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

/** Questions per word in a session: today's new words get the full set, reviews a quick check. */
export const NEW_QUESTIONS = 5;
export const REVIEW_QUESTIONS = 2;

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

export interface Session {
  items: Item[];
  i: number;
  total: number;        // words in the session
  firstRight: number;   // words with every question right first time
  missed: string[];
  words: Record<string, Progress>;
}

function item(word: Word, question: Question, retry: boolean, rand: Rand): Item {
  return { word: word.word, question, options: shuffle([question.answer, ...question.distractors], rand), retry };
}

/** How many questions a session would ask today. */
export function sessionSize(state: State, bank: Word[], date: string): { words: number; questions: number } {
  const due = dueWords(state, bank, date);
  const news = new Set(state.days[date] ?? []);
  return { words: due.length, questions: due.reduce((n, w) => n + (news.has(w) ? NEW_QUESTIONS : REVIEW_QUESTIONS), 0) };
}

/**
 * Today's new words get five questions each and reviews two, dealt round by round
 * so the same word's questions are spread out rather than back to back.
 */
export function startSession(state: State, bank: Word[], date: string, rand: Rand = Math.random): Session {
  const byWord = new Map(bank.map(w => [w.word, w]));
  const due = dueWords(state, bank, date);
  const todays = new Set(state.days[date] ?? []);
  const news = (state.days[date] ?? []).filter(w => due.includes(w));
  const order = [...news, ...shuffle(due.filter(w => !todays.has(w)), rand)];

  const lists = order.map(w => {
    const word = byWord.get(w)!;
    const qs = questionsFor(word, state.cards[w].asked, todays.has(w) ? NEW_QUESTIONS : REVIEW_QUESTIONS);
    return qs.map(q => item(word, q, false, rand));
  });
  const items: Item[] = [];
  for (let round = 0; lists.some(l => l.length > round); round++) {
    for (const l of shuffle(lists.filter(l => l.length > round), rand)) items.push(l[round]);
  }
  const words = Object.fromEntries(lists.map((l, k) => [order[k], { left: l.length, failed: false }]));
  return { items, i: 0, total: order.length, firstRight: 0, missed: [], words };
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
    if (!correct) {
      // First miss on this word: back to level 0, due tomorrow. Later misses don't count again.
      if (!p.failed) {
        card = grade(card, false, date);
        next.missed = [...next.missed, it.word];
      }
      p.failed = true;
      // Ask again at the end, with a question not already seen today if there is one.
      const word = bank.find(w => w.word === it.word)!;
      const seen = next.items.filter(x => x.word === it.word).map(x => x.question);
      const fresh = questionsFor(word, card.asked, 1, seen)[0] ?? it.question;
      next.items.push(item(word, fresh, true, rand));
    } else if (p.left === 0 && !p.failed) {
      // Every first-attempt question right: up a level.
      card = grade(card, true, date);
      next.firstRight++;
    }
    next.words[it.word] = p;
  }
  return { state: { ...state, cards: { ...state.cards, [it.word]: card } }, session: next, correct };
}

export function finish(state: State, date: string): State {
  return { ...state, done: { ...state.done, [date]: true } };
}
