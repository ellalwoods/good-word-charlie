import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import words from './data/words.json';
import { dismiss, ensureToday } from './lib/daily';
import { markCheer, markUsed, nameOf, news, setProfile, usedOn, type Friend } from './lib/friends';
import { addDays, longDate, today } from './lib/dates';
import { recordPractised, redoSession, shuffleTest, startSession, type Session } from './lib/session';
import { device, fresh } from './lib/storage';
import { remote } from './lib/supabase';
import { cleanKey, Sync } from './lib/sync';
import type { State, Word } from './lib/types';
import { usable } from './lib/validate';
import { Friends } from './views/Friends';
import { Lexicon } from './views/Lexicon';
import { Practice } from './views/Practice';
import { Sync as SyncView, syncLabel } from './views/Sync';
import { Today } from './views/Today';
import { Welcome } from './views/Welcome';

const bank = usable(words as Word[]);
const numbers = new Map(bank.map((w, i) => [w.word, i + 1]));
const number = (w: string) => numbers.get(w) ?? 0;

type Tab = 'today' | 'lexicon' | 'sync' | 'friends';

const sync = new Sync(remote, device);

/** Nothing worth keeping yet: no answers, dismissals or finished days. */
const blank = (s: State) =>
  !Object.keys(s.done).length && !Object.keys(s.known).length && !Object.keys(s.rejected).length
  && Object.values(s.cards).every(c => c.right + c.wrong === 0);

// Opening a sync link joins it. A device with nothing on it yet just takes the link's progress.
const join = (key: string) => {
  if (blank(sync.get().state)) sync.update(fresh());
  return sync.join(key);
};
const fromLink = location.hash.length > 1 ? cleanKey(location.hash) : null;
if (fromLink && fromLink !== sync.get().key) join(fromLink);
else { sync.start(); if (sync.get().key) device.writeKey(sync.get().key); }
window.addEventListener('online', sync.wake);

// Friends' uses already looked at today, so the header only counts new ones.
const SEEN = 'good-word-charlie-seen';
function readSeen(date: string): string[] {
  try { const s = JSON.parse(localStorage.getItem(SEEN) || 'null'); return s?.date === date ? s.ids : []; } catch { return []; }
}
function writeSeen(date: string, ids: string[]) {
  try { localStorage.setItem(SEEN, JSON.stringify({ date, ids })); } catch { /* storage blocked */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync.wake(); });

export default function App() {
  const snap = useSyncExternalStore(sync.subscribe, sync.get);
  const state = snap.state;
  // When linked, wait for the first sync before picking today's words, so they follow on from the other device.
  const settled = snap.status !== 'saving' || Object.keys(state.days).length > 0;
  const [tab, setTab] = useState<Tab>('today');
  const [session, setSession] = useState<Session | null>(null);
  const [from, setFrom] = useState<Tab>('today');
  const [date, setDate] = useState(today);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [friendsFailed, setFriendsFailed] = useState(false);
  const [seen, setSeen] = useState(() => readSeen(today()));
  const name = nameOf(state);

  const update = (next: State) => sync.update({ ...next, updated: Date.now() });

  // Roll over to a new day when the app comes back from the background after midnight.
  useEffect(() => {
    const check = () => { if (document.visibilityState === 'visible') setDate(today()); };
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);

  useEffect(() => {
    if (!settled || session) return;
    const next = ensureToday(state, bank, date);
    if (next !== state) update(next);
  }, [date, settled, state, session]);

  // Friends are fetched when the site opens or comes back into view, and when the Friends page opens.
  const loadFriends = () => {
    const key = sync.get().key;
    if (!remote || !key || !nameOf(sync.get().state)) return;
    remote.friends(key, addDays(today(), -1))
      .then(f => { setFriends(f); setFriendsFailed(false); })
      .catch(() => setFriendsFailed(true));
  };
  useEffect(loadFriends, [snap.key, name, date, tab]);
  useEffect(() => {
    const check = () => { if (document.visibilityState === 'visible') loadFriends(); };
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);

  const uses = friends ? news(friends, date) : [];
  const unseen = uses.filter(id => !seen.includes(id)).length;
  useEffect(() => {
    if (tab === 'friends' && unseen) { setSeen(uses); writeSeen(date, uses); }
  }, [tab, unseen]);

  const used = usedOn(state.used, date);
  const toggleUsed = (w: string) => update(markUsed(state, w, date, !used.includes(w)));

  const joinFriends = async (n: string, color: string) => {
    if (!sync.get().key) await sync.link();
    update(setProfile(sync.get().state, n, color));
    setTimeout(loadFriends, 1500);   // once the name has saved
  };

  // The welcome card sits over everything until it's dismissed.
  const welcoming = settled && !state.welcomed;

  const heading = useMemo(() => longDate(new Date(`${date}T12:00`)), [date]);

  const go = (t: Tab) => { setSession(null); setTab(t); window.scrollTo(0, 0); };
  const begin = (s: Session, origin: Tab) => { setFrom(origin); setSession(s); window.scrollTo(0, 0); };

  return (
    <>
      <header className="masthead" inert={welcoming}>
        <span className="overprint" aria-hidden="true" />
        <div className="masthead-inner">
          <div className="masthead-top">
            <p className="date tag">{heading}</p>
            {snap.status !== 'off' && (
              <button type="button" className="friends-btn" aria-current={tab === 'friends' && !session} onClick={() => go('friends')}>
                Friends{unseen > 0 && <span className="badge" aria-label={`${unseen} new`}>{unseen}</span>}
              </button>
            )}
          </div>
          <h1>Good Word, Charlie</h1>
          <nav className="tabs" aria-label="Sections">
            <button type="button" aria-current={tab === 'today' && !session} onClick={() => go('today')}>Today</button>
            <button type="button" aria-current={tab === 'lexicon'} onClick={() => go('lexicon')}>Lexicon</button>
          </nav>
        </div>
      </header>

      <main className="page" inert={welcoming}>
        {!settled ? null
          : session ? (
            <Practice start={session} state={state} bank={bank} number={number} date={date}
              onState={update} onDone={() => go(from)} />
          ) : tab === 'today' ? (
            <Today state={state} bank={bank} number={number} date={date}
              onDismiss={(w, why) => update(dismiss(state, bank, w, why, date))}
              onPractise={() => {
                const s = startSession(state, bank, date);
                update(recordPractised(state, s, date));
                begin(s, 'today');
              }}
              onRedo={() => begin(redoSession(state, bank, date), 'today')}
              used={used} onUsed={toggleUsed} />
          ) : tab === 'friends' ? (
            <Friends snap={snap} state={state} bank={bank} date={date} friends={friends} failed={friendsFailed}
              onProfile={joinFriends} onLeave={() => { update(setProfile(state, '', state.name?.color ?? 'pink')); setFriends(null); }}
              onUsed={toggleUsed} onCheer={(n, w, yes) => update(markCheer(state, n, w, date, yes))} />
          ) : tab === 'sync' ? (
            <SyncView snap={snap} onLink={() => sync.link()} onJoin={join} onUnlink={() => sync.unlink()} />
          ) : (
            <Lexicon state={state} bank={bank} number={number} date={date}
              onTest={(words, questions) => begin(shuffleTest(state, bank, words, questions), 'lexicon')}
              used={used} onUsed={toggleUsed} />
          )}
        {settled && !session && tab !== 'sync' && tab !== 'friends' && (
          <footer className="foot">
            <button type="button" className="chip" onClick={() => go('sync')}>Sync devices · {syncLabel(snap)}</button>
          </footer>
        )}
      </main>
      {welcoming && <Welcome onDone={() => update({ ...state, welcomed: true })} />}
    </>
  );
}
