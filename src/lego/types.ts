/**
 * Grid conventions used throughout Lego It:
 *   x  → studs (left/right)
 *   z  → studs (front/back; +z is the model's "front")
 *   y  → plates (1 brick = 3 plates); y = 0 is the ground
 *
 * A placement's (x, y, z) is the minimum corner of its footprint.
 * Rotation is a quarter-turn count around the vertical axis (0..3).
 * At rot 0 a part's width runs along +x and its length along +z;
 * slopes descend toward +z (they "face" the front).
 */

export type Rot = 0 | 1 | 2 | 3;

export interface Placement {
  part: string; // part id, e.g. "3001"
  color: string; // color key, e.g. "red"
  x: number;
  y: number;
  z: number;
  rot: Rot;
  /** Ordering hint: lower phases are built first (default 0). */
  phase?: number;
  /** Name of a sub-assembly this part belongs to (built separately, then attached). */
  sub?: string;
}

export interface Brick extends Placement {
  id: number;
  step: number; // index into Model.steps
}

export interface Step {
  index: number;
  bricks: number[]; // brick ids added in this step
  /** Camera azimuth (degrees) suggested for this step. */
  view: number;
  /** True when the view changed vs. the previous step (draw the "rotate model" icon). */
  rotated: boolean;
  /** Sub-assembly name if this step builds part of a sub-assembly. */
  sub?: string;
  /** Sub-assembly attached to the main model in this step. */
  attaches?: string;
  bag: number;
}

export interface ModelMeta {
  id: string;
  name: string;
  tagline: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  age: string;
  /** Hero camera azimuth in degrees (0 = looking at the front). */
  heroView?: number;
  generated?: boolean;
}

export interface Model extends ModelMeta {
  bricks: Brick[];
  steps: Step[];
}

export interface ModelSource extends ModelMeta {
  build: () => Placement[];
  /** Max parts per instruction step (smaller = easier). */
  maxPerStep?: number;
}
