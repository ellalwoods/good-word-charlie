import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import words from './data/words.json';
import { dismiss, ensureToday, tidyDays } from './lib/daily';
import { combine, markCheer, markUsed, nameOf, news, setNote, setProfile, usedOn, type Friend } from './lib/friends';
import { longDate, today } from './lib/dates';
import { recordPractised, redoSession, shuffleTest, startSession, type Session } from './lib/session';
import { device, fresh, linkManifest } from './lib/storage';
import { remote } from './lib/supabase';
import { cleanKey, Sync } from './lib/sync';
import type { State, Word } from './lib/types';
import { usable } from './lib/validate';
import { Friends } from './views/Friends';
import { Lexicon } from './views/Lexicon';
import { Practice } from './views/Practice';
import { Sync as SyncView, syncLabel } from './views/Sync';
import { Today } from './views/Today';
import { InstallHelp, installed, useInstall } from './views/Install';
import { Stats } from './views/Stats';
import { TextElla } from './views/TextElla';
import { Welcome } from './views/Welcome';
import { WhoAreYou } from './views/WhoAreYou';

const bank = usable(words as Word[]);
const numbers = new Map(bank.map((w, i) => [w.word, i + 1]));
const number = (w: string) => numbers.get(w) ?? 0;

type Tab = 'today' | 'lexicon' | 'sync' | 'friends' | 'stats';

const sync = new Sync(remote, device);

/** Nothing worth keeping yet: no answers, dismissals or finished days. */
const blank = (s: State) =>
  !Object.keys(s.done).length && !Object.keys(s.known).length && !Object.keys(s.rejected).length
  && Object.values(s.cards).every(c => c.right + c.wrong === 0);

// Opening a sync link joins it. A device with nothing on it yet just takes the link's progress.
// This device's progress is added to it; its name comes from the link (you, from another device).
const join = (key: string) => {
  const s = sync.get().state;
  if (blank(s)) sync.update(fresh());
  else if (s.name) sync.update({ ...s, name: undefined });
  return sync.join(key);
};
const fromLink = location.hash.length > 1 ? cleanKey(location.hash) : null;
// The link this device opened with; if its record has been deleted, the device starts over as nobody.
const startKey = fromLink ?? sync.get().key;
if (fromLink && fromLink !== sync.get().key) join(fromLink);
else { sync.start(); if (sync.get().key) device.writeKey(sync.get().key); }
linkManifest(sync.get().key ?? fromLink);
// Ask the browser not to clear progress to save space.
navigator.storage?.persist?.().catch(() => {});
window.addEventListener('online', sync.wake);

// Friends' news already looked at, so the header only counts new things.
const SEEN = 'good-word-charlie-seen-v2';
const ASKED = 'good-word-charlie-asked';
const WELCOMED = 'good-word-charlie-welcomed';
const flag = (k: string) => { try { return !!localStorage.getItem(k); } catch { return false; } };
const setFlag = (k: string) => { try { localStorage.setItem(k, '1'); } catch { /* storage blocked */ } };
// The welcome is shown once per device, so a new device always starts with it, then "Who are you?".
// Devices that read it before this was per device keep it read.
if (device.read().welcomed) setFlag(WELCOMED);
function readSeen(): string[] {
  try { const s = JSON.parse(localStorage.getItem(SEEN) || '[]'); return Array.isArray(s) ? s : []; } catch { return []; }
}
function writeSeen(ids: string[]) {
  try { localStorage.setItem(SEEN, JSON.stringify(ids.slice(-300))); } catch { /* storage blocked */ }
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
  const [seen, setSeen] = useState(readSeen);
  const [fresh, setFresh] = useState<string[]>([]);
  const name = nameOf(state);

  const update = (next: State) => sync.update({ ...next, updated: Date.now() });
  // The newest progress, including changes made earlier in the same tap (e.g. a word and its story).
  const latest = () => sync.get().state;

  // Roll over to a new day when the app comes back from the background after midnight.
  useEffect(() => {
    const check = () => { if (document.visibilityState === 'visible') setDate(today()); };
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);

  useEffect(() => {
    if (!settled || session) return;
    const next = ensureToday(tidyDays(state), bank, date);
    if (next !== state) update(next);
  }, [date, settled, state, session]);

  // Friends are fetched when the site opens or comes back into view, and when the Friends page opens.
  const loadFriends = () => {
    if (!remote) return;
    remote.friends(sync.get().key ?? '', '')
      .then(f => { setFriends(combine(f)); setFriendsFailed(false); })
      .catch(() => setFriendsFailed(true));
  };
  useEffect(loadFriends, [snap.key, name, date, tab]);
  useEffect(() => {
    const check = () => { if (document.visibilityState === 'visible') loadFriends(); };
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);

  const newsIds = friends ? news(friends, Date.now()) : [];
  const unseenIds = newsIds.filter(id => !seen.includes(id));
  const unseen = unseenIds.length;
  // Opening Friends marks the news as seen, and those cards pop in with confetti.
  useEffect(() => {
    if (tab !== 'friends' || !unseen) return;
    setFresh(f => [...f, ...unseenIds]);
    const next = [...seen, ...unseenIds];
    setSeen(next);
    writeSeen(next);
  }, [tab, unseen]);

  const used = usedOn(state.used, date);
  const toggleUsed = (w: string) => update(markUsed(state, w, date, !used.includes(w)));

  // Become someone who has already joined: you, on a new device.
  const claim = async (n: string) => {
    const key = await remote!.claim(n);
    if (!key) throw new Error('not found');
    await join(key);
    if (sync.get().status === 'invalid') throw new Error('not found');
  };

  const joinFriends = async (n: string, color: string) => {
    if (!sync.get().key) await sync.link();
    update(setProfile(sync.get().state, n, color));
    setTimeout(loadFriends, 1500);   // once the name has saved
  };

  useEffect(() => {
    if (snap.status !== 'invalid' || snap.key !== startKey) return;
    sync.unlink();
    sync.update({ ...sync.get().state, name: undefined });
  }, [snap.status]);

  // The welcome card sits over everything until it's dismissed.
  const [welcomedHere, setWelcomedHere] = useState(() => flag(WELCOMED));
  const welcoming = settled && !welcomedHere;
  const install = useInstall();
  // Then, on a device that doesn't know you: are you one of these people? Asked once per device.
  const [asked, setAsked] = useState(() => flag(ASKED));
  const doneAsking = () => { setAsked(true); setFlag(ASKED); };
  // Only when this device doesn't know who you are: not while it's still fetching your account.
  const asking = settled && !welcoming && !asked && !name && snap.status !== 'off' && snap.status !== 'saving'
    && (friends !== null || friendsFailed);
  const blocked = welcoming || install.open || asking;

  const heading = useMemo(() => longDate(new Date(`${date}T12:00`)), [date]);

  const go = (t: Tab) => { setSession(null); setTab(t); window.scrollTo(0, 0); };
  const begin = (s: Session, origin: Tab) => { setFrom(origin); setSession(s); window.scrollTo(0, 0); };

  return (
    <>
      <header className="masthead" inert={blocked}>
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

      <main className="page" inert={blocked}>
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
              onProfile={joinFriends}
              onClaim={claim} onLeave={() => { update(setProfile(state, '', state.name?.color ?? 'pink')); setFriends(null); }}
              fresh={fresh}
              onUsed={(w, d, yes) => update(markUsed(latest(), w, d, yes))}
              onNote={(w, d, text) => update(setNote(latest(), w, d, text))}
              onCheer={(n, w, d, yes) => update(markCheer(latest(), n, w, d, yes))} />
          ) : tab === 'stats' && remote ? (
            <Stats bank={bank} date={date} load={p => remote!.stats(p)} />
          ) : tab === 'sync' ? (
            <SyncView snap={snap} onLink={() => sync.link()} onJoin={join} onUnlink={() => sync.unlink()} />
          ) : (
            <Lexicon state={state} bank={bank} number={number} date={date}
              onTest={(words, questions) => begin(shuffleTest(state, bank, words, questions), 'lexicon')}
              used={used} onUsed={toggleUsed} />
          )}
        {settled && !session && tab !== 'sync' && tab !== 'friends' && tab !== 'stats' && (
          <footer className="foot">
            {!installed() && <button type="button" className="chip" onClick={install.start}>Add to home screen</button>}
            <button type="button" className="chip" onClick={() => go('sync')}>Sync devices · {syncLabel(snap)}</button>
            <TextElla label="Error? Tell Ella" body="Hi Ella, something’s not working on Good Word, Charlie: " />
            {remote && name.trim().toLowerCase() === 'ella' && (
              <button type="button" className="chip chip-quiet" onClick={() => go('stats')}>Ella’s stats</button>
            )}
          </footer>
        )}
      </main>
      {install.open && <InstallHelp onClose={install.close} />}
      {asking && (
        <WhoAreYou people={(friends ?? []).filter(f => !f.mine)} onClaim={async n => { await claim(n); doneAsking(); }}
          onAdd={async (n, c) => { await joinFriends(n, c); doneAsking(); }} onGuest={doneAsking} />
      )}
      {welcoming && <Welcome onDone={() => { setFlag(WELCOMED); setWelcomedHere(true); update({ ...state, welcomed: true }); }} />}
    </>
  );
}
