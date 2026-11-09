import { Kit, type ChicagoSource } from '../kit';

/**
 * Willis Tower — nine 75-ft "bundled tubes" in a 3x3 grid (3 studs each).
 * NW + SE stop at floor 50, NE + SW at 66, N + E + S at 90; W + center reach 108.
 * Black aluminium with bronze glass; mechanical floors read as lighter bands.
 */
export const willis: ChicagoSource = {
  id: 'willis-tower',
  name: 'Willis Tower',
  tagline: 'Nine bundled tubes stepping back at the 50th, 66th and 90th floors, crowned by twin antennas.',
  difficulty: 5,
  age: '16+',
  maxPerStep: 10,
  heroView: 30,
  info: {
    year: '1974',
    architect: 'Skidmore, Owings & Merrill (Bruce Graham, Fazlur Khan)',
    height: '442 m · 1,451 ft (527 m with antennas)',
    heightM: 442,
    floors: 108,
    style: 'Structural expressionism',
    location: 'Wacker Drive, the Loop',
    fact: 'Two of its nine tubes stop at the 50th floor, two at the 66th, three at the 90th, and the last two run to the 108th. It was the tallest building in the world for nearly 25 years.',
    scale: '1:950',
  },
  build() {
    const k = new Kit();
    k.base(15, 17, { ground: 'dbg' });
    const t = k.grid({ tall: true, tilesOnTop: true });
    // plates above the plaza for floors 50 / 66 / 90 / 108
    const top: Record<string, number> = { '0,0': 66, '2,2': 66, '2,0': 87, '0,2': 87, '1,0': 120, '2,1': 120, '1,2': 120, '0,1': 144, '1,1': 144 };
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) t.rect(3 + 3 * i, 3 + 3 * j, 6 + 3 * i, 6 + 3 * j, 2, 2 + top[`${i},${j}`], 'black');
    const bands = new Set([42, 43, 87, 88, 119, 120, 141, 142, 143]);
    t.facade(2, 147, (c) => {
      if (bands.has(c.y)) return 'dbg';
      // each tube face: black edge columns framing a bronze-glass centre
      return (c.u - 3) % 3 === 1 ? 'trans-black' : null;
    });
    // twin antennas on the west and centre tubes
    k.spire(4, 146, 7, 'black', 2, '2569', 'lbg');
    k.spire(7, 146, 7, 'black', 2, '2569', 'lbg');
    return k.compile();
  },
};
