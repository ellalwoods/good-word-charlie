import { PER_DAY, streak } from './daily';
import { addDays } from './dates';
import { on, uses, type Friend } from './friends';
import { normalise } from './merge';
import { byUse, minutesByDay, pageUse, type PageUse } from './time';
import type { State, Word } from './types';

/** One record as the owner's stats function returns it. */
export interface Row { id?: string; updated_at: string; archived?: boolean; data: unknown }

export interface Person {
  id: string;                // the start of their key, for archiving
  archived: boolean;
  name: string;
  guest: boolean;            // no name yet: "Guest 1", "Guest 2", by when they started
  started: string | null;    // when the record was first used (ISO), or the first day it was dealt words
  startedTime: boolean;      // whether `started` has a time of day, not just a date
  color: string | null;
  lastSeen: string;          // ISO time of the last save
  streak: number;
  practised: number;         // days a practice was finished
  dealt: number;             // days words were dealt
  learned: number;
  strong: number;            // words at level 5 or 6
  accuracy: number | null;   // share of graded answers right
  used: number;
  stories: number;
  cheersGiven: number;
  cheersReceived: number;
  left: number;              // words still in the box for them
  runsOut: string | null;    // the day they'd see the out-of-words card
  minutes: number;           // on the site, all time (counted since this was added)
  minutesWeek: number;       // the last 7 days, today included
  byDay: Record<string, number>;
  pages: PageUse[];
}

export interface Tally { word: string; n: number; extra?: string }
export interface Story { name: string; word: string; date: string; text: string }

export interface Stats {
  people: Person[];
  guests: number;            // records with no name (shown among the people, as guests)
  activeWeek: number;
  hardest: Tally[];
  known: Tally[];
  rejected: Tally[];
  mostUsed: Tally[];
  stories: Story[];
  pages: PageUse[];          // everyone together
}

const top = (counts: Map<string, number>, n = 8, extra?: (w: string) => string): Tally[] =>
  [...counts].filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n)
    .map(([word, c]) => ({ word, n: c, extra: extra?.(word) }));

const bump = (m: Map<string, number>, k: string, by = 1) => m.set(k, (m.get(k) ?? 0) + by);

export function computeStats(rows: Row[], bank: Word[], date: string): Stats {
  // A guest record whose device has since become someone else is left out.
  const records = rows.map((r, i) => ({ id: r.id ?? String(i), archived: !!r.archived, at: r.updated_at, s: normalise(r.data) as State }))
    .filter(r => !r.s.moved);
  const named = records.filter(r => r.s.name?.value);
  const startOf = (s: State): { started: string | null; startedTime: boolean } => {
    if (s.started) return { started: new Date(s.started).toISOString(), startedTime: true };
    const first = Object.keys(s.days).sort()[0];
    return { started: first ? `${first}T00:00:00` : null, startedTime: false };
  };
  // Guests are numbered by when they started.
  const guestNo = new Map(records.filter(r => !r.s.name?.value)
    .sort((a, b) => (startOf(a.s).started ?? a.at).localeCompare(startOf(b.s).started ?? b.at))
    .map((r, i) => [r, i + 1]));
  const inBank = new Set(bank.map(w => w.word));
  const asFriend = (s: State): Friend => ({
    name: s.name?.value ?? '', color: s.name?.color ?? null, used: s.used ?? {}, cheers: s.cheers ?? {}, notes: s.notes ?? {}, mine: false,
  });

  const wrong = new Map<string, number>(), right = new Map<string, number>();
  const known = new Map<string, number>(), rejected = new Map<string, number>(), usedCount = new Map<string, number>();
  for (const { s } of records) {
    for (const [w, c] of Object.entries(s.cards)) { bump(wrong, w, c.wrong); bump(right, w, c.right); }
    for (const w of Object.keys(s.known)) bump(known, w);
    for (const w of Object.keys(s.rejected)) bump(rejected, w);
  }

  const stories: Story[] = [];
  const people = records.map((r): Person => {
    const { at, s } = r;
    const f = asFriend(s);
    if (!f.name) f.name = `Guest ${guestNo.get(r)}`;
    const all = uses([f]);
    for (const u of all) {
      bump(usedCount, u.word);
      if (u.note) stories.push({ name: f.name, word: u.word, date: u.date, text: u.note });
    }
    const graded = Object.values(s.cards).reduce((a, c) => ({ r: a.r + c.right, w: a.w + c.wrong }), { r: 0, w: 0 });
    const left = bank.filter(w => !s.cards[w.word] && !s.known[w.word] && !s.rejected[w.word]).length;
    const cheersReceived = named.reduce((n, o) => n + Object.keys(o.s.cheers ?? {})
      .reduce((m, d) => m + on(o.s.cheers, d).filter(k => k.startsWith(`${f.name}:`)).length, 0), 0);
    const byDay = minutesByDay(s);
    const week = new Set(Array.from({ length: 7 }, (_, i) => addDays(date, -i)));
    return {
      minutes: Object.values(byDay).reduce((a, n) => a + n, 0),
      minutesWeek: Object.entries(byDay).filter(([d]) => week.has(d)).reduce((a, [, n]) => a + n, 0),
      byDay,
      pages: pageUse(s),
      ...startOf(s),
      guest: !s.name?.value,
      id: r.id,
      archived: r.archived,
      name: f.name,
      color: f.color,
      lastSeen: at,
      streak: streak(s, date),
      practised: Object.keys(s.done).length,
      dealt: Object.keys(s.days).length,
      learned: Object.keys(s.cards).filter(w => inBank.has(w)).length,
      strong: Object.values(s.cards).filter(c => c.level >= 5).length,
      accuracy: graded.r + graded.w ? graded.r / (graded.r + graded.w) : null,
      used: all.length,
      stories: all.filter(u => u.note).length,
      cheersGiven: Object.keys(s.cheers ?? {}).reduce((n, d) => n + on(s.cheers, d).length, 0),
      cheersReceived,
      left,
      runsOut: left ? addDays(date, Math.ceil(left / PER_DAY)) : date,
    };
  }).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));

  const weekAgo = Date.now() - 7 * 864e5;
  return {
    people,
    guests: records.filter(r => !r.s.name?.value && !r.archived).length,
    activeWeek: people.filter(p => !p.guest && Date.parse(p.lastSeen) > weekAgo).length,
    hardest: top(wrong, 8, w => `${right.get(w) ?? 0} right`),
    known: top(known),
    rejected: top(rejected),
    mostUsed: top(usedCount),
    stories: stories.sort((a, b) => b.date.localeCompare(a.date)),
    pages: [...people.flatMap(p => p.pages).reduce((m, u) => {
      const t = m.get(u.page) ?? { page: u.page, minutes: 0, visits: 0 };
      m.set(u.page, { page: u.page, minutes: t.minutes + u.minutes, visits: t.visits + u.visits });
      return m;
    }, new Map<PageUse['page'], PageUse>()).values()].sort(byUse),
  };
}
