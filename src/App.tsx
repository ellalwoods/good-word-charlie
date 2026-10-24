import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import words from './data/words.json';
import { dismiss, ensureToday } from './lib/daily';
import { longDate, today } from './lib/dates';
import { recordPractised, redoSession, shuffleTest, startSession, type Session } from './lib/session';
import { device, fresh } from './lib/storage';
import { remote } from './lib/supabase';
import { cleanKey, Sync } from './lib/sync';
import type { State, Word } from './lib/types';
import { usable } from './lib/validate';
import { Lexicon } from './views/Lexicon';
import { Practice } from './views/Practice';
import { Sync as SyncView, syncLabel } from './views/Sync';
import { Today } from './views/Today';

const bank = usable(words as Word[]);
const numbers = new Map(bank.map((w, i) => [w.word, i + 1]));
const number = (w: string) => numbers.get(w) ?? 0;

type Tab = 'today' | 'lexicon' | 'sync';

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

  const heading = useMemo(() => longDate(new Date(`${date}T12:00`)), [date]);

  const go = (t: Tab) => { setSession(null); setTab(t); window.scrollTo(0, 0); };
  const begin = (s: Session, origin: Tab) => { setFrom(origin); setSession(s); window.scrollTo(0, 0); };

  return (
    <>
      <header className="masthead">
        <span className="overprint" aria-hidden="true" />
        <div className="masthead-inner">
          <p className="date tag">{heading}</p>
          <h1>Good Word, Charlie</h1>
          <nav className="tabs" aria-label="Sections">
            <button type="button" aria-current={tab === 'today' && !session} onClick={() => go('today')}>Today</button>
            <button type="button" aria-current={tab === 'lexicon'} onClick={() => go('lexicon')}>Lexicon</button>
          </nav>
        </div>
      </header>

      <main className="page">
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
              onRedo={() => begin(redoSession(state, bank, date), 'today')} />
          ) : tab === 'sync' ? (
            <SyncView snap={snap} onLink={() => sync.link()} onJoin={join} onUnlink={() => sync.unlink()} />
          ) : (
            <Lexicon state={state} bank={bank} number={number} date={date}
              onTest={(words, questions) => begin(shuffleTest(state, bank, words, questions), 'lexicon')} />
          )}
        {settled && !session && tab !== 'sync' && (
          <footer className="foot">
            <button type="button" className="chip" onClick={() => go('sync')}>Sync devices · {syncLabel(snap)}</button>
          </footer>
        )}
      </main>
    </>
  );
}
