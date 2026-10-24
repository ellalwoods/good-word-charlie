import { useEffect, useState } from 'react';
import { addDays, shortDate } from '../lib/dates';
import { colorOf } from '../lib/friends';
import { computeStats, type Row, type Stats as S, type Tally } from '../lib/stats';
import type { Word } from '../lib/types';
import { Avatar } from './Friends';
import { Problem } from './TextElla';

// The code is never kept; clear one saved by an earlier version.
try { localStorage.removeItem('good-word-charlie-owner'); } catch { /* storage blocked */ }

const ago = (iso: string) => {
  const h = (Date.now() - Date.parse(iso)) / 36e5;
  if (h < 1) return 'within the hour';
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
};
const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);

const mins = (m: number) => (m < 1 && m > 0 ? '<1' : String(Math.round(m)));

const DAYS = 30;

/** Minutes each day for the last 30 days. Tap a bar for its day. */
function MinutesChart({ byDay, date, color }: { byDay: Record<string, number>; date: string; color: string }) {
  const days = Array.from({ length: DAYS }, (_, i) => addDays(date, i - DAYS + 1));
  const values = days.map(d => byDay[d] ?? 0);
  const max = Math.max(...values, 1);
  const peak = values.indexOf(Math.max(...values));
  const [picked, setPicked] = useState<number | null>(null);
  const shown = picked ?? (values[peak] > 0 ? peak : null);
  const [table, setTable] = useState(false);
  return (
    <div className={`minutes c-${color}`}>
      <p className="minutes-read" aria-live="polite">
        {shown === null ? 'No time recorded in the last 30 days.'
          : <><b>{mins(values[shown])} min</b> on {shortDate(days[shown])}{picked === null ? ' (busiest day)' : ''}</>}
      </p>
      <div className="bars" role="img" aria-label={`Minutes per day for the last ${DAYS} days`}>
        {values.map((v, i) => (
          <button key={days[i]} type="button" className={`bar-hit${i === shown ? ' bar-on' : ''}`}
            onClick={() => setPicked(i === picked ? null : i)} aria-label={`${shortDate(days[i])}: ${mins(v)} minutes`}>
            <span className="bar" style={{ height: `${v ? Math.max(4, (v / max) * 100) : 0}%` }} />
          </button>
        ))}
      </div>
      <div className="bars-axis tag"><span>{shortDate(days[0])}</span><span>Today</span></div>
      <button type="button" className="link whoops" onClick={() => setTable(!table)}>{table ? 'Hide the list' : 'Show as a list'}</button>
      {table && (
        <ul className="minutes-list">
          {days.map((d, i) => ({ d, v: values[i] })).filter(x => x.v > 0).reverse()
            .map(x => <li key={x.d}><span>{shortDate(x.d)}</span><span>{mins(x.v)} min</span></li>)}
        </ul>
      )}
    </div>
  );
}

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

/** Four boxes for the four-digit code. It checks itself as soon as the fourth digit goes in. */
function Pin({ onCode, wrong, busy }: { onCode: (code: string) => void; wrong: number; busy: boolean }) {
  const [code, setCode] = useState('');
  useEffect(() => { if (wrong) setCode(''); }, [wrong]);
  return (
    <label className={`pin${wrong ? ' pin-wrong' : ''}`} key={wrong}>
      <input className="pin-input" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" autoFocus maxLength={4}
        value={code} disabled={busy} aria-label="Four-digit code"
        onChange={e => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 4);
          setCode(v);
          if (v.length === 4) onCode(v);
        }} />
      {[0, 1, 2, 3].map(i => (
        <span key={i} className={`pin-box${i === code.length ? ' pin-next' : ''}`} aria-hidden="true">{code[i] ? '●' : ''}</span>
      ))}
    </label>
  );
}

/** Ella's stats: how everyone's using the site. Behind a four-digit code checked by Supabase, asked every time. */
export function Stats({ bank, date, load }: { bank: Word[]; date: string; load: (password: string) => Promise<Row[] | null> }) {
  const [stats, setStats] = useState<S | null>(null);
  const [state, setState] = useState<'locked' | 'loading' | 'failed' | 'open'>('locked');
  const [wrong, setWrong] = useState(0);
  const [chart, setChart] = useState<string | null>(null);

  const open = async (code: string) => {
    setState('loading');
    try {
      const rows = await load(code);
      if (!rows) { setWrong(n => n + 1); setState('locked'); return; }
      setStats(computeStats(rows, bank, date)); setState('open');
    } catch { setState('failed'); }
  };

  if (state === 'locked' || (state === 'loading' && !stats)) {
    return (
      <section className="sync">
        <article className="card lock">
          <div className="band"><span>Ella’s stats</span><span>Private</span></div>
          <div className="ruled">
            <h3 className="hw lock-title">Nice try, biatch!</h3>
            <p className="sense">These are <b>MY</b> stats.</p>
            <Pin onCode={open} wrong={wrong} busy={state === 'loading'} />
            <p className="small-print lock-note">{wrong ? 'Nope. Try again.' : 'Enter the code.'}</p>
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
      <p className="small-print">Everyone together: <b>{mins(stats.people.reduce((n, p) => n + p.minutesWeek, 0))} minutes</b> on the site in the last 7 days.</p>
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
                <div><dt>Minutes, all</dt><dd>{mins(p.minutes)}</dd></div>
                <div><dt>Minutes, 7 days</dt><dd>{mins(p.minutesWeek)}</dd></div>
              </dl>
              <button type="button" className="chip chip-quiet minutes-btn" aria-expanded={chart === p.name}
                onClick={() => setChart(chart === p.name ? null : p.name)}>
                {chart === p.name ? 'Hide minutes by day' : 'Minutes by day'}
              </button>
              {chart === p.name && <MinutesChart byDay={p.byDay} date={date} color={colorOf(p.color)} />}
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

    </section>
  );
}
