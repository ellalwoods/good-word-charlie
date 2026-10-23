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

  it('every word has seven questions of at least six types', () => {
    for (const w of bank) {
      expect(w.questions).toHaveLength(7);
      expect(new Set(w.questions.map(q => q.type)).size).toBeGreaterThanOrEqual(6);
    }
  });

  it('never tests with the card definition', () => {
    const cardDefinitions = new Set(bank.map(w => w.definition));
    for (const w of bank) {
      for (const q of w.questions) {
        expect(cardDefinitions.has(q.prompt)).toBe(false);
        expect([q.answer, ...q.distractors].some(o => cardDefinitions.has(o))).toBe(false);
      }
    }
  });

  it('gives every word its own synonym', () => {
    expect(new Set(bank.map(w => w.synonym)).size).toBe(bank.length);
  });
});

describe('checkWord', () => {
  const good = bank[0];
  const gapAt = good.questions.findIndex(q => q.type === 'gap');
  const withQ = (patch: object) => ({ ...good, questions: good.questions.map((q, i) => (i === gapAt ? { ...q, ...patch } : q)) });
  const at = `question ${gapAt + 1} (gap)`;

  it('rejects a test sentence matching the card example', () => {
    const prompt = good.example.replace(good.word, '___');
    expect(checkWord(withQ({ prompt }))).toContain(`${at}: too close to the card example`);
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

  it('rejects a test definition that copies the card', () => {
    expect(checkWord({ ...good, testDefinition: good.definition })).toContain('test definition is worded too like the card definition');
  });

  it('rejects a synonym that appears in the card definition', () => {
    const synonym = good.definition.split(' ')[1].replace(/[^a-z]/gi, '');
    expect(checkWord({ ...good, synonym })).toContain('synonym appears in the card definition');
  });

  it('rejects a usage sentence that does not use the word', () => {
    const qs = good.questions.map(q => (q.type === 'usage' ? { ...q, distractors: ['A sentence about nothing.', ...q.distractors.slice(1)] } : q));
    expect(checkWord({ ...good, questions: qs }).join()).toMatch(/every sentence must use the word/);
  });

  it('drops bad entries and duplicates from the usable list', () => {
    expect(usable([good, { ...bank[1], example: '' }, good]).map(w => w.word)).toEqual([good.word]);
  });
});
