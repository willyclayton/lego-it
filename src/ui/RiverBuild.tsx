import { useEffect, useMemo, useState } from 'react';
import { CHICAGO } from '../chicago';
import { buildMinutes } from '../lego/inventory';
import { realSizeCm } from '../render/pageRenderer';
import { riverModel } from '../river/model';
import { ft } from '../river/sights';
import { buildingInfo, loadWorld, type World } from '../river/world';
import { BuildPlayer } from './BuildPlayer';
import { InstructionBook, mainStepCount } from './Instructions';
import { Studs } from './PartCallout';
import { PartsList } from './PartsList';

type Tab = 'build' | 'instructions' | 'parts';

/** Build page for any building picked on the river tour. */
export function RiverBuild({ id, onBack }: { id: number; onBack: () => void }) {
  const [world, setWorld] = useState<World | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('build');
  useEffect(() => {
    let alive = true;
    loadWorld().then(
      (w) => alive && setWorld(w),
      (e) => alive && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const valid = !!world && id >= 1 && id <= world.b.h.length;
  const built = useMemo(() => (valid ? riverModel(world!, id) : null), [valid, world, id]);
  const info = useMemo(() => (valid ? buildingInfo(world!, id) : null), [valid, world, id]);
  useEffect(() => {
    if (info) document.title = `${info.name} · Lego It`;
  }, [info]);

  if (error || (world && !valid))
    return (
      <div className="build-view">
        <div className="bv-bar">
          <button className="chip bv-back" onClick={onBack}>
            ← Back to the river
          </button>
        </div>
        <p className="rv-msg">{error ?? 'That building is not on the tour.'}</p>
      </div>
    );
  if (!built || !info) return <div className="rv-msg">Loading…</div>;

  const { model } = built;
  const m = info.meta;
  const stats = { cm: realSizeCm(model), minutes: buildMinutes(model), steps: mainStepCount(model) };
  const cat = m.cat && CHICAGO.find((c) => c.id === m.cat);
  const est = info.heightSrc === 1 ? ` (estimated from ${m.lv} floors)` : info.heightSrc === 2 ? ' (estimate)' : '';
  return (
    <div className="build-view">
      <div className="bv-bar">
        <button className="chip bv-back" onClick={onBack}>
          ← Back to the river
        </button>
        {cat && (
          <a className="chip" href={`#chicago/${cat.id}`}>
            Detailed catalog model of {cat.name} ›
          </a>
        )}
      </div>
      <main className="workspace">
        <div className="model-head">
          <div className="model-title">
            <p className="eyebrow">Chicago River tour{m.y ? ` · ${m.y}` : ''} · {Math.round(info.heightM)} m</p>
            <h1>{model.name}</h1>
            <p>{model.tagline}</p>
          </div>
          <dl className="stats">
            <div>
              <dt>Pieces</dt>
              <dd>{model.bricks.length}</dd>
            </div>
            <div>
              <dt>Steps</dt>
              <dd>{stats.steps}</dd>
            </div>
            <div>
              <dt>Age</dt>
              <dd>{model.age}</dd>
            </div>
            <div>
              <dt>Difficulty</dt>
              <dd>
                <Studs n={model.difficulty} />
              </dd>
            </div>
            <div>
              <dt>Build time</dt>
              <dd>~{stats.minutes} min</dd>
            </div>
            <div>
              <dt>Model size</dt>
              <dd>
                {Math.round(stats.cm.w)}×{Math.round(stats.cm.d)}×{Math.round(stats.cm.h)} cm
              </dd>
            </div>
          </dl>
        </div>
        <nav className="tabs" role="tablist">
          {(
            [
              ['build', '▶ Build animation'],
              ['instructions', '📖 Instructions'],
              ['parts', '🧱 Parts list'],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="tab-body bv-body">
          {tab === 'build' && <BuildPlayer key={model.id} model={model} />}
          {tab === 'instructions' && <InstructionBook key={model.id} model={model} />}
          {tab === 'parts' && <PartsList model={model} />}
        </div>
        <section className="facts" aria-label="About the building">
          <h2>About the building</h2>
          <dl>
            <div>
              <dt>Height</dt>
              <dd>
                {Math.round(info.heightM)} m · {ft(info.heightM)} ft{est}
              </dd>
            </div>
            {m.lv ? (
              <div>
                <dt>Floors</dt>
                <dd>{m.lv}</dd>
              </div>
            ) : null}
            {m.y ? (
              <div>
                <dt>Completed</dt>
                <dd>{m.y}</dd>
              </div>
            ) : null}
            {m.a ? (
              <div>
                <dt>Architect</dt>
                <dd>{m.a}</dd>
              </div>
            ) : null}
            {m.ad ? (
              <div>
                <dt>Address</dt>
                <dd>{m.ad}</dd>
              </div>
            ) : null}
            <div>
              <dt>Model scale</dt>
              <dd>1:{Math.round(built.mPerStud / 0.008)}</dd>
            </div>
          </dl>
          {m.f && <p>{m.f}</p>}
          <p className="rv-src">Footprint and height from OpenStreetMap (© OpenStreetMap contributors). The windows are a simplified pattern.</p>
        </section>
      </main>
    </div>
  );
}
