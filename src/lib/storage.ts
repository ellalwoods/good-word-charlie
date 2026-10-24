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
    linkManifest(key);
  },
};

/**
 * A home-screen icon opens the manifest's start address, and on iPhone it has
 * its own storage, separate from Safari's. So once there's a sync link, point
 * the manifest at it: an icon added from then on opens with your progress.
 */
export function linkManifest(key: string | null) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) return;
  const base = new URL('./', location.href).href;
  if (!link.dataset.original) link.dataset.original = link.getAttribute('href') ?? '';
  if (!key) { link.setAttribute('href', link.dataset.original); return; }
  const manifest = {
    name: 'Good Word, Charlie',
    short_name: 'Good Word',
    description: 'Three good words a day, and the practice to keep them.',
    id: base,
    start_url: `${base}#${key}`,
    scope: base,
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#efece4',
    theme_color: '#1d4ed8',
    icons: [
      { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  link.setAttribute('href', 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest)));
}
