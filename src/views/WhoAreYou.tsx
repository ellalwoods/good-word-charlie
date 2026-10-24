import { useEffect, useState } from 'react';
import { COLORS, type Friend } from '../lib/friends';
import { Avatar, claimError } from './Friends';

interface Props {
  people: Friend[];
  onClaim: (name: string) => Promise<unknown>;
  onAdd: (name: string, color: string) => Promise<unknown>;
  onGuest: () => void;
}

/** Shown once on a new device, after the welcome: pick yourself, add yourself, or carry on as a guest. */
export function WhoAreYou({ people, onClaim, onAdd, onGuest }: Props) {
  const [pick, setPick] = useState<Friend | null>(null);
  const [adding, setAdding] = useState(!people.length);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>('pink');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, []);

  const run = async (f: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await f(); } catch (e) { setError(claimError(e)); setBusy(false); }
  };
  const taken = people.find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());

  return (
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="who-title">
      <article className="card welcome who-card">
        <div className="band"><span id="who-title">{adding ? 'Add yourself' : 'Who are you?'}</span><span>GWC v.5</span></div>
        <div className="ruled">
          {!adding ? (
            <>
              <p className="sense">Are you one of these people?</p>
              <ul className="roster roster-pick">
                {people.map(f => (
                  <li key={f.name}>
                    <button type="button" className="who" aria-pressed={pick?.name === f.name} onClick={() => { setPick(f); setError(''); }}>
                      <Avatar friend={f} big />
                      <span className="tag">{f.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {pick && (
                <button type="button" className="btn" disabled={busy} onClick={() => run(() => onClaim(pick.name))}>
                  {busy ? 'One moment…' : `Yes, I’m ${pick.name}`}
                  <span className="btn-sub">Carry on where you left off</span>
                </button>
              )}
              {error && <p className="small-print sync-warn">{error}</p>}
              <h4 className="tag welcome-how">Not on the list?</h4>
              <p className="small-print who-note">Adding yourself takes a name and a colour. No email, no password.</p>
              <div className="card-actions">
                <button type="button" className="chip" onClick={() => { setAdding(true); setError(''); }}>Add me · just a name</button>
                <button type="button" className="chip chip-quiet" onClick={onGuest}>Continue as guest</button>
              </div>
            </>
          ) : (
            <>
              <p className="sense">All you need is a name and a colour. No email, no password.</p>
              <label className="tag" htmlFor="who-name">Your name</label>
              <input id="who-name" className="field" value={name} maxLength={30} onChange={e => setName(e.target.value)} autoComplete="given-name" />
              <fieldset className="choice">
                <legend className="tag">Your colour</legend>
                <div className="swatches">
                  {COLORS.map(c => (
                    <button key={c} type="button" className={`swatch c-${c}`} aria-pressed={color === c} aria-label={c} onClick={() => setColor(c)}>
                      {color === c && (name.trim().slice(0, 1).toUpperCase() || '✓')}
                    </button>
                  ))}
                </div>
              </fieldset>
              {taken && (
                <div className="sync-warn">
                  <p className="small-print">Someone called {taken.name} is already here.</p>
                  <button type="button" className="chip" disabled={busy} onClick={() => run(() => onClaim(taken.name))}>That’s me, I’m {taken.name}</button>
                </div>
              )}
              <button type="button" className="btn" disabled={!name.trim() || !!taken || busy} onClick={() => run(() => onAdd(name, color))}>
                {busy ? 'One moment…' : 'Add me'}
              </button>
              {error && <p className="small-print sync-warn">{error}</p>}
              <div className="card-actions">
                {people.length > 0 && <button type="button" className="chip chip-quiet" onClick={() => setAdding(false)}>Back</button>}
                <button type="button" className="chip chip-quiet" onClick={onGuest}>Continue as guest</button>
              </div>
              <p className="small-print">Friends see your name and colour, the words you’ve used and what you’ve practised. Guests can add themselves later on the Friends page.</p>
            </>
          )}
        </div>
      </article>
    </div>
  );
}
