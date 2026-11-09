import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_MODEL, MODEL_OPTIONS, type ModelSize } from '../ai/models';
import { CHICAGO, loadChicago } from '../chicago';
import type { BuildingInfo } from '../chicago/kit';
import { getSample, inArtifact, type SampleFn } from '../host';
import { buildMinutes, colorsUsed } from '../lego/inventory';
import type { Model } from '../lego/types';
import { realSizeCm, StepRenderer } from '../render/pageRenderer';
import { loadSample, SAMPLES } from '../samples';
import { BuildPlayer } from './BuildPlayer';
import { Catalog } from './Catalog';
import { InstructionBook, mainStepCount } from './Instructions';
import { Studs } from './PartCallout';
import { PartsList } from './PartsList';
import { useThumb } from './thumbs';

type Tab = 'build' | 'instructions' | 'parts';
type Collection = 'samples' | 'chicago';
interface Route {
  view: 'catalog' | 'model';
  collection: Collection;
  id: string;
}

/** #chicago → catalog, #chicago/<id> → a Chicago model, #<sample-id> → a starter build. */
function parseHash(): Route {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h === 'chicago') return { view: 'catalog', collection: 'chicago', id: CHICAGO[0].id };
  if (h.startsWith('chicago/') && CHICAGO.some((c) => c.id === h.slice(8))) return { view: 'model', collection: 'chicago', id: h.slice(8) };
  if (SAMPLES.some((x) => x.id === h)) return { view: 'model', collection: 'samples', id: h };
  return { view: 'model', collection: 'samples', id: 'freighter' };
}
const hashOf = (r: Route) => (r.view === 'catalog' ? '#chicago' : r.collection === 'chicago' ? `#chicago/${r.id}` : `#${r.id}`);

const KEY_STORE = 'legoit.apiKey';
const MODEL_STORE = 'legoit.model';

function readStore(k: string) {
  try {
    return localStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
}
function writeStore(k: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
}

const thumbs = new Map<string, string>();
function thumbnail(model: Model) {
  let t = thumbs.get(model.id);
  if (!t) {
    const r = new StepRenderer(model);
    t = r.hero(300, 200, 'instructions');
    r.dispose();
    thumbs.set(model.id, t);
  }
  return t;
}

/** Offline matching so the example prompts work without an API key. */
function matchSample(prompt: string): string | null {
  const p = prompt.toLowerCase();
  const rules: [RegExp, string][] = [
    [/falcon|millenn|freighter|saucer|space ?ship|starship|spacecraft|ufo/, 'freighter'],
    [/duck|bird|chick/, 'duck'],
    [/car|racer|race|formula|f1|vehicle/, 'racer'],
    [/house|cottage|home|cabin|hut/, 'cottage'],
    [/lighthouse|light house|beacon|island|tower/, 'lighthouse'],
  ];
  for (const [re, id] of rules) if (re.test(p)) return id;
  return null;
}

function BrickLogo() {
  return (
    <svg width="34" height="28" viewBox="0 0 34 28" aria-hidden>
      <rect x="1" y="9" width="32" height="18" rx="2.5" fill="#D01012" stroke="#7a0a0b" strokeWidth="1.5" />
      <rect x="5" y="3" width="9" height="7" rx="2" fill="#D01012" stroke="#7a0a0b" strokeWidth="1.5" />
      <rect x="20" y="3" width="9" height="7" rx="2" fill="#D01012" stroke="#7a0a0b" strokeWidth="1.5" />
    </svg>
  );
}

function ChicagoShelfCard({ id, active, onClick }: { id: string; active: boolean; onClick: () => void }) {
  const src = CHICAGO.find((c) => c.id === id)!;
  const img = useThumb(id, () => loadChicago(id)!);
  return (
    <button className={`card ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="card-thumb">{img ? <img src={img.url} alt="" style={{ maxWidth: 150, maxHeight: 100 }} /> : null}</span>
      <div className="card-body">
        <div className="card-name">{src.name}</div>
        <div className="card-meta">
          <span>{src.info.year}</span> <span>{src.info.height.split(' ·')[0]}</span>
        </div>
      </div>
    </button>
  );
}

function Facts({ info }: { info: BuildingInfo }) {
  return (
    <section className="facts" aria-label="About the building">
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

export function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const modelId = route.id;
  const go = (r: Route) => {
    setRoute(r);
    if (location.hash !== hashOf(r)) history.pushState(null, '', hashOf(r));
    if (r.view !== route.view || r.id !== route.id) window.scrollTo({ top: 0 });
  };
  const setModelId = (id: string) => go({ view: 'model', collection: CHICAGO.some((c) => c.id === id) ? 'chicago' : 'samples', id });
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('popstate', on);
    window.addEventListener('hashchange', on);
    return () => {
      window.removeEventListener('popstate', on);
      window.removeEventListener('hashchange', on);
    };
  }, []);
  const [generated, setGenerated] = useState<Model[]>([]);
  const [tab, setTab] = useState<Tab>('build');
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<ModelSize>('medium');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => readStore(KEY_STORE));
  const [remember, setRemember] = useState(() => !!readStore(KEY_STORE));
  const [aiModel, setAiModel] = useState(() => readStore(MODEL_STORE) || DEFAULT_MODEL);
  const abort = useRef<AbortController | null>(null);
  // How "Build anything" reaches Claude: the viewer's own account when hosted on
  // claude.ai, otherwise a user-supplied API key.
  const hosted = useRef<SampleFn | null>(null);
  const [aiMode, setAiMode] = useState<'checking' | 'hosted' | 'key' | 'none'>(inArtifact ? 'checking' : 'key');
  useEffect(() => {
    if (!inArtifact) return;
    void getSample().then((sm) => {
      hosted.current = sm;
      setAiMode(sm ? 'hosted' : 'none');
    });
  }, []);

  const model = useMemo(() => generated.find((g) => g.id === modelId) ?? loadChicago(modelId) ?? loadSample(modelId), [modelId, generated]);
  const chicagoInfo = CHICAGO.find((c) => c.id === modelId)?.info;
  const samples = useMemo(() => SAMPLES.map((s) => loadSample(s.id)), []);
  const stats = useMemo(() => {
    const cm = realSizeCm(model);
    return { cm, minutes: buildMinutes(model), colors: colorsUsed(model).length, steps: mainStepCount(model) };
  }, [model]);

  useEffect(() => {
    document.title = route.view === 'catalog' ? 'Chicago Buildings · Lego It' : `${model.name} · Lego It`;
  }, [model, route.view]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const p = prompt.trim();
    if (!p || busy) return;
    setNotice(null);
    let mode = aiMode;
    if (mode === 'checking') {
      setBusy('Connecting to Claude…');
      hosted.current = await getSample();
      mode = hosted.current ? 'hosted' : 'none';
      setAiMode(mode);
      setBusy(null);
    }
    if (mode === 'none') {
      const id = matchSample(p);
      if (id) setModelId(id);
      setNotice(
        id
          ? `Showing the built-in “${SAMPLES.find((x) => x.id === id)!.name}”. Designing new models needs Claude, which isn’t available to this page right now.`
          : 'Designing new models needs Claude, which isn’t available to this page right now. Try one of the samples below.',
      );
      return;
    }
    if (mode === 'key' && !apiKey) {
      const id = matchSample(p);
      if (id) {
        setModelId(id);
        setNotice(`Showing the built-in “${SAMPLES.find((s) => s.id === id)!.name}”. Add a Claude API key in Settings to design “${p}” from scratch.`);
      } else {
        setNotice('To design anything you type, add your Claude API key in Settings. Meanwhile, try one of the samples below.');
        setSettings(true);
      }
      return;
    }
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy('Starting…');
    try {
      let m: Model;
      if (mode === 'hosted' && hosted.current) {
        const { generateHosted } = await import('../ai/hosted');
        ({ model: m } = await generateHosted(hosted.current, { prompt: p, size, signal: ctrl.signal, onProgress: setBusy }));
      } else {
        const { generateModel } = await import('../ai/generate');
        ({ model: m } = await generateModel({ apiKey, prompt: p, size, model: aiModel, signal: ctrl.signal, onProgress: setBusy }));
      }
      setGenerated((g) => [m, ...g]);
      setModelId(m.id);
      setTab('build');
    } catch (err) {
      if (!ctrl.signal.aborted) setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      abort.current = null;
    }
  };

  const saveSettings = () => {
    writeStore(KEY_STORE, remember && apiKey ? apiKey : null);
    writeStore(MODEL_STORE, aiModel);
    setSettings(false);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <BrickLogo />
          <span>Lego&nbsp;It</span>
        </div>
        <nav className="topnav" aria-label="Collections">
          <button className={route.collection === 'samples' && route.view === 'model' ? 'on' : ''} onClick={() => go({ view: 'model', collection: 'samples', id: SAMPLES.some((x) => x.id === modelId) ? modelId : 'freighter' })}>
            Starter builds
          </button>
          <button className={route.collection === 'chicago' ? 'on' : ''} onClick={() => go({ view: 'catalog', collection: 'chicago', id: modelId })}>
            Chicago
          </button>
        </nav>
        <form className="prompt" onSubmit={submit}>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Build anything… a Millennium Falcon, a dragon, the Eiffel Tower"
            aria-label="What do you want to build?"
          />
          <select value={size} onChange={(e) => setSize(e.target.value as ModelSize)} aria-label="Model size">
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
          <button className="primary" type="submit" disabled={!!busy}>
            {busy ? 'Building…' : 'Build it'}
          </button>
        </form>
        <button className="icon settings-btn" onClick={() => setSettings(true)} aria-label="Settings" title="Settings">
          ⚙
        </button>
      </header>

      {notice && (
        <div className="notice" role="status">
          {notice}
          <button className="icon" onClick={() => setNotice(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {route.view === 'catalog' ? (
        <Catalog onOpen={(id) => go({ view: 'model', collection: 'chicago', id })} />
      ) : (
        <>
      {route.collection === 'chicago' ? (
        <section className="shelf" aria-label="Chicago buildings">
          <button className="card card-back" onClick={() => go({ view: 'catalog', collection: 'chicago', id: modelId })}>
            <span className="card-back-arrow">←</span>
            <span className="card-name">All {CHICAGO.length} landmarks</span>
            <span className="card-meta">Chicago catalog</span>
          </button>
          {CHICAGO.map((c) => (
            <ChicagoShelfCard key={c.id} id={c.id} active={c.id === modelId} onClick={() => setModelId(c.id)} />
          ))}
        </section>
      ) : (
      <section className="shelf" aria-label="Models">
        {[...generated, ...samples].map((m) => (
          <button key={m.id} className={`card ${m.id === modelId ? 'active' : ''}`} onClick={() => setModelId(m.id)}>
            <img src={thumbnail(m)} alt="" width={150} height={100} />
            <div className="card-body">
              <div className="card-name">{m.name}</div>
              <div className="card-meta">
                <Studs n={m.difficulty} /> <span>{m.bricks.length} pcs</span>
              </div>
            </div>
            {m.generated && <span className="tag">AI</span>}
          </button>
        ))}
      </section>
      )}

      <main className="workspace">
        <div className="model-head">
          <div className="model-title">
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
              <dt>Size</dt>
              <dd>
                {Math.round(stats.cm.w)}×{Math.round(stats.cm.d)}×{Math.round(stats.cm.h)} cm
              </dd>
            </div>
          </dl>
        </div>
        {chicagoInfo && <Facts info={chicagoInfo} />}
        <nav className="tabs" role="tablist">
          {(
            [
              ['build', '▶ Build animation'],
              ['instructions', '📖 Instructions'],
              ['parts', '🧱 Parts list'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="tab-body">
          {tab === 'build' && <BuildPlayer key={model.id} model={model} />}
          {tab === 'instructions' && <InstructionBook key={model.id} model={model} />}
          {tab === 'parts' && <PartsList model={model} />}
        </div>
      </main>
        </>
      )}

      <footer className="foot">
        Lego It is a fan-made tool. LEGO® is a trademark of the LEGO Group, which does not sponsor, authorize or endorse this site. Part numbers and
        colors follow the LDraw and BrickLink catalogs.
      </footer>

      {busy && (
        <div className="overlay" role="alertdialog" aria-label="Designing">
          <div className="busy-card">
            <div className="brick-spinner">
              <i />
              <i />
              <i />
            </div>
            <div className="busy-title">Designing “{prompt}”</div>
            <div className="busy-msg">{busy}</div>
            <button className="chip" onClick={() => abort.current?.abort()}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {settings && (
        <div className="overlay" onClick={() => setSettings(false)}>
          <div className="modal" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
            <h2>Design anything with Claude</h2>
            <p>
              The samples work offline. To turn any idea into a model, Lego It asks Claude to sketch it as 3D shapes, then converts those into real bricks and
              instructions right here in your browser.
            </p>
            {inArtifact ? (
              <>
                <p>
                  {aiMode === 'none'
                    ? 'Claude isn’t available to this page in your account right now, so only the built-in samples can be shown.'
                    : 'On this page, designs run on your own Claude account. The first time you build, you’ll be asked to allow Lego It to use Claude. There’s nothing to set up.'}
                </p>
                <div className="modal-actions">
                  <button className="primary" onClick={() => setSettings(false)}>
                    Got it
                  </button>
                </div>
              </>
            ) : (
              <>
            <label className="field">
              <span>Claude API key</span>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value.trim())} placeholder="sk-ant-…" autoComplete="off" />
            </label>
            <label className="toggle">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember on this device
            </label>
            <label className="field">
              <span>Model</span>
              <select value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
                {MODEL_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="fine">
              Your key is only sent to api.anthropic.com, straight from this browser. Use a key with a spending limit. A design typically costs a few tens of
              cents.
            </p>
            <div className="modal-actions">
              {apiKey && (
                <button
                  className="chip"
                  onClick={() => {
                    setApiKey('');
                    setRemember(false);
                    writeStore(KEY_STORE, null);
                  }}
                >
                  Forget key
                </button>
              )}
              <button className="primary" onClick={saveSettings}>
                Save
              </button>
            </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
