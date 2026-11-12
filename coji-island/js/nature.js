// Plants, rocks and clouds. Trees, flowers, grass and rocks are drawn with InstancedMesh:
// hundreds of them cost only a handful of draw calls.
import * as THREE from 'three'
import { Parts, MAT, box, cyl, cone, ico } from './build.js'

function geo(fn) {
  const p = new Parts()
  fn(p)
  return p.geometry(MAT)
}

export const PROTOS = {
  round: () =>
    geo((p) => {
      p.add(cyl(0.22, 0.34, 2.4, 6), '#8b5a2b', { y: 1.2 })
      p.add(ico(1.55, 1), '#63b84f', { y: 3.2, sy: 0.95 })
      p.add(ico(1.05, 1), '#71c65a', { x: 0.95, y: 2.8, z: 0.35 })
      p.add(ico(1.0, 1), '#58a947', { x: -0.85, y: 2.95, z: -0.45 })
      p.add(ico(0.9, 1), '#6cc055', { x: 0.1, y: 4.1, z: 0.2 })
    }),
  pine: () =>
    geo((p) => {
      p.add(cyl(0.2, 0.3, 1.6, 6), '#7a4e27', { y: 0.8 })
      p.add(cone(1.7, 2.2, 7), '#3f9a5a', { y: 2.2 })
      p.add(cone(1.35, 2.0, 7), '#47a862', { y: 3.3 })
      p.add(cone(0.95, 1.8, 7), '#52b56c', { y: 4.4 })
    }),
  palm: () =>
    geo((p) => {
      let x = 0
      let y = 0
      for (let i = 0; i < 6; i++) {
        p.add(cyl(0.2 - i * 0.015, 0.24 - i * 0.015, 0.9, 6), i % 2 ? '#b58552' : '#a77745', { x, y: y + 0.45, rz: -0.08 - i * 0.03 })
        x += 0.07 + i * 0.03
        y += 0.88
      }
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2
        p.add(ico(0.5, 0), i % 2 ? '#4fb34a' : '#5cc456', { x: x + Math.cos(a) * 1.0, y: y - 0.15, z: Math.sin(a) * 1.0, sx: 2.4, sy: 0.18, sz: 0.7, ry: -a, rz: -0.35 })
      }
      for (let i = 0; i < 3; i++) p.add(ico(0.17, 0), '#7a4e27', { x: x + Math.cos(i * 2.1) * 0.25, y: y - 0.3, z: Math.sin(i * 2.1) * 0.25 })
    }),
  bush: () =>
    geo((p) => {
      p.add(ico(0.7, 1), '#5aad4d', { y: 0.45, sx: 1.3 })
      p.add(ico(0.5, 1), '#66ba57', { x: 0.55, y: 0.38, z: 0.25 })
      p.add(ico(0.45, 1), '#4f9f45', { x: -0.55, y: 0.35, z: -0.15 })
    }),
  rock: () =>
    geo((p) => {
      p.add(ico(0.7, 0), '#a8a29a', { y: 0.25, sy: 0.7 })
      p.add(ico(0.42, 0), '#b8b2aa', { x: 0.55, y: 0.15, z: 0.25, sy: 0.7 })
    }),
  grass: () =>
    geo((p) => {
      for (let i = 0; i < 4; i++) p.add(cone(0.07, 0.55, 3), i % 2 ? '#79c95d' : '#69ba50', { x: (i - 1.5) * 0.09, y: 0.25, z: (i % 2) * 0.08, rz: (i - 1.5) * 0.25, jitter: 0 })
    }),
  mushroom: () =>
    geo((p) => {
      p.add(cyl(0.08, 0.1, 0.3, 6), '#fff4e0', { y: 0.15 })
      p.add(ico(0.2, 0), '#e94b3c', { y: 0.34, sy: 0.55 })
      p.add(ico(0.04, 0), '#ffffff', { x: 0.08, y: 0.42, z: 0.05, jitter: 0 })
    }),
  reeds: () =>
    geo((p) => {
      for (let i = 0; i < 5; i++) {
        p.add(cyl(0.025, 0.03, 1.3, 4), '#6aa84f', { x: (i - 2) * 0.12, y: 0.65, z: (i % 2) * 0.1, rz: (i - 2) * 0.06 })
        if (i % 2 === 0) p.add(cyl(0.06, 0.06, 0.3, 5), '#7a4e27', { x: (i - 2) * 0.12 + (i - 2) * 0.07, y: 1.25, z: (i % 2) * 0.1 })
      }
    }),
}

export const FLOWER_COLORS = ['#ff6b8a', '#ffd23f', '#ffffff', '#b38bff', '#ff9f43']
export function flowerProto(hex) {
  return geo((p) => {
    p.add(cyl(0.025, 0.025, 0.4, 4), '#5aa846', { y: 0.2, jitter: 0 })
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      p.add(ico(0.075, 0), hex, { x: Math.cos(a) * 0.09, y: 0.42, z: Math.sin(a) * 0.09, sy: 0.5, jitter: 0.04 })
    }
    p.add(ico(0.05, 0), hex === '#ffd23f' ? '#ff9f43' : '#ffd23f', { y: 0.44, jitter: 0 })
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

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _s = new THREE.Vector3()
const _p = new THREE.Vector3()
const _c = new THREE.Color()

// items: [{x, y, z, s, ry, tint}]
export function instanced(name, items, { shadow = true, receive = false } = {}) {
  const mesh = new THREE.InstancedMesh(proto(name), MAT, items.length)
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

export function cloud(rand) {
  const p = new Parts()
  const n = 4 + Math.floor(rand() * 3)
  for (let i = 0; i < n; i++) {
    const r = 3 + rand() * 3.5
    p.add(ico(r, 1), i % 2 ? '#ffffff' : '#f4f8ff', { x: (i - n / 2) * 3.6 + rand() * 2, y: rand() * 2, z: rand() * 4 - 2, sy: 0.7, jitter: 0.02 })
  }
  return p.build({ shadow: false })
}

export { box }
