import { describe, expect, it } from 'vitest';
import words from '../data/words.json';
import { canDismiss, dismiss, dueWords, ensureToday, streak, unseen } from './daily';
import { answer, finish, pool, questionFor, startSession } from './session';
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
  it('asks one question per due word, today\'s new words first', () => {
    const s = ensureToday(fresh(), bank, D);
    const sess = startSession(s, bank, D, fixed);
    expect(sess.items.map(i => i.word)).toEqual(['farcical', 'paucity', 'modicum']);
    for (const it of sess.items) {
      expect(it.options).toHaveLength(4);
      expect(it.options).toContain(it.question.answer);
    }
  });

  it('rotates through the pool, easiest types first', () => {
    const w = bank.find(x => x.confusable)!;
    expect(pool(w).map(q => q.type)).toEqual(['pick-meaning', 'pick-word', 'gap', 'rewrite', 'confusable']);
    expect(new Set([0, 1, 2, 3, 4].map(n => questionFor(w, n).prompt)).size).toBe(5);
    expect(questionFor(w, 5)).toBe(questionFor(w, 0));
  });

  it('a wrong answer resets the word and asks it once more at the end, without changing the level', () => {
    let s = ensureToday(fresh(), bank, D);
    s = { ...s, cards: { ...s.cards, farcical: { ...s.cards.farcical, level: 3 } } };
    let sess = startSession(s, bank, D, fixed);
    const first = sess.items[0];
    let r = answer(s, sess, bank, first.question.distractors[0], D, fixed);
    expect(r.correct).toBe(false);
    expect(r.state.cards.farcical).toMatchObject({ level: 0, due: '2026-10-24', asked: 1 });
    expect(r.session.items).toHaveLength(4);
    const retry = r.session.items[3];
    expect(retry).toMatchObject({ word: 'farcical', retry: true });
    expect(retry.question).not.toBe(first.question);

    s = r.state; sess = { ...r.session, i: 3 };
    r = answer(s, sess, bank, retry.question.answer, D, fixed);
    expect(r.correct).toBe(true);
    expect(r.state.cards.farcical).toMatchObject({ level: 0, due: '2026-10-24', asked: 2 });
    expect(r.session.firstRight).toBe(0);
    expect(r.session.items).toHaveLength(4);
  });

  it('a right first answer levels up and leaves the word out of today\'s due list', () => {
    const s = ensureToday(fresh(), bank, D);
    const sess = startSession(s, bank, D, fixed);
    const r = answer(s, sess, bank, sess.items[0].question.answer, D, fixed);
    expect(r.state.cards.farcical).toMatchObject({ level: 1, due: '2026-10-24', right: 1 });
    expect(dueWords(r.state, bank, D)).not.toContain('farcical');
    expect(canDismiss(r.state, 'farcical')).toBe(false);
    expect(finish(r.state, D).done[D]).toBe(true);
  });
});
