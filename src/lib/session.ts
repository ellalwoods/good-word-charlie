import { dueWords } from './daily';
import { grade } from './srs';
import type { Question, QuestionType, State, Word } from './types';

export type Rand = () => number;

export function shuffle<T>(items: T[], rand: Rand = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Questions per word in a session: today's new words get three, reviews a quick check of two. */
export const NEW_QUESTIONS = 3;
export const REVIEW_QUESTIONS = 2;
/** Today's practice never asks more than this, retries included. Reviews that don't fit wait for tomorrow. */
export const DAILY_MAX = 21;
/** The most different questions one word can get in a session (its pool, less the pair that clash). */
export const MAX_PER_WORD = 6;

// Easier types first, so a word's first questions start gently.
const RANK: Record<QuestionType, number> = {
  'pick-meaning': 0, synonym: 1, 'pick-word': 2, gap: 3, rewrite: 4, usage: 5, confusable: 6,
};

export function pool(word: Word): Question[] {
  return word.questions.map((q, i) => ({ q, i })).sort((a, b) => RANK[a.q.type] - RANK[b.q.type] || a.i - b.i).map(x => x.q);
}

// Both use the word's test definition, so asking them together would give one away.
const clash = (a: Question, b: Question) =>
  (a.type === 'pick-meaning' && b.type === 'pick-word') || (a.type === 'pick-word' && b.type === 'pick-meaning');

/**
 * Up to `count` different questions for a word, starting at the nth in its pool and
 * rotating, so each day picks up where the last left off. Skips anything in `used`.
 */
export function questionsFor(word: Word, n: number, count: number, used: Question[] = []): Question[] {
  const p = pool(word);
  const out: Question[] = [];
  for (let i = 0; i < p.length && out.length < count; i++) {
    const q = p[(n + i) % p.length];
    if (used.includes(q) || [...used, ...out].some(u => clash(u, q))) continue;
    out.push(q);
  }
  return out;
}

/** Kept for callers that want a single question. */
export function questionFor(word: Word, n: number): Question {
  const p = pool(word);
  return p[n % p.length];
}

export interface Item {
  word: string;
  question: Question;
  options: string[];
  retry: boolean;   // an end-of-session repeat after a wrong answer; doesn't change the level
}

export interface Progress {
  left: number;        // first-attempt questions still to answer
  failed: boolean;     // any first-attempt question wrong
}

export type SessionKind = 'daily' | 'redo' | 'shuffle';

export interface Session {
  kind: SessionKind;    // only 'daily' changes levels and review dates
  items: Item[];
  i: number;
  total: number;        // words in the session
  firstRight: number;   // words with every question right first time
  questionsRight: number;   // first-attempt questions answered correctly
  questionsAsked: number;   // first-attempt questions in the session
  missed: string[];
  words: Record<string, Progress>;
}

function item(word: Word, question: Question, retry: boolean, rand: Rand): Item {
  return { word: word.word, question, options: shuffle([question.answer, ...question.distractors], rand), retry };
}

/**
 * Today's practice: the day's new words first, then the most overdue reviews that
 * still fit in DAILY_MAX questions. The rest stay due and come round tomorrow.
 */
export function dailyPlan(state: State, bank: Word[], date: string): [string, number][] {
  const due = dueWords(state, bank, date);
  const todays = new Set(state.days[date] ?? []);
  const plan: [string, number][] = (state.days[date] ?? []).filter(w => due.includes(w)).map(w => [w, NEW_QUESTIONS]);
  let left = DAILY_MAX - plan.length * NEW_QUESTIONS;
  const reviews = due.filter(w => !todays.has(w))
    .sort((a, b) => state.cards[a].due.localeCompare(state.cards[b].due) || state.cards[a].level - state.cards[b].level || a.localeCompare(b));
  for (const w of reviews) {
    if (left < REVIEW_QUESTIONS) break;
    plan.push([w, REVIEW_QUESTIONS]);
    left -= REVIEW_QUESTIONS;
  }
  return plan;
}

/** How many words and questions today's practice would ask. */
export function sessionSize(state: State, bank: Word[], date: string): { words: number; questions: number } {
  const plan = dailyPlan(state, bank, date);
  return { words: plan.length, questions: plan.reduce((n, [, q]) => n + q, 0) };
}

/**
 * Builds a session from words and how many questions each gets, dealt round by round
 * so the same word's questions are spread out rather than back to back.
 */
function deal(kind: SessionKind, state: State, bank: Word[], plan: [string, number][], rand: Rand): Session {
  const byWord = new Map(bank.map(w => [w.word, w]));
  const lists = plan.map(([w, count]) => {
    const word = byWord.get(w)!;
    return questionsFor(word, state.cards[w]?.asked ?? 0, count).map(q => item(word, q, false, rand));
  });
  const items: Item[] = [];
  for (let round = 0; lists.some(l => l.length > round); round++) {
    for (const l of shuffle(lists.filter(l => l.length > round), rand)) items.push(l[round]);
  }
  const words = Object.fromEntries(lists.map((l, k) => [plan[k][0], { left: l.length, failed: false }]));
  return { kind, items, i: 0, total: plan.length, firstRight: 0, questionsRight: 0, questionsAsked: items.length, missed: [], words };
}

/** Today's practice: new words get three questions each and reviews two, 21 at most. Changes levels. */
export function startSession(state: State, bank: Word[], date: string, rand: Rand = Math.random): Session {
  const plan = dailyPlan(state, bank, date);
  const isNew = new Set(state.days[date] ?? []);
  const order = [...plan.filter(([w]) => isNew.has(w)), ...shuffle(plan.filter(([w]) => !isNew.has(w)), rand)];
  return deal('daily', state, bank, order, rand);
}

/** Remembers which words were in today's practice, so it can be redone. */
export function recordPractised(state: State, session: Session, date: string): State {
  const before = state.practised?.[date] ?? [];
  const words = [...before, ...Object.keys(session.words).filter(w => !before.includes(w))];
  return { ...state, practised: { [date]: words } };
}

/** The words that "Redo today" would go over. */
export function practisedToday(state: State, bank: Word[], date: string): string[] {
  const inBank = new Set(bank.map(w => w.word));
  return (state.practised?.[date] ?? state.days[date] ?? []).filter(w => inBank.has(w) && state.cards[w]);
}

/** Today's practice again, with fresh questions. Practice only: levels don't change. */
export function redoSession(state: State, bank: Word[], date: string, rand: Rand = Math.random): Session {
  const todays = new Set(state.days[date] ?? []);
  const words = practisedToday(state, bank, date);
  return deal('redo', state, bank, words.map(w => [w, todays.has(w) ? NEW_QUESTIONS : REVIEW_QUESTIONS]), rand);
}

/** Words that can go in a shuffle test: every word met so far. */
export function testableWords(state: State, bank: Word[]): string[] {
  return bank.filter(w => state.cards[w.word]).map(w => w.word);
}

/**
 * A random test: `wordCount` words picked from those met so far, with `questionCount`
 * questions shared out between them as evenly as possible. Practice only.
 */
export function shuffleTest(state: State, bank: Word[], wordCount: number, questionCount: number, rand: Rand = Math.random): Session {
  const words = shuffle(testableWords(state, bank), rand).slice(0, Math.max(1, wordCount));
  const total = Math.min(questionCount, words.length * MAX_PER_WORD);
  const plan = words.map((w, k): [string, number] => [w, Math.floor(total / words.length) + (k < total % words.length ? 1 : 0)]);
  return deal('shuffle', state, bank, plan.filter(([, n]) => n > 0), rand);
}

export function answer(
  state: State,
  session: Session,
  bank: Word[],
  choice: string,
  date: string,
  rand: Rand = Math.random,
): { state: State; session: Session; correct: boolean } {
  const it = session.items[session.i];
  const correct = choice === it.question.answer;
  let card = { ...state.cards[it.word], asked: state.cards[it.word].asked + 1 };
  const next: Session = { ...session, items: session.items.slice(), words: { ...session.words } };

  if (!it.retry) {
    const p = { ...next.words[it.word], left: next.words[it.word].left - 1 };
    const graded = session.kind === 'daily';
    if (correct) next.questionsRight++;
    if (!correct) {
      // First miss on this word: back to level 0, due tomorrow (in today's practice only).
      if (!p.failed) {
        if (graded) card = grade(card, false, date);
        next.missed = [...next.missed, it.word];
      }
      p.failed = true;
      // Ask again at the end, with a question not already seen today if there is one
      // (in today's practice, only while it stays within the day's questions).
      if (!graded || next.items.length < DAILY_MAX) {
        const word = bank.find(w => w.word === it.word)!;
        const seen = next.items.filter(x => x.word === it.word).map(x => x.question);
        const fresh = questionsFor(word, card.asked, 1, seen)[0] ?? it.question;
        next.items.push(item(word, fresh, true, rand));
      }
    } else if (p.left === 0 && !p.failed) {
      // Every first-attempt question right: up a level (in today's practice only).
      if (graded) card = grade(card, true, date);
      next.firstRight++;
    }
    next.words[it.word] = p;
  }
  return { state: { ...state, cards: { ...state.cards, [it.word]: card } }, session: next, correct };
}

export function finish(state: State, date: string): State {
  return { ...state, done: { ...state.done, [date]: true } };
}
