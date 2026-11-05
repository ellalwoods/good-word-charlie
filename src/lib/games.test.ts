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

describe('answer options', () => {
  it('come only from your own words while the game uses your words', async () => {
    const { choiceQuestion, seeded } = await import('./games');
    let s = fresh();
    for (const d of ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28']) s = ensureToday(s, bank, d);
    const mine = metWords(s, bank), names = new Set(mine.map(w => w.word));
    const rand = seeded('t');
    for (let i = 0; i < 40; i++) {
      const q = choiceQuestion(mine, bank, rand, 'word');
      expect(q.options.every(o => names.has(o))).toBe(true);
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(3);
    }
  });
});

describe('new game countdown', () => {
  it('counts hours to midnight, then minutes in the last hour', async () => {
    const { untilNext } = await import('../views/Games');
    expect(untilNext(new Date(2026, 9, 29, 19, 0))).toBe('New game in 5 hours');
    expect(untilNext(new Date(2026, 9, 29, 22, 40))).toBe('New game in 1 hour');
    expect(untilNext(new Date(2026, 9, 29, 23, 15))).toBe('New game in 45 minutes');
    expect(untilNext(new Date(2026, 9, 29, 23, 59, 30))).toBe('New game in 1 minute');
  });
});

describe('resetting today’s games (testing)', () => {
  it('clears them on every device, without bringing old results back', async () => {
    const { resetGames } = await import('./games');
    const phone = saveResult(fresh(), 'wordle', D, { at: Date.now() - 1000, score: 4 });
    const laptop = phone;                                   // the laptop synced the result earlier
    const reset = resetGames(phone, D);
    expect(reset.games?.[D]).toBeUndefined();
    expect(merge(reset, laptop).games?.[D]).toBeUndefined();
    expect(merge(laptop, reset).games?.[D]).toBeUndefined();
    // A new go after the reset counts.
    const again = saveResult(merge(reset, laptop), 'wordle', D, { at: Date.now() + 1000, score: 3 });
    expect(merge(again, laptop).games?.[D]?.wordle?.score).toBe(3);
  });
});

describe('personal bests and the games card', () => {
  it('flags a new best only when it beats every earlier go (not on a first go)', async () => {
    const Y = '2026-10-28';
    let s = saveResult(fresh(), 'fuse', '2026-10-27', { at: 1, score: 200 });
    expect(s.games?.['2026-10-27']?.fuse?.best).toBeUndefined();          // first ever go
    s = saveResult(s, 'fuse', Y, { at: 2, score: 150 });
    expect(s.games?.[Y]?.fuse?.best).toBeUndefined();                      // worse
    s = saveResult(s, 'fuse', D, { at: 3, score: 250 });
    expect(s.games?.[D]?.fuse?.best).toBe(true);                           // better than both
    let w = saveResult(fresh(), 'wordle', Y, { at: 1, score: 4 });
    w = saveResult(w, 'wordle', D, { at: 2, score: 3 });
    expect(w.games?.[D]?.wordle?.best).toBe(true);                         // fewer guesses is better
    const x = saveResult(saveResult(fresh(), 'wordle', Y, { at: 1, score: 7 }), 'wordle', D, { at: 2, score: 7 });
    expect(x.games?.[D]?.wordle?.best).toBeUndefined();                    // not solved is never a best
  });

  it('only posts a card once all three games are done, timed by the last one', async () => {
    const { gamesCards, gamesHeadline } = await import('./games');
    const two = friend('Sam', { [D]: { wordle: { at: 1, score: 3 }, fuse: { at: 2, score: 90 } } });
    const three = friend('Charlie', { [D]: { wordle: { at: 1, score: 3 }, fuse: { at: 5, score: 90 }, gravity: { at: 3, score: 400, level: 6, best: true } } });
    const cards = gamesCards([two, three]);
    expect(cards.map(c => c.friend.name)).toEqual(['Charlie']);
    expect(cards[0].at).toBe(5);
    expect(gamesHeadline(cards[0], 'Charlie')).toBe('Charlie reached level 6 in Gravity, a new best!');
  });
});

describe('Crossword', () => {
  it('builds a working puzzle every day for a year, even from only 30 words', async () => {
    const { buildCrossword, squares } = await import('./crossword');
    for (const words of [bank.slice(0, 30), bank.slice(0, 120), bank.slice(380, 410)]) {
      for (let d = 0; d < 365; d++) {
        const date = new Date(Date.UTC(2026, 10, 1) + d * 864e5).toISOString().slice(0, 10);
        const p = buildCrossword(words, `crossword:test:${date}`);
        expect(p, date).not.toBeNull();
        expect(p!.entries.length).toBeGreaterThanOrEqual(6);
        expect(Math.max(p!.rows, p!.cols)).toBeLessThanOrEqual(11);
        // Where words cross, they agree; and every square belongs to the grid.
        const grid = new Map<string, string>();
        for (const e of p!.entries) squares(e).forEach((sq, k) => {
          if (grid.has(sq)) expect(grid.get(sq)).toBe(e.word.word[k]);
          grid.set(sq, e.word.word[k]);
          const [y, x] = sq.split(',').map(Number);
          expect(y >= 0 && x >= 0 && y < p!.rows && x < p!.cols).toBe(true);
        });
        expect(new Set(p!.entries.map(e => e.word.word)).size).toBe(p!.entries.length);
      }
    }
  });

  it('is the same puzzle all day, and only opens at 30 words', async () => {
    const { buildCrossword, crosswordUnlocked } = await import('./crossword');
    const a = buildCrossword(bank.slice(0, 40), 'crossword:Ella:2026-11-05');
    const b = buildCrossword(bank.slice(0, 40), 'crossword:Ella:2026-11-05');
    expect(a!.entries.map(e => e.word.word)).toEqual(b!.entries.map(e => e.word.word));
    let s = fresh();
    for (let i = 0; i < 9; i++) s = ensureToday(s, bank, `2026-10-${String(10 + i).padStart(2, '0')}`);
    expect(crosswordUnlocked(s, bank)).toBe(false);   // 27 words
    s = ensureToday(s, bank, '2026-10-19');
    expect(crosswordUnlocked(s, bank)).toBe(true);    // 30
  });
});

describe('leaving a game half-way', () => {
  it('keeps the latest progress across devices, and drops it once the game is finished', async () => {
    const { saveProgress, savedProgress } = await import('./games');
    const phone = saveProgress(fresh(), 'fuse', D, { fuse: 12, score: 80 });
    expect(savedProgress(phone, 'fuse', D)).toEqual({ fuse: 12, score: 80 });
    await new Promise(r => setTimeout(r, 5));
    const later = saveProgress(phone, 'fuse', D, { fuse: 9, score: 120 });
    expect(savedProgress(merge(phone, later), 'fuse', D)).toEqual({ fuse: 9, score: 120 });
    expect(savedProgress(merge(later, phone), 'fuse', D)).toEqual({ fuse: 9, score: 120 });
    const finished = saveResult(later, 'fuse', D, { at: Date.now(), score: 150 });
    expect(savedProgress(finished, 'fuse', D)).toBeUndefined();
    // A device that still had the half-way save can't bring it back.
    expect(savedProgress(merge(finished, later), 'fuse', D)).toBeUndefined();
    expect(saveProgress(finished, 'fuse', D, { fuse: 30 })).toBe(finished);
  });
});
