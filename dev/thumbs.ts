// Dev-only: renders one catalog thumbnail as WebP for scripts/thumbs.cjs.
// /dev/thumbs.html#list → window.__ids; /dev/thumbs.html#<id> → window.__thumb (data URL)
import { CHICAGO, loadChicago } from '../src/chicago';
import { StepRenderer } from '../src/render/pageRenderer';

const w = window as unknown as { __ids?: string[]; __thumb?: string };
const id = location.hash.slice(1);
if (id === 'list') {
  w.__ids = CHICAGO.map((c) => c.id);
} else {
  const r = new StepRenderer(loadChicago(id)!);
  const img = r.heroTight(320, 420); // rendered at 2x
  const el = new Image();
  el.onload = () => {
    const c = document.createElement('canvas');
    c.width = el.naturalWidth;
    c.height = el.naturalHeight;
    c.getContext('2d')!.drawImage(el, 0, 0);
    w.__thumb = c.toDataURL('image/webp', 0.86);
  };
  el.src = img.url;
}
