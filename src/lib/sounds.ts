/**
 * Arcade sound effects, made on the spot with the Web Audio API (no sound files).
 * Phones only let a page make sound after a tap, so the first tap anywhere unlocks it.
 */
type Sound = 'right' | 'wrong' | 'finish' | 'levelup' | 'celebrate' | 'tap';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let on = true;
let unlocked = false;

/** Sound on or off, from the person's settings. */
export function setSoundOn(value: boolean) { on = value; }

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (ctx && ctx.state === 'closed') { ctx = null; master = null; }
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.createDynamicsCompressor()).connect(ctx.destination);
    }
    // iPhone pauses audio when the site is put away ("interrupted"), not just before the first tap ("suspended").
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

// Wake the audio on every tap, not just the first: iPhone only lets it start from a tap
// (touchend or click, not touchstart), and pauses it again whenever the site is put away.
if (typeof window !== 'undefined') {
  const wake = () => {
    if (!on) return;
    const c = audio();
    if (c && !unlocked) {
      // A silent blip, played inside the tap, is what unlocks sound on iPhone.
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, 22050);
      src.connect(c.destination);
      src.start(0);
      unlocked = true;
    }
  };
  for (const e of ['touchend', 'click', 'keydown'] as const) window.addEventListener(e, wake, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') unlocked = false; });
}

// One square-wave note, `at` seconds from now.
function note(c: AudioContext, freq: number, at: number, dur: number, gain = 0.1) {
  const t = c.currentTime + at;
  const osc = c.createOscillator(), env = c.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, t);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(master!);
  osc.start(t); osc.stop(t + dur + 0.05);
}

// A button click, built like a real one: a tiny impulse that sets a few resonances
// ringing for a moment, the way pressing a small plastic button does.
function click(c: AudioContext) {
  const len = Math.ceil(c.sampleRate * 0.0015);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const out = c.createGain(); out.gain.value = 0.9;
  for (const [hz, q, level] of [[2300, 18, 1], [3900, 22, 0.6], [6100, 25, 0.3]]) {
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = hz; bp.Q.value = q;
    const g = c.createGain(); g.gain.value = level;
    src.connect(bp).connect(g).connect(out);
  }
  out.connect(master!);
  src.start(c.currentTime);
}

const F = { G3: 196, G4: 392, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, B5: 987.8, C6: 1046.5, D6: 1174.7, E6: 1318.5, G6: 1568 };

const SOUNDS: Record<Sound, (c: AudioContext) => void> = {
  // A coin.
  right: c => { note(c, F.B5, 0, 0.08, 0.12); note(c, F.E6, 0.08, 0.3, 0.12); },
  // Two falling buzzes. Also used when the words run out.
  wrong: c => { note(c, F.G3, 0, 0.14); note(c, F.G3 * 0.75, 0.15, 0.3); },
  // A short fanfare.
  finish: c => {
    [F.G4, F.C5, F.E5, F.G5].forEach((f, i) => note(c, f, i * 0.1, 0.1));
    note(c, F.E5, 0.42, 0.12); note(c, F.G5, 0.56, 0.5);
  },
  // A quick run up.
  levelup: c => { [F.C5, F.E5, F.G5, F.C6, F.E6].forEach((f, i) => note(c, f, i * 0.045, 0.07, 0.09)); },
  // A one-up jingle, for celebrating and being celebrated.
  tap: click,
  celebrate: c => { [F.E5, F.G5, F.E6, F.C6, F.D6, F.G6].forEach((f, i) => note(c, f, i * 0.09, 0.09, 0.08)); },
};

/**
 * A click for every press of a button, tab, chip or link. Buttons that make their own
 * sound (answers, Celebrate) carry data-sound="own" and are skipped.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('click', e => {
    const el = (e.target as Element | null)?.closest?.('button, a, [role="switch"], .pin');
    if (!el || el.closest('[data-sound="own"]') || (el as HTMLButtonElement).disabled) return;
    play('tap');
  }, { capture: true });
}

export function play(sound: Sound) {
  if (!on) return;
  const c = audio();
  if (c && master) SOUNDS[sound](c);
}
