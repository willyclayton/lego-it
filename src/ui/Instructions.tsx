import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { color } from '../lego/colors';
import { inventory, stepParts, type InvItem } from '../lego/inventory';
import { brickAABB, stepLabels } from '../lego/steps';
import type { Model } from '../lego/types';
import { partImage, StepRenderer } from '../render/pageRenderer';
import { canPrint } from '../host';
import { BagIcon, PartCallout, RotateIcon } from './PartCallout';
import { enqueue, pendingRenders } from './renderQueue';

export const PAGE_W = 1120;
export const PAGE_H = 792;

type Page =
  | { kind: 'cover' }
  | { kind: 'steps'; steps: number[]; cap: number; sub?: string; bag: number; bagStart: boolean; wide?: boolean }
  | { kind: 'final' }
  | { kind: 'inventory'; items: InvItem[]; index: number; of: number };

/* ------------------------------ pagination ------------------------------ */

export function paginate(model: Model): Page[] {
  const pages: Page[] = [{ kind: 'cover' }];
  // how big is the model after each main step, relative to the finished model?
  const final = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const grow = (box: typeof final, b: Parameters<typeof brickAABB>[0]) => {
    const a = brickAABB(b);
    for (let k = 0; k < 3; k++) {
      box.min[k] = Math.min(box.min[k], a.min[k]);
      box.max[k] = Math.max(box.max[k], a.max[k]);
    }
  };
  const diag = (b: typeof final) => Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
  for (const b of model.bricks) grow(final, b);
  const fd = diag(final) || 1;
  const cur = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const capOf: number[] = [];
  const wideOf: boolean[] = [];
  // Approximate on-screen aspect of a box seen from the manual's 3/4 view.
  const az = ((model.heroView ?? 35) * Math.PI) / 180;
  const el = (30 * Math.PI) / 180;
  const screenAspect = (b: typeof final) => {
    const dx = b.max[0] - b.min[0], dy = b.max[1] - b.min[1], dz = b.max[2] - b.min[2];
    const w = Math.abs(dx * Math.cos(az)) + Math.abs(dz * Math.sin(az));
    const h = dy * Math.cos(el) + (Math.abs(dx * Math.sin(az)) + Math.abs(dz * Math.cos(az))) * Math.sin(el);
    return w / Math.max(0.1, h);
  };
  for (const s of model.steps) {
    if (s.sub) {
      capOf.push(6);
      wideOf.push(false);
      continue;
    }
    for (const id of s.bricks) grow(cur, model.bricks[id]);
    if (s.attaches) for (const b of model.bricks) if (b.sub === s.attaches) grow(cur, b);
    const f = diag(cur) / fd;
    // Small, simple builds get more steps per page; big models get room to breathe.
    const small = model.bricks.length < 150;
    capOf.push(s.attaches ? 1 : f < 0.42 ? 4 : small || f < 0.85 ? 2 : 1);
    wideOf.push(screenAspect(cur) > 1.9);
  }

  let page: Extract<Page, { kind: 'steps' }> | null = null;
  let lastBag = 0;
  const flush = () => {
    if (page) pages.push(page);
    page = null;
  };
  model.steps.forEach((s, i) => {
    const cap = capOf[i];
    const bagStart = s.bag > 0 && s.bag !== lastBag;
    lastBag = s.bag;
    const sameKind = page && page.sub === s.sub;
    if (!page || !sameKind || bagStart || page.steps.length >= Math.min(page.cap, cap) || (!s.sub && cap < page.cap && page.steps.length >= cap)) {
      flush();
      page = { kind: 'steps', steps: [], cap, sub: s.sub, bag: s.bag, bagStart, wide: wideOf[i] };
    }
    page.steps.push(i);
    page.wide = page.wide && wideOf[i];
    page.cap = Math.min(page.cap, cap);
  });
  flush();
  pages.push({ kind: 'final' });
  const inv = inventory(model);
  const per = 30;
  const n = Math.ceil(inv.length / per);
  for (let k = 0; k < n; k++) pages.push({ kind: 'inventory', items: inv.slice(k * per, k * per + per), index: k, of: n });
  return pages;
}

/* ------------------------------ step image ------------------------------ */

function StepImage({ r, si, w, h, highlight }: { r: StepRenderer; si: number; w: number; h: number; highlight: boolean }) {
  const [img, setImg] = useState<ReturnType<StepRenderer['step']> | null>(null);
  useEffect(() => {
    let alive = true;
    setImg(null);
    enqueue(() => {
      if (alive) setImg(r.step(si, Math.round(w), Math.round(h), highlight));
    });
    return () => {
      alive = false;
    };
  }, [r, si, w, h, highlight]);
  if (!img) return <div className="step-img loading" style={{ width: w, height: h }} />;
  return (
    <div className="step-img" style={{ width: w, height: h }}>
      <img src={img.url} width={w} height={h} alt={`Step ${si + 1}`} draggable={false} />
      {img.arrows.length > 0 && (
        <svg className="arrows" viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
          {img.arrows.map((a, k) => {
            const [x1, y1] = [a.from[0] * w, a.from[1] * h];
            const [x2, y2] = [a.to[0] * w, a.to[1] * h];
            const ang = Math.atan2(y2 - y1, x2 - x1);
            const L = 16;
            const hx = x2 - Math.cos(ang) * L, hy = y2 - Math.sin(ang) * L;
            const px = -Math.sin(ang) * 10, py = Math.cos(ang) * 10;
            return (
              <g key={k}>
                <line x1={x1} y1={y1} x2={hx} y2={hy} stroke="#1A1A1A" strokeWidth="9" strokeLinecap="round" />
                <line x1={x1} y1={y1} x2={hx} y2={hy} stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
                <path d={`M${x2},${y2} L${hx + px},${hy + py} L${hx - px},${hy - py} Z`} fill="#FFFFFF" stroke="#1A1A1A" strokeWidth="2.5" strokeLinejoin="round" />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/* ------------------------------ pages ------------------------------ */

const GRID: Record<number, [number, number]> = { 1: [1, 1], 2: [2, 1], 4: [2, 2], 6: [3, 2] };

function StepsPage({ model, r, page, highlight }: { model: Model; r: StepRenderer; page: Extract<Page, { kind: 'steps' }>; highlight: boolean }) {
  const n = page.steps.length;
  const cap = page.sub ? (n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : 6) : n <= 1 ? 1 : n <= 2 ? 2 : 4;
  // Two wide, flat steps read better stacked than side by side.
  const [cols, rows] = cap === 2 && page.wide ? [1, 2] : GRID[cap];
  const pad = page.sub ? 70 : 40;
  const top = page.sub ? 70 : 34;
  const cellW = (PAGE_W - pad * 2) / cols;
  const cellH = (PAGE_H - top - 64) / rows;
  const labels = stepLabels(model);
  const cells = page.steps.map((si) => {
    const s = model.steps[si];
    return (
      <div className={`step-cell ${s.sub ? 'is-sub' : ''}`} key={si} style={{ width: cellW, height: cellH }}>
        <StepImage r={r} si={si} w={cellW - 16} h={cellH - 16} highlight={highlight} />
        <div className="step-head">
          <div className={`step-num ${s.sub ? 'small' : ''}`}>{labels[si].num}</div>
          {!s.attaches && <PartCallout items={stepParts(model, si)} scale={cap >= 4 ? 13 : 16} />}
        </div>
        {s.rotated && (
          <div className="rot-wrap">
            <RotateIcon size={cap >= 4 ? 34 : 44} />
          </div>
        )}
      </div>
    );
  });
  return (
    <>
      {page.sub ? (
        <div className="sub-frame" style={{ left: pad - 22, top: top - 30, right: pad - 22, bottom: 50 }}>
          <div className="sub-title">{page.sub}</div>
        </div>
      ) : null}
      <div className="page-grid" style={{ left: pad, top, width: PAGE_W - pad * 2, gridTemplateColumns: `repeat(${cols}, ${cellW}px)`, gridTemplateRows: `repeat(${rows}, ${cellH}px)` }}>
        {cells}
      </div>
      {page.bagStart && (
        <div className="page-bag">
          <BagIcon n={page.bag} size={56} />
        </div>
      )}
    </>
  );
}

export function mainStepCount(model: Model) {
  return model.steps.filter((s) => !s.sub).length;
}

function CoverPage({ model, r }: { model: Model; r: StepRenderer }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    enqueue(() => setUrl(r.hero(900, 560, 'instructions')));
  }, [r]);
  return (
    <div className="cover">
      <div className="cover-top">
        <div className="brand">
          <span className="brand-brick" />
          Lego&nbsp;It
        </div>
        <div className="cover-id">LI-{String(model.bricks.length).padStart(4, '0')}</div>
      </div>
      <div className="cover-title">{model.name}</div>
      {url ? <img className="cover-hero" src={url} width={900} height={560} alt="" /> : <div className="cover-hero" />}
      <div className="cover-bottom">
        <div className="age">{model.age}</div>
        <div className="pcs">{model.bricks.length} pcs</div>
      </div>
    </div>
  );
}

function FinalPage({ model, r }: { model: Model; r: StepRenderer }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    enqueue(() => setUrl(r.hero(1000, 640, 'realistic', (model.heroView ?? 35) - 30, 24)));
  }, [r, model]);
  return (
    <div className="final">
      {url ? <img src={url} width={1000} height={640} alt="Finished model" /> : <div style={{ height: 640 }} />}
      <div className="final-note">{model.name} · {model.bricks.length} pieces · {mainStepCount(model)} steps</div>
    </div>
  );
}

function InventoryPage({ page }: { page: Extract<Page, { kind: 'inventory' }> }) {
  return (
    <div className="inventory">
      <div className="inv-grid">
        {page.items.map((it) => {
          const img = partImage(it.part, it.color, 12);
          const max = 118;
          const k = Math.min(1, max / img.w, 74 / img.h);
          return (
            <div className="inv-cell" key={`${it.part}|${it.color}`}>
              <div className="inv-img">
                <img src={img.url} width={img.w * k} height={img.h * k} alt="" />
              </div>
              <div className="inv-qty">{it.count}x</div>
              <div className="inv-id">
                {it.part} · {color(it.color).name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PageView({ model, r, page, num, highlight }: { model: Model; r: StepRenderer; page: Page; num: number; highlight: boolean }) {
  return (
    <div className={`page page-${page.kind}`} style={{ width: PAGE_W, height: PAGE_H }}>
      {page.kind === 'cover' && <CoverPage model={model} r={r} />}
      {page.kind === 'steps' && <StepsPage model={model} r={r} page={page} highlight={highlight} />}
      {page.kind === 'final' && <FinalPage model={model} r={r} />}
      {page.kind === 'inventory' && <InventoryPage page={page} />}
      {page.kind !== 'cover' && <div className="page-num">{num}</div>}
    </div>
  );
}

/* ------------------------------ book ------------------------------ */

export function InstructionBook({ model }: { model: Model }) {
  const r = useMemo(() => new StepRenderer(model), [model]);
  useEffect(() => () => r.dispose(), [r]);
  const pages = useMemo(() => paginate(model), [model]);
  const [idx, setIdx] = useState(0);
  const [highlight, setHighlight] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [progress, setProgress] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.8);

  useEffect(() => setIdx(0), [model]);
  useLayoutEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - 8;
      const h = el.clientHeight - 8;
      setScale(Math.min(w / PAGE_W, h / PAGE_H));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') setIdx((i) => Math.min(pages.length - 1, i + 1));
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pages.length]);

  // Prefetch the next page's renders while the reader looks at this one.
  const prefetch = pages[idx + 1];

  useEffect(() => {
    if (!printing) return;
    let done = false;
    const total = Math.max(1, pendingRenders());
    const tick = () => {
      if (done) return;
      const left = pendingRenders();
      setProgress(1 - left / total);
      if (left === 0) {
        setTimeout(() => {
          window.print();
          setPrinting(false);
        }, 300);
        return;
      }
      setTimeout(tick, 200);
    };
    setTimeout(tick, 300);
    return () => {
      done = true;
    };
  }, [printing]);

  const page = pages[idx];
  const stepPages = pages.map((p, i) => (p.kind === 'steps' ? i : -1)).filter((i) => i >= 0);
  const findStep = (n: number) => {
    let main = 0;
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (p.kind !== 'steps' || p.sub) continue;
      main += p.steps.length;
      if (main >= n) return i;
    }
    return stepPages[stepPages.length - 1] ?? 0;
  };

  return (
    <div className="book">
      <div className="book-bar">
        <button className="icon" onClick={() => setIdx(0)} aria-label="First page">
          ⏮
        </button>
        <button className="icon" onClick={() => setIdx(Math.max(0, idx - 1))} aria-label="Previous page">
          ‹
        </button>
        <input type="range" min={0} max={pages.length - 1} value={idx} onChange={(e) => setIdx(Number(e.target.value))} aria-label="Page" />
        <button className="icon" onClick={() => setIdx(Math.min(pages.length - 1, idx + 1))} aria-label="Next page">
          ›
        </button>
        <span className="page-label">
          Page <b>{idx + 1}</b> / {pages.length}
        </span>
        <label className="jump">
          Step
          <input
            type="number"
            min={1}
            max={mainStepCount(model)}
            placeholder="#"
            onKeyDown={(e) => {
              if (e.key === 'Enter') setIdx(findStep(Number((e.target as HTMLInputElement).value)));
            }}
          />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} /> Highlight new parts
        </label>
        {canPrint && (
          <button className="chip" onClick={() => setPrinting(true)} disabled={printing}>
            {printing ? `Preparing ${Math.round(progress * 100)}%…` : '⎙ Print / PDF'}
          </button>
        )}
      </div>
      <div className="book-stage" ref={wrap}>
        <div className="page-holder" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0' }}>
            <PageView model={model} r={r} page={page} num={idx + 1} highlight={highlight} />
          </div>
        </div>
        {prefetch && (
          <div className="prefetch" aria-hidden>
            <PageView model={model} r={r} page={prefetch} num={idx + 2} highlight={highlight} />
          </div>
        )}
      </div>
      {printing && (
        <div className="print-root">
          {pages.map((p, i) => (
            <PageView key={i} model={model} r={r} page={p} num={i + 1} highlight={highlight} />
          ))}
        </div>
      )}
    </div>
  );
}

