import { useState } from 'react';
import { usedOn, type Friend } from '../lib/friends';
import type { Snapshot } from '../lib/sync';

interface Props {
  snap: Snapshot;
  date: string;
  name: string;
  friends: Friend[] | null;
  failed: boolean;
  onName: (name: string) => Promise<unknown>;
  onLeave: () => void;
}

const list = (words: string[]) =>
  words.map((w, i) => <span key={w}>{i > 0 && (i === words.length - 1 ? ' and ' : ', ')}<i>{w}</i></span>);

export function Friends({ snap, date, name, friends, failed, onName, onLeave }: Props) {
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (snap.status === 'off') return <p className="slip">Friends isn’t switched on for this site yet. Tell Ella.</p>;

  const save = async () => {
    setBusy(true); setError('');
    try { await onName(draft); } catch { setError('Couldn’t reach the server. Try again in a moment.'); }
    setBusy(false);
  };

  if (!name) {
    return (
      <section className="sync">
        <p className="lede">Used one of your words out loud, or in a message? Tap <b>I used it today</b> on its card, and your friends here get to cheer.</p>
        <article className="card">
          <div className="band"><span>Join in</span></div>
          <div className="ruled">
            <label className="tag" htmlFor="friend-name">Your name</label>
            <input id="friend-name" className="field" value={draft} maxLength={30} onChange={e => setDraft(e.target.value)} autoComplete="given-name" />
            <div className="card-actions">
              <button type="button" className="chip" disabled={!draft.trim() || busy} onClick={save}>Join</button>
            </div>
            <p className="small-print">Friends see your name and the words you’ve used today. Nothing else.</p>
          </div>
        </article>
        {error && <p className="slip sync-error">{error}</p>}
      </section>
    );
  }

  const me = friends?.find(f => f.mine);
  const others = (friends ?? []).filter(f => !f.mine)
    .sort((a, b) => usedOn(b.used, date).length - usedOn(a.used, date).length || a.name.localeCompare(b.name));
  const mine = me ? usedOn(me.used, date) : [];

  return (
    <section className="sync">
      {failed && !friends && <p className="slip sync-error">Couldn’t load your friends just now. Check the connection.</p>}
      {friends && !others.length && <p className="slip">No one else has joined yet. Friends appear here once they pick a name.</p>}
      <div className="cards">
        {others.map(f => {
          const words = usedOn(f.used, date);
          return words.length ? (
            <article key={f.name} className="card friend friend-used">
              <div className="band"><span>{f.name}</span><span>Used today</span></div>
              <div className="ruled">
                <span className="confetti" aria-hidden="true" />
                <h3 className="hw">Good word, {f.name}!</h3>
                <p className="sense">{f.name} used {list(words)} today.</p>
              </div>
            </article>
          ) : (
            <article key={f.name} className="card friend">
              <div className="band"><span>{f.name}</span></div>
              <div className="ruled"><p className="sense quiet">No words used yet today.</p></div>
            </article>
          );
        })}
      </div>
      <p className="small-print">
        You’re here as <b>{name}</b>{mine.length ? <> and you’ve used {list(mine)} today</> : ''}.{' '}
        <button type="button" className="link" onClick={onLeave}>Leave friends</button>
      </p>
    </section>
  );
}
