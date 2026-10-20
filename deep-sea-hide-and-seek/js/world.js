// The midnight-zone playground: hiding spots, ambient deep-sea critters and easter eggs.

import { sfx } from './audio.js'

// The whole playground fits on screen, so its size follows the window's shape.
export let WORLD_W = 1600
export let WORLD_H = 1000
export const HOME = { x: WORLD_W / 2, y: WORLD_H / 2 }
let FLOOR_Y = WORLD_H - 70

export function setWorldSize(screenW, screenH) {
  const aspect = screenW / screenH
  if (aspect >= 1) {
    WORLD_H = 1000
    WORLD_W = Math.round(Math.min(2000, Math.max(1100, 1000 * aspect)))
  } else {
    WORLD_W = 1100
    WORLD_H = Math.round(Math.min(2000, Math.max(1000, 1100 / aspect)))
  }
  HOME.x = WORLD_W / 2
  HOME.y = WORLD_H / 2
  FLOOR_Y = WORLD_H - 70
}

const TAU = Math.PI * 2
const rand = (a, b) => a + Math.random() * (b - a)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by)

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---------- Hiding spots ----------

const KINDS = ['rock', 'coral', 'kelp', 'clam', 'wreck', 'anemone', 'tubes', 'vent']
class Spot {
  constructor(kind, x, y, r) {
    this.kind = kind
    this.x = x
    this.y = y
    this.r = r
    this.seed = Math.random() * 100
    this.d = {}
    const d = this.d
    if (kind === 'rock') {
      d.pts = []
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU
        const rr = r * rand(0.88, 1.1)
        d.pts.push([Math.cos(a) * rr * 1.08, Math.sin(a) * rr * 0.8 + r * 0.05])
      }
      d.moss = Array.from({ length: 9 }, () => {
        const a = rand(Math.PI * 1.1, Math.PI * 1.9)
        return [Math.cos(a) * r * rand(0.4, 0.85), Math.sin(a) * r * rand(0.3, 0.6), rand(0, TAU)]
      })
      d.craters = Array.from({ length: 3 }, () => [rand(-0.5, 0.5) * r, rand(-0.2, 0.4) * r, rand(6, 14)])
    } else if (kind === 'coral') {
      d.branches = Array.from({ length: 9 }, (_, i) => {
        const bx = -r * 0.85 + (i * 1.7 * r) / 8
        const top = -r * rand(0.55, 1.05)
        return {
          bx,
          tx: bx + rand(-25, 25),
          top,
          side: rand(-1, 1) > 0 ? 1 : -1,
          color: pick(['#ff6fae', '#ff9a5c', '#c86bff', '#ff7f7f']),
        }
      })
    } else if (kind === 'kelp') {
      d.strands = Array.from({ length: 10 }, (_, i) => ({
        bx: -r * 0.85 + (i * 1.7 * r) / 9 + rand(-6, 6),
        h: r * rand(1.5, 2.0),
        ph: rand(0, TAU),
        color: pick(['#2fa874', '#3fc58a', '#279467']),
      }))
      d.spores = Array.from({ length: 6 }, () => [rand(-r, r), rand(-r * 1.2, r * 0.5), rand(0, TAU)])
    } else if (kind === 'anemone') {
      d.tent = Array.from({ length: 24 }, (_, i) => ({ a: Math.PI * (1.05 + (i / 23) * 0.9), ph: rand(0, TAU), len: r * rand(0.45, 0.7) }))
    } else if (kind === 'tubes') {
      d.tubes = Array.from({ length: 7 }, (_, i) => ({
        x: -r * 0.75 + (i * 1.5 * r) / 6 + rand(-8, 8),
        w: rand(26, 36),
        h: r * rand(0.9, 1.75),
      })).sort((a, b) => b.h - a.h)
    } else if (kind === 'vent') {
      d.bub = Array.from({ length: 8 }, () => ({ p: Math.random(), x: rand(-10, 10), s: rand(3, 7) }))
    }
  }

  /** Does a character standing at (x, y) count as hidden here? */
  covers(x, y) {
    return dist(x, y, this.x, this.y) < this.r * 0.55
  }

  draw(c, t) {
    // Kelp and anemones sway, so they are drawn live; everything else is drawn once into a cache.
    if (this.kind === 'kelp' || this.kind === 'anemone') {
      c.save()
      c.translate(this.x, this.y)
      this['draw_' + this.kind](c, t + this.seed)
      c.restore()
      return
    }
    const r = this.r
    if (!this.cache) {
      const S = 2 // cache resolution (crisp on high-DPI screens)
      const cv = document.createElement('canvas')
      cv.width = Math.ceil(r * 2.8 * S)
      cv.height = Math.ceil(r * 2.4 * S)
      const g = cv.getContext('2d')
      g.scale(S, S)
      g.translate(r * 1.4, r * 1.4)
      this['draw_' + this.kind](g, this.seed)
      this.cache = cv
    }
    c.drawImage(this.cache, this.x - r * 1.4, this.y - r * 1.4, r * 2.8, r * 2.4)
  }

  glow(c, t) {
    c.save()
    c.translate(this.x, this.y)
    const fn = this['glow_' + this.kind]
    if (fn) fn.call(this, c, t + this.seed)
    c.restore()
  }

  draw_rock(c) {
    const { pts, craters } = this.d
    const r = this.r
    const g = c.createLinearGradient(0, -r, 0, r)
    g.addColorStop(0, '#565b8c')
    g.addColorStop(1, '#22244a')
    c.fillStyle = g
    c.beginPath()
    for (let i = 0; i <= pts.length; i++) {
      const p = pts[i % pts.length]
      const n = pts[(i + 1) % pts.length]
      const mx = (p[0] + n[0]) / 2
      const my = (p[1] + n[1]) / 2
      if (i === 0) c.moveTo(mx, my)
      else c.quadraticCurveTo(p[0], p[1], mx, my)
    }
    c.closePath()
    c.fill()
    c.strokeStyle = '#1a1b3a'
    c.lineWidth = 4
    c.stroke()
    c.fillStyle = 'rgba(20,20,50,0.35)'
    for (const [x, y, s] of craters) {
      c.beginPath()
      c.ellipse(x, y, s, s * 0.7, 0, 0, TAU)
      c.fill()
    }
  }
  glow_rock(c, t) {
    for (const [x, y, ph] of this.d.moss) {
      const a = 0.5 + 0.4 * Math.sin(t * 2 + ph)
      dot(c, x, y, 3, `rgba(90,255,230,${a})`, 12)
    }
  }

  draw_coral(c, t) {
    const r = this.r
    c.fillStyle = '#5a1f4f'
    c.beginPath()
    c.ellipse(0, r * 0.1, r * 0.95, r * 0.78, 0, 0, TAU)
    c.fill()
    c.lineCap = 'round'
    for (const b of this.d.branches) {
      const sway = Math.sin(t * 1.2 + b.bx) * 4
      c.strokeStyle = b.color
      c.lineWidth = 15
      c.beginPath()
      c.moveTo(b.bx, r * 0.75)
      c.quadraticCurveTo(b.bx, r * 0.1, b.tx + sway, b.top)
      c.stroke()
      const mx = (b.bx + b.tx) / 2
      const my = (r * 0.4 + b.top) / 2
      c.lineWidth = 10
      c.beginPath()
      c.moveTo(mx, my + 10)
      c.quadraticCurveTo(mx + b.side * 20, my, mx + b.side * 26 + sway, my - 26)
      c.stroke()
    }
    c.fillStyle = '#3a2a4a'
    c.beginPath()
    c.ellipse(0, r * 0.8, r * 0.95, r * 0.2, 0, 0, TAU)
    c.fill()
  }
  glow_coral(c, t) {
    for (const b of this.d.branches) {
      const a = 0.45 + 0.35 * Math.sin(t * 2.5 + b.bx)
      dot(c, b.tx + Math.sin(t * 1.2 + b.bx) * 4, b.top, 4, `rgba(255,170,220,${a})`, 10)
    }
  }

  draw_kelp(c, t) {
    const r = this.r
    c.fillStyle = '#123d33'
    c.beginPath()
    c.ellipse(0, r * 0.2, r * 0.9, r * 0.72, 0, 0, TAU)
    c.fill()
    for (const s of this.d.strands) {
      const base = r * 0.8
      const left = []
      const right = []
      for (let k = 0; k <= 10; k++) {
        const y = base - (s.h * k) / 10
        const x = s.bx + Math.sin(t * 1.4 + s.ph + k * 0.45) * k * 1.8
        const w = 13 * (1 - k / 12) + 3
        left.push([x - w / 2, y])
        right.push([x + w / 2, y])
      }
      c.fillStyle = s.color
      c.beginPath()
      c.moveTo(left[0][0], left[0][1])
      for (const p of left) c.lineTo(p[0], p[1])
      for (let i = right.length - 1; i >= 0; i--) c.lineTo(right[i][0], right[i][1])
      c.closePath()
      c.fill()
      c.strokeStyle = 'rgba(10,60,40,0.6)'
      c.lineWidth = 2
      c.stroke()
    }
    c.fillStyle = '#2a2c4a'
    c.beginPath()
    c.ellipse(0, r * 0.82, r * 0.95, r * 0.22, 0, 0, TAU)
    c.fill()
  }
  glow_kelp(c, t) {
    for (const [x, y, ph] of this.d.spores) {
      const yy = y + Math.sin(t + ph) * 10
      dot(c, x + Math.cos(t * 0.7 + ph) * 8, yy, 2.5, `rgba(160,255,140,${0.4 + 0.3 * Math.sin(t * 3 + ph)})`, 9)
    }
  }

  draw_clam(c, t) {
    const r = this.r
    const open = 0.12 + 0.05 * Math.sin(t * 0.8)
    c.fillStyle = '#3a1030'
    c.beginPath()
    c.ellipse(0, -r * 0.1, r * 0.9, r * 0.55, 0, 0, TAU)
    c.fill()
    // pearl
    c.fillStyle = '#fff6fb'
    c.beginPath()
    c.arc(0, -r * 0.05, 11, 0, TAU)
    c.fill()
    const shell = (top) => {
      const g = c.createLinearGradient(0, top ? -r : 0, 0, top ? 0 : r)
      g.addColorStop(0, top ? '#a99bff' : '#8a7cff')
      g.addColorStop(1, top ? '#6a5bd8' : '#4436a8')
      c.fillStyle = g
      c.beginPath()
      if (top) c.ellipse(0, -r * 0.05 - open * r, r, r * 0.7, 0, Math.PI, TAU)
      else c.ellipse(0, r * 0.08, r, r * 0.72, 0, 0, Math.PI)
      c.closePath()
      c.fill()
      c.strokeStyle = 'rgba(255,255,255,0.25)'
      c.lineWidth = 3
      for (let i = 1; i < 8; i++) {
        const a = (top ? Math.PI : 0) + (i / 8) * Math.PI
        const cy = top ? -r * 0.05 - open * r : r * 0.08
        c.beginPath()
        c.moveTo(0, cy + (top ? -4 : 4))
        c.lineTo(Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.68)
        c.stroke()
      }
      c.strokeStyle = '#2e2380'
      c.lineWidth = 4
      c.beginPath()
      if (top) c.ellipse(0, -r * 0.05 - open * r, r, r * 0.7, 0, Math.PI, TAU)
      else c.ellipse(0, r * 0.08, r, r * 0.72, 0, 0, Math.PI)
      c.closePath()
      c.stroke()
    }
    shell(false)
    shell(true)
  }
  glow_clam(c, t) {
    halo(c, 0, -this.r * 0.05, 40, `rgba(255,220,250,${0.25 + 0.1 * Math.sin(t * 2)})`)
  }

  draw_wreck(c) {
    const r = this.r
    c.save()
    c.rotate(-0.1)
    // broken mast + sail
    c.fillStyle = '#4a321e'
    c.fillRect(r * 0.1, -r * 1.25, 12, r * 0.9)
    c.fillStyle = 'rgba(220,210,180,0.55)'
    c.beginPath()
    c.moveTo(r * 0.1 + 12, -r * 1.15)
    c.lineTo(r * 0.75, -r * 0.75)
    c.lineTo(r * 0.55, -r * 0.62)
    c.lineTo(r * 0.68, -r * 0.5)
    c.lineTo(r * 0.1 + 12, -r * 0.45)
    c.closePath()
    c.fill()
    // hull
    const g = c.createLinearGradient(0, -r * 0.6, 0, r * 0.7)
    g.addColorStop(0, '#8a5d38')
    g.addColorStop(1, '#3d2716')
    c.fillStyle = g
    c.beginPath()
    c.moveTo(-r * 1.25, -r * 0.6)
    c.lineTo(r * 1.15, -r * 0.55)
    c.quadraticCurveTo(r * 1.05, r * 0.4, r * 0.75, r * 0.7)
    c.lineTo(-r * 0.85, r * 0.72)
    c.quadraticCurveTo(-r * 1.15, r * 0.2, -r * 1.25, -r * 0.6)
    c.closePath()
    c.fill()
    c.strokeStyle = '#2a1a0e'
    c.lineWidth = 4
    c.stroke()
    c.strokeStyle = 'rgba(40,25,12,0.6)'
    c.lineWidth = 2.5
    for (let i = 1; i < 5; i++) {
      const y = -r * 0.6 + (i * r * 1.3) / 5
      c.beginPath()
      c.moveTo(-r * 1.15 + i * 6, y)
      c.lineTo(r * 1.08 - i * 8, y)
      c.stroke()
    }
    // a little hole
    c.fillStyle = '#1a0f08'
    c.beginPath()
    c.ellipse(-r * 0.55, r * 0.25, 16, 12, 0.3, 0, TAU)
    c.fill()
    // portholes
    c.fillStyle = '#2a2016'
    c.strokeStyle = '#c9a25a'
    c.lineWidth = 4
    for (const px of [-0.2, 0.25, 0.7]) {
      c.beginPath()
      c.arc(px * r, -r * 0.2, 10, 0, TAU)
      c.fill()
      c.stroke()
    }
    c.restore()
  }
  glow_wreck(c, t) {
    c.save()
    c.rotate(-0.1)
    for (const [i, px] of [-0.2, 0.25, 0.7].entries()) {
      const a = 0.35 + 0.3 * Math.sin(t * 1.5 + i * 2)
      dot(c, px * this.r, -this.r * 0.2, 7, `rgba(255,210,110,${a})`, 22)
    }
    c.restore()
  }

  draw_anemone(c, t) {
    const r = this.r
    c.fillStyle = '#a83a7a'
    c.beginPath()
    c.ellipse(0, -r * 0.1, r * 0.85, r * 0.55, 0, 0, TAU)
    c.fill()
    c.lineCap = 'round'
    for (const tn of this.d.tent) {
      const bx = Math.cos(tn.a) * r * 0.75
      const by = Math.sin(tn.a) * r * 0.45 + r * 0.05
      const w = Math.sin(t * 2 + tn.ph) * 12
      c.strokeStyle = '#ff8fc7'
      c.lineWidth = 9
      c.beginPath()
      c.moveTo(bx, by)
      c.quadraticCurveTo(bx * 1.15 + w, by - tn.len * 0.6, bx * 1.25 + w * 1.4, by - tn.len)
      c.stroke()
    }
    c.fillStyle = '#6a2450'
    c.beginPath()
    c.ellipse(0, r * 0.35, r * 0.95, r * 0.55, 0, 0, TAU)
    c.fill()
    c.fillStyle = 'rgba(255,255,255,0.12)'
    for (let i = 0; i < 5; i++) {
      c.beginPath()
      c.arc(-r * 0.6 + i * r * 0.3, r * 0.3 + (i % 2) * 10, 6, 0, TAU)
      c.fill()
    }
  }
  glow_anemone(c, t) {
    const r = this.r
    for (const tn of this.d.tent) {
      const bx = Math.cos(tn.a) * r * 0.75
      const by = Math.sin(tn.a) * r * 0.45 + r * 0.05
      const w = Math.sin(t * 2 + tn.ph) * 12
      dot(c, bx * 1.25 + w * 1.4, by - tn.len, 3, `rgba(255,240,150,${0.5 + 0.3 * Math.sin(t * 3 + tn.ph)})`, 8)
    }
  }

  draw_tubes(c) {
    const r = this.r
    c.fillStyle = '#2b1a4d'
    c.beginPath()
    c.ellipse(0, r * 0.2, r * 0.92, r * 0.75, 0, 0, TAU)
    c.fill()
    for (const tb of this.d.tubes) {
      const base = r * 0.85
      const g = c.createLinearGradient(tb.x - tb.w / 2, 0, tb.x + tb.w / 2, 0)
      g.addColorStop(0, '#5a2fb8')
      g.addColorStop(0.5, '#9b6bff')
      g.addColorStop(1, '#4a249a')
      c.fillStyle = g
      c.beginPath()
      c.moveTo(tb.x - tb.w / 2, base)
      c.lineTo(tb.x - tb.w / 2 - 3, base - tb.h)
      c.lineTo(tb.x + tb.w / 2 + 3, base - tb.h)
      c.lineTo(tb.x + tb.w / 2, base)
      c.closePath()
      c.fill()
      c.fillStyle = '#1a0d33'
      c.beginPath()
      c.ellipse(tb.x, base - tb.h, tb.w / 2 + 3, 7, 0, 0, TAU)
      c.fill()
    }
  }
  glow_tubes(c, t) {
    for (const [i, tb] of this.d.tubes.entries()) {
      c.strokeStyle = `rgba(215,184,255,${0.4 + 0.3 * Math.sin(t * 2 + i)})`
      c.lineWidth = 3
      c.beginPath()
      c.ellipse(tb.x, this.r * 0.85 - tb.h, tb.w / 2 + 3, 7, 0, 0, TAU)
      c.stroke()
    }
  }

  draw_vent(c) {
    const r = this.r
    const g = c.createLinearGradient(0, -r, 0, r)
    g.addColorStop(0, '#4a3a38')
    g.addColorStop(1, '#1e1818')
    c.fillStyle = g
    c.beginPath()
    c.moveTo(-r, r * 0.85)
    c.lineTo(-r * 0.75, r * 0.3)
    c.lineTo(-r * 0.62, -r * 0.2)
    c.lineTo(-r * 0.42, -r * 0.55)
    c.lineTo(-r * 0.35, -r * 0.95)
    c.lineTo(r * 0.35, -r * 0.95)
    c.lineTo(r * 0.45, -r * 0.5)
    c.lineTo(r * 0.68, -r * 0.1)
    c.lineTo(r * 0.8, r * 0.35)
    c.lineTo(r, r * 0.85)
    c.closePath()
    c.fill()
    c.strokeStyle = '#140f0f'
    c.lineWidth = 4
    c.stroke()
    c.fillStyle = '#0d0909'
    c.beginPath()
    c.ellipse(0, -r * 0.95, r * 0.35, 8, 0, 0, TAU)
    c.fill()
  }
  glow_vent(c, t) {
    const r = this.r
    c.strokeStyle = `rgba(255,130,60,${0.45 + 0.25 * Math.sin(t * 3)})`
    c.lineWidth = 3
    c.beginPath()
    c.moveTo(-r * 0.3, r * 0.6)
    c.lineTo(-r * 0.15, r * 0.2)
    c.lineTo(-r * 0.25, -r * 0.3)
    c.moveTo(r * 0.3, r * 0.5)
    c.lineTo(r * 0.2, 0)
    c.lineTo(r * 0.28, -r * 0.5)
    c.stroke()
    for (const b of this.d.bub) {
      const p = (b.p + t * 0.25) % 1
      const y = -r * 0.95 - p * r * 1.4
      c.strokeStyle = `rgba(200,230,255,${0.6 * (1 - p)})`
      c.lineWidth = 2
      c.beginPath()
      c.arc(b.x + Math.sin(t * 2 + b.s) * 8 * p, y, b.s, 0, TAU)
      c.stroke()
    }
  }
}

// Glows are drawn from small pre-rendered sprites (one per color) instead of building
// a radial gradient for every dot every frame, which is very slow in Chrome.
const spriteCache = new Map()
const RGBA = /rgba?\(\s*([^,)]+),\s*([^,)]+),\s*([^,)]+)(?:,\s*([^,)]+))?\)/

function parseColor(color) {
  const m = RGBA.exec(color)
  if (!m) return [color, 1]
  return [`${m[1]},${m[2]},${m[3]}`, m[4] === undefined ? 1 : Number(m[4])]
}

function sprite(rgb, kind) {
  const key = rgb + kind
  let cv = spriteCache.get(key)
  if (!cv) {
    cv = document.createElement('canvas')
    cv.width = cv.height = 64
    const g = cv.getContext('2d')
    if (kind === 'halo') {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      grad.addColorStop(0, `rgba(${rgb},1)`)
      grad.addColorStop(1, `rgba(${rgb},0)`)
      g.fillStyle = grad
    } else g.fillStyle = `rgb(${rgb})`
    g.beginPath()
    g.arc(32, 32, kind === 'halo' ? 32 : 30, 0, TAU)
    g.fill()
    spriteCache.set(key, cv)
  }
  return cv
}

function drawSprite(c, x, y, r, color, kind) {
  const [rgb, a] = parseColor(color)
  if (a <= 0.01) return
  const prev = c.globalAlpha
  c.globalAlpha = prev * Math.min(1, a)
  c.drawImage(sprite(rgb, kind), x - r, y - r, r * 2, r * 2)
  c.globalAlpha = prev
}

function dot(c, x, y, r, color, haloR) {
  if (haloR) drawSprite(c, x, y, haloR, color, 'halo')
  drawSprite(c, x, y, r, color, 'dot')
}

function halo(c, x, y, r, color) {
  drawSprite(c, x, y, r, color, 'halo')
}

/** A soft round light-hole sprite (used by the darkness layer). */
export function lightSprite() {
  return sprite('0,0,0', 'halo')
}

function genSpots() {
  const kinds = shuffle([...KINDS, ...shuffle([...KINDS])])
  const spots = []
  const want = Math.round((WORLD_W * WORLD_H) / 150000) // about 11 on a 16:9 screen
  for (let minD = 300; spots.length < want && minD > 200; minD -= 20) {
    for (let tries = 0; tries < 3000 && spots.length < want; tries++) {
      const x = rand(150, WORLD_W - 150)
      const y = rand(190, FLOOR_Y - 80)
      if (dist(x, y, HOME.x, HOME.y) < 250) continue
      if (spots.some((s) => dist(s.x, s.y, x, y) < minD)) continue
      const kind = kinds[spots.length % kinds.length]
      spots.push(new Spot(kind, x, y, kind === 'wreck' ? 92 : rand(80, 92)))
    }
  }
  return spots
}

// ---------- Ambient critters ----------

class LanternSchool {
  constructor() {
    this.x = rand(0, WORLD_W)
    this.y = rand(150, FLOOR_Y - 150)
    this.vx = rand(35, 65) * (Math.random() < 0.5 ? -1 : 1)
    this.fish = Array.from({ length: Math.floor(rand(5, 9)) }, () => ({ ox: rand(-60, 60), oy: rand(-35, 35), ph: rand(0, TAU), s: rand(0.8, 1.2) }))
  }
  update(dt, t) {
    this.x += this.vx * dt
    this.y += Math.sin(t * 0.5 + this.fish[0].ph) * 10 * dt
    if (this.x < -150) this.x = WORLD_W + 150
    if (this.x > WORLD_W + 150) this.x = -150
  }
  each(t, fn) {
    for (const f of this.fish) fn(this.x + f.ox + Math.sin(t * 1.3 + f.ph) * 6, this.y + f.oy + Math.cos(t * 1.7 + f.ph) * 5, f)
  }
  draw(c, t) {
    const d = Math.sign(this.vx)
    this.each(t, (x, y, f) => {
      c.save()
      c.translate(x, y)
      c.scale(d * f.s, f.s)
      c.fillStyle = '#3c4f7a'
      c.beginPath()
      c.ellipse(0, 0, 11, 6, 0, 0, TAU)
      c.fill()
      c.beginPath()
      c.moveTo(-9, 0)
      c.lineTo(-17, -6 + Math.sin(t * 12 + f.ph) * 2)
      c.lineTo(-17, 6 + Math.sin(t * 12 + f.ph) * 2)
      c.closePath()
      c.fill()
      c.fillStyle = '#fff'
      c.beginPath()
      c.arc(6, -1.5, 2.6, 0, TAU)
      c.fill()
      c.fillStyle = '#111'
      c.beginPath()
      c.arc(6.6, -1.5, 1.3, 0, TAU)
      c.fill()
      c.restore()
    })
  }
  glow(c, t) {
    const d = Math.sign(this.vx)
    this.each(t, (x, y, f) => {
      for (let i = -1; i <= 1; i++) dot(c, x + i * 5 * d * f.s, y + 4 * f.s, 1.6, 'rgba(120,255,255,0.8)', 6)
    })
  }
  lights(out) {
    out.push({ x: this.x, y: this.y, r: 90, a: 0.25 })
  }
}

class Jelly {
  constructor() {
    this.x = rand(100, WORLD_W - 100)
    this.y = rand(150, FLOOR_Y - 150)
    this.ph = rand(0, TAU)
    this.hue = pick([[255, 140, 220], [140, 200, 255], [190, 150, 255], [140, 255, 220]])
    this.vx = rand(-10, 10)
    this.squish = 0
  }
  update(dt, t) {
    const p = Math.sin(t * 2 + this.ph)
    this.y += (-14 * Math.max(0, p) + 6) * dt
    this.x += this.vx * dt
    if (this.y < 120) this.y = FLOOR_Y - 150
    if (this.y > FLOOR_Y - 100) this.y = 130
    if (this.x < 50 || this.x > WORLD_W - 50) this.vx *= -1
    this.squish = Math.max(0, this.squish - dt * 2)
  }
  draw(c, t) {
    const p = Math.sin(t * 2 + this.ph)
    const [r, g, b] = this.hue
    const s = 1 + this.squish * Math.sin(t * 30) * 0.3
    c.save()
    c.translate(this.x, this.y)
    c.scale(s, 1 / s)
    c.strokeStyle = `rgba(${r},${g},${b},0.6)`
    c.lineWidth = 2.5
    c.lineCap = 'round'
    for (let i = 0; i < 4; i++) {
      const x0 = -12 + i * 8
      c.beginPath()
      c.moveTo(x0, 4)
      c.quadraticCurveTo(x0 + Math.sin(t * 3 + i) * 7, 20, x0 + Math.sin(t * 2 + i) * 4, 34 - p * 4)
      c.stroke()
    }
    c.fillStyle = `rgba(${r},${g},${b},0.45)`
    c.strokeStyle = `rgba(${r},${g},${b},0.9)`
    c.beginPath()
    c.ellipse(0, 0, 22 * (1 + p * 0.08), 20 * (1 - p * 0.08), 0, Math.PI, TAU)
    c.quadraticCurveTo(0, 8, -22 * (1 + p * 0.08), 0)
    c.fill()
    c.stroke()
    // cute face
    c.fillStyle = '#2a1840'
    c.beginPath()
    c.arc(-6, -7, 2.2, 0, TAU)
    c.arc(6, -7, 2.2, 0, TAU)
    c.fill()
    c.strokeStyle = '#2a1840'
    c.lineWidth = 1.5
    c.beginPath()
    c.arc(0, -4, 3, 0.2 * Math.PI, 0.8 * Math.PI)
    c.stroke()
    c.restore()
  }
  glow(c) {
    const [r, g, b] = this.hue
    halo(c, this.x, this.y, 48, `rgba(${r},${g},${b},0.22)`)
  }
  lights(out) {
    out.push({ x: this.x, y: this.y, r: 80, a: 0.35 })
  }
  touch() {
    if (this.squish > 0) return
    this.squish = 1
    sfx.boing()
  }
}

class Angler {
  constructor() {
    this.x = rand(100, WORLD_W - 100)
    this.y = rand(250, FLOOR_Y - 120)
    this.vx = rand(18, 30) * (Math.random() < 0.5 ? -1 : 1)
    this.ph = rand(0, TAU)
    this.bright = 0
  }
  update(dt, t) {
    this.x += this.vx * dt
    this.y += Math.sin(t * 0.7 + this.ph) * 8 * dt
    if (this.x < 80 || this.x > WORLD_W - 80) this.vx *= -1
    this.bright = Math.max(0, this.bright - dt)
  }
  lure(t) {
    const d = Math.sign(this.vx)
    return [this.x + d * (30 + Math.sin(t * 2) * 3), this.y - 44 + Math.cos(t * 2) * 3]
  }
  draw(c, t) {
    const d = Math.sign(this.vx)
    c.save()
    c.translate(this.x, this.y)
    c.scale(d, 1)
    c.fillStyle = '#4a3a5a'
    c.beginPath()
    c.moveTo(-24, 0)
    c.lineTo(-44, -14 + Math.sin(t * 6) * 3)
    c.lineTo(-44, 14 + Math.sin(t * 6) * 3)
    c.closePath()
    c.fill()
    c.beginPath()
    c.arc(0, 0, 28, 0, TAU)
    c.fill()
    c.fillStyle = '#6b5880'
    c.beginPath()
    c.ellipse(-2, 10, 20, 12, 0, 0, TAU)
    c.fill()
    // mouth with tiny teeth
    c.fillStyle = '#1a1020'
    c.beginPath()
    c.ellipse(16, 10, 12, 7, -0.2, 0, TAU)
    c.fill()
    c.fillStyle = '#fff'
    for (let i = 0; i < 4; i++) {
      c.beginPath()
      c.moveTo(8 + i * 5, 5)
      c.lineTo(10 + i * 5, 10)
      c.lineTo(12 + i * 5, 5)
      c.fill()
    }
    // big cute eye
    c.fillStyle = '#fff'
    c.beginPath()
    c.arc(10, -9, 9, 0, TAU)
    c.fill()
    c.fillStyle = '#111'
    c.beginPath()
    c.arc(12, -8, 5, 0, TAU)
    c.fill()
    c.fillStyle = '#fff'
    c.beginPath()
    c.arc(13.5, -10, 1.8, 0, TAU)
    c.fill()
    // stalk
    c.strokeStyle = '#4a3a5a'
    c.lineWidth = 3
    c.beginPath()
    c.moveTo(4, -26)
    c.quadraticCurveTo(14, -54, 30 + Math.sin(t * 2) * 3, -44 + Math.cos(t * 2) * 3)
    c.stroke()
    c.restore()
  }
  glow(c, t) {
    const [lx, ly] = this.lure(t)
    const a = 0.7 + 0.3 * Math.sin(t * 4) + this.bright
    halo(c, lx, ly, 55 + this.bright * 60, `rgba(220,255,140,${0.35 * a})`)
    dot(c, lx, ly, 6, `rgba(240,255,190,${Math.min(1, 0.8 * a)})`)
  }
  lights(out, t) {
    const [lx, ly] = this.lure(t)
    out.push({ x: lx, y: ly, r: 150 + this.bright * 120, a: 0.6 })
  }
  touch() {
    if (this.bright > 0) return
    this.bright = 1.5
    sfx.reveal()
  }
}

class Shrimp {
  constructor() {
    this.x = rand(100, WORLD_W - 100)
    this.y = rand(200, FLOOR_Y - 60)
    this.vx = 0
    this.vy = 0
    this.d = 1
    this.hop = rand(1, 3)
    this.puff = 0
  }
  update(dt) {
    this.hop -= dt
    if (this.hop <= 0) {
      this.hop = rand(1.5, 3.5)
      this.d = Math.random() < 0.5 ? -1 : 1
      this.vx = this.d * rand(60, 110)
      this.vy = rand(-60, 20)
      if (Math.random() < 0.3) this.puff = 1
    }
    this.vx *= 1 - dt * 2
    this.vy *= 1 - dt * 2
    this.x = Math.max(60, Math.min(WORLD_W - 60, this.x + this.vx * dt))
    this.y = Math.max(120, Math.min(FLOOR_Y - 30, this.y + this.vy * dt))
    this.puff = Math.max(0, this.puff - dt * 0.8)
  }
  draw(c, t) {
    c.save()
    c.translate(this.x, this.y)
    c.scale(this.d, 1)
    c.fillStyle = '#ff5a4a'
    for (let i = 0; i < 5; i++) {
      c.beginPath()
      c.arc(-i * 6, Math.sin(i * 0.5) * 4 + i * 1.5, 8 - i, 0, TAU)
      c.fill()
    }
    c.beginPath()
    c.moveTo(-28, 8)
    c.lineTo(-36, 2)
    c.lineTo(-36, 14)
    c.closePath()
    c.fill()
    c.strokeStyle = '#ff7a6a'
    c.lineWidth = 1.2
    c.beginPath()
    c.moveTo(6, -3)
    c.quadraticCurveTo(22, -16, 30, -10 + Math.sin(t * 5) * 3)
    c.moveTo(6, -1)
    c.quadraticCurveTo(24, -6, 32, 0 + Math.sin(t * 5 + 1) * 3)
    for (let i = 0; i < 4; i++) {
      c.moveTo(-i * 6, 6)
      c.lineTo(-i * 6 + Math.sin(t * 10 + i) * 2, 13)
    }
    c.stroke()
    c.fillStyle = '#111'
    c.beginPath()
    c.arc(4, -3, 2, 0, TAU)
    c.fill()
    c.restore()
  }
  glow(c) {
    if (this.puff > 0) halo(c, this.x - this.d * 30, this.y, 40 * (1.5 - this.puff), `rgba(120,200,255,${0.5 * this.puff})`)
  }
  lights() {}
}

class Dumbo {
  constructor() {
    this.x = rand(150, WORLD_W - 150)
    this.y = rand(200, FLOOR_Y - 150)
    this.tx = this.x
    this.ty = this.y
    this.flip = 0
    this.ph = rand(0, TAU)
  }
  update(dt) {
    if (dist(this.x, this.y, this.tx, this.ty) < 10) {
      this.tx = Math.max(150, Math.min(WORLD_W - 150, this.x + rand(-300, 300)))
      this.ty = Math.max(200, Math.min(FLOOR_Y - 150, this.y + rand(-200, 200)))
    }
    const a = Math.atan2(this.ty - this.y, this.tx - this.x)
    this.x += Math.cos(a) * 30 * dt
    this.y += Math.sin(a) * 30 * dt
    this.flip = Math.max(0, this.flip - dt * 1.2)
  }
  draw(c, t) {
    c.save()
    c.translate(this.x, this.y + Math.sin(t * 2 + this.ph) * 5)
    c.rotate((1 - this.flip) * TAU * (this.flip > 0 ? 1 : 0))
    const flap = Math.sin(t * 5 + this.ph) * 0.4
    c.fillStyle = '#ff9f80'
    for (const s of [-1, 1]) {
      c.save()
      c.translate(s * 20, -14)
      c.rotate(s * (0.5 + flap))
      c.beginPath()
      c.ellipse(s * 8, 0, 11, 7, 0, 0, TAU)
      c.fill()
      c.restore()
    }
    c.fillStyle = '#ffb894'
    c.beginPath()
    c.ellipse(0, -6, 22, 22, 0, Math.PI, TAU)
    c.lineTo(22, 6)
    for (let i = 0; i < 6; i++) {
      const x = 22 - (i + 0.5) * (44 / 6)
      c.quadraticCurveTo(x + 3, 18 + Math.sin(t * 4 + i) * 3, x - 3.6, 6)
    }
    c.closePath()
    c.fill()
    c.fillStyle = '#2a1a1a'
    c.beginPath()
    c.arc(-8, -8, 3.5, 0, TAU)
    c.arc(8, -8, 3.5, 0, TAU)
    c.fill()
    c.fillStyle = '#fff'
    c.beginPath()
    c.arc(-7, -9.5, 1.3, 0, TAU)
    c.arc(9, -9.5, 1.3, 0, TAU)
    c.fill()
    c.fillStyle = 'rgba(255,100,130,0.5)'
    c.beginPath()
    c.ellipse(-14, -1, 4, 2.5, 0, 0, TAU)
    c.ellipse(14, -1, 4, 2.5, 0, 0, TAU)
    c.fill()
    c.restore()
  }
  glow() {}
  lights() {}
  touch(game) {
    if (this.flip > 0) return
    this.flip = 1
    sfx.flip()
    game.burst(this.x, this.y - 20, 'heart', 6)
  }
}

// ---------- Easter eggs ----------

class Chest {
  constructor(spots) {
    for (let i = 0; i < 200; i++) {
      this.x = rand(150, WORLD_W - 150)
      this.y = FLOOR_Y - 20
      if (!spots.some((s) => Math.abs(s.x - this.x) < 160 && s.y > FLOOR_Y - 300)) break
    }
    this.open = 0
  }
  update(dt) {
    if (this.open > 0) this.open = Math.min(1, this.open + dt * 2)
  }
  draw(c) {
    c.save()
    c.translate(this.x, this.y)
    c.fillStyle = '#8a5a2b'
    c.strokeStyle = '#3d2410'
    c.lineWidth = 3
    c.fillRect(-26, -18, 52, 26)
    c.strokeRect(-26, -18, 52, 26)
    c.fillStyle = '#e8b83a'
    c.fillRect(-26, -8, 52, 4)
    c.save()
    c.translate(-26, -18)
    c.rotate(-this.open * 1.9)
    c.fillStyle = '#9a6a35'
    c.beginPath()
    c.moveTo(0, 0)
    c.lineTo(52, 0)
    c.quadraticCurveTo(52, -16, 26, -18)
    c.quadraticCurveTo(0, -16, 0, 0)
    c.fill()
    c.stroke()
    c.restore()
    c.fillStyle = '#ffd34a'
    c.fillRect(-4, -14, 8, 9)
    c.restore()
  }
  glow(c, t) {
    if (this.open > 0) halo(c, this.x, this.y - 20, 60, `rgba(255,220,100,${0.4 + 0.1 * Math.sin(t * 5)})`)
    else halo(c, this.x, this.y - 10, 30, `rgba(255,220,100,${0.1 + 0.08 * Math.sin(t * 2)})`)
  }
  lights(out) {
    if (this.open > 0) out.push({ x: this.x, y: this.y - 20, r: 130, a: 0.6 })
  }
  touch(game) {
    if (this.open > 0) return
    this.open = 0.01
    sfx.chest()
    game.burst(this.x, this.y - 30, 'coin', 14)
    game.addStar('Treasure chest! 💰')
  }
}

class Duck {
  constructor() {
    this.reset()
  }
  reset() {
    this.x = rand(150, WORLD_W - 150)
    this.y = rand(150, FLOOR_Y - 150)
    this.spin = 0
  }
  update(dt) {
    if (this.spin > 0) {
      this.spin -= dt
      if (this.spin <= 0) this.reset()
    }
  }
  draw(c, t) {
    c.save()
    c.translate(this.x, this.y + Math.sin(t * 2) * 4)
    if (this.spin > 0) c.rotate((1.2 - this.spin) * 12)
    c.scale(0.8, 0.8)
    c.fillStyle = '#ffd92e'
    c.beginPath()
    c.ellipse(0, 6, 20, 13, 0, 0, TAU)
    c.fill()
    c.beginPath()
    c.arc(10, -8, 11, 0, TAU)
    c.fill()
    c.beginPath()
    c.moveTo(-18, 2)
    c.lineTo(-28, -6)
    c.lineTo(-20, 10)
    c.fill()
    c.fillStyle = '#ff8a1f'
    c.beginPath()
    c.ellipse(23, -6, 7, 3.5, 0, 0, TAU)
    c.fill()
    c.fillStyle = '#111'
    c.beginPath()
    c.arc(13, -11, 2, 0, TAU)
    c.fill()
    c.restore()
  }
  glow(c, t) {
    halo(c, this.x, this.y, 34, `rgba(255,240,120,${0.12 + 0.06 * Math.sin(t * 3)})`)
  }
  lights() {}
  touch(game) {
    if (this.spin > 0) return
    this.spin = 1.2
    sfx.duck()
    game.burst(this.x, this.y, 'confetti', 18)
    game.addStar('A rubber duck! 🐤')
  }
}

class Submarine {
  constructor() {
    this.active = false
    this.wait = rand(25, 45)
  }
  update(dt) {
    if (!this.active) {
      this.wait -= dt
      if (this.wait <= 0) {
        this.active = true
        this.d = Math.random() < 0.5 ? 1 : -1
        this.x = this.d > 0 ? -150 : WORLD_W + 150
        this.y = rand(200, FLOOR_Y - 250)
        this.touched = false
      }
      return
    }
    this.x += this.d * 80 * dt
    if (this.x < -200 || this.x > WORLD_W + 200) {
      this.active = false
      this.wait = rand(50, 80)
    }
  }
  draw(c, t) {
    if (!this.active) return
    c.save()
    c.translate(this.x, this.y + Math.sin(t) * 6)
    c.scale(this.d, 1)
    c.fillStyle = '#ffcf3a'
    c.strokeStyle = '#8a6a10'
    c.lineWidth = 3
    c.beginPath()
    c.ellipse(0, 0, 60, 28, 0, 0, TAU)
    c.fill()
    c.stroke()
    c.fillRect(-12, -46, 30, 22)
    c.strokeRect(-12, -46, 30, 22)
    c.beginPath()
    c.moveTo(6, -46)
    c.lineTo(6, -62)
    c.lineTo(18, -62)
    c.stroke()
    for (const px of [-28, 0, 28]) {
      c.fillStyle = '#9fe0ff'
      c.beginPath()
      c.arc(px, 2, 8, 0, TAU)
      c.fill()
      c.stroke()
    }
    // propeller
    c.fillStyle = '#c9a020'
    c.save()
    c.translate(-64, 0)
    c.scale(1, Math.sin(t * 20))
    c.fillRect(-3, -14, 6, 28)
    c.restore()
    c.restore()
  }
  glow(c, t) {
    if (!this.active) return
    const x = this.x + this.d * 60
    const y = this.y + Math.sin(t) * 6
    c.save()
    c.translate(x, y)
    c.scale(this.d, 1)
    const g = c.createLinearGradient(0, 0, 260, 0)
    g.addColorStop(0, 'rgba(255,250,200,0.35)')
    g.addColorStop(1, 'rgba(255,250,200,0)')
    c.fillStyle = g
    c.beginPath()
    c.moveTo(0, -6)
    c.lineTo(260, -70)
    c.lineTo(260, 70)
    c.lineTo(0, 6)
    c.closePath()
    c.fill()
    c.restore()
  }
  lights(out, t) {
    if (!this.active) return
    out.push({ x: this.x, y: this.y, r: 120, a: 0.5 })
    out.push({ x: this.x + this.d * 170, y: this.y + Math.sin(t) * 6, r: 120, a: 0.5 })
  }
  touch(game) {
    if (!this.active || this.touched) return
    this.touched = true
    sfx.sub()
    game.burst(this.x, this.y - 40, 'bubble', 10)
    game.addStar('Yellow submarine! 🚢')
  }
}

/** A gigantic, gentle whale shadow drifting far in the background. */
class MamaWhale {
  constructor() {
    this.active = false
    this.wait = rand(35, 60)
  }
  update(dt) {
    if (!this.active) {
      this.wait -= dt
      if (this.wait <= 0) {
        this.active = true
        this.d = Math.random() < 0.5 ? 1 : -1
        this.x = this.d > 0 ? -400 : WORLD_W + 400
        this.y = rand(300, WORLD_H - 300)
        sfx.whaleSong()
      }
      return
    }
    this.x += this.d * 45 * dt
    if (this.x < -500 || this.x > WORLD_W + 500) {
      this.active = false
      this.wait = rand(70, 110)
    }
  }
  draw(c, t) {
    if (!this.active) return
    c.save()
    c.translate(this.x, this.y + Math.sin(t * 0.4) * 30)
    c.scale(this.d * 4, 4)
    c.globalAlpha = 0.22
    c.fillStyle = '#1d3a7a'
    c.beginPath()
    c.ellipse(0, 0, 50, 30, 0, 0, TAU)
    c.fill()
    c.save()
    c.translate(-45, 0)
    c.rotate(Math.sin(t * 1.2) * 0.2)
    c.beginPath()
    c.moveTo(6, -8)
    c.quadraticCurveTo(-12, -10, -26, -28)
    c.quadraticCurveTo(-18, -6, -14, 0)
    c.quadraticCurveTo(-20, 6, -28, 20)
    c.quadraticCurveTo(-12, 10, 6, 8)
    c.fill()
    c.restore()
    c.globalAlpha = 0.35
    c.fillStyle = '#8fb8ff'
    c.beginPath()
    c.arc(26, -6, 3, 0, TAU)
    c.fill()
    c.restore()
  }
  glow(c, t) {
    if (!this.active) return
    // a floating heart above her
    c.save()
    c.translate(this.x + this.d * 80, this.y - 160 + Math.sin(t * 2) * 10)
    c.scale(2, 2)
    c.fillStyle = 'rgba(255,140,180,0.35)'
    heart(c)
    c.restore()
  }
  lights() {}
}

export function heart(c) {
  c.beginPath()
  c.moveTo(0, 4)
  c.bezierCurveTo(-8, -2, -6, -10, 0, -6)
  c.bezierCurveTo(6, -10, 8, -2, 0, 4)
  c.fill()
}

// ---------- The world ----------

export class World {
  constructor() {
    this.spots = genSpots()
    this.critters = [
      ...Array.from({ length: 4 }, () => new LanternSchool()),
      ...Array.from({ length: 5 }, () => new Jelly()),
      ...Array.from({ length: 2 }, () => new Angler()),
      ...Array.from({ length: 4 }, () => new Shrimp()),
      new Dumbo(),
    ]
    this.mama = new MamaWhale()
    this.eggs = [new Chest(this.spots), new Duck(), new Submarine()]
    this.floor = Array.from({ length: 40 }, (_, i) => [(i / 39) * WORLD_W, FLOOR_Y + rand(-20, 15)])
    this.stars = Array.from({ length: 10 }, () => ({ x: rand(50, WORLD_W - 50), y: FLOOR_Y + rand(10, 50), r: rand(7, 11), rot: rand(0, TAU) }))
    this.floorGlow = Array.from({ length: 30 }, () => [rand(0, WORLD_W), FLOOR_Y + rand(0, 70), rand(0, TAU)])
    this.distant = Array.from({ length: 10 }, (_, i) => ({ x: (i / 9) * WORLD_W + rand(-80, 80), w: rand(200, 420), h: rand(120, 300) }))
  }

  spotAt(x, y) {
    for (const s of this.spots) if (s.covers(x, y)) return s
    return null
  }

  update(dt, t, game) {
    for (const cr of this.critters) cr.update(dt, t)
    for (const e of this.eggs) e.update(dt)
    this.mama.update(dt)
    const p = game.player
    if (!p) return
    for (const cr of this.critters) {
      if (!cr.touch) continue
      if (dist(cr.x, cr.y, p.x, p.y) < 50) cr.touch(game)
    }
    for (const e of this.eggs) {
      if (e.active === false) continue
      if (dist(e.x, e.y, p.x, p.y) < 60) e.touch(game)
    }
  }

  drawBack(c, t) {
    this.mama.draw(c, t)
    // distant silhouettes of hills
    c.fillStyle = 'rgba(20,30,70,0.5)'
    for (const d of this.distant) {
      c.beginPath()
      c.ellipse(d.x, FLOOR_Y, d.w, d.h, 0, Math.PI, TAU)
      c.fill()
    }
    // seafloor
    c.fillStyle = '#0e1534'
    c.beginPath()
    c.moveTo(0, WORLD_H + 200)
    for (const [x, y] of this.floor) c.lineTo(x, y)
    c.lineTo(WORLD_W, WORLD_H + 200)
    c.closePath()
    c.fill()
    c.strokeStyle = '#1d2a5a'
    c.lineWidth = 4
    c.beginPath()
    for (const [i, [x, y]] of this.floor.entries()) i ? c.lineTo(x, y) : c.moveTo(x, y)
    c.stroke()
    // starfish
    c.fillStyle = '#ff7aa8'
    for (const s of this.stars) {
      c.save()
      c.translate(s.x, s.y)
      c.rotate(s.rot)
      c.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU - Math.PI / 2
        const rr = i % 2 ? s.r * 0.45 : s.r
        c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
      }
      c.closePath()
      c.fill()
      c.restore()
    }
    // home base: a ring of glowing pebbles
    c.fillStyle = 'rgba(80,120,200,0.25)'
    c.beginPath()
    c.ellipse(HOME.x, HOME.y + 40, 110, 34, 0, 0, TAU)
    c.fill()
  }

  drawSpots(c, t) {
    for (const s of this.spots) s.draw(c, t)
  }

  drawFront(c, t) {
    for (const e of this.eggs) e.draw(c, t)
    for (const cr of this.critters) cr.draw(c, t)
  }

  drawGlow(c, t) {
    for (const [x, y, ph] of this.floorGlow) dot(c, x, y, 1.8, `rgba(120,200,255,${0.25 + 0.25 * Math.sin(t * 1.5 + ph)})`, 7)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + t * 0.3
      dot(c, HOME.x + Math.cos(a) * 100, HOME.y + 40 + Math.sin(a) * 30, 3, 'rgba(140,220,255,0.6)', 12)
    }
    for (const s of this.spots) s.glow(c, t)
    for (const e of this.eggs) e.glow(c, t)
    for (const cr of this.critters) cr.glow(c, t)
    this.mama.glow(c, t)
  }

  lights(t) {
    const out = []
    for (const cr of this.critters) cr.lights(out, t)
    for (const e of this.eggs) e.lights(out, t)
    out.push({ x: HOME.x, y: HOME.y + 40, r: 160, a: 0.4 })
    return out
  }
}
