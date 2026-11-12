// Buildings and objects. Each builder returns a Group whose door/front faces +z.
import * as THREE from 'three'
import { Parts, MAT, GLOW, box, cyl, cone, ico, sphere, torus, textCanvas } from './build.js'

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

// Two roof slabs over a gable.
function roof(p, w, d, wallH, h, hex, over = 0.45) {
  const a = Math.atan2(h, d / 2)
  const L = Math.hypot(d / 2, h) + over
  const t = 0.18
  for (const s of [1, -1]) {
    const nY = Math.cos(a) * (t / 2)
    const nZ = Math.sin(a) * (t / 2) * s
    p.add(box(w + over * 1.6, t, L), hex, { y: wallH + h / 2 + nY, z: (s * d) / 4 + nZ, rx: s * a, jitter: 0.04 })
  }
}

function windowAt(p, x, y, z, ry = 0, w = 0.9, h = 0.85) {
  p.add(box(w, h, 0.08), '#bfe3ff', { x, y, z, ry, mat: GLOW, jitter: 0 })
  const nx = Math.sin(ry) * 0.05
  const nz = Math.cos(ry) * 0.05
  p.add(box(w + 0.16, 0.1, 0.1), '#ffffff', { x: x + nx, y: y - h / 2, z: z + nz, ry, jitter: 0 })
  p.add(box(w + 0.16, 0.1, 0.1), '#ffffff', { x: x + nx, y: y + h / 2, z: z + nz, ry, jitter: 0 })
  p.add(box(0.08, h, 0.1), '#ffffff', { x: x + nx, y, z: z + nz, ry, jitter: 0 })
  p.add(box(w, 0.07, 0.1), '#ffffff', { x: x + nx, y, z: z + nz, ry, jitter: 0 })
}

const WALLS = ['#fff1d6', '#ffd9c2', '#e2f4e4', '#e6ecff', '#fff7c7']
const ROOFS = ['#f0705f', '#4fb0a5', '#f5a742', '#8f7ad9', '#5aa0e6']

export function house(colorIdx = 0, w = 5.5, d = 5) {
  const p = new Parts()
  const H = 2.9
  const wall = WALLS[colorIdx % WALLS.length]
  const rf = ROOFS[colorIdx % ROOFS.length]
  p.add(box(w + 0.3, 0.35, d + 0.3), '#c9c2b8', { y: 0.1 })
  p.add(box(w, H, d), wall, { y: H / 2 + 0.2, jitter: 0.03 })
  p.add(prism(w, 1.7, d), wall, { y: H + 0.2, jitter: 0.03 })
  roof(p, w, d, H + 0.2, 1.7, rf)
  p.add(box(1.1, 1.9, 0.12), '#a8693f', { y: 1.15, z: d / 2 + 0.03 })
  p.add(ico(0.07, 0), '#f1c232', { x: 0.35, y: 1.15, z: d / 2 + 0.12 })
  p.add(box(1.6, 0.12, 0.6), '#c9c2b8', { y: 0.25, z: d / 2 + 0.35 })
  windowAt(p, -1.65, 1.9, d / 2 + 0.03)
  windowAt(p, 1.65, 1.9, d / 2 + 0.03)
  windowAt(p, w / 2 + 0.03, 1.9, 0, Math.PI / 2)
  windowAt(p, -w / 2 - 0.03, 1.9, 0, -Math.PI / 2)
  // flower boxes
  for (const s of [-1, 1]) {
    p.add(box(1.0, 0.22, 0.3), '#a8693f', { x: s * 1.65, y: 1.38, z: d / 2 + 0.18 })
    for (let i = 0; i < 4; i++) p.add(ico(0.12, 0), ['#ff6b8a', '#ffd23f', '#ff9f43', '#ffffff'][i], { x: s * 1.65 - 0.36 + i * 0.24, y: 1.55, z: d / 2 + 0.2 })
  }
  p.add(box(0.6, 1.2, 0.6), '#b5654a', { x: w / 4, y: H + 1.6, z: -d / 5 })
  return p.build()
}

export function cottage() {
  const p = new Parts()
  const w = 5.5
  const d = 5
  const H = 2.6
  p.add(box(w + 0.3, 0.35, d + 0.3), '#a9a39a', { y: 0.1 })
  p.add(box(w, H, d), '#ece6da', { y: H / 2 + 0.2, jitter: 0.06 })
  p.add(prism(w, 1.6, d), '#ece6da', { y: H + 0.2 })
  roof(p, w, d, H + 0.2, 1.6, '#3d6e9e')
  p.add(box(1.1, 1.9, 0.12), '#2f5b86', { y: 1.15, z: d / 2 + 0.03 })
  windowAt(p, 1.6, 1.8, d / 2 + 0.03)
  windowAt(p, -1.6, 1.8, d / 2 + 0.03)
  // life ring on the wall
  p.add(torus(0.35, 0.1, 6, 12), '#ff5a4f', { x: w / 2 + 0.08, y: 1.8, ry: Math.PI / 2 })
  p.add(box(0.5, 1.3, 0.5), '#8c8c8c', { x: -w / 4, y: H + 1.5, z: -d / 5 })
  return p.build()
}

export function shed() {
  const p = new Parts()
  const w = 5
  const d = 4
  const H = 2.6
  p.add(box(w, H, d), '#d9574f', { y: H / 2, jitter: 0.04 })
  p.add(prism(w, 1.5, d), '#d9574f', { y: H })
  roof(p, w, d, H, 1.5, '#f2efe8')
  p.add(box(2, 2.1, 0.1), '#f2efe8', { y: 1.05, z: d / 2 + 0.03 })
  p.add(box(2.4, 0.12, 0.12), '#f2efe8', { y: 1.05, z: d / 2 + 0.1, rz: 0.75 })
  p.add(box(2.4, 0.12, 0.12), '#f2efe8', { y: 1.05, z: d / 2 + 0.1, rz: -0.75 })
  for (let i = 0; i < 3; i++) p.add(cyl(0.45, 0.45, 0.6, 8), '#f1d36b', { x: w / 2 + 0.6, y: 0.3 + i * 0.6 * (i < 2 ? 1 : 0.9), z: -1 + i * 0.7, rx: Math.PI / 2 })
  return p.build()
}

export function warehouse() {
  const p = new Parts()
  const w = 6
  const d = 8
  const H = 3.2
  p.add(box(w, H, d), '#b98a5e', { y: H / 2, jitter: 0.05 })
  for (let i = -3; i <= 3; i++) p.add(box(0.08, H, d + 0.02), '#9a7049', { x: i * 0.85, y: H / 2, jitter: 0 })
  p.add(prism(w, 1.4, d), '#b98a5e', { y: H })
  roof(p, w, d, H, 1.4, '#6c7a89')
  p.add(box(2.6, 2.5, 0.1), '#7d5634', { y: 1.25, z: d / 2 + 0.03 })
  // crates and barrels
  const crate = (x, y, z, s = 1) => p.add(box(0.9 * s, 0.9 * s, 0.9 * s), '#c89a5a', { x, y: y + 0.45 * s, z, ry: Math.random() * 0.4 })
  crate(2.2, 0, d / 2 + 1)
  crate(3.1, 0, d / 2 + 1.3)
  crate(2.6, 0.9, d / 2 + 1.1, 0.8)
  for (const [x, z] of [[-2.4, d / 2 + 1], [-1.6, d / 2 + 1.6]]) {
    p.add(cyl(0.38, 0.38, 0.95, 9), '#8a5a35', { x, y: 0.48, z })
    p.add(torus(0.39, 0.04, 4, 10), '#555555', { x, y: 0.75, z, rx: Math.PI / 2 })
  }
  return p.build()
}

export function burgerHut() {
  const p = new Parts()
  const w = 8
  const d = 7
  const H = 3.0
  p.add(box(w + 0.4, 0.3, d + 0.4), '#d5cbbd', { y: 0.1 })
  // back and side walls
  p.add(box(w, H, 0.3), '#fff6e8', { y: H / 2 + 0.2, z: -d / 2 + 0.15 })
  for (const s of [-1, 1]) p.add(box(0.3, H, d), '#fff6e8', { x: (s * (w - 0.3)) / 2, y: H / 2 + 0.2 })
  // front: low counter wall + window opening
  p.add(box(w, 1.15, 0.3), '#e94b3c', { y: 0.78, z: d / 2 - 0.15 })
  p.add(box(w + 0.1, 0.12, 0.7), '#f7f1e6', { y: 1.4, z: d / 2 - 0.05 })
  p.add(box(w, 0.5, 0.3), '#fff6e8', { y: H - 0.05, z: d / 2 - 0.15 })
  for (const s of [-1, 1]) p.add(box(0.5, H, 0.32), '#fff6e8', { x: (s * (w - 0.5)) / 2, y: H / 2 + 0.2, z: d / 2 - 0.15 })
  // red stripe band
  p.add(box(w + 0.05, 0.3, d + 0.05), '#e94b3c', { y: H + 0.05 })
  // flat roof + striped awning
  p.add(box(w + 0.8, 0.3, d + 0.8), '#ffcf3f', { y: H + 0.35 })
  for (let i = 0; i < 8; i++)
    p.add(box(w / 8, 0.08, 1.4), i % 2 ? '#ffffff' : '#e94b3c', { x: -w / 2 + w / 16 + (i * w) / 8, y: H - 0.15, z: d / 2 + 0.55, rx: 0.35, jitter: 0 })
  // inside: grill + menu board
  p.add(box(2.4, 1.0, 0.8), '#7d7d86', { x: -1.8, y: 0.7, z: -d / 2 + 0.8 })
  p.add(box(1.8, 0.12, 0.6), '#2b2b2b', { x: -1.8, y: 1.25, z: -d / 2 + 0.8 })
  // giant burger on the roof
  const y0 = H + 0.5
  p.add(sphere(1.3, 12, 6, 0, Math.PI / 2), '#e8a33d', { y: y0 + 1.0, sy: 0.75 })
  p.add(cyl(1.35, 1.35, 0.15, 12), '#6ec43f', { y: y0 + 0.95 })
  p.add(cyl(1.25, 1.25, 0.12, 12), '#ffd23f', { y: y0 + 0.82 })
  p.add(cyl(1.28, 1.28, 0.38, 12), '#7a3e1f', { y: y0 + 0.6 })
  p.add(cyl(1.25, 1.2, 0.38, 12), '#e8a33d', { y: y0 + 0.22 })
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9
    p.add(ico(0.06, 0), '#fff5d6', { x: Math.cos(a) * 0.7, y: y0 + 1.75, z: Math.sin(a) * 0.7, jitter: 0 })
  }
  // tables outside
  for (const z of [-1.8, 1.8]) {
    p.add(cyl(0.7, 0.7, 0.08, 10), '#ffffff', { x: w / 2 + 2.4, y: 1.0, z })
    p.add(cyl(0.08, 0.08, 1.0, 6), '#888888', { x: w / 2 + 2.4, y: 0.5, z })
    p.add(cyl(0.12, 0.12, 2.6, 6), '#888888', { x: w / 2 + 2.4, y: 1.3, z })
    p.add(cone(1.2, 0.5, 8), z < 0 ? '#e94b3c' : '#ffcf3f', { x: w / 2 + 2.4, y: 2.7, z })
  }
  return p.build()
}

export function marketStall() {
  const p = new Parts()
  const w = 6
  const d = 4
  for (const [x, z] of [[-w / 2 + 0.2, -d / 2 + 0.2], [w / 2 - 0.2, -d / 2 + 0.2], [-w / 2 + 0.2, d / 2 - 0.2], [w / 2 - 0.2, d / 2 - 0.2]])
    p.add(box(0.2, 2.8, 0.2), '#a8693f', { x, y: 1.4, z })
  p.add(box(w, 1.0, 0.9), '#c48a52', { y: 0.5, z: d / 2 - 0.5 })
  p.add(box(w + 0.2, 0.1, 1.1), '#e0b07a', { y: 1.05, z: d / 2 - 0.5 })
  // striped awning
  for (let i = 0; i < 8; i++)
    p.add(box(w / 8 + 0.02, 0.08, d + 0.8), i % 2 ? '#ffffff' : '#f7c843', { x: -w / 2 + w / 16 + (i * w) / 8, y: 2.95, z: 0.2, rx: 0.18, jitter: 0 })
  // goods on the counter: honey, carrots, apples, milk
  for (let i = 0; i < 4; i++) {
    p.add(cyl(0.15, 0.15, 0.3, 8), '#f5b623', { x: -2.3 + i * 0.36, y: 1.25, z: d / 2 - 0.5, mat: GLOW })
    p.add(cyl(0.16, 0.16, 0.06, 8), '#e9e2d0', { x: -2.3 + i * 0.36, y: 1.42, z: d / 2 - 0.5 })
  }
  for (let i = 0; i < 5; i++) p.add(cone(0.06, 0.4, 5), '#ff8c2b', { x: -0.6 + i * 0.12, y: 1.15, z: d / 2 - 0.45, rz: Math.PI / 2 + (i % 2) * 0.2 })
  for (let i = 0; i < 6; i++) p.add(ico(0.12, 0), '#e8433a', { x: 0.6 + (i % 3) * 0.24, y: 1.2 + Math.floor(i / 3) * 0.15, z: d / 2 - 0.55 + (i % 2) * 0.1 })
  for (let i = 0; i < 3; i++) {
    p.add(cyl(0.1, 0.12, 0.35, 8), '#ffffff', { x: 1.8 + i * 0.28, y: 1.27, z: d / 2 - 0.5 })
    p.add(cyl(0.05, 0.05, 0.08, 6), '#4a90c8', { x: 1.8 + i * 0.28, y: 1.48, z: d / 2 - 0.5 })
  }
  // crates beside
  p.add(box(0.8, 0.6, 0.8), '#c89a5a', { x: w / 2 + 0.6, y: 0.3, z: d / 2 - 0.5 })
  for (let i = 0; i < 4; i++) p.add(ico(0.13, 0), '#e8433a', { x: w / 2 + 0.45 + (i % 2) * 0.3, y: 0.68, z: d / 2 - 0.65 + Math.floor(i / 2) * 0.3 })
  // a beehive sign on top
  p.add(ico(0.35, 1), '#f5b623', { y: 3.35, sy: 1.2 })
  for (let i = 0; i < 3; i++) p.add(torus(0.3 - i * 0.05, 0.035, 4, 10), '#c98a12', { y: 3.15 + i * 0.18, rx: Math.PI / 2 })
  return p.build()
}

export function bank() {
  const p = new Parts()
  const w = 7
  const d = 6
  const H = 3.6
  p.add(box(w + 1.2, 0.25, d + 1.6), '#d8d2c8', { y: 0.12, z: 0.3 })
  p.add(box(w + 0.6, 0.25, d + 1.0), '#e6e1d8', { y: 0.37, z: 0.2 })
  p.add(box(w, H, d), '#f4efe6', { y: H / 2 + 0.5, jitter: 0.02 })
  for (let i = 0; i < 4; i++) {
    const x = -w / 2 + 0.9 + (i * (w - 1.8)) / 3
    p.add(cyl(0.25, 0.28, H - 0.2, 10), '#ffffff', { x, y: H / 2 + 0.5, z: d / 2 + 0.6 })
    p.add(box(0.7, 0.18, 0.7), '#ffffff', { x, y: H + 0.4, z: d / 2 + 0.6 })
  }
  p.add(box(w + 0.4, 0.35, d + 1.6), '#e6e1d8', { y: H + 0.6, z: 0.3 })
  p.add(prism(w + 0.4, 1.2, d + 1.6), '#e6e1d8', { y: H + 0.78, z: 0.3 })
  roof(p, w + 0.4, d + 1.6, H + 0.78, 1.2, '#7f9fbf', 0.3)
  p.add(cyl(0.45, 0.45, 0.1, 14), '#f1c232', { y: H + 1.3, z: d / 2 + 1.12, rx: Math.PI / 2, mat: GLOW })
  p.add(box(1.4, 2.3, 0.12), '#5b6b80', { y: 1.65, z: d / 2 + 0.03 })
  windowAt(p, -2.3, 2.3, d / 2 + 0.03, 0, 0.8, 1.2)
  windowAt(p, 2.3, 2.3, d / 2 + 0.03, 0, 0.8, 1.2)
  return p.build()
}

export function toyShop() {
  const p = new Parts()
  const w = 7
  const d = 6
  const H = 3.2
  p.add(box(w + 0.3, 0.3, d + 0.3), '#d5cbbd', { y: 0.1 })
  p.add(box(w, H, d), '#ffe3ef', { y: H / 2 + 0.2, jitter: 0.03 })
  p.add(prism(w, 1.8, d), '#ffe3ef', { y: H + 0.2 })
  roof(p, w, d, H + 0.2, 1.8, '#7ec8e3')
  // big display window
  p.add(box(3.2, 1.7, 0.1), '#d7f0ff', { x: -1.5, y: 1.6, z: d / 2 + 0.03, mat: GLOW, jitter: 0 })
  p.add(box(3.4, 0.14, 0.2), '#ffffff', { x: -1.5, y: 0.72, z: d / 2 + 0.06 })
  p.add(box(3.4, 0.14, 0.2), '#ffffff', { x: -1.5, y: 2.48, z: d / 2 + 0.06 })
  // the Super Bright Bulb in the window (a clue!)
  p.add(ico(0.42, 1), '#fff6b0', { x: -1.0, y: 1.75, z: d / 2 + 0.35, mat: GLOW, jitter: 0 })
  p.add(cyl(0.18, 0.2, 0.3, 8), '#b0b0b0', { x: -1.0, y: 1.2, z: d / 2 + 0.35 })
  // toys in the window
  p.add(ico(0.22, 1), '#ff5d5d', { x: -2.4, y: 1.0, z: d / 2 + 0.3 })
  p.add(box(0.4, 0.4, 0.4), '#5bc0eb', { x: -1.9, y: 0.95, z: d / 2 + 0.3, ry: 0.5 })
  p.add(ico(0.2, 1), '#c9a27a', { x: -2.4, y: 1.45, z: d / 2 + 0.3 })
  // door with a star
  p.add(box(1.2, 2.1, 0.12), '#ff8fb1', { x: 1.9, y: 1.25, z: d / 2 + 0.03 })
  p.add(ico(0.18, 0), '#ffd23f', { x: 1.9, y: 1.7, z: d / 2 + 0.12 })
  // colorful pennants
  for (let i = 0; i < 9; i++)
    p.add(cone(0.16, 0.32, 3), ['#ff5d5d', '#ffd23f', '#5bc0eb', '#7bd389', '#c38bff'][i % 5], { x: -w / 2 + 0.4 + i * 0.78, y: H + 0.05, z: d / 2 + 0.2, rx: Math.PI, jitter: 0 })
  // giant teddy bear on the roof corner
  p.add(ico(0.55, 1), '#c9a27a', { x: 2.4, y: H + 1.2, z: 1.2 })
  p.add(ico(0.4, 1), '#c9a27a', { x: 2.4, y: H + 1.95, z: 1.25 })
  for (const s of [-1, 1]) p.add(ico(0.15, 1), '#c9a27a', { x: 2.4 + s * 0.3, y: H + 2.3, z: 1.25 })
  return p.build()
}

// The lighthouse: tower, lantern room (glows at night) and refs for the lamp and beam.
export function lighthouse() {
  const g = new THREE.Group()
  const p = new Parts()
  p.add(cyl(3.0, 3.3, 0.6, 12), '#bdb6aa', { y: 0.3 })
  const bands = 6
  const h = 2.3
  for (let i = 0; i < bands; i++) {
    const r0 = 2.4 - i * 0.22
    const r1 = 2.4 - (i + 1) * 0.22
    p.add(cyl(r1, r0, h, 12), i % 2 ? '#e94b3c' : '#ffffff', { y: 0.6 + h * i + h / 2, jitter: 0.02 })
  }
  const top = 0.6 + h * bands
  p.add(cyl(1.9, 1.7, 0.3, 12), '#3a3a46', { y: top + 0.15 })
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    p.add(box(0.06, 0.7, 0.06), '#3a3a46', { x: Math.cos(a) * 1.8, y: top + 0.6, z: Math.sin(a) * 1.8 })
  }
  p.add(torus(1.8, 0.05, 4, 20), '#3a3a46', { y: top + 0.95, rx: Math.PI / 2 })
  p.add(cyl(1.1, 1.1, 1.6, 10), '#cfeeff', { y: top + 1.1, mat: GLOW, jitter: 0 })
  p.add(cone(1.4, 1.2, 10), '#e94b3c', { y: top + 2.5 })
  p.add(ico(0.2, 0), '#3a3a46', { y: top + 3.2 })
  p.add(box(1.2, 2.0, 0.3), '#2f5b86', { y: 1.6, z: 2.32 })
  for (let i = 0; i < 3; i++) windowAt(p, 0, 4 + i * 4, 2.15 - i * 0.66, 0, 0.5, 0.7)
  g.add(p.build())
  const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshBasicMaterial({ color: 0x8a8a70 }))
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

export function pier(len, width) {
  const p = new Parts()
  for (let z = 0; z < len; z += 0.9)
    p.add(box(width, 0.16, 0.82), (Math.floor(z / 0.9) % 2 ? '#b98a5e' : '#c99a6a'), { y: -0.08, z: z + 0.41, jitter: 0.04 })
  for (let z = 0; z <= len; z += 3)
    for (const s of [-1, 1]) {
      p.add(cyl(0.18, 0.2, 3.2, 6), '#7d5634', { x: s * (width / 2 - 0.1), y: -1.5, z })
      p.add(cyl(0.2, 0.2, 0.3, 6), '#7d5634', { x: s * (width / 2 - 0.1), y: 0.2, z })
    }
  // rope rails
  for (const s of [-1, 1]) p.add(box(0.05, 0.05, len), '#e8d9b0', { x: s * (width / 2 - 0.1), y: 0.3, z: len / 2, jitter: 0 })
  return p.build({ receive: true })
}

export function boat() {
  const g = new THREE.Group()
  const p = new Parts()
  // hull: tapered stack
  p.add(box(2.6, 1.0, 5.2), '#e8584a', { y: 0.5 })
  p.add(box(2.66, 0.18, 5.26), '#ffffff', { y: 0.95 })
  p.add(prism(1.0, 1.4, 2.6), '#e8584a', { y: 0.5, z: 2.6, rz: Math.PI / 2, ry: Math.PI / 2 })
  p.add(prism(0.18, 1.42, 2.66), '#ffffff', { y: 0.95, z: 2.6, rz: Math.PI / 2, ry: Math.PI / 2 })
  p.add(box(2.4, 0.08, 5.0), '#c99a6a', { y: 1.05 })
  p.add(box(1.8, 1.4, 1.8), '#ffffff', { y: 1.8, z: -1.0 })
  p.add(box(2.0, 0.15, 2.0), '#2b4c8c', { y: 2.55, z: -1.0 })
  for (const s of [-1, 1]) p.add(box(0.08, 0.5, 0.9), '#bfe3ff', { x: s * 0.92, y: 1.95, z: -1.0, mat: GLOW, jitter: 0 })
  p.add(cyl(0.08, 0.1, 4.2, 6), '#7d5634', { y: 3.2, z: 0.9 })
  p.add(prism(0.05, 0.9, 0.55), '#ffd23f', { y: 5.0, z: 0.9, rx: -Math.PI / 2 })
  p.add(torus(0.35, 0.1, 6, 12), '#ffffff', { x: 1.34, y: 1.5, z: -1.0, ry: Math.PI / 2 })
  g.add(p.build())
  return g
}

export function well() {
  const p = new Parts()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    p.add(box(0.75, 0.9, 0.42), i % 2 ? '#b7b0a6' : '#a59e94', { x: Math.cos(a) * 1.05, y: 0.45, z: Math.sin(a) * 1.05, ry: -a + Math.PI / 2, jitter: 0.06 })
  }
  p.add(cyl(0.95, 0.95, 0.05, 12), '#4fb7e0', { y: 0.7 })
  for (const s of [-1, 1]) p.add(box(0.18, 2.2, 0.18), '#8b5a2b', { x: s * 1.15, y: 1.1 })
  p.add(cyl(0.08, 0.08, 2.5, 6), '#7d5634', { y: 1.9, rz: Math.PI / 2 })
  p.add(prism(2.9, 0.9, 1.9), '#f0705f', { y: 2.2 })
  p.add(cyl(0.2, 0.17, 0.3, 8), '#8b5a2b', { y: 1.3 })
  return p.build()
}

export function spring() {
  const p = new Parts()
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    p.add(ico(0.55 + (i % 3) * 0.12, 0), i % 2 ? '#9a958e' : '#b1aca4', { x: Math.cos(a) * 0.95, y: 0.25, z: Math.sin(a) * 0.95, jitter: 0.08 })
  }
  p.add(cyl(0.9, 0.9, 0.08, 10), '#5cc8ea', { y: 0.35 })
  p.add(ico(0.8, 0), '#9a958e', { y: 0.9, z: -1.0, sy: 1.4 })
  p.add(cyl(0.07, 0.07, 0.7, 5), '#7fd7f0', { y: 0.75, z: -0.5, rx: 0.35, mat: GLOW, jitter: 0 })
  return p.build()
}

export function fountain() {
  const p = new Parts()
  p.add(cyl(1.3, 1.4, 0.6, 12), '#d9d2c5', { y: 0.3 })
  p.add(cyl(1.1, 1.1, 0.05, 12), '#5cc8ea', { y: 0.58 })
  p.add(cyl(0.25, 0.3, 1.4, 8), '#d9d2c5', { y: 1.0 })
  p.add(cyl(0.6, 0.4, 0.2, 10), '#d9d2c5', { y: 1.7 })
  p.add(cone(0.2, 0.6, 6), '#9fe3f7', { y: 2.1, mat: GLOW, jitter: 0 })
  return p.build()
}

export function bench() {
  const p = new Parts()
  p.add(box(2.0, 0.12, 0.6), '#c48a52', { y: 0.55 })
  p.add(box(2.0, 0.5, 0.1), '#c48a52', { y: 0.9, z: -0.3, rx: -0.15 })
  for (const s of [-1, 1]) {
    p.add(box(0.1, 0.55, 0.5), '#5f5f68', { x: s * 0.85, y: 0.27 })
    p.add(box(0.1, 0.7, 0.1), '#5f5f68', { x: s * 0.85, y: 0.8, z: -0.3 })
  }
  return p.build()
}

export function appleTree() {
  const g = new THREE.Group()
  const p = new Parts()
  p.add(cyl(0.22, 0.32, 2.2, 6), '#8b5a2b', { y: 1.1 })
  p.add(ico(1.5, 1), '#5fb64a', { y: 2.9, sx: 1.1 })
  p.add(ico(1.0, 1), '#6cc456', { x: 0.9, y: 2.6, z: 0.4 })
  p.add(ico(1.0, 1), '#58ab45', { x: -0.8, y: 2.7, z: -0.4 })
  g.add(p.build())
  const ap = new Parts()
  const spots = [[0.9, 2.3, 1.1], [-1.0, 2.5, 0.9], [0.2, 3.2, 1.45], [1.4, 3.0, -0.3], [-0.6, 2.2, -1.2], [-1.4, 3.1, 0.2]]
  for (const [x, y, z] of spots) {
    ap.add(ico(0.18, 1), '#e8433a', { x, y, z })
    ap.add(box(0.03, 0.1, 0.03), '#5a3a1a', { x, y: y + 0.2, z, jitter: 0 })
  }
  const apples = ap.build()
  g.add(apples)
  g.userData.fruit = apples
  return g
}

export function berryBush() {
  const g = new THREE.Group()
  const p = new Parts()
  p.add(ico(0.75, 1), '#4f9f45', { y: 0.55, sx: 1.25 })
  p.add(ico(0.55, 1), '#5aad4d', { x: 0.6, y: 0.45, z: 0.2 })
  p.add(ico(0.5, 1), '#4a9640', { x: -0.6, y: 0.45, z: -0.1 })
  g.add(p.build())
  const bp = new Parts()
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4
    const r = 0.75 + (i % 3) * 0.1
    bp.add(ico(0.09, 0), i % 3 ? '#4a4fc4' : '#7a3fb8', { x: Math.cos(a) * r, y: 0.5 + Math.sin(i * 1.7) * 0.25, z: Math.sin(a) * r * 0.75 })
  }
  const berries = bp.build()
  g.add(berries)
  g.userData.fruit = berries
  return g
}

export function carrotPatch() {
  const g = new THREE.Group()
  const p = new Parts()
  p.add(box(4.2, 0.2, 3.2), '#7a5233', { y: 0.05 })
  for (let r = 0; r < 3; r++) p.add(box(3.8, 0.14, 0.5), '#6a4529', { y: 0.18, z: -1 + r })
  g.add(p.build({ receive: true }))
  const cp = new Parts()
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 5; i++) {
      const x = -1.6 + i * 0.8
      const z = -1 + r
      cp.add(cone(0.1, 0.25, 4), '#ff8c2b', { x, y: 0.3, z })
      for (let k = 0; k < 3; k++) cp.add(cone(0.06, 0.45, 3), '#5fb64a', { x: x + (k - 1) * 0.06, y: 0.6, z, rz: (k - 1) * 0.4 })
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
  const g = new THREE.Group()
  const p = new Parts()
  p.add(cyl(0.12, 0.14, 3.3, 6), '#8b5a2b', { y: 1.65 })
  p.add(cone(0.18, 0.3, 6), '#8b5a2b', { y: 3.45 })
  g.add(p.build())
  boards.forEach((b, i) => {
    const arm = new THREE.Group()
    arm.position.y = 2.95 - i * 0.52
    arm.rotation.y = b.angle
    const bp = new Parts()
    bp.add(ARROW_BOARD, i % 2 ? '#d9a066' : '#e3b27a', { x: 0.1 })
    arm.add(bp.build())
    const tex = new THREE.CanvasTexture(textCanvas(b.text, { w: 320, h: 80, font: 'bold 44px Andika, sans-serif' }))
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true })
    for (const s of [1, -1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), mat)
      pl.position.set(0.95, 0, s * 0.045)
      if (s < 0) pl.rotation.y = Math.PI
      arm.add(pl)
    }
    g.add(arm)
  })
  return g
}

// A flat shop sign with words (reading practice).
export function shopSign(text, w, h, bg, fg = '#ffffff') {
  const cv = textCanvas(text, { w: 512, h: Math.round((512 * h) / w), font: `bold ${Math.round(((512 * h) / w) * 0.62)}px "Baloo 2", Andika, sans-serif`, fg, bg })
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex }))
  return m
}

// Pickups
export function shellMesh() {
  const p = new Parts()
  p.add(cone(0.22, 0.12, 7), '#ffd1dc', { rx: -Math.PI / 2 + 0.2, y: 0.08, sz: 1.3 })
  p.add(ico(0.06, 0), '#fff0f3', { y: 0.06, z: -0.12 })
  return p.build()
}
export function coinMesh() {
  const p = new Parts()
  p.add(cyl(0.28, 0.28, 0.07, 14), '#f5c542', { rx: Math.PI / 2, mat: GLOW, jitter: 0 })
  p.add(box(0.08, 0.26, 0.09), '#e0a92a', { jitter: 0 })
  return p.build()
}
export function glassesMesh() {
  const p = new Parts()
  for (const s of [-1, 1]) p.add(torus(0.16, 0.035, 5, 12), '#3a3030', { x: s * 0.2, rx: -Math.PI / 2 + 0.4, y: 0.06 })
  p.add(box(0.12, 0.03, 0.03), '#3a3030', { y: 0.12 })
  return p.build()
}
