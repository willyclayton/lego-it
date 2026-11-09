/**
 * Synthesized plastic "click" — no audio assets needed.
 * Three layers: a band-passed noise transient, a short tick and a low body thock,
 * with slight random pitch/gain so repeated clicks don't sound mechanical.
 */
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let lastClick = 0;

function ensure() {
  if (!ctx) {
    ctx = new AudioContext();
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ensure();
}

/** Only make sound after the user has interacted with the page (browser autoplay rules). */
function ready() {
  return ctx && ctx.state === 'running' ? ctx : null;
}

export function click(vol = 0.35) {
  const c = ready();
  if (!c) return;
  const now = c.currentTime;
  if (now - lastClick < 0.05) return; // rate limit
  lastClick = now;
  const p = 1 + (Math.random() - 0.5) * 0.16;
  const out = c.createGain();
  out.gain.value = vol * (0.8 + Math.random() * 0.4);
  out.connect(c.destination);
  const env = (a: number, len: number) => {
    const g = c.createGain();
    g.gain.setValueAtTime(a, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + len);
    return g;
  };
  const n = c.createBufferSource();
  n.buffer = noise;
  const bp = new BiquadFilterNode(c, { type: 'bandpass', frequency: 3200 * p, Q: 2.5 });
  n.connect(bp).connect(env(1, 0.02)).connect(out);
  n.start(now);
  n.stop(now + 0.03);
  const tick = new OscillatorNode(c, { type: 'triangle', frequency: 2400 * p });
  tick.frequency.exponentialRampToValueAtTime(1400 * p, now + 0.03);
  tick.connect(env(0.3, 0.04)).connect(out);
  tick.start(now);
  tick.stop(now + 0.05);
  const body = new OscillatorNode(c, { type: 'sine', frequency: 220 * p });
  body.frequency.exponentialRampToValueAtTime(120, now + 0.05);
  body.connect(env(0.45, 0.06)).connect(out);
  body.start(now);
  body.stop(now + 0.07);
}

/** Little C-E-G arpeggio when the model is finished. */
export function fanfare(vol = 0.18) {
  const c = ready();
  if (!c) return;
  const now = c.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const o = new OscillatorNode(c, { type: 'sine', frequency: f });
    const g = c.createGain();
    const t = now + i * 0.09;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.55);
  });
}
