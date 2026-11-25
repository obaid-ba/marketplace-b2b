/*
 * Service worker de Marketplace B2B (SCRUM-88 / PWA).
 *
 * - Pages (navigation) : réseau d'abord ; hors ligne, la coquille de l'application déjà en cache, sinon offline.html.
 * - Fichiers de l'application (/assets/…, icônes, polices) : cache d'abord, ils portent une empreinte dans leur nom.
 * - API : jamais mise en cache par le service worker (données personnelles, toujours à jour).
 * Changer VERSION à chaque modification de ce fichier pour remplacer l'ancien cache.
 */
const VERSION = 'v1'
const SHELL_CACHE = `shell-${VERSION}`
const ASSET_CACHE = `assets-${VERSION}`
const SHELL = ['/', '/offline.html', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => ![SHELL_CACHE, ASSET_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Dernière version de la coquille, pour les prochaines ouvertures hors ligne.
          const copy = response.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(async () => (await caches.match('/')) ?? caches.match('/offline.html')),
    )
    return
  }

  const isAppFile = url.origin === self.location.origin && /^\/(assets|icons)\//.test(url.pathname)
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)

  if (isAppFile || isFont) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok || response.type === 'opaque') {
              const copy = response.clone()
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
  }
  // Tout le reste (API, images téléversées) : réseau, comportement normal du navigateur.
})
