import { describe, expect, it } from 'vitest';
import words from '../data/words.json';
import { canDismiss, dismiss, dueWords, ensureToday, streak, unseen } from './daily';
import { answer, DAILY_MAX, finish, MAX_PER_WORD, pool, practisedToday, questionsFor, recordPractised, redoSession, sessionSize, shuffleTest, startSession } from './session';
import { grade, newCard } from './srs';
import { fresh } from './storage';
import type { Word } from './types';

const bank = words as Word[];
const D = '2026-10-23';
const fixed = () => 0.5;

describe('spaced repetition', () => {
  it('moves up a level on a right answer, with the matching interval', () => {
    const c = grade({ ...newCard(D), level: 2 }, true, D);
    expect(c.level).toBe(3);
    expect(c.due).toBe('2026-10-30');
  });
  it('drops to level 0, due tomorrow, on a wrong answer', () => {
    const c = grade({ ...newCard(D), level: 5 }, false, D);
    expect(c).toMatchObject({ level: 0, due: '2026-10-24', wrong: 1 });
  });
  it('stops at level 6 with a 60-day interval', () => {
    expect(grade({ ...newCard(D), level: 6 }, true, D)).toMatchObject({ level: 6, due: '2026-12-22' });
  });
});

describe('daily words', () => {
  it('gives three new words a day, all due today', () => {
    const s = ensureToday(fresh(), bank, D);
    expect(s.days[D]).toEqual(['farcical', 'paucity', 'modicum']);
    expect(dueWords(s, bank, D)).toHaveLength(3);
    expect(ensureToday(s, bank, D)).toBe(s);
  });
  it('replaces a word marked known, and keeps it out for good', () => {
    let s = ensureToday(fresh(), bank, D);
    s = dismiss(s, bank, 'modicum', 'known', D);
    expect(s.days[D]).toEqual(['farcical', 'paucity', 'glut']);
    expect(s.cards.modicum).toBeUndefined();
    expect(unseen(s, bank).some(w => w.word === 'modicum')).toBe(false);
  });
  it('replaces a rejected word too', () => {
    const s = dismiss(ensureToday(fresh(), bank, D), bank, 'glut', 'rejected', D);
    expect(s.rejected.glut).toBe(true);
    expect(s.days[D]).toHaveLength(3);
  });
  it('tops up a short day when new words are published', () => {
    const s = ensureToday(fresh(), bank.slice(0, 1), D);
    expect(s.days[D]).toEqual(['farcical']);
    expect(ensureToday(s, bank, D).days[D]).toEqual(['farcical', 'paucity', 'modicum']);
  });
  it('counts the streak back from today or yesterday', () => {
    const s = { ...fresh(), done: { '2026-10-20': true, '2026-10-21': true, '2026-10-22': true } as Record<string, true> };
    expect(streak(s, D)).toBe(3);
    expect(streak({ ...s, done: { ...s.done, [D]: true } }, D)).toBe(4);
    expect(streak(s, '2026-10-25')).toBe(0);
  });
});

describe('practice session', () => {
  const wordsOf = (sess: { items: { word: string }[] }) => sess.items.map(i => i.word);

  it("asks today's new words three questions each, spread out rather than back to back", () => {
    const s = ensureToday(fresh(), bank, D);
    const sess = startSession(s, bank, D, fixed);
    expect(sess.items).toHaveLength(9);
    for (const w of ['farcical', 'paucity', 'modicum']) {
      const qs = sess.items.filter(i => i.word === w).map(i => i.question);
      expect(qs).toHaveLength(3);
      expect(new Set(qs).size).toBe(3);
    }
    const order = wordsOf(sess);
    expect(order.every((w, k) => k === 0 || w !== order[k - 1])).toBe(true);
    for (const it of sess.items) {
      expect(it.options).toHaveLength(4);
      expect(it.options).toContain(it.question.answer);
    }
    expect(sessionSize(s, bank, D)).toEqual({ words: 3, questions: 9 });
  });

  it('asks review words two questions each', () => {
    let s = ensureToday(fresh(), bank, '2026-10-22');
    s = { ...s, days: {} };
    const sess = startSession(s, bank, D, fixed);
    expect(sess.items).toHaveLength(6);
    expect(sessionSize(s, bank, D)).toEqual({ words: 3, questions: 6 });
  });

  it('rotates through the pool and never pairs the two definition questions', () => {
    const w = bank.find(x => x.confusable)!;
    expect(pool(w).map(q => q.type)).toEqual(['pick-meaning', 'synonym', 'pick-word', 'gap', 'rewrite', 'usage', 'confusable']);
    for (let n = 0; n < 7; n++) {
      const types = questionsFor(w, n, 5).map(q => q.type);
      expect(types).toHaveLength(5);
      expect(types.includes('pick-meaning') && types.includes('pick-word')).toBe(false);
    }
    expect(questionsFor(w, 0, 2)[0]).not.toBe(questionsFor(w, 2, 2)[0]);
  });

  it('a wrong answer resets the word and asks it again at the end with a fresh question', () => {
    let s = ensureToday(fresh(), bank, D);
    s = { ...s, cards: { ...s.cards, farcical: { ...s.cards.farcical, level: 3 } } };
    let sess = startSession(s, bank, D, fixed);
    const k = sess.items.findIndex(i => i.word === 'farcical');
    sess = { ...sess, i: k };
    const first = sess.items[k];
    let r = answer(s, sess, bank, first.question.distractors[0], D, fixed);
    expect(r.correct).toBe(false);
    expect(r.state.cards.farcical).toMatchObject({ level: 0, due: '2026-10-24', asked: 1 });
    expect(r.session.items).toHaveLength(10);
    const retry = r.session.items[9];
    expect(retry).toMatchObject({ word: 'farcical', retry: true });
    expect(sess.items.filter(i => i.word === 'farcical').map(i => i.question)).not.toContain(retry.question);

    // Getting the rest of its questions right doesn't lift it back up.
    s = r.state;
    for (const [j, it] of r.session.items.entries()) {
      if (it.word !== 'farcical' || j === k) continue;
      r = answer(s, { ...r.session, i: j }, bank, it.question.answer, D, fixed);
      s = r.state;
    }
    expect(s.cards.farcical).toMatchObject({ level: 0, due: '2026-10-24' });
    expect(r.session.firstRight).toBe(0);
    expect(r.session.missed).toEqual(['farcical']);
  });

  it('a word moves up only once every question is right', () => {
    let s = ensureToday(fresh(), bank, D);
    let sess = startSession(s, bank, D, fixed);
    const mine = sess.items.map((it, j) => [it, j] as const).filter(([it]) => it.word === 'farcical');
    for (const [n, [it, j]] of mine.entries()) {
      const r = answer(s, { ...sess, i: j }, bank, it.question.answer, D, fixed);
      s = r.state; sess = r.session;
      expect(s.cards.farcical.level).toBe(n === mine.length - 1 ? 1 : 0);
    }
    expect(s.cards.farcical).toMatchObject({ level: 1, due: '2026-10-24', right: 1, asked: 3 });
    expect(sess.firstRight).toBe(1);
    expect(dueWords(s, bank, D)).not.toContain('farcical');
    expect(canDismiss(s, 'farcical')).toBe(false);
    expect(finish(s, D).done[D]).toBe(true);
  });

  it("redo goes over today's words again without changing levels", () => {
    let s = ensureToday(fresh(), bank, D);
    const daily = startSession(s, bank, D, fixed);
    s = recordPractised(s, daily, D);
    expect(practisedToday(s, bank, D)).toEqual(['farcical', 'paucity', 'modicum']);
    const before = s.cards.farcical;
    let sess = redoSession(s, bank, D, fixed);
    expect(sess.kind).toBe('redo');
    expect(sess.items).toHaveLength(9);
    // Every question right, then one wrong: levels and due dates stay put.
    for (const [j, it] of sess.items.entries()) {
      const r = answer(s, { ...sess, i: j }, bank, it.word === 'paucity' ? it.question.distractors[0] : it.question.answer, D, fixed);
      s = r.state; sess = r.session;
    }
    expect(s.cards.farcical).toMatchObject({ level: before.level, due: before.due, right: 0, wrong: 0 });
    expect(s.cards.paucity).toMatchObject({ level: 0, due: D, wrong: 0 });
    expect(sess.questionsRight).toBe(6);
    expect(sess.questionsAsked).toBe(9);
    expect(sess.missed).toEqual(['paucity']);
  });

  it('a shuffle test picks the chosen number of words and shares out the questions', () => {
    let s = ensureToday(fresh(), bank, D);
    for (const d of ['2026-10-20', '2026-10-21', '2026-10-22']) s = ensureToday(s, bank, d);
    expect(Object.keys(s.cards)).toHaveLength(12);
    const sess = shuffleTest(s, bank, 5, 12, fixed);
    expect(sess.kind).toBe('shuffle');
    expect(sess.total).toBe(5);
    expect(sess.items).toHaveLength(12);
    const counts = Object.values(sess.words).map(p => p.left).sort();
    expect(counts).toEqual([2, 2, 2, 3, 3]);
    // Never more questions than a word can give.
    expect(shuffleTest(s, bank, 2, 50, fixed).items).toHaveLength(2 * MAX_PER_WORD);
  });

  it('never asks more than 21 questions a day; the most overdue reviews go first', () => {
    // Twenty days of words, none practised: plenty of reviews due, plus today's three.
    let s = fresh();
    for (let i = 20; i >= 1; i--) s = ensureToday(s, bank, `2026-10-${String(23 - i).padStart(2, '0')}`);
    s = ensureToday(s, bank, D);
    const sess = startSession(s, bank, D, fixed);
    expect(sess.items).toHaveLength(DAILY_MAX);
    expect(sessionSize(s, bank, D)).toEqual({ words: 9, questions: 21 });
    // Today's three new words, then six of the oldest reviews (dealt on the 3rd and 4th).
    const reviews = Object.keys(sess.words).filter(w => !s.days[D].includes(w));
    expect(reviews.every(w => ['2026-10-03', '2026-10-04'].includes(s.cards[w].due))).toBe(true);

    // Getting everything wrong doesn't add retries past 21.
    let st = s, se = sess;
    for (let j = 0; j < se.items.length; j++) {
      const r = answer(st, { ...se, i: j }, bank, se.items[j].question.distractors[0], D, fixed);
      st = r.state; se = r.session;
    }
    expect(se.items).toHaveLength(DAILY_MAX);
  });
});
