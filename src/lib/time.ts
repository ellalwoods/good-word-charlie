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

/** The parts of the site whose use is counted. */
export const PAGES = ['today', 'practice', 'redo', 'shuffle', 'lexicon', 'friends', 'games', 'sync', 'stats'] as const;
export type Page = typeof PAGES[number];
export const PAGE_NAMES: Record<Page, string> = {
  today: 'Today', practice: 'Practice', redo: 'Redo', shuffle: 'Shuffle test',
  lexicon: 'Lexicon', friends: 'Friends', games: 'Games', sync: 'Sync devices', stats: 'Ella’s stats',
};

// time[date] holds "device" (all seconds) and "device|page" (seconds on that page);
// visits[date] holds "device|page" (times it was opened). Each device only adds to its own.
const bump = (m: Record<string, Record<string, number>> | undefined, date: string, key: string, by: number) =>
  ({ ...m, [date]: { ...m?.[date], [key]: (m?.[date]?.[key] ?? 0) + by } });

export function addTime(s: State, date: string, device: string, seconds: number, pages: Partial<Record<Page, number>> = {}): State {
  let time = bump(s.time, date, device, seconds);
  for (const [p, n] of Object.entries(pages)) time = bump(time, date, `${device}|${p}`, n);
  return { ...s, time };
}

export function addVisit(s: State, date: string, device: string, page: Page): State {
  return { ...s, visits: bump(s.visits, date, `${device}|${page}`, 1) };
}

/** Minutes on the site each day, all devices together. */
export function minutesByDay(s: State): Record<string, number> {
  return Object.fromEntries(Object.entries(s.time ?? {})
    .map(([d, keys]) => [d, Object.entries(keys).filter(([k]) => !k.includes('|')).reduce((a, [, n]) => a + n, 0) / 60]));
}

export interface PageUse { page: Page; minutes: number; visits: number }

/** Busiest first; ties in the site's own order. */
export const byUse = (a: PageUse, b: PageUse) =>
  b.minutes - a.minutes || b.visits - a.visits || PAGES.indexOf(a.page) - PAGES.indexOf(b.page);

/** Minutes and visits for each page, all time, busiest first. */
export function pageUse(s: State): PageUse[] {
  const out = new Map<Page, PageUse>();
  const add = (stamps: State['time'], field: 'minutes' | 'visits', scale: number) => {
    for (const keys of Object.values(stamps ?? {})) {
      for (const [k, n] of Object.entries(keys)) {
        const page = k.split('|')[1] as Page | undefined;
        if (!page || !PAGES.includes(page)) continue;
        const u = out.get(page) ?? { page, minutes: 0, visits: 0 };
        u[field] += n / scale;
        out.set(page, u);
      }
    }
  };
  add(s.time, 'minutes', 60);
  add(s.visits, 'visits', 1);
  return [...out.values()].sort(byUse);
}

const TICK = 15;           // seconds between checks
const IDLE = 2 * 60_000;   // no taps, keys or scrolling for this long: not counted

/**
 * Counts time while the site is on screen and being used, and adds it to
 * progress about once a minute (and whenever the site is put away).
 * Returns a function that stops it.
 */
export function trackTime(page: () => Page, save: (seconds: number, pages: Partial<Record<Page, number>>) => void): () => void {
  let last = Date.now(), pending = 0, pages: Partial<Record<Page, number>> = {};
  const poke = () => { last = Date.now(); };
  const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
  events.forEach(e => window.addEventListener(e, poke, { passive: true }));
  const flush = () => { if (pending) { save(pending, pages); pending = 0; pages = {}; } };
  const timer = setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - last < IDLE) {
      pending += TICK;
      const p = page();
      pages[p] = (pages[p] ?? 0) + TICK;
    }
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
