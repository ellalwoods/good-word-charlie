import { describe, expect, it } from 'vitest';
import words from '../data/words.json';
import { ensureToday } from './daily';
import type { Friend } from './friends';
import {
  dailyWordle, FUSE_BEYOND, fusePoints, fuseSource, GRAVITY_BEYOND, gravityPoints, gravitySource, gravitySpeed, leaderboard, markGuess,
  metWords, saveResult, wordleWords,
} from './games';
import { merge } from './merge';
import { fresh } from './storage';
import type { Word } from './types';

const bank = words as Word[];
const D = '2026-10-29';
const friend = (name: string, games: Friend['games']): Friend => ({ name, color: 'pink', used: {}, cheers: {}, notes: {}, mine: false, games });

describe('Good Wordle', () => {
  it('gives everyone the same word each day, from the whole bank', () => {
    expect(dailyWordle(bank, D).word).toBe(dailyWordle(bank, D).word);
    expect(wordleWords(bank).map(w => w.word)).toContain(dailyWordle(bank, D).word);
    const week = new Set(Array.from({ length: 7 }, (_, i) => dailyWordle(bank, `2026-11-0${i + 1}`).word));
    expect(week.size).toBeGreaterThan(4);
  });

  it('colours repeated letters the way Wordle does', () => {
    expect(markGuess('lolly', 'hello')).toEqual(['x', 'y', 'g', 'g', 'x']);   // both l's already placed
    expect(markGuess('hello', 'hello')).toEqual(['g', 'g', 'g', 'g', 'g']);
    expect(markGuess('eerie', 'tease')).toEqual(['x', 'g', 'x', 'x', 'g']);   // only two e's to find
    expect(markGuess('stare', 'tease')).toEqual(['y', 'y', 'g', 'x', 'g']);
  });

  it('ranks by fewest guesses only; equal guesses share a place', () => {
    const rows = leaderboard('wordle', D, [
      friend('Charlie', { [D]: { wordle: { at: 2, score: 4 } } }),
      friend('Jackson', { [D]: { wordle: { at: 1, score: 3 } } }),
      friend('Sam', { [D]: { wordle: { at: 3, score: 7 } } }),
      friend('Lou', {}),
    ], { name: 'Ella', color: 'violet', result: { at: 9, score: 4 } });
    expect(rows.map(r => [r.name, r.rank])).toEqual([['Jackson', 1], ['Charlie', 2], ['Ella', 2], ['Sam', 4]]);
  });
});

describe('once a day', () => {
  it('keeps the first go, on one device or two', () => {
    const first = saveResult(fresh(), 'fuse', D, { at: 1, score: 120 });
    expect(saveResult(first, 'fuse', D, { at: 2, score: 900 }).games?.[D]?.fuse?.score).toBe(120);
    const laptop = saveResult(fresh(), 'fuse', D, { at: 5, score: 50 });
    expect(merge(first, laptop).games?.[D]?.fuse?.score).toBe(120);
    expect(merge(laptop, first).games?.[D]?.fuse?.score).toBe(120);
  });
});

describe('The Fuse', () => {
  it('uses your words until 200 points, then the whole bank', () => {
    let s = fresh();
    for (const d of ['2026-10-26', '2026-10-27', '2026-10-28']) s = ensureToday(s, bank, d);
    expect(metWords(s, bank)).toHaveLength(9);
    expect(fuseSource(s, bank, FUSE_BEYOND - 1)).toMatchObject({ beyond: false });
    expect(fuseSource(s, bank, FUSE_BEYOND - 1).words).toHaveLength(9);
    expect(fuseSource(s, bank, FUSE_BEYOND)).toMatchObject({ beyond: true, words: bank });
  });

  it('scores 10 × bet, one step more every five questions', () => {
    expect([fusePoints(1, 0), fusePoints(3, 0), fusePoints(2, 5), fusePoints(3, 10)]).toEqual([10, 30, 40, 90]);
  });
});

describe('Gravity', () => {
  it('speeds up quickly to level 5, then drops back to level 3’s pace and climbs gently', () => {
    const early = [1, 2, 3, 4].map(gravitySpeed);
    expect(early.every((v, i) => i === 0 || v > early[i - 1])).toBe(true);
    expect(gravitySpeed(GRAVITY_BEYOND)).toBe(gravitySpeed(3));
    const after = gravitySpeed(GRAVITY_BEYOND + 1) - gravitySpeed(GRAVITY_BEYOND);
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(gravitySpeed(4) - gravitySpeed(3));
  });

  it('uses your words below level 5 and the whole bank from then on', () => {
    let s = fresh();
    for (const d of ['2026-10-27', '2026-10-28']) s = ensureToday(s, bank, d);
    expect(gravitySource(s, bank, GRAVITY_BEYOND - 1)).toHaveLength(6);
    expect(gravitySource(s, bank, GRAVITY_BEYOND)).toBe(bank);
  });

  it('scores 10 per level plus up to 10 for catching it high', () => {
    expect([gravityPoints(1, 0), gravityPoints(1, 1), gravityPoints(3, 0.5)]).toEqual([20, 10, 35]);
  });
});
