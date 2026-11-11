import * as THREE from 'three';
import { color as legoColor } from '../lego/colors';
import { type BridgeData, LAND_Y, PLATE, type World } from './world';

/** Accumulates coloured quads/boxes into one geometry (position, normal, colour + facade style, object id). */
export class Quads {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  ids: number[] = [];
  idx: number[] = [];

  quad(p: number[], n: [number, number, number], rgb: [number, number, number], style: number, id: number) {
    const base = this.pos.length / 3;
    for (let i = 0; i < 12; i++) this.pos.push(p[i]);
    for (let i = 0; i < 4; i++) {
      this.nor.push(n[0] * 127, n[1] * 127, n[2] * 127);
      this.col.push(rgb[0], rgb[1], rgb[2], style);
      this.ids.push(id);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** Box given by local min/max, placed with a matrix. */
  box(min: [number, number, number], max: [number, number, number], m: THREE.Matrix4 | null, rgb: [number, number, number], style = 3, id = 0) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    const faces: [number[], [number, number, number]][] = [
      [[x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0], [0, 1, 0]],
      [[x0, y0, z1, x0, y0, z0, x1, y0, z0, x1, y0, z1], [0, -1, 0]],
      [[x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], [0, 0, -1]],
      [[x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [0, 0, 1]],
      [[x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [-1, 0, 0]],
      [[x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], [1, 0, 0]],
    ];
    const v = new THREE.Vector3();
    for (const [p, n] of faces) {
      let nn = n;
      if (m) {
        for (let i = 0; i < 4; i++) {
          v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]).applyMatrix4(m);
          p[i * 3] = v.x;
          p[i * 3 + 1] = v.y;
          p[i * 3 + 2] = v.z;
        }
        v.set(n[0], n[1], n[2]).transformDirection(m);
        nn = [v.x, v.y, v.z];
      }
      this.quad(p, nn, rgb, style, id);
    }
  }

  get empty() {
    return this.idx.length === 0;
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(this.nor), 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(this.col), 4, true));
    g.setAttribute('oid', new THREE.BufferAttribute(new Uint16Array(this.ids), 1));
    g.setIndex(this.pos.length / 3 > 65535 ? new THREE.BufferAttribute(new Uint32Array(this.idx), 1) : new THREE.BufferAttribute(new Uint16Array(this.idx), 1));
    g.computeBoundingSphere();
    return g;
  }
}

export const rgbOf = (key: string): [number, number, number] => {
  const hex = legoColor(key).hex;
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
};

const isWater = (cls: number) => cls === 1 || cls === 2;

/** Every building as stacks of studs: tops and outer walls only, merged into runs, in chunks for culling. */
export function buildCity(world: World, chunk = 128): THREE.BufferGeometry[] {
  const { w, h, height, bid, ground } = world;
  const pal = world.palette.map(rgbOf);
  const colOf = (id: number): [number, number, number] => {
    const base = pal[world.b.c[id - 1]];
    const k = 0.93 + (((id * 2654435761) >>> 0) % 1000) / 1000 * 0.12; // small brightness variation between neighbours
    return [Math.min(255, base[0] * k), Math.min(255, base[1] * k), Math.min(255, base[2] * k)];
  };
  const H = (x: number, z: number) => (x < 0 || z < 0 || x >= w || z >= h ? 0 : height[z * w + x]);
  const out: THREE.BufferGeometry[] = [];
  const bank: [number, number, number] = [150, 152, 150];

  for (let cz = 0; cz < h; cz += chunk)
    for (let cx = 0; cx < w; cx += chunk) {
      const q = new Quads();
      const x1c = Math.min(w, cx + chunk), z1c = Math.min(h, cz + chunk);
      // ---- tops: runs along x, merged with the identical run in the next rows
      let open = new Map<number, { x0: number; x1: number; z0: number; hh: number; id: number }>();
      const flush = (r: { x0: number; x1: number; z0: number; hh: number; id: number }, zEnd: number) => {
        const y = LAND_Y + r.hh * PLATE;
        q.quad([r.x0, y, r.z0, r.x0, y, zEnd, r.x1, y, zEnd, r.x1, y, r.z0], [0, 1, 0], colOf(r.id), world.b.s[r.id - 1], r.id);
      };
      for (let z = cz; z <= z1c; z++) {
        const next = new Map<number, { x0: number; x1: number; z0: number; hh: number; id: number }>();
        if (z < z1c) {
          let x = cx;
          while (x < x1c) {
            const i = z * w + x;
            const hh = height[i];
            if (!hh) {
              x++;
              continue;
            }
            const id = bid[i];
            let xe = x + 1;
            while (xe < x1c && height[z * w + xe] === hh && bid[z * w + xe] === id) xe++;
            const key = x * 4096 + xe;
            const prev = open.get(key);
            if (prev && prev.hh === hh && prev.id === id) {
              next.set(key, prev);
              open.delete(key);
            } else next.set(key, { x0: x, x1: xe, z0: z, hh, id });
            x = xe;
          }
        }
        for (const r of open.values()) flush(r, z);
        open = next;
      }
      // ---- walls facing north/south
      for (let z = cz; z < z1c; z++)
        for (const dz of [-1, 1]) {
          let x = cx;
          while (x < x1c) {
            const hh = height[z * w + x], nh = H(x, z + dz);
            if (hh <= nh) {
              x++;
              continue;
            }
            const id = bid[z * w + x], wet = isWater(ground[z * w + x]);
            let xe = x + 1;
            while (xe < x1c && height[z * w + xe] === hh && H(xe, z + dz) === nh && bid[z * w + xe] === id && isWater(ground[z * w + xe]) === wet) xe++;
            const yb = nh ? LAND_Y + nh * PLATE : wet ? 0 : LAND_Y, yt = LAND_Y + hh * PLATE;
            if (dz < 0) q.quad([xe, yb, z, x, yb, z, x, yt, z, xe, yt, z], [0, 0, -1], colOf(id), world.b.s[id - 1], id);
            else q.quad([x, yb, z + 1, xe, yb, z + 1, xe, yt, z + 1, x, yt, z + 1], [0, 0, 1], colOf(id), world.b.s[id - 1], id);
            x = xe;
          }
        }
      // ---- walls facing west/east
      for (let x = cx; x < x1c; x++)
        for (const dx of [-1, 1]) {
          let z = cz;
          while (z < z1c) {
            const hh = height[z * w + x], nh = H(x + dx, z);
            if (hh <= nh) {
              z++;
              continue;
            }
            const id = bid[z * w + x], wet = isWater(ground[z * w + x]);
            let ze = z + 1;
            while (ze < z1c && height[ze * w + x] === hh && H(x + dx, ze) === nh && bid[ze * w + x] === id && isWater(ground[ze * w + x]) === wet) ze++;
            const yb = nh ? LAND_Y + nh * PLATE : wet ? 0 : LAND_Y, yt = LAND_Y + hh * PLATE;
            if (dx < 0) q.quad([x, yb, z, x, yb, ze, x, yt, ze, x, yt, z], [-1, 0, 0], colOf(id), world.b.s[id - 1], id);
            else q.quad([x + 1, yb, ze, x + 1, yb, z, x + 1, yt, z, x + 1, yt, ze], [1, 0, 0], colOf(id), world.b.s[id - 1], id);
            z = ze;
          }
        }
      // ---- river and lake walls: the one-brick drop from street level to the water
      const land = (x: number, z: number) => x >= 0 && z >= 0 && x < w && z < h && !isWater(ground[z * w + x]);
      for (let z = cz; z < z1c; z++)
        for (const dz of [-1, 1]) {
          let x = cx;
          while (x < x1c) {
            if (!land(x, z) || land(x, z + dz) || z + dz < 0 || z + dz >= h) {
              x++;
              continue;
            }
            let xe = x + 1;
            while (xe < x1c && land(xe, z) && !land(xe, z + dz)) xe++;
            if (dz < 0) q.quad([xe, 0, z, x, 0, z, x, LAND_Y, z, xe, LAND_Y, z], [0, 0, -1], bank, 4, 0);
            else q.quad([x, 0, z + 1, xe, 0, z + 1, xe, LAND_Y, z + 1, x, LAND_Y, z + 1], [0, 0, 1], bank, 4, 0);
            x = xe;
          }
        }
      for (let x = cx; x < x1c; x++)
        for (const dx of [-1, 1]) {
          let z = cz;
          while (z < z1c) {
            if (!land(x, z) || land(x + dx, z) || x + dx < 0 || x + dx >= w) {
              z++;
              continue;
            }
            let ze = z + 1;
            while (ze < z1c && land(x, ze) && !land(x + dx, ze)) ze++;
            if (dx < 0) q.quad([x, 0, z, x, 0, ze, x, LAND_Y, ze, x, LAND_Y, z], [-1, 0, 0], bank, 4, 0);
            else q.quad([x + 1, 0, ze, x + 1, 0, z, x + 1, LAND_Y, z, x + 1, LAND_Y, ze], [1, 0, 0], bank, 4, 0);
            z = ze;
          }
        }
      if (!q.empty) out.push(q.geometry());
    }
  return out;
}

export const BRIDGE_ID = 40000;
export interface BridgeBox {
  index: number;
  cx: number;
  cz: number;
  ax: number;
  az: number;
  u0: number;
  u1: number;
  halfW: number;
  top: number;
}

const DECK0 = 1.3, DECK1 = 1.7;

/** All bridges as brick-built spans, plus their boxes for picking. */
export function buildBridges(world: World): { geometry: THREE.BufferGeometry; boxes: BridgeBox[] } {
  const q = new Quads();
  const boxes: BridgeBox[] = [];
  const road = rgbOf('dbg'), stone = rgbOf('tan'), rail = rgbOf('dark-tan');
  world.bridges.forEach((b: BridgeData, index) => {
    const id = BRIDGE_ID + index;
    const [ax, az] = b.ax;
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(ax, 0, az), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-az, 0, ax)).setPosition(b.c[0], 0, b.c[1]);
    const col = rgbOf(b.color ?? 'lbg');
    const s0 = b.span[0], s1 = b.span[1];
    const u0 = Math.max(b.t[0], s0 - 7), u1 = Math.min(b.t[1], s1 + 7);
    const hw = Math.max(0.6, b.w / 2);
    const L = Math.max(1, s1 - s0);
    let top = DECK1 + 0.5;
    const isRail = b.rail || b.kind === 'raised' || b.kind === 'lift' || b.kind === 'swing' || (b.kind === 'through' && b.color === 'black');
    const deck = (y0: number, y1: number, c = road) => q.box([u0, y0, -hw], [u1, y1, hw], m, c, 3, id);
    const rails = (y0: number, y1: number, from = u0, to = u1) => {
      q.box([from, y0, -hw - 0.15], [to, y1, -hw + 0.1], m, col, 3, id);
      q.box([from, y0, hw - 0.1], [to, y1, hw + 0.15], m, col, 3, id);
    };
    // abutments at both banks
    if (b.kind !== 'beam' || L > 6) {
      q.box([s0 - 1.6, 0, -hw - 0.4], [s0 + 0.4, DECK0, hw + 0.4], m, stone, 4, id);
      q.box([s1 - 0.4, 0, -hw - 0.4], [s1 + 1.6, DECK0, hw + 0.4], m, stone, 4, id);
    }
    const leaf = (pivot: number, dir: 1 | -1, len: number, off = 0) => {
      // a bascule leaf locked upright, with its counterweight
      const mm = m.clone().multiply(new THREE.Matrix4().makeTranslation(pivot, DECK0 + 0.6, off)).multiply(new THREE.Matrix4().makeRotationZ(THREE.MathUtils.degToRad(dir > 0 ? 76 : 104)));
      const c2 = rgbOf(b.kind === 'raised' ? (b.color ?? 'reddish-brown') : 'reddish-brown');
      for (const side of [-hw, hw - 0.3]) {
        q.box([0, -0.2, side], [len, 0.15, side + 0.3], mm, c2, 3, id);
        q.box([0, 1.5, side], [len * 0.9, 1.8, side + 0.3], mm, c2, 3, id);
        for (let u = 0; u <= len * 0.9; u += 2) q.box([u, 0, side], [u + 0.3, 1.6, side + 0.3], mm, c2, 3, id);
      }
      for (let u = 0; u <= len; u += 2) q.box([u, -0.2, -hw], [u + 0.3, 0.1, hw], mm, c2, 3, id);
      q.box([-3.2, -0.6, -hw - 0.2], [-0.8, 2.4, hw + 0.2], mm, rgbOf('dbg'), 3, id);
      q.box([pivot - 1.2 * dir - 0.8, 0, off - hw - 0.3], [pivot - 1.2 * dir + 0.8, DECK0 + 1.2, off + hw + 0.3], m, stone, 4, id);
      top = Math.max(top, DECK0 + len);
    };
    const westEnd = ax * (s1 - s0) > 0 ? s0 : s1; // the end of the span that lies to the west
    const westDir: 1 | -1 = westEnd === s0 ? 1 : -1;

    if (b.kind === 'raised') {
      leaf(westEnd, westDir, L * 0.95);
    } else {
      deck(DECK0, DECK1, isRail ? rail : road);
      if (b.kind === 'pony') {
        rails(DECK1, DECK1 + 0.35);
        for (let u = s0; u < s1; u += 1) {
          const f = (u + 0.5 - s0) / L;
          const hgt = 0.45 + 1.35 * Math.pow(Math.abs(2 * f - 1), 1.5);
          q.box([u, DECK1, -hw - 0.2], [Math.min(u + 1, s1), DECK1 + hgt, -hw + 0.15], m, col, 3, id);
          q.box([u, DECK1, hw - 0.15], [Math.min(u + 1, s1), DECK1 + hgt, hw + 0.2], m, col, 3, id);
        }
        top = DECK1 + 1.9;
      } else if (b.kind === 'deck') {
        rails(DECK1, DECK1 + 0.3);
        for (let u = s0; u < s1; u += 1) {
          const f = (u + 0.5 - s0) / L;
          const depth = 0.1 + 0.75 * Math.pow(Math.abs(2 * f - 1), 2);
          q.box([u, DECK0 - depth, -hw], [Math.min(u + 1, s1), DECK0, -hw + 0.4], m, col, 3, id);
          q.box([u, DECK0 - depth, hw - 0.4], [Math.min(u + 1, s1), DECK0, hw], m, col, 3, id);
        }
      } else if (b.kind === 'double') {
        const y2 = DECK1 + 1.5;
        q.box([u0, y2, -hw], [u1, y2 + 0.4, hw], m, b.top === 'L' ? rail : road, 3, id);
        rails(y2 + 0.4, y2 + 0.7);
        rails(DECK1, DECK1 + 0.2, s0, s1);
        for (let u = s0; u <= s1; u += 2) {
          q.box([u - 0.15, DECK1, -hw - 0.15], [u + 0.15, y2, -hw + 0.15], m, col, 3, id);
          q.box([u - 0.15, DECK1, hw - 0.15], [u + 0.15, y2, hw + 0.15], m, col, 3, id);
        }
        // approach viaduct piers on land
        for (const u of [u0 + 0.5, u1 - 0.5]) q.box([u - 0.4, LAND_Y, -hw], [u + 0.4, y2, hw], m, stone, 4, id);
        if (b.top === 'L') {
          // a CTA train crossing on the upper deck
          const silver = rgbOf('lbg');
          for (let k = 0; k < 4; k++) {
            const a = s0 + 1 + k * 3.1;
            if (a + 2.9 > u1) break;
            q.box([a, y2 + 0.45, -0.4], [a + 2.9, y2 + 1.25, 0.4], m, silver, 2, id);
          }
        }
        top = y2 + 1.4;
      } else if (b.kind === 'through' || b.kind === 'lift' || b.kind === 'swing') {
        const ht = b.kind === 'swing' ? 2.0 : 2.8;
        for (const side of [-hw - 0.1, hw - 0.2]) {
          q.box([s0, DECK1 + ht - 0.3, side], [s1, DECK1 + ht, side + 0.3], m, col, 3, id);
          for (let u = s0; u <= s1 - 0.3; u += 2) q.box([u, DECK1, side], [u + 0.3, DECK1 + ht, side + 0.3], m, col, 3, id);
        }
        for (let u = s0; u <= s1 - 0.3; u += 2) q.box([u, DECK1 + ht - 0.25, -hw], [u + 0.3, DECK1 + ht, hw], m, col, 3, id);
        top = DECK1 + ht;
        if (b.kind === 'lift') {
          const th = 14.5; // 195 ft towers
          for (const u of [s0 - 1.4, s1 + 0.2]) {
            for (const side of [-hw - 0.5, hw - 0.1]) {
              q.box([u, DECK1, side], [u + 0.5, DECK1 + th, side + 0.6], m, col, 3, id);
              q.box([u + 0.7, DECK1, side], [u + 1.2, DECK1 + th, side + 0.6], m, col, 3, id);
            }
            for (let y = 3; y < th; y += 3) q.box([u, DECK1 + y, -hw - 0.5], [u + 1.2, DECK1 + y + 0.3, hw + 0.5], m, col, 3, id);
            q.box([u - 0.2, DECK1 + th, -hw - 0.7], [u + 1.4, DECK1 + th + 0.8, hw + 0.7], m, col, 3, id);
          }
          top = DECK1 + th + 0.8;
        }
        if (b.kind === 'swing') q.box([westEnd - 1.5, 0, -hw - 0.6], [westEnd + 1.5, DECK0, hw + 0.6], m, stone, 4, id);
        if (b.twin === 'raised') leaf(westEnd, westDir, L * 0.8, hw * 2 + 1.2);
      } else if (b.kind === 'arch') {
        const rise = Math.min(6, L * 0.22);
        rails(DECK1, DECK1 + 0.3);
        for (let u = s0; u < s1; u += 1) {
          const f = (u + 0.5 - s0) / L;
          const y = DECK1 + 4 * rise * f * (1 - f);
          for (const side of [-hw - 0.15, hw - 0.2]) {
            q.box([u, y - 0.1, side], [Math.min(u + 1, s1), y + 0.5, side + 0.35], m, col, 3, id);
            if (Math.round(u - s0) % 2 === 0 && y - 0.1 > DECK1 + 0.4) q.box([u + 0.4, DECK1, side + 0.1], [u + 0.55, y, side + 0.25], m, col, 3, id);
          }
        }
        top = DECK1 + rise + 0.6;
      } else {
        rails(DECK1, DECK1 + 0.3);
      }
    }
    boxes.push({ index, cx: b.c[0], cz: b.c[1], ax, az, u0: Math.min(u0, s0 - 1.6), u1: Math.max(u1, s1 + 1.6), halfW: hw + 0.5, top });
  });
  return { geometry: q.geometry(), boxes };
}

/** The tour boat: forward is +x, origin on the waterline amidships. */
export function buildBoat(): THREE.BufferGeometry {
  const q = new Quads();
  const white = rgbOf('white'), blue = rgbOf('blue'), tan = rgbOf('tan'), glass = rgbOf('dark-blue');
  q.box([-3.4, 0.02, -0.9], [3.0, 0.42, 0.9], null, white);
  q.box([3.0, 0.02, -0.65], [3.7, 0.42, 0.65], null, white);
  q.box([3.7, 0.12, -0.35], [4.2, 0.42, 0.35], null, white);
  q.box([-3.42, 0.2, -0.92], [3.02, 0.3, 0.92], null, blue);
  q.box([-3.0, 0.42, -0.75], [2.0, 0.7, 0.75], null, glass, 2);
  q.box([-3.2, 0.7, -0.85], [2.3, 0.76, 0.85], null, tan);
  q.box([2.0, 0.42, -0.6], [2.7, 0.95, 0.6], null, white, 2); // wheelhouse
  const shirts = ['red', 'blue', 'green', 'orange', 'white', 'medium-azure', 'lime', 'dark-red'].map(rgbOf);
  const yellow = rgbOf('yellow');
  let k = 0;
  for (let u = -2.9; u < 1.7; u += 0.62)
    for (const v of [-0.55, -0.18, 0.18, 0.55]) {
      if ((k * 7 + 3) % 5 === 0) {
        k++;
        continue;
      }
      q.box([u, 0.76, v - 0.11], [u + 0.22, 0.96, v + 0.11], null, shirts[k % shirts.length]);
      q.box([u + 0.04, 0.96, v - 0.07], [u + 0.18, 1.08, v + 0.07], null, yellow);
      k++;
    }
  q.box([-3.3, 0.76, -0.03], [-3.24, 1.5, 0.03], null, white); // flagstaff
  q.box([-3.9, 1.2, -0.02], [-3.3, 1.5, 0.02], null, rgbOf('red'));
  return q.geometry();
}

export const WHEEL_ID = 39999;
/** Navy Pier's Centennial Wheel (60 m). */
export function buildWheel(x: number, z: number): THREE.BufferGeometry {
  const q = new Quads();
  const white = rgbOf('white'), blue = rgbOf('blue');
  const R = 6.6, cy = LAND_Y + R + 1.2;
  const base = new THREE.Matrix4().makeTranslation(x, cy, z);
  const N = 36;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const m = base.clone().multiply(new THREE.Matrix4().makeRotationZ(a));
    const seg = (2 * Math.PI * R) / N / 2 + 0.05;
    q.box([R - 0.15, -seg, -0.25], [R + 0.15, seg, -0.1], m, white, 3, WHEEL_ID);
    q.box([R - 0.15, -seg, 0.1], [R + 0.15, seg, 0.25], m, white, 3, WHEEL_ID);
    if (i % 3 === 0) q.box([0.3, -0.05, -0.05], [R, 0.05, 0.05], m, white, 3, WHEEL_ID);
    if (i % 2 === 0) q.box([R + 0.15, -0.3, -0.3], [R + 0.75, 0.3, 0.3], m, blue, 3, WHEEL_ID);
  }
  q.box([-0.5, -0.5, -0.5], [0.5, 0.5, 0.5], base, white, 3, WHEEL_ID);
  for (const s of [-1, 1]) {
    const leg = base.clone().multiply(new THREE.Matrix4().makeRotationZ(s * 0.32));
    q.box([-0.25, -(R + 1.4), -0.45], [0.25, 0, -0.3], leg, white, 3, WHEEL_ID);
    q.box([-0.25, -(R + 1.4), 0.3], [0.25, 0, 0.45], leg, white, 3, WHEEL_ID);
  }
  return q.geometry();
}
