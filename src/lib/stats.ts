import { PER_DAY, streak } from './daily';
import { addDays } from './dates';
import { on, uses, type Friend } from './friends';
import { normalise } from './merge';
import type { State, Word } from './types';

/** One record as the owner's stats function returns it. */
export interface Row { updated_at: string; data: unknown }

export interface Person {
  name: string;
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
}

export interface Tally { word: string; n: number; extra?: string }
export interface Story { name: string; word: string; date: string; text: string }

export interface Stats {
  people: Person[];
  guests: number;            // records with no name
  activeWeek: number;
  hardest: Tally[];
  known: Tally[];
  rejected: Tally[];
  mostUsed: Tally[];
  stories: Story[];
}

const top = (counts: Map<string, number>, n = 8, extra?: (w: string) => string): Tally[] =>
  [...counts].filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n)
    .map(([word, c]) => ({ word, n: c, extra: extra?.(word) }));

const bump = (m: Map<string, number>, k: string, by = 1) => m.set(k, (m.get(k) ?? 0) + by);

export function computeStats(rows: Row[], bank: Word[], date: string): Stats {
  const records = rows.map(r => ({ at: r.updated_at, s: normalise(r.data) as State }));
  const named = records.filter(r => r.s.name?.value);
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
  const people = named.map(({ at, s }): Person => {
    const f = asFriend(s);
    const all = uses([f]);
    for (const u of all) {
      bump(usedCount, u.word);
      if (u.note) stories.push({ name: f.name, word: u.word, date: u.date, text: u.note });
    }
    const graded = Object.values(s.cards).reduce((a, c) => ({ r: a.r + c.right, w: a.w + c.wrong }), { r: 0, w: 0 });
    const left = bank.filter(w => !s.cards[w.word] && !s.known[w.word] && !s.rejected[w.word]).length;
    const cheersReceived = named.reduce((n, o) => n + Object.keys(o.s.cheers ?? {})
      .reduce((m, d) => m + on(o.s.cheers, d).filter(k => k.startsWith(`${f.name}:`)).length, 0), 0);
    return {
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
    guests: records.length - named.length,
    activeWeek: people.filter(p => Date.parse(p.lastSeen) > weekAgo).length,
    hardest: top(wrong, 8, w => `${right.get(w) ?? 0} right`),
    known: top(known),
    rejected: top(rejected),
    mostUsed: top(usedCount),
    stories: stories.sort((a, b) => b.date.localeCompare(a.date)),
  };
}
