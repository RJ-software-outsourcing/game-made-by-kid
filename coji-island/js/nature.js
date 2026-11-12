// Plants, rocks, lamps and clouds. Trees, flowers, grass, rocks and lamps are drawn with InstancedMesh:
// hundreds of them cost only a handful of draw calls.
import * as THREE from 'three'
import { Parts, MAT, SMOOTH, GLOW, cyl, cone, ico, box } from './build.js'
import { vnoise } from './land.js'

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

function geo(fn) {
  const p = new Parts()
  fn(p)
  return p.geometry(MAT)
}

export const PROTOS = {
  round: () =>
    geo((p) => {
      p.add(cyl(0.22, 0.34, 2.5, 8), '#8b5a2b', { y: 1.25, jitter: 0.03 })
      p.add(cyl(0.08, 0.12, 1.1, 6), '#8b5a2b', { x: 0.45, y: 2.3, rz: -0.8, jitter: 0.03 })
      p.add(blob(1.55, 2, 1), '#63b84f', { y: 3.3, sy: 0.92, jitter: 0.03 })
      p.add(blob(1.05, 1, 2), '#73c85b', { x: 1.0, y: 2.85, z: 0.35, jitter: 0.03 })
      p.add(blob(1.0, 1, 3), '#56a846', { x: -0.9, y: 3.0, z: -0.45, jitter: 0.03 })
      p.add(blob(0.95, 1, 4), '#6cc055', { x: 0.1, y: 4.2, z: 0.2, jitter: 0.03 })
    }),
  pine: () =>
    geo((p) => {
      p.add(cyl(0.2, 0.3, 1.6, 7), '#7a4e27', { y: 0.8 })
      p.add(cone(1.75, 2.2, 9), '#3f9a5a', { y: 2.2 })
      p.add(cone(1.4, 2.0, 9), '#47a862', { y: 3.3 })
      p.add(cone(1.0, 1.8, 9), '#52b56c', { y: 4.4 })
      p.add(cone(0.5, 0.9, 7), '#5cc077', { y: 5.3 })
    }),
  palm: () =>
    geo((p) => {
      let x = 0
      let y = 0
      for (let i = 0; i < 7; i++) {
        p.add(cyl(0.19 - i * 0.012, 0.23 - i * 0.012, 0.8, 7), i % 2 ? '#b58552' : '#a77745', { x, y: y + 0.4, rz: -0.08 - i * 0.03 })
        x += 0.06 + i * 0.026
        y += 0.78
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        p.add(ico(0.5, 1), i % 2 ? '#4fb34a' : '#5cc456', { x: x + Math.cos(a) * 1.05, y: y - 0.2, z: Math.sin(a) * 1.05, sx: 2.5, sy: 0.16, sz: 0.65, ry: -a, rz: -0.4 })
      }
      for (let i = 0; i < 3; i++) p.add(ico(0.17, 1), '#7a4e27', { x: x + Math.cos(i * 2.1) * 0.25, y: y - 0.3, z: Math.sin(i * 2.1) * 0.25 })
    }),
  bush: () =>
    geo((p) => {
      p.add(blob(0.7, 1, 5), '#5aad4d', { y: 0.45, sx: 1.3 })
      p.add(blob(0.5, 1, 6), '#66ba57', { x: 0.55, y: 0.38, z: 0.25 })
      p.add(blob(0.45, 1, 7), '#4f9f45', { x: -0.55, y: 0.35, z: -0.15 })
    }),
  rock: () =>
    geo((p) => {
      p.add(ico(0.7, 1), '#a8a29a', { y: 0.25, sy: 0.65, jitter: 0.06 })
      p.add(ico(0.42, 1), '#b8b2aa', { x: 0.55, y: 0.15, z: 0.25, sy: 0.7, jitter: 0.06 })
    }),
  grass: () =>
    geo((p) => {
      for (let i = 0; i < 5; i++) p.add(cone(0.06, 0.55 + (i % 2) * 0.15, 3), i % 2 ? '#79c95d' : '#69ba50', { x: (i - 2) * 0.08, y: 0.27, z: (i % 2) * 0.08, rz: (i - 2) * 0.22, jitter: 0 })
    }),
  mushroom: () =>
    geo((p) => {
      p.add(cyl(0.08, 0.1, 0.3, 6), '#fff4e0', { y: 0.15 })
      p.add(ico(0.2, 1), '#e94b3c', { y: 0.34, sy: 0.55 })
      p.add(ico(0.04, 0), '#ffffff', { x: 0.08, y: 0.42, z: 0.05, jitter: 0 })
    }),
  reeds: () =>
    geo((p) => {
      for (let i = 0; i < 5; i++) {
        p.add(cyl(0.025, 0.03, 1.3, 4), '#6aa84f', { x: (i - 2) * 0.12, y: 0.65, z: (i % 2) * 0.1, rz: (i - 2) * 0.06 })
        if (i % 2 === 0) p.add(cyl(0.06, 0.06, 0.3, 5), '#7a4e27', { x: (i - 2) * 0.12 + (i - 2) * 0.07, y: 1.25, z: (i % 2) * 0.1 })
      }
    }),
  lamppost: () =>
    geo((p) => {
      p.add(cyl(0.18, 0.22, 0.3, 8), '#34404a', { y: 0.15 })
      p.add(cyl(0.06, 0.08, 3.0, 8), '#34404a', { y: 1.6 })
      p.add(cyl(0.2, 0.16, 0.12, 8), '#34404a', { y: 3.1 })
      p.add(cone(0.26, 0.28, 8), '#34404a', { y: 3.8 })
      p.add(ico(0.06, 0), '#34404a', { y: 4.0 })
    }),
  lamphead: () => {
    const p = new Parts()
    p.add(cyl(0.17, 0.13, 0.5, 8), '#ffe9a8', { y: 3.42, mat: GLOW, jitter: 0 })
    return p.geometry(GLOW)
  },
}

export const FLOWER_COLORS = ['#ff6b8a', '#ffd23f', '#ffffff', '#b38bff', '#ff9f43']
export function flowerProto(hex) {
  return geo((p) => {
    p.add(cyl(0.022, 0.022, 0.4, 3), '#5aa846', { y: 0.2, jitter: 0 })
    p.add(cyl(0.13, 0.13, 0.05, 6), hex, { y: 0.42, jitter: 0.04 })
    p.add(ico(0.05, 0), hex === '#ffd23f' ? '#ff9f43' : '#ffd23f', { y: 0.46, jitter: 0 })
    p.add(cone(0.06, 0.16, 3), '#5aa846', { x: 0.05, y: 0.12, rz: -0.7, jitter: 0 })
  })
}

const protoCache = new Map()
export function proto(name) {
  let g = protoCache.get(name)
  if (!g) {
    g = name.startsWith('flower:') ? flowerProto(name.slice(7)) : PROTOS[name]()
    protoCache.set(name, g)
  }
  return g
}
// Which material each kind of plant uses.
export function matFor(name) {
  if (name === 'round' || name === 'bush') return SMOOTH
  if (name === 'lamphead') return GLOW
  return MAT
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _s = new THREE.Vector3()
const _p = new THREE.Vector3()
const _c = new THREE.Color()

// items: [{x, y, z, s, ry, tint}]
export function instanced(name, items, { shadow = true, receive = false, mat = matFor(name) } = {}) {
  const mesh = new THREE.InstancedMesh(proto(name), mat, items.length)
  items.forEach((it, i) => {
    _e.set(it.rx || 0, it.ry || 0, it.rz || 0)
    _q.setFromEuler(_e)
    const s = it.s || 1
    _s.set(s * (it.sx || 1), s * (it.sy || 1), s * (it.sx || 1))
    _p.set(it.x, it.y, it.z)
    _m.compose(_p, _q, _s)
    mesh.setMatrixAt(i, _m)
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

// Big, puffy, bright white clouds.
const CLOUD_MAT = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xdde8f5, emissiveIntensity: 0.55 })
export function cloud(rand) {
  const p = new Parts()
  const n = 5 + Math.floor(rand() * 4)
  for (let i = 0; i < n; i++) {
    const r = 3.5 + rand() * 4
    p.add(blob(r, 1, i, 0.08), '#ffffff', { x: (i - n / 2) * 3.8 + rand() * 2, y: rand() * 2.4 - (i % 2) * 0.8, z: rand() * 5 - 2.5, sy: 0.72, jitter: 0, mat: CLOUD_MAT })
  }
  // flat bottom
  p.add(cyl(n * 2.2, n * 2.2, 0.5, 14), '#ffffff', { y: -1.6, sz: 0.45, jitter: 0, mat: CLOUD_MAT })
  return p.build({ shadow: false })
}

export { box }
