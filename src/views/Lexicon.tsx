import { useState } from 'react';
import { shortDate } from '../lib/dates';
import { MAX_LEVEL } from '../lib/srs';
import type { State, Word } from '../lib/types';
import { POS_LABEL, WordCard } from './WordCard';

interface Props {
  state: State;
  bank: Word[];
  number: (word: string) => number;
  date: string;
}

export function Lexicon({ state, bank, number, date }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const words = bank.filter(w => state.cards[w.word]).sort((a, b) => a.word.localeCompare(b.word));

  if (!words.length) return <p className="slip">Words appear here once you’ve met them.</p>;

  return (
    <section>
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
              {isOpen && <WordCard word={w} number={number(w.word)} note />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
