import { addDays } from './dates';
import type { Card } from './types';

/** Days until the next review at each level, 0–6. */
export const INTERVALS = [0, 1, 3, 7, 14, 30, 60];
export const MAX_LEVEL = INTERVALS.length - 1;

export function newCard(date: string): Card {
  return { level: 0, due: date, right: 0, wrong: 0, asked: 0 };
}

/** First-try answer: right moves up a level, wrong drops to 0 and comes back tomorrow. */
export function grade(card: Card, correct: boolean, date: string): Card {
  if (correct) {
    const level = Math.min(card.level + 1, MAX_LEVEL);
    return { ...card, level, due: addDays(date, INTERVALS[level]), right: card.right + 1 };
  }
  return { ...card, level: 0, due: addDays(date, 1), wrong: card.wrong + 1 };
}
