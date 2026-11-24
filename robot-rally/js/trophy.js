import * as THREE from '../vendor/three.module.js'

const TAU = 2 * Math.PI
const brass = '#e0ae62'
const polished = '#f1c87c'
const bronze = '#a86d36'
const goldOrange = '#e89546'
const enamel = '#254446'
const graphite = '#233135'

// Each connected strip is smooth across its own rings. Separate strips preserve
// the sharp boundary between a cut face, its chamfer and the threaded bore.
function ringSurface(segments, rows, point, reverse = false) {
  const positions = []
  const indices = []
  for (let row = 0; row < rows; row++) {
    for (let j = 0; j < segments; j++) {
      positions.push(...point((j * TAU) / segments, row))
      if (row + 1 === rows) continue
      const a = row * segments + j
      const b = row * segments + ((j + 1) % segments)
      const c = a + segments
      const d = b + segments
      if (reverse) indices.push(a, c, b, b, c, d)
      else indices.push(a, b, c, b, d, c)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

function merge(pieces) {
  const positions = []
  const normals = []
  const colors = []
  const indices = []
  for (const [geometry, tint] of pieces) {
    const start = positions.length / 3
    const p = geometry.attributes.position
    const n = geometry.attributes.normal
    const color = new THREE.Color(tint)
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i))
      normals.push(n.getX(i), n.getY(i), n.getZ(i))
      colors.push(color.r, color.g, color.b)
    }
    const count = geometry.index?.count ?? p.count
    for (let i = 0; i < count; i++) indices.push(start + (geometry.index ? geometry.index.getX(i) : i))
    geometry.dispose()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute(
    'normal',
    new THREE.Int16BufferAttribute(
      normals.map((n) => Math.round(n * 32767)),
      3,
      true
    )
  )
  g.setAttribute(
    'color',
    new THREE.Uint16BufferAttribute(
      colors.map((v) => Math.round(v * 65535)),
      3,
      true
    )
  )
  g.setIndex(indices)
  g.computeBoundingSphere()
  return g
}

function nut(alloy) {
  const y = 0.75
  const radius = 0.403
  const apothem = radius * Math.cos(Math.PI / 6)
  const hexRadius = (angle) => apothem / Math.cos((angle % (Math.PI / 3)) - Math.PI / 6)
  const cut = (angle, z, mix, round) => {
    const r = hexRadius(angle) * mix + round * (1 - mix)
    return [Math.cos(angle) * r, y + Math.sin(angle) * r, z]
  }
  const ring = (angle, z, r) => [Math.cos(angle) * r, y + Math.sin(angle) * r, z]
  const sides = 48
  // The center band keeps all six wrench flats planar.
  for (let face = 0; face < 6; face++) {
    const a = (face * TAU) / 6
    const b = ((face + 1) * TAU) / 6
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [...cut(a, -0.061, 1, 0), ...cut(b, -0.061, 1, 0), ...cut(a, 0.061, 1, 0), ...cut(b, 0.061, 1, 0)],
        3
      )
    )
    g.setIndex([0, 1, 2, 1, 3, 2])
    g.computeVertexNormals()
    alloy.push([g, brass])
  }
  // A turned circular bevel is cut across the hexagonal corners on both sides.
  for (const side of [-1, 1]) {
    const reverse = side < 0
    const lip = [
      [0.061, 1],
      [0.071, 0.89],
      [0.104, 0.16],
      [0.108, 0]
    ]
    alloy.push([
      ringSurface(
        sides,
        lip.length,
        (a, row) => {
          const [z, mix] = lip[row]
          return cut(a, side * z, mix, 0.325)
        },
        reverse
      ),
      brass
    ])
    const front = [
      [0.108, 0.325],
      [0.108, 0.219],
      [0.105, 0.211],
      [0.079, 0.187]
    ]
    alloy.push([
      ringSurface(
        sides,
        front.length,
        (a, row) => {
          const [z, r] = front[row]
          return ring(a, side * z, r)
        },
        reverse
      ),
      polished
    ])
  }
  // A continuous helical ridge is cut into the wall inside the opening.
  const rows = 22
  alloy.push([
    ringSurface(sides, rows, (a, row) => {
      const v = row / (rows - 1)
      const thread = 0.5 + 0.5 * Math.cos(TAU * v * 2.6 + a)
      const entrance = Math.min(1, v * 11, (1 - v) * 11)
      const r = 0.187 - 0.021 * entrance * thread
      return ring(a, 0.079 - 0.158 * v, r)
    }),
    bronze
  ])
}

function baseRing(r1, r2, y1, y2) {
  const g = new THREE.CylinderGeometry(r2, r1, y2 - y1, 12, 1, false, Math.PI / 12)
  g.scale(1, 1, 0.72)
  g.translate(0, (y1 + y2) * 0.5, 0)
  return g
}

function relief(points, depth, at, bevel = 0) {
  const shape = new THREE.Shape()
  shape.moveTo(...points[0])
  for (const point of points.slice(1)) shape.lineTo(...point)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 3
  })
  return g.translate(...at)
}

function pedestal(alloy, paint) {
  paint.push([baseRing(0.333, 0.363, 0, 0.023), graphite])
  paint.push([baseRing(0.363, 0.363, 0.023, 0.048), graphite])
  alloy.push([baseRing(0.364, 0.362, 0.048, 0.062), goldOrange])
  paint.push([baseRing(0.359, 0.324, 0.062, 0.216), enamel])
  paint.push([baseRing(0.324, 0.305, 0.216, 0.232), graphite])

  const foot = [
    [0.188, 0.232],
    [0.19, 0.245],
    [0.175, 0.257],
    [0.13, 0.267],
    [0.08, 0.292],
    [0.07, 0.341],
    [0.1, 0.382],
    [0.139, 0.397],
    [0.139, 0.411],
    [0.131, 0.414],
    [0, 0.414]
  ]
  const stem = new THREE.LatheGeometry(
    foot.map(([x, y]) => new THREE.Vector2(x, y)),
    32
  )
  alloy.push([stem, brass])

  const plate = [
    [-0.143, -0.046],
    [-0.133, -0.054],
    [0.133, -0.054],
    [0.143, -0.046],
    [0.143, 0.046],
    [0.133, 0.054],
    [-0.133, 0.054],
    [-0.143, 0.046]
  ]
  const plateY = 0.139
  // The mounting face follows the plinth's draft angle.
  const mount = (geometry) => geometry.rotateX(-0.151).translate(0, plateY, 0.237)
  alloy.push([mount(relief(plate, 0.009, [0, 0, 0], 0.002)), polished])

  const one = [
    [0.01, 0.02],
    [0.033, 0.037],
    [0.047, 0.037],
    [0.047, -0.022],
    [0.06, -0.022],
    [0.06, -0.034],
    [0.016, -0.034],
    [0.016, -0.022],
    [0.03, -0.022],
    [0.03, 0.015],
    [0.018, 0.008]
  ]
  paint.push([mount(relief(one, 0.002, [0, 0, 0.011])), graphite])
  const wrench = [
    [-0.041, -0.01],
    [0.003, -0.009],
    [0.014, -0.023],
    [0.034, -0.025],
    [0.044, -0.015],
    [0.025, -0.011],
    [0.021, 0.003],
    [0.03, 0.012],
    [0.047, 0.009],
    [0.039, 0.022],
    [0.018, 0.024],
    [0.004, 0.011],
    [-0.042, 0.009],
    [-0.048, 0],
    [-0.041, -0.01]
  ]
  const tool = relief(wrench, 0.002, [0, 0, 0]).rotateZ(0.5).translate(-0.047, 0, 0.011)
  paint.push([mount(tool), graphite])
  for (const x of [-0.119, 0.119]) {
    const pin = new THREE.CylinderGeometry(0.006, 0.006, 0.003, 8).rotateX(Math.PI / 2).translate(x, 0, 0.011)
    alloy.push([mount(pin), bronze])
  }
}

/** Create the first-place workshop trophy. The base rests on y=0, plaque toward +Z.
 * Add group to a Three.js scene. dispose() detaches the group and releases its GPU resources.
 */
export function createTrophy() {
  const group = new THREE.Group()
  group.name = '小扳手的冠軍金螺帽'
  const alloy = []
  const paint = []
  nut(alloy)
  pedestal(alloy, paint)
  for (const [pieces, name, metalness, roughness] of [
    [alloy, 'Machined brass', 0.72, 0.29],
    [paint, 'Enamel plinth', 0.19, 0.42]
  ]) {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, metalness, roughness })
    const mesh = new THREE.Mesh(merge(pieces), material)
    mesh.name = name
    mesh.castShadow = mesh.receiveShadow = true
    group.add(mesh)
  }
  let disposed = false
  function dispose() {
    if (disposed) return
    disposed = true
    group.removeFromParent()
    for (const mesh of group.children) {
      mesh.geometry.dispose()
      mesh.material.dispose()
    }
  }
  return { group, dispose }
}
