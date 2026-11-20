// Serves cached media (with Range support so video seeking/streaming works offline)
const CACHE = 'tv-media-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // Player page: network first, fall back to the last copy so a TV can boot without internet
  if (e.request.mode === 'navigate' && u.origin === location.origin && u.pathname === '/') {
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open('tv-shell-v1').then(c => c.put('/', copy));
      return r;
    }).catch(() => caches.open('tv-shell-v1').then(c => c.match('/'))));
    return;
  }
  if (e.request.method !== 'GET' || !u.hostname.endsWith('blob.vercel-storage.com')) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(u.href);
    if (!hit) return fetch(e.request);
    const range = e.request.headers.get('range');
    if (!range) return hit;
    const blob = await hit.blob();
    const size = blob.size, m = /bytes=(\d*)-(\d*)/.exec(range);
    let s, en;
    if (m[1] === '') { s = Math.max(0, size - +m[2]); en = size - 1; }
    else { s = +m[1]; en = m[2] === '' ? size - 1 : Math.min(+m[2], size - 1); }
    return new Response(blob.slice(s, en + 1), {
      status: 206,
      headers: {
        'Content-Type': hit.headers.get('Content-Type') || 'video/mp4',
        'Content-Range': `bytes ${s}-${en}/${size}`,
        'Content-Length': String(en - s + 1)
      }
    });
  })());
});
