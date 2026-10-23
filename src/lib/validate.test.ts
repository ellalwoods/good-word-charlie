import { describe, expect, it } from 'vitest';
import words from '../data/words.json';
import rejected from '../data/rejected.json';
import type { Word } from './types';
import { checkBank, checkWord, usable } from './validate';

const bank = words as Word[];

describe('word bank', () => {
  it('every entry passes the checks', () => {
    expect(checkBank(bank, rejected)).toEqual([]);
  });

  it('every word has five questions and at least three types', () => {
    for (const w of bank) {
      expect(w.questions).toHaveLength(5);
      expect(new Set(w.questions.map(q => q.type)).size).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('checkWord', () => {
  const good = bank[0];
  const withQ = (patch: object) => ({ ...good, questions: [{ ...good.questions[3], ...patch }, ...good.questions.slice(1)] });

  it('rejects a test sentence matching the card example', () => {
    const prompt = good.example.replace(good.word, '___');
    expect(checkWord(withQ({ prompt }))).toContain('question 1 (gap): too close to the card example');
  });

  it('rejects an answer that is also a distractor', () => {
    expect(checkWord(withQ({ distractors: [good.word, 'ruse', 'crux'] })).join()).toMatch(/options repeat/);
  });

  it('rejects missing fields', () => {
    expect(checkWord({ ...good, definition: '' })).toContain('missing definition');
  });

  it('rejects an article that gives the answer away', () => {
    expect(checkWord(withQ({ prompt: 'They found an ___ in the report.' })).join()).toMatch(/"an" before the gap/);
  });

  it('drops bad entries and duplicates from the usable list', () => {
    expect(usable([good, { ...bank[1], example: '' }, good]).map(w => w.word)).toEqual([good.word]);
  });
});
