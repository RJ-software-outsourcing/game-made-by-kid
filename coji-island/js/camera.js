// Follow camera with touch/mouse input: a short tap is a "tap", a drag turns the camera,
// a pinch or the mouse wheel zooms.
import * as THREE from 'three'

const TAP_MOVE = 10 // px: more than this is a drag
const TAP_TIME = 650 // ms

export class FollowCam {
  constructor(camera, canvas, { onTap, groundY }) {
    this.cam = camera
    this.canvas = canvas
    this.onTap = onTap
    this.groundY = groundY
    this.yaw = 0
    this.pitch = 0.62
    this.dist = 15
    this.minDist = 7
    this.maxDist = 34
    this.focus = new THREE.Vector3()
    this.goal = new THREE.Vector3()
    this.pointers = new Map()
    this.enabled = true
    this.override = null // { focus, yaw, pitch, dist } for cut-scenes
    this.bind()
  }

  bind() {
    const c = this.canvas
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture?.(e.pointerId)
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false })
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()]
        this.pinch = Math.hypot(a.x - b.x, a.y - b.y)
        for (const p of this.pointers.values()) p.moved = true
      }
    })
    c.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      if (!p.moved && Math.hypot(p.x - p.sx, p.y - p.sy) > TAP_MOVE) p.moved = true
      if (!this.enabled || this.override) return
      if (this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (this.pinch) this.zoom(this.pinch / d)
        this.pinch = d
      } else if (p.moved) {
        const k = 1 / Math.max(320, Math.min(window.innerWidth, window.innerHeight))
        this.yaw -= dx * k * 3.2
        this.pitch = Math.min(1.25, Math.max(0.22, this.pitch + dy * k * 2.2))
      }
    })
    const end = (e) => {
      const p = this.pointers.get(e.pointerId)
      if (!p) return
      this.pointers.delete(e.pointerId)
      if (this.pointers.size < 2) this.pinch = null
      if (e.type === 'pointerup' && !p.moved && performance.now() - p.t < TAP_TIME && this.pointers.size === 0) this.onTap(e.clientX, e.clientY)
    }
    c.addEventListener('pointerup', end)
    c.addEventListener('pointercancel', end)
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        if (!this.enabled || this.override) return
        this.zoom(Math.exp(e.deltaY * 0.0015))
      },
      { passive: false },
    )
    c.addEventListener('contextmenu', (e) => e.preventDefault())
    // Stop Safari's own pinch-zoom of the page.
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false })
  }

  zoom(k) {
    this.dist = Math.min(this.maxDist, Math.max(this.minDist, this.dist * k))
  }

  update(dt, target) {
    const o = this.override
    const goalFocus = o ? o.focus : target
    const yaw = o ? o.yaw : this.yaw
    const pitch = o ? o.pitch : this.pitch
    const dist = o ? o.dist : this.dist
    const k = 1 - Math.exp(-dt * (o ? 1.6 : 9))
    this.focus.lerp(goalFocus, k)
    if (o) {
      this.cy = (this.cy ?? this.yaw) + angleDiff(this.cy ?? this.yaw, yaw) * k
      this.cp = (this.cp ?? this.pitch) + (pitch - (this.cp ?? this.pitch)) * k
      this.cd = (this.cd ?? this.dist) + (dist - (this.cd ?? this.dist)) * k
    } else {
      this.cy = this.cy === undefined ? yaw : this.cy + angleDiff(this.cy, yaw) * Math.min(1, dt * 14)
      this.cp = this.cp === undefined ? pitch : this.cp + (pitch - this.cp) * Math.min(1, dt * 14)
      this.cd = this.cd === undefined ? dist : this.cd + (dist - this.cd) * Math.min(1, dt * 10)
    }
    const cp = Math.cos(this.cp)
    const look = this.focus.clone()
    look.y += 1.1
    const pos = new THREE.Vector3(look.x + Math.sin(this.cy) * cp * this.cd, look.y + Math.sin(this.cp) * this.cd, look.z + Math.cos(this.cy) * cp * this.cd)
    const floor = this.groundY(pos.x, pos.z) + 1.2
    if (pos.y < floor) pos.y = floor
    this.cam.position.copy(pos)
    this.cam.lookAt(look)
  }

  // Snap instantly (after loading a save).
  snap(target) {
    this.focus.copy(target)
    this.cy = this.yaw
    this.cp = this.pitch
    this.cd = this.dist
  }
}

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}
