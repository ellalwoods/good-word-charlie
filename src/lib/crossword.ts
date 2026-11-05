import { seeded } from './games';
import type { State, Word } from './types';

/** The crossword opens once someone has learned this many words. */
export const CROSSWORD_UNLOCK = 30;
const TARGET = 7, MIN = 6, MAX_SIDE = 11, ATTEMPTS = 60;

export interface Entry { word: Word; num: number; dir: 'across' | 'down'; y: number; x: number }
export interface Crossword { rows: number; cols: number; entries: Entry[] }

/** Words learned so far (met in practice), in bank order. */
export const learnedWords = (s: State, bank: Word[]) => bank.filter(w => s.cards[w.word]);

export const crosswordUnlocked = (s: State, bank: Word[]) => learnedWords(s, bank).length >= CROSSWORD_UNLOCK;

/** Every square of an entry, as "row,col". */
export const squares = (e: Pick<Entry, 'word' | 'dir' | 'y' | 'x'>) =>
  Array.from({ length: e.word.word.length }, (_, k) => `${e.y + (e.dir === 'down' ? k : 0)},${e.x + (e.dir === 'across' ? k : 0)}`);

const shuffle = <T,>(a: T[], rand: () => number): T[] => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

/**
 * Today's criss-cross from someone's own words: 6 or 7 of them, crossing where they
 * share a letter, never touching side by side, at most 11 squares each way so it
 * fits a phone. The same words and date always give the same puzzle. If one
 * arrangement won't come together, it tries the next, up to 60 times.
 */
export function buildCrossword(words: Word[], seed: string): Crossword | null {
  const usable = words.filter(w => /^[a-z]{4,10}$/.test(w.word));
  if (usable.length < MIN) return null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const rand = seeded(`${seed}:${attempt}`);
    const pool = shuffle(usable, rand);
    const cells = new Map<string, { ch: string; dirs: Set<string> }>();
    const placed: Omit<Entry, 'num'>[] = [];
    const key = (y: number, x: number) => `${y},${x}`;
    const fits = (w: string, y0: number, x0: number, dir: Entry['dir']) => {
      const dy = dir === 'down' ? 1 : 0, dx = dir === 'across' ? 1 : 0;
      if (cells.has(key(y0 - dy, x0 - dx)) || cells.has(key(y0 + dy * w.length, x0 + dx * w.length))) return -1;
      let cross = 0;
      for (let k = 0; k < w.length; k++) {
        const y = y0 + dy * k, x = x0 + dx * k, c = cells.get(key(y, x));
        if (c) { if (c.ch !== w[k] || c.dirs.has(dir)) return -1; cross++; }
        else if (cells.has(key(y + dx, x + dy)) || cells.has(key(y - dx, x - dy))) return -1;
      }
      return cross;
    };
    const put = (word: Word, y: number, x: number, dir: Entry['dir']) => {
      for (const sq of squares({ word, dir, y, x })) {
        const [yy, xx] = sq.split(',').map(Number);
        const c = cells.get(sq) ?? { ch: word.word[dir === 'across' ? xx - x : yy - y], dirs: new Set<string>() };
        c.dirs.add(dir); cells.set(sq, c);
      }
      placed.push({ word, y, x, dir });
    };
    const span = (extraY: number[], extraX: number[]) => {
      const ys = [...cells.keys()].map(k => +k.split(',')[0]).concat(extraY), xs = [...cells.keys()].map(k => +k.split(',')[1]).concat(extraX);
      return Math.max(Math.max(...ys) - Math.min(...ys), Math.max(...xs) - Math.min(...xs)) + 1;
    };
    put(pool[0], 0, 0, 'across');
    for (const word of pool.slice(1)) {
      if (placed.length >= TARGET) break;
      const w = word.word;
      const opts: { y: number; x: number; dir: Entry['dir']; n: number; t: number }[] = [];
      for (const [k, c] of cells) {
        const [y, x] = k.split(',').map(Number);
        for (let i = 0; i < w.length; i++) {
          if (w[i] !== c.ch) continue;
          for (const dir of ['across', 'down'] as const) {
            if (c.dirs.has(dir)) continue;
            const y0 = dir === 'down' ? y - i : y, x0 = dir === 'across' ? x - i : x;
            const n = fits(w, y0, x0, dir);
            if (n > 0) opts.push({ y: y0, x: x0, dir, n, t: rand() });
          }
        }
      }
      opts.sort((a, b) => b.n - a.n || a.t - b.t);
      const o = opts.find(o => {
        const endY = o.y + (o.dir === 'down' ? w.length - 1 : 0), endX = o.x + (o.dir === 'across' ? w.length - 1 : 0);
        return span([o.y, endY], [o.x, endX]) <= MAX_SIDE;
      });
      if (o) put(word, o.y, o.x, o.dir);
    }
    if (placed.length < MIN) continue;
    // Crop to the words and number them the usual way: left to right, top to bottom.
    const ys = placed.flatMap(p => [p.y, p.y + (p.dir === 'down' ? p.word.word.length - 1 : 0)]);
    const xs = placed.flatMap(p => [p.x, p.x + (p.dir === 'across' ? p.word.word.length - 1 : 0)]);
    const top = Math.min(...ys), left = Math.min(...xs);
    const moved = placed.map(p => ({ ...p, y: p.y - top, x: p.x - left }));
    const starts = [...new Set(moved.map(e => `${e.y},${e.x}`))]
      .sort((a, b) => { const [ay, ax] = a.split(',').map(Number), [by, bx] = b.split(',').map(Number); return ay - by || ax - bx; });
    return {
      rows: Math.max(...ys) - top + 1,
      cols: Math.max(...xs) - left + 1,
      entries: moved.map(e => ({ ...e, num: starts.indexOf(`${e.y},${e.x}`) + 1 })),
    };
  }
  return null;
}

/** Today's crossword for this person: their own learned words, the same all day. */
export const dailyCrossword = (s: State, bank: Word[], date: string, who: string) =>
  buildCrossword(learnedWords(s, bank), `crossword:${who}:${date}`);
