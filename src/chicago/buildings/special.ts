import { Kit, type ChicagoSource } from '../kit';

/* ------------------------------------------------------------------ */
/* Marina City                                                         */
/* ------------------------------------------------------------------ */
export const marinaCity: ChicagoSource = {
  id: 'marina-city',
  name: 'Marina City',
  tagline: 'Twin “corncob” towers on the river: a spiral garage below, scalloped balconies above.',
  difficulty: 3,
  age: '10+',
  maxPerStep: 6,
  heroView: 25,
  info: {
    year: '1964 / 1968',
    architect: 'Bertrand Goldberg',
    height: '179 m · 587 ft',
    heightM: 179,
    floors: 65,
    style: 'Modernism (“city within a city”)',
    location: 'State Street on the Chicago River',
    fact: 'The lowest 19 floors of each tower are an open spiral parking ramp; above them, every apartment opens onto a semicircular balcony, which gives the towers their corncob look.',
    scale: '1:950',
  },
  build() {
    const k = new Kit();
    k.base(24, 19, { ground: 'lbg' });
    const river = k.grid({ tilesOnTop: true, phase: 0, ground: true });
    river.rect(0, 12, 24, 17, 1, 2, 'dark-azure');
    // the plaza deck over the marina, with boat slips opening onto the river
    const deck = k.grid({ tilesOnTop: true });
    deck.rect(1, 2, 23, 12, 2, 8, 'lbg');
    for (let x = 3; x < 22; x += 3) deck.rect(x, 11, x + 2, 12, 2, 5, null);
    for (const x of [3.5, 9.5, 15.5]) k.add('3069b', 'white', x, 2, 13, 0, 1);
    for (const cx of [7, 17]) {
      const cz = 7;
      let y = 8;
      const ring = (part: '11213' | '60474', color: string) => {
        const r = part === '11213' ? 3 : 2;
        k.add(part, color, cx - r, y, cz - r, 0, 1);
        y += 1;
      };
      // spiral parking ramp: 19 floors
      for (let i = 0; i < 11; i++) {
        ring('11213', 'lbg');
        ring('60474', 'black');
      }
      // mechanical and laundry floor
      k.add('87081', 'lbg', cx - 2, y, cz - 2, 0, 1);
      y += 3;
      // 40 floors of apartments with balconies
      for (let i = 0; i < 22; i++) {
        ring('11213', 'white');
        ring('60474', 'lbg');
      }
      // roof
      ring('11213', 'white');
      k.add('87081', 'white', cx - 2, y, cz - 2, 0, 2);
      y += 3;
      k.add('14769', 'lbg', cx - 1, y, cz - 1, 0, 2);
    }
    return k.compile();
  },
};

/* ------------------------------------------------------------------ */
/* Frederick C. Robie House                                            */
/* ------------------------------------------------------------------ */
export const robieHouse: ChicagoSource = {
  id: 'robie-house',
  name: 'Robie House',
  tagline: 'Frank Lloyd Wright’s Prairie-style house: long Roman brick, bands of art glass and daring cantilevered roofs.',
  difficulty: 3,
  age: '12+',
  maxPerStep: 7,
  heroView: 30,
  info: {
    year: '1910',
    architect: 'Frank Lloyd Wright',
    height: '3 storeys',
    heightM: 12,
    floors: 3,
    style: 'Prairie School',
    location: 'Hyde Park, University of Chicago',
    fact: 'Steel beams let the low hipped roofs cantilever about 20 feet beyond their supports, and the house is part of a UNESCO World Heritage listing of Wright’s work.',
    scale: '1:160',
  },
  build() {
    const k = new Kit();
    k.base(38, 18, { ground: 'bright-green' });
    const t = k.grid({ texture: { 'dark-orange': 'masonry' } });
    // garden walls and the ground floor
    t.rect(1, 9, 37, 11, 2, 5, 'dark-orange');
    t.rect(4, 3, 32, 10, 2, 11, 'dark-orange');
    t.rect(1, 9, 37, 11, 5, 6, 'tan');
    // main floor with its long band of art-glass windows
    t.rect(4, 3, 32, 10, 11, 21, 'dark-orange');
    t.facade(12, 20, (c) => (c.y >= 13 && c.y <= 18 && c.i % 3 !== 0 ? (c.y === 13 ? 'tan' : 'black') : null));
    t.rect(4, 3, 32, 10, 11, 12, 'tan');
    // balcony walls with planters along the front
    t.rect(6, 10, 24, 12, 11, 15, 'dark-orange');
    t.rect(6, 10, 24, 12, 15, 16, 'tan');
    // the main cantilevered roof, sweeping past both ends
    const roof = k.grid({ tilesOnTop: true });
    roof.rect(0, 1, 38, 12, 21, 22, 'reddish-brown');
    roof.rect(2, 2, 36, 11, 22, 23, 'reddish-brown');
    // third-floor bedroom block with its own roof
    t.rect(13, 4, 25, 9, 23, 31, 'dark-orange');
    t.facade(24, 30, (c) => (c.y >= 25 && c.y <= 28 && c.i % 3 !== 0 ? 'black' : null));
    roof.rect(10, 2, 28, 11, 31, 32, 'reddish-brown');
    roof.rect(12, 3, 26, 10, 32, 33, 'reddish-brown');
    roof.rect(17, 5, 21, 8, 31, 33, null); // the chimney rises through the roof
    // the broad central chimney
    t.rect(17, 5, 21, 8, 23, 37, 'dark-orange');
    t.rect(16, 5, 22, 8, 37, 38, 'tan');
    // planters
    for (const x of [7, 12, 17, 22]) k.add('4032', 'green', x, 16, 10, 0, 2);
    return k.compile();
  },
};

/* ------------------------------------------------------------------ */
/* Wrigley Field                                                       */
/* ------------------------------------------------------------------ */
export const wrigleyField: ChicagoSource = {
  id: 'wrigley-field',
  name: 'Wrigley Field',
  tagline: 'The Friendly Confines: ivy-covered outfield walls, bleachers, the hand-turned scoreboard and the red marquee.',
  difficulty: 4,
  age: '12+',
  maxPerStep: 10,
  heroView: 15,
  info: {
    year: '1914',
    architect: 'Zachary Taylor Davis',
    height: 'Ballpark · about 41,000 seats',
    heightM: 20,
    style: 'Classic ballpark',
    location: 'Clark & Addison, Wrigleyville',
    fact: 'The ivy on the outfield walls was planted in 1937, the same year the hand-operated centre-field scoreboard was built; numbers are still changed by hand.',
    scale: '1:1000',
  },
  build() {
    const k = new Kit();
    const W = 34, D = 36;
    k.base(W, D);
    // home plate near the front; centre field toward the back (-z)
    const hx = 17, hz = 22;
    const ang = (x: number, z: number) => (Math.atan2(x + 0.5 - hx, hz - (z + 0.5)) * 180) / Math.PI; // 0 = centre field
    const dist = (x: number, z: number) => Math.hypot(x + 0.5 - hx, z + 0.5 - hz);
    // the street outside, with the Clark & Addison corner in front (field layers below win over it)
    const street = k.grid({ tilesOnTop: true, phase: 0, ground: true });
    street.rect(0, 0, W, D - 2, 1, 2, 'dbg');
    const field = k.grid({ tilesOnTop: true, phase: 0, ground: true });
    field.shape(0, 0, W, D - 2, 1, 2, (x, z) => dist(x, z) <= 17 && Math.abs(ang(x, z)) <= 50, 'green');
    field.shape(0, 0, W, D - 2, 1, 2, (x, z) => dist(x, z) < 5.5 && Math.abs(ang(x, z)) > 50, 'green');
    // infield dirt: the diamond and the base paths
    field.paint((x, _y, z) => {
      const px = x + 0.5 - hx, pz = hz - (z + 0.5);
      const a = (px + pz) / Math.SQRT2, b = (pz - px) / Math.SQRT2;
      const inDiamond = a >= -0.6 && b >= -0.6 && a <= 4.4 && b <= 4.4;
      const onPath = inDiamond && (a < 0.8 || b < 0.8 || a > 3.1 || b > 3.1);
      return onPath || (inDiamond && dist(x, z) > 6.2 && dist(x, z) < 7.8);
    }, 'tan');
    const s = k.grid({ tilesOnTop: true });
    // grandstands wrap from foul pole to foul pole behind home plate, rising row by row
    s.shape(0, 0, W, D, 2, 12, (x, z, y) => {
      const d = dist(x, z), a = Math.abs(ang(x, z));
      if (a <= 46 || z >= D - 2) return false;
      if (d < 5.5 || d > 10.5) return false;
      return y < 2 + (d - 5.5) * 1.5;
    }, 'dark-green');
    // upper-deck roof
    s.shape(0, 0, W, D, 10, 12, (x, z) => {
      const d = dist(x, z), a = Math.abs(ang(x, z));
      return a > 46 && d >= 9.5 && d <= 11.5 && z < D - 2;
    }, 'dbg');
    // the ivy-covered outfield wall and the bleachers behind it
    s.shape(0, 0, W, D, 2, 5, (x, z) => Math.abs(ang(x, z)) <= 50 && dist(x, z) > 17 && dist(x, z) <= 18, 'green');
    s.shape(0, 0, W, D, 2, 11, (x, z, y) => {
      const d = dist(x, z);
      return Math.abs(ang(x, z)) <= 47 && d > 18 && d <= 21.5 && y < 3 + (d - 18) * 2.2;
    }, 'dark-green');
    // the hand-turned scoreboard in centre field
    s.rect(14, 0, 21, 1, 11, 20, 'dark-green');
    s.facade(12, 19, (c) => (c.dir === 'S' && c.y % 2 === 0 && c.i > 0 && c.i < c.n - 1 ? 'white' : null));
    k.add('3062b', 'white', 17, 20, 0, 0, 3);
    k.add('3957', 'flat-silver', 17, 23, 0, 0, 3);
    // the red marquee outside the main gate, behind home plate
    for (const x of [14, 19]) for (const y of [2, 5]) k.add('3005', 'black', x, y, 33, 0, 3);
    k.add('3008', 'red', 13, 8, 33, 1, 3);
    k.add('3460', 'white', 13, 11, 33, 1, 3);
    k.add('3008', 'red', 13, 12, 33, 1, 3);
    // pitcher's mound
    k.add('98138', 'tan', 16.5, 2, 17.5, 0, 2);
    return k.compile();
  },
};
