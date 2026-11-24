import { PerspectiveCamera } from '../vendor/three.module.js'
import { slots, frames } from './catalog.js'
import { createRobot } from './robot.js'

// Capture one body per workshop frame. The pictures use the installed parts
// and paint, and stay valid when the child switches between body shapes.
export class BodyCards {
  constructor() {
    this.camera = new PerspectiveCamera(27, 1.28, 0.05, 30)
    this.pictures = []
    this.sets = new Map()
    this.pending = null
    this.active = null
  }
  open(build, paint, host) {
    this.host = host
    this.active = build ? { build, paint } : null
    this.pending = null
    if (!build) return
    const key = paint + slots.map((s) => build[s.id]).join(':')
    let pictures = this.sets.get(key)
    if (pictures) this.sets.delete(key)
    else {
      pictures = []
      // Two fitted looks let a child compare paints without rebuilding
      // twelve rigs. Their small RGBA portraits take at most 2.35 MiB.
      if (this.sets.size >= 2) this.release(this.sets.keys().next().value)
    }
    this.sets.set(key, pictures)
    this.pictures = pictures
    for (let i = 0; i < frames.length; i++) this.attach(i)
    if (pictures.length < frames.length) this.pending = this.active
  }
  release(key) {
    for (const canvas of this.sets.get(key)) {
      // The previous lighting can stay visible until its replacement arrives.
      if (canvas && !canvas.isConnected) canvas.width = canvas.height = 1
    }
    this.sets.delete(key)
  }
  lightingChanged() {
    for (const key of this.sets.keys()) this.release(key)
    this.pictures = []
    if (this.active) this.open(this.active.build, this.active.paint, this.host)
  }
  attach(i) {
    const canvas = this.pictures[i]
    const mount = this.host?.querySelector('[data-frame="' + i + '"] .body-art')
    if (mount && canvas && mount.firstElementChild !== canvas) {
      mount.replaceChildren(canvas)
      mount.classList.add('live-body')
    }
  }
  renderNext(view) {
    if (!this.pending) return
    const i = frames.findIndex((_, i) => !this.pictures[i])
    if (i < 0) {
      this.pending = null
      return
    }
    const { build, paint } = this.pending
    const model = createRobot({ ...build, chassis: i }, paint, true)
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 200
    const visible = view.enemy.group.visible
    try {
      model.setFinishMaterial(view.workshopFinish)
      model.update({ time: 1.25 })
      view.scout.add(model.group)
      view.enemy.group.visible = false
      const y = i === 5 ? 0.6 : frames[i].center
      const distance = i === 5 ? 0.84 : 1
      this.camera.position.set(2.11 * distance, y + 1.2 * distance, 3.73 * distance)
      this.camera.lookAt(0, y, 0)
      view.snapshotScout(this.camera, canvas)
      this.pictures[i] = canvas
      this.attach(i)
    } finally {
      model.dispose()
      view.enemy.group.visible = visible
    }
    if (i === frames.length - 1) this.pending = null
    else view.invalidate()
  }
}
