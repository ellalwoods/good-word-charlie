import type { Friend } from './friends';
import type { State, Word } from './types';

export type GameId = 'wordle' | 'fuse' | 'gravity';
export const GAME_IDS: GameId[] = ['wordle', 'fuse', 'gravity'];

/** One go at a game. `score` is what the leaderboard ranks by. */
export interface GameResult {
  at: number;        // when it was played
  score: number;     // Good Wordle: guesses used (7 if not solved); The Fuse and Gravity: points
  level?: number;    // Gravity: the level reached
  answered?: number; // The Fuse: questions answered
}

/** Good Wordle ranks fewest guesses first; the others most points first. */
export const lowWins = (g: GameId) => g === 'wordle';

/** Today's result for a game, if it's been played (each game is once a day). */
export const playedToday = (s: State, game: GameId, date: string): GameResult | undefined => s.games?.[date]?.[game];

export function saveResult(s: State, game: GameId, date: string, result: GameResult): State {
  if (playedToday(s, game, date)) return s;
  return { ...s, games: { ...s.games, [date]: { ...s.games?.[date], [game]: result } } };
}

// A small, stable hash, so a date always picks the same word for everyone.
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** A random-number source that gives the same sequence for the same seed. */
export function seeded(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Good Wordle ----------

export const WORDLE_TRIES = 6;

/** Words that can be the answer: plain letters, 5 or 6 long (shorter words make a fairer puzzle). */
export const wordleWords = (bank: Word[]) => bank.filter(w => /^[a-z]{5,6}$/.test(w.word));

/** Today's word: the same for everyone, from the whole bank. */
export function dailyWordle(bank: Word[], date: string): Word {
  const pool = wordleWords(bank);
  return pool[hash(`wordle:${date}`) % pool.length];
}

/** Colours for a guess: g (right place), y (in the word, wrong place), x (not in it). Repeated letters count properly. */
export function markGuess(guess: string, answer: string): ('g' | 'y' | 'x')[] {
  const res: ('g' | 'y' | 'x')[] = Array(guess.length).fill('x');
  const left: Record<string, number> = {};
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) res[i] = 'g';
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (res[i] !== 'g' && left[guess[i]]) { res[i] = 'y'; left[guess[i]]--; }
  }
  return res;
}

// ---------- Questions for The Fuse and Gravity ----------

/** Words this person has met (in practice, or marked as known). */
export function metWords(s: State, bank: Word[]): Word[] {
  return bank.filter(w => s.cards[w.word] || s.known[w.word]);
}

export interface Choice { word: Word; prompt: string; kind: 'meaning' | 'word'; answer: string; options: string[] }

const shuffle = <T,>(a: T[], rand: () => number): T[] => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

/**
 * A three-option question about one word from `from`. Wrong options come from `wrongFrom`
 * (the same words the question is drawn from, so a word you've never met can't give the
 * answer away), never share a meaning group with the word, and match its part of speech
 * where there are enough to choose from.
 */
export function choiceQuestion(
  from: Word[], bank: Word[], rand: () => number, kind?: 'meaning' | 'word', avoid: string[] = [], wrongFrom: Word[] = from,
): Choice {
  const pool = from.filter(w => !avoid.includes(w.word));
  const word = (pool.length ? pool : from)[Math.floor(rand() * (pool.length || from.length))];
  const groups = new Set(word.groups ?? []);
  const fits = (w: Word) => w.word !== word.word && !(w.groups ?? []).some(g => groups.has(g));
  const samePos = wrongFrom.filter(w => fits(w) && w.pos === word.pos);
  const anyPos = wrongFrom.filter(fits);
  const candidates = samePos.length >= 2 ? samePos : anyPos.length >= 2 ? anyPos : bank.filter(w => fits(w) && w.pos === word.pos);
  const others = shuffle(candidates, rand).slice(0, 2);
  const k = kind ?? (rand() < 0.5 ? 'meaning' : 'word');
  return k === 'meaning'
    ? { word, kind: k, prompt: word.word, answer: word.testDefinition, options: shuffle([word, ...others].map(w => w.testDefinition), rand) }
    : { word, kind: k, prompt: word.testDefinition, answer: word.word, options: shuffle([word, ...others].map(w => w.word), rand) };
}

// ---------- The Fuse ----------

export const FUSE_START = 30;      // seconds of fuse
export const FUSE_MAX = 30;
/** Each bet: points multiplier, fuse added when right, fuse burned when wrong. */
export const BETS = { 1: { add: 2, burn: 2 }, 2: { add: 3, burn: 4 }, 3: { add: 4, burn: 7 } } as const;
export type Bet = keyof typeof BETS;
/** Once you pass this many points, questions come from the whole bank, not just your words. */
export const FUSE_BEYOND = 200;

/** Points for a right answer: 10 × bet, and worth one step more for every five questions answered. */
export const fusePoints = (bet: Bet, answeredBefore: number) => 10 * bet * (1 + Math.floor(answeredBefore / 5));

/** Where The Fuse's next word comes from: your words until FUSE_BEYOND points (or if you've met too few). */
export const fuseSource = (s: State, bank: Word[], score: number): { words: Word[]; beyond: boolean } => {
  const mine = metWords(s, bank);
  const beyond = score >= FUSE_BEYOND || mine.length < 4;
  return { words: beyond ? bank : mine, beyond };
};

// ---------- Gravity ----------

export const GRAVITY_LIVES = 3;
export const GRAVITY_PER_LEVEL = 5;   // words cleared per level
/** From this level on, words come from the whole bank, and the speed resets to an easier pace. */
export const GRAVITY_BEYOND = 5;
export const GRAVITY_LANES = 3;

/**
 * How fast cards fall, as a share of the sky's height per second. It climbs quickly to
 * level 5, then drops back to level 3's pace and climbs gently from there.
 */
export function gravitySpeed(level: number): number {
  const early = [0, 0.08, 0.11, 0.15, 0.2, 0.26];
  if (level < GRAVITY_BEYOND) return early[Math.max(1, level)];
  return early[3] + (level - GRAVITY_BEYOND) * 0.012;
}

/** How many cards can be falling at once. */
export const gravityMaxFalling = (level: number) => Math.min(GRAVITY_LANES, level >= GRAVITY_BEYOND ? 2 + Math.floor((level - GRAVITY_BEYOND) / 3) : 1 + Math.floor(level / 2));

/** Points for clearing a card: 10 per level, plus up to 10 more the higher up it was (0 = top, 1 = ground). */
export const gravityPoints = (level: number, depth: number) => 10 * level + Math.round(10 * (1 - Math.min(1, Math.max(0, depth))));

/** Gravity's words: yours below level 5, the whole bank from then on. */
export const gravitySource = (s: State, bank: Word[], level: number) => {
  const mine = metWords(s, bank);
  return level >= GRAVITY_BEYOND || mine.length < 4 ? bank : mine;
};

// ---------- Leaderboards ----------

export interface Standing { name: string; color: string | null; mine: boolean; result: GameResult; rank: number }

/** Today's leaderboard for a game: everyone who's played it today, best first; ties share a rank. */
export function leaderboard(game: GameId, date: string, friends: Friend[], me: { name: string; color: string | null; result?: GameResult }): Standing[] {
  const rows: Omit<Standing, 'rank'>[] = friends
    .filter(f => !f.mine && f.games?.[date]?.[game])
    .map(f => ({ name: f.name, color: f.color, mine: false, result: f.games![date][game]! }));
  if (me.result) rows.push({ name: me.name || 'You', color: me.color, mine: true, result: me.result });
  const better = (a: GameResult, b: GameResult) => (lowWins(game) ? a.score - b.score : b.score - a.score);
  rows.sort((a, b) => better(a.result, b.result) || a.result.at - b.result.at);
  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || better(rows[i - 1].result, r.result) !== 0) rank = i + 1;
    return { ...r, rank };
  });
}
