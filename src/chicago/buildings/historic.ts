import type { Rot } from '../../lego/types';
import { Kit, type ChicagoSource, type Grid } from '../kit';

/** A projecting cornice of inverted slopes along the top edges of a rectangle. */
function cornice(k: Kit, x0: number, z0: number, x1: number, z1: number, y: number, color: string, phase = 2) {
  for (let x = x0; x < x1; x++) {
    k.add('3665', color, x, y, z1 - 1, 0, phase); // south: overhang toward +z
    k.add('3665', color, x, y, z0 - 1, 2, phase); // north
  }
  for (let z = z0 + 1; z < z1 - 1; z++) {
    k.add('3665', color, x1 - 1, y, z, 1 as Rot, phase); // east
    k.add('3665', color, x0 - 1, y, z, 3 as Rot, phase); // west
  }
}

/** Battlements: alternating merlons along the top edge of a rectangle. */
function crenellate(g: Grid, x0: number, z0: number, x1: number, z1: number, y: number, h: number, color: string, skip = (_x: number, _z: number) => false) {
  for (let x = x0; x < x1; x++)
    for (let z = z0; z < z1; z++) {
      const edge = x === x0 || x === x1 - 1 || z === z0 || z === z1 - 1;
      if (edge && (x + z) % 2 === 0 && !skip(x, z) && g.has(x, y - 1, z)) g.rect(x, z, x + 1, z + 1, y, y + h, color);
    }
}

/* ------------------------------------------------------------------ */
/* Tribune Tower                                                       */
/* ------------------------------------------------------------------ */
export const tribune: ChicagoSource = {
  id: 'tribune-tower',
  name: 'Tribune Tower',
  tagline: 'A neo-Gothic limestone shaft crowned by an octagonal lantern and flying buttresses.',
  difficulty: 4,
  age: '14+',
  maxPerStep: 8,
  heroView: 35,
  info: {
    year: '1925',
    architect: 'John Mead Howells and Raymond Hood',
    height: '141 m · 462 ft',
    heightM: 141,
    floors: 36,
    style: 'Neo-Gothic',
    location: 'Michigan Avenue, Magnificent Mile',
    fact: 'The design won the Chicago Tribune’s 1922 international competition, and stones from famous sites around the world, such as the Great Wall and the Parthenon, are set into the walls at street level.',
    scale: '1:350',
  },
  build() {
    const k = new Kit();
    k.base(16, 18, { ground: 'lbg' });
    const t = k.grid({ tall: true, tilesOnTop: true });
    // main shaft with Gothic piers
    t.rect(3, 2, 12, 14, 2, 80, 'dark-tan');
    t.facade(2, 80, (c) => (c.i % 2 === 1 && c.i < c.n - 1 && c.y > 4 ? 'carve' : 'tan'));
    // the entrance arch on Michigan Avenue
    t.rect(6, 13, 9, 14, 2, 12, null);
    t.rect(7, 13, 8, 14, 12, 14, null);
    // pinnacles at the shaft corners
    for (const [x, z] of [[3, 2], [11, 2], [3, 13], [11, 13]]) {
      t.rect(x, z, x + 1, z + 1, 80, 92, 'tan');
      k.add('4589', 'tan', x, 92, z, 0, 3);
    }
    // octagonal crown (chamfered square) with flying buttresses from the corners
    const oct = (y0: number, y1: number, x0: number, z0: number, s: number, c: string) =>
      t.shape(x0, z0, x0 + s, z0 + s, y0, y1, (x, z) => Math.abs(x + 0.5 - (x0 + s / 2)) + Math.abs(z + 0.5 - (z0 + s / 2)) <= s * 0.72, c);
    oct(80, 104, 4, 4, 7, 'tan');
    t.facade(84, 102, (c) => (c.i % 2 === 1 && c.i > 0 && c.i < c.n - 1 ? 'carve' : null));
    for (const [x, z, dx, dz] of [[4, 3, 1, 1], [10, 3, -1, 1], [4, 12, 1, -1], [10, 12, -1, -1]]) {
      t.rect(x, z, x + 1, z + 1, 80, 88, 'tan');
      t.rect(x + dx, z + dz, x + dx + 1, z + dz + 1, 86, 96, 'tan');
    }
    oct(104, 110, 5, 5, 5, 'tan');
    for (const [x, z] of [[5, 7], [9, 7], [7, 5], [7, 9]]) k.add('4589', 'tan', x, 110, z, 0, 3);
    k.add('3062b', 'tan', 7, 110, 7, 0, 3);
    k.add('4589', 'tan', 7, 113, 7, 0, 3);
    return k.compile();
  },
};

/* ------------------------------------------------------------------ */
/* Wrigley Building                                                    */
/* ------------------------------------------------------------------ */
export const wrigleyBuilding: ChicagoSource = {
  id: 'wrigley-building',
  name: 'Wrigley Building',
  tagline: 'Gleaming white terra cotta, a clock tower facing the river and two towers linked by sky bridges.',
  difficulty: 4,
  age: '14+',
  maxPerStep: 8,
  heroView: 30,
  info: {
    year: '1921 / 1924',
    architect: 'Graham, Anderson, Probst & White',
    height: '134 m · 438 ft',
    heightM: 134,
    floors: 30,
    style: 'Spanish Colonial Revival',
    location: 'Michigan Avenue at the river',
    fact: 'The clock tower was modelled on the Giralda bell tower in Seville, and the facade is glazed terra cotta in several shades of white that get brighter toward the top.',
    scale: '1:350',
  },
  build() {
    const k = new Kit();
    k.base(16, 25, { ground: 'lbg' });
    const river = k.grid({ tilesOnTop: true, phase: 0, ground: true });
    river.rect(0, 20, 16, 23, 1, 2, 'dark-azure');
    const t = k.grid({ tall: true, tilesOnTop: true });
    // north building, plaza gap, south building with the clock tower facing the river
    t.rect(3, 1, 13, 7, 2, 44, 'lbg');
    t.rect(3, 9, 13, 19, 2, 52, 'lbg');
    t.rect(7, 7, 9, 9, 6, 9, 'lbg'); // sky bridge (3rd floor)
    t.rect(7, 7, 9, 9, 37, 40, 'lbg'); // sky bridge (14th floor)
    t.facade(2, 52, (c) => (c.i % 2 === 1 && c.i < c.n - 1 && c.y > 5 && c.y < 49 ? 'carve' : 'white'));
    // clock tower
    t.rect(5, 13, 11, 19, 52, 80, 'lbg');
    t.facade(52, 80, (c) => (c.i % 2 === 1 && c.i < c.n - 1 && c.y < 76 ? 'carve' : 'white'));
    t.rect(5, 13, 11, 19, 80, 90, 'white');
    // clock faces on all four sides: dark frame, white dial, gold hands
    t.facade(81, 89, (c) => {
      if (c.i < 1 || c.i > 4) return null;
      if (c.y === 81 || c.y === 88 || c.i === 1 || c.i === 4) return 'black';
      return c.i === 2 && c.y >= 84 ? 'pearl-gold' : 'white';
    });
    // tiered cupola
    t.rect(6, 14, 10, 18, 90, 96, 'white');
    t.facade(91, 96, (c) => (c.i % 2 === 1 ? 'carve' : null));
    t.rect(6, 14, 10, 18, 96, 97, 'white');
    k.add('3941', 'white', 7, 97, 15, 0, 3);
    k.add('3941', 'white', 7, 100, 15, 0, 3);
    k.add('3942', 'white', 7, 103, 15, 0, 3);
    k.add('3957', 'pearl-gold', 7.5, 109, 15.5, 0, 3);
    return k.compile();
  },
};

/* ------------------------------------------------------------------ */
/* Chicago Water Tower                                                 */
/* ------------------------------------------------------------------ */
export const waterTower: ChicagoSource = {
  id: 'water-tower',
  name: 'Chicago Water Tower',
  tagline: 'The castellated limestone tower that survived the Great Chicago Fire.',
  difficulty: 3,
  age: '10+',
  maxPerStep: 7,
  heroView: 35,
  info: {
    year: '1869',
    architect: 'William W. Boyington',
    height: '47 m · 154 ft',
    heightM: 47,
    style: 'Gothic Revival (castellated)',
    location: 'Michigan Avenue, Magnificent Mile',
    fact: 'Built of yellow Joliet limestone to hide a 138-foot standpipe, it was one of the few buildings in the burned district to survive the Great Chicago Fire of 1871.',
    scale: '1:110',
  },
  build() {
    const k = new Kit();
    k.base(20, 22, { ground: 'bright-green' });
    const path = k.grid({ tilesOnTop: true, phase: 0, ground: true });
    path.rect(8, 16, 12, 20, 1, 2, 'tan');
    const t = k.grid({ tall: true, tilesOnTop: true });
    // base block with carved-out corners for the turrets
    t.rect(3, 3, 17, 17, 2, 20, 'tan');
    for (const [x, z] of [[3, 3], [15, 3], [3, 15], [15, 15]]) t.rect(x, z, x + 2, z + 2, 2, 20, null);
    // doorways and narrow windows
    t.facade(2, 20, (c) => {
      const mid = Math.abs(c.i - (c.n - 1) / 2);
      if (mid < 1 && c.y < 11) return 'black';
      if (mid > 3 && mid < 4.5 && c.y > 6 && c.y < 16) return 'dark-tan';
      return null;
    });
    crenellate(t, 3, 3, 17, 17, 20, 2, 'tan', (x, z) => (x < 5 || x >= 15) && (z < 5 || z >= 15));
    for (const [x, z] of [[3, 3], [15, 3], [3, 15], [15, 15]]) {
      for (let y = 2; y < 23; y += 3) k.add('3941', 'tan', x, y, z, 0, 1);
      k.add('3942', 'dark-tan', x, 23, z, 0, 2);
    }
    // second tier with corner pinnacles
    t.rect(6, 6, 14, 14, 20, 38, 'tan');
    t.facade(22, 36, (c) => (Math.abs(c.i - (c.n - 1) / 2) < 1 && c.y > 25 && c.y < 33 ? 'black' : null));
    for (const [x, z] of [[6, 6], [13, 6], [6, 13], [13, 13]]) {
      t.rect(x, z, x + 1, z + 1, 38, 44, 'tan');
      k.add('4589', 'dark-tan', x, 44, z, 0, 2);
    }
    // shaft with tall lancet windows
    t.rect(7, 7, 13, 13, 38, 66, 'tan');
    t.facade(40, 64, (c) => (c.i >= 2 && c.i <= 3 && c.y > 44 && c.y < 58 ? 'black' : null));
    // octagonal upper stage and lantern
    t.shape(7, 7, 13, 13, 66, 78, (x, z) => Math.abs(x + 0.5 - 10) + Math.abs(z + 0.5 - 10) <= 3.6, 'tan');
    t.facade(68, 76, (c) => (c.i === Math.floor((c.n - 1) / 2) && c.y > 69 && c.y < 75 ? 'black' : null));
    k.add('3941', 'tan', 9, 78, 9, 0, 3);
    k.add('3941', 'dark-tan', 9, 81, 9, 0, 3);
    k.add('4032', 'tan', 9, 84, 9, 0, 3);
    k.add('3062b', 'dbg', 9.5, 85, 9.5, 0, 3);
    k.add('4589', 'dbg', 9.5, 88, 9.5, 0, 3);
    return k.compile();
  },
};

/* ------------------------------------------------------------------ */
/* Chicago Board of Trade Building                                     */
/* ------------------------------------------------------------------ */
export const boardOfTrade: ChicagoSource = {
  id: 'board-of-trade',
  name: 'Chicago Board of Trade Building',
  tagline: 'An Art Deco “throne” closing the end of LaSalle Street, topped by a pyramid and the goddess Ceres.',
  difficulty: 4,
  age: '14+',
  maxPerStep: 9,
  heroView: 30,
  info: {
    year: '1930',
    architect: 'Holabird & Root',
    height: '184 m · 605 ft (with statue)',
    heightM: 184,
    floors: 44,
    style: 'Art Deco',
    location: 'LaSalle Street at Jackson Boulevard',
    fact: 'A 31-foot faceless aluminium statue of Ceres, Roman goddess of grain, stands on the copper pyramid roof; it was Chicago’s tallest building until 1965.',
    scale: '1:600',
  },
  build() {
    const k = new Kit();
    k.base(17, 21, { ground: 'lbg' });
    const t = k.grid({ tall: true, tilesOnTop: true, slopes: true });
    // twelve-storey base, then the throne: two side wings and the central tower
    t.rect(2, 2, 15, 18, 2, 32, 'dbg');
    t.rect(2, 2, 5, 16, 32, 50, 'dbg');
    t.rect(12, 2, 15, 16, 32, 50, 'dbg');
    t.rect(5, 3, 12, 15, 32, 86, 'dbg');
    t.rect(6, 4, 11, 14, 86, 92, 'dbg');
    t.facade(2, 92, (c) => (c.i % 2 === 1 && c.i < c.n - 1 && c.y > 6 ? 'carve' : 'lbg'));
    // the clock above the LaSalle Street entrance
    t.facade(22, 28, (c) => (c.dir === 'S' && Math.abs(c.i - (c.n - 1) / 2) < 1.5 ? (c.y === 24 || c.y === 25 ? 'pearl-gold' : 'black') : null));
    // copper pyramid (green with age)
    let y = 92;
    for (let i = 0; i < 3; i++, y += 3) t.rect(6 + i, 4 + i, 11 - i, 14 - i, y, y + 3, 'sand-green');
    // Ceres
    k.add('3062b', 'flat-silver', 8, y, 8, 0, 3);
    k.add('4589', 'flat-silver', 8, y + 3, 8, 0, 3);
    return k.compile();
  },
};

/* ------------------------------------------------------------------ */
/* The Rookery                                                         */
/* ------------------------------------------------------------------ */
export const rookery: ChicagoSource = {
  id: 'rookery',
  name: 'The Rookery',
  tagline: 'A Romanesque block of red brick and terra cotta around a glass-roofed light court.',
  difficulty: 4,
  age: '14+',
  maxPerStep: 9,
  heroView: 35,
  info: {
    year: '1888',
    architect: 'Burnham & Root (lobby remodelled by Frank Lloyd Wright, 1905)',
    height: '55 m · 181 ft',
    heightM: 55,
    floors: 12,
    style: 'Chicago School / Romanesque Revival',
    location: 'LaSalle Street, the Loop',
    fact: 'Its masonry outer walls surround an iron-framed light court; Frank Lloyd Wright later remodelled the court’s lobby in white marble and gold.',
    scale: '1:300',
  },
  build() {
    const k = new Kit();
    k.base(20, 21, { ground: 'lbg' });
    const t = k.grid({ tilesOnTop: true, texture: { 'reddish-brown': 'masonry' } });
    t.rect(2, 2, 18, 19, 2, 44, 'reddish-brown');
    // the light court, roofed in glass above the lobby
    t.rect(7, 7, 13, 14, 11, 44, null);
    t.rect(7, 7, 13, 14, 10, 11, 'trans-clear');
    // granite base, arched windows and the LaSalle Street entrance
    t.facade(2, 44, (c) => {
      if (c.y < 8) return c.i % 3 === 1 && c.y > 2 ? 'black' : 'dark-tan';
      if (c.i % 2 === 1 && c.i < c.n - 1 && c.y >= 11 && c.y < 41) return 'carve';
      return null;
    });
    t.rect(8, 18, 12, 19, 2, 8, null);
    t.rect(8, 18, 12, 19, 8, 10, 'dark-tan');
    cornice(k, 2, 2, 18, 19, 44, 'reddish-brown');
    return k.compile();
  },
};

/* ------------------------------------------------------------------ */
/* Monadnock Building                                                  */
/* ------------------------------------------------------------------ */
export const monadnock: ChicagoSource = {
  id: 'monadnock',
  name: 'Monadnock Building',
  tagline: 'A sheer slab of dark brick with rows of bay windows, a flared base and a flared cornice.',
  difficulty: 3,
  age: '12+',
  maxPerStep: 9,
  heroView: 25,
  info: {
    year: '1891 / 1893',
    architect: 'Burnham & Root (north half); Holabird & Roche (south half)',
    height: '60 m · 197 ft',
    heightM: 60,
    floors: 16,
    style: 'Chicago School',
    location: 'Dearborn Street, the Loop',
    fact: 'The north half is one of the tallest load-bearing brick buildings ever built: its walls are six feet thick at the base.',
    scale: '1:250',
  },
  build() {
    const k = new Kit();
    k.base(31, 16, { ground: 'lbg' });
    const t = k.grid({ tilesOnTop: true, texture: { 'dark-brown': 'masonry' } });
    // flared base (one stud wider), then the plain slab
    t.rect(2, 2, 29, 12, 2, 5, 'dark-brown');
    t.rect(3, 3, 28, 11, 5, 58, 'dark-brown');
    // projecting bay windows on both long sides
    for (let x = 4; x < 27; x += 4)
      for (const z of [2, 11]) {
        t.rect(x, z, x + 2, z + 1, 9, 54, 'dark-brown');
      }
    // tall window strips on the bays and between them (the brick piers stay dark brown)
    t.facade(8, 56, (c) => ((c.dir === 'N' || c.dir === 'S') && c.i % 2 === 0 && c.i > 0 && c.i < c.n - 1 ? 'black' : null));
    t.rect(4, 4, 27, 10, 58, 61, 'dark-brown');
    cornice(k, 3, 3, 28, 11, 58, 'dark-brown');
    return k.compile();
  },
};

/* ------------------------------------------------------------------ */
/* Merchandise Mart                                                    */
/* ------------------------------------------------------------------ */
export const mart: ChicagoSource = {
  id: 'merchandise-mart',
  name: 'Merchandise Mart',
  tagline: 'The two-block Art Deco giant on the river, with corner towers and a central crown.',
  difficulty: 4,
  age: '14+',
  maxPerStep: 10,
  heroView: 25,
  info: {
    year: '1930',
    architect: 'Graham, Anderson, Probst & White',
    height: '103 m · 343 ft',
    heightM: 103,
    floors: 25,
    style: 'Art Deco',
    location: 'Wells Street on the Chicago River',
    fact: 'When it opened it was the largest building in the world by floor area, about 4 million square feet, and it once had its own ZIP code.',
    scale: '1:1600',
  },
  build() {
    const k = new Kit();
    k.base(30, 19, { ground: 'lbg' });
    const river = k.grid({ tilesOnTop: true, phase: 0, ground: true });
    river.rect(0, 13, 30, 17, 1, 2, 'dark-azure');
    const t = k.grid({ tall: true, tilesOnTop: true, slopes: true });
    t.rect(2, 2, 28, 12, 2, 26, 'dark-tan');
    // corner pavilions and the central tower
    for (const [x, z] of [[2, 2], [25, 2], [2, 9], [25, 9]]) t.rect(x, z, x + 3, z + 3, 26, 29, 'dark-tan');
    t.rect(12, 4, 18, 10, 26, 35, 'dark-tan');
    t.rect(13, 5, 17, 9, 35, 38, 'dark-tan');
    t.facade(2, 38, (c) => (c.i % 2 === 1 && c.i < c.n - 1 && c.y > 4 ? 'carve' : 'tan'));
    t.rect(13, 5, 17, 9, 38, 41, 'tan');
    t.rect(14, 6, 16, 8, 41, 44, 'tan');
    return k.compile();
  },
};
