/**
 * LEGO-style color palette. Hex values follow the LDraw LDConfig.ldr palette,
 * names follow BrickLink (with the official LEGO name alongside).
 */
export interface LegoColor {
  key: string;
  name: string; // BrickLink name
  legoName: string; // official LEGO name
  ldraw: number; // LDraw colour code
  bricklink: number; // BrickLink color id
  hex: string;
  edge: string; // outline color used for the instruction-style render
  trans?: boolean;
  metal?: boolean;
}

const C = (
  key: string,
  name: string,
  legoName: string,
  ldraw: number,
  bricklink: number,
  hex: string,
  edge: string,
  extra: Partial<LegoColor> = {},
): LegoColor => ({ key, name, legoName, ldraw, bricklink, hex, edge, ...extra });

export const COLORS: Record<string, LegoColor> = Object.fromEntries(
  [
    C('white', 'White', 'White', 15, 1, '#FFFFFF', '#333333'),
    C('black', 'Black', 'Black', 0, 11, '#1B2A34', '#808080'),
    C('red', 'Red', 'Bright Red', 4, 5, '#C91A09', '#333333'),
    C('blue', 'Blue', 'Bright Blue', 1, 7, '#0055BF', '#333333'),
    C('yellow', 'Yellow', 'Bright Yellow', 14, 3, '#F2CD37', '#333333'),
    C('green', 'Green', 'Dark Green', 2, 6, '#237841', '#333333'),
    C('bright-green', 'Bright Green', 'Bright Green', 10, 36, '#4B9F4A', '#333333'),
    C('lbg', 'Light Bluish Gray', 'Medium Stone Grey', 71, 86, '#A0A5A9', '#333333'),
    C('dbg', 'Dark Bluish Gray', 'Dark Stone Grey', 72, 85, '#6C6E68', '#333333'),
    C('tan', 'Tan', 'Brick Yellow', 19, 2, '#E4CD9E', '#333333'),
    C('dark-tan', 'Dark Tan', 'Sand Yellow', 28, 69, '#958A73', '#333333'),
    C('reddish-brown', 'Reddish Brown', 'Reddish Brown', 70, 88, '#582A12', '#808080'),
    C('dark-brown', 'Dark Brown', 'Dark Brown', 308, 120, '#352100', '#808080'),
    C('orange', 'Orange', 'Bright Orange', 25, 4, '#FE8A18', '#333333'),
    C('blo', 'Bright Light Orange', 'Flame Yellowish Orange', 191, 110, '#F8BB3D', '#333333'),
    C('lime', 'Lime', 'Bright Yellowish Green', 27, 34, '#BBE90B', '#333333'),
    C('dark-red', 'Dark Red', 'Dark Red', 320, 59, '#720E0F', '#808080'),
    C('dark-blue', 'Dark Blue', 'Earth Blue', 272, 63, '#0A3463', '#808080'),
    C('medium-blue', 'Medium Blue', 'Medium Blue', 73, 42, '#5A93DB', '#333333'),
    C('dark-azure', 'Dark Azure', 'Dark Azur', 321, 153, '#078BC9', '#333333'),
    C('medium-azure', 'Medium Azure', 'Medium Azur', 322, 156, '#36AEBF', '#333333'),
    C('sand-green', 'Sand Green', 'Sand Green', 378, 48, '#A0BCAC', '#333333'),
    C('dark-green', 'Dark Green', 'Earth Green', 288, 80, '#184632', '#808080'),
    C('olive', 'Olive Green', 'Olive Green', 330, 155, '#9B9A5A', '#333333'),
    C('pink', 'Bright Pink', 'Light Purple', 29, 104, '#E4ADC8', '#333333'),
    C('lavender', 'Medium Lavender', 'Medium Lavender', 324, 157, '#AC78BA', '#333333'),
    C('pearl-gold', 'Pearl Gold', 'Warm Gold', 297, 115, '#AA7F2E', '#333333', { metal: true }),
    C('flat-silver', 'Flat Silver', 'Silver Metallic', 179, 95, '#898788', '#333333', { metal: true }),
    C('trans-clear', 'Trans-Clear', 'Transparent', 47, 12, '#FCFCFC', '#9AA4AA', { trans: true }),
    C('trans-light-blue', 'Trans-Light Blue', 'Transparent Light Blue', 43, 15, '#AEEFEC', '#7FA9B0', { trans: true }),
    C('trans-red', 'Trans-Red', 'Transparent Red', 36, 17, '#C91A09', '#5A1A10', { trans: true }),
    C('trans-yellow', 'Trans-Yellow', 'Transparent Yellow', 46, 19, '#F5CD2F', '#8A7A30', { trans: true }),
    C('trans-orange', 'Trans-Orange', 'Transparent Bright Orange', 182, 98, '#F08F1C', '#8A5A20', { trans: true }),
    C('trans-dark-blue', 'Trans-Dark Blue', 'Transparent Blue', 33, 14, '#0020A0', '#30406A', { trans: true }),
  ].map((c) => [c.key, c]),
);

export function color(key: string): LegoColor {
  const c = COLORS[key];
  if (!c) throw new Error(`Unknown color "${key}"`);
  return c;
}

/** Ordering used by parts lists (roughly how LEGO sorts its inventory pages). */
export const COLOR_ORDER = Object.keys(COLORS);

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Squared distance in a simple perceptual-ish RGB space; used to snap arbitrary colors to the palette. */
export function nearestColor(hex: string, allowTrans = false): string {
  const [r, g, b] = hexToRgb(hex);
  let best = 'lbg';
  let bestD = Infinity;
  for (const c of Object.values(COLORS)) {
    if (c.trans && !allowTrans) continue;
    if (c.metal) continue;
    const [r2, g2, b2] = hexToRgb(c.hex);
    const rm = (r + r2) / 2;
    const d = (2 + rm / 256) * (r - r2) ** 2 + 4 * (g - g2) ** 2 + (2 + (255 - rm) / 256) * (b - b2) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c.key;
    }
  }
  return best;
}
