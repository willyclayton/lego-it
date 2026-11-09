import { useEffect, useMemo, useState } from 'react';
import { CHICAGO, loadChicago } from '../chicago';
import type { BuildingInfo } from '../chicago/kit';
import { buildMinutes } from '../lego/inventory';
import { realSizeCm } from '../render/pageRenderer';
import { BuildPlayer } from './BuildPlayer';
import { InstructionBook, mainStepCount } from './Instructions';
import { Studs } from './PartCallout';
import { PartsList } from './PartsList';

type Tab = 'build' | 'instructions' | 'parts';

function Facts({ info }: { info: BuildingInfo }) {
  return (
    <section className="facts" aria-label="About the building">
      <h2>About the building</h2>
      <dl>
        <div>
          <dt>Completed</dt>
          <dd>{info.year}</dd>
        </div>
        <div>
          <dt>Architect</dt>
          <dd>{info.architect}</dd>
        </div>
        <div>
          <dt>Height</dt>
          <dd>{info.height}</dd>
        </div>
        {info.floors ? (
          <div>
            <dt>Floors</dt>
            <dd>{info.floors}</dd>
          </div>
        ) : null}
        <div>
          <dt>Style</dt>
          <dd>{info.style}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{info.location}</dd>
        </div>
        <div>
          <dt>Model scale</dt>
          <dd>{info.scale}</dd>
        </div>
      </dl>
      <p>{info.fact}</p>
    </section>
  );
}

/** The page you land on after picking a building: it starts building right away. */
export function ChicagoBuild({ id, onBack, onOpen }: { id: string; onBack: () => void; onOpen: (id: string) => void }) {
  const idx = CHICAGO.findIndex((c) => c.id === id);
  const src = CHICAGO[idx];
  const prev = CHICAGO[(idx - 1 + CHICAGO.length) % CHICAGO.length];
  const next = CHICAGO[(idx + 1) % CHICAGO.length];
  const model = useMemo(() => loadChicago(id)!, [id]);
  const [tab, setTab] = useState<Tab>('build');
  const stats = useMemo(() => ({ cm: realSizeCm(model), minutes: buildMinutes(model), steps: mainStepCount(model) }), [model]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  return (
    <div className="build-view">
      <div className="bv-bar">
        <button className="chip bv-back" onClick={onBack}>
          ← All buildings
        </button>
        <div className="bv-nav">
          <button className="chip" onClick={() => onOpen(prev.id)} title={`Previous: ${prev.name}`}>
            ‹ <span className="bv-nav-name">{prev.name}</span>
          </button>
          <span className="bv-count">
            {idx + 1} / {CHICAGO.length}
          </span>
          <button className="chip" onClick={() => onOpen(next.id)} title={`Next: ${next.name}`}>
            <span className="bv-nav-name">{next.name}</span> ›
          </button>
        </div>
      </div>
      <main className="workspace">
        <div className="model-head">
          <div className="model-title">
            <p className="eyebrow">
              Chicago · {src.info.year} · {src.info.height.split(' (')[0]}
            </p>
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
        <Facts info={src.info} />
      </main>
    </div>
  );
}
