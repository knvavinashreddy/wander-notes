// Network-first for pages, cache-first for built assets. Lets the app open offline.
const CACHE = 'wander-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/icon.svg', '/manifest.webmanifest'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put('/', res.clone()))
          return res
        })
        .catch(() => caches.match('/'))
    )
    return
  }
  e.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()))
          return res
        })
    )
  )
})
