import type { Local } from './sync';
import type { State } from './types';

export function fresh(): State {
  return { version: 1, cards: {}, days: {}, done: {}, known: {}, rejected: {}, updated: 0 };
}

const KEY = 'good-word-charlie-v1';
const LINK_KEY = 'good-word-charlie-sync';

/**
 * Progress on this device. The sync key also goes in the address (`…/#<key>`),
 * because a home-screen icon on iPhone keeps its own storage, separate from Safari's.
 */
export const device: Local = {
  read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...fresh(), ...JSON.parse(raw) } as State;
    } catch {
      // Private mode or corrupt data: start fresh.
    }
    return fresh();
  },
  write(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked; nothing more we can do on this device.
    }
  },
  readKey() {
    try { return localStorage.getItem(LINK_KEY); } catch { return null; }
  },
  writeKey(key) {
    try {
      if (key) localStorage.setItem(LINK_KEY, key);
      else localStorage.removeItem(LINK_KEY);
    } catch { /* storage blocked */ }
    try { history.replaceState(null, '', key ? `#${key}` : location.pathname + location.search); } catch { /* not available */ }
  },
};
