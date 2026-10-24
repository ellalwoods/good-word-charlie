import { useEffect, useState } from 'react';
import { streak } from '../lib/daily';
import { celebrators, colorOf, COLORS, isFresh, NOTE_MAX, usedCount, useId, uses, type Friend, type Use } from '../lib/friends';
import { shortDate } from '../lib/dates';
import type { Snapshot } from '../lib/sync';
import type { State, Word } from '../lib/types';
import { Burst } from './Burst';

interface Props {
  snap: Snapshot;
  state: State;
  bank: Word[];
  date: string;
  friends: Friend[] | null;
  failed: boolean;
  /** News that arrived since you last looked: these pop in with confetti. */
  fresh: string[];
  onProfile: (name: string, color: string) => Promise<unknown>;
  /** Become someone who has already joined (you, on a new device). */
  onClaim: (name: string) => Promise<unknown>;
  onLeave: () => void;
  onUsed: (word: string, date: string, yes: boolean) => void;
  onNote: (word: string, date: string, text: string) => void;
  onCheer: (name: string, word: string, date: string, yes: boolean) => void;
}

/** "Just now", "20 min ago", "5 hours ago". */
function ago(at: number): string {
  const min = Math.floor((Date.now() - at) / 60000);
  if (min < 2) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return `${h} hour${h === 1 ? '' : 's'} ago`;
}

const list = (items: string[]) =>
  items.map((w, i) => <span key={w}>{i > 0 && (i === items.length - 1 ? ' and ' : ', ')}{w}</span>);

function Avatar({ friend, big }: { friend: { name: string; color: string | null }; big?: boolean }) {
  return <span className={`avatar c-${colorOf(friend.color)}${big ? ' avatar-big' : ''}`} aria-hidden="true">{friend.name.slice(0, 1).toUpperCase()}</span>;
}

/** Name and colour: the first time, and whenever you change them. */
function Setup({ name, color, taken = [], onSave, onCancel, onClaim }: {
  name: string; color: string; taken?: string[]; onSave: Props['onProfile']; onCancel?: () => void; onClaim?: Props['onClaim'];
}) {
  const [draft, setDraft] = useState(name);
  const [pick, setPick] = useState(color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const clash = taken.some(t => t.trim().toLowerCase() === draft.trim().toLowerCase() && t.trim().toLowerCase() !== name.trim().toLowerCase());
  const claim = async () => {
    if (!onClaim) return;
    setBusy(true); setError('');
    try { await onClaim(taken.find(t => t.trim().toLowerCase() === draft.trim().toLowerCase()) ?? draft.trim()); }
    catch (e) { setError(claimError(e)); }
    setBusy(false);
  };
  const save = async () => {
    setBusy(true); setError('');
    try { await onSave(draft, pick); } catch { setError('Couldn’t reach the server. Try again in a moment.'); }
    setBusy(false);
  };
  return (
    <section className="sync">
      {!name && <p className="lede">Used one of your words out loud, or in a message? Say so here, and your friends get to celebrate.</p>}
      <article className="card">
        <div className="band"><span>{name ? 'Your profile' : 'Join in'}</span></div>
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
          {clash && (
            <div className="sync-warn">
              <p className="small-print">Someone called {draft.trim()} is already here.</p>
              {onClaim && !name && (
                <button type="button" className="chip" disabled={busy} onClick={claim}>That’s me, I’m {taken.find(t => t.trim().toLowerCase() === draft.trim().toLowerCase())}</button>
              )}
            </div>
          )}
          <div className="card-actions">
            <button type="button" className="chip" disabled={!draft.trim() || clash || busy} onClick={save}>{name ? 'Save' : 'Join'}</button>
            {onCancel && <button type="button" className="chip chip-quiet" onClick={onCancel}>Cancel</button>}
          </div>
          <p className="small-print">Friends see your name and colour, the words you’ve used (and any story you add), what you’ve celebrated, and how many words and days you’ve practised.</p>
        </div>
      </article>
      {error && <p className="slip sync-error">{error}</p>}
    </section>
  );
}

/** Why "That's me" didn't work, in words someone can act on. */
export function claimError(e: unknown): string {
  const msg = String((e as { message?: string })?.message ?? e);
  if (/charlie_claim|PGRST202|function/i.test(msg)) return 'This needs the latest Supabase setup. Tell Ella (run the charlie_claim SQL).';
  if (/not found/i.test(msg)) return 'Couldn’t find that person. Try again in a moment.';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'You’re offline. Try again when you’re connected.';
  return `That didn’t work: ${msg}`;
}

/** Everyone who's joined: tap yourself to carry on as you on this device. */
function AlreadyJoined({ people, onClaim }: { people: Friend[]; onClaim: Props['onClaim'] }) {
  const [pick, setPick] = useState<Friend | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const yes = async () => {
    if (!pick) return;
    setBusy(true); setError('');
    try { await onClaim(pick.name); } catch (e) { setError(claimError(e)); }
    setBusy(false);
  };
  return (
    <article className="card">
      <div className="band"><span>Already joined?</span></div>
      <div className="ruled">
        <p className="small-print">Tap yourself to carry on where you left off.</p>
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
          <div className="card-actions">
            <button type="button" className="chip" disabled={busy} onClick={yes}>{busy ? 'One moment…' : `Yes, I’m ${pick.name}`}</button>
            <button type="button" className="chip chip-quiet" onClick={() => setPick(null)}>No</button>
          </div>
        )}
        {error && <p className="small-print sync-warn">{error}</p>}
      </div>
    </article>
  );
}

/** Someone's card: a few numbers and the words they've used lately. */
function Profile({ friend, date, onClose }: { friend: Friend; date: string; onClose: () => void }) {
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, []);
  const done = friend.done;
  const days = done ? streak({ done: Object.fromEntries(done.map(d => [d, true])) } as unknown as State, date) : null;
  const recent = uses([friend]).slice(0, 5);
  const n = (v: number | null | undefined) => (v === null || v === undefined ? '–' : v);
  return (
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="profile-title" onClick={onClose}>
      <article className={`card profile c-${colorOf(friend.color)}`} onClick={e => e.stopPropagation()}>
        <div className="band"><span id="profile-title">{friend.mine ? 'You' : friend.name}</span></div>
        <div className="ruled">
          <div className="profile-head">
            <Avatar friend={friend} big />
            <h3 className="hw">{friend.name}</h3>
          </div>
          <section className="stats profile-stats" aria-label="Stats">
            <div className="stat"><b>{n(friend.learned)}</b><span className="tag">Words learned</span></div>
            <div className="stat stat-yellow"><b>{n(days)}</b><span className="tag">Day streak</span></div>
            <div className="stat"><b>{n(done?.length)}</b><span className="tag">Days practised</span></div>
            <div className="stat stat-pink"><b>{usedCount(friend)}</b><span className="tag">Words used</span></div>
          </section>
          {recent.length > 0 && (
            <>
              <h4 className="tag welcome-how">Lately used</h4>
              <p className="sense profile-words">{recent.map(u => u.word).map((w, i) => <span key={i}>{i > 0 && ', '}<i>{w}</i></span>)}</p>
            </>
          )}
          <div className="card-actions">
            <button type="button" className="btn btn-quiet profile-close" onClick={onClose}>Close</button>
          </div>
        </div>
      </article>
    </div>
  );
}

function StoryField({ word, initial, onSave, onCancel, saveLabel, cancelLabel }: {
  word: string; initial: string; onSave: (text: string) => void; onCancel: () => void; saveLabel: string; cancelLabel: string;
}) {
  const [text, setText] = useState(initial);
  return (
    <div className="story">
      <label className="tag" htmlFor={`story-${word}`}>How did you use <i>{word}</i>?</label>
      <textarea id={`story-${word}`} className="field" rows={3} maxLength={NOTE_MAX} value={text}
        placeholder="Where were you, who was there, did anyone notice?" onChange={e => setText(e.target.value)} />
      <div className="card-actions">
        <button type="button" className="chip" onClick={() => onSave(text)}>{saveLabel}</button>
        <button type="button" className="chip chip-quiet" onClick={onCancel}>{cancelLabel}</button>
      </div>
    </div>
  );
}

/** Your words as little boxes, with a search; then, if you like, the story. */
function Picker({ words, onShare, onClose }: { words: string[]; onShare: (word: string, story: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const shown = words.filter(w => w.includes(q.trim().toLowerCase()));
  return (
    <article className="card picker">
      <div className="band"><span>{picked ? 'Tell the story' : 'Which word?'}</span><span>{picked ? 'Optional' : `${words.length} met`}</span></div>
      <div className="ruled">
        {picked
          ? <StoryField word={picked} initial="" saveLabel="Share" cancelLabel="Skip the story"
              onSave={text => onShare(picked, text)} onCancel={() => onShare(picked, '')} />
          : <>
            <input className="field" type="search" placeholder="Search your words" value={q} onChange={e => setQ(e.target.value)}
              aria-label="Search your words" autoCapitalize="off" spellCheck={false} />
            {words.length
              ? (
                <div className="word-boxes">
                  {shown.map(w => <button key={w} type="button" className="word-box" onClick={() => setPicked(w)}>{w}</button>)}
                  {!shown.length && <p className="small-print">No word matches “{q}”.</p>}
                </div>
              )
              : <p className="small-print">Your words appear here once you’ve met them on Today.</p>}
            <div className="card-actions">
              <button type="button" className="chip chip-quiet" onClick={onClose}>Close</button>
            </div>
          </>}
      </div>
    </article>
  );
}

function UseCard({ use, people, fresh, mineCheered, onUsed, onNote, onCheer }: {
  use: Use; people: Friend[]; fresh: string[]; mineCheered: boolean;
  onUsed: Props['onUsed']; onNote: Props['onNote']; onCheer: Props['onCheer'];
}) {
  const { friend: f, word: w, date, note } = use;
  const [bursts, setBursts] = useState(0);
  const [editing, setEditing] = useState(false);
  const cheered = celebrators(people, f.name, w, date);
  // New to you: a friend's use, or a friend celebrating yours.
  const isNew = fresh.includes(useId(use)) || cheered.some(c => fresh.includes(`cheer:${c.name}:${date}:${f.name}:${w}`));
  const who = f.mine ? 'You' : f.name;
  return (
    <article className={`card use c-${colorOf(f.color)}${isNew ? ' pop' : ''}`}>
      <div className="band"><span>{who}</span><span>{ago(use.at)}</span></div>
      <div className="ruled">
        <span className="confetti" aria-hidden="true" />
        {isNew && <Burst className="burst-head" />}
        <h3 className="hw">Good word, {f.name}!</h3>
        <p className="sense">{who} used <i>{w}</i>.</p>
        {note && !editing && <p className="example story-text">{note}</p>}
        {editing && (
          <StoryField word={w} initial={note} saveLabel="Save" cancelLabel="Cancel"
            onSave={text => { onNote(w, date, text); setEditing(false); }} onCancel={() => setEditing(false)} />
        )}
        {cheered.length > 0 && (
          <p className={`cheered${isNew && f.mine ? ' cheered-new' : ''}`}>
            {list(cheered.map(c => (c.mine ? 'You' : c.name)))} celebrated <i>{w}</i>.
          </p>
        )}
        {f.mine
          ? !editing && (
            <p className="own-links">
              <button type="button" className="link whoops" onClick={() => setEditing(true)}>{note ? 'Edit the story' : 'Add the story'}</button>
              <button type="button" className="link whoops" onClick={() => onUsed(w, date, false)}>Whoops! Remove</button>
            </p>
          )
          : (
            <div className="card-actions">
              <span className="cheer-wrap">
                <button type="button" className="chip chip-cheer" aria-pressed={mineCheered}
                  onClick={() => { if (!mineCheered) setBursts(n => n + 1); onCheer(f.name, w, date, !mineCheered); }}>
                  {mineCheered ? 'Celebrated 🎉' : 'Celebrate'}
                </button>
                {bursts > 0 && <Burst key={bursts} />}
              </span>
            </div>
          )}
      </div>
    </article>
  );
}

/** Older uses, a line each, newest first. */
function Archive({ items, people, onBack }: { items: Use[]; people: Friend[]; onBack: () => void }) {
  const days = [...new Set(items.map(u => u.date))];
  return (
    <section className="sync">
      <button type="button" className="btn btn-quiet archive-back" onClick={onBack}>Back to friends</button>
      {!items.length && <p className="slip">Nothing here yet. Words move here 24 hours after they’re shared.</p>}
      {days.map(d => (
        <div key={d}>
          <h2 className="tag section-label">{shortDate(d)}</h2>
          <ul className="archive">
            {items.filter(u => u.date === d).map(u => {
              const cheered = celebrators(people, u.friend.name, u.word, u.date);
              return (
                <li key={useId(u)} className={`c-${colorOf(u.friend.color)}`}>
                  <Avatar friend={u.friend} />
                  <div>
                    <p className="archive-line"><b>{u.friend.mine ? 'You' : u.friend.name}</b> used <i>{u.word}</i></p>
                    {u.note && <p className="archive-note">“{u.note}”</p>}
                    {cheered.length > 0 && <p className="tag">Celebrated by {list(cheered.map(c => (c.mine ? 'you' : c.name)))}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

export function Friends({ snap, state, bank, date, friends, failed, fresh, onProfile, onClaim, onLeave, onUsed, onNote, onCheer }: Props) {
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [archive, setArchive] = useState(false);
  const [viewing, setViewing] = useState<Friend | null>(null);
  const name = state.name?.value ?? '';
  const color = colorOf(state.name?.color);

  if (snap.status === 'off') return <p className="slip">Friends isn’t switched on for this site yet. Tell Ella.</p>;
  const taken = (friends ?? []).filter(f => !f.mine).map(f => f.name);
  if (!name) {
    const others = (friends ?? []).filter(f => !f.mine);
    return (
      <>
        <Setup name="" color="pink" taken={taken} onSave={onProfile} onClaim={onClaim} />
        {others.length > 0 && <div className="already"><AlreadyJoined people={others} onClaim={onClaim} /></div>}
        {failed && !friends && <p className="slip sync-error">Couldn’t load who’s already joined. Check the connection.</p>}
      </>
    );
  }
  if (editing) return <Setup name={name} color={color} taken={taken} onSave={async (n, c) => { await onProfile(n, c); setEditing(false); }} onCancel={() => setEditing(false)} />;

  // Your own entry comes from this device, so your taps show straight away.
  const me: Friend = {
    name, color, used: state.used ?? {}, cheers: state.cheers ?? {}, notes: state.notes ?? {}, mine: true,
    learned: Object.keys(state.cards).filter(w => bank.some(b => b.word === w)).length, done: Object.keys(state.done),
  };
  const people = [me, ...(friends ?? []).filter(f => !f.mine && f.name !== name)];
  const all = uses(people);
  const now = Date.now();

  if (archive) return <Archive items={all.filter(u => !isFresh(u, now))} people={people} onBack={() => setArchive(false)} />;

  const current = all.filter(u => isFresh(u, now));
  const met = bank.filter(w => state.cards[w.word] || state.known[w.word]).map(w => w.word).sort();

  return (
    <section className="sync">
      <button type="button" className="btn" onClick={() => setPicking(!picking)}>
        I used a word
        <span className="btn-sub">Tell your friends</span>
      </button>
      {picking && (
        <Picker words={met} onClose={() => setPicking(false)}
          onShare={(w, story) => { onUsed(w, date, true); if (story.trim()) onNote(w, date, story); setPicking(false); }} />
      )}

      {failed && !friends && <p className="slip sync-error">Couldn’t load your friends just now. Check the connection.</p>}
      {!current.length && <p className="slip">No one’s used a word in the last day. Be the first.</p>}
      <div className="cards">
        {current.map(u => (
          <UseCard key={useId(u)} use={u} people={people} fresh={fresh}
            mineCheered={me.cheers[u.date]?.[`${u.friend.name}:${u.word}`] > 0}
            onUsed={onUsed} onNote={onNote} onCheer={onCheer} />
        ))}
      </div>

      <div>
        <h2 className="tag section-label">Friends · tap for stats</h2>
        <ul className="roster">
          {people.map(f => (
            <li key={f.name}>
              <button type="button" className="who" onClick={() => setViewing(f)} aria-label={`${f.mine ? 'Your' : `${f.name}’s`} stats`}>
                <Avatar friend={f} big />
                <span className="tag">{f.mine ? 'You' : f.name}</span>
              </button>
            </li>
          ))}
        </ul>
        {friends && people.length === 1 && <p className="small-print">No one else has joined yet.</p>}
        <p className="small-print">
          You’re here as <b>{name}</b>. <button type="button" className="link" onClick={() => setEditing(true)}>Change name or colour</button>
          {' · '}<button type="button" className="link" onClick={onLeave}>Leave friends</button>
        </p>
        <button type="button" className="chip chip-quiet archive-btn" onClick={() => { setArchive(true); window.scrollTo(0, 0); }}>
          Archive · {all.length - current.length} older
        </button>
      </div>
      {viewing && <Profile friend={viewing} date={date} onClose={() => setViewing(null)} />}
    </section>
  );
}
