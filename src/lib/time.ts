import type { State } from './types';

const DEVICE = 'good-word-charlie-device';

/** A random name for this device, so two devices' minutes add up instead of overwriting each other. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE);
    if (!id) { id = Math.random().toString(36).slice(2, 10); localStorage.setItem(DEVICE, id); }
    return id;
  } catch {
    return 'unknown';
  }
}

export function addTime(s: State, date: string, device: string, seconds: number): State {
  const day = { ...s.time?.[date], [device]: (s.time?.[date]?.[device] ?? 0) + seconds };
  return { ...s, time: { ...s.time, [date]: day } };
}

/** Minutes on the site each day, all devices together. */
export function minutesByDay(s: State): Record<string, number> {
  return Object.fromEntries(Object.entries(s.time ?? {})
    .map(([d, devices]) => [d, Object.values(devices).reduce((a, n) => a + n, 0) / 60]));
}

const TICK = 15;           // seconds between checks
const IDLE = 2 * 60_000;   // no taps, keys or scrolling for this long: not counted

/**
 * Counts time while the site is on screen and being used, and adds it to
 * progress about once a minute (and whenever the site is put away).
 * Returns a function that stops it.
 */
export function trackTime(save: (seconds: number) => void): () => void {
  let last = Date.now(), pending = 0;
  const poke = () => { last = Date.now(); };
  const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
  events.forEach(e => window.addEventListener(e, poke, { passive: true }));
  const flush = () => { if (pending) { save(pending); pending = 0; } };
  const timer = setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - last < IDLE) pending += TICK;
    if (pending >= 60) flush();
  }, TICK * 1000);
  const away = () => { if (document.visibilityState === 'hidden') flush(); else poke(); };
  document.addEventListener('visibilitychange', away);
  return () => {
    flush();
    clearInterval(timer);
    events.forEach(e => window.removeEventListener(e, poke));
    document.removeEventListener('visibilitychange', away);
  };
}
