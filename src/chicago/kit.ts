import { ModelBuilder } from '../lego/builder';
import { footprint, part } from '../lego/parts';
import { compileGrid } from '../lego/shapes';
import type { ModelSource, Placement, Rot } from '../lego/types';
import { VoxelGrid } from '../lego/voxel';

/**
 * Tools for architectural models. Coordinates: x, z in studs, y in plates.
 * The display base occupies y = 0 (one plate); buildings start at y = 1.
 * The model's front (+z) is where the nameplate sits.
 */

export interface BuildingInfo {
  year: string;
  architect: string;
  height: string; // human-readable, e.g. "442 m · 1,451 ft"
  heightM: number; // for sorting and the skyline
  floors?: number;
  style: string;
  location: string;
  fact: string;
  scale: string; // e.g. "1:950"
}

export type Dir = 'N' | 'S' | 'E' | 'W';
export interface FaceCell {
  x: number;
  y: number;
  z: number;
  dir: Dir;
  /** position along the face (x for N/S faces, z for E/W faces) */
  u: number;
  /** position along the face relative to that face's extent at this height (0 at its left end) */
  i: number;
  /** length of that face run at this height */
  n: number;
}
type FaceFn = (c: FaceCell) => string | null | undefined | 'carve';

export class Grid {
  g = new VoxelGrid();

  rect(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, c: string | null) {
    this.g.box(x0, y0, z0, x1, y1, z1, c, c === null ? 'carve' : 'add');
    return this;
  }

  /** Any footprint given by an inside test on cell centers (x, z), for y0..y1. */
  shape(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, inside: (x: number, z: number, y: number) => boolean, c: string | null) {
    this.g.shape([x0, y0, z0, x1, y1, z1], (x, y, z) => inside(x, z, y - 0.5), c, c === null ? 'carve' : 'add');
    return this;
  }

  /** Vertical cylinder (radius in studs) centred on (cx, cz). */
  cyl(cx: number, cz: number, r: number, y0: number, y1: number, c: string | null, r1 = r) {
    this.g.cylinderY(cx, cz, y0, y1, r, c, c === null ? 'carve' : 'add', r1);
    return this;
  }

  /** Pyramid / hip from a rectangle up to a ridge or point, one stud in per `rise` plates. */
  pyramid(x0: number, z0: number, x1: number, z1: number, y0: number, rise: number, c: string) {
    let [a, b, cc, d] = [x0, z0, x1, z1];
    let y = y0;
    while (a < cc && b < d) {
      this.rect(a, b, cc, d, y, y + rise, c);
      y += rise;
      a++; b++; cc--; d--;
    }
    return y;
  }

  /** Recolor every filled cell that passes the test. */
  paint(test: (x: number, y: number, z: number) => boolean, c: string) {
    this.g.forEach((x, y, z) => {
      if (test(x, y, z)) this.g.set(x, y, z, c);
    });
    return this;
  }

  /**
   * Paint or carve the outer walls. `fn` sees every exposed wall cell in y0..y1
   * with its facing direction and its position along that face.
   */
  facade(y0: number, y1: number, fn: FaceFn) {
    const changes: [number, number, number, string | null][] = [];
    const runs = new Map<string, [number, number]>();
    // measure face runs per (dir, y, plane) so patterns can be centred on each face
    const cells: FaceCell[] = [];
    this.g.forEach((x, y, z) => {
      if (y < y0 || y >= y1) return;
      let dir: Dir | null = null;
      if (!this.g.has(x, y, z + 1)) dir = 'S';
      else if (!this.g.has(x, y, z - 1)) dir = 'N';
      else if (!this.g.has(x + 1, y, z)) dir = 'E';
      else if (!this.g.has(x - 1, y, z)) dir = 'W';
      if (!dir) return;
      const u = dir === 'S' || dir === 'N' ? x : z;
      const plane = dir === 'S' || dir === 'N' ? z : x;
      const k = `${dir}|${y}|${plane}`;
      const r = runs.get(k);
      if (!r) runs.set(k, [u, u]);
      else runs.set(k, [Math.min(r[0], u), Math.max(r[1], u)]);
      cells.push({ x, y, z, dir, u, i: 0, n: 0 });
    });
    for (const c of cells) {
      const plane = c.dir === 'S' || c.dir === 'N' ? c.z : c.x;
      const [a, b] = runs.get(`${c.dir}|${c.y}|${plane}`)!;
      c.i = c.u - a;
      c.n = b - a + 1;
      const r = fn(c);
      if (r === 'carve') changes.push([c.x, c.y, c.z, null]);
      else if (r) changes.push([c.x, c.y, c.z, r]);
    }
    for (const [x, y, z, c] of changes) this.g.set(x, y, z, c, c === null ? 'carve' : 'add');
    return this;
  }

  has(x: number, y: number, z: number) {
    return this.g.has(x, y, z);
  }

  /** Highest filled plate + 1 in a column (0 if empty). */
  top(x: number, z: number) {
    let t = 0;
    this.g.forEach((cx, cy, cz) => {
      if (cx === x && cz === z) t = Math.max(t, cy + 1);
    });
    return t;
  }
}

export interface CompileOptions {
  /** Ground layers give way to anything else built in the same spot. */
  ground?: boolean;
  tall?: boolean;
  tilesOnTop?: boolean;
  slopes?: boolean;
  texture?: Record<string, 'masonry' | 'grille'>;
  phase?: number;
  sub?: string;
}

export class Kit {
  readonly b = new ModelBuilder();
  private grids: { grid: Grid; opts: CompileOptions }[] = [];

  /** A voxel grid compiled with its own options (e.g. tiled plaza vs studded tower). */
  grid(opts: CompileOptions = {}) {
    const grid = new Grid();
    this.grids.push({ grid, opts });
    return grid;
  }

  /**
   * The display base: a one-plate black base with a smooth nameplate strip at
   * the front, and an optional plaza/ground grid on top.
   */
  base(w: number, d: number, opts: { ground?: string; nameplate?: number } = {}) {
    const base = this.grid({ phase: 0 });
    base.rect(0, 0, w, d, 0, 1, 'black');
    const np = opts.nameplate ?? 2;
    const plate = this.grid({ phase: 0, tilesOnTop: true, ground: true });
    plate.rect(1, d - np, w - 1, d, 1, 2, 'black');
    if (opts.ground) {
      const ground = this.grid({ phase: 0, tilesOnTop: true, ground: true });
      ground.rect(0, 0, w, d - np, 1, 2, opts.ground);
      return ground;
    }
    return null;
  }

  add(part: string, color: string, x: number, y: number, z: number, rot: Rot = 0, phase = 2, sub?: string) {
    this.b.add(part, color, x, y, z, rot, { phase, sub });
    return this;
  }

  /** A slim spire: stacked 1x1 round bricks topped with an antenna or bar. */
  spire(x: number, y: number, z: number, color: string, rounds: number, tip: '3957' | '2569' | '63965', tipColor = color, phase = 3) {
    let yy = y;
    for (let i = 0; i < rounds; i++, yy += 3) this.add('3062b', color, x, yy, z, 0, phase);
    this.add(tip, tipColor, x, yy, z, 0, phase);
    return this;
  }

  compile(): Placement[] {
    const out: Placement[] = [];
    // Everything that is not a ground layer claims its cells; ground layers make way,
    // and tiles under anything become studded plates so the parts above can attach.
    const OFF = 512;
    const ck = (x: number, y: number, z: number) => x + OFF + (z + OFF) * 1024 + (y + OFF) * 1048576;
    const occ = new Set<number>();
    for (const { grid, opts } of this.grids) if (!opts.ground) grid.g.forEach((x, y, z) => occ.add(ck(x, y, z)));
    for (const p of this.b.out) {
      const def = part(p.part);
      const [sx, sz] = footprint(def, p.rot);
      const y0 = Math.floor(p.y);
      for (let dz = 0; dz < Math.max(1, Math.round(sz)); dz++)
        for (let dx = 0; dx < Math.max(1, Math.round(sx)); dx++) occ.add(ck(Math.floor(p.x) + dx, y0, Math.floor(p.z) + dz));
    }
    // later ground layers (a river, a path) win over earlier ones (the plaza)
    for (const { grid, opts } of [...this.grids].reverse()) {
      if (!opts.ground) continue;
      const drop: [number, number, number][] = [];
      grid.g.forEach((x, y, z) => {
        if (occ.has(ck(x, y, z))) drop.push([x, y, z]);
      });
      for (const [x, y, z] of drop) grid.g.set(x, y, z, null);
      grid.g.forEach((x, y, z) => occ.add(ck(x, y, z)));
    }
    const covered = (x: number, y: number, z: number) => occ.has(ck(x, y, z));
    for (const { grid, opts } of this.grids) {
      out.push(
        ...compileGrid(grid.g, {
          offset: [0, 0, 0],
          tall: opts.tall,
          tilesOnTop: opts.tilesOnTop,
          slopes: opts.slopes,
          texture: opts.texture,
          keepFragments: true,
          covered,
          phase: opts.phase ?? 1,
          sub: opts.sub,
        }),
      );
    }
    out.push(...this.b.out);
    return out;
  }
}

export interface ChicagoSource extends ModelSource {
  info: BuildingInfo;
}

/** Floor number → plate height, given total floors and the plates they occupy. */
export const floorY = (floor: number, floors: number, plates: number, y0 = 1) => y0 + Math.round((floor / floors) * plates);
