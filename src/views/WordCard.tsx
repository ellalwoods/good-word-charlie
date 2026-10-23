import type { ReactNode } from 'react';
import { canSpeak, speak } from '../lib/speech';
import type { Word } from '../lib/types';

export const POS_LABEL = { noun: 'Noun', adjective: 'Adjective', verb: 'Verb' } as const;

export function Speaker({ word }: { word: string }) {
  if (!canSpeak) return null;
  return (
    <button type="button" className="say" aria-label={`Hear “${word}”`} onClick={e => { e.stopPropagation(); speak(word); }}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function Headword({ word, small }: { word: Word; small?: boolean }) {
  return (
    <div className="headword">
      <h3 className={small ? 'hw hw-sm' : 'hw'}>{word.word}</h3>
      <div className="pron">
        <span>/{word.pron}/</span>
        <Speaker word={word.word} />
      </div>
    </div>
  );
}

export function ConfusableNote({ word }: { word: Word }) {
  if (!word.confusable) return null;
  return (
    <p className="note">
      <span className="tag">Not to be confused with <i>{word.confusable.word}</i></span>
      {word.confusable.note}
    </p>
  );
}

/** A ruled index card: coloured part-of-speech band, headword, sense and example. */
export function WordCard({ word, number, note, children }: { word: Word; number: number; note?: boolean; children?: ReactNode }) {
  return (
    <article className={`card pos-${word.pos}`}>
      <div className="band">
        <span>{POS_LABEL[word.pos]}</span>
        <span>No. {String(number).padStart(3, '0')}</span>
      </div>
      <div className="ruled">
        <Headword word={word} />
        <p className="sense">{word.definition}</p>
        <p className="example">{word.example}</p>
        {note && <ConfusableNote word={word} />}
        {children}
      </div>
    </article>
  );
}
