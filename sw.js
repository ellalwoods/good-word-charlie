// Keeps the site opening instantly and offline once added to the home screen.
// Progress lives in the browser's storage, never here.
const CACHE = 'good-word-v1';
const SHELL = ['./', './manifest.webmanifest', './icons/icon.svg', './icons/apple-touch-icon.png', './icons/icon-192.png'];
const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const put = (req, res) => {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy));
  }
  return res;
};

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Pages: network first, so newly loaded words arrive straight away.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => put('./', res)).catch(() => caches.match('./')));
    return;
  }
  // Built files (hashed, so they never change) and fonts: cache first.
  if (new URL(req.url).origin === self.location.origin || FONTS.test(req.url)) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => put(req, res))));
  }
});
