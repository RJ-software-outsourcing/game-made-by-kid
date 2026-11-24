// Rig dimensions and shared machined geometry for six competition frames.
import * as T from '../vendor/three.module.js'
import { chassisWheels } from './wheel-motion.js'

export const colors = {
  ivory: '#f4edda',
  trim: '#285c5b',
  graphite: '#253237',
  rubber: '#263237',
  tread: '#394449',
  steel: '#a7b6b5',
  darkSteel: '#637878',
  cyan: '#81f7db',
  amber: '#ffb74e'
}
export const finishes = {
  porcelain: [0.36, 0.1, 0],
  lacquer: [0.24, 0.22, 0],
  metal: [0.29, 0.68, 0],
  soft: [0.83, 0.02, 0],
  glass: [0.13, 0.26, 0],
  lit: [0.32, 0.06, 0.9]
}
const { trim, graphite, rubber, steel, darkSteel } = colors
const { lacquer, metal, soft } = finishes
const TAU = Math.PI * 2

export const forms = [
  {
    name: 'Rivet',
    bodyY: 0.506,
    head: [-0.157, 0.465, -0.023],
    headScale: [0.618, 0.671, 0.688],
    arm: [0.356, 0.274, 0.022],
    shoulders: [
      [0.305, 0.246, 0.083],
      [0.412, 0.407, -0.059]
    ],
    readyArm: -0.3,
    armRoll: 0.069,
    reach: 0.97,
    ...chassisWheels[0],
    cpu: [0.093, 0.116, -0.194],
    battery: [0, 0.121, -0.275],
    gauge: [-0.117, 0.26, 0.263],
    tool: [-0.207, 0.161, 0.264],
    toolScale: 0.86,
    toolHand: 1,
    handSocket: [0.131, -0.523, 0.151],
    shellFocus: [0.238, 0.229, 0.249],
    belly: [0, 0.163, 0.039]
  },
  {
    name: 'Rover',
    bodyY: 0.37,
    head: [0, 0.197, 0.101],
    headScale: [0.63, 0.55, 0.682],
    arm: [0.324, 0.061, 0.337],
    readyArm: -0.05,
    armRoll: 0.037,
    reach: 1.04,
    ...chassisWheels[1],
    cpu: [-0.048, 0.092, -0.22],
    battery: [0, 0.063, -0.486],
    gauge: [-0.116, 0.135, 0.457],
    tool: [-0.053, -0.022, 0.533],
    toolScale: 0.83,
    shellFocus: [0.269, 0.104, 0.504],
    belly: [0, 0.091, 0.031]
  },
  {
    name: 'Rotor',
    bodyY: 0.301,
    head: [0, 0.16, -0.022],
    headScale: [1.01, 1.02, 1.0],
    faceZ: 0.12,
    arm: [0.433, 0.136, 0.083],
    readyArm: -0.08,
    armRoll: 0.078,
    reach: 0.95,
    ...chassisWheels[2],
    cpu: [0.056, 0.122, 0.237],
    battery: [0, 0.062, -0.486],
    gauge: [-0.124, 0.104, 0.475],
    tool: [-0.221, 0.061, 0.339],
    toolScale: 0.81,
    shellFocus: [0.299, 0.17, 0.386],
    belly: [0, 0.138, 0.007]
  },
  {
    name: 'Knuckle',
    bodyY: 0.59,
    head: [0, 0.51, -0.013],
    headScale: [0.411, 0.552, 0.541],
    arm: [0.466, 0.392, -0.025],
    readyArm: -0.126,
    armRoll: -0.029,
    reach: 0.997,
    ...chassisWheels[3],
    cpu: [0.013, 0.125, -0.199],
    battery: [0, 0.148, -0.26],
    gauge: [-0.114, 0.267, 0.201],
    tool: [0.26, -0.041, 0.259],
    toolScale: 0.84,
    toolHand: 1,
    handSocket: [-0.238, -0.653, 0.239],
    shellFocus: [0.231, 0.303, 0.167],
    belly: [0, 0.189, 0.004]
  },
  {
    name: 'Strider',
    bodyY: 0.611,
    head: [0, 0.41, -0.04],
    headScale: [0.425, 0.531, 0.592],
    arm: [0.555, 0.316, 0.008],
    readyArm: -0.13,
    armRoll: 0.112,
    reach: 1.02,
    ...chassisWheels[4],
    cpu: [0.05, 0.102, -0.218],
    battery: [0, 0.119, -0.245],
    gauge: [-0.116, 0.238, 0.151],
    tool: [-0.377, 0.249, 0.167],
    toolScale: 0.86,
    toolHand: -1,
    handSocket: [0.087, -0.131, 0.319],
    shellFocus: [0.345, 0.263, 0.159],
    belly: [0, 0.177, 0.007]
  },
  {
    name: 'Comet',
    bodyY: 0.348,
    head: [0, 0.231, -0.039],
    headScale: [0.551, 0.532, 0.746],
    arm: [0.376, 0.162, 0.044],
    armStagger: 0.117,
    readyArm: -0.32,
    armRoll: 0.05,
    reach: 0.99,
    ...chassisWheels[5],
    cpu: [0.003, 0.136, -0.227],
    battery: [0, 0.138, -0.398],
    gauge: [-0.12, 0.169, 0.389],
    tool: [-0.326, 0.099, 0.306],
    toolScale: 0.82,
    toolHand: -1,
    handSocket: [0.051, -0.203, 0.397],
    shellFocus: [0.249, 0.18, 0.327],
    belly: [0, 0.121, 0.025]
  }
]

export function revolved(p, key, profile, at, scale, tint, finish, rotation = [0, 0, 0], sides = 32) {
  const g = p.template(
    key,
    () =>
      new T.LatheGeometry(
        profile.map((v) => new T.Vector2(...v)),
        p.compact ? Math.max(12, Math.round(sides * 0.62)) : sides
      )
  )
  p.add(g, tint, finish, at, scale, rotation)
}

// A genuine extruded face with a small turned lip; used for distinctive signs,
// sight fins and the soft bristles of the toy brush.
function badge(p, key, outline, thickness, at, tint, finish, rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const g = p.template('badge ' + key, () => {
    const shape = new T.Shape()
    outline.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)))
    shape.closePath()
    return new T.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.005,
      bevelSegments: 1,
      curveSegments: 3
    })
  })
  p.add(g, tint, finish, at, scale, rotation)
}

// A closed, folded sheet-metal shell with eight clipped corners. The front
// and rear heights are independent so each chassis has a real raked roof.
export function armorCowl(p, key, at, width, depth, bottom, front, rear, cut, tint, finish) {
  const geometry = p.template('folded ' + key, () => {
    const x = width * 0.5,
      z = depth * 0.5,
      c = Math.min(cut, x * 0.8, z * 0.8)
    const edge = [
      [-x + c, z],
      [x - c, z],
      [x, z - c],
      [x, -z + c],
      [x - c, -z],
      [-x + c, -z],
      [-x, -z + c],
      [-x, z - c]
    ]
    const verts = [],
      indices = []
    for (let ring = 0; ring < 4; ring++)
      for (const [xx, zz] of edge) {
        const scale = [0.9, 1, 1, 0.9][ring],
          top = front + (rear - front) * (0.5 - zz / depth)
        const bevel = Math.min(0.041, (top - bottom) * 0.22)
        verts.push(xx * scale, [bottom, bottom + bevel, top - bevel, top][ring], zz * scale)
      }
    for (let ring = 0; ring < 3; ring++)
      for (let i = 0; i < 8; i++) {
        const a = ring * 8 + i,
          b = ring * 8 + ((i + 1) % 8)
        indices.push(a, b, b + 8, a, b + 8, a + 8)
      }
    for (let i = 1; i < 7; i++) indices.push(0, i + 1, i, 24, 24 + i, 25 + i)
    const geo = new T.BufferGeometry()
    geo.setAttribute('position', new T.Float32BufferAttribute(verts, 3))
    geo.setIndex(indices)
    const flat = geo.toNonIndexed()
    flat.computeVertexNormals()
    // Mark the outside of the upper and lower rolled lips. The centers of
    // the roof, side panels and underside retain their unbroken powder coat.
    flat.userData.fold = Uint8Array.from(indices, (i, vertex) => {
      const band = Math.floor(vertex / 48), ring = Math.floor(i / 8)
      return (band === 0 && ring === 1) || (band === 2 && ring === 2) ? 255 : 0
    })
    geo.dispose()
    return flat
  })
  p.add(geometry, tint, finish, at)
}

export function facePlate(p, key, outline, at, depth, tint, finish = metal, rotation = [0, 0, 0]) {
  badge(p, key, outline, depth, at, tint, finish, rotation)
}

export function mountParts(p, at, build, scale = [1, 1, 1]) {
  const first = p.pieces.length
  build()
  const m = new T.Matrix4().makeScale(...scale).setPosition(...at)
  for (let i = first; i < p.pieces.length; i++) p.pieces[i].matrix.premultiply(m)
}

export function roverFrame(p) {
  armorCowl(p, 'rover belly', [0, 0, -0.02], 0.95, 1.34, -0.12, 0.076, 0.12, 0.145, graphite, soft)
  for (const side of [-1, 1]) {
    p.rod([side * 0.415, 0.055, -0.52], [side * 0.415, 0.074, 0.505], 0.047, steel, metal, 12)
    for (const z of [-0.44, 0.4]) {
      p.rod([side * 0.33, 0.124, z - 0.085], [side * 0.478, -0.085, z + 0.038], 0.04, darkSteel, metal, 10)
    }
  }
  p.cylinder([0, 0.286, 0.35], 0.226, 0.17, graphite, 'y', soft)
  p.ring([0, 0.346, 0.35], 0.221, 0.032, steel, 'y')
  p.block([0, 0.137, -0.51], [0.55, 0.2, 0.22], 0.033, darkSteel, metal)
}

export function orbFrame(p) {
  revolved(
    p,
    'orb inner frame',
    [
      [0.18, -0.18],
      [0.34, -0.09],
      [0.49, 0.13],
      [0.51, 0.32],
      [0.47, 0.54],
      [0.39, 0.565]
    ],
    [0, 0, -0.048],
    [1, 1, 0.92],
    graphite,
    soft
  )
  p.cylinder([0, 0.518, -0.045], 0.461, 0.084, steel, 'y', metal)
  p.block([0, 0.2, -0.445], [0.46, 0.27, 0.13], 0.041, graphite, soft)
  p.block([0, 0.082, 0.457], [0.31, 0.052, 0.04], 0.015, graphite, soft)
}

export function honeyPanel(p, at, angle) {
  const geometry = p.template('vented honey mould', () => {
    const radius = 0.096
    const exposed = new Map(),
      holes = []
    const key = ([x, y]) => Math.round(x * 10000) + ',' + Math.round(y * 10000)
    for (const [q, r] of [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1]
    ]) {
      const x = (q + r * 0.5 - 1) * radius * Math.sqrt(3),
        y = (r - 0.49) * 1.5 * radius
      const corners = [],
        inner = []
      for (let j = 0; j < 6; j++) {
        const a = ((j + 0.5) * TAU) / 6,
          dx = radius * Math.cos(a),
          dy = radius * Math.sin(a)
        corners.push([x + dx, y + dy])
        inner.push([x + dx * 0.69, y + dy * 0.69])
      }
      const hole = new T.Path()
      inner.forEach(([x, y], i) => (i ? hole.lineTo(x, y) : hole.moveTo(x, y)))
      hole.closePath()
      holes.push(hole)
      for (let j = 0; j < 6; j++) {
        const a = corners[j],
          b = corners[(j + 1) % 6],
          ka = key(a),
          kb = key(b)
        if (!exposed.delete(kb + '|' + ka)) exposed.set(ka + '|' + kb, [a, b])
      }
    }
    const next = new Map([...exposed.values()].map(([a, b]) => [key(a), b]))
    const shape = new T.Shape(),
      first = exposed.values().next().value[0]
    shape.moveTo(...first)
    let v = first
    for (let i = 0; i < next.size; i++) {
      v = next.get(key(v))
      shape.lineTo(...v)
    }
    shape.closePath()
    shape.holes = holes
    return new T.ExtrudeGeometry(shape, {
      depth: 0.049,
      bevelEnabled: true,
      bevelSize: 0.004,
      bevelThickness: 0.005,
      bevelSegments: 1
    })
  })
  p.add(geometry, p.paint, metal, at, [1, 1, 1], [0, angle, 0])
}

export function alternateDrive(p, chassis) {
  if (chassis === 1) {
    for (const z of [0.403, -0.442]) {
      p.cylinder([0, 0.26, z], 0.064, 0.99, darkSteel, 'x', metal, 12)
      for (const s of [-1, 1])
        p.rod([s * 0.42, 0.247, z], [s * 0.347, 0.47, z * 0.83], 0.052, trim, lacquer, 10)
    }
  } else {
    p.ball([0, 0.172, -0.048], [0.204, 0.172, 0.202], rubber, soft)
    p.ring([0, 0.16, -0.048], 0.192, 0.017, darkSteel, 'y')
    p.cylinder([0, 0.283, -0.03], 0.113, 0.2, steel, 'y', metal)
    p.cylinder([0, 0.208, -0.021], 0.062, 0.739, trim, 'x', lacquer)
  }
}

export const toolReach = [0.263, 0.305, 0.372, 0.335]
export const slideTravel = [1.82, 1.96]
export function playTool(p, tier, shapeNose) {
  if (tier >= 2) p.ball([0, 0, 0.007], [0.105, 0.107, 0.107], graphite, soft)
  else p.cylinder([0, 0, 0.024], 0.11, 0.068, graphite, 'z', soft)
  p.cylinder([0, 0, 0.078], 0.072, 0.079, steel, 'z', metal)
  const rails = []
  if (tier < 2) {
    // Five overlapping shafts slide from the same padded swivel. The cuff
    // of each shaft follows its leading edge instead of stretching with it.
    for (const [i, radius] of [0.085, 0.074, 0.063, 0.052, 0.04].entries()) {
      const near = 0.012 + i * 0.008,
        far = 0.082 + i * 0.007
      rails.push({ index: p.pieces.length, near, far, start: i / 5, end: (i + 1) / 5 })
      p.cylinder([0, 0, (near + far) / 2], radius, far - near, i === 1 ? steel : darkSteel, 'z', metal, 14)
      p.cylinder([0, 0, far], radius + 0.009, 0.024, i === 1 ? trim : graphite, 'z', soft, 14)
    }
  }
  const nose = p.pieces.length
  shapeNose()
  const counts = p.pieces.map(({ geometry }) => geometry.attributes.position.count)
  const geometry = p.geometry()
  if (tier >= 2) return geometry
  const position = geometry.attributes.position,
    delta = new Float32Array(position.count * 3)
  let vertex = 0
  for (const [piece, count] of counts.entries()) {
    const shaft = rails.find((r) => piece === r.index || piece === r.index + 1)
    for (let i = vertex; i < vertex + count; i++) {
      let fraction = piece >= nose ? 1 : 0
      if (shaft) {
        const t =
          piece === shaft.index
            ? T.MathUtils.clamp((position.getZ(i) - shaft.near) / (shaft.far - shaft.near), 0, 1)
            : 1
        fraction = shaft.start + (shaft.end - shaft.start) * t
      }
      delta[i * 3 + 2] = fraction * slideTravel[tier]
    }
    vertex += count
  }
  geometry.morphAttributes.position = [new T.Float32BufferAttribute(delta, 3)]
  geometry.morphTargetsRelative = true
  geometry.computeBoundingSphere()
  return geometry
}
