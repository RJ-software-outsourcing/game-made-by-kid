// Island shape, heights and layout. Pure JavaScript (no three.js), so the map and tools can use it too.
// Coordinates: x goes east, z goes south, y is up. 1 unit ≈ 1 meter. The world spans -HALF..HALF.
//
// Layout: the King's castle (with a moat) sits in the middle, the village just south of it. A ring
// road circles the island just inside the beach, and the places along it are spread evenly (one every
// 45°). A small loop road goes around the moat; spokes join it to the ring.
// Lighthouse Island is a small island of its own, reached only over Bear Bridge.

export const HALF = 145

// ---------- small math helpers ----------
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
export const lerp = (a, b, t) => a + (b - a) * t
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}
export function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hash2(ix, iz) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
export function vnoise(x, z) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uz = fz * fz * (3 - 2 * fz)
  return lerp(lerp(hash2(ix, iz), hash2(ix + 1, iz), ux), lerp(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), ux), uz)
}
export function fbm(x, z) {
  return 0.5 * vnoise(x, z) + 0.3 * vnoise(x * 2.1 + 5.3, z * 2.1 - 1.7) + 0.2 * vnoise(x * 4.3 - 3.1, z * 4.3 + 8.2)
}

// Distance from (x, z) to a polyline [[x, z], ...]. Also returns where along it (segment index + t).
export function polyDist(x, z, pts) {
  let best = Infinity
  let seg = 0
  let bt = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]
    const [bx, bz] = pts[i + 1]
    const dx = bx - ax
    const dz = bz - az
    const len2 = dx * dx + dz * dz
    let t = len2 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0
    t = clamp(t, 0, 1)
    const px = ax + dx * t - x
    const pz = az + dz * t - z
    const d = px * px + pz * pz
    if (d < best) {
      best = d
      seg = i
      bt = t
    }
  }
  return { d: Math.sqrt(best), seg, t: bt }
}

const DEG = Math.PI / 180
// A spot at an angle (degrees, atan2(z, x): 0 = east, 90 = south, 180 = west, 270 = north) and radius.
export const polar = (deg, r) => [Math.cos(deg * DEG) * r, Math.sin(deg * DEG) * r]
// Rotation so a door looks outward (away from the island center) or inward.
export const faceOut = (deg) => Math.atan2(Math.cos(deg * DEG), Math.sin(deg * DEG))
export const faceIn = (deg) => Math.atan2(-Math.cos(deg * DEG), -Math.sin(deg * DEG))
// The point `dist` in front of something at (x, z) facing `rot`.
export const ahead = (x, z, rot, dist) => [x + Math.sin(rot) * dist, z + Math.cos(rot) * dist]

// ---------- coast and ring road ----------

// Coast radius every 15°.
const COAST = [100, 101, 103, 104, 102, 99, 97, 99, 102, 104, 103, 101, 100, 102, 104, 105, 103, 101, 102, 104, 103, 100, 101, 100]

function coastSmooth(a) {
  let u = (a / (Math.PI * 2)) * 24
  u = ((u % 24) + 24) % 24
  const i = Math.floor(u)
  const t = u - i
  const n = 24
  const p0 = COAST[(i + n - 1) % n]
  const p1 = COAST[i]
  const p2 = COAST[(i + 1) % n]
  const p3 = COAST[(i + 2) % n]
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}
export function coastRadius(a) {
  return coastSmooth(a) + 2.0 * Math.sin(a * 11 + 0.7) + 1.3 * Math.sin(a * 17 + 2.1)
}
export function inland(x, z) {
  return coastRadius(Math.atan2(z, x)) - Math.hypot(x, z)
}

const RING_INSET = 21
export const ringRadius = (deg) => coastSmooth(deg * DEG) - RING_INSET
export const ringPos = (deg, off = 0) => polar(deg, ringRadius(deg) + off)
export const RING = []
for (let i = 0; i <= 64; i++) RING.push(ringPos((i / 64) * 360))

// ---------- landmarks ----------

export const MOUNTAIN = { x: -10, z: -47, r: 19, h: 20, block: 15.5 }
export const POND = { x: -29, z: -25, r: 7 }
// A little creek runs from the foot of Mount Puff into the pond.
export const STREAM = [[-18, -37], [-22.5, -32], [-26, -28]]
export const STREAM_HALF = 1.4

// Small islands off the coast, each joined to the main island by a wooden bridge.
const islet = (id, deg, dist, r, h, from, to, w = 3.6) => {
  const [x, z] = polar(deg, dist)
  const [ax, az] = polar(deg, from)
  const [bx, bz] = polar(deg, to)
  return { id, deg, x, z, r, h, bridge: { id, ax, az, bx, bz, w } }
}
export const ISLETS = [
  islet('lighthouse', 315, 124, 16, 3.4, 94.5, 110.5, 3.8),
  islet('turtle', 200, 122, 12, 2.4, 99, 113),
  islet('flower', 62, 121, 11, 2.6, 97.5, 112.5),
]
export const ISLET = ISLETS[0]
export const BRIDGES = ISLETS.map((i) => i.bridge)
export const BRIDGE = BRIDGES[0] // Bear Bridge
export const BRIDGE_MID = [(BRIDGE.ax + BRIDGE.bx) / 2, (BRIDGE.az + BRIDGE.bz) / 2]
export const ISLE_OF = Object.fromEntries(ISLETS.map((i) => [i.id, i]))

export const GRAVEYARD = (() => {
  const deg = 225
  const [x, z] = ringPos(deg, -15)
  const rot = faceOut(deg)
  return { x, z, r: 13, rot, deg }
})()
// Gravestones in neat-ish rows, leaving a path from the gate to the middle.
export const GRAVES = (() => {
  const out = []
  const g = GRAVEYARD
  const c = Math.cos(g.rot)
  const s = Math.sin(g.rot)
  let k = 0
  for (let row = -2; row <= 2; row++)
    for (let col = -3; col <= 3; col++) {
      if (Math.abs(col) <= 0) continue
      if (row === 0 && Math.abs(col) <= 1) continue
      const lx = col * 3.0 + (row % 2) * 0.6
      const lz = row * 3.4 - 1
      if (Math.hypot(lx, lz) > 10.5) continue
      // local → world (local +z points out of the gate)
      const x = g.x + lx * c + lz * s
      const z = g.z - lx * s + lz * c
      out.push({ id: `grave-${k}`, x, z, rot: g.rot + (((k * 37) % 7) - 3) * 0.05, type: k % 3 })
      k++
    }
  return out
})()
export const PUMPKINS = (() => {
  const g = GRAVEYARD
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const a = g.rot + Math.PI + (i - 2.5) * 0.22
    return { id: `pumpkin-${i}`, x: g.x + Math.sin(a) * 10.2, z: g.z + Math.cos(a) * 10.2 }
  })
})()

// The castle: square walls (half size `half`), corner towers, a keep, and a moat around it.
export const CASTLE = { x: 0, z: 0, half: 10, moatIn: 17.5, moatOut: 20.5, loop: 23.5 }
export const DRAWBRIDGE = { x0: -2.2, x1: 2.2, z0: 16.6, z1: 21.6 }
export const VILLAGE = { x: 0, z: 40 }
export const PLAZA = { x: 0, z: 40, r: 11 }
export const PIER = { x0: -2.6, x1: 2.6, z0: 93, z1: 120, y: 1.05 }
export const HARBOR = { x: 0, z: 85 }

// Ring stops, one every 45°. `in`: the building sits inside the ring, facing out to the road.
const STOP = {
  burger: 135,
  farm: 180,
  graveyard: 225,
  school: 270,
  bridge: 315,
  beach: 0,
  post: 45,
  harbor: 90,
}
const at = (deg, off) => ringPos(deg, off)

const [burgerX, burgerZ] = at(STOP.burger, -12)
const [postX, postZ] = at(STOP.post, -12)
const [schoolX, schoolZ] = at(STOP.school, -10)
const [iceX, iceZ] = at(STOP.beach, 9)
const [farmX, farmZ] = at(STOP.farm, -14)
const [monumentX, monumentZ] = at(300, -8)
const [lightX, lightZ] = [ISLET.x + 3.5, ISLET.z - 3.5]

export const PLACES = {
  harbor: { name: 'Harbor', icon: '⚓', x: 0, z: 88 },
  burger: { name: 'Burger Hut', icon: '🍔', x: burgerX, z: burgerZ },
  castle: { name: 'Castle', icon: '🏰', x: 0, z: 0 },
  village: { name: 'Village', icon: '🏡', x: 0, z: 40 },
  market: { name: 'Market', icon: '🍯', x: -13, z: 40 },
  bank: { name: 'Bank', icon: '🏦', x: 13, z: 34 },
  toyshop: { name: 'Toy Shop', icon: '🧸', x: 13, z: 47 },
  farm: { name: 'Farm', icon: '🥕', x: farmX, z: farmZ },
  beach: { name: 'Sunny Beach', icon: '🏖️', x: iceX + 2, z: iceZ + 8 },
  icecream: { name: 'Ice Cream', icon: '🍦', x: iceX, z: iceZ },
  post: { name: 'Post Office', icon: '📮', x: postX, z: postZ },
  school: { name: 'Royal Library', icon: '📚', x: schoolX, z: schoolZ },
  monument: { name: "Knight's Monument", icon: '🗿', x: monumentX, z: monumentZ },
  graveyard: { name: 'Spooky Graveyard', icon: '👻', x: GRAVEYARD.x, z: GRAVEYARD.z },
  forest: { name: 'Forest', icon: '🌲', x: 24, z: -34 },
  pond: { name: 'Pond', icon: '🦆', x: POND.x, z: POND.z },
  bridge: { name: 'Bear Bridge', icon: '🌉', x: BRIDGE_MID[0], z: BRIDGE_MID[1] },
  lighthouse: { name: 'Lighthouse', icon: '🗼', x: lightX, z: lightZ },
  turtle: { name: 'Turtle Island', icon: '🐢', x: ISLETS[1].x, z: ISLETS[1].z },
  flower: { name: 'Flower Island', icon: '🌸', x: ISLETS[2].x, z: ISLETS[2].z },
  mountain: { name: 'Mount Puff', icon: '⛰️', x: MOUNTAIN.x, z: MOUNTAIN.z },
}

// ---------- roads ----------

const [rS] = [ringPos(90)]
const [rW] = [ringPos(180)]
const [rE] = [ringPos(0)]
const [rNE] = [ringPos(315)]
const CASTLE_LOOP = []
for (let i = 0; i <= 40; i++) {
  const a = (i / 40) * Math.PI * 2
  CASTLE_LOOP.push([CASTLE.x + Math.cos(a) * CASTLE.loop, CASTLE.z + Math.sin(a) * CASTLE.loop])
}
const lp = (deg) => polar(deg, CASTLE.loop)
export const ROADS = [
  { w: 4.4, loop: true, pts: RING }, // the ring road
  { w: 3.6, loop: true, pts: CASTLE_LOOP }, // around the castle moat
  { w: 4.0, pts: [[0, DRAWBRIDGE.z1], [0, 50], [rS[0], rS[1]], [0, 95]] }, // castle → village → harbor
  { w: 3.8, pts: [lp(180), [-40, 1], [rW[0], rW[1]]] }, // west spoke (farm)
  { w: 3.8, pts: [lp(0), [40, 1], [rE[0], rE[1]]] }, // east spoke (beach)
  { w: 3.4, pts: [lp(315), [24, -30], [38, -44], [rNE[0], rNE[1]]] }, // forest trail
  { w: 3.4, pts: [[rNE[0], rNE[1]], [BRIDGE.ax, BRIDGE.az]] }, // spur to Bear Bridge
  { w: 3.0, pts: [[BRIDGE.bx, BRIDGE.bz], [ISLET.x - 1, ISLET.z + 1]] }, // up to the lighthouse
  ...ISLETS.slice(1).map((I) => ({ w: 3.0, pts: [ringPos(I.deg), [I.bridge.ax, I.bridge.az]] })), // spurs to the small islands
  { w: 2.8, pts: [[-33, 1], [-30, -12], [-28, -16.5]] }, // pond trail
  ...[STOP.burger, STOP.post, STOP.school].map((d) => ({ w: 3.0, pts: [ringPos(d, -2), ringPos(d, -7.5)] })), // driveways
]

// ---------- heights ----------

// Village houses: [x, z, rot, color]
const HOUSES = [
  [-15, 54, 2.32, 0],
  [15, 58, -2.45, 1],
  [-27, 31, 1.2, 2],
  [27, 27, -1.08, 3],
  [-31, 14, 2.0, 4],
  [31, 13, -2.0, 0],
]

export const PADS = [
  // A broad raised castle hill keeps the castle visible from the beaches while preserving a gentle,
  // walkable approach around the moat and castle loop road.
  { x: CASTLE.x, z: CASTLE.z, r: 22, blend: 14, h: 4.2 }, // castle
  { x: PLAZA.x, z: PLAZA.z, r: 15, blend: 8 }, // village plaza
  { x: HARBOR.x, z: HARBOR.z, r: 11, blend: 7, h: 1.05 }, // harbor quay
  { x: burgerX, z: burgerZ, r: 8, blend: 5 },
  { x: postX, z: postZ, r: 7, blend: 5 },
  { x: schoolX, z: schoolZ, r: 8, blend: 5 },
  { x: iceX, z: iceZ, r: 7, blend: 6, h: 0.7 },
  { x: farmX, z: farmZ, r: 12, blend: 8 },
  { x: GRAVEYARD.x, z: GRAVEYARD.z, r: 14, blend: 6 },
  ...HOUSES.map((h) => ({ x: h[0], z: h[1], r: 4.5, blend: 4 })),
  { x: ISLETS[0].x - 6.7, z: ISLETS[0].z - 2.5, r: 3.6, blend: 4, h: ISLETS[0].h }, // the cottage on Lighthouse Island
]

function baseHeight(x, z) {
  const t = inland(x, z)
  let h
  if (t < 0) {
    h = Math.max(-7, 0.3 + t * 0.3)
  } else {
    h = 0.3 + 1.25 * smoothstep(2, 16, t)
    h += 1.6 * (fbm(x * 0.021 + 3, z * 0.021 - 7) - 0.45) * smoothstep(10, 30, t)
    h = Math.max(h, 0.3 + 0.4 * smoothstep(2, 12, t))
  }
  const md = Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z)
  if (md < MOUNTAIN.r) {
    const k = 1 - md / MOUNTAIN.r
    h = Math.max(h, MOUNTAIN.h * Math.pow(k, 1.2) * (0.88 + 0.24 * vnoise(x * 0.16, z * 0.16)) + 0.4 * k)
  }
  // the small islands: a beach ring and a flat top
  for (const I of ISLETS) {
    const id = Math.hypot(x - I.x, z - I.z)
    if (id > I.r + 25) continue
    const it = I.r - id
    // the slope up from the beach is long enough to walk (tall islands get a longer ramp)
    const ih = it < 0 ? Math.max(-7, 0.3 + it * 0.3) : 0.3 + (I.h - 0.3) * smoothstep(1.5, 1.5 + Math.max(4, (I.h - 0.3) * 2.1), it)
    h = Math.max(h, ih)
  }
  return h
}

let streamLevels = null
function streamLevel(seg, t) {
  if (!streamLevels) {
    streamLevels = STREAM.map(([x, z]) => baseHeight(x, z) - 0.6)
    for (let i = 1; i < streamLevels.length; i++) streamLevels[i] = Math.min(streamLevels[i], streamLevels[i - 1] - 0.05)
    streamLevels[streamLevels.length - 1] = Math.max(streamLevels[streamLevels.length - 1], getPondLevel())
  }
  return lerp(streamLevels[seg], streamLevels[seg + 1], t)
}
export function streamLevelAt(x, z) {
  const p = polyDist(x, z, STREAM)
  return streamLevel(p.seg, p.t)
}
let pondLevel = null
export function getPondLevel() {
  if (pondLevel === null) pondLevel = baseHeight(POND.x, POND.z) - 0.6
  return pondLevel
}

let padsReady = false
function preparePads() {
  for (const p of PADS) if (p.h === undefined) p.h = baseHeight(p.x, p.z)
  padsReady = true
}

export function heightAt(x, z) {
  if (!padsReady) preparePads()
  let h = baseHeight(x, z)
  for (const p of PADS) {
    const d = Math.hypot(x - p.x, z - p.z)
    if (d < p.r + p.blend) h = lerp(h, p.h, smoothstep(p.r + p.blend, p.r, d))
  }
  const s = polyDist(x, z, STREAM)
  if (s.d < STREAM_HALF + 2.5) {
    const bed = streamLevel(s.seg, s.t) - 0.8
    h = lerp(h, Math.min(h, bed), smoothstep(STREAM_HALF + 2.5, STREAM_HALF - 0.5, s.d))
  }
  const pd = Math.hypot(x - POND.x, z - POND.z)
  if (pd < POND.r + 3) {
    const bed = getPondLevel() - 1.3
    h = lerp(h, Math.min(h, bed), smoothstep(POND.r + 3, POND.r - 2.5, pd))
  }
  // the moat
  const cd = Math.hypot(x - CASTLE.x, z - CASTLE.z)
  if (cd > CASTLE.moatIn - 2 && cd < CASTLE.moatOut + 2) {
    const mid = (CASTLE.moatIn + CASTLE.moatOut) / 2
    const half = (CASTLE.moatOut - CASTLE.moatIn) / 2
    const bed = getMoatLevel() - 1.2
    h = lerp(h, Math.min(h, bed), smoothstep(half + 1.6, half - 0.6, Math.abs(cd - mid)))
  }
  return h
}
let moatLevel = null
export function getMoatLevel() {
  if (moatLevel === null) {
    if (!padsReady) preparePads()
    moatLevel = PADS[0].h - 0.75
  }
  return moatLevel
}

// ---------- decks (pier, bridge) ----------

export function onPier(x, z) {
  return x > PIER.x0 && x < PIER.x1 && z > PIER.z0 && z < PIER.z1
}
export function onDrawbridge(x, z) {
  const D = DRAWBRIDGE
  return x > D.x0 && x < D.x1 && z > CASTLE.z + D.z0 && z < CASTLE.z + D.z1
}
export function inMoat(x, z, margin = 0) {
  const cd = Math.hypot(x - CASTLE.x, z - CASTLE.z)
  return cd > CASTLE.moatIn - margin && cd < CASTLE.moatOut + margin
}
// Which bridge (and where along it, t 0..1) a point is on, or null.
export function bridgeAt(x, z, pad = 0) {
  for (const b of BRIDGES) {
    const { ax, az, bx, bz, w } = b
    const dx = bx - ax
    const dz = bz - az
    const len = Math.hypot(dx, dz)
    const t = ((x - ax) * dx + (z - az) * dz) / (len * len)
    if (t < -pad / len || t > 1 + pad / len) continue
    const side = Math.abs(((x - ax) * dz - (z - az) * dx) / len)
    if (side < w / 2 + pad) return { b, t: clamp(t, 0, 1) }
  }
  return null
}
export function onBridge(x, z) {
  return bridgeAt(x, z) !== null
}
export function bridgeDeckY(b, t, groundAt) {
  const ya = groundAt(b.ax, b.az)
  const yb = groundAt(b.bx, b.bz)
  return lerp(ya, yb, t) + 1.1 * Math.sin(Math.PI * t) + 0.14
}

export function inStream(x, z, margin = 0) {
  return polyDist(x, z, STREAM).d < STREAM_HALF + margin
}
export function inPond(x, z, margin = 0) {
  return Math.hypot(x - POND.x, z - POND.z) < POND.r + margin
}
export function inMountain(x, z) {
  return Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z) < MOUNTAIN.block
}
export function nearRoad(x, z, extra = 0) {
  for (const r of ROADS) if (polyDist(x, z, r.pts).d < r.w / 2 + extra) return true
  return Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + extra
}
// How spooky a spot is (0..1): the graveyard and a little around it.
export function spookiness(x, z) {
  return smoothstep(GRAVEYARD.r + 9, GRAVEYARD.r - 3, Math.hypot(x - GRAVEYARD.x, z - GRAVEYARD.z))
}
// How much a spot is "forest" (0..1), with a wobbly edge.
export function forestness(x, z) {
  const r = Math.hypot(x, z)
  const zEdge = -20 - 7 * (vnoise(x * 0.045 + 11, 2.5) - 0.5) * 2
  const a = smoothstep(zEdge + 2.5, zEdge - 2.5, z)
  const b = smoothstep(ringRadius(Math.atan2(z, x) / DEG) - 6, ringRadius(Math.atan2(z, x) / DEG) - 11, r)
  const c = 1 - smoothstep(GRAVEYARD.r + 4, GRAVEYARD.r - 2, Math.hypot(x - GRAVEYARD.x, z - GRAVEYARD.z))
  const m = smoothstep(MOUNTAIN.r - 3, MOUNTAIN.r + 1, Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z))
  const sch = smoothstep(9, 14, Math.hypot(x - schoolX, z - schoolZ))
  const cas = smoothstep(CASTLE.loop + 1, CASTLE.loop + 6, Math.hypot(x - CASTLE.x, z - CASTLE.z))
  return a * b * c * m * sch * cas
}

// ---------- buildings, objects, characters ----------

const out = (deg) => faceOut(deg)
export const BUILDINGS = [
  { kind: 'burger', x: burgerX, z: burgerZ, rot: out(STOP.burger), w: 8, d: 7 },
  { kind: 'post', x: postX, z: postZ, rot: out(STOP.post), w: 7, d: 6 },
  { kind: 'school', x: schoolX, z: schoolZ, rot: out(STOP.school), w: 10, d: 6.5 },
  { kind: 'icecream', x: iceX, z: iceZ, rot: faceIn(STOP.beach), w: 4.5, d: 3.6 },
  { kind: 'castle', x: CASTLE.x, z: CASTLE.z, rot: 0, w: CASTLE.half * 2 + 1, d: CASTLE.half * 2 + 1 },
  { kind: 'market', x: -13.5, z: 40, rot: Math.PI / 2, w: 6, d: 4 },
  { kind: 'bank', x: 13, z: 34, rot: -1.14, w: 7, d: 6 },
  { kind: 'toyshop', x: 13, z: 47, rot: -2.06, w: 7, d: 6 },
  ...HOUSES.map(([x, z, rot, color]) => ({ kind: 'house', x, z, rot, w: 5.5, d: 5, color })),
  { kind: 'shed', x: farmX - 8, z: farmZ + 10, rot: Math.PI / 2, w: 5, d: 4 },
  { kind: 'cottage', x: ISLET.x - 6.7, z: ISLET.z - 2.5, rot: Math.atan2(BRIDGE.bx - ISLET.x, BRIDGE.bz - ISLET.z), w: 5.5, d: 5 },
  { kind: 'lighthouse', x: lightX, z: lightZ, rot: Math.atan2(BRIDGE.bx - lightX, BRIDGE.bz - lightZ), w: 7, d: 7, round: true },
  { kind: 'warehouse', x: -13, z: 84, rot: Math.PI / 2, w: 6, d: 8 },
]
const B = (kind) => BUILDINGS.find((b) => b.kind === kind)

const sp = (kind, dist) => {
  const b = B(kind)
  return ahead(b.x, b.z, b.rot, dist)
}

export const OBJECTS = [
  { id: 'well', kind: 'well', x: PLAZA.x, z: PLAZA.z },
  { id: 'spring', kind: 'spring', x: 14, z: -31 },
  { id: 'fountain', kind: 'fountain', x: iceX + 2, z: iceZ - 8 },
  { id: 'bench-harbor', kind: 'bench', x: -7, z: 78, rot: 0 },
  { id: 'bench-plaza1', kind: 'bench', x: -7.5, z: 48, rot: 2.4 },
  { id: 'bench-plaza2', kind: 'bench', x: 7.5, z: 32, rot: -0.8 },
  { id: 'bench-castle', kind: 'bench', x: -7, z: 27.5, rot: 0 },
  { id: 'bench-farm', kind: 'bench', x: farmX + 9, z: farmZ + 9, rot: Math.PI },
  { id: 'bench-beach', kind: 'bench', x: iceX + 3, z: iceZ + 7, rot: -Math.PI / 2 },
  { id: 'bench-lighthouse', kind: 'bench', x: ISLET.x - 2, z: ISLET.z + 8, rot: Math.atan2(BRIDGE.bx - ISLET.x, BRIDGE.bz - ISLET.z) },
  { id: 'bench-school', kind: 'bench', x: schoolX + 7, z: schoolZ + 6, rot: 0 },
  { id: 'bench-grave', kind: 'bench', x: GRAVEYARD.x + 5, z: GRAVEYARD.z - 5, rot: GRAVEYARD.rot },
  ...[[-6, -14], [-14, -14], [-22, -12], [-9, -22], [-18, -22]].map(([dx, dz], i) => ({ id: `apple${i + 1}`, kind: 'appletree', x: farmX + dx, z: farmZ + dz })),
  ...[[-12, -20], [16, -36], [32, -50], [42, -30], [-40, -30], [6, -64]].map(([x, z], i) => ({ id: `berry${i + 1}`, kind: 'berrybush', x, z })),
  { id: 'carrots', kind: 'carrots', x: farmX + 2, z: farmZ + 11 },
  { id: 'sign-harbor', kind: 'sign', x: 4.5, z: 70, boards: ['village', 'burger', 'post'] },
  { id: 'sign-village', kind: 'sign', x: 4.5, z: 27, boards: ['castle', 'farm', 'beach', 'harbor'] },
  { id: 'sign-castle', kind: 'sign', x: 18.5, z: -19, boards: ['forest', 'lighthouse', 'castle'] },
  { id: 'sign-west', kind: 'sign', x: ringPos(180, 5)[0], z: ringPos(180, 5)[1] - 4, boards: ['graveyard', 'farm', 'burger'] },
  { id: 'sign-east', kind: 'sign', x: ringPos(0, -5)[0], z: ringPos(0, -5)[1] + 4, boards: ['lighthouse', 'beach', 'post'] },
  { id: 'sign-ne', kind: 'sign', x: ringPos(315, -5)[0] + 3, z: ringPos(315, -5)[1] + 2, boards: ['lighthouse', 'school', 'village'] },
  { id: 'sign-grave', kind: 'sign', x: ringPos(225, 5)[0] + 4, z: ringPos(225, 5)[1] - 2, boards: ['graveyard', 'school', 'farm'] },
  { id: 'knight-monument', kind: 'monument', x: monumentX, z: monumentZ, rot: faceIn(300) },
]
export const SIGN_TARGETS = Object.fromEntries(Object.entries(PLACES).map(([k, p]) => [k, [p.x, p.z]]))

const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z)
const [benX, benZ] = sp('burger', 2.0)
const [cocoX, cocoZ] = sp('icecream', 0.2)
const [maxX, maxZ] = sp('post', 4.4)
const [kimX, kimZ] = sp('school', 4.6)
const [gusX, gusZ] = sp('lighthouse', 4.8)
const [booX, booZ] = ahead(GRAVEYARD.x, GRAVEYARD.z, GRAVEYARD.rot, -2)

export const OWL_TREE = { x: 18, z: -42 }
export const GLASSES_SPOT = { x: -20.5, z: -21 }

export const NPCS = {
  pip: { x: 1.2, z: 109.5, face: 0, zone: 'harbor' },
  finn: { x: -2.1, z: 101, face: -Math.PI / 2, zone: 'harbor', sit: true },
  momo: { x: 8, z: 87, face: -2.6, zone: 'harbor', crate: true },
  ben: { x: benX, z: benZ, face: B('burger').rot, zone: 'burger' },
  coco: { x: cocoX, z: cocoZ, face: B('icecream').rot, zone: 'beach' },
  max: { x: maxX, z: maxZ, face: B('post').rot, zone: 'post' },
  kim: { x: kimX, z: kimZ, face: B('school').rot, zone: 'school' },
  granny: { x: -13.8, z: 40, face: Math.PI / 2, zone: 'village' },
  penny: { x: ahead(13, 34, -1.14, 4)[0], z: ahead(13, 34, -1.14, 4)[1], face: -1.14, zone: 'village' },
  tina: { x: ahead(13, 47, -2.06, 4)[0], z: ahead(13, 47, -2.06, 4)[1], face: -2.06, zone: 'village' },
  leo: { x: 5.5, z: 44.5, face: -2.2, zone: 'village' },
  lance: { x: 2.4, z: CASTLE.z + 13, face: 0, zone: 'castle' },
  bun: { x: farmX + 6, z: farmZ + 13, face: 0.6, zone: 'farm' },
  hoot: { x: OWL_TREE.x, z: OWL_TREE.z + 1.6, face: face(OWL_TREE.x, OWL_TREE.z, 22, -31), zone: 'forest', perch: 4.6 },
  bruno: { x: BRIDGE_MID[0], z: BRIDGE_MID[1], face: face(BRIDGE_MID[0], BRIDGE_MID[1], BRIDGE.ax, BRIDGE.az), zone: 'bridge' },
  gus: { x: gusX, z: gusZ, face: B('lighthouse').rot, zone: 'lighthouse' },
  boo: { x: booX, z: booZ, face: GRAVEYARD.rot, zone: 'graveyard', float: 1.3 },
  sam: { x: ISLETS[1].x + 2.5, z: ISLETS[1].z + 2, face: face(ISLETS[1].x + 2.5, ISLETS[1].z + 2, ISLETS[1].bridge.bx, ISLETS[1].bridge.bz), zone: 'turtle' },
  pam: { x: ISLETS[2].x - 2.6, z: ISLETS[2].z - 1.2, face: face(ISLETS[2].x - 2.6, ISLETS[2].z - 1.2, ISLETS[2].bridge.bx, ISLETS[2].bridge.bz), zone: 'flower' },
}
export const CHEST = { x: ISLETS[1].x - 3, z: ISLETS[1].z - 2.5 }
export const GAZEBO = { x: ISLETS[2].x + 1.5, z: ISLETS[2].z + 0.5 }
// Where Bruno sits after he moves off the bridge.
export const BEAR_SPOT = (() => {
  const ux = (BRIDGE.bx - BRIDGE.ax) / 16
  const uz = (BRIDGE.bz - BRIDGE.az) / 16
  return { x: BRIDGE.ax - ux * 3 + uz * 4, z: BRIDGE.az - uz * 3 - ux * 4, face: face(BRIDGE.ax - ux * 3 + uz * 4, BRIDGE.az - uz * 3 - ux * 4, BRIDGE.ax, BRIDGE.az) }
})()

export const HIDDEN_COINS = [
  [-36, 24], [26, -16], [farmX - 6, farmZ + 16], [iceX + 4, iceZ + 16], [8, -60], [ISLET.x + 6, ISLET.z + 2], [GRAVEYARD.x + 2, GRAVEYARD.z + 3], [50, 30],
]
export const START = { x: -0.6, z: 115, face: Math.PI }

export const ZONES = [
  { id: 'harbor', x: 0, z: 88, r: 30 },
  { id: 'burger', x: burgerX, z: burgerZ, r: 22 },
  { id: 'post', x: postX, z: postZ, r: 22 },
  { id: 'village', x: 0, z: 40, r: 30 },
  { id: 'castle', x: 0, z: 0, r: 26 },
  { id: 'farm', x: farmX, z: farmZ, r: 28 },
  { id: 'beach', x: iceX, z: iceZ, r: 28 },
  { id: 'school', x: schoolX, z: schoolZ, r: 22 },
  { id: 'graveyard', x: GRAVEYARD.x, z: GRAVEYARD.z, r: 24 },
  { id: 'forest', x: 14, z: -36, r: 36 },
  { id: 'bridge', x: BRIDGE_MID[0], z: BRIDGE_MID[1], r: 16 },
  { id: 'lighthouse', x: ISLET.x, z: ISLET.z, r: 24 },
  { id: 'turtle', x: ISLE_OF.turtle.x, z: ISLE_OF.turtle.z, r: 18 },
  { id: 'flower', x: ISLE_OF.flower.x, z: ISLE_OF.flower.z, r: 18 },
  { id: 'wild', x: 0, z: 0, r: 999 },
]
