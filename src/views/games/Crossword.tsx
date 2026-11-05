import { useEffect, useMemo, useRef, useState } from 'react';
import { dailyCrossword, squares, type Entry } from '../../lib/crossword';
import type { GameResult } from '../../lib/games';
import { play } from '../../lib/sounds';
import { useSaveOnLeave } from './useSaveOnLeave';
import type { State, Word } from '../../lib/types';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm⌫'];
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Today's criss-cross of your own words. The clock runs from Go until the last word is right. */
/** A hint reveals one letter of the word you're on; then there's a wait before the next. */
export const HINT_WAIT = 7;

interface Saved { fill: Record<string, string>; elapsed: number; hints: number; lastHint: number }

export function Crossword({ state, bank, date, who, onDone, saved, onSave }: {
  state: State; bank: Word[]; date: string; who: string; onDone: (r: GameResult) => void;
  saved?: unknown; onSave: (data: unknown) => void;
}) {
  const puzzle = useMemo(() => dailyCrossword(state, bank, date, who), [date, who]);
  // A crossword left half-way comes back with its letters, and the clock carries on from where it paused.
  const was = saved as Saved | undefined;
  const [fill, setFill] = useState<Record<string, string>>(was?.fill ?? {});
  const [hints, setHints] = useState(was?.hints ?? 0);
  const [lastHint, setLastHint] = useState(was?.lastHint ?? -HINT_WAIT);   // in seconds on the clock
  const [cur, setCur] = useState<Entry | null>(() => puzzle?.entries.slice().sort((a, b) => a.num - b.num)[0] ?? null);
  const [pos, setPos] = useState(0);
  const [secs, setSecs] = useState(was?.elapsed ?? 0);
  const [flash, setFlash] = useState('');
  const start = useRef(Date.now() - (was?.elapsed ?? 0) * 1000);
  const done = useRef(false);
  const elapsed = () => Math.floor((Date.now() - start.current) / 1000);

  // The clock stops while the page is out of sight, and picks up from the same second.
  useEffect(() => {
    let away = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') away = elapsed();
      else start.current = Date.now() - away * 1000;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  useSaveOnLeave((): Saved => ({ fill, elapsed: elapsed(), hints, lastHint }), onSave, () => done.current);

  // A physical keyboard types too; the handler is refreshed each render below.
  const typeRef = useRef<(k: string) => void>(() => {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Backspace') typeRef.current('⌫');
      else if (/^[a-z]$/i.test(e.key)) typeRef.current(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const t = setInterval(() => { if (!done.current && !document.hidden) setSecs(elapsed()); }, 250);
    return () => clearInterval(t);
  }, []);

  if (!puzzle || !cur) return <p className="slip">Today’s crossword couldn’t be built from your words. Tell Ella.</p>;
  const { rows, cols, entries } = puzzle;

  const at = new Map<string, { ch: string; es: Entry[] }>();
  for (const e of entries) squares(e).forEach((sq, k) => {
    const c = at.get(sq) ?? { ch: e.word.word[k], es: [] };
    c.es.push(e); at.set(sq, c);
  });
  const order = entries.slice().sort((a, b) => (a.dir === b.dir ? a.num - b.num : a.dir === 'across' ? -1 : 1));
  const solved = (e: Entry, f = fill) => squares(e).every((sq, k) => f[sq] === e.word.word[k]);
  const curSquares = squares(cur);
  const sel = curSquares[pos];

  const moveTo = (e: Entry, p = 0) => { setCur(e); setPos(p); };
  const tapSquare = (sq: string) => {
    const c = at.get(sq)!;
    const i = curSquares.indexOf(sq);
    // Tapping the chosen square again switches between across and down.
    if (i >= 0 && sq === sel && c.es.length > 1) { const other = c.es.find(e => e !== cur)!; moveTo(other, squares(other).indexOf(sq)); return; }
    const e = i >= 0 ? cur : c.es[0];
    moveTo(e, squares(e).indexOf(sq));
  };

  const type = (k: string) => {
    if (done.current) return;
    const next = { ...fill };
    if (k === '⌫') {
      if (!next[sel] && pos > 0) { delete next[curSquares[pos - 1]]; setPos(pos - 1); } else delete next[sel];
      setFill(next); return;
    }
    const was = solved(cur);
    next[sel] = k;
    setFill(next);
    if (entries.every(e => solved(e, next))) {
      done.current = true;
      const score = Math.max(1, Math.round((Date.now() - start.current) / 1000));
      play('finish');
      setFlash(`Solved in ${clock(score)}!`);
      setTimeout(() => onDone({ at: Date.now(), score, hints }), 1200);
      return;
    }
    if (!was && solved(cur, next)) { play('right'); setFlash(`${cur.word.word}! ✓`); }
    if ([...at.keys()].every(sq => next[sq])) { play('wrong'); setFlash('All filled, but some letters are wrong'); }
    // One square along; at the end of a word, on to the next unfinished one.
    if (pos < curSquares.length - 1) setPos(pos + 1);
    else {
      const nxt = order.slice(order.indexOf(cur) + 1).concat(order).find(e => !solved(e, next));
      if (nxt) { setCur(nxt); setPos(Math.max(0, squares(nxt).findIndex(sq => !next[sq]))); }
    }
  };

  // A hint fills one square of the current word with its right letter: the first one that's empty or wrong.
  const hintWait = Math.max(0, lastHint + HINT_WAIT - secs);
  const hint = () => {
    if (done.current || hintWait > 0) return;
    const k = curSquares.findIndex((sq, i) => fill[sq] !== cur.word.word[i]);
    if (k < 0) return;
    const next = { ...fill, [curSquares[k]]: cur.word.word[k] };
    setFill(next);
    setHints(h => h + 1);
    setLastHint(elapsed());
    setPos(Math.min(k + 1, curSquares.length - 1));
    if (entries.every(e => solved(e, next))) {
      done.current = true;
      const score = Math.max(1, elapsed());
      play('finish');
      setFlash(`Solved in ${clock(score)}!`);
      setTimeout(() => onDone({ at: Date.now(), score, hints: hints + 1 }), 1200);
    } else if (solved(cur, next)) { play('right'); setFlash(`${cur.word.word}! ✓`); }
    else play('tap');
  };

  typeRef.current = type;
  const n = entries.filter(e => solved(e)).length;
  return (
    <div className="xw">
      <div className="hud">
        <span><span className="tag">Time</span><br /><span className="big">{clock(secs)}</span></span>
        <span className="hud-right"><span className="tag">Words</span><br /><span className="big">{n}/{entries.length}</span></span>
      </div>
      <div className="xgrid" style={{ ['--cs' as string]: `min(34px, calc((100vw - 72px) / ${cols}))`, gridTemplateColumns: `repeat(${cols}, var(--cs))` }}>
        {Array.from({ length: rows * cols }, (_, i) => {
          const sq = `${Math.floor(i / cols)},${i % cols}`, c = at.get(sq);
          if (!c) return <div key={sq} className="xcell" />;
          const num = entries.find(e => `${e.y},${e.x}` === sq)?.num;
          const cls = `xcell on${curSquares.includes(sq) ? ' word' : ''}${sq === sel ? ' sel' : ''}${c.es.some(e => solved(e)) ? ' good' : ''}`;
          return (
            <button key={sq} type="button" className={cls} onClick={() => tapSquare(sq)} aria-label={`Square ${num ?? ''}`}>
              {num && <span className="n">{num}</span>}{fill[sq] ?? ''}
            </button>
          );
        })}
      </div>
      <div className="cluebar">
        <button type="button" onClick={() => moveTo(order[(order.indexOf(cur) - 1 + order.length) % order.length])} aria-label="Previous clue">‹</button>
        <span className="num">{cur.num} {cur.dir}</span>
        <span className="txt">{cur.word.testDefinition}</span>
        <button type="button" onClick={() => moveTo(order[(order.indexOf(cur) + 1) % order.length])} aria-label="Next clue">›</button>
      </div>
      <div className="hint-row">
        <button type="button" className="chip hint-btn" data-sound="own" disabled={hintWait > 0 || solved(cur)} onClick={hint}>
          {hintWait > 0 ? `Hint in ${hintWait}s` : 'Hint: reveal a letter'}
        </button>
        {hints > 0 && <span className="tag">{hints} hint{hints === 1 ? '' : 's'} used</span>}
      </div>
      <div className="kb" role="group" aria-label="Keyboard">
        {ROWS.map(row => (
          <div key={row}>
            {[...row].map(k => (
              <button key={k} type="button" className={`key${k === '⌫' ? ' wide' : ''}`} onClick={() => type(k)} aria-label={k === '⌫' ? 'Delete' : k}>
                {k === '⌫' ? 'Del' : k}
              </button>
            ))}
          </div>
        ))}
      </div>
      <p className="flash" role="status">{flash}</p>
      <div className="clues">
        {(['across', 'down'] as const).map(dir => (
          <div key={dir}>
            <span className="tag">{dir === 'across' ? 'Across' : 'Down'}</span>
            <ol>
              {order.filter(e => e.dir === dir).map(e => (
                <li key={e.num + dir} className={`${e === cur ? 'cur' : ''}${solved(e) ? ' done' : ''}`}>
                  <button type="button" onClick={() => moveTo(e)}>
                    <b>{e.num}</b><span>{e.word.testDefinition} <span className="tag">({e.word.word.length})</span></span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <p className="small-print">Tap a square to choose it; tap it again to switch between across and down. Finished words turn green.</p>
    </div>
  );
}
