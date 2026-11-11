/* Woodshed service worker, version 17dc6a5331 (written by build.py).
   - The page is fetched fresh whenever you're online, so updates arrive on the next open; offline, the
     last copy is used.
   - Sounds are cached the first time they load and come from the Mac after that. Their URLs carry a
     version, so a rebuilt instrument is fetched again. */
const SHELL = 'woodshed-shell-17dc6a5331';
const SOUNDS = 'woodshed-sounds-1';
const SHELL_FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('woodshed-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

const networkFirst = async (req) => {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) cache.put(req.mode === 'navigate' ? 'index.html' : req, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(req.mode === 'navigate' ? 'index.html' : req)) || (await cache.match('./')) || Response.error();
  }
};

const soundFirst = async (req) => {
  const cache = await caches.open(SOUNDS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    cache.put(req, res.clone());
    // Drop older versions of the same file
    const base = req.url.split('?')[0];
    for (const k of await cache.keys()) if (k.url.split('?')[0] === base && k.url !== req.url) cache.delete(k);
  }
  return res;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes('/sounds/')) { e.respondWith(soundFirst(req)); return; }
  e.respondWith(networkFirst(req));
});
