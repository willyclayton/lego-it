import { ModelBuilder } from '../lego/builder';
import type { ModelSource } from '../lego/types';

/**
 * Open-wheel formula racer. Front faces +z, width x 0..6, length z 0..16.
 * Wheels hang on 2x2 wheel-holder plates; the rear wing is a sub-assembly.
 */
export const racer: ModelSource = {
  id: 'racer',
  name: 'Formula Racer',
  tagline: 'An open-wheel race car with sidepods, a driver and a big rear wing.',
  difficulty: 2,
  age: '6+',
  maxPerStep: 4,
  heroView: 40,
  build() {
    const b = new ModelBuilder();
    const wheelY = 0.5; // wheel center lines up with the holder pins (plate 2)

    // ---- Chassis (phase 0)
    b.add('4600', 'dbg', 2, 2, 2, 0).add('4600', 'dbg', 2, 2, 12, 0);
    b.plate('dbg', 2, 2, 0, 2, 2).plate('dbg', 2, 2, 4, 2, 8);
    b.plate('black', 0, 2, 14, 6, 2); // front wing
    b.plate('red', 2, 3, 0, 2, 4).plate('red', 0, 3, 4, 6, 8).plate('red', 2, 3, 12, 2, 4);

    // ---- Body (phase 1)
    b.phase = 1;
    b.brick('red', 0, 4, 5, 2, 6).brick('red', 4, 4, 5, 2, 6); // sidepods
    b.brick('red', 2, 4, 1, 2, 4); // engine cover
    b.brick('red', 2, 4, 5, 2, 2); // behind the driver
    b.plate('black', 2, 4, 7, 2, 3); // cockpit floor
    b.brick('red', 2, 4, 10, 2, 2);
    b.add('3298', 'red', 2, 4, 12, 0); // nose cone
    b.tile('white', 0, 3, 14, 1, 2).tile('white', 5, 3, 14, 1, 2); // front wing end plates

    // ---- Details (phase 2)
    b.phase = 2;
    b.tile('red', 0, 7, 5, 2, 4).tile('red', 4, 7, 5, 2, 4);
    b.add('3039', 'red', 0, 7, 9, 0).add('3039', 'red', 4, 7, 9, 0); // sidepod fronts
    b.add('3039', 'red', 2, 7, 5, 0); // air box
    b.add('15068', 'red', 2, 7, 10, 0); // smooth nose top
    // driver
    b.brick('blue', 2, 5, 8, 2, 1);
    b.brick('black', 2, 5, 7, 2, 1); // seat back
    b.add('3794', 'blue', 2, 8, 8, 1);
    b.add('3062b', 'yellow', 2.5, 9, 8, 0);
    b.add('98138', 'trans-dark-blue', 2.5, 12, 8, 0);

    // ---- Rear wing sub-assembly
    b.group({ sub: 'Rear Wing', phase: 2 }, () => {
      b.plate('black', 2, 7, 1, 2, 2);
      b.brick('black', 2, 8, 1, 2, 2);
      b.plate('red', 0, 11, 1, 6, 2);
      b.tile('white', 0, 12, 1, 1, 2).tile('white', 5, 12, 1, 1, 2);
      b.tile('red', 1, 12, 1, 4, 2);
    });

    // ---- Wheels (phase 3): rim + tire on each pin
    b.phase = 3;
    for (const z of [2, 12]) {
      b.add('4624', 'lbg', 1.1, wheelY, z, 0).add('3641', 'black', 1.1, wheelY, z, 0);
      b.add('4624', 'lbg', 3.9, wheelY, z, 2).add('3641', 'black', 3.9, wheelY, z, 2);
    }
    return b.out;
  },
};
