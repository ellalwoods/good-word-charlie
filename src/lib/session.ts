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

// Easier types first, so a word's first few reviews start gently.
const RANK: Record<QuestionType, number> = { 'pick-meaning': 0, 'pick-word': 1, gap: 2, rewrite: 3, confusable: 4 };

export function pool(word: Word): Question[] {
  return word.questions.map((q, i) => ({ q, i })).sort((a, b) => RANK[a.q.type] - RANK[b.q.type] || a.i - b.i).map(x => x.q);
}

/** The nth question asked for a word, rotating through its pool. */
export function questionFor(word: Word, n: number): Question {
  const p = pool(word);
  return p[n % p.length];
}

export interface Item {
  word: string;
  question: Question;
  options: string[];
  retry: boolean;   // the end-of-session repeat after a wrong answer; doesn't change the level
}

export interface Session {
  items: Item[];
  i: number;
  total: number;        // words in the session, not counting retries
  firstRight: number;
  missed: string[];
}

function item(word: Word, n: number, retry: boolean, rand: Rand): Item {
  const question = questionFor(word, n);
  return { word: word.word, question, options: shuffle([question.answer, ...question.distractors], rand), retry };
}

/** Today's new words first, then every other due word in random order. One question each. */
export function startSession(state: State, bank: Word[], date: string, rand: Rand = Math.random): Session {
  const byWord = new Map(bank.map(w => [w.word, w]));
  const due = dueWords(state, bank, date);
  const news = (state.days[date] ?? []).filter(w => due.includes(w));
  const rest = shuffle(due.filter(w => !news.includes(w)), rand);
  const items = [...news, ...rest].map(w => item(byWord.get(w)!, state.cards[w].asked, false, rand));
  return { items, i: 0, total: items.length, firstRight: 0, missed: [] };
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
  const card = { ...state.cards[it.word], asked: state.cards[it.word].asked + 1 };
  const next = { ...session, items: session.items.slice() };

  if (it.retry) {
    state = { ...state, cards: { ...state.cards, [it.word]: card } };
  } else {
    state = { ...state, cards: { ...state.cards, [it.word]: grade(card, correct, date) } };
    if (correct) next.firstRight++;
    else {
      next.missed = [...next.missed, it.word];
      // Ask once more at the end, with the next question in the pool rather than the one just revealed.
      const word = bank.find(w => w.word === it.word)!;
      next.items.push(item(word, card.asked, true, rand));
    }
  }
  return { state, session: next, correct };
}

export function finish(state: State, date: string): State {
  return { ...state, done: { ...state.done, [date]: true } };
}
