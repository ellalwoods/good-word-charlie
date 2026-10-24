import { describe, expect, it } from 'vitest';
import words from '../data/words.json';
import { dismiss, ensureToday } from './daily';
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
