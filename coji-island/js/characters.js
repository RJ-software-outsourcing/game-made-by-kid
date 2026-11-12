// Coji, the islanders and the animals: low-poly models built from colored primitives,
// with simple procedural animation (walk, breathe, look, talk, wave).
import * as THREE from 'three'
import { Parts, MAT2, SMOOTH, SMOOTH2, box, cyl, cone, ico, sphere, torus } from './build.js'
import { UNIFORM, BLANKIE, COJI, BACKPACK } from './config.js'

const KID = { leg: 0.44, hip: 0.15, torso: 0.46, bodyR: 0.25, headR: 0.4, arm: 0.42, armR: 0.072, legR: 0.09, neck: 0.03 }
const ADULT = { leg: 0.7, hip: 0.18, torso: 0.66, bodyR: 0.33, headR: 0.39, arm: 0.6, armR: 0.092, legR: 0.115, neck: 0.06 }

const lerp = (a, b, t) => a + (b - a) * t
const darker = (hex, k = 0.85) => new THREE.Color(hex).multiplyScalar(k)
const HEAD = (r) => new THREE.SphereGeometry(r, 26, 18)

// ---------- heads ----------

function addFace(p, r, o) {
  p.add(HEAD(r), o.skin, { sy: 0.97, jitter: 0 })
  for (const s of [-1, 1]) p.add(sphere(r * 0.2, 10, 8), o.skin, { x: s * r * 0.97, y: -r * 0.05, sx: 0.55, jitter: 0 })
  const ey = -r * 0.04
  const er = o.bigEyes ? r * 0.21 : r * 0.13
  for (const s of [-1, 1]) {
    p.add(sphere(er, 12, 10), '#1d1717', { x: s * r * 0.36, y: ey, z: r * 0.86, sz: 0.6, sy: 1.12, jitter: 0 })
    p.add(sphere(er * 0.35, 8, 6), '#ffffff', { x: s * r * 0.36 + r * 0.05, y: ey + r * 0.06, z: r * 0.93 + er * 0.2, jitter: 0 })
    p.add(sphere(r * 0.12, 10, 8), o.cheeks || '#f4a6a0', { x: s * r * 0.58, y: -r * 0.25, z: r * 0.75, sz: 0.35, jitter: 0 })
    if (o.brows) p.add(box(r * 0.22, r * 0.05, r * 0.05), o.brows, { x: s * r * 0.36, y: ey + r * 0.24, z: r * 0.9, rz: s * -0.12, jitter: 0 })
  }
  p.add(sphere(r * 0.13, 12, 6, Math.PI / 2, Math.PI / 2), '#8e3b36', { y: -r * 0.3, z: r * 0.92, sz: 0.3, jitter: 0 })
  p.add(sphere(r * 0.06, 8, 6), darker(o.skin, 0.9), { y: -r * 0.12, z: r * 0.98, jitter: 0 })
  if (o.glasses) {
    for (const s of [-1, 1]) p.add(torus(r * 0.17, r * 0.025, 6, 16), o.glasses, { x: s * r * 0.36, y: ey, z: r * 0.97, jitter: 0 })
    p.add(box(r * 0.2, r * 0.03, r * 0.03), o.glasses, { y: ey + r * 0.05, z: r * 1.0, jitter: 0 })
  }
}

// Coji's hair: one shell that follows the head, with a jagged fringe, short sides that show the
// ears, a short back, a shiny band and a little cowlick.
const COJI_EDGE = [
  [0, 0.3], [0.6, 0.29], [1.0, 0.18], [1.18, -0.05], [1.3, -0.26], [1.42, 0.1], [1.8, 0.02], [2.3, -0.3], [2.8, -0.44], [Math.PI, -0.47],
]
const hash = (a, b) => {
  const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return h - Math.floor(h)
}
function edgeAt(table, a) {
  for (let i = 1; i < table.length; i++)
    if (a <= table[i][0]) {
      const [a0, e0] = table[i - 1]
      const [a1, e1] = table[i]
      const t = (a - a0) / (a1 - a0)
      return e0 + (e1 - e0) * (t * t * (3 - 2 * t))
    }
  return table[table.length - 1][1]
}
function cojiHair(p, r, color, shine) {
  const segA = 40
  const segE = 10
  // little spikes along the hairline: long bangs in front, short tips at the back
  const jagAt = (k) => {
    const a = -Math.PI + (k / segA) * Math.PI * 2
    const front = Math.max(0, Math.cos(a)) ** 1.5
    const side = Math.max(0, 1 - Math.abs(Math.abs(a) - 1.3) * 3)
    const back = Math.max(0, -Math.cos(a))
    return (k % 2 ? -0.02 : 0.14) * front + (k % 2 ? 0 : 0.1) * side * (1 - front) + (k % 2 ? 0 : 0.09) * back
  }
  const pt = (k, j) => {
    const a = -Math.PI + (k / segA) * Math.PI * 2
    const e = edgeAt(COJI_EDGE, Math.abs(a))
    let phi = Math.acos(Math.max(-0.95, Math.min(0.95, e))) * (j / segE)
    if (j === segE) phi += jagAt(k)
    const top = 1 - j / segE
    const front = Math.max(0, Math.cos(a))
    const back = Math.max(0, -Math.cos(a))
    // hug the head; a bit of volume on top; tufts make it look like real strands
    const tuft = j > 0 && j < segE ? (hash(k % segA, j) - 0.5) * 0.05 : 0
    const R = r * (1.035 + 0.06 * top * top + 0.035 * front * (j / segE) - 0.02 * back * (j / segE) + tuft)
    return [Math.sin(phi) * Math.sin(a) * R, Math.cos(phi) * R + r * 0.03, Math.sin(phi) * Math.cos(a) * R]
  }
  const base = []
  const hi = []
  for (let k = 0; k < segA; k++)
    for (let j = 0; j < segE; j++) {
      const A = pt(k, j)
      const B = pt(k + 1, j)
      const Cc = pt(k, j + 1)
      const D = pt(k + 1, j + 1)
      const am = -Math.PI + ((k + 0.5) / segA) * Math.PI * 2
      const dst = j >= 3 && j <= 4 && Math.abs(am) < 1.5 && k % 3 !== 0 ? hi : base
      dst.push(...A, ...B, ...Cc, ...B, ...D, ...Cc)
    }
  for (const [arr, c] of [[base, color], [hi, shine]]) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
    g.computeVertexNormals()
    p.push(g, c, 0.05, MAT2)
  }
  // cowlick on the crown
  p.add(cone(r * 0.09, r * 0.4, 5), color, { y: r * 1.12, z: -r * 0.35, rx: -0.9, rz: 0.3, mat: MAT2 })
  p.add(cone(r * 0.07, r * 0.3, 5), color, { y: r * 1.1, z: -r * 0.42, rx: -1.2, rz: -0.5, mat: MAT2 })
}

function addHair(p, r, o) {
  const c = o.hair
  switch (o.hairStyle) {
    case 'coji':
      cojiHair(p, r, c, o.hairShine || '#3a3f55')
      break
    case 'short':
      p.add(sphere(r * 1.06, 18, 10, 0, Math.PI * 0.55), c, { rx: -0.5, y: r * 0.06, jitter: 0.03 })
      break
    case 'bun':
      p.add(sphere(r * 1.06, 18, 10, 0, Math.PI * 0.55), c, { rx: -0.45, y: r * 0.06, jitter: 0.03 })
      p.add(sphere(r * 0.38, 14, 10), c, { y: r * 0.95, z: -r * 0.35 })
      break
    case 'bob':
      p.add(sphere(r * 1.08, 18, 10, 0, Math.PI * 0.68), c, { rx: -0.35, y: r * 0.02, jitter: 0.03 })
      break
    case 'pigtails':
      p.add(sphere(r * 1.07, 18, 10, 0, Math.PI * 0.58), c, { rx: -0.45, y: r * 0.05, jitter: 0.03 })
      for (const s of [-1, 1]) {
        p.add(sphere(r * 0.32, 12, 10), c, { x: s * r * 1.05, y: -r * 0.2, z: -r * 0.2, sy: 1.4 })
        p.add(sphere(r * 0.1, 8, 6), '#ff5d8f', { x: s * r * 0.98, y: r * 0.18, z: -r * 0.2 })
      }
      break
    case 'bald':
      for (const s of [-1, 1]) p.add(sphere(r * 0.42, 12, 10), c, { x: s * r * 0.75, y: -r * 0.05, z: -r * 0.25, sx: 0.5 })
      p.add(sphere(r * 0.5, 12, 10), c, { y: -r * 0.05, z: -r * 0.72, sz: 0.5 })
      break
  }
  if (o.antennae)
    for (const s of [-1, 1]) {
      p.add(cyl(r * 0.03, r * 0.03, r * 0.7, 6), o.skin, { x: s * r * 0.3, y: r * 1.15, rz: -s * 0.35 })
      p.add(sphere(r * 0.1, 10, 8), '#ffe066', { x: s * r * 0.43, y: r * 1.47 })
    }
  if (o.beard) {
    p.add(sphere(r * 0.62, 14, 10), o.beard, { y: -r * 0.55, z: r * 0.45, sz: 0.65, sy: 0.85 })
    for (const s of [-1, 1]) p.add(sphere(r * 0.2, 10, 8), o.beard, { x: s * r * 0.17, y: -r * 0.2, z: r * 0.92, sx: 1.6, sy: 0.6, sz: 0.5 })
  }
  switch (o.hat) {
    case 'captain':
      p.add(cyl(r * 1.05, r * 0.95, r * 0.42, 18), '#ffffff', { y: r * 0.72 })
      p.add(cyl(r * 0.98, r * 0.98, r * 0.16, 18), '#22325e', { y: r * 0.55 })
      p.add(cyl(r * 0.6, r * 0.6, r * 0.05, 16), '#1a1a1a', { y: r * 0.5, z: r * 0.62, sz: 0.9, rx: 0.25 })
      p.add(sphere(r * 0.12, 8, 6), '#f1c232', { y: r * 0.72, z: r * 0.98 })
      break
    case 'chef':
      p.add(cyl(r * 0.85, r * 0.8, r * 0.5, 16), '#ffffff', { y: r * 0.85 })
      p.add(sphere(r * 0.62, 16, 10), '#ffffff', { y: r * 1.25, sx: 1.25, sz: 1.25, sy: 0.75 })
      break
    case 'cap':
      p.add(sphere(r * 1.06, 18, 8, 0, Math.PI * 0.45), o.hatColor, { y: r * 0.12 })
      p.add(cyl(r * 0.55, r * 0.55, r * 0.05, 14), darker(o.hatColor, 0.9), { y: r * 0.5, z: r * 0.7, rx: 0.15, sx: 1.1 })
      break
    case 'bucket':
      p.add(cyl(r * 0.8, r * 1.0, r * 0.45, 16), o.hatColor, { y: r * 0.72 })
      p.add(cyl(r * 1.35, r * 1.35, r * 0.06, 18), o.hatColor, { y: r * 0.5 })
      break
    case 'paper':
      p.add(cyl(r * 0.9, r * 0.95, r * 0.35, 16), o.hatColor, { y: r * 0.62 })
      p.add(cyl(r * 0.92, r * 0.92, r * 0.08, 16), '#ffffff', { y: r * 0.5 })
      break
    case 'helmet':
      p.add(sphere(r * 1.12, 20, 10, 0, Math.PI * 0.56), '#c9ced6', { y: r * 0.05 })
      p.add(cyl(r * 1.13, r * 1.13, r * 0.14, 20, true), '#a8afba', { y: r * 0.05 })
      p.add(box(r * 0.12, r * 0.5, r * 0.12), '#a8afba', { y: r * 0.1, z: r * 1.08 })
      for (let i = 0; i < 5; i++) p.add(sphere(r * 0.16, 8, 6), '#e94b3c', { y: r * 1.18 + i * r * 0.05, z: -r * 0.1 - i * r * 0.18, sx: 0.6 })
      break
    case 'crown':
      p.add(cyl(r * 0.78, r * 0.72, r * 0.32, 16, true), '#f1c232', { y: r * 0.85 })
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        p.add(cone(r * 0.12, r * 0.3, 5), '#f1c232', { x: Math.sin(a) * r * 0.75, y: r * 1.15, z: Math.cos(a) * r * 0.75 })
        p.add(sphere(r * 0.06, 8, 6), i % 2 ? '#e94b3c' : '#3b7dd8', { x: Math.sin(a) * r * 0.79, y: r * 0.85, z: Math.cos(a) * r * 0.79 })
      }
      p.add(sphere(r * 0.6, 14, 8, 0, Math.PI / 2), '#b3282d', { y: r * 0.82 })
      break
  }
}

// Rounded shoes. With `toe`, `shoeStripe` and `strap` they become sneakers.
function addShoe(p, P, o) {
  const L = P.leg
  const w = P.legR * 2.35
  const len = P.legR * 3.7
  const y0 = -L
  const zc = P.legR * 0.6
  const sole = o.soles || darker(o.shoes, 0.7)
  p.add(box(w, 0.06, len - w), sole, { y: y0 + 0.03, z: zc, jitter: 0 })
  for (const k of [-1, 1]) p.add(cyl(w / 2, w / 2, 0.06, 16), sole, { y: y0 + 0.03, z: zc + (k * (len - w)) / 2, jitter: 0 })
  p.add(sphere(w * 0.52, 18, 10, 0, Math.PI / 2), o.shoes, { y: y0 + 0.055, z: zc + len * 0.02, sy: 1.25, sz: len / (w * 1.04), jitter: 0 })
  if (o.toe) p.add(sphere(w * 0.5, 16, 8, 0, Math.PI / 2), o.toe, { y: y0 + 0.054, z: zc + len * 0.27, sy: 0.72, sz: 0.85, jitter: 0 })
  if (o.shoeStripe) for (const k of [-1, 1]) p.add(box(0.012, 0.028, len * 0.42), o.shoeStripe, { x: k * w * 0.5, y: y0 + 0.1, z: zc - len * 0.02, rx: -0.35, jitter: 0 })
  if (o.strap) p.add(box(w * 0.94, 0.03, 0.08), o.strap, { y: y0 + 0.165, z: zc + len * 0.04, rx: -0.5, jitter: 0 })
}

// Stacked colored rings make a striped shirt.
function bandedTorso(p, rb, rt, y0, h, bands, seg = 16) {
  let acc = 0
  for (const [f, c] of bands) {
    const r0 = lerp(rb, rt, acc)
    const r1 = lerp(rb, rt, acc + f)
    p.add(new THREE.CylinderGeometry(r1, r0, h * f, seg, 1, true), c, { y: y0 + h * (acc + f / 2), jitter: 0, mat: SMOOTH2 })
    acc += f
  }
}

// A knit cloth (Blankie Bear's blanket): stripes across, a ribbed border all round, and a little
// light/dark knit pattern. `shape(u, v)` (u -1..1 across, v 0..1 down) places each point every frame.
function makeCloth(rowColors, cols, border, shape) {
  const rows = rowColors.length
  const pos = []
  const col = []
  const rest = []
  const c = new THREE.Color()
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++) {
      const u0 = (k / cols) * 2 - 1
      const u1 = ((k + 1) / cols) * 2 - 1
      const v0 = r / rows
      const v1 = (r + 1) / rows
      const edge = k === 0 || k === cols - 1 || r === rows - 1
      c.set(edge ? border : rowColors[r])
      const j = 1 + ((k + r) % 2 ? 0.035 : -0.035) + (Math.random() * 2 - 1) * 0.02
      for (const [u, v] of [[u0, v0], [u0, v1], [u1, v0], [u0, v1], [u1, v1], [u1, v0]]) {
        rest.push(u, v)
        pos.push(0, 0, 0)
        col.push(c.r * j, c.g * j, c.b * j)
      }
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  const mesh = new THREE.Mesh(g, SMOOTH2)
  mesh.castShadow = true
  mesh.frustumCulled = false
  return { mesh, rest, shape }
}

// The little bear head of Blankie Bear.
function blankieHead() {
  const B = BLANKIE
  const bp = new Parts(SMOOTH)
  bp.add(sphere(0.16, 18, 14), B.head, { sy: 0.92, jitter: 0.03 })
  for (const s of [-1, 1]) {
    bp.add(sphere(0.065, 12, 10), B.ears, { x: s * 0.115, y: 0.11, sz: 0.6 })
    bp.add(sphere(0.02, 8, 6), B.features, { x: s * 0.055, y: 0.035, z: 0.145, jitter: 0 })
  }
  bp.add(sphere(0.075, 12, 10), B.muzzle, { y: -0.035, z: 0.12, sz: 0.6, jitter: 0.02 })
  bp.add(sphere(0.028, 8, 6), B.features, { y: -0.01, z: 0.168, sx: 1.3, jitter: 0 })
  bp.add(box(0.012, 0.045, 0.01), B.features, { y: -0.055, z: 0.16, rz: 0.25, jitter: 0 })
  return bp.build()
}

// ---------- people ----------

export class Person {
  constructor(look) {
    this.look = look
    const P = look.kid ? KID : ADULT
    this.P = P
    const o = look
    const root = new THREE.Group()
    this.root = root
    this.phase = Math.random() * 6
    this.seed = Math.random() * 10
    this.speed = 0
    this.talk = 0
    this.wave = 0
    this.lookYaw = 0
    this.cheer = 0

    // Legs: pivot at the hip.
    const legs = []
    for (const s of [-1, 1]) {
      const p = new Parts(SMOOTH)
      const L = P.leg
      const longPants = o.pantsLong
      p.add(cyl(P.legR, P.legR * 0.92, L, 12), longPants ? o.pants : o.skin, { y: -L / 2, jitter: 0 })
      if (!longPants && !o.dress) {
        p.add(cyl(P.legR * 1.45, P.legR * 1.35, L * 0.36, 14), o.pants, { y: -L * 0.16, jitter: 0 })
        if (o.piping) p.add(box(0.02, L * 0.34, 0.03), o.piping, { x: s * P.legR * 1.42, y: -L * 0.16, jitter: 0 })
      }
      if (o.socks) p.add(cyl(P.legR * 1.06, P.legR * 1.02, L * 0.22, 12), o.socks, { y: -L + L * 0.17, jitter: 0 })
      addShoe(p, P, o)
      const leg = p.build()
      leg.position.set(s * P.bodyR * 0.45, P.leg, 0)
      root.add(leg)
      legs.push(leg)
    }
    ;[this.legR, this.legL] = legs // s=-1 is the right side (character faces +z)

    // Body: torso + head + arms. Pivot at the hips.
    const body = new THREE.Group()
    body.position.y = P.leg
    root.add(body)
    this.body = body
    this.bodyY = P.leg
    const p = new Parts(SMOOTH)
    const shirtTop = P.hip * 0.6 + P.torso
    this.shirtTop = shirtTop
    if (o.uniform) {
      const U = UNIFORM
      p.add(cyl(P.bodyR * 1.06, P.bodyR * 1.1, P.hip, 16), U.shorts, { y: P.hip / 2 - 0.02, jitter: 0 })
      const stripe = [
        [0.05, U.stripe],
        [0.018, U.stripeLine],
        [0.13, U.shirt],
      ]
      bandedTorso(p, P.bodyR * 1.12, P.bodyR * 0.9, P.hip * 0.6, P.torso, [[0.08, U.shirt], ...stripe, ...stripe, ...stripe, ...stripe, [0.124, U.navy]])
      p.add(sphere(P.bodyR * 0.9, 16, 6, 0, Math.PI / 2), U.navy, { y: shirtTop, sy: 0.45, jitter: 0 })
      p.add(box(0.13, 0.13, 0.02), U.navy, { y: shirtTop - 0.06, z: P.bodyR * 0.92, rz: Math.PI / 4, jitter: 0 })
      p.add(torus(0.115, 0.03, 6, 16), U.navy, { y: shirtTop + 0.02, rx: Math.PI / 2, jitter: 0 })
      p.add(cyl(0.035, 0.035, 0.012, 12), U.crest, { x: 0.1, y: shirtTop - 0.14, z: P.bodyR * 0.98, rx: Math.PI / 2 - 0.15, jitter: 0 })
    } else {
      p.add(cyl(P.bodyR * 1.04, P.bodyR * 1.08, P.hip, 16), o.dress || o.pants, { y: P.hip / 2 - 0.02, jitter: 0 })
      if (o.stripes) {
        const bands = []
        for (let i = 0; i < 5; i++) bands.push([0.12, o.shirt], [0.08, o.stripes])
        bandedTorso(p, P.bodyR * 1.05, P.bodyR * 0.9, P.hip * 0.6, P.torso, bands)
      } else bandedTorso(p, P.bodyR * 1.05, P.bodyR * 0.9, P.hip * 0.6, P.torso, [[1, o.shirt]])
      p.add(sphere(P.bodyR * 0.9, 16, 6, 0, Math.PI / 2), o.shirt, { y: shirtTop, sy: 0.45, jitter: 0 })
      if (o.dress) p.add(cyl(P.bodyR * 1.05, P.bodyR * (o.robe ? 1.9 : 1.7), P.leg * (o.robe ? 0.92 : 0.55), 18), o.dress, { y: -P.leg * (o.robe ? 0.38 : 0.2), jitter: 0 })
      if (o.robe) {
        p.add(torus(P.bodyR * 1.85, 0.07, 6, 20), '#ffffff', { y: -P.leg * 0.82, rx: Math.PI / 2, jitter: 0 })
        p.add(torus(0.2, 0.09, 8, 18), '#ffffff', { y: shirtTop + 0.01, rx: Math.PI / 2, jitter: 0 })
        p.add(box(0.06, P.torso + P.leg * 0.8, 0.04), '#f1c232', { y: P.torso / 2 - P.leg * 0.35, z: P.bodyR * 1.0, jitter: 0 })
      }
      if (o.apron) {
        p.add(box(P.bodyR * 1.3, P.torso * 0.75, 0.04), o.apron, { y: P.hip * 0.6 + P.torso * 0.4, z: P.bodyR * 1.0, jitter: 0.02 })
        p.add(box(P.bodyR * 1.3, P.leg * 0.45, 0.04), o.apron, { y: -P.leg * 0.12, z: P.bodyR * 1.08, jitter: 0.02 })
      }
      if (o.coat) {
        for (const s of [-1, 1]) p.add(box(P.bodyR * 0.7, P.torso, 0.05), o.coat, { x: s * P.bodyR * 0.55, y: P.hip * 0.6 + P.torso / 2, z: P.bodyR * 0.88, rz: s * 0.04 })
        for (let i = 0; i < 3; i++) p.add(sphere(0.03, 8, 6), '#f1c232', { x: P.bodyR * 0.25, y: P.hip + 0.12 + i * 0.17, z: P.bodyR * 0.96 })
      }
      if (o.bow) for (const s of [-1, 1]) p.add(cone(0.06, 0.1, 4), o.bow, { x: s * 0.05, y: shirtTop - 0.02, z: P.bodyR * 0.85, rz: (s * Math.PI) / 2 })
      if (o.collar) p.add(torus(0.12, 0.03, 6, 16), o.collar, { y: shirtTop + 0.02, rx: Math.PI / 2, jitter: 0 })
      if (o.belt) p.add(cyl(P.bodyR * 1.07, P.bodyR * 1.07, 0.08, 16), o.belt, { y: P.hip * 0.8, jitter: 0 })
      if (o.cape) p.add(box(P.bodyR * 2.2, P.torso + P.leg * (o.robe ? 0.85 : 0.5), 0.05), o.cape, { y: shirtTop - (P.torso + P.leg * (o.robe ? 0.85 : 0.5)) / 2, z: -P.bodyR * 1.05, rx: 0.06 })
      if (o.bag) {
        p.add(box(0.36, 0.3, 0.14), o.bag, { x: -P.bodyR * 1.1, y: P.hip * 0.7, z: 0.05 })
        p.add(box(0.04, P.torso * 1.25, 0.03), darker(o.bag, 0.8), { x: 0, y: P.hip + P.torso * 0.45, z: P.bodyR * 0.98, rz: 0.75 })
      }
    }
    p.add(cyl(0.09, 0.1, P.neck + 0.08, 12), o.skin, { y: shirtTop + 0.02, jitter: 0 })
    body.add(p.build())

    // Head
    const head = new THREE.Group()
    const headY = shirtTop + P.neck + P.headR * 0.92
    head.position.y = headY
    const hp = new Parts(SMOOTH)
    addFace(hp, P.headR, o)
    addHair(hp, P.headR, o)
    head.add(hp.build())
    body.add(head)
    this.head = head
    this.headY = headY

    // Arms: pivot at the shoulder.
    const arms = []
    for (const s of [-1, 1]) {
      const ap = new Parts(SMOOTH)
      const A = P.arm
      const sleeve = o.uniform ? UNIFORM.navy : o.coat || o.shirt
      ap.add(cyl(P.armR * 1.35, P.armR * 1.3, A * (o.longSleeves ? 0.85 : 0.36), 12), sleeve, { y: -A * (o.longSleeves ? 0.42 : 0.17), jitter: 0 })
      if (o.uniform) ap.add(box(0.02, A * 0.34, 0.025), UNIFORM.piping, { x: s * P.armR * 1.33, y: -A * 0.17, jitter: 0 })
      ap.add(cyl(P.armR, P.armR * 0.9, A, 12), o.gloves || o.skin, { y: -A / 2 - 0.01, jitter: 0 })
      ap.add(sphere(P.armR * 1.25, 12, 10), o.gloves || o.skin, { y: -A - 0.02, jitter: 0 })
      if (s === 1 && o.shield) {
        ap.add(cyl(0.34, 0.34, 0.06, 18), o.shield, { y: -A * 0.6, z: 0.02, x: 0.12, rz: Math.PI / 2, jitter: 0 })
        ap.add(torus(0.34, 0.035, 6, 18), '#f1c232', { y: -A * 0.6, x: 0.16, ry: Math.PI / 2, jitter: 0 })
        ap.add(cone(0.1, 0.14, 5), '#f1c232', { y: -A * 0.6 + 0.04, x: 0.17, rz: -Math.PI / 2, jitter: 0 })
      }
      const arm = ap.build()
      arm.position.set(s * (P.bodyR * 0.95 + P.armR), shirtTop - 0.06, 0)
      arm.rotation.z = s * 0.12
      body.add(arm)
      arms.push(arm)
    }
    ;[this.armR, this.armL] = arms

    if (o.rod) {
      const rp = new Parts()
      rp.add(cyl(0.025, 0.035, 2.6, 6), '#8b5a2b', { y: 1.2 })
      const rod = rp.build()
      rod.position.set(0, -P.arm, 0.05)
      rod.rotation.x = 1.6
      this.armR.add(rod)
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 2.2, 3), new THREE.MeshBasicMaterial({ color: 0xeeeeee }))
      line.position.set(0, 2.4 - 0.594, 0.924)
      line.rotation.x = 2.14
      rod.add(line)
    }
    if (o.spear) {
      const sp = new Parts(SMOOTH)
      sp.add(cyl(0.035, 0.035, 3.0, 8), '#8b5a2b', { y: 0.6 })
      sp.add(cone(0.08, 0.32, 8), '#d9dde3', { y: 2.25 })
      sp.add(box(0.04, 0.18, 0.12), '#e94b3c', { y: 1.9, z: 0.06 })
      const spear = sp.build()
      spear.position.set(-(P.bodyR * 0.95 + P.armR) - 0.06, P.leg + shirtTop - 0.06 - P.arm, 0.22)
      root.add(spear)
    }
    if (o.scepter) {
      const sc = new Parts(SMOOTH)
      sc.add(cyl(0.03, 0.03, 0.9, 8), '#f1c232', { y: 0.2 })
      sc.add(sphere(0.09, 12, 10), '#e94b3c', { y: 0.68 })
      const scep = sc.build()
      scep.position.set(0, -P.arm, 0.06)
      this.armR.add(scep)
    }
    if (o.backpack) this.addBackpack()
    if (o.hug) this.addLovey()
    if (o.sit) this.sit()
    root.traverse((m) => {
      if (m.isMesh) m.castShadow = true
    })
  }

  // Coji's red backpack.
  addBackpack() {
    const P = this.P
    const K = BACKPACK
    const top = this.shirtTop
    const by = top - 0.27
    const bz = -(P.bodyR + 0.12)
    const p = new Parts(SMOOTH)
    p.add(box(0.44, 0.36, 0.2), K.main, { y: by, z: bz, jitter: 0.02 })
    p.add(cyl(0.1, 0.1, 0.44, 14), K.main, { y: by + 0.18, z: bz, rz: Math.PI / 2, jitter: 0.02 })
    p.add(cyl(0.1, 0.1, 0.44, 14), K.main, { y: by - 0.18, z: bz, rz: Math.PI / 2, sy: 1, sz: 1, jitter: 0.02 })
    p.add(box(0.32, 0.17, 0.08), K.pocket, { y: by - 0.07, z: bz - 0.12 })
    p.add(box(0.34, 0.05, 0.09), K.dark, { y: by + 0.03, z: bz - 0.125, jitter: 0 })
    p.add(box(0.012, 0.3, 0.012), K.dark, { x: 0.18, y: by + 0.02, z: bz - 0.105, jitter: 0 })
    p.add(torus(0.06, 0.016, 6, 12, Math.PI), K.dark, { y: by + 0.27, z: bz, ry: Math.PI / 2, jitter: 0 })
    p.add(ico(0.045, 0), K.charm, { x: 0.25, y: by - 0.12, z: bz, jitter: 0 })
    for (const s of [-1, 1]) {
      p.add(box(0.07, 0.05, 0.36), K.straps, { x: s * 0.13, y: top + 0.03, z: -0.02, jitter: 0 })
      p.add(box(0.07, 0.3, 0.035), K.straps, { x: s * 0.13, y: top - 0.13, z: P.bodyR * 0.98, rx: -0.12, jitter: 0 })
    }
    this.body.add(p.build())
  }

  // Blankie Bear held in a hug: the bear head at the chest; the blanket is gathered under the head,
  // hangs down in front in soft folds, and drapes over both arms. When resting it covers the lap.
  addLovey() {
    const P = this.P
    const B = BLANKIE
    const top = this.shirtTop
    const head = blankieHead()
    head.scale.setScalar(1.05)
    head.position.set(0.02, top - 0.08, P.bodyR + 0.19)
    head.rotation.set(-0.15, 0.12, 0.08)
    this.body.add(head)
    this.bearHead = head
    const z0 = P.bodyR + 0.15
    const y0 = top - 0.19
    const rows = [B.knit, B.stripe, B.knit, B.knit, B.stripe, B.knit, B.knit, B.stripe, B.knit, B.rib]
    // the front drop: gathered at the top, wider below, the middle corner hangs lowest
    const front = makeCloth(rows, 10, B.rib, (u, v, t, sw) => {
      const x = u * (0.1 + 0.2 * Math.sqrt(v))
      const y = y0 - v * 0.44 - 0.11 * (1 - Math.abs(u)) * v * v
      const fold = Math.sin(u * Math.PI * 2.5 + 0.7) * 0.03 * Math.min(1, v * 2)
      const z = z0 + 0.05 * (1 - u * u) + 0.07 * v + fold + sw * 0.07 * v * v + Math.sin(t * 9 + v * 5 + u * 2) * 0.02 * sw * v
      return [x, y, z]
    })
    // two corners draped over the forearms
    const flap = (s) =>
      makeCloth([B.knit, B.stripe, B.knit, B.knit, B.stripe, B.rib], 4, B.rib, (u, v, t, sw) => {
        const x = s * (0.15 + 0.08 * v) + u * (0.05 + 0.05 * v)
        const y = y0 + 0.02 - v * 0.36
        const z = z0 - 0.02 + 0.03 * Math.sin((u + 1) * 1.6) + 0.04 * v + Math.sin(t * 8 + v * 4) * 0.015 * sw * v
        return [x, y, z]
      })
    // the lap blanket when Coji sits: over the thighs, then hanging down at the knees
    const lap = makeCloth([B.knit, B.stripe, B.knit, B.knit, B.stripe, B.knit, B.knit, B.stripe, B.rib], 10, B.rib, (u, v, t) => {
      const x = u * 0.34 * (1 + 0.15 * v)
      const fold = Math.sin(u * Math.PI * 3) * 0.018
      let y
      let z
      if (v < 0.5) {
        z = 0.08 + (v / 0.5) * 0.42
        y = 0.24 - (v / 0.5) * 0.08 + fold
      } else {
        z = 0.5 + 0.04 * Math.sin((v - 0.5) * 3)
        y = 0.16 - ((v - 0.5) / 0.5) * 0.46 + fold * 0.5
      }
      return [x, y + Math.sin(t * 1.5 + u * 2) * 0.004, z]
    })
    lap.mesh.visible = false
    this.cloths = [front, flap(-1), flap(1), lap]
    this.lap = lap
    for (const c of this.cloths) this.body.add(c.mesh)
    this.sway = 0
    this.updateCloth(0, 0)
  }

  // Resting: the blanket moves from the arms to the lap.
  setRest(on) {
    if (!this.cloths) return
    for (const c of this.cloths) c.mesh.visible = c === this.lap ? on : !on
  }

  updateCloth(dt, t) {
    const target = Math.min(1, this.speed / 6)
    this.sway += (target - this.sway) * Math.min(1, dt * 4)
    for (const c of this.cloths) {
      if (!c.mesh.visible && c.done) continue
      c.done = true
      const a = c.mesh.geometry.attributes.position.array
      for (let i = 0, n = c.rest.length / 2; i < n; i++) {
        const [x, y, z] = c.shape(c.rest[i * 2], c.rest[i * 2 + 1], t, this.sway)
        a[i * 3] = x
        a[i * 3 + 1] = y
        a[i * 3 + 2] = z
      }
      c.mesh.geometry.attributes.position.needsUpdate = true
      c.mesh.geometry.computeVertexNormals()
    }
  }

  sit() {
    this.seated = true
    this.bodyY = 0.42
    this.body.position.y = this.bodyY
    for (const leg of [this.legL, this.legR]) {
      leg.position.y = 0.42
      leg.rotation.x = -1.45
    }
  }

  stand() {
    this.seated = false
    this.bodyY = this.P.leg
    this.body.position.y = this.bodyY
    for (const leg of [this.legL, this.legR]) {
      leg.position.y = this.P.leg
      leg.rotation.x = 0
    }
  }

  update(dt, t) {
    const moving = this.speed > 0.2 && !this.seated
    if (moving) this.phase += dt * Math.min(20, this.speed * 3.1)
    const amp = moving ? Math.min(1, this.speed / 4) : 0
    this.swing = lerp(this.swing || 0, Math.sin(this.phase) * amp, Math.min(1, dt * 12))
    const sw = this.swing
    const hop = this.cheer > 0 ? Math.abs(Math.sin(t * 10)) * 0.15 : 0
    if (!this.seated) {
      this.legL.rotation.x = sw * 0.75
      this.legR.rotation.x = -sw * 0.75
      this.body.position.y = this.bodyY + Math.abs(Math.sin(this.phase)) * 0.05 * amp + hop
    } else this.body.position.y = this.bodyY
    this.body.scale.y = 1 + Math.sin(t * 2.2 + this.seed) * 0.012
    if (this.look.hug) {
      // both arms hold Blankie Bear
      const s = Math.sin(t * 2.2 + this.seed) * 0.03 + sw * 0.05
      this.armR.rotation.set(-1.05 + s, 0, 0.55)
      this.armL.rotation.set(-1.05 - s, 0, -0.55)
      if (this.cheer > 0) this.cheer -= dt
    } else {
      this.armL.rotation.x = -sw * 0.65
      this.armR.rotation.x = sw * 0.65
      if (this.wave > 0) {
        this.wave -= dt
        this.armR.rotation.x = -2.7
        this.armR.rotation.z = -0.4 + Math.sin(t * 12) * 0.35
      } else if (this.cheer > 0) {
        this.cheer -= dt
        this.armR.rotation.x = -2.9
        this.armL.rotation.x = -2.9
        this.armR.rotation.z = -0.3
        this.armL.rotation.z = 0.3
      } else {
        this.armR.rotation.z = -0.12
        this.armL.rotation.z = 0.12
      }
      if (this.look.rod) this.armR.rotation.x = -0.6 + Math.sin(t * 0.8) * 0.05
      if (this.look.spear && this.wave <= 0) this.armR.rotation.x = -0.35
      if (this.look.shield) this.armL.rotation.x = -0.25 - sw * 0.3
    }
    this.head.rotation.y = lerp(this.head.rotation.y, this.lookYaw, Math.min(1, dt * 5))
    this.head.rotation.x = this.talk > 0 ? Math.sin(t * 9) * 0.07 : Math.sin(t * 0.7 + this.seed) * 0.03
    if (this.talk > 0) this.talk -= dt
    if (this.cloths) this.updateCloth(dt, t)
  }

  get faceY() {
    return this.bodyY + this.headY
  }
}

// ---------- looks ----------

export const LOOKS = {
  coji: {
    kid: true,
    skin: COJI.skin,
    hair: COJI.hair,
    hairShine: '#3a3f55',
    hairStyle: 'coji',
    cheeks: COJI.cheeks,
    uniform: true,
    pants: UNIFORM.shorts,
    piping: UNIFORM.piping,
    socks: UNIFORM.socks,
    shoes: UNIFORM.shoes,
    toe: UNIFORM.toe,
    shoeStripe: UNIFORM.shoeStripe,
    strap: UNIFORM.strap,
    soles: UNIFORM.soles,
    backpack: true,
    hug: true,
  },
  pip: { skin: '#f7cfb0', hair: '#7a4a2a', hairStyle: 'short', beard: '#7a4a2a', hat: 'captain', shirt: '#ffffff', coat: '#2b4c8c', longSleeves: true, pants: '#f4f1ea', pantsLong: true, shoes: '#2a2a2a' },
  finn: { skin: '#e8b48f', hair: '#3b2a1f', hairStyle: 'short', hat: 'bucket', hatColor: '#f2c94c', shirt: '#4a90c8', stripes: '#ffffff', pants: '#5a6b8c', pantsLong: true, shoes: '#6b4a2b', rod: true, sit: true },
  ben: { skin: '#f3cfb0', hair: '#c46a2b', hairStyle: 'short', hat: 'chef', shirt: '#ffffff', apron: '#ef5b5b', pants: '#3a3a4a', pantsLong: true, shoes: '#2a2a2a' },
  granny: { skin: '#f5d3ba', hair: '#ebe7e1', hairStyle: 'bun', glasses: '#8a5a3a', shirt: '#a678c9', apron: '#f7c843', longSleeves: true, dress: '#7b5aa6', pants: '#7b5aa6', shoes: '#5a3a2a' },
  penny: { skin: '#e8b894', hair: '#2d1e14', hairStyle: 'bob', glasses: '#333333', shirt: '#ffffff', coat: '#3b7a5e', bow: '#e2465a', longSleeves: true, pants: '#2f3b4a', pantsLong: true, shoes: '#2a2a2a' },
  tina: { skin: '#f7d6c0', hair: '#e8a93a', hairStyle: 'pigtails', shirt: '#ff9bbd', dress: '#5bc0eb', pants: '#5bc0eb', shoes: '#ff6f91', collar: '#ffffff' },
  leo: { kid: true, skin: '#e9b48c', hair: '#5a3a22', hairStyle: 'short', hat: 'cap', hatColor: '#e94b3c', shirt: '#5ac46f', pants: '#3b5998', socks: '#ffffff', shoes: '#e94b3c', toe: '#ffffff', soles: '#ffffff' },
  gus: { skin: '#f7d0b4', hair: '#f4f4f4', hairStyle: 'bald', beard: '#f4f4f4', hat: 'cap', hatColor: '#2b3a67', shirt: '#d9534f', stripes: '#ffffff', longSleeves: true, pants: '#4a4a5a', pantsLong: true, shoes: '#3a2a1a' },
  coco: { skin: '#f3c9a8', hair: '#ff8fb1', hairStyle: 'bob', hat: 'paper', hatColor: '#ff8fb1', shirt: '#ffffff', stripes: '#ffb3c9', apron: '#9be7ff', pants: '#5a6b8c', pantsLong: true, shoes: '#ff6f91' },
  max: { skin: '#d9a27c', hair: '#2d1e14', hairStyle: 'short', hat: 'cap', hatColor: '#2f6fd0', shirt: '#3b7dd8', pants: '#2b3a67', pantsLong: true, shoes: '#2a2a2a', bag: '#a8693f', brows: '#2d1e14' },
  kim: { skin: '#f6d1b6', hair: '#3a2a20', hairStyle: 'bun', glasses: '#7a4a2a', shirt: '#ffffff', coat: '#5aa985', longSleeves: true, dress: '#41607a', pants: '#41607a', shoes: '#5a3a2a' },
  lance: { skin: '#f2c9a6', hair: '#6b4a2b', hairStyle: 'short', hat: 'helmet', shirt: '#c9ced6', stripes: '#b3bac5', coat: '#3f63c9', belt: '#6b4a2b', gloves: '#a8afba', longSleeves: true, pants: '#8a929e', pantsLong: true, shoes: '#5b6270', cape: '#e94b3c', shield: '#3f63c9', spear: true, brows: '#6b4a2b' },
  king: { skin: '#f7d0b4', hair: '#f4f4f4', hairStyle: 'bald', beard: '#f4f4f4', hat: 'crown', shirt: '#b3282d', dress: '#b3282d', robe: true, cape: '#8e1f2a', longSleeves: true, pants: '#b3282d', shoes: '#f1c232', scepter: true },
}

// ---------- animals ----------

class Animal {
  constructor() {
    this.root = new THREE.Group()
    this.seed = Math.random() * 10
    this.talk = 0
    this.mood = 'idle'
    this.lookYaw = 0
    this.speed = 0
  }
  finish() {
    this.root.traverse((m) => {
      if (m.isMesh) m.castShadow = true
    })
    return this
  }
  get faceY() {
    return this.faceH
  }
}

export class Bear extends Animal {
  constructor() {
    super()
    const brown = '#9b6a43'
    const tan = '#e2bf92'
    const p = new Parts(SMOOTH)
    p.add(ico(1.0, 2), brown, { y: 1.0, sx: 1.15, sy: 1.05, sz: 0.95 })
    p.add(ico(0.72, 2), tan, { y: 0.92, z: 0.45, sz: 0.6, sy: 1.1 })
    for (const s of [-1, 1]) {
      p.add(cyl(0.3, 0.34, 0.95, 8), brown, { x: s * 0.55, y: 0.35, z: 0.7, rx: Math.PI / 2 })
      p.add(ico(0.36, 2), brown, { x: s * 0.55, y: 0.38, z: 1.2 })
      p.add(ico(0.22, 2), tan, { x: s * 0.55, y: 0.4, z: 1.48, sz: 0.4 })
    }
    this.root.add(p.build())
    const head = new THREE.Group()
    head.position.set(0, 2.1, 0.15)
    const hp = new Parts(SMOOTH)
    hp.add(ico(0.64, 2), brown, { sy: 0.92 })
    hp.add(ico(0.3, 2), tan, { y: -0.15, z: 0.5, sz: 0.75 })
    hp.add(ico(0.11, 2), '#2b1d14', { y: -0.05, z: 0.76, sx: 1.3 })
    for (const s of [-1, 1]) {
      hp.add(ico(0.075, 2), '#1d1414', { x: s * 0.24, y: 0.12, z: 0.55, sz: 0.7, jitter: 0 })
      hp.add(ico(0.025, 2), '#ffffff', { x: s * 0.24 + 0.03, y: 0.15, z: 0.61, jitter: 0 })
      hp.add(ico(0.22, 2), brown, { x: s * 0.46, y: 0.48, z: -0.05, sz: 0.6 })
      hp.add(ico(0.12, 2), tan, { x: s * 0.46, y: 0.47, z: 0.05, sz: 0.4 })
      hp.add(ico(0.1, 2), '#f2a0a0', { x: s * 0.42, y: -0.12, z: 0.45, sz: 0.4, jitter: 0 })
    }
    hp.add(sphere(0.1, 8, 4, Math.PI / 2, Math.PI / 2), '#7a2f2a', { y: -0.27, z: 0.66, sz: 0.4, jitter: 0 })
    head.add(hp.build())
    this.root.add(head)
    this.head = head
    const arms = []
    for (const s of [-1, 1]) {
      const ap = new Parts(SMOOTH)
      ap.add(cyl(0.22, 0.26, 0.85, 8), brown, { y: -0.4 })
      ap.add(ico(0.27, 2), brown, { y: -0.85 })
      const arm = ap.build()
      arm.position.set(s * 0.9, 1.6, 0.2)
      arm.rotation.x = -0.5
      arm.rotation.z = s * 0.25
      this.root.add(arm)
      arms.push(arm)
    }
    ;[this.armR, this.armL] = arms
    this.faceH = 2.1
    this.portraitDist = 3.2
    this.finish()
  }
  update(dt, t) {
    const hungry = this.mood === 'hungry'
    const b = Math.sin(t * 1.6 + this.seed)
    this.root.children[0].scale.set(1 + b * 0.015, 1 + b * 0.02, 1 + b * 0.015)
    this.head.rotation.y = lerp(this.head.rotation.y, this.lookYaw, Math.min(1, dt * 4))
    if (this.mood === 'happy') {
      this.head.rotation.x = Math.sin(t * 6) * 0.1
      this.armR.rotation.x = -2.6 + Math.sin(t * 8) * 0.3
      this.armL.rotation.x = -2.6 - Math.sin(t * 8) * 0.3
      this.root.position.y = this.baseY + Math.abs(Math.sin(t * 5)) * 0.2
    } else if (hungry) {
      this.head.rotation.x = 0.25 + Math.sin(t * 0.9) * 0.05
      this.armR.rotation.x = -0.9 + Math.sin(t * 3) * 0.25
      this.armL.rotation.x = -0.5
      this.armR.rotation.z = 0.5
    } else {
      this.head.rotation.x = Math.sin(t * 0.8) * 0.04
      this.armR.rotation.x = -0.5
      this.armL.rotation.x = -0.5
      this.armR.rotation.z = -0.25
      if (this.root.position.y > this.baseY) this.root.position.y = this.baseY
    }
    if (this.talk > 0) {
      this.talk -= dt
      this.head.rotation.z = Math.sin(t * 7) * 0.06
    } else this.head.rotation.z = 0
  }
}

export class Owl extends Animal {
  constructor() {
    super()
    const brown = '#9c7650'
    const p = new Parts(SMOOTH)
    p.add(ico(0.45, 2), brown, { y: 0.45, sy: 1.15, sz: 0.95 })
    p.add(ico(0.34, 2), '#efdcb8', { y: 0.4, z: 0.26, sz: 0.5 })
    for (const s of [-1, 1]) p.add(ico(0.08, 2), '#f2a33a', { x: s * 0.13, y: 0.02, z: 0.18, sy: 0.5 })
    this.root.add(p.build())
    const head = new THREE.Group()
    head.position.y = 1.05
    const hp = new Parts(SMOOTH)
    hp.add(ico(0.4, 2), brown, { sy: 0.88 })
    for (const s of [-1, 1]) {
      hp.add(cyl(0.16, 0.16, 0.05, 12), '#f3e6cc', { x: s * 0.16, y: 0.02, z: 0.31, rx: Math.PI / 2 - 0.2, jitter: 0 })
      hp.add(cone(0.08, 0.24, 4), brown, { x: s * 0.24, y: 0.36, rz: -s * 0.35 })
    }
    hp.add(cone(0.06, 0.15, 4), '#f2a33a', { y: -0.08, z: 0.38, rx: Math.PI / 2 + 0.4 })
    head.add(hp.build())
    const ep = new Parts(SMOOTH)
    for (const s of [-1, 1]) {
      ep.add(ico(0.075, 2), '#1d1414', { x: s * 0.16, y: 0.03, z: 0.35, sz: 0.5, jitter: 0 })
      ep.add(ico(0.025, 2), '#ffffff', { x: s * 0.16 + 0.03, y: 0.06, z: 0.385, jitter: 0 })
    }
    this.eyes = ep.build()
    head.add(this.eyes)
    const gp = new Parts(SMOOTH)
    for (const s of [-1, 1]) gp.add(torus(0.13, 0.02, 4, 12), '#3a3030', { x: s * 0.16, y: 0.03, z: 0.4, rx: -0.2, jitter: 0 })
    gp.add(box(0.08, 0.02, 0.02), '#3a3030', { y: 0.06, z: 0.42, jitter: 0 })
    this.glasses = gp.build()
    this.glasses.visible = false
    head.add(this.glasses)
    this.root.add(head)
    this.head = head
    const wings = []
    for (const s of [-1, 1]) {
      const wp = new Parts(SMOOTH)
      wp.add(ico(0.3, 2), '#86623f', { y: -0.2, sx: 0.32, sz: 0.75 })
      const w = wp.build()
      w.position.set(s * 0.42, 0.75, -0.02)
      this.root.add(w)
      wings.push(w)
    }
    ;[this.wingR, this.wingL] = wings
    this.faceH = 1.05
    this.portraitDist = 1.9
    this.finish()
  }
  update(dt, t) {
    this.head.rotation.y = lerp(this.head.rotation.y, this.lookYaw, Math.min(1, dt * 4))
    this.head.rotation.z = Math.sin(t * 0.9 + this.seed) * 0.15
    const blink = Math.sin(t * 1.3 + this.seed) > 0.97 ? 0.15 : 1
    this.eyes.scale.y = blink
    const flap = this.mood === 'happy' ? Math.sin(t * 14) * 0.6 : this.talk > 0 ? Math.sin(t * 6) * 0.15 : 0
    this.wingR.rotation.z = -Math.abs(flap)
    this.wingL.rotation.z = Math.abs(flap)
    if (this.talk > 0) this.talk -= dt
  }
}

export class Cat extends Animal {
  constructor() {
    super()
    const o = '#f0a050'
    const dark = '#d7782d'
    const p = new Parts(SMOOTH)
    p.add(ico(0.3, 2), o, { y: 0.3, sy: 1.15, sz: 1.1 })
    p.add(ico(0.18, 2), '#fff4e6', { y: 0.3, z: 0.2, sz: 0.5 })
    for (const s of [-1, 1]) p.add(ico(0.09, 2), '#fff4e6', { x: s * 0.12, y: 0.06, z: 0.24 })
    for (let i = 0; i < 3; i++) p.add(box(0.06, 0.03, 0.3), dark, { y: 0.45 - i * 0.1, z: -0.25, ry: 0, jitter: 0 })
    this.root.add(p.build())
    const head = new THREE.Group()
    head.position.set(0, 0.68, 0.08)
    const hp = new Parts(SMOOTH)
    hp.add(ico(0.26, 2), o, { sx: 1.1, sy: 0.92 })
    for (const s of [-1, 1]) {
      hp.add(cone(0.1, 0.18, 4), o, { x: s * 0.14, y: 0.22, rz: -s * 0.25 })
      hp.add(cone(0.05, 0.1, 4), '#ffb3b3', { x: s * 0.14, y: 0.2, z: 0.03, rz: -s * 0.25 })
      hp.add(ico(0.035, 2), '#1d1717', { x: s * 0.1, y: 0.03, z: 0.22, sz: 0.6, sy: 1.3, jitter: 0 })
      hp.add(box(0.14, 0.008, 0.008), '#ffffff', { x: s * 0.2, y: -0.06, z: 0.2, rz: s * 0.1, jitter: 0 })
    }
    hp.add(ico(0.1, 2), '#fff4e6', { y: -0.07, z: 0.2, sx: 1.3, sz: 0.6 })
    hp.add(ico(0.025, 2), '#ff8fa3', { y: -0.03, z: 0.26 })
    hp.add(box(0.05, 0.02, 0.02), dark, { y: 0.2, z: 0.18, jitter: 0 })
    head.add(hp.build())
    this.root.add(head)
    this.head = head
    const tail = new THREE.Group()
    tail.position.set(0, 0.12, -0.3)
    const tp = new Parts(SMOOTH)
    tp.add(cyl(0.05, 0.06, 0.5, 6), o, { y: 0.25 })
    tp.add(ico(0.06, 2), dark, { y: 0.5 })
    tail.add(tp.build())
    tail.rotation.x = -0.9
    this.root.add(tail)
    this.tail = tail
    this.faceH = 0.68
    this.portraitDist = 1.4
    this.finish()
  }
  update(dt, t) {
    this.tail.rotation.z = Math.sin(t * 2 + this.seed) * 0.5
    this.head.rotation.y = lerp(this.head.rotation.y, this.lookYaw, Math.min(1, dt * 4))
    this.head.rotation.z = this.talk > 0 ? Math.sin(t * 8) * 0.1 : Math.sin(t * 0.6) * 0.05
    if (this.talk > 0) this.talk -= dt
    if (this.mood === 'happy') this.root.position.y = this.baseY + Math.abs(Math.sin(t * 6)) * 0.12
  }
}

export class Bunny extends Animal {
  constructor() {
    super()
    const w = '#f7f4f0'
    const p = new Parts(SMOOTH)
    p.add(ico(0.32, 2), w, { y: 0.3, sz: 1.2 })
    p.add(ico(0.1, 2), '#ffffff', { y: 0.32, z: -0.38 })
    for (const s of [-1, 1]) p.add(ico(0.1, 2), w, { x: s * 0.15, y: 0.06, z: 0.25, sz: 1.5, sy: 0.5 })
    this.root.add(p.build())
    const head = new THREE.Group()
    head.position.set(0, 0.6, 0.18)
    const hp = new Parts(SMOOTH)
    hp.add(ico(0.24, 2), w)
    for (const s of [-1, 1]) {
      hp.add(ico(0.1, 2), w, { x: s * 0.09, y: 0.33, z: -0.03, sy: 3.2, sz: 0.45, rz: -s * 0.15 })
      hp.add(ico(0.06, 2), '#ffb6c8', { x: s * 0.09, y: 0.33, z: 0.015, sy: 3.4, sz: 0.3, rz: -s * 0.15, jitter: 0 })
      hp.add(ico(0.035, 2), '#1d1717', { x: s * 0.1, y: 0.04, z: 0.2, sz: 0.6, jitter: 0 })
      hp.add(ico(0.04, 2), '#ffc2d1', { x: s * 0.14, y: -0.06, z: 0.17, sz: 0.4, jitter: 0 })
    }
    hp.add(ico(0.03, 2), '#ff8fa3', { y: -0.03, z: 0.24 })
    head.add(hp.build())
    this.root.add(head)
    this.head = head
    this.faceH = 0.62
    this.portraitDist = 1.4
    this.hop = 0
    this.finish()
  }
  update(dt, t) {
    this.head.rotation.y = lerp(this.head.rotation.y, this.lookYaw, Math.min(1, dt * 4))
    this.hop -= dt
    if (this.hop < -2.5 - (this.seed % 2)) this.hop = 0.45
    const h = this.hop > 0 ? Math.sin((this.hop / 0.45) * Math.PI) * 0.25 : 0
    const happy = this.mood === 'happy' ? Math.abs(Math.sin(t * 7)) * 0.3 : 0
    this.root.position.y = this.baseY + Math.max(h, happy)
    this.head.rotation.z = this.talk > 0 ? Math.sin(t * 9) * 0.08 : 0
    if (this.talk > 0) this.talk -= dt
  }
}

export function makeDuck(white) {
  const p = new Parts(SMOOTH)
  const c = white ? '#ffffff' : '#f6d64a'
  p.add(ico(0.25, 2), c, { y: 0.12, sx: 1.0, sy: 0.75, sz: 1.35 })
  p.add(ico(0.16, 2), c, { y: 0.38, z: 0.22 })
  p.add(box(0.12, 0.05, 0.14), '#f39c34', { y: 0.36, z: 0.4, jitter: 0 })
  for (const s of [-1, 1]) p.add(ico(0.025, 2), '#111111', { x: s * 0.09, y: 0.42, z: 0.32, jitter: 0 })
  p.add(cone(0.08, 0.15, 4), c, { y: 0.2, z: -0.34, rx: -1.2 })
  return p.build()
}

export function makeGull() {
  const g = new THREE.Group()
  const p = new Parts(SMOOTH)
  p.add(ico(0.22, 2), '#ffffff', { sz: 2.0, sy: 0.8 })
  p.add(ico(0.13, 2), '#ffffff', { z: 0.42, y: 0.08 })
  p.add(cone(0.04, 0.14, 4), '#f2b134', { z: 0.6, y: 0.06, rx: Math.PI / 2 })
  g.add(p.build({ shadow: false }))
  const wings = []
  for (const s of [-1, 1]) {
    const wp = new Parts(SMOOTH)
    wp.add(box(0.75, 0.03, 0.3), '#f2f2f2', { x: s * 0.38 })
    wp.add(box(0.2, 0.035, 0.28), '#9aa3ad', { x: s * 0.68 })
    const w = wp.build({ shadow: false })
    g.add(w)
    wings.push(w)
  }
  g.userData.wings = wings
  return g
}

export function makeButterfly(hex) {
  const g = new THREE.Group()
  const wings = []
  for (const s of [-1, 1]) {
    const wp = new Parts(SMOOTH)
    wp.add(new THREE.CircleGeometry(0.16, 6), hex, { x: s * 0.13, rx: -Math.PI / 2, mat: MAT2, jitter: 0 })
    const w = wp.build({ shadow: false })
    g.add(w)
    wings.push(w)
  }
  g.userData.wings = wings
  return g
}

// ---------- spooky friends ----------

// A little sheet ghost. Boo is a friend; others pop out of graves and fade away.
export class Ghost {
  constructor(boo = false) {
    this.root = new THREE.Group()
    this.body = new THREE.Group()
    this.root.add(this.body)
    this.head = this.body
    this.seed = Math.random() * 10
    this.talk = 0
    this.mood = 'idle'
    this.lookYaw = 0
    this.speed = 0
    this.mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xcfe0ff, emissiveIntensity: 0.45, transparent: true, opacity: 0.94, side: THREE.DoubleSide })
    this.dark = new THREE.MeshBasicMaterial({ color: 0x2a2433, transparent: true })
    this.pink = new THREE.MeshBasicMaterial({ color: 0xffa3c0, transparent: true })
    const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(geo, mat)
      m.position.set(x, y, z)
      m.scale.set(sx, sy, sz)
      this.body.add(m)
      return m
    }
    add(new THREE.SphereGeometry(0.5, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), this.mat, 0, 0.75, 0)
    add(new THREE.CylinderGeometry(0.5, 0.62, 0.75, 24, 1, true), this.mat, 0, 0.38, 0)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      add(new THREE.SphereGeometry(0.13, 10, 8), this.mat, Math.cos(a) * 0.56, 0.02, Math.sin(a) * 0.56)
    }
    for (const s of [-1, 1]) {
      add(new THREE.SphereGeometry(0.07, 12, 10), this.dark, s * 0.16, 0.82, 0.45, 1, 1.4, 0.5)
      add(new THREE.SphereGeometry(0.06, 10, 8), this.pink, s * 0.29, 0.68, 0.42, 1, 0.7, 0.4)
    }
    add(new THREE.SphereGeometry(0.06, 10, 8), this.dark, 0, 0.62, 0.49, 1.2, 1, 0.4)
    this.arms = [-1, 1].map((s) => add(new THREE.SphereGeometry(0.14, 12, 10), this.mat, s * 0.6, 0.5, 0.05, 1.3, 0.7, 0.8))
    if (boo) {
      for (const s of [-1, 1]) add(new THREE.ConeGeometry(0.11, 0.2, 8), this.pink, s * 0.13, 1.22, 0.05).rotation.z = (s * Math.PI) / 2
      add(new THREE.SphereGeometry(0.06, 10, 8), this.pink, 0, 1.22, 0.05)
    }
    this.faceH = 0.78
    this.portraitDist = 2.0
  }
  setOpacity(o) {
    this.mat.opacity = o
    this.dark.opacity = o
    this.pink.opacity = o
  }
  update(dt, t) {
    this.body.position.y = Math.sin(t * 2 + this.seed) * 0.12
    this.body.rotation.z = Math.sin(t * 1.3 + this.seed) * 0.08
    this.body.rotation.y = lerp(this.body.rotation.y, this.lookYaw, Math.min(1, dt * 4))
    const w = this.mood === 'happy' ? 0.9 : this.talk > 0 ? 0.5 : 0.25
    this.arms[0].rotation.z = Math.sin(t * 3 + this.seed) * w
    this.arms[1].rotation.z = -Math.sin(t * 3 + this.seed) * w
    this.body.scale.y = 1 + (this.talk > 0 ? Math.sin(t * 10) * 0.05 : 0)
    if (this.talk > 0) this.talk -= dt
  }
  get faceY() {
    return this.faceH
  }
}

// A friendly (and not very helpful) skeleton that climbs out of a grave and wanders around.
export class Skeleton {
  constructor() {
    const bone = '#f1ede2'
    const dark = '#2a2433'
    this.root = new THREE.Group()
    this.seed = Math.random() * 10
    this.phase = 0
    this.talk = 0
    this.speed = 0
    this.lookYaw = 0
    this.mood = 'idle'
    const hipY = 0.9
    const legs = []
    for (const s of [-1, 1]) {
      const p = new Parts(SMOOTH)
      p.add(cyl(0.045, 0.04, 0.42, 8), bone, { y: -0.21, jitter: 0 })
      p.add(sphere(0.065, 10, 8), bone, { y: -0.44, jitter: 0 })
      p.add(cyl(0.04, 0.035, 0.4, 8), bone, { y: -0.65, jitter: 0 })
      p.add(box(0.12, 0.06, 0.22), bone, { y: -0.87, z: 0.05, jitter: 0 })
      const leg = p.build()
      leg.position.set(s * 0.11, hipY, 0)
      this.root.add(leg)
      legs.push(leg)
    }
    ;[this.legR, this.legL] = legs
    const body = new THREE.Group()
    body.position.y = hipY
    this.root.add(body)
    this.body = body
    const b = new Parts(SMOOTH)
    b.add(torus(0.12, 0.04, 6, 14), bone, { y: 0.02, rx: Math.PI / 2, sz: 0.7, jitter: 0 })
    b.add(cyl(0.035, 0.035, 0.7, 8), bone, { y: 0.35, jitter: 0 })
    for (let i = 0; i < 3; i++) b.add(torus(0.17 - i * 0.025, 0.024, 6, 16), bone, { y: 0.38 + i * 0.1, rx: Math.PI / 2, sy: 0.7, jitter: 0 })
    b.add(box(0.52, 0.06, 0.08), bone, { y: 0.7, jitter: 0 })
    body.add(b.build())
    const head = new THREE.Group()
    head.position.y = 0.95
    const h = new Parts(SMOOTH)
    h.add(sphere(0.24, 18, 14), bone, { sy: 0.95, jitter: 0 })
    for (const s of [-1, 1]) h.add(sphere(0.07, 10, 8), dark, { x: s * 0.09, y: 0.02, z: 0.19, sz: 0.6, jitter: 0 })
    h.add(cone(0.035, 0.06, 3), dark, { y: -0.06, z: 0.22, rx: Math.PI, jitter: 0 })
    head.add(h.build())
    const j = new Parts(SMOOTH)
    j.add(box(0.26, 0.07, 0.16), bone, { y: -0.03, z: 0.08, jitter: 0 })
    for (let i = 0; i < 5; i++) j.add(box(0.035, 0.04, 0.02), '#ffffff', { x: -0.08 + i * 0.04, y: 0.02, z: 0.16, jitter: 0 })
    const jaw = j.build()
    jaw.position.set(0, -0.15, 0)
    head.add(jaw)
    this.jaw = jaw
    body.add(head)
    this.head = head
    const arms = []
    for (const s of [-1, 1]) {
      const p = new Parts(SMOOTH)
      p.add(cyl(0.035, 0.03, 0.32, 8), bone, { y: -0.16, jitter: 0 })
      p.add(sphere(0.05, 8, 6), bone, { y: -0.33, jitter: 0 })
      p.add(cyl(0.03, 0.028, 0.3, 8), bone, { y: -0.49, jitter: 0 })
      p.add(sphere(0.06, 8, 6), bone, { y: -0.66, sx: 1.2, sy: 0.8, jitter: 0 })
      const arm = p.build()
      arm.position.set(s * 0.28, 0.7, 0)
      arm.rotation.z = s * 0.1
      body.add(arm)
      arms.push(arm)
    }
    ;[this.armR, this.armL] = arms
    this.faceH = 1.85
    this.portraitDist = 2.2
    this.root.traverse((m) => {
      if (m.isMesh) m.castShadow = true
    })
  }
  update(dt, t) {
    const moving = this.speed > 0.1
    if (moving) this.phase += dt * this.speed * 5
    const sw = moving ? Math.sin(this.phase) : 0
    this.legL.rotation.x = sw * 0.6
    this.legR.rotation.x = -sw * 0.6
    this.armL.rotation.x = -sw * 0.7 + Math.sin(t * 7) * 0.05
    this.armR.rotation.x = sw * 0.7 - Math.sin(t * 6) * 0.05
    this.body.rotation.z = moving ? Math.sin(this.phase * 2) * 0.05 : Math.sin(t * 1.5 + this.seed) * 0.03
    this.head.rotation.y = lerp(this.head.rotation.y, this.lookYaw, Math.min(1, dt * 4))
    this.head.rotation.z = Math.sin(t * 2.3 + this.seed) * 0.12
    this.jaw.rotation.x = this.talk > 0 ? Math.abs(Math.sin(t * 14)) * 0.4 : Math.abs(Math.sin(t * 3)) * 0.06
    if (this.talk > 0) this.talk -= dt
  }
  get faceY() {
    return this.faceH
  }
}

// ---------- animals and people that come and go ----------

// Small animals with a little walk. kind: deer, fox, chicken, squirrel, hedgehog, crab, frog, duckling.
export class Critter {
  constructor(kind) {
    this.kind = kind
    this.root = new THREE.Group()
    this.body = new THREE.Group()
    this.root.add(this.body)
    this.seed = Math.random() * 10
    this.phase = 0
    this.speed = 0
    this.talk = 0
    this.lookYaw = 0
    this.legs = []
    const p = new Parts(SMOOTH)
    const legs = (pts, len, r, c) => {
      for (const [x, z] of pts) {
        const lp = new Parts(SMOOTH)
        lp.add(cyl(r, r * 0.8, len, 8), c, { y: -len / 2, jitter: 0 })
        const leg = lp.build()
        leg.position.set(x, len, z)
        this.root.add(leg)
        this.legs.push(leg)
      }
    }
    const eyes = (x, y, z, r = 0.035) => {
      for (const s of [-1, 1]) {
        p.add(sphere(r, 8, 6), '#1d1717', { x: s * x, y, z, jitter: 0 })
        p.add(sphere(r * 0.35, 6, 4), '#ffffff', { x: s * x + r * 0.3, y: y + r * 0.4, z: z + r * 0.6, jitter: 0 })
      }
    }
    let faceH = 0.6
    switch (kind) {
      case 'deer': {
        const c = '#b07a4a'
        p.add(sphere(0.45, 16, 12), c, { y: 1.0, sx: 0.85, sz: 1.6 })
        for (const [x, z] of [[0.18, 0.2], [-0.15, -0.1], [0.12, -0.35], [-0.2, 0.3]]) p.add(sphere(0.05, 6, 4), '#fff4e0', { x, y: 1.32, z, jitter: 0 })
        p.add(cyl(0.12, 0.15, 0.6, 10), c, { y: 1.45, z: 0.55, rx: 0.5 })
        p.add(sphere(0.2, 14, 10), c, { y: 1.78, z: 0.75, sz: 1.3 })
        p.add(sphere(0.08, 8, 6), '#2b1d14', { y: 1.74, z: 1.0 })
        for (const s of [-1, 1]) {
          p.add(sphere(0.08, 8, 6), c, { x: s * 0.17, y: 1.95, z: 0.68, sx: 0.6, sy: 1.5 })
          p.add(cyl(0.02, 0.03, 0.35, 5), '#7a5a3a', { x: s * 0.09, y: 2.1, z: 0.7, rz: -s * 0.4 })
        }
        eyes(0.12, 1.84, 0.9, 0.04)
        p.add(sphere(0.08, 8, 6), '#ffffff', { y: 1.15, z: -0.7 })
        legs([[0.22, 0.45], [-0.22, 0.45], [0.22, -0.45], [-0.22, -0.45]], 0.8, 0.05, '#8a5a35')
        faceH = 1.8
        break
      }
      case 'fox': {
        const c = '#e8742a'
        p.add(sphere(0.3, 14, 10), c, { y: 0.48, sz: 1.6 })
        p.add(sphere(0.18, 10, 8), '#fff4e6', { y: 0.42, z: 0.32, sz: 0.7 })
        p.add(sphere(0.22, 14, 10), c, { y: 0.72, z: 0.5 })
        p.add(cone(0.11, 0.25, 8), '#fff4e6', { y: 0.66, z: 0.72, rx: Math.PI / 2 })
        p.add(sphere(0.04, 6, 4), '#1d1717', { y: 0.67, z: 0.85 })
        for (const s of [-1, 1]) p.add(cone(0.08, 0.2, 5), c, { x: s * 0.12, y: 0.95, z: 0.45, rz: -s * 0.2 })
        eyes(0.09, 0.78, 0.68)
        p.add(sphere(0.18, 12, 8), c, { y: 0.55, z: -0.62, sz: 2.2, rx: -0.5 })
        p.add(sphere(0.1, 8, 6), '#ffffff', { y: 0.72, z: -0.95 })
        legs([[0.12, 0.25], [-0.12, 0.25], [0.12, -0.25], [-0.12, -0.25]], 0.35, 0.04, '#3b2a1e')
        faceH = 0.75
        break
      }
      case 'chicken': {
        p.add(sphere(0.25, 14, 10), '#ffffff', { y: 0.45, sz: 1.2 })
        p.add(sphere(0.14, 12, 10), '#ffffff', { y: 0.72, z: 0.15 })
        p.add(cone(0.05, 0.12, 5), '#f2a33a', { y: 0.7, z: 0.3, rx: Math.PI / 2 })
        for (let i = 0; i < 3; i++) p.add(sphere(0.04, 6, 4), '#e94b3c', { y: 0.86 + (i % 2) * 0.02, z: 0.1 + i * 0.05 })
        p.add(sphere(0.04, 6, 4), '#e94b3c', { y: 0.62, z: 0.26 })
        eyes(0.07, 0.75, 0.25, 0.025)
        p.add(cone(0.12, 0.25, 6), '#ffffff', { y: 0.6, z: -0.32, rx: -0.9 })
        legs([[0.08, 0], [-0.08, 0]], 0.25, 0.02, '#f2a33a')
        faceH = 0.72
        break
      }
      case 'squirrel': {
        const c = '#b5582f'
        p.add(sphere(0.16, 12, 10), c, { y: 0.28, sy: 1.3 })
        p.add(sphere(0.12, 12, 10), c, { y: 0.52, z: 0.06 })
        for (const s of [-1, 1]) p.add(cone(0.04, 0.1, 5), c, { x: s * 0.06, y: 0.66, z: 0.04 })
        eyes(0.05, 0.55, 0.15, 0.02)
        p.add(sphere(0.13, 10, 8), '#c8693a', { y: 0.42, z: -0.2, sy: 2.0, sz: 0.8, rx: -0.3 })
        legs([[0.06, 0.06], [-0.06, 0.06]], 0.12, 0.025, c)
        faceH = 0.52
        break
      }
      case 'hedgehog': {
        p.add(sphere(0.22, 12, 8, 0, Math.PI / 2), '#7a5a3a', { y: 0.08, sz: 1.3 })
        for (let i = 0; i < 26; i++) {
          const a = (i / 26) * Math.PI * 2
          const r = 0.12 + (i % 3) * 0.04
          p.add(cone(0.04, 0.16, 4), '#5a4030', { x: Math.cos(a) * r, y: 0.18 + (i % 2) * 0.04, z: Math.sin(a) * r * 1.2 - 0.03, rx: Math.sin(a) * 0.8 - 0.4, rz: -Math.cos(a) * 0.8, jitter: 0 })
        }
        p.add(sphere(0.1, 10, 8), '#e8cfae', { y: 0.12, z: 0.25, sz: 1.3 })
        p.add(sphere(0.025, 6, 4), '#1d1717', { y: 0.12, z: 0.38 })
        eyes(0.05, 0.17, 0.28, 0.018)
        faceH = 0.18
        break
      }
      case 'crab': {
        const c = '#e8533e'
        p.add(sphere(0.22, 12, 8), c, { y: 0.18, sy: 0.5, sx: 1.3 })
        for (const s of [-1, 1]) {
          p.add(cyl(0.015, 0.015, 0.12, 5), c, { x: s * 0.07, y: 0.3, z: 0.1 })
          p.add(sphere(0.035, 8, 6), '#ffffff', { x: s * 0.07, y: 0.37, z: 0.1, jitter: 0 })
          p.add(sphere(0.018, 6, 4), '#1d1717', { x: s * 0.07, y: 0.38, z: 0.13, jitter: 0 })
          p.add(sphere(0.09, 8, 6), c, { x: s * 0.33, y: 0.24, z: 0.12, sy: 0.7 })
          for (let i = 0; i < 3; i++) p.add(cyl(0.015, 0.012, 0.22, 4), c, { x: s * 0.28, y: 0.1, z: -0.1 + i * 0.1, rz: s * 1.1 })
        }
        faceH = 0.3
        break
      }
      case 'frog': {
        const c = '#5cbf4a'
        p.add(sphere(0.2, 14, 10), c, { y: 0.18, sz: 1.2, sy: 0.8 })
        for (const s of [-1, 1]) {
          p.add(sphere(0.07, 10, 8), c, { x: s * 0.09, y: 0.33, z: 0.08 })
          p.add(sphere(0.045, 8, 6), '#1d1717', { x: s * 0.1, y: 0.36, z: 0.12, jitter: 0 })
          p.add(sphere(0.08, 8, 6), c, { x: s * 0.17, y: 0.06, z: -0.1, sx: 0.7, sz: 1.6 })
        }
        p.add(box(0.16, 0.012, 0.01), '#2e6b24', { y: 0.18, z: 0.23, jitter: 0 })
        faceH = 0.3
        break
      }
      default: {
        // duckling
        p.add(sphere(0.16, 12, 10), '#ffe066', { y: 0.2, sz: 1.3 })
        p.add(sphere(0.1, 10, 8), '#ffe066', { y: 0.38, z: 0.12 })
        p.add(box(0.08, 0.03, 0.08), '#f39c34', { y: 0.36, z: 0.24, jitter: 0 })
        eyes(0.05, 0.42, 0.18, 0.018)
        legs([[0.05, 0], [-0.05, 0]], 0.08, 0.015, '#f39c34')
        faceH = 0.38
      }
    }
    this.body.add(p.build())
    this.faceH = faceH
    this.portraitDist = Math.max(1.2, faceH * 1.6)
    this.root.traverse((m) => {
      if (m.isMesh) m.castShadow = true
    })
  }
  get faceY() {
    return this.faceH
  }
  get head() {
    return this.body
  }
  update(dt, t) {
    const moving = this.speed > 0.1
    if (moving) this.phase += dt * this.speed * 8
    const sw = moving ? Math.sin(this.phase) : 0
    this.legs.forEach((l, i) => (l.rotation.x = (i % 2 ? sw : -sw) * 0.6))
    const hop = this.kind === 'frog' || this.kind === 'squirrel' ? Math.abs(Math.sin(this.phase * 0.5)) * 0.25 * (moving ? 1 : 0) : 0
    this.body.position.y = hop + (moving ? Math.abs(sw) * 0.03 : Math.sin(t * 2 + this.seed) * 0.01)
    this.body.rotation.z = this.talk > 0 ? Math.sin(t * 9) * 0.08 : 0
    if (this.talk > 0) this.talk -= dt
  }
}

// A random villager look.
const SKINS = ['#ffd7bf', '#f6c9a8', '#e8b48f', '#d9a27c', '#c68b62', '#a8704a']
const HAIRS = ['#1b1b22', '#3b2a1f', '#6b4a2b', '#c46a2b', '#e8a93a', '#ebe7e1']
const SHIRTS = ['#e94b3c', '#3b7dd8', '#5ac46f', '#ffcf3f', '#b38bff', '#ff8fb1', '#4fb0a5', '#ffffff', '#f5a742']
const PANTS = ['#3b5998', '#2f3b4a', '#5a6b8c', '#7a5a3a', '#41607a', '#8a929e']
export function randomLook(rand, kid) {
  const p = (a) => a[Math.floor(rand() * a.length)]
  const dress = rand() < 0.35
  const look = {
    kid,
    skin: p(SKINS),
    hair: p(HAIRS),
    hairStyle: p(['short', 'bob', 'bun', 'pigtails', 'short']),
    shirt: p(SHIRTS),
    pants: p(PANTS),
    pantsLong: !kid && rand() < 0.7,
    shoes: p(['#2a2a2a', '#7a5a3a', '#e94b3c', '#3b7dd8']),
    soles: '#f4f2ec',
  }
  if (dress) look.dress = p(SHIRTS)
  if (rand() < 0.35) look.stripes = '#ffffff'
  if (rand() < 0.3) {
    look.hat = p(['cap', 'bucket'])
    look.hatColor = p(SHIRTS)
  }
  if (!kid && rand() < 0.15) look.glasses = '#333333'
  if (kid) look.socks = '#ffffff'
  return look
}

export const RESIDENT_LOOKS = [
  { skin: '#f5d3ba', hair: '#d9d4cc', hairStyle: 'bun', shirt: '#ff8fb1', dress: '#e94b6b', longSleeves: true, pants: '#e94b6b', shoes: '#7a5a3a', apron: '#ffffff' },
  { skin: '#f3cfb0', hair: '#6b4a2b', hairStyle: 'short', hat: 'chef', shirt: '#ffffff', apron: '#f5a742', pants: '#5a6b8c', pantsLong: true, shoes: '#2a2a2a' },
  { skin: '#e8b894', hair: '#1b1b22', hairStyle: 'bob', shirt: '#4fb0a5', stripes: '#ffffff', dress: '#3b7dd8', pants: '#3b7dd8', shoes: '#ff6f91', hat: 'bucket', hatColor: '#ffcf3f' },
  { skin: '#f0c8a8', hair: '#f4f4f4', hairStyle: 'bald', beard: '#f4f4f4', glasses: '#7a4a2a', shirt: '#7b9a5a', coat: '#6b4a2b', longSleeves: true, pants: '#4a4a5a', pantsLong: true, shoes: '#3a2a1a' },
  { kid: true, skin: '#ffd7bf', hair: '#c46a2b', hairStyle: 'pigtails', shirt: '#ffcf3f', dress: '#5bc0eb', pants: '#5bc0eb', socks: '#ffffff', shoes: '#e94b3c' },
  { skin: '#d9a27c', hair: '#2d1e14', hairStyle: 'short', glasses: '#333333', shirt: '#ffffff', coat: '#ffffff', longSleeves: true, pants: '#3b5998', pantsLong: true, shoes: '#2a2a2a', bow: '#3b7dd8' },
]

LOOKS.sam = { skin: '#d9a27c', hair: '#f4f4f4', hairStyle: 'bald', beard: '#f4f4f4', hat: 'bucket', hatColor: '#3b7dd8', shirt: '#ffffff', stripes: '#e94b3c', pants: '#5a6b8c', pantsLong: true, shoes: '#6b4a2b' }
LOOKS.pam = { skin: '#f7d6c0', hair: '#c46a2b', hairStyle: 'pigtails', hat: 'bucket', hatColor: '#ff8fb1', shirt: '#ffffff', dress: '#ffcf3f', pants: '#ffcf3f', shoes: '#ff6f91' }
LOOKS.guard = { skin: '#f2c9a6', hair: '#3b2a1f', hairStyle: 'short', hat: 'helmet', shirt: '#c9ced6', stripes: '#b3bac5', coat: '#3f63c9', belt: '#6b4a2b', gloves: '#a8afba', longSleeves: true, pants: '#8a929e', pantsLong: true, shoes: '#5b6270', shield: '#3f63c9', spear: true }
LOOKS.percy = { ...LOOKS.guard, skin: '#d9a27c', cape: '#3f63c9', shield: '#e94b3c' }
LOOKS.alien = { skin: '#8fe08a', hair: '#8fe08a', hairStyle: 'none', antennae: true, bigEyes: true, shirt: '#c9d3df', stripes: '#a8b6c8', pants: '#c9d3df', pantsLong: true, shoes: '#6b7a8c', gloves: '#8fe08a' }
