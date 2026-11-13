// Plants, rocks, lamps and clouds.
//
// Plants are drawn with InstancedMesh: hundreds of them cost only a handful of draw calls. Each kind
// has a detailed model for near Coji and a light one for far away; PlantPools moves every plant into
// the right pool as the camera moves (so the iPad only draws the detail where you can see it), and
// skips small things (grass tufts, flowers) that are too far away to notice. Leaves sway in the wind
// in the vertex shader, which is nearly free.
import * as THREE from 'three'
import { Parts, MAT, SMOOTH, GLOW, cyl, cone, ico, box, sphere, pbrPatch, seePatch, noise3 } from './build.js'
import { vnoise } from './land.js'

// ---------- materials ----------

export const WIND = { uTime: { value: 0 } }

function plantMat(amp, side, key) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, side })
  m.defaultAttributeValues = { ...m.defaultAttributeValues, pbr: [0, 0] }
  const uAmp = { value: amp }
  m.onBeforeCompile = (sh) => {
    pbrPatch(sh)
    seePatch(sh)
    sh.uniforms.uTime = WIND.uTime
    sh.uniforms.uWindAmp = uAmp
    sh.vertexShader =
      'uniform float uTime;\nuniform float uWindAmp;\n' +
      sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 wOrg = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        #else
          vec2 wOrg = vec2(modelMatrix[3][0], modelMatrix[3][2]);
        #endif
        float wPh = uTime * 1.25 + wOrg.x * 0.23 + wOrg.y * 0.19;
        float wS = (sin(wPh) * 0.65 + sin(wPh * 2.7 + 1.3) * 0.2) * uWindAmp * max(transformed.y, 0.0) * max(transformed.y, 0.0);
        transformed.x += wS;
        transformed.z += wS * 0.55;`,
      )
  }
  m.customProgramCacheKey = () => 'plant-' + key
  return m
}
// Trees and bushes (a 5 m tree top moves ~9 cm), palm fronds (two-sided), and small plants.
export const TREE_MAT = plantMat(0.0035, THREE.FrontSide, 'tree')
export const LEAF_MAT = plantMat(0.004, THREE.DoubleSide, 'leaf')
export const SMALL_MAT = plantMat(0.22, THREE.DoubleSide, 'small')

// ---------- shapes ----------

// A soft, lumpy ball (tree tops, bushes): smooth normals, a little bumpy.
const blobCache = new Map()
export function blob(r, detail = 2, seed = 0, amp = 0.12) {
  const key = `${r},${detail},${seed},${amp}`
  if (blobCache.has(key)) return blobCache.get(key)
  const g = new THREE.IcosahedronGeometry(r, detail)
  const pos = g.attributes.position
  const v = new THREE.Vector3()
  const nor = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = v.clone().normalize()
    const k = 1 + amp * (vnoise(n.x * 2.3 + seed, n.y * 2.3 + n.z * 1.7 - seed) - 0.5) * 2
    v.multiplyScalar(k)
    pos.setXYZ(i, v.x, v.y, v.z)
    nor[i * 3] = n.x
    nor[i * 3 + 1] = n.y
    nor[i * 3 + 2] = n.z
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  blobCache.set(key, g)
  return g
}

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _d = new THREE.Vector3()
const _qq = new THREE.Quaternion()
const _mm = new THREE.Matrix4()
const UP = new THREE.Vector3(0, 1, 0)
const ONE = new THREE.Vector3(1, 1, 1)
// A tapered branch from point a to point b.
function limb(p, a, b, r0, r1, hex, seg = 8, o = {}) {
  _a.set(...a)
  _b.set(...b)
  _d.subVectors(_b, _a)
  const len = _d.length()
  _qq.setFromUnitVectors(UP, _d.normalize())
  _mm.compose(_a.clone().add(_b).multiplyScalar(0.5), _qq, ONE)
  p.add(new THREE.CylinderGeometry(r1, r0, len, seg, 1, true), hex, { matrix: _mm.clone(), jitter: 0.08, flat: false, ...o })
}

// Leafy crowns: normals point away from the crown's middle (so the whole crown shades softly like
// one big fluffy ball), and the inside and underside get darker (less sky gets in there).
function crown(p, mat, start, c, rad, { warm = 0.06, bend = 0.6 } = {}) {
  const g = p.groups.get(mat)
  for (let i = start; i < g.pos.length; i += 3) {
    const dx = (g.pos[i] - c[0]) / rad[0]
    const dy = (g.pos[i + 1] - c[1]) / rad[1]
    const dz = (g.pos[i + 2] - c[2]) / rad[2]
    const len = Math.hypot(dx, dy, dz) || 1
    const nx = dx / len
    const ny = dy / len
    const nz = dz / len
    const bx = g.nor[i] * (1 - bend) + nx * bend
    const by = g.nor[i + 1] * (1 - bend) + ny * bend
    const bz = g.nor[i + 2] * (1 - bend) + nz * bend
    const bl = Math.hypot(bx, by, bz) || 1
    g.nor[i] = bx / bl
    g.nor[i + 1] = by / bl
    g.nor[i + 2] = bz / bl
    const outer = Math.min(1, len)
    const shade = (0.42 + 0.58 * outer * outer) * (0.78 + 0.22 * (ny * 0.5 + 0.5))
    const sun = 1 + warm * Math.max(0, ny)
    g.col[i] *= shade * sun * 1.04
    g.col[i + 1] *= shade * sun
    g.col[i + 2] *= shade
  }
}
const mark = (p, mat) => (p.groups.get(mat)?.pos.length ?? 0)

// Points spread evenly over a ball (a golden spiral), from the top down to `bottom` (-1..1).
function spiral(n, bottom = -0.6) {
  const out = []
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * (1 - bottom)
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const a = i * 2.39996
    out.push([Math.cos(a) * r, y, Math.sin(a) * r])
  }
  return out
}

// A thin two-sided strip of quads (a blade of grass, a leaflet): pts are [x,y,z] along the middle,
// widths per point; the strip faces `side` (unit vector across the blade).
function strip(pts, widths, side, cols) {
  const pos = []
  const col = []
  const c0 = new THREE.Color()
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay, az] = pts[i]
    const [bx, by, bz] = pts[i + 1]
    const wa = widths[i] / 2
    const wb = widths[i + 1] / 2
    const A1 = [ax - side[0] * wa, ay - side[1] * wa, az - side[2] * wa]
    const A2 = [ax + side[0] * wa, ay + side[1] * wa, az + side[2] * wa]
    const B1 = [bx - side[0] * wb, by - side[1] * wb, bz - side[2] * wb]
    const B2 = [bx + side[0] * wb, by + side[1] * wb, bz + side[2] * wb]
    const ca = cols[i]
    const cb = cols[i + 1]
    if (wb < 1e-4) {
      pos.push(...A1, ...A2, ...B1)
      for (const c of [ca, ca, cb]) col.push(...c0.set(c).toArray())
    } else {
      pos.push(...A1, ...A2, ...B2, ...A1, ...B2, ...B1)
      for (const c of [ca, ca, cb, ca, cb, cb]) col.push(...c0.set(c).toArray())
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  // leaves look lit by the sky from both sides: tip the normals upward
  const n = g.attributes.normal
  for (let i = 0; i < n.count; i++) {
    _d.set(n.getX(i), n.getY(i), n.getZ(i))
    if (_d.y < 0) _d.negate()
    _d.y += 0.9
    _d.normalize()
    n.setXYZ(i, _d.x, _d.y, _d.z)
  }
  return { g, col }
}
// Add a strip with per-vertex colors to Parts (bypasses the single color of p.add).
function pushStrip(p, mat, s) {
  p.push(s.g, '#ffffff', 0, mat, { flat: false })
  const grp = p.groups.get(mat)
  const start = grp.col.length - s.col.length
  for (let i = 0; i < s.col.length; i++) grp.col[start + i] = s.col[i]
}

// A leafy crown of many small clumps around c (radii rad), shaded as one soft ball. For big one-off
// trees (the owl's tree) that are not instanced.
export function addCrown(p, mat, c, rad, { n = 40, r = 0.6 } = {}) {
  const start = mark(p, mat)
  p.add(blob(Math.min(rad[0], rad[1]) * 0.8, 1, 9, 0.1), LEAF[2], { x: c[0], y: c[1], z: c[2], sy: rad[1] / rad[0], jitter: 0.04, mat })
  spiral(n, -0.6).forEach(([x, y, z], i) => {
    const k = 0.86 + ((i * 3) % 4) * 0.04
    p.add(blob(r + ((i * 7) % 5) * 0.05, 1, i + 1, 0.3), LEAF[i % 4], { x: c[0] + x * rad[0] * k, y: c[1] + y * rad[1] * k, z: c[2] + z * rad[2] * k, ry: i, jitter: 0.1, mat })
  })
  crown(p, mat, start, c, rad, { bend: 0.45 })
}
export { limb }

// ---------- the models (hi = near, lo = far) ----------

const LEAF = ['#5e9c3c', '#6aa944', '#558f37', '#73b04a']

function roundTree(lo) {
  const p = new Parts(TREE_MAT)
  const m = TREE_MAT
  const bark = '#6b4a2e'
  const seg = lo ? 6 : 11
  // trunk with a slight lean, and roots spreading at the base
  const tp = [
    [0, -0.1, 0],
    [0.05, 1.2, 0.02],
    [0.12, 2.3, -0.04],
    [0.08, 3.1, 0.02],
  ]
  const tr = [0.38, 0.27, 0.21, 0.15]
  for (let i = 0; i < (lo ? 1 : 3); i++) limb(p, lo ? tp[0] : tp[i], lo ? tp[3] : tp[i + 1], lo ? tr[0] : tr[i], lo ? tr[3] : tr[i + 1], bark, seg)
  if (!lo) {
    for (let i = 0; i < 5; i++) {
      const a = i * 1.257 + 0.4
      limb(p, [Math.cos(a) * 0.12, 0.45, Math.sin(a) * 0.12], [Math.cos(a) * 0.62, -0.08, Math.sin(a) * 0.62], 0.13, 0.04, '#5f412a', 5)
    }
    // branches up into the crown
    for (let i = 0; i < 4; i++) {
      const a = i * 1.571 + 0.7
      limb(p, [0.1, 2.5 + i * 0.12, -0.02], [Math.cos(a) * 1.0, 3.5 + (i % 2) * 0.35, Math.sin(a) * 1.0], 0.11, 0.05, bark, 6)
    }
  }
  const c = [0.1, 3.95, 0]
  const rad = [1.95, 1.55, 1.95]
  const start = mark(p, m)
  p.add(blob(1.45, 1, 9, 0.1), LEAF[2], { x: c[0], y: c[1], z: c[2], sy: 0.85, jitter: 0.04 })
  // many small leafy clumps over the crown's surface (a big clump would look like a smooth plate)
  const pts = spiral(lo ? 6 : 38, -0.6)
  pts.forEach(([x, y, z], i) => {
    const r = lo ? 1.05 : 0.5 + ((i * 7) % 5) * 0.04
    const k = lo ? 0.62 : 0.86 + ((i * 3) % 4) * 0.04
    p.add(blob(r, 1, i + 1, lo ? 0.14 : 0.3), LEAF[i % 4], { x: c[0] + x * rad[0] * k, y: c[1] + y * rad[1] * k, z: c[2] + z * rad[2] * k, ry: i, jitter: 0.1 })
  })
  crown(p, m, start, c, rad, { bend: lo ? 0.6 : 0.45 })
  return p.geometry(m)
}

function pineTree(lo) {
  const p = new Parts(TREE_MAT)
  const m = TREE_MAT
  limb(p, [0, -0.1, 0], [0, 5.9, 0], 0.27, 0.05, '#634127', lo ? 5 : 9)
  const tiers = lo ? 4 : 8
  const start = mark(p, m)
  for (let t = 0; t < tiers; t++) {
    const k = t / (tiers - 1)
    const y = 1.25 + k * 4.5
    const r = 2.05 - k * 1.7
    const h = 1.5 - k * 0.55
    const seg = lo ? 9 : 18
    // a drooping skirt with branch tips around the rim, and an underside so it is closed
    const g = new THREE.ConeGeometry(r, h, seg, lo ? 1 : 3, true)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const vy = pos.getY(i)
      const f = (h / 2 - vy) / h // 0 at the tip, 1 at the rim
      const a = Math.atan2(pos.getZ(i), pos.getX(i))
      const tip = 1 + 0.16 * Math.sin(a * 7 + t * 1.3) * f
      pos.setX(i, pos.getX(i) * tip)
      pos.setZ(i, pos.getZ(i) * tip)
      pos.setY(i, vy - f * f * 0.28)
    }
    g.computeVertexNormals()
    const col = ['#2f6b3f', '#357546', '#3c7d4b', '#2b6339'][t % 4]
    p.add(g, col, { y: y + h / 2, ry: t * 0.7, jitter: 0.06, flat: false })
    p.add(cone(r * 0.92, h * 0.35, lo ? 9 : 14), '#24502f', { y: y - 0.12, rx: Math.PI, jitter: 0.04, flat: false })
  }
  // a darker inside, lighter tips: shade by distance from the trunk compared with the tier radius
  const g = p.groups.get(m)
  for (let i = start; i < g.pos.length; i += 3) {
    const y = g.pos[i + 1]
    const kk = Math.min(1, Math.max(0, (y - 1.25) / 5.2))
    const rr = 2.1 - kk * 1.8
    const d = Math.min(1, Math.hypot(g.pos[i], g.pos[i + 2]) / rr)
    const s = 0.55 + 0.5 * d * d
    g.col[i] *= s
    g.col[i + 1] *= s * 1.02
    g.col[i + 2] *= s
  }
  return p.geometry(m)
}

function palmTree(lo) {
  const p = new Parts(LEAF_MAT)
  const m = LEAF_MAT
  let x = 0
  let y = 0
  const n = lo ? 5 : 8
  const stepY = 5.6 / n
  for (let i = 0; i < n; i++) {
    const nx = x + 0.07 + i * 0.03 * (8 / n)
    const r0 = 0.24 - i * 0.012 * (8 / n)
    limb(p, [x, y, 0], [nx, y + stepY, 0], r0, r0 - 0.03, i % 2 ? '#a07a50' : '#93693f', lo ? 6 : 10)
    if (!lo) limb(p, [x, y + 0.02, 0], [x + 0.01, y + 0.16, 0], r0 + 0.035, r0 + 0.01, '#7d5a36', 10)
    x = nx
    y += stepY
  }
  const top = [x, y, 0]
  // fronds: a drooping rib with leaflets on both sides
  const fronds = lo ? 6 : 9
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2 + 0.2
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const len = 2.6 + (f % 3) * 0.25
    const rib = []
    const steps = lo ? 4 : 9
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const out = t * len
      const up = 0.55 * t - 1.25 * t * t
      rib.push([top[0] + ca * out, top[1] + 0.15 + up, top[2] + sa * out])
    }
    const side = [-sa, 0, ca]
    if (lo) {
      pushStrip(p, m, strip(rib, rib.map((_, i) => 0.9 * Math.sin((i / steps) * Math.PI) + 0.05), side, rib.map(() => '#4f9a43')))
      continue
    }
    pushStrip(p, m, strip(rib, rib.map((_, i) => 0.07 * (1 - i / steps) + 0.01), [0, 1, 0], rib.map(() => '#7a8a3c')))
    for (let i = 1; i < steps; i++) {
      const [rx, ry, rz] = rib[i]
      const t = i / steps
      const ll = 0.75 * Math.sin(t * Math.PI) + 0.2
      for (const s of [-1, 1]) {
        const ex = rx + side[0] * s * ll + ca * 0.25
        const ez = rz + side[2] * s * ll + sa * 0.25
        const ey = ry - 0.32 * ll
        const mid = [(rx + ex) / 2, (ry + ey) / 2 + 0.05, (rz + ez) / 2]
        const along = [ex - rx, 0, ez - rz]
        const al = Math.hypot(along[0], along[2]) || 1
        const across = [-along[2] / al, 0.25, along[0] / al]
        const cA = (i + f) % 2 ? '#4a9440' : '#57a548'
        pushStrip(p, m, strip([[rx, ry, rz], mid, [ex, ey, ez]], [0.15, 0.13, 0], across, ['#3d7d35', cA, '#78b85a']))
      }
    }
  }
  if (!lo) for (let i = 0; i < 4; i++) p.add(sphere(0.17, 10, 8), '#6b4a26', { x: top[0] + Math.cos(i * 1.6) * 0.24, y: top[1] - 0.18, z: Math.sin(i * 1.6) * 0.24, rough: 0.5, flat: false })
  return p.geometry(m)
}

function bushModel(lo) {
  const p = new Parts(TREE_MAT)
  const m = TREE_MAT
  const c = [0, 0.55, 0]
  const rad = [1.15, 0.7, 1.0]
  const start = mark(p, m)
  p.add(blob(0.62, 1, 21, 0.1), LEAF[2], { x: 0, y: 0.45, z: 0, sx: 1.4, jitter: 0.04 })
  const pts = spiral(lo ? 3 : 16, -0.25)
  pts.forEach(([x, y, z], i) => {
    p.add(blob(lo ? 0.62 : 0.32 + (i % 3) * 0.04, 1, 30 + i, lo ? 0.14 : 0.3), LEAF[(i + 1) % 4], { x: x * rad[0] * (lo ? 0.62 : 0.8), y: c[1] + y * rad[1] * (lo ? 0.55 : 0.75), z: z * rad[2] * (lo ? 0.62 : 0.8), ry: i, jitter: 0.1 })
  })
  crown(p, m, start, c, rad, { bend: 0.45 })
  return p.geometry(m)
}

// Rocks: lumpy, faceted, a little buried, with lichen on top and dark crevices.
function rockModel(lo) {
  const p = new Parts(MAT)
  const lump = (r, seed) => {
    const g = new THREE.IcosahedronGeometry(r, lo ? 1 : 2)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      _d.set(pos.getX(i), pos.getY(i), pos.getZ(i))
      const n = _d.clone().normalize()
      const k = 1 + (noise3(n.x * 1.6 + seed, n.y * 1.6, n.z * 1.6) - 0.5) * 0.55 + (noise3(n.x * 4 + seed, n.y * 4, n.z * 4) - 0.5) * 0.18
      _d.multiplyScalar(k)
      pos.setXYZ(i, _d.x, _d.y, _d.z)
    }
    return g
  }
  const start = mark(p, SMOOTH)
  p.add(lump(0.72, 1), '#9b958b', { y: 0.2, sy: 0.68, jitter: 0.1 })
  p.add(lump(0.44, 5), '#a7a197', { x: 0.62, y: 0.1, z: 0.28, sy: 0.72, ry: 0.6, jitter: 0.1 })
  if (!lo) p.add(lump(0.24, 9), '#8f897f', { x: -0.55, y: 0.02, z: 0.4, sy: 0.8, jitter: 0.1 })
  const g = p.groups.get(SMOOTH)
  const moss = new THREE.Color('#7d8f55')
  for (let i = start; i < g.pos.length; i += 3) {
    const up = g.nor[i + 1]
    const t = Math.max(0, (up - 0.55) / 0.45) * (0.5 + noise3(g.pos[i] * 3, g.pos[i + 1] * 3, g.pos[i + 2] * 3) * 0.8)
    const k = Math.min(1, t)
    g.col[i] += (moss.r - g.col[i]) * k
    g.col[i + 1] += (moss.g - g.col[i + 1]) * k
    g.col[i + 2] += (moss.b - g.col[i + 2]) * k
  }
  p.aoBottom(0.35, 0.45, 0)
  return p.geometry(MAT)
}

// A tuft of curved grass blades.
function grassTuft() {
  const p = new Parts(SMALL_MAT)
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4 + 0.3
    const h = 0.42 + ((i * 5) % 7) * 0.05
    const lean = 0.12 + (i % 3) * 0.06
    const bx = Math.cos(a) * 0.07
    const bz = Math.sin(a) * 0.07
    const dx = Math.cos(a) * lean
    const dz = Math.sin(a) * lean
    const pts = [
      [bx, 0, bz],
      [bx + dx * 0.3, h * 0.5, bz + dz * 0.3],
      [bx + dx, h, bz + dz],
    ]
    const side = [-Math.sin(a), 0, Math.cos(a)]
    pushStrip(p, SMALL_MAT, strip(pts, [0.06, 0.045, 0], side, ['#3f7d2f', i % 2 ? '#6aac48' : '#5f9f41', '#a5cf6c']))
  }
  return p.geometry(SMALL_MAT)
}

export const FLOWER_COLORS = ['#ff6b8a', '#ffd23f', '#ffffff', '#b38bff', '#ff9f43']
export function flowerProto(hex) {
  const p = new Parts(SMALL_MAT)
  const m = SMALL_MAT
  pushStrip(p, m, strip([[0, 0, 0], [0.02, 0.22, 0], [0, 0.42, 0.01]], [0.025, 0.02, 0.018], [1, 0, 0], ['#3f7d2f', '#4f9a3a', '#5aa846']))
  for (const s of [-1, 1]) pushStrip(p, m, strip([[0, 0.08, 0], [s * 0.09, 0.15, 0.02], [s * 0.17, 0.17, 0.03]], [0.02, 0.07, 0], [0, 0.3, 1], ['#3f7d2f', '#5aa846', '#6fb352']))
  const centre = hex === '#ffd23f' ? '#c96a1c' : '#ffcf3a'
  const petals = 6
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    pushStrip(p, m, strip([[ca * 0.02, 0.43, sa * 0.02], [ca * 0.08, 0.455, sa * 0.08], [ca * 0.13, 0.44, sa * 0.13]], [0.035, 0.075, 0], [-sa, 0, ca], [hex, hex, hex]))
  }
  p.add(sphere(0.035, 8, 6), centre, { y: 0.455, sy: 0.6, jitter: 0, flat: false, mat: m })
  return p.geometry(m)
}

function reedsModel() {
  const p = new Parts(SMALL_MAT)
  const m = SMALL_MAT
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 0.1
    const z = (i % 2) * 0.09 - 0.04
    const h = 1.1 + (i % 3) * 0.15
    pushStrip(p, m, strip([[x, 0, z], [x + 0.03, h * 0.5, z], [x + 0.09, h, z + 0.02]], [0.05, 0.035, 0], [0.3, 0, 1], ['#4a7f35', '#6aa84f', '#9cc76a']))
    if (i % 2 === 0) p.add(cyl(0.045, 0.045, 0.28, 8), '#6b4526', { x: x + 0.04, y: h * 0.82, z, jitter: 0.04, flat: false, mat: m })
  }
  return p.geometry(m)
}

function mushroomModel() {
  const p = new Parts(SMOOTH)
  p.add(cyl(0.07, 0.1, 0.3, 10), '#fff4e0', { y: 0.15, flat: false })
  p.add(sphere(0.21, 14, 8, 0, Math.PI / 2), '#e94b3c', { y: 0.27, sy: 0.7, flat: false, rough: 0.45 })
  p.add(cyl(0.2, 0.2, 0.02, 14), '#f3e2c4', { y: 0.27, flat: false })
  for (let i = 0; i < 5; i++) p.add(sphere(0.03, 6, 4), '#ffffff', { x: Math.cos(i * 1.3) * 0.11, y: 0.39 - (i % 2) * 0.03, z: Math.sin(i * 1.3) * 0.11, sy: 0.5, jitter: 0, flat: false })
  return p.geometry(SMOOTH)
}

// Street lamp: stepped base, fluted post, a collar and a little iron cap.
function lamppostModel() {
  const p = new Parts(SMOOTH)
  const iron = { rough: 0.38, metal: 0.65, flat: false }
  const c = '#2b3533'
  p.add(cyl(0.24, 0.27, 0.14, 12), c, { y: 0.07, ...iron })
  p.add(cyl(0.18, 0.22, 0.22, 12), c, { y: 0.25, ...iron })
  p.add(cyl(0.085, 0.11, 0.5, 12), c, { y: 0.6, ...iron })
  p.add(cyl(0.06, 0.07, 2.4, 10), c, { y: 2.0, ...iron })
  p.add(cyl(0.11, 0.08, 0.1, 12), c, { y: 3.08, ...iron })
  p.add(cyl(0.2, 0.2, 0.05, 12), c, { y: 3.15, ...iron })
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    p.add(box(0.03, 0.55, 0.03), c, { x: Math.cos(a) * 0.17, y: 3.43, z: Math.sin(a) * 0.17, ...iron })
  }
  p.add(cone(0.29, 0.26, 12), c, { y: 3.83, ...iron })
  p.add(cyl(0.05, 0.05, 0.08, 8), c, { y: 4.0, ...iron })
  p.add(sphere(0.055, 8, 6), c, { y: 4.07, ...iron })
  return p.geometry(SMOOTH)
}
function lampheadModel() {
  const p = new Parts()
  p.add(cyl(0.155, 0.12, 0.5, 12), '#ffe9a8', { y: 3.42, mat: GLOW, jitter: 0, rough: 0.12, flat: false })
  return p.geometry(GLOW)
}

// ---------- prototypes ----------

export const PROTOS = {
  round: () => roundTree(false),
  pine: () => pineTree(false),
  palm: () => palmTree(false),
  bush: () => bushModel(false),
  rock: () => rockModel(false),
  grass: grassTuft,
  mushroom: mushroomModel,
  reeds: reedsModel,
  lamppost: lamppostModel,
  lamphead: lampheadModel,
}
const LO = {
  round: () => roundTree(true),
  pine: () => pineTree(true),
  palm: () => palmTree(true),
  bush: () => bushModel(true),
  rock: () => rockModel(true),
}

const protoCache = new Map()
export function proto(name, lo = false) {
  const key = lo ? name + ':lo' : name
  let g = protoCache.get(key)
  if (!g) {
    if (name.startsWith('flower:')) g = flowerProto(name.slice(7))
    else g = lo && LO[name] ? LO[name]() : PROTOS[name]()
    protoCache.set(key, g)
  }
  return g
}
// Which material each kind of plant uses.
export function matFor(name) {
  if (name === 'round' || name === 'pine' || name === 'bush') return TREE_MAT
  if (name === 'palm') return LEAF_MAT
  if (name === 'grass' || name === 'reeds' || name.startsWith('flower:')) return SMALL_MAT
  if (name === 'lamphead') return GLOW
  if (name === 'rock') return MAT
  return SMOOTH
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _s = new THREE.Vector3()
const _p = new THREE.Vector3()
const _c = new THREE.Color()

function itemMatrix(it, out) {
  _e.set(it.rx || 0, it.ry || 0, it.rz || 0)
  _q.setFromEuler(_e)
  const s = it.s || 1
  _s.set(s * (it.sx || 1), s * (it.sy || 1), s * (it.sx || 1))
  _p.set(it.x, it.y, it.z)
  return out.compose(_p, _q, _s)
}

// items: [{x, y, z, s, ry, tint}]
export function instanced(name, items, { shadow = true, receive = true, mat = matFor(name) } = {}) {
  const mesh = new THREE.InstancedMesh(proto(name), mat, items.length)
  items.forEach((it, i) => {
    mesh.setMatrixAt(i, itemMatrix(it, _m))
    const k = it.tint ?? 1
    mesh.setColorAt(i, _c.setRGB(k, k, k))
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.castShadow = shadow
  mesh.receiveShadow = receive
  mesh.computeBoundingSphere()
  return mesh
}

// ---------- near / far pools ----------

// How far each kind keeps its detailed model, and how far it is drawn at all.
const RANGE = {
  round: { hi: 62, far: 1e9 },
  pine: { hi: 62, far: 1e9 },
  palm: { hi: 55, far: 1e9 },
  bush: { hi: 40, far: 150 },
  rock: { hi: 40, far: 150 },
  grass: { hi: 0, far: 58 },
  reeds: { hi: 0, far: 70 },
  flower: { hi: 0, far: 62 },
}
export const POOLED = (type) => type in RANGE || type.startsWith('flower:')

export class PlantPools {
  constructor(scene, itemsByType) {
    this.kinds = []
    for (const [type, items] of Object.entries(itemsByType)) {
      if (!items.length) continue
      const r = RANGE[type.startsWith('flower:') ? 'flower' : type]
      const n = items.length
      const mats = new Float32Array(n * 16)
      const xz = new Float32Array(n * 2)
      const tint = new Float32Array(n)
      items.forEach((it, i) => {
        itemMatrix(it, _m).toArray(mats, i * 16)
        xz[i * 2] = it.x
        xz[i * 2 + 1] = it.z
        tint[i] = it.tint ?? 1
      })
      const small = r.hi === 0
      const make = (lo) => {
        const mesh = new THREE.InstancedMesh(proto(type, lo), matFor(type), n)
        mesh.count = 0
        mesh.castShadow = !small && !lo
        mesh.receiveShadow = true
        mesh.frustumCulled = true
        mesh.setColorAt(0, _c.setRGB(1, 1, 1))
        scene.add(mesh)
        return mesh
      }
      // small plants have only one (detailed) model, shown near Coji
      const near = make(false)
      const far = small ? null : make(true)
      this.kinds.push({ type, r, n, mats, xz, tint, near, far })
    }
    this.last = new THREE.Vector3(1e9, 0, 0)
    this.hiScale = 1
  }

  // Keep the detailed models over a shorter distance (for slower devices).
  setDetailRange(k) {
    this.hiScale = k
    this.last.set(1e9, 0, 0)
  }

  // Re-sort plants into the near and far pools when the camera has moved a few meters.
  update(cam, force = false) {
    if (!force && Math.hypot(cam.x - this.last.x, cam.z - this.last.z) < 4) return
    this.last.copy(cam)
    for (const k of this.kinds) {
      const hi2 = (k.r.hi * this.hiScale) ** 2
      const far2 = k.r.far * k.r.far
      let a = 0
      let b = 0
      const nm = k.near.instanceMatrix.array
      const fm = k.far?.instanceMatrix.array
      const nc = k.near.instanceColor.array
      const fc = k.far?.instanceColor.array
      for (let i = 0; i < k.n; i++) {
        const dx = k.xz[i * 2] - cam.x
        const dz = k.xz[i * 2 + 1] - cam.z
        const d2 = dx * dx + dz * dz
        if (d2 > far2) continue
        const t = k.tint[i]
        if (d2 <= hi2 || !k.far) {
          if (k.r.hi === 0 && d2 > far2) continue
          nm.set(k.mats.subarray(i * 16, i * 16 + 16), a * 16)
          nc[a * 3] = nc[a * 3 + 1] = nc[a * 3 + 2] = t
          a++
        } else {
          fm.set(k.mats.subarray(i * 16, i * 16 + 16), b * 16)
          fc[b * 3] = fc[b * 3 + 1] = fc[b * 3 + 2] = t
          b++
        }
      }
      for (const [mesh, cnt] of [
        [k.near, a],
        [k.far, b],
      ]) {
        if (!mesh) continue
        mesh.count = cnt
        mesh.visible = cnt > 0
        mesh.instanceMatrix.needsUpdate = true
        mesh.instanceColor.needsUpdate = true
        if (cnt) mesh.computeBoundingSphere()
      }
    }
  }
}

// ---------- clouds ----------

// Big puffy clouds: bright tops, soft gray-blue bellies, a flat-ish bottom.
export const CLOUD_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: 0xc9d8ea, emissiveIntensity: 0.32 })
export function cloud(rand) {
  const p = new Parts(CLOUD_MAT)
  const n = 6 + Math.floor(rand() * 4)
  const start = 0
  for (let i = 0; i < n; i++) {
    const r = 3 + rand() * 3.5
    const mid = 1 - Math.abs(i - (n - 1) / 2) / n
    p.add(blob(r, 1, i + 40, 0.1), '#ffffff', { x: (i - n / 2) * 3.4 + rand() * 2, y: mid * 2.6 + rand() * 1.2, z: rand() * 5 - 2.5, sy: 0.78, jitter: 0, flat: false })
  }
  for (let i = 0; i < 3; i++) p.add(blob(2.4 + rand() * 1.5, 1, i + 70, 0.1), '#ffffff', { x: (rand() - 0.5) * n * 2.4, y: 3.4 + rand() * 1.4, z: rand() * 3 - 1.5, sy: 0.85, jitter: 0, flat: false })
  const g = p.groups.get(CLOUD_MAT)
  const belly = new THREE.Color('#aebdd0')
  for (let i = start; i < g.pos.length; i += 3) {
    const y = g.pos[i + 1]
    if (y < -1.4) g.pos[i + 1] = -1.4 - (y + 1.4) * 0.15 // flatten the bottom
    const k = Math.min(1, Math.max(0, (g.pos[i + 1] + 1.4) / 4.5))
    const f = 1 - k
    g.col[i] += (belly.r - g.col[i]) * f * 0.75
    g.col[i + 1] += (belly.g - g.col[i + 1]) * f * 0.75
    g.col[i + 2] += (belly.b - g.col[i + 2]) * f * 0.75
    // soft, round shading for the whole cloud
    const nx = g.pos[i] / (n * 2)
    const ny = (g.pos[i + 1] - 1) / 3
    const nz = g.pos[i + 2] / 4
    const l = Math.hypot(nx, ny, nz) || 1
    g.nor[i] = g.nor[i] * 0.5 + (nx / l) * 0.5
    g.nor[i + 1] = g.nor[i + 1] * 0.5 + (ny / l) * 0.5
    g.nor[i + 2] = g.nor[i + 2] * 0.5 + (nz / l) * 0.5
  }
  const mesh = new THREE.Mesh(p.geometry(CLOUD_MAT), CLOUD_MAT)
  mesh.castShadow = false
  return mesh
}

export { box }
