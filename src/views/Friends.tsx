import { useState } from 'react';
import { celebrators, colorOf, COLORS, on, type Friend } from '../lib/friends';
import type { Snapshot } from '../lib/sync';
import type { State, Word } from '../lib/types';

interface Props {
  snap: Snapshot;
  state: State;
  bank: Word[];
  date: string;
  friends: Friend[] | null;
  failed: boolean;
  onProfile: (name: string, color: string) => Promise<unknown>;
  onLeave: () => void;
  onUsed: (word: string) => void;
  onCheer: (name: string, word: string, yes: boolean) => void;
}

const list = (items: string[]) =>
  items.map((w, i) => <span key={w}>{i > 0 && (i === items.length - 1 ? ' and ' : ', ')}{w}</span>);

function Avatar({ friend, big }: { friend: { name: string; color: string | null }; big?: boolean }) {
  return <span className={`avatar c-${colorOf(friend.color)}${big ? ' avatar-big' : ''}`} aria-hidden="true">{friend.name.slice(0, 1).toUpperCase()}</span>;
}

/** Name and colour: the first time, and whenever you change them. */
function Setup({ name, color, onSave, onCancel }: { name: string; color: string; onSave: Props['onProfile']; onCancel?: () => void }) {
  const [draft, setDraft] = useState(name);
  const [pick, setPick] = useState(color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    try { await onSave(draft, pick); } catch { setError('Couldn’t reach the server. Try again in a moment.'); }
    setBusy(false);
  };
  return (
    <section className="sync">
      {!onCancel && <p className="lede">Used one of your words out loud, or in a message? Say so here, and your friends get to celebrate.</p>}
      <article className="card">
        <div className="band"><span>{onCancel ? 'Your profile' : 'Join in'}</span></div>
        <div className="ruled">
          <label className="tag" htmlFor="friend-name">Your name</label>
          <input id="friend-name" className="field" value={draft} maxLength={30} onChange={e => setDraft(e.target.value)} autoComplete="given-name" />
          <fieldset className="choice">
            <legend className="tag">Your colour</legend>
            <div className="swatches">
              {COLORS.map(c => (
                <button key={c} type="button" className={`swatch c-${c}`} aria-pressed={pick === c} aria-label={c} onClick={() => setPick(c)}>
                  {pick === c && (draft.trim().slice(0, 1).toUpperCase() || '✓')}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="card-actions">
            <button type="button" className="chip" disabled={!draft.trim() || busy} onClick={save}>{onCancel ? 'Save' : 'Join'}</button>
            {onCancel && <button type="button" className="chip chip-quiet" onClick={onCancel}>Cancel</button>}
          </div>
          <p className="small-print">Friends see your name, your colour, the words you’ve used today and what you’ve celebrated. Nothing else.</p>
        </div>
      </article>
      {error && <p className="slip sync-error">{error}</p>}
    </section>
  );
}

/** Your words as little boxes, with a search, to pick the one you used. */
function Picker({ words, used, onPick, onClose }: { words: string[]; used: string[]; onPick: (w: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const shown = words.filter(w => w.includes(q.trim().toLowerCase()));
  return (
    <article className="card picker">
      <div className="band"><span>Which word?</span><span>{words.length} met</span></div>
      <div className="ruled">
        <input className="field" type="search" placeholder="Search your words" value={q} onChange={e => setQ(e.target.value)}
          aria-label="Search your words" autoCapitalize="off" spellCheck={false} />
        {words.length
          ? (
            <div className="word-boxes">
              {shown.map(w => (
                <button key={w} type="button" className="word-box" aria-pressed={used.includes(w)} onClick={() => onPick(w)}>{w}</button>
              ))}
              {!shown.length && <p className="small-print">No word matches “{q}”.</p>}
            </div>
          )
          : <p className="small-print">Your words appear here once you’ve met them on Today.</p>}
        <div className="card-actions">
          <button type="button" className="chip chip-quiet" onClick={onClose}>Close</button>
        </div>
      </div>
    </article>
  );
}

export function Friends({ snap, state, bank, date, friends, failed, onProfile, onLeave, onUsed, onCheer }: Props) {
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const name = state.name?.value ?? '';
  const color = colorOf(state.name?.color);

  if (snap.status === 'off') return <p className="slip">Friends isn’t switched on for this site yet. Tell Ella.</p>;
  if (!name) return <Setup name="" color="pink" onSave={onProfile} />;
  if (editing) return <Setup name={name} color={color} onSave={async (n, c) => { await onProfile(n, c); setEditing(false); }} onCancel={() => setEditing(false)} />;

  // Your own entry comes from this device, so your taps show straight away.
  const me: Friend = { name, color, used: state.used ?? {}, cheers: state.cheers ?? {}, mine: true };
  const people = [me, ...(friends ?? []).filter(f => !f.mine && f.name !== name)];
  const uses = people.flatMap(f => on(f.used, date).map(w => ({ f, w, at: f.used[date][w] })))
    .sort((a, b) => b.at - a.at);
  const usedToday = on(me.used, date);
  const met = bank.filter(w => state.cards[w.word] || state.known[w.word]).map(w => w.word).sort();
  const mineCheered = on(me.cheers, date);

  return (
    <section className="sync">
      <button type="button" className="btn" onClick={() => setPicking(!picking)}>
        I used a word
        <span className="btn-sub">Tell your friends</span>
      </button>
      {picking && (
        <Picker words={met} used={usedToday} onClose={() => setPicking(false)}
          onPick={w => { onUsed(w); setPicking(false); }} />
      )}

      {failed && !friends && <p className="slip sync-error">Couldn’t load your friends just now. Check the connection.</p>}
      {!uses.length && <p className="slip">No one’s used a word yet today. Be the first.</p>}
      <div className="cards">
        {uses.map(({ f, w }) => {
          const cheered = celebrators(people, f.name, w, date).map(c => (c.mine ? 'You' : c.name));
          const mine = mineCheered.includes(`${f.name}:${w}`);
          return (
            <article key={`${f.name}:${w}`} className={`card use c-${colorOf(f.color)}`}>
              <div className="band"><span>{f.mine ? 'You' : f.name}</span><span>Used today</span></div>
              <div className="ruled">
                <span className="confetti" aria-hidden="true" />
                <h3 className="hw">Good word, {f.name}!</h3>
                <p className="sense">{f.mine ? 'You' : f.name} used <i>{w}</i> today.</p>
                {cheered.length > 0 && <p className="cheered">{list(cheered)} celebrated <i>{w}</i>.</p>}
                {f.mine
                  ? <button type="button" className="link whoops" onClick={() => onUsed(w)}>Whoops! Remove</button>
                  : (
                    <div className="card-actions">
                      <button type="button" className="chip chip-cheer" aria-pressed={mine} onClick={() => onCheer(f.name, w, !mine)}>
                        {mine ? 'Celebrated 🎉' : 'Celebrate'}
                      </button>
                    </div>
                  )}
              </div>
            </article>
          );
        })}
      </div>

      <div>
        <h2 className="tag section-label">Friends</h2>
        <ul className="roster">
          {people.map(f => (
            <li key={f.name}>
              <Avatar friend={f} big />
              <span className="tag">{f.mine ? 'You' : f.name}</span>
            </li>
          ))}
        </ul>
        {friends && people.length === 1 && <p className="small-print">No one else has joined yet.</p>}
        <p className="small-print">
          You’re here as <b>{name}</b>. <button type="button" className="link" onClick={() => setEditing(true)}>Change name or colour</button>
          {' · '}<button type="button" className="link" onClick={onLeave}>Leave friends</button>
        </p>
      </div>
    </section>
  );
}
