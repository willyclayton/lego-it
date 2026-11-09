import { useEffect, useMemo, useRef, useState } from 'react';
import { saveFile } from '../host';
import { stepParts } from '../lego/inventory';
import { color } from '../lego/colors';
import { part } from '../lego/parts';
import { stepLabels } from '../lego/steps';
import type { Model } from '../lego/types';
import type { RenderStyle } from '../render/brickMesh';
import { BuildEngine } from '../render/player';
import { BagIcon, PartCallout } from './PartCallout';
import { unlockAudio } from './sound';

const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const SPEEDS = [0.5, 1, 2, 4, 8];

export function BuildPlayer({ model, autoplay = true }: { model: Model; autoplay?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<BuildEngine | null>(null);
  const scrub = useRef<HTMLInputElement>(null);
  const timeLabel = useRef<HTMLSpanElement>(null);
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(model.bricks.length > 250 ? 2 : 1);
  const [style, setStyle] = useState<RenderStyle>('instructions');
  const [sound, setSound] = useState(true);
  const [loop, setLoop] = useState(false);
  const [autoCam, setAutoCam] = useState(true);
  const [recording, setRecording] = useState(false);
  const [total, setTotal] = useState(1);
  const [hover, setHover] = useState<{ id: number; x: number; y: number } | null>(null);
  const lastPick = useRef(0);
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const e = new BuildEngine(host.current!, model, style);
    engine.current = e;
    e.speed = speed;
    e.sound = sound;
    e.loop = loop;
    e.onStep = setStep;
    e.onPlayState = setPlaying;
    e.onRecordState = setRecording;
    e.onCamMode = setAutoCam;
    e.onTick = (t) => {
      if (scrub.current && document.activeElement !== scrub.current) scrub.current.value = String(t);
      if (timeLabel.current) timeLabel.current.textContent = `${fmt(t)} / ${fmt(e.sch.total)}`;
    };
    setTotal(e.sch.total);
    e.seek(0);
    if (autoplay) e.play();
    return () => e.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  useEffect(() => {
    if (engine.current) engine.current.speed = speed;
  }, [speed]);
  useEffect(() => {
    if (engine.current) engine.current.sound = sound;
  }, [sound]);
  useEffect(() => {
    if (engine.current) engine.current.loop = loop;
  }, [loop]);
  useEffect(() => {
    engine.current?.setStyle(style);
  }, [style]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const e = engine.current;
      if (!e || (ev.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (ev.code === 'Space') {
        ev.preventDefault();
        unlockAudio();
        e.toggle();
      } else if (ev.key === 'ArrowRight') {
        e.pause();
        e.gotoStep(Math.max(0, step) + 1);
      } else if (ev.key === 'ArrowLeft') {
        e.pause();
        e.gotoStep(Math.max(0, step - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  const labels = useMemo(() => stepLabels(model), [model]);
  const mainCount = useMemo(() => labels.filter((l) => !l.sub).length, [labels]);
  const s = step >= 0 ? model.steps[step] : null;
  const label = step >= 0 ? labels[step] : null;
  // main-model step reached so far (for the transport label)
  const mainReached = useMemo(() => {
    for (let i = Math.max(0, step); i >= 0; i--) if (!labels[i]?.sub) return labels[i]?.num ?? 0;
    return 0;
  }, [labels, step]);
  const parts = useMemo(() => (step >= 0 ? stepParts(model, step) : []), [model, step]);
  const ticks = useMemo(() => {
    const e = engine.current;
    if (!e) return [];
    return model.steps.map((st, i) => ({ i, at: e.sch.stepStart[i] / e.sch.total, sub: !!st.sub || !!st.attaches, bag: st.bag }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, total]);
  const bagStart = s && s.bag > 0 && (step === 0 || model.steps[step - 1].bag !== s.bag);

  return (
    <div className="player">
      <div
        className="stage"
        ref={host}
        onPointerDown={() => {
          unlockAudio();
          setHover(null);
        }}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(ev) => {
          const e = engine.current;
          if (!e || e.playing || ev.buttons) return;
          const now = performance.now();
          if (now - lastPick.current < 90) return;
          lastPick.current = now;
          const id = e.pickAt(ev.clientX, ev.clientY);
          const box = host.current!.getBoundingClientRect();
          setHover(id === null ? null : { id, x: ev.clientX - box.left, y: ev.clientY - box.top });
        }}
      >
        <div className="step-overlay">
          {s && (
            <>
              <div className="step-head">
                <div className={`step-num ${label?.sub ? 'small' : ''}`}>{label?.num}</div>
                {s.attaches ? (
                  <div className="callout sub-note">Attach the {s.attaches.toLowerCase()}</div>
                ) : (
                  <PartCallout items={parts} scale={narrow ? 9 : 15} />
                )}
              </div>
              {s.sub && <div className="sub-badge">Sub-assembly · {s.sub} · built on the side</div>}
              {bagStart && (
                <div className="bag-note">
                  <BagIcon n={s.bag} size={38} /> <span>Open bag {s.bag}</span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="stage-tools">
          <div className="seg" role="group" aria-label="Render style">
            <button className={style === 'instructions' ? 'on' : ''} onClick={() => setStyle('instructions')}>
              Manual
            </button>
            <button className={style === 'realistic' ? 'on' : ''} onClick={() => setStyle('realistic')}>
              Realistic
            </button>
          </div>
          {!autoCam && (
            <button className="chip" onClick={() => engine.current?.recenter()}>
              ⟲ Auto camera
            </button>
          )}
        </div>
        {recording && <div className="rec-badge">● Recording…</div>}
        {hover && !playing && (
          <div className="brick-tip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
            <b>{part(model.bricks[hover.id].part).name}</b>
            <span>
              <i className="swatch" style={{ background: color(model.bricks[hover.id].color).hex }} /> {color(model.bricks[hover.id].color).name} · #
              {model.bricks[hover.id].part}
            </span>
            <span>
              {labels[model.bricks[hover.id].step].sub ? `${labels[model.bricks[hover.id].step].sub} · step ` : 'Step '}
              {labels[model.bricks[hover.id].step].num}
            </span>
          </div>
        )}
      </div>

      <div className="transport">
        <button
          className="play"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => {
            unlockAudio();
            engine.current?.toggle();
          }}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" width="22" height="22"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 4.5v15l13-7.5z" fill="currentColor" /></svg>
          )}
        </button>
        <button className="icon" aria-label="Previous step" onClick={() => { engine.current?.pause(); engine.current?.gotoStep(Math.max(0, step - 1)); }}>
          ‹
        </button>
        <button className="icon" aria-label="Next step" onClick={() => { engine.current?.pause(); engine.current?.gotoStep(step + 1); }}>
          ›
        </button>
        <div className="scrubber">
          <div className="ticks">
            {ticks.map((tk) => (
              <i key={tk.i} className={tk.sub ? 'sub' : ''} style={{ left: `${tk.at * 100}%` }} />
            ))}
          </div>
          <input
            ref={scrub}
            type="range"
            min={0}
            max={total}
            step={1}
            defaultValue={0}
            aria-label="Timeline"
            onPointerDown={() => engine.current?.pause()}
            onInput={(ev) => engine.current?.seek(Number((ev.target as HTMLInputElement).value))}
          />
        </div>
        <span className="time" ref={timeLabel} />
        {!playing && <span className="hint">Hover a brick to identify it · drag to orbit</span>}
        <span className="step-label">
          Step <b>{mainReached}</b> / {mainCount}
        </span>
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Speed">
          {SPEEDS.map((v) => (
            <option key={v} value={v}>
              {v}×
            </option>
          ))}
        </select>
        <button className={`icon ${sound ? 'on' : ''}`} aria-label="Sound" title="Click sounds" onClick={() => { unlockAudio(); setSound(!sound); }}>
          {sound ? '🔊' : '🔈'}
        </button>
        <button className={`icon ${loop ? 'on' : ''}`} aria-label="Loop" title="Loop" onClick={() => setLoop(!loop)}>
          ↻
        </button>
        <button
          className={`chip ${recording ? 'danger' : ''}`}
          title="Record the build animation as a video"
          onClick={() => {
            const e = engine.current;
            if (!e) return;
            if (e.recording) e.stopRecording();
            else e.record((blob, ext) => void saveFile(`${model.name.replace(/\s+/g, '-').toLowerCase()}-build.${ext}`, blob));
          }}
        >
          {recording ? '■ Stop' : '⬤ Video'}
        </button>
      </div>
    </div>
  );
}
