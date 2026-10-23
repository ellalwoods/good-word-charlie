import type { Pos, QuestionType, Word } from './types';

const POS: Pos[] = ['noun', 'adjective', 'verb'];
const TYPES: QuestionType[] = ['pick-meaning', 'pick-word', 'rewrite', 'confusable', 'gap'];
const SENTENCE_TYPES: QuestionType[] = ['rewrite', 'confusable', 'gap'];
export const GAP = '___';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s: string) => new Set(norm(s).split(' ').filter(Boolean));

/** Share of words two sentences have in common (Jaccard). */
export function overlap(a: string, b: string): number {
  const x = tokens(a), y = tokens(b);
  let both = 0;
  for (const t of x) if (y.has(t)) both++;
  return both / (x.size + y.size - both || 1);
}

/** The test sentence with the answer put in, for comparing against the card example. */
export function filled(prompt: string, answer: string): string {
  return prompt.replace(GAP, answer).replace(/\{[^}]*\}/, answer);
}

const mentions = (text: string, word: string) => new RegExp(`\\b${word}\\b`, 'i').test(text);

/** Problems with one entry; an empty list means it can be used. */
export function checkWord(w: Word, bank: Map<string, Word> = new Map()): string[] {
  const errs: string[] = [];
  const need = (ok: unknown, msg: string) => { if (!ok) errs.push(msg); };

  need(typeof w.word === 'string' && /^[a-z][a-z' -]*$/.test(w.word), 'word must be lowercase letters');
  need(POS.includes(w.pos), `unknown part of speech "${w.pos}"`);
  for (const f of ['pron', 'definition', 'example'] as const) need(typeof w[f] === 'string' && w[f].trim(), `missing ${f}`);
  if (errs.length) return errs;

  need(mentions(w.example, w.word), 'card example must use the word');
  if (w.confusable) {
    need(w.confusable.word?.trim() && w.confusable.note?.trim(), 'confusable needs a word and a note');
    need(w.confusable.word !== w.word, 'confusable is the word itself');
  }

  const qs = Array.isArray(w.questions) ? w.questions : [];
  need(qs.length >= 4 && qs.length <= 6, 'needs about five questions');
  const prompts = new Set<string>();

  qs.forEach((q, n) => {
    const at = `question ${n + 1} (${q?.type})`;
    if (!q || !TYPES.includes(q.type)) return errs.push(`${at}: unknown type`);
    if (typeof q.prompt !== 'string' || !q.prompt.trim()) return errs.push(`${at}: missing prompt`);
    if (typeof q.answer !== 'string' || !q.answer.trim()) return errs.push(`${at}: missing answer`);
    const ds = Array.isArray(q.distractors) ? q.distractors : [];
    const options = [q.answer, ...ds];
    need(ds.length === 3 && ds.every(d => typeof d === 'string' && d.trim()), `${at}: needs three distractors`);
    need(new Set(options.map(norm)).size === options.length, `${at}: options repeat, or the answer is also a distractor`);
    need(!prompts.has(norm(q.prompt)), `${at}: same prompt as another question`);
    prompts.add(norm(q.prompt));

    if (q.type === 'pick-meaning') {
      need(q.prompt === w.word, `${at}: prompt must be the word`);
      need(q.answer === w.definition, `${at}: answer must be the card definition`);
    } else {
      need(q.answer === w.word, `${at}: answer must be the word`);
      // Word options must be the same part of speech; we can check the ones in the bank.
      for (const d of ds) {
        const other = bank.get(d);
        need(!other || other.pos === w.pos, `${at}: distractor "${d}" is a ${other?.pos}`);
      }
    }
    if (q.type === 'pick-word') need(!mentions(q.prompt, w.word), `${at}: prompt gives away the word`);

    if (SENTENCE_TYPES.includes(q.type)) {
      const holes = q.type === 'rewrite' ? (q.prompt.match(/\{[^}]+\}/g) ?? []).length : q.prompt.split(GAP).length - 1;
      need(holes === 1, `${at}: needs exactly one ${q.type === 'rewrite' ? '{phrase}' : GAP}`);
      need(!mentions(q.prompt.replace(/\{[^}]*\}/, ''), w.word), `${at}: sentence gives away the word`);
      const s = filled(q.prompt, w.word);
      need(norm(s) !== norm(w.example) && overlap(s, w.example) < 0.6, `${at}: too close to the card example`);
      // "a ___" or "an ___" would give the answer away unless every option takes the same article.
      const art = q.prompt.match(/\b(a|an)\s+(?:___|\{)/i)?.[1].toLowerCase();
      if (art) {
        const vowel = (o: string) => /^[aeiou]/i.test(o);
        need(options.every(o => vowel(o) === (art === 'an')), `${at}: "${art}" before the gap gives the answer away`);
      }
    }
    if (q.type === 'confusable') {
      need(w.confusable && ds.includes(w.confusable.word), `${at}: the confusable word must be an option`);
    }
  });
  return errs;
}

/** Checks every entry, plus duplicates and rejected words across the bank. */
export function checkBank(words: Word[], rejected: string[] = []): { word: string; errors: string[] }[] {
  const bank = new Map(words.map(w => [w.word, w]));
  const seen = new Set<string>();
  const bad = new Set(rejected);
  const out: { word: string; errors: string[] }[] = [];
  for (const w of words) {
    const errors = checkWord(w, bank);
    if (seen.has(w.word)) errors.push('duplicate word');
    if (bad.has(w.word)) errors.push('on the rejected list');
    seen.add(w.word);
    if (errors.length) out.push({ word: w.word, errors });
  }
  return out;
}

/** Only the entries that pass, so one bad entry never breaks the app. */
export function usable(words: Word[]): Word[] {
  const bank = new Map(words.map(w => [w.word, w]));
  const seen = new Set<string>();
  return words.filter(w => !seen.has(w.word) && !checkWord(w, bank).length && seen.add(w.word));
}
