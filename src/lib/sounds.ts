/**
 * Arcade sound effects, made on the spot with the Web Audio API (no sound files).
 * Phones only let a page make sound after a tap, so the first tap anywhere unlocks it.
 */
type Sound = 'right' | 'wrong' | 'finish' | 'levelup' | 'celebrate';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let on = true;

/** Sound on or off, from the person's settings. */
export function setSoundOn(value: boolean) { on = value; }

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.createDynamicsCompressor()).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

if (typeof window !== 'undefined') {
  const unlock = () => { audio(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
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
  celebrate: c => { [F.E5, F.G5, F.E6, F.C6, F.D6, F.G6].forEach((f, i) => note(c, f, i * 0.09, 0.09, 0.08)); },
};

export function play(sound: Sound) {
  if (!on) return;
  const c = audio();
  if (c && master) SOUNDS[sound](c);
}
