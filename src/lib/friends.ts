import type { State } from './types';

/** Someone on the site who has picked a name, and the words they've said they used. */
export interface Friend {
  name: string;
  used: Record<string, Record<string, number>>;
  mine: boolean;
}

export const nameOf = (s: State) => s.name?.value ?? '';

export function setName(s: State, value: string): State {
  return { ...s, name: { value: value.trim().slice(0, 30), at: Date.now() } };
}

/** Words marked "I used it" on a date. */
export function usedOn(used: State['used'], date: string): string[] {
  return Object.entries(used?.[date] ?? {}).filter(([, t]) => t > 0).map(([w]) => w);
}

export function markUsed(s: State, word: string, date: string, on: boolean): State {
  const day = { ...s.used?.[date], [word]: on ? Date.now() : -Date.now() };
  return { ...s, used: { ...s.used, [date]: day } };
}

/** Friends' uses on a date, as "name:word" ids, for the unseen count. */
export function friendUses(friends: Friend[], date: string): string[] {
  return friends.filter(f => !f.mine).flatMap(f => usedOn(f.used, date).map(w => `${f.name}:${w}`));
}
