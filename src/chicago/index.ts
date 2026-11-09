import { buildModel } from '../lego/steps';
import type { Model } from '../lego/types';
import { boardOfTrade, mart, monadnock, rookery, tribune, waterTower, wrigleyBuilding } from './buildings/historic';
import { marinaCity, robieHouse, wrigleyField } from './buildings/special';
import { aon, aqua, carbide, hancock, lakePoint, stRegis, trump, twoPru, wacker333 } from './buildings/towers';
import { willis } from './buildings/willis';
import type { ChicagoSource } from './kit';

/** The Chicago catalog: 20 landmarks, tallest first. */
export const CHICAGO: ChicagoSource[] = [
  willis,
  trump,
  stRegis,
  aon,
  hancock,
  twoPru,
  aqua,
  lakePoint,
  boardOfTrade,
  marinaCity,
  carbide,
  wacker333,
  tribune,
  wrigleyBuilding,
  mart,
  monadnock,
  rookery,
  waterTower,
  wrigleyField,
  robieHouse,
];

const cache = new Map<string, Model>();
export function loadChicago(id: string): Model | null {
  const src = CHICAGO.find((s) => s.id === id);
  if (!src) return null;
  let m = cache.get(id);
  if (!m) {
    m = buildModel(src);
    cache.set(id, m);
  }
  return m;
}
