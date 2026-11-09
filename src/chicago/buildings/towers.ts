import { Kit, type ChicagoSource } from '../kit';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ------------------------------------------------------------------ */
/* 875 North Michigan (John Hancock Center)                            */
/* ------------------------------------------------------------------ */
export const hancock: ChicagoSource = {
  id: 'hancock-center',
  name: '875 North Michigan',
  tagline: 'The tapering black tower wrapped in giant X-braces, better known as the John Hancock Center.',
  difficulty: 5,
  age: '16+',
  maxPerStep: 10,
  heroView: 35,
  info: {
    year: '1969',
    architect: 'Skidmore, Owings & Merrill (Bruce Graham, Fazlur Khan)',
    height: '344 m · 1,128 ft (457 m with antennas)',
    heightM: 344,
    floors: 100,
    style: 'Structural expressionism',
    location: 'Magnificent Mile, Streeterville',
    fact: 'The exterior X-bracing carries the wind loads, so the 100-storey tower needed far less steel than a conventional frame. It tapers from about 50 × 81 m at the base to 30 × 49 m at the top.',
    scale: '1:1300',
  },
  build() {
    const k = new Kit();
    k.base(16, 21, { ground: 'dbg' });
    const t = k.grid({ tilesOnTop: true });
    const H = 138; // plates above the plaza
    const cx = 8, cz = 9;
    t.shape(0, 0, 16, 19, 2, 2 + H, (x, z, y) => {
      const f = (y - 2) / H;
      return Math.abs(x + 0.5 - cx) <= lerp(4, 2.5, f) && Math.abs(z + 0.5 - cz) <= lerp(6.5, 4, f);
    }, 'black');
    // five tiers of X-braces with horizontal ties, stepped per brick course so they stay bricks
    const ties = [2, 29, 56, 83, 110, 137];
    t.facade(2, 2 + H, (c) => {
      const tier = ties.findIndex((y, i) => c.y >= y && c.y < (ties[i + 1] ?? 999));
      const ya = ties[tier], yb = ties[tier + 1] ?? 2 + H;
      if (c.y < ya + 3 || c.i === 0 || c.i === c.n - 1) return null; // ties and corner columns
      const course = Math.floor((c.y - ya - 3) / 3) * 3 + 1.5;
      const f = course / Math.max(1, yb - ya - 3);
      const p1 = f * (c.n - 1), p2 = (1 - f) * (c.n - 1);
      if (Math.abs(c.i - p1) < 0.75 || Math.abs(c.i - p2) < 0.75) return null; // the X
      return c.y >= 2 + H - 6 && c.y < 2 + H - 3 ? 'dbg' : 'trans-black';
    });
    // twin antennas on the roof
    k.spire(8, 2 + H, 7, 'black', 4, '2569', 'white');
    k.spire(7, 2 + H, 11, 'black', 3, '2569', 'white');
    return k.compile();
  },
};

/* ------------------------------------------------------------------ */
/* Trump International Hotel & Tower                                   */
/* ------------------------------------------------------------------ */
export const trump: ChicagoSource = {
  id: 'trump-tower',
  name: 'Trump International Hotel & Tower',
  tagline: 'Silver-blue glass rising in three setbacks beside the river, topped by a slender spire.',
  difficulty: 4,
  age: '14+',
  maxPerStep: 10,
  heroView: 20,
  info: {
    year: '2009',
    architect: 'Skidmore, Owings & Merrill (Adrian Smith)',
    height: '423 m · 1,388 ft to the spire tip',
    heightM: 423,
    floors: 98,
    style: 'Modernism',
    location: 'North bank of the Chicago River',
    fact: 'Its three setbacks line up with the cornice of the Wrigley Building, the top of Marina City and the roof of 330 North Wabash, tying the tower to its neighbours.',
    scale: '1:1200',
  },
  build() {
    const k = new Kit();
    k.base(19, 16, { ground: 'lbg' });
    const river = k.grid({ tilesOnTop: true, phase: 0, ground: true });
    river.rect(0, 10, 19, 14, 1, 2, 'dark-azure');
    const t = k.grid({ tall: true, tilesOnTop: true });
    const z0 = 2, z1 = 8;
    const sections: [number, number, number, number][] = [
      // x0, x1, y0, y1 (setbacks at floors 16 east, 29 west, 51 east)
      [2, 17, 2, 26],
      [2, 15, 26, 46],
      [4, 15, 46, 80],
      [4, 12, 80, 152],
    ];
    for (const [x0, x1, y0, y1] of sections) {
      t.rect(x0, z0, x1, z1, y0, y1, 'sand-blue');
      // rounded corners
      for (const [x, z] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) t.rect(x, z, x + 1, z + 1, y0, y1, null);
    }
    t.facade(2, 152, (c) => (c.u % 2 === 0 ? 'trans-clear' : 'flat-silver'));
    // rooftop mechanical crown and the spire
    t.rect(6, 4, 10, 6, 152, 155, 'lbg');
    k.add('3941', 'flat-silver', 7, 155, 4, 0, 3);
    k.spire(7, 158, 4, 'flat-silver', 2, '63965');
    return k.compile();
  },
};

/* ------------------------------------------------------------------ */
/* St. Regis Chicago                                                   */
/* ------------------------------------------------------------------ */
export const stRegis: ChicagoSource = {
  id: 'st-regis',
  name: 'St. Regis Chicago',
  tagline: 'Three blue-glass towers built from stacked, alternating frustums, rising toward the west.',
  difficulty: 5,
  age: '16+',
  maxPerStep: 10,
  heroView: 20,
  info: {
    year: '2020',
    architect: 'Studio Gang (Jeanne Gang)',
    height: '363 m · 1,191 ft',
    heightM: 363,
    floors: 101,
    style: 'Contemporary',
    location: 'Lakeshore East, at the mouth of the Chicago River',
    fact: 'Each tower is a stack of 12-storey frustums set right-side-up and upside-down, and the tallest has open-air “blow-through” floors near its top to let the wind pass.',
    scale: '1:1200',
  },
  build() {
    const k = new Kit();
    k.base(20, 16, { ground: 'lbg' });
    const river = k.grid({ tilesOnTop: true, phase: 0, ground: true });
    river.rect(0, 11, 20, 14, 1, 2, 'dark-azure');
    const t = k.grid({ tilesOnTop: true });
    // towers east → west: 47, 71 and 101 storeys; frustums of 18 plates alternate wide/narrow
    const towers = [
      { x0: 3, x1: 8, top: 72, phase: 0 },
      { x0: 8, x1: 12, top: 108, phase: 1 },
      { x0: 12, x1: 17, top: 152, phase: 0 },
    ];
    const cz = 6;
    towers.forEach(({ x0, x1, top, phase }, ti) => {
      t.shape(x0 - 1, 0, x1 + 1, 12, 2, 2 + top, (x, z, y) => {
        const m = Math.floor((y - 2) / 18) + phase;
        const f = ((y - 2) % 18) / 18; // 0..1 within the frustum
        const v = m % 2 === 0 ? f : 1 - f; // widening or narrowing
        const hz = 2.6 + v * 1.4;
        const outer = ti === 0 ? x0 - v * 1.2 : ti === 2 ? x1 + v * 1.2 : null;
        const inX = ti === 0 ? x + 0.5 >= outer! && x < x1 : ti === 2 ? x >= x0 && x + 0.5 <= outer! : x >= x0 && x < x1;
        return inX && Math.abs(z + 0.5 - cz) <= hz;
      }, 'medium-blue');
    });
    // glass shades change with each frustum
    t.paint((_x, y) => Math.floor((y - 2) / 18) % 2 === 1, 'sand-blue');
    t.facade(2, 160, (c) => ((c.y - 2) % 18 === 17 ? 'white' : null));
    // blow-through floors near the top of the tallest tower
    t.rect(13, 5, 16, 7, 140, 144, null);
    t.rect(12, 4, 17, 8, 152, 155, 'lbg');
    return k.compile();
  },
};

/* ------------------------------------------------------------------ */
/* Aon Center                                                          */
/* ------------------------------------------------------------------ */
export const aon: ChicagoSource = {
  id: 'aon-center',
  name: 'Aon Center',
  tagline: 'A sheer white shaft of chevron-shaped stone piers rising straight up from Grant Park.',
  difficulty: 4,
  age: '14+',
  maxPerStep: 10,
  heroView: 35,
  info: {
    year: '1973',
    architect: 'Edward Durell Stone with Perkins & Will',
    height: '346 m · 1,136 ft',
    heightM: 346,
    floors: 83,
    style: 'Late modernism',
    location: 'Randolph Street, Lakeshore East',
    fact: 'It was first clad in thin Carrara marble; the panels began to bow, and in 1990–92 all 43,000 were replaced with Mount Airy granite.',
    scale: '1:1300',
  },
  build() {
    const k = new Kit();
    const ground = k.base(17, 19, { ground: 'lbg' })!;
    const t = k.grid({ tall: true, tilesOnTop: true });
    const H = 159;
    t.rect(3, 3, 14, 14, 2, 2 + H, 'dbg');
    // white chevron piers with recessed window strips; notched corners
    t.facade(2, 2 + H, (c) => (c.i === 0 || c.i === c.n - 1 ? 'carve' : c.i % 2 === 1 ? 'white' : 'carve'));
    t.rect(4, 4, 13, 13, 2 + H, 3 + H, 'white');
    // plaza trees
    for (const [x, z] of [[1, 2], [1, 8], [1, 14], [15, 2], [15, 8], [15, 14]]) {
      k.add('3062b', 'reddish-brown', x, 2, z, 0, 2);
      k.add('4032', 'bright-green', x - 0.5, 5, z - 0.5, 0, 2);
    }
    void ground;
    return k.compile();
  },
};

/* ------------------------------------------------------------------ */
/* Aqua                                                                */
/* ------------------------------------------------------------------ */
export const aqua: ChicagoSource = {
  id: 'aqua',
  name: 'Aqua',
  tagline: 'White balcony slabs that ripple across blue glass like the surface of the lake.',
  difficulty: 4,
  age: '14+',
  maxPerStep: 10,
  heroView: 30,
  info: {
    year: '2009',
    architect: 'Studio Gang (Jeanne Gang)',
    height: '262 m · 859 ft',
    heightM: 262,
    floors: 82,
    style: 'Contemporary',
    location: 'Lakeshore East',
    fact: 'Every floor slab has a different outline, so the balconies form “hills” and “pools” across the facade; the irregular edges also help break up the wind.',
    scale: '1:1000',
  },
  build() {
    const k = new Kit();
    k.base(20, 22, { ground: 'lbg' });
    // podium with a green roof
    const p = k.grid({ tilesOnTop: true });
    p.rect(2, 2, 18, 18, 2, 8, 'dbg');
    p.rect(2, 2, 18, 18, 8, 9, 'bright-green');
    const t = k.grid({});
    const X0 = 6, X1 = 14, Z0 = 5, Z1 = 15, Y0 = 9, Y1 = 155;
    t.rect(X0, Z0, X1, Z1, Y0, Y1, 'medium-azure');
    // perimeter position → smooth balcony depth (0..2 studs): "hills" and "pools"
    const per = (x: number, z: number) => {
      const W = X1 - X0, D = Z1 - Z0;
      if (z < Z0) return Math.min(Math.max(x - X0, 0), W);
      if (x >= X1) return W + Math.min(Math.max(z - Z0, 0), D);
      if (z >= Z1) return W + D + (W - Math.min(Math.max(x - X0, 0), W));
      return 2 * W + D + (D - Math.min(Math.max(z - Z0, 0), D));
    };
    const depth = (s: number, y: number) =>
      Math.round(1.1 + 1.25 * Math.sin(0.45 * s + 0.06 * y) + 0.7 * Math.sin(0.19 * s - 0.045 * y + 1.7));
    for (let y = Y0 + 3; y < Y1; y += 6) {
      for (let z = Z0 - 2; z < Z1 + 2; z++)
        for (let x = X0 - 2; x < X1 + 2; x++) {
          const out = Math.max(X0 - x, x - X1 + 1, Z0 - z, z - Z1 + 1, 0);
          if (out === 0) t.g.set(x, y, z, 'white');
          else if (out <= depth(per(x, z), y)) t.g.set(x, y, z, 'white');
        }
    }
    t.rect(X0, Z0, X1, Z1, Y1, Y1 + 2, 'white');
    return k.compile();
  },
};

/* ------------------------------------------------------------------ */
/* Two Prudential Plaza                                                */
/* ------------------------------------------------------------------ */
export const twoPru: ChicagoSource = {
  id: 'two-prudential',
  name: 'Two Prudential Plaza',
  tagline: 'Chevron setbacks climbing to a pyramid turned 45 degrees and a needle spire.',
  difficulty: 4,
  age: '14+',
  maxPerStep: 9,
  heroView: 35,
  info: {
    year: '1990',
    architect: 'Loebl Schlossman & Hackl (Stephen Wright)',
    height: '303 m · 995 ft',
    heightM: 303,
    floors: 64,
    style: 'Postmodernism',
    location: 'Randolph Street, the Loop',
    fact: 'Its silhouette comes from stacked chevron setbacks on the north and south faces and a pyramidal peak rotated 45 degrees, capped by an 80-foot spire.',
    scale: '1:1100',
  },
  build() {
    const k = new Kit();
    k.base(15, 16, { ground: 'lbg' });
    const t = k.grid({ tall: true, tilesOnTop: true, slopes: true });
    const X0 = 3, X1 = 12, Z0 = 2, Z1 = 11, H = 114;
    t.rect(X0, Z0, X1, Z1, 2, 2 + H, 'lbg');
    t.facade(2, 2 + H, (c) => (c.i % 2 === 1 && c.i < c.n - 1 ? 'sand-blue' : null));
    // chevron setbacks: each tier cuts a deeper V into the north and south faces
    let y = 2 + H;
    for (let tier = 0; tier < 4; tier++) {
      const depth = tier + 1;
      t.shape(X0, Z0, X1, Z1, y, y + 6, (x, z) => {
        const off = Math.abs(x + 0.5 - (X0 + X1) / 2);
        const v = Math.max(0, depth - off * 0.6);
        return z >= Z0 + v && z + 0.5 <= Z1 - v;
      }, tier % 2 ? 'lbg' : 'sand-blue');
      y += 6;
    }
    // pyramid rotated 45°
    const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
    for (let r = 4.6; r > 0.4; r -= 0.75, y += 3) t.shape(X0, Z0, X1, Z1, y, y + 3, (x, z) => Math.abs(x + 0.5 - cx) + Math.abs(z + 0.5 - cz) <= r, 'lbg');
    k.spire(7, y, 6, 'lbg', 2, '63965', 'flat-silver');
    return k.compile();
  },
};

/* ------------------------------------------------------------------ */
/* Lake Point Tower                                                    */
/* ------------------------------------------------------------------ */
export const lakePoint: ChicagoSource = {
  id: 'lake-point-tower',
  name: 'Lake Point Tower',
  tagline: 'A three-lobed tower of dark bronze glass standing alone on the lakefront.',
  difficulty: 4,
  age: '14+',
  maxPerStep: 10,
  heroView: 30,
  info: {
    year: '1968',
    architect: 'John Heinrich and George Schipporeit',
    height: '197 m · 645 ft',
    heightM: 197,
    floors: 70,
    style: 'International Style',
    location: 'Navy Pier, east of Lake Shore Drive',
    fact: 'Its curving Y-shaped plan was inspired by Mies van der Rohe’s 1922 glass skyscraper project, and it is the only skyscraper on the lake side of Lake Shore Drive.',
    scale: '1:900',
  },
  build() {
    const k = new Kit();
    k.base(22, 22, { ground: 'lbg' });
    // podium with its rooftop park
    const p = k.grid({ tilesOnTop: true });
    p.rect(2, 2, 20, 18, 2, 8, 'dbg');
    p.rect(2, 2, 20, 18, 8, 9, 'bright-green');
    const t = k.grid({ tall: true, tilesOnTop: true });
    const cx = 11, cz = 10;
    const wings = [90, 210, 330].map((d) => (d * Math.PI) / 180);
    const inside = (x: number, z: number) => {
      const px = x + 0.5 - cx, pz = z + 0.5 - cz;
      if (Math.hypot(px, pz) <= 3) return true;
      return wings.some((a) => {
        const dx = Math.cos(a), dz = -Math.sin(a);
        const along = Math.max(0, Math.min(6, px * dx + pz * dz));
        return Math.hypot(px - dx * along, pz - dz * along) <= 2.4;
      });
    };
    t.shape(2, 1, 20, 19, 9, 147, (x, z) => inside(x, z), 'black');
    t.facade(9, 147, (c) => (Math.round(Math.atan2(c.z + 0.5 - cz, c.x + 0.5 - cx) * 8) % 2 === 0 ? 'trans-black' : null));
    t.shape(2, 1, 20, 19, 141, 147, (x, z) => inside(x, z), 'black');
    for (const [x, z] of [[4, 4], [17, 4], [4, 15], [17, 15]]) k.add('4032', 'green', x, 9, z, 0, 2);
    return k.compile();
  },
};

/* ------------------------------------------------------------------ */
/* 333 Wacker Drive                                                    */
/* ------------------------------------------------------------------ */
export const wacker333: ChicagoSource = {
  id: '333-wacker',
  name: '333 Wacker Drive',
  tagline: 'A curved wall of green glass that follows the bend of the Chicago River and mirrors it.',
  difficulty: 3,
  age: '12+',
  maxPerStep: 9,
  heroView: -25,
  info: {
    year: '1983',
    architect: 'Kohn Pedersen Fox (William Pedersen)',
    height: '149 m · 487 ft',
    heightM: 149,
    floors: 36,
    style: 'Late modernism',
    location: 'Wacker Drive at the river’s bend',
    fact: 'The river side is a single sweeping curve of green-tinted glass, while the city side is angular and gridded to match the Loop’s streets.',
    scale: '1:700',
  },
  build() {
    const k = new Kit();
    const R = 20;
    k.base(22, 22, { ground: 'lbg' });
    const river = k.grid({ tilesOnTop: true, phase: 0, ground: true });
    river.shape(0, 0, 22, 20, 1, 2, (x, z) => Math.hypot(x + 0.5 + 4, z + 0.5 + 4) > R + 2.5, 'dark-azure');
    const t = k.grid({ tilesOnTop: true });
    const plan = (x: number, z: number) =>
      x >= 0 && z >= 0 && x + z >= 11 && Math.hypot(x + 0.5 + 4, z + 0.5 + 4) <= R;
    // granite base, then the glass tower: a stainless band every three floors on the curve,
    // a gridded stone-and-glass wall on the city sides
    t.shape(0, 0, 22, 22, 2, 8, (x, z) => plan(x, z), 'dbg');
    t.shape(0, 0, 22, 22, 8, 71, (x, z) => plan(x, z), 'sand-green');
    t.facade(8, 71, (c) => {
      const onArc = Math.hypot(c.x + 0.5 + 4, c.z + 0.5 + 4) > R - 1.6;
      if (!onArc) return c.u % 3 === 0 ? 'lbg' : 'dbg';
      return (c.y - 8) % 9 === 0 ? 'lbg' : null;
    });
    t.shape(0, 0, 22, 22, 71, 73, (x, z) => plan(x, z) && Math.hypot(x + 0.5 + 4, z + 0.5 + 4) <= R - 1 && x + z >= 12, 'lbg');
    return k.compile();
  },
};

/* ------------------------------------------------------------------ */
/* Carbide & Carbon Building                                           */
/* ------------------------------------------------------------------ */
export const carbide: ChicagoSource = {
  id: 'carbide-carbon',
  name: 'Carbide & Carbon Building',
  tagline: 'Dark green terra cotta with gold leaf at the crown, rising from a polished black granite base.',
  difficulty: 3,
  age: '12+',
  maxPerStep: 8,
  heroView: 35,
  info: {
    year: '1929',
    architect: 'Burnham Brothers',
    height: '154 m · 503 ft',
    heightM: 154,
    floors: 37,
    style: 'Art Deco',
    location: 'Michigan Avenue, the Loop',
    fact: 'Its tower is clad in dark green terra cotta and its top is trimmed with 24-karat gold leaf; a popular story says it was meant to look like a dark green champagne bottle.',
    scale: '1:450',
  },
  build() {
    const k = new Kit();
    k.base(13, 17, { ground: 'lbg' });
    const t = k.grid({ tall: true, tilesOnTop: true });
    // black granite base with a gold band
    t.rect(3, 2, 10, 13, 2, 12, 'black');
    t.rect(3, 2, 10, 13, 12, 13, 'pearl-gold');
    // green shaft with vertical piers
    t.rect(3, 2, 10, 13, 13, 88, 'dark-green');
    t.facade(13, 88, (c) => (c.i % 2 === 1 && c.i < c.n - 1 ? 'carve' : null));
    // setbacks with gold trim
    t.rect(4, 3, 9, 12, 88, 103, 'dark-green');
    t.facade(88, 103, (c) => (c.i % 2 === 1 && c.i < c.n - 1 ? 'carve' : null));
    t.rect(4, 3, 9, 12, 103, 104, 'pearl-gold');
    t.rect(5, 5, 8, 10, 104, 116, 'dark-green');
    t.facade(104, 116, (c) => (c.i === 1 ? 'pearl-gold' : null));
    t.rect(5, 5, 8, 10, 116, 117, 'pearl-gold');
    // gold spire
    k.add('3941', 'pearl-gold', 5.5, 117, 6.5, 0, 3);
    k.add('3942', 'pearl-gold', 5.5, 120, 6.5, 0, 3);
    k.add('3957', 'pearl-gold', 6, 126, 7, 0, 3);
    for (const [x, z] of [[4, 3], [8, 3], [4, 11], [8, 11]]) k.add('4589', 'pearl-gold', x, 104, z, 0, 3);
    return k.compile();
  },
};
