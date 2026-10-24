import { useState } from 'react';
import { shortDate } from '../lib/dates';
import { MAX_PER_WORD } from '../lib/session';
import { MAX_LEVEL } from '../lib/srs';
import type { State, Word } from '../lib/types';
import { UsedChip } from './UsedChip';
import { POS_LABEL, WordCard } from './WordCard';

interface Props {
  state: State;
  bank: Word[];
  number: (word: string) => number;
  date: string;
  onTest: (words: number, questions: number) => void;
  used: string[];
  onUsed: (word: string) => void;
}

const WORD_CHOICES = [5, 10, 20];
const QUESTION_CHOICES = [10, 20, 30, 50];

/** Pick how many words and questions, then start a random practice-only test. */
function ShuffleTest({ met, onTest }: { met: number; onTest: Props['onTest'] }) {
  const [open, setOpen] = useState(false);
  const wordChoices = [...WORD_CHOICES.filter(n => n < met), met];
  const [words, setWords] = useState(Math.min(10, met));
  const cap = words * MAX_PER_WORD;
  const questionChoices = QUESTION_CHOICES.filter(n => n <= cap);
  if (!questionChoices.length) questionChoices.push(cap);
  const [asked, setAsked] = useState(20);
  const questions = questionChoices.includes(asked) ? asked : questionChoices[questionChoices.length - 1];

  if (!open) {
    return (
      <button type="button" className="btn shuffle-btn" onClick={() => setOpen(true)}>
        Shuffle test
        <span className="btn-sub">Random words from your lexicon</span>
      </button>
    );
  }
  return (
    <article className="card test-setup">
      <div className="band"><span>Shuffle test</span><span>Practice only</span></div>
      <div className="ruled">
        <fieldset className="choice">
          <legend className="tag">How many words?</legend>
          <div className="chips">
            {wordChoices.map(n => (
              <button key={n} type="button" className="chip" aria-pressed={words === n} onClick={() => setWords(n)}>
                {n === met && !WORD_CHOICES.includes(n) ? `All ${n}` : n}
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
        <p className="small-print">Levels and review dates don’t change.</p>
        <div className="card-actions">
          <button type="button" className="btn" onClick={() => onTest(words, questions)}>
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
      <ShuffleTest met={words.length} onTest={onTest} />
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
