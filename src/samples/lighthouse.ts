import { ModelBuilder } from '../lego/builder';
import { compileGrid, voxelize, type ShapeProgram } from '../lego/shapes';
import type { ModelSource } from '../lego/types';

/** Rocky island, striped tower, keeper's hut; the lamp room is a sub-assembly. */
export const lighthouseProgram: ShapeProgram = {
  title: 'Lighthouse',
  parts: [
    { label: 'sea', shape: 'cylinder', op: 'add', center: [0, 0.2, 0], size: [24, 0.4, 22], color: 'dark-azure' },
    { label: 'beach', shape: 'ellipsoid', op: 'add', center: [0, 0.4, 0.5], size: [19, 1.6, 17], color: 'tan' },
    { label: 'rock', shape: 'ellipsoid', op: 'add', center: [-1, 0.4, -1], size: [13, 3.6, 11], color: 'dbg' },
    { label: 'rock 2', shape: 'ellipsoid', op: 'add', center: [-6, 0.4, 3], size: [6, 2.4, 6], color: 'lbg' },
    { label: 'rock 3', shape: 'ellipsoid', op: 'add', center: [5, 0.4, -5], size: [6, 2.0, 5], color: 'lbg' },
    { label: 'tower', shape: 'cylinder', op: 'add', center: [-1, 6.8, -1], size: [7, 10.4, 7], taper: 0.72, color: 'white' },
    { label: 'stripe 1', shape: 'cylinder', op: 'paint', center: [-1, 4.4, -1], size: [9, 1.2, 9], color: 'red' },
    { label: 'stripe 2', shape: 'cylinder', op: 'paint', center: [-1, 7.6, -1], size: [9, 1.2, 9], color: 'red' },
    { label: 'stripe 3', shape: 'cylinder', op: 'paint', center: [-1, 10.8, -1], size: [9, 1.2, 9], color: 'red' },
    { label: 'door', shape: 'box', op: 'paint', center: [-1, 2.6, 2.2], size: [1.8, 2.0, 1.6], color: 'reddish-brown' },
    { label: 'window', shape: 'box', op: 'paint', center: [-1, 6.0, 1.8], size: [1.2, 1.0, 1.6], color: 'black' },
    { label: 'window 2', shape: 'box', op: 'paint', center: [-1, 9.2, 1.4], size: [1.2, 1.0, 1.6], color: 'black' },
    { label: 'hut', shape: 'box', op: 'add', center: [5.5, 2.4, 3], size: [4, 2.4, 4], color: 'white' },
    { label: 'hut door', shape: 'box', op: 'paint', center: [5.5, 2.2, 4.8], size: [1.2, 1.4, 1], color: 'blue' },
    { label: 'hut roof', shape: 'box', op: 'add', center: [5.5, 4.0, 3], size: [5, 0.8, 5], taper: 0.4, color: 'blue' },
  ],
};

export const lampProgram: ShapeProgram = {
  title: 'Lamp room',
  parts: [
    { label: 'gallery', shape: 'cylinder', op: 'add', center: [-1, 12.2, -1], size: [7, 0.4, 7], color: 'dbg' },
    { label: 'rail', shape: 'cylinder', op: 'add', center: [-1, 12.8, -1], size: [7, 0.8, 7], color: 'black' },
    { label: 'rail inner', shape: 'cylinder', op: 'subtract', center: [-1, 12.8, -1], size: [5, 0.8, 5], color: 'none' },
    { label: 'lamp', shape: 'cylinder', op: 'add', center: [-1, 13.2, -1], size: [3.6, 1.6, 3.6], color: 'trans-yellow' },
    { label: 'roof', shape: 'cylinder', op: 'add', center: [-1, 14.8, -1], size: [5, 1.6, 5], taper: 0.15, color: 'red' },
  ],
};

export const lighthouse: ModelSource = {
  id: 'lighthouse',
  name: 'Island Lighthouse',
  tagline: 'A striped lighthouse on a rocky island, with a keeper’s hut and a glowing lamp room.',
  difficulty: 4,
  age: '9+',
  maxPerStep: 7,
  heroView: 30,
  build() {
    const body = voxelize(lighthouseProgram);
    const lamp = voxelize(lampProgram);
    lamp.forEach((x, y, z) => {
      if (body.has(x, y, z)) lamp.set(x, y, z, null);
    });
    const bb = body.bounds();
    const offset: [number, number, number] = [-bb.x0, 0, -bb.z0];
    const b = new ModelBuilder();
    b.push(compileGrid(body, { offset, slopes: true }));
    b.push(compileGrid(lamp, { offset, sub: 'Lamp Room', phase: 1 }));
    return b.out;
  },
};
