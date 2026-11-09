import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { part, type PartDef } from '../lego/parts';

/**
 * Procedural part geometry in "stud units": 1 stud pitch = 1, 1 plate = 0.4.
 * Local origin = minimum corner of the un-rotated footprint, y = 0 at the bottom.
 *
 * Each part also carries outline data in the style of LDraw:
 *  - lines: hard edges, always drawn
 *  - cond:  conditional edges, drawn only where they form a silhouette
 *           (used for the sides of studs, round bricks, cones, wheels…)
 */
export const PLATE = 0.4;
export const STUD_R = 0.3;
export const STUD_H = 0.2;
const GAP = 0.012;
const SEG = 16;

export interface PartGeo {
  geometry: THREE.BufferGeometry; // non-indexed, position + normal
  lines: number[]; // [x,y,z, x,y,z] per segment
  cond: number[]; // [p0, p1, c0, c1] (12 floats) per segment
}

const cache = new Map<string, PartGeo>();

export function partGeo(id: string): PartGeo {
  let g = cache.get(id);
  if (!g) {
    g = build(part(id));
    cache.set(id, g);
  }
  return g;
}

/* ---------------------------------------------------------------- */

class Acc {
  geos: THREE.BufferGeometry[] = [];
  lines: number[] = [];
  cond: number[] = [];

  addGeo(g: THREE.BufferGeometry) {
    const ng = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(ng.attributes)) if (name !== 'position' && name !== 'normal') ng.deleteAttribute(name);
    this.geos.push(ng);
  }
  line(a: THREE.Vector3Like, b: THREE.Vector3Like) {
    this.lines.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  condLine(a: THREE.Vector3Like, b: THREE.Vector3Like, c0: THREE.Vector3Like, c1: THREE.Vector3Like) {
    this.cond.push(a.x, a.y, a.z, b.x, b.y, b.z, c0.x, c0.y, c0.z, c1.x, c1.y, c1.z);
  }
  /** Transform everything added since `mark` by matrix m. */
  transformSince(mark: { g: number; l: number; c: number }, m: THREE.Matrix4) {
    for (let i = mark.g; i < this.geos.length; i++) this.geos[i].applyMatrix4(m);
    const v = new THREE.Vector3();
    for (let i = mark.l; i < this.lines.length; i += 3) {
      v.set(this.lines[i], this.lines[i + 1], this.lines[i + 2]).applyMatrix4(m);
      this.lines[i] = v.x; this.lines[i + 1] = v.y; this.lines[i + 2] = v.z;
    }
    for (let i = mark.c; i < this.cond.length; i += 3) {
      v.set(this.cond[i], this.cond[i + 1], this.cond[i + 2]).applyMatrix4(m);
      this.cond[i] = v.x; this.cond[i + 1] = v.y; this.cond[i + 2] = v.z;
    }
  }
  mark() {
    return { g: this.geos.length, l: this.lines.length, c: this.cond.length };
  }
  done(): PartGeo {
    const geometry = mergeGeometries(this.geos, false)!;
    geometry.computeBoundingBox();
    return { geometry, lines: this.lines, cond: this.cond };
  }
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Axis-aligned box with its 12 edges. */
function box(acc: Acc, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  acc.addGeo(g);
  const xs = [x0, x1], ys = [y0, y1], zs = [z0, z1];
  for (const y of ys) for (const z of zs) acc.line(V(x0, y, z), V(x1, y, z));
  for (const x of xs) for (const z of zs) acc.line(V(x, y0, z), V(x, y1, z));
  for (const x of xs) for (const y of ys) acc.line(V(x, y, z0), V(x, y, z1));
}

/**
 * Surface of revolution around the local Y axis through (cx, cz).
 * profile: [radius, y] points; `sharp[i]` marks profile vertices that get a circle outline.
 * Each segment is built separately so creases stay crisp.
 */
function lathe(acc: Acc, cx: number, cz: number, profile: [number, number][], sharp: boolean[] = [], seg = SEG, silhouettes = true) {
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, y0] = profile[i];
    const [r1, y1] = profile[i + 1];
    if (r0 === 0 && r1 === 0) continue;
    const g = new THREE.LatheGeometry([new THREE.Vector2(r0, y0), new THREE.Vector2(r1, y1)], seg);
    g.translate(cx, 0, cz);
    acc.addGeo(g);
    // Silhouette (conditional) lines along the segment.
    if (silhouettes && Math.abs(y1 - y0) > 1e-4 && (r0 > 0 || r1 > 0)) {
      for (let k = 0; k < seg; k++) {
        const a = (k / seg) * Math.PI * 2;
        const an = ((k + 1) / seg) * Math.PI * 2;
        const ap = ((k - 1) / seg) * Math.PI * 2;
        const p = (r: number, y: number, ang: number) => V(cx + Math.sin(ang) * r, y, cz + Math.cos(ang) * r);
        const rm = (r0 + r1) / 2, ym = (y0 + y1) / 2;
        acc.condLine(p(r0, y0, a), p(r1, y1, a), p(rm, ym, ap), p(rm, ym, an));
      }
    }
  }
  profile.forEach(([r, y], i) => {
    if (r <= 0) return;
    if (sharp[i] === false) return;
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      const b = ((k + 1) / seg) * Math.PI * 2;
      acc.line(V(cx + Math.sin(a) * r, y, cz + Math.cos(a) * r), V(cx + Math.sin(b) * r, y, cz + Math.cos(b) * r));
    }
  });
}

function stud(acc: Acc, cx: number, y: number, cz: number) {
  lathe(acc, cx, cz, [[STUD_R, y], [STUD_R, y + STUD_H], [0, y + STUD_H]], [true, true, false], 14);
}

function studGrid(acc: Acc, w: number, l: number, y: number, rows?: [number, number]) {
  const [z0, z1] = rows ?? [0, l];
  for (let z = z0; z < z1; z++) for (let x = 0; x < w; x++) stud(acc, x + 0.5, y, z + 0.5);
}

/**
 * Prism: a 2D profile in the (z, y) plane extruded along x from x0 to x1.
 * `soft[i]` marks profile vertices on a smooth curve (outlined only at silhouettes).
 */
function prism(acc: Acc, profile: [number, number][], x0: number, x1: number, soft: boolean[] = []) {
  const n = profile.length;
  const pos: number[] = [];
  const nor: number[] = [];
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  /** Push a triangle, flipping its winding if needed so it faces along `facing`. */
  const tri = (
    a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3,
    facing: THREE.Vector3, na = facing, nb = facing, nc = facing,
  ) => {
    e1.subVectors(b, a);
    e2.subVectors(c, a);
    if (e1.cross(e2).dot(facing) < 0) {
      [b, c] = [c, b];
      [nb, nc] = [nc, nb];
    }
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    nor.push(na.x, na.y, na.z, nb.x, nb.y, nb.z, nc.x, nc.y, nc.z);
  };
  // Caps
  const contour = profile.map(([z, y]) => new THREE.Vector2(z, y));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const clockwise = THREE.ShapeUtils.isClockWise(contour);
  const P = (i: number, x: number) => V(x, profile[i][1], profile[i][0]);
  for (const [a, b, c] of tris) {
    tri(P(a, x1), P(b, x1), P(c, x1), V(1, 0, 0));
    tri(P(a, x0), P(b, x0), P(c, x0), V(-1, 0, 0));
  }
  // Sides (smooth normals across soft vertices)
  const edgeNormal = (i: number) => {
    const [za, ya] = profile[i];
    const [zb, yb] = profile[(i + 1) % n];
    const dz = zb - za, dy = yb - ya;
    const len = Math.hypot(dz, dy) || 1;
    // outward normal of a counter-clockwise (z, y) polygon edge is (dy, -dz) in (z, y)
    const s = clockwise ? -1 : 1;
    return V(0, (-dz / len) * s, (dy / len) * s);
  };
  const vNormal = (i: number, edge: number) => {
    if (!soft[i]) return edgeNormal(edge);
    return edgeNormal((i - 1 + n) % n).add(edgeNormal(i % n)).normalize();
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [za, ya] = profile[i];
    const [zb, yb] = profile[j];
    const flat = edgeNormal(i);
    const na = vNormal(i, i), nb = vNormal(j, i);
    const a0 = V(x0, ya, za), a1 = V(x1, ya, za), b0 = V(x0, yb, zb), b1 = V(x1, yb, zb);
    tri(a0, b1, a1, flat, na, nb, na);
    tri(a0, b0, b1, flat, na, nb, nb);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  acc.addGeo(g);
  // Outlines
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [za, ya] = profile[i];
    const [zb, yb] = profile[j];
    acc.line(V(x0, ya, za), V(x0, yb, zb));
    acc.line(V(x1, ya, za), V(x1, yb, zb));
    if (soft[i]) {
      const [zp, yp] = profile[(i - 1 + n) % n];
      const [zn, yn] = profile[j];
      const xm = (x0 + x1) / 2;
      acc.condLine(V(x0, ya, za), V(x1, ya, za), V(xm, yp, zp), V(xm, yn, zn));
    } else acc.line(V(x0, ya, za), V(x1, ya, za));
  }
}

/* ---------------------------------------------------------------- */

function build(def: PartDef): PartGeo {
  const acc = new Acc();
  const { w, l } = def;
  const H = def.h * PLATE;
  const g = GAP;
  switch (def.kind) {
    case 'brick':
    case 'plate':
      box(acc, g, 0, g, w - g, H, l - g);
      studGrid(acc, w, l, H);
      break;
    case 'tile':
      box(acc, g, 0, g, w - g, H, l - g);
      // the little groove line near the bottom of a tile
      for (const [a, b] of [
        [V(g, 0.06, g), V(w - g, 0.06, g)],
        [V(g, 0.06, l - g), V(w - g, 0.06, l - g)],
        [V(g, 0.06, g), V(g, 0.06, l - g)],
        [V(w - g, 0.06, g), V(w - g, 0.06, l - g)],
      ])
        acc.line(a, b);
      break;
    case 'grille': {
      box(acc, g, 0, g, w - g, H, l - g);
      for (let i = 1; i < 6; i++) {
        const z = (l * i) / 6;
        acc.line(V(0.15, H + 0.001, z), V(w - 0.15, H + 0.001, z));
      }
      break;
    }
    case 'jumper':
      box(acc, g, 0, g, w - g, H, l - g);
      stud(acc, w / 2, H, l / 2);
      break;
    case 'slope': {
      const rows = def.studRows ?? 1;
      const toe = 0.2;
      prism(acc, [[g, 0], [l - g, 0], [l - g, toe], [rows, H], [g, H]], g, w - g);
      studGrid(acc, w, l, H, [0, rows]);
      break;
    }
    case 'slopeInv': {
      prism(acc, [[g, 0], [1, 0], [l - g, H - 0.2], [l - g, H], [g, H]], g, w - g);
      studGrid(acc, w, l, H);
      break;
    }
    case 'ridge':
      prism(acc, [[g, 0], [l - g, 0], [l - g, 0.2], [l / 2, H], [g, 0.2]], g, w - g);
      break;
    case 'curve': {
      const pts: [number, number][] = [[g, 0], [l - g, 0], [l - g, 0.1]];
      const soft: boolean[] = [false, false, false];
      const N = 8;
      for (let i = N - 1; i >= 1; i--) {
        const t = i / N;
        pts.push([g + (l - 2 * g) * t, 0.1 + (H - 0.1) * Math.cos((Math.PI / 2) * t)]);
        soft.push(true);
      }
      pts.push([g, H]);
      soft.push(false);
      prism(acc, pts, g, w - g, soft);
      break;
    }
    case 'round': {
      const r = def.radius!;
      if (w === 1) {
        // LDraw 3062b / 6141: r=10 body over a narrower r=8 collar at the bottom (5 LDU on a brick, 5 of 8 on a plate)
        const collar = def.h === 3 ? 0.25 : 0.25;
        lathe(acc, 0.5, 0.5, [[0, 0], [0.4, 0], [0.4, collar], [r, collar], [r, H], [0, H]], [false, true, true, true, true, false], 20);
        stud(acc, 0.5, H, 0.5);
      } else {
        lathe(acc, w / 2, l / 2, [[0, 0], [r, 0], [r, H], [0, H]], [false, true, true, false], w > 2 ? 40 : 24);
        // studs only where they fit inside the circle (a 4x4 round has 12, a 6x6 has 32)
        for (let z = 0; z < l; z++)
          for (let x = 0; x < w; x++) if (Math.hypot(x + 0.5 - w / 2, z + 0.5 - l / 2) <= r - 0.28) stud(acc, x + 0.5, H, z + 0.5);
      }
      break;
    }
    case 'masonry': {
      box(acc, g, 0, g, w - g, H, l - g);
      studGrid(acc, w, l, H);
      // brick-and-mortar grooves on all four sides: two courses per brick, staggered joints
      const e = 0.003;
      const course = [H * 0.36, H * 0.68];
      for (const y of course) {
        acc.line(V(-e + g, y, g - e), V(-e + g, y, l - g + e));
        acc.line(V(w - g + e, y, g - e), V(w - g + e, y, l - g + e));
        acc.line(V(g, y, g - e), V(w - g, y, g - e));
        acc.line(V(g, y, l - g + e), V(w - g, y, l - g + e));
      }
      const bands: [number, number][] = [[0.04, course[0]], [course[0], course[1]], [course[1], H - 0.04]];
      bands.forEach(([y0, y1], i) => {
        for (let zz = (i % 2 ? 0.5 : 1) ; zz < l; zz += 1) {
          acc.line(V(g - e, y0, zz), V(g - e, y1, zz));
          acc.line(V(w - g + e, y0, zz), V(w - g + e, y1, zz));
        }
      });
      break;
    }
    case 'grilleBrick': {
      box(acc, g, 0, g, w - g, H, l - g);
      studGrid(acc, w, l, H);
      const e = 0.003;
      for (let i = 1; i < 6; i++) {
        const zz = (l * i) / 6;
        acc.line(V(g - e, 0.12, zz), V(g - e, H - 0.12, zz));
        acc.line(V(w - g + e, 0.12, zz), V(w - g + e, H - 0.12, zz));
      }
      break;
    }
    case 'antenna': {
      const r = def.radius ?? 0.08;
      lathe(acc, 0.5, 0.5, [[0, 0], [0.3, 0], [0.3, 0.2], [r * 1.6, 0.35], [r, 0.6], [r, H - 0.12], [r * 1.7, H - 0.06], [0, H]], [false, true, true, true, false, false, true, false], 10);
      break;
    }
    case 'bar': {
      const r = def.radius ?? 0.16;
      lathe(acc, 0.5, 0.5, [[0, 0], [r, 0], [r, 0.5], [r * 1.5, 0.5], [r * 1.5, 0.62], [r, 0.62], [r, H], [0, H]], [false, true, true, true, true, true, true, false], 12);
      break;
    }
    case 'roundTile': {
      const r = def.radius!;
      lathe(acc, w / 2, l / 2, [[0, 0], [r, 0], [r, H], [0, H]], [false, true, true, false], 20);
      break;
    }
    case 'cone': {
      const r = def.radius!;
      const top = w === 1 ? 0.3 : 0.5;
      if (w === 1) lathe(acc, 0.5, 0.5, [[0, 0], [0.4, 0], [0.4, 0.25], [r, 0.25], [top, H], [0, H]], [false, true, true, true, true, false], 20);
      else lathe(acc, w / 2, l / 2, [[0, 0], [r, 0], [r, 0.16], [top, H], [0, H]], [false, true, true, true, false], 24);
      stud(acc, w / 2, H, l / 2);
      break;
    }
    case 'dish': {
      const r = def.radius!;
      const hub = w === 2 ? 0.45 : 0.75;
      lathe(acc, w / 2, l / 2, [[0, 0], [hub, 0], [r, H * 0.9], [r - 0.06, H * 1.05], [hub * 0.9, H * 0.55], [0, H * 0.55]], [false, true, false, true, true, false], 28);
      stud(acc, w / 2, H * 0.55, l / 2);
      break;
    }
    case 'wheelHolder': {
      box(acc, g, 0, g, w - g, H, l - g);
      studGrid(acc, w, l, H);
      const m0 = acc.mark();
      // pins along x on both sides
      lathe(acc, 0, 0, [[0, -0.42], [0.14, -0.42], [0.14, 0], [0, 0]], [false, true, true, false], 10);
      const pinL = new THREE.Matrix4().makeRotationZ(-Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(g, H / 2, l / 2));
      acc.transformSince(m0, pinL);
      const m1 = acc.mark();
      lathe(acc, 0, 0, [[0, 0], [0.14, 0], [0.14, 0.42], [0, 0.42]], [false, true, true, false], 10);
      const pinR = new THREE.Matrix4().makeRotationZ(-Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(w - g, H / 2, l / 2));
      acc.transformSince(m1, pinR);
      break;
    }
    case 'wheel':
    case 'tire': {
      const m0 = acc.mark();
      if (def.kind === 'wheel') {
        lathe(acc, 0, 0, [[0, 0.06], [0.18, 0.06], [0.22, 0.02], [0.46, 0.02], [0.5, 0.08], [0.5, 0.64], [0.46, 0.7], [0, 0.7]], [false, true, true, true, true, true, true, false], 20);
      } else {
        lathe(acc, 0, 0, [[0.5, 0.05], [0.78, 0.0], [0.875, 0.12], [0.875, 0.58], [0.78, 0.7], [0.5, 0.65], [0.5, 0.05]], [true, true, false, false, true, true, true], 24);
      }
      const m = new THREE.Matrix4().makeRotationZ(-Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(0.15, 0.8, 1.0));
      acc.transformSince(m0, m);
      break;
    }
  }
  return acc.done();
}

/** Bounding box of a part in local coordinates (including studs). */
export function partBounds(id: string): THREE.Box3 {
  return partGeo(id).geometry.boundingBox!.clone();
}
