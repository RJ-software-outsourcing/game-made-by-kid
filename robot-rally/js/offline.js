// An installed worker has already checked every file in this release. Keep
// the previous release available while another version downloads in the background.
export function offlineSupport(onChange) {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
  if (
    !('serviceWorker' in navigator) ||
    !window.isSecureContext ||
    (local && !new URLSearchParams(location.search).has('offline'))
  )
    return null
  const workers = navigator.serviceWorker,
    script = new URL('./sw.js', document.baseURI).href
  let registration,
    current = 'preparing',
    pending = false
  function update() {
    const ownController = workers.controller?.scriptURL === script
    const active = registration?.active
    const ready = ownController || (active?.scriptURL === script && active.state === 'activated')
    const downloading =
      pending ||
      registration?.waiting ||
      active?.state === 'activating' ||
      (registration?.installing && registration.installing.state !== 'redundant')
    current = ready ? 'ready' : downloading ? 'preparing' : 'retry'
    onChange()
  }
  function watch() {
    const worker = registration.installing
    worker?.addEventListener('statechange', update)
    update()
  }
  async function prepare() {
    if (pending) return
    pending = true
    update()
    try {
      if (registration?.active || registration?.waiting || registration?.installing)
        await registration.update()
      else {
        const next = await workers.register('./sw.js', { scope: './', updateViaCache: 'none' })
        if (next !== registration) next.addEventListener('updatefound', watch)
        registration = next
        watch()
      }
    } catch {
    } finally {
      pending = false
      update()
    }
  }
  workers.addEventListener('controllerchange', update)
  return {
    prepare,
    get state() {
      return current
    }
  }
}
