import { ModelBuilder } from '../lego/builder';
import { compileGrid } from '../lego/shapes';
import type { ModelSource } from '../lego/types';
import { VoxelGrid } from '../lego/voxel';

/**
 * A small cottage on a garden plate. The walls are drawn as voxels and the
 * brick converter lays them in a proper running bond; the roof is hand placed.
 * House footprint x 1..11, z 2..8; the front faces +z.
 */
export const cottage: ModelSource = {
  id: 'cottage',
  name: 'Cozy Cottage',
  tagline: 'A little house with a gabled roof, flower boxes and a tree in the garden.',
  difficulty: 3,
  age: '7+',
  maxPerStep: 5,
  heroView: 35,
  build() {
    const b = new ModelBuilder();
    // ---- Garden plate + path (phase 0)
    b.plate('green', 0, 0, 0, 16, 16);
    b.tile('tan', 5, 1, 8, 2, 4).tile('tan', 5, 1, 12, 2, 4);

    // ---- Walls (phase 1): 4 courses on top of the plate
    const g = new VoxelGrid();
    const X0 = 1, X1 = 11, Z0 = 2, Z1 = 8;
    for (let course = 0; course < 4; course++) {
      for (let z = Z0; z < Z1; z++)
        for (let x = X0; x < X1; x++) {
          const edge = x === X0 || x === X1 - 1 || z === Z0 || z === Z1 - 1;
          if (!edge) continue;
          let c = course === 0 ? 'tan' : 'white';
          const front = z === Z1 - 1;
          const side = x === X0 || x === X1 - 1;
          if (front && (x === 5 || x === 6) && course < 3) c = 'reddish-brown'; // door
          if (front && [2, 3, 8, 9].includes(x) && (course === 1 || course === 2)) c = 'trans-light-blue';
          if (side && (z === 4 || z === 5) && (course === 1 || course === 2)) c = 'trans-light-blue';
          if (z === Z0 && (x === 5 || x === 6) && (course === 1 || course === 2)) c = 'trans-light-blue';
          for (let dy = 0; dy < 3; dy++) g.set(x, course * 3 + dy, z, c);
        }
    }
    b.push(compileGrid(g, { offset: [0, 1, 0] }), { phase: 1 });

    // ---- Ceiling + roof (phase 2)
    b.phase = 2;
    b.plate('reddish-brown', X0, 13, Z0, 10, 6);
    const roofRow = (y: number, zFront: number, zBack: number) => {
      for (const x of [0, 4, 8]) {
        b.add('3037', 'red', x, y, zFront, 0); // faces +z
        b.add('3037', 'red', x, y, zBack, 2); // faces -z
      }
    };
    roofRow(14, 7, 1);
    b.brick('white', 1, 14, 3, 10, 2).brick('white', 1, 14, 5, 10, 2);
    roofRow(17, 6, 2);
    b.brick('white', 1, 17, 4, 10, 2);
    roofRow(20, 5, 3);
    for (const x of [0, 4, 8]) b.add('3041', 'red', x, 23, 4, 0);

    // ---- Garden details (phase 3)
    b.phase = 3;
    b.plate('green', 2, 1, 8, 2, 1).plate('green', 8, 1, 8, 2, 1);
    b.add('4073', 'red', 2, 2, 8, 0).add('4073', 'yellow', 3, 2, 8, 0);
    b.add('4073', 'pink', 8, 2, 8, 0).add('4073', 'red', 9, 2, 8, 0);
    // bush
    b.add('3941', 'bright-green', 12, 1, 4, 0).add('4032', 'bright-green', 12, 4, 4, 0);
    // mailbox
    b.add('3062b', 'dbg', 2, 1, 13, 0).add('3005', 'red', 2, 4, 13, 0).add('3070b', 'red', 2, 7, 13, 0);
    // flowers along the path
    for (const z of [10, 13]) b.add('4073', 'yellow', 4, 1, z, 0).add('4073', 'pink', 7, 1, z, 0);

    // tree, built on the side and planted in the garden
    b.group({ sub: 'Tree', phase: 3 }, () => {
      b.add('3941', 'reddish-brown', 13, 1, 11, 0).add('3941', 'reddish-brown', 13, 4, 11, 0);
      b.brick('bright-green', 12, 7, 10, 4, 2).brick('bright-green', 12, 7, 12, 4, 2);
      b.brick('bright-green', 12, 10, 10, 2, 4).brick('bright-green', 14, 10, 10, 2, 4);
      b.brick('green', 13, 13, 11, 2, 2);
      b.add('4032', 'green', 13, 16, 11, 0);
    });
    return b.out;
  },
};
