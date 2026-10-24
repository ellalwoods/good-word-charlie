import type { State } from './types';

/** date -> key -> when it was tapped (negative once untapped). */
export type Stamps = Record<string, Record<string, number>>;

/** Someone on the site who has picked a name: what they used, and whose words they celebrated. */
export interface Friend {
  name: string;
  color: string | null;
  used: Stamps;
  cheers: Stamps;   // keyed "name:word"
  mine: boolean;
}

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
export const markCheer = (s: State, name: string, word: string, date: string, yes: boolean) =>
  stamp(s, 'cheers', cheerKey(name, word), date, yes);

/** Who celebrated `name` using `word` on a date. */
export function celebrators(friends: Friend[], name: string, word: string, date: string): Friend[] {
  return friends.filter(f => f.name !== name && on(f.cheers, date).includes(cheerKey(name, word)));
}

/**
 * Things to tell you about on a date, as ids for the unseen count:
 * friends using a word, and friends celebrating one of yours.
 */
export function news(friends: Friend[], date: string): string[] {
  const me = friends.find(f => f.mine);
  return friends.filter(f => !f.mine).flatMap(f => [
    ...on(f.used, date).map(w => `use:${f.name}:${w}`),
    ...(me ? on(f.cheers, date).filter(k => k.startsWith(`${me.name}:`)).map(k => `cheer:${f.name}:${k}`) : []),
  ]);
}
