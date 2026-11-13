// Buildings and objects. Each builder returns a Group (or a Mesh) whose door/front faces +z.
// v0.4: real detail — clapboard siding, stone plinths and courses, framed windows with glass, panel
// doors, tiled roofs with ridge caps and gutters, iron and brass that shine — still merged into one
// or two draw calls per model (glass that glows at night is the second one).
import * as THREE from 'three'
import { Parts, SMOOTH, GLOW, SHINE, box, cyl, cone, ico, sphere, torus, textCanvas } from './build.js'

// Triangular prism: triangle (base d along z, apex height h) extruded along x by w. Base at y = 0.
export function prism(w, h, d) {
  const x0 = -w / 2
  const x1 = w / 2
  const a = [0, h]
  const b = [-d / 2, 0]
  const c = [d / 2, 0]
  const v = []
  const tri = (p, q, r) => v.push(...p, ...q, ...r)
  const P = (x, yz) => [x, yz[1], yz[0]]
  tri(P(x0, b), P(x0, c), P(x0, a))
  tri(P(x1, b), P(x1, a), P(x1, c))
  tri(P(x0, c), P(x1, c), P(x1, a))
  tri(P(x0, c), P(x1, a), P(x0, a))
  tri(P(x0, b), P(x1, a), P(x1, b))
  tri(P(x0, b), P(x0, a), P(x1, a))
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
  g.computeVertexNormals()
  return g
}

// ---------- little helpers ----------

// A shade of a color (k < 1 darker, k > 1 lighter).
const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k)

// Repeatable random numbers, so a model looks the same every time it is built.
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const IRON = '#3b3a42'
const BRASS = '#e2b84f'
const METAL = { metal: 0.9, rough: 0.35, jitter: 0 }
const GLASS = { mat: GLOW, rough: 0.08, metal: 0.35, jitter: 0 }
const GOLDEN = { metal: 0.55, rough: 0.3, jitter: 0 }
const ROUND = { flat: false }

// Place parts in a turned frame: local x runs along a face, local z points out of it.
function frame(p, x0, y0, z0, ry) {
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  return (geo, hex, lx, ly, lz, o = {}) => p.add(geo, hex, { ...o, x: x0 + lx * c + lz * s, y: y0 + ly, z: z0 - lx * s + lz * c, ry: ry + (o.ry || 0), order: 'YXZ' })
}

// A soft lumpy ball (tree tops, bushes): smooth normals pointing out from the middle.
const lumpCache = new Map()
function lump(r, detail = 2, seed = 1, amp = 0.12) {
  const key = `${r},${detail},${seed},${amp}`
  let g = lumpCache.get(key)
  if (g) return g
  g = new THREE.IcosahedronGeometry(r, detail)
  const pos = g.attributes.position
  const v = new THREE.Vector3()
  const nor = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = v.clone().normalize()
    const k = 1 + amp * Math.sin(n.x * 5.1 + seed) * Math.sin(n.y * 4.3 - seed * 0.7) * Math.sin(n.z * 4.7 + seed * 1.3) * 2
    v.multiplyScalar(k)
    pos.setXYZ(i, v.x, v.y, v.z)
    nor[i * 3] = n.x
    nor[i * 3 + 1] = n.y
    nor[i * 3 + 2] = n.z
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  lumpCache.set(key, g)
  return g
}

// Stone footing: a slab with a course of blocks in slightly different shades around it.
function plinth(p, w, d, h, hex, cy) {
  p.add(box(w + 0.3, h, d + 0.3), hex, { y: cy, jitter: 0.03 })
  const r = rng(Math.round(w * 37 + d * 11))
  const course = (len, place) => {
    const n = Math.max(2, Math.round(len / 0.8))
    for (let i = 0; i < n; i++) place(-len / 2 + ((i + 0.5) * len) / n, len / n - 0.05, 0.84 + r() * 0.22)
  }
  course(w + 0.3, (o, l, k) => {
    for (const s of [1, -1]) p.add(box(l, h - 0.08, 0.05), shade(hex, k), { x: o, y: cy, z: s * ((d + 0.3) / 2 + 0.015), jitter: 0.05 })
  })
  course(d + 0.3, (o, l, k) => {
    for (const s of [1, -1]) p.add(box(0.05, h - 0.08, l), shade(hex, k), { x: s * ((w + 0.3) / 2 + 0.015), y: cy, z: o, jitter: 0.05 })
  })
}

// Clapboard siding on the four faces of a w×d wall box: each board's lower edge sticks out a little,
// so the rows catch the light differently.
function siding(p, w, d, y0, y1, hex, step = 0.27) {
  const n = Math.floor((y1 - y0) / step)
  for (let i = 0; i < n; i++) {
    const y = y0 + (i + 0.5) * step
    const c = i % 2 ? hex : shade(hex, 0.97)
    for (const s of [1, -1]) {
      p.add(box(w + 0.02, step * 0.92, 0.035), c, { y, z: s * (d / 2 + 0.012), rx: -s * 0.06, jitter: 0.02 })
      p.add(box(0.035, step * 0.92, d + 0.02), c, { x: s * (w / 2 + 0.012), y, rz: s * 0.06, jitter: 0.02 })
    }
  }
}

// Boards in the triangle of each gable end (the x faces), and a round vent.
function gableSiding(p, w, d, y0, h, hex, step = 0.27) {
  for (let y = y0 + step * 0.5; y < y0 + h - 0.2; y += step) {
    const span = d * (1 - (y - y0 + step * 0.46) / h)
    if (span < 0.25) break
    for (const s of [1, -1]) p.add(box(0.035, step * 0.92, span), hex, { x: s * (w / 2 + 0.012), y, rz: s * 0.06, jitter: 0.02 })
  }
  for (const s of [1, -1]) {
    p.add(cyl(0.22, 0.22, 0.06, 14), '#fbf7ef', { x: s * (w / 2 + 0.04), y: y0 + h * 0.4, rz: Math.PI / 2, jitter: 0 })
    p.add(cyl(0.16, 0.16, 0.07, 14), '#4a4a52', { x: s * (w / 2 + 0.05), y: y0 + h * 0.4, rz: Math.PI / 2, jitter: 0 })
    for (const k of [-1, 0, 1]) p.add(box(0.03, 0.035, 0.3), '#fbf7ef', { x: s * (w / 2 + 0.085), y: y0 + h * 0.4 + k * 0.08, jitter: 0 })
  }
}

// Corner boards, a frieze board under the eaves and a skirt board at the bottom.
function trims(p, w, d, y0, y1, hex) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(box(0.16, y1 - y0, 0.16), hex, { x: (sx * w) / 2, y: (y0 + y1) / 2, z: (sz * d) / 2, jitter: 0 })
  for (const [y, h] of [
    [y1 - 0.1, 0.2],
    [y0 + 0.09, 0.18],
  ]) {
    for (const s of [1, -1]) {
      p.add(box(w + 0.08, h, 0.07), hex, { y, z: s * (d / 2 + 0.035), jitter: 0 })
      p.add(box(0.07, h, d + 0.08), hex, { x: s * (w / 2 + 0.035), y, jitter: 0 })
    }
  }
}

// A half disc that hangs down once turned with rx: PI/2 (awning scallops).
const halfCache = new Map()
function halfDisc(r, t = 0.04, seg = 10) {
  const key = `${r},${t},${seg}`
  let g = halfCache.get(key)
  if (!g) {
    g = new THREE.CylinderGeometry(r, r, t, seg, 1, false, -Math.PI / 2, Math.PI)
    halfCache.set(key, g)
  }
  return g
}

// A roof tile: a thin box without its hidden bottom face.
const tileCache = new Map()
function tile(w, t, l) {
  const key = `${w.toFixed(3)},${t},${l.toFixed(3)}`
  let g = tileCache.get(key)
  if (g) return g
  const b = new THREE.BoxGeometry(w, t, l).toNonIndexed()
  const keep = (a) => new THREE.Float32BufferAttribute([...a.array.slice(0, 18 * a.itemSize), ...a.array.slice(24 * a.itemSize)], a.itemSize)
  g = new THREE.BufferGeometry()
  g.setAttribute('position', keep(b.attributes.position))
  g.setAttribute('normal', keep(b.attributes.normal))
  tileCache.set(key, g)
  return g
}

// A gable roof: a deck, rows of overlapping tiles in slightly different shades, a ridge cap, barge
// boards on the gable ends, a fascia and a gutter on each eave, and downspouts at the corners.
function roof(p, w, d, wallH, h, hex, over = 0.45, o = {}) {
  const a = Math.atan2(h, d / 2)
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  const hyp = Math.hypot(d / 2, h)
  const t = 0.12
  const W = w + over * 1.6
  const trim = o.trim ?? '#f4efe6'
  const r = rng(Math.round(w * 131 + d * 17 + h * 7) + (o.seed || 0))
  // the eave sticks out half of `over` past the wall line (same eave line as before v0.4)
  const fe = hyp / 2 + over / 2
  const len = fe + hyp / 2 + t
  const fc = (fe - hyp / 2 - t) / 2
  const step = o.step ?? Math.max(0.32, (hyp + over) / 12)
  const rh = step * 1.3
  const tw = o.tileW ?? Math.max(0.78, W / 10)
  const topF = -hyp / 2 + rh / 2 - 0.02
  for (const s of [1, -1]) {
    const at = (f, off) => ({ y: wallH + h / 2 - sa * f + ca * off, z: s * (d / 4 + ca * f + sa * off) })
    p.add(box(W, t, len), shade(hex, 0.62), { ...at(fc, t / 2), rx: s * a, jitter: 0.02 })
    // tile rows from the eave up to the ridge
    let k = 0
    for (let f = fe - rh / 2; ; f -= step, k++) {
      const ff = Math.max(f, topF)
      const off0 = (k % 2) * tw * 0.5
      for (let x0 = -W / 2 - off0; x0 < W / 2 - 0.02; x0 += tw) {
        const xa = Math.max(-W / 2, x0)
        const xb = Math.min(W / 2, x0 + tw)
        if (xb - xa < 0.1) continue
        p.add(tile(xb - xa - 0.035, 0.05, rh), shade(hex, 0.84 + r() * 0.26), { x: (xa + xb) / 2, ...at(ff, t + 0.04), rx: s * (a - 0.06), jitter: 0.03 })
      }
      if (f <= topF) break
    }
    // barge boards on the gable ends
    for (const sx of [-1, 1]) p.add(box(0.08, 0.26, len), trim, { x: sx * (W / 2 + 0.04), ...at(fc, 0.02), rx: s * a, jitter: 0 })
    // fascia, gutter and downspouts at the eave
    const fy = wallH + h / 2 - sa * fe + (ca * t) / 2
    const fz = s * (d / 4 + ca * fe + (sa * t) / 2) + s * 0.03
    p.add(box(W + 0.08, 0.22, 0.06), trim, { y: fy, z: fz, jitter: 0 })
    if (o.gutters !== false) {
      const gy = fy - 0.16
      const gz = fz + s * 0.09
      p.add(cyl(0.085, 0.085, W, 8), '#aab2ba', { y: gy, z: gz, rz: Math.PI / 2, ...METAL, rough: 0.45, flat: false })
      if (o.spouts !== false) {
        const wz = s * (d / 2 + 0.09)
        for (const sx of [-1, 1]) {
          const x = sx * (w / 2 - 0.2)
          p.add(cyl(0.05, 0.05, Math.abs(gz - wz) + 0.05, 6), '#aab2ba', { x, y: gy - 0.12, z: (gz + wz) / 2, rx: Math.PI / 2, ...METAL, rough: 0.45, flat: false })
          const bottom = o.ground ?? 0.25
          p.add(cyl(0.05, 0.05, gy - 0.12 - bottom, 6), '#aab2ba', { x, y: (gy - 0.12 + bottom) / 2, z: wz, ...METAL, rough: 0.45, flat: false })
          p.add(cyl(0.07, 0.05, 0.12, 6), '#aab2ba', { x, y: bottom + 0.06, z: wz + s * 0.04, ...METAL, rough: 0.45 })
        }
      }
    }
  }
  // the ridge cap
  p.add(cyl(0.14, 0.14, W + 0.06, 10), shade(hex, 0.7), { y: wallH + h + t / ca + 0.04, rz: Math.PI / 2, jitter: 0.02, flat: false })
}

// A window with a frame, glass that shines (and glows at night), mullions, a sill and a head.
function windowAt(p, x, y, z, ry = 0, w = 0.9, h = 0.85, o = {}) {
  const put = frame(p, x, y, z, ry)
  const trim = o.trim ?? '#ffffff'
  put(box(w, h, 0.04), o.glass ?? '#9fc6de', 0, 0, 0.02, GLASS)
  put(box(w + 0.2, 0.1, 0.12), trim, 0, h / 2 + 0.05, 0.04, { jitter: 0 })
  put(box(w + 0.2, 0.08, 0.12), trim, 0, -h / 2 - 0.04, 0.04, { jitter: 0 })
  for (const sx of [-1, 1]) put(box(0.1, h, 0.12), trim, sx * (w / 2 + 0.05), 0, 0.04, { jitter: 0 })
  if (o.mullions !== false) {
    put(box(0.05, h, 0.05), trim, 0, 0, 0.055, { jitter: 0 })
    put(box(w, 0.05, 0.05), trim, 0, h * 0.1, 0.055, { jitter: 0 })
  }
  put(box(w + 0.36, 0.06, 0.2), o.sill ?? trim, 0, -h / 2 - 0.11, 0.08, { jitter: 0 })
  put(box(w + 0.34, 0.08, 0.1), trim, 0, h / 2 + 0.14, 0.04, { jitter: 0 })
  if (o.shutters)
    for (const sx of [-1, 1]) {
      const lx = sx * (w / 2 + 0.3)
      put(box(0.34, h + 0.1, 0.04), o.shutters, lx, 0, 0.03, { jitter: 0.02 })
      for (let i = 0; i < 6; i++) put(box(0.28, 0.035, 0.03), shade(o.shutters, 0.8), lx, -h / 2 + 0.08 + (i * (h - 0.06)) / 5, 0.06, { rx: 0.6, jitter: 0 })
    }
}

// An arched window in a stone wall (castle).
function archWindow(p, x, y, z, ry, w, h, stoneHex) {
  const put = frame(p, x, y, z, ry)
  put(box(w, h, 0.05), '#41506e', 0, 0, 0, GLASS)
  put(cyl(w / 2, w / 2, 0.05, 12), '#41506e', 0, h / 2, 0, { ...GLASS, rx: Math.PI / 2 })
  for (const sx of [-1, 1]) put(box(0.14, h, 0.16), stoneHex, sx * (w / 2 + 0.07), 0, 0.03)
  put(torus(w / 2 + 0.07, 0.08, 4, 10, Math.PI), stoneHex, 0, h / 2, 0.04)
  put(box(w + 0.3, 0.1, 0.2), stoneHex, 0, -h / 2 - 0.05, 0.06)
  put(box(0.035, h, 0.035), IRON, 0, 0, 0.035, METAL)
  put(box(w, 0.035, 0.035), IRON, 0, h * 0.1, 0.035, METAL)
}

// A panel door with a casing, a brass knob, and glass in the top panels if asked.
function door(p, x, y0, z, w, h, hex, o = {}) {
  const trim = o.trim ?? '#ffffff'
  p.add(box(w, h, 0.1), hex, { x, y: y0 + h / 2, z: z + 0.03, rough: 0.55, jitter: 0.03 })
  const pw = w * 0.34
  const ph = h * 0.3
  for (const sx of [-1, 1]) {
    p.add(box(pw, ph, 0.03), shade(hex, 1.08), { x: x + sx * w * 0.21, y: y0 + h * 0.27, z: z + 0.09, rough: 0.55, jitter: 0 })
    if (o.glass) p.add(box(pw, ph, 0.03), '#9fc6de', { x: x + sx * w * 0.21, y: y0 + h * 0.69, z: z + 0.085, ...GLASS })
    else p.add(box(pw, ph, 0.03), shade(hex, 1.08), { x: x + sx * w * 0.21, y: y0 + h * 0.69, z: z + 0.09, rough: 0.55, jitter: 0 })
  }
  p.add(box(w + 0.32, 0.14, 0.14), trim, { x, y: y0 + h + 0.07, z: z + 0.05, jitter: 0 })
  for (const sx of [-1, 1]) p.add(box(0.14, h, 0.14), trim, { x: x + sx * (w / 2 + 0.07), y: y0 + h / 2, z: z + 0.05, jitter: 0 })
  p.add(sphere(0.055, 10, 8), BRASS, { x: x + w * 0.36, y: y0 + h * 0.48, z: z + 0.13, ...METAL, flat: false })
  p.add(box(0.05, 0.16, 0.03), BRASS, { x: x + w * 0.36, y: y0 + h * 0.48, z: z + 0.09, ...METAL })
}

// A brick chimney with mortar courses, a cap and a pot.
function chimney(p, x, yb, z, s, top, hex) {
  const h = top - yb
  p.add(box(s, h, s), hex, { x, y: yb + h / 2, z, jitter: 0.07 })
  for (let y = top - 0.18; y > top - 1.0; y -= 0.18) p.add(box(s + 0.02, 0.025, s + 0.02), '#d9d0c4', { x, y, z, jitter: 0 })
  p.add(box(s + 0.16, 0.1, s + 0.16), '#8e8a84', { x, y: top + 0.05, z })
  p.add(cyl(0.11, 0.13, 0.26, 10), shade(hex, 0.85), { x, y: top + 0.23, z, ...ROUND })
  p.add(cyl(0.08, 0.08, 0.02, 10), '#2a2a2a', { x, y: top + 0.365, z })
}

// A window box full of flowers. y is the top of the box.
function flowerBox(p, x, y, z, w = 1.0) {
  p.add(box(w, 0.22, 0.3), '#a8693f', { x, y: y - 0.11, z, rough: 0.7 })
  p.add(box(w + 0.06, 0.04, 0.34), '#8e5631', { x, y, z })
  p.add(box(w - 0.06, 0.03, 0.24), '#5a3d26', { x, y: y + 0.01, z })
  const cols = ['#ff6b8a', '#ffd23f', '#ff9f43', '#ffffff', '#c38bff']
  const n = Math.max(3, Math.round(w / 0.2))
  for (let i = 0; i < n; i++) {
    const fx = x - w / 2 + 0.1 + (i * (w - 0.2)) / (n - 1)
    p.add(ico(0.11, 0), '#5aa846', { x: fx, y: y + 0.07, z: z + (i % 2 ? 0.05 : -0.04), sy: 0.65, jitter: 0.05 })
    p.add(ico(0.075, 0), cols[i % cols.length], { x: fx + 0.03, y: y + 0.17 + (i % 3) * 0.03, z: z + 0.07, jitter: 0 })
  }
}

// A little wall lantern (glows at night).
function wallLamp(p, x, y, z, ry = 0) {
  const put = frame(p, x, y, z, ry)
  put(box(0.05, 0.05, 0.22), IRON, 0, 0.12, 0.1, METAL)
  put(box(0.12, 0.2, 0.04), IRON, 0, 0.05, 0.01, METAL)
  put(cyl(0.075, 0.065, 0.22, 8), '#fff2b0', 0, 0, 0.22, { mat: GLOW, jitter: 0 })
  put(cone(0.13, 0.12, 6), IRON, 0, 0.17, 0.22, METAL)
  put(cyl(0.09, 0.07, 0.04, 6), IRON, 0, -0.12, 0.22, METAL)
}

// A crate with planks and corner battens.
function crate(p, x, y, z, s = 1, ry = 0, hex = '#c89a5a') {
  const put = frame(p, x, y, z, ry)
  const S = 0.9 * s
  put(box(S, S, S), hex, 0, S / 2, 0, { jitter: 0.06 })
  const dark = shade(hex, 0.78)
  for (const k of [-1, 1])
    for (const m of [-1, 1]) {
      put(box(0.08 * s, S + 0.01, 0.08 * s), dark, (k * S) / 2, S / 2, (m * S) / 2)
    }
  for (const k of [-1, 1]) {
    put(box(S, 0.07 * s, 0.03), dark, 0, S / 2, (k * S) / 2)
    put(box(0.03, 0.07 * s, S), dark, (k * S) / 2, S / 2, 0)
  }
}

// A barrel with staves and iron hoops.
function barrel(p, x, y, z, s = 1, hex = '#8a5a35') {
  p.add(cyl(0.38 * s, 0.33 * s, 0.48 * s, 12), hex, { x, y: y + 0.72 * s, z, jitter: 0.07 })
  p.add(cyl(0.33 * s, 0.38 * s, 0.48 * s, 12), hex, { x, y: y + 0.24 * s, z, jitter: 0.07 })
  for (const yy of [0.14, 0.4, 0.56, 0.82]) p.add(cyl(0.385 * s - Math.abs(yy - 0.48) * 0.1 * s, 0.385 * s - Math.abs(yy - 0.48) * 0.1 * s, 0.05 * s, 12, true), IRON, { x, y: y + yy * s, z, ...METAL })
  p.add(cyl(0.3 * s, 0.3 * s, 0.02, 12), shade(hex, 1.15), { x, y: y + 0.965 * s, z })
}

const WALLS = ['#fff1d6', '#ffd9c2', '#e2f4e4', '#e6ecff', '#fff7c7']
const ROOFS = ['#f0705f', '#4fb0a5', '#f5a742', '#8f7ad9', '#5aa0e6']

export function house(colorIdx = 0, w = 5.5, d = 5) {
  const p = new Parts()
  const H = 2.9
  const y0 = 0.2
  const wall = WALLS[colorIdx % WALLS.length]
  const rf = ROOFS[colorIdx % ROOFS.length]
  const trim = '#fffaf2'
  plinth(p, w, d, 0.35, '#c9c2b8', 0.1)
  p.add(box(w, H, d), wall, { y: H / 2 + y0, jitter: 0.03 })
  siding(p, w, d, y0 + 0.18, y0 + H - 0.2, wall)
  trims(p, w, d, y0, y0 + H, trim)
  p.add(prism(w, 1.7, d), wall, { y: H + y0, jitter: 0.03 })
  gableSiding(p, w, d, H + y0, 1.7, wall)
  roof(p, w, d, H + y0, 1.7, rf, 0.45, { trim })
  door(p, 0, y0, d / 2, 1.1, 1.9, '#a8693f', { trim, glass: true })
  // stone doorstep
  p.add(box(1.6, 0.12, 0.6), '#c9c2b8', { y: 0.25, z: d / 2 + 0.35 })
  p.add(box(1.7, 0.03, 0.66), '#b8b0a4', { y: 0.32, z: d / 2 + 0.35 })
  for (const s of [-1, 1]) {
    windowAt(p, s * 1.65, 1.9, d / 2 + 0.03, 0, 0.9, 0.85, { trim, shutters: shade(rf, 0.9) })
    flowerBox(p, s * 1.65, 1.36, d / 2 + 0.24, 1.0)
  }
  windowAt(p, w / 2 + 0.03, 1.9, 0, Math.PI / 2, 0.9, 0.85, { trim })
  windowAt(p, -w / 2 - 0.03, 1.9, 0, -Math.PI / 2, 0.9, 0.85, { trim })
  chimney(p, w / 4, H + 1.0, -d / 5, 0.6, H + 2.2, '#b5654a')
  wallLamp(p, -0.85, 1.95, d / 2 + 0.03)
  // the mailbox on a post
  p.add(box(0.1, 1.0, 0.1), '#6b4a2b', { x: 1.6, y: 0.5, z: d / 2 + 1.4 })
  p.add(box(0.06, 0.4, 0.06), '#6b4a2b', { x: 1.6, y: 0.85, z: d / 2 + 1.25, rx: 0.6 })
  p.add(box(0.36, 0.22, 0.5), '#3b7dd8', { x: 1.6, y: 1.06, z: d / 2 + 1.4, rough: 0.45 })
  p.add(cyl(0.18, 0.18, 0.5, 12, false), '#3b7dd8', { x: 1.6, y: 1.17, z: d / 2 + 1.4, rx: Math.PI / 2, rough: 0.45, ...ROUND })
  p.add(box(0.04, 0.24, 0.05), '#e94b3c', { x: 1.8, y: 1.3, z: d / 2 + 1.5, rough: 0.45 })
  p.add(box(0.04, 0.1, 0.14), '#e94b3c', { x: 1.8, y: 1.37, z: d / 2 + 1.57, rough: 0.45 })
  p.aoBottom(1.0, 0.35)
  return p.build()
}

export function cottage() {
  const p = new Parts()
  const w = 5.5
  const d = 5
  const H = 2.6
  const y0 = 0.2
  const wall = '#ece6da'
  const stone = '#b9b2a6'
  plinth(p, w, d, 0.35, '#a9a39a', 0.1)
  p.add(box(w, H, d), wall, { y: H / 2 + y0, jitter: 0.06 })
  // whitewashed stone: a few stones showing through, and corner quoins
  const r = rng(91)
  for (let i = 0; i < 16; i++) {
    const s = r() < 0.5 ? 1 : -1
    const side = r() < 0.6
    const y = y0 + 0.3 + r() * (H - 0.6)
    const l = 0.3 + r() * 0.3
    if (side) p.add(box(l, 0.18, 0.04), shade(stone, 0.9 + r() * 0.2), { x: (r() - 0.5) * (w - 1), y, z: s * (d / 2 + 0.01), jitter: 0.05 })
    else p.add(box(0.04, 0.18, l), shade(stone, 0.9 + r() * 0.2), { x: s * (w / 2 + 0.01), y, z: (r() - 0.5) * (d - 1), jitter: 0.05 })
  }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      for (let k = 0; k < 7; k++) {
        const long = k % 2 === 0
        p.add(box(long ? 0.5 : 0.3, 0.3, long ? 0.3 : 0.5), shade(stone, 0.92 + (k % 3) * 0.05), { x: sx * (w / 2 - (long ? 0.2 : 0.1)), y: y0 + 0.18 + k * 0.35, z: sz * (d / 2 - (long ? 0.1 : 0.2)), jitter: 0.06 })
      }
  p.add(prism(w, 1.6, d), wall, { y: H + y0, jitter: 0.04 })
  gableSiding(p, w, d, H + y0, 1.6, '#e2dccf')
  roof(p, w, d, H + y0, 1.6, '#3d6e9e', 0.45, { trim: '#f4efe6' })
  door(p, 0, y0, d / 2, 1.1, 1.9, '#2f5b86', { trim: '#f4efe6' })
  p.add(box(1.5, 0.14, 0.55), '#a9a39a', { y: 0.27, z: d / 2 + 0.32 })
  windowAt(p, 1.6, 1.8, d / 2 + 0.03, 0, 0.9, 0.85, { trim: '#f4efe6' })
  windowAt(p, -1.6, 1.8, d / 2 + 0.03, 0, 0.9, 0.85, { trim: '#f4efe6' })
  windowAt(p, -w / 2 - 0.03, 1.8, 0, -Math.PI / 2, 0.8, 0.8, { trim: '#f4efe6' })
  // life ring on the wall, red and white
  for (let i = 0; i < 8; i++) p.add(torus(0.35, 0.1, 6, 3, Math.PI / 4), i % 2 ? '#ffffff' : '#ff5a4f', { x: w / 2 + 0.12, y: 1.8, rx: (i * Math.PI) / 4, ry: Math.PI / 2, order: 'YXZ', ...ROUND, jitter: 0 })
  p.add(box(0.06, 0.06, 0.12), IRON, { x: w / 2 + 0.06, y: 2.18, ...METAL })
  chimney(p, -w / 4, H + 0.9, -d / 5, 0.55, H + 2.1, '#8c8c8c')
  wallLamp(p, 0.85, 1.95, d / 2 + 0.03)
  // a coil of rope and a lobster pot by the door
  for (let i = 0; i < 3; i++) p.add(torus(0.28 - i * 0.02, 0.045, 4, 12), '#d8c08a', { x: -1.7, y: 0.25 + i * 0.07, z: d / 2 + 0.7, rx: Math.PI / 2, ...ROUND })
  p.add(cyl(0.3, 0.3, 0.7, 10, true), '#7a5a3a', { x: 1.9, y: 0.55, z: d / 2 + 0.8, rz: Math.PI / 2, jitter: 0.05 })
  p.add(box(0.75, 0.05, 0.62), '#7a5a3a', { x: 1.9, y: 0.25, z: d / 2 + 0.8 })
  for (const k of [-1, 0, 1]) p.add(torus(0.3, 0.025, 4, 12), '#6a4a2a', { x: 1.9 + k * 0.3, y: 0.55, z: d / 2 + 0.8, ry: Math.PI / 2 })
  p.aoBottom(1.0, 0.35)
  return p.build()
}

export function shed() {
  const p = new Parts()
  const w = 5
  const d = 4
  const H = 2.6
  const red = '#d9574f'
  const white = '#f2efe8'
  p.add(box(w, H, d), red, { y: H / 2, jitter: 0.05 })
  // vertical barn boards with battens
  const r = rng(33)
  for (let x = -w / 2 + 0.15; x < w / 2; x += 0.3)
    for (const s of [1, -1]) p.add(box(0.05, H - 0.1, 0.04), shade(red, 0.82 + r() * 0.1), { x, y: H / 2, z: s * (d / 2 + 0.015), jitter: 0.02 })
  for (let z = -d / 2 + 0.15; z < d / 2; z += 0.3)
    for (const s of [1, -1]) p.add(box(0.04, H - 0.1, 0.05), shade(red, 0.82 + r() * 0.1), { x: s * (w / 2 + 0.015), y: H / 2, z, jitter: 0.02 })
  trims(p, w, d, 0, H, white)
  p.add(prism(w, 1.5, d), red, { y: H, jitter: 0.05 })
  for (let y = H + 0.2; y < H + 1.3; y += 0.3) {
    const span = d * (1 - (y - H + 0.15) / 1.5)
    for (const s of [1, -1]) for (let z = -span / 2 + 0.15; z < span / 2 - 0.05; z += 0.3) p.add(box(0.04, 0.28, 0.05), shade(red, 0.85), { x: s * (w / 2 + 0.015), y, z })
  }
  roof(p, w, d, H, 1.5, '#f2efe8', 0.45, { trim: white, ground: 0.05 })
  // the big barn door: white frame with an X
  p.add(box(2, 2.1, 0.1), shade(red, 0.9), { y: 1.05, z: d / 2 + 0.03 })
  p.add(box(2.2, 0.14, 0.14), white, { y: 2.12, z: d / 2 + 0.08, jitter: 0 })
  p.add(box(2.2, 0.14, 0.14), white, { y: 0.07, z: d / 2 + 0.08, jitter: 0 })
  for (const s of [-1, 1]) p.add(box(0.14, 2.1, 0.14), white, { x: s * 1.03, y: 1.05, z: d / 2 + 0.08, jitter: 0 })
  p.add(box(0.08, 2.1, 0.12), white, { y: 1.05, z: d / 2 + 0.08, jitter: 0 })
  for (const s of [-1, 1])
    for (const k of [-1, 1]) p.add(box(1.2, 0.12, 0.1), white, { x: s * 0.5, y: 1.05, z: d / 2 + 0.11, rz: k * 0.98 * s, jitter: 0 })
  for (const s of [-1, 1]) p.add(box(0.08, 0.3, 0.05), IRON, { x: s * 0.12, y: 1.05, z: d / 2 + 0.16, ...METAL })
  // a hay-loft window on each gable end
  for (const s of [-1, 1]) {
    p.add(box(0.06, 0.7, 0.7), shade(red, 0.75), { x: s * (w / 2 + 0.04), y: H + 0.5 })
    p.add(box(0.08, 0.84, 0.1), white, { x: s * (w / 2 + 0.06), y: H + 0.5, z: 0.38 })
    p.add(box(0.08, 0.84, 0.1), white, { x: s * (w / 2 + 0.06), y: H + 0.5, z: -0.38 })
    p.add(box(0.08, 0.1, 0.84), white, { x: s * (w / 2 + 0.06), y: H + 0.88 })
    p.add(box(0.08, 0.1, 0.84), white, { x: s * (w / 2 + 0.06), y: H + 0.12 })
  }
  // hay bales with twine
  for (let i = 0; i < 3; i++) {
    const x = w / 2 + 0.6
    const y = 0.3 + i * 0.6 * (i < 2 ? 1 : 0.9)
    const z = -1 + i * 0.7
    p.add(cyl(0.45, 0.45, 0.6, 14), '#f1d36b', { x, y, z, rx: Math.PI / 2, jitter: 0.09, ...ROUND })
    p.add(cyl(0.3, 0.3, 0.61, 14), '#e3c25a', { x, y, z, rx: Math.PI / 2, jitter: 0.06 })
    for (const k of [-1, 1]) p.add(cyl(0.455, 0.455, 0.03, 14, true), '#b08a3a', { x, y, z: z + k * 0.17, rx: Math.PI / 2 })
  }
  p.aoBottom(0.9, 0.35)
  return p.build()
}

export function warehouse() {
  const p = new Parts()
  const w = 6
  const d = 8
  const H = 3.2
  const wood = '#b98a5e'
  p.add(box(w, H, d), wood, { y: H / 2, jitter: 0.06 })
  const r = rng(57)
  // vertical boards with dark battens between them
  for (let x = -w / 2 + 0.2; x < w / 2; x += 0.4)
    for (const s of [1, -1]) p.add(box(0.36, H - 0.05, 0.03), shade(wood, 0.88 + r() * 0.2), { x, y: H / 2, z: s * (d / 2 + 0.012), jitter: 0.04 })
  for (let z = -d / 2 + 0.2; z < d / 2; z += 0.4)
    for (const s of [1, -1]) p.add(box(0.03, H - 0.05, 0.36), shade(wood, 0.88 + r() * 0.2), { x: s * (w / 2 + 0.012), y: H / 2, z, jitter: 0.04 })
  for (let i = -3; i <= 3; i++) p.add(box(0.08, H, d + 0.06), '#9a7049', { x: i * 0.85, y: H / 2, jitter: 0 })
  trims(p, w, d, 0, H, '#7d5634')
  p.add(prism(w, 1.4, d), wood, { y: H, jitter: 0.05 })
  roof(p, w, d, H, 1.4, '#6c7a89', 0.45, { trim: '#7d5634', ground: 0.05 })
  // a big sliding door on a rail
  p.add(box(2.6, 2.5, 0.1), '#7d5634', { y: 1.25, z: d / 2 + 0.05 })
  for (let i = 0; i < 6; i++) p.add(box(0.4, 2.4, 0.03), shade('#7d5634', 0.9 + (i % 2) * 0.12), { x: -1.05 + i * 0.42, y: 1.25, z: d / 2 + 0.11 })
  p.add(box(2.7, 0.12, 0.08), '#5c3f24', { y: 2.4, z: d / 2 + 0.13 })
  p.add(box(2.7, 0.12, 0.08), '#5c3f24', { y: 0.12, z: d / 2 + 0.13 })
  p.add(box(3.0, 0.27, 0.08), '#5c3f24', { y: 1.25, z: d / 2 + 0.13, rz: Math.atan2(2.3, 2.6) })
  p.add(box(3.6, 0.08, 0.1), IRON, { x: 0.5, y: 2.62, z: d / 2 + 0.12, ...METAL })
  for (const s of [-1, 1]) p.add(cyl(0.06, 0.06, 0.06, 8), IRON, { x: s * 1.0, y: 2.55, z: d / 2 + 0.18, rx: Math.PI / 2, ...METAL })
  p.add(box(0.06, 0.3, 0.06), IRON, { x: 1.1, y: 1.25, z: d / 2 + 0.2, ...METAL })
  // small high windows on the sides
  for (const s of [-1, 1]) for (const z of [-2.2, 0, 2.2]) windowAt(p, s * (w / 2 + 0.03), 2.5, z, (s * Math.PI) / 2, 0.8, 0.5, { trim: '#7d5634', mullions: false })
  // a hoist beam over the door
  p.add(box(0.2, 0.2, 1.6), '#6b4a2b', { y: H + 0.7, z: d / 2 + 0.5 })
  p.add(cyl(0.12, 0.12, 0.08, 10), IRON, { y: H + 0.48, z: d / 2 + 1.15, rz: Math.PI / 2, ...METAL })
  p.add(cyl(0.015, 0.015, 1.6, 4), '#d8c08a', { y: H - 0.35, z: d / 2 + 1.2 })
  p.add(box(0.12, 0.1, 0.06), IRON, { y: H - 1.15, z: d / 2 + 1.2, ...METAL })
  // crates and barrels
  crate(p, 2.2, 0, d / 2 + 1, 1, 0.15)
  crate(p, 3.1, 0, d / 2 + 1.3, 1, 0.32)
  crate(p, 2.6, 0.9, d / 2 + 1.1, 0.8, 0.05)
  barrel(p, -2.4, 0, d / 2 + 1)
  barrel(p, -1.6, 0, d / 2 + 1.6)
  p.aoBottom(0.9, 0.35)
  return p.build()
}

export function burgerHut() {
  const p = new Parts()
  const w = 8
  const d = 7
  const H = 3.0
  const cream = '#fff6e8'
  const red = '#e94b3c'
  p.add(box(w + 0.4, 0.3, d + 0.4), '#d5cbbd', { y: 0.1 })
  // checkered diner floor inside
  p.add(box(w - 0.6, 0.02, d - 0.6), '#f4f1ea', { y: 0.26, rough: 0.35, jitter: 0 })
  for (let i = 0; i < 9; i++)
    for (let j = 0; j < 8; j++) if ((i + j) % 2 === 0) p.add(box(0.78, 0.02, 0.76), '#2f2f36', { x: -w / 2 + 0.3 + 0.41 + i * 0.82, y: 0.275, z: -d / 2 + 0.3 + 0.4 + j * 0.8, rough: 0.35, jitter: 0 })
  // back and side walls
  p.add(box(w, H, 0.3), cream, { y: H / 2 + 0.2, z: -d / 2 + 0.15, jitter: 0.03 })
  for (const s of [-1, 1]) p.add(box(0.3, H, d), cream, { x: (s * (w - 0.3)) / 2, y: H / 2 + 0.2, jitter: 0.03 })
  // a red tile band along the bottom of the outside walls, with a white trim line
  p.add(box(w + 0.06, 0.7, 0.06), red, { y: 0.55, z: -d / 2 - 0.02, rough: 0.35 })
  p.add(box(w + 0.08, 0.06, 0.08), '#ffffff', { y: 0.92, z: -d / 2 - 0.02, jitter: 0 })
  for (const s of [-1, 1]) {
    p.add(box(0.06, 0.7, d + 0.06), red, { x: s * (w / 2 + 0.02), y: 0.55, rough: 0.35 })
    p.add(box(0.08, 0.06, d + 0.08), '#ffffff', { x: s * (w / 2 + 0.02), y: 0.92, jitter: 0 })
    for (let k = 0; k < 8; k++) p.add(box(0.012, 0.66, 0.012), shade(red, 0.7), { x: s * (w / 2 + 0.055), y: 0.55, z: -d / 2 + 0.44 + k * 0.88, jitter: 0 })
    windowAt(p, s * (w / 2 + 0.03), 2.0, -0.6, (s * Math.PI) / 2, 1.6, 1.0, { trim: '#ffffff' })
  }
  // front: low counter wall + window opening
  p.add(box(w, 1.15, 0.3), red, { y: 0.78, z: d / 2 - 0.15, rough: 0.4 })
  p.add(box(w + 0.02, 0.1, 0.32), '#ffffff', { y: 0.45, z: d / 2 - 0.15, jitter: 0 })
  p.add(box(w + 0.1, 0.12, 0.7), '#f7f1e6', { y: 1.4, z: d / 2 - 0.05, rough: 0.3, jitter: 0.02 })
  p.add(box(w + 0.12, 0.04, 0.72), '#d9d2c5', { y: 1.33, z: d / 2 - 0.05, jitter: 0 })
  p.add(box(w, 0.5, 0.3), cream, { y: H - 0.05, z: d / 2 - 0.15 })
  for (const s of [-1, 1]) {
    p.add(box(0.5, H, 0.32), cream, { x: (s * (w - 0.5)) / 2, y: H / 2 + 0.2, z: d / 2 - 0.15 })
    p.add(box(0.6, 0.12, 0.42), '#ffffff', { x: (s * (w - 0.5)) / 2, y: H + 0.12, z: d / 2 - 0.15, jitter: 0 })
  }
  // things on the counter: napkins, ketchup and mustard
  p.add(box(0.3, 0.18, 0.16), '#c9ccd2', { x: -2.6, y: 1.55, z: d / 2 - 0.1, ...METAL, rough: 0.25 })
  for (const [x, c] of [
    [-2.1, '#d62e22'],
    [-1.9, '#f2c230'],
    [2.3, '#d62e22'],
    [2.5, '#f2c230'],
  ]) {
    p.add(cyl(0.06, 0.07, 0.24, 8), c, { x, y: 1.58, z: d / 2 - 0.1, rough: 0.3, ...ROUND })
    p.add(cone(0.035, 0.08, 6), c, { x, y: 1.74, z: d / 2 - 0.1, rough: 0.3 })
  }
  // stools along the counter
  for (let i = 0; i < 4; i++) {
    const x = -2.4 + i * 1.6
    p.add(cyl(0.22, 0.22, 0.1, 12), red, { x, y: 0.82, z: d / 2 + 0.55, rough: 0.35, ...ROUND })
    p.add(cyl(0.045, 0.045, 0.6, 6), '#c9ccd2', { x, y: 0.47, z: d / 2 + 0.55, ...METAL, rough: 0.2 })
    p.add(cyl(0.18, 0.2, 0.05, 12), '#c9ccd2', { x, y: 0.2, z: d / 2 + 0.55, ...METAL, rough: 0.2 })
  }
  // red stripe band
  p.add(box(w + 0.05, 0.3, d + 0.05), red, { y: H + 0.05, rough: 0.4 })
  // flat roof with a parapet, a vent and a fan box
  p.add(box(w + 0.8, 0.3, d + 0.8), '#ffcf3f', { y: H + 0.35, rough: 0.5 })
  for (const s of [1, -1]) {
    p.add(box(w + 0.9, 0.12, 0.12), '#ffffff', { y: H + 0.55, z: s * (d / 2 + 0.4), jitter: 0 })
    p.add(box(0.12, 0.12, d + 0.9), '#ffffff', { x: s * (w / 2 + 0.4), y: H + 0.55, jitter: 0 })
  }
  p.add(box(1.1, 0.6, 0.8), '#c9ccd2', { x: 2.6, y: H + 0.8, z: -2.2, ...METAL, rough: 0.4 })
  p.add(cyl(0.28, 0.28, 0.05, 12), '#5d636b', { x: 2.6, y: H + 1.12, z: -2.2, ...METAL })
  p.add(cyl(0.18, 0.18, 0.7, 10), '#c9ccd2', { x: -2.0, y: H + 0.85, z: -2.6, ...METAL, rough: 0.3 })
  p.add(cone(0.3, 0.25, 10), '#c9ccd2', { x: -2.0, y: H + 1.3, z: -2.6, ...METAL, rough: 0.3 })
  // striped awning with a scalloped edge
  const ay = H - 0.15
  const az = d / 2 + 0.55
  const edgeY = ay - 0.7 * Math.sin(0.35)
  const edgeZ = az + 0.7 * Math.cos(0.35)
  for (let i = 0; i < 8; i++) {
    const x = -w / 2 + w / 16 + (i * w) / 8
    const c = i % 2 ? '#ffffff' : red
    p.add(box(w / 8, 0.06, 1.4), c, { x, y: ay, z: az, rx: 0.35, jitter: 0, rough: 0.7 })
    p.add(halfDisc(w / 16), c, { x, y: edgeY - 0.02, z: edgeZ + 0.02, rx: Math.PI / 2, sz: 0.6, jitter: 0, rough: 0.7 })
  }
  p.add(box(w + 0.1, 0.06, 0.06), '#d9d2c5', { y: edgeY + 0.02, z: edgeZ, ...METAL, rough: 0.3 })
  // inside: a grill with a hood, patties and a menu board
  p.add(box(2.4, 1.0, 0.8), '#7d7d86', { x: -1.8, y: 0.7, z: -d / 2 + 0.8, ...METAL, rough: 0.4 })
  p.add(box(1.8, 0.06, 0.6), '#2b2b2b', { x: -1.8, y: 1.23, z: -d / 2 + 0.8, ...METAL, rough: 0.6 })
  for (let i = 0; i < 7; i++) p.add(box(0.03, 0.03, 0.6), '#555555', { x: -2.6 + i * 0.27, y: 1.27, z: -d / 2 + 0.8, ...METAL })
  for (let i = 0; i < 3; i++) p.add(cyl(0.16, 0.16, 0.06, 12), '#6b3a1d', { x: -2.3 + i * 0.5, y: 1.31, z: -d / 2 + 0.8, jitter: 0.08 })
  p.add(box(2.4, 0.5, 1.0), '#b8bdc4', { x: -1.8, y: H - 0.1, z: -d / 2 + 0.8, ...METAL, rough: 0.3 })
  p.add(cyl(0.18, 0.18, 0.9, 10), '#b8bdc4', { x: -1.8, y: H + 0.5, z: -d / 2 + 0.8, ...METAL, rough: 0.3 })
  p.add(box(2.6, 1.2, 0.06), '#2f2f36', { x: 1.6, y: 2.3, z: -d / 2 + 0.33, rough: 0.6 })
  p.add(box(2.7, 1.3, 0.04), '#a8693f', { x: 1.6, y: 2.3, z: -d / 2 + 0.31 })
  const pics = ['#e8a33d', '#ffd23f', '#e94b3c', '#6ec43f']
  for (let i = 0; i < 4; i++) {
    p.add(box(0.42, 0.3, 0.02), pics[i], { x: 0.65 + i * 0.63, y: 2.55, z: -d / 2 + 0.37, jitter: 0 })
    p.add(box(0.42, 0.05, 0.02), '#f4f1ea', { x: 0.65 + i * 0.63, y: 2.25, z: -d / 2 + 0.37, jitter: 0 })
    p.add(box(0.3, 0.04, 0.02), '#f4f1ea', { x: 0.65 + i * 0.63, y: 2.0, z: -d / 2 + 0.37, jitter: 0 })
  }
  // giant burger on the back of the roof, so the sign in front stays readable
  const y0 = H + 0.5
  const bz = -1.6
  p.add(sphere(1.3, 24, 10, 0, Math.PI / 2), '#e8a33d', { y: y0 + 1.0, z: bz, sy: 0.75, rough: 0.55, jitter: 0.04, ...ROUND })
  p.add(torus(1.22, 0.1, 6, 24), '#d18a2c', { y: y0 + 1.02, z: bz, rx: Math.PI / 2, ...ROUND })
  p.add(torus(1.3, 0.08, 5, 24), '#6ec43f', { y: y0 + 0.93, z: bz, rx: Math.PI / 2, jitter: 0.08, ...ROUND })
  p.add(cyl(1.32, 1.32, 0.08, 24), '#6ec43f', { y: y0 + 0.93, z: bz, jitter: 0.06 })
  p.add(box(2.0, 0.06, 2.0), '#ffd23f', { y: y0 + 0.84, z: bz, ry: Math.PI / 4, rough: 0.45 })
  p.add(cyl(1.18, 1.18, 0.08, 24), '#e2412f', { y: y0 + 0.77, z: bz, rough: 0.4 })
  p.add(cyl(1.28, 1.28, 0.38, 24), '#7a3e1f', { y: y0 + 0.55, z: bz, jitter: 0.1 })
  p.add(cyl(1.25, 1.2, 0.34, 24), '#e8a33d', { y: y0 + 0.2, z: bz, rough: 0.55, ...ROUND })
  p.add(torus(1.21, 0.07, 5, 24), '#d18a2c', { y: y0 + 0.37, z: bz, rx: Math.PI / 2, ...ROUND })
  const sr = rng(5)
  for (let i = 0; i < 14; i++) {
    const a = sr() * Math.PI * 2
    const rr = 0.2 + sr() * 0.85
    const yy = y0 + 1.0 + Math.sqrt(Math.max(0, 1 - (rr / 1.3) ** 2)) * 1.3 * 0.75
    p.add(sphere(0.06, 6, 4), '#fff5d6', { x: Math.cos(a) * rr, y: yy, z: bz + Math.sin(a) * rr, sy: 0.5, ry: a, sx: 1.6, jitter: 0 })
  }
  // sign board standing on the front edge of the roof
  p.add(box(5.0, 1.05, 0.14), '#ffffff', { y: H + 1.05, z: d / 2 + 0.3, jitter: 0 })
  p.add(box(5.16, 0.08, 0.18), red, { y: H + 1.6, z: d / 2 + 0.3, jitter: 0 })
  p.add(box(5.16, 0.08, 0.18), red, { y: H + 0.5, z: d / 2 + 0.3, jitter: 0 })
  for (const s of [-1, 1]) p.add(box(0.08, 1.18, 0.18), red, { x: s * 2.54, y: H + 1.05, z: d / 2 + 0.3, jitter: 0 })
  for (const s of [-1, 1]) p.add(box(0.12, 0.6, 0.12), '#c9ccd2', { x: s * 2.0, y: H + 0.45, z: d / 2 + 0.2, ...METAL })
  // tables outside with umbrellas and stools
  for (const z of [-1.8, 1.8]) {
    const x = w / 2 + 2.4
    p.add(cyl(0.7, 0.7, 0.06, 16), '#ffffff', { x, y: 1.0, z, rough: 0.35 })
    p.add(torus(0.7, 0.03, 4, 16), '#c9ccd2', { x, y: 1.0, z, rx: Math.PI / 2, ...METAL })
    p.add(cyl(0.05, 0.05, 1.0, 6), '#c9ccd2', { x, y: 0.5, z, ...METAL })
    p.add(cyl(0.3, 0.34, 0.05, 12), '#c9ccd2', { x, y: 0.03, z, ...METAL })
    p.add(cyl(0.035, 0.035, 2.6, 6), '#c9ccd2', { x, y: 1.3, z, ...METAL })
    const uc = z < 0 ? red : '#ffcf3f'
    p.add(cone(1.2, 0.5, 16), uc, { x, y: 2.7, z, rough: 0.75 })
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      p.add(box(0.03, 0.03, 1.2), '#ffffff', { x: x + Math.sin(a) * 0.6, y: 2.66, z: z + Math.cos(a) * 0.6, ry: a, rx: -0.39, order: 'YXZ', jitter: 0 })
      p.add(sphere(0.16, 8, 4, 0, Math.PI / 2), uc, { x: x + Math.sin(a + 0.39) * 1.12, y: 2.4, z: z + Math.cos(a + 0.39) * 1.12, rx: Math.PI, sy: 0.6, jitter: 0, rough: 0.75 })
    }
    p.add(sphere(0.08, 8, 6), '#ffffff', { x, y: 2.98, z, ...ROUND })
    for (const s of [-1, 1]) {
      p.add(cyl(0.25, 0.25, 0.08, 12), uc, { x: x + s * 1.0, y: 0.62, z, rough: 0.35 })
      p.add(cyl(0.04, 0.04, 0.6, 6), '#c9ccd2', { x: x + s * 1.0, y: 0.3, z, ...METAL })
      p.add(cyl(0.18, 0.2, 0.04, 10), '#c9ccd2', { x: x + s * 1.0, y: 0.02, z, ...METAL })
    }
  }
  p.aoBottom(0.8, 0.3)
  return p.build()
}

export function marketStall() {
  const p = new Parts()
  const w = 6
  const d = 4
  const wood = '#a8693f'
  for (const [x, z] of [
    [-w / 2 + 0.2, -d / 2 + 0.2],
    [w / 2 - 0.2, -d / 2 + 0.2],
    [-w / 2 + 0.2, d / 2 - 0.2],
    [w / 2 - 0.2, d / 2 - 0.2],
  ]) {
    p.add(box(0.2, 2.8, 0.2), wood, { x, y: 1.4, z, jitter: 0.06 })
    p.add(box(0.3, 0.12, 0.3), shade(wood, 0.8), { x, y: 0.06, z })
  }
  // braces and top beams
  for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) {
    p.add(box(w - 0.2, 0.16, 0.16), shade(wood, 0.9), { y: 2.62, z })
    for (const s of [-1, 1]) p.add(box(0.1, 0.8, 0.1), shade(wood, 0.9), { x: s * (w / 2 - 0.45), y: 2.35, z, rz: s * 0.8 })
  }
  for (const s of [-1, 1]) p.add(box(0.16, 0.16, d - 0.2), shade(wood, 0.9), { x: s * (w / 2 - 0.2), y: 2.62 })
  // the counter: planks on a frame
  p.add(box(w, 1.0, 0.9), '#c48a52', { y: 0.5, z: d / 2 - 0.5, jitter: 0.05 })
  for (let i = 0; i < 12; i++) p.add(box(0.47, 0.96, 0.03), shade('#c48a52', 0.86 + ((i * 37) % 7) * 0.035), { x: -w / 2 + 0.25 + i * 0.5, y: 0.5, z: d / 2 - 0.04, jitter: 0.04 })
  p.add(box(w + 0.2, 0.1, 1.1), '#e0b07a', { y: 1.05, z: d / 2 - 0.5, rough: 0.5 })
  // striped awning with a scalloped valance
  for (let i = 0; i < 8; i++) {
    const x = -w / 2 + w / 16 + (i * w) / 8
    const c = i % 2 ? '#ffffff' : '#f7c843'
    p.add(box(w / 8 + 0.02, 0.06, d + 0.8), c, { x, y: 2.95, z: 0.2, rx: 0.18, jitter: 0, rough: 0.75 })
    p.add(halfDisc(w / 16), c, { x, y: 2.95 - ((d + 0.8) / 2) * Math.sin(0.18) - 0.02, z: 0.2 + ((d + 0.8) / 2) * Math.cos(0.18) + 0.02, rx: Math.PI / 2, sz: 0.6, jitter: 0, rough: 0.75 })
  }
  // goods on the counter: honey, carrots, apples, milk
  for (let i = 0; i < 4; i++) {
    p.add(cyl(0.15, 0.15, 0.3, 10), '#f5b623', { x: -2.3 + i * 0.36, y: 1.25, z: d / 2 - 0.5, mat: GLOW, rough: 0.15, jitter: 0 })
    p.add(cyl(0.16, 0.16, 0.06, 10), '#e9e2d0', { x: -2.3 + i * 0.36, y: 1.42, z: d / 2 - 0.5, ...ROUND })
    p.add(box(0.16, 0.12, 0.01), '#fff8e0', { x: -2.3 + i * 0.36, y: 1.24, z: d / 2 - 0.34, jitter: 0 })
  }
  p.add(box(0.9, 0.12, 0.5), '#b88752', { x: -0.36, y: 1.16, z: d / 2 - 0.5 })
  for (let i = 0; i < 6; i++) {
    p.add(cone(0.06, 0.42, 6), '#ff8c2b', { x: -0.66 + i * 0.12, y: 1.26, z: d / 2 - 0.42, rx: Math.PI / 2 + (i % 2) * 0.15, jitter: 0.04, ...ROUND })
    for (let k = 0; k < 3; k++) p.add(cone(0.035, 0.28, 3), '#5fb64a', { x: -0.66 + i * 0.12 + (k - 1) * 0.03, y: 1.3, z: d / 2 - 0.72, rx: -Math.PI / 2 + 0.4 + (k - 1) * 0.2 })
  }
  p.add(box(0.8, 0.14, 0.5), '#b88752', { x: 0.84, y: 1.17, z: d / 2 - 0.52 })
  for (let i = 0; i < 9; i++) {
    const x = 0.6 + (i % 3) * 0.24
    const z = d / 2 - 0.66 + Math.floor(i / 3) * 0.14
    p.add(sphere(0.12, 10, 8), i % 4 ? '#e8433a' : '#c9302a', { x, y: 1.32 + (i % 2) * 0.03, z, rough: 0.35, jitter: 0.06, ...ROUND })
    p.add(cyl(0.01, 0.01, 0.06, 3), '#5a3a1a', { x, y: 1.46 + (i % 2) * 0.03, z, jitter: 0 })
  }
  for (let i = 0; i < 3; i++) {
    p.add(cyl(0.1, 0.12, 0.35, 10), '#ffffff', { x: 1.8 + i * 0.28, y: 1.27, z: d / 2 - 0.5, rough: 0.2, ...ROUND })
    p.add(cyl(0.05, 0.08, 0.08, 10), '#ffffff', { x: 1.8 + i * 0.28, y: 1.48, z: d / 2 - 0.5, rough: 0.2, ...ROUND })
    p.add(cyl(0.055, 0.055, 0.04, 8), '#4a90c8', { x: 1.8 + i * 0.28, y: 1.54, z: d / 2 - 0.5 })
  }
  // crates beside, full of apples
  crate(p, w / 2 + 0.6, 0, d / 2 - 0.5, 0.75, 0.1)
  for (let i = 0; i < 5; i++) p.add(sphere(0.13, 10, 8), '#e8433a', { x: w / 2 + 0.45 + (i % 3) * 0.16, y: 0.7, z: d / 2 - 0.65 + Math.floor(i / 3) * 0.28, rough: 0.35, ...ROUND })
  crate(p, w / 2 + 0.55, 0, -0.6, 0.7, -0.2, '#b88752')
  // a hanging scale
  p.add(cyl(0.01, 0.01, 0.4, 3), IRON, { x: 1.2, y: 2.35, z: d / 2 - 0.2 })
  p.add(cyl(0.12, 0.1, 0.12, 10), '#c9ccd2', { x: 1.2, y: 2.1, z: d / 2 - 0.2, ...METAL })
  p.add(cyl(0.22, 0.22, 0.03, 12), '#c9ccd2', { x: 1.2, y: 1.85, z: d / 2 - 0.2, ...METAL })
  // a beehive sign on top
  p.add(sphere(0.35, 14, 10), '#f5b623', { y: 3.35, sy: 1.2, rough: 0.6, ...ROUND })
  for (let i = 0; i < 4; i++) p.add(torus(0.34 - Math.abs(i - 1.5) * 0.05, 0.04, 6, 14), '#c98a12', { y: 3.08 + i * 0.18, rx: Math.PI / 2, ...ROUND })
  p.add(box(0.14, 0.12, 0.05), '#5a3a1a', { y: 3.2, z: 0.34 })
  p.aoBottom(0.7, 0.3)
  return p.build()
}

export function bank() {
  const p = new Parts()
  const w = 7
  const d = 6
  const H = 3.6
  const stone = '#f4efe6'
  // three steps up to the door
  p.add(box(w + 1.2, 0.25, d + 1.6), '#d8d2c8', { y: 0.12, z: 0.3 })
  p.add(box(w + 0.6, 0.25, d + 1.0), '#e6e1d8', { y: 0.37, z: 0.2 })
  p.add(box(w + 1.24, 0.03, d + 1.64), '#cbc4b8', { y: 0.245, z: 0.3, jitter: 0 })
  // walls of smooth stone with grooved courses
  p.add(box(w, H, d), stone, { y: H / 2 + 0.5, jitter: 0.02 })
  for (let y = 0.5 + 0.45; y < H + 0.4; y += 0.45) {
    for (const s of [1, -1]) {
      p.add(box(w + 0.02, 0.025, 0.02), '#d9d2c5', { y, z: s * (d / 2 + 0.005), jitter: 0 })
      p.add(box(0.02, 0.025, d + 0.02), '#d9d2c5', { x: s * (w / 2 + 0.005), y, jitter: 0 })
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(box(0.3, H, 0.3), '#ece6db', { x: (sx * w) / 2, y: H / 2 + 0.5, z: (sz * d) / 2, jitter: 0.02 })
  // fluted columns with bases and capitals
  for (let i = 0; i < 4; i++) {
    const x = -w / 2 + 0.9 + (i * (w - 1.8)) / 3
    const z = d / 2 + 0.6
    p.add(cyl(0.25, 0.28, H - 0.5, 16), '#ffffff', { x, y: H / 2 + 0.45, z, rough: 0.5, ...ROUND })
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      p.add(box(0.035, H - 0.6, 0.035), '#e8e4dc', { x: x + Math.cos(a) * 0.255, y: H / 2 + 0.45, z: z + Math.sin(a) * 0.255, ry: -a, jitter: 0 })
    }
    p.add(cyl(0.34, 0.36, 0.14, 16), '#ffffff', { x, y: 0.57, z })
    p.add(box(0.72, 0.1, 0.72), '#ffffff', { x, y: 0.55, z })
    p.add(cyl(0.34, 0.27, 0.16, 16), '#ffffff', { x, y: H + 0.12, z })
    p.add(box(0.7, 0.18, 0.7), '#ffffff', { x, y: H + 0.4 - 0.08, z })
    for (const s of [-1, 1]) p.add(cyl(0.08, 0.08, 0.72, 10), '#f4efe6', { x: x + s * 0.3, y: H + 0.23, z, rx: Math.PI / 2, ...ROUND })
  }
  // entablature with dentils, the pediment with a raking cornice, and a tiled roof
  p.add(box(w + 0.4, 0.35, d + 1.6), '#e6e1d8', { y: H + 0.6, z: 0.3 })
  for (let i = 0; i < 26; i++) p.add(box(0.13, 0.1, 0.08), '#efeae1', { x: -w / 2 - 0.05 + i * 0.29, y: H + 0.38, z: d / 2 + 1.06, jitter: 0 })
  p.add(box(w + 0.6, 0.08, d + 1.6), '#efeae1', { y: H + 0.8, z: 0.3, jitter: 0 })
  p.add(prism(w + 0.4, 1.2, d + 1.6), '#e6e1d8', { y: H + 0.78, z: 0.3 })
  roof(p, w + 0.4, d + 1.6, H + 0.78, 1.2, '#7f9fbf', 0.3, { trim: '#efeae1', gutters: false })
  // the gable ends are the sides here; a gold coin sign over the porch
  p.add(cyl(0.45, 0.45, 0.1, 24), '#f1c232', { y: H + 1.3, z: d / 2 + 1.12, rx: Math.PI / 2, mat: GLOW, ...GOLDEN })
  p.add(torus(0.45, 0.04, 5, 24), '#d9a91f', { y: H + 1.3, z: d / 2 + 1.17, ...GOLDEN })
  p.add(box(0.1, 0.42, 0.04), '#d9a91f', { y: H + 1.3, z: d / 2 + 1.19, ...GOLDEN })
  // big double door with brass handles
  p.add(box(1.7, 2.6, 0.16), '#ece6db', { y: 1.8, z: d / 2 + 0.02 })
  for (const s of [-1, 1]) {
    p.add(box(0.68, 2.3, 0.08), '#5b6b80', { x: s * 0.35, y: 1.65, z: d / 2 + 0.06, rough: 0.5 })
    for (const y of [1.0, 2.2]) p.add(box(0.5, 0.75, 0.03), '#6a7b91', { x: s * 0.35, y, z: d / 2 + 0.11, rough: 0.5, jitter: 0 })
    p.add(cyl(0.025, 0.025, 0.4, 6), BRASS, { x: s * 0.09, y: 1.6, z: d / 2 + 0.14, ...METAL })
  }
  windowAt(p, -2.3, 2.3, d / 2 + 0.03, 0, 0.8, 1.2, { trim: '#ffffff' })
  windowAt(p, 2.3, 2.3, d / 2 + 0.03, 0, 0.8, 1.2, { trim: '#ffffff' })
  for (const s of [-1, 1]) {
    p.add(box(0.22, 0.26, 0.14), '#e6e1d8', { x: s * 2.3, y: 3.13, z: d / 2 + 0.1, jitter: 0 })
    for (const z of [-1.5, 1.2]) windowAt(p, s * (w / 2 + 0.03), 2.3, z, (s * Math.PI) / 2, 0.8, 1.2, { trim: '#ffffff' })
  }
  // brass lamps by the steps
  for (const s of [-1, 1]) {
    const x = s * (w / 2 + 0.35)
    const z = d / 2 + 1.1
    p.add(box(0.3, 0.6, 0.3), '#e6e1d8', { x, y: 0.8, z })
    p.add(cyl(0.04, 0.05, 1.0, 8), IRON, { x, y: 1.6, z, ...METAL })
    p.add(sphere(0.18, 12, 10), '#fff4c2', { x, y: 2.2, z, mat: GLOW, jitter: 0 })
    p.add(cyl(0.08, 0.12, 0.1, 10), IRON, { x, y: 2.05, z, ...METAL })
  }
  p.aoBottom(0.9, 0.3)
  return p.build()
}

export function toyShop() {
  const p = new Parts()
  const w = 7
  const d = 6
  const H = 3.2
  const y0 = 0.2
  const wall = '#ffe3ef'
  const trim = '#ffffff'
  plinth(p, w, d, 0.3, '#d5cbbd', 0.1)
  p.add(box(w, H, d), wall, { y: H / 2 + y0, jitter: 0.03 })
  siding(p, w, d, y0 + 0.18, y0 + H - 0.2, wall)
  trims(p, w, d, y0, y0 + H, trim)
  p.add(prism(w, 1.8, d), wall, { y: H + y0, jitter: 0.03 })
  gableSiding(p, w, d, H + y0, 1.8, wall)
  roof(p, w, d, H + y0, 1.8, '#7ec8e3', 0.45, { trim })
  // big display window
  p.add(box(3.2, 1.7, 0.1), '#c9e8fb', { x: -1.5, y: 1.6, z: d / 2 + 0.05, ...GLASS })
  p.add(box(3.4, 0.14, 0.2), trim, { x: -1.5, y: 0.72, z: d / 2 + 0.07, jitter: 0 })
  p.add(box(3.4, 0.14, 0.2), trim, { x: -1.5, y: 2.48, z: d / 2 + 0.07, jitter: 0 })
  for (const k of [-1, 0, 1]) p.add(box(0.1, 1.7, 0.16), trim, { x: -1.5 + k * 1.65, y: 1.6, z: d / 2 + 0.07, jitter: 0 })
  p.add(box(3.5, 0.08, 0.36), '#f7d6e4', { x: -1.5, y: 0.66, z: d / 2 + 0.16, jitter: 0 })
  // the Super Bright Bulb in the window (a clue!)
  p.add(sphere(0.42, 14, 10), '#fff6b0', { x: -1.0, y: 1.75, z: d / 2 + 0.35, mat: GLOW, rough: 0.15, jitter: 0 })
  p.add(cyl(0.18, 0.2, 0.3, 12), '#b0b0b0', { x: -1.0, y: 1.2, z: d / 2 + 0.35, ...METAL })
  for (let i = 0; i < 3; i++) p.add(torus(0.19, 0.025, 4, 12), '#8f8f8f', { x: -1.0, y: 1.12 + i * 0.08, z: d / 2 + 0.35, rx: Math.PI / 2, ...METAL })
  // toys in the window: a ball, blocks and a little teddy
  p.add(sphere(0.22, 10, 8), '#ff5d5d', { x: -2.4, y: 1.0, z: d / 2 + 0.3, rough: 0.35, ...ROUND })
  p.add(torus(0.22, 0.03, 4, 14), '#ffffff', { x: -2.4, y: 1.0, z: d / 2 + 0.3, ry: 0.4 })
  p.add(box(0.4, 0.4, 0.4), '#5bc0eb', { x: -1.9, y: 0.95, z: d / 2 + 0.3, ry: 0.5, rough: 0.4 })
  p.add(box(0.3, 0.3, 0.3), '#ffd23f', { x: -1.95, y: 1.3, z: d / 2 + 0.3, ry: 0.2, rough: 0.4 })
  p.add(sphere(0.2, 8, 6), '#c9a27a', { x: -2.4, y: 1.45, z: d / 2 + 0.3, ...ROUND })
  p.add(sphere(0.14, 8, 6), '#c9a27a', { x: -2.4, y: 1.72, z: d / 2 + 0.32, ...ROUND })
  for (const s of [-1, 1]) p.add(sphere(0.06, 6, 4), '#b08a62', { x: -2.4 + s * 0.11, y: 1.83, z: d / 2 + 0.32, ...ROUND })
  // door with a star and a glass panel
  door(p, 1.9, y0, d / 2, 1.2, 2.1, '#ff8fb1', { trim, glass: true })
  p.add(ico(0.18, 0), '#ffd23f', { x: 1.9, y: 1.7, z: d / 2 + 0.14, metal: 0.6, rough: 0.35, jitter: 0 })
  p.add(box(1.7, 0.14, 0.55), '#d5cbbd', { x: 1.9, y: 0.27, z: d / 2 + 0.3 })
  wallLamp(p, 2.85, 2.2, d / 2 + 0.03)
  // colorful pennants on a string
  p.add(cyl(0.012, 0.012, w - 0.4, 4), '#ffffff', { y: H + 0.12, z: d / 2 + 0.22, rz: Math.PI / 2 })
  for (let i = 0; i < 9; i++)
    p.add(cone(0.16, 0.32, 3), ['#ff5d5d', '#ffd23f', '#5bc0eb', '#7bd389', '#c38bff'][i % 5], { x: -w / 2 + 0.4 + i * 0.78, y: H + 0.05 - 0.08, z: d / 2 + 0.22, rx: Math.PI, sz: 0.25, jitter: 0, rough: 0.7 })
  // side windows
  for (const s of [-1, 1]) windowAt(p, s * (w / 2 + 0.03), 2.0, 0, (s * Math.PI) / 2, 0.9, 0.9, { trim })
  // giant teddy bear on the roof corner
  const bx = 2.4
  const by = H + 1.2
  const bz = 1.2
  p.add(sphere(0.55, 12, 9), '#c9a27a', { x: bx, y: by, z: bz, sy: 1.05, rough: 0.9, ...ROUND })
  p.add(sphere(0.32, 10, 7), '#e8cfaa', { x: bx, y: by - 0.05, z: bz + 0.35, sy: 1.1, rough: 0.9, ...ROUND })
  p.add(sphere(0.4, 12, 9), '#c9a27a', { x: bx, y: by + 0.75, z: bz + 0.05, rough: 0.9, ...ROUND })
  p.add(sphere(0.17, 10, 7), '#e8cfaa', { x: bx, y: by + 0.68, z: bz + 0.4, sz: 0.8, rough: 0.9, ...ROUND })
  p.add(sphere(0.06, 6, 5), '#3a2a20', { x: bx, y: by + 0.74, z: bz + 0.53, rough: 0.3, ...ROUND })
  for (const s of [-1, 1]) {
    p.add(sphere(0.15, 8, 6), '#c9a27a', { x: bx + s * 0.3, y: by + 1.1, z: bz, rough: 0.9, ...ROUND })
    p.add(sphere(0.08, 6, 5), '#e8cfaa', { x: bx + s * 0.3, y: by + 1.1, z: bz + 0.08, sz: 0.5, ...ROUND })
    p.add(sphere(0.045, 6, 4), '#1d1717', { x: bx + s * 0.14, y: by + 0.86, z: bz + 0.39, rough: 0.2, ...ROUND })
    p.add(sphere(0.18, 8, 6), '#c9a27a', { x: bx + s * 0.5, y: by + 0.1, z: bz + 0.15, sy: 1.4, rough: 0.9, ...ROUND })
    p.add(sphere(0.2, 8, 6), '#c9a27a', { x: bx + s * 0.28, y: by - 0.45, z: bz + 0.3, sz: 1.3, rough: 0.9, ...ROUND })
  }
  p.add(box(0.5, 0.12, 0.08), '#e94b3c', { x: bx, y: by + 0.42, z: bz + 0.36, jitter: 0 })
  p.aoBottom(1.0, 0.33)
  return p.build()
}

// The lighthouse: tower, lantern room (glows at night) and refs for the lamp and beam.
export function lighthouse() {
  const g = new THREE.Group()
  const p = new Parts()
  // a stone base with blocks
  p.add(cyl(3.0, 3.3, 0.6, 24), '#bdb6aa', { y: 0.3, jitter: 0.04 })
  const r = rng(19)
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2
    p.add(box(0.78, 0.24, 0.08), shade('#bdb6aa', 0.85 + r() * 0.25), { x: Math.cos(a) * 3.12, y: 0.22 + (i % 2) * 0.24, z: Math.sin(a) * 3.12, ry: -a + Math.PI / 2, jitter: 0.05 })
  }
  p.add(cyl(3.05, 3.05, 0.06, 24), '#a9a297', { y: 0.62 })
  const bands = 6
  const h = 2.3
  for (let i = 0; i < bands; i++) {
    const r0 = 2.4 - i * 0.22
    const r1 = 2.4 - (i + 1) * 0.22
    p.add(cyl(r1, r0, h, 24), i % 2 ? '#e94b3c' : '#ffffff', { y: 0.6 + h * i + h / 2, jitter: 0.02, rough: 0.6, ...ROUND })
    // a thin ring where two bands meet
    if (i > 0) p.add(cyl(r0 + 0.03, r0 + 0.03, 0.08, 24, true), '#d9d2c5', { y: 0.6 + h * i, jitter: 0, ...ROUND })
  }
  const top = 0.6 + h * bands
  // the gallery: corbels, a deck and a railing
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    p.add(box(0.18, 0.4, 0.32), '#3a3a46', { x: Math.cos(a) * 1.4, y: top - 0.15, z: Math.sin(a) * 1.4, ry: -a + Math.PI / 2, ...METAL, rough: 0.5 })
  }
  p.add(cyl(1.9, 1.7, 0.3, 24), '#3a3a46', { y: top + 0.15, ...METAL, rough: 0.55 })
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    p.add(cyl(0.03, 0.03, 0.7, 5), '#3a3a46', { x: Math.cos(a) * 1.8, y: top + 0.6, z: Math.sin(a) * 1.8, ...METAL })
  }
  p.add(torus(1.8, 0.05, 5, 32), '#3a3a46', { y: top + 0.95, rx: Math.PI / 2, ...METAL, ...ROUND })
  p.add(torus(1.8, 0.025, 4, 32), '#3a3a46', { y: top + 0.6, rx: Math.PI / 2, ...METAL })
  // the lantern room: metal frame around the glass, a red dome, a vent and a lightning rod
  p.add(cyl(1.1, 1.1, 1.6, 16), '#cfeeff', { y: top + 1.1, mat: GLOW, rough: 0.05, metal: 0.4, jitter: 0 })
  p.add(cyl(1.18, 1.18, 0.3, 16), '#3a3a46', { y: top + 0.32, ...METAL })
  p.add(cyl(1.18, 1.18, 0.12, 16), '#3a3a46', { y: top + 1.94, ...METAL })
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    p.add(box(0.07, 1.6, 0.07), '#3a3a46', { x: Math.cos(a) * 1.12, y: top + 1.1, z: Math.sin(a) * 1.12, ry: -a, ...METAL })
  }
  p.add(cone(1.4, 1.2, 20), '#e94b3c', { y: top + 2.5, rough: 0.45, ...ROUND })
  p.add(cyl(1.42, 1.42, 0.08, 20), '#c23a2e', { y: top + 1.94, rough: 0.45 })
  p.add(sphere(0.24, 12, 10), '#3a3a46', { y: top + 3.15, ...METAL, ...ROUND })
  p.add(cyl(0.025, 0.025, 0.9, 5), '#3a3a46', { y: top + 3.7, ...METAL })
  // the door with a little porch roof, and windows up the tower
  door(p, 0, 0.6, 2.32, 1.2, 1.9, '#2f5b86', { trim: '#ffffff' })
  p.add(box(1.8, 0.1, 0.9), '#3a3a46', { y: 2.75, z: 2.7, rx: 0.25, ...METAL, rough: 0.5 })
  for (const s of [-1, 1]) p.add(box(0.05, 0.05, 0.6), '#3a3a46', { x: s * 0.75, y: 2.5, z: 2.6, rx: -0.6, ...METAL })
  p.add(box(1.6, 0.14, 0.6), '#a9a297', { y: 0.67, z: 2.7 })
  for (let i = 0; i < 3; i++) {
    const y = 4 + i * 4
    windowAt(p, 0, y, 2.4 - (0.22 * (y - 0.6)) / h + 0.03, 0, 0.5, 0.7, { mullions: false })
  }
  p.aoBottom(1.0, 0.3)
  g.add(p.build())
  const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 2), new THREE.MeshBasicMaterial({ color: 0x8a8a70 }))
  lamp.position.y = top + 1.1
  g.add(lamp)
  const beamGeo = new THREE.ConeGeometry(3.2, 40, 16, 1, true)
  beamGeo.translate(0, -20, 0)
  beamGeo.rotateZ(Math.PI / 2)
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })
  const beam = new THREE.Group()
  const b1 = new THREE.Mesh(beamGeo, beamMat)
  const b2 = new THREE.Mesh(beamGeo, beamMat)
  b2.rotation.y = Math.PI
  beam.add(b1, b2)
  beam.position.y = top + 1.1
  beam.visible = false
  g.add(beam)
  g.userData = { lamp, beam, top }
  return g
}

// The pier deck: planks with small gaps, beams below, posts with rope, rope rails. One mesh (the
// world gives it the deck material), so no glass here.
export function pier(len, width) {
  const p = new Parts()
  const r = rng(Math.round(len * 13 + width))
  for (let z = 0; z < len; z += 0.45) {
    const k = r()
    p.add(box(width, 0.14, 0.41), shade(k < 0.33 ? '#b98a5e' : k < 0.66 ? '#c99a6a' : '#bf9264', 0.92 + r() * 0.14), { y: -0.07 + (r() - 0.5) * 0.01, z: z + 0.225, jitter: 0.06 })
  }
  // stringers under the deck and nails
  for (const x of [-width / 2 + 0.3, 0, width / 2 - 0.3]) p.add(box(0.2, 0.3, len), '#6f4c2e', { x, y: -0.3, z: len / 2 })
  for (let z = 0; z <= len; z += 3)
    for (const s of [-1, 1]) {
      p.add(cyl(0.18, 0.21, 3.2, 10), '#7d5634', { x: s * (width / 2 - 0.1), y: -1.5, z, jitter: 0.06, ...ROUND })
      p.add(cyl(0.2, 0.2, 0.3, 10), '#7d5634', { x: s * (width / 2 - 0.1), y: 0.2, z, ...ROUND })
      p.add(cyl(0.21, 0.21, 0.02, 10), '#5c3f24', { x: s * (width / 2 - 0.1), y: 0.36, z })
      for (const y of [-0.45, -1.2]) p.add(torus(0.2, 0.025, 4, 10), '#d8c08a', { x: s * (width / 2 - 0.1), y, z, rx: Math.PI / 2 })
      if (s > 0) p.add(box(width, 0.18, 0.18), '#6f4c2e', { y: -0.5, z })
    }
  // rope rails
  for (const s of [-1, 1]) p.add(cyl(0.03, 0.03, len, 6), '#e8d9b0', { x: s * (width / 2 - 0.1), y: 0.3, z: len / 2, rx: Math.PI / 2, jitter: 0 })
  // bollards at the end
  for (const s of [-1, 1]) {
    p.add(cyl(0.16, 0.2, 0.4, 10), '#3f4148', { x: s * (width / 2 - 0.55), y: 0.2, z: len - 0.5, ...METAL, rough: 0.5 })
    p.add(cyl(0.22, 0.22, 0.06, 10), '#3f4148', { x: s * (width / 2 - 0.55), y: 0.42, z: len - 0.5, ...METAL, rough: 0.5 })
  }
  return p.build({ receive: true })
}

export function boat() {
  const g = new THREE.Group()
  const p = new Parts()
  // hull: tapered stack with plank lines
  p.add(box(2.6, 1.0, 5.2), '#e8584a', { y: 0.5, rough: 0.45 })
  p.add(prism(1.0, 1.4, 2.6), '#e8584a', { y: 0.5, z: 2.6, rz: Math.PI / 2, ry: Math.PI / 2, rough: 0.45 })
  for (const y of [0.2, 0.45, 0.7]) {
    for (const s of [-1, 1]) p.add(box(0.02, 0.025, 5.2), '#c94639', { x: s * 1.305, y, jitter: 0 })
    p.add(box(2.62, 0.025, 0.02), '#c94639', { y, z: -2.605, jitter: 0 })
  }
  p.add(box(2.66, 0.18, 5.26), '#ffffff', { y: 0.95, rough: 0.4 })
  p.add(prism(0.18, 1.42, 2.66), '#ffffff', { y: 0.95, z: 2.6, rz: Math.PI / 2, ry: Math.PI / 2, rough: 0.4 })
  for (const s of [-1, 1]) p.add(box(0.1, 0.08, 5.3), '#8a5a35', { x: s * 1.33, y: 1.08, rough: 0.4 })
  p.add(box(2.76, 0.08, 0.1), '#8a5a35', { y: 1.08, z: -2.63, rough: 0.4 })
  // deck planks
  for (let i = 0; i < 8; i++) p.add(box(0.28, 0.06, 5.0), shade('#c99a6a', 0.9 + (i % 3) * 0.06), { x: -1.05 + i * 0.3, y: 1.06, rough: 0.5 })
  // cabin with windows, a roof with a rail, and a door
  p.add(box(1.8, 1.4, 1.8), '#ffffff', { y: 1.8, z: -1.0, rough: 0.5 })
  p.add(box(2.0, 0.15, 2.0), '#2b4c8c', { y: 2.55, z: -1.0, rough: 0.45 })
  for (const s of [-1, 1]) p.add(box(2.0, 0.04, 0.04), '#d9d9d9', { y: 2.75, z: -1.0 + s * 0.95, ...METAL, rough: 0.2 })
  for (const s of [-1, 1]) {
    p.add(box(0.08, 0.62, 1.02), '#2b4c8c', { x: s * 0.89, y: 1.95, z: -1.0, jitter: 0 })
    p.add(box(0.06, 0.5, 0.9), '#bfe3ff', { x: s * 0.925, y: 1.95, z: -1.0, ...GLASS })
  }
  p.add(box(0.9, 0.45, 0.06), '#bfe3ff', { y: 2.05, z: -0.08, ...GLASS })
  p.add(box(0.7, 1.1, 0.06), '#2b4c8c', { y: 1.65, z: -1.92 })
  // mast, boom, rigging and the little flag
  p.add(cyl(0.08, 0.1, 4.2, 8), '#7d5634', { y: 3.2, z: 0.9, ...ROUND })
  p.add(cyl(0.05, 0.05, 2.2, 6), '#7d5634', { y: 1.9, z: 0.0, rx: Math.PI / 2, ...ROUND })
  p.add(cyl(0.012, 0.012, 4.6, 3), '#d8c08a', { y: 3.1, z: 2.25, rx: -0.55 })
  p.add(cyl(0.012, 0.012, 4.3, 3), '#d8c08a', { y: 3.1, z: -0.1, rx: 0.45 })
  p.add(prism(0.05, 0.9, 0.55), '#ffd23f', { y: 5.0, z: 0.9, rx: -Math.PI / 2 })
  // life ring, fenders, cleats and a coil of rope
  for (let i = 0; i < 8; i++) p.add(torus(0.35, 0.1, 6, 3, Math.PI / 4), i % 2 ? '#ffffff' : '#ff5a4f', { x: 1.34, y: 1.5, z: -1.0, rx: (i * Math.PI) / 4, ry: Math.PI / 2, order: 'YXZ', jitter: 0, ...ROUND })
  for (const z of [-1.8, 0.2, 1.8]) {
    p.add(cyl(0.12, 0.12, 0.5, 10), '#2b4c8c', { x: -1.42, y: 0.55, z, rough: 0.4, ...ROUND })
    p.add(cyl(0.01, 0.01, 0.4, 3), '#d8c08a', { x: -1.38, y: 0.95, z })
  }
  for (const z of [-2.3, 2.0]) for (const s of [-1, 1]) p.add(box(0.08, 0.06, 0.3), '#c9ccd2', { x: s * 1.15, y: 1.16, z, ...METAL })
  for (let i = 0; i < 3; i++) p.add(torus(0.22 - i * 0.04, 0.035, 4, 12), '#d8c08a', { x: 0.6, y: 1.13 + i * 0.05, z: 1.6, rx: Math.PI / 2 })
  g.add(p.build())
  return g
}

export function well() {
  const p = new Parts()
  // two courses of stones around the well
  const r = rng(3)
  for (let k = 0; k < 2; k++)
    for (let i = 0; i < 12; i++) {
      const a = ((i + k * 0.5) / 12) * Math.PI * 2
      p.add(box(0.56, 0.42, 0.42), shade(i % 2 ? '#b7b0a6' : '#a59e94', 0.9 + r() * 0.2), { x: Math.cos(a) * 1.05, y: 0.22 + k * 0.44, z: Math.sin(a) * 1.05, ry: -a + Math.PI / 2, jitter: 0.08 })
    }
  p.add(cyl(1.32, 1.32, 0.1, 16), '#c4bdb2', { y: 0.92, jitter: 0.05 })
  p.add(cyl(0.95, 0.95, 0.05, 16), '#4fb7e0', { y: 0.7, rough: 0.05, metal: 0.2, jitter: 0 })
  for (let i = 0; i < 3; i++) {
    const a = i * 2.2
    p.add(ico(0.1, 0), '#6f9f55', { x: Math.cos(a) * 1.26, y: 0.12, z: Math.sin(a) * 1.26, sy: 0.5 })
  }
  // posts, crossbeam with a crank, rope and bucket
  for (const s of [-1, 1]) {
    p.add(box(0.18, 2.2, 0.18), '#8b5a2b', { x: s * 1.15, y: 1.1, jitter: 0.06 })
    p.add(box(0.06, 0.6, 0.06), '#7d5634', { x: s * 1.15, y: 1.0, z: 0.25, rx: 0.5 })
  }
  p.add(cyl(0.08, 0.08, 2.5, 8), '#7d5634', { y: 1.9, rz: Math.PI / 2, ...ROUND })
  p.add(cyl(0.12, 0.12, 0.7, 10), '#d8c08a', { y: 1.9, rz: Math.PI / 2, ...ROUND })
  p.add(box(0.05, 0.4, 0.05), IRON, { x: 1.3, y: 1.75, ...METAL })
  p.add(cyl(0.03, 0.03, 0.25, 6), IRON, { x: 1.4, y: 1.57, rz: Math.PI / 2, ...METAL })
  p.add(cyl(0.015, 0.015, 0.45, 4), '#d8c08a', { y: 1.6 })
  p.add(cyl(0.2, 0.16, 0.3, 12), '#8b5a2b', { y: 1.3, ...ROUND })
  for (const y of [1.22, 1.4]) p.add(cyl(0.19 + (y - 1.22) * 0.1, 0.19 + (y - 1.22) * 0.1, 0.03, 12, true), IRON, { y, ...METAL })
  p.add(torus(0.17, 0.012, 3, 10, Math.PI), IRON, { y: 1.45, ...METAL })
  // a tiled roof
  p.add(prism(2.9, 0.9, 1.9), '#c95a4c', { y: 2.2 })
  const a = Math.atan2(0.9, 0.95)
  for (const s of [1, -1])
    for (let k = 0; k < 4; k++) {
      const f = 0.55 - k * 0.32
      p.add(box(3.0, 0.05, 0.4), shade('#f0705f', 0.88 + ((k * 3 + (s > 0 ? 1 : 0)) % 4) * 0.06), { y: 2.2 + 0.45 - Math.sin(a) * f + Math.cos(a) * 0.04, z: s * (0.475 + Math.cos(a) * f + Math.sin(a) * 0.04), rx: s * (a - 0.06), jitter: 0.03 })
    }
  p.add(cyl(0.08, 0.08, 3.05, 8), '#b04c3f', { y: 3.13, rz: Math.PI / 2, ...ROUND })
  p.aoBottom(0.6, 0.3)
  return p.build()
}

export function spring() {
  const p = new Parts()
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    p.add(lump(0.5 + (i % 3) * 0.1, 1, i + 3, 0.1), i % 2 ? '#9a958e' : '#b1aca4', { x: Math.cos(a) * 1.0, y: 0.22, z: Math.sin(a) * 1.0, sy: 0.75, jitter: 0.1, flat: true })
  }
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3 + 0.4
    p.add(ico(0.12, 0), '#6f9f55', { x: Math.cos(a) * 1.2, y: 0.45, z: Math.sin(a) * 1.2, sy: 0.4 })
  }
  p.add(cyl(0.9, 0.9, 0.08, 16), '#5cc8ea', { y: 0.35, rough: 0.05, metal: 0.2, jitter: 0 })
  p.add(lump(0.8, 1, 9, 0.1), '#9a958e', { y: 0.9, z: -1.0, sy: 1.4, jitter: 0.1, flat: true })
  p.add(ico(0.18, 0), '#6f9f55', { x: 0.3, y: 1.6, z: -1.0, sy: 0.4 })
  p.add(cyl(0.07, 0.07, 0.7, 6), '#7fd7f0', { y: 0.75, z: -0.5, rx: 0.35, mat: GLOW, rough: 0.05, jitter: 0 })
  p.add(cyl(0.18, 0.2, 0.03, 10), '#b9ecf8', { y: 0.4, z: -0.38, mat: GLOW, rough: 0.05, jitter: 0 })
  return p.build()
}

export function fountain() {
  const p = new Parts()
  const st = '#d9d2c5'
  p.add(cyl(1.3, 1.45, 0.55, 24), st, { y: 0.28, rough: 0.6, ...ROUND })
  p.add(torus(1.3, 0.1, 6, 24), '#e6e0d4', { y: 0.58, rx: Math.PI / 2, ...ROUND })
  p.add(cyl(1.48, 1.52, 0.08, 24), '#c7c0b2', { y: 0.04 })
  p.add(cyl(1.15, 1.15, 0.05, 24), '#5cc8ea', { y: 0.5, rough: 0.05, metal: 0.2, jitter: 0 })
  p.add(cyl(0.25, 0.32, 1.4, 12), st, { y: 1.0, ...ROUND })
  for (const y of [0.55, 1.45]) p.add(torus(0.3, 0.05, 4, 12), '#e6e0d4', { y, rx: Math.PI / 2 })
  p.add(cyl(0.65, 0.35, 0.22, 16), st, { y: 1.7, ...ROUND })
  p.add(torus(0.63, 0.05, 4, 16), '#e6e0d4', { y: 1.8, rx: Math.PI / 2 })
  p.add(cyl(0.58, 0.58, 0.03, 16), '#5cc8ea', { y: 1.79, rough: 0.05, metal: 0.2, jitter: 0 })
  p.add(sphere(0.14, 10, 8), st, { y: 1.95, ...ROUND })
  p.add(cone(0.2, 0.6, 8), '#9fe3f7', { y: 2.25, mat: GLOW, rough: 0.05, jitter: 0 })
  // water falling from the bowl
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    p.add(cyl(0.012, 0.03, 1.15, 4), '#d6f5ff', { x: Math.cos(a) * 0.78, y: 1.2, z: Math.sin(a) * 0.78, rz: -Math.cos(a) * 0.22, rx: Math.sin(a) * 0.22, mat: GLOW, rough: 0.05, jitter: 0 })
  }
  for (const rr of [0.95, 1.05]) p.add(torus(rr, 0.015, 3, 24), '#e3f8ff', { y: 0.53, rx: Math.PI / 2, mat: GLOW, rough: 0.05, jitter: 0 })
  p.aoBottom(0.5, 0.25)
  return p.build()
}

export function bench() {
  const p = new Parts()
  const wood = '#c48a52'
  // seat and back slats
  for (let i = 0; i < 4; i++) p.add(box(2.0, 0.07, 0.13), shade(wood, 0.92 + (i % 2) * 0.1), { y: 0.58, z: -0.22 + i * 0.15, rough: 0.55, jitter: 0.04 })
  for (let i = 0; i < 3; i++) p.add(box(2.0, 0.12, 0.05), shade(wood, 0.92 + (i % 2) * 0.1), { y: 0.78 + i * 0.15, z: -0.31 - i * 0.025, rx: -0.15, rough: 0.55, jitter: 0.04 })
  // cast iron sides with armrests, and bolts
  for (const s of [-1, 1]) {
    const x = s * 0.85
    p.add(box(0.07, 0.55, 0.07), IRON, { x, y: 0.27, z: 0.22, ...METAL })
    p.add(box(0.07, 1.0, 0.07), IRON, { x, y: 0.55, z: -0.28, rx: -0.12, ...METAL })
    p.add(box(0.07, 0.07, 0.56), IRON, { x, y: 0.52, ...METAL })
    p.add(box(0.07, 0.07, 0.5), IRON, { x, y: 0.12, ...METAL })
    p.add(box(0.08, 0.06, 0.5), IRON, { x, y: 0.82, z: 0.0, ...METAL })
    p.add(cyl(0.045, 0.045, 0.3, 6), IRON, { x, y: 0.67, z: 0.22, ...METAL })
    p.add(sphere(0.05, 8, 6), IRON, { x, y: 0.84, z: 0.25, ...METAL, ...ROUND })
    for (const z of [-0.2, 0.2]) p.add(box(0.12, 0.05, 0.09), IRON, { x, y: 0.02, z, ...METAL })
  }
  p.add(box(1.7, 0.05, 0.05), IRON, { y: 0.5, z: 0.05, ...METAL })
  return p.build()
}

export function appleTree() {
  const g = new THREE.Group()
  const p = new Parts()
  const bark = '#7a4e2b'
  p.add(cyl(0.2, 0.34, 2.2, 10), bark, { y: 1.1, jitter: 0.1, ...ROUND })
  for (let i = 0; i < 4; i++) {
    const a = i * 1.6 + 0.3
    p.add(cyl(0.12, 0.16, 0.5, 6), bark, { x: Math.cos(a) * 0.3, y: 0.12, z: Math.sin(a) * 0.3, rz: Math.cos(a) * 1.0, rx: -Math.sin(a) * 1.0, jitter: 0.08 })
  }
  for (const [x, y, z, rz, rx] of [
    [0.45, 2.3, 0.2, -0.8, 0.2],
    [-0.4, 2.35, -0.25, 0.7, -0.3],
    [0.05, 2.5, 0.45, 0.1, 0.8],
  ])
    p.add(cyl(0.07, 0.12, 1.1, 6), bark, { x, y, z, rz, rx, jitter: 0.08 })
  p.add(lump(1.5, 2, 1), '#5fb64a', { y: 2.9, sx: 1.1, jitter: 0.08, ...ROUND })
  p.add(lump(1.0, 2, 2), '#6cc456', { x: 0.9, y: 2.6, z: 0.4, jitter: 0.08, ...ROUND })
  p.add(lump(1.0, 2, 3), '#58ab45', { x: -0.8, y: 2.7, z: -0.4, jitter: 0.08, ...ROUND })
  p.add(lump(0.85, 1, 4), '#64bd4f', { x: 0.1, y: 3.65, z: 0.1, jitter: 0.08, ...ROUND })
  p.add(lump(0.8, 1, 5), '#52a443', { x: -0.3, y: 2.4, z: 0.85, jitter: 0.08, ...ROUND })
  p.aoBottom(1.8, 0.4, 0)
  g.add(p.build())
  const ap = new Parts()
  const spots = [
    [0.9, 2.3, 1.1],
    [-1.0, 2.5, 0.9],
    [0.2, 3.2, 1.45],
    [1.4, 3.0, -0.3],
    [-0.6, 2.2, -1.2],
    [-1.4, 3.1, 0.2],
  ]
  for (const [x, y, z] of spots) {
    ap.add(sphere(0.18, 10, 8), '#e8433a', { x, y, z, rough: 0.3, jitter: 0.06, ...ROUND })
    ap.add(box(0.03, 0.12, 0.03), '#5a3a1a', { x, y: y + 0.2, z, jitter: 0 })
    ap.add(sphere(0.07, 5, 3), '#4f9f3a', { x: x + 0.06, y: y + 0.23, z, sy: 0.3, sx: 1.6, jitter: 0 })
  }
  const apples = ap.build()
  g.add(apples)
  g.userData.fruit = apples
  return g
}

export function berryBush() {
  const g = new THREE.Group()
  const p = new Parts()
  p.add(lump(0.75, 2, 11), '#4f9f45', { y: 0.55, sx: 1.25, jitter: 0.08, ...ROUND })
  p.add(lump(0.55, 2, 12), '#5aad4d', { x: 0.6, y: 0.45, z: 0.2, jitter: 0.08, ...ROUND })
  p.add(lump(0.5, 2, 13), '#4a9640', { x: -0.6, y: 0.45, z: -0.1, jitter: 0.08, ...ROUND })
  p.add(lump(0.4, 1, 14), '#56a84a', { x: 0.1, y: 0.95, z: 0.1, jitter: 0.08, ...ROUND })
  p.aoBottom(0.8, 0.4, 0)
  g.add(p.build())
  const bp = new Parts()
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4
    const r = 0.75 + (i % 3) * 0.1
    const x = Math.cos(a) * r
    const y = 0.5 + Math.sin(i * 1.7) * 0.25
    const z = Math.sin(a) * r * 0.75
    const c = i % 3 ? '#4a4fc4' : '#7a3fb8'
    for (let k = 0; k < 3; k++) bp.add(sphere(0.07, 6, 4), c, { x: x + (k - 1) * 0.06, y: y + (k === 1 ? 0.06 : 0), z: z + (k % 2) * 0.03, rough: 0.25, jitter: 0.05, ...ROUND })
  }
  const berries = bp.build()
  g.add(berries)
  g.userData.fruit = berries
  return g
}

export function carrotPatch() {
  const g = new THREE.Group()
  const p = new Parts()
  p.add(box(4.2, 0.2, 3.2), '#7a5233', { y: 0.05, jitter: 0.1 })
  for (const s of [-1, 1]) {
    p.add(box(4.4, 0.25, 0.12), '#8b5a2b', { y: 0.1, z: s * 1.66 })
    p.add(box(0.12, 0.25, 3.4), '#8b5a2b', { x: s * 2.16, y: 0.1 })
  }
  for (let r = 0; r < 3; r++) {
    p.add(box(3.8, 0.14, 0.5), '#6a4529', { y: 0.18, z: -1 + r, jitter: 0.12 })
    for (let i = 0; i < 4; i++) p.add(ico(0.09, 0), '#5d3c22', { x: -1.4 + i * 0.95, y: 0.25, z: -1 + r + ((i * 7) % 3 - 1) * 0.15, sy: 0.5 })
  }
  g.add(p.build({ receive: true }))
  const cp = new Parts()
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 5; i++) {
      const x = -1.6 + i * 0.8
      const z = -1 + r
      cp.add(cone(0.1, 0.25, 8), '#ff8c2b', { x, y: 0.3, z, rx: Math.PI, rough: 0.6, ...ROUND })
      cp.add(cyl(0.1, 0.1, 0.03, 8), '#f57a1f', { x, y: 0.43, z })
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + i
        cp.add(cone(0.05, 0.5, 3), k % 2 ? '#5fb64a' : '#4f9f3a', { x: x + Math.cos(a) * 0.05, y: 0.66, z: z + Math.sin(a) * 0.05, rz: Math.cos(a) * 0.4, rx: -Math.sin(a) * 0.4, jitter: 0 })
      }
    }
  const tops = cp.build()
  g.add(tops)
  g.userData.fruit = tops
  return g
}

const arrowShape = new THREE.Shape()
arrowShape.moveTo(0, -0.21)
arrowShape.lineTo(1.65, -0.21)
arrowShape.lineTo(1.98, 0)
arrowShape.lineTo(1.65, 0.21)
arrowShape.lineTo(0, 0.21)
arrowShape.closePath()
const ARROW_BOARD = new THREE.ExtrudeGeometry(arrowShape, { depth: 0.08, bevelEnabled: false }).translate(0, 0, -0.04)

// Signpost with arrow boards pointing at real places. boards: [{ text, angle }]
export function signpost(boards) {
  // Two draw calls in all: the wood and iron in one mesh, and every board's words in one mesh that
  // reads from a single texture (one row per board).
  const g = new THREE.Group()
  const p = new Parts()
  p.add(cyl(0.12, 0.14, 3.3, 10), '#8b5a2b', { y: 1.65, jitter: 0.08, ...ROUND })
  p.add(cone(0.18, 0.3, 10), '#7a4e27', { y: 3.45 })
  p.add(cyl(0.17, 0.17, 0.05, 10), '#7a4e27', { y: 3.3 })
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    p.add(ico(0.16 + (i % 2) * 0.04, 0), i % 2 ? '#a59e94' : '#b7b0a6', { x: Math.cos(a) * 0.25, y: 0.06, z: Math.sin(a) * 0.25, sy: 0.6, jitter: 0.08 })
  }
  const n = boards.length
  const RW = 320
  const RH = 80
  const atlas = document.createElement('canvas')
  atlas.width = RW
  atlas.height = RH * n
  const ctx = atlas.getContext('2d')
  const pos = []
  const nor = []
  const uv = []
  const arm = new THREE.Matrix4()
  const local = new THREE.Matrix4()
  const v = new THREE.Vector3()
  const nn = new THREE.Vector3()
  const nm = new THREE.Matrix3()
  boards.forEach((b, i) => {
    arm.makeRotationY(b.angle).setPosition(0, 2.95 - i * 0.52, 0)
    p.add(ARROW_BOARD, i % 2 ? '#d9a066' : '#e3b27a', { x: 0.1, rough: 0.7, jitter: 0.05, matrix: arm })
    p.add(box(0.08, 0.5, 0.12), '#6b4a2b', { x: 0.13, matrix: arm })
    for (const y of [-0.15, 0.15]) p.add(cyl(0.025, 0.025, 0.14, 6), IRON, { x: 0.25, y, rx: Math.PI / 2, ...METAL, matrix: arm })
    ctx.drawImage(textCanvas(b.text, { w: RW, h: RH, font: 'bold 44px Andika, sans-serif' }), 0, i * RH)
    // a text plane on each side of the board, its uvs on this board's row of the texture
    for (const side of [1, -1]) {
      local.makeRotationY(side < 0 ? Math.PI : 0).setPosition(0.95, 0, side * 0.045)
      local.premultiply(arm)
      nm.getNormalMatrix(local)
      const pg = new THREE.PlaneGeometry(1.6, 0.4).toNonIndexed()
      const P = pg.attributes.position
      const U = pg.attributes.uv
      for (let k = 0; k < P.count; k++) {
        v.fromBufferAttribute(P, k).applyMatrix4(local)
        pos.push(v.x, v.y, v.z)
        nn.set(0, 0, 1).applyMatrix3(nm).normalize()
        nor.push(nn.x, nn.y, nn.z)
        uv.push(U.getX(k), 1 - (i + 1 - U.getY(k)) / n)
      }
    }
  })
  g.add(p.build())
  const tex = new THREE.CanvasTexture(atlas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const tg = new THREE.BufferGeometry()
  tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  tg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  tg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  const words = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8 }))
  g.add(words)
  return g
}

// A flat shop sign with words (reading practice).
export function shopSign(text, w, h, bg, fg = '#ffffff') {
  const cv = textCanvas(text, { w: 512, h: Math.round((512 * h) / w), font: `bold ${Math.round(((512 * h) / w) * 0.62)}px "Baloo 2", Andika, sans-serif`, fg, bg })
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }))
  return m
}

// Pickups
export function shellMesh() {
  const p = new Parts()
  // a scallop: a low dome with ribs fanning out from the hinge, and two little ears
  const R = 0.2
  const dome = (x, z) => 0.075 * Math.sqrt(Math.max(0, 1 - (x * x + z * z) / (R * R)))
  p.add(sphere(R, 14, 6, 0, Math.PI / 2), '#ffd1dc', { y: 0.005, sy: 0.375, rough: 0.35, jitter: 0.04, ...ROUND })
  const hz = -R * 0.95
  for (let i = 0; i < 7; i++) {
    const a = 0.12 * Math.PI + (i / 6) * 0.76 * Math.PI
    const ex = Math.cos(a) * R
    const ez = Math.sin(a) * R * 0.98
    for (const t of [0.22, 0.47, 0.72]) {
      const x = ex * t
      const z = hz + (ez - hz) * t
      const len = Math.hypot(ex, ez - hz) * 0.26
      p.add(box(0.02, 0.016, len), i % 2 ? '#ffb3c4' : '#ffc0cf', { x, y: dome(x, z) + 0.004, z, ry: Math.atan2(ex, ez - hz), rough: 0.35, jitter: 0 })
    }
  }
  for (const sx of [-1, 1]) p.add(box(0.07, 0.025, 0.06), '#ffb3c4', { x: sx * 0.045, y: 0.015, z: hz - 0.01, rough: 0.35 })
  return p.build()
}
export function coinMesh() {
  const p = new Parts()
  const coin = { mat: GLOW, metal: 0.3, rough: 0.3, jitter: 0 }
  p.add(cyl(0.28, 0.28, 0.07, 20), '#ffd04a', { rx: Math.PI / 2, ...coin })
  p.add(torus(0.26, 0.025, 4, 20), '#f0b62e', coin)
  p.add(box(0.08, 0.26, 0.09), '#f0b62e', coin)
  return p.build()
}
export function glassesMesh() {
  const p = new Parts()
  for (const s of [-1, 1]) {
    p.add(torus(0.16, 0.03, 6, 16), '#3a3030', { x: s * 0.2, rx: -Math.PI / 2 + 0.4, y: 0.06, rough: 0.3 })
    p.add(cyl(0.15, 0.15, 0.01, 16), '#bfe3ff', { x: s * 0.2, rx: 0.4, y: 0.06, rough: 0.05, metal: 0.4, jitter: 0 })
    p.add(box(0.03, 0.03, 0.34), '#3a3030', { x: s * 0.37, y: 0.1, z: -0.16, rough: 0.3 })
  }
  p.add(torus(0.07, 0.02, 4, 8, Math.PI), '#3a3030', { y: 0.11, rx: -0.4, rough: 0.3 })
  return p.build()
}

// ---------- ring road buildings ----------

export function postOffice() {
  const p = new Parts()
  const w = 7
  const d = 6
  const H = 3.0
  const y0 = 0.2
  const wall = '#fdf0e0'
  const blue = '#3b7dd8'
  const trim = '#ffffff'
  plinth(p, w, d, 0.3, '#cfc6b3', 0.1)
  p.add(box(w, H, d), wall, { y: H / 2 + y0, jitter: 0.03 })
  siding(p, w, d, 0.75, y0 + H - 0.2, wall)
  // a blue wainscot band with a white cap
  p.add(box(w + 0.05, 0.35, d + 0.05), blue, { y: 0.55, rough: 0.45 })
  p.add(box(w + 0.1, 0.06, d + 0.1), trim, { y: 0.74, jitter: 0 })
  trims(p, w, d, y0, y0 + H, trim)
  p.add(prism(w, 1.7, d), wall, { y: H + y0, jitter: 0.03 })
  gableSiding(p, w, d, H + y0, 1.7, wall)
  roof(p, w, d, H + y0, 1.7, '#e94b3c', 0.45, { trim })
  door(p, 0, y0, d / 2, 1.3, 2.1, blue, { trim, glass: true })
  p.add(box(1.8, 0.14, 0.6), '#cfc6b3', { y: 0.27, z: d / 2 + 0.32 })
  windowAt(p, -2.2, 1.9, d / 2 + 0.03, 0, 0.9, 0.85, { trim, shutters: blue })
  windowAt(p, 2.2, 1.9, d / 2 + 0.03, 0, 0.9, 0.85, { trim, shutters: blue })
  for (const s of [-1, 1]) windowAt(p, s * (w / 2 + 0.03), 1.9, 0, (s * Math.PI) / 2, 0.9, 0.85, { trim })
  wallLamp(p, -1.0, 2.0, d / 2 + 0.03)
  // a letter slot in the wall
  p.add(box(0.5, 0.12, 0.05), BRASS, { x: 1.15, y: 1.25, z: d / 2 + 0.05, ...METAL })
  p.add(box(0.4, 0.03, 0.06), '#2b2b2b', { x: 1.15, y: 1.25, z: d / 2 + 0.06, jitter: 0 })
  // big red mailbox on legs, with a slot, and a stack of taped parcels
  p.add(cyl(0.45, 0.45, 1.1, 18), '#e94b3c', { x: 2.6, y: 0.95, z: d / 2 + 1.5, rough: 0.4, ...ROUND })
  p.add(sphere(0.45, 18, 8, 0, Math.PI / 2), '#e94b3c', { x: 2.6, y: 1.5, z: d / 2 + 1.5, rough: 0.4, ...ROUND })
  p.add(torus(0.45, 0.03, 4, 18), '#c23a2e', { x: 2.6, y: 1.5, z: d / 2 + 1.5, rx: Math.PI / 2, rough: 0.4 })
  p.add(box(0.5, 0.08, 0.1), '#2b2b2b', { x: 2.6, y: 1.2, z: d / 2 + 1.94, jitter: 0 })
  p.add(box(0.56, 0.03, 0.12), '#c23a2e', { x: 2.6, y: 1.27, z: d / 2 + 1.95, jitter: 0 })
  p.add(box(0.3, 0.2, 0.02), '#ffffff', { x: 2.6, y: 0.85, z: d / 2 + 1.95, jitter: 0 })
  for (const s of [-1, 1]) p.add(box(0.1, 0.4, 0.5), '#2b2b2b', { x: 2.6 + s * 0.3, y: 0.2, z: d / 2 + 1.5, ...METAL, rough: 0.5 })
  for (let i = 0; i < 3; i++) {
    const pw = 0.7 - i * 0.12
    const pd = 0.6 - i * 0.1
    const py = 0.45 + i * 0.45
    const put = frame(p, -2.6, py, d / 2 + 1.0, i * 0.3)
    put(box(pw, 0.45, pd), '#c89a5a', 0, 0, 0, { jitter: 0.05 })
    put(box(pw + 0.01, 0.46, 0.08), '#e8d8a8', 0, 0, 0)
    put(box(0.08, 0.46, pd + 0.01), '#e8d8a8', 0, 0, 0)
    put(box(0.2, 0.12, 0.01), '#ffffff', pw * 0.2, 0.08, pd / 2 + 0.005, { jitter: 0 })
  }
  // envelope on the roof, with a stamp and a red seal
  p.add(box(1.5, 1.0, 0.12), '#ffffff', { y: H + 2.4, z: 0.2, rough: 0.7, jitter: 0 })
  p.add(prism(0.13, 0.5, 1.5), '#f0e2c8', { y: H + 2.4, z: 0.28, rx: Math.PI / 2, ry: Math.PI / 2 })
  p.add(box(0.26, 0.3, 0.02), '#5bc0eb', { x: 0.5, y: H + 2.68, z: 0.27, jitter: 0 })
  p.add(box(0.18, 0.2, 0.02), '#ffd23f', { x: 0.5, y: H + 2.68, z: 0.285, jitter: 0 })
  p.add(cyl(0.12, 0.12, 0.04, 12), '#c2272d', { y: H + 2.5, z: 0.36, rx: Math.PI / 2, rough: 0.4 })
  for (const s of [-1, 1]) p.add(box(0.06, 0.6, 0.06), IRON, { x: s * 0.55, y: H + 1.7, z: 0.15, ...METAL })
  p.aoBottom(1.0, 0.33)
  return p.build()
}

export function school() {
  const g = new THREE.Group()
  const p = new Parts()
  const w = 10
  const d = 6.5
  const H = 3.4
  const y0 = 0.2
  const wall = '#fff4d6'
  const trim = '#ffffff'
  plinth(p, w, d, 0.3, '#cfc6b3', 0.1)
  p.add(box(w, H, d), wall, { y: H / 2 + y0, jitter: 0.03 })
  // brick lower walls, siding above
  const brick = '#c46a4a'
  p.add(box(w + 0.05, 0.9, d + 0.05), brick, { y: y0 + 0.45, jitter: 0.08 })
  for (let y = y0 + 0.15; y < y0 + 0.9; y += 0.15) {
    for (const s of [1, -1]) {
      p.add(box(w + 0.07, 0.02, 0.02), '#e3d6c4', { y, z: s * (d / 2 + 0.025), jitter: 0 })
      p.add(box(0.02, 0.02, d + 0.07), '#e3d6c4', { x: s * (w / 2 + 0.025), y, jitter: 0 })
    }
  }
  p.add(box(w + 0.12, 0.08, d + 0.12), '#e6dccb', { y: y0 + 0.93, jitter: 0 })
  siding(p, w, d, y0 + 0.97, y0 + H - 0.2, wall)
  trims(p, w, d, y0, y0 + H, trim)
  p.add(prism(w, 2.0, d), wall, { y: H + y0, jitter: 0.03 })
  gableSiding(p, w, d, H + y0, 2.0, wall)
  roof(p, w, d, H + y0, 2.0, '#3b7dd8', 0.45, { trim })
  // double doors with glass, steps and a little porch roof
  for (const s of [-1, 1]) door(p, s * 0.55, y0, d / 2, 1.0, 2.2, '#8b5a2b', { trim, glass: true })
  p.add(box(2.6, 0.15, 0.9), '#cfc6b3', { y: 0.3, z: d / 2 + 0.55 })
  p.add(box(3.0, 0.15, 1.3), '#c4bba8', { y: 0.15, z: d / 2 + 0.7 })
  p.add(box(2.8, 0.1, 1.0), '#3b7dd8', { y: 2.75, z: d / 2 + 0.5, rx: 0.2, rough: 0.45 })
  for (const s of [-1, 1]) p.add(box(0.05, 0.05, 0.7), IRON, { x: s * 1.2, y: 2.55, z: d / 2 + 0.38, rx: -0.6, ...METAL })
  for (const x of [-3.6, -2.0, 2.0, 3.6]) windowAt(p, x, 2.0, d / 2 + 0.03, 0, 1.0, 1.0, { trim })
  for (const s of [-1, 1]) for (const z of [-1.4, 1.4]) windowAt(p, s * (w / 2 + 0.03), 2.0, z, (s * Math.PI) / 2, 1.0, 1.0, { trim })
  // clock on the front of the roof, with hour marks
  p.add(cyl(0.58, 0.58, 0.1, 24), '#3b4a5e', { y: H + 0.95, z: d / 2 + 0.02, rx: Math.PI / 2, rough: 0.4 })
  p.add(cyl(0.5, 0.5, 0.08, 24), '#ffffff', { y: H + 0.95, z: d / 2 + 0.06, rx: Math.PI / 2, rough: 0.3 })
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    p.add(box(0.03, i % 3 ? 0.06 : 0.1, 0.02), '#333333', { x: Math.sin(a) * 0.42, y: H + 0.95 + Math.cos(a) * 0.42, z: d / 2 + 0.105, rz: -a, jitter: 0 })
  }
  p.add(box(0.05, 0.36, 0.04), '#333333', { y: H + 1.08, z: d / 2 + 0.12, jitter: 0 })
  p.add(box(0.26, 0.05, 0.04), '#333333', { x: 0.1, y: H + 0.95, z: d / 2 + 0.12, jitter: 0 })
  // bell tower with louvers, a bell and a spire
  p.add(box(1.4, 1.4, 1.4), wall, { y: H + 2.6, z: -0.6, jitter: 0.03 })
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(box(0.14, 1.4, 0.14), trim, { x: sx * 0.7, y: H + 2.6, z: -0.6 + sz * 0.7, jitter: 0 })
  p.add(box(1.6, 0.14, 1.6), trim, { y: H + 3.32, z: -0.6, jitter: 0 })
  for (const s of [-1, 1]) {
    p.add(box(0.8, 0.8, 0.04), '#4a4a52', { y: H + 2.75, z: -0.6 + s * 0.71 })
    for (let i = 0; i < 5; i++) p.add(box(0.8, 0.03, 0.12), trim, { y: H + 2.45 + i * 0.15, z: -0.6 + s * 0.75, rx: s * 0.6, jitter: 0 })
  }
  p.add(cone(1.2, 1.4, 4), '#e94b3c', { y: H + 4.0, z: -0.6, ry: Math.PI / 4, rough: 0.5 })
  p.add(cyl(0.02, 0.02, 0.7, 4), IRON, { y: H + 4.9, z: -0.6, ...METAL })
  p.add(sphere(0.07, 8, 6), BRASS, { y: H + 5.1, z: -0.6, ...METAL, ...ROUND })
  p.add(sphere(0.32, 14, 8, 0, Math.PI / 1.6), '#f1c232', { y: H + 2.75, z: 0.12, ...METAL, rough: 0.3, ...ROUND })
  p.add(cyl(0.05, 0.05, 0.12, 6), IRON, { y: H + 3.08, z: 0.12, ...METAL })
  // flag pole
  p.add(cyl(0.06, 0.06, 5.5, 8), '#cccccc', { x: w / 2 + 1.4, y: 2.75, z: d / 2 + 0.8, ...METAL, rough: 0.25 })
  p.add(cyl(0.25, 0.3, 0.2, 10), '#bdb6aa', { x: w / 2 + 1.4, y: 0.1, z: d / 2 + 0.8 })
  p.add(sphere(0.09, 8, 6), BRASS, { x: w / 2 + 1.4, y: 5.55, z: d / 2 + 0.8, ...METAL, ...ROUND })
  p.add(box(1.1, 0.7, 0.03), '#3b7dd8', { x: w / 2 + 1.95, y: 5.0, z: d / 2 + 0.8, rough: 0.75 })
  p.add(ico(0.12, 0), '#f1c232', { x: w / 2 + 1.95, y: 5.0, z: d / 2 + 0.83, jitter: 0 })
  // a swing with chains
  for (const s of [-1, 1]) {
    p.add(cyl(0.08, 0.08, 2.6, 8), '#e94b3c', { x: -w / 2 - 2 + s * 1.1, y: 1.3, z: d / 2 + 1.5, rough: 0.4, ...ROUND })
    p.add(cyl(0.06, 0.06, 2.75, 8), '#e94b3c', { x: -w / 2 - 2 + s * 1.1, y: 1.3, z: d / 2 + 1.5 + 0.45, rx: 0.33, rough: 0.4, ...ROUND })
    p.add(cyl(0.06, 0.06, 2.75, 8), '#e94b3c', { x: -w / 2 - 2 + s * 1.1, y: 1.3, z: d / 2 + 1.5 - 0.45, rx: -0.33, rough: 0.4, ...ROUND })
  }
  p.add(cyl(0.07, 0.07, 2.4, 8), '#e94b3c', { x: -w / 2 - 2, y: 2.6, z: d / 2 + 1.5, rz: Math.PI / 2, rough: 0.4, ...ROUND })
  for (const s of [-1, 1]) p.add(cyl(0.012, 0.012, 1.8, 4), '#9aa0a8', { x: -w / 2 - 2 + s * 0.3, y: 1.7, z: d / 2 + 1.5, ...METAL })
  p.add(box(0.8, 0.06, 0.35), '#ffd23f', { x: -w / 2 - 2, y: 0.8, z: d / 2 + 1.5, rough: 0.45 })
  p.aoBottom(1.0, 0.3)
  g.add(p.build())
  return g
}

export function iceCreamStand() {
  const p = new Parts()
  const w = 4.5
  const d = 3.6
  // the counter with pink and white stripes
  p.add(box(w, 1.1, 0.4), '#ffffff', { y: 0.55, z: d / 2 - 0.2 })
  for (let i = 0; i < 6; i++) p.add(box(w / 6 - 0.04, 1.0, 0.05), i % 2 ? '#ff8fb1' : '#ffffff', { x: -w / 2 + w / 12 + (i * w) / 6, y: 0.55, z: d / 2 + 0.02, jitter: 0, rough: 0.45 })
  p.add(box(w + 0.06, 0.1, 0.1), '#ff6f9a', { y: 0.06, z: d / 2 + 0.02, jitter: 0 })
  p.add(box(w + 0.1, 0.12, 0.6), '#9be7ff', { y: 1.16, z: d / 2 - 0.15, rough: 0.3 })
  // a glass display case over the tubs
  p.add(box(w - 0.6, 0.04, 0.5), '#d6f3ff', { y: 1.62, z: d / 2 - 0.2, ...GLASS })
  p.add(box(w - 0.6, 0.38, 0.03), '#d6f3ff', { y: 1.42, z: d / 2 + 0.05, rx: 0.3, ...GLASS })
  for (const s of [-1, 1]) p.add(box(0.04, 0.42, 0.5), '#c9ccd2', { x: s * (w / 2 - 0.3), y: 1.42, z: d / 2 - 0.2, ...METAL })
  // back and side walls, with a little round window in each side
  p.add(box(w, 2.6, 0.2), '#ffffff', { y: 1.3, z: -d / 2 + 0.1 })
  for (const s of [-1, 1]) {
    p.add(box(0.2, 2.6, d), '#ffffff', { x: (s * (w - 0.2)) / 2, y: 1.3 })
    p.add(box(0.06, 1.0, d + 0.02), '#ff8fb1', { x: s * (w / 2 + 0.01), y: 0.55, rough: 0.45 })
    p.add(cyl(0.32, 0.32, 0.06, 18), '#ff8fb1', { x: s * (w / 2 + 0.02), y: 1.8, z: -0.3, rz: Math.PI / 2 })
    p.add(cyl(0.25, 0.25, 0.08, 18), '#cfeeff', { x: s * (w / 2 + 0.02), y: 1.8, z: -0.3, rz: Math.PI / 2, ...GLASS })
  }
  // ice cream tubs in the counter, with scoops
  const flav = ['#ff8fb1', '#7a4a2a', '#fff6dc', '#b6ef8a', '#ffe066']
  for (let i = 0; i < 5; i++) {
    p.add(cyl(0.22, 0.2, 0.1, 14), '#e8edf2', { x: -1.6 + i * 0.8, y: 1.24, z: d / 2 - 0.15, ...METAL, rough: 0.25 })
    p.add(sphere(0.18, 14, 10), flav[i], { x: -1.6 + i * 0.8, y: 1.3, z: d / 2 - 0.15, sy: 0.6, jitter: 0.04, rough: 0.6, ...ROUND })
  }
  // cones in a stand and a scoop
  for (let i = 0; i < 4; i++) p.add(cone(0.07, 0.25, 8), '#e8b26a', { x: 1.7 + (i % 2) * 0.14, y: 1.36, z: d / 2 - 0.45 + Math.floor(i / 2) * 0.14, rx: Math.PI })
  // striped canopy with scallops
  for (let i = 0; i < 8; i++) {
    const x = -w / 2 + w / 16 + (i * w) / 8
    const c = i % 2 ? '#ffffff' : '#ff8fb1'
    p.add(box(w / 8 + 0.02, 0.06, 2.0), c, { x, y: 2.75, z: d / 2 - 0.2, rx: 0.22, jitter: 0, rough: 0.75 })
    p.add(halfDisc(w / 16), c, { x, y: 2.75 - Math.sin(0.22) * 1.0 - 0.02, z: d / 2 - 0.2 + Math.cos(0.22) * 1.0 + 0.02, rx: Math.PI / 2, sz: 0.6, jitter: 0, rough: 0.75 })
  }
  p.add(box(w + 0.2, 0.25, d + 0.2), '#ff8fb1', { y: 2.7, z: -0.3, rough: 0.5 })
  p.add(box(w + 0.26, 0.06, d + 0.26), '#ffffff', { y: 2.84, z: -0.3, jitter: 0 })
  // giant cone on top: a waffle cone and three smooth scoops with a cherry
  p.add(cone(0.55, 1.5, 16), '#e8b26a', { y: 3.55, rx: Math.PI, rough: 0.7, ...ROUND })
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    for (const k of [-1, 1]) p.add(box(0.03, 1.45, 0.03), '#c98d45', { x: Math.cos(a) * 0.28, y: 3.55, z: Math.sin(a) * 0.28, ry: -a, rz: k * 0.35, rx: 0.18, order: 'YXZ', jitter: 0 })
  }
  p.add(torus(0.55, 0.07, 6, 18), '#e8b26a', { y: 4.28, rx: Math.PI / 2, rough: 0.7, ...ROUND })
  p.add(sphere(0.62, 20, 14), '#ff8fb1', { y: 4.45, rough: 0.55, jitter: 0.03, ...ROUND })
  p.add(torus(0.58, 0.09, 6, 18), '#ff8fb1', { y: 4.2, rx: Math.PI / 2, rough: 0.55, ...ROUND })
  p.add(sphere(0.52, 20, 14), '#fff6dc', { y: 5.05, rough: 0.55, jitter: 0.03, ...ROUND })
  p.add(sphere(0.4, 18, 12), '#7a4a2a', { y: 5.55, rough: 0.5, jitter: 0.03, ...ROUND })
  const r = rng(77)
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2
    const t = 0.3 + r() * 0.9
    const rr = 0.4 * Math.sin(t) + 0.01
    p.add(box(0.03, 0.08, 0.03), ['#ff5d5d', '#ffd23f', '#5bc0eb', '#7bd389'][i % 4], { x: Math.cos(a) * rr, y: 5.55 + Math.cos(t) * 0.4, z: Math.sin(a) * rr, rx: r() * 3, rz: r() * 3, jitter: 0 })
  }
  p.add(sphere(0.12, 12, 10), '#e94b3c', { y: 5.95, rough: 0.2, ...ROUND })
  p.add(cyl(0.012, 0.012, 0.2, 4), '#5a3a1a', { x: 0.04, y: 6.12, rz: -0.3 })
  p.aoBottom(0.6, 0.3)
  return p.build()
}

// ---------- the castle ----------

const STONE = '#ebe4d4'
const STONE2 = '#ddd4c1'
const ROYAL = '#3f63c9'
const GOLD = '#f1c232'

export function castle() {
  const g = new THREE.Group()
  const p = new Parts()
  const h = 10 // half size
  const W = 5.2 // wall height
  const T = 1.2 // wall thickness
  const r = rng(7)
  const st = (k = 1) => shade(STONE, k * (0.9 + r() * 0.16))

  // Raised ashlar blocks on a wall face. The face is centred at (cx, cz) and looks along ry.
  const ashlar = (cx, cz, ry, len, y0, y1) => {
    const put = frame(p, cx, 0, cz, ry)
    const ch = 0.55
    for (let k = 0, y = y0; y < y1 - 0.15; k++, y += ch) {
      const hh = Math.min(ch, y1 - y)
      let x = -len / 2
      let first = true
      while (x < len / 2 - 0.1) {
        const bl = first && k % 2 ? 0.6 : 0.9 + r() * 0.6
        first = false
        const xe = Math.min(len / 2, x + bl)
        put(box(xe - x - 0.06, hh - 0.06, 0.08), st(), (x + xe) / 2, y + hh / 2, 0.01, { jitter: 0.04 })
        x = xe
      }
    }
  }
  // Grooved courses on a plain face (inside faces, seen from above).
  const courses = (cx, cz, ry, len, y0, y1) => {
    const put = frame(p, cx, 0, cz, ry)
    for (let y = y0 + 0.55; y < y1 - 0.1; y += 0.55) put(box(len, 0.03, 0.03), shade(STONE, 0.82), 0, y, 0, { jitter: 0 })
  }
  // Merlons along the outer edge of a wall top.
  const merlons = (x0, z0, x1, z1, y, out) => {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.floor(len / 1.4)
    const ry = Math.atan2(x1 - x0, z1 - z0)
    const ox = -Math.cos(ry) * out
    const oz = Math.sin(ry) * out
    for (let i = 0; i <= n; i++) {
      const t = i / n
      p.add(box(0.5, 0.8, 0.85), st(0.97), { x: x0 + (x1 - x0) * t + ox, y: y + 0.4, z: z0 + (z1 - z0) * t + oz, ry, jitter: 0.05 })
      p.add(box(0.56, 0.06, 0.9), st(0.9), { x: x0 + (x1 - x0) * t + ox, y: y + 0.83, z: z0 + (z1 - z0) * t + oz, ry, jitter: 0 })
    }
  }

  // walls (the front one has the gate opening)
  p.add(box(2 * h, W, T), STONE, { y: W / 2, z: -h, jitter: 0.04 })
  for (const s of [-1, 1]) p.add(box(T, W, 2 * h), STONE, { x: s * h, y: W / 2, jitter: 0.04 })
  for (const s of [-1, 1]) p.add(box(h - 2, W, T), STONE, { x: s * (h / 2 + 1), y: W / 2, z: h, jitter: 0.04 })
  p.add(box(4.4, 1.6, T + 0.2), STONE, { y: W - 0.8, z: h })
  // the outside faces get real blocks, the inside faces grooved courses
  ashlar(0, -h - T / 2, Math.PI, 15, 0.6, W)
  for (const s of [-1, 1]) ashlar(s * (h + T / 2), 0, (s * Math.PI) / 2, 15, 0.6, W)
  for (const s of [-1, 1]) ashlar(s * 6.1, h + T / 2, 0, 2.8, 0.6, W)
  courses(0, -h + T / 2 + 0.005, 0, 2 * h - 2 * T, 0, W)
  for (const s of [-1, 1]) courses(s * (h - T / 2 - 0.005), 0, (-s * Math.PI) / 2, 2 * h - 2 * T, 0, W)
  for (const s of [-1, 1]) courses(s * (h / 2 + 1), h - T / 2 - 0.005, Math.PI, h - 2, 0, W)
  // a sloped plinth at the foot of the walls and a string course under the top
  p.add(box(2 * h + 0.4, 0.6, T + 0.4), shade(STONE2, 0.92), { y: 0.3, z: -h, jitter: 0.05 })
  for (const s of [-1, 1]) {
    p.add(box(T + 0.4, 0.6, 2 * h + 0.4), shade(STONE2, 0.92), { x: s * h, y: 0.3, jitter: 0.05 })
    p.add(box(h - 2, 0.6, T + 0.4), shade(STONE2, 0.92), { x: s * (h / 2 + 1), y: 0.3, z: h, jitter: 0.05 })
  }
  p.add(box(2 * h, 0.18, 0.16), STONE2, { y: W - 0.3, z: -h - T / 2 - 0.05, jitter: 0 })
  for (const s of [-1, 1]) {
    p.add(box(0.16, 0.18, 2 * h), STONE2, { x: s * (h + T / 2 + 0.05), y: W - 0.3, jitter: 0 })
    p.add(box(h - 2, 0.18, 0.16), STONE2, { x: s * (h / 2 + 1), y: W - 0.3, z: h + T / 2 + 0.05, jitter: 0 })
  }
  // the battlements sit on the outer edge, so the knights can walk along the inner half
  merlons(-h + 1.8, -h, h - 1.8, -h, W, -0.35)
  merlons(-h + 1.8, h, -2.4, h, W, 0.35)
  merlons(2.4, h, h - 1.8, h, W, 0.35)
  for (const s of [-1, 1]) merlons(s * h, -h + 1.8, s * h, h - 1.8, W, s * -0.35)
  // arrow slits on the outer walls
  for (const z of [-5, 0, 5])
    for (const s of [-1, 1]) {
      p.add(box(0.06, 0.9, 0.16), '#2a2730', { x: s * (h + T / 2 + 0.02), y: 3.0, z, jitter: 0 })
      p.add(box(0.06, 0.16, 0.42), '#2a2730', { x: s * (h + T / 2 + 0.02), y: 3.0, z, jitter: 0 })
    }
  for (const x of [-5, 0, 5]) p.add(box(0.16, 0.9, 0.06), '#2a2730', { x, y: 3.0, z: -h - T / 2 - 0.02, jitter: 0 })
  p.add(box(2 * h + 0.3, 0.5, 2 * h + 0.3), '#cfc6b3', { y: 0.2 })
  // a cobbled yard
  for (let i = 0; i < 40; i++) p.add(box(0.8 + r() * 0.6, 0.04, 0.6 + r() * 0.5), shade('#cfc6b3', 0.85 + r() * 0.2), { x: (r() - 0.5) * 16, y: 0.46, z: 2 + (r() - 0.5) * 9, ry: r() * 0.3, jitter: 0.05 })
  // ivy climbing the walls
  for (const [x, z, s] of [
    [-h - T / 2, 4, -1],
    [h + T / 2, -3, 1],
    [-6.5, h + T / 2, 0],
  ])
    for (let i = 0; i < 6; i++) {
      const lx = s === 0 ? x + (r() - 0.5) * 2 : x + s * 0.05
      const lz = s === 0 ? z + 0.05 : z + (r() - 0.5) * 2
      p.add(ico(0.35 + r() * 0.2, 1), r() < 0.5 ? '#4f8f3a' : '#5ea24a', { x: lx, y: 0.6 + i * 0.5 + r() * 0.3, z: lz, sx: s === 0 ? 1 : 0.25, sz: s === 0 ? 0.25 : 1, jitter: 0.1 })
    }

  // the gate: plank doors with iron bands and studs under a stone arch, and a raised portcullis
  p.add(box(3.4, 3.3, 0.3), '#7a4e27', { y: 1.65, z: h + 0.05 })
  for (let i = 0; i < 9; i++) p.add(box(0.36, 3.25, 0.05), shade('#7a4e27', 0.88 + (i % 3) * 0.08), { x: -1.6 + i * 0.4, y: 1.65, z: h + 0.22, jitter: 0.05 })
  p.add(box(0.08, 3.3, 0.34), '#5a3a1a', { y: 1.65, z: h + 0.08, jitter: 0 })
  for (const y of [0.6, 1.65, 2.7]) {
    p.add(box(3.4, 0.12, 0.06), IRON, { y, z: h + 0.27, ...METAL })
    for (let i = 0; i < 8; i++) p.add(sphere(0.04, 6, 4), IRON, { x: -1.5 + i * 0.43, y, z: h + 0.31, ...METAL })
  }
  for (const s of [-1, 1]) p.add(torus(0.13, 0.025, 4, 10), BRASS, { x: s * 0.3, y: 1.5, z: h + 0.32, ...METAL })
  // the portcullis, pulled up into the wall: only its spiky bottom shows
  for (let i = 0; i < 8; i++) p.add(box(0.07, 0.9, 0.07), IRON, { x: -1.75 + i * 0.5, y: 3.25, z: h + 0.5, ...METAL })
  for (const y of [2.95, 3.4]) p.add(box(3.9, 0.07, 0.07), IRON, { y, z: h + 0.5, ...METAL })
  for (let i = 0; i < 8; i++) p.add(cone(0.06, 0.18, 4), IRON, { x: -1.75 + i * 0.5, y: 2.72, z: h + 0.5, rx: Math.PI, ...METAL })
  // the arch: voussoir stones and a golden keystone
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI
    p.add(box(0.38, 0.55, 0.5), st(0.95), { x: Math.cos(a) * 1.95, y: 3.3 + Math.sin(a) * 1.95, z: h + 0.5, rz: a - Math.PI / 2, jitter: 0.05 })
  }
  p.add(sphere(0.3, 14, 10), GOLD, { y: 4.4, z: h + 0.78, sz: 0.5, ...GOLDEN, ...ROUND })
  // torch stands in front of the gate
  for (const s of [-1, 1]) {
    p.add(cyl(0.04, 0.05, 1.8, 6), IRON, { x: s * 2.3, y: 0.9, z: h + 2.4, ...METAL })
    p.add(cyl(0.16, 0.18, 0.06, 8), IRON, { x: s * 2.3, y: 0.03, z: h + 2.4, ...METAL })
    p.add(cyl(0.14, 0.06, 0.25, 8), IRON, { x: s * 2.3, y: 1.9, z: h + 2.4, ...METAL })
    p.add(cone(0.11, 0.36, 8), '#ffb347', { x: s * 2.3, y: 2.2, z: h + 2.4, mat: GLOW, jitter: 0 })
  }

  // A round tower: battered foot, stone rings, corbels under a crenellated crown, a cone roof with
  // tile bands, and a flag pole.
  const tower = (x, z, rad, hgt, roofR, roofH) => {
    p.add(cyl(rad, rad + 0.2, hgt, 20), STONE, { x, y: hgt / 2, z, jitter: 0.03, ...ROUND })
    p.add(cyl(rad + 0.25, rad + 0.45, 1.0, 20), shade(STONE2, 0.92), { x, y: 0.5, z, jitter: 0.04 })
    for (let y = 1.4; y < hgt - 0.4; y += 0.6) p.add(cyl(rad + 0.2 * (1 - y / hgt) + 0.02, rad + 0.2 * (1 - y / hgt) + 0.02, 0.05, 20, true), shade(STONE, 0.84), { x, y, z, jitter: 0 })
    const n = Math.round(rad * 5)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      p.add(box(0.3, 0.4, 0.4), STONE2, { x: x + Math.cos(a) * (rad + 0.12), y: hgt - 0.2, z: z + Math.sin(a) * (rad + 0.12), ry: -a + Math.PI / 2 })
    }
    p.add(cyl(rad + 0.4, rad + 0.3, 0.7, 20), STONE2, { x, y: hgt + 0.1, z })
    const m = Math.round(rad * 4.3)
    for (let i = 0; i < m; i++) {
      const a = (i / m) * Math.PI * 2
      p.add(box(0.5, 0.6, 0.45), st(0.97), { x: x + Math.cos(a) * (rad + 0.15), y: hgt + 0.75, z: z + Math.sin(a) * (rad + 0.15), ry: -a + Math.PI / 2, jitter: 0.04 })
    }
    p.add(cone(roofR, roofH, 20), ROYAL, { x, y: hgt + 0.5 + roofH / 2, z, rough: 0.5, ...ROUND })
    for (let k = 1; k < 5; k++) {
      const t0 = k / 5
      const rr = roofR * (1 - t0) + 0.03
      p.add(cyl(rr, rr + 0.06, 0.08, 20, true), shade(ROYAL, 0.8), { x, y: hgt + 0.5 + roofH * t0, z, jitter: 0 })
    }
    p.add(sphere(0.2, 12, 10), GOLD, { x, y: hgt + 0.55 + roofH, z, ...GOLDEN, ...ROUND })
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i - 1) * 1.2
      const ry = Math.atan2(Math.cos(a), Math.sin(a))
      p.add(box(0.12, 0.8, 0.06), '#2a2730', { x: x + Math.cos(a) * (rad + 0.1), y: hgt * 0.35, z: z + Math.sin(a) * (rad + 0.1), ry, jitter: 0 })
    }
  }

  // gate towers
  for (const s of [-1, 1]) {
    tower(s * 3.1, h + 0.4, 1.45, 7, 1.85, 2.4)
    archWindow(p, s * 3.1, 4.8, h + 1.9, 0, 0.45, 0.8, STONE2)
  }
  // corner towers
  const flags = []
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * h
      const z = sz * h
      tower(x, z, 2.3, 8.5, 2.8, 3.8)
      p.add(cyl(0.05, 0.05, 2.0, 6), '#888888', { x, y: 13.6, z, ...METAL })
      for (const y of [3.5, 6.0]) archWindow(p, x, y, z + 2.38, 0, 0.45, 0.8, STONE2)
      const fp = new Parts()
      fp.add(prism(0.04, 1.3, 0.7), sx === sz ? '#e94b3c' : GOLD, { x: 0.65, y: 0, z: 0, rz: -Math.PI / 2, jitter: 0, rough: 0.8 })
      const flag = fp.build({ shadow: false })
      flag.position.set(x, 14.2, z)
      flags.push(flag)
      g.add(flag)
    }
  // the keep
  const kz = -2
  p.add(box(9, 8.5, 7.5), STONE, { y: 4.25, z: kz, jitter: 0.03 })
  ashlar(0, kz + 3.75, 0, 9, 0.5, 8.4)
  for (const s of [-1, 1]) ashlar(s * 4.5, kz, (s * Math.PI) / 2, 7.5, 5.2, 8.4)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(box(0.6, 8.5, 0.6), STONE2, { x: sx * 4.45, y: 4.25, z: kz + sz * 3.7, jitter: 0.04 })
  p.add(box(9.4, 0.5, 7.9), STONE2, { y: 8.6, z: kz })
  for (let i = 0; i < 22; i++) p.add(box(0.22, 0.25, 0.3), STONE2, { x: -4.4 + i * 0.42, y: 8.25, z: kz + 3.85 })
  p.add(cone(6.6, 4.6, 4), ROYAL, { y: 11.1, z: kz, ry: Math.PI / 4, sz: 0.85, rough: 0.5 })
  for (let k = 1; k < 7; k++) {
    const t0 = k / 7
    const rr = 6.6 * (1 - t0) + 0.04
    p.add(cyl(rr, rr + 0.1, 0.1, 4, true), shade(ROYAL, 0.8), { y: 8.8 + 4.6 * t0, z: kz, ry: Math.PI / 4, sz: 0.85, jitter: 0 })
  }
  // little dormer windows on the keep roof
  for (const s of [-1, 1]) {
    p.add(box(0.9, 0.9, 1.0), STONE, { x: s * 2.0, y: 9.5, z: kz + 3.0 })
    p.add(prism(1.0, 0.5, 1.1), ROYAL, { x: s * 2.0, y: 9.95, z: kz + 3.0, ry: Math.PI / 2, rough: 0.5 })
    p.add(box(0.45, 0.5, 0.04), '#41506e', { x: s * 2.0, y: 9.5, z: kz + 3.52, ...GLASS })
  }
  p.add(cyl(0.06, 0.06, 2.2, 6), '#888888', { y: 14.4, z: kz, ...METAL })
  p.add(sphere(0.12, 8, 6), GOLD, { y: 15.5, z: kz, ...GOLDEN, ...ROUND })
  const kflag = new Parts()
  kflag.add(prism(0.04, 1.6, 0.9), GOLD, { x: 0.8, rz: -Math.PI / 2, jitter: 0, rough: 0.8 })
  const kf = kflag.build({ shadow: false })
  kf.position.set(0, 15.0, kz)
  flags.push(kf)
  g.add(kf)
  for (const x of [-3, 3]) for (const y of [3.0, 6.4]) archWindow(p, x, y, kz + 3.8, 0, 0.7, 1.1, STONE2)
  for (const s of [-1, 1]) for (const z of [-1, 1]) archWindow(p, s * 4.55, 6.6, kz + z * 1.8, (s * Math.PI) / 2, 0.6, 1.0, STONE2)
  // balcony where the King comes out, with balusters
  const by = 5.6
  p.add(box(3.4, 0.3, 1.6), STONE2, { y: by, z: kz + 4.5 })
  for (let i = 0; i < 5; i++) p.add(box(0.25, 0.3, 0.6), STONE2, { x: -1.4 + i * 0.7, y: by - 0.3, z: kz + 4.0 })
  p.add(box(3.5, 0.12, 0.25), STONE2, { y: by + 0.85, z: kz + 5.25 })
  for (let i = 0; i < 9; i++) p.add(cyl(0.07, 0.09, 0.6, 8), STONE, { x: -1.5 + i * 0.375, y: by + 0.47, z: kz + 5.25, ...ROUND })
  for (const s of [-1, 1]) {
    p.add(box(0.15, 0.12, 1.6), STONE2, { x: s * 1.65, y: by + 0.85, z: kz + 4.5 })
    for (let i = 0; i < 3; i++) p.add(cyl(0.07, 0.09, 0.6, 8), STONE, { x: s * 1.65, y: by + 0.47, z: kz + 4.0 + i * 0.45, ...ROUND })
  }
  p.add(box(1.4, 2.2, 0.15), '#7a4e27', { y: by + 1.25, z: kz + 3.78 })
  for (let i = 0; i < 4; i++) p.add(box(0.3, 2.1, 0.04), shade('#7a4e27', 0.9 + (i % 2) * 0.1), { x: -0.5 + i * 0.33, y: by + 1.25, z: kz + 3.86 })
  p.add(torus(0.7, 0.12, 5, 12, Math.PI), STONE2, { y: by + 2.35, z: kz + 3.82 })
  // royal banners with a golden crown
  const crown = (x, y, z, s) => {
    p.add(box(0.5 * s, 0.18 * s, 0.04), GOLD, { x, y, z, ...GOLDEN })
    for (const k of [-1, 0, 1]) p.add(cone(0.08 * s, 0.22 * s, 4), GOLD, { x: x + k * 0.18 * s, y: y + 0.19 * s, z, ...GOLDEN })
  }
  for (const s of [-1, 1]) {
    p.add(box(1.1, 3.0, 0.08), ROYAL, { x: s * 3.0, y: 4.6, z: kz + 3.82, rough: 0.8 })
    p.add(prism(0.08, 0.5, 1.1), ROYAL, { x: s * 3.0, y: 3.1, z: kz + 3.82, rx: Math.PI, ry: Math.PI / 2, rough: 0.8 })
    p.add(box(1.2, 0.08, 0.12), GOLD, { x: s * 3.0, y: 6.12, z: kz + 3.85, ...GOLDEN })
    for (const k of [-1, 1]) p.add(box(0.05, 2.9, 0.1), GOLD, { x: s * 3.0 + k * 0.5, y: 4.62, z: kz + 3.84, ...GOLDEN })
    crown(s * 3.0, 5.2, kz + 3.88, 1)
  }
  // banner on each outer wall
  for (const s of [-1, 1]) {
    p.add(box(1.0, 2.2, 0.08), ROYAL, { x: s * (h / 2 + 1), y: 3.2, z: h + 0.65, rough: 0.8 })
    p.add(prism(0.08, 0.4, 1.0), ROYAL, { x: s * (h / 2 + 1), y: 2.1, z: h + 0.65, rx: Math.PI, ry: Math.PI / 2, rough: 0.8 })
    p.add(box(1.1, 0.08, 0.12), GOLD, { x: s * (h / 2 + 1), y: 4.32, z: h + 0.67, ...GOLDEN })
    crown(s * (h / 2 + 1), 3.5, h + 0.71, 0.9)
  }
  p.aoBottom(1.5, 0.3)
  g.add(p.build())
  g.userData = { balcony: new THREE.Vector3(0, by + 0.15, kz + 4.6), flags }
  return g
}

// ---------- the spooky graveyard ----------

export function gravestone(type = 0) {
  const p = new Parts()
  const c = '#a19eae'
  const dark = '#5e5b6b'
  const r = rng(type * 11 + 3)
  if (type === 0) {
    p.add(box(0.9, 1.0, 0.25), c, { y: 0.55, jitter: 0.1 })
    p.add(cyl(0.45, 0.45, 0.25, 16), c, { y: 1.05, rx: Math.PI / 2, jitter: 0.1 })
    // a chipped corner and engraved lines
    p.add(box(0.2, 0.14, 0.27), shade(c, 0.8), { x: 0.36, y: 1.18, rz: 0.5 })
    for (let i = 0; i < 3; i++) p.add(box(0.5 - i * 0.1, 0.04, 0.02), dark, { y: 0.95 - i * 0.16, z: 0.13, jitter: 0 })
    p.add(box(0.06, 0.24, 0.02), dark, { y: 1.18, z: 0.13, jitter: 0 })
    p.add(box(0.18, 0.06, 0.02), dark, { y: 1.22, z: 0.13, jitter: 0 })
  } else if (type === 1) {
    p.add(box(0.22, 1.5, 0.22), c, { y: 0.8, jitter: 0.1 })
    p.add(box(0.8, 0.22, 0.22), c, { y: 1.15, jitter: 0.1 })
    p.add(torus(0.22, 0.04, 4, 12), c, { y: 1.15, z: 0.0 })
    p.add(box(0.3, 0.2, 0.3), shade(c, 0.9), { y: 0.1 })
  } else {
    p.add(box(1.0, 1.2, 0.3), c, { y: 0.6, jitter: 0.1 })
    p.add(box(1.1, 0.15, 0.36), '#8f8c9c', { y: 1.25 })
    p.add(prism(1.1, 0.25, 0.36), '#8f8c9c', { y: 1.32 })
    for (let i = 0; i < 3; i++) p.add(box(0.6 - i * 0.12, 0.04, 0.02), dark, { y: 0.95 - i * 0.18, z: 0.16, jitter: 0 })
    p.add(box(0.25, 0.3, 0.32), shade(c, 0.85), { x: -0.45, y: 0.15, rz: 0.3 })
  }
  p.add(box(1.2, 0.18, 0.5), '#8f8c9c', { y: 0.09, jitter: 0.08 })
  // moss and lichen
  for (let i = 0; i < 4; i++) p.add(ico(0.1 + r() * 0.06, 0), r() < 0.5 ? '#6f8f5a' : '#7f9a5c', { x: (r() - 0.5) * 0.7, y: 0.2 + r() * 0.8, z: 0.13 + (type === 2 ? 0.03 : 0), sz: 0.35 })
  // the dirt mound with a few grass tufts
  p.add(sphere(0.55, 14, 5, 0, Math.PI / 2), '#5b4a3c', { z: 0.9, sx: 0.9, sy: 0.3, sz: 1.4, jitter: 0.1, ...ROUND })
  for (let i = 0; i < 5; i++) p.add(cone(0.04, 0.22, 3), '#56704a', { x: (r() - 0.5) * 0.9, y: 0.1, z: 0.5 + r() * 0.9, rz: (r() - 0.5) * 0.6 })
  p.aoBottom(0.4, 0.3)
  return p.build()
}

export function graveyardFence(r, rot) {
  const g = new THREE.Group()
  const p = new Parts()
  const iron = '#3b3546'
  const n = 96
  const gateA = rot
  const gap = 0.2
  const ang = (a) => Math.atan2(Math.sin(a - gateA), Math.cos(a - gateA))
  const IR = { metal: 0.7, rough: 0.5, jitter: 0 }
  const pt = (a) => [Math.sin(a) * r, Math.cos(a) * r]
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    if (Math.abs(ang(a)) < gap) continue
    const [x, z] = pt(a)
    if (i % 8 === 0) {
      // a stout post with a ball on top
      p.add(box(0.14, 1.75, 0.14), iron, { x, y: 0.88, z, ry: a, ...IR })
      p.add(sphere(0.09, 8, 6), iron, { x, y: 1.83, z, ...IR })
    } else {
      p.add(box(0.06, 1.6, 0.06), iron, { x, y: 0.8, z, ry: a, ...IR })
      p.add(cone(0.075, 0.22, 4), iron, { x, y: 1.7, z, ry: a, ...IR })
    }
  }
  // rails between every few posts (long straight runs)
  for (let i = 0; i < n; i += 3) {
    const a = (i / n) * Math.PI * 2
    const a2 = ((i + 3) / n) * Math.PI * 2
    if (Math.abs(ang(a)) < gap || Math.abs(ang(a2)) < gap || Math.abs(ang((a + a2) / 2)) < gap) continue
    const [x1, z1] = pt(a)
    const [x2, z2] = pt(a2)
    const len = Math.hypot(x2 - x1, z2 - z1)
    const ry = Math.atan2(x2 - x1, z2 - z1)
    for (const y of [0.45, 1.3]) p.add(box(0.05, 0.06, len), iron, { x: (x1 + x2) / 2, y, z: (z1 + z2) / 2, ry, ...IR })
    // a little curl between the rails
    p.add(torus(0.12, 0.018, 3, 8), iron, { x: (x1 + x2) / 2, y: 1.48, z: (z1 + z2) / 2, ry: ry + Math.PI / 2, ...IR })
  }
  // gate pillars of stone blocks with caps and lanterns, and an iron arch with the sign
  const gx = Math.sin(gateA) * r
  const gz = Math.cos(gateA) * r
  const cx = Math.cos(gateA)
  const sx = -Math.sin(gateA)
  for (const s of [-1, 1]) {
    const x = gx + cx * s * 2.6
    const z = gz + sx * s * 2.6
    p.add(box(0.8, 2.6, 0.8), '#8f8c9c', { x, y: 1.3, z, ry: gateA, jitter: 0.08 })
    for (let k = 0; k < 5; k++) p.add(box(0.84, 0.04, 0.84), '#76737f', { x, y: 0.5 + k * 0.45, z, ry: gateA, jitter: 0 })
    p.add(box(1.0, 0.2, 1.0), '#7b7888', { x, y: 2.7, z, ry: gateA })
    p.add(box(0.7, 0.15, 0.7), '#7b7888', { x, y: 2.88, z, ry: gateA })
    p.add(cyl(0.16, 0.13, 0.35, 8), '#b8ff9a', { x, y: 3.13, z, mat: GLOW, jitter: 0 })
    p.add(cone(0.24, 0.22, 6), iron, { x, y: 3.42, z, ...IR })
    p.add(cyl(0.2, 0.2, 0.05, 6), iron, { x, y: 2.97, z, ...IR })
    // half-open gates
    const hx = x - cx * s * 0.42
    const hz = z - sx * s * 0.42
    for (let k = 0; k < 5; k++) {
      const off = 0.15 + k * 0.4
      const ga = gateA + s * 0.9
      p.add(box(0.05, 1.7, 0.05), iron, { x: hx - Math.cos(ga) * s * off, y: 0.95, z: hz + Math.sin(ga) * s * off, ...IR })
    }
  }
  p.add(torus(2.6, 0.08, 5, 24, Math.PI), iron, { x: gx, y: 2.6, z: gz, ry: gateA, ...IR })
  p.add(torus(2.35, 0.04, 4, 24, Math.PI), iron, { x: gx, y: 2.6, z: gz, ry: gateA, ...IR })
  g.add(p.build())
  const sign = shopSign('SPOOKY GRAVEYARD', 3.6, 0.6, '#4a2f6b', '#ffb347')
  sign.position.set(gx + Math.sin(gateA) * 0.05, 4.0, gz + Math.cos(gateA) * 0.05)
  sign.rotation.y = gateA
  g.add(sign)
  const back = sign.clone()
  back.rotation.y = gateA + Math.PI
  back.position.set(gx - Math.sin(gateA) * 0.05, 4.0, gz - Math.cos(gateA) * 0.05)
  g.add(back)
  return g
}

export function deadTree() {
  const p = new Parts()
  const c = '#4b3a3f'
  p.add(cyl(0.18, 0.32, 3.2, 10), c, { y: 1.6, rz: 0.08, jitter: 0.1, ...ROUND })
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7
    p.add(cyl(0.08, 0.16, 0.7, 6), c, { x: Math.cos(a) * 0.3, y: 0.15, z: Math.sin(a) * 0.3, rz: Math.cos(a) * 1.1, rx: -Math.sin(a) * 1.1, jitter: 0.1 })
  }
  p.add(cyl(0.1, 0.16, 1.8, 8), c, { x: 0.55, y: 3.3, rz: -0.7, jitter: 0.1 })
  p.add(cyl(0.08, 0.13, 1.6, 8), c, { x: -0.6, y: 3.0, rz: 0.8, ry: 0.5, jitter: 0.1 })
  p.add(cyl(0.06, 0.1, 1.2, 6), c, { x: 0.1, y: 3.9, rz: 0.25, jitter: 0.1 })
  p.add(cyl(0.05, 0.07, 0.8, 6), c, { x: 1.15, y: 3.95, rz: -1.2 })
  p.add(cyl(0.05, 0.07, 0.7, 6), c, { x: -1.15, y: 3.55, rz: 1.3 })
  p.add(cyl(0.03, 0.05, 0.5, 5), c, { x: 1.3, y: 4.35, rz: -0.3 })
  p.add(cyl(0.03, 0.05, 0.5, 5), c, { x: -1.0, y: 3.95, rz: 0.4 })
  p.add(cyl(0.03, 0.05, 0.45, 5), c, { x: 0.25, y: 4.6, rz: -0.6 })
  // a knot hole
  p.add(sphere(0.1, 8, 6), '#1e1719', { x: 0.05, y: 1.9, z: 0.24, sz: 0.4 })
  return p.build()
}

export function pumpkin(s = 1) {
  const p = new Parts()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    p.add(sphere(0.25 * s, 10, 8), i % 2 ? '#ff8a1f' : '#f77a12', { x: Math.cos(a) * 0.12 * s, y: 0.24 * s, z: Math.sin(a) * 0.12 * s, sy: 0.88, sx: 0.8, ry: -a, mat: SMOOTH, jitter: 0.03, rough: 0.5 })
  }
  p.add(cyl(0.04 * s, 0.06 * s, 0.22 * s, 6), '#5d7a2b', { y: 0.5 * s, rz: 0.2, jitter: 0.05 })
  p.add(torus(0.07 * s, 0.012 * s, 3, 8, Math.PI * 1.4), '#6f8f3a', { x: 0.06 * s, y: 0.55 * s, rx: 0.4 })
  return p.build()
}
export function pumpkinVine() {
  const p = new Parts()
  for (let i = 0; i < 5; i++) {
    const a = i * 1.7
    p.add(ico(0.22, 1), i % 2 ? '#4f8f3a' : '#5a9a42', { x: Math.cos(a) * 0.45, y: 0.05, z: Math.sin(a) * 0.45, sy: 0.18, sx: 1.3, ry: a, jitter: 0.08 })
    p.add(cyl(0.015, 0.015, 0.45, 4), '#5d7a2b', { x: Math.cos(a) * 0.22, y: 0.03, z: Math.sin(a) * 0.22, rz: Math.PI / 2, ry: -a })
  }
  p.add(torus(0.12, 0.012, 3, 8, Math.PI * 1.5), '#5d7a2b', { x: 0.5, y: 0.08, z: -0.2, rx: Math.PI / 2 })
  return p.build()
}

export function jackOLantern(s = 1) {
  const g = new THREE.Group()
  g.add(pumpkin(s * 1.2))
  const f = new Parts()
  const z = 0.36 * s
  for (const x of [-0.11, 0.11]) f.add(cone(0.07 * s, 0.1 * s, 3), '#ffd447', { x: x * s, y: 0.33 * s, z, rx: Math.PI / 2, mat: SHINE, jitter: 0 })
  f.add(cone(0.04 * s, 0.07 * s, 3), '#ffd447', { y: 0.26 * s, z, rx: Math.PI / 2, mat: SHINE, jitter: 0 })
  f.add(box(0.26 * s, 0.06 * s, 0.04), '#ffd447', { y: 0.18 * s, z, mat: SHINE, jitter: 0 })
  for (const x of [-0.07, 0.07]) f.add(box(0.05 * s, 0.04 * s, 0.04), '#ffd447', { x: x * s, y: 0.215 * s, z, mat: SHINE, jitter: 0 })
  g.add(f.build({ shadow: false }))
  return g
}

export function bat() {
  const g = new THREE.Group()
  const p = new Parts()
  p.add(sphere(0.15, 10, 8), '#2a2433', { sz: 1.3, ...ROUND })
  for (const s of [-1, 1]) {
    p.add(cone(0.05, 0.12, 4), '#2a2433', { x: s * 0.07, y: 0.14 })
    p.add(sphere(0.022, 6, 4), '#ffd447', { x: s * 0.05, y: 0.04, z: 0.17, mat: SHINE, jitter: 0 })
  }
  g.add(p.build({ shadow: false }))
  const wings = []
  for (const s of [-1, 1]) {
    const wp = new Parts()
    wp.add(prism(0.02, 0.45, 0.35), '#2a2433', { x: s * 0.05, rz: (-s * Math.PI) / 2, jitter: 0 })
    wp.add(prism(0.02, 0.25, 0.2), '#2a2433', { x: s * 0.3, z: -0.12, rz: (-s * Math.PI) / 2, jitter: 0 })
    const w = wp.build({ shadow: false })
    g.add(w)
    wings.push(w)
  }
  g.userData.wings = wings
  return g
}

// ---------- little islands ----------

export function mushroomMesh() {
  const p = new Parts(SMOOTH)
  p.add(cyl(0.085, 0.12, 0.32, 12), '#fff4e0', { y: 0.16, jitter: 0.03 })
  p.add(torus(0.1, 0.02, 4, 12), '#f3e6cc', { y: 0.24, rx: Math.PI / 2 })
  p.add(sphere(0.24, 18, 10, 0, Math.PI / 2), '#e94b3c', { y: 0.3, sy: 0.75, jitter: 0.03, rough: 0.4 })
  p.add(cyl(0.235, 0.09, 0.05, 18), '#f3e1c4', { y: 0.29 })
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    p.add(box(0.13, 0.02, 0.008), '#e6d2b0', { x: Math.cos(a) * 0.16, y: 0.29, z: Math.sin(a) * 0.16, ry: -a, jitter: 0 })
  }
  for (const [x, z, k] of [
    [0.08, 0.08, 1],
    [-0.1, 0.03, 0.8],
    [0.02, -0.12, 1.1],
    [0.12, -0.05, 0.7],
    [-0.06, -0.1, 0.8],
    [-0.15, 0.1, 0.6],
  ]) {
    const y = 0.3 + Math.sqrt(Math.max(0, 1 - (x * x + z * z) / 0.0576)) * 0.18
    p.add(sphere(0.035 * k, 8, 6), '#ffffff', { x, y, z, sy: 0.5, jitter: 0 })
  }
  return p.build()
}

export function treasureChest() {
  const g = new THREE.Group()
  const p = new Parts()
  const wood = '#9a6232'
  p.add(box(1.2, 0.6, 0.8), wood, { y: 0.3, jitter: 0.06 })
  for (let i = 0; i < 3; i++) for (const s of [1, -1]) p.add(box(1.14, 0.17, 0.02), shade(wood, 0.92 + (i % 2) * 0.12), { y: 0.1 + i * 0.2, z: s * 0.405, jitter: 0.05 })
  const band = GOLDEN
  for (const x of [-0.45, 0.45]) {
    p.add(box(0.1, 0.62, 0.82), '#f1c232', { x, y: 0.3, ...band })
    for (const y of [0.15, 0.45]) p.add(sphere(0.022, 6, 4), '#c99a1a', { x, y, z: 0.415, ...band })
  }
  for (const s of [-1, 1]) {
    p.add(box(0.1, 0.62, 0.1), '#f1c232', { x: s * 0.58, y: 0.3, z: 0.38, ...band })
    p.add(box(0.1, 0.62, 0.1), '#f1c232', { x: s * 0.58, y: 0.3, z: -0.38, ...band })
    p.add(torus(0.08, 0.018, 4, 8, Math.PI), IRON, { x: s * 0.61, y: 0.3, ry: Math.PI / 2, rz: Math.PI, ...METAL })
  }
  p.add(box(0.2, 0.22, 0.06), '#f1c232', { y: 0.5, z: 0.42, ...band })
  p.add(cyl(0.025, 0.025, 0.07, 8), '#2a2020', { y: 0.53, z: 0.44, rx: Math.PI / 2, jitter: 0 })
  p.add(box(0.02, 0.05, 0.07), '#2a2020', { y: 0.49, z: 0.44, jitter: 0 })
  p.aoBottom(0.3, 0.25)
  g.add(p.build())
  const lid = new THREE.Group()
  lid.position.set(0, 0.6, -0.4)
  const lp = new Parts()
  lp.add(cyl(0.4, 0.4, 1.2, 16, false), '#a86c38', { z: 0.4, rz: Math.PI / 2, jitter: 0.06, ...ROUND })
  for (let i = 0; i < 5; i++) {
    const a = (i / 4 - 0.5) * Math.PI * 0.95
    lp.add(box(1.16, 0.02, 0.22), shade('#a86c38', 0.9 + (i % 2) * 0.12), { y: Math.cos(a) * 0.405, z: 0.4 + Math.sin(a) * 0.405, rx: a, jitter: 0.05 })
  }
  for (const x of [-0.45, 0.45]) lp.add(cyl(0.41, 0.41, 0.1, 16), '#f1c232', { x, z: 0.4, rz: Math.PI / 2, ...GOLDEN, ...ROUND })
  lid.add(lp.build())
  g.add(lid)
  const gold = new Parts()
  for (let i = 0; i < 9; i++) gold.add(cyl(0.12, 0.12, 0.04, 10), '#f5c542', { x: -0.4 + i * 0.1, y: 0.62 + (i % 3) * 0.02, z: (i % 3) * 0.1 - 0.1, rx: 0.3 * (i % 2), mat: GLOW, ...GOLDEN })
  gold.add(sphere(0.07, 8, 6), '#e94b3c', { x: 0.25, y: 0.68, z: 0.05, mat: GLOW, rough: 0.05, metal: 0.3, jitter: 0 })
  const coins = gold.build({ shadow: false })
  g.add(coins)
  g.userData = { lid, coins }
  return g
}

export function gazebo() {
  const p = new Parts()
  const white = '#ffffff'
  // a hexagonal deck of boards on a base
  p.add(cyl(2.5, 2.6, 0.25, 6), '#f4ede0', { y: 0.12 })
  for (let i = 0; i < 9; i++) {
    const z = -2.0 + i * 0.5
    const half = Math.min(2.4, 2.55 - Math.abs(z) * 0.55)
    p.add(box(half * 2, 0.04, 0.46), shade('#e6d9c2', 0.94 + (i % 2) * 0.08), { y: 0.265, z, ry: 0, jitter: 0.04 })
  }
  p.add(cyl(2.62, 2.62, 0.06, 6), '#d9cdb6', { y: 0.29 })
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const x = Math.cos(a) * 2.2
    const z = Math.sin(a) * 2.2
    p.add(cyl(0.11, 0.12, 2.6, 10), white, { x, y: 1.3, z, ...ROUND })
    p.add(box(0.3, 0.12, 0.3), white, { x, y: 0.35, z, ry: -a })
    p.add(box(0.3, 0.12, 0.3), white, { x, y: 2.56, z, ry: -a })
    // railings with balusters between the posts (but not across the way in)
    const a2 = ((i + 1) / 6) * Math.PI * 2
    const mid = (a + a2) / 2
    if (Math.abs(Math.sin(mid) - 1) < 0.01 || Math.cos(mid) > 0.99) continue
    const x2 = Math.cos(a2) * 2.2
    const z2 = Math.sin(a2) * 2.2
    const len = Math.hypot(x2 - x, z2 - z)
    const ry = Math.atan2(x2 - x, z2 - z)
    p.add(box(0.08, 0.08, len), white, { x: (x + x2) / 2, y: 1.0, z: (z + z2) / 2, ry })
    p.add(box(0.06, 0.06, len), white, { x: (x + x2) / 2, y: 0.4, z: (z + z2) / 2, ry })
    for (let k = 1; k < 6; k++) p.add(box(0.04, 0.6, 0.04), white, { x: x + ((x2 - x) * k) / 6, y: 0.7, z: z + ((z2 - z) * k) / 6 })
    // a scalloped trim under the roof
    p.add(box(0.05, 0.25, len - 0.2), white, { x: (x + x2) / 2, y: 2.45, z: (z + z2) / 2, ry })
  }
  // the roof: a six-sided cone with tile bands, a ridge on each corner and a finial
  p.add(cone(3.0, 1.6, 6), '#ff8fb1', { y: 3.4, rough: 0.5 })
  for (let k = 1; k < 5; k++) {
    const t0 = k / 5
    const rr = 3.0 * (1 - t0) + 0.03
    p.add(cyl(rr, rr + 0.08, 0.06, 6, true), '#e9729a', { y: 2.6 + 1.6 * t0, jitter: 0 })
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const sl = Math.hypot(3.0, 1.6)
    p.add(box(0.1, 0.1, sl), '#e9729a', { x: Math.cos(a) * 1.5, y: 3.42, z: Math.sin(a) * 1.5, ry: Math.PI / 2 - a, rx: Math.atan2(1.6, 3.0), order: 'YXZ' })
  }
  p.add(sphere(0.18, 12, 10), '#ffd23f', { y: 4.3, ...METAL, rough: 0.3, ...ROUND })
  p.add(cyl(0.03, 0.03, 0.4, 5), '#ffd23f', { y: 4.55, ...METAL })
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6
    p.add(lump(0.3, 1, i + 20, 0.15), ['#ff6b8a', '#ffd23f', '#b38bff'][i % 3], { x: Math.cos(a) * 2.3, y: 2.45, z: Math.sin(a) * 2.3, jitter: 0.06, ...ROUND })
    p.add(lump(0.22, 1, i + 30, 0.15), '#5aa846', { x: Math.cos(a) * 2.3, y: 2.3, z: Math.sin(a) * 2.3 + 0.12, jitter: 0.06, ...ROUND })
  }
  // picnic blanket with a basket
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) p.add(box(0.45, 0.03, 0.45), (i + j) % 2 ? '#ffffff' : '#e94b3c', { x: -3.6 + i * 0.45, y: 0.03, z: -1.2 + j * 0.45, jitter: 0.02, rough: 0.95 })
  p.add(box(0.6, 0.35, 0.4), '#c48a52', { x: -3.0, y: 0.2, z: -0.5, jitter: 0.08 })
  for (let k = 0; k < 4; k++) p.add(box(0.62, 0.025, 0.42), '#a8693f', { x: -3.0, y: 0.06 + k * 0.08, z: -0.5, jitter: 0 })
  p.add(torus(0.22, 0.03, 4, 10, Math.PI), '#a8693f', { x: -3.0, y: 0.38, z: -0.5 })
  p.add(box(0.5, 0.04, 0.32), '#e94b3c', { x: -3.0, y: 0.39, z: -0.5, rz: 0.1 })
  p.add(sphere(0.09, 10, 8), '#e8433a', { x: -3.5, y: 0.1, z: -1.0, rough: 0.3, ...ROUND })
  p.add(cyl(0.08, 0.09, 0.06, 10), '#ffffff', { x: -3.3, y: 0.06, z: -0.2 })
  p.aoBottom(0.5, 0.25)
  return p.build()
}

export function seaTurtle() {
  const g = new THREE.Group()
  const p = new Parts(SMOOTH)
  p.add(sphere(0.5, 16, 7, 0, Math.PI / 2), '#5c8a3a', { y: 0.12, sy: 0.6, sz: 1.2, rough: 0.45 })
  p.add(torus(0.5, 0.04, 4, 16), '#4a7230', { y: 0.12, rx: Math.PI / 2, sy: 1.2 })
  // scutes: plates on the shell
  const plates = [
    [0, 0.42, 0.0, 0.17],
    [0, 0.38, 0.32, 0.15],
    [0, 0.38, -0.32, 0.15],
    [0.25, 0.34, 0.15, 0.13],
    [-0.25, 0.34, 0.15, 0.13],
    [0.25, 0.34, -0.17, 0.13],
    [-0.25, 0.34, -0.17, 0.13],
  ]
  for (const [x, y, z, s] of plates) p.add(cyl(s, s, 0.04, 6), '#7aa84f', { x, y, z, rx: -z * 0.6, rz: x * 0.9, rough: 0.4 })
  p.add(sphere(0.18, 10, 8), '#9cc977', { y: 0.18, z: 0.72 })
  p.add(sphere(0.12, 8, 6), '#9cc977', { y: 0.14, z: 0.86, sy: 0.8 })
  for (const s of [-1, 1]) {
    p.add(sphere(0.04, 6, 5), '#1d1717', { x: s * 0.09, y: 0.24, z: 0.83, jitter: 0, rough: 0.2 })
    p.add(sphere(0.15, 8, 6), '#9cc977', { x: s * 0.48, y: 0.08, z: 0.35, sx: 1.6, sy: 0.25, ry: s * 0.5 })
    p.add(sphere(0.11, 8, 6), '#9cc977', { x: s * 0.38, y: 0.08, z: -0.42, sx: 1.3, sy: 0.3, ry: -s * 0.4 })
  }
  p.add(cone(0.06, 0.18, 6), '#9cc977', { y: 0.1, z: -0.68, rx: -Math.PI / 2 })
  g.add(p.build())
  return g
}
