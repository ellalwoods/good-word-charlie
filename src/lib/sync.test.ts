import { describe, expect, it } from 'vitest';
import words from '../data/words.json';
import { dismiss, ensureToday } from './daily';
import { celebrators, FRESH_FOR, isFresh, markCheer, markUsed, news, setNote, setProfile, usedOn, uses } from './friends';
import { merge, same } from './merge';
import { answer, startSession } from './session';
import { fresh } from './storage';
import { cleanKey, Sync, type Local, type Remote } from './sync';
import type { State, Word } from './types';

const bank = words as Word[];
const D = '2026-10-23';
const fixed = () => 0.5;

/** Answers every question in today's practice, right unless the word is in `miss`. */
function practise(s: State, miss: string[] = []): State {
  let sess = startSession(s, bank, D, fixed);
  for (let j = 0; j < sess.items.length; j++) {
    const it = sess.items[j];
    const r = answer(s, { ...sess, i: j }, bank, miss.includes(it.word) ? it.question.distractors[0] : it.question.answer, D, fixed);
    s = r.state; sess = r.session;
  }
  return s;
}

describe('merge', () => {
  const start = ensureToday(fresh(), bank, D);

  it('keeps the side that has practised more, either way round', () => {
    const done = practise(start);
    expect(merge(start, done).cards.farcical.level).toBe(1);
    expect(same(merge(start, done), merge(done, start))).toBe(true);
    expect(same(merge(done, done), done)).toBe(true);
  });

  it("keeps both devices' work when each did something different", () => {
    const phone = { ...practise(start), done: { [D]: true as const } };
    const laptop = dismiss(start, bank, 'modicum', 'known', D);
    const m = merge(phone, laptop);
    expect(m.known.modicum).toBe(true);
    expect(m.cards.modicum).toBeUndefined();
    expect(m.days[D]).not.toContain('modicum');
    expect(m.cards.farcical.level).toBe(1);
    expect(m.done[D]).toBe(true);
    expect(same(m, merge(laptop, phone))).toBe(true);
  });
});

/** An in-memory server, as Supabase would behave. */
function server() {
  const rows = new Map<string, { data: State; version: number }>();
  const listeners = new Set<() => void>();
  let n = 0, down = false;
  const r: Remote & { rows: typeof rows; down: (d: boolean) => void } = {
    rows,
    down: d => { down = d; },
    async create(data) { const k = `key${++n}`.padEnd(20, 'x'); rows.set(k, { data: structuredClone(data), version: 1 }); return k; },
    async load(key) { if (down) throw new Error('offline'); const row = rows.get(key); return row ? structuredClone(row) : 'invalid'; },
    async save(key, data, expected) {
      if (down) throw new Error('offline');
      const row = rows.get(key);
      if (!row || row.version !== expected) return null;
      rows.set(key, { data: structuredClone(data), version: expected + 1 });
      return expected + 1;
    },
    listen(_key, fn) { listeners.add(fn); return () => listeners.delete(fn); },
    announce() { listeners.forEach(fn => fn()); },
    async stats() { return null; },
    async claim(name) {
      return [...rows].find(([, r]) => r.data.name?.value === name)?.[0] ?? null;
    },
    async friends(key) {
      return [...rows].filter(([, r]) => r.data.name?.value).map(([k, r]) => ({ name: r.data.name!.value, color: r.data.name!.color ?? null, used: r.data.used ?? {}, cheers: r.data.cheers ?? {}, notes: r.data.notes ?? {}, mine: k === key }));
    },
  };
  return r;
}

function memory(state = fresh()): Local & { key: string | null } {
  let s = state;
  const m = {
    key: null as string | null,
    read: () => s,
    write: (x: State) => { s = x; },
    readKey: () => m.key,
    writeKey: (k: string | null) => { m.key = k; },
  };
  return m;
}

const settle = () => new Promise(r => setTimeout(r, 650));

describe("today's words", () => {
  it('stay three after merging two devices that each picked them', () => {
    // The account met words 1–3 yesterday and 4–6 today; a new device dealt itself 1–3 for today.
    const account = ensureToday(ensureToday(fresh(), bank, '2026-10-22'), bank, D);
    const stray = ensureToday(fresh(), bank, D);
    const m = merge(account, stray);
    expect(m.days[D]).toEqual(account.days[D]);
    expect(m.days[D]).toHaveLength(3);
    expect(Object.keys(m.cards)).toHaveLength(6);
  });

  it('put back extra words that were never practised', () => {
    const a = ensureToday(fresh(), bank, D);
    const b = { ...a, days: { [D]: ['glut', 'risible', 'specious'] }, cards: Object.fromEntries(['glut', 'risible', 'specious'].map(w => [w, a.cards.farcical])) };
    const m = merge(a, b);
    expect(m.days[D]).toHaveLength(3);
    expect(Object.keys(m.cards)).toHaveLength(3);
  });
});

describe('friends', () => {
  const start = ensureToday(fresh(), bank, D);

  it('un-tapping "I used it" on one device sticks after merging', async () => {
    const phone = markUsed(start, 'farcical', D, true);
    await new Promise(r => setTimeout(r, 5));
    const later = markUsed(phone, 'farcical', D, false);
    expect(usedOn(merge(phone, later).used, D)).toEqual([]);
    expect(usedOn(merge(later, phone).used, D)).toEqual([]);
    expect(usedOn(merge(start, phone).used, D)).toEqual(['farcical']);
  });

  it('keeps the story, and the latest edit of it', async () => {
    const a = setNote(markUsed(start, 'glut', D, true), 'glut', D, 'At the market, about avocados.');
    await new Promise(r => setTimeout(r, 5));
    const b = setNote(a, 'glut', D, 'At the market. Nobody noticed.');
    expect(merge(start, a).notes?.[D].glut.text).toBe('At the market, about avocados.');
    expect(merge(a, b).notes?.[D].glut.text).toBe('At the market. Nobody noticed.');
    expect(merge(b, a).notes?.[D].glut.text).toBe('At the market. Nobody noticed.');
  });

  it('a use is current for 24 hours, then goes to the archive', () => {
    const s = setNote(markUsed(start, 'glut', D, true), 'glut', D, 'Story');
    const [u] = uses([{ name: 'Ella', color: 'pink', used: s.used!, cheers: {}, notes: s.notes!, mine: true }]);
    expect(u).toMatchObject({ word: 'glut', date: D, note: 'Story' });
    expect(isFresh(u, u.at + FRESH_FOR - 1)).toBe(true);
    expect(isFresh(u, u.at + FRESH_FOR)).toBe(false);
  });

  it('keeps the latest name', async () => {
    const a = setProfile(start, 'Charlie', 'pink');
    await new Promise(r => setTimeout(r, 5));
    const b = setProfile(start, 'Ella', 'blue');
    expect(merge(a, b).name?.value).toBe('Ella');
    expect(merge(b, a).name?.value).toBe('Ella');
  });

  it("shows friends' names and what they used, and nothing else", async () => {
    const srv = server();
    const ella = new Sync(srv, memory(setProfile(markUsed(start, 'paucity', D, true), 'Ella', 'blue')));
    const charlie = new Sync(srv, memory(setProfile(start, 'Charlie', 'pink')));
    await ella.link();
    const key = await charlie.link();
    const friends = await srv.friends(key, D);
    const e = friends.find(f => f.name === 'Ella')!;
    expect(e.mine).toBe(false);
    expect(usedOn(e.used, D)).toEqual(['paucity']);
    expect(friends.find(f => f.name === 'Charlie')!.mine).toBe(true);
    expect(e.color).toBe('blue');
    expect(news(friends, Date.now())).toEqual([`use:Ella:${D}:paucity`]);

    // Charlie celebrates; Ella hears about it.
    charlie.update(markCheer(charlie.get().state, 'Ella', 'paucity', D, true));
    await settle();
    const after = await srv.friends(ella.get().key!, D);
    expect(celebrators(after, 'Ella', 'paucity', D).map(f => f.name)).toEqual(['Charlie']);
    expect(news(after, Date.now())).toContain(`cheer:Charlie:${D}:Ella:paucity`);
  });
});

describe('sync', () => {
  it('stays on the device when sync is not set up', () => {
    const s = new Sync(null, memory());
    expect(s.get().status).toBe('off');
    s.update(ensureToday(fresh(), bank, D));
    expect(s.get().state.days[D]).toHaveLength(3);
  });

  it('a new link carries progress to another device, and changes flow both ways', async () => {
    const srv = server();
    const phone = new Sync(srv, memory(practise(ensureToday(fresh(), bank, D))));
    const key = await phone.link();
    expect(phone.get().status).toBe('synced');

    const laptop = new Sync(srv, memory());
    await laptop.join(key);
    expect(laptop.get().status).toBe('synced');
    expect(laptop.get().state.cards.farcical.level).toBe(1);

    // The laptop marks a word known; the phone picks it up from the ping.
    laptop.update(dismiss(laptop.get().state, bank, 'paucity', 'known', D));
    await settle();
    await settle();
    expect(phone.get().state.known.paucity).toBe(true);
    expect(phone.get().status).toBe('synced');
  });

  it('two devices saving at once both keep their changes', async () => {
    const srv = server();
    const start = ensureToday(fresh(), bank, D);
    const a = new Sync(srv, memory(start));
    const key = await a.link();
    const b = new Sync(srv, memory());
    await b.join(key);
    a.stop(); b.stop();   // no pings: they only find out by saving
    a.update(dismiss(a.get().state, bank, 'farcical', 'known', D));
    b.update(dismiss(b.get().state, bank, 'modicum', 'rejected', D));
    await settle();
    const saved = srv.rows.get(key)!.data;
    expect(saved.known.farcical).toBe(true);
    expect(saved.rejected.modicum).toBe(true);
  });

  it('keeps working offline and catches up later', async () => {
    const srv = server();
    const a = new Sync(srv, memory(ensureToday(fresh(), bank, D)), 50);
    const key = await a.link();
    srv.down(true);
    a.update(dismiss(a.get().state, bank, 'glut', 'known', D));
    await settle();
    expect(a.get().status).toBe('offline');
    expect(a.get().state.known.glut).toBe(true);
    srv.down(false);
    await settle();
    expect(a.get().status).toBe('synced');
    expect(srv.rows.get(key)!.data.known.glut).toBe(true);
  });

  it('says so when a link matches nothing', async () => {
    const s = new Sync(server(), memory());
    await s.join('nosuchkeyatall12345');
    expect(s.get().status).toBe('invalid');
    s.unlink();
    expect(s.get()).toMatchObject({ status: 'local', key: null });
  });

  it('reads a key from a whole link or on its own', () => {
    const k = 'a'.repeat(64);
    expect(cleanKey(`https://ellalwoods.github.io/good-word-charlie/#${k}`)).toBe(k);
    expect(cleanKey(` ${k} `)).toBe(k);
    expect(cleanKey('#short')).toBeNull();
  });
});

describe("Ella's stats", () => {
  it('sums up each person and the words', async () => {
    const { computeStats } = await import('./stats');
    let ella = setProfile(ensureToday(fresh(), bank, D), 'Ella', 'pink');
    ella = practise(ella, ['paucity']);
    ella = setNote(markUsed(ella, 'farcical', D, true), 'farcical', D, 'At breakfast.');
    const charlie = markCheer(dismiss(setProfile(ensureToday(fresh(), bank, D), 'Charlie', 'yellow'), bank, 'glut', 'known', D), 'Ella', 'farcical', D, true);
    const now = new Date().toISOString();
    const s = computeStats([{ updated_at: now, data: ella }, { updated_at: now, data: charlie }, { updated_at: now, data: fresh() }], bank, D);
    expect(s.people.map(p => p.name).sort()).toEqual(['Charlie', 'Ella']);
    expect(s.guests).toBe(1);
    const e = s.people.find(p => p.name === 'Ella')!;
    expect(e).toMatchObject({ learned: 3, used: 1, stories: 1, cheersReceived: 1, left: bank.length - 3 });
    expect(e.accuracy).toBeGreaterThan(0);
    expect(s.hardest[0].word).toBe('paucity');
    expect(s.known[0]).toMatchObject({ word: 'glut', n: 1 });
    expect(s.stories[0]).toMatchObject({ name: 'Ella', word: 'farcical', text: 'At breakfast.' });
  });
});

describe('minutes on the site', () => {
  it('adds up across devices, and merging never double-counts', async () => {
    const { addTime, minutesByDay } = await import('./time');
    let phone = addTime(fresh(), D, 'phone', 120);
    phone = addTime(phone, D, 'phone', 60);
    const laptop = addTime(fresh(), D, 'laptop', 300);
    const m = merge(merge(phone, laptop), phone);
    expect(minutesByDay(m)[D]).toBe(8);
    // A later sync with more time on the phone keeps the newer count.
    expect(minutesByDay(merge(m, addTime(phone, D, 'phone', 60)))[D]).toBe(9);
  });
});

describe('pages', () => {
  it('counts minutes and visits per page, across devices', async () => {
    const { addTime, addVisit, pageUse, minutesByDay } = await import('./time');
    let phone = addTime(fresh(), D, 'phone', 120, { today: 60, practice: 60 });
    phone = addVisit(addVisit(phone, D, 'phone', 'today'), D, 'phone', 'practice');
    const laptop = addVisit(addTime(fresh(), D, 'laptop', 180, { lexicon: 180 }), D, 'laptop', 'lexicon');
    const m = merge(phone, laptop);
    expect(minutesByDay(m)[D]).toBe(5);
    expect(pageUse(m)).toEqual([
      { page: 'lexicon', minutes: 3, visits: 1 },
      { page: 'today', minutes: 1, visits: 1 },
      { page: 'practice', minutes: 1, visits: 1 },
    ]);
  });
});
