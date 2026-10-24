import { useEffect, useState } from 'react';
import { shortDate } from '../lib/dates';
import { colorOf } from '../lib/friends';
import { computeStats, type Row, type Stats as S, type Tally } from '../lib/stats';
import type { Word } from '../lib/types';
import { Avatar } from './Friends';
import { Problem } from './TextElla';

const SAVED = 'good-word-charlie-owner';
const readSaved = () => { try { return localStorage.getItem(SAVED) ?? ''; } catch { return ''; } };
const save = (p: string) => { try { if (p) localStorage.setItem(SAVED, p); else localStorage.removeItem(SAVED); } catch { /* storage blocked */ } };

const ago = (iso: string) => {
  const h = (Date.now() - Date.parse(iso)) / 36e5;
  if (h < 1) return 'within the hour';
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
};
const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);

function List({ title, items, empty, unit }: { title: string; items: Tally[]; empty: string; unit: [string, string] }) {
  return (
    <article className="card">
      <div className="band"><span>{title}</span></div>
      <div className="ruled">
        {items.length
          ? <ol className="tally">{items.map(t => <li key={t.word}><i>{t.word}</i><span className="tag">{t.n} {t.n === 1 ? unit[0] : unit[1]}{t.extra ? ` · ${t.extra}` : ''}</span></li>)}</ol>
          : <p className="small-print">{empty}</p>}
      </div>
    </article>
  );
}

/** Ella's stats: how everyone's using the site. Behind a password checked by Supabase. */
export function Stats({ bank, date, load }: { bank: Word[]; date: string; load: (password: string) => Promise<Row[] | null> }) {
  const [password, setPassword] = useState(readSaved);
  const [draft, setDraft] = useState('');
  const [stats, setStats] = useState<S | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'wrong' | 'failed'>('idle');

  const open = async (p: string) => {
    setState('loading');
    try {
      const rows = await load(p);
      if (!rows) { save(''); setPassword(''); setState('wrong'); return; }
      save(p); setPassword(p); setStats(computeStats(rows, bank, date)); setState('idle');
    } catch { setState('failed'); }
  };
  useEffect(() => { if (password) open(password); }, []);

  if (!password || state === 'wrong') {
    return (
      <section className="sync">
        <article className="card">
          <div className="band"><span>Ella’s stats</span><span>Private</span></div>
          <div className="ruled">
            <label className="tag" htmlFor="owner-pw">Password</label>
            <input id="owner-pw" className="field" type="password" value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && draft) open(draft); }} autoComplete="current-password" />
            {state === 'wrong' && <p className="small-print sync-warn">That’s not it.</p>}
            <div className="card-actions">
              <button type="button" className="chip" disabled={!draft || state === 'loading'} onClick={() => open(draft)}>Open</button>
            </div>
            <p className="small-print">This device remembers it once it’s right.</p>
          </div>
        </article>
      </section>
    );
  }
  if (state === 'failed') return <Problem about="Ella’s stats wouldn’t load.">Couldn’t load the stats. Check the connection.</Problem>;
  if (!stats) return <p className="slip">Loading…</p>;

  const soonest = stats.people.filter(p => p.runsOut).sort((a, b) => a.runsOut!.localeCompare(b.runsOut!))[0];
  return (
    <section className="sync stats-page">
      <section className="stats" aria-label="Overview">
        <div className="stat"><b>{stats.people.length}</b><span className="tag">People</span></div>
        <div className="stat stat-yellow"><b>{stats.activeWeek}</b><span className="tag">Active this week</span></div>
        <div className="stat stat-pink"><b>{stats.people.reduce((n, p) => n + p.used, 0)}</b><span className="tag">Words used</span></div>
      </section>
      {soonest && (
        <p className="slip">
          <b>{soonest.name}</b> runs out of words first, around <b>{shortDate(soonest.runsOut!)}</b> ({soonest.left} left).
          {stats.guests > 0 && <> Plus {stats.guests} guest{stats.guests === 1 ? '' : 's'} with no name.</>}
        </p>
      )}

      <h2 className="tag section-label">People</h2>
      <div className="cards">
        {stats.people.map(p => (
          <article key={p.name} className={`card person c-${colorOf(p.color)}`}>
            <div className="band"><span>{p.name}</span><span>Seen {ago(p.lastSeen)}</span></div>
            <div className="ruled">
              <div className="profile-head"><Avatar friend={p} /><span className="tag">{p.streak}-day streak · practised {p.practised} of {p.dealt} days</span></div>
              <dl className="facts">
                <div><dt>Learned</dt><dd>{p.learned}</dd></div>
                <div><dt>Firmly (5–6)</dt><dd>{p.strong}</dd></div>
                <div><dt>Accuracy</dt><dd>{pct(p.accuracy)}</dd></div>
                <div><dt>Used</dt><dd>{p.used}</dd></div>
                <div><dt>Stories</dt><dd>{p.stories}</dd></div>
                <div><dt>Celebrated / got</dt><dd>{p.cheersGiven} / {p.cheersReceived}</dd></div>
                <div><dt>Words left</dt><dd>{p.left}</dd></div>
                <div><dt>Runs out</dt><dd>{p.runsOut ? shortDate(p.runsOut) : '–'}</dd></div>
              </dl>
            </div>
          </article>
        ))}
      </div>

      <h2 className="tag section-label">Words</h2>
      <div className="cards">
        <List title="Hardest" items={stats.hardest} empty="No wrong answers yet." unit={['wrong', 'wrong']} />
        <List title="Most “Already know it”" items={stats.known} empty="No one’s skipped a word as known." unit={['person', 'people']} />
        <List title="Most “Not for me”" items={stats.rejected} empty="No one’s turned a word down." unit={['person', 'people']} />
        <List title="Most used for real" items={stats.mostUsed} empty="No words used yet." unit={['time', 'times']} />
      </div>

      <h2 className="tag section-label">Stories</h2>
      {stats.stories.length
        ? (
          <ul className="archive">
            {stats.stories.map((s, i) => (
              <li key={i}>
                <div>
                  <p className="archive-line"><b>{s.name}</b> used <i>{s.word}</i> <span className="tag">{shortDate(s.date)}</span></p>
                  <p className="archive-note">“{s.text}”</p>
                </div>
              </li>
            ))}
          </ul>
        )
        : <p className="slip">No stories yet.</p>}

      <button type="button" className="chip chip-quiet" onClick={() => { save(''); setPassword(''); setStats(null); setDraft(''); }}>
        Forget the password on this device
      </button>
    </section>
  );
}
