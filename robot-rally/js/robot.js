import {
  carriers,
  sensorBridge,
  sensorLight,
  integratedOptic,
  serviceBrain,
  serviceArmor,
  machineDrive,
  machineArm,
  handPlan,
  stockWheel,
  wristStroke
} from './competition-rigs.js'
import { motorKit, powerKit, toolNose } from './robot-race-kit.js'
import * as THREE from '../vendor/three.module.js'
import { coatFor } from './palette.js'
import { tireWidths } from './wheel-motion.js'
import { palmRest, restReach } from './bumper-contact.js'
import { chassisMark } from './chassis-marks.js'
import { bakeSurfaces, paintSpans, acquireSurfaceMaterial, releaseSurfaceMaterial } from './surface-batch.js'

import { colors, finishes, forms, mountParts, toolReach, slideTravel, playTool } from './robot-forms.js'

// The body, face and each moving joint use one indexed mesh each. Surface finish is
// a vertex attribute, so a chrome screw and its enamel panel can share a draw call.
const PI = Math.PI
const TAU = 2 * PI
const { ivory, trim, graphite, rubber, steel, darkSteel, cyan, amber } = colors
const { porcelain, lacquer, metal, soft, lit } = finishes
const yAxis = new THREE.Vector3(0, 1, 0)
const toolStroke = [0, 0, -0.052, 0.025]
// A single bevel keeps the small details legible at arena distance. The 24
// tangent vertices share across the six flat faces, twelve edges and eight
// corners. Their axis normals blend across the edges as on rolled enamel.
function compactBlock(w, h, d, radius) {
  const half = [w / 2, h / 2, d / 2],
    r = Math.min(radius, ...half) * 0.998
  const positions = [],
    normals = [],
    indices = []
  for (let corner = 0; corner < 8; corner++) {
    for (let face = 0; face < 3; face++) {
      for (let axis = 0; axis < 3; axis++) {
        const sign = corner & (1 << axis) ? 1 : -1
        positions.push(sign * (half[axis] - (face === axis ? 0 : r)))
        normals.push(face === axis ? sign : 0)
      }
    }
  }
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    normal = new THREE.Vector3()
  function polygon(vertices) {
    const [u, v, w] = vertices
    a.fromArray(positions, u * 3)
    b.fromArray(positions, v * 3).sub(a)
    c.fromArray(positions, w * 3).sub(a)
    normal
      .fromArray(normals, u * 3)
      .add(a.fromArray(normals, v * 3))
      .add(a.fromArray(normals, w * 3))
    if (b.cross(c).dot(normal) < 0) vertices.reverse()
    for (let i = 1; i + 1 < vertices.length; i++) indices.push(vertices[0], vertices[i], vertices[i + 1])
  }
  const corners = [0, 1, 2, 3, 4, 5, 6, 7]
  for (const corner of corners) polygon([3 * corner, 3 * corner + 1, 3 * corner + 2])
  for (let axis = 0; axis < 3; axis++) {
    const first = (axis + 1) % 3,
      second = (axis + 2) % 3
    const bit = 1 << axis
    for (const start of [0, bit]) {
      polygon(
        [start, start ^ (1 << first), start ^ (1 << first) ^ (1 << second), start ^ (1 << second)].map(
          (c) => 3 * c + axis
        )
      )
    }
    for (const corner of corners) {
      if (corner & bit) continue
      const next = corner ^ bit
      polygon([3 * corner + first, 3 * next + first, 3 * next + second, 3 * corner + second])
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  return geometry
}

function roundedBlock(w, h, d, r, steps) {
  const half = [w / 2, h / 2, d / 2]
  r = Math.min(r, ...half) * 0.998
  const edge = half.map((a) => a - r)
  const geometry = new THREE.BoxGeometry(1, 1, 1, 2 * steps + 1, 2 * steps + 1, 2 * steps + 1)
  const position = geometry.attributes.position
  const normal = geometry.attributes.normal
  const point = new THREE.Vector3()
  const core = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i)
    for (let axis = 0; axis < 3; axis++) {
      const v = point.getComponent(axis)
      const j = Math.round(Math.abs(v) * (2 * steps + 1) - 0.5)
      point.setComponent(axis, Math.sign(v) * (edge[axis] + (r * j) / steps))
      core.setComponent(axis, THREE.MathUtils.clamp(point.getComponent(axis), -edge[axis], edge[axis]))
    }
    n.copy(point).sub(core).normalize()
    point.copy(core).addScaledVector(n, r)
    position.setXYZ(i, point.x, point.y, point.z)
    normal.setXYZ(i, n.x, n.y, n.z)
  }
  return geometry
}

// The visor's plan-view corner radius is independent of its thickness. Cross
// sections curve smoothly around the lip, as on a molded lens or rubber seal.
function panelGeometry(w, h, d, radius, compact = false) {
  const positions = []
  const normals = []
  const indices = []
  const bevel = Math.min(d * 0.47, 0.035)
  const steps = compact ? 5 : 7
  const bevelSteps = compact ? 3 : 4
  const perimeter = (steps + 1) * 4
  const signs = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1]
  ]
  const rings = [
    [0, -d / 2, 0],
    [0, d / 2 - bevel, 0]
  ]
  for (let j = 1; j <= bevelSteps; j++) {
    const phi = (j * PI) / (2 * bevelSteps)
    rings.push([bevel * (1 - Math.cos(phi)), d / 2 - bevel + bevel * Math.sin(phi), phi])
  }
  for (const [inset, z, phi] of rings) {
    for (let side = 0; side < 4; side++) {
      const [sx, sy] = signs[side]
      for (let i = 0; i <= steps; i++) {
        const theta = (PI / 2) * (side + i / steps)
        const nx = Math.cos(theta)
        const ny = Math.sin(theta)
        positions.push(
          sx * (w / 2 - radius) + nx * (radius - inset),
          sy * (h / 2 - radius) + ny * (radius - inset),
          z
        )
        normals.push(nx * Math.cos(phi), ny * Math.cos(phi), Math.sin(phi))
      }
    }
  }
  for (let j = 1; j < rings.length; j++) {
    for (let i = 0; i < perimeter; i++) {
      const a = (j - 1) * perimeter + i
      const b = (j - 1) * perimeter + ((i + 1) % perimeter)
      indices.push(a, b, a + perimeter, b, b + perimeter, a + perimeter)
    }
  }
  const capStart = (rings.length - 1) * perimeter
  const center = positions.length / 3
  positions.push(0, 0, d / 2)
  normals.push(0, 0, 1)
  for (let i = 0; i < perimeter; i++) indices.push(center, capStart + i, capStart + ((i + 1) % perimeter))
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  g.setIndex(indices)
  return g
}

class Parts {
  constructor(cache, paint, compact) {
    this.cache = cache
    this.paint = paint
    this.compact = compact
    this.pieces = []
  }

  template(key, make) {
    if (!this.cache.has(key)) this.cache.set(key, make())
    return this.cache.get(key)
  }

  add(geometry, color, finish, at, scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const q = rotation.isQuaternion
      ? rotation
      : new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation))
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...at), q, new THREE.Vector3(...scale))
    this.pieces.push({
      geometry,
      color:
        color === this.paint || color === this.paint.coat
          ? color
          : (color === ivory && finish === porcelain) || (color === trim && finish === lacquer)
            ? this.paint.coat
            : new THREE.Color(color),
      finish,
      matrix
    })
  }

  block(at, size, radius, color, finish = porcelain, rotation = [0, 0, 0], steps = radius < 0.032 ? 1 : 2) {
    if (!radius) {
      this.add(
        this.template('cube', () => new THREE.BoxGeometry()),
        color,
        finish,
        at,
        size,
        rotation
      )
      return
    }
    if (this.compact) steps = Math.max(1, steps - 1)
    const key = 'box:' + [...size, radius, steps].join(',')
    const g = this.template(key, () =>
      this.compact && steps === 1 ? compactBlock(...size, radius) : roundedBlock(...size, radius, steps)
    )
    this.add(g, color, finish, at, [1, 1, 1], rotation)
  }

  panel(at, size, radius, color, finish) {
    const key = 'panel:' + [...size, radius].join(',')
    this.add(
      this.template(key, () => panelGeometry(...size, radius, this.compact)),
      color,
      finish,
      at
    )
  }

  ball(at, size, color, finish = porcelain) {
    const fine = Math.max(...size) > 0.11
    const horizontal = this.compact ? (fine ? 14 : 10) : fine ? 20 : 14
    const vertical = this.compact ? (fine ? 9 : 6) : fine ? 12 : 9
    const g = this.template('sphere' + fine, () => new THREE.SphereGeometry(1, horizontal, vertical))
    this.add(g, color, finish, at, size, [0, 0, 0])
  }

  cylinder(at, radius, height, color, axis = 'y', finish = metal, sides = 24) {
    if (this.compact) sides = Math.max(6, Math.round(sides * 0.63))
    const g = this.template('cylinder' + sides, () => new THREE.CylinderGeometry(1, 1, 1, sides))
    const rotation = axis === 'x' ? [0, 0, PI / 2] : axis === 'z' ? [PI / 2, 0, 0] : [0, 0, 0]
    this.add(g, color, finish, at, [radius, height, radius], rotation)
  }

  rod(a, b, radius, color, finish = metal, sides = 10) {
    if (this.compact) sides = Math.max(6, Math.round(sides * 0.63))
    const delta = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const length = delta.length()
    const q = new THREE.Quaternion().setFromUnitVectors(yAxis, delta.normalize())
    const g = this.template('cylinder' + sides, () => new THREE.CylinderGeometry(1, 1, 1, sides))
    this.add(
      g,
      color,
      finish,
      a.map((v, i) => (v + b[i]) / 2),
      [radius, length, radius],
      q
    )
  }

  ring(at, radius, wire, color, axis = 'z', finish = metal, arc = TAU) {
    const key = 'ring:' + [radius, wire, arc].join(',')
    const sides = arc === TAU ? (this.compact ? 22 : 32) : this.compact ? 13 : 18
    const g = this.template(
      key,
      () => new THREE.TorusGeometry(radius, wire, this.compact ? 5 : 6, sides, arc)
    )
    const rotation = axis === 'x' ? [0, PI / 2, 0] : axis === 'y' ? [PI / 2, 0, 0] : [0, 0, 0]
    this.add(g, color, finish, at, [1, 1, 1], rotation)
  }

  geometry() {
    const geometry = bakeSurfaces(this.pieces, this.paint)
    this.pieces.length = 0
    return geometry
  }
}

function joint(parent, name, x, y, z) {
  const group = new THREE.Group()
  group.name = name
  group.position.set(x, y, z)
  parent.add(group)
  return group
}

function screw(parts, x, y, z, radius = 0.024) {
  parts.cylinder([x, y, z], radius, 0.011, darkSteel, 'z', metal, 10)
  parts.block([x, y, z + 0.0065], [radius * 1.04, radius * 0.23, 0.005], 0, graphite, soft, [0, 0, 0.65])
}

// These normally concealed faces are generated on the first inspection. Their
// indices sit at the very end of the head batch, outside the closed draw range.
function buildVisorBack(p) {
  const cap = p.template('visor back', () => panelGeometry(1.026, 0.296, 0.024, 0.061))
  p.add(cap, graphite, soft, [0, -0.006, 0.254], [1, 1, 1], [0, PI, 0])
  p.block([0.12, 0.005, 0.235], [0.34, 0.115, 0.021], 0.009, trim, lacquer)
  for (let j = 0; j < 6; j++) {
    p.block([0.028 + 0.037 * j, 0.005, 0.222], [0.017, 0.079, 0.006], 0, amber, metal)
  }
  for (const x of [-0.4, 0.4]) {
    p.cylinder([x, -0.02, 0.237], 0.023, 0.014, darkSteel, 'z', metal, 8)
  }
}

function buildVisorSocket(p) {
  p.block([0, -0.006, 0.433], [0.62, 0.253, 0.021], 0.01, trim, lacquer)
  p.block([-0.145, 0.003, 0.451], [0.166, 0.132, 0.018], 0.008, graphite, soft)
  for (let j = 0; j < 6; j++) {
    p.block([0.028 + 0.037 * j, 0.005, 0.449], [0.017, 0.079, 0.01], 0, amber, metal)
  }
  for (const s of [-1, 1]) screw(p, s * 0.257, -0.073, 0.448, 0.012)
}

function eyeGeometry(p, lens, chassis) {
  const scan = (victory) => sensorLight(p, chassis, lens, victory)
  scan(false)
  // A warm alternate instrument display marks a win without changing the
  // number of meshes or rebuilding the lights.
  const openCount = p.pieces.reduce(
    (n, { geometry }) => n + (geometry.index?.count ?? geometry.attributes.position.count),
    0
  )
  scan(true)
  const geometry = p.geometry()
  geometry.userData.openCount = openCount
  geometry.setDrawRange(0, openCount)
  return geometry
}

function lightEyes(geometry, happy) {
  const open = geometry.userData.openCount
  const start = happy ? open : 0
  if (geometry.drawRange.start !== start)
    geometry.setDrawRange(start, happy ? geometry.index.count - open : open)
}

const fitPanels = Symbol('fit compact panels')
const slots = ['brain', 'motor', 'cell', 'shell', 'lens', 'weapon']
const canonicalSlot = (slot) => (slot === 'cpu' || slot === 'logic' ? 'brain' : slot)
const runningRadius = (motor) => (motor >= 0 ? radii[motor] : 0.178)
const radii = [0.228, 0.241, 0.249, 0.253]
const streams = ['position', 'normal', 'color', 'surface']

// Positions are local to the head or chest, with +Z toward the visor.
const travel = {
  brain: { inspect: [-0.25, 0.4, -0.09], install: [0, 0.15, -0.035] },
  cell: { inspect: [0.58, 0.15, -0.62], install: [0, 0.045, -0.25], focus: [0, 0.19, -0.45] },
  shell: { inspect: [-0.61, 0.18, 0.05], install: [0, 0.11, 0.045], focus: [-0.28, 0.22, 0.21] },
  lens: { inspect: [0.61, 0.18, 0.38], install: [0, 0.022, 0.095] }
}
const movingPanels = Object.keys(travel)

function makeMesh(parent, name, material, geometry = new THREE.BufferGeometry()) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function replaceGeometry(mesh, geometry) {
  mesh.geometry.dispose()
  mesh.geometry = geometry
}

// A second selection can arrive before the next render. Preserve the entire
// pending upload in that case, including an in-flight cartridge animation.
function changedRange(attribute, start, count) {
  if (count <= 0) return
  const pending = attribute.updateRanges[0]
  if (pending) {
    const end = Math.max(pending.start + pending.count, start + count)
    pending.start = Math.min(pending.start, start)
    pending.count = end - pending.start
  } else {
    attribute.addUpdateRange(start, count)
  }
  attribute.needsUpdate = true
}

// In a combined mesh the baked module and the live colour buffer both need
// the new finish, so a later part swap can repack the module without reverting it.
function paintGeometry(source, rgb, live = source.attributes.color, vertexOffset = 0) {
  const spans = paintSpans.get(source)
  if (!spans) return
  const colors = source.attributes.color.array
  for (const [start, end, layer] of spans) {
    const shade = rgb[layer]
    for (let i = start; i < end; i += 3) {
      colors[i] = shade[0]
      colors[i + 1] = shade[1]
      colors[i + 2] = shade[2]
    }
    const at = vertexOffset * 3 + start
    if (live.array !== colors) live.array.set(colors.subarray(start, end), at)
    changedRange(live, at, end - start)
  }
}

// The head and chest each remain one draw. Keep the fixed frame first and each
// installed module's baked source so an unchanged section never needs tessellation.
class ModuleBatch {
  constructor(mesh, fixed) {
    this.mesh = mesh
    this.sections = new Map()
    this.set('frame', fixed)
  }

  set(name, source) {
    this.sections.get(name)?.source.dispose()
    this.sections.set(name, { source, vertex: -1, element: -1 })
  }

  pack() {
    const mesh = this.mesh
    let geometry = mesh.geometry
    let vertices = 0,
      elements = 0
    for (const { source } of this.sections.values()) {
      vertices += source.attributes.position.count
      elements += source.index.count
    }
    const resize =
      !geometry.index || vertices > geometry.attributes.position.count || elements > geometry.index.count
    if (resize) {
      geometry = new THREE.BufferGeometry()
      // Small spare capacity handles most tier changes without replacing GPU buffers.
      const vertexCapacity = Math.ceil((vertices * 1.09) / 64) * 64
      const indexCapacity = Math.ceil((elements * 1.09) / 96) * 96
      const frame = this.sections.get('frame').source
      for (const key of streams) {
        const original = frame.attributes[key]
        const array = new original.array.constructor(vertexCapacity * original.itemSize)
        geometry.setAttribute(
          key,
          new THREE.BufferAttribute(array, original.itemSize, original.normalized).setUsage(THREE.DynamicDrawUsage)
        )
      }
      geometry.setIndex(
        new THREE.BufferAttribute(new Uint16Array(indexCapacity), 1).setUsage(THREE.DynamicDrawUsage)
      )
      replaceGeometry(mesh, geometry)
    }
    let vertex = 0,
      element = 0
    const bounds = new THREE.Sphere()
    for (const part of this.sections.values()) {
      const src = part.source
      if (resize || part.vertex !== vertex) {
        for (const key of streams) {
          const attribute = geometry.attributes[key]
          const data = src.attributes[key].array
          const start = vertex * attribute.itemSize
          attribute.array.set(data, start)
          changedRange(attribute, start, data.length)
        }
      }
      if (resize || part.vertex !== vertex || part.element !== element) {
        const indices = geometry.index.array
        for (let i = 0; i < src.index.count; i++) indices[element + i] = src.index.array[i] + vertex
        changedRange(geometry.index, element, src.index.count)
      }
      part.vertex = vertex
      part.element = element
      vertex += src.attributes.position.count
      element += src.index.count
      bounds.union(src.boundingSphere)
    }
    // Vertex slack is never submitted to the GPU as triangles.
    geometry.setDrawRange(0, element)
    this.elementCount = element
    this.restRadius = bounds.radius
    geometry.boundingSphere = bounds
    geometry.boundingBox = null
  }

  paint(rgb) {
    const live = this.mesh.geometry.attributes.color
    for (const part of this.sections.values()) paintGeometry(part.source, rgb, live, part.vertex)
  }

  slide(name, dx, dy, dz) {
    const part = this.sections.get(name)
    const p = part.source.attributes.position.array
    const live = this.mesh.geometry.attributes.position
    const start = part.vertex * 3
    if (dx === 0 && dy === 0 && dz === 0) {
      live.array.set(p, start)
    } else {
      for (let i = 0; i < p.length; i += 3) {
        live.array[start + i] = p[i] + dx
        live.array[start + i + 1] = p[i + 1] + dy
        live.array[start + i + 2] = p[i + 2] + dz
      }
    }
    changedRange(live, start, p.length)
    this.mesh.geometry.boundingBox = null
  }

  dispose() {
    for (const { source } of this.sections.values()) source.dispose()
    this.sections.clear()
  }
}

/** Feet rest on y=0 and the visor looks along +Z. setBuild accepts a full build
 * or just the changed slots. setPaint takes a Three.js colour representation
 * (for example "#2c9d9b") and updates only this robot's team-colour vertices.
 */
export function createRobot(build = {}, color = '#f0a24f', compact = false) {
  const group = new THREE.Group()
  group.name = 'Rally robot'
  const material = acquireSurfaceMaterial()
  const templates = new Map()
  const paint = new THREE.Color(color)
  paint.coat = new THREE.Color(coatFor('#' + paint.getHexString()))
  const p = new Parts(templates, paint, compact)
  const chassisIndex = (value) => THREE.MathUtils.clamp(Math.trunc(Number(value)) || 0, 0, forms.length - 1)
  let chassis = chassisIndex(build.chassis),
    form = forms[chassis]
  function fixedFrame() {
    carriers[chassis](p)
    if (chassis !== 2) chassisMark(p, chassis)
    const [x, y, z] = form.gauge
    p.block([x + 0.118, y, z - 0.023], [0.267, 0.052, 0.046], 0.01, graphite, soft)
    for (const dx of [0.03, 0.205])
      p.rod([x + dx, y - 0.071, z - 0.114], [x + dx, y - 0.006, z - 0.022], 0.022, darkSteel, metal, 8)
  }
  function fixedHead() {
    sensorBridge(p, chassis)
    if (chassis === 2) chassisMark(p, chassis)
  }
  const chest = joint(group, 'Suspended chassis', 0, form.bodyY, 0)
  const head = joint(chest, 'Gimbal head', ...form.head)
  const eyes = joint(head, 'Phosphor eyes', 0, 0.027, 0)
  const arms = [],
    wheels = [],
    wheelMeshes = [],
    rearWheels = [],
    rearRims = [],
    paintedMeshes = []
  for (const s of [-1, 1]) {
    const wheel = joint(group, 'Drive wheel', s * form.axle[0], radii[0] * form.wheelScale, form.axle[1])
    const rim = makeMesh(wheel, 'Tire, rim and hub', material)
    wheelMeshes.push(rim)
    paintedMeshes.push(rim)
    wheels.push(wheel)
    const rear = joint(group, 'Rear drive wheel', 0, 0, 0)
    rearWheels.push(rear)
    rearRims.push(makeMesh(rear, 'Rear tire and rim', material, rim.geometry))
    const arm = joint(chest, 'Shoulder joint', s * form.arm[0], form.arm[1], form.arm[2])
    paintedMeshes.push(makeMesh(arm, 'Arm and padded gripper', material, machineArm(p, chassis, s)))
    arms.push(arm)
  }
  const drive = makeMesh(group, 'Drivetrain and caster', material)
  paintedMeshes.push(drive)
  fixedFrame()
  const bodyBatch = new ModuleBatch(makeMesh(chest, 'Chest and replaceable modules', material), p.geometry())
  fixedHead()
  const headBatch = new ModuleBatch(makeMesh(head, 'Helmet, visor and radio', material), p.geometry())
  const display = makeMesh(eyes, 'Display', material)
  const gauge = joint(chest, 'Charge indicator', ...form.gauge)
  p.block([0.118, 0, 0], [0.236, 0.019, 0.011], 0.005, cyan, lit)
  makeMesh(gauge, 'Battery light', material, p.geometry())

  const toolMount = joint(chest, 'Front tool socket', ...form.tool)
  const toolAction = joint(toolMount, 'Tool head', 0, 0, 0)
  const toolMesh = makeMesh(toolAction, 'Workshop toy tool', material)
  paintedMeshes.push(toolMesh)
  const surfaceMeshes = []
  group.traverse((node) => {
    if (node.isMesh) surfaceMeshes.push(node)
  })
  const active = { chassis }
  const offset = Object.fromEntries(movingPanels.map((key) => [key, new THREE.Vector3()]))
  let lastSlot = '',
    lastSpring = 0,
    lastSpread = 0
  let inspectionReady = false,
    visorOpen = false
  let lastHand = 1
  let previousTime,
    wheelAngle = 0,
    brushAngle = 0,
    toolExtension = 0,
    disposed = false
  let arenaSkin = null,
    compactFinish = material
  const clamp = THREE.MathUtils.clamp
  const palm = new THREE.Vector3()
  const swing = new THREE.Quaternion()
  const wristPlane = new THREE.Vector3()
  const toolSight = new THREE.Vector3()
  const handDirections = [new THREE.Vector3(), new THREE.Vector3()]
  const palmAt = [palmRest, palmRest],
    palmReach = [restReach, restReach]

  function clearTemplates() {
    for (const geometry of templates.values()) geometry.dispose()
    templates.clear()
  }

  function drawConcealedFaces() {
    if (!inspectionReady) return
    const count = visorOpen ? headBatch.elementCount : headBatch.sections.get('lensBack').element
    headBatch.mesh.geometry.setDrawRange(0, count)
  }

  function positionDrive(spread = 0, wheelFit = 0) {
    const radius = runningRadius(active.motor ?? -1) * form.wheelScale
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1
      const x = side * (form.axle[0] + 0.67 * spread + 0.19 * wheelFit)
      wheels[i].position.set(x, radius + 0.045 * spread, form.axle[1] + 0.04 * spread)
      rearWheels[i].position.set(x, radius + 0.045 * spread, (form.rear ?? 0) - 0.055 * spread)
    }
  }

  function fitChassis() {
    for (const [i, s] of [-1, 1].entries()) {
      const pt = handPlan(chassis, s).palm
      palmAt[i] = pt
      palmReach[i] = Math.hypot(...pt)
      handDirections[i].set(s * pt[0], pt[1], pt[2]).normalize()
    }
    chest.position.y = form.bodyY
    head.position.fromArray(form.head)
    head.scale.fromArray(form.headScale)
    eyes.position.z = form.faceZ || 0
    gauge.position.fromArray(form.gauge)
    toolMount.position.fromArray(form.tool)
    toolMount.scale.setScalar(form.toolScale)
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1
      const shoulder = form.shoulders?.[i] ?? form.arm
      arms[i].position.set(side * shoulder[0], shoulder[1], shoulder[2] + side * (form.armStagger || 0))
      arms[i].scale.setScalar(form.reach)
      wheels[i].scale.setScalar(form.wheelScale)
      rearWheels[i].scale.setScalar(form.wheelScale)
      rearWheels[i].visible = form.rear !== undefined
    }
    positionDrive()
  }
  fitChassis()

  // The offsets are measured in each part's existing joint space. Only changed
  // vertex ranges are uploaded during movement. A stationary inspection costs
  // the same draw count as the assembled model.
  function positionToolSocket(slot, spring, spread) {
    const hand = form.toolHand
    const socket = form.handSocket ?? [0.04, -0.363, 0.193]
    if (hand && active.weapon >= 0) {
      const i = hand < 0 ? 0 : 1,
        arm = arms[i]
      const travel = arm.children[0].morphTargetInfluences[0] * wristStroke
      arm.updateMatrix()
      toolMount.position
        .set(hand * socket[0], socket[1], socket[2])
        .addScaledVector(handDirections[i], travel)
        .applyMatrix4(arm.matrix)
      toolMount.position.z += 0.062
    } else toolMount.position.fromArray(form.tool)
    if (active.weapon >= 0) {
      toolMount.position.x -= 0.29 * spread
      toolMount.position.y -= 0.085 * spread
      toolMount.position.z += 0.49 * spread + (slot === 'weapon' ? 0.13 * spring * (1 - spread) : 0)
    }
  }
  function positionParts(slot, spring, spread, force = false) {
    if (!force && slot === lastSlot && spring === lastSpring && spread === lastSpread) return
    visorOpen = active.lens >= 0 && (spread > 0.04 || (slot === 'lens' && spring > 0.15))
    if (visorOpen && !inspectionReady) {
      mountParts(p, [0, 0, form.faceZ || 0], () => buildVisorBack(p))
      headBatch.set('lensBack', p.geometry())
      mountParts(p, [0, 0, form.faceZ || 0], () => buildVisorSocket(p))
      headBatch.set('socket', p.geometry())
      headBatch.pack()
      clearTemplates()
      inspectionReady = true
      force = true
    }
    for (const key of movingPanels) {
      if (!force && spread === lastSpread && key !== slot && key !== lastSlot) continue
      const partSpread = active[key] >= 0 ? spread : 0
      const t = key === slot && active[key] >= 0 ? spring * (1 - spread) : 0
      const { inspect, install } = travel[key]
      const x = inspect[0] * partSpread + install[0] * t
      const y = inspect[1] * partSpread + install[1] * t
      const z = inspect[2] * partSpread + install[2] * t
      const current = offset[key]
      const same = current.x === x && current.y === y && current.z === z
      if (same && (!force || !(x || y || z))) continue
      current.set(x, y, z)
      const batch = key === 'brain' || key === 'lens' ? headBatch : bodyBatch
      batch.slide(key, x, y, z)
      if (key === 'lens' && inspectionReady) headBatch.slide('lensBack', x, y, z)
    }
    const wheelFit = slot === 'motor' && active.motor >= 0 ? spring * (1 - spread) : 0
    positionDrive(active.motor >= 0 ? spread : 0, active.motor >= 0 ? wheelFit : 0)
    positionToolSocket(slot, spring, spread)
    eyes.position.x = offset.lens.x
    eyes.position.z = offset.lens.z + (form.faceZ || 0)
    headBatch.mesh.geometry.boundingSphere.radius =
      headBatch.restRadius + Math.max(offset.brain.length(), offset.lens.length())
    bodyBatch.mesh.geometry.boundingSphere.radius =
      bodyBatch.restRadius + Math.max(offset.shell.length(), offset.cell.length())
    drawConcealedFaces()
    lastSlot = slot
    lastSpring = spring
    lastSpread = spread
    if (arenaSkin) {
      arenaSkin.source[fitPanels](slot, spring, spread)
      // Lazy inspection can grow the compact helmet's packed vertex buffer.
      for (const { reference, mesh } of arenaSkin.pairs) mesh.geometry = reference.geometry
    }
  }

  function setBuild(next = {}) {
    if (disposed) return false
    const selectedBrain = next.brain ?? next.cpu ?? next.logic
    const nextChassis = 'chassis' in next ? chassisIndex(next.chassis) : chassis
    const changedFrame = nextChassis !== chassis
    const keepReduced = arenaSkin?.reduced
    let changed = changedFrame,
      headDirty = changedFrame,
      bodyDirty = changedFrame
    if (changedFrame) {
      releaseArenaSkin()
      chassis = nextChassis
      active.chassis = chassis
      form = forms[chassis]
      {
        for (const [i, arm] of arms.entries()) {
          const mesh = arm.children[0]
          replaceGeometry(mesh, machineArm(p, chassis, i === 0 ? -1 : 1))
          mesh.updateMorphTargets()
        }
      }
      fixedFrame()
      bodyBatch.set('frame', p.geometry())
      fixedHead()
      headBatch.set('frame', p.geometry())
      if (inspectionReady) {
        mountParts(p, [0, 0, form.faceZ || 0], () => buildVisorBack(p))
        headBatch.set('lensBack', p.geometry())
        mountParts(p, [0, 0, form.faceZ || 0], () => buildVisorSocket(p))
        headBatch.set('socket', p.geometry())
      }
      fitChassis()
    }
    for (const slot of slots) {
      const selection = slot === 'brain' ? selectedBrain : next[slot]
      const tier =
        selection === undefined ? (active[slot] ?? 0) : clamp(Math.trunc(Number(selection)) || 0, -1, 3)
      if (!changedFrame && tier === active[slot]) continue
      releaseArenaSkin()
      changed = true
      active[slot] = tier
      if (slot === 'brain') active.cpu = active.logic = tier
      if (slot === 'motor') {
        const r = runningRadius(tier)
        for (let i = 0; i < wheels.length; i++) {
          if (tier < 0) stockWheel(p, i === 0 ? -1 : 1, r)
          else motorKit(p, chassis, tier, i === 0 ? -1 : 1, r, tireWidths[tier] ?? 0.112)
          replaceGeometry(wheelMeshes[i], p.geometry())
          // Both physical wheels on this side share one GPU geometry; their axles rotate independently.
          rearRims[i].geometry = wheelMeshes[i].geometry
        }
        positionDrive(tier >= 0 ? lastSpread : 0, 0)
        machineDrive(p, chassis, r * form.wheelScale)
        replaceGeometry(drive, p.geometry())
      } else if (slot === 'lens') {
        if (tier >= 0) mountParts(p, [0, 0, form.faceZ || 0], () => integratedOptic(p, chassis, tier))
        headBatch.set('lens', p.geometry())
        headDirty = true
        replaceGeometry(display, eyeGeometry(p, tier, chassis))
      } else if (slot === 'brain') {
        if (tier >= 0) mountParts(p, form.cpu, () => serviceBrain(p, chassis, tier))
        headBatch.set(slot, p.geometry())
        headDirty = true
      } else if (slot === 'weapon') {
        brushAngle = 0
        toolExtension = 0
        toolAction.position.set(0, 0, 0)
        toolAction.rotation.set(0, 0, 0)
        toolAction.scale.setScalar(1)
        toolMount.rotation.set(0, 0, 0)
        toolMount.visible = tier >= 0
        replaceGeometry(
          toolMesh,
          tier >= 0 ? playTool(p, tier, () => toolNose(p, chassis, tier)) : p.geometry()
        )
        toolMesh.updateMorphTargets()
      } else {
        if (slot === 'cell' && tier >= 0) mountParts(p, form.battery, () => powerKit(p, chassis, tier))
        if (slot === 'shell' && tier >= 0) serviceArmor(p, chassis, tier)
        bodyBatch.set(slot, p.geometry())
        bodyDirty = true
      }
    }
    if (headDirty) {
      headBatch.pack()
      drawConcealedFaces()
    }
    if (bodyDirty) bodyBatch.pack()
    if (changed) positionParts(lastSlot, lastSpring, lastSpread, true)
    clearTemplates()
    if (changed && keepReduced) setArenaDetail(true)
    return changed
  }
  setBuild(build)

  function setPaint(value) {
    if (disposed) return false
    const next = paint.clone().set(value)
    if (paint.equals(next)) return false
    arenaSkin?.source.setPaint(value)
    paint.copy(next)
    paint.coat.set(coatFor('#' + next.getHexString()))
    const rgb = [paint, paint.coat].map((c) => c.toArray().map((channel) => Math.round(channel * 65535)))
    for (const mesh of paintedMeshes) paintGeometry(mesh.geometry, rgb)
    headBatch.paint(rgb)
    bodyBatch.paint(rgb)
    return true
  }

  function update({
    time = 0,
    move = 0,
    bank = 0,
    dash = 0,
    wheelLeft,
    wheelRight,
    look = 0,
    attack = 0,
    fire = attack,
    toolAim = null,
    toolContact = null,
    hand = 1,
    windingHand = hand,
    palmTarget = null,
    hit = 0,
    hitFront = 1,
    hitSide = 0,
    guard = 0,
    win = 0,
    energy = 1,
    rest = false,
    windup = 0,
    assemble = 0,
    slot = '',
    explode = 0
  } = {}) {
    if (disposed) return
    const dt = previousTime === undefined ? 0 : clamp(time - previousTime, 0, 0.1)
    previousTime = time
    wheelAngle = (wheelAngle + dt * move * 8.5) % TAU
    lastHand = hand
    slot = canonicalSlot(slot)
    const install = clamp(assemble, 0, 1)
    const spring = slot && install ? install * install * Math.cos((1 - install) * 5.8) : 0
    const progress = clamp(explode, 0, 1)
    const spread = progress * progress * (3 - 2 * progress)
    positionParts(slot, spring, spread)
    const wheelFit = slot === 'motor' && active.motor >= 0 ? spring * (1 - spread) : 0
    const lidFit = slot === 'shell' || slot === 'brain' ? spring * (1 - spread) : 0
    const drawBack = clamp(windup, 0, 1) * (1 - clamp(attack, 0, 1))
    const stride = Math.sin(time * 10)
    const cheer = Math.sin(time * 7.0)
    const idle = Math.sin(time * 2.2)
    const lift = Math.sin((clamp(attack, 0, 1) * PI) / 2)
    const sleepy = rest && !win ? clamp((0.75 - energy) * 1.8, 0, 1) : 0
    const reach = palmTarget ? 0.115 * lift : 0
    chest.position.x = Math.sin(look) * reach
    chest.position.z = Math.cos(look) * reach
    chest.rotation.y = clamp(look, -0.76, 0.76) * lift
    chest.position.y =
      form.bodyY +
      idle * 0.007 +
      move * Math.abs(stride) * 0.017 +
      win * Math.abs(cheer) * 0.07 -
      guard * 0.095 -
      drawBack * 0.028 -
      dash * 0.065
    chest.rotation.x =
      0.025 + dash * 0.14 + move * 0.085 + lift * 0.12 - hit * hitFront * 0.21 + guard * 0.13 - drawBack * 0.095
    chest.rotation.z =
      -bank * (active.shell === 2 ? 0.085 : 0.14) +
      move * stride * 0.025 +
      win * cheer * 0.095 +
      hit * hitSide * 0.21 +
      drawBack * 0.045
    head.position.y = form.head[1] + 0.06 * lidFit
    head.rotation.x = idle * 0.009 + 0.049 - hit * hitFront * 0.1 - guard * 0.08 - lidFit * 0.085 + sleepy * 0.07
    head.rotation.y =
      clamp(look - chest.rotation.y, -1.5, 1.5) +
      Math.sin(time * 0.89) * 0.042 * (1 - move) -
      lift * hand * 0.09 +
      drawBack * windingHand * 0.05
    head.rotation.z = Math.sin(time * 1.1) * 0.018 + win * cheer * 0.075 + hit * hitSide * 0.085
    const blink = (time + 0.5) % 4.73
    eyes.scale.y =
      (blink < 0.17 && !win ? 0.12 + 0.88 * Math.abs(blink / 0.085 - 1) : 1) *
      (1 - 0.43 * hit) *
      (1 - sleepy * 0.48)
    lightEyes(display.geometry, win > 0)
    if (arenaSkin) lightEyes(arenaSkin.eyes, win > 0)
    eyes.position.y = 0.027 - 0.025 * guard + offset.lens.y
    gauge.scale.x = Math.max(0.01, clamp(energy, 0, 1))
    // The popper and bell pivot in their ball socket. Chassis steering and
    // gimbal steering share a local bearing. An optional world-space target
    // supplies pitch as well, for shots between different-height robots.
    const pulse = clamp(fire, 0, 1),
      weapon = active.weapon
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1
      const distance = i === 0 ? wheelLeft : wheelRight
      const roll =
        distance === undefined ? wheelAngle : distance / (runningRadius(active.motor) * form.wheelScale)
      wheels[i].rotation.x = roll + s * wheelFit * 0.53
      rearWheels[i].rotation.x = wheels[i].rotation.x
      let extension = 0
      {
        // Fists telegraph the installed equipment: one straight press, a
        // sideways brush pass, a two-arm recoil brace, or an open bell stance.
        const stroke = Math.max(pulse, lift),
          leading = s === hand
        const swingPhase = Math.sin(stroke * PI)
        arms[i].rotation.x =
          form.readyArm + s * stride * move * 0.16 - 0.4 * guard + drawBack * (s === windingHand ? 0.5 : 0.18)
        arms[i].rotation.z =
          s * ((form.armRoll ?? 0.13) + win * (1.98 + cheer * 0.12) + hit * 0.24 + 0.08 * move)
        arms[i].rotation.y = -s * 0.23 * guard
        if (weapon <= 0) {
          arms[i].rotation.x -= stroke * (leading ? 0.89 : 0.28)
          extension = stroke * (leading ? 0.64 : 0.11)
        } else if (weapon === 1) {
          arms[i].rotation.x -= stroke * (leading ? 0.69 : 0.19)
          arms[i].rotation.y += s * (leading ? -0.67 * stroke + 0.37 * swingPhase : 0.18 * stroke)
          extension = stroke * (leading ? 0.56 : 0.14)
        } else if (weapon === 2) {
          arms[i].rotation.x -= stroke * (leading ? 0.55 : 0.48)
          arms[i].rotation.y -= s * 0.28 * stroke
          arms[i].rotation.z += s * 0.12 * swingPhase
          extension = 0.29 * stroke
        } else {
          arms[i].rotation.x -= stroke * 0.46
          arms[i].rotation.z += s * (stroke * 0.38 + swingPhase * 0.25)
          extension = 0.19 * stroke
        }
      }
      // A tool-bearing wrist retains room for its pad; the other hand can
      // brace against the target. Both move on the same draw joints used in LOD.
      extension *= 0.46 / wristStroke
      const usingTool = s === form.toolHand && toolContact && pulse > 0 && weapon >= 0 && weapon < 2
      const handGoal = usingTool ? toolContact : s === hand ? palmTarget : null
      const effort = usingTool ? Math.sin((pulse * Math.PI) / 2) : lift
      if (handGoal && effort > 0) {
        chest.worldToLocal(palm.copy(handGoal)).sub(arms[i].position)
        const range = palm.length(),
          reserve = usingTool ? form.toolScale * (toolReach[weapon] + 0.21) : 0
        const reach = Math.max(0, (range - reserve) / form.reach - palmReach[i])
        extension = clamp(reach / wristStroke, 0, usingTool ? 0.49 : 1) * effort
        palm.normalize()
        if (usingTool && range > 0.001) {
          const armLength = (palmReach[i] + extension * wristStroke) * form.reach
          const cos = clamp(
            (range * range + armLength * armLength - reserve * reserve) / (2 * range * armLength),
            -0.997,
            1
          )
          if (cos < 1) {
            wristPlane
              .set(s, -0.17, -0.08)
              .addScaledVector(palm, -(s * palm.x - 0.17 * palm.y - 0.08 * palm.z))
              .normalize()
            palm.multiplyScalar(cos).addScaledVector(wristPlane, Math.sqrt(1 - cos * cos))
          }
        }
        swing.setFromUnitVectors(handDirections[i], palm)
        arms[i].quaternion.slerp(swing, effort)
      }
      arms[i].children[0].morphTargetInfluences[0] = extension
      if (arenaSkin) arenaSkin.grippers[i].morphTargetInfluences[0] = extension
    }
    positionToolSocket(slot, spring, spread)
    const melee = weapon === 0 || weapon === 1,
      goal = melee ? toolContact : toolAim
    const follow = Math.sin((pulse * PI) / 2)
    let bearing = 0,
      compression = 0,
      elevation = 0
    toolExtension = melee ? (weapon === 0 ? 0.52 : 0.67) * follow : 0
    if (goal && (!melee || pulse > 0)) {
      chest.worldToLocal(toolSight.copy(goal)).sub(toolMount.position)
      bearing = Math.atan2(toolSight.x, toolSight.z)
      elevation = Math.atan2(toolSight.y, Math.hypot(toolSight.x, toolSight.z))
      if (melee) {
        const travel = toolSight.length() / form.toolScale - toolReach[weapon]
        toolExtension = clamp(travel, 0, slideTravel[weapon]) * follow
        compression = clamp(travel, -toolReach[weapon], 0) * follow
        bearing *= follow
        elevation *= follow
      }
    } else if (weapon >= 2) bearing = look - chest.rotation.y
    if (weapon === 1) bearing += hand * 0.22 * Math.sin(pulse * PI)
    const loaded = melee && Boolean(toolContact)
    const yaw = loaded ? Math.PI : melee ? 1.24 : 1.43
    toolMount.rotation.set(
      -clamp(
        elevation,
        loaded ? -Math.PI / 2 : melee ? -0.68 : -0.49,
        loaded ? Math.PI / 2 : melee ? 0.79 : 0.63
      ),
      clamp(bearing, -yaw, yaw),
      0,
      'YXZ'
    )
    brushAngle = (brushAngle + dt * (move * 0.9 + pulse * 19)) % TAU
    toolAction.position.z = melee ? compression : (toolStroke[weapon] ?? 0) * pulse
    toolAction.rotation.z = weapon === 1 ? brushAngle : 0
    toolAction.rotation.x = weapon === 3 ? Math.sin(time * 32) * pulse * 0.24 : 0
    if (melee) {
      const progress = toolExtension / slideTravel[weapon]
      toolMesh.morphTargetInfluences[0] = progress
      if (arenaSkin) arenaSkin.tool.morphTargetInfluences[0] = progress
    }
  }
  update()

  // Return a focal point in robot.group's local space, regardless of where its
  // caller positions or rotates the robot in the workshop.
  function getPartPosition(slot, out = new THREE.Vector3()) {
    slot = canonicalSlot(slot)
    if (
      disposed ||
      (slot !== 'chassis' &&
        slot !== 'gauge' &&
        slot !== 'leftHand' &&
        slot !== 'rightHand' &&
        !slots.includes(slot))
    )
      return null
    let node
    if (slot === 'leftHand' || slot === 'rightHand') {
      const i = slot === 'leftHand' ? 0 : 1,
        side = i === 0 ? -1 : 1
      node = arms[i]
      const amount = node.children[0].morphTargetInfluences[0]
      out
        .set(side * palmAt[i][0], palmAt[i][1], palmAt[i][2])
        .addScaledVector(handDirections[i], amount * wristStroke)
    } else if (slot === 'gauge') {
      node = gauge
      out.set(0.118, 0, 0)
    } else if (slot === 'chassis') {
      node = chest
      out.fromArray(form.belly)
    } else if (slot === 'motor') {
      node = wheels[1]
      out.set(0.105, 0, 0)
    } else if (slot === 'weapon') {
      node = toolAction
      out.set(0, 0, (toolReach[active.weapon] ?? 0) + toolExtension)
    } else if (slot === 'lens') {
      node = eyes
      out.set(0.18, 0.014, 0.464)
    } else {
      node = slot === 'brain' ? head : chest
      if (slot === 'brain') out.fromArray(form.cpu).addScaledVector(yAxis, 0.095)
      if (slot === 'cell') out.set(form.battery[0], form.battery[1] + 0.03, form.battery[2] - 0.12)
      if (slot === 'shell') out.fromArray(form.shellFocus)
      out.add(offset[slot])
    }
    while (node !== group) {
      node.updateMatrix()
      out.applyMatrix4(node.matrix)
      node = node.parent
    }
    return out
  }

  // Share the animated joints, so a detail change never resets a wheel,
  // gripper, blink or battery meter mid-frame. The compact source owns the
  // geometry referenced by its display meshes.
  function setArenaDetail(reduced) {
    if (!arenaSkin && !reduced) return
    if (!arenaSkin) {
      const source = createRobot(active, paint, true)
      source[fitPanels](lastSlot, lastSpring, lastSpread)
      const originals = [],
        lighter = []
      group.traverse((node) => {
        if (node.isMesh) originals.push(node)
      })
      source.group.traverse((node) => {
        if (node.isMesh) lighter.push(node)
      })
      const pairs = originals.map((original, index) => {
        const mesh = lighter[index].clone(false)
        mesh.material = compactFinish
        mesh.castShadow = false
        original.parent.add(mesh)
        return { original, mesh, reference: lighter[index] }
      })
      const eyes = source.group.getObjectByName('Display').geometry
      lightEyes(eyes, display.geometry.drawRange.start !== 0)
      const grippers = arms.map((arm) => pairs.find((pair) => pair.original.parent === arm).mesh)
      grippers.forEach(
        (gripper, i) => (gripper.morphTargetInfluences[0] = arms[i].children[0].morphTargetInfluences[0])
      )
      const tool = pairs.find((pair) => pair.original === toolMesh).mesh
      if (active.weapon >= 0 && active.weapon < 2)
        tool.morphTargetInfluences[0] = toolMesh.morphTargetInfluences[0]
      arenaSkin = { source, pairs, eyes, grippers, tool, reduced: null }
    }
    if (arenaSkin.reduced === reduced) return
    for (const { original, mesh } of arenaSkin.pairs) {
      original.visible = !reduced
      mesh.visible = reduced
    }
    arenaSkin.reduced = reduced
  }
  function releaseArenaSkin() {
    if (!arenaSkin) return
    for (const { original, mesh } of arenaSkin.pairs) {
      original.visible = true
      mesh.removeFromParent()
    }
    arenaSkin.source.dispose()
    arenaSkin = null
  }
  function dispose() {
    if (disposed) return
    disposed = true
    releaseArenaSkin()
    group.removeFromParent()
    headBatch.dispose()
    bodyBatch.dispose()
    const owned = new Set()
    group.traverse((node) => {
      if (node.isMesh) owned.add(node.geometry)
    })
    for (const geometry of owned) geometry.dispose()
    releaseSurfaceMaterial()
  }
  const sightline = new THREE.Vector3()
  // Projectile origin and outward unit vector in world space, including the
  // instant swivel, spring, firing recoil and the parent robot's transform.
  function getToolRay(origin, direction) {
    toolAction.updateWorldMatrix(true, false)
    if (active.weapon < 0) {
      const arm = arms[lastHand === -1 ? 0 : 1]
      group.localToWorld(getPartPosition(lastHand === -1 ? 'leftHand' : 'rightHand', origin))
      arm.updateWorldMatrix(true, false)
      direction.copy(handDirections[lastHand === -1 ? 0 : 1]).transformDirection(arm.matrixWorld)
      return
    }
    origin.set(0, 0, (toolReach[active.weapon] ?? 0) + toolExtension).applyMatrix4(toolAction.matrixWorld)
    direction.set(0, 0, 1).transformDirection(toolAction.matrixWorld)
  }
  function lensView(origin, target, subject) {
    head.updateWorldMatrix(true, false)
    origin.set(0, 0.035, 0.51 + (form.faceZ || 0)).applyMatrix4(head.matrixWorld)
    target.set(0, 0, 1).transformDirection(head.matrixWorld)
    // The camera shares the gimbal's bearing. Stabilise vertical recoil and
    // keep a level horizon when the padded arm pushes.
    target.y = THREE.MathUtils.clamp(target.y * 0.35, -0.12, 0.12)
    if (subject) {
      if (subject.getPartPosition) subject.group.localToWorld(subject.getPartPosition('lens', sightline))
      else sightline.copy(subject)
      const range = Math.hypot(sightline.x - origin.x, sightline.z - origin.z)
      target.y = THREE.MathUtils.clamp((sightline.y - origin.y) / Math.max(range, 0.35), -0.62, 0.62)
    }
    target.normalize().add(origin)
  }
  function pickPart(ray) {
    if (disposed) return null
    group.updateWorldMatrix(true, true)
    const hit = ray.intersectObjects(
      surfaceMeshes.filter((n) => n.visible && n.parent.visible),
      false
    )[0]
    if (!hit) return null
    const mesh = hit.object
    if (mesh === toolMesh || arms.includes(mesh.parent)) return 'weapon'
    if (mesh === display) return 'lens'
    if (mesh === drive || wheelMeshes.includes(mesh) || rearRims.includes(mesh)) return 'motor'
    const batch = mesh === headBatch.mesh ? headBatch : mesh === bodyBatch.mesh ? bodyBatch : null
    if (batch) {
      const element = hit.faceIndex * 3
      for (const [key, section] of batch.sections) {
        if (element < section.element || element >= section.element + section.source.index.count) continue
        if (key === 'lensBack' || key === 'socket') return 'lens'
        if (slots.includes(key)) return key
      }
    }
    return 'shell'
  }
  function shadowParts() {
    const pieces = []
    for (const node of surfaceMeshes) {
      if (!node.parent?.visible || !node.geometry.index?.count || (node === toolMesh && active.weapon < 0))
        continue
      const batch = node === headBatch.mesh ? headBatch : node === bodyBatch.mesh ? bodyBatch : null
      if (batch) {
        for (const [key, { source }] of batch.sections) {
          if (!source.index.count || ((key === 'lensBack' || key === 'socket') && !visorOpen)) continue
          pieces.push({
            node,
            geometry: source,
            part:
              slots.includes(key) && active[key] >= 0
                ? key
                : key === 'lensBack' && active.lens >= 0
                  ? 'lens'
                  : null
          })
        }
      } else {
        const part =
          node === toolMesh
            ? 'weapon'
            : node === display
              ? active.lens >= 0
                ? 'lens'
                : null
              : wheelMeshes.includes(node) || rearRims.includes(node)
                ? active.motor >= 0
                  ? 'motor'
                  : null
                : null
        pieces.push({ node, geometry: node.geometry, part })
      }
    }
    return pieces
  }
  return {
    [fitPanels]: positionParts,
    shadowParts,
    pickPart,
    group,
    setBuild,
    setPaint,
    getPartPosition,
    lensView,
    getToolRay,
    update,
    setFinishMaterial(finish = material, distanceFinish = material) {
      compactFinish = distanceFinish
      if (arenaSkin) for (const { mesh } of arenaSkin.pairs) mesh.material = compactFinish
      for (const mesh of surfaceMeshes) mesh.material = finish
    },
    setArenaDetail,
    releaseArenaSkin,
    dispose
  }
}
