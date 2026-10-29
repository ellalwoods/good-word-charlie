import { useEffect, useRef, useState } from 'react';
import {
  choiceQuestion, GRAVITY_BEYOND, GRAVITY_LANES, GRAVITY_LIVES, GRAVITY_PER_LEVEL, gravityMaxFalling, gravityPoints, gravitySource,
  gravitySpeed, seeded, type GameResult,
} from '../../lib/games';
import { play } from '../../lib/sounds';
import type { State, Word } from '../../lib/types';

interface Card { id: number; word: Word; lane: number; depth: number; again: boolean; hit?: boolean }

const PAUSE_AT_BEYOND = 3500;   // ms of breather before words go beyond your own

/**
 * Gravity: meanings fall in three lanes. Tap the word for the lowest one before it lands.
 * Three lives: a card that lands, or a wrong tap, turns red and costs one; that word comes
 * back later. Faster quickly up to level 5, then words go beyond yours and the pace eases.
 */
export function Gravity({ state, bank, onDone }: { state: State; bank: Word[]; onDone: (r: GameResult) => void }) {
  const rand = useRef(seeded(`gravity:${Date.now()}`)).current;
  const g = useRef({
    cards: [] as Card[], again: [] as Word[], nextId: 1, score: 0, lives: GRAVITY_LIVES, level: 1, cleared: 0,
    spawnIn: 0.4, pausedUntil: 0, over: false, options: [] as string[], targetId: 0,
  });
  const [, render] = useState(0);
  const [flash, setFlash] = useState('');
  const [breather, setBreather] = useState(false);
  const [banner, setBanner] = useState(0);   // the level just reached, shown big for a moment
  const draw = () => render(n => n + 1);

  // The card that matters: the lowest one still falling.
  const target = () => g.current.cards.filter(c => !c.hit).sort((a, b) => b.depth - a.depth)[0];

  const refreshOptions = () => {
    const t = target();
    if (!t) { g.current.options = []; g.current.targetId = 0; return; }
    if (g.current.targetId === t.id) return;
    g.current.targetId = t.id;
    // Before level 5 the wrong options are your own words too, so none can be ruled out as unfamiliar.
    const q = choiceQuestion([t.word], bank, rand, 'word', [], gravitySource(state, bank, g.current.level));
    g.current.options = q.options;
  };

  const loseLife = (card: Card, why: string) => {
    const s = g.current;
    if (card.hit) return;   // each card can only cost one life
    card.hit = true;
    s.lives -= 1;
    s.again.push(card.word);
    play('wrong');
    setFlash(`${why}: it was “${card.word.word}”. It'll come back.`);
    setTimeout(() => { s.cards = s.cards.filter(c => c !== card); refreshOptions(); draw(); }, 450);
    if (s.lives <= 0 && !s.over) {
      s.over = true;
      setTimeout(() => { play('finish'); onDone({ at: Date.now(), score: s.score, level: s.level }); }, 700);
    }
  };

  const tap = (word: string) => {
    const s = g.current, t = target();
    if (!t || s.over || Date.now() < s.pausedUntil) return;
    if (word !== t.word.word) { loseLife(t, 'Not quite'); refreshOptions(); draw(); return; }
    const pts = gravityPoints(s.level, t.depth);
    s.score += pts;
    s.cards = s.cards.filter(c => c !== t);
    s.cleared += 1;
    if (s.cleared % GRAVITY_PER_LEVEL === 0) {
      s.level += 1;
      if (s.level === GRAVITY_BEYOND) {
        s.pausedUntil = Date.now() + PAUSE_AT_BEYOND;
        setBreather(true);
        setTimeout(() => setBreather(false), PAUSE_AT_BEYOND);
      }
      play('levelup');
      setFlash('');
      if (s.level !== GRAVITY_BEYOND) {
        const reached = s.level;
        setBanner(reached);
        setTimeout(() => setBanner(b => (b === reached ? 0 : b)), 1300);
      }
    } else {
      play('right');
      setFlash(`+${pts}`);
    }
    refreshOptions(); draw();
  };

  useEffect(() => {
    let last = performance.now(), raf = 0;
    const loop = (now: number) => {
      const s = g.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!s.over && Date.now() >= s.pausedUntil) {
        const speed = gravitySpeed(s.level);
        for (const c of s.cards) {
          if (c.hit) continue;
          c.depth += speed * dt;
          if (c.depth >= 1) loseLife(c, 'Landed');
        }
        // A new card, in a lane whose top is clear, when there's room for one.
        s.spawnIn -= dt;
        const falling = s.cards.filter(c => !c.hit);
        if (s.spawnIn <= 0 && falling.length < gravityMaxFalling(s.level)) {
          const busy = new Set(s.cards.filter(c => c.depth < 0.45).map(c => c.lane));
          const free = Array.from({ length: GRAVITY_LANES }, (_, i) => i).filter(i => !busy.has(i));
          if (free.length) {
            const lane = free[Math.floor(rand() * free.length)];
            const again = s.again.length > 0 && rand() < 0.5;
            const pool = gravitySource(state, bank, s.level);
            const word = again ? s.again.shift()! : choiceQuestion(pool, bank, rand, 'word', s.cards.map(c => c.word.word)).word;
            s.cards.push({ id: s.nextId++, word, lane, depth: 0, again });
            s.spawnIn = Math.max(0.9, 2.4 - 0.25 * (s.level >= GRAVITY_BEYOND ? 3 + (s.level - GRAVITY_BEYOND) * 0.5 : s.level));
          }
        }
        refreshOptions();
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const s = g.current;
  const t = target();
  return (
    <div className="gravity">
      <div className="hud">
        <span>
          <span className="tag">Level</span><br /><span className="big">{s.level}</span>
          <span className="to-next">{GRAVITY_PER_LEVEL - (s.cleared % GRAVITY_PER_LEVEL)} to level {s.level + 1}</span>
        </span>
        <span className="lives" aria-label={`${s.lives} lives left`}>{'♥'.repeat(Math.max(0, s.lives))}{'♡'.repeat(GRAVITY_LIVES - Math.max(0, s.lives))}</span>
        <span className="hud-right"><span className="tag">Score</span><br /><span className="big">{s.score}</span></span>
      </div>
      <div className="sky">
        {s.cards.map(c => (
          <div key={c.id} className={`rock${c.again ? ' again' : ''}${c.hit ? ' hit' : ''}${t && c.id === t.id ? ' target' : ''}`}
            style={{ left: `${2 + c.lane * (96 / GRAVITY_LANES)}%`, width: `${96 / GRAVITY_LANES - 2}%`, top: `calc(${Math.min(c.depth, 1)} * (100% - var(--ground) - var(--rock)))` }}>
            {c.word.testDefinition}
          </div>
        ))}
        {banner > 0 && !breather && <div className="level-up" role="status" key={banner}>Level {banner}!</div>}
        {breather && (
          <div className="breather" role="status">
            <span className="tag">You've reached</span>
            <b>Level {GRAVITY_BEYOND}!</b>
            <span><strong>New words from here:</strong> anything in the bank can fall, not just yours. Take a breath; we'll slow down a little.</span>
          </div>
        )}
        <div className="ground" />
      </div>
      <div className="taps" role="group" aria-label="Which word is the lowest card?">
        {s.options.map(o => (
          <button key={o} type="button" data-sound="own" disabled={breather || s.over} onClick={() => tap(o)}>{o}</button>
        ))}
      </div>
      <p className="flash" role="status">{flash}</p>
      <p className="small-print">
        Tap the word for the lowest card (outlined). Points: 10 × level, plus up to 10 more the higher it is.
        {s.level < GRAVITY_BEYOND ? ` Your words until level ${GRAVITY_BEYOND}; then any word in the bank.` : ' Any word in the bank now.'}
      </p>
    </div>
  );
}
