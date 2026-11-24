// A crop of the existing 3D projection. A wheel or screw between the two
// fingertips stays there as they move apart or together.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export class WorkshopCamera {
  constructor(host, button, view) {
    this.host = host
    this.button = button
    this.view = view
    this.zoom = 1
    this.left = this.top = 0
    this.touches = new Map()
    button.onclick = () => this.crop(this.zoom > 1.015 ? 1 : 1.7, 0.5, 0.48, 0.5, 0.48)
    host.addEventListener('pointerdown', (event) => this.down(event))
    host.addEventListener('pointermove', (event) => this.move(event))
    host.addEventListener('pointerup', (event) => this.release(event, true))
    for (const type of ['pointercancel', 'lostpointercapture'])
      host.addEventListener(type, (event) => this.release(event, false))
  }
  crop(zoom, oldX, oldY, x, y) {
    const next = clamp(zoom, 1, 2.2)
    this.left = clamp(this.left + oldX / this.zoom - x / next, 0, 1 - 1 / next)
    this.top = clamp(this.top + oldY / this.zoom - y / next, 0, 1 - 1 / next)
    this.zoom = next
    const close = next > 1.015
    if (close !== this.close) {
      this.close = close
      this.button.setAttribute('aria-pressed', String(close))
      this.button.querySelector('span:last-child').textContent = close ? 'Zoom out' : 'Zoom'
    }
    this.dirty = true
    this.view.wakeShop()
  }
  reset() {
    this.touches.clear()
    this.pinch = null
    if (this.zoom !== 1) this.crop(1, 0, 0, 0, 0)
  }
  apply(camera, width, height) {
    if (!this.dirty && this.width === width && this.height === height) return
    if (this.zoom === 1) {
      if (camera.view?.enabled) camera.clearViewOffset()
    } else {
      camera.setViewOffset(
        width,
        height,
        this.left * width,
        this.top * height,
        width / this.zoom,
        height / this.zoom
      )
    }
    this.width = width
    this.height = height
    this.dirty = false
  }
  pair() {
    const [a, b] = this.touches.values()
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, gap: Math.hypot(a.x - b.x, a.y - b.y) }
  }
  down(e) {
    if (e.target.closest('button') || e.button !== 0 || this.touches.size >= 2) return
    this.touches.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      angle: this.view.angle,
      tap: true
    })
    this.host.setPointerCapture(e.pointerId)
    if (this.touches.size === 2) {
      for (const t of this.touches.values()) t.tap = false
      this.pinch = this.pair()
      this.bounds = this.host.getBoundingClientRect()
      this.view.spinRemaining = 0
    }
  }
  move(e) {
    const t = this.touches.get(e.pointerId)
    if (!t) return
    t.x = e.clientX
    t.y = e.clientY
    if (this.touches.size === 2) {
      const next = this.pair(),
        prev = this.pinch,
        box = this.bounds
      if (next.gap > 4 && prev.gap > 4)
        this.crop(
          (this.zoom * next.gap) / prev.gap,
          (prev.x - box.left) / box.width,
          (prev.y - box.top) / box.height,
          (next.x - box.left) / box.width,
          (next.y - box.top) / box.height
        )
      this.pinch = next
      return
    }
    if (t.scroll) return
    const dx = t.x - t.startX,
      dy = t.y - t.startY
    if (Math.hypot(dx, dy) > 6) t.tap = false
    if (Math.abs(dy) > 10 && Math.abs(dx) < 6) {
      t.scroll = true
      return
    }
    this.view.angle = t.angle + dx * 0.013
    this.view.spinRemaining = 0
    this.view.invalidate()
  }
  release(e, pick) {
    const t = this.touches.get(e.pointerId)
    if (!t) return
    this.touches.delete(e.pointerId)
    if (
      pick &&
      t.tap &&
      this.touches.size === 0 &&
      Math.hypot(e.clientX - t.startX, e.clientY - t.startY) < 6
    ) {
      const box = this.host.getBoundingClientRect()
      this.view.pickAt((e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height)
    }
    // A lifted finger must not turn the robot or select a part.
    for (const one of this.touches.values()) {
      one.angle = this.view.angle
      one.startX = one.x
      one.startY = one.y
      one.tap = false
      one.scroll = false
    }
    this.pinch = null
  }
}
