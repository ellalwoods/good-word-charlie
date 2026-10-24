import { useState } from 'react';
import { shortDate } from '../lib/dates';
import { dueForShuffle, MAX_PER_WORD } from '../lib/session';
import { MAX_LEVEL } from '../lib/srs';
import type { State, Word } from '../lib/types';
import { UsedChip } from './UsedChip';
import { POS_LABEL, WordCard } from './WordCard';

interface Props {
  state: State;
  bank: Word[];
  number: (word: string) => number;
  date: string;
  onTest: (words: number, questions: number, dueOnly: boolean) => void;
  used: string[];
  onUsed: (word: string) => void;
}

const WORD_CHOICES = [5, 10, 20];
const QUESTION_CHOICES = [10, 20, 30, 50];

/**
 * Pick which words (due ones, which count towards levels, or any), how many, and how
 * many questions, then start a random test.
 */
function ShuffleTest({ met, due, onTest }: { met: number; due: number; onTest: Props['onTest'] }) {
  const [open, setOpen] = useState(false);
  const [dueOnly, setDueOnly] = useState(due > 0);
  const counts = dueOnly && due > 0;
  const pool = counts ? due : met;
  const wordChoices = [...WORD_CHOICES.filter(n => n < pool), pool];
  const [wanted, setWords] = useState(10);
  const words = Math.min(wanted, pool);
  const cap = words * MAX_PER_WORD;
  const questionChoices = QUESTION_CHOICES.filter(n => n <= cap);
  if (!questionChoices.length) questionChoices.push(cap);
  const [asked, setAsked] = useState(20);
  const questions = questionChoices.includes(asked) ? asked : questionChoices[questionChoices.length - 1];

  if (!open) {
    return (
      <button type="button" className="btn shuffle-btn" onClick={() => setOpen(true)}>
        Shuffle test
        <span className="btn-sub">{due > 0 ? `${due} due word${due === 1 ? '' : 's'} can count towards levels` : 'Random words from your lexicon'}</span>
      </button>
    );
  }
  return (
    <article className="card test-setup">
      <div className="band"><span>Shuffle test</span><span>{counts ? 'Counts towards levels' : 'Practice only'}</span></div>
      <div className="ruled">
        <fieldset className="choice">
          <legend className="tag">Which words?</legend>
          <div className="chips">
            <button type="button" className="chip" aria-pressed={counts} disabled={!due} onClick={() => setDueOnly(true)}>Due · {due}</button>
            <button type="button" className="chip" aria-pressed={!counts} onClick={() => setDueOnly(false)}>Any word</button>
          </div>
        </fieldset>
        <fieldset className="choice">
          <legend className="tag">How many words?</legend>
          <div className="chips">
            {wordChoices.map(n => (
              <button key={n} type="button" className="chip" aria-pressed={words === n} onClick={() => setWords(n)}>
                {n === pool && !WORD_CHOICES.includes(n) ? `All ${n}` : n}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="choice">
          <legend className="tag">How many questions?</legend>
          <div className="chips">
            {questionChoices.map(n => (
              <button key={n} type="button" className="chip" aria-pressed={questions === n} onClick={() => setAsked(n)}>{n}</button>
            ))}
          </div>
        </fieldset>
        <p className="small-print">
          {counts
            ? 'Due words count like today’s practice: every question right first time moves a word up a level; a wrong answer sends it back to the start.'
            : 'Practice only: levels and review dates don’t change.'}
        </p>
        <div className="card-actions">
          <button type="button" className="btn" onClick={() => onTest(words, questions, counts)}>
            Start · {words} word{words === 1 ? '' : 's'}, {questions} questions
          </button>
          <button type="button" className="chip chip-quiet" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </div>
    </article>
  );
}

export function Lexicon({ state, bank, number, date, onTest, used, onUsed }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const words = bank.filter(w => state.cards[w.word]).sort((a, b) => a.word.localeCompare(b.word));

  if (!words.length) return <p className="slip">Words appear here once you’ve met them.</p>;

  return (
    <section>
      <ShuffleTest met={words.length} due={dueForShuffle(state, bank, date).length} onTest={onTest} />
      <p className="lede">{words.length} word{words.length === 1 ? '' : 's'} so far. The squares show how firmly each one is fixed; tap a word for its card.</p>
      <ul className="lex">
        {words.map(w => {
          const c = state.cards[w.word];
          const isOpen = open === w.word;
          return (
            <li key={w.word} className={`pos-${w.pos}`}>
              <button type="button" className="lex-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : w.word)}>
                <span className="lex-word">
                  <span className="hw hw-sm">{w.word}</span>
                  <span className="pos-dot">{POS_LABEL[w.pos]}</span>
                </span>
                <span className="lex-meta">
                  <span className="strength" role="img" aria-label={`Strength ${c.level} of ${MAX_LEVEL}`}>
                    {Array.from({ length: MAX_LEVEL }, (_, i) => <span key={i} className={i < c.level ? 'on' : ''} />)}
                  </span>
                  <span className="tag">{c.due <= date ? 'Due now' : `Next ${shortDate(c.due)}`}</span>
                </span>
              </button>
              {isOpen && (
                <WordCard word={w} number={number(w.word)} note>
                  <div className="card-actions"><UsedChip used={used.includes(w.word)} onToggle={() => onUsed(w.word)} /></div>
                </WordCard>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
