import { useState } from 'react';
import { celebrators, colorOf, COLORS, isFresh, NOTE_MAX, useId, uses, type Friend, type Use } from '../lib/friends';
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
function Setup({ name, color, onSave, onCancel }: { name: string; color: string; onSave: Props['onProfile']; onCancel?: () => void }) {
  const [draft, setDraft] = useState(name);
  const [pick, setPick] = useState(color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    try { await onSave(draft, pick); } catch { setError('Couldn’t reach the server. Try again in a moment.'); }
    setBusy(false);
  };
  return (
    <section className="sync">
      {!onCancel && <p className="lede">Used one of your words out loud, or in a message? Say so here, and your friends get to celebrate.</p>}
      <article className="card">
        <div className="band"><span>{onCancel ? 'Your profile' : 'Join in'}</span></div>
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
          <div className="card-actions">
            <button type="button" className="chip" disabled={!draft.trim() || busy} onClick={save}>{onCancel ? 'Save' : 'Join'}</button>
            {onCancel && <button type="button" className="chip chip-quiet" onClick={onCancel}>Cancel</button>}
          </div>
          <p className="small-print">Friends see your name, your colour, the words you’ve used (and any story you add) and what you’ve celebrated. Nothing else.</p>
        </div>
      </article>
      {error && <p className="slip sync-error">{error}</p>}
    </section>
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

export function Friends({ snap, state, bank, date, friends, failed, fresh, onProfile, onLeave, onUsed, onNote, onCheer }: Props) {
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [archive, setArchive] = useState(false);
  const name = state.name?.value ?? '';
  const color = colorOf(state.name?.color);

  if (snap.status === 'off') return <p className="slip">Friends isn’t switched on for this site yet. Tell Ella.</p>;
  if (!name) return <Setup name="" color="pink" onSave={onProfile} />;
  if (editing) return <Setup name={name} color={color} onSave={async (n, c) => { await onProfile(n, c); setEditing(false); }} onCancel={() => setEditing(false)} />;

  // Your own entry comes from this device, so your taps show straight away.
  const me: Friend = { name, color, used: state.used ?? {}, cheers: state.cheers ?? {}, notes: state.notes ?? {}, mine: true };
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
        <h2 className="tag section-label">Friends</h2>
        <ul className="roster">
          {people.map(f => (
            <li key={f.name}>
              <Avatar friend={f} big />
              <span className="tag">{f.mine ? 'You' : f.name}</span>
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
    </section>
  );
}
