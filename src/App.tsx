import { useEffect, useMemo, useState } from 'react';
import words from './data/words.json';
import { dismiss, ensureToday } from './lib/daily';
import { longDate, today } from './lib/dates';
import { recordPractised, redoSession, shuffleTest, startSession, type Session } from './lib/session';
import { store } from './lib/storage';
import type { State, Word } from './lib/types';
import { usable } from './lib/validate';
import { Lexicon } from './views/Lexicon';
import { Practice } from './views/Practice';
import { Today } from './views/Today';

const bank = usable(words as Word[]);
const numbers = new Map(bank.map((w, i) => [w.word, i + 1]));
const number = (w: string) => numbers.get(w) ?? 0;

type Tab = 'today' | 'lexicon';

export default function App() {
  const [state, setState] = useState<State | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [session, setSession] = useState<Session | null>(null);
  const [from, setFrom] = useState<Tab>('today');
  const [date, setDate] = useState(today);

  const update = (next: State) => {
    const s = { ...next, updated: Date.now() };
    setState(s);
    store.save(s);
  };

  useEffect(() => {
    store.load().then(s => update(ensureToday(s, bank, today())));
  }, []);

  // Roll over to a new day when the app comes back from the background after midnight.
  useEffect(() => {
    const check = () => { if (document.visibilityState === 'visible') setDate(today()); };
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);

  useEffect(() => {
    if (state && !session && !state.days[date]) update(ensureToday(state, bank, date));
  }, [date]);

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
        {!state ? null
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
          ) : (
            <Lexicon state={state} bank={bank} number={number} date={date}
              onTest={(words, questions) => begin(shuffleTest(state, bank, words, questions), 'lexicon')} />
          )}
      </main>
    </>
  );
}
