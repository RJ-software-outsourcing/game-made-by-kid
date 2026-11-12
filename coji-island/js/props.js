// Buildings and objects. Each builder returns a Group whose door/front faces +z.
import * as THREE from 'three'
import { Parts, MAT, SMOOTH, GLOW, SHINE, box, cyl, cone, ico, sphere, torus, textCanvas } from './build.js'

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
// Two roof slabs over a gable, with tile rows and a ridge cap.
function roof(p, w, d, wallH, h, hex, over = 0.45) {
  const a = Math.atan2(h, d / 2)
  const L = Math.hypot(d / 2, h) + over
  const t = 0.18
  const dark = new THREE.Color(hex).multiplyScalar(0.82)
  for (const s of [1, -1]) {
    const nY = Math.cos(a) * (t / 2)
    const nZ = Math.sin(a) * (t / 2) * s
    p.add(box(w + over * 1.6, t, L), hex, { y: wallH + h / 2 + nY, z: (s * d) / 4 + nZ, rx: s * a, jitter: 0.03 })
    // tile rows
    for (let k = 1; k <= 4; k++) {
      const f = k / 5 - 0.5
      const yy = wallH + h / 2 - Math.sin(a) * f * L + Math.cos(a) * (t + 0.02)
      const zz = (s * d) / 4 + s * Math.cos(a) * f * L + Math.sin(a) * (t + 0.02) * s
      p.add(box(w + over * 1.6, 0.05, 0.08), dark, { y: yy, z: zz, rx: s * a, jitter: 0 })
    }
  }
  p.add(cyl(0.16, 0.16, w + over * 1.6 + 0.05, 8), dark, { y: wallH + h + 0.12, rz: Math.PI / 2, jitter: 0 })
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
  p.add(box(0.72, 0.12, 0.72), '#8e4c37', { x: w / 4, y: H + 2.25, z: -d / 5 })
  // door frame, shutters, porch lamp and a mailbox
  p.add(box(1.3, 0.12, 0.16), '#ffffff', { y: 2.15, z: d / 2 + 0.05, jitter: 0 })
  for (const s of [-1, 1]) {
    p.add(box(0.12, 2.0, 0.16), '#ffffff', { x: s * 0.6, y: 1.15, z: d / 2 + 0.05, jitter: 0 })
    for (const k of [-1, 1]) p.add(box(0.28, 0.9, 0.06), new THREE.Color(rf).multiplyScalar(0.9), { x: s * 1.65 + k * 0.62, y: 1.9, z: d / 2 + 0.08, jitter: 0 })
  }
  p.add(ico(0.12, 1), '#fff2b0', { x: -0.85, y: 2.0, z: d / 2 + 0.16, mat: GLOW, jitter: 0 })
  p.add(cyl(0.05, 0.05, 1.0, 6), '#6b4a2b', { x: 1.6, y: 0.5, z: d / 2 + 1.4 })
  p.add(box(0.36, 0.3, 0.5), '#3b7dd8', { x: 1.6, y: 1.1, z: d / 2 + 1.4 })
  p.add(box(0.05, 0.22, 0.12), '#e94b3c', { x: 1.8, y: 1.3, z: d / 2 + 1.5 })
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
  // giant burger on the back of the roof, so the sign in front stays readable
  const y0 = H + 0.5
  const bz = -1.6
  p.add(sphere(1.3, 16, 8, 0, Math.PI / 2), '#e8a33d', { y: y0 + 1.0, z: bz, sy: 0.75 })
  p.add(cyl(1.35, 1.35, 0.15, 16), '#6ec43f', { y: y0 + 0.95, z: bz })
  p.add(cyl(1.25, 1.25, 0.12, 16), '#ffd23f', { y: y0 + 0.82, z: bz })
  p.add(cyl(1.28, 1.28, 0.38, 16), '#7a3e1f', { y: y0 + 0.6, z: bz })
  p.add(cyl(1.25, 1.2, 0.38, 16), '#e8a33d', { y: y0 + 0.22, z: bz })
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9
    p.add(ico(0.06, 0), '#fff5d6', { x: Math.cos(a) * 0.7, y: y0 + 1.75, z: bz + Math.sin(a) * 0.7, jitter: 0 })
  }
  // sign board standing on the front edge of the roof
  p.add(box(5.0, 1.05, 0.14), '#ffffff', { y: H + 1.05, z: d / 2 + 0.3 })
  for (const s of [-1, 1]) p.add(box(0.12, 0.6, 0.12), '#ffffff', { x: s * 2.0, y: H + 0.45, z: d / 2 + 0.3 })
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

// ---------- ring road buildings ----------

export function postOffice() {
  const p = new Parts()
  const w = 7
  const d = 6
  const H = 3.0
  p.add(box(w + 0.3, 0.3, d + 0.3), '#cfc6b3', { y: 0.1 })
  p.add(box(w, H, d), '#fdf0e0', { y: H / 2 + 0.2, jitter: 0.03 })
  p.add(box(w + 0.05, 0.35, d + 0.05), '#3b7dd8', { y: 0.55 })
  p.add(prism(w, 1.7, d), '#fdf0e0', { y: H + 0.2 })
  roof(p, w, d, H + 0.2, 1.7, '#e94b3c')
  p.add(box(1.3, 2.1, 0.12), '#3b7dd8', { y: 1.25, z: d / 2 + 0.03 })
  windowAt(p, -2.2, 1.9, d / 2 + 0.03)
  windowAt(p, 2.2, 1.9, d / 2 + 0.03)
  // big red mailbox and a stack of parcels
  p.add(cyl(0.45, 0.45, 1.3, 14), '#e94b3c', { x: 2.6, y: 0.85, z: d / 2 + 1.5 })
  p.add(sphere(0.45, 14, 6, 0, Math.PI / 2), '#e94b3c', { x: 2.6, y: 1.5, z: d / 2 + 1.5 })
  p.add(box(0.5, 0.08, 0.1), '#2b2b2b', { x: 2.6, y: 1.2, z: d / 2 + 1.95, jitter: 0 })
  for (let i = 0; i < 3; i++) p.add(box(0.7 - i * 0.12, 0.45, 0.6 - i * 0.1), '#c89a5a', { x: -2.6, y: 0.45 + i * 0.45, z: d / 2 + 1.0, ry: i * 0.3 })
  // envelope on the roof
  p.add(box(1.5, 1.0, 0.12), '#ffffff', { y: H + 2.4, z: 0.2 })
  p.add(prism(0.13, 0.5, 1.5), '#f0e2c8', { y: H + 2.4, z: 0.28, rx: Math.PI / 2, ry: Math.PI / 2 })
  return p.build()
}

export function school() {
  const g = new THREE.Group()
  const p = new Parts()
  const w = 10
  const d = 6.5
  const H = 3.4
  p.add(box(w + 0.3, 0.3, d + 0.3), '#cfc6b3', { y: 0.1 })
  p.add(box(w, H, d), '#fff4d6', { y: H / 2 + 0.2, jitter: 0.03 })
  p.add(prism(w, 2.0, d), '#fff4d6', { y: H + 0.2 })
  roof(p, w, d, H + 0.2, 2.0, '#3b7dd8')
  p.add(box(1.0, 2.2, 0.12), '#8b5a2b', { x: -0.55, y: 1.3, z: d / 2 + 0.03 })
  p.add(box(1.0, 2.2, 0.12), '#8b5a2b', { x: 0.55, y: 1.3, z: d / 2 + 0.03 })
  for (const x of [-3.6, -2.0, 2.0, 3.6]) windowAt(p, x, 2.0, d / 2 + 0.03, 0, 1.0, 1.0)
  p.add(box(2.6, 0.15, 0.9), '#cfc6b3', { y: 0.3, z: d / 2 + 0.55 })
  // clock on the gable
  p.add(cyl(0.5, 0.5, 0.08, 18), '#ffffff', { y: H + 0.95, z: d / 2 + 0.06, rx: Math.PI / 2 })
  p.add(box(0.05, 0.36, 0.04), '#333333', { y: H + 1.08, z: d / 2 + 0.12, jitter: 0 })
  p.add(box(0.26, 0.05, 0.04), '#333333', { x: 0.1, y: H + 0.95, z: d / 2 + 0.12, jitter: 0 })
  // bell tower
  p.add(box(1.4, 1.4, 1.4), '#fff4d6', { y: H + 2.6, z: -0.6 })
  p.add(cone(1.2, 1.4, 4), '#e94b3c', { y: H + 4.0, z: -0.6, ry: Math.PI / 4 })
  p.add(sphere(0.32, 12, 8, 0, Math.PI / 1.6), '#f1c232', { y: H + 2.75, z: 0.12 })
  // flag pole
  p.add(cyl(0.06, 0.06, 5.5, 6), '#cccccc', { x: w / 2 + 1.4, y: 2.75, z: d / 2 + 0.8 })
  p.add(box(1.1, 0.7, 0.03), '#3b7dd8', { x: w / 2 + 1.95, y: 5.0, z: d / 2 + 0.8 })
  p.add(ico(0.12, 0), '#f1c232', { x: w / 2 + 1.95, y: 5.0, z: d / 2 + 0.83, jitter: 0 })
  // a swing
  for (const s of [-1, 1]) p.add(cyl(0.08, 0.08, 2.6, 6), '#e94b3c', { x: -w / 2 - 2 + s * 1.1, y: 1.3, z: d / 2 + 1.5 })
  p.add(cyl(0.07, 0.07, 2.4, 6), '#e94b3c', { x: -w / 2 - 2, y: 2.6, z: d / 2 + 1.5, rz: Math.PI / 2 })
  for (const s of [-1, 1]) p.add(box(0.03, 1.8, 0.03), '#888888', { x: -w / 2 - 2 + s * 0.3, y: 1.7, z: d / 2 + 1.5, jitter: 0 })
  p.add(box(0.8, 0.08, 0.35), '#ffd23f', { x: -w / 2 - 2, y: 0.8, z: d / 2 + 1.5 })
  g.add(p.build())
  return g
}

export function iceCreamStand() {
  const p = new Parts()
  const w = 4.5
  const d = 3.6
  p.add(box(w, 1.1, 0.4), '#ffffff', { y: 0.55, z: d / 2 - 0.2 })
  for (let i = 0; i < 6; i++) p.add(box(w / 6 - 0.04, 1.0, 0.05), i % 2 ? '#ff8fb1' : '#ffffff', { x: -w / 2 + w / 12 + (i * w) / 6, y: 0.55, z: d / 2 + 0.02, jitter: 0 })
  p.add(box(w + 0.1, 0.12, 0.6), '#9be7ff', { y: 1.16, z: d / 2 - 0.15 })
  p.add(box(w, 2.6, 0.2), '#ffffff', { y: 1.3, z: -d / 2 + 0.1 })
  for (const s of [-1, 1]) p.add(box(0.2, 2.6, d), '#ffffff', { x: (s * (w - 0.2)) / 2, y: 1.3 })
  // ice cream tubs in the counter
  const flav = ['#ff8fb1', '#7a4a2a', '#fff6dc', '#b6ef8a', '#ffe066']
  for (let i = 0; i < 5; i++) p.add(ico(0.18, 1), flav[i], { x: -1.6 + i * 0.8, y: 1.28, z: d / 2 - 0.15, sy: 0.6, jitter: 0 })
  // striped canopy
  for (let i = 0; i < 8; i++) p.add(box(w / 8 + 0.02, 0.08, 2.0), i % 2 ? '#ffffff' : '#ff8fb1', { x: -w / 2 + w / 16 + (i * w) / 8, y: 2.75, z: d / 2 - 0.2, rx: 0.22, jitter: 0 })
  p.add(box(w + 0.2, 0.25, d + 0.2), '#ff8fb1', { y: 2.7, z: -0.3 })
  // giant cone on top
  p.add(cone(0.55, 1.5, 12), '#e8b26a', { y: 3.55, rx: Math.PI })
  p.add(ico(0.62, 2), '#ff8fb1', { y: 4.45, mat: SMOOTH })
  p.add(ico(0.52, 2), '#fff6dc', { y: 5.05, mat: SMOOTH })
  p.add(ico(0.4, 2), '#7a4a2a', { y: 5.55, mat: SMOOTH })
  p.add(ico(0.12, 1), '#e94b3c', { y: 5.95, mat: SMOOTH })
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
  const merlons = (x0, z0, x1, z1, y) => {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.floor(len / 1.1)
    const ry = Math.atan2(x1 - x0, z1 - z0)
    for (let i = 0; i <= n; i++) {
      const t = i / n
      p.add(box(0.6, 0.65, 0.6), STONE2, { x: x0 + (x1 - x0) * t, y: y + 0.32, z: z0 + (z1 - z0) * t, ry, jitter: 0.04 })
    }
  }
  // walls (the front one has the gate opening)
  p.add(box(2 * h, W, T), STONE, { y: W / 2, z: -h, jitter: 0.04 })
  for (const s of [-1, 1]) p.add(box(T, W, 2 * h), STONE, { x: s * h, y: W / 2, jitter: 0.04 })
  for (const s of [-1, 1]) p.add(box(h - 2, W, T), STONE, { x: s * (h / 2 + 1), y: W / 2, z: h, jitter: 0.04 })
  p.add(box(4.4, 1.6, T + 0.2), STONE, { y: W - 0.8, z: h })
  merlons(-h + 1.8, -h, h - 1.8, -h, W)
  merlons(-h + 1.8, h, -2.4, h, W)
  merlons(2.4, h, h - 1.8, h, W)
  for (const s of [-1, 1]) merlons(s * h, -h + 1.8, s * h, h - 1.8, W)
  p.add(box(2 * h + 0.3, 0.5, 2 * h + 0.3), '#cfc6b3', { y: 0.2 })
  // the gate: closed wooden doors under an arch, with a portcullis
  p.add(box(3.4, 3.3, 0.3), '#7a4e27', { y: 1.65, z: h + 0.05 })
  p.add(box(0.08, 3.3, 0.34), '#5a3a1a', { y: 1.65, z: h + 0.08, jitter: 0 })
  for (let i = 0; i < 4; i++) p.add(box(3.4, 0.1, 0.36), '#4a4a52', { y: 0.5 + i * 0.85, z: h + 0.12, jitter: 0 })
  p.add(torus(1.75, 0.25, 6, 16, Math.PI), STONE2, { y: 3.3, z: h + 0.35 })
  p.add(ico(0.3, 1), GOLD, { y: 4.4, z: h + 0.62, sz: 0.5 })
  // gate towers
  for (const s of [-1, 1]) {
    p.add(cyl(1.45, 1.6, 7, 14), STONE, { x: s * 3.1, y: 3.5, z: h + 0.4, jitter: 0.03 })
    p.add(cone(1.85, 2.4, 14), ROYAL, { x: s * 3.1, y: 8.2, z: h + 0.4 })
    windowAt(p, s * 3.1, 4.8, h + 1.95, 0, 0.45, 0.8)
  }
  // corner towers
  const flags = []
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * h
      const z = sz * h
      p.add(cyl(2.3, 2.5, 8.5, 16), STONE, { x, y: 4.25, z, jitter: 0.03 })
      p.add(cyl(2.7, 2.6, 0.7, 16), STONE2, { x, y: 8.6, z })
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        p.add(box(0.5, 0.6, 0.5), STONE2, { x: x + Math.cos(a) * 2.45, y: 9.25, z: z + Math.sin(a) * 2.45, ry: -a })
      }
      p.add(cone(2.8, 3.8, 16), ROYAL, { x, y: 10.9, z })
      p.add(cyl(0.05, 0.05, 2.0, 5), '#888888', { x, y: 13.6, z })
      for (const y of [3.5, 6.0]) windowAt(p, x + sx * 0.2 * 0, y, z + 2.45, 0, 0.45, 0.8)
      const fp = new Parts()
      fp.add(prism(0.04, 1.3, 0.7), sx === sz ? '#e94b3c' : GOLD, { x: 0.65, y: 0, z: 0, rz: -Math.PI / 2, jitter: 0 })
      const flag = fp.build({ shadow: false })
      flag.position.set(x, 14.2, z)
      flags.push(flag)
      g.add(flag)
    }
  // the keep
  const kz = -2
  p.add(box(9, 8.5, 7.5), STONE, { y: 4.25, z: kz, jitter: 0.03 })
  p.add(box(9.4, 0.5, 7.9), STONE2, { y: 8.6, z: kz })
  p.add(cone(6.6, 4.6, 4), ROYAL, { y: 11.1, z: kz, ry: Math.PI / 4, sz: 0.85 })
  p.add(cyl(0.06, 0.06, 2.2, 5), '#888888', { y: 14.4, z: kz })
  const kflag = new Parts()
  kflag.add(prism(0.04, 1.6, 0.9), GOLD, { x: 0.8, rz: -Math.PI / 2, jitter: 0 })
  const kf = kflag.build({ shadow: false })
  kf.position.set(0, 15.0, kz)
  flags.push(kf)
  g.add(kf)
  for (const x of [-3, 3]) for (const y of [3.0, 6.4]) windowAt(p, x, y, kz + 3.8, 0, 0.7, 1.1)
  // balcony where the King comes out
  const by = 5.6
  p.add(box(3.4, 0.3, 1.6), STONE2, { y: by, z: kz + 4.5 })
  p.add(box(3.4, 0.7, 0.15), STONE2, { y: by + 0.5, z: kz + 5.25 })
  for (const s of [-1, 1]) p.add(box(0.15, 0.7, 1.6), STONE2, { x: s * 1.65, y: by + 0.5, z: kz + 4.5 })
  p.add(box(1.4, 2.2, 0.15), '#7a4e27', { y: by + 1.25, z: kz + 3.78 })
  p.add(torus(0.7, 0.12, 5, 12, Math.PI), STONE2, { y: by + 2.35, z: kz + 3.82 })
  // royal banners with a crown
  for (const s of [-1, 1]) {
    p.add(box(1.1, 3.0, 0.08), ROYAL, { x: s * 3.0, y: 4.6, z: kz + 3.82 })
    p.add(prism(0.08, 0.5, 1.1), ROYAL, { x: s * 3.0, y: 3.1, z: kz + 3.82, rx: Math.PI, ry: Math.PI / 2 })
    p.add(cyl(0.3, 0.3, 0.06, 5), GOLD, { x: s * 3.0, y: 5.3, z: kz + 3.88, rx: Math.PI / 2, jitter: 0 })
  }
  // banner on each outer wall
  for (const s of [-1, 1]) {
    p.add(box(1.0, 2.2, 0.08), ROYAL, { x: s * (h / 2 + 1), y: 3.2, z: h + 0.65 })
    p.add(cyl(0.28, 0.28, 0.06, 5), GOLD, { x: s * (h / 2 + 1), y: 3.6, z: h + 0.71, rx: Math.PI / 2, jitter: 0 })
  }
  g.add(p.build())
  g.userData = { balcony: new THREE.Vector3(0, by + 0.15, kz + 4.6), flags }
  return g
}

// ---------- the spooky graveyard ----------

export function gravestone(type = 0) {
  const p = new Parts()
  const c = '#a19eae'
  if (type === 0) {
    p.add(box(0.9, 1.0, 0.25), c, { y: 0.55 })
    p.add(cyl(0.45, 0.45, 0.25, 12, false), c, { y: 1.05, rx: Math.PI / 2 })
  } else if (type === 1) {
    p.add(box(0.22, 1.5, 0.22), c, { y: 0.8 })
    p.add(box(0.8, 0.22, 0.22), c, { y: 1.15 })
  } else {
    p.add(box(1.0, 1.2, 0.3), c, { y: 0.6 })
    p.add(box(1.1, 0.15, 0.36), '#8f8c9c', { y: 1.25 })
  }
  p.add(box(1.2, 0.18, 0.5), '#8f8c9c', { y: 0.09 })
  p.add(ico(0.12, 0), '#6f8f5a', { x: 0.3, y: 0.3, z: 0.14, sz: 0.4 })
  p.add(ico(0.1, 0), '#6f8f5a', { x: -0.25, y: 0.75, z: 0.13, sz: 0.4 })
  p.add(sphere(0.55, 10, 4, 0, Math.PI / 2), '#5b4a3c', { z: 0.9, sx: 0.9, sy: 0.3, sz: 1.4 })
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
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    if (Math.abs(ang(a)) < gap) continue
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    p.add(box(0.07, 1.6, 0.07), iron, { x, y: 0.8, z, jitter: 0 })
    p.add(cone(0.08, 0.22, 4), iron, { x, y: 1.7, z, jitter: 0 })
    const a2 = ((i + 1) / n) * Math.PI * 2
    if (Math.abs(ang(a2)) < gap) continue
    const mx = (Math.sin(a) + Math.sin(a2)) * 0.5 * r
    const mz = (Math.cos(a) + Math.cos(a2)) * 0.5 * r
    const len = (Math.PI * 2 * r) / n
    for (const y of [0.45, 1.3]) p.add(box(0.05, 0.06, len), iron, { x: mx, y, z: mz, ry: (a + a2) / 2 + Math.PI / 2, jitter: 0 })
  }
  // gate pillars and an iron arch with the sign
  const gx = Math.sin(gateA) * r
  const gz = Math.cos(gateA) * r
  const cx = Math.cos(gateA)
  const sx = -Math.sin(gateA)
  for (const s of [-1, 1]) {
    const x = gx + cx * s * 2.6
    const z = gz + sx * s * 2.6
    p.add(box(0.8, 2.6, 0.8), '#8f8c9c', { x, y: 1.3, z, ry: gateA })
    p.add(box(1.0, 0.2, 1.0), '#7b7888', { x, y: 2.7, z, ry: gateA })
  }
  p.add(torus(2.6, 0.08, 4, 18, Math.PI), iron, { x: gx, y: 2.6, z: gz, ry: gateA })
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
  p.add(cyl(0.18, 0.32, 3.2, 7), c, { y: 1.6, rz: 0.08 })
  p.add(cyl(0.1, 0.16, 1.8, 6), c, { x: 0.55, y: 3.3, rz: -0.7 })
  p.add(cyl(0.08, 0.13, 1.6, 6), c, { x: -0.6, y: 3.0, rz: 0.8, ry: 0.5 })
  p.add(cyl(0.06, 0.1, 1.2, 5), c, { x: 0.1, y: 3.9, rz: 0.25 })
  p.add(cyl(0.05, 0.07, 0.8, 5), c, { x: 1.15, y: 3.95, rz: -1.2 })
  p.add(cyl(0.05, 0.07, 0.7, 5), c, { x: -1.15, y: 3.55, rz: 1.3 })
  return p.build()
}

export function pumpkin(s = 1) {
  const p = new Parts()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    p.add(ico(0.26 * s, 2), i % 2 ? '#ff8a1f' : '#f77a12', { x: Math.cos(a) * 0.12 * s, y: 0.24 * s, z: Math.sin(a) * 0.12 * s, sy: 0.85, mat: SMOOTH, jitter: 0 })
  }
  p.add(cyl(0.04 * s, 0.06 * s, 0.22 * s, 6), '#5d7a2b', { y: 0.5 * s, rz: 0.2 })
  return p.build()
}
export function pumpkinVine() {
  const p = new Parts()
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7
    p.add(ico(0.22, 1), '#4f8f3a', { x: Math.cos(a) * 0.45, y: 0.05, z: Math.sin(a) * 0.45, sy: 0.2, sx: 1.3 })
  }
  return p.build()
}

export function jackOLantern(s = 1) {
  const g = new THREE.Group()
  g.add(pumpkin(s * 1.2))
  const f = new Parts()
  const z = 0.36 * s
  for (const x of [-0.11, 0.11]) f.add(cone(0.07 * s, 0.1 * s, 3), '#ffd447', { x: x * s, y: 0.33 * s, z, rx: Math.PI / 2, mat: SHINE, jitter: 0 })
  f.add(box(0.26 * s, 0.06 * s, 0.04), '#ffd447', { y: 0.2 * s, z, mat: SHINE, jitter: 0 })
  g.add(f.build({ shadow: false }))
  return g
}

export function bat() {
  const g = new THREE.Group()
  const p = new Parts()
  p.add(ico(0.15, 1), '#2a2433', { sz: 1.3 })
  for (const s of [-1, 1]) p.add(cone(0.05, 0.12, 3), '#2a2433', { x: s * 0.07, y: 0.14 })
  g.add(p.build({ shadow: false }))
  const wings = []
  for (const s of [-1, 1]) {
    const wp = new Parts()
    wp.add(prism(0.02, 0.45, 0.35), '#2a2433', { x: s * 0.05, rz: (-s * Math.PI) / 2, jitter: 0 })
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
  p.add(cyl(0.09, 0.12, 0.32, 10), '#fff4e0', { y: 0.16, jitter: 0 })
  p.add(sphere(0.24, 14, 8, 0, Math.PI / 2), '#e94b3c', { y: 0.3, sy: 0.75, jitter: 0 })
  for (const [x, z] of [[0.08, 0.08], [-0.1, 0.03], [0.02, -0.12], [0.12, -0.05]]) p.add(sphere(0.035, 8, 6), '#ffffff', { x, y: 0.43, z, jitter: 0 })
  return p.build()
}

export function treasureChest() {
  const g = new THREE.Group()
  const p = new Parts()
  p.add(box(1.2, 0.6, 0.8), '#9a6232', { y: 0.3 })
  for (const x of [-0.45, 0.45]) p.add(box(0.1, 0.62, 0.82), '#f1c232', { x, y: 0.3, jitter: 0 })
  p.add(box(0.2, 0.2, 0.06), '#f1c232', { y: 0.5, z: 0.42, jitter: 0 })
  g.add(p.build())
  const lid = new THREE.Group()
  lid.position.set(0, 0.6, -0.4)
  const lp = new Parts()
  lp.add(cyl(0.4, 0.4, 1.2, 12, false), '#a86c38', { z: 0.4, rz: Math.PI / 2, sy: 1, sx: 1, jitter: 0.02 })
  for (const x of [-0.45, 0.45]) lp.add(cyl(0.41, 0.41, 0.1, 12), '#f1c232', { x, z: 0.4, rz: Math.PI / 2, jitter: 0 })
  lid.add(lp.build())
  g.add(lid)
  const gold = new Parts()
  for (let i = 0; i < 7; i++) gold.add(cyl(0.12, 0.12, 0.04, 10), '#f5c542', { x: -0.35 + i * 0.12, y: 0.62, z: (i % 3) * 0.1 - 0.1, rx: 0.3 * (i % 2), mat: GLOW, jitter: 0 })
  const coins = gold.build({ shadow: false })
  g.add(coins)
  g.userData = { lid, coins }
  return g
}

export function gazebo() {
  const p = new Parts()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    p.add(cyl(0.12, 0.12, 2.6, 8), '#ffffff', { x: Math.cos(a) * 2.2, y: 1.3, z: Math.sin(a) * 2.2 })
  }
  p.add(cyl(2.5, 2.5, 0.25, 6), '#f4ede0', { y: 0.12 })
  p.add(cone(3.0, 1.6, 6), '#ff8fb1', { y: 3.4 })
  p.add(sphere(0.18, 10, 8), '#ffd23f', { y: 4.3 })
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6
    p.add(ico(0.32, 1), ['#ff6b8a', '#ffd23f', '#b38bff'][i % 3], { x: Math.cos(a) * 2.3, y: 2.45, z: Math.sin(a) * 2.3, mat: SMOOTH })
  }
  // picnic blanket with a basket
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) p.add(box(0.45, 0.04, 0.45), (i + j) % 2 ? '#ffffff' : '#e94b3c', { x: -3.6 + i * 0.45, y: 0.03, z: -1.2 + j * 0.45, jitter: 0 })
  p.add(box(0.6, 0.35, 0.4), '#c48a52', { x: -3.0, y: 0.2, z: -0.5 })
  p.add(torus(0.22, 0.03, 4, 10, Math.PI), '#a8693f', { x: -3.0, y: 0.38, z: -0.5 })
  return p.build()
}

export function seaTurtle() {
  const g = new THREE.Group()
  const p = new Parts(SMOOTH)
  p.add(sphere(0.5, 16, 8, 0, Math.PI / 2), '#5c8a3a', { y: 0.12, sy: 0.6, sz: 1.2 })
  for (let i = 0; i < 5; i++) p.add(sphere(0.14, 8, 6, 0, Math.PI / 2), '#7aa84f', { x: (i % 3) * 0.2 - 0.2, y: 0.3, z: Math.floor(i / 3) * 0.3 - 0.1, sy: 0.4 })
  p.add(sphere(0.18, 12, 10), '#9cc977', { y: 0.18, z: 0.7 })
  for (const s of [-1, 1]) {
    p.add(sphere(0.04, 8, 6), '#1d1717', { x: s * 0.09, y: 0.24, z: 0.83, jitter: 0 })
    p.add(sphere(0.14, 10, 8), '#9cc977', { x: s * 0.45, y: 0.08, z: 0.35, sx: 1.4, sy: 0.3 })
    p.add(sphere(0.11, 10, 8), '#9cc977', { x: s * 0.38, y: 0.08, z: -0.4, sx: 1.3, sy: 0.3 })
  }
  g.add(p.build())
  return g
}
