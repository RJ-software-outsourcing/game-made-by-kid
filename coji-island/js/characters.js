// Coji, the islanders and the animals: smooth models built from colored primitives (one mesh per
// moving part, so each is one draw call), with simple procedural animation (walk, breathe, look,
// talk, wave). v0.4: rounder shapes, detailed faces (iris, pupil, catch-lights, lids, brows), hair
// made of soft tufts with a shine, clothes with collars, cuffs, seams and buttons, real-looking shoes,
// and animals with shaded fur, paws and glossy eyes.
import * as THREE from 'three'
import { Parts, MAT2, SMOOTH, SMOOTH2, box, cyl, cone, ico, sphere, torus } from './build.js'
import { UNIFORM, BLANKIE, COJI, BACKPACK } from './config.js'
import { mergeRig } from './rig.js'

const KID = { leg: 0.44, hip: 0.15, torso: 0.46, bodyR: 0.25, headR: 0.4, arm: 0.42, armR: 0.072, legR: 0.09, neck: 0.03 }
const ADULT = { leg: 0.7, hip: 0.18, torso: 0.66, bodyR: 0.33, headR: 0.39, arm: 0.6, armR: 0.092, legR: 0.115, neck: 0.06 }
// a "grey" alien: thin body, long arms, a big head
const GREY = { leg: 0.6, hip: 0.13, torso: 0.52, bodyR: 0.2, headR: 0.5, arm: 0.66, armR: 0.055, legR: 0.07, neck: 0.1 }

const lerp = (a, b, t) => a + (b - a) * t
// Detail level while a person is being built: Coji gets the most, passers-by the fewest triangles.
let Q = 1
const S = (n, min = 3) => Math.max(min, Math.round(n * Q))
const darker = (hex, k = 0.85) => new THREE.Color(hex).multiplyScalar(k)
const lighter = (hex, k = 0.25) => new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), k)
const mixc = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t)
const lum = (hex) => {
  const c = new THREE.Color(hex)
  return c.r * 0.3 + c.g * 0.59 + c.b * 0.11
}

// ---------- geometry helpers (cached: every islander shares them) ----------

const gcache = new Map()
const cachedGeo = (key, make) => {
  let g = gcache.get(key)
  if (!g) {
    g = make()
    gcache.set(key, g)
  }
  return g
}

// Vertices on a seam (the same spot twice) get one shared normal, so deformed spheres stay smooth.
function weldNormals(g) {
  const pos = g.attributes.position
  const nor = g.attributes.normal
  const map = new Map()
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`
    let a = map.get(k)
    if (!a) map.set(k, (a = []))
    a.push(i)
  }
  const v = new THREE.Vector3()
  for (const ids of map.values()) {
    if (ids.length < 2) continue
    v.set(0, 0, 0)
    for (const i of ids) v.set(v.x + nor.getX(i), v.y + nor.getY(i), v.z + nor.getZ(i))
    v.normalize()
    for (const i of ids) nor.setXYZ(i, v.x, v.y, v.z)
  }
  return g
}

// A rounded box (a superellipsoid): boxy, with soft edges and smooth shading.
function rbox(w, h, d, e = 0.3, ws = 20, hs = 14) {
  return cachedGeo(`rb${w},${h},${d},${e},${ws},${hs}`, () => {
    const g = new THREE.SphereGeometry(1, ws, hs)
    const p = g.attributes.position
    const f = (v) => Math.sign(v) * Math.pow(Math.abs(v), e)
    for (let i = 0; i < p.count; i++) p.setXYZ(i, (f(p.getX(i)) * w) / 2, (f(p.getY(i)) * h) / 2, (f(p.getZ(i)) * d) / 2)
    g.computeVertexNormals()
    return weldNormals(g)
  })
}

// A capsule (limbs, fingers, bones).
const capsule = (r, len, cs = 5, rs = 14) => cachedGeo(`cap${r},${len},${cs},${rs}`, () => new THREE.CapsuleGeometry(r, len, cs, rs))

// An open tube whose radius ripples around (pleated skirts, capes, chef hats). `arc` limits it to part
// of the way round, centred on `center` (0 = front, PI = back).
function pleated(rTop, rBot, h, n, amp, { seg = 40, rows = 4, arc = Math.PI * 2, center = 0, flare = 1 } = {}) {
  return cachedGeo(`pl${rTop},${rBot},${h},${n},${amp},${seg},${rows},${arc},${center},${flare}`, () => {
    const t0 = arc >= Math.PI * 2 ? 0 : center - arc / 2
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, rows, true, t0, arc)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const y = p.getY(i)
      const z = p.getZ(i)
      const t = Math.pow((h / 2 - y) / h, flare) // 0 at the top, 1 at the hem
      const a = Math.atan2(x, z)
      const k = 1 + Math.sin(a * n) * amp * t
      p.setXYZ(i, x * k, y, z * k)
    }
    g.computeVertexNormals()
    return weldNormals(g)
  })
}

// Brighten or darken everything painted so far by position (fur: lighter belly, darker back).
function shadeAll(p, f) {
  for (const grp of p.groups.values())
    for (let i = 0; i < grp.pos.length; i += 3) {
      const k = f(grp.pos[i], grp.pos[i + 1], grp.pos[i + 2])
      grp.col[i] *= k
      grp.col[i + 1] *= k
      grp.col[i + 2] *= k
    }
}

// A glossy animal eye: dark ball, colored iris, pupil (round or a slit) and two catch-lights.
// It faces `ry` (yaw) / `rx` (pitch); x, y, z is its centre (sit it a little inside the head).
const _eu = new THREE.Euler()
function animalEye(p, x, y, z, r, o = {}) {
  const R = { rx: o.rx ?? 0, ry: o.ry ?? 0, order: 'YXZ' }
  _eu.set(R.rx, R.ry, 0, 'YXZ')
  const f = new THREE.Vector3(0, 0, 1).applyEuler(_eu)
  const rt = new THREE.Vector3(1, 0, 0).applyEuler(_eu)
  const up = new THREE.Vector3(0, 1, 0).applyEuler(_eu)
  const at = (d, a = 0, b = 0) => ({ x: x + f.x * d + rt.x * a + up.x * b, y: y + f.y * d + rt.y * a + up.y * b, z: z + f.z * d + rt.z * a + up.z * b })
  const sy = o.sy ?? 1
  p.add(sphere(r, S(12), S(9)), o.base || '#17100e', { ...at(0), sy, sz: 0.5, ...R, jitter: 0, rough: 0.15 })
  if (o.iris) {
    p.add(sphere(r * 0.75, S(12), S(9)), o.iris, { ...at(r * 0.18), sy, sz: 0.55, ...R, jitter: 0, rough: 0.1 })
    p.add(sphere(r * 0.4, S(9), S(8)), '#060404', { ...at(r * 0.42), sx: o.slit ? 0.32 : 1, sy: o.slit ? 1.6 * sy : sy, sz: 0.5, ...R, jitter: 0, rough: 0.1 })
  }
  p.add(sphere(r * 0.27, S(8), S(6)), '#ffffff', { ...at(r * 0.5, r * 0.3, r * 0.34 * sy), sz: 0.5, ...R, jitter: 0, rough: 0.05 })
  p.add(sphere(r * 0.12, S(6), S(4)), '#ffffff', { ...at(r * 0.45, -r * 0.26, -r * 0.3 * sy), sz: 0.5, ...R, jitter: 0, rough: 0.05 })
}

// ---------- heads ----------

// A head: a sphere with fuller cheeks low on the sides, a softer chin and a slightly flatter face.
const cheekK = (r, y, z) => {
  const low = Math.max(0, -y / r)
  const fr = Math.max(0, z / r)
  return 1 + 0.06 * Math.sin(Math.min(1, low * 1.8) * Math.PI) * (0.4 + 0.6 * fr) - 0.08 * Math.pow(low, 2.5)
}
function headGeo(r) {
  const ws = S(30)
  const hs = S(21)
  return cachedGeo(`head${r},${ws},${hs}`, () => {
    const g = new THREE.SphereGeometry(r, ws, hs)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const y = p.getY(i)
      const z = p.getZ(i)
      const low = Math.max(0, -y / r)
      const fr = Math.max(0, z / r)
      p.setXYZ(i, x * cheekK(r, y, z), y * 0.97, z * (1 - 0.035 * low - 0.02 * Math.pow(fr, 4)))
    }
    g.computeVertexNormals()
    return weldNormals(g)
  })
}
// Where the face is at (x, y): its depth z and the way the skin faces (for placing features).
function onFace(r, x, y) {
  const yy = y / 0.97
  let z = Math.sqrt(Math.max(1e-4, r * r - x * x - yy * yy))
  const x0 = x / cheekK(r, yy, z)
  z = Math.sqrt(Math.max(1e-4, r * r - x0 * x0 - yy * yy))
  const low = Math.max(0, -yy / r)
  const n = new THREE.Vector3(x0, yy, z).normalize()
  return { z: z * (1 - 0.035 * low - 0.02 * Math.pow(z / r, 4)), n }
}
// A feature lying on the face at (fx, fy): returns a placer `at(d, a, b)` (d out of the skin, a/b
// along it) and the rotation that turns a part to face out of the skin.
function facePlace(r, fx, fy) {
  const { z, n } = onFace(r, fx, fy)
  const right = new THREE.Vector3(n.z, 0, -n.x).normalize()
  const up = new THREE.Vector3().crossVectors(n, right)
  const rot = { rx: -Math.asin(n.y), ry: Math.atan2(n.x, n.z), order: 'YXZ' }
  const at = (d, a = 0, b = 0) => ({ x: fx + n.x * d + right.x * a + up.x * b, y: fy + n.y * d + right.y * a + up.y * b, z: z + n.z * d + right.z * a + up.z * b })
  return { at, rot }
}

const GIRLY = new Set(['bob', 'pigtails', 'bun'])

// One eye: a dark rim, a colored iris, the pupil, two catch-lights and an upper lid line (with lashes
// for some). Everything lies on the face, so the eye never sinks or floats.
function addEye(p, r, s, o) {
  const big = !!o.bigEyes
  const er = big ? r * 0.21 : r * 0.135
  const ex = s * r * (big ? 0.37 : 0.34)
  const ey = -r * 0.04
  const { at, rot } = facePlace(r, ex, ey)
  const iris = o.eyes || (big ? '#1d3a26' : '#4a2c1e')
  p.add(sphere(er, S(14), S(10)), '#1a1210', { ...at(-er * 0.32), sy: 1.15, sz: 0.5, ...rot, jitter: 0, rough: 0.2 })
  p.add(sphere(er * 0.8, S(14), S(10)), iris, { ...at(-er * 0.18, 0, -er * 0.1), sy: 1.12, sz: 0.5, ...rot, jitter: 0, rough: 0.12 })
  p.add(sphere(er * 0.45, S(10), S(8)), '#090606', { ...at(er * 0.05, 0, -er * 0.08), sy: 1.1, sz: 0.45, ...rot, jitter: 0, rough: 0.1 })
  p.add(sphere(er * 0.25, S(8), S(6)), '#ffffff', { ...at(er * 0.2, er * 0.28, er * 0.34), sz: 0.4, ...rot, jitter: 0, rough: 0.05 })
  p.add(sphere(er * 0.11, S(6), S(4)), '#ffffff', { ...at(er * 0.2, -er * 0.24, -er * 0.4), sz: 0.4, ...rot, jitter: 0, rough: 0.05 })
  // the upper lid line arching over the eye
  const arc = Math.PI * 0.92
  p.add(torus(er * 1.0, er * 0.085, S(4), S(14), arc), '#1a1210', { ...at(-er * 0.06), sy: 1.15, ...rot, rz: Math.PI / 2 - arc / 2, jitter: 0, rough: 0.4 })
  if (GIRLY.has(o.hairStyle) && !o.beard)
    for (let i = 0; i < 2; i++) {
      const a = Math.PI / 2 - s * (0.75 + i * 0.32)
      p.add(cone(er * 0.07, er * 0.38, S(4)), '#1a1210', {
        ...at(-er * 0.02, Math.cos(a) * er * 1.05, Math.sin(a) * er * 1.2),
        ...rot,
        rz: a - Math.PI / 2 - s * 0.2,
        jitter: 0,
      })
    }
  if (o.hairStyle !== 'none') {
    const brow = o.brows || darker(o.hair, lum(o.hair) > 0.75 ? 0.92 : 0.8)
    const b = facePlace(r, ex + s * r * 0.01, ey + er * 1.15 + r * 0.1)
    const ba = Math.PI * 0.55
    p.add(torus(r * 0.13, r * 0.024, S(4), S(10), ba), brow, { ...b.at(-r * 0.004), sx: 1.05, ...b.rot, rz: Math.PI / 2 - ba / 2 + s * 0.08, jitter: 0, rough: 0.6 })
  }
}

// The grey alien's face: a big bulb of a head that narrows to a small pointed chin, huge glossy black
// almond eyes that slant up at the sides, two tiny nostrils and a small, thin mouth. No ears.
function addGreyFace(p, r, o) {
  const g = new THREE.SphereGeometry(r, S(32), S(24))
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const t = y / r
    const k = t > 0 ? 1 + 0.22 * t : 1 - 0.5 * Math.pow(-t, 1.3)
    pos.setXYZ(i, x * k, y * (t > 0 ? 1.12 : 1.08), z * (t > 0 ? 1 + 0.12 * t : 1 - 0.2 * -t))
  }
  g.computeVertexNormals()
  p.add(g, o.skin, { jitter: 0.03, rough: 0.48, flat: false })
  for (const s of [-1, 1]) {
    const { at, rot } = facePlace(r, s * r * 0.36, -r * 0.02)
    p.add(sphere(r * 0.3, S(18), S(12)), '#07070b', { ...at(-r * 0.1), sx: 1.25, sy: 0.82, sz: 0.42, ...rot, rz: s * 0.36, jitter: 0, rough: 0.05, metal: 0.25 })
    p.add(sphere(r * 0.06, S(8), S(6)), '#ffffff', { ...at(r * 0.04, -s * r * 0.06, r * 0.09), sz: 0.4, ...rot, jitter: 0, rough: 0.05 })
    p.add(sphere(r * 0.025, S(6), S(4)), '#ffffff', { ...at(r * 0.04, s * r * 0.08, -r * 0.06), sz: 0.4, ...rot, jitter: 0, rough: 0.05 })
  }
  for (const s of [-1, 1]) {
    const n = facePlace(r, s * r * 0.045, -r * 0.33)
    p.add(sphere(r * 0.018, S(6), S(4)), darker(o.skin, 0.55), { ...n.at(-r * 0.006), ...n.rot, sz: 0.4, jitter: 0 })
  }
  const m = facePlace(r, 0, -r * 0.5)
  p.add(box(r * 0.16, r * 0.012, r * 0.02), darker(o.skin, 0.5), { ...m.at(-r * 0.01), ...m.rot, jitter: 0 })
}

// Closed eyes: a skin-colored lid over each eye with a soft curved lash line (like a happy, sleepy
// smile). Built as their own piece so they can be shrunk away while the eyes are open.
function addLids(p, r, o) {
  const big = !!o.bigEyes
  const er = big ? r * 0.21 : r * 0.135
  for (const s of [-1, 1]) {
    const { at, rot } = facePlace(r, s * r * (big ? 0.37 : 0.34), -r * 0.04)
    p.add(sphere(er * 1.12, S(14), S(10)), o.skin, { ...at(-er * 0.14), sy: 1.2, sz: 0.45, ...rot, jitter: 0, rough: 0.62 })
    const arc = Math.PI * 0.8
    p.add(torus(er * 0.7, er * 0.09, S(4), S(14), arc), '#1a1210', { ...at(er * 0.32, 0, er * 0.15), ...rot, rz: -Math.PI / 2 - arc / 2, jitter: 0, rough: 0.4 })
  }
}

function addFace(p, r, o) {
  if (o.grey) return addGreyFace(p, r, o)
  p.add(headGeo(r), o.skin, { jitter: 0, rough: 0.62 })
  // ears: the outer ear and a darker hollow
  for (const s of [-1, 1]) {
    p.add(sphere(r * 0.2, S(12), S(9)), o.skin, { x: s * r * 1.0, y: -r * 0.07, z: -r * 0.03, sx: 0.45, sz: 0.78, ry: s * 0.25, jitter: 0, rough: 0.62 })
    p.add(sphere(r * 0.12, S(9), S(8)), darker(o.skin, 0.84), { x: s * r * 1.075, y: -r * 0.075, z: r * 0.01, sx: 0.22, sz: 0.7, sy: 0.85, ry: s * 0.25, jitter: 0, rough: 0.7 })
  }
  for (const s of [-1, 1]) {
    addEye(p, r, s, o)
    // soft blush
    const c = facePlace(r, s * r * 0.56, -r * 0.25)
    p.add(sphere(r * 0.12, S(10), S(8)), mixc(o.skin, o.cheeks || '#f4a6a0', 0.55), { ...c.at(-r * 0.022), sy: 0.8, sz: 0.3, ...c.rot, jitter: 0, rough: 0.7 })
  }
  // nose
  const nz = facePlace(r, 0, -r * 0.13)
  p.add(sphere(r * 0.075, S(10), S(8)), darker(o.skin, 0.93), { ...nz.at(-r * 0.012), sx: 1.15, sy: 0.9, sz: 0.75, ...nz.rot, jitter: 0, rough: 0.68 })
  // mouth: an open smile with a tongue for kids, a gentle smile for grown-ups
  if (o.kid) {
    const m = facePlace(r, 0, -r * 0.29)
    p.add(sphere(r * 0.09, S(14), S(6), Math.PI / 2, Math.PI / 2), '#6e2626', { ...m.at(-r * 0.014), sx: 1.15, sy: 0.75, sz: 0.35, ...m.rot, jitter: 0, rough: 0.35 })
    p.add(sphere(r * 0.05, S(9), S(6)), '#e2716b', { ...m.at(-r * 0.012, 0, -r * 0.045), sx: 1.3, sy: 0.6, sz: 0.3, ...m.rot, jitter: 0, rough: 0.35 })
  } else {
    const m = facePlace(r, 0, -r * 0.27)
    const a = Math.PI * 0.62
    p.add(torus(r * 0.1, r * 0.02, S(4), S(12), a), '#8a3a34', { ...m.at(-r * 0.008, 0, r * 0.07), ...m.rot, rz: -Math.PI / 2 - a / 2, jitter: 0, rough: 0.4 })
  }
  if (o.glasses) {
    const ex = r * 0.34
    const gs = []
    for (const s of [-1, 1]) {
      const g = facePlace(r, s * ex, -r * 0.04)
      gs.push(g)
      p.add(torus(r * 0.185, r * 0.022, S(6), S(21)), o.glasses, { ...g.at(r * 0.07), sy: 0.9, ...g.rot, jitter: 0, rough: 0.3, metal: 0.3 })
      // the arm back to the ear
      p.add(box(r * 0.025, r * 0.03, r * 0.32), o.glasses, { x: s * r * 0.67, y: -r * 0.01, z: r * 0.77, ry: -s * 1.01, jitter: 0, rough: 0.3, metal: 0.3 })
    }
    const nb = facePlace(r, 0, r * 0.0)
    p.add(torus(r * 0.07, r * 0.018, S(4), S(9), Math.PI), o.glasses, { ...nb.at(r * 0.07), ...nb.rot, jitter: 0, rough: 0.3, metal: 0.3 })
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
  const STEP = 2 // two sub-steps per spike edge: same spikes as before, smoother shell
  const segA = 40 * STEP
  const segE = 16
  // little spikes along the hairline: long bangs in front, short tips at the back
  const jag0 = (k) => {
    const a = -Math.PI + (k / 40) * Math.PI * 2
    const front = Math.max(0, Math.cos(a)) ** 1.5
    const side = Math.max(0, 1 - Math.abs(Math.abs(a) - 1.3) * 3)
    const back = Math.max(0, -Math.cos(a))
    return (k % 2 ? -0.02 : 0.14) * front + (k % 2 ? 0 : 0.1) * side * (1 - front) + (k % 2 ? 0 : 0.09) * back
  }
  const jagAt = (k) => (k % STEP ? (jag0(Math.floor(k / STEP)) + jag0(Math.floor(k / STEP) + 1)) / 2 : jag0(k / STEP))
  const pt = (k, j) => {
    const a = -Math.PI + (k / segA) * Math.PI * 2
    const e = edgeAt(COJI_EDGE, Math.abs(a))
    let phi = Math.acos(Math.max(-0.95, Math.min(0.95, e))) * (j / segE)
    if (j === segE) phi += jagAt(k)
    const top = 1 - j / segE
    const front = Math.max(0, Math.cos(a))
    const back = Math.max(0, -Math.cos(a))
    // hug the head; a bit of volume on top; tufts make it look like real strands
    const kk = Math.floor(k / STEP) % 40
    const tuft = j > 0 && j < segE ? (hash(kk, Math.floor(j / 1.6)) - 0.5) * 0.045 : 0
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
      const dst = j >= 5 && j <= 7 && Math.abs(am) < 1.5 && Math.floor(k / STEP) % 3 !== 0 ? hi : base
      dst.push(...A, ...B, ...Cc, ...B, ...D, ...Cc)
    }
  for (const [arr, c, rough] of [[base, color, 0.68], [hi, mixc(color, shine, 0.6), 0.5]]) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
    // smooth: hair faces away from the middle of the head
    const n = new Float32Array(arr.length)
    for (let i = 0; i < arr.length; i += 3) {
      const x = arr[i]
      const y = arr[i + 1] - r * 0.03
      const z = arr[i + 2]
      const l = Math.hypot(x, y, z) || 1
      n[i] = x / l
      n[i + 1] = y / l
      n[i + 2] = z / l
    }
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3))
    p.push(g, c, 0.04, MAT2, { flat: false, rough })
  }
  // cowlick on the crown
  p.add(cone(r * 0.09, r * 0.4, S(8)), color, { y: r * 1.12, z: -r * 0.35, rx: -0.9, rz: 0.3, mat: MAT2, flat: false, rough: 0.5 })
  p.add(cone(r * 0.07, r * 0.3, S(8)), color, { y: r * 1.1, z: -r * 0.42, rx: -1.2, rz: -0.5, mat: MAT2, flat: false, rough: 0.5 })
}

// A soft tuft of hair lying on the head. az: around the head (0 = front), el: up from the ear line.
function tuft(p, R, c, az, el, w, len, o = {}) {
  const ce = Math.cos(el)
  const d = R + (o.lift ?? 0)
  p.add(sphere(1, S(9), S(8)), c, {
    x: Math.sin(az) * ce * d,
    y: Math.sin(el) * d + (o.y || 0),
    z: Math.cos(az) * ce * d,
    sx: w,
    sy: len,
    sz: w * (o.thick ?? 0.45),
    rx: -el + (o.tilt || 0),
    ry: az,
    rz: o.twist || 0,
    order: 'YXZ',
    jitter: 0.04,
    rough: o.rough ?? 0.5,
  })
}
// A cap of hair: part of a sphere tilted back.
function hairCap(p, r, c, R, theta, tilt, y) {
  p.add(sphere(R, S(24), S(12), 0, theta), c, { rx: tilt, y, jitter: 0.04, rough: 0.5 })
}
// Bangs: a row of tufts across the forehead.
function bangs(p, r, c, n, el, w, len, R = 1.04, span = 1.1) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5
    tuft(p, r * R, c, t * span, el - Math.abs(t) * 0.12, w, len, { twist: -t * 0.5, thick: 0.36 })
  }
}

function addHair(p, r, o) {
  const c = o.hair
  switch (o.hairStyle) {
    case 'coji':
      cojiHair(p, r, c, o.hairShine || '#3a3f55')
      break
    case 'short':
      hairCap(p, r, c, r * 1.07, Math.PI * 0.52, -0.45, r * 0.05)
      if (!o.hat) bangs(p, r, c, 7, 0.64, r * 0.13, r * 0.27)
      for (const s of [-1, 1]) {
        tuft(p, r * 1.0, c, s * 1.28, 0.18, r * 0.15, r * 0.28, { thick: 0.5 })
        tuft(p, r * 1.01, c, s * 1.7, 0.1, r * 0.2, r * 0.3, { thick: 0.5 })
      }
      for (let i = -1; i <= 1; i++) tuft(p, r * 1.0, c, Math.PI + i * 0.45, -0.12, r * 0.24, r * 0.3, { thick: 0.5 })
      break
    case 'bun':
      hairCap(p, r, c, r * 1.065, Math.PI * 0.53, -0.42, r * 0.05)
      // swept to the sides from a middle part
      if (!o.hat) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) tuft(p, r * 1.04, c, s * (0.18 + i * 0.32), 0.62 - i * 0.12, r * 0.15, r * 0.3, { twist: s * 0.9, thick: 0.4 })
      p.add(sphere(r * 0.36, S(16), S(12)), c, { y: r * 0.95, z: -r * 0.35, jitter: 0.05, rough: 0.5 })
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        p.add(sphere(r * 0.17, S(9), S(8)), darker(c, 0.93), { x: Math.cos(a) * r * 0.22, y: r * 1.02 + Math.sin(a * 2) * r * 0.05, z: -r * 0.35 + Math.sin(a) * r * 0.22, sy: 0.7, jitter: 0.04, rough: 0.5 })
      }
      p.add(torus(r * 0.3, r * 0.045, S(6), S(18)), '#e2465a', { y: r * 0.82, z: -r * 0.3, rx: Math.PI / 2 + 0.6, jitter: 0, rough: 0.5 })
      break
    case 'bob':
      hairCap(p, r, c, r * 1.09, Math.PI * 0.53, -0.45, r * 0.02)
      if (!o.hat) bangs(p, r, c, 9, 0.55, r * 0.125, r * 0.28, 1.06, 1.3)
      // the rounded ends that curl under at the jaw
      // a curtain of strands down to the jaw, curling in a little at the ends
      for (let i = 0; i < 15; i++) {
        const az = 0.95 + (i / 14) * (Math.PI * 2 - 1.9)
        tuft(p, r * 1.06, c, az, -0.22, r * 0.17, r * 0.4, { thick: 0.5, tilt: -0.12, twist: Math.sin(az) * 0.15 })
      }
      break
    case 'pigtails':
      hairCap(p, r, c, r * 1.07, Math.PI * 0.53, -0.45, r * 0.05)
      if (!o.hat) bangs(p, r, c, 8, 0.58, r * 0.12, r * 0.27, 1.05, 1.2)
      for (const s of [-1, 1]) {
        // a hair tie and a pigtail of soft lumps
        p.add(sphere(r * 0.11, S(9), S(8)), '#ff5d8f', { x: s * r * 0.98, y: r * 0.16, z: -r * 0.2, jitter: 0, rough: 0.4 })
        for (let i = 0; i < 4; i++)
          p.add(sphere(r * (0.3 - i * 0.045), S(12), S(9)), c, { x: s * r * (1.06 + i * 0.05), y: -r * (0.05 + i * 0.22), z: -r * (0.22 + i * 0.03), sy: 1.25, jitter: 0.05, rough: 0.5 })
        p.add(cone(r * 0.12, r * 0.25, S(8)), c, { x: s * r * 1.26, y: -r * 0.98, z: -r * 0.32, rx: Math.PI, jitter: 0.04, rough: 0.5 })
      }
      break
    case 'bald':
      for (let i = 0; i < 9; i++) {
        const az = Math.PI / 2 + 0.35 + (i / 8) * (Math.PI - 0.7)
        for (const s of [-1, 1]) if (s === 1 || i !== 4) tuft(p, r * 0.99, c, s * az, -0.02 + (i % 2) * 0.08, r * 0.2, r * 0.24, { thick: 0.6 })
      }
      break
  }
  if (o.antennae)
    for (const s of [-1, 1]) {
      p.add(cyl(r * 0.03, r * 0.035, r * 0.7, S(8)), o.skin, { x: s * r * 0.3, y: r * 1.15, rz: -s * 0.35, rough: 0.5 })
      p.add(sphere(r * 0.1, S(10), S(8)), '#ffe066', { x: s * r * 0.43, y: r * 1.47, rough: 0.2 })
    }
  if (o.beard) {
    const b = o.beard
    p.add(sphere(r * 0.62, S(18), S(12)), b, { y: -r * 0.55, z: r * 0.43, sz: 0.62, sy: 0.82, jitter: 0.06, rough: 0.75 })
    for (const s of [-1, 1]) {
      // along the jaw up to the ears
      p.add(sphere(r * 0.3, S(12), S(9)), b, { x: s * r * 0.62, y: -r * 0.36, z: r * 0.3, sx: 0.7, sy: 1.2, sz: 0.8, jitter: 0.06, rough: 0.75 })
      // mustache: two soft curls
      p.add(sphere(r * 0.2, S(10), S(8)), b, { x: s * r * 0.15, y: -r * 0.2, z: r * 0.93, sx: 1.5, sy: 0.55, sz: 0.5, rz: s * -0.25, jitter: 0.04, rough: 0.7 })
    }
    for (let i = 0; i < 5; i++) p.add(sphere(r * 0.13, S(8), S(6)), darker(b, 0.95), { x: (i - 2) * r * 0.13, y: -r * 0.95 + Math.abs(i - 2) * r * 0.06, z: r * 0.48, sy: 1.3, sz: 0.6, jitter: 0.05, rough: 0.8 })
  }
  addHat(p, r, o)
}

function addHat(p, r, o) {
  switch (o.hat) {
    case 'captain': {
      p.add(cyl(r * 1.06, r * 0.95, r * 0.42, S(27)), '#ffffff', { y: r * 0.72, rough: 0.6 })
      p.add(sphere(r * 1.06, S(27), S(4), 0, Math.PI / 2), '#f4f4f2', { y: r * 0.93, sy: 0.18, rough: 0.6 })
      p.add(cyl(r * 0.99, r * 0.98, r * 0.16, S(27)), '#22325e', { y: r * 0.6, rough: 0.7 })
      // the shiny black peak and the gold cord above it
      p.add(new THREE.CylinderGeometry(r * 0.6, r * 0.6, r * 0.035, S(21), 1, false, -Math.PI / 2, Math.PI), '#141414', { y: r * 0.5, z: r * 0.72, sz: 0.78, rx: 0.28, rough: 0.2 })
      p.add(torus(r * 1.0, r * 0.02, S(4), S(18), Math.PI * 0.5), '#e8b923', { y: r * 0.55, rx: Math.PI / 2, rz: Math.PI * 0.25, jitter: 0, rough: 0.3, metal: 0.8 })
      // badge: a gold anchor on the band
      p.add(sphere(r * 0.12, S(12), S(9)), '#e8b923', { y: r * 0.74, z: r * 0.99, sz: 0.3, jitter: 0, rough: 0.3, metal: 0.8 })
      p.add(box(r * 0.03, r * 0.16, r * 0.03), '#22325e', { y: r * 0.74, z: r * 1.03, jitter: 0 })
      p.add(torus(r * 0.06, r * 0.015, S(4), S(9), Math.PI), '#22325e', { y: r * 0.71, z: r * 1.03, rz: Math.PI, jitter: 0 })
      break
    }
    case 'chef':
      p.add(pleated(r * 0.86, r * 0.82, r * 0.48, 12, 0.035, { seg: S(36), rows: 1 }), '#ffffff', { y: r * 0.85, rough: 0.75 })
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        p.add(sphere(r * 0.38, S(14), S(10)), '#fbfbf8', { x: Math.cos(a) * r * 0.48, y: r * 1.22, z: Math.sin(a) * r * 0.48, sy: 0.8, jitter: 0.02, rough: 0.8 })
      }
      p.add(sphere(r * 0.5, S(16), S(12)), '#ffffff', { y: r * 1.32, sy: 0.7, jitter: 0.02, rough: 0.8 })
      break
    case 'cap': {
      const hc = o.hatColor
      p.add(sphere(r * 1.07, S(24), S(9), 0, Math.PI * 0.46), hc, { y: r * 0.12, rough: 0.7 })
      for (let i = 0; i < 3; i++) p.add(torus(r * 1.075, r * 0.008, S(3), S(24), Math.PI * 0.92), darker(hc, 0.75), { y: r * 0.12, ry: (i / 3) * Math.PI, rz: Math.PI / 2 - Math.PI * 0.46, jitter: 0, rough: 0.8 })
      p.add(sphere(r * 0.09, S(9), S(6)), darker(hc, 0.85), { y: r * 1.18, sy: 0.6, jitter: 0, rough: 0.6 })
      p.add(new THREE.CylinderGeometry(r * 0.62, r * 0.62, r * 0.045, S(21), 1, false, -Math.PI / 2, Math.PI), darker(hc, 0.9), { y: r * 0.5, z: r * 0.72, sz: 0.85, rx: 0.16, rough: 0.6 })
      break
    }
    case 'bucket': {
      const hc = o.hatColor
      // tall enough to hold the hair inside, with a softly rounded top
      p.add(cyl(r * 0.84, r * 1.03, r * 0.64, S(27)), hc, { y: r * 0.82, rough: 0.85 })
      p.add(sphere(r * 0.84, S(27), S(5), 0, Math.PI / 2), hc, { y: r * 1.14, sy: 0.12, rough: 0.85 })
      p.add(new THREE.CylinderGeometry(r * 1.03, r * 1.45, r * 0.2, S(30), 1), hc, { y: r * 0.43, rough: 0.85 })
      for (const [y, rr] of [[0.62, 0.975], [0.9, 0.915]]) p.add(torus(r * rr, r * 0.008, S(3), S(27)), darker(hc, 0.78), { y: r * y, rx: Math.PI / 2, jitter: 0, rough: 0.9 })
      for (const rr of [1.22, 1.35]) p.add(torus(r * rr, r * 0.008, S(3), S(30)), darker(hc, 0.78), { y: r * (0.535 - (rr - 1.03) * 0.476), rx: Math.PI / 2, jitter: 0, rough: 0.9 })
      break
    }
    case 'paper':
      p.add(cyl(r * 0.9, r * 0.96, r * 0.36, S(24)), o.hatColor, { y: r * 0.62, rough: 0.8 })
      p.add(cyl(r * 0.93, r * 0.93, r * 0.09, S(24)), '#ffffff', { y: r * 0.5, rough: 0.8 })
      p.add(box(r * 0.04, r * 0.36, r * 0.02), darker(o.hatColor, 0.85), { y: r * 0.62, z: r * 0.92, jitter: 0 })
      break
    case 'helmet': {
      const M = { rough: 0.32, metal: 0.75 }
      p.add(sphere(r * 1.12, S(27), S(10), 0, Math.PI * 0.56), '#c9ced6', { y: r * 0.05, ...M })
      p.add(torus(r * 1.12, r * 0.07, S(5), S(27)), '#a8afba', { y: r * 0.05, rx: Math.PI / 2, ...M })
      p.add(rbox(r * 0.12, r * 0.55, r * 0.1, 0.4, S(8), S(6)), '#a8afba', { y: r * 0.06, z: r * 1.1, ...M })
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        p.add(sphere(r * 0.035, S(6), S(4)), '#8d94a0', { x: Math.sin(a) * r * 1.15, y: r * 0.05, z: Math.cos(a) * r * 1.15, ...M, jitter: 0 })
      }
      // a ridge over the top and a red plume
      p.add(torus(r * 1.12, r * 0.04, S(4), S(22), Math.PI * 0.8), '#b3bac5', { y: r * 0.05, ry: Math.PI / 2, rz: Math.PI * 0.1, ...M, jitter: 0 })
      for (let i = 0; i < 7; i++) p.add(sphere(r * 0.17, S(9), S(8)), i % 2 ? '#e94b3c' : '#d63c2e', { y: r * 1.2 + Math.sin(i * 0.45) * r * 0.05, z: r * 0.05 - i * r * 0.15, sx: 0.55, sy: 1.0 - i * 0.04, jitter: 0.03, rough: 0.85 })
      break
    }
    case 'crown': {
      const G = { rough: 0.25, metal: 0.9 }
      p.add(sphere(r * 0.7, S(18), S(9), 0, Math.PI / 2), '#a3222a', { y: r * 0.82, rough: 0.9 })
      p.add(cyl(r * 0.8, r * 0.73, r * 0.34, S(27)), '#f1c232', { y: r * 0.85, ...G })
      p.add(torus(r * 0.77, r * 0.04, S(6), S(27)), '#f1c232', { y: r * 0.7, rx: Math.PI / 2, ...G, jitter: 0 })
      p.add(torus(r * 0.82, r * 0.035, S(6), S(27)), '#f1c232', { y: r * 1.02, rx: Math.PI / 2, ...G, jitter: 0 })
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        p.add(cone(r * 0.12, r * 0.32, S(8)), '#f1c232', { x: Math.sin(a) * r * 0.8, y: r * 1.18, z: Math.cos(a) * r * 0.8, ...G })
        p.add(sphere(r * 0.05, S(8), S(6)), '#fff2b0', { x: Math.sin(a) * r * 0.8, y: r * 1.36, z: Math.cos(a) * r * 0.8, ...G, jitter: 0 })
        p.add(sphere(r * 0.065, S(9), S(8)), i % 2 ? '#e0283a' : '#2f6fd8', { x: Math.sin(a) * r * 0.81, y: r * 0.86, z: Math.cos(a) * r * 0.81, sz: 0.6, ry: a, jitter: 0, rough: 0.08 })
      }
      // white fur band with little black tips
      p.add(torus(r * 0.78, r * 0.08, S(8), S(27)), '#f7f5ee', { y: r * 0.66, rx: Math.PI / 2, jitter: 0.02, rough: 0.95 })
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2
        p.add(sphere(r * 0.025, S(4), S(3)), '#1a1a1a', { x: Math.sin(a) * r * 0.86, y: r * 0.66, z: Math.cos(a) * r * 0.86, sy: 1.6, jitter: 0 })
      }
      break
    }
  }
}

// Shoes: a rounded sole with a tread edge, a soft upper, a collar and a heel tab. With `toe`,
// `shoeStripe` and `strap` they become Coji's sneakers; otherwise they get laces.
function addShoe(p, P, o) {
  const L = P.leg
  const w = P.legR * 2.35
  const len = P.legR * 3.7
  const y0 = -L
  const zc = P.legR * 0.6
  const sole = o.soles || darker(o.shoes, 0.55)
  const shoe = o.shoes
  p.add(rbox(w * 1.04, 0.06, len * 1.01, 0.3, S(21), S(8)), sole, { y: y0 + 0.03, z: zc, jitter: 0, rough: 0.6 })
  p.add(rbox(w * 1.0, 0.018, len * 0.98, 0.3, S(21), S(6)), darker(sole, 0.75), { y: y0 + 0.008, z: zc, jitter: 0, rough: 0.9 })
  // the upper: a stretched half dome
  const ux = w * 0.52
  const uy = w * 0.52 * 1.25
  const uz = len / 2
  const uc = zc + len * 0.02
  p.add(sphere(ux, S(22), S(10), 0, Math.PI / 2), shoe, { y: y0 + 0.055, z: uc, sy: 1.25, sz: uz / ux, jitter: 0, rough: o.toe ? 0.55 : 0.38 })
  const domeY = (z) => y0 + 0.055 + uy * Math.sqrt(Math.max(0, 1 - ((z - uc) / uz) ** 2))
  // ankle collar and heel tab
  p.add(torus(P.legR * 1.12, 0.014, S(6), S(16)), darker(shoe, 0.75), { y: domeY(uc - uz * 0.35) - 0.004, z: uc - uz * 0.32, rx: Math.PI / 2 + 0.25, sx: 1.05, jitter: 0, rough: 0.6 })
  p.add(rbox(w * 0.3, 0.07, 0.03, 0.4, S(8), S(6)), darker(shoe, 0.85), { y: y0 + 0.13, z: uc - uz + 0.01, rx: 0.2, jitter: 0, rough: 0.6 })
  if (o.toe) p.add(sphere(w * 0.5, S(16), S(8), 0, Math.PI / 2), o.toe, { y: y0 + 0.054, z: zc + len * 0.27, sy: 0.72, sz: 0.85, jitter: 0, rough: 0.5 })
  if (o.shoeStripe) for (const k of [-1, 1]) p.add(rbox(0.012, 0.03, len * 0.45, 0.5, S(6), S(4)), o.shoeStripe, { x: k * w * 0.495, y: y0 + 0.1, z: zc - len * 0.02, rx: -0.35, jitter: 0, rough: 0.5 })
  if (o.strap) {
    p.add(rbox(w * 0.98, 0.032, 0.085, 0.4, S(10), S(6)), o.strap, { y: y0 + 0.165, z: zc + len * 0.04, rx: -0.5, jitter: 0, rough: 0.5 })
    p.add(rbox(w * 0.3, 0.034, 0.06, 0.4, S(8), S(4)), darker(o.strap, 0.9), { x: w * 0.3, y: y0 + 0.17, z: zc + len * 0.04, rx: -0.5, jitter: 0, rough: 0.7 })
  } else {
    const lace = lum(shoe) < 0.35 ? '#ece9e2' : darker(shoe, 0.6)
    for (let i = 0; i < 3; i++) {
      const z = uc + uz * (0.05 + i * 0.16)
      const z2 = z + 0.01
      const slope = Math.atan2(domeY(z) - domeY(z2), z2 - z)
      p.add(capsule(0.008, w * 0.36, S(3), S(4)), lace, { y: domeY(z) + 0.004, z, rz: Math.PI / 2, rx: slope, jitter: 0, rough: 0.7 })
    }
    p.add(torus(0.025, 0.007, S(4), S(8)), lace, { x: -w * 0.08, y: domeY(uc + uz * 0.05) + 0.012, z: uc + uz * 0.02, rx: -0.6, ry: 0.4, jitter: 0, rough: 0.7 })
  }
}

// Stacked colored rings make a striped shirt.
function bandedTorso(p, rb, rt, y0, h, bands, seg = 32) {
  let acc = 0
  for (const [f, c] of bands) {
    const r0 = lerp(rb, rt, acc)
    const r1 = lerp(rb, rt, acc + f)
    p.add(new THREE.CylinderGeometry(r1, r0, h * f, seg, S(3), true), c, { y: y0 + h * (acc + f / 2), jitter: 0, mat: SMOOTH2, rough: 0.85 })
    acc += f
  }
}

// A knit cloth (Blankie Bear's blanket): stripes across, a ribbed border all round, and a knit
// pattern. `shape(u, v)` (u -1..1 across, v 0..1 down) places each point of a grid every frame; the
// grid gets smooth normals, so the cloth looks soft instead of folded paper.
function makeCloth(rowColors, cols, border, shape) {
  const rows = rowColors.length
  const SUB = 2 // each stripe row is two grid rows (smoother folds)
  const gr = rows * SUB
  const gw = cols + 1
  const gpts = gw * (gr + 1)
  const rest = new Float32Array(gpts * 2)
  for (let j = 0; j <= gr; j++)
    for (let k = 0; k <= cols; k++) {
      rest[(j * gw + k) * 2] = (k / cols) * 2 - 1
      rest[(j * gw + k) * 2 + 1] = j / gr
    }
  const idx = []
  const col = []
  const c = new THREE.Color()
  for (let j = 0; j < gr; j++)
    for (let k = 0; k < cols; k++) {
      const r = Math.floor(j / SUB)
      const edge = k === 0 || k === cols - 1 || r === rows - 1
      c.set(edge ? border : rowColors[r])
      const kj = 1 + ((k + j) % 2 ? 0.03 : -0.03) + (Math.random() * 2 - 1) * 0.015
      const a = j * gw + k
      const b = a + 1
      const d = a + gw
      const e = d + 1
      for (const v of [a, d, b, d, e, b]) {
        idx.push(v)
        col.push(c.r * kj, c.g * kj, c.b * kj)
      }
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(idx.length * 3), 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(idx.length * 3), 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  const mesh = new THREE.Mesh(g, SMOOTH2)
  mesh.castShadow = true
  mesh.frustumCulled = false
  return { mesh, rest, shape, idx, gw, gr, grid: new Float32Array(gpts * 3), gnor: new Float32Array(gpts * 3) }
}

// The little bear head of Blankie Bear.
function blankieHead() {
  const B = BLANKIE
  const bp = new Parts(SMOOTH)
  bp.add(sphere(0.16, S(20), S(15)), B.head, { sy: 0.92, jitter: 0.03, rough: 0.95 })
  for (const s of [-1, 1]) {
    bp.add(sphere(0.065, S(12), S(9)), B.ears, { x: s * 0.115, y: 0.11, sz: 0.6, jitter: 0.02, rough: 0.95 })
    bp.add(sphere(0.04, S(9), S(8)), lighter(B.ears, 0.3), { x: s * 0.118, y: 0.108, z: 0.022, sz: 0.35, jitter: 0, rough: 0.95 })
    bp.add(sphere(0.021, S(9), S(8)), '#3e2a20', { x: s * 0.055, y: 0.035, z: 0.143, sz: 0.6, jitter: 0, rough: 0.12 })
    bp.add(sphere(0.007, S(4), S(3)), '#ffffff', { x: s * 0.055 + 0.007, y: 0.043, z: 0.155, jitter: 0, rough: 0.05 })
  }
  bp.add(sphere(0.075, S(12), S(9)), B.muzzle, { y: -0.035, z: 0.12, sz: 0.6, jitter: 0.02, rough: 0.95 })
  bp.add(sphere(0.028, S(9), S(8)), B.features, { y: -0.01, z: 0.168, sx: 1.3, sy: 0.85, jitter: 0, rough: 0.25 })
  bp.add(sphere(0.008, S(4), S(3)), '#ffffff', { x: 0.008, y: 0.0, z: 0.188, jitter: 0, rough: 0.1 })
  bp.add(capsule(0.004, 0.035, S(3), S(4)), B.features, { y: -0.052, z: 0.162, rz: 0.25, rx: 0.3, jitter: 0, rough: 0.8 })
  bp.add(torus(0.022, 0.004, S(3), S(8), Math.PI * 0.8), B.features, { y: -0.062, z: 0.158, rz: -Math.PI / 2 - Math.PI * 0.4, rx: -0.3, jitter: 0, rough: 0.8 })
  return bp.build()
}


// ---------- people ----------

export class Person {
  constructor(look) {
    this.look = look
    Q = look.detail ?? 0.8
    const P = look.kid ? KID : look.grey ? GREY : ADULT
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
    const shoeTop = 0.055 + P.legR * 2.35 * 0.52 * 1.25

    // Legs: pivot at the hip.
    const legs = []
    for (const s of [-1, 1]) {
      const p = new Parts(SMOOTH)
      const L = P.leg
      const longPants = o.pantsLong
      p.add(cyl(P.legR, P.legR * 0.9, L, S(15)), longPants ? o.pants : o.skin, { y: -L / 2, jitter: 0, rough: longPants ? 0.85 : 0.62 })
      if (longPants) {
        // a soft crease down the front and a turned-up hem above the shoe
        p.add(box(0.007, L * 0.7, 0.01), darker(o.pants, 0.86), { y: -L * 0.42, z: P.legR * 0.955, jitter: 0, rough: 0.9 })
        p.add(cyl(P.legR * 1.05, P.legR * 1.0, 0.05, S(15)), darker(o.pants, 0.92), { y: -L + shoeTop * 0.85, jitter: 0, rough: 0.85 })
      }
      if (!longPants && !o.dress) {
        p.add(cyl(P.legR * 1.45, P.legR * 1.35, L * 0.36, S(18)), o.pants, { y: -L * 0.16, jitter: 0, rough: 0.85 })
        p.add(torus(P.legR * 1.34, 0.007, S(4), S(18)), darker(o.pants, 0.75), { y: -L * 0.31, rx: Math.PI / 2, jitter: 0, rough: 0.9 })
        if (o.piping) p.add(rbox(0.018, L * 0.34, 0.026, 0.5, S(6), S(8)), o.piping, { x: s * P.legR * 1.4, y: -L * 0.16, jitter: 0, rough: 0.6 })
      }
      if (o.socks) {
        p.add(cyl(P.legR * 1.06, P.legR * 1.02, L * 0.22, S(15)), o.socks, { y: -L + L * 0.17, jitter: 0, rough: 0.9 })
        p.add(torus(P.legR * 1.06, 0.01, S(4), S(15)), darker(o.socks, 0.9), { y: -L + L * 0.28, rx: Math.PI / 2, jitter: 0, rough: 0.9 })
      }
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
    const y0 = P.hip * 0.6
    // the torso's radius at height y (it narrows toward the shoulders)
    const torsoR = (y, rb, rt) => lerp(rb, rt, Math.min(1, Math.max(0, (y - y0) / P.torso)))
    if (o.uniform) {
      const U = UNIFORM
      const rb = P.bodyR * 1.12
      const rt = P.bodyR * 0.9
      p.add(cyl(P.bodyR * 1.06, P.bodyR * 1.1, P.hip, S(24)), U.shorts, { y: P.hip / 2 - 0.02, jitter: 0, rough: 0.8 })
      const stripe = [
        [0.05, U.stripe],
        [0.018, U.stripeLine],
        [0.13, U.shirt],
      ]
      bandedTorso(p, rb, rt, y0, P.torso, [[0.08, U.shirt], ...stripe, ...stripe, ...stripe, ...stripe, [0.124, U.navy]])
      p.add(torus(rb, 0.008, S(4), S(24)), darker(U.shirt, 0.88), { y: y0 + 0.006, rx: Math.PI / 2, jitter: 0, rough: 0.9 })
      // navy raglan shoulders with white piping where they meet the shirt
      p.add(sphere(rt, S(24), S(6), 0, Math.PI / 2), U.navy, { y: shirtTop, sy: 0.45, jitter: 0, rough: 0.8 })
      const py = y0 + P.torso * 0.876
      p.add(torus(torsoR(py, rb, rt) + 0.003, 0.006, S(4), S(24)), U.piping, { y: py, rx: Math.PI / 2, jitter: 0, rough: 0.6 })
      // navy V-neck collar
      p.add(torus(0.115, 0.03, S(8), S(21)), U.navy, { y: shirtTop + 0.02, rx: Math.PI / 2, jitter: 0, rough: 0.8 })
      const vz = rt + 0.004
      for (const s of [-1, 1]) {
        p.add(rbox(0.03, 0.15, 0.016, 0.5, S(6), S(8)), U.navy, { x: s * 0.034, y: shirtTop - 0.065, z: vz, rz: -s * 0.42, rx: -0.12, jitter: 0, rough: 0.8 })
        p.add(rbox(0.008, 0.13, 0.01, 0.5, S(4), S(6)), U.piping, { x: s * 0.018, y: shirtTop - 0.07, z: vz + 0.008, rz: -s * 0.42, rx: -0.12, jitter: 0, rough: 0.6 })
      }
      // the school crest: a little gold shield on the left chest
      const cy = shirtTop - 0.14
      const cr = torsoR(cy, rb, rt)
      const cx = 0.1
      const cz = Math.sqrt(cr * cr - cx * cx)
      const ry = Math.asin(cx / cr)
      p.add(rbox(0.07, 0.08, 0.012, 0.4, S(9), S(9)), U.crest, { x: cx, y: cy, z: cz + 0.004, ry, rx: -0.12, jitter: 0, rough: 0.35, metal: 0.5 })
      p.add(rbox(0.045, 0.054, 0.01, 0.4, S(8), S(8)), U.navy, { x: cx + Math.sin(ry) * 0.006, y: cy, z: cz + 0.009, ry, rx: -0.12, jitter: 0, rough: 0.6 })
      p.add(sphere(0.012, S(6), S(4)), U.crest, { x: cx + Math.sin(ry) * 0.012, y: cy + 0.004, z: cz + 0.013, ry, jitter: 0, rough: 0.35, metal: 0.5 })
    } else {
      const rb = P.bodyR * 1.05
      const rt = P.bodyR * 0.9
      p.add(cyl(P.bodyR * 1.04, P.bodyR * 1.08, P.hip, S(24)), o.dress || o.pants, { y: P.hip / 2 - 0.02, jitter: 0, rough: 0.85 })
      if (o.stripes) {
        const bands = []
        for (let i = 0; i < 5; i++) bands.push([0.12, o.shirt], [0.08, o.stripes])
        bandedTorso(p, rb, rt, y0, P.torso, bands)
      } else bandedTorso(p, rb, rt, y0, P.torso, [[1, o.shirt]])
      p.add(torus(rb, 0.009, S(4), S(24)), darker(o.shirt, 0.88), { y: y0 + 0.006, rx: Math.PI / 2, jitter: 0, rough: 0.9 })
      p.add(sphere(rt, S(24), S(6), 0, Math.PI / 2), o.coat || o.shirt, { y: shirtTop, sy: 0.45, jitter: 0, rough: 0.85 })
      // a little crew collar (the shirt's)
      if (!o.robe && !o.collar) p.add(torus(0.103, 0.02, S(6), S(18)), darker(o.shirt, 0.92), { y: shirtTop + 0.025, rx: Math.PI / 2, jitter: 0, rough: 0.85 })
      // a skirt or robe with soft pleats
      const sk = o.robe ? { rb: 1.9, h: 0.92, y: -0.38, n: 10 } : { rb: 1.7, h: 0.55, y: -0.2, n: 9 }
      const skTop = P.leg * sk.y + (P.leg * sk.h) / 2
      const skirtR = (y) => P.bodyR * lerp(1.05, sk.rb, (skTop - y) / (P.leg * sk.h)) * 1.05
      if (o.dress) p.add(pleated(P.bodyR * 1.05, P.bodyR * sk.rb, P.leg * sk.h, sk.n, 0.04, { seg: S(36), rows: S(2, 1) }), o.dress, { y: P.leg * sk.y, mat: SMOOTH2, jitter: 0.02, rough: 0.85 })
      if (o.robe) {
        // white fur trim with black tips, a fur collar and a gold band down the front
        const hy = P.leg * sk.y - (P.leg * sk.h) / 2
        p.add(torus(P.bodyR * 1.95, 0.075, S(8), S(30)), '#f7f5ee', { y: hy + 0.03, rx: Math.PI / 2, jitter: 0.02, rough: 0.95 })
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2
          p.add(sphere(0.02, S(4), S(3)), '#1a1a1a', { x: Math.sin(a) * (P.bodyR * 1.95 + 0.07), y: hy + 0.04, z: Math.cos(a) * (P.bodyR * 1.95 + 0.07), sy: 1.7, jitter: 0 })
        }
        p.add(torus(0.2, 0.09, S(8), S(18)), '#f7f5ee', { y: shirtTop + 0.01, rx: Math.PI / 2, jitter: 0.02, rough: 0.95 })
        p.add(rbox(0.07, P.torso + P.leg * 0.8, 0.04, 0.4, S(8), S(15)), '#f1c232', { y: P.torso / 2 - P.leg * 0.35, z: P.bodyR * 1.0, jitter: 0, rough: 0.3, metal: 0.8 })
        for (let i = 0; i < 5; i++) p.add(sphere(0.022, S(8), S(6)), '#f1c232', { x: Math.sin((i - 2) * 0.32) * 0.18, y: shirtTop - 0.05 - Math.cos((i - 2) * 0.32) * 0.07 + 0.07, z: 0.22 + Math.cos((i - 2) * 0.32) * 0.05, jitter: 0, rough: 0.25, metal: 0.9 })
      }
      if (o.coat) {
        // an open jacket: two panels round the body, lapels, buttons and pockets
        const cr0 = P.bodyR * 1.1
        const cr1 = P.bodyR * 0.95
        const ch = P.torso * 0.98
        const cyc = y0 + P.torso * 0.49 - 0.02
        const coatR = (y) => lerp(cr0, cr1, (y - (cyc - ch / 2)) / ch)
        for (const s of [-1, 1]) {
          p.add(new THREE.CylinderGeometry(cr1, cr0, ch, S(18), 1, true, s > 0 ? 0.13 : -Math.PI, Math.PI - 0.13), o.coat, { y: cyc, mat: SMOOTH2, rough: 0.8 })
          p.add(rbox(0.075, 0.2, 0.014, 0.4, S(8), S(9)), darker(o.coat, 0.88), { x: s * 0.075, y: shirtTop - 0.11, z: coatR(shirtTop - 0.11) + 0.004, rz: -s * 0.32, ry: s * 0.25, jitter: 0, rough: 0.8 })
          const py = y0 + 0.1
          const pa = s * 0.95
          p.add(rbox(0.12, 0.03, 0.012, 0.4, S(8), S(4)), darker(o.coat, 0.85), { x: Math.sin(pa) * (coatR(py) + 0.004), y: py, z: Math.cos(pa) * (coatR(py) + 0.004), ry: pa, jitter: 0, rough: 0.8 })
        }
        const btn = o.coat === '#ffffff' ? '#d9d9d9' : '#f1c232'
        for (let i = 0; i < 3; i++) {
          const y = y0 + 0.12 + i * P.torso * 0.24
          const R = coatR(y) + 0.008
          p.add(sphere(0.026, S(9), S(6)), btn, { x: Math.sin(0.3) * R, y, z: Math.cos(0.3) * R, sz: 0.55, ry: 0.3, jitter: 0, rough: 0.25, metal: btn === '#f1c232' ? 0.85 : 0 })
        }
      }
      if (o.apron) {
        // curved over the body (and over a skirt), with a pocket, a neck strap and waist ties
        const ay = y0 + P.torso * 0.4
        const ah = P.torso * 0.75
        const top = ay + ah / 2
        const bot = ay - ah / 2
        p.add(new THREE.CylinderGeometry(torsoR(top, rb, rt) + 0.012, torsoR(bot, rb, rt) + 0.012, ah, S(12), S(3), true, -0.8, 1.6), o.apron, { y: ay, mat: SMOOTH2, jitter: 0.02, rough: 0.85 })
        const lh = P.leg * 0.45
        const ly = -P.leg * 0.12
        const lt = ly + lh / 2
        const lb = ly - lh / 2
        const r0 = o.dress ? skirtR(lt) + 0.012 : P.bodyR * 1.1
        const r1 = o.dress ? skirtR(lb) + 0.012 : P.bodyR * 1.2
        p.add(new THREE.CylinderGeometry(r0, r1, lh, S(12), 1, true, -0.75, 1.5), o.apron, { y: ly, mat: SMOOTH2, jitter: 0.02, rough: 0.85 })
        p.add(rbox(0.13, 0.1, 0.012, 0.4, S(8), S(8)), darker(o.apron, 0.92), { y: ly - 0.02, z: lerp(r0, r1, 0.5 + 0.02 / lh) + 0.006, jitter: 0, rough: 0.85 })
        p.add(torus(0.14, 0.012, S(4), S(15), Math.PI), darker(o.apron, 0.95), { y: shirtTop - 0.03, z: 0.02, rx: -0.35, jitter: 0, rough: 0.85 })
        for (const s of [-1, 1]) p.add(rbox(0.06, 0.035, 0.03, 0.5, S(6), S(4)), o.apron, { x: s * 0.05, y: y0 + 0.05, z: -torsoR(y0 + 0.05, rb, rt) - 0.012, rz: s * 0.5, jitter: 0, rough: 0.85 })
      }
      if (o.bow) {
        const bz = rt + 0.03
        for (const s of [-1, 1]) p.add(sphere(0.055, S(10), S(8)), o.bow, { x: s * 0.05, y: shirtTop - 0.015, z: bz, sx: 1.0, sy: 0.65, sz: 0.4, rz: s * -0.2, jitter: 0, rough: 0.5 })
        p.add(sphere(0.022, S(8), S(6)), darker(o.bow, 0.85), { y: shirtTop - 0.015, z: bz + 0.008, jitter: 0, rough: 0.5 })
      }
      if (o.collar) p.add(torus(0.12, 0.03, S(8), S(18)), o.collar, { y: shirtTop + 0.02, rx: Math.PI / 2, jitter: 0, rough: 0.8 })
      if (o.belt) {
        const br = P.bodyR * (o.coat ? 1.12 : 1.075)
        p.add(cyl(br, br, 0.08, S(24)), o.belt, { y: P.hip * 0.8, jitter: 0, rough: 0.55 })
        p.add(rbox(0.1, 0.075, 0.02, 0.3, S(8), S(6)), '#e2b73a', { y: P.hip * 0.8, z: br + 0.008, jitter: 0, rough: 0.25, metal: 0.85 })
        p.add(rbox(0.06, 0.04, 0.02, 0.3, S(6), S(4)), o.belt, { y: P.hip * 0.8, z: br + 0.012, jitter: 0, rough: 0.55 })
      }
      if (o.cape) {
        const H = P.torso + P.leg * (o.robe ? 0.85 : 0.5)
        p.add(pleated(P.bodyR * 1.04, P.bodyR * (o.robe ? 2.05 : 1.55), H, 7, 0.05, { arc: Math.PI * 0.8, center: Math.PI, seg: S(21), rows: S(4, 1) }), o.cape, { y: shirtTop - H / 2, rx: 0.05, mat: SMOOTH2, jitter: 0.02, rough: 0.85 })
        for (const s of [-1, 1]) p.add(sphere(0.035, S(9), S(8)), '#f1c232', { x: s * 0.12, y: shirtTop - 0.01, z: 0.17, jitter: 0, rough: 0.25, metal: 0.9 })
      }
      if (o.bag) {
        const bx = -P.bodyR * 1.12
        p.add(rbox(0.34, 0.28, 0.13, 0.3, S(15), S(12)), o.bag, { x: bx, y: P.hip * 0.7, z: 0.05, ry: 0.15, jitter: 0.03, rough: 0.55 })
        p.add(rbox(0.35, 0.15, 0.14, 0.3, S(15), S(9)), darker(o.bag, 0.88), { x: bx, y: P.hip * 0.7 + 0.08, z: 0.055, ry: 0.15, jitter: 0.03, rough: 0.55 })
        p.add(rbox(0.04, 0.05, 0.02, 0.4, S(6), S(6)), '#d9c27a', { x: bx + 0.012, y: P.hip * 0.7 + 0.03, z: 0.13, ry: 0.15, jitter: 0, rough: 0.3, metal: 0.8 })
        p.add(rbox(0.045, P.torso * 1.25, 0.022, 0.4, S(6), S(12)), darker(o.bag, 0.8), { x: 0, y: P.hip + P.torso * 0.45, z: P.bodyR * 0.98, rz: 0.75, jitter: 0, rough: 0.6 })
      }
    }
    p.add(cyl(0.09, 0.1, P.neck + 0.08, S(15)), o.skin, { y: shirtTop + 0.02, jitter: 0, rough: 0.62 })
    body.add(p.build())

    // Head
    const head = new THREE.Group()
    const headY = shirtTop + P.neck + P.headR * 0.92
    head.position.y = headY
    const hp = new Parts(SMOOTH)
    addFace(hp, P.headR, o)
    addHair(hp, P.headR, o)
    head.add(hp.build())
    // eyelids (closed when resting, and a blink now and then); shrunk to nothing while open
    if (!o.grey) {
      const lp = new Parts(SMOOTH)
      addLids(lp, P.headR, o)
      this.lids = lp.build({ shadow: false })
      head.add(this.lids)
      this.blinkT = 1 + Math.random() * 4
    }
    body.add(head)
    this.head = head
    this.headY = headY

    // Arms: pivot at the shoulder.
    const arms = []
    for (const s of [-1, 1]) {
      const ap = new Parts(SMOOTH)
      const A = P.arm
      const sleeve = o.uniform ? UNIFORM.navy : o.coat || o.shirt
      const sl = A * (o.longSleeves ? 0.85 : 0.36)
      const hand = o.gloves || o.skin
      ap.add(sphere(P.armR * 1.36, S(15), S(6), 0, Math.PI / 2), sleeve, { sy: 0.6, jitter: 0, rough: 0.85 })
      ap.add(cyl(P.armR * 1.36, P.armR * 1.3, sl, S(15)), sleeve, { y: -sl / 2, jitter: 0, rough: 0.85 })
      ap.add(torus(P.armR * 1.3, P.armR * 0.13, S(4), S(15)), darker(sleeve, 0.88), { y: -sl + 0.004, rx: Math.PI / 2, jitter: 0, rough: 0.85 })
      if (o.uniform) ap.add(rbox(0.016, sl * 0.95, 0.022, 0.5, S(4), S(8)), UNIFORM.piping, { x: s * P.armR * 1.33, y: -sl / 2, jitter: 0, rough: 0.6 })
      // forearm, then a hand with a thumb
      ap.add(cyl(P.armR, P.armR * 0.88, A, S(14)), hand, { y: -A / 2 - 0.01, jitter: 0, rough: o.gloves ? 0.4 : 0.62, metal: o.gloves && o.shield ? 0.6 : 0 })
      ap.add(sphere(P.armR * 1.2, S(14), S(10)), hand, { y: -A - 0.025, sx: 0.92, sy: 1.12, sz: 0.82, jitter: 0, rough: o.gloves ? 0.4 : 0.6, metal: o.gloves && o.shield ? 0.6 : 0 })
      ap.add(capsule(P.armR * 0.36, P.armR * 0.55, S(3), S(8)), hand, { x: -s * P.armR * 0.55, y: -A + P.armR * 0.05, z: P.armR * 0.55, rz: s * 0.5, rx: 0.3, jitter: 0, rough: 0.6 })
      if (s === 1 && o.shield) {
        const M = { rough: 0.3, metal: 0.8 }
        ap.add(cyl(0.34, 0.34, 0.05, S(24)), o.shield, { y: -A * 0.6, z: 0.02, x: 0.12, rz: Math.PI / 2, jitter: 0.02, rough: 0.5 })
        ap.add(torus(0.34, 0.03, S(6), S(24)), '#e2b73a', { y: -A * 0.6, z: 0.02, x: 0.15, ry: Math.PI / 2, jitter: 0, ...M })
        ap.add(sphere(0.07, S(10), S(8)), '#e2b73a', { y: -A * 0.6, z: 0.02, x: 0.15, sx: 0.5, jitter: 0, ...M })
        ap.add(rbox(0.02, 0.44, 0.06, 0.4, S(4), S(9)), '#e2b73a', { y: -A * 0.6, z: 0.02, x: 0.148, jitter: 0, ...M })
        ap.add(rbox(0.02, 0.06, 0.44, 0.4, S(4), S(9)), '#e2b73a', { y: -A * 0.6, z: 0.02, x: 0.148, jitter: 0, ...M })
      }
      const arm = ap.build()
      arm.position.set(s * (P.bodyR * 0.95 + P.armR), shirtTop - 0.06, 0)
      arm.rotation.z = s * 0.12
      body.add(arm)
      arms.push(arm)
    }
    ;[this.armR, this.armL] = arms

    if (o.rod) {
      const rp = new Parts(SMOOTH)
      rp.add(cyl(0.022, 0.034, 2.6, S(8)), '#8b5a2b', { y: 1.2, rough: 0.4 })
      rp.add(cyl(0.045, 0.045, 0.32, S(9)), '#c99a5a', { y: 0.05, rough: 0.85 })
      rp.add(cyl(0.06, 0.06, 0.05, S(12)), '#9aa3ad', { y: 0.3, z: 0.07, rx: Math.PI / 2, rough: 0.3, metal: 0.8 })
      for (let i = 0; i < 4; i++) rp.add(torus(0.025, 0.006, S(3), S(8)), '#9aa3ad', { y: 0.7 + i * 0.5, z: 0.03, rough: 0.3, metal: 0.8 })
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
      sp.add(cyl(0.032, 0.036, 3.0, S(9)), '#8b5a2b', { y: 0.6, rough: 0.5 })
      sp.add(cyl(0.042, 0.042, 0.12, S(9)), '#9aa3ad', { y: 2.1, rough: 0.3, metal: 0.8 })
      sp.add(cone(0.08, 0.36, S(3)), '#d9dde3', { y: 2.33, sz: 0.35, rough: 0.25, metal: 0.9 })
      sp.add(rbox(0.012, 0.18, 0.2, 0.3, S(4), S(8)), '#e94b3c', { y: 1.92, z: 0.12, jitter: 0.02, rough: 0.85 })
      const spear = sp.build()
      spear.position.set(-(P.bodyR * 0.95 + P.armR) - 0.06, P.leg + shirtTop - 0.06 - P.arm, 0.22)
      root.add(spear)
    }
    if (o.scepter) {
      const sc = new Parts(SMOOTH)
      const G = { rough: 0.25, metal: 0.9 }
      sc.add(cyl(0.028, 0.032, 0.9, S(9)), '#f1c232', { y: 0.2, ...G })
      for (const y of [-0.15, 0.2, 0.55]) sc.add(torus(0.035, 0.012, S(4), S(10)), '#f1c232', { y, rx: Math.PI / 2, ...G })
      sc.add(sphere(0.09, S(14), S(10)), '#d0202e', { y: 0.7, rough: 0.08 })
      sc.add(torus(0.092, 0.012, S(4), S(15)), '#f1c232', { y: 0.7, ...G })
      sc.add(cyl(0.012, 0.012, 0.14, S(6)), '#f1c232', { y: 0.84, ...G })
      sc.add(cyl(0.012, 0.012, 0.09, S(6)), '#f1c232', { y: 0.84, rz: Math.PI / 2, ...G })
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
    Q = 1
    // one draw call for the whole character (the simulated blanket stays separate)
    mergeRig(root, { keep: (this.cloths || []).map((c) => c.mesh) })
    if (this.lids) this.lids.scale.setScalar(0.001)
  }

  // Coji's red backpack: rounded, with a zipped front pocket, side pockets, a handle and a charm.
  addBackpack() {
    const P = this.P
    const K = BACKPACK
    const top = this.shirtTop
    const by = top - 0.27
    const bz = -(P.bodyR + 0.12)
    const p = new Parts(SMOOTH)
    const F = { jitter: 0.02, rough: 0.55 }
    const ZIP = { jitter: 0, rough: 0.3, metal: 0.8 }
    p.add(rbox(0.44, 0.4, 0.21, 0.3, S(21), S(15)), K.main, { y: by, z: bz, ...F })
    p.add(rbox(0.448, 0.014, 0.216, 0.3, S(21), S(3)), K.dark, { y: by + 0.1, z: bz, jitter: 0, rough: 0.7 })
    p.add(rbox(0.33, 0.19, 0.08, 0.35, S(16), S(12)), K.pocket, { y: by - 0.07, z: bz - 0.12, ...F })
    p.add(rbox(0.3, 0.012, 0.014, 0.5, S(8), S(3)), K.dark, { y: by + 0.012, z: bz - 0.158, jitter: 0, rough: 0.7 })
    p.add(rbox(0.022, 0.045, 0.012, 0.5, S(4), S(6)), '#d9dde3', { x: 0.1, y: by - 0.008, z: bz - 0.166, ...ZIP })
    p.add(rbox(0.022, 0.04, 0.012, 0.5, S(4), S(6)), '#d9dde3', { x: -0.18, y: by + 0.085, z: bz - 0.108, ...ZIP })
    for (const s of [-1, 1]) p.add(rbox(0.06, 0.15, 0.15, 0.4, S(9), S(9)), K.pocket, { x: s * 0.235, y: by - 0.08, z: bz, ...F })
    p.add(torus(0.06, 0.016, S(6), S(14), Math.PI), K.dark, { y: by + 0.2, z: bz, ry: Math.PI / 2, jitter: 0, rough: 0.6 })
    // the little charm on a ring
    p.add(torus(0.018, 0.004, S(3), S(8)), '#d9dde3', { x: 0.25, y: by - 0.06, z: bz, ry: Math.PI / 2, ...ZIP })
    p.add(ico(0.045, 1), K.charm, { x: 0.25, y: by - 0.12, z: bz, jitter: 0, rough: 0.3 })
    for (const s of [-1, 1]) {
      p.add(rbox(0.07, 0.05, 0.36, 0.4, S(8), S(6)), K.straps, { x: s * 0.13, y: top + 0.03, z: -0.02, jitter: 0, rough: 0.7 })
      p.add(rbox(0.07, 0.3, 0.035, 0.4, S(8), S(10)), K.straps, { x: s * 0.13, y: top - 0.13, z: P.bodyR * 0.98, rx: -0.12, jitter: 0, rough: 0.7 })
      p.add(rbox(0.074, 0.03, 0.04, 0.4, S(6), S(4)), '#9aa3ad', { x: s * 0.13, y: top - 0.24, z: P.bodyR * 0.98 + 0.012, rx: -0.12, ...ZIP })
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
    const front = makeCloth(rows, 14, B.rib, (u, v, t, sw) => {
      const x = u * (0.1 + 0.2 * Math.sqrt(v))
      const y = y0 - v * 0.44 - 0.11 * (1 - Math.abs(u)) * v * v
      const fold = Math.sin(u * Math.PI * 2.5 + 0.7) * 0.03 * Math.min(1, v * 2)
      const z = z0 + 0.05 * (1 - u * u) + 0.07 * v + fold + sw * 0.07 * v * v + Math.sin(t * 9 + v * 5 + u * 2) * 0.02 * sw * v
      return [x, y, z]
    })
    // two corners draped over the forearms
    const flap = (s) =>
      makeCloth([B.knit, B.stripe, B.knit, B.knit, B.stripe, B.rib], 6, B.rib, (u, v, t, sw) => {
        const x = s * (0.15 + 0.08 * v) + u * (0.05 + 0.05 * v)
        const y = y0 + 0.02 - v * 0.36
        const z = z0 - 0.02 + 0.03 * Math.sin((u + 1) * 1.6) + 0.04 * v + Math.sin(t * 8 + v * 4) * 0.015 * sw * v
        return [x, y, z]
      })
    // the lap blanket when Coji sits: over the thighs, then hanging down at the knees
    const lap = makeCloth([B.knit, B.stripe, B.knit, B.knit, B.stripe, B.knit, B.knit, B.stripe, B.rib], 14, B.rib, (u, v, t) => {
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
    this.eyesShut = on
    if (!this.cloths) return
    for (const c of this.cloths) c.mesh.visible = c === this.lap ? on : !on
  }

  updateCloth(dt, t) {
    const target = Math.min(1, this.speed / 6)
    this.sway += (target - this.sway) * Math.min(1, dt * 4)
    for (const c of this.cloths) {
      if (!c.mesh.visible && c.done) continue
      c.done = true
      const G = c.grid
      const R = c.rest
      const n = R.length / 2
      for (let i = 0; i < n; i++) {
        const q = c.shape(R[i * 2], R[i * 2 + 1], t, this.sway)
        G[i * 3] = q[0]
        G[i * 3 + 1] = q[1]
        G[i * 3 + 2] = q[2]
      }
      // smooth normals from the neighbours on the grid (down × across, matching the triangles)
      const N = c.gnor
      const gw = c.gw
      const gr = c.gr
      for (let j = 0; j <= gr; j++)
        for (let k = 0; k < gw; k++) {
          const i = j * gw + k
          const l = (j * gw + Math.max(0, k - 1)) * 3
          const r = (j * gw + Math.min(gw - 1, k + 1)) * 3
          const u = (Math.max(0, j - 1) * gw + k) * 3
          const d = (Math.min(gr, j + 1) * gw + k) * 3
          const ax = G[r] - G[l]
          const ay = G[r + 1] - G[l + 1]
          const az = G[r + 2] - G[l + 2]
          const bx = G[d] - G[u]
          const by = G[d + 1] - G[u + 1]
          const bz = G[d + 2] - G[u + 2]
          const nx = by * az - bz * ay
          const ny = bz * ax - bx * az
          const nz = bx * ay - by * ax
          const len = Math.hypot(nx, ny, nz) || 1
          N[i * 3] = nx / len
          N[i * 3 + 1] = ny / len
          N[i * 3 + 2] = nz / len
        }
      const pos = c.mesh.geometry.attributes.position
      const nor = c.mesh.geometry.attributes.normal
      const pa = pos.array
      const na = nor.array
      const idx = c.idx
      for (let m = 0; m < idx.length; m++) {
        const v = idx[m] * 3
        pa[m * 3] = G[v]
        pa[m * 3 + 1] = G[v + 1]
        pa[m * 3 + 2] = G[v + 2]
        na[m * 3] = N[v]
        na[m * 3 + 1] = N[v + 1]
        na[m * 3 + 2] = N[v + 2]
      }
      pos.needsUpdate = true
      nor.needsUpdate = true
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
    if (this.lids) {
      this.blinkT -= dt
      let shut = this.eyesShut
      if (this.blinkT < 0) {
        shut = true
        if (this.blinkT < -0.14) this.blinkT = 2.5 + Math.random() * 4.5
      }
      this.lids.scale.setScalar(shut ? 1 : 0.001)
    }
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
    detail: 1.05,
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
    mergeRig(this.root, { keep: [this.glasses] })
    return this
  }
  get faceY() {
    return this.faceH
  }
}

const sm = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const FUR = { jitter: 0.06, rough: 0.92 }

export class Bear extends Animal {
  constructor() {
    super()
    Q = 0.8
    const brown = '#9b6a43'
    const tan = '#e2bf92'
    const p = new Parts(SMOOTH)
    p.add(sphere(1.0, S(21), S(15)), brown, { y: 1.0, sx: 1.15, sy: 1.05, sz: 0.95, ...FUR })
    p.add(sphere(0.74, S(16), S(12)), tan, { y: 0.95, z: 0.42, sz: 0.6, sy: 1.1, ...FUR })
    p.add(sphere(0.16, S(8), S(6)), brown, { y: 0.35, z: -0.92, ...FUR })
    // darker over the back, lighter in front, and a little shade near the ground
    shadeAll(p, (x, y, z) => (0.86 + 0.2 * sm(-0.9, 0.9, z)) * (0.78 + 0.22 * sm(0, 0.6, y)))
    // Everything above the legs rides in `upper`, which lifts when Bruno stands up to walk.
    const upper = new THREE.Group()
    this.upper = upper
    this.root.add(upper)
    upper.add(p.build())
    // Legs pivot at the hip. Built standing (pointing down, soles on the ground); sitting turns them
    // to stick straight out in front with the soles showing, like a teddy bear.
    this.legs = []
    for (const s of [-1, 1]) {
      const lp = new Parts(SMOOTH)
      lp.add(sphere(0.38, S(14), S(10)), brown, { y: -0.3, sy: 1.25, ...FUR })
      lp.add(sphere(0.33, S(14), S(10)), brown, { y: -0.68, z: 0.05, sy: 0.95, ...FUR })
      shadeAll(lp, (x, y) => 0.84 + 0.18 * sm(-1, 0, y))
      lp.add(sphere(0.21, S(10), S(8)), tan, { y: -0.98, z: 0.06, sy: 0.32, jitter: 0.03, rough: 0.9 })
      for (let i = 0; i < 3; i++) lp.add(sphere(0.06, S(6), S(4)), tan, { x: (i - 1) * 0.11, y: -0.97, z: 0.25 - Math.abs(i - 1) * 0.03, sy: 0.5, jitter: 0, rough: 0.9 })
      const leg = lp.build()
      leg.position.set(s * 0.56, 0.42, 0.25)
      leg.rotation.x = -Math.PI / 2
      this.root.add(leg)
      this.legs.push(leg)
    }
    this.standK = 0
    const head = new THREE.Group()
    head.position.set(0, 2.1, 0.15)
    const hp = new Parts(SMOOTH)
    hp.add(sphere(0.64, S(20), S(15)), brown, { sy: 0.92, ...FUR })
    for (const s of [-1, 1]) {
      hp.add(sphere(0.22, S(10), S(8)), brown, { x: s * 0.46, y: 0.48, z: -0.05, sz: 0.6, ...FUR })
      // fluffy cheeks
      hp.add(sphere(0.24, S(10), S(8)), brown, { x: s * 0.36, y: -0.2, z: 0.22, sz: 0.8, ...FUR })
    }
    shadeAll(hp, (x, y, z) => 0.9 + 0.12 * sm(-0.5, 0.5, z))
    hp.add(sphere(0.32, S(14), S(10)), tan, { y: -0.15, z: 0.47, sz: 0.78, ...FUR })
    hp.add(sphere(0.12, S(10), S(8)), '#2b1d14', { y: -0.04, z: 0.73, sx: 1.35, sy: 0.85, jitter: 0, rough: 0.2 })
    hp.add(sphere(0.03, S(6), S(4)), '#ffffff', { x: 0.04, y: 0.0, z: 0.82, sz: 0.5, jitter: 0, rough: 0.1 })
    hp.add(capsule(0.012, 0.06, S(3), S(4)), '#3a2418', { y: -0.17, z: 0.775, rx: 0.4, jitter: 0, rough: 0.6 })
    const a = Math.PI * 0.8
    hp.add(torus(0.075, 0.013, S(4), S(9), a), '#3a2418', { y: -0.18, z: 0.76, rx: -0.45, rz: -Math.PI / 2 - a / 2, jitter: 0, rough: 0.6 })
    for (const s of [-1, 1]) {
      hp.add(sphere(0.12, S(9), S(6)), tan, { x: s * 0.47, y: 0.47, z: 0.04, sz: 0.4, jitter: 0, rough: 0.9 })
      hp.add(sphere(0.1, S(8), S(6)), '#f2a0a0', { x: s * 0.42, y: -0.12, z: 0.46, sz: 0.3, jitter: 0, rough: 0.8 })
      animalEye(hp, s * 0.24, 0.12, 0.54, 0.08, { ry: s * 0.39, rx: -0.18, iris: '#4a2c18' })
      hp.add(capsule(0.014, 0.07, S(3), S(4)), '#5e3d26', { x: s * 0.25, y: 0.27, z: 0.53, rz: Math.PI / 2 + s * 0.25, ry: s * 0.4, jitter: 0, rough: 0.9 })
    }
    head.add(hp.build())
    upper.add(head)
    this.head = head
    const arms = []
    for (const s of [-1, 1]) {
      const ap = new Parts(SMOOTH)
      ap.add(capsule(0.24, 0.5, S(3), S(12)), brown, { y: -0.42, ...FUR })
      ap.add(sphere(0.28, S(12), S(9)), brown, { y: -0.85, ...FUR })
      shadeAll(ap, (x, y) => 0.92 + 0.1 * sm(-1, 0, y))
      ap.add(sphere(0.15, S(9), S(6)), tan, { y: -0.92, z: 0.16, sz: 0.4, jitter: 0, rough: 0.9 })
      for (let i = 0; i < 3; i++) ap.add(cone(0.025, 0.08, S(4)), '#e8e0d0', { x: (i - 1) * 0.09, y: -1.1, z: 0.12, rx: Math.PI - 0.5, jitter: 0, rough: 0.4 })
      const arm = ap.build()
      arm.position.set(s * 0.9, 1.6, 0.2)
      arm.rotation.x = -0.5
      arm.rotation.z = s * 0.25
      upper.add(arm)
      arms.push(arm)
    }
    ;[this.armR, this.armL] = arms
    this.faceH = 2.1
    this.portraitDist = 3.2
    Q = 1
    this.finish()
  }
  update(dt, t) {
    const hungry = this.mood === 'hungry'
    const b = Math.sin(t * 1.6 + this.seed)
    this.upper.scale.set(1 + b * 0.015, 1 + b * 0.02, 1 + b * 0.015)
    this.head.rotation.y = lerp(this.head.rotation.y, this.lookYaw, Math.min(1, dt * 4))
    const ease = Math.min(1, dt * 6)
    // stand up to walk, sit down otherwise
    const walking = this.mood === 'walk'
    this.standK = lerp(this.standK, walking ? 1 : 0, Math.min(1, dt * 2.5))
    const k = this.standK
    const stride = walking ? Math.sin(t * 6.5) * 0.5 * k : 0
    this.upper.position.y = k * 0.6
    this.legs.forEach((l, i) => {
      l.position.y = 0.42 + k * 0.6
      l.rotation.x = -Math.PI / 2 * (1 - k) + (i ? stride : -stride)
    })
    this.root.rotation.z = lerp(this.root.rotation.z, 0, ease)
    if (this.mood === 'hug') {
      // a big hug: lean in, both arms forward and around, head tipped to the side, a happy squeeze
      const sq = 1 + Math.abs(Math.sin(t * 3)) * 0.03
      this.upper.scale.set(sq, sq, sq)
      this.root.rotation.x = lerp(this.root.rotation.x, 0.18, ease)
      this.head.rotation.x = lerp(this.head.rotation.x, 0.2, ease)
      this.head.rotation.z = lerp(this.head.rotation.z, 0.25, ease)
      this.armR.rotation.x = lerp(this.armR.rotation.x, -1.35, ease)
      this.armL.rotation.x = lerp(this.armL.rotation.x, -1.35, ease)
      // (the right arm is on the -x side: +z swings it inward)
      this.armR.rotation.z = lerp(this.armR.rotation.z, 0.75, ease)
      this.armL.rotation.z = lerp(this.armL.rotation.z, -0.75, ease)
      this.root.position.y = this.baseY
      return
    }
    this.root.rotation.x = lerp(this.root.rotation.x, 0, ease)
    this.armL.rotation.z = lerp(this.armL.rotation.z, 0, ease)
    if (this.mood === 'walk') {
      // a big, slow waddle: rock side to side, bob a little, swing the arms
      const w = t * 6.5
      this.root.rotation.z = Math.sin(w) * 0.13
      this.root.position.y = this.baseY + Math.abs(Math.sin(w)) * 0.08
      this.armR.rotation.x = -0.5 + Math.sin(w) * 0.45
      this.armL.rotation.x = -0.5 - Math.sin(w) * 0.45
      this.armR.rotation.z = lerp(this.armR.rotation.z, -0.2, ease)
      this.armL.rotation.z = lerp(this.armL.rotation.z, 0.2, ease)
      this.head.rotation.x = Math.sin(w * 2) * 0.04
      this.head.rotation.z = 0
      return
    }
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
    const cream = '#efdcb8'
    const p = new Parts(SMOOTH)
    p.add(sphere(0.45, S(18), S(14)), brown, { y: 0.45, sy: 1.15, sz: 0.95, ...FUR })
    shadeAll(p, (x, y, z) => 0.85 + 0.18 * sm(-0.3, 0.4, z))
    p.add(sphere(0.34, S(15), S(10)), cream, { y: 0.4, z: 0.26, sz: 0.5, jitter: 0.04, rough: 0.95 })
    // little chevrons of feathers on the chest
    for (let r = 0; r < 3; r++)
      for (let i = 0; i < 3 - (r === 2 ? 1 : 0); i++) {
        const x = (i - (r === 2 ? 0.5 : 1)) * 0.11
        const y = 0.55 - r * 0.13
        const z = 0.26 + 0.17 * Math.sqrt(Math.max(0, 1 - (x / 0.34) ** 2 - ((y - 0.4) / 0.34) ** 2)) - 0.005
        p.add(torus(0.035, 0.009, S(3), S(6), Math.PI * 0.8), '#a88760', { x, y, z, rz: -Math.PI / 2 - Math.PI * 0.4, jitter: 0, rough: 0.95 })
      }
    for (const s of [-1, 1])
      for (let i = 0; i < 3; i++) p.add(capsule(0.025, 0.06, S(3), S(4)), '#f2a33a', { x: s * 0.13 + (i - 1) * 0.04, y: 0.03, z: 0.2 + Math.abs(i - 1) * -0.02, rx: Math.PI / 2, ry: (i - 1) * 0.4, jitter: 0, rough: 0.5 })
    this.root.add(p.build())
    const head = new THREE.Group()
    head.position.y = 1.05
    const hp = new Parts(SMOOTH)
    hp.add(sphere(0.4, S(18), S(14)), brown, { sy: 0.88, ...FUR })
    for (const s of [-1, 1]) hp.add(cone(0.08, 0.24, S(6)), brown, { x: s * 0.24, y: 0.36, rz: -s * 0.35, ...FUR })
    shadeAll(hp, (x, y, z) => 0.88 + 0.15 * sm(-0.2, 0.3, z))
    for (const s of [-1, 1]) {
      hp.add(cyl(0.17, 0.17, 0.05, S(18)), '#f3e6cc', { x: s * 0.16, y: 0.02, z: 0.31, rx: Math.PI / 2 - 0.2, jitter: 0, rough: 0.95 })
      hp.add(torus(0.17, 0.018, S(4), S(18)), '#7d5c3c', { x: s * 0.16, y: 0.02, z: 0.33, rx: -0.2, jitter: 0, rough: 0.95 })
    }
    hp.add(cone(0.06, 0.15, S(8)), '#e8952c', { y: -0.08, z: 0.38, rx: Math.PI / 2 + 0.4, jitter: 0, rough: 0.35 })
    head.add(hp.build())
    const ep = new Parts(SMOOTH)
    for (const s of [-1, 1]) animalEye(ep, s * 0.16, 0.03, 0.335, 0.085, { ry: s * 0.15, rx: -0.2, iris: '#f2b632' })
    this.eyes = ep.build()
    head.add(this.eyes)
    const gp = new Parts(SMOOTH)
    for (const s of [-1, 1]) gp.add(torus(0.13, 0.02, S(4), S(18)), '#3a3030', { x: s * 0.16, y: 0.03, z: 0.4, rx: -0.2, jitter: 0, rough: 0.3, metal: 0.4 })
    gp.add(torus(0.035, 0.015, S(4), S(8), Math.PI), '#3a3030', { y: 0.05, z: 0.42, rx: -0.2, jitter: 0, rough: 0.3, metal: 0.4 })
    this.glasses = gp.build()
    this.glasses.visible = false
    head.add(this.glasses)
    this.root.add(head)
    this.head = head
    const wings = []
    for (const s of [-1, 1]) {
      const wp = new Parts(SMOOTH)
      wp.add(sphere(0.3, S(12), S(9)), '#86623f', { y: -0.2, sx: 0.32, sz: 0.75, ...FUR })
      for (let i = 0; i < 4; i++) wp.add(sphere(0.09, S(6), S(4)), i % 2 ? '#6e5034' : '#7a5a3a', { x: s * 0.02, y: -0.42 - (i % 2) * 0.03, z: -0.15 + i * 0.1, sx: 0.3, sy: 1.6, jitter: 0.03, rough: 0.92 })
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
    const white = '#fff4e6'
    const p = new Parts(SMOOTH)
    p.add(sphere(0.3, S(18), S(14)), o, { y: 0.3, sy: 1.15, sz: 1.1, ...FUR })
    for (const s of [-1, 1]) p.add(sphere(0.13, S(10), S(8)), o, { x: s * 0.17, y: 0.14, z: -0.08, sz: 1.5, ...FUR })
    shadeAll(p, (x, y, z) => 0.88 + 0.16 * sm(-0.3, 0.3, z))
    p.add(sphere(0.18, S(12), S(9)), white, { y: 0.32, z: 0.2, sz: 0.5, jitter: 0.03, rough: 0.95 })
    for (const s of [-1, 1]) {
      p.add(capsule(0.06, 0.16, S(3), S(8)), o, { x: s * 0.1, y: 0.13, z: 0.2, ...FUR })
      p.add(sphere(0.075, S(9), S(6)), white, { x: s * 0.11, y: 0.04, z: 0.25, sy: 0.6, sz: 1.2, jitter: 0.02, rough: 0.95 })
    }
    // tabby stripes over the back
    for (let i = 0; i < 4; i++) p.add(torus(0.3, 0.024, S(3), S(12), Math.PI * 0.55), dark, { y: 0.48 - i * 0.1, z: -0.06, sx: 1.02 - i * 0.02, sz: 1.12, rx: Math.PI / 2 + 0.1, rz: Math.PI * 0.725, jitter: 0, rough: 0.92 })
    this.root.add(p.build())
    const head = new THREE.Group()
    head.position.set(0, 0.68, 0.08)
    const hp = new Parts(SMOOTH)
    hp.add(sphere(0.26, S(18), S(14)), o, { sx: 1.1, sy: 0.92, ...FUR })
    for (const s of [-1, 1]) {
      hp.add(sphere(0.12, S(9), S(8)), o, { x: s * 0.2, y: -0.07, z: 0.08, sx: 0.9, ...FUR })
      hp.add(cone(0.1, 0.18, S(8)), o, { x: s * 0.14, y: 0.22, rz: -s * 0.25, ...FUR })
    }
    shadeAll(hp, (x, y, z) => 0.9 + 0.12 * sm(-0.2, 0.2, z))
    for (const s of [-1, 1]) {
      hp.add(cone(0.055, 0.11, S(6)), '#ffb3b3', { x: s * 0.14, y: 0.2, z: 0.035, rz: -s * 0.25, jitter: 0, rough: 0.8 })
      animalEye(hp, s * 0.1, 0.03, 0.2, 0.042, { ry: s * 0.4, rx: -0.1, iris: '#7fc65a', slit: true, sy: 1.15 })
      for (let i = 0; i < 3; i++) hp.add(cyl(0.003, 0.002, 0.18, S(3)), '#ffffff', { x: s * 0.2, y: -0.06 - i * 0.025, z: 0.2, rz: s * (Math.PI / 2 - 0.15 + i * 0.12), jitter: 0, rough: 0.5 })
      hp.add(capsule(0.012, 0.05, S(3), S(4)), dark, { x: s * 0.06, y: 0.21, z: 0.17, rz: s * 0.3, rx: -0.4, jitter: 0, rough: 0.9 })
    }
    hp.add(sphere(0.1, S(10), S(8)), white, { y: -0.07, z: 0.2, sx: 1.3, sz: 0.6, jitter: 0.02, rough: 0.95 })
    hp.add(sphere(0.026, S(8), S(6)), '#ff8fa3', { y: -0.03, z: 0.26, sx: 1.2, sy: 0.8, jitter: 0, rough: 0.3 })
    const ma = Math.PI * 0.7
    for (const s of [-1, 1]) hp.add(torus(0.025, 0.006, S(3), S(8), ma), '#9a5a3a', { x: s * 0.024, y: -0.085, z: 0.258, rz: -Math.PI / 2 - ma / 2, jitter: 0, rough: 0.7 })
    hp.add(capsule(0.012, 0.05, S(3), S(4)), dark, { y: 0.2, z: 0.18, rx: -0.5, jitter: 0, rough: 0.9 })
    head.add(hp.build())
    this.root.add(head)
    this.head = head
    const tail = new THREE.Group()
    tail.position.set(0, 0.12, -0.3)
    const tp = new Parts(SMOOTH)
    // a gently curving tail with rings and a dark tip
    let ty = 0
    let tz = 0
    for (let i = 0; i < 5; i++) {
      const a = i * 0.16
      tp.add(capsule(0.05 - i * 0.004, 0.1, S(3), S(8)), i % 2 ? dark : o, { y: ty + 0.06, z: tz, rx: -a, ...FUR })
      ty += Math.cos(a) * 0.11
      tz -= Math.sin(a) * 0.11
    }
    tp.add(sphere(0.05, S(8), S(6)), dark, { y: ty + 0.02, z: tz, ...FUR })
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
    p.add(sphere(0.32, S(18), S(14)), w, { y: 0.3, sz: 1.2, ...FUR })
    for (const s of [-1, 1]) p.add(sphere(0.14, S(10), S(8)), w, { x: s * 0.17, y: 0.14, z: -0.12, sz: 1.4, ...FUR })
    shadeAll(p, (x, y, z) => 0.9 + 0.1 * sm(0, 0.4, y))
    p.add(sphere(0.11, S(10), S(8)), '#ffffff', { y: 0.34, z: -0.38, jitter: 0.03, rough: 1 })
    for (const s of [-1, 1]) {
      p.add(sphere(0.1, S(9), S(8)), w, { x: s * 0.15, y: 0.06, z: 0.25, sz: 1.5, sy: 0.5, ...FUR })
      p.add(sphere(0.07, S(8), S(6)), w, { x: s * 0.09, y: 0.07, z: 0.33, sz: 1.2, sy: 0.6, ...FUR })
      p.add(sphere(0.06, S(6), S(4)), '#ffd6e0', { x: s * 0.17, y: 0.02, z: 0.1, sz: 1.6, sy: 0.3, jitter: 0, rough: 0.9 })
    }
    this.root.add(p.build())
    const head = new THREE.Group()
    head.position.set(0, 0.6, 0.18)
    const hp = new Parts(SMOOTH)
    hp.add(sphere(0.24, S(18), S(14)), w, { ...FUR })
    for (const s of [-1, 1]) {
      hp.add(sphere(0.1, S(10), S(8)), w, { x: s * 0.09, y: 0.33, z: -0.03, sy: 3.2, sz: 0.45, rz: -s * 0.15, ...FUR })
      hp.add(sphere(0.12, S(9), S(8)), w, { x: s * 0.1, y: -0.06, z: 0.12, sx: 0.9, sz: 0.9, ...FUR })
    }
    shadeAll(hp, (x, y, z) => 0.92 + 0.08 * sm(-0.2, 0.2, z))
    for (const s of [-1, 1]) {
      hp.add(sphere(0.06, S(9), S(8)), '#ffb6c8', { x: s * 0.09, y: 0.33, z: 0.015, sy: 3.4, sz: 0.3, rz: -s * 0.15, jitter: 0, rough: 0.8 })
      animalEye(hp, s * 0.1, 0.04, 0.185, 0.042, { ry: s * 0.45, rx: -0.12, iris: '#5b2a2a', sy: 1.1 })
      hp.add(sphere(0.04, S(8), S(6)), '#ffc2d1', { x: s * 0.15, y: -0.07, z: 0.17, sz: 0.4, jitter: 0, rough: 0.8 })
      for (let i = 0; i < 3; i++) hp.add(cyl(0.003, 0.002, 0.16, S(3)), '#d8d2ca', { x: s * 0.14, y: -0.05 - i * 0.02, z: 0.2, rz: s * (Math.PI / 2 - 0.12 + i * 0.12), jitter: 0, rough: 0.5 })
    }
    hp.add(sphere(0.03, S(8), S(6)), '#ff8fa3', { y: -0.03, z: 0.24, sx: 1.2, sy: 0.85, jitter: 0, rough: 0.3 })
    hp.add(rbox(0.04, 0.03, 0.01, 0.4, S(4), S(4)), '#ffffff', { y: -0.11, z: 0.225, jitter: 0, rough: 0.3 })
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

// A tiny eye for birds and small animals (fewer triangles).
function dotEye(p, x, y, z, r, ry = 0) {
  p.add(sphere(r, S(8), S(6)), '#111111', { x, y, z, sz: 0.7, ry, jitter: 0, rough: 0.12 })
  p.add(sphere(r * 0.35, S(4), S(3)), '#ffffff', { x: x + Math.cos(ry) * r * 0.3, y: y + r * 0.35, z: z + r * 0.55, ry, jitter: 0, rough: 0.05 })
}

export function makeDuck(white) {
  const p = new Parts(SMOOTH)
  const c = white ? '#ffffff' : '#f6d64a'
  p.add(sphere(0.25, S(12), S(9)), c, { y: 0.12, sx: 1.0, sy: 0.75, sz: 1.35, ...FUR })
  p.add(sphere(0.16, S(10), S(8)), c, { y: 0.38, z: 0.22, ...FUR })
  for (const s of [-1, 1]) p.add(sphere(0.12, S(8), S(6)), darker(c, 0.92), { x: s * 0.2, y: 0.17, z: -0.05, sx: 0.35, sz: 1.5, rx: -0.15, ...FUR })
  p.add(cone(0.08, 0.15, S(6)), c, { y: 0.2, z: -0.34, rx: -1.2, ...FUR })
  shadeAll(p, (x, y) => 0.88 + 0.14 * sm(0, 0.35, y))
  p.add(rbox(0.12, 0.045, 0.15, 0.4, S(8), S(4)), '#f39c34', { y: 0.36, z: 0.4, jitter: 0, rough: 0.4 })
  for (const s of [-1, 1]) dotEye(p, s * 0.09, 0.42, 0.32, 0.026, s * 0.5)
  return p.build()
}

export function makeGull() {
  const g = new THREE.Group()
  const p = new Parts(SMOOTH)
  p.add(sphere(0.22, S(12), S(9)), '#ffffff', { sz: 2.0, sy: 0.8, ...FUR })
  p.add(sphere(0.13, S(9), S(8)), '#ffffff', { z: 0.42, y: 0.08, ...FUR })
  p.add(cone(0.1, 0.22, S(6)), '#e6e9ec', { z: -0.48, rx: -Math.PI / 2, sy: 1, sx: 1.4, sz: 0.3, ...FUR })
  p.add(cone(0.04, 0.16, S(6)), '#f2b134', { z: 0.6, y: 0.06, rx: Math.PI / 2, jitter: 0, rough: 0.35 })
  p.add(sphere(0.012, S(4), S(3)), '#e94b3c', { z: 0.58, y: 0.035, jitter: 0 })
  for (const s of [-1, 1]) dotEye(p, s * 0.08, 0.12, 0.5, 0.022, s * 0.9)
  g.add(p.build({ shadow: false }))
  const wings = []
  for (const s of [-1, 1]) {
    const wp = new Parts(SMOOTH)
    wp.add(rbox(0.75, 0.03, 0.3, 0.35, S(9), S(4)), '#f2f2f2', { x: s * 0.38, jitter: 0.03, rough: 0.9 })
    wp.add(rbox(0.22, 0.034, 0.27, 0.35, S(6), S(3)), '#9aa3ad', { x: s * 0.66, jitter: 0.02, rough: 0.9 })
    wp.add(rbox(0.1, 0.036, 0.22, 0.35, S(4), S(3)), '#2a2d33', { x: s * 0.8, jitter: 0, rough: 0.9 })
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
  const edge = darker(hex, 0.45)
  for (const s of [-1, 1]) {
    const wp = new Parts(SMOOTH)
    const W = { rx: -Math.PI / 2, mat: MAT2, jitter: 0, rough: 0.6 }
    // forewing and hindwing, each with a dark edge and pale spots
    wp.add(new THREE.CircleGeometry(0.15, 18), edge, { x: s * 0.13, y: -0.002, z: -0.06, sx: 1.0, sy: 0.75, rz: s * 0.4, ...W })
    wp.add(new THREE.CircleGeometry(0.13, 18), hex, { x: s * 0.13, y: 0.0, z: -0.055, sx: 1.0, sy: 0.72, rz: s * 0.4, ...W })
    wp.add(new THREE.CircleGeometry(0.1, 16), edge, { x: s * 0.09, y: -0.002, z: 0.08, sy: 0.9, ...W })
    wp.add(new THREE.CircleGeometry(0.085, 16), lighter(hex, 0.2), { x: s * 0.09, y: 0.0, z: 0.08, sy: 0.88, ...W })
    for (const [x, z, r] of [[0.19, -0.1, 0.022], [0.12, -0.12, 0.016], [0.1, 0.1, 0.018]]) wp.add(new THREE.CircleGeometry(r, 8), '#ffffff', { x: s * x, y: 0.002, z, ...W })
    // the body lies on the hinge line, so it stays still while the wings flap
    if (s === -1) {
      wp.add(capsule(0.016, 0.16, S(3), S(6)), '#2a2226', { rx: Math.PI / 2, mat: MAT2, flat: false, jitter: 0, rough: 0.7 })
      wp.add(sphere(0.022, S(6), S(4)), '#2a2226', { z: -0.11, mat: MAT2, flat: false, jitter: 0, rough: 0.7 })
    }
    const w = wp.build({ shadow: false })
    g.add(w)
    wings.push(w)
  }
  g.userData.wings = wings
  return g
}

// ---------- spooky friends ----------

// A little sheet ghost. Boo is a friend; others pop out of graves and fade away.
// Merged into a few meshes: the sheet, the dark face, the pink cheeks (and Boo's bow), two arms.
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
    this.mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xcfe0ff, emissiveIntensity: 0.45, roughness: 0.55, transparent: true, opacity: 0.94, side: THREE.DoubleSide })
    this.dark = new THREE.MeshStandardMaterial({ color: 0x2a2433, roughness: 0.2, transparent: true })
    this.pink = new THREE.MeshStandardMaterial({ color: 0xffa3c0, roughness: 0.6, transparent: true })
    // the sheet: a round top flowing down to a wavy hem
    const prof = []
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * (Math.PI / 2)
      prof.push(new THREE.Vector2(Math.max(0.001, Math.sin(a) * 0.5), 0.75 + Math.cos(a) * 0.5))
    }
    for (let i = 1; i <= 10; i++) {
      const t = i / 10
      prof.push(new THREE.Vector2(0.5 + 0.13 * Math.pow(t, 1.6), 0.75 - 0.75 * t))
    }
    const sheet = cachedGeo('ghostSheet', () => {
      const g = new THREE.LatheGeometry(prof, 48)
      const pos = g.attributes.position
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i)
        const y = pos.getY(i)
        const z = pos.getZ(i)
        const a = Math.atan2(x, z)
        const k = sm(0.45, 0, y)
        pos.setXYZ(i, x * (1 + Math.sin(a * 5) * 0.04 * k), y + Math.sin(a * 9) * 0.06 * k, z * (1 + Math.sin(a * 5) * 0.04 * k))
      }
      g.computeVertexNormals()
      return weldNormals(g)
    })
    const bp = new Parts(this.mat)
    bp.add(sheet, '#ffffff', { jitter: 0 })
    this.body.add(bp.build())
    const dp = new Parts(this.dark)
    for (const s of [-1, 1]) {
      dp.add(sphere(0.07, S(12), S(9)), '#000000', { x: s * 0.16, y: 0.82, z: 0.45, sy: 1.4, sz: 0.5, jitter: 0 })
    }
    dp.add(sphere(0.06, S(10), S(8)), '#000000', { y: 0.62, z: 0.49, sx: 1.2, sz: 0.4, jitter: 0 })
    this.body.add(dp.build())
    const pp = new Parts(this.pink)
    for (const s of [-1, 1]) pp.add(sphere(0.06, S(9), S(8)), '#000000', { x: s * 0.29, y: 0.68, z: 0.42, sy: 0.7, sz: 0.4, jitter: 0 })
    if (boo) {
      for (const s of [-1, 1]) pp.add(cone(0.11, 0.2, S(9)), '#000000', { x: s * 0.13, y: 1.22, z: 0.05, rz: (s * Math.PI) / 2, jitter: 0 })
      pp.add(sphere(0.06, S(9), S(8)), '#000000', { y: 1.22, z: 0.05, jitter: 0 })
    }
    this.body.add(pp.build())
    this.arms = [-1, 1].map((s) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, S(12), S(9)), this.mat)
      m.position.set(s * 0.6, 0.5, 0.05)
      m.scale.set(1.3, 0.7, 0.8)
      this.body.add(m)
      return m
    })
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
    const B = { jitter: 0.03, rough: 0.55 }
    this.root = new THREE.Group()
    this.seed = Math.random() * 10
    this.phase = 0
    this.talk = 0
    this.speed = 0
    this.lookYaw = 0
    this.mood = 'idle'
    const hipY = 0.9
    Q = 0.85
    // a bone: a shaft with knobbly ends
    const boneAt = (p, x, y0, y1, r, z = 0) => {
      const len = Math.abs(y1 - y0)
      p.add(capsule(r, Math.max(0.01, len - r * 2), S(3), S(8)), bone, { x, y: (y0 + y1) / 2, z, ...B })
      for (const yy of [y0, y1]) for (const s of [-1, 1]) p.add(sphere(r * 1.15, S(8), S(6)), bone, { x: x + s * r * 0.55, y: yy, z, ...B })
    }
    const legs = []
    for (const s of [-1, 1]) {
      const p = new Parts(SMOOTH)
      boneAt(p, 0, -0.02, -0.42, 0.04)
      p.add(sphere(0.06, S(9), S(8)), bone, { y: -0.45, z: 0.035, sz: 0.6, ...B })
      boneAt(p, 0, -0.47, -0.84, 0.033)
      p.add(rbox(0.11, 0.05, 0.12, 0.4, S(8), S(6)), bone, { y: -0.87, z: 0.0, ...B })
      for (let i = 0; i < 4; i++) p.add(capsule(0.012, 0.06, S(3), S(4)), bone, { x: (i - 1.5) * 0.026, y: -0.885, z: 0.1, rx: Math.PI / 2, ...B })
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
    // pelvis, spine of little vertebrae, ribs bending round to the breastbone, collarbones
    for (const s of [-1, 1]) b.add(sphere(0.1, S(10), S(8)), bone, { x: s * 0.08, y: 0.03, sx: 1.1, sy: 0.75, sz: 0.55, rz: s * 0.3, ...B })
    b.add(sphere(0.06, S(8), S(6)), bone, { y: 0.02, z: -0.04, ...B })
    for (let i = 0; i < 9; i++) b.add(cyl(0.032, 0.032, 0.045, S(8)), bone, { y: 0.1 + i * 0.065, z: -0.06, ...B })
    for (let i = 0; i < 4; i++) {
      const rr = 0.165 - Math.abs(i - 1.3) * 0.022
      b.add(torus(rr, 0.018, S(4), S(18)), bone, { y: 0.36 + i * 0.085, z: -0.01, rx: Math.PI / 2 - 0.15, sy: 0.72, ...B })
    }
    b.add(rbox(0.04, 0.26, 0.02, 0.4, S(4), S(8)), bone, { y: 0.48, z: 0.07, ...B })
    for (const s of [-1, 1]) b.add(capsule(0.022, 0.22, S(3), S(6)), bone, { x: s * 0.13, y: 0.7, rz: Math.PI / 2, ...B })
    body.add(b.build())
    const head = new THREE.Group()
    head.position.y = 0.95
    const h = new Parts(SMOOTH)
    h.add(sphere(0.24, S(18), S(14)), bone, { sy: 0.95, ...B })
    for (const s of [-1, 1]) {
      h.add(sphere(0.07, S(10), S(8)), dark, { x: s * 0.09, y: 0.02, z: 0.19, sz: 0.6, jitter: 0, rough: 0.9 })
      h.add(sphere(0.06, S(8), S(6)), bone, { x: s * 0.15, y: -0.06, z: 0.15, sz: 0.6, ...B })
    }
    h.add(cone(0.035, 0.07, S(3)), dark, { y: -0.07, z: 0.215, rx: Math.PI, jitter: 0, rough: 0.9 })
    // a small crack on the forehead
    h.add(rbox(0.008, 0.06, 0.01, 0.5, S(3), S(4)), '#c9c3b4', { x: 0.06, y: 0.15, z: 0.19, rz: 0.4, rx: -0.6, jitter: 0, rough: 0.9 })
    head.add(h.build())
    const j = new Parts(SMOOTH)
    j.add(rbox(0.26, 0.07, 0.16, 0.35, S(10), S(6)), bone, { y: -0.03, z: 0.08, ...B })
    for (let i = 0; i < 6; i++) j.add(rbox(0.03, 0.04, 0.02, 0.4, S(4), S(4)), '#ffffff', { x: -0.075 + i * 0.03, y: 0.02, z: 0.16, jitter: 0, rough: 0.3 })
    const jaw = j.build()
    jaw.position.set(0, -0.15, 0)
    head.add(jaw)
    this.jaw = jaw
    body.add(head)
    this.head = head
    const arms = []
    for (const s of [-1, 1]) {
      const p = new Parts(SMOOTH)
      boneAt(p, 0, -0.01, -0.32, 0.032)
      boneAt(p, 0, -0.35, -0.62, 0.026)
      p.add(rbox(0.07, 0.06, 0.03, 0.4, S(6), S(6)), bone, { y: -0.67, ...B })
      for (let i = 0; i < 4; i++) p.add(capsule(0.01, 0.07, S(3), S(4)), bone, { x: (i - 1.5) * 0.018, y: -0.74, ...B })
      p.add(capsule(0.01, 0.05, S(3), S(4)), bone, { x: -s * 0.04, y: -0.69, z: 0.02, rz: s * 0.6, ...B })
      const arm = p.build()
      arm.position.set(s * 0.28, 0.7, 0)
      arm.rotation.z = s * 0.1
      body.add(arm)
      arms.push(arm)
    }
    ;[this.armR, this.armL] = arms
    this.faceH = 1.85
    this.portraitDist = 2.2
    Q = 1
    this.root.traverse((m) => {
      if (m.isMesh) m.castShadow = true
    })
    mergeRig(this.root)
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
    // legs: a thin leg with a darker hoof or foot, pivoting at the top
    const legs = (pts, len, r, c, foot = null) => {
      for (const [x, z] of pts) {
        const lp = new Parts(SMOOTH)
        lp.add(cyl(r, r * 0.75, len, S(8)), c, { y: -len / 2, jitter: 0.03, rough: 0.9 })
        if (foot === 'hoof') lp.add(cyl(r * 0.8, r * 1.0, len * 0.1, S(8)), '#2b1d14', { y: -len * 0.95, jitter: 0, rough: 0.4 })
        if (foot === 'bird')
          for (let i = -1; i <= 1; i++) lp.add(capsule(r * 0.45, len * 0.25, S(3), S(4)), c, { x: i * r * 1.2, y: -len, z: r * 1.2, rx: Math.PI / 2, ry: i * 0.5, jitter: 0, rough: 0.6 })
        const leg = lp.build()
        leg.position.set(x, len, z)
        leg.userData.y = len
        this.root.add(leg)
        this.legs.push(leg)
      }
    }
    const eyes = (x, y, z, r = 0.035, iris = '#3a2416', o = {}) => {
      for (const s of [-1, 1]) animalEye(p, s * x, y, z, r, { ry: s * (o.ry ?? 0.5), rx: o.rx ?? -0.1, iris, slit: o.slit, sy: o.sy })
    }
    let faceH = 0.6
    switch (kind) {
      case 'deer': {
        const c = '#b07a4a'
        p.add(sphere(0.45, S(16), S(12)), c, { y: 1.0, sx: 0.85, sz: 1.6, ...FUR })
        p.add(capsule(0.12, 0.42, S(3), S(9)), c, { y: 1.45, z: 0.55, rx: 0.5, ...FUR })
        p.add(sphere(0.2, S(14), S(10)), c, { y: 1.78, z: 0.75, sz: 1.3, ...FUR })
        for (const s of [-1, 1]) p.add(sphere(0.09, S(9), S(8)), c, { x: s * 0.18, y: 1.95, z: 0.66, sx: 0.5, sy: 1.6, rz: -s * 0.5, ...FUR })
        // darker back, pale belly and throat
        shadeAll(p, (x, y) => (y > 1.38 ? 1.0 : 0.84 + 0.2 * sm(1.25, 0.7, y)))
        p.add(sphere(0.3, S(12), S(9)), '#e8d2b0', { y: 0.82, sx: 0.75, sz: 1.3, jitter: 0.03, rough: 0.95 })
        for (const [x, z] of [[0.18, 0.2], [-0.15, -0.1], [0.12, -0.35], [-0.2, 0.3], [0.05, 0.45], [-0.08, -0.45]]) p.add(sphere(0.045, S(6), S(4)), '#fff4e0', { x, y: 1.33 - Math.abs(x) * 0.25, z, sy: 0.5, jitter: 0, rough: 0.95 })
        for (const s of [-1, 1]) p.add(sphere(0.055, S(6), S(4)), '#e9b9a0', { x: s * 0.19, y: 1.95, z: 0.69, sx: 0.35, sy: 1.2, rz: -s * 0.5, jitter: 0, rough: 0.9 })
        p.add(sphere(0.11, S(9), S(8)), '#d9b48a', { y: 1.72, z: 0.95, sx: 0.9, ...FUR })
        p.add(sphere(0.06, S(8), S(6)), '#2b1d14', { y: 1.75, z: 1.04, sx: 1.2, sy: 0.8, jitter: 0, rough: 0.2 })
        // little antlers
        for (const s of [-1, 1]) {
          p.add(capsule(0.018, 0.26, S(3), S(4)), '#7a5a3a', { x: s * 0.1, y: 2.07, z: 0.7, rz: -s * 0.4, jitter: 0, rough: 0.7 })
          p.add(capsule(0.014, 0.1, S(3), S(4)), '#7a5a3a', { x: s * 0.16, y: 2.12, z: 0.76, rz: -s * 0.2, rx: 0.6, jitter: 0, rough: 0.7 })
        }
        eyes(0.12, 1.84, 0.88, 0.04, '#3a2416', { ry: 0.6 })
        p.add(sphere(0.09, S(8), S(6)), '#ffffff', { y: 1.15, z: -0.7, sy: 1.2, jitter: 0, rough: 1 })
        legs([[0.22, 0.45], [-0.22, 0.45], [0.22, -0.45], [-0.22, -0.45]], 0.8, 0.05, '#8a5a35', 'hoof')
        faceH = 1.8
        break
      }
      case 'fox': {
        const c = '#e8742a'
        const w = '#fff4e6'
        p.add(sphere(0.3, S(15), S(10)), c, { y: 0.48, sz: 1.6, ...FUR })
        p.add(sphere(0.22, S(14), S(10)), c, { y: 0.72, z: 0.5, ...FUR })
        for (const s of [-1, 1]) p.add(cone(0.08, 0.2, S(6)), c, { x: s * 0.12, y: 0.95, z: 0.45, rz: -s * 0.2, ...FUR })
        p.add(sphere(0.18, S(12), S(9)), c, { y: 0.55, z: -0.62, sz: 2.2, rx: -0.5, ...FUR })
        shadeAll(p, (x, y) => 0.85 + 0.18 * sm(0.3, 0.75, y))
        p.add(sphere(0.18, S(10), S(8)), w, { y: 0.42, z: 0.32, sz: 0.7, jitter: 0.03, rough: 0.95 })
        for (const s of [-1, 1]) {
          p.add(sphere(0.1, S(9), S(6)), w, { x: s * 0.13, y: 0.64, z: 0.56, sx: 0.8, jitter: 0.03, rough: 0.95 })
          p.add(cone(0.05, 0.08, S(6)), '#2b1d14', { x: s * 0.125, y: 1.03, z: 0.46, rz: -s * 0.2, jitter: 0, rough: 0.9 })
          p.add(cone(0.05, 0.13, S(6)), w, { x: s * 0.12, y: 0.94, z: 0.475, rz: -s * 0.2, sz: 0.4, jitter: 0, rough: 0.95 })
        }
        p.add(cone(0.11, 0.25, S(9)), w, { y: 0.66, z: 0.72, rx: Math.PI / 2, jitter: 0.03, rough: 0.95 })
        p.add(sphere(0.04, S(8), S(6)), '#1d1717', { y: 0.67, z: 0.85, jitter: 0, rough: 0.2 })
        eyes(0.09, 0.78, 0.67, 0.035, '#d9902a', { ry: 0.45, slit: true, sy: 1.1 })
        p.add(sphere(0.1, S(8), S(6)), w, { y: 0.72, z: -0.93, sz: 1.2, jitter: 0.02, rough: 0.95 })
        legs([[0.12, 0.25], [-0.12, 0.25], [0.12, -0.25], [-0.12, -0.25]], 0.35, 0.04, '#3b2a1e')
        faceH = 0.75
        break
      }
      case 'chicken': {
        p.add(sphere(0.25, S(14), S(10)), '#ffffff', { y: 0.45, sz: 1.2, ...FUR })
        p.add(sphere(0.14, S(10), S(9)), '#ffffff', { y: 0.72, z: 0.15, ...FUR })
        for (const s of [-1, 1]) p.add(sphere(0.15, S(9), S(8)), '#f4f1ea', { x: s * 0.22, y: 0.47, z: -0.02, sx: 0.3, sz: 1.2, rx: -0.2, ...FUR })
        for (let i = 0; i < 3; i++) p.add(sphere(0.1, S(8), S(6)), '#f6f3ec', { x: (i - 1) * 0.06, y: 0.64, z: -0.3, sx: 0.4, sy: 1.6, rx: -0.6 + (i - 1) * 0.1, rz: (i - 1) * 0.3, ...FUR })
        shadeAll(p, (x, y) => 0.86 + 0.14 * sm(0.25, 0.6, y))
        p.add(cone(0.05, 0.12, S(6)), '#f2a33a', { y: 0.7, z: 0.3, rx: Math.PI / 2, jitter: 0, rough: 0.35 })
        for (let i = 0; i < 3; i++) p.add(sphere(0.045, S(8), S(6)), '#e94b3c', { y: 0.86 + (i % 2) * 0.02, z: 0.1 + i * 0.05, sx: 0.6, jitter: 0, rough: 0.5 })
        p.add(sphere(0.04, S(8), S(6)), '#e94b3c', { y: 0.62, z: 0.26, sx: 0.6, sy: 1.3, jitter: 0, rough: 0.5 })
        eyes(0.07, 0.75, 0.25, 0.025, '#d98a1a', { ry: 0.9 })
        legs([[0.08, 0], [-0.08, 0]], 0.25, 0.02, '#f2a33a', 'bird')
        faceH = 0.72
        break
      }
      case 'squirrel': {
        const c = '#b5582f'
        p.add(sphere(0.16, S(12), S(9)), c, { y: 0.28, sy: 1.3, ...FUR })
        p.add(sphere(0.12, S(12), S(9)), c, { y: 0.52, z: 0.06, ...FUR })
        for (const s of [-1, 1]) p.add(cone(0.04, 0.11, S(6)), c, { x: s * 0.065, y: 0.67, z: 0.04, rz: -s * 0.15, ...FUR })
        // the big bushy tail: soft lumps curling up the back
        for (let i = 0; i < 4; i++) p.add(sphere(0.12 + i * 0.01, S(9), S(8)), i % 2 ? '#c8693a' : '#bf6133', { y: 0.22 + i * 0.15, z: -0.22 - Math.sin(i * 0.9) * 0.08, sz: 0.85, ...FUR })
        shadeAll(p, (x, y, z) => 0.86 + 0.16 * sm(-0.1, 0.12, z))
        p.add(sphere(0.1, S(9), S(8)), '#f2dcc0', { y: 0.28, z: 0.09, sz: 0.6, sy: 1.4, jitter: 0.03, rough: 0.95 })
        for (const s of [-1, 1]) p.add(sphere(0.05, S(8), S(6)), '#f2dcc0', { x: s * 0.06, y: 0.48, z: 0.13, jitter: 0.02, rough: 0.95 })
        p.add(sphere(0.022, S(6), S(4)), '#2b1d14', { y: 0.53, z: 0.18, jitter: 0, rough: 0.2 })
        for (const s of [-1, 1]) p.add(sphere(0.035, S(6), S(4)), c, { x: s * 0.07, y: 0.33, z: 0.14, sy: 1.4, ...FUR })
        eyes(0.055, 0.56, 0.135, 0.022, '#2b1d14', { ry: 0.6 })
        legs([[0.06, 0.06], [-0.06, 0.06]], 0.12, 0.025, c)
        faceH = 0.52
        break
      }
      case 'hedgehog': {
        p.add(sphere(0.22, S(14), S(8), 0, Math.PI / 2), '#7a5a3a', { y: 0.08, sz: 1.3, ...FUR })
        for (let i = 0; i < 44; i++) {
          const a = (i / 44) * Math.PI * 2 * 3.0
          const r = 0.06 + (i / 44) * 0.14
          const x = Math.cos(a) * r
          const z = Math.sin(a) * r * 1.2 - 0.05
          p.add(cone(0.035, 0.16, S(4)), i % 3 ? '#5a4030' : '#d8c8b0', { x, y: 0.2 + (0.2 - r) * 0.3, z, rx: (z / 0.26) * 0.9 - 0.45, rz: -(x / 0.2) * 0.9, jitter: 0, rough: 0.8 })
        }
        p.add(sphere(0.1, S(10), S(8)), '#e8cfae', { y: 0.12, z: 0.25, sz: 1.3, jitter: 0.03, rough: 0.95 })
        p.add(sphere(0.025, S(6), S(4)), '#1d1717', { y: 0.12, z: 0.38, jitter: 0, rough: 0.2 })
        eyes(0.05, 0.17, 0.29, 0.018, '#1d1717', { ry: 0.5 })
        faceH = 0.18
        break
      }
      case 'crab': {
        const c = '#e8533e'
        p.add(sphere(0.22, S(14), S(9)), c, { y: 0.18, sy: 0.5, sx: 1.3, ...FUR, rough: 0.45 })
        shadeAll(p, (x, y) => 0.8 + 0.25 * sm(0.12, 0.26, y))
        for (const s of [-1, 1]) {
          p.add(cyl(0.015, 0.015, 0.12, S(4)), c, { x: s * 0.07, y: 0.3, z: 0.1, jitter: 0, rough: 0.45 })
          animalEye(p, s * 0.07, 0.37, 0.11, 0.032, { ry: s * 0.3, iris: null })
          // claw: an arm and a two-part pincer
          p.add(capsule(0.03, 0.12, S(3), S(6)), c, { x: s * 0.25, y: 0.2, z: 0.14, rz: s * 1.2, ry: -s * 0.5, jitter: 0, rough: 0.45 })
          p.add(sphere(0.085, S(9), S(8)), c, { x: s * 0.35, y: 0.24, z: 0.2, sy: 0.75, sz: 1.2, jitter: 0, rough: 0.45 })
          p.add(cone(0.035, 0.12, S(6)), c, { x: s * 0.33, y: 0.27, z: 0.31, rx: Math.PI / 2 - 0.2, jitter: 0, rough: 0.45 })
          p.add(cone(0.03, 0.1, S(6)), darker(c, 0.85), { x: s * 0.37, y: 0.22, z: 0.3, rx: Math.PI / 2 + 0.25, jitter: 0, rough: 0.45 })
          for (let i = 0; i < 3; i++) {
            p.add(capsule(0.014, 0.12, S(3), S(4)), c, { x: s * 0.26, y: 0.16, z: -0.1 + i * 0.1, rz: s * 1.0, jitter: 0, rough: 0.45 })
            p.add(capsule(0.012, 0.12, S(3), S(4)), darker(c, 0.9), { x: s * 0.36, y: 0.08, z: -0.1 + i * 0.1, rz: s * 0.3, jitter: 0, rough: 0.45 })
          }
        }
        faceH = 0.3
        break
      }
      case 'frog': {
        const c = '#5cbf4a'
        p.add(sphere(0.2, S(15), S(10)), c, { y: 0.18, sz: 1.2, sy: 0.8, ...FUR, rough: 0.35 })
        for (const s of [-1, 1]) {
          p.add(sphere(0.07, S(9), S(8)), c, { x: s * 0.09, y: 0.33, z: 0.08, ...FUR, rough: 0.35 })
          // back legs folded at the sides, with webbed feet; little front legs
          p.add(sphere(0.08, S(9), S(8)), c, { x: s * 0.17, y: 0.08, z: -0.08, sx: 0.7, sz: 1.6, ...FUR, rough: 0.35 })
          p.add(sphere(0.05, S(8), S(6)), c, { x: s * 0.2, y: 0.02, z: 0.06, sx: 1.4, sy: 0.35, sz: 1.2, ...FUR, rough: 0.35 })
          p.add(capsule(0.025, 0.07, S(3), S(6)), c, { x: s * 0.1, y: 0.06, z: 0.17, rz: s * 0.3, ...FUR, rough: 0.35 })
        }
        for (const [x, z] of [[0.06, 0.0], [-0.08, -0.08], [0.02, -0.13]]) p.add(sphere(0.03, S(6), S(4)), '#3f8f33', { x, y: 0.33 - Math.abs(z) * 0.4, z, sy: 0.3, jitter: 0, rough: 0.4 })
        shadeAll(p, (x, y) => 0.82 + 0.22 * sm(0.05, 0.3, y))
        p.add(sphere(0.16, S(12), S(8)), '#d8f0b0', { y: 0.12, z: 0.06, sz: 1.15, sy: 0.6, jitter: 0.02, rough: 0.4 })
        for (const s of [-1, 1]) animalEye(p, s * 0.1, 0.36, 0.11, 0.045, { ry: s * 0.5, rx: -0.3, iris: '#e8c23a', base: '#2e6b24' })
        p.add(torus(0.12, 0.007, S(3), S(12), Math.PI * 0.7), '#2e6b24', { y: 0.24, z: 0.12, rx: -0.5, rz: -Math.PI / 2 - Math.PI * 0.35, sz: 1.2, jitter: 0, rough: 0.5 })
        faceH = 0.3
        break
      }
      default: {
        // duckling
        p.add(sphere(0.16, S(12), S(9)), '#ffe066', { y: 0.2, sz: 1.3, ...FUR })
        p.add(sphere(0.1, S(10), S(8)), '#ffe066', { y: 0.38, z: 0.12, ...FUR })
        for (const s of [-1, 1]) p.add(sphere(0.07, S(8), S(6)), '#ffd84a', { x: s * 0.13, y: 0.23, z: -0.02, sx: 0.35, sz: 1.4, ...FUR })
        shadeAll(p, (x, y) => 0.88 + 0.14 * sm(0.1, 0.35, y))
        p.add(rbox(0.08, 0.03, 0.09, 0.4, S(6), S(4)), '#f39c34', { y: 0.36, z: 0.24, jitter: 0, rough: 0.4 })
        eyes(0.05, 0.42, 0.19, 0.018, null, { ry: 0.6 })
        legs([[0.05, 0], [-0.05, 0]], 0.08, 0.015, '#f39c34', 'bird')
        faceH = 0.38
      }
    }
    this.body.add(p.build())
    this.faceH = faceH
    this.portraitDist = Math.max(1.2, faceH * 1.6)
    this.root.traverse((m) => {
      if (m.isMesh) m.castShadow = true
    })
    mergeRig(this.root)
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
    if (this.kind === 'frog' || this.kind === 'squirrel') {
      // hoppers leave the ground all together: legs push back to take off, reach forward to land,
      // and the body tips nose-up going up and nose-down coming down
      const h = Math.sin(this.phase * 0.5)
      const lift = moving ? Math.abs(h) * 0.25 : 0
      const climb = moving ? Math.cos(this.phase * 0.5) * Math.sign(h) : 0
      this.body.position.y = lift + (moving ? 0 : Math.sin(t * 2 + this.seed) * 0.01)
      this.body.rotation.x = -climb * 0.22
      this.legs.forEach((l) => {
        l.position.y = l.userData.y + lift
        l.rotation.x = climb * 0.7
      })
    } else {
      this.legs.forEach((l, i) => (l.rotation.x = (i % 2 ? sw : -sw) * 0.6))
      this.body.position.y = moving ? Math.abs(sw) * 0.03 : Math.sin(t * 2 + this.seed) * 0.01
    }
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
    detail: 0.55,
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
  { skin: '#f5d3ba', hair: '#d9d4cc', hairStyle: 'bun', shirt: '#ff8fb1', dress: '#e94b6b', longSleeves: true, pants: '#e94b6b', shoes: '#7a5a3a', apron: '#ffffff', detail: 0.6 },
  { skin: '#f3cfb0', hair: '#6b4a2b', hairStyle: 'short', hat: 'chef', shirt: '#ffffff', apron: '#f5a742', pants: '#5a6b8c', pantsLong: true, shoes: '#2a2a2a', detail: 0.6 },
  { skin: '#e8b894', hair: '#1b1b22', hairStyle: 'bob', shirt: '#4fb0a5', stripes: '#ffffff', dress: '#3b7dd8', pants: '#3b7dd8', shoes: '#ff6f91', hat: 'bucket', hatColor: '#ffcf3f', detail: 0.6 },
  { skin: '#f0c8a8', hair: '#f4f4f4', hairStyle: 'bald', beard: '#f4f4f4', glasses: '#7a4a2a', shirt: '#7b9a5a', coat: '#6b4a2b', longSleeves: true, pants: '#4a4a5a', pantsLong: true, shoes: '#3a2a1a', detail: 0.6 },
  { kid: true, skin: '#ffd7bf', hair: '#c46a2b', hairStyle: 'pigtails', shirt: '#ffcf3f', dress: '#5bc0eb', pants: '#5bc0eb', socks: '#ffffff', shoes: '#e94b3c', detail: 0.6 },
  { skin: '#d9a27c', hair: '#2d1e14', hairStyle: 'short', glasses: '#333333', shirt: '#ffffff', coat: '#ffffff', longSleeves: true, pants: '#3b5998', pantsLong: true, shoes: '#2a2a2a', bow: '#3b7dd8', detail: 0.6 },
]

LOOKS.sam = { skin: '#d9a27c', hair: '#f4f4f4', hairStyle: 'bald', beard: '#f4f4f4', hat: 'bucket', hatColor: '#3b7dd8', shirt: '#ffffff', stripes: '#e94b3c', pants: '#5a6b8c', pantsLong: true, shoes: '#6b4a2b' }
LOOKS.pam = { skin: '#f7d6c0', hair: '#c46a2b', hairStyle: 'pigtails', hat: 'bucket', hatColor: '#ff8fb1', shirt: '#ffffff', dress: '#ffcf3f', pants: '#ffcf3f', shoes: '#ff6f91' }
LOOKS.guard = { detail: 0.65, skin: '#f2c9a6', hair: '#3b2a1f', hairStyle: 'short', hat: 'helmet', shirt: '#c9ced6', stripes: '#b3bac5', coat: '#3f63c9', belt: '#6b4a2b', gloves: '#a8afba', longSleeves: true, pants: '#8a929e', pantsLong: true, shoes: '#5b6270', shield: '#3f63c9', spear: true }
LOOKS.percy = { ...LOOKS.guard, detail: 0.8, skin: '#d9a27c', cape: '#3f63c9', shield: '#e94b3c' }
// a little grey alien: grey all over, big black eyes, no clothes but a thin silver belt
LOOKS.alien = { detail: 0.7, grey: true, skin: '#a3abb1', hair: '#a3abb1', hairStyle: 'none', cheeks: '#a3abb1', shirt: '#a3abb1', pants: '#a3abb1', pantsLong: true, shoes: '#959ea4', gloves: '#a3abb1', brows: '#a3abb1' }
