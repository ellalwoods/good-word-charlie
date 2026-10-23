import { addDays } from './dates';
import { newCard } from './srs';
import type { State, Word } from './types';

export const PER_DAY = 3;

/** Words this person hasn't met, known or rejected, in bank order. */
export function unseen(state: State, bank: Word[]): Word[] {
  return bank.filter(w => !state.cards[w.word] && !state.known[w.word] && !state.rejected[w.word]);
}

function withCards(state: State, date: string, words: string[]): State {
  const cards = { ...state.cards };
  for (const w of words) cards[w] = newCard(date);
  return { ...state, cards };
}

/**
 * Makes sure today has its three new words. Tops up a short day too, so
 * words added in a later deploy arrive the same day they're published.
 */
export function ensureToday(state: State, bank: Word[], date: string): State {
  const list = state.days[date] ?? [];
  if (list.length >= PER_DAY) return state;
  const add = unseen(state, bank).slice(0, PER_DAY - list.length).map(w => w.word);
  if (!add.length && state.days[date]) return state;
  return { ...withCards(state, date, add), days: { ...state.days, [date]: [...list, ...add] } };
}

/** "Already know it" or "Not for me": out of practice for good, replaced by the next word. */
export function dismiss(state: State, bank: Word[], word: string, reason: 'known' | 'rejected', date: string): State {
  const cards = { ...state.cards };
  delete cards[word];
  const next: State = {
    ...state,
    cards,
    [reason]: { ...state[reason], [word]: true },
    days: { ...state.days, [date]: (state.days[date] ?? []).filter(w => w !== word) },
  };
  return ensureToday(next, bank, date);
}

/** A new card can still be dismissed until it has been answered once. */
export function canDismiss(state: State, word: string): boolean {
  const c = state.cards[word];
  return !!c && c.right + c.wrong === 0;
}

export function dueWords(state: State, bank: Word[], date: string): string[] {
  const inBank = new Set(bank.map(w => w.word));
  return Object.keys(state.cards).filter(w => inBank.has(w) && state.cards[w].due <= date);
}

/** Consecutive days with a finished session, counting back from today (or yesterday if today isn't done yet). */
export function streak(state: State, date: string): number {
  let d = state.done[date] ? date : addDays(date, -1);
  let n = 0;
  while (state.done[d]) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
