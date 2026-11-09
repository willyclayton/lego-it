import { ModelBuilder } from '../lego/builder';
import { compileGrid, voxelize, type ShapeProgram } from '../lego/shapes';
import type { ModelSource } from '../lego/types';

/**
 * A saucer-shaped light freighter: disc hull, twin forward mandibles, an
 * offset cockpit tube on the starboard side, radar dish, turret and a glowing
 * engine band. The front faces +z; the ship's right (starboard) side is -x.
 */
export const hullProgram: ShapeProgram = {
  title: 'Space Freighter',
  features: ['disc hull', 'twin front mandibles with a gap', 'cockpit tube on the right', 'radar dish on top', 'blue engine glow at the back'],
  parts: [
    { label: 'rim', shape: 'cylinder', op: 'add', center: [0, 1.8, 0], size: [30, 1.6, 30], color: 'lbg' },
    { label: 'upper dome', shape: 'ellipsoid', op: 'add', center: [0, 2.6, 0], size: [28, 3.6, 28], color: 'lbg' },
    { label: 'belly', shape: 'ellipsoid', op: 'add', center: [0, 1.4, 0], size: [26, 2.0, 26], color: 'lbg' },
    { label: 'mandible', shape: 'box', op: 'add', center: [3.5, 1.8, 14.5], size: [5, 1.6, 10], color: 'lbg', mirror_x: true },
    { label: 'mandible ramp', shape: 'wedge', op: 'add', center: [3.5, 3.0, 11.5], size: [5, 0.8, 5], color: 'lbg', mirror_x: true },
    { label: 'front notch', shape: 'box', op: 'subtract', center: [0, 2.5, 15.5], size: [2, 6, 11], color: 'none' },
    { label: 'landing gear', shape: 'box', op: 'add', center: [6, 0.2, 4], size: [2, 0.4, 2], color: 'dbg', mirror_x: true },
    { label: 'landing gear rear', shape: 'box', op: 'add', center: [0, 0.2, -7], size: [2, 0.4, 2], color: 'dbg' },
    // hull detailing
    { label: 'mandible stripe', shape: 'box', op: 'paint', center: [3.5, 2.4, 15], size: [1, 1.6, 8], color: 'dbg', mirror_x: true },
    { label: 'spine', shape: 'box', op: 'paint', center: [0, 3.5, -8], size: [2, 3, 12], color: 'dbg' },
    { label: 'trench L', shape: 'box', op: 'paint', center: [-8, 3.5, -2], size: [1, 3, 14], rot: [0, 50, 0], color: 'dbg' },
    { label: 'trench R', shape: 'box', op: 'paint', center: [8, 3.5, -2], size: [1, 3, 14], rot: [0, -50, 0], color: 'dbg' },
    { label: 'panel', shape: 'box', op: 'paint', center: [9, 3.5, 3], size: [3, 3, 4], color: 'dbg' },
    { label: 'panel 2', shape: 'box', op: 'paint', center: [-5, 3.5, 9], size: [3, 3, 3], color: 'dbg' },
    { label: 'scorch', shape: 'box', op: 'paint', center: [6, 3.5, -8], size: [3, 3, 2], color: 'dark-red' },
    { label: 'scorch 2', shape: 'box', op: 'paint', center: [-9, 3.5, 4], size: [2, 3, 2], color: 'dark-red' },
    { label: 'engine glow', shape: 'box', op: 'paint', center: [0, 1.8, -14.5], size: [24, 1.6, 3], color: 'trans-light-blue' },
    // top turret
    { label: 'turret', shape: 'cylinder', op: 'add', center: [0, 4.6, 0], size: [4, 0.8, 4], color: 'dbg' },
  ],
};

export const cockpitProgram: ShapeProgram = {
  title: 'Cockpit',
  parts: [
    { label: 'arm', shape: 'box', op: 'add', center: [-11.5, 2.4, 4.5], size: [6, 1.6, 4], color: 'lbg' },
    { label: 'tube', shape: 'cylinder', op: 'add', center: [-14, 2.6, 9], size: [4, 11, 4], rot: [90, 0, 0], taper: 0.55, color: 'lbg' },
    { label: 'windows', shape: 'box', op: 'paint', center: [-14, 3.2, 13.6], size: [3.4, 1.4, 1.8], color: 'black' },
  ],
};

export const freighter: ModelSource = {
  id: 'freighter',
  name: 'Space Freighter',
  tagline: 'A battered saucer freighter: disc hull, twin mandibles, offset cockpit, radar dish and engine glow.',
  difficulty: 5,
  age: '14+',
  maxPerStep: 10,
  heroView: -40,
  build() {
    const hull = voxelize(hullProgram);
    const cockpit = voxelize(cockpitProgram);
    cockpit.forEach((x, y, z) => {
      if (hull.has(x, y, z)) cockpit.set(x, y, z, null);
    });
    const hb = hull.bounds();
    const cb = cockpit.bounds();
    const ox = -Math.min(hb.x0, cb.x0);
    const oz = -Math.min(hb.z0, cb.z0);
    const offset: [number, number, number] = [ox, 0, oz];

    const b = new ModelBuilder();
    b.push(compileGrid(hull, { offset, slopes: true }));
    b.push(compileGrid(cockpit, { offset, sub: 'Cockpit' }));

    // Radar dish on a post, built as its own little sub-assembly.
    const topAt = (x: number, z: number) => {
      let top = -1;
      hull.forEach((cx, cy, cz) => {
        if (cx === x && cz === z) top = Math.max(top, cy + 1);
      });
      return top;
    };
    const dx = -5, dz = 4; // dish center cell (shape coordinates)
    const y = topAt(dx, dz);
    b.group({ sub: 'Radar Dish', phase: 1 }, () => {
      b.add('3062b', 'dbg', dx + ox, y, dz + oz, 0);
      b.add('3960', 'lbg', dx + ox - 1.5, y + 3, dz + oz - 1.5, 0);
    });
    // Quad-gun turret barrels on top of the turret
    const ty = topAt(0, 0);
    b.group({ phase: 1 }, () => {
      b.add('3794', 'black', -1 + ox, ty, -1 + oz, 0);
      b.add('3794', 'black', 0 + ox, ty, -1 + oz, 0);
    });
    return b.out;
  },
};
