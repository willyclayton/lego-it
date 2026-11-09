import { BRICKS_BY_SIZE, PLATES_BY_SIZE, TILES_BY_SIZE } from './parts';
import type { Placement, Rot } from './types';

type RectKind = 'brick' | 'plate' | 'tile';
const TABLE: Record<RectKind, Record<string, string>> = {
  brick: BRICKS_BY_SIZE,
  plate: PLATES_BY_SIZE,
  tile: TILES_BY_SIZE,
};

export interface AddOpts {
  phase?: number;
  sub?: string;
}

/** Imperative helper for hand-designed models. */
export class ModelBuilder {
  readonly out: Placement[] = [];
  phase = 0;
  sub: string | undefined;

  add(part: string, color: string, x: number, y: number, z: number, rot: Rot = 0, opts: AddOpts = {}): this {
    this.out.push({
      part,
      color,
      x,
      y,
      z,
      rot,
      phase: opts.phase ?? this.phase,
      sub: opts.sub ?? this.sub,
    });
    return this;
  }

  /** Place a rectangular brick/plate/tile of size sx (along x) by sz (along z). */
  rect(kind: RectKind, color: string, x: number, y: number, z: number, sx: number, sz: number, opts?: AddOpts): this {
    const key = `${Math.min(sx, sz)}x${Math.max(sx, sz)}`;
    const id = TABLE[kind][key];
    if (!id) throw new Error(`No ${kind} of size ${key}`);
    // Catalog parts have w <= l, so a part longer along x needs a quarter turn.
    const rot: Rot = sx > sz ? 1 : 0;
    return this.add(id, color, x, y, z, rot, opts);
  }

  brick(color: string, x: number, y: number, z: number, sx: number, sz: number, opts?: AddOpts) {
    return this.rect('brick', color, x, y, z, sx, sz, opts);
  }
  plate(color: string, x: number, y: number, z: number, sx: number, sz: number, opts?: AddOpts) {
    return this.rect('plate', color, x, y, z, sx, sz, opts);
  }
  tile(color: string, x: number, y: number, z: number, sx: number, sz: number, opts?: AddOpts) {
    return this.rect('tile', color, x, y, z, sx, sz, opts);
  }

  /** Run `fn` with a temporary phase / sub-assembly. */
  group(opts: AddOpts, fn: () => void): this {
    const prev = { phase: this.phase, sub: this.sub };
    if (opts.phase !== undefined) this.phase = opts.phase;
    if ('sub' in opts) this.sub = opts.sub;
    fn();
    this.phase = prev.phase;
    this.sub = prev.sub;
    return this;
  }

  /** Append placements from elsewhere (e.g. the voxel converter). */
  push(ps: Placement[], opts: AddOpts = {}): this {
    for (const p of ps) this.out.push({ ...p, phase: opts.phase ?? p.phase ?? this.phase, sub: opts.sub ?? p.sub ?? this.sub });
    return this;
  }
}

/** Sizes available for greedy rectangle filling, largest first. */
export const RECT_SIZES: Record<RectKind, [number, number][]> = {
  brick: [
    [2, 10], [2, 8], [2, 6], [2, 4], [2, 3], [2, 2], [1, 8], [1, 6], [1, 4], [1, 3], [1, 2], [1, 1],
  ],
  plate: [
    [16, 16], [8, 16], [8, 8], [6, 10], [6, 8], [6, 6], [4, 10], [4, 8], [4, 6], [4, 4], [2, 10], [2, 8],
    [2, 6], [2, 4], [2, 3], [2, 2], [1, 8], [1, 6], [1, 4], [1, 3], [1, 2], [1, 1],
  ],
  tile: [[2, 4], [2, 2], [1, 6], [1, 4], [1, 3], [1, 2], [1, 1]],
};
