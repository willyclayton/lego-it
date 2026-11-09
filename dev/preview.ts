// Dev-only: render a model from several angles. Open /dev/preview.html#<model-id>
import { CHICAGO, loadChicago } from '../src/chicago';
import { StepRenderer } from '../src/render/pageRenderer';
import { loadSample } from '../src/samples';

const id = location.hash.slice(1) || CHICAGO[0].id;
if (id === 'all' || id.startsWith('all:')) {
  // contact sheet: every Chicago model (or a slice: #all:0-10)
  const [a, b] = (id.split(':')[1] ?? `0-${CHICAGO.length}`).split('-').map(Number);
  const out = document.getElementById('out')!;
  for (const src of CHICAGO.slice(a, b)) {
    const m = loadChicago(src.id)!;
    const r = new StepRenderer(m);
    const fig = document.createElement('figure');
    fig.style.cssText = 'margin:0;background:#fff;border:1px solid #ccc;font:12px system-ui;text-align:center';
    const img = new Image(300, 400);
    img.src = r.hero(300, 400, 'instructions', m.heroView ?? 35, 24);
    fig.append(img, Object.assign(document.createElement('figcaption'), { textContent: `${m.name} · ${m.bricks.length} pcs` }));
    out.appendChild(fig);
    r.dispose();
  }
  (window as unknown as { __ready: boolean }).__ready = true;
  throw new Error('contact sheet done');
}
const t0 = performance.now();
const model = loadChicago(id) ?? loadSample(id);
const t1 = performance.now();
const r = new StepRenderer(model);
const out = document.getElementById('out')!;
const views: [number, number, 'instructions' | 'realistic', number, number][] = [
  [model.heroView ?? 35, 22, 'instructions', 520, 720],
  [(model.heroView ?? 35) + 180, 22, 'instructions', 520, 720],
  [(model.heroView ?? 35) - 70, 28, 'realistic', 520, 720],
  [model.heroView ?? 35, 70, 'instructions', 520, 520],
];
for (const [az, el, style, w, h] of views) {
  const img = new Image(w, h);
  img.src = r.hero(w, h, style, az, el);
  out.appendChild(img);
}
const counts = new Map<string, number>();
for (const b of model.bricks) counts.set(b.part, (counts.get(b.part) ?? 0) + 1);
document.getElementById('stats')!.textContent =
  `${model.name}: ${model.bricks.length} pieces, ${model.steps.length} steps, built in ${Math.round(t1 - t0)} ms\n` +
  [...counts].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p}:${n}`).join('  ');
(window as unknown as { __ready: boolean }).__ready = true;
