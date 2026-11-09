/**
 * Parts catalog. Dimensions:
 *   w = width in studs along x (at rot 0)
 *   l = length/depth in studs along z (at rot 0)
 *   h = height in plates (brick = 3)
 * Real-world: 1 stud pitch = 8 mm = 20 LDU, 1 plate = 3.2 mm = 8 LDU.
 */

export type PartKind =
  | 'brick'
  | 'plate'
  | 'tile'
  | 'slope'
  | 'slopeInv'
  | 'ridge'
  | 'curve'
  | 'round'
  | 'roundTile'
  | 'cone'
  | 'dish'
  | 'jumper'
  | 'grille'
  | 'wheelHolder'
  | 'wheel'
  | 'tire'
  | 'masonry'
  | 'grilleBrick'
  | 'antenna'
  | 'bar';

export interface PartDef {
  id: string; // LDraw / LEGO design id
  name: string; // BrickLink-style name
  kind: PartKind;
  w: number;
  l: number;
  h: number;
  /** For slopes: number of stud rows on the flat top at the back. */
  studRows?: number;
  /** For round parts: radius in studs. */
  radius?: number;
  /** Sort category for parts lists. */
  category: string;
}

const P = (
  id: string,
  name: string,
  kind: PartKind,
  w: number,
  l: number,
  h: number,
  category: string,
  extra: Partial<PartDef> = {},
): PartDef => ({ id, name, kind, w, l, h, category, ...extra });

const list: PartDef[] = [
  // Bricks
  P('3005', 'Brick 1 x 1', 'brick', 1, 1, 3, 'Brick'),
  P('3004', 'Brick 1 x 2', 'brick', 1, 2, 3, 'Brick'),
  P('3622', 'Brick 1 x 3', 'brick', 1, 3, 3, 'Brick'),
  P('3010', 'Brick 1 x 4', 'brick', 1, 4, 3, 'Brick'),
  P('3009', 'Brick 1 x 6', 'brick', 1, 6, 3, 'Brick'),
  P('3008', 'Brick 1 x 8', 'brick', 1, 8, 3, 'Brick'),
  P('3003', 'Brick 2 x 2', 'brick', 2, 2, 3, 'Brick'),
  P('3002', 'Brick 2 x 3', 'brick', 2, 3, 3, 'Brick'),
  P('3001', 'Brick 2 x 4', 'brick', 2, 4, 3, 'Brick'),
  P('2456', 'Brick 2 x 6', 'brick', 2, 6, 3, 'Brick'),
  P('3007', 'Brick 2 x 8', 'brick', 2, 8, 3, 'Brick'),
  P('3006', 'Brick 2 x 10', 'brick', 2, 10, 3, 'Brick'),
  // Tall bricks (columns, pilasters, curtain-wall mullions)
  P('14716', 'Brick 1 x 1 x 3', 'brick', 1, 1, 9, 'Brick'),
  P('22886', 'Brick 1 x 2 x 3', 'brick', 1, 2, 9, 'Brick'),
  P('49311', 'Brick 1 x 4 x 3', 'brick', 1, 4, 9, 'Brick'),
  P('2453b', 'Brick 1 x 1 x 5', 'brick', 1, 1, 15, 'Brick'),
  P('2454', 'Brick 1 x 2 x 5', 'brick', 1, 2, 15, 'Brick'),
  P('3754', 'Brick 1 x 6 x 5', 'brick', 1, 6, 15, 'Brick'),
  // Textured bricks
  P('98283', 'Brick 1 x 2 with Masonry Profile', 'masonry', 1, 2, 3, 'Brick'),
  P('15533', 'Brick 1 x 4 with Masonry Profile', 'masonry', 1, 4, 3, 'Brick'),
  P('2877', 'Brick 1 x 2 with Grille', 'grilleBrick', 1, 2, 3, 'Brick'),
  // Plates
  P('3024', 'Plate 1 x 1', 'plate', 1, 1, 1, 'Plate'),
  P('3023', 'Plate 1 x 2', 'plate', 1, 2, 1, 'Plate'),
  P('3623', 'Plate 1 x 3', 'plate', 1, 3, 1, 'Plate'),
  P('3710', 'Plate 1 x 4', 'plate', 1, 4, 1, 'Plate'),
  P('3666', 'Plate 1 x 6', 'plate', 1, 6, 1, 'Plate'),
  P('3460', 'Plate 1 x 8', 'plate', 1, 8, 1, 'Plate'),
  P('3022', 'Plate 2 x 2', 'plate', 2, 2, 1, 'Plate'),
  P('3021', 'Plate 2 x 3', 'plate', 2, 3, 1, 'Plate'),
  P('3020', 'Plate 2 x 4', 'plate', 2, 4, 1, 'Plate'),
  P('3795', 'Plate 2 x 6', 'plate', 2, 6, 1, 'Plate'),
  P('3034', 'Plate 2 x 8', 'plate', 2, 8, 1, 'Plate'),
  P('3832', 'Plate 2 x 10', 'plate', 2, 10, 1, 'Plate'),
  P('3031', 'Plate 4 x 4', 'plate', 4, 4, 1, 'Plate'),
  P('3032', 'Plate 4 x 6', 'plate', 4, 6, 1, 'Plate'),
  P('3035', 'Plate 4 x 8', 'plate', 4, 8, 1, 'Plate'),
  P('3030', 'Plate 4 x 10', 'plate', 4, 10, 1, 'Plate'),
  P('3958', 'Plate 6 x 6', 'plate', 6, 6, 1, 'Plate'),
  P('3036', 'Plate 6 x 8', 'plate', 6, 8, 1, 'Plate'),
  P('3033', 'Plate 6 x 10', 'plate', 6, 10, 1, 'Plate'),
  P('41539', 'Plate 8 x 8', 'plate', 8, 8, 1, 'Plate'),
  P('92438', 'Plate 8 x 16', 'plate', 8, 16, 1, 'Plate'),
  P('91405', 'Plate 16 x 16', 'plate', 16, 16, 1, 'Plate'),
  // Tiles
  P('3070b', 'Tile 1 x 1', 'tile', 1, 1, 1, 'Tile'),
  P('3069b', 'Tile 1 x 2', 'tile', 1, 2, 1, 'Tile'),
  P('63864', 'Tile 1 x 3', 'tile', 1, 3, 1, 'Tile'),
  P('2431', 'Tile 1 x 4', 'tile', 1, 4, 1, 'Tile'),
  P('6636', 'Tile 1 x 6', 'tile', 1, 6, 1, 'Tile'),
  P('3068b', 'Tile 2 x 2', 'tile', 2, 2, 1, 'Tile'),
  P('87079', 'Tile 2 x 4', 'tile', 2, 4, 1, 'Tile'),
  P('2412b', 'Tile 1 x 2 Grille', 'grille', 1, 2, 1, 'Tile'),
  P('3794', 'Plate 1 x 2 with 1 Stud (Jumper)', 'jumper', 1, 2, 1, 'Plate'),
  // Slopes (descend toward +z at rot 0)
  P('3040', 'Slope 45 2 x 1', 'slope', 1, 2, 3, 'Slope', { studRows: 1 }),
  P('3039', 'Slope 45 2 x 2', 'slope', 2, 2, 3, 'Slope', { studRows: 1 }),
  P('3038', 'Slope 45 2 x 3', 'slope', 3, 2, 3, 'Slope', { studRows: 1 }),
  P('3037', 'Slope 45 2 x 4', 'slope', 4, 2, 3, 'Slope', { studRows: 1 }),
  P('4286', 'Slope 33 3 x 1', 'slope', 1, 3, 3, 'Slope', { studRows: 1 }),
  P('3298', 'Slope 33 3 x 2', 'slope', 2, 3, 3, 'Slope', { studRows: 1 }),
  P('3297', 'Slope 33 3 x 4', 'slope', 4, 3, 3, 'Slope', { studRows: 1 }),
  P('3665', 'Slope Inverted 45 2 x 1', 'slopeInv', 1, 2, 3, 'Slope'),
  P('3660', 'Slope Inverted 45 2 x 2', 'slopeInv', 2, 2, 3, 'Slope'),
  P('3044', 'Slope 45 2 x 1 Double', 'ridge', 1, 2, 3, 'Slope'),
  P('3043', 'Slope 45 2 x 2 Double', 'ridge', 2, 2, 3, 'Slope'),
  P('3041', 'Slope 45 2 x 4 Double', 'ridge', 4, 2, 3, 'Slope'),
  P('11477', 'Slope Curved 2 x 1', 'curve', 1, 2, 2, 'Slope'),
  P('15068', 'Slope Curved 2 x 2', 'curve', 2, 2, 2, 'Slope'),
  // Round
  P('3062b', 'Brick Round 1 x 1', 'round', 1, 1, 3, 'Round', { radius: 0.48 }),
  P('4073', 'Plate Round 1 x 1', 'round', 1, 1, 1, 'Round', { radius: 0.48 }),
  P('98138', 'Tile Round 1 x 1', 'roundTile', 1, 1, 1, 'Round', { radius: 0.48 }),
  P('3941', 'Brick Round 2 x 2', 'round', 2, 2, 3, 'Round', { radius: 0.98 }),
  P('4032', 'Plate Round 2 x 2', 'round', 2, 2, 1, 'Round', { radius: 0.98 }),
  P('14769', 'Tile Round 2 x 2', 'roundTile', 2, 2, 1, 'Round', { radius: 0.98 }),
  P('4589', 'Cone 1 x 1', 'cone', 1, 1, 3, 'Round', { radius: 0.48 }),
  P('3942', 'Cone 2 x 2 x 2', 'cone', 2, 2, 6, 'Round', { radius: 0.98 }),
  P('4740', 'Dish 2 x 2 Inverted', 'dish', 2, 2, 1, 'Round', { radius: 0.98 }),
  P('3960', 'Dish 4 x 4 Inverted', 'dish', 4, 4, 1, 'Round', { radius: 1.98 }),
  P('87081', 'Brick Round 4 x 4', 'round', 4, 4, 3, 'Round', { radius: 1.98 }),
  P('60474', 'Plate Round 4 x 4 with Hole', 'round', 4, 4, 1, 'Round', { radius: 1.98 }),
  P('11213', 'Plate Round 6 x 6 with Hole', 'round', 6, 6, 1, 'Round', { radius: 2.98 }),
  // Antennas and bars (stand in a hollow stud)
  P('3957', 'Antenna 4H', 'antenna', 1, 1, 12, 'Bar', { radius: 0.08 }),
  P('2569', 'Antenna Whip 8H', 'antenna', 1, 1, 24, 'Bar', { radius: 0.07 }),
  P('63965', 'Bar 6L with Stop Ring', 'bar', 1, 1, 15, 'Bar', { radius: 0.16 }),
  // Wheels
  P('4600', 'Plate 2 x 2 with Wheel Holders', 'wheelHolder', 2, 2, 1, 'Wheel'),
  P('4624', 'Wheel 8mm D. x 6mm with Slot', 'wheel', 1, 2, 4, 'Wheel', { radius: 0.5 }),
  P('3641', 'Tire 14mm D. x 4mm Smooth Small Single', 'tire', 1, 2, 4, 'Wheel', { radius: 0.875 }),
];

export const PARTS: Record<string, PartDef> = Object.fromEntries(list.map((p) => [p.id, p]));

export function part(id: string): PartDef {
  const p = PARTS[id];
  if (!p) throw new Error(`Unknown part "${id}"`);
  return p;
}

/** Footprint after rotation: [sizeX, sizeZ]. */
export function footprint(p: PartDef, rot: number): [number, number] {
  return rot % 2 === 0 ? [p.w, p.l] : [p.l, p.w];
}

/** Lookup tables for the voxel → brick converter: rectangular parts by footprint. */
export const BRICKS_BY_SIZE: Record<string, string> = {};
export const PLATES_BY_SIZE: Record<string, string> = {};
export const TILES_BY_SIZE: Record<string, string> = {};
/** Tall bricks by footprint and height in plates, e.g. "1x2x15". */
export const TALL_BY_SIZE: Record<string, string> = {};
for (const p of list) {
  const key = `${Math.min(p.w, p.l)}x${Math.max(p.w, p.l)}`;
  if (p.kind === 'brick' && p.h === 3) BRICKS_BY_SIZE[key] = p.id;
  if (p.kind === 'brick' && p.h > 3) TALL_BY_SIZE[`${key}x${p.h}`] = p.id;
  if (p.kind === 'plate') PLATES_BY_SIZE[key] = p.id;
  if (p.kind === 'tile') TILES_BY_SIZE[key] = p.id;
}
