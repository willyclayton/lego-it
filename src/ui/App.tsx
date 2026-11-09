import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_MODEL, describeError, generateModel, MODEL_OPTIONS, type ModelSize } from '../ai/generate';
import { buildMinutes, colorsUsed } from '../lego/inventory';
import type { Model } from '../lego/types';
import { realSizeCm, StepRenderer } from '../render/pageRenderer';
import { loadSample, SAMPLES } from '../samples';
import { BuildPlayer } from './BuildPlayer';
import { InstructionBook, mainStepCount } from './Instructions';
import { Studs } from './PartCallout';
import { PartsList } from './PartsList';

type Tab = 'build' | 'instructions' | 'parts';

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

export function App() {
  const [modelId, setModelId] = useState<string>('freighter');
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

  const model = useMemo(() => generated.find((g) => g.id === modelId) ?? loadSample(modelId), [modelId, generated]);
  const samples = useMemo(() => SAMPLES.map((s) => loadSample(s.id)), []);
  const stats = useMemo(() => {
    const cm = realSizeCm(model);
    return { cm, minutes: buildMinutes(model), colors: colorsUsed(model).length, steps: mainStepCount(model) };
  }, [model]);

  useEffect(() => {
    document.title = `${model.name} · Lego It`;
  }, [model]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const p = prompt.trim();
    if (!p || busy) return;
    setNotice(null);
    if (!apiKey) {
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
      const { model: m } = await generateModel({ apiKey, prompt: p, size, model: aiModel, signal: ctrl.signal, onProgress: setBusy });
      setGenerated((g) => [m, ...g]);
      setModelId(m.id);
      setTab('build');
    } catch (err) {
      if (!ctrl.signal.aborted) setNotice(describeError(err));
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
          </div>
        </div>
      )}
    </div>
  );
}
