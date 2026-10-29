import { useEffect, useState } from 'react';
import { dailyWordle, markGuess, WORDLE_TRIES, type GameResult } from '../../lib/games';
import { play } from '../../lib/sounds';
import type { Word } from '../../lib/types';

const ROWS = ['qwertyuiop', 'asdfghjkl', '⏎zxcvbnm⌫'];
const RANK = { x: 1, y: 2, g: 3 } as const;

/** Good Wordle: today's word (the same for everyone), its meaning as the clue, six guesses. */
export function Wordle({ bank, date, onDone }: { bank: Word[]; date: string; onDone: (r: GameResult) => void }) {
  const target = dailyWordle(bank, date);
  const len = target.word.length;
  const [guesses, setGuesses] = useState<string[]>([]);
  const [cur, setCur] = useState('');
  const [msg, setMsg] = useState('');
  const over = guesses.includes(target.word) || guesses.length >= WORDLE_TRIES;

  const keys: Record<string, 'g' | 'y' | 'x'> = {};
  for (const g of guesses) {
    markGuess(g, target.word).forEach((c, i) => { const k = g[i]; if (!keys[k] || RANK[c] > RANK[keys[k]]) keys[k] = c; });
  }

  const press = (k: string) => {
    if (over) return;
    setMsg('');
    if (k === '⏎') {
      if (cur.length < len) { setMsg(`Needs ${len} letters`); return; }
      const next = [...guesses, cur];
      setGuesses(next); setCur('');
      const won = cur === target.word;
      if (won || next.length >= WORDLE_TRIES) {
        play(won ? 'finish' : 'wrong');
        setTimeout(() => onDone({ at: Date.now(), score: won ? next.length : WORDLE_TRIES + 1 }), 900);
      } else play('tap');
      return;
    }
    if (k === '⌫') setCur(c => c.slice(0, -1));
    else if (cur.length < len) setCur(c => c + k);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') press('⏎');
      else if (e.key === 'Backspace') press('⌫');
      else if (/^[a-z]$/i.test(e.key)) press(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const tile = `min(46px, calc((100vw - ${70 + (len - 1) * 6}px) / ${len}))`;
  return (
    <div className="wordle">
      <p className="tag">The clue</p>
      <p className="clue">{target.testDefinition}</p>
      <div className="wgrid" style={{ ['--t' as string]: tile }}>
        {Array.from({ length: WORDLE_TRIES }, (_, r) => {
          const word = r < guesses.length ? guesses[r] : r === guesses.length ? cur : '';
          const marks = r < guesses.length ? markGuess(guesses[r], target.word) : [];
          return (
            <div key={r} className="wrow" style={{ gridTemplateColumns: `repeat(${len}, var(--t))` }}>
              {Array.from({ length: len }, (_, i) => (
                <div key={i} className={`wtile ${marks[i] ?? ''}`} style={{ animationDelay: `${i * 90}ms` }}>{word[i] ?? ''}</div>
              ))}
            </div>
          );
        })}
      </div>
      {over && (
        <p className="wanswer">
          {guesses.includes(target.word) ? 'Good word! ' : 'The word was '}<b>{target.word}</b>
        </p>
      )}
      <div className="kb" role="group" aria-label="Keyboard">
        {ROWS.map(row => (
          <div key={row}>
            {[...row].map(k => (
              <button key={k} type="button" data-sound="own" className={`key ${k === '⏎' || k === '⌫' ? 'wide' : ''} ${keys[k] ?? ''}`}
                onClick={() => press(k)} aria-label={k === '⏎' ? 'Enter' : k === '⌫' ? 'Delete' : k}>
                {k === '⏎' ? 'Enter' : k === '⌫' ? 'Del' : k}
              </button>
            ))}
          </div>
        ))}
      </div>
      <p className="flash" role="status">{msg}</p>
    </div>
  );
}
