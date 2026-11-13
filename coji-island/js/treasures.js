// Little treasures to find around the island and swap at the bank. Each kind lives in its own kind
// of place, is worth a different number of coins (rare things are worth more), and grows back after
// a while once it is picked up.
import * as THREE from 'three'
import { Parts, SMOOTH, MAT, box, cyl, sphere, ico, torus } from './build.js'

// price: coins at the bank. respawn: seconds until it comes back. where: what kind of place.
export const TREASURES = {
  acorn: { price: 1, respawn: 150, where: 'forest' },
  starfish: { price: 2, respawn: 200, where: 'beach' },
  clover: { price: 3, respawn: 300, where: 'meadow' },
  bone: { price: 4, respawn: 360, where: 'farm' },
  pearl: { price: 5, respawn: 420, where: 'islet' },
  key: { price: 6, respawn: 480, where: 'graveyard' },
  crystal: { price: 8, respawn: 600, where: 'mountain' },
}

function starfish() {
  const p = new Parts(SMOOTH)
  const shape = new THREE.Shape()
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    const r = i % 2 ? 0.07 : 0.2
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2 })
  p.add(g, '#ff8a4c', { rx: -Math.PI / 2, y: 0.03, jitter: 0.05, flat: false, rough: 0.6 })
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2
    for (const r of [0.06, 0.11, 0.15]) p.add(sphere(0.012, 6, 4), '#ffd2a8', { x: Math.cos(a) * r, y: 0.085, z: -Math.sin(a) * r, jitter: 0, flat: false })
  }
  return p.build()
}

function acorn() {
  const p = new Parts(SMOOTH)
  p.add(sphere(0.09, 12, 10), '#b9773a', { y: 0.1, sy: 1.25, flat: false, rough: 0.45 })
  p.add(sphere(0.1, 12, 6, 0, Math.PI / 2), '#7a5230', { y: 0.15, sy: 0.75, flat: false, rough: 0.9, jitter: 0.12 })
  p.add(cyl(0.012, 0.016, 0.06, 6), '#5a3b22', { y: 0.24, rz: 0.3, flat: false })
  return p.build()
}

function clover() {
  const p = new Parts(SMOOTH)
  p.add(cyl(0.01, 0.012, 0.22, 5), '#4c8f3a', { y: 0.11, rz: 0.1, flat: false })
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    // each leaf is a little heart: two round lobes
    for (const s of [-1, 1]) {
      const la = a + s * 0.32
      p.add(sphere(0.045, 10, 6), '#3fa046', { x: Math.cos(la) * 0.06, y: 0.225, z: Math.sin(la) * 0.06, sy: 0.25, flat: false, rough: 0.55 })
    }
  }
  return p.build()
}

function dinoBone() {
  const p = new Parts(SMOOTH)
  const c = '#efe3c8'
  p.add(cyl(0.035, 0.035, 0.34, 10), c, { y: 0.05, rz: Math.PI / 2, flat: false, jitter: 0.06 })
  for (const s of [-1, 1]) for (const z of [-0.035, 0.035]) p.add(sphere(0.048, 10, 8), c, { x: s * 0.18, y: 0.05, z, flat: false, jitter: 0.06 })
  return p.build()
}

function pearl() {
  const p = new Parts(SMOOTH)
  // an open oyster shell with a shiny pearl inside
  p.add(sphere(0.16, 16, 6, 0, Math.PI / 2), '#a9a3b5', { y: 0.0, sy: 0.35, rx: Math.PI, flat: false, jitter: 0.1, rough: 0.6 })
  p.add(sphere(0.16, 16, 6, 0, Math.PI / 2), '#b9b3c4', { y: 0.05, z: -0.1, sy: 0.35, rx: -1.1, flat: false, jitter: 0.1, rough: 0.6 })
  p.add(cyl(0.15, 0.15, 0.01, 16), '#e9e2f2', { y: 0.01, flat: false, rough: 0.3 })
  p.add(sphere(0.065, 16, 12), '#fbf6ff', { y: 0.075, flat: false, rough: 0.12, metal: 0.1 })
  return p.build()
}

function oldKey() {
  const p = new Parts(SMOOTH)
  const brass = { rough: 0.35, metal: 0.85, flat: false, jitter: 0.08 }
  p.add(torus(0.07, 0.018, 8, 18), '#b8862f', { x: -0.14, y: 0.02, rx: Math.PI / 2, ...brass })
  p.add(cyl(0.016, 0.016, 0.26, 8), '#b8862f', { x: 0.0, y: 0.02, rz: Math.PI / 2, ...brass })
  p.add(box(0.03, 0.02, 0.06), '#b8862f', { x: 0.1, y: 0.02, z: 0.035, ...brass })
  p.add(box(0.03, 0.02, 0.045), '#b8862f', { x: 0.05, y: 0.02, z: 0.03, ...brass })
  return p.build()
}

function crystal() {
  const p = new Parts(MAT)
  const shard = (h, r, x, z, rx, rz, c) => {
    p.add(cyl(r, r, h, 6), c, { x, y: h / 2, z, rx, rz, rough: 0.12, jitter: 0.04 })
    p.add(new THREE.ConeGeometry(r, r * 1.6, 6), c, { x: x + Math.sin(rz) * -h * 0.5, y: h + r * 0.7, z: z + Math.sin(rx) * h * 0.5, rx, rz, rough: 0.12, jitter: 0.04 })
  }
  shard(0.32, 0.06, 0, 0, 0, 0, '#a77bff')
  shard(0.22, 0.045, 0.08, 0.04, 0.2, -0.45, '#8f63f2')
  shard(0.18, 0.04, -0.08, -0.02, -0.25, 0.5, '#c4a3ff')
  p.add(ico(0.1, 0), '#7c7468', { y: 0.01, sy: 0.4 })
  return p.build()
}

const MAKERS = { starfish, acorn, clover, bone: dinoBone, pearl, key: oldKey, crystal }
export function treasureMesh(kind) {
  const m = MAKERS[kind]()
  m.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  m.scale.setScalar(1.25)
  return m
}
