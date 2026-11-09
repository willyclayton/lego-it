import { buildModel } from '../lego/steps';
import type { Model, ModelSource } from '../lego/types';
import { cottage } from './cottage';
import { duck } from './duck';
import { freighter } from './freighter';
import { lighthouse } from './lighthouse';
import { racer } from './racer';

/** Built-in samples, least to most complex. */
export const SAMPLES: ModelSource[] = [duck, racer, cottage, lighthouse, freighter];

const cache = new Map<string, Model>();
export function loadSample(id: string): Model {
  let m = cache.get(id);
  if (!m) {
    const src = SAMPLES.find((s) => s.id === id);
    if (!src) throw new Error(`Unknown sample ${id}`);
    m = buildModel(src);
    cache.set(id, m);
  }
  return m;
}
