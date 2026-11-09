import { RECT_SIZES } from './builder';
import { BRICKS_BY_SIZE, PLATES_BY_SIZE, TILES_BY_SIZE } from './parts';
import type { Placement, Rot } from './types';

/** Height of one plate in stud units (3.2 mm / 8 mm). */
export const PLATE_H = 0.4;

type Mode = 'add' | 'paint' | 'carve';
const OFF = 512;
const key = (x: number, y: number, z: number) => x + OFF + (z + OFF) * 1024 + (y + OFF) * 1048576;
const unkey = (k: number): [number, number, number] => {
  const x = (k % 1024) - OFF;
  const z = (Math.floor(k / 1024) % 1024) - OFF;
  const y = Math.floor(k / 1048576) - OFF;
  return [x, y, z];
};

/**
 * A voxel grid at LEGO resolution: one cell = 1 x 1 stud footprint x 1 plate tall.
 * Shape helpers take x/z in studs and y in plates; round shapes are evaluated in
 * true proportions (1 plate = 0.4 stud) so spheres and cylinders look round.
 */
export class VoxelGrid {
  cells = new Map<number, string>();

  set(x: number, y: number, z: number, color: string | null, mode: Mode = 'add') {
    const k = key(x, y, z);
    if (mode === 'carve' || color === null) {
      this.cells.delete(k);
    } else if (mode === 'paint') {
      if (this.cells.has(k)) this.cells.set(k, color);
    } else {
      this.cells.set(k, color);
    }
  }

  get(x: number, y: number, z: number) {
    return this.cells.get(key(x, y, z));
  }

  has(x: number, y: number, z: number) {
    return this.cells.has(key(x, y, z));
  }

  forEach(fn: (x: number, y: number, z: number, color: string) => void) {
    for (const [k, c] of this.cells) {
      const [x, y, z] = unkey(k);
      fn(x, y, z, c);
    }
  }

  get size() {
    return this.cells.size;
  }

  /**
   * Evaluate an implicit shape over integer cell bounds [x0,x1) [y0,y1) [z0,z1).
   * `test` receives cell-center coordinates (x, z in studs; y in plates).
   */
  shape(
    bounds: [number, number, number, number, number, number],
    test: (x: number, y: number, z: number) => boolean,
    color: string | null,
    mode: Mode = 'add',
  ) {
    const [x0, y0, z0, x1, y1, z1] = bounds.map(Math.round) as typeof bounds;
    for (let y = y0; y < y1; y++)
      for (let z = z0; z < z1; z++)
        for (let x = x0; x < x1; x++) if (test(x + 0.5, y + 0.5, z + 0.5)) this.set(x, y, z, color, mode);
    return this;
  }

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: string | null, mode: Mode = 'add') {
    return this.shape([x0, y0, z0, x1, y1, z1], () => true, color, mode);
  }

  /** Ellipsoid: center (cx, cz in studs; cy in plates), radii rx, rz in studs and ry in plates. */
  ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, color: string | null, mode: Mode = 'add') {
    return this.shape(
      [Math.floor(cx - rx), Math.floor(cy - ry), Math.floor(cz - rz), Math.ceil(cx + rx), Math.ceil(cy + ry), Math.ceil(cz + rz)],
      (x, y, z) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1,
      color,
      mode,
    );
  }

  /** True sphere of radius r studs. */
  sphere(cx: number, cy: number, cz: number, r: number, color: string | null, mode: Mode = 'add') {
    return this.ellipsoid(cx, cy, cz, r, r / PLATE_H, r, color, mode);
  }

  /** Vertical cylinder / frustum from y0 to y1 (plates), radius r0 at the bottom and r1 at the top (studs). */
  cylinderY(cx: number, cz: number, y0: number, y1: number, r0: number, color: string | null, mode: Mode = 'add', r1 = r0) {
    const r = Math.max(r0, r1);
    return this.shape(
      [Math.floor(cx - r), y0, Math.floor(cz - r), Math.ceil(cx + r), y1, Math.ceil(cz + r)],
      (x, y, z) => {
        const t = (y - y0) / Math.max(1e-6, y1 - y0);
        const rr = r0 + (r1 - r0) * t;
        return (x - cx) ** 2 + (z - cz) ** 2 <= rr * rr;
      },
      color,
      mode,
    );
  }

  /** Horizontal cylinder along z, center (cx studs, cy plates), radius r studs, from z0 to z1 (with optional taper). */
  cylinderZ(cx: number, cy: number, z0: number, z1: number, r0: number, color: string | null, mode: Mode = 'add', r1 = r0) {
    const r = Math.max(r0, r1);
    const ry = r / PLATE_H;
    return this.shape(
      [Math.floor(cx - r), Math.floor(cy - ry), z0, Math.ceil(cx + r), Math.ceil(cy + ry), z1],
      (x, y, z) => {
        const t = (z - z0) / Math.max(1e-6, z1 - z0);
        const rr = r0 + (r1 - r0) * t;
        return (x - cx) ** 2 + ((y - cy) * PLATE_H) ** 2 <= rr * rr;
      },
      color,
      mode,
    );
  }

  /** Horizontal cylinder along x. */
  cylinderX(cz: number, cy: number, x0: number, x1: number, r0: number, color: string | null, mode: Mode = 'add', r1 = r0) {
    const r = Math.max(r0, r1);
    const ry = r / PLATE_H;
    return this.shape(
      [x0, Math.floor(cy - ry), Math.floor(cz - r), x1, Math.ceil(cy + ry), Math.ceil(cz + r)],
      (x, y, z) => {
        const t = (x - x0) / Math.max(1e-6, x1 - x0);
        const rr = r0 + (r1 - r0) * t;
        return (z - cz) ** 2 + ((y - cy) * PLATE_H) ** 2 <= rr * rr;
      },
      color,
      mode,
    );
  }

  /** Mirror every cell across the plane x = mx (in stud coordinates, e.g. the model's center line). */
  mirrorX(mx: number) {
    const add: [number, number, number, string][] = [];
    this.forEach((x, y, z, c) => add.push([Math.round(2 * mx - x - 1), y, z, c]));
    for (const [x, y, z, c] of add) this.set(x, y, z, c);
    return this;
  }

  bounds() {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    this.forEach((x, y, z) => {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z);
      x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); z1 = Math.max(z1, z + 1);
    });
    return { x0, y0, z0, x1, y1, z1 };
  }

  /** Remove interior cells more than `shell` cells away from any empty neighbor (saves parts in huge models). */
  hollow(shell = 2) {
    let interior = new Set<number>();
    const surface = new Set<number>();
    for (const k of this.cells.keys()) {
      const [x, y, z] = unkey(k);
      const n = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      if (n.some(([dx, dy, dz]) => !this.has(x + dx, y + dy, z + dz))) surface.add(k);
      else interior.add(k);
    }
    for (let i = 1; i < shell; i++) {
      const next = new Set<number>();
      for (const k of interior) {
        const [x, y, z] = unkey(k);
        const n = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
        if (n.some(([dx, dy, dz]) => surface.has(key(x + dx, y + dy, z + dz)))) surface.add(k);
        else next.add(k);
      }
      interior = next;
    }
    // Keep interior cells that lie directly under the top surface so roofs stay supported.
    for (const k of interior) this.cells.delete(k);
    return this;
  }
}

export interface BrickifyOpts {
  /** Merge 3-plate-tall uniform columns into bricks (default true). */
  bricks?: boolean;
  /** Use tiles (no studs) on exposed top surfaces of plate layers. */
  tilesOnTop?: boolean;
  /** Colors that should always be tiled on top (e.g. decorative panels). */
  phase?: number;
  sub?: string;
}

const rectId = (kind: 'brick' | 'plate' | 'tile', a: number, b: number) => {
  const k = `${Math.min(a, b)}x${Math.max(a, b)}`;
  return kind === 'brick' ? BRICKS_BY_SIZE[k] : kind === 'plate' ? PLATES_BY_SIZE[k] : TILES_BY_SIZE[k];
};

const k2 = (x: number, z: number) => (x + OFF) + (z + OFF) * 1024;

/**
 * Convert voxels into a buildable list of bricks, plates and tiles.
 * Greedy largest-part-first packing per layer, alternating the preferred
 * orientation every layer and rewarding parts that bridge seams below
 * (a running-bond pattern), which keeps the model structurally sound.
 */
export function brickify(grid: VoxelGrid, opts: BrickifyOpts = {}): Placement[] {
  const useBricks = opts.bricks ?? true;
  const out: Placement[] = [];
  if (grid.size === 0) return out;
  const { y0, y1 } = grid.bounds();
  /** cell → index of placement occupying it (for seam scoring). */
  const occ = new Map<number, number>();
  const consumed = new Set<number>();

  const pack = (cells: Map<number, string>, kind: 'brick' | 'plate' | 'tile', y: number, h: number, layerParity: number) => {
    const sizes = RECT_SIZES[kind];
    const pts = [...cells.keys()].map((k) => [(k % 1024) - OFF, Math.floor(k / 1024) - OFF] as [number, number]);
    const alongX = layerParity % 2 === 0;
    pts.sort((a, b) => (alongX ? a[1] - b[1] || a[0] - b[0] : a[0] - b[0] || a[1] - b[1]));
    const filled = new Set<number>();
    for (const [x, z] of pts) {
      const ck = k2(x, z);
      if (filled.has(ck)) continue;
      const col = cells.get(ck)!;
      let best: { sx: number; sz: number; score: number } | null = null;
      for (const [a, b] of sizes) {
        const orients: [number, number][] = a === b ? [[a, b]] : alongX ? [[b, a], [a, b]] : [[a, b], [b, a]];
        for (const [sx, sz] of orients) {
          if (!rectId(kind, sx, sz)) continue;
          if (best && sx * sz * 10 + 9 < best.score) continue;
          let ok = true;
          const below = new Set<number>();
          for (let dz = 0; dz < sz && ok; dz++)
            for (let dx = 0; dx < sx && ok; dx++) {
              const kk = k2(x + dx, z + dz);
              if (filled.has(kk) || cells.get(kk) !== col) ok = false;
              else {
                const b = occ.get(key(x + dx, y - 1, z + dz));
                if (b !== undefined) below.add(b);
              }
            }
          if (!ok) continue;
          // Prefer larger parts; among equals prefer bridging several parts below and the layer's orientation.
          const orientBonus = (alongX ? sx >= sz : sz >= sx) ? 1 : 0;
          const score = sx * sz * 10 + Math.min(below.size, 4) * 2 + orientBonus;
          if (!best || score > best.score) best = { sx, sz, score };
        }
      }
      if (!best) continue;
      const idx = out.length;
      const id = rectId(kind, best.sx, best.sz)!;
      const rot: Rot = best.sx > best.sz ? 1 : 0;
      out.push({ part: id, color: col, x, y, z, rot, phase: opts.phase, sub: opts.sub });
      for (let dz = 0; dz < best.sz; dz++)
        for (let dx = 0; dx < best.sx; dx++) {
          filled.add(k2(x + dx, z + dz));
          for (let dy = 0; dy < h; dy++) occ.set(key(x + dx, y + dy, z + dz), idx);
        }
    }
  };

  // brick courses are aligned to the bottom of the shape
  const start = y0;
  for (let base = start; base < y1; base += 3) {
    const parity = Math.floor((base - start) / 3);
    if (useBricks) {
      const bc = new Map<number, string>();
      grid.forEach((x, y, z, c) => {
        if (y !== base) return;
        if (grid.get(x, y + 1, z) === c && grid.get(x, y + 2, z) === c) bc.set(k2(x, z), c);
      });
      for (const kk of bc.keys()) {
        const x = (kk % 1024) - OFF, z = Math.floor(kk / 1024) - OFF;
        for (let dy = 0; dy < 3; dy++) consumed.add(key(x, base + dy, z));
      }
      pack(bc, 'brick', base, 3, parity);
    }
    for (let y = base; y < base + 3; y++) {
      const plates = new Map<number, string>();
      const tiles = new Map<number, string>();
      grid.forEach((x, yy, z, c) => {
        if (yy !== y || consumed.has(key(x, y, z))) return;
        if (opts.tilesOnTop && !grid.has(x, y + 1, z)) tiles.set(k2(x, z), c);
        else plates.set(k2(x, z), c);
      });
      pack(plates, 'plate', y, 1, parity + (y - base));
      pack(tiles, 'tile', y, 1, parity + (y - base));
    }
  }
  return out;
}
