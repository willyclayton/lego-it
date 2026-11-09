import { ModelBuilder } from '../lego/builder';
import type { ModelSource } from '../lego/types';

/** 18 pieces. Front faces +z (the beak). */
export const duck: ModelSource = {
  id: 'duck',
  name: 'Rubber Duck',
  tagline: 'A bath-time classic floating on a little pond. Your first build!',
  difficulty: 1,
  age: '4+',
  maxPerStep: 3,
  heroView: 40,
  build() {
    const b = new ModelBuilder();
    // pond
    b.plate('dark-azure', -1, 0, -1, 8, 8);
    // body, first course: three 2x6 bricks along z
    b.brick('yellow', 0, 1, 0, 2, 6).brick('yellow', 2, 1, 0, 2, 6).brick('yellow', 4, 1, 0, 2, 6);
    // second course: crossed bricks + rounded back corners + tail
    b.brick('yellow', 0, 4, 2, 6, 2).brick('yellow', 0, 4, 4, 6, 2);
    b.add('3039', 'yellow', 0, 4, 0, 3); // back-left corner slopes outward
    b.add('3039', 'yellow', 4, 4, 0, 1); // back-right corner
    b.add('3039', 'yellow', 2, 4, 0, 0); // tail
    // wings + neck
    b.add('3039', 'yellow', 0, 7, 2, 3);
    b.add('3039', 'yellow', 4, 7, 2, 1);
    b.brick('yellow', 2, 7, 3, 2, 2);
    // beak plate pokes out the front
    b.plate('orange', 2, 10, 3, 2, 4);
    // head
    b.brick('yellow', 2, 11, 3, 2, 2);
    b.tile('orange', 2, 11, 5, 2, 2);
    // eyes
    b.add('4073', 'black', 2, 14, 4, 0).add('4073', 'black', 3, 14, 4, 0);
    b.tile('yellow', 2, 14, 3, 2, 1);
    return b.out;
  },
};
