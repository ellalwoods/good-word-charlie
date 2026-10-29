import type { State } from './types';

/** date -> key -> when it was tapped (negative once untapped). */
export type Stamps = Record<string, Record<string, number>>;
/** date -> word -> the story of how it was used. */
export type Notes = Record<string, Record<string, { text: string; at: number }>>;

/** Someone on the site who has picked a name: what they used, and whose words they celebrated. */
export interface Friend {
  name: string;
  color: string | null;
  used: Stamps;     // keyed by the day it was used
  cheers: Stamps;   // keyed by the day the word was used, then "name:word"
  notes: Notes;
  mine: boolean;
  learned?: number;   // words met and still in practice
  done?: string[];    // days a practice was finished
  games?: State['games'];   // each day's game results, for the leaderboards
}

/** One word one person used, as shown on the Friends page. */
export interface Use { friend: Friend; word: string; date: string; at: number; note: string }

/** A use stays on the Friends page this long, then moves to the archive. */
export const FRESH_FOR = 24 * 60 * 60 * 1000;

export const COLORS = ['pink', 'yellow', 'blue', 'green', 'orange', 'violet'] as const;
export const colorOf = (c: string | null | undefined) => (COLORS as readonly string[]).includes(c ?? '') ? c! : 'pink';

export const nameOf = (s: State) => s.name?.value ?? '';

export function setProfile(s: State, value: string, color: string): State {
  return { ...s, name: { value: value.trim().slice(0, 30), color, at: Date.now() } };
}

/** Keys tapped on a date and not untapped since. */
export function on(stamps: Stamps | undefined, date: string): string[] {
  return Object.entries(stamps?.[date] ?? {}).filter(([, t]) => t > 0).map(([k]) => k);
}

export const usedOn = (used: Stamps | undefined, date: string) => on(used, date);

function stamp(s: State, field: 'used' | 'cheers', key: string, date: string, yes: boolean): State {
  const day = { ...s[field]?.[date], [key]: yes ? Date.now() : -Date.now() };
  return { ...s, [field]: { ...s[field], [date]: day } };
}

export const markUsed = (s: State, word: string, date: string, yes: boolean) => stamp(s, 'used', word, date, yes);
export const cheerKey = (name: string, word: string) => `${name}:${word}`;
/** Celebrates `name` using `word` on `date` (the day they used it). */
export const markCheer = (s: State, name: string, word: string, date: string, yes: boolean) =>
  stamp(s, 'cheers', cheerKey(name, word), date, yes);

export const NOTE_MAX = 280;

export function setNote(s: State, word: string, date: string, text: string): State {
  const day = { ...s.notes?.[date], [word]: { text: text.trim().slice(0, NOTE_MAX), at: Date.now() } };
  return { ...s, notes: { ...s.notes, [date]: day } };
}

/** Everyone's uses, newest first. */
export function uses(friends: Friend[]): Use[] {
  return friends.flatMap(friend => Object.entries(friend.used ?? {}).flatMap(([date, words]) =>
    Object.entries(words).filter(([, at]) => at > 0)
      .map(([word, at]) => ({ friend, word, date, at, note: friend.notes?.[date]?.[word]?.text ?? '' }))))
    .sort((a, b) => b.at - a.at);
}

/** How many words someone has marked "I used it", all time. */
export const usedCount = (f: Friend) => uses([f]).length;

export const isFresh = (u: Use, now: number) => now - u.at < FRESH_FOR;

/** Who celebrated `name` using `word` on `date`. */
export function celebrators(friends: Friend[], name: string, word: string, date: string): Friend[] {
  return friends.filter(f => f.name !== name && on(f.cheers, date).includes(cheerKey(name, word)));
}

export const useId = (u: Use) => `use:${u.friend.name}:${u.date}:${u.word}`;

/**
 * Things to tell you about, as ids for the unseen count: friends using a word,
 * and friends celebrating one of yours, in the last 24 hours.
 */
export function news(friends: Friend[], now: number): string[] {
  const me = friends.find(f => f.mine);
  const recent = (t: number) => t > 0 && now - t < FRESH_FOR;
  return friends.filter(f => !f.mine).flatMap(f => [
    ...uses([f]).filter(u => isFresh(u, now)).map(useId),
    ...(me ? Object.entries(f.cheers ?? {}).flatMap(([date, keys]) => Object.entries(keys)
      .filter(([k, t]) => recent(t) && k.startsWith(`${me.name}:`))
      .map(([k]) => `cheer:${f.name}:${date}:${k}`)) : []),
  ]);
}

/**
 * One entry per name. Someone who joined on two devices without a shared sync
 * link has two records under the same name; show them as one person.
 */
export function combine(friends: Friend[]): Friend[] {
  const byName = new Map<string, Friend>();
  for (const f of friends) {
    const key = f.name.trim().toLowerCase();
    const g = byName.get(key);
    if (!g) { byName.set(key, f); continue; }
    byName.set(key, {
      name: g.mine ? g.name : f.name,
      color: g.mine ? g.color : f.mine ? f.color : g.color ?? f.color,
      used: joinStamps(g.used, f.used),
      cheers: joinStamps(g.cheers, f.cheers),
      notes: joinNotes(g.notes, f.notes),
      mine: g.mine || f.mine,
      learned: Math.max(g.learned ?? 0, f.learned ?? 0),
      done: [...new Set([...(g.done ?? []), ...(f.done ?? [])])],
      games: { ...f.games, ...g.games },
    });
  }
  return [...byName.values()];
}

function joinStamps(a: Stamps = {}, b: Stamps = {}): Stamps {
  const out: Stamps = {};
  for (const d of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[d] = { ...a[d] };
    for (const [k, t] of Object.entries(b[d] ?? {})) {
      const p = out[d][k];
      out[d][k] = p === undefined || Math.abs(t) > Math.abs(p) ? t : p;
    }
  }
  return out;
}

function joinNotes(a: Notes = {}, b: Notes = {}): Notes {
  const out: Notes = {};
  for (const d of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[d] = { ...a[d] };
    for (const [w, n] of Object.entries(b[d] ?? {})) if (!out[d][w] || n.at > out[d][w].at) out[d][w] = n;
  }
  return out;
}
