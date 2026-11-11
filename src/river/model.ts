import { compileGrid } from '../lego/shapes';
import { assemble } from '../lego/steps';
import type { Model } from '../lego/types';
import { VoxelGrid } from '../lego/voxel';
import { buildingInfo, type World } from './world';

export interface RiverModel {
  model: Model;
  /** metres per stud */
  mPerStud: number;
}

const cache = new Map<number, RiverModel>();

/**
 * A buildable model of one building from the tour, made from the same footprint
 * and heights the tour shows. Big towers are scaled down and small buildings
 * scaled up so every model lands at a sensible number of parts.
 */
export function riverModel(world: World, id: number): RiverModel {
  const hit = cache.get(id);
  if (hit) return hit;
  const info = buildingInfo(world, id);
  const k = (id - 1) * 4;
  const x0 = world.bbox[k], y0 = world.bbox[k + 1], x1 = world.bbox[k + 2], y1 = world.bbox[k + 3];
  const bw = x1 - x0, bd = y1 - y0;
  const hAt = (x: number, y: number) => (x >= x0 && y >= y0 && x < x1 && y < y1 && world.bid[y * world.w + x] === id ? world.height[y * world.w + x] : 0);
  let cells = 0, vol = 0, hmax = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const hh = hAt(x, y);
      if (hh) {
        cells++;
        vol += hh;
        hmax = Math.max(hmax, hh);
      }
    }
  // studs per cell: 3, 2, 1 (the tour's own scale), 1/2, 1/3, 1/4
  const scales = [3, 2, 1, 1 / 2, 1 / 3, 1 / 4, 1 / 6];
  const k3 = scales.find((s) => vol * s * s * s <= 24000 && Math.max(bw, bd) * s <= 46 && hmax * s <= 210) ?? 1 / 6;
  const sw = Math.max(1, Math.round(bw * k3)), sd = Math.max(1, Math.round(bd * k3));
  // resample the footprint: a model cell is filled when at least half of what it covers is
  const col: number[] = new Array(sw * sd).fill(0);
  for (let z = 0; z < sd; z++)
    for (let x = 0; x < sw; x++) {
      if (k3 >= 1) {
        col[z * sw + x] = Math.round(hAt(x0 + Math.floor(x / k3), y0 + Math.floor(z / k3)) * k3);
        continue;
      }
      const n = Math.round(1 / k3);
      let filled = 0, top = 0;
      for (let dz = 0; dz < n; dz++)
        for (let dx = 0; dx < n; dx++) {
          const hh = hAt(x0 + x * n + dx, y0 + z * n + dz);
          if (hh) {
            filled++;
            top = Math.max(top, hh);
          }
        }
      col[z * sw + x] = filled * 2 >= n * n ? Math.max(1, Math.round(top * k3)) : 0;
    }
  const H = (x: number, z: number) => (x < 0 || z < 0 || x >= sw || z >= sd ? 0 : col[z * sw + x]);
  const g = new VoxelGrid();
  const glass = info.style === 1 ? 'trans-light-blue' : 'trans-black';
  const M = 1; // margin of the display base
  for (let z = 0; z < sd; z++)
    for (let x = 0; x < sw; x++) {
      const hh = H(x, z);
      if (!hh) continue;
      const low = Math.min(H(x - 1, z), H(x + 1, z), H(x, z - 1), H(x, z + 1));
      for (let y = 0; y < hh; y++) {
        let c = info.color;
        const course = Math.floor(y / 3);
        const outer = y >= low;
        // window courses: every other brick course on the outside, below the roof
        if (outer && info.style !== 3 && course % 2 === 1 && course < Math.floor((hh - 1) / 3)) {
          if (info.style !== 0 || (x + z) % 2 === 0) c = glass;
        }
        g.set(x + M, y + 1, z + M, c);
      }
    }
  const base = new VoxelGrid();
  base.box(0, 0, 0, sw + 2 * M, 1, sd + 2 * M, 'black');
  const placements = [
    ...compileGrid(base, { offset: [0, 0, 0], keepFragments: true, phase: 0 }),
    ...compileGrid(g, { offset: [0, 0, 0], keepFragments: true, tall: true, phase: 1 }),
  ];
  const mPerStud = world.cell / k3;
  const model = assemble(
    {
      id: `river-${id}`,
      name: info.name,
      tagline: `As seen from the Chicago River tour, at 1:${Math.round(mPerStud / 0.008)} (one stud = ${mPerStud % 1 ? mPerStud.toFixed(1) : mPerStud} m).`,
      difficulty: (placements.length > 900 ? 4 : placements.length > 350 ? 3 : placements.length > 90 ? 2 : 1) as 1 | 2 | 3 | 4,
      age: placements.length > 900 ? '12+' : placements.length > 350 ? '10+' : '8+',
      heroView: 35,
      maxPerStep: 8,
    },
    placements,
  );
  const out = { model, mPerStud };
  cache.set(id, out);
  void cells;
  return out;
}
