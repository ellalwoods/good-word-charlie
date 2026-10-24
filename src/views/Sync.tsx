import { useState } from 'react';
import type { Snapshot } from '../lib/sync';
import { cleanKey } from '../lib/sync';

interface Props {
  snap: Snapshot;
  onLink: () => Promise<unknown>;
  onJoin: (key: string) => Promise<unknown>;
  onUnlink: () => void;
}

const STATUS: Record<Snapshot['status'], string> = {
  off: 'Not set up',
  local: 'This device only',
  saving: 'Saving…',
  synced: 'Synced',
  offline: 'Offline · will catch up',
  invalid: 'Link not found',
};

export const syncLabel = (s: Snapshot) => STATUS[s.status];

const linkFor = (key: string) => `${location.origin}${location.pathname}#${key}`;

export function Sync({ snap, onLink, onJoin, onUnlink }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [paste, setPaste] = useState('');
  const [copied, setCopied] = useState(false);

  const run = async (f: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await f(); } catch { setError('Couldn’t reach the server. Check the connection and try again.'); }
    setBusy(false);
  };

  if (snap.status === 'off') {
    return <p className="slip">Syncing between devices isn’t switched on for this site yet. Tell Ella.</p>;
  }

  if (!snap.key) {
    const key = cleanKey(paste);
    return (
      <section className="sync">
        <p className="lede">Keep your progress the same on your phone and laptop. Make a sync link here, then open it on your other device.</p>
        <button type="button" className="btn" disabled={busy} onClick={() => run(onLink)}>
          Make my sync link
          <span className="btn-sub">Your progress so far comes with you</span>
        </button>
        <article className="card sync-join">
          <div className="band"><span>Already have a link?</span></div>
          <div className="ruled">
            <label className="tag" htmlFor="sync-paste">Paste it here</label>
            <input id="sync-paste" className="field" value={paste} onChange={e => setPaste(e.target.value)}
              placeholder="https://…/#…" autoComplete="off" autoCapitalize="off" spellCheck={false} />
            <div className="card-actions">
              <button type="button" className="chip" disabled={!key || busy} onClick={() => key && run(() => onJoin(key))}>Join</button>
            </div>
            <p className="small-print">Anything on this device is added to that link’s progress.</p>
          </div>
        </article>
        {error && <p className="slip sync-error">{error}</p>}
      </section>
    );
  }

  if (snap.status === 'invalid') {
    return (
      <section className="sync">
        <p className="slip sync-error">That sync link doesn’t match any progress. Check you copied all of it.</p>
        <button type="button" className="btn btn-quiet" onClick={onUnlink}>Forget this link</button>
      </section>
    );
  }

  const link = linkFor(snap.key);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* select the text instead */ }
  };

  return (
    <section className="sync">
      <article className="card">
        <div className="band"><span>Your sync link</span><span>{STATUS[snap.status]}</span></div>
        <div className="ruled">
          <p>Open this link on your other phone or laptop, and both stay at the same place.</p>
          <input className="field" readOnly value={link} onFocus={e => e.target.select()} aria-label="Sync link" />
          <div className="card-actions">
            <button type="button" className="chip" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
          </div>
          <p className="small-print">Keep it to yourself: anyone with the link can see and change your progress. On a phone, add the site to your home screen after opening the link.</p>
        </div>
      </article>
      <button type="button" className="btn btn-quiet" onClick={onUnlink}>
        Stop syncing on this device
        <span className="btn-sub">Progress stays here; the link still works elsewhere</span>
      </button>
    </section>
  );
}
