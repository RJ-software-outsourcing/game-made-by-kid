// The map screen (loaded the first time it is opened). North is up.
import * as L from './land.js'

const R = 138 // world units from the center to the map edge
let base = null

function makeBase(sample, trees) {
  const N = 300
  const cv = document.createElement('canvas')
  cv.width = N
  cv.height = N
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(N, N)
  const M = L.MOUNTAIN
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = -R + ((i + 0.5) / N) * R * 2
      const z = -R + ((j + 0.5) / N) * R * 2
      const h = sample(x, z)
      let c
      if (L.inStream(x, z, 0.3) || L.inPond(x, z, 0.3) || L.inMoat(x, z)) c = [87, 196, 234]
      else if (L.spookiness(x, z) > 0.5 && h > 0.5) c = [120, 110, 140]
      else if (h < 0) {
        const k = Math.min(1, -h / 5)
        c = [95 - 50 * k, 208 - 65 * k, 230 - 15 * k]
      } else if (Math.hypot(x - M.x, z - M.z) < M.r - 2 && h > 2) c = h > 15 ? [240, 237, 232] : [180, 173, 163]
      else if (h < 0.95 && L.inland(x, z) < 18) c = [242, 224, 168]
      else if (L.spookiness(x, z) > 0) {
        const f = L.spookiness(x, z)
        c = [154 - 40 * f, 214 - 100 * f, 113 + 10 * f]
      } else {
        const f = L.forestness(x, z)
        c = [154 - 50 * f, 214 - 34 * f, 113 - 21 * f]
      }
      const k = (j * N + i) * 4
      img.data[k] = c[0]
      img.data[k + 1] = c[1]
      img.data[k + 2] = c[2]
      img.data[k + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  // trees
  ctx.fillStyle = 'rgba(46, 120, 60, 0.55)'
  const s = N / (R * 2)
  for (const [x, z] of trees) {
    ctx.beginPath()
    ctx.arc((x + R) * s, (z + R) * s, 1.4, 0, Math.PI * 2)
    ctx.fill()
  }
  return cv
}

export function drawMap(canvas, opts) {
  const { sample, trees, player, camYaw, stars, targets, bearOnBridge, lit } = opts
  const size = Math.floor(Math.min(window.innerWidth - 32, window.innerHeight - 32, 860))
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = size * dpr
  canvas.height = size * dpr
  canvas.style.width = size + 'px'
  canvas.style.height = size + 'px'
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (!base) base = makeBase(sample, trees)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(base, 0, 0, size, size)
  const s = size / (R * 2)
  const P = (x, z) => [(x + R) * s, (z + R) * s]

  // roads
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const pass of [0, 1]) {
    for (const r of L.ROADS) {
      ctx.beginPath()
      r.pts.forEach(([x, z], i) => {
        const [px, py] = P(x, z)
        if (i) ctx.lineTo(px, py)
        else ctx.moveTo(px, py)
      })
      ctx.strokeStyle = pass ? '#fbeccb' : '#d2b47c'
      ctx.lineWidth = Math.max(3, r.w * s) + (pass ? 0 : 3)
      ctx.stroke()
    }
  }
  const [px0, py0] = P(L.PLAZA.x, L.PLAZA.z)
  ctx.fillStyle = '#fbeccb'
  ctx.beginPath()
  ctx.arc(px0, py0, L.PLAZA.r * s, 0, Math.PI * 2)
  ctx.fill()
  // pier, drawbridge and Bear Bridge
  ctx.fillStyle = '#b98a5e'
  ctx.fillRect(...P(L.PIER.x0, L.PIER.z0), (L.PIER.x1 - L.PIER.x0) * s, (L.PIER.z1 - L.PIER.z0) * s)
  const D = L.DRAWBRIDGE
  ctx.fillRect(...P(D.x0, L.CASTLE.z + D.z0), (D.x1 - D.x0) * s, (D.z1 - D.z0) * s)
  ctx.strokeStyle = '#b98a5e'
  ctx.lineWidth = Math.max(4, L.BRIDGE.w * s)
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(...P(L.BRIDGE.ax, L.BRIDGE.az))
  ctx.lineTo(...P(L.BRIDGE.bx, L.BRIDGE.bz))
  ctx.stroke()
  // graveyard: fence circle and little gravestones
  const [gx, gy] = P(L.GRAVEYARD.x, L.GRAVEYARD.z)
  ctx.strokeStyle = '#3b3546'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(gx, gy, L.GRAVEYARD.r * s, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#9e9aa8'
  for (const g of L.GRAVES) {
    const [x, y] = P(g.x, g.z)
    ctx.fillRect(x - 1.5, y - 2, 3, 4)
  }

  // buildings
  for (const b of L.BUILDINGS) {
    const [x, y] = P(b.x, b.z)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(-b.rot)
    ctx.fillStyle = b.kind === 'lighthouse' ? (lit ? '#fff1a6' : '#e94b3c') : b.kind === 'castle' ? '#e8e0cf' : b.kind === 'house' ? '#f0705f' : '#ffb22e'
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    const w = Math.max(6, b.w * s)
    const d = Math.max(6, b.d * s)
    if (b.kind === 'castle') {
      ctx.fillRect(-w / 2, -d / 2, w, d)
      ctx.strokeRect(-w / 2, -d / 2, w, d)
      ctx.fillStyle = '#3f63c9'
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath()
        ctx.arc((cx * w) / 2, (cz * d) / 2, 2.4 * s, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillRect(-2.2 * s, -2.8 * s, 4.4 * s, 4 * s)
    } else if (b.round) {
      ctx.beginPath()
      ctx.arc(0, 0, w / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    } else {
      ctx.fillRect(-w / 2, -d / 2, w, d)
      ctx.strokeRect(-w / 2, -d / 2, w, d)
    }
    ctx.restore()
  }

  // labels
  const label = (x, z, text, big, dy = 0) => {
    const [lx, ly] = P(x, z)
    ctx.font = `bold ${big ? 17 : 13}px Andika, sans-serif`
    const w = ctx.measureText(text).width + 14
    const h = big ? 26 : 20
    const top = ly + dy - h / 2
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    roundRect(ctx, lx - w / 2, top, w, h, h / 2)
    ctx.fill()
    ctx.fillStyle = '#3b2a1e'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, lx, top + h / 2 + 1)
  }
  const small = new Set(['market', 'bank', 'toyshop', 'icecream'])
  const offsets = { village: 40, castle: 0, harbor: -16, burger: -18, post: -18, school: 18, graveyard: -24, lighthouse: -26, bridge: 12, pond: -16, mountain: 0, forest: 0, farm: -20, beach: 22 }
  for (const [k, p] of Object.entries(L.PLACES)) {
    if (small.has(k)) continue
    label(p.x, p.z, `${p.icon} ${p.name}`, true, offsets[k] ?? 0)
  }
  for (const k of small) {
    const p = L.PLACES[k]
    label(p.x, p.z, `${p.icon} ${p.name}`, false, { icecream: -16, market: -10, bank: -8, toyshop: 10 }[k] ?? 0)
  }
  if (bearOnBridge) {
    const [bx, by] = P(L.BRIDGE_MID[0], L.BRIDGE_MID[1])
    ctx.font = '22px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🐻', bx, by)
  }

  // clue stars and "!" friends
  const t = performance.now() / 1000
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const [x, z] of stars) {
    const [sx, sy] = P(x, z)
    const k = 1 + Math.sin(t * 4) * 0.12
    ctx.font = `${Math.round(30 * k)}px sans-serif`
    ctx.fillText('⭐', sx, sy - 18)
  }
  for (const [x, z] of targets) {
    const [sx, sy] = P(x, z)
    ctx.fillStyle = '#ffcf3f'
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(sx, sy, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#5a3300'
    ctx.font = 'bold 16px sans-serif'
    ctx.fillText('!', sx, sy + 1)
  }

  // Coji: where he is, which way he faces, and what the camera sees
  const [cx, cy] = P(player.x, player.z)
  const look = Math.atan2(-Math.cos(camYaw), -Math.sin(camYaw)) // screen angle of the camera's view
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.arc(cx, cy, 70, look - 0.55, look + 0.55)
  ctx.closePath()
  ctx.fill()
  const pulse = 14 + Math.sin(t * 5) * 3
  ctx.fillStyle = 'rgba(255, 90, 80, 0.3)'
  ctx.beginPath()
  ctx.arc(cx, cy, pulse, 0, Math.PI * 2)
  ctx.fill()
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(Math.atan2(Math.cos(player.face), Math.sin(player.face)))
  ctx.fillStyle = '#ff5a4f'
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(14, 0)
  ctx.lineTo(-8, -9)
  ctx.lineTo(-4, 0)
  ctx.lineTo(-8, 9)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
  label(player.x, player.z, 'Coji', false, 22)

  // compass
  ctx.save()
  ctx.translate(size - 44, size - 44)
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.beginPath()
  ctx.arc(0, 0, 26, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#e94b3c'
  ctx.beginPath()
  ctx.moveTo(0, -20)
  ctx.lineTo(7, 2)
  ctx.lineTo(-7, 2)
  ctx.fill()
  ctx.fillStyle = '#3b2a1e'
  ctx.font = 'bold 14px sans-serif'
  ctx.fillText('N', 0, 12)
  ctx.restore()
}

// The nearest named place, for "You are here".
export function placeName(x, z) {
  let best = null
  let bd = Infinity
  for (const p of Object.values(L.PLACES)) {
    const d = Math.hypot(x - p.x, z - p.z)
    if (d < bd) {
      bd = d
      best = p
    }
  }
  if (bd > 32) return 'Sunny Island'
  return bd < 14 ? `${best.icon} ${best.name}` : `near ${best.icon} ${best.name}`
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
