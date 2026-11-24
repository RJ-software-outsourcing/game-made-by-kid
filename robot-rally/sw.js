/* global self, caches, importScripts, RALLY_OFFLINE */
importScripts('./offline-assets.js')
const root = new URL('./', self.location.href)
const prefix = 'robot-rally:' + root.pathname + ':'
const cacheName = prefix + RALLY_OFFLINE.version
const releaseKey = new URL('offline-release-index', root).href
const files = new Map(
  Object.keys(RALLY_OFFLINE.assets).map((path) => {
    const url = new URL(path, root)
    return [url.pathname, url.href]
  })
)

async function previousRelease() {
  for (const key of (await caches.keys()).reverse()) {
    if (!key.startsWith(prefix) || key === cacheName) continue
    const cache = await caches.open(key)
    const index = await cache.match(releaseKey)
    if (index) return { cache, assets: await index.json() }
  }
}

async function installRelease() {
  const previous = await previousRelease()
  const cache = await caches.open(cacheName)
  const queue = Object.entries(RALLY_OFFLINE.assets)[Symbol.iterator]()
  async function copyFiles() {
    for (const [path, digest] of queue) {
      const url = new URL(path, root).href
      let response
      if (previous?.assets[path] === digest) response = await previous.cache.match(url)
      if (!response) {
        response = await fetch(new Request(url, { cache: 'no-cache' }))
        if (!response.ok) throw new Error('Missing game file: ' + path)
        // Reject a mixture of old and new files during a rolling deployment.
        const bytes = await response.clone().arrayBuffer()
        const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
        if (btoa(String.fromCharCode(...hash)) !== digest) throw new Error('Game file changed: ' + path)
      }
      await cache.put(url, response)
    }
  }
  try {
    const results = await Promise.allSettled(Array.from({ length: 4 }, copyFiles))
    const failure = results.find((result) => result.status === 'rejected')
    if (failure) throw failure.reason
    await cache.put(releaseKey, new Response(JSON.stringify(RALLY_OFFLINE.assets)))
  } catch (error) {
    await caches.delete(cacheName)
    throw error
  }
}

// An interrupted download never replaces the last complete cup. A new worker
// takes over after the previous game windows close, including an active bout.
self.addEventListener('install', (event) => {
  event.waitUntil(installRelease())
})
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith(prefix) && key !== cacheName) await caches.delete(key)
      }
      await self.clients.claim()
    })()
  )
})
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== root.origin) return
  const target = url.pathname === root.pathname ? new URL('index.html', root).href : files.get(url.pathname)
  if (!target) return
  event.respondWith(
    (async () => {
      const saved = await (await caches.open(cacheName)).match(target)
      return saved || fetch(request)
    })()
  )
})
