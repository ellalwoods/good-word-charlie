import type { Pos, QuestionType, Word } from './types';

const POS: Pos[] = ['noun', 'adjective', 'verb'];
const TYPES: QuestionType[] = ['pick-meaning', 'pick-word', 'synonym', 'usage', 'rewrite', 'confusable', 'gap'];
const SENTENCE_TYPES: QuestionType[] = ['rewrite', 'confusable', 'gap'];
export const GAP = '___';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s: string) => new Set(norm(s).split(' ').filter(Boolean));

const STOP = new Set('the and for with that from into than this not are was were has had have its it\'s you your their them they who what which when where also very too often especially something someone way being been such more less most just only'.split(' '));
const stem = (t: string) => t.replace(/(ing|ed|es|s|ly)$/, '');
const content = (s: string) => new Set(norm(s).split(' ').filter(t => t.length > 2 && !STOP.has(t)).map(stem));

/** Share of the shorter text's key words that also appear in the other, ignoring small words and endings. */
export function keywordOverlap(a: string, b: string): number {
  const x = content(a), y = content(b);
  let both = 0;
  for (const t of x) if (y.has(t)) both++;
  return both / (Math.min(x.size, y.size) || 1);
}

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

/** True if the text uses the word or a regular inflection of it (glut, gluts; mitigate, mitigated; tally, tallies; extol, extolled). */
export function mentions(text: string, word: string): boolean {
  const e = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const forms = [`${e}(s|es|d|ed|ing)?`];
  if (word.endsWith('e')) forms.push(`${e.slice(0, -1)}(ing|ed|es)`);
  if (word.endsWith('y')) forms.push(`${e.slice(0, -1)}(ies|ied)`);
  if (/[^aeiou][aeiou][bdglmnprt]$/.test(word)) forms.push(`${e}${word.slice(-1)}(ed|ing)`); // extolled, demurred
  return new RegExp(`\\b(${forms.join('|')})\\b`, 'i').test(text);
}

const shareGroup = (a?: Word, b?: Word) => !!a?.groups && !!b?.groups && a.groups.some(g => b.groups!.includes(g));

/** Problems with one entry; an empty list means it can be used. */
export function checkWord(w: Word, bank: Map<string, Word> = new Map()): string[] {
  const errs: string[] = [];
  const cardDefinitions = new Set([...bank.values()].map(b => b.definition));
  const byTestDefinition = new Map([...bank.values()].map(b => [b.testDefinition, b]));
  const bySynonym = new Map([...bank.values()].map(b => [b.synonym, b]));
  const need = (ok: unknown, msg: string) => { if (!ok) errs.push(msg); };

  need(typeof w.word === 'string' && /^[a-z][a-z' -]*$/.test(w.word), 'word must be lowercase letters');
  need(POS.includes(w.pos), `unknown part of speech "${w.pos}"`);
  for (const f of ['pron', 'definition', 'testDefinition', 'synonym', 'example'] as const) need(typeof w[f] === 'string' && w[f].trim(), `missing ${f}`);
  if (errs.length) return errs;

  need(mentions(w.example, w.word), 'card example must use the word');
  // The tests must not let you match the answer from the card's wording.
  need(keywordOverlap(w.testDefinition, w.definition) < 0.5, 'test definition is worded too like the card definition');
  need(!mentions(w.testDefinition, w.word), 'test definition gives away the word');
  need(w.synonym !== w.word && !mentions(w.synonym, w.word), 'synonym is the word itself');
  need(!new RegExp(`\\b${w.synonym.replace(/[^a-z' -]/gi, '')}\\b`, 'i').test(w.definition), 'synonym appears in the card definition');
  if (w.confusable) {
    need(w.confusable.word?.trim() && w.confusable.note?.trim(), 'confusable needs a word and a note');
    need(w.confusable.word !== w.word, 'confusable is the word itself');
  }

  const qs = Array.isArray(w.questions) ? w.questions : [];
  need(qs.length >= 6 && qs.length <= 9, 'needs six to nine questions');
  need(qs.filter(q => q?.type === 'synonym').length === 1 && qs.filter(q => q?.type === 'usage').length === 1, 'needs one synonym and one usage question');
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
    need(!prompts.has(`${q.type}:${norm(q.prompt)}`), `${at}: same prompt as another question`);
    prompts.add(`${q.type}:${norm(q.prompt)}`);

    if (q.type === 'pick-meaning') {
      need(q.prompt === w.word, `${at}: prompt must be the word`);
      need(q.answer === w.testDefinition, `${at}: answer must be the test definition`);
      for (const d of ds) {
        need(!cardDefinitions.has(d), `${at}: wrong option uses a card definition word for word`);
        const other = byTestDefinition.get(d);
        need(!other || (other.pos === w.pos && !shareGroup(w, other)), `${at}: wrong option is the definition of "${other?.word}", too close in meaning or not a ${w.pos}`);
      }
    } else if (q.type === 'synonym') {
      need(q.prompt === w.word && q.answer === w.synonym, `${at}: must ask for the word's synonym`);
      for (const d of ds) {
        const other = bySynonym.get(d);
        need(!other || (other.pos === w.pos && !shareGroup(w, other)), `${at}: wrong option is the synonym of "${other?.word}", too close in meaning or not a ${w.pos}`);
      }
    } else if (q.type === 'usage') {
      need(q.prompt === w.word, `${at}: prompt must be the word`);
      need(options.every(o => mentions(o, w.word)), `${at}: every sentence must use the word`);
      need(overlap(q.answer, w.example) < 0.6, `${at}: correct sentence too close to the card example`);
    } else {
      need(q.answer === w.word, `${at}: answer must be the word`);
      // Word options must be the same part of speech; we can check the ones in the bank.
      for (const d of ds) {
        const other = bank.get(d);
        need(!other || other.pos === w.pos, `${at}: distractor "${d}" is a ${other?.pos}`);
        need(d === w.confusable?.word || !shareGroup(w, other), `${at}: distractor "${d}" is too close in meaning`);
      }
    }
    if (q.type === 'pick-word') need(q.prompt === w.testDefinition, `${at}: prompt must be the test definition`);

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
