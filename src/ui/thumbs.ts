import { useEffect, useState } from 'react';
import type { Model } from '../lego/types';
import { StepRenderer, type PartImage } from '../render/pageRenderer';
import { enqueue } from './renderQueue';

/** Tight hero renders, cached per model id; built in the background render queue. */
const cache = new Map<string, PartImage>();
const waiting = new Map<string, ((img: PartImage) => void)[]>();

export function thumbFor(id: string, getModel: () => Model): Promise<PartImage> {
  const hit = cache.get(id);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const list = waiting.get(id);
    if (list) return list.push(resolve);
    waiting.set(id, [resolve]);
    enqueue(() => {
      const r = new StepRenderer(getModel());
      const img = r.heroTight(320, 420);
      r.dispose();
      cache.set(id, img);
      for (const fn of waiting.get(id) ?? []) fn(img);
      waiting.delete(id);
    });
  });
}

export function useThumb(id: string, getModel: () => Model) {
  const [img, setImg] = useState<PartImage | null>(() => cache.get(id) ?? null);
  useEffect(() => {
    let alive = true;
    if (!cache.has(id)) void thumbFor(id, getModel).then((i) => alive && setImg(i));
    else setImg(cache.get(id)!);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return img;
}
