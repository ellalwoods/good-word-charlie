import { useState } from 'react';
import { colorOf, type Friend } from '../lib/friends';
import { leaderboard, playedToday, type GameId, type GameResult } from '../lib/games';
import type { State, Word } from '../lib/types';
import { Avatar } from './Friends';
import { Fuse } from './games/Fuse';
import { Gravity } from './games/Gravity';
import { Wordle } from './games/Wordle';

interface Props {
  state: State;
  bank: Word[];
  date: string;
  friends: Friend[] | null;
  /** Today's practice is finished, so the games are open. */
  unlocked: boolean;
  onResult: (game: GameId, result: GameResult) => void;
  onPractise: () => void;
}

/** While the games are being built they sit behind a notice; only Ella can step past it to test. */
export const GAMES_IN_PROGRESS = true;

const GAMES: { id: GameId; title: string; band: string; blurb: string }[] = [
  { id: 'wordle', title: 'Good Wordle', band: 'c-green',
    blurb: 'Guess the hidden word in six tries. The clue is its meaning; the tiles show which letters are right. Everyone gets the same word, from the whole bank.' },
  { id: 'fuse', title: 'The Fuse', band: 'c-yellow',
    blurb: 'A lit fuse and a stack of questions. Bet ×1, ×2 or ×3 on each. Right answers add fuse; wrong ones burn it, harder the more you bet. Your words first, then the whole bank once you pass 200 points.' },
  { id: 'gravity', title: 'Gravity', band: 'c-violet',
    blurb: 'Meanings fall towards the ground. Tap the right word before each one lands. It speeds up fast; from level 5 it eases off but goes beyond your words to the whole bank.' },
];

const showScore = (game: GameId, r: GameResult) =>
  game === 'wordle' ? `${r.score > 6 ? 'X' : r.score}/6` : game === 'gravity' ? `${r.score} pts · level ${r.level ?? 1}` : `${r.score} pts`;

function Board({ game, state, date, friends }: { game: GameId; state: State; date: string; friends: Friend[] | null }) {
  const rows = leaderboard(game, date, friends ?? [], { name: state.name?.value ?? '', color: state.name?.color ?? null, result: playedToday(state, game, date) });
  return (
    <article className="card">
      <div className="band board-band"><span>Today’s leaderboard</span><span>Resets at midnight</span></div>
      <div className="ruled">
        {rows.length
          ? (
            <ol className="board">
              {rows.map((r, i) => (
                <li key={i} className={r.mine ? 'me' : ''}>
                  <span className="rank">{r.rank}</span>
                  <Avatar friend={{ name: r.name, color: colorOf(r.color) }} />
                  <span className="board-name">{r.mine ? 'You' : r.name}</span>
                  <span className="score">{showScore(game, r.result)}</span>
                </li>
              ))}
            </ol>
          )
          : <p className="small-print">No one’s played yet today.</p>}
        {!state.name?.value && <p className="small-print">Join Friends to see your friends’ scores here.</p>}
      </div>
    </article>
  );
}

export function Games({ state, bank, date, friends, unlocked, onResult, onPractise }: Props) {
  const [open, setOpen] = useState<GameId | null>(null);
  const [past, setPast] = useState(false);
  const isElla = (state.name?.value ?? '').trim().toLowerCase() === 'ella';

  if (GAMES_IN_PROGRESS && !past) {
    return (
      <section className="sync">
        <article className="card">
          <div className="band board-band"><span>Games</span><span>Coming soon</span></div>
          <div className="ruled">
            <h3 className="hw">Works in progress</h3>
            <p className="sense">Three games are on their way: Good Wordle, The Fuse and Gravity. Check back soon.</p>
            {isElla && (
              <div className="card-actions">
                <button type="button" className="chip" onClick={() => setPast(true)}>Ella: open the games to test</button>
              </div>
            )}
          </div>
        </article>
      </section>
    );
  }

  if (open) {
    const g = GAMES.find(x => x.id === open)!;
    const result = playedToday(state, open, date);
    const finish = (r: GameResult) => onResult(open, r);
    return (
      <section className="sync games">
        <div><button type="button" className="chip chip-quiet" onClick={() => setOpen(null)}>← Games</button></div>
        {result ? (
          <>
            <article className={`card ${g.band} game-card`}>
              <div className="band"><span>{g.title}</span><span>Played today ✓</span></div>
              <div className="ruled">
                <p className="game-result">{showScore(open, result)}</p>
                <p className="small-print">That’s your go for today. It opens again tomorrow.</p>
              </div>
            </article>
            <Board game={open} state={state} date={date} friends={friends} />
          </>
        ) : (
          <article className={`card ${g.band} game-card`}>
            <div className="band"><span>{g.title}</span><span>Once a day</span></div>
            <div className="ruled">
              {open === 'wordle' && <Wordle bank={bank} date={date} onDone={finish} />}
              {open === 'fuse' && <Fuse state={state} bank={bank} onDone={finish} />}
              {open === 'gravity' && <Gravity state={state} bank={bank} onDone={finish} />}
            </div>
          </article>
        )}
      </section>
    );
  }

  return (
    <section className="sync games">
      {GAMES_IN_PROGRESS && <p className="slip">Testing mode: only you can see the games until the “works in progress” notice comes off.</p>}
      {!unlocked && (
        <article className="card">
          <div className="band board-band"><span>Locked</span><span>Practice first</span></div>
          <div className="ruled">
            <p className="sense">The games open once today’s practice is done.</p>
            <div className="card-actions"><button type="button" className="btn" onClick={onPractise}>Go to today’s practice</button></div>
          </div>
        </article>
      )}
      {GAMES.map((g, i) => {
        const result = playedToday(state, g.id, date);
        const top = leaderboard(g.id, date, friends ?? [], { name: state.name?.value ?? '', color: state.name?.color ?? null, result })[0];
        return (
          <article key={g.id} className={`card ${g.band} game-card${unlocked ? '' : ' locked'}`}>
            <div className="band"><span>Game {i + 1} of 3</span><span>{result ? 'Played today ✓' : unlocked ? 'Ready' : 'Locked'}</span></div>
            <div className="ruled">
              <h3 className="hw">{g.title}</h3>
              <p className="sense">{g.blurb}</p>
              {top && <p className="tag game-top">Today’s #1: {top.mine ? 'You' : top.name} · {showScore(g.id, top.result)}</p>}
              <button type="button" className={`btn${result ? ' btn-quiet' : ''}`} disabled={!unlocked}
                onClick={() => { setOpen(g.id); window.scrollTo(0, 0); }}>
                {!unlocked ? 'Locked' : result ? 'See leaderboard' : 'Play'}
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
