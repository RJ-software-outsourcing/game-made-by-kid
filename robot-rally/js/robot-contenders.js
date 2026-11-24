// Welded carriers and removable service equipment for the tabletop competition.
import * as T from '../vendor/three.module.js'
import { colors, finishes, armorCowl } from './robot-forms.js'
export const wristStroke = 1.28
const { graphite, rubber, darkSteel, steel, amber } = colors
const { porcelain, lacquer, metal, soft, lit, glass } = finishes
export const alloy = '#a9b9bc',
  bright = '#d1d9d6',
  gun = '#48545b',
  black = '#222b30',
  copper = '#b58a65',
  oil = '#303a42'
export const tau = Math.PI * 2
export const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t)
export function hose(p, points, r = 0.022) {
  const g = p.template(
    'rig hose ' + JSON.stringify([points, r]),
    () =>
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((x) => new T.Vector3(...x))),
        p.compact ? 10 : 17,
        r,
        p.compact ? 5 : 8,
        false
      )
  )
  p.add(g, black, soft, [0, 0, 0])
}
export function rivet(p, x, y, z, r = 0.019) {
  p.cylinder([x, y, z], r, 0.017, gun, 'z', metal, 8)
  p.cylinder([x, y, z + 0.011], r * 0.6, 0.008, bright, 'z', metal, 6)
}
// A shallow convex folded plate: facets rise from the tapered bottom to a
// ridge near the brow. Its front, cut bevel and dark backing are separate.
export function shield(p, key, outline, at, depth, peak, color, finish = porcelain, stripeSide = 0) {
  const g = p.template('rig panel ' + key + JSON.stringify([outline, depth, peak]), () => {
    const vertices = [],
      inds = [],
      count = outline.length
    for (const z of [-depth, -0.012, 0])
      for (const [x, y] of outline) {
        const lip = z === -depth ? 0.85 : z === 0 ? 0.925 : 1
        vertices.push(x * lip, y * lip, z)
      }
    vertices.push(...peak)
    const center = new T.Vector2()
    for (const v of outline) center.add(new T.Vector2(...v))
    center.divideScalar(count)
    const sides =
      outline.reduce((sum, a, i) => {
        const b = outline[(i + 1) % count]
        return sum + a[0] * b[1] - b[0] * a[1]
      }, 0) > 0
    function tri(a, b, c) {
      if (sides) inds.push(a, b, c)
      else inds.push(a, c, b)
    }
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count
      tri(2 * count + i, 2 * count + j, 3 * count)
      for (let ring = 0; ring < 2; ring++) {
        const n = ring * count
        tri(n + i, n + j, n + count + i)
        tri(n + j, n + count + j, n + count + i)
      }
    }
    for (let i = 1; i < count - 1; i++) tri(0, i + 1, i)
    const indexed = new T.BufferGeometry()
    indexed.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
    indexed.setIndex(inds)
    const flat = indexed.toNonIndexed()
    flat.computeVertexNormals()
    // The outer lip is where a pressed plate rubs against the boards.
    // Preserve this edge even though every face has its own flat normal.
    flat.userData.fold = Uint8Array.from(inds, (i) => i >= count && i < 2 * count ? 255 : 0)
    indexed.dispose()
    return flat
  })
  p.add(g, color, finish, at)
  if (stripeSide) {
    const stripe = p.template('pressed stripe ' + key, () => stripeGeometry(outline, peak, stripeSide))
    p.add(stripe, '#e2e4dc', porcelain, at)
  }
}
export function taperSleeve(p, key, a, b, r1, r2, c, finish = metal, facets = 16) {
  const va = new T.Vector3(...a),
    vb = new T.Vector3(...b),
    axis = vb.clone().sub(va)
  const g = p.template(
    'rig sleeve ' + [key, r1, r2, facets],
    () => new T.CylinderGeometry(r2, r1, 1, p.compact ? Math.max(6, Math.round(facets * 0.65)) : facets)
  )
  p.add(
    g,
    c,
    finish,
    va.add(vb).multiplyScalar(0.5).toArray(),
    [1, axis.length(), 1],
    new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), axis.normalize())
  )
}
export function ram(p, a, b, r, tint = gun) {
  p.rod(a, b, r * 0.57, bright, metal, 12)
  p.rod(a, lerp(a, b, 0.51), r, tint, metal, 16)
  p.rod(lerp(a, b, 0.39), lerp(a, b, 0.46), r * 1.06, oil, soft, 12)
  p.rod(lerp(a, b, 0.47), lerp(a, b, 0.56), r * 1.09, alloy, metal, 12)
  p.rod(lerp(a, b, 0.82), lerp(a, b, 0.91), r * 0.72, copper, metal, 12)
}
function gear(p, at, r, thickness, axis = 'x', color = gun) {
  const outline = []
  for (let i = 0; i < 12; i++)
    for (const [j, w] of [
      [0, 0.8],
      [0.15, 1],
      [0.54, 1],
      [0.69, 0.8]
    ]) {
      const angle = (tau * (i + j)) / 12
      outline.push([Math.cos(angle) * r * w, Math.sin(angle) * r * w])
    }
  const g = p.template(
    'gear ' + [r, thickness],
    () =>
      new T.ExtrudeGeometry(new T.Shape(outline.map((x) => new T.Vector2(...x))), {
        depth: thickness,
        bevelEnabled: false
      })
  )
  p.add(g, color, metal, at, [1, 1, 1], axis === 'x' ? [0, Math.PI / 2, 0] : [0, 0, 0])
}
export function boltedHub(p, s, x, y, z, r) {
  p.cylinder([s * x, y, z], r, 0.075, black, 'x', soft, 18)
  gear(p, [s * x - 0.029, y, z], r * 1.09, 0.055, 'x', gun)
  p.cylinder([s * (x + 0.044), y, z], r * 0.81, 0.029, alloy, 'x', metal, 16)
  p.cylinder([s * (x + 0.061), y, z], r * 0.47, 0.021, oil, 'x', metal, 12)
  p.cylinder([s * (x + 0.078), y, z], r * 0.23, 0.017, copper, 'x', metal, 6)
  for (let i = 0; i < 4; i++) {
    const a = (tau * (i + 0.5)) / 4
    p.cylinder(
      [s * (x + 0.064), y + Math.cos(a) * r * 0.62, z + Math.sin(a) * r * 0.62],
      r * 0.089,
      0.01,
      black,
      'x',
      soft,
      6
    )
  }
}
const shoulderShape = [
  [-0.16, 0.082],
  [-0.108, 0.145],
  [0.087, 0.155],
  [0.204, 0.073],
  [0.168, -0.078],
  [0.053, -0.16],
  [-0.124, -0.095]
]
const chestShape = [
  [-0.159, 0.094],
  [-0.09, 0.155],
  [0.133, 0.132],
  [0.177, 0.056],
  [0.131, -0.105],
  [0.039, -0.167],
  [-0.124, -0.088]
]
export const reflect = (points, side) => points.map(([x, y]) => [side * x, y])
// Clip a printed line to each fold so it follows the steel even edge-on.
function clipStripe(polygon, distance) {
  const clipped = []
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length]
    const da = distance(a), db = distance(b)
    if (da >= 0) clipped.push(a)
    if ((da < 0) !== (db < 0)) clipped.push(lerp(a, b, da / (da - db)))
  }
  return clipped
}

function stripeGeometry(outline, peak, side) {
  const rim = outline.map(([x, y]) => [x * 0.925, y * 0.925, 0])
  const width = Math.max(...rim.map(([x]) => Math.abs(x)))
  const height = Math.max(...rim.map(([, y]) => Math.abs(y)))
  const vertices = []
  const across = ([x]) => side * x / width
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i], b = rim[(i + 1) % rim.length]
    const front = (b[0] - a[0]) * (peak[1] - a[1]) > (b[1] - a[1]) * (peak[0] - a[0])
      ? [a, b, peak] : [b, a, peak]
    // An angled inner stripe meets a level band toward the outside of the
    // shoulder. Each line has a short unpainted margin at its ends.
    for (const [start, end, slope] of [[-.85, .12, .48], [.12, .88, 0]]) {
      let facet = clipStripe(front, v => across(v) - start)
      facet = clipStripe(facet, v => end - across(v))
      const above = v => v[1] / height - slope * (across(v) - .12)
      for (const [bottom, top] of [[.04, .25], [-.20, -.12]]) {
        const band = clipStripe(clipStripe(facet, v => above(v) - bottom), v => top - above(v))
        for (let j = 1; j + 1 < band.length; j++)
          for (const [x, y, z] of [band[0], band[j], band[j + 1]]) vertices.push(x, y, z + .001)
      }
    }
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
  geometry.computeVertexNormals()
  return geometry
}
export function knuckleCarrier(p) {
  // The differential hangs between two independent load rails. Air remains
  // visible through the waist behind the paired press arms.
  p.cylinder([0, -0.051, -0.078], 0.108, 0.224, black, 'y', soft, 12)
  p.cylinder([0, -0.087, -0.078], 0.119, 0.029, alloy, 'y', metal, 12)
  p.cylinder([0, 0.079, -0.078], 0.082, 0.159, gun, 'y', metal, 10)
  p.block([0, 0.135, -0.084], [0.212, 0.122, 0.167], 0.02, gun, metal)
  p.cylinder([0, 0.247, -0.069], 0.071, 0.159, alloy, 'y', metal, 12)
  p.rod([-0.507, 0.412, -0.074], [0.507, 0.412, -0.074], 0.062, gun, metal, 12)
  p.rod([-0.375, 0.472, -0.127], [0.375, 0.472, -0.127], 0.035, alloy, metal, 10)
  for (const s of [-1, 1]) {
    p.rod([s * 0.094, -0.111, -0.056], [s * 0.24, 0.294, -0.146], 0.031, alloy, metal, 10)
    p.rod([s * 0.102, -0.061, 0.039], [s * 0.2, 0.261, 0.001], 0.024, gun, metal, 8)
    p.rod([s * 0.113, -0.04, -0.087], [-s * 0.167, 0.193, -0.126], 0.019, copper, metal, 8)
    ram(p, [s * 0.196, 0.221, -0.062], [s * 0.489, 0.409, -0.045], 0.036)
    const breast = [s * 0.173, 0.32, 0.075]
    shield(p, 'sternum ' + s, reflect(chestShape, s), breast, 0.16, [s * 0.032, 0.038, 0.071], p.paint, porcelain, s)
    rivet(p, s * 0.254, 0.351, 0.141)
    // Pop-up lap lights and tapered roll bars sit BEHIND the load-bearing shoulder.
    p.rod([s * 0.466, 0.399, -0.175], [s * 0.549, 0.724, -0.163], 0.036, gun, metal, 10)
    p.rod([s * 0.448, 0.395, -0.234], [s * 0.524, 0.693, -0.238], 0.023, alloy, metal, 8)
    p.block([s * 0.54, 0.665, -0.17], [0.087, 0.198, 0.081], 0.014, oil, metal, [0.04, 0, -s * 0.11])
    for (let i = 0; i < 3; i++) {
      p.block(
        [s * (0.533 + i * 0.006), 0.614 + i * 0.047, -0.123],
        [0.045, 0.028, 0.018],
        0.006,
        i === 2 ? '#ffd58f' : '#b26754',
        i === 2 ? lit : glass,
        [0, 0, -s * 0.11]
      )
    }
    hose(
      p,
      [
        [s * 0.488, 0.341, -0.132],
        [s * 0.414, 0.181, -0.191],
        [s * 0.243, 0.176, -0.169],
        [s * 0.195, 0.29, -0.107]
      ],
      0.016
    )
    p.block([s * 0.162, 0.041, -0.192], [0.093, 0.196, 0.148], 0.019, gun, metal, [0.23, 0, s * 0.2])
  }
  p.block([0, 0.424, -0.071], [0.188, 0.091, 0.2], 0.018, gun, metal)
  p.cylinder([0, 0.485, -0.054], 0.078, 0.088, steel, 'y', metal, 12)
}
export function knuckleBridge(p) {
  // A small removable sensor loom on a gimbal replaces the old solid drum helmet.
  armorCowl(
    p,
    'bridge electronics pot',
    [0, -0.028, -0.02],
    0.737,
    0.547,
    -0.131,
    0.071,
    0.159,
    0.072,
    gun,
    metal
  )
  for (const s of [-1, 1]) {
    p.rod([s * 0.301, -0.077, 0.145], [s * 0.342, 0.116, -0.168], 0.046, alloy, metal, 9)
    p.cylinder([s * 0.337, 0.023, -0.04], 0.097, 0.078, black, 'x', soft, 12)
    p.cylinder([s * 0.385, 0.023, -0.04], 0.056, 0.032, copper, 'x', metal, 8)
    p.block([s * 0.176, 0.084, -0.071], [0.209, 0.114, 0.282], 0.026, p.paint, porcelain, [-0.1, 0, s * 0.11])
    p.rod([s * 0.128, 0.115, 0.021], [s * 0.182, 0.192, -0.214], 0.02, alloy, metal, 8)
  }
  p.block([0, 0.006, 0.254], [0.469, 0.182, 0.088], 0.023, black, soft)
  p.block([-0.08, 0.008, 0.329], [0.159, 0.098, 0.055], 0.014, '#233b44', glass)
  p.block([0.124, 0.02, 0.319], [0.124, 0.06, 0.049], 0.008, '#233b44', glass)
  p.rod([-0.213, -0.081, 0.302], [0.197, -0.081, 0.302], 0.016, steel, metal, 8)
}
export function knuckleDrive(p, r) {
  p.rod([-0.202, 0.516, -0.071], [0.202, 0.516, -0.071], 0.074, gun, metal, 12)
  for (const s of [-1, 1]) {
    const hip = [s * 0.177, 0.509, -0.081],
      knee = [s * 0.345, 0.391, 0.075],
      hub = [s * 0.414, r, -0.01]
    p.rod(hip, knee, 0.061, gun, metal, 12)
    p.rod([s * 0.205, 0.496, -0.171], [s * 0.35, 0.378, -0.042], 0.034, alloy, metal, 10)
    p.rod(knee, hub, 0.049, gun, metal, 12)
    ram(p, [s * 0.343, 0.396, 0.143], [s * 0.409, r + 0.011, 0.076], 0.047, alloy)
    shield(
      p,
      'knee ' + s,
      reflect(
        [
          [-0.094, 0.061],
          [-0.059, 0.114],
          [0.084, 0.096],
          [0.117, 0.044],
          [0.061, -0.073],
          [-0.071, -0.109]
        ],
        s
      ),
      [s * 0.315, 0.373, 0.099],
      0.139,
      [s * 0.028, 0.032, 0.058],
      p.paint.coat
    )
    rivet(p, s * 0.345, 0.404, 0.158, 0.018)
    boltedHub(p, s, 0.376, 0.389, 0.023, 0.06)
    p.rod([s * 0.254, 0.443, -0.136], [s * 0.428, r, -0.116], 0.027, copper, metal, 10)
    hose(
      p,
      [
        [s * 0.198, 0.483, -0.135],
        [s * 0.246, 0.282, -0.162],
        [s * 0.347, 0.225, -0.139],
        [s * 0.39, r, -0.087]
      ],
      0.017
    )
  }
  p.rod([0, 0.491, -0.116], [0, 0.093, -0.285], 0.036, gun, metal, 10)
  p.cylinder([0, 0.083, -0.303], 0.083, 0.092, rubber, 'x', soft, 14)
}
export function stockWheel(p, s, r) {
  const profile = [
    [r * 0.51, -0.086],
    [r * 0.83, -0.086],
    [r * 0.99, -0.065],
    [r, 0.049],
    [r * 0.89, 0.086],
    [r * 0.51, 0.086]
  ]
  const g = p.template(
    'workshop stock roller ' + r,
    () =>
      new T.LatheGeometry(
        profile.map((x) => new T.Vector2(...x)),
        p.compact ? 16 : 24
      )
  )
  p.add(g, rubber, soft, [0, 0, 0], [1, 1, 1], [0, 0, Math.PI / 2])
  p.cylinder([0, 0, 0], r * 0.64, 0.164, gun, 'x', metal, 12)
  p.cylinder([s * 0.086, 0, 0], r * 0.39, 0.031, alloy, 'x', metal, 10)
  p.cylinder([s * 0.101, 0, 0], r * 0.19, 0.02, black, 'x', soft, 6)
  p.ring([s * 0.089, 0, 0], r * 0.55, 0.012, alloy, 'x')
  for (let i = 0; i < 9; i++) {
    const a = (tau * i) / 9,
      cs = Math.cos(a),
      sn = Math.sin(a),
      rr = r * 0.904
    const x = 0.069,
      step = 0.033
    const v = [-x, rr * cs - step * sn, rr * sn + step * cs],
      w = [x, rr * cs + step * sn, rr * sn - step * cs]
    taperSleeve(p, 'tread roller', v, w, r * 0.158, r * 0.145, graphite, soft, 10)
    p.cylinder([s * 0.097, rr * cs, rr * sn], r * 0.073, 0.014, darkSteel, 'x', metal, 8)
    p.block([s * 0.087, r * 0.505 * cs, r * 0.505 * sn], [0.018, r * 0.263, 0.024], 0.004, alloy, metal, [
      a + 0.18,
      0,
      0
    ])
  }
}
export const knucklePalm = [-0.266, -0.687, 0.231]
export function knuckleArm(p, s) {
  const root = [0, 0, 0],
    elbow = [s * 0.177, -0.19, 0.049],
    wrist = [s * knucklePalm[0], knucklePalm[1], knucklePalm[2]]
  const outer = [s * 0.174, -0.218, 0.105],
    mouth = [s * -0.13, -0.559, 0.19]
  p.cylinder(root, 0.116, 0.182, black, 'x', soft, 16)
  boltedHub(p, s, 0.086, 0, -0.004, 0.095)
  ram(p, [s * 0.023, -0.062, -0.025], elbow, 0.064, alloy)
  p.rod([s * 0.045, -0.04, 0.084], [s * 0.185, -0.185, 0.12], 0.039, gun, metal, 10)
  // A broad, metal-backed trapezoidal shoulder, separate from the chest plate.
  shield(
    p,
    'load pad seat ' + s,
    reflect(shoulderShape, s),
    [s * 0.034, 0.098, 0.003],
    0.24,
    [s * 0.045, 0.057, 0.08],
    gun,
    metal
  )
  shield(
    p,
    'load pad cover ' + s,
    reflect(shoulderShape, s),
    [s * 0.036, 0.107, 0.049],
    0.147,
    [s * 0.061, 0.06, 0.081],
    p.paint, porcelain, s
  )
  rivet(p, s * 0.132, 0.095, 0.112, 0.02)
  rivet(p, -s * 0.061, 0.159, 0.103, 0.016)
  boltedHub(p, s, 0.192, -0.192, 0.054, 0.12)
  p.rod([s * 0.111, -0.183, -0.054], [s * 0.217, -0.168, 0.06], 0.075, gun, metal, 12)
  // External U-shaped flexible lead between the elbow valve and forearm socket.
  hose(
    p,
    [
      [s * 0.169, -0.184, -0.042],
      [s * 0.326, -0.266, -0.061],
      [s * 0.352, -0.511, 0.043],
      [s * 0.294, -0.568, 0.113],
      [s * 0.156, -0.438, 0.166],
      [s * 0.044, -0.371, 0.151]
    ],
    0.02
  )
  p.cylinder([s * 0.162, -0.184, -0.045], 0.033, 0.047, copper, 'x', metal, 8)
  // Two slender silver tie rods flank a much larger, inward-canted sleeve.
  const mounts = [
    [s * 0.053, 0.015, 0.077],
    [-s * 0.06, -0.013, -0.05]
  ]
  for (const off of mounts) {
    const a = outer.map((v, i) => v + off[i]),
      b = mouth.map((v, i) => v + off[i])
    p.rod(a, b, 0.025, bright, metal, 10)
    p.rod(a, lerp(a, b, 0.14), 0.036, oil, metal, 10)
    p.rod(lerp(a, b, 0.6), lerp(a, b, 0.7), 0.031, copper, metal, 10)
  }
  taperSleeve(p, 'press cast', outer, lerp(outer, mouth, 0.53), 0.101, 0.093, p.paint, porcelain, 10)
  taperSleeve(
    p,
    'press heel',
    lerp(outer, mouth, 0.09),
    lerp(outer, mouth, 0.25),
    0.112,
    0.111,
    gun,
    metal,
    10
  )
  taperSleeve(
    p,
    'mid collar',
    lerp(outer, mouth, 0.47),
    lerp(outer, mouth, 0.6),
    0.102,
    0.083,
    alloy,
    metal,
    14
  )
  taperSleeve(p, 'forward bore', lerp(outer, mouth, 0.58), mouth, 0.061, 0.053, bright, metal, 16)
  taperSleeve(p, 'wiper', lerp(outer, mouth, 0.86), mouth, 0.076, 0.068, gun, metal, 14)
  const p0 = p.pieces.reduce((n, v) => n + v.geometry.attributes.position.count, 0)
  const throat = lerp(mouth, wrist, 0.63)
  taperSleeve(p, 'press rod', mouth, throat, 0.043, 0.041, bright, metal, 14)
  const p1 = p.pieces.reduce((n, v) => n + v.geometry.attributes.position.count, 0)
  taperSleeve(p, 'service collar', throat, lerp(mouth, wrist, 0.88), 0.062, 0.069, copper, metal, 12)
  taperSleeve(p, 'safety foot', lerp(mouth, wrist, 0.88), wrist, 0.071, 0.068, graphite, soft, 12)
  palmShoe(p, s, wrist, 1.16)
  const geometry = p.geometry(),
    pos = geometry.attributes.position,
    morph = new Float32Array(pos.count * 3),
    v = new T.Vector3()
  const normal = new T.Vector3(...wrist).normalize(),
    a = new T.Vector3(...mouth),
    b = new T.Vector3(...throat).sub(a),
    len = b.lengthSq()
  for (let i = p0; i < pos.count; i++) {
    const weight = i >= p1 ? 1 : T.MathUtils.clamp(v.fromBufferAttribute(pos, i).sub(a).dot(b) / len, 0, 1)
    morph.set(
      [normal.x * wristStroke * weight, normal.y * wristStroke * weight, normal.z * wristStroke * weight],
      i * 3
    )
  }
  geometry.morphAttributes.position = [new T.Float32BufferAttribute(morph, 3)]
  geometry.morphTargetsRelative = true
  geometry.computeBoundingSphere()
  return geometry
}

export function palmShoe(p, s, wrist, size = 1) {
  const [x, y, z] = wrist
  // A forked wrist clamp with a bridging pin and soft, flat contact pads.
  for (const k of [-1, 1]) {
    const dx = k * 0.065 * size
    p.block(
      [x + dx, y + 0.014 * size, z - 0.01],
      [0.041 * size, 0.113 * size, 0.12 * size],
      0.009,
      gun,
      metal,
      [-0.36, 0, -s * 0.24]
    )
    p.block(
      [x + dx, y - 0.03 * size, z + 0.031],
      [0.044 * size, 0.044 * size, 0.085 * size],
      0.009,
      graphite,
      soft,
      [-0.29, 0, -s * 0.24]
    )
  }
  p.cylinder([x, y + 0.012, z - 0.035], 0.029 * size, 0.169 * size, alloy, 'x', metal, 10)
  p.block(
    [x, y - 0.006, z + 0.041],
    [0.113 * size, 0.052 * size, 0.044 * size],
    0.008,
    p.paint.coat,
    porcelain,
    [-0.3, 0, -s * 0.24]
  )
}

export function triangleTruss(p, a, b, c, r = 0.026, tint = alloy) {
  p.rod(a, b, r, tint, metal, 9)
  p.rod(b, c, r, tint, metal, 9)
  p.rod(c, a, r, gun, metal, 9)
}
export function louver(p, side, x, y, z, count = 3) {
  p.block([side * x, y, z], [0.125, count * 0.027 + 0.029, 0.016], 0.01, oil, soft)
  for (let j = 0; j < count; j++)
    p.block(
      [side * x, y + (0.5 * (count - 1) - j) * 0.027, z + 0.01],
      [0.098, 0.01, 0.014],
      0.003,
      alloy,
      metal,
      [-0.3, 0, 0]
    )
}
export function landingPlate(p, key, s, at, w, h, depth, color) {
  const shape = [
    [-0.48, 0.17],
    [-0.27, 0.5],
    [0.26, 0.44],
    [0.5, 0.2],
    [0.41, -0.24],
    [0.07, -0.5],
    [-0.35, -0.36]
  ]
  shield(
    p,
    key + s,
    shape.map(([x, y]) => [s * x * w, y * h]),
    at,
    depth,
    [s * 0.12 * w, 0.11 * h, depth * 0.29],
    color
  )
}
export function ringSection(p, key, rOut, rIn, low, high, start, end, tint, finish) {
  const g = p.template('turntable ' + key + JSON.stringify([rOut, rIn, low, high, start, end]), () => {
    const pos = [],
      idx = [],
      seg = Math.max(3, Math.round((end - start) / (p.compact ? 0.24 : 0.15)))
    for (let j = 0; j <= seg; j++) {
      const a = start + ((end - start) * j) / seg,
        x = Math.sin(a),
        z = Math.cos(a)
      for (const [r, y] of [
        [rIn, low],
        [rOut - 0.018, low],
        [rOut, low + 0.019],
        [rOut, high - 0.014],
        [rOut - 0.024, high],
        [rIn + 0.014, high],
        [rIn, high - 0.014]
      ])
        pos.push(r * x, y, r * z)
    }
    for (let j = 0; j < seg; j++)
      for (let k = 0; k < 7; k++) {
        const a = 7 * j + k,
          b = 7 * j + ((k + 1) % 7)
        idx.push(a, a + 7, b, b, a + 7, b + 7)
      }
    for (let k = 1; k < 6; k++) {
      idx.push(0, k, k + 1, seg * 7, seg * 7 + k + 1, seg * 7 + k)
    }
    const g = new T.BufferGeometry()
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    const flat = g.toNonIndexed()
    flat.computeVertexNormals()
    g.dispose()
    return flat
  })
  p.add(g, tint, finish, [0, 0, 0])
}
export function spring(p, a, b, r, turns = 4.7) {
  const start = new T.Vector3(...a),
    axis = new T.Vector3(...b).sub(start),
    length = axis.length()
  axis.normalize()
  const u = new T.Vector3().crossVectors(axis, new T.Vector3(1, 0, 0)).normalize(),
    v = new T.Vector3().crossVectors(axis, u)
  const pts = [],
    n = p.compact ? 40 : 62
  for (let i = 0; i <= n; i++) {
    const t = i / n
    pts.push(
      start
        .clone()
        .addScaledVector(axis, t * length)
        .addScaledVector(u, r * Math.cos(t * tau * turns))
        .addScaledVector(v, r * Math.sin(t * tau * turns))
    )
  }
  const key = 'rig coil ' + [...a, ...b, r, turns].join(',')
  p.add(
    p.template(
      key,
      () => new T.TubeGeometry(new T.CatmullRomCurve3(pts), n, 0.012, p.compact ? 4 : 6, false)
    ),
    bright,
    metal,
    [0, 0, 0]
  )
}
