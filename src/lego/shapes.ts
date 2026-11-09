import { COLORS } from './colors';
import { footprint, part } from './parts';
import type { Placement, Rot } from './types';
import { brickify, PLATE_H, VoxelGrid } from './voxel';

/**
 * Shape programs: a model described as an ordered list of solid primitives.
 * This is the format Claude generates for "LEGO anything", and several built-in
 * samples use it too, so both paths share the same voxel → brick pipeline.
 *
 * Units are studs on every axis (1 stud = 8 mm). y is up, y = 0 is the ground.
 * x = 0, z = 0 is the model's center line. The model's front faces +z.
 */
export type ShapeKind = 'box' | 'ellipsoid' | 'cylinder' | 'wedge' | 'torus';
export type ShapeOp = 'add' | 'subtract' | 'paint';

export interface ShapeSpec {
  label?: string;
  shape: ShapeKind;
  op: ShapeOp;
  center: [number, number, number];
  size: [number, number, number];
  rot?: [number, number, number];
  /** Scale of the top end relative to the bottom (cylinder → cone, box → pyramid). 1 = none. */
  taper?: number;
  color: string;
  mirror_x?: boolean;
}

export interface ShapeProgram {
  title: string;
  description?: string;
  features?: string[];
  parts: ShapeSpec[];
}

export interface CompileOpts {
  /** Replace stair-steps on top surfaces with 45° slopes. */
  slopes?: boolean;
  /** Use tiles on exposed top surfaces of plate layers. */
  tilesOnTop?: boolean;
  /** Remove interior voxels (keeps a shell) to save parts on big models. */
  hollow?: number;
  phase?: number;
  sub?: string;
  /** Grid offset added to every placement (stud/plate units). */
  offset?: [number, number, number];
  /** Tall bricks on outer walls; textured bricks by color (see brickify). */
  tall?: boolean;
  texture?: Record<string, 'masonry' | 'grille'>;
  /** Keep small detached fragments (details that sit on another grid). */
  keepFragments?: boolean;
  covered?: (x: number, y: number, z: number) => boolean;
}

const ALIASES: Record<string, string> = {
  gray: 'lbg', grey: 'lbg', 'light-gray': 'lbg', 'light-grey': 'lbg', 'light-bluish-gray': 'lbg', 'light-bluish-grey': 'lbg',
  'dark-gray': 'dbg', 'dark-grey': 'dbg', 'dark-bluish-gray': 'dbg', 'dark-bluish-grey': 'dbg',
  brown: 'reddish-brown', 'light-orange': 'blo', 'bright-light-orange': 'blo', gold: 'pearl-gold', silver: 'flat-silver',
  'trans-blue': 'trans-light-blue', glass: 'trans-clear', 'trans-clear': 'trans-clear', azure: 'medium-azure',
  purple: 'lavender', 'medium-lavender': 'lavender', 'bright-pink': 'pink', 'olive-green': 'olive', 'earth-green': 'dark-green',
};

export function resolveColor(name: string): string | null {
  const n = name.trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (n === 'none' || n === '') return null;
  if (COLORS[n]) return n;
  if (ALIASES[n]) return ALIASES[n];
  for (const c of Object.values(COLORS)) if (c.name.toLowerCase().replace(/\s+/g, '-') === n) return c.key;
  return 'lbg';
}

function rotMatrix([rx, ry, rz]: [number, number, number]) {
  const [a, b, c] = [rx, ry, rz].map((d) => (d * Math.PI) / 180);
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
  // R = Rz * Ry * Rx (XYZ euler), row-major 3x3
  return [
    cb * cc, sa * sb * cc - ca * sc, ca * sb * cc + sa * sc,
    cb * sc, sa * sb * sc + ca * cc, ca * sb * sc - sa * cc,
    -sb, sa * cb, ca * cb,
  ];
}

function insideFn(s: ShapeSpec) {
  const [hx, hy, hz] = s.size.map((v) => Math.max(0.05, Math.abs(v) / 2));
  const taper = s.taper ?? 1;
  const k = (qy: number) => 1 + (taper - 1) * Math.min(1, Math.max(0, (qy + hy) / (2 * hy)));
  switch (s.shape) {
    case 'box':
      return (x: number, y: number, z: number) => {
        if (Math.abs(y) > hy) return false;
        const kk = k(y);
        return Math.abs(x) <= hx * kk && Math.abs(z) <= hz * kk;
      };
    case 'ellipsoid':
      return (x: number, y: number, z: number) => (x / hx) ** 2 + (y / hy) ** 2 + (z / hz) ** 2 <= 1;
    case 'cylinder':
      return (x: number, y: number, z: number) => {
        if (Math.abs(y) > hy) return false;
        const kk = Math.max(1e-3, k(y));
        return (x / (hx * kk)) ** 2 + (z / (hz * kk)) ** 2 <= 1;
      };
    case 'wedge':
      // full height at the back (-z), down to nothing at the front (+z)
      return (x: number, y: number, z: number) => {
        if (Math.abs(x) > hx || Math.abs(z) > hz || Math.abs(y) > hy) return false;
        const top = hy - ((z + hz) / (2 * hz)) * 2 * hy;
        return y <= top;
      };
    case 'torus': {
      const r = hy;
      const R = Math.max(r, (hx + hz) / 2 - r);
      return (x: number, y: number, z: number) => (Math.hypot(x, z) - R) ** 2 + y * y <= r * r;
    }
  }
}

/** Evaluate a shape program into a voxel grid (cells: 1 x 1 stud x 1 plate). */
export function voxelize(program: ShapeProgram, grid = new VoxelGrid()): VoxelGrid {
  const specs: ShapeSpec[] = [];
  for (const s of program.parts) {
    specs.push(s);
    if (s.mirror_x) {
      const r = s.rot ?? [0, 0, 0];
      specs.push({ ...s, mirror_x: false, center: [-s.center[0], s.center[1], s.center[2]], rot: [r[0], -r[1], -r[2]] });
    }
  }
  for (const s of specs) {
    const color = s.op === 'subtract' ? null : resolveColor(s.color);
    if (s.op !== 'subtract' && !color) continue;
    const R = rotMatrix(s.rot ?? [0, 0, 0]);
    const inside = insideFn(s);
    const [cx, cy, cz] = s.center;
    const [hx, hy, hz] = s.size.map((v) => Math.abs(v) / 2);
    // world AABB of the rotated box
    let ex = 0, ey = 0, ez = 0;
    for (let i = 0; i < 3; i++) {
      ex += Math.abs(R[i]) * [hx, hy, hz][i];
      ey += Math.abs(R[3 + i]) * [hx, hy, hz][i];
      ez += Math.abs(R[6 + i]) * [hx, hy, hz][i];
    }
    const x0 = Math.floor(cx - ex), x1 = Math.ceil(cx + ex);
    const z0 = Math.floor(cz - ez), z1 = Math.ceil(cz + ez);
    const y0 = Math.floor((cy - ey) / PLATE_H), y1 = Math.ceil((cy + ey) / PLATE_H);
    const thin = Math.min(hx, hy, hz) < 0.75;
    const test = (px: number, py: number, pz: number) => {
      const dx = px - cx, dy = py - cy, dz = pz - cz;
      // inverse rotation = transpose
      const qx = R[0] * dx + R[3] * dy + R[6] * dz;
      const qy = R[1] * dx + R[4] * dy + R[7] * dz;
      const qz = R[2] * dx + R[5] * dy + R[8] * dz;
      return inside(qx, qy, qz);
    };
    const mode = s.op === 'subtract' ? 'carve' : s.op === 'paint' ? 'paint' : 'add';
    for (let y = Math.max(0, y0); y < y1; y++)
      for (let z = z0; z < z1; z++)
        for (let x = x0; x < x1; x++) {
          const px = x + 0.5, py = (y + 0.5) * PLATE_H, pz = z + 0.5;
          let hit = test(px, py, pz);
          if (!hit && thin) {
            // thin features: count the cell if any sub-sample is inside so they don't vanish
            for (const [ox, oy, oz] of [[-0.3, -0.12, -0.3], [0.3, 0.12, 0.3], [-0.3, 0.12, 0.3], [0.3, -0.12, -0.3]])
              if (test(px + ox, py + oy, pz + oz)) { hit = true; break; }
          }
          if (hit) grid.set(x, y, z, color, mode);
        }
  }
  return grid;
}

/** Drop tiny floating fragments (and anything not connected to the main body). */
export function removeFloating(grid: VoxelGrid, minKeep = 6) {
  const seen = new Set<string>();
  const comps: [number, number, number][][] = [];
  grid.forEach((x, y, z) => {
    const k0 = `${x},${y},${z}`;
    if (seen.has(k0)) return;
    const comp: [number, number, number][] = [];
    const stack: [number, number, number][] = [[x, y, z]];
    seen.add(k0);
    while (stack.length) {
      const [a, b, c] = stack.pop()!;
      comp.push([a, b, c]);
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const n = [a + dx, b + dy, c + dz] as [number, number, number];
        const kk = n.join(',');
        if (!seen.has(kk) && grid.has(...n)) {
          seen.add(kk);
          stack.push(n);
        }
      }
    }
    comps.push(comp);
  });
  if (comps.length <= 1) return grid;
  comps.sort((a, b) => b.length - a.length);
  for (const comp of comps.slice(1)) {
    if (comp.length < minKeep) for (const [x, y, z] of comp) grid.set(x, y, z, null);
  }
  return grid;
}

/**
 * Cosmetic slope pass: where a top surface steps down by exactly one brick,
 * replace the edge column with a 45° slope that ramps over the step.
 * Removes the edge voxels from the grid and returns slope placements.
 */
export function slopePass(grid: VoxelGrid): Placement[] {
  const out: Placement[] = [];
  const claimed = new Set<string>();
  const ck = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const { x0, x1, y0, y1, z0, z1 } = grid.bounds();
  const colOK = (x: number, base: number, z: number) => {
    const c = grid.get(x, base, z);
    return c && grid.get(x, base + 1, z) === c && grid.get(x, base + 2, z) === c && !grid.has(x, base + 3, z) && !claimed.has(ck(x, base, z)) ? c : null;
  };
  const dirs: { d: [number, number]; rot: Rot }[] = [
    { d: [0, 1], rot: 0 },
    { d: [1, 0], rot: 1 },
    { d: [0, -1], rot: 2 },
    { d: [-1, 0], rot: 3 },
  ];
  const start = y0 + 3;
  for (let base = start; base < y1; base += 3) {
    for (const { d, rot } of dirs) {
      const along: [number, number] = [Math.abs(d[1]), Math.abs(d[0])]; // edge direction
      const candidate = (x: number, z: number) => {
        const c = colOK(x, base, z);
        if (!c) return null;
        const bx = x + d[0], bz = z + d[1];
        for (let dy = 0; dy < 6; dy++) if (grid.has(bx, base + dy, bz) || claimed.has(ck(bx, base + dy, bz))) return null;
        if (!grid.has(bx, base - 1, bz)) return null; // the step below must support the slope
        // the cell behind the edge should be part of the body (avoid slopes on 1-wide ridges)
        if (!grid.has(x - d[0], base, z - d[1])) return null;
        return c;
      };
      for (let z = z0; z < z1; z++)
        for (let x = x0; x < x1; x++) {
          const c = candidate(x, z);
          if (!c) continue;
          // extend along the edge for wider slopes
          let n = 1;
          while (n < 4 && candidate(x + along[0] * n, z + along[1] * n) === c) n++;
          if (n === 3 && !candidate(x + along[0] * 3, z + along[1] * 3)) n = 3;
          const id = n >= 4 ? '3037' : n === 3 ? '3038' : n === 2 ? '3039' : '3040';
          const w = n >= 4 ? 4 : n;
          for (let i = 0; i < w; i++) {
            const ax = x + along[0] * i, az = z + along[1] * i;
            for (let dy = 0; dy < 3; dy++) {
              grid.set(ax, base + dy, az, null);
              claimed.add(ck(ax, base + dy, az));
              claimed.add(ck(ax + d[0], base + dy, az + d[1]));
            }
          }
          // footprint min corner: back row = edge cells, front row = step cells
          const fx = Math.min(x, x + d[0]);
          const fz = Math.min(z, z + d[1]);
          const def = part(id);
          const [sx, sz] = footprint(def, rot);
          void sx; void sz;
          out.push({ part: id, color: c, x: fx, y: base, z: fz, rot });
        }
    }
  }
  return out;
}

/** Shape program → placements (grid starts at x, z ≥ 0). */
export function compileProgram(program: ShapeProgram, opts: CompileOpts = {}): Placement[] {
  const grid = voxelize(program);
  return compileGrid(grid, opts);
}

export function compileGrid(grid: VoxelGrid, opts: CompileOpts = {}): Placement[] {
  if (!opts.keepFragments) removeFloating(grid);
  if (grid.size === 0) return [];
  const b = grid.bounds();
  const [ox, oy, oz] = opts.offset ?? [-b.x0, 0, -b.z0];
  if (opts.hollow) grid.hollow(opts.hollow);
  const slopes = opts.slopes ? slopePass(grid) : [];
  const bricks = brickify(grid, { tilesOnTop: opts.tilesOnTop, tall: opts.tall, texture: opts.texture, covered: opts.covered });
  return [...bricks, ...slopes].map((p) => ({
    ...p,
    x: p.x + ox,
    y: p.y + oy,
    z: p.z + oz,
    phase: opts.phase ?? p.phase,
    sub: opts.sub ?? p.sub,
  }));
}
