import { merge, normalise, same } from './merge';
import type { State } from './types';

/** Where synced progress lives. Methods throw on network errors. */
export interface Remote {
  /** Stores this progress under a brand-new sync key and returns the key. */
  create(data: State): Promise<string>;
  /** `invalid` when no progress has that key. */
  load(key: string): Promise<{ data: State; version: number } | 'invalid'>;
  /** Saves only if the server is still at `expected`; returns the new version, or null if another device saved first. */
  save(key: string, data: State, expected: number): Promise<number | null>;
  /** Calls back whenever another device saves. Returns an unsubscribe. */
  listen(key: string, onSaved: () => void): () => void;
  /** Tells other devices we saved. */
  announce(key: string): void;
}

/** Keeps progress on this device, and in step with a sync link if there is one. */
export interface Local {
  read(): State;
  write(s: State): void;
  readKey(): string | null;
  writeKey(key: string | null): void;
}

/**
 * off: sync isn't set up on this site. local: no sync link on this device.
 * offline: can't reach the server just now (keeps trying). invalid: the link doesn't match any progress.
 */
export type SyncStatus = 'off' | 'local' | 'saving' | 'synced' | 'offline' | 'invalid';
export interface Snapshot { state: State; status: SyncStatus; key: string | null }

const DELAY = 500;
const RETRY_FIRST = 3000, RETRY_MAX = 60000;

export function cleanKey(input: string): string | null {
  const t = input.trim();
  const k = decodeURIComponent(t.includes('#') ? t.slice(t.indexOf('#') + 1) : t).trim();
  return /^[A-Za-z0-9_-]{16,}$/.test(k) ? k : null;
}

/**
 * Every change is saved on the device straight away, then sent to the server.
 * Before saving, the server's copy is fetched and merged in, and the save only
 * goes through if nobody saved in between, so two devices never overwrite each other.
 */
export class Sync {
  private snap: Snapshot;
  private fns = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private again = false;
  private dirty = false;
  private retryIn: number;
  private unlisten: (() => void) | null = null;

  constructor(private remote: Remote | null, private local: Local, private retryFirst = RETRY_FIRST) {
    this.retryIn = retryFirst;
    const key = remote ? local.readKey() : null;
    this.snap = { state: local.read(), status: !remote ? 'off' : key ? 'saving' : 'local', key };
  }

  get = () => this.snap;
  subscribe = (fn: () => void) => { this.fns.add(fn); return () => { this.fns.delete(fn); }; };

  private set(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.fns.forEach(fn => fn());
  }

  start() {
    if (!this.remote || !this.snap.key) return;
    this.listen();
    this.sync();
  }

  stop() {
    clearTimeout(this.timer);
    this.unlisten?.();
    this.unlisten = null;
  }

  /** Call when the page comes back into view or the device reconnects. */
  wake = () => { if (this.snap.key) this.sync(); };

  update(state: State) {
    this.local.write(state);
    if (!this.remote || !this.snap.key) { this.set({ state }); return; }
    this.dirty = true;
    this.set({ state, status: this.snap.status === 'invalid' ? 'invalid' : 'saving' });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.sync(), DELAY);
  }

  /** Makes a new sync link holding this device's progress. */
  async link(): Promise<string> {
    if (!this.remote) throw new Error('Sync is not set up');
    const key = await this.remote.create(this.snap.state);
    this.useKey(key);
    this.set({ status: 'synced' });
    return key;
  }

  /** Joins an existing link; this device's progress is merged into it. */
  async join(key: string): Promise<void> {
    if (!this.remote) return;
    this.useKey(key);
    this.dirty = true;
    this.set({ status: 'saving' });
    await this.sync();
  }

  /** Stops syncing on this device. Progress stays here; the link keeps working elsewhere. */
  unlink() {
    this.stop();
    this.local.writeKey(null);
    this.set({ key: null, status: this.remote ? 'local' : 'off' });
  }

  private useKey(key: string) {
    this.stop();
    this.local.writeKey(key);
    this.set({ key });
    this.listen();
  }

  private listen() {
    if (!this.remote || !this.snap.key || this.unlisten) return;
    this.unlisten = this.remote.listen(this.snap.key, () => this.sync());
  }

  /** Brings in progress the server has that this device doesn't. */
  private take(merged: State) {
    if (same(merged, this.snap.state)) return;
    this.local.write(merged);
    this.set({ state: merged });
  }

  private async sync(): Promise<void> {
    const remote = this.remote, key = this.snap.key;
    if (!remote || !key) return;
    if (this.running) { this.again = true; return; }
    this.running = true;
    this.dirty = false;
    clearTimeout(this.timer);
    try {
      for (let tries = 0; tries < 5; tries++) {
        const res = await remote.load(key);
        if (key !== this.snap.key) return;
        if (res === 'invalid') { this.set({ status: 'invalid' }); return; }
        const theirs = normalise(res.data);
        const merged = merge(this.snap.state, theirs);
        this.take(merged);
        if (same(merged, theirs)) break;
        const saved = await remote.save(key, merged, res.version);
        if (saved !== null) { remote.announce(key); break; }
      }
      this.retryIn = this.retryFirst;
      if (key === this.snap.key) this.set({ status: this.dirty ? 'saving' : 'synced' });
    } catch (e) {
      console.warn('Sync failed; trying again shortly', e);
      this.dirty = true;
      this.set({ status: 'offline' });
      this.timer = setTimeout(() => this.sync(), this.retryIn);
      this.retryIn = Math.min(this.retryIn * 2, RETRY_MAX);
    } finally {
      this.running = false;
      if (this.again) { this.again = false; this.sync(); }
    }
  }
}
