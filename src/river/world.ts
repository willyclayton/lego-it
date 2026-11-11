/**
 * The Chicago River world: a north-up grid of 4 m cells (one stud = 4 m, one plate = 1.6 m)
 * built from OpenStreetMap by scripts/river/build_data.py.
 *   ground.png  land-use class per cell      city.png  building height (plates) and building index per cell
 *   world.json  tour route, bridges, points of interest and the building table
 */
export const PLATE = 0.4; // world units (studs) per plate
export const LAND_Y = 1.2; // street level: one brick above the water

export const VOID = 0, LAKE = 1, RIVER = 2, LAND = 3, ROAD = 4, PARK = 5, PLAZA = 6, RAIL = 7, SAND = 8, STONE = 9, FAR = 10;
const GROUND_R = [20, 54, 58, 160, 108, 75, 228, 149, 240, 120]; // red channel of each class in ground.png

export interface BridgeData {
  name: string;
  line: string;
  c: [number, number];
  ax: [number, number];
  t: [number, number];
  span: [number, number];
  w: number;
  kind: 'pony' | 'deck' | 'double' | 'raised' | 'through' | 'lift' | 'swing' | 'arch' | 'beam';
  color?: string;
  year?: number;
  type?: string;
  fact?: string;
  top?: string;
  twin?: string;
  rail?: boolean;
  foot?: boolean;
  status?: string | null;
}
export interface BuildingMeta {
  n?: string; // OSM name
  nm?: string; // common name
  ad?: string;
  lv?: number;
  y?: number;
  a?: string;
  t?: string;
  f?: string;
  cat?: string;
}
export interface Poi {
  name: string;
  x: number;
  y: number;
  f: string;
}
interface WorldJson {
  cell: number;
  plate: number;
  w: number;
  h: number;
  route: [number, number][];
  legs: { key: string; title: string; start: number }[];
  bridges: BridgeData[];
  pois: Poi[];
  palette: string[];
  geo: { latN: number; lonW: number; kx: number; ky: number };
  b: { h: number[]; src: number[]; c: number[]; s: number[]; m: Record<string, BuildingMeta> };
}

export interface World extends WorldJson {
  ground: Uint8Array; // class per cell
  height: Uint16Array; // building height in plates per cell (0 = none)
  bid: Uint16Array; // building index per cell (1-based, 0 = none)
  /** bounding box of each building in cells: x0, y0, x1, y1 (exclusive), index = (id - 1) * 4 */
  bbox: Int32Array;
  cum: Float32Array; // cumulative route length in cells
  length: number; // route length in cells
}

async function pixels(url: string): Promise<ImageData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}`);
  const blob = await res.blob();
  // the pixels are data, not colour: keep the browser from colour-managing them
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }).catch(() => createImageBitmap(blob));
  const cv = document.createElement('canvas');
  cv.width = bmp.width;
  cv.height = bmp.height;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  return ctx.getImageData(0, 0, bmp.width, bmp.height);
}

let cached: Promise<World> | null = null;
export function loadWorld(): Promise<World> {
  cached ??= (async () => {
    const [json, g, c] = await Promise.all([
      fetch('river/world.json').then((r) => {
        if (!r.ok) throw new Error('Could not load the river map');
        return r.json() as Promise<WorldJson>;
      }),
      pixels('river/ground.png'),
      pixels('river/city.png'),
    ]);
    const { w, h } = json;
    const n = w * h;
    const ground = new Uint8Array(n);
    const height = new Uint16Array(n);
    const bid = new Uint16Array(n);
    const lut = new Uint8Array(256);
    GROUND_R.forEach((r, i) => (lut[r] = i));
    for (let i = 0; i < n; i++) {
      let cls = lut[g.data[i * 4]];
      // outside the downloaded area: lake to the east of the shoreline, city everywhere else
      if (cls === VOID) cls = i % w > 1160 ? LAKE : FAR;
      ground[i] = cls;
      const r = c.data[i * 4], gg = c.data[i * 4 + 1], b = c.data[i * 4 + 2];
      height[i] = r | ((b & 1) << 8);
      bid[i] = gg | ((b >> 1) << 8);
    }
    const count = json.b.h.length;
    const bbox = new Int32Array(count * 4);
    for (let i = 0; i < count; i++) {
      bbox[i * 4] = w;
      bbox[i * 4 + 1] = h;
    }
    for (let y = 0, i = 0; y < h; y++)
      for (let x = 0; x < w; x++, i++) {
        const id = bid[i];
        if (!id) continue;
        const k = (id - 1) * 4;
        if (x < bbox[k]) bbox[k] = x;
        if (y < bbox[k + 1]) bbox[k + 1] = y;
        if (x + 1 > bbox[k + 2]) bbox[k + 2] = x + 1;
        if (y + 1 > bbox[k + 3]) bbox[k + 3] = y + 1;
      }
    const cum = new Float32Array(json.route.length);
    for (let i = 1; i < json.route.length; i++)
      cum[i] = cum[i - 1] + Math.hypot(json.route[i][0] - json.route[i - 1][0], json.route[i][1] - json.route[i - 1][1]);
    return { ...json, ground, height, bid, bbox, cum, length: cum[cum.length - 1] };
  })();
  cached.catch(() => (cached = null));
  return cached;
}

/** Position on the route at distance s (cells) from the start. */
export function routeAt(world: World, s: number): [number, number] {
  const { cum, route } = world;
  const t = Math.max(0, Math.min(s, world.length));
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= t) lo = mid;
    else hi = mid;
  }
  const f = (t - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
  return [route[lo][0] + (route[hi][0] - route[lo][0]) * f, route[lo][1] + (route[hi][1] - route[lo][1]) * f];
}

/** Distance along the route of the point closest to (x, y); `from` skips the earlier part (the route passes Wolf Point three times). */
export function routeNearest(world: World, x: number, y: number, from = 0): { s: number; d: number } {
  const { route, cum } = world;
  let best = { s: 0, d: Infinity };
  for (let i = 0; i < route.length - 1; i++) {
    if (cum[i + 1] < from) continue;
    const [ax, ay] = route[i], [bx, by] = route[i + 1];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    const d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
    if (d < best.d - 1e-6) best = { s: cum[i] + Math.sqrt(len2) * t, d };
  }
  return best;
}

export const legAt = (world: World, s: number) => {
  let k = 0;
  for (let i = 0; i < world.legs.length; i++) if (world.cum[world.legs[i].start] <= s + 1e-3) k = i;
  return world.legs[k];
};

export interface BuildingInfoLite {
  id: number;
  name: string;
  named: boolean;
  heightM: number;
  heightSrc: number; // 0 measured (OSM height tag or checked), 1 from floor count, 2 default guess
  color: string;
  style: number;
  meta: BuildingMeta;
  cx: number;
  cy: number;
}
export function buildingInfo(world: World, id: number): BuildingInfoLite {
  const meta = world.b.m[String(id)] ?? {};
  const k = (id - 1) * 4;
  const kind = meta.t && !['yes', 'commercial', 'retail', 'residential', 'apartments', 'office'].includes(meta.t) ? meta.t.replace(/_/g, ' ') : '';
  return {
    id,
    name: meta.nm ?? meta.n ?? meta.ad ?? (kind ? kind[0].toUpperCase() + kind.slice(1) : 'Building'),
    named: !!(meta.nm ?? meta.n),
    heightM: world.b.h[id - 1],
    heightSrc: world.b.src[id - 1],
    color: world.palette[world.b.c[id - 1]],
    style: world.b.s[id - 1],
    meta,
    cx: (world.bbox[k] + world.bbox[k + 2]) / 2,
    cy: (world.bbox[k + 1] + world.bbox[k + 3]) / 2,
  };
}
