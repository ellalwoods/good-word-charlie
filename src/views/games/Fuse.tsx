import { useEffect, useRef, useState } from 'react';
import { BETS, choiceQuestion, FUSE_MAX, FUSE_START, fusePoints, fuseSource, seeded, type Bet, type Choice, type GameResult } from '../../lib/games';
import { play } from '../../lib/sounds';
import type { State, Word } from '../../lib/types';

/**
 * The Fuse: a burning fuse and a stream of questions. Before each one you bet ×1, ×2 or ×3;
 * right answers add fuse, wrong ones burn it (more for a bigger bet). Your own words first,
 * then the whole bank once you pass 200 points.
 */
export function Fuse({ state, bank, onDone }: { state: State; bank: Word[]; onDone: (r: GameResult) => void }) {
  const rand = useRef(seeded(`fuse:${Date.now()}`)).current;
  const [fuse, setFuse] = useState(FUSE_START);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [bet, setBet] = useState<Bet | null>(null);
  const [beyond, setBeyond] = useState(false);
  const [flash, setFlash] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const seen = useRef<string[]>([]);
  const newQ = (pts: number) => {
    const src = fuseSource(state, bank, pts);
    const q = choiceQuestion(src.words, bank, rand, undefined, seen.current.slice(-20));
    seen.current.push(q.word.word);
    return { q, beyond: src.beyond };
  };
  const [q, setQ] = useState<Choice>(() => newQ(0).q);
  const ended = useRef(false);

  // The fuse burns a tenth of a second at a time, paused only while an answer is being shown.
  useEffect(() => {
    const t = setInterval(() => setFuse(f => (!picked ? f - 0.1 : f)), 100);
    return () => clearInterval(t);
  }, [picked]);

  useEffect(() => {
    if (fuse > 0 || ended.current) return;
    ended.current = true;
    play('finish');
    onDone({ at: Date.now(), score, answered });
  }, [fuse]);

  const choose = (o: string) => {
    if (!bet || picked || fuse <= 0) return;
    setPicked(o);
    const right = o === q.answer;
    let next = score;
    if (right) {
      const pts = fusePoints(bet, answered);
      next = score + pts;
      setScore(next);
      setFuse(f => Math.min(FUSE_MAX, f + BETS[bet].add));
      setFlash(`+${pts} points · +${BETS[bet].add}s`);
      play('right');
    } else {
      setFuse(f => Math.max(0, f - BETS[bet].burn));
      setFlash(`Burned ${BETS[bet].burn}s`);
      play('wrong');
    }
    setAnswered(n => n + 1);
    setTimeout(() => {
      const { q: nq, beyond: b } = newQ(next);
      if (b && !beyond) { setFlash('Beyond your words now: anything in the bank can come up.'); play('levelup'); }
      setBeyond(b);
      setQ(nq); setBet(null); setPicked(null);
    }, right ? 450 : 900);
  };

  return (
    <div className="fuse-game">
      <div className="hud">
        <span><span className="tag">Fuse</span><br /><span className="big">{Math.max(0, Math.ceil(fuse))}s</span></span>
        <span className="tag hud-mid">{beyond ? 'Whole bank' : 'Your words'}</span>
        <span className="hud-right"><span className="tag">Score</span><br /><span className="big">{score}</span></span>
      </div>
      <div className="fuse" aria-hidden="true"><b style={{ width: `${Math.max(0, (fuse / FUSE_MAX) * 100)}%` }} /></div>
      <p className="tag">{q.kind === 'meaning' ? 'What does it mean?' : 'Which word means…'}{bet ? ` · bet ×${bet}` : ''}</p>
      <p className={q.kind === 'meaning' ? 'clue clue-word' : 'clue'}>{q.prompt}</p>
      {!bet ? (
        <>
          <p className="tag">How sure are you?</p>
          <div className="bets">
            {([1, 2, 3] as Bet[]).map(b => (
              <button key={b} type="button" className={`bet bet-${b}`} onClick={() => setBet(b)}>
                {b === 1 ? 'Safe' : b === 2 ? 'Sure' : 'Certain'} ×{b}
                <small>+{BETS[b].add}s / −{BETS[b].burn}s</small>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="options">
          {q.options.map(o => (
            <button key={o} type="button" data-sound="own" disabled={!!picked}
              className={`opt${q.kind === 'word' ? ' opt-word' : ''}${!picked ? '' : o === q.answer ? ' right' : o === picked ? ' wrong' : ' faded'}`}
              onClick={() => choose(o)}>{o}</button>
          ))}
        </div>
      )}
      <p className="flash" role="status">{flash}</p>
      <p className="small-print">The fuse keeps burning while you choose your bet. Questions are worth more every five you answer.</p>
    </div>
  );
}
