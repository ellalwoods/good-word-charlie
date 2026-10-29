import { useEffect, useState } from 'react';
import { colorOf, type Friend } from '../lib/friends';
import { dailyWordle, leaderboard, playedToday, type GameId, type GameResult } from '../lib/games';
import { POS_LABEL } from './WordCard';
import { addDays, shortDate } from '../lib/dates';
import type { State, Word } from '../lib/types';
import { Avatar } from './Friends';
import { TextElla } from './TextElla';
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


const GAMES: { id: GameId; title: string; band: string; blurb: string }[] = [
  { id: 'wordle', title: 'Good Wordle', band: 'c-green',
    blurb: 'The classic game you know, with words you probably don’t.' },
  { id: 'fuse', title: 'The Fuse', band: 'c-yellow',
    blurb: 'Answer as many questions as you can before the fuse burns out. Before each one, bet how sure you are: ×1, ×2 or ×3. A bigger bet wins more points if you’re right, but burns more fuse if you’re wrong. Right answers add a little time back. Questions use words from your Lexicon until you reach 200 points, then any word in the bank.' },
  { id: 'gravity', title: 'Gravity', band: 'c-violet',
    blurb: 'Definitions fall towards the ground. Match the right word to each definition before it lands. Levels 1 to 4 use only words from your Lexicon, and get faster quickly. At level 5 it slows down a little, but words can come from the whole word bank, including ones you haven’t met yet. If you let a definition land or match it incorrectly, you lose a life.' },
];

const showScore = (game: GameId, r: GameResult) =>
  game === 'wordle' ? `${r.score > 6 ? 'X' : r.score}/6` : game === 'gravity' ? `${r.score} pts · level ${r.level ?? 1}` : `${r.score} pts`;

/** "New game in 5 hours": time until midnight, when every game resets. Minutes in the last hour. */
export function untilNext(now = new Date()): string {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mins = Math.max(1, Math.ceil((midnight.getTime() - now.getTime()) / 60000));
  if (mins < 60) return `New game in ${mins} minute${mins === 1 ? '' : 's'}`;
  const hours = Math.round(mins / 60);
  return `New game in ${hours} hour${hours === 1 ? '' : 's'}`;
}

function NextGame() {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 30000); return () => clearInterval(t); }, []);
  return <>{untilNext()}</>;
}

/** After Good Wordle: the word and what it means, then on to the leaderboard when they're ready. */
function WordleReveal({ word, result, onNext }: { word: Word; result: GameResult; onNext: () => void }) {
  const won = result.score <= 6;
  return (
    <article className={`card pos-${word.pos} wordle-reveal`}>
      <div className="band"><span>{won ? `Solved in ${result.score} of 6` : 'Not this time'}</span><span>Today’s word</span></div>
      <div className="ruled">
        <p className="tag">{won ? 'Good word!' : 'The word was'}</p>
        <h3 className="hw reveal-word">{word.word}</h3>
        <p className="pron">{POS_LABEL[word.pos]} · /{word.pron}/</p>
        <p className="sense">{word.definition}</p>
        <p className="example">{word.example}</p>
        <button type="button" className="btn" onClick={onNext}>See the leaderboard</button>
      </div>
    </article>
  );
}

/** The small symbol for each game, used on Yesterday's winners. */
function Symbol({ game }: { game: GameId }) {
  if (game === 'wordle') return <span className="sym-wordle" aria-hidden="true">{[...'xyxygxggg'].map((c, i) => <i key={i} className={c} />)}</span>;
  if (game === 'fuse') return <span className="sym-fuse" aria-hidden="true" />;
  return <span className="sym-gravity" aria-hidden="true">{[5, 8, 11, 14, 16].map(h => <i key={h} style={{ height: h }} />)}</span>;
}

/** Yesterday's winner of each game, in one short strip at the top of the Games page. */
function YesterdaysWinners({ state, date, friends }: { state: State; date: string; friends: Friend[] | null }) {
  const yesterday = addDays(date, -1);
  const me = { name: state.name?.value ?? '', color: state.name?.color ?? null };
  const winners = GAMES.map(g => ({ g, top: leaderboard(g.id, yesterday, friends ?? [], { ...me, result: playedToday(state, g.id, yesterday) })[0] }));
  if (!winners.some(w => w.top)) return null;
  return (
    <article className="card">
      <div className="band board-band"><span>Yesterday’s winners</span><span>{shortDate(yesterday)}</span></div>
      <div className="ruled">
        <div className="winners">
          {winners.map(({ g, top }) => (
            <div key={g.id} className={`win${top?.mine ? ' mine' : ''}`}>
              <span className="whead"><span className="sym"><Symbol game={g.id} /></span><span className="gname">{g.title}</span></span>
              {top
                ? (
                  <span className="wrow">
                    <Avatar friend={{ name: top.name, color: colorOf(top.color) }} />
                    <span className="wtext"><span className="wname">{top.mine ? 'You!' : top.name}</span><span className="wscore">{g.id === 'gravity' ? `Level ${top.result.level ?? 1}` : showScore(g.id, top.result)}</span></span>
                  </span>
                )
                : <span className="wscore">No one played</span>}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

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
  // Good Wordle shows the word and its meaning first; the leaderboard waits until they're ready.
  const [reveal, setReveal] = useState(false);

  if (open) {
    const g = GAMES.find(x => x.id === open)!;
    const result = playedToday(state, open, date);
    const finish = (r: GameResult) => { onResult(open, r); if (open === 'wordle') setReveal(true); };
    return (
      <section className="sync games">
        <div><button type="button" className="chip chip-quiet" onClick={() => setOpen(null)}>← Games</button></div>
        {result && open === 'wordle' && reveal ? (
          <WordleReveal word={dailyWordle(bank, date)} result={result} onNext={() => { setReveal(false); window.scrollTo(0, 0); }} />
        ) : result ? (
          <>
            <article className={`card ${g.band} game-card`}>
              <div className="band"><span>{g.title}</span><span>Played today ✓</span></div>
              <div className="ruled">
                <p className="game-result">{showScore(open, result)}</p>
                {open === 'wordle' && <p className="sense">Today’s word: <i>{dailyWordle(bank, date).word}</i>. {dailyWordle(bank, date).definition}</p>}
                <p className="small-print"><NextGame /></p>
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
      <div className="games-help"><TextElla label="Error? Tell Ella" body="Hi Ella, something’s not working in the games on Good Word, Charlie: " /></div>
      </section>
    );
  }

  return (
    <section className="sync games">
      <YesterdaysWinners state={state} date={date} friends={friends} />
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
      <div className="games-help"><TextElla label="Error? Tell Ella" body="Hi Ella, something’s not working in the games on Good Word, Charlie: " /></div>
    </section>
  );
}
