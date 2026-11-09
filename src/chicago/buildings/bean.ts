import { Kit, type ChicagoSource } from '../kit';

/**
 * Cloud Gate ("The Bean") on AT&T Plaza in Millennium Park.
 * 20 x 13 x 10 m at 0.8 m per stud: 25 x 16 studs, 31 plates tall.
 * A drop of liquid mercury: a rounded top that tucks under at the sides and an
 * arch underneath with the concave "omphalos" you can walk beneath.
 */
export const bean: ChicagoSource = {
  id: 'cloud-gate',
  name: 'Cloud Gate (The Bean)',
  tagline: 'Anish Kapoor’s mirror-polished “Bean” in Millennium Park, with its arch and omphalos to walk under.',
  difficulty: 3,
  age: '10+',
  maxPerStep: 8,
  heroView: 20,
  info: {
    year: '2006',
    architect: 'Anish Kapoor (sculptor)',
    height: '10 m · 33 ft (20 × 13 m footprint)',
    heightM: 10,
    style: 'Public sculpture',
    location: 'AT&T Plaza, Millennium Park',
    fact: 'Its skin is 168 stainless-steel plates welded and polished until no seam shows, inspired by liquid mercury. Underneath, a 12-foot arch leads to the “omphalos”, a concave chamber that bends reflections.',
    scale: '1:100',
  },
  build() {
    const k = new Kit();
    const W = 33, D = 26;
    const plaza = k.base(W, D, { ground: 'lbg' })!;
    void plaza;
    const border = k.grid({ tilesOnTop: true, phase: 0, ground: true });
    border.shape(0, 0, W, D - 2, 1, 2, (x, z) => x < 1 || x >= W - 1 || z < 1 || z >= D - 3, 'dbg');

    const t = k.grid({ tilesOnTop: true });
    const cx = W / 2, cz = 11.5, a = 12.5, c = 8, H = 31, p = 2.2;
    const b = H / 2;
    t.shape(0, 0, W, D, 2, 2 + H + 1, (x, z, y) => {
      const dx = (x + 0.5 - cx) / a, dz = (z + 0.5 - cz) / c;
      const r = Math.pow(Math.pow(Math.abs(dx), p) + Math.pow(Math.abs(dz), p), 1 / p);
      if (r > 1) return false;
      const h = y - 2 + 0.5; // plates above the plaza (cell centre)
      // a drop of mercury: an elliptical top over a flatter underside that curls in at the edges
      const top = b * (1 + Math.sqrt(Math.max(0, 1 - r * r)));
      const under = b * (1 - Math.pow(Math.max(0, 1 - Math.pow(r, 4)), 0.25));
      // the 12-foot arch runs under the middle from front to back, then up into the omphalos
      const arch = Math.abs(dx) < 0.6 ? 12 * Math.pow(1 - Math.pow(dx / 0.6, 2), 0.55) : 0;
      const omph = 2.5 * Math.max(0, 1 - Math.pow(dx / 0.3, 2) - Math.pow(dz / 0.55, 2));
      const bottom = Math.max(under, arch + omph);
      return h >= bottom && h < top;
    }, 'chrome-silver');
    t.g.hollow(2);

    // visitors for scale (about 1.7 m tall)
    const people: [number, number, string][] = [
      [4, 4, 'red'], [6, 19, 'blue'], [10, 21, 'yellow'], [15, 13, 'white'], [17, 11, 'dark-green'],
      [22, 21, 'orange'], [27, 18, 'medium-azure'], [29, 6, 'lavender'], [24, 3, 'black'], [9, 2, 'tan'],
    ];
    const skin = ['tan', 'medium-nougat', 'reddish-brown', 'tan', 'medium-nougat'];
    people.forEach(([x, z, col], i) => {
      k.add('3062b', i % 3 === 0 ? 'dark-blue' : 'dbg', x, 2, z, 0, 3);
      k.add('4073', col, x, 5, z, 0, 3);
      k.add('4073', skin[i % skin.length], x, 6, z, 0, 3);
    });
    // trees at the edge of the plaza
    for (const x of [2, 30]) for (const z of [8, 15]) {
      k.add('3062b', 'reddish-brown', x, 2, z, 0, 2);
      k.add('3062b', 'reddish-brown', x, 5, z, 0, 2);
      k.add('3941', 'green', x - 0.5, 8, z - 0.5, 0, 2);
      k.add('4032', 'bright-green', x - 0.5, 11, z - 0.5, 0, 2);
    }
    return k.compile();
  },
};
