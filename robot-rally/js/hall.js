import * as T from '../vendor/three.module.js'
import { createArenaShow, fountainBays, fountainRadius, projector } from './arena-show.js'

const TAU = Math.PI * 2
const sectorAngle = TAU / 8
// The portable two-row spectator benches in audience.js sit at r=6.57..6.81.
// Their feet end at -.3725 and their shadows at -.375.
const floorY = -0.385
const halfBay = Math.tan(Math.PI / 8)
const centerAngle = (i) => (i + 0.12) * sectorAngle
const stone = '#adac98',
  cream = '#d7ceb5',
  deep = '#304e4b'
const teal = '#54746b',
  steel = '#84978b',
  brass = '#b99a60'
const colorCache = new Map()
const tile = {
  glass: [0, 0, 512, 256],
  masonry: [512, 0, 512, 256],
  enamel: [0, 256, 512, 256],
  oak: [512, 256, 512, 256]
}
function plate(i) {
  return [(i % 2) * 512, 512 + Math.floor(i / 2) * 128, 512, 128]
}
function radial(angle, x, y, r) {
  return [Math.sin(angle) * r + Math.cos(angle) * x, y, Math.cos(angle) * r - Math.sin(angle) * x]
}

// One indexed mesh per finish, with one reusable section for the grandstands,
// windows and roof. Everything here is built once in court coordinates.
class Batch {
  constructor() {
    this.positions = []
    this.normals = []
    this.colors = []
    this.uv = []
    this.indices = []
  }
  quad(a, b, c, d, color, region) {
    let tint = colorCache.get(color)
    if (!tint) {
      tint = new T.Color(color)
      colorCache.set(color, tint)
    }
    const ax = b[0] - a[0],
      ay = b[1] - a[1],
      az = b[2] - a[2]
    const bx = c[0] - a[0],
      by = c[1] - a[1],
      bz = c[2] - a[2]
    const nx = ay * bz - az * by,
      ny = az * bx - ax * bz,
      nz = ax * by - ay * bx
    const length = Math.hypot(nx, ny, nz) || 1
    const first = this.positions.length / 3
    for (const point of d ? [a, b, c, d] : [a, b, c]) {
      this.positions.push(...point)
      this.normals.push(nx / length, ny / length, nz / length)
      this.colors.push(tint.r, tint.g, tint.b)
    }
    if (region) {
      // The inset isolates neighbouring materials at the atlas mip edges.
      const [x, y, w, h] = region
      const l = (x + 2) / 1024,
        r = (x + w - 2) / 1024
      const bottom = 1 - (y + h - 2) / 1024,
        top = 1 - (y + 2) / 1024
      this.uv.push(l, bottom, r, bottom, r, top, l, top)
    } else this.uv.push(0, 0, 1, 0, 1, 1, 0, 1)
    if (!d) this.uv.length -= 2
    this.indices.push(first, first + 1, first + 2)
    if (d) this.indices.push(first, first + 2, first + 3)
  }
  box(x, y, z, w, h, d, color) {
    const a = x - w / 2,
      b = x + w / 2,
      l = y - h / 2,
      u = y + h / 2,
      f = z - d / 2,
      k = z + d / 2
    this.quad([b, l, f], [a, l, f], [a, u, f], [b, u, f], color)
    this.quad([a, l, k], [b, l, k], [b, u, k], [a, u, k], color)
    this.quad([a, l, f], [a, l, k], [a, u, k], [a, u, f], color)
    this.quad([b, l, k], [b, l, f], [b, u, f], [b, u, k], color)
    this.quad([a, u, k], [b, u, k], [b, u, f], [a, u, f], color)
    this.quad([a, l, f], [b, l, f], [b, l, k], [a, l, k], color)
  }
  // A closed square or octagonal section joining arbitrary endpoints.
  beam(a, b, radius, color, sides = 4) {
    const dir = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize()
    const side = new T.Vector3()
      .crossVectors(dir, Math.abs(dir.y) > 0.96 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0))
      .normalize()
    const normal = new T.Vector3().crossVectors(dir, side)
    const start = [],
      end = []
    for (let j = 0; j < sides; j++) {
      const t = ((j + 0.5) * TAU) / sides
      const v = side
        .clone()
        .multiplyScalar(radius * Math.cos(t))
        .addScaledVector(normal, radius * Math.sin(t))
      start.push([a[0] + v.x, a[1] + v.y, a[2] + v.z])
      end.push([b[0] + v.x, b[1] + v.y, b[2] + v.z])
    }
    for (let j = 0; j < sides; j++) {
      const k = (j + 1) % sides
      this.quad(start[j], start[k], end[k], end[j], color)
    }
  }
  panel(x, y, z, width, height, region, color = '#ffffff') {
    const a = x - width / 2,
      b = x + width / 2,
      l = y - height / 2,
      u = y + height / 2
    this.quad([b, l, z], [a, l, z], [a, u, z], [b, u, z], color, region)
  }
  finish() {
    const g = new T.BufferGeometry()
    g.setAttribute('position', new T.Float32BufferAttribute(this.positions, 3))
    g.setAttribute(
      'normal',
      new T.Int16BufferAttribute(
        this.normals.map((n) => Math.round(n * 32767)),
        3,
        true
      )
    )
    g.setAttribute(
      'color',
      new T.Uint16BufferAttribute(
        this.colors.map((n) => Math.round(n * 65535)),
        3,
        true
      )
    )
    g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2))
    g.setIndex(this.indices)
    g.computeBoundingSphere()
    return g
  }
}

function strip(b, inner, outer, h, lower, color, face, trim = '#b1a184') {
  const a = inner * halfBay,
    z = outer * halfBay
  b.quad([-z, h, outer], [z, h, outer], [a, h, inner], [-a, h, inner], color)
  b.quad([a, lower, inner], [-a, lower, inner], [-a, h, inner], [a, h, inner], face)
  if (trim) b.box(0, h + 0.004, inner + 0.018, a * 2, 0.012, 0.045, trim)
}
function stand(rows, trim) {
  const tiers = [
    [7.36, 8.03, 0.005],
    [8.03, 8.72, 0.325],
    [8.72, 9.43, 0.654],
    [9.43, 10.15, 0.978],
    [10.15, 12.53, 1.24]
  ]
  let base = floorY
  for (let i = 0; i < tiers.length; i++) {
    const [r0, r1, y] = tiers[i]
    strip(rows, r0, r1, y, base, i % 2 ? '#a6afa3' : '#b2b8aa', i % 2 ? '#77847a' : '#869187')
    base = y
    if (i === 4) continue
    const radius = (r0 + r1) / 2 + 0.025
    const end = radius * halfBay - 0.48
    // A clear concrete aisle on either side of the seating bank. The wooden
    // seat boards and enamel backs sit on steel brackets above each tread.
    for (const s of [-1, 1]) {
      const width = end - 0.37,
        x = s * (0.37 + width / 2)
      rows.box(x, y + 0.112, radius, width, 0.069, 0.245, '#725d47')
      trim.quad(
        [x - width / 2, y + 0.149, radius + 0.123],
        [x + width / 2, y + 0.149, radius + 0.123],
        [x + width / 2, y + 0.149, radius - 0.123],
        [x - width / 2, y + 0.149, radius - 0.123],
        '#e0d2b4',
        tile.oak
      )
      for (const at of [x - width * 0.36, x + width * 0.36]) {
        rows.box(at, y + 0.063, radius, 0.052, 0.13, 0.18, deep)
        rows.box(at, y + 0.19, radius + 0.13, 0.038, 0.37, 0.042, steel)
      }
      rows.box(x, y + 0.268, radius + 0.145, width, 0.17, 0.052, i === 2 ? '#987657' : '#637c70')
      rows.box(x, y + 0.356, radius + 0.145, width, 0.012, 0.053, '#a3a791')
      // Expansion joint between the bentwood positions.
      const count = Math.max(3, Math.round(width / 0.49))
      for (let j = 1; j < count; j++)
        rows.box(x - width / 2 + (j * width) / count, y + 0.268, radius + 0.117, 0.016, 0.16, 0.005, '#536559')
    }
    // Half-steps climb the end aisle between the audience sections.
    for (const s of [-1, 1]) {
      const x = s * (radius * halfBay - 0.224)
      rows.box(x, y + 0.077, r0 + 0.49, 0.38, 0.152, 0.34, stone)
      rows.box(x, y + 0.157, r0 + 0.34, 0.36, 0.012, 0.035, '#d5bd82')
    }
  }
  for (const s of [-1, 1]) {
    // Handrail follows the rake. Posts are sunk into the actual concrete steps.
    for (const [r, y] of [
      [7.63, 0.005],
      [8.98, 0.654],
      [10.4, 1.24]
    ]) {
      const x = s * (r * halfBay - 0.041)
      rows.beam([x, y, r], [x, y + 0.49, r], 0.025, steel, 6)
    }
    rows.beam([s * (7.63 * halfBay - 0.041), 0.5, 7.63], [s * (10.4 * halfBay - 0.041), 1.735, 10.4], 0.032, steel, 6)
  }
  // Courtside barriers are lower than the spectators' eyes. The wide aisle
  // between barriers is continuous with the two entry ramps.
  rows.box(0, -0.201, 5.945, 2.21, 0.255, 0.14, '#334945')
  for (const x of [-0.76, 0, 0.76]) {
    rows.box(x, -0.189, 5.852, 0.63, 0.166, 0.077, '#3e5150')
    rows.box(x, -0.128, 5.81, 0.54, 0.018, 0.023, '#78847a')
  }
  for (const x of [-1.04, 1.04]) {
    rows.box(x, -0.174, 5.843, 0.087, 0.196, 0.071, '#bd954f')
    rows.box(x, -0.174, 5.801, 0.085, 0.041, 0.015, '#35433d')
  }
  for (const x of [-1.17, 0, 1.17]) {
    rows.box(x, -0.364, 5.956, 0.137, 0.039, 0.17, ironColor)
    rows.beam([x, -0.352, 5.956], [x, 0.169, 5.956], 0.031, steel, 8)
  }
  rows.beam([-1.25, 0.171, 5.956], [1.25, 0.171, 5.956], 0.037, '#a9b7a4', 8)
}
const ironColor = '#455b54'

function envelope(frame, surfaces, glass, bulbs) {
  const r = 12.6,
    w = r * halfBay
  // Lower concourse with a genuinely recessed service tunnel through the wall.
  for (const s of [-1, 1]) {
    const left = 1.01,
      right = w
    const x = (s * (left + right)) / 2,
      width = right - left
    frame.box(x, 1.39, r + 0.1, width, 3.57, 0.2, '#777d6b')
    surfaces.panel(x, 1.87, r - 0.012, width, 1.24, tile.enamel)
    surfaces.panel(x, 2.79, r - 0.013, width, 0.6, tile.masonry, '#e1dbc4')
  }
  frame.box(0, 3.235, r + 0.09, w * 2, 0.38, 0.22, '#7d8c79')
  frame.box(0, 2.185, r + 1.57, 1.96, 1.89, 0.11, '#40564f')
  surfaces.panel(0, 2.085, r + 1.505, 1.6, 1.58, tile.enamel, '#b9c9b7')
  frame.box(0, 1.218, r + 0.81, 2.08, 0.05, 1.74, '#a8aa94')
  frame.box(0, 3.086, r + 0.78, 2.11, 0.095, 1.6, '#7e806e')
  for (const s of [-1, 1]) {
    frame.box(s * 0.996, 2.157, r + 0.77, 0.067, 1.93, 1.62, '#87917c')
    frame.box(s * 1.03, 2.16, r - 0.025, 0.107, 1.95, 0.15, deep)
    frame.box(s * 0.364, 2.02, r + 1.43, 0.34, 0.016, 0.03, brass)
    bulbs.box(s * 0.86, 1.41, r + 0.61, 0.013, 0.053, 0.65, '#d8bd82')
  }
  for (const s of [-1, 1]) {
    frame.box(s * 1.114, 1.83, r - 0.125, 0.159, 1.03, 0.17, '#3c504e')
    frame.box(s * 1.114, 1.58, r - 0.22, 0.123, 0.061, 0.018, '#caa04e')
    frame.box(s * 1.114, 1.73, r - 0.22, 0.123, 0.061, 0.018, '#caa04e')
  }
  frame.box(0, 3.112, r - 0.035, 2.15, 0.11, 0.16, deep)
  frame.box(0, 1.291, r - 0.005, w * 2, 0.13, 0.32, '#596e63')
  frame.box(0, 2.488, r - 0.03, w * 2, 0.087, 0.15, '#a4ad93')
  frame.box(0, 3.455, r - 0.04, w * 2, 0.16, 0.26, deep)
  frame.box(0, 3.56, r - 0.1, w * 2, 0.05, 0.16, brass)

  // Glazed clerestory with deep reveals. Physical mullions, transoms and
  // corner columns cast a clear silhouette across individually tinted panes.
  const count = 9,
    bay = (2 * w) / count
  for (let i = 0; i < count; i++) {
    const x = -w + bay * (i + 0.5)
    glass.panel(x, 4.72, r + 0.026, bay - 0.022, 2.27, tile.glass, i % 3 === 0 ? '#476073' : '#354a61')
    frame.box(x - bay * 0.5, 4.73, r - 0.061, 0.041, 2.33, 0.13, '#617a70')
    frame.box(x, 4.284, r - 0.053, bay, 0.045, 0.102, '#70887c')
    frame.box(x, 5.426, r - 0.053, bay, 0.042, 0.102, '#70887c')
  }
  frame.box(0, 5.928, r - 0.02, 2 * w, 0.16, 0.39, deep)
  for (const x of [-w, -w / 3, w / 3]) {
    frame.box(x, 3.43, r - 0.18, 0.19, 5.91, 0.26, teal)
    frame.box(x, 1.54, r - 0.2, 0.31, 0.63, 0.37, deep)
    frame.box(x, 1.88, r - 0.2, 0.33, 0.075, 0.37, brass)
    frame.box(x, 5.73, r - 0.17, 0.37, 0.31, 0.47, deep)
    frame.beam([x, 4.86, r - 0.22], [x, 5.88, r - 0.98], 0.066, teal)
  }
  // The upper promenade has its own rail behind the last row, with open
  // door-width breaks at the aisle and brass-capped posts.
  for (const s of [-1, 1]) {
    const start = s * 0.47,
      end = s * (10.73 * halfBay - 0.2),
      y = 1.24,
      r0 = 10.73
    for (const x of [start, (start + end) / 2, end]) frame.beam([x, y, r0], [x, y + 0.66, r0], 0.031, teal, 6)
    for (const dy of [0.32, 0.66])
      frame.beam([start, y + dy, r0], [end, y + dy, r0], 0.034, dy > 0.5 ? brass : steel, 6)
  }
}

// Lathed speaker surrounds and projector optics face the ring. They share
// the existing instanced architecture draw and remain visible from free orbit.
function radialFace(batch, point, profile, sides) {
  for (let j = 1; j < profile.length; j++) {
    const [outer, front] = profile[j - 1], [inner, back, tint] = profile[j]
    for (let k = 0; k < sides; k++) {
      const a = k * TAU / sides, b = (k + 1) * TAU / sides
      const p = (r, d, ang) => point(Math.cos(ang) * r, Math.sin(ang) * r, d)
      if (inner === 0) batch.quad(p(outer, front, a), point(0, 0, back), p(outer, front, b), null, tint)
      else batch.quad(p(outer, front, a), p(inner, back, a), p(inner, back, b), p(outer, front, b), tint)
    }
  }
}

function speakerTower(frame, bulbs) {
  const x = projector.x, z = 7.37, face = z - 0.37
  frame.box(x, -0.30, z, 1.29, 0.17, 0.91, '#525d57')
  for (const y of [0.28, 1.24]) {
    frame.box(x, y, z, 1.17, 0.93, 0.70, '#303839')
    frame.box(x, y, face + 0.013, 1.045, 0.82, 0.032, '#192a2b')
    // The polymer roll, recessed fibre cone and metal dust cap have actual
    // relief, so the highlight changes as the ringside camera moves.
    radialFace(frame, (u, v, d) => [x + u, y + 0.01 + v, face - d],
      [[0.395, 0.002], [0.363, 0.035, '#718077'], [0.334, 0.047, '#242e31'],
        [0.301, 0.018, '#49514e'], [0.142, 0.009, '#5c625b'],
        [0.114, 0.034, '#242d2b'], [0.075, 0.069, '#7e7866'], [0, 0.079, '#9a8a70']], 24)
    for (const side of [-1, 1]) {
      frame.box(x + side * 0.523, y, face - 0.020, 0.031, 0.83, 0.071, '#788079')
      for (const t of [-1, 1]) {
        frame.box(x + side * 0.502, y + t * 0.404, face - 0.022, 0.10, 0.089, 0.077, '#8a8d80')
        frame.box(x + side * 0.585, y, z + t * 0.11, 0.025, 0.185, 0.045, '#152626')
      }
    }
  }
  frame.box(x, 1.881, z, 1.08, 0.33, 0.63, '#354342')
  frame.box(x, 1.887, z - 0.323, 0.79, 0.181, 0.04, '#142625')
  for (const offset of [-0.25, 0, 0.25])
    frame.box(x + offset, 1.883, z - 0.353, 0.018, 0.143, 0.059, '#52625b')
  bulbs.box(x + 0.452, 1.884, z - 0.321, 0.056, 0.037, 0.022, '#f6be71')

  const lens = (u, v, d) => [x + u, projector.y + v * 0.84 - d * 0.54, projector.z - v * 0.54 - d * 0.84]
  frame.box(x, 2.091, z - 0.04, 0.36, 0.10, 0.34, '#505d56')
  for (const side of [-1, 1]) {
    frame.beam([x + 0.10 * side, 2.12, z - 0.04], [x + 0.282 * side, 2.30, z - 0.04], 0.039, steel)
    frame.beam([x + 0.282 * side, 2.30, z - 0.04], lens(side * 0.28, 0, -0.20), 0.038, deep)
  }
  radialFace(frame, lens, [[0.075, -0.42], [0.183, -0.35, '#5e695e'], [0.231, -0.18, '#2b4543'],
    [0.251, -0.059, '#6a7971'], [0.246, 0.014, '#37443e'], [0.212, 0.031, '#b29973'],
    [0.184, 0.011, '#d8c480']], 24)
  radialFace(bulbs, lens, [[0.184, 0.011], [0.149, 0.029, '#f5d8a4'], [0.087, 0.038, '#ffebc2'],
    [0, 0.043, '#fff8e6']], 24)
}

function fountainHousing(frame, bay) {
  const p = (x, y, offset) => radial(centerAngle(bay), x, y, fountainRadius + offset)
  // Low, shielded event fixtures sit on the outer mat beyond the bumpers.
  const walls = [[-0.18, -0.16], [0.18, -0.16], [0.18, 0.16], [-0.18, 0.16]]
  for (let i = 0; i < 4; i++) {
    const [x, z] = walls[i], [nx, nz] = walls[(i + 1) % 4]
    frame.quad(p(x, floorY, z), p(x, -0.08, z), p(nx, -0.08, nz), p(nx, floorY, nz), '#34453e')
    frame.quad(p(x, -0.08, z), p(x * 0.86, -0.035, z * 0.86), p(nx * 0.86, -0.035, nz * 0.86),
      p(nx, -0.08, nz), '#a18a5d')
    frame.quad(p(x * 0.86, -0.035, z * 0.86), p(0, -0.035, 0), p(nx * 0.86, -0.035, nz * 0.86), null, '#586158')
  }
  frame.beam(p(0, -0.035, 0), p(0, -0.015, 0), 0.064, '#bd9f72', 12)
}

// A shielded sports flood sits on its own yoke below the timber roof.
// Its angled lenses point into the ring; the fins and visor stay solid in
// silhouette when an onboard camera looks toward the upper gallery.
function floodBank(frame, light) {
  const r = 6.06,
    y = 5.28
  const p = (x, v, d) => [x, y + 0.8 * v - 0.6 * d, r - 0.6 * v - 0.8 * d]
  const w = 0.53,
    h = 0.203
  const face = (width, height, depth) => [
    p(-width, -height, depth),
    p(-width, height, depth),
    p(width, height, depth),
    p(width, -height, depth)
  ]
  const back = face(w * 0.78, h * 0.76, -0.13),
    front = face(w, h, 0.115)
  for (let i = 0; i < 4; i++)
    frame.quad(front[i], front[(i + 1) % 4], back[(i + 1) % 4], back[i], i === 1 ? '#66786d' : '#354747')
  frame.quad(front[3], front[2], front[1], front[0], '#293b3b')
  for (const side of [-1, 1]) {
    frame.beam([side * 0.49, y + 0.17, r], [side * 0.57, y + 0.47, r + 0.09], 0.024, steel, 6)
    frame.beam([side * 0.57, y + 0.47, r + 0.09], [side * 0.57, 7.77, r + 0.09], 0.016, deep, 6)
  }
  frame.beam([-0.59, y + 0.48, r + 0.09], [0.59, y + 0.48, r + 0.09], 0.032, steel, 6)
  // Three separate frosted emitters and a protective top cowl.
  for (const x of [-0.307, 0, 0.307]) {
    light.quad(
      p(x + 0.126, -0.104, 0.125),
      p(x - 0.126, -0.104, 0.125),
      p(x - 0.126, 0.101, 0.125),
      p(x + 0.126, 0.101, 0.125),
      '#fff0cd'
    )
  }
  frame.quad(p(-w, h, 0.12), p(w, h, 0.12), p(w, h + 0.055, 0.38), p(-w, h + 0.055, 0.38), '#5c6e65')
}

function ceiling(frame, surfaces, light) {
  const radii = [12.78, 10.65, 8.35, 6.0, 3.47, 2.1]
  const height = [6.01, 6.86, 7.58, 8.11, 8.45, 8.56]
  for (let i = 0; i < radii.length - 1; i++) {
    const a = radii[i],
      b = radii[i + 1],
      ay = height[i],
      by = height[i + 1]
    // Four planked acoustic panels span each space between laminated ribs.
    for (let j = 0; j < 4; j++) {
      const u = -1 + j * 0.5,
        v = u + 0.5
      surfaces.quad(
        [u * a * halfBay, ay, a],
        [u * b * halfBay, by, b],
        [v * b * halfBay, by, b],
        [v * a * halfBay, ay, a],
        '#d7ceba',
        tile.oak
      )
      // The roof also has an exterior skin. A very wide orbit can look just
      // over an eave without opening a slit through a one-sided ceiling.
      surfaces.quad(
        [v * a * halfBay, ay + 0.085, a],
        [v * b * halfBay, by + 0.085, b],
        [u * b * halfBay, by + 0.085, b],
        [u * a * halfBay, ay + 0.085, a],
        '#a4aa94',
        tile.enamel
      )
    }
    for (const factor of [-1, 0]) {
      const a0 = [factor * a * halfBay, ay - 0.08, a],
        b0 = [factor * b * halfBay, by - 0.08, b]
      const a1 = [a0[0], ay - 0.59, a],
        b1 = [b0[0], by - 0.59, b]
      frame.beam(a0, b0, 0.104, deep)
      frame.beam(a1, b1, 0.074, teal)
      frame.beam(a1, b0, 0.051, steel)
      frame.beam(a0, a1, 0.055, brass)
    }
    frame.beam([-b * halfBay, by - 0.13, b], [b * halfBay, by - 0.13, b], 0.082, teal)
  }
  // Crown skylight closes the roof over the pitch; a dollhouse cutaway opens
  // only the obstructing roof when a bird's-eye camera rises above the rink.
  const b = radii.at(-1),
    y = height.at(-1)
  light.quad([-b * halfBay, y, b], [0, y + 0.32, 0], [b * halfBay, y, b], null, '#293749')
  frame.beam([-b * halfBay, y - 0.07, b], [0, y + 0.23, 0], 0.049, steel)
  floodBank(frame, light)
  // Pendant luminaires carry their own yokes, reflectors and frosted lenses.
  const rr = 7.64
  for (const x of [-1.63, 1.63]) {
    const y0 = 5.67
    frame.beam([x, y0 + 0.23, rr], [x, 7.47, rr], 0.019, deep, 6)
    frame.box(x, y0 + 0.24, rr, 0.25, 0.085, 0.19, deep)
    for (const s of [-1, 1]) frame.beam([x + s * 0.11, y0 + 0.22, rr], [x + s * 0.18, y0 + 0.02, rr], 0.021, teal, 6)
    const top = 0.16,
      bottom = 0.27,
      angle = Math.PI / 8
    for (let j = 0; j < 12; j++) {
      const a = (j * TAU) / 12 + angle,
        b = ((j + 1) * TAU) / 12 + angle
      const p = [x + Math.cos(a) * bottom, y0, rr + Math.sin(a) * bottom],
        q = [x + Math.cos(b) * bottom, y0, rr + Math.sin(b) * bottom]
      frame.quad(
        p,
        [x + Math.cos(a) * top, y0 + 0.122, rr + Math.sin(a) * top],
        [x + Math.cos(b) * top, y0 + 0.122, rr + Math.sin(b) * top],
        q,
        brass
      )
      light.quad(p, q, [x, y0 - 0.025, rr], null, '#ffe5ae')
    }
  }
}

// A host gym surrounds the low competition pavilion. From the boards it is
// hidden behind the clerestory. A long portrait orbit can see the service
// galleries and the higher steel roof behind the cutaway pavilion instead.
function serviceGallery(frame, panels) {
  const r = 27,
    span = r * halfBay
  for (let j = 0; j < 4; j++) {
    const x = (j - 1.5) * span * 0.5,
      w = span * 0.5
    panels.panel(x, 3.05, r, w, 6.88, tile.masonry, '#809386')
    panels.panel(x, 9.55, r, w, 6.2, tile.glass, '#b3c1b1')
    frame.box(x - w / 2, 6.13, r - 0.06, 0.14, 13.0, 0.25, '#54695e')
    frame.box(x, 6.48, r - 0.07, w, 0.19, 0.21, '#566c63')
    frame.box(x, 10.72, r - 0.07, w, 0.1, 0.13, '#738277')
  }
  const ridge = 18.7,
    eave = 12.63
  panels.quad([-span, eave, r], [0, ridge, 0], [span, eave, r], null, '#8e9985', tile.oak)
  frame.beam([-span, eave - 0.19, r], [0, ridge - 0.19, 0], 0.13, '#526659')
  for (const z of [15.4, 21.2, 27]) {
    const h = ridge + ((eave - ridge) * z) / r,
      edge = z * halfBay
    frame.beam([-edge, h - 0.23, z], [edge, h - 0.23, z], 0.114, '#66786a')
  }
}

function floorGeometry() {
  // Keep the original texel density at the court. Outside the concourse,
  // extend its concrete perimeter to the farthest camera's near field.
  const g = new T.BufferGeometry(),
    p = [],
    uv = [],
    idx = []
  const metres = [-43, -15, 15, 43],
    sample = [0.105, 0, 1, 0.895]
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 4; i++) {
      p.push(metres[i], floorY, metres[j])
      uv.push(sample[i], 1 - sample[j])
      if (i < 3 && j < 3) {
        const a = j * 4 + i
        idx.push(a, a + 4, a + 1, a + 1, a + 4, a + 5)
      }
    }
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3))
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function addRamp(fittings, a) {
  const p = (x, y, r) => radial(a, x, y, r)
  const crest = 4.245,
    foot = 5.48,
    half = 0.55,
    top = -0.015
  fittings.quad(
    p(-half, floorY + 0.012, foot),
    p(half, floorY + 0.012, foot),
    p(half, top, crest),
    p(-half, top, crest),
    '#798875'
  )
  for (const s of [-1, 1]) {
    fittings.beam(p(s * half, floorY + 0.026, foot), p(s * half, top + 0.015, crest), 0.028, brass, 6)
    fittings.quad(
      p(s * half, floorY, crest),
      p(s * half, top, crest),
      p(s * half, floorY + 0.011, foot),
      p(s * half, floorY, foot),
      deep
    )
  }
  for (let j = 1; j < 10; j++) {
    const u = j / 10,
      r = crest + (foot - crest) * u,
      y = top + (floorY + 0.012 - top) * u + 0.004
    fittings.beam(p(-half + 0.045, y, r), p(half - 0.045, y, r), 0.011, '#596b62', 4)
  }
}

function courtsideMats(fittings) {
  const count = 20
  for (let i = 0; i < count; i++) {
    const angle = (i * TAU) / count,
      angularGap = 0.012
    // The two opposite pit entrances occupy a whole mat bay.
    if (i === 6 || i === 16) continue
    const a = angle - Math.PI / count + angularGap,
      b = angle + Math.PI / count - angularGap
    const point = (rad, az, y) => radial(az, 0, y, rad)
    const inner = 4.11,
      outer = 4.79,
      y = -0.332
    const tint = i % 3 === 0 ? '#75887d' : '#73847b'
    for (let j = 0; j < 4; j++) {
      const s = a + ((b - a) * j) / 4,
        e = a + ((b - a) * (j + 1)) / 4
      fittings.quad(point(outer, s, y), point(outer, e, y), point(inner, e, y), point(inner, s, y), tint)
      fittings.quad(
        point(outer, s, floorY + 0.002),
        point(outer, e, floorY + 0.002),
        point(outer, e, y),
        point(outer, s, y),
        '#53665b'
      )
      fittings.quad(
        point(outer - 0.046, s, y + 0.0015),
        point(outer - 0.046, e, y + 0.0015),
        point(outer - 0.063, e, y + 0.0015),
        point(outer - 0.063, s, y + 0.0015),
        '#a4ac96'
      )
    }
  }
}

function sign(fittings, signs, i) {
  const a = centerAngle(i),
    r = 12.27,
    y = 3.18
  const p = (x, h, z) => radial(a, x, h, z)
  const w = 2.82,
    h = 0.68
  const plateIndex = [4, 5, 2, 3, 0, 1, 6, 7][i]
  signs.quad(
    p(w / 2, y - h / 2, r),
    p(-w / 2, y - h / 2, r),
    p(-w / 2, y + h / 2, r),
    p(w / 2, y + h / 2, r),
    '#ffffff',
    plate(plateIndex)
  )
  for (const sy of [-1, 1]) {
    fittings.beam(p(-w / 2, y + (sy * h) / 2, r - 0.008), p(w / 2, y + (sy * h) / 2, r - 0.008), 0.02, brass, 6)
    for (const sx of [-1, 1]) {
      fittings.beam(
        p(sx * (w / 2 - 0.061), y + sy * (h / 2 - 0.061), r - 0.006),
        p(sx * (w / 2 - 0.061), y + sy * (h / 2 - 0.061), r - 0.03),
        0.02,
        '#bca570',
        6
      )
    }
  }
  // Club colours hang from separate little outriggers. The cloth has depth:
  // its two pleats and the split fly cast different highlights as you orbit.
  for (const side of [-1, 1]) {
    const x = side * 2.94,
      z = r - 0.2,
      top = 4.13,
      w = 0.68
    fittings.beam(p(x - 0.36, top, z), p(x + 0.36, top, z), 0.023, brass, 6)
    fittings.beam(p(x, top, r + 0.05), p(x, top, z), 0.024, teal, 6)
    for (let j = 0; j < 4; j++) {
      const u = j / 4,
        v = (j + 1) / 4
      const left = x + w * (u - 0.5),
        right = x + w * (v - 0.5)
      const dz = (q) => -0.045 * Math.sin(q * Math.PI * 3)
      const bottom = (q) => top - 1.03 + 0.13 * (1 - Math.abs(2 * q - 1))
      const cloth = side < 0 ? '#ae7740' : '#326860'
      fittings.quad(
        p(right, bottom(v), z + dz(v)),
        p(left, bottom(u), z + dz(u)),
        p(left, top - 0.017, z + dz(u)),
        p(right, top - 0.017, z + dz(v)),
        cloth
      )
      fittings.quad(
        p(right, top - 0.36, z + dz(v) - 0.008),
        p(left, top - 0.34, z + dz(u) - 0.008),
        p(left, top - 0.29, z + dz(u) - 0.008),
        p(right, top - 0.31, z + dz(v) - 0.008),
        '#dac59b'
      )
    }
  }
}

// A solid chamfered casting for a spectator's helmet or visor. The outline is
// clipped in XY and the lip bevel follows it back in Z.
function helmet(batch, x, y, z, w, h, d, edge, colour, visor = false) {
  const perimeter = [
    [-0.5, -0.27],
    [-0.36, -0.5],
    [0.36, -0.5],
    [0.5, -0.27],
    [0.5, 0.28],
    [0.34, 0.5],
    [-0.34, 0.5],
    [-0.5, 0.28]
  ]
  const ring = (scale, depth) => perimeter.map(([u, v]) => [x + u * w * scale, y + v * h * scale, z + depth])
  const rear = ring(0.93, d / 2),
    body = ring(1, -d / 2 + edge),
    face = ring(0.93, -d / 2)
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8
    if (!visor) batch.quad(rear[j], rear[i], body[i], body[j], colour)
    batch.quad(body[j], body[i], face[i], face[j], colour)
  }
  // Fan meshes are turned toward the court. The solid cap is still visible
  // from the sides and on the bird's-eye camera.
  for (let i = 1; i < 7; i++) {
    batch.quad(face[0], face[i + 1], face[i], null, colour)
    if (!visor) batch.quad(rear[0], rear[i], rear[i + 1], null, colour)
  }
}

function supporter(cameraHead) {
  const f = new Batch()
  const shell = cameraHead ? '#d4c4a0' : '#ddd4b7'
  // The seat board carries the hips; little shoes hang over its front lip.
  f.box(0, 0.115, 0, 0.29, 0.23, 0.19, cameraHead ? '#bd9473' : '#87a59a')
  for (const side of [-1, 1]) {
    f.box(side * 0.078, 0.021, -0.107, 0.092, 0.073, 0.16, ironColor)
    const handY = cameraHead && side > 0 ? 0.277 : 0.092
    f.beam([side * 0.133, 0.188, -0.012], [side * 0.203, handY, -0.051], 0.036, '#74887d', 6)
    f.box(side * 0.204, handY, -0.053, 0.063, 0.061, 0.058, shell)
  }
  f.box(0, 0.241, -0.006, 0.13, 0.039, 0.12, deep)
  helmet(f, 0, 0.376, -0.015, 0.438, 0.27, 0.229, 0.021, shell)
  if (cameraHead) {
    const core = [0, 0.375, -0.132],
      front = [0, 0.375, -0.176]
    f.beam(core, front, 0.105, '#64756c', 12)
    f.beam(front, [0, 0.375, -0.196], 0.087, '#344e50', 12)
    // An inset circular lens with a small specular glint.
    for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12,
        b = ((i + 1) * TAU) / 12
      f.quad(
        [0, 0.375, -0.197],
        [0.081 * Math.cos(b), 0.375 + 0.081 * Math.sin(b), -0.197],
        [0.081 * Math.cos(a), 0.375 + 0.081 * Math.sin(a), -0.197],
        null,
        '#76a99f'
      )
    }
    f.box(-0.024, 0.403, -0.2, 0.036, 0.024, 0.005, '#d2e3cc')
    f.beam([0.157, 0.476, 0.001], [0.221, 0.596, 0.021], 0.012, '#69796c', 6)
  } else {
    helmet(f, 0, 0.379, -0.134, 0.343, 0.153, 0.035, 0.007, '#344d4e', true)
    for (const side of [-1, 1]) f.panel(side * 0.073, 0.388, -0.156, 0.041, 0.05, null, '#abd0b7')
    f.panel(0, 0.338, -0.156, 0.049, 0.008, null, '#8aa99a')
  }
  return f.finish()
}

function* fillSeats(group, material) {
  const banks = 16
  const seats = Array.from({ length: banks }, () => []),
    matrix = new T.Object3D()
  const tint = [
    new T.Color('#eee3c7'),
    new T.Color('#c4d4bf'),
    new T.Color('#d9bda0'),
    new T.Color('#bfd0cb'),
    new T.Color('#e1cfaf')
  ]
  let seed = 271
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const rows = [
    [7.7, 0.005],
    [8.396, 0.325],
    [9.1, 0.654],
    [9.82, 0.978]
  ]
  for (let section = 0; section < 8; section++) {
    const a = centerAngle(section)
    for (let row = 0; row < rows.length; row++) {
      const [r, y] = rows[row]
      // Leave irregular gaps between families and reserve the centre stair.
      for (const side of [-1, 1]) {
        const count = row === 3 ? 5 : 4
        for (let place = 0; place < count; place++) {
          const occupied = rnd() < (row === 0 ? 0.88 : row === 1 ? 0.84 : row === 2 ? 0.7 : 0.61)
          if (!occupied) continue
          const x = side * (0.65 + place * 0.57 + (rnd() - 0.5) * 0.09)
          const pos = radial(a, x, y + 0.148, r + (rnd() - 0.5) * 0.052)
          const size = 0.94 + rnd() * 0.25,
            kind = rnd() < 0.43 ? 1 : 0
          matrix.position.fromArray(pos)
          matrix.scale.set(size * (0.97 + rnd() * 0.1), size, size)
          matrix.rotation.set(
            (rnd() - 0.5) * 0.105,
            a + Math.atan2(x, r) * 0.65 + (rnd() - 0.5) * 0.28,
            (rnd() - 0.5) * 0.07,
            'YXZ'
          )
          matrix.updateMatrix()
          seats[section * 2 + (side > 0 ? 1 : 0)].push({
            kind,
            pose: matrix.matrix.clone(),
            tint: tint[Math.floor(rnd() * tint.length)]
          })
        }
      }
    }
  }
  // Bake the stationary families in angular order. The index ring repeats its
  // first arc, allowing one draw even when the visible seats straddle north.
  const models = [supporter(false), supporter(true)]
  let vertices = 0,
    elements = 0
  for (const section of seats)
    for (const f of section) {
      vertices += models[f.kind].attributes.position.count
      elements += models[f.kind].index.count
    }
  const position = new Float32Array(vertices * 3),
    normal = new Int16Array(vertices * 3),
    colours = new Uint16Array(vertices * 3)
  const index = vertices > 65535 ? new Uint32Array(elements * 2) : new Uint16Array(elements * 2)
  const starts = [],
    bounds = [],
    vertex = new T.Vector3(),
    normalMatrix = new T.Matrix3(),
    box = new T.Box3()
  let at = 0,
    idx = 0
  for (const section of seats) {
    starts.push(idx)
    box.makeEmpty()
    for (const fan of section) {
      const source = models[fan.kind],
        attributes = source.attributes,
        tint = fan.tint
      normalMatrix.getNormalMatrix(fan.pose)
      box.expandByPoint(vertex.setFromMatrixPosition(fan.pose))
      for (let k = 0; k < attributes.position.count; k++) {
        const j = (at + k) * 3
        vertex.fromBufferAttribute(attributes.position, k).applyMatrix4(fan.pose).toArray(position, j)
        vertex
          .fromBufferAttribute(attributes.normal, k)
          .applyNormalMatrix(normalMatrix)
          .multiplyScalar(32767)
          .round()
          .toArray(normal, j)
        colours[j] = Math.round(tint.r * attributes.color.array[k * 3])
        colours[j + 1] = Math.round(tint.g * attributes.color.array[k * 3 + 1])
        colours[j + 2] = Math.round(tint.b * attributes.color.array[k * 3 + 2])
      }
      for (const element of source.index.array) index[idx++] = at + element
      at += attributes.position.count
    }
    bounds.push(box.clone().expandByScalar(0.65))
    if (bounds.length % 2 === 0) yield
  }
  starts.push(idx)
  index.copyWithin(elements, 0, elements)
  const g = new T.BufferGeometry()
  g.setIndex(new T.BufferAttribute(index, 1))
  g.setAttribute('position', new T.BufferAttribute(position, 3))
  g.setAttribute('normal', new T.BufferAttribute(normal, 3, true))
  g.setAttribute('color', new T.BufferAttribute(colours, 3, true))
  g.setDrawRange(0, elements)
  g.computeBoundingSphere()
  for (const model of models) model.dispose()
  const mesh = new T.Mesh(g, material)
  mesh.name = 'Seated radio and camera clubs'
  const view = new T.Matrix4(),
    frustum = new T.Frustum(),
    eye = new T.Vector3(),
    center = new T.Vector3()
  let last = -1
  mesh.onBeforeRender = (renderer, scene, camera) => {
    frustum.setFromProjectionMatrix(view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
    eye.setFromMatrixPosition(camera.matrixWorld)
    const r = Math.hypot(eye.x, eye.z)
    let mask = 0
    for (let i = 0; i < banks; i++) {
      bounds[i].getCenter(center)
      // An outside orbit cuts away the grandstand in front of the lens.
      const cut = r > 12.6 && eye.y > 2.12 && (eye.x * center.x + eye.z * center.z) / r > 7.8
      if (!cut && frustum.intersectsBox(bounds[i])) mask |= 1 << i
    }
    if (mask === last) return
    last = mask
    if (!mask || mask === (1 << banks) - 1) {
      g.setDrawRange(0, mask ? elements : 0)
      return
    }
    let skip = 0,
      end = 0
    for (let i = 0; i < banks; i++) {
      if (mask & (1 << i)) continue
      let n = 1
      while (n < banks && !(mask & (1 << ((i + n) % banks)))) n++
      if (n > skip) {
        skip = n
        end = (i + n) % banks
      }
    }
    const finish = end + banks - skip
    const finalOffset = finish > banks ? elements + starts[finish - banks] : starts[finish]
    g.setDrawRange(starts[end], finalOffset - starts[end])
  }
  group.add(mesh)
}

// Cameras can orbit behind a bank or rise above the ceiling on narrow screens.
// Only the architecture between that camera and the pitch is cut away. World
// coordinates keep the room, signs and far wall fixed during the entire orbit.
function cutaway(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 hallCut;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 hallWorld=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          hallWorld=instanceMatrix*hallWorld;
        #endif
        hallWorld=modelMatrix*hallWorld;
        float camR=length(cameraPosition.xz), r=length(hallWorld.xz);
        float toward=dot(hallWorld.xz,cameraPosition.xz/max(0.01,camR));
        hallCut=vec3(camR-r+0.18,min(toward-0.30*r-1.20,cameraPosition.y+0.35-hallWorld.y),
          min(hallWorld.y-5.28,cameraPosition.y-hallWorld.y+0.18));`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 hallCut;')
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        if(min(hallCut.x,hallCut.y)>0.0 || hallCut.z>0.0) discard;`
      )
  }
  return material
}

export function createHall() {
  const construction = assembleHall()
  let step = construction.next()
  while (!step.done) step = construction.next()
  return step.value
}

export function* assembleHall() {
  const group = new T.Group()
  group.name = 'Robot Rally field house'
  const textures = []
  function texture(name) {
    const result = new T.TextureLoader().load(new URL('../art/' + name, import.meta.url).href)
    result.colorSpace = T.SRGBColorSpace
    result.anisotropy = 4
    textures.push(result)
    return result
  }
  const atlas = texture('hall-finishes.webp')
  const structure = new Batch(),
    trim = new Batch(),
    glass = new Batch(),
    bulbs = new Batch()
  // House lights are down behind the floodlit ring. These material tints
  // affect only the spectator banks, leaving the contestants' light rig intact.
  const solid = cutaway(new T.MeshLambertMaterial({ color: '#92a4ad', vertexColors: true }))
  const painted = cutaway(new T.MeshLambertMaterial({ color: '#8496a5', vertexColors: true, map: atlas }))
  const glazing = cutaway(new T.MeshBasicMaterial({ vertexColors: true, map: atlas, toneMapped: false }))
  const glow = cutaway(new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: T.DoubleSide }))
  function mount(name, batch, material, repeat) {
    const g = batch.finish()
    const mesh = repeat ? new T.InstancedMesh(g, material, 8) : new T.Mesh(g, material)
    mesh.name = name
    if (repeat) {
      const m = new T.Matrix4()
      for (let i = 0; i < 8; i++) mesh.setMatrixAt(i, m.makeRotationY(centerAngle(i)))
      mesh.computeBoundingSphere()
    }
    group.add(mesh)
  }
  speakerTower(structure, bulbs)
  stand(structure, trim)
  envelope(structure, trim, glass, bulbs)
  ceiling(structure, trim, bulbs)
  serviceGallery(structure, trim)
  yield
  mount('Terraces, portal frames and roof trusses', structure, solid, true)
  mount('Planked benches, wall panels and acoustic roof', trim, painted, true)
  mount('Clerestory glass', glass, glazing, true)
  mount('Roof lights and crown skylight', bulbs, glow, true)
  const fanPaint = cutaway(new T.MeshStandardMaterial({ color: '#8096a2', vertexColors: true, roughness: 0.64, metalness: 0.12, envMapIntensity: .52 }))
  yield
  yield* fillSeats(group, fanPaint)
  const entry = new Batch(),
    signs = new Batch()
  for (const bay of fountainBays) fountainHousing(entry, bay)
  courtsideMats(entry)
  for (const a of [Math.PI * 0.5 + 0.32, -Math.PI * 0.5 + 0.32]) addRamp(entry, a)
  for (let i = 0; i < 8; i++) sign(entry, signs, i)
  mount('Court ramps and nameplate fittings', entry, solid, false)
  mount('Field house signs', signs, painted, false)
  yield

  const floorMaterial = new T.MeshStandardMaterial({
    map: texture('hall-floor.webp'),
    color: '#6a7b84',
    envMapIntensity: .51,
    roughness: 0.73,
    metalness: 0.09
  })
  const floor = new T.Mesh(floorGeometry(), floorMaterial)
  floor.name = 'Sealed concrete floor'
  group.add(floor)
  // One roof flood covers both contestants. Its aperture follows their
  // separation and settles on the winner while the rail fireworks fire.
  const focus = new T.SpotLight(0xfff2dc, 57, 18, 0.72, 0.64, 2)
  focus.name = 'Ring flood'
  focus.position.fromArray(radial(centerAngle(4), 0, 5.28, 6.06))
  focus.target.position.set(0, 0.25, 0)
  group.add(focus, focus.target)
  const show = createArenaShow()
  group.add(show.group)
  let disposed = false
  return {
    group,
    updateShow: show.update,
    lightBout(own, rival, winner, victorySeconds, reduced) {
      const celebrate = winner === 0 || winner === 1
        ? T.MathUtils.smoothstep(victorySeconds, .15, 1.48) : 0
      const midX = (own.x + rival.x) * .5, midZ = (own.z + rival.z) * .5
      const subject = winner === 1 ? rival : own
      const aim = focus.target.position
      // Keep both silhouettes in soft light as the beam moves to the podium.
      // Reduced Motion keeps a steady wide wash across the entire floor.
      if (reduced) {
        aim.set(0, .25, 0)
        focus.angle = .72
        focus.intensity = 57
        return
      }
      aim.set(T.MathUtils.lerp(midX, subject.x, celebrate), .48,
        T.MathUtils.lerp(midZ, subject.z, celebrate))
      const radius = T.MathUtils.lerp(1.85 + .64 * Math.hypot(own.x - rival.x, own.z - rival.z), 2.05, celebrate)
      focus.angle = T.MathUtils.clamp(Math.atan2(radius, focus.position.distanceTo(aim)), .22, .77)
      focus.intensity = 74 + 17 * celebrate
    },
    impactRails:show.impact,
    resetShow:show.clear,
    dispose() {
      if (disposed) return
      disposed = true
      group.removeFromParent()
      for (const mesh of group.children) {
        if (!mesh.isMesh) continue
        mesh.geometry.dispose()
        if (mesh.isInstancedMesh) mesh.dispose()
      }
      for (const material of [solid, painted, glazing, glow, fanPaint, floorMaterial]) material.dispose()
      for (const map of textures) map.dispose()
      focus.dispose()
      show.dispose()
      group.clear()
    }
  }
}
