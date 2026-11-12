// Island shape, heights and layout. Pure JavaScript (no three.js), so the map and tools can use it too.
// Coordinates: x goes east, z goes south, y is up. 1 unit ≈ 1 meter. The world spans -HALF..HALF.

export const HALF = 130

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

// ---------- layout ----------

// Coast radius every 15°, angle = atan2(z, x): 0 = east, 90 = south, 180 = west, 270 = north.
const COAST = [88, 89, 92, 95, 95, 94, 93, 94, 96, 98, 99, 100, 101, 100, 98, 99, 103, 106, 108, 108, 110, 121, 112, 95]

export const MOUNTAIN = { x: -18, z: -92, r: 27, h: 24, block: 21.5 }
export const PLATEAU = { x: 66, z: -79, r: 11, fall: 16, h: 4.4 }
export const POND = { x: -44, z: -34, r: 7.5 }
// The stream runs from the foot of Mount Puff to the east sea. Only the bridge crosses it.
export const STREAM = [[-9, -74], [3, -66], [18, -59], [32, -55], [46, -53], [60, -51], [76, -46], [94, -40], [118, -36]]
export const STREAM_HALF = 2.4

export const PLACES = {
  harbor: { name: 'Harbor', icon: '⚓', x: 0, z: 84 },
  burger: { name: 'Burger Hut', icon: '🍔', x: -16, z: 50 },
  village: { name: 'Village', icon: '🏡', x: 0, z: 0 },
  market: { name: 'Market', icon: '🍯', x: -15, z: -4 },
  bank: { name: 'Bank', icon: '🏦', x: 18, z: -10 },
  toyshop: { name: 'Toy Shop', icon: '🧸', x: 18, z: 11 },
  farm: { name: 'Farm', icon: '🥕', x: -58, z: 8 },
  beach: { name: 'Sunny Beach', icon: '🏖️', x: 74, z: 12 },
  forest: { name: 'Forest', icon: '🌲', x: -12, z: -48 },
  pond: { name: 'Pond', icon: '🦆', x: -44, z: -34 },
  bridge: { name: 'Bear Bridge', icon: '🌉', x: 46, z: -53 },
  lighthouse: { name: 'Lighthouse', icon: '🗼', x: 66, z: -80 },
  mountain: { name: 'Mount Puff', icon: '⛰️', x: -18, z: -92 },
}

export const ROADS = [
  { w: 4.4, pts: [[0, 88], [0, 66], [0, 42], [0, 13]] }, // harbor → village
  { w: 3.2, pts: [[0, 50], [-10, 50]] }, // burger hut
  { w: 3.8, pts: [[-13, 1], [-30, 4], [-46, 7], [-54, 8]] }, // village → farm
  { w: 3.8, pts: [[13, 1], [30, 5], [48, 10], [66, 12]] }, // village → beach
  { w: 3.8, pts: [[0, -13], [2, -24], [4, -36]] }, // village → forest fork
  { w: 3.2, pts: [[4, -36], [24, -40], [46, -44.5]] }, // fork → bridge (south end)
  { w: 3.2, pts: [[46, -61.5], [50, -68], [60, -74]] }, // bridge (north end) → lighthouse
  { w: 3.0, pts: [[4, -36], [-14, -38], [-28, -36], [-35, -35]] }, // fork → pond
]
export const PLAZA = { x: 0, z: 0, r: 13 }

// Walkable decks over water: their own floor height.
export const PIER = { x0: -2.6, x1: 2.6, z0: 86, z1: 113, y: 1.05 }
export const BRIDGE = { x: 46, x0: 44.1, x1: 47.9, z0: -62, z1: -44 }

// Flat pads for buildings and open places. h is filled in from the terrain if missing.
export const PADS = [
  { x: 0, z: 0, r: 17, blend: 9 }, // village
  { x: 0, z: 80, r: 11, blend: 7, h: 1.05 }, // harbor quay
  { x: -16, z: 50, r: 7, blend: 5 }, // burger hut
  { x: -58, z: 8, r: 11, blend: 8 }, // farm
  { x: 74, z: 12, r: 9, blend: 7, h: 0.75 }, // beach area
  { x: 52, z: -78, r: 5, blend: 4 }, // Gus's cottage
  { x: -21, z: 18, r: 4.5, blend: 4 }, // houses
  { x: -26, z: -16, r: 4.5, blend: 4 },
  { x: 12, z: -26, r: 4.5, blend: 4 },
  { x: -12, z: 26, r: 4.5, blend: 4 },
  { x: 13, z: 27, r: 4.5, blend: 4 },
  { x: 30, z: -8, r: 4.5, blend: 4 },
]

// Buildings: footprint is used for path-finding. rot faces the door (0 = door looks south, +z).
export const BUILDINGS = [
  { kind: 'burger', x: -16, z: 50, rot: Math.PI / 2, w: 8, d: 7 },
  { kind: 'market', x: -16.5, z: -4, rot: Math.PI / 2, w: 6, d: 4 },
  { kind: 'bank', x: 18, z: -10, rot: -1.064, w: 7, d: 6 },
  { kind: 'toyshop', x: 18, z: 11, rot: -2.119, w: 7, d: 6 },
  { kind: 'house', x: -21, z: 18, rot: 2.29, w: 5.5, d: 5, color: 0 },
  { kind: 'house', x: -26, z: -16, rot: 1.02, w: 5.5, d: 5, color: 1 },
  { kind: 'house', x: 12, z: -26, rot: -0.43, w: 5.5, d: 5, color: 2 },
  { kind: 'house', x: -12, z: 26, rot: 2.0, w: 5.5, d: 5, color: 3 },
  { kind: 'house', x: 13, z: 27, rot: -1.9, w: 5.5, d: 5, color: 4 },
  { kind: 'house', x: 30, z: -8, rot: -1.3, w: 5.5, d: 5, color: 0 },
  { kind: 'shed', x: -66, z: 2, rot: Math.PI / 2, w: 5, d: 4 },
  { kind: 'cottage', x: 52, z: -79, rot: 0.6, w: 5.5, d: 5 },
  { kind: 'lighthouse', x: 68, z: -83, rot: -2.4, w: 7, d: 7, round: true },
  { kind: 'warehouse', x: -13, z: 80, rot: Math.PI / 2, w: 6, d: 8 },
]

// Things to tap that are not characters.
export const OBJECTS = [
  { id: 'well', kind: 'well', x: 0, z: 0 },
  { id: 'spring', kind: 'spring', x: 10, z: -31 },
  { id: 'fountain', kind: 'fountain', x: 70, z: 6 },
  { id: 'bench-harbor', kind: 'bench', x: -6, z: 74, rot: 0 },
  { id: 'bench-plaza1', kind: 'bench', x: -8, z: 8, rot: 2.4 },
  { id: 'bench-plaza2', kind: 'bench', x: 8, z: -8, rot: -0.8 },
  { id: 'bench-farm', kind: 'bench', x: -50, z: 16, rot: Math.PI },
  { id: 'bench-beach', kind: 'bench', x: 78, z: 6, rot: -Math.PI / 2 },
  { id: 'bench-lighthouse', kind: 'bench', x: 60, z: -84, rot: 0.6 },
  { id: 'apple1', kind: 'appletree', x: -48, z: -6 },
  { id: 'apple2', kind: 'appletree', x: -57, z: -5 },
  { id: 'apple3', kind: 'appletree', x: -66, z: -4 },
  { id: 'apple4', kind: 'appletree', x: -52, z: -14 },
  { id: 'apple5', kind: 'appletree', x: -62, z: -13 },
  { id: 'berry1', kind: 'berrybush', x: -16, z: -30 },
  { id: 'berry2', kind: 'berrybush', x: 14, z: -48 },
  { id: 'berry3', kind: 'berrybush', x: -32, z: -46 },
  { id: 'berry4', kind: 'berrybush', x: 22, z: -32 },
  { id: 'berry5', kind: 'berrybush', x: -6, z: -58 },
  { id: 'carrots', kind: 'carrots', x: -62, z: 16 },
  { id: 'sign-harbor', kind: 'sign', x: 4, z: 62, boards: ['village', 'burger', 'harbor'] },
  { id: 'sign-village', kind: 'sign', x: 5, z: -14, boards: ['forest', 'farm', 'beach', 'harbor'] },
  { id: 'sign-forest', kind: 'sign', x: 8, z: -33, boards: ['lighthouse', 'pond', 'village'] },
  { id: 'sign-bridge', kind: 'sign', x: 50, z: -64, boards: ['lighthouse', 'village'] },
]
// Where each signpost board points (the place it names).
export const SIGN_TARGETS = {
  village: [0, 0],
  burger: [-16, 50],
  harbor: [0, 84],
  forest: [3, -40],
  farm: [-58, 8],
  beach: [74, 12],
  lighthouse: [66, -80],
  pond: [-44, -34],
}

// Characters: position, facing (radians, 0 = looking south) and which zone they belong to.
export const NPCS = {
  pip: { x: 1.2, z: 102.5, face: 0, zone: 'harbor' },
  finn: { x: -2.1, z: 95, face: -Math.PI / 2, zone: 'harbor', sit: true },
  momo: { x: 8, z: 84.5, face: -2.6, zone: 'harbor' },
  ben: { x: -13.4, z: 50, face: Math.PI / 2, zone: 'burger' },
  granny: { x: -16.3, z: -4, face: Math.PI / 2, zone: 'village' },
  penny: { x: 14.6, z: -8.1, face: -1.064, zone: 'village' },
  tina: { x: 14.7, z: 8.9, face: -2.119, zone: 'village' },
  leo: { x: 5.5, z: 4.5, face: -2.2, zone: 'village' },
  bun: { x: -56, z: 20, face: 0.6, zone: 'farm' },
  hoot: { x: -28, z: -50, face: 0.4, zone: 'forest', perch: 4.6 },
  bruno: { x: 46, z: -53, face: Math.PI * 0.95, zone: 'forest' },
  gus: { x: 62, z: -77, face: -0.9, zone: 'lighthouse' },
}

export const OWL_TREE = { x: -28, z: -50.8 }
export const GLASSES_SPOT = { x: -36.5, z: -40.5 }
export const HIDDEN_COINS = [
  [-30, 22], [24, -20], [-70, 12], [86, 22], [-4, -66], [70, -66],
]
export const START = { x: -0.6, z: 108, face: Math.PI }

// Zones: details (plants, characters, pickups) are built when Coji gets near.
export const ZONES = [
  { id: 'harbor', x: 0, z: 78, r: 34 },
  { id: 'burger', x: -14, z: 48, r: 22 },
  { id: 'village', x: 0, z: 2, r: 36 },
  { id: 'farm', x: -60, z: 6, r: 32 },
  { id: 'beach', x: 72, z: 14, r: 34 },
  { id: 'forest', x: -10, z: -48, r: 50 },
  { id: 'lighthouse', x: 62, z: -78, r: 36 },
  { id: 'wild', x: 0, z: 0, r: 999 }, // everything else (scattered trees and flowers)
]

// ---------- heights ----------

export function coastRadius(a) {
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
  const r = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  return r + 2.0 * Math.sin(a * 11 + 0.7) + 1.3 * Math.sin(a * 17 + 2.1)
}

// How far inside the coast a point is (negative = in the sea).
export function inland(x, z) {
  return coastRadius(Math.atan2(z, x)) - Math.hypot(x, z)
}

function baseHeight(x, z) {
  const t = inland(x, z)
  let h
  if (t < 0) {
    h = Math.max(-7, 0.3 + t * 0.3)
  } else {
    h = 0.3 + 1.25 * smoothstep(2, 16, t)
    h += 1.7 * (fbm(x * 0.021 + 3, z * 0.021 - 7) - 0.45) * smoothstep(8, 30, t)
    h = Math.max(h, 0.3 + 0.4 * smoothstep(2, 12, t))
  }
  const md = Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z)
  if (md < MOUNTAIN.r) {
    const k = 1 - md / MOUNTAIN.r
    h = Math.max(h, MOUNTAIN.h * Math.pow(k, 1.25) * (0.86 + 0.28 * vnoise(x * 0.16, z * 0.16)) + 0.4 * k)
  }
  const pd = Math.hypot(x - PLATEAU.x, z - PLATEAU.z)
  if (pd < PLATEAU.r + PLATEAU.fall) h = Math.max(h, PLATEAU.h * smoothstep(PLATEAU.r + PLATEAU.fall, PLATEAU.r, pd))
  return h
}

// Water level along the stream: follows the land downhill, never rising.
let streamLevels = null
function streamLevel(seg, t) {
  if (!streamLevels) {
    streamLevels = STREAM.map(([x, z]) => baseHeight(x, z) - 0.7)
    for (let i = 1; i < streamLevels.length; i++) streamLevels[i] = Math.min(streamLevels[i], streamLevels[i - 1] - 0.05)
    for (let i = 0; i < streamLevels.length; i++) streamLevels[i] = Math.max(streamLevels[i], 0.05)
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
  if (s.d < STREAM_HALF + 3) {
    const bed = streamLevel(s.seg, s.t) - 1.0
    h = lerp(h, Math.min(h, bed), smoothstep(STREAM_HALF + 3, STREAM_HALF - 0.8, s.d))
  }
  const pd = Math.hypot(x - POND.x, z - POND.z)
  if (pd < POND.r + 3) {
    const bed = getPondLevel() - 1.3
    h = lerp(h, Math.min(h, bed), smoothstep(POND.r + 3, POND.r - 2.5, pd))
  }
  return h
}

// Height of the bridge deck at z (an arch from bank to bank).
export function bridgeDeckY(z, groundAt) {
  const yS = groundAt(BRIDGE.x, BRIDGE.z1 + 0.5)
  const yN = groundAt(BRIDGE.x, BRIDGE.z0 - 0.5)
  const t = clamp((z - BRIDGE.z1) / (BRIDGE.z0 - BRIDGE.z1), 0, 1)
  return lerp(yS, yN, t) + 0.7 * Math.sin(Math.PI * t) + 0.12
}

export function onPier(x, z) {
  return x > PIER.x0 && x < PIER.x1 && z > PIER.z0 && z < PIER.z1
}
export function onBridge(x, z) {
  return x > BRIDGE.x0 && x < BRIDGE.x1 && z > BRIDGE.z0 && z < BRIDGE.z1
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
// How much a spot is "forest" (0..1), with a wobbly edge instead of a straight line.
export function forestness(x, z) {
  const zEdge = -24 - 7 * (vnoise(x * 0.045 + 11, 2.5) - 0.5) * 2
  const xEdge = 40 + 9 * (vnoise(4.5, z * 0.045 + 7) - 0.5) * 2
  const zFar = -82 + 6 * (vnoise(x * 0.05 - 3, 9.5) - 0.5) * 2
  const a = smoothstep(zEdge + 2.5, zEdge - 2.5, z)
  const b = smoothstep(xEdge + 2.5, xEdge - 2.5, x)
  const c = smoothstep(zFar - 2.5, zFar + 2.5, z)
  const m = smoothstep(MOUNTAIN.r - 3, MOUNTAIN.r + 1, Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z))
  return a * b * c * m
}

export function nearRoad(x, z, extra = 0) {
  for (const r of ROADS) if (polyDist(x, z, r.pts).d < r.w / 2 + extra) return true
  return Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + extra
}
