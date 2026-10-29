import { useState } from 'react';
import { celebrators, colorOf, type Friend } from '../lib/friends';
import { gamesCardId, gamesHeadline, GRAVITY_BEYOND, type GamesCard } from '../lib/games';
import { play } from '../lib/sounds';
import { Burst } from './Burst';

/** Good Wordle's guesses as tiny colour squares: no letters, so the word isn't spoiled. */
function MiniGrid({ grid, solved }: { grid?: string[]; solved: boolean }) {
  if (!grid?.length) return null;
  return (
    <div className="mini" aria-label={`${grid.length} guesses${solved ? '' : ', not solved'}`}>
      {grid.map((row, r) => (
        <div key={r} style={{ gridTemplateColumns: `repeat(${row.length}, 9px)` }}>
          {[...row].map((c, i) => <i key={i} className={c} />)}
        </div>
      ))}
    </div>
  );
}

/** How far the fuse got (score against a full bar at 500), with a spark for every ×3 bet won. */
function FuseLine({ score, sparks = 0 }: { score: number; sparks?: number }) {
  return (
    <>
      <div className="fuseline" aria-hidden="true"><b style={{ width: `${Math.min(100, score / 5)}%` }} /></div>
      <div className="sparks" aria-label={`${sparks} ×3 bet${sparks === 1 ? '' : 's'} won`}>{'✷'.repeat(Math.min(sparks, 8))}</div>
    </>
  );
}

/** A little staircase of levels; rungs past level 5 (beyond their own words) in pink. */
function Ladder({ level }: { level: number }) {
  const rungs = Math.max(8, level);
  return (
    <div className="ladder" aria-label={`Reached level ${level}`}>
      {Array.from({ length: rungs }, (_, i) => (
        <i key={i} className={`${i < level ? 'on' : ''}${i >= GRAVITY_BEYOND - 1 ? ' beyond' : ''}`} style={{ height: `${30 + (i * 70) / (rungs - 1)}%` }} />
      ))}
    </div>
  );
}

const Best = () => <span className="pb">New best!</span>;

/** Someone's three games for a day, on the Friends page, once they've played all three. */
export function GamesCardView({ card, people, fresh, mineCheered, onCheer }: {
  card: GamesCard; people: Friend[]; fresh: string[]; mineCheered: boolean;
  onCheer: (name: string, key: string, date: string, yes: boolean) => void;
}) {
  const { friend: f, date, wordle, fuse, gravity } = card;
  const [bursts, setBursts] = useState(0);
  const cheered = celebrators(people, f.name, 'games', date);
  const isNew = fresh.includes(gamesCardId(card)) || cheered.some(c => fresh.includes(`cheer:${c.name}:${date}:${f.name}:games`));
  const who = f.mine ? 'You' : f.name;
  const solved = wordle.score <= 6;
  return (
    <article className={`card use games-card c-${colorOf(f.color)}${isNew ? ' pop' : ''}`}>
      <div className="band"><span>{who} · Games</span><span>{ago(card.at)}</span></div>
      <div className="ruled">
        {isNew && <Burst className="burst-head" />}
        <h3 className="hw">{gamesHeadline(card, who)}</h3>
        <div className="tiles">
          <div className="tile">
            {wordle.best && <Best />}
            <span className="name">Good Wordle</span>
            <span className="val">{solved ? wordle.score : 'X'}<small>/6</small></span>
            <MiniGrid grid={wordle.grid} solved={solved} />
          </div>
          <div className="tile">
            {fuse.best && <Best />}
            <span className="name">The Fuse</span>
            <span className="val">{fuse.score}<small>pts</small></span>
            <FuseLine score={fuse.score} sparks={fuse.sparks} />
          </div>
          <div className="tile">
            {gravity.best && <Best />}
            <span className="name">Gravity</span>
            <span className="val">Lvl {gravity.level ?? 1}</span>
            <Ladder level={gravity.level ?? 1} />
            <span className="name">{gravity.score} pts</span>
          </div>
        </div>
        <div className="games-card-foot">
          <span className="cheered">{cheered.length > 0 && <>{cheered.map(c => (c.mine ? 'You' : c.name)).join(' and ')} celebrated</>}</span>
          {!f.mine && (
            <span className="cheer-wrap">
              <button type="button" className="chip chip-cheer" data-sound="own" aria-pressed={mineCheered}
                onClick={() => { if (!mineCheered) { setBursts(n => n + 1); play('celebrate'); } onCheer(f.name, 'games', date, !mineCheered); }}>
                {mineCheered ? 'Celebrated 🎉' : 'Celebrate'}
              </button>
              {bursts > 0 && <Burst key={bursts} />}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/** "Just now", "20 min ago", "5 hours ago". */
function ago(at: number): string {
  const min = Math.floor((Date.now() - at) / 60000);
  if (min < 2) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return `${h} hour${h === 1 ? '' : 's'} ago`;
}
