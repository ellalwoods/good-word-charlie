import type { State } from './types';

/**
 * The only place progress is read or written. Swap `store` for a Supabase
 * version later; the rest of the app only sees load() and save().
 */
export interface ProgressStore {
  load(): Promise<State>;
  save(state: State): Promise<void>;
}

export function fresh(): State {
  return { version: 1, cards: {}, days: {}, done: {}, known: {}, rejected: {}, updated: 0 };
}

const KEY = 'good-word-charlie-v1';

export const localStore: ProgressStore = {
  async load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...fresh(), ...JSON.parse(raw) } as State;
    } catch {
      // Private mode or corrupt data: start fresh.
    }
    return fresh();
  },
  async save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked; nothing more we can do on this device.
    }
  },
};

export const store: ProgressStore = localStore;
