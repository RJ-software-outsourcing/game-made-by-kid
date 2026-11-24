import * as T from '../vendor/three.module.js'

const samples = 72
const spacing = 0.78
const colors = [new T.Color('#007671'), new T.Color('#b95b18')]
const arrowHead = [0, .14, -.105, -.06, 0, -.012, 0, .14, 0, -.012, .105, -.06]
const dashHead = [...arrowHead, ...arrowHead.map((v, i) => i % 2 ? v - .16 : v)]
const dodgeHead = [
  ...arrowHead,
  -.027, 0, .027, 0, -.027, -.19, .027, 0, .027, -.19, -.027, -.19,
  -.16, -.19, -.027, -.19, -.027, -.137, -.16, -.19, -.027, -.137, -.16, -.137
]

function signs(shape, count, color) {
  const points = []
  for (let i = 0; i < shape.length; i += 2) points.push(shape[i], 0, shape[i + 1])
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3))
  const mesh = new T.InstancedMesh(geometry, new T.MeshBasicMaterial({ color, side: T.DoubleSide, depthWrite: false }), count)
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage)
  mesh.frustumCulled = false
  mesh.renderOrder = 3
  mesh.count = 0
  return mesh
}

// Both live Paths and the half-speed replay use samples from the real drive.
export class ReplayTrails {
  constructor() {
    this.group = new T.Group()
    this.lanes = colors.map(() => ({
      x: new Float32Array(samples), z: new Float32Array(samples),
      distance: new Float64Array(samples), action: new Uint8Array(samples),
      sign: new Int8Array(samples), angle: new Float32Array(samples)
    }))
    this.count = 0
    this.head = -1
    this.positions = new T.BufferAttribute(new Float32Array(2 * samples * 6), 3).setUsage(T.DynamicDrawUsage)
    const tint = [], indices = []
    for (let side = 0; side < 2; side++) {
      for (let k = 0; k < samples; k++) {
        const c = colors[side], alpha = .25 + .75 * k / (samples - 1)
        tint.push(c.r, c.g, c.b, alpha, c.r, c.g, c.b, alpha)
        if (k) {
          const n = (side * samples + k) * 2
          indices.push(n - 2, n - 1, n, n, n - 1, n + 1)
        }
      }
    }
    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', this.positions)
    geometry.setAttribute('color', new T.Float32BufferAttribute(tint, 4))
    geometry.setIndex(indices)
    const ribbon = new T.Mesh(geometry, new T.MeshBasicMaterial({
      vertexColors: true, side: T.DoubleSide, transparent: true, depthWrite: false
    }))
    ribbon.frustumCulled = false
    ribbon.renderOrder = 2
    this.arrows = signs(arrowHead, samples * 2, '#ffedbf')
    this.dashes = signs(dashHead, samples, '#fff4c5')
    this.dodges = signs(dodgeHead, samples, '#fff4c5')
    this.pose = new T.Object3D()
    this.group.add(ribbon, this.arrows, this.dashes, this.dodges)
    this.group.visible = false
  }
  reset(match, visible) {
    this.head = -1
    this.count = 0
    this.group.visible = visible
    this.record(match)
  }
  record(match) {
    const prev = this.head
    this.head = (prev + 1) % samples
    this.count = Math.min(samples, this.count + 1)
    for (let side = 0; side < 2; side++) {
      const p = match.robots[side], lane = this.lanes[side], at = this.head
      lane.x[at] = p.x
      lane.z[at] = p.z
      lane.action[at] = p.maneuver === 'dash' ? 1 : p.maneuver === 'dodge' ? 2 : 0
      lane.distance[at] = prev < 0 ? 0 : lane.distance[prev] + Math.hypot(p.x - lane.x[prev], p.z - lane.z[prev])
      lane.sign[at] = 0
      if (prev < 0 || lane.action[at] !== lane.action[prev]) {
        lane.startX = prev < 0 ? p.x : lane.x[prev]
        lane.startZ = prev < 0 ? p.z : lane.z[prev]
        const older = (prev - 1 + samples) % samples
        lane.approachX = this.count > 2 ? lane.x[prev] - lane.x[older] : 0
        lane.approachZ = this.count > 2 ? lane.z[prev] - lane.z[older] : 0
        lane.marked = false
      }
      if (lane.action[at] && !lane.marked) {
        const dx = p.x - lane.startX, dz = p.z - lane.startZ
        // Mark a maneuver only after the wheels really move. A bot pinned
        // against a rail can order a dodge without getting anywhere.
        if (Math.hypot(dx, dz) >= .16) {
          lane.angle[at] = Math.atan2(dx, dz)
          const turn = dx * lane.approachZ - dz * lane.approachX
          lane.sign[at] = lane.action[at] === 1 ? 1 : turn < 0 ? -2 : 2
          lane.marked = true
        }
      }
    }
    if (this.group.visible) this.draw()
  }
  mark(mesh, x, z, heading, width, length) {
    this.pose.position.set(x, .039, z)
    this.pose.rotation.y = heading
    this.pose.scale.set(width, 1, length)
    this.pose.updateMatrix()
    mesh.setMatrixAt(mesh.count++, this.pose.matrix)
  }
  draw() {
    this.arrows.count = this.dashes.count = this.dodges.count = 0
    const first = (this.head - this.count + 1 + samples) % samples
    for (let side = 0; side < 2; side++) {
      const lane = this.lanes[side]
      let prev = first, nx = 0, nz = 0
      for (let k = 0; k < samples; k++) {
        const at = (first + Math.max(0, k - (samples - this.count))) % samples
        const x = lane.x[at], z = lane.z[at]
        const dx = x - lane.x[prev], dz = z - lane.z[prev], length = Math.hypot(dx, dz)
        if (length > .001) {
          nx = -dz / length
          nz = dx / length
          const heading = Math.atan2(dx, dz), action = lane.action[at]
          if (lane.sign[at]) {
            const dash = lane.sign[at] === 1
            this.mark(dash ? this.dashes : this.dodges, x, z, lane.angle[at], dash ? 1.4 : Math.sign(lane.sign[at]) * 1.45, 1.45)
          } else if (!action) {
            // Distance is measured from the starting mark. Older arrows stay
            // put when the oldest point falls out of the seven-second trail.
            const distance = lane.distance[at], mark = Math.floor(distance / spacing) * spacing
            if (mark > lane.distance[prev]) {
              const back = (distance - mark) / (distance - lane.distance[prev])
              this.mark(this.arrows, x - dx * back, z - dz * back, heading, 1, 1)
            }
          }
        }
        const width = .045 + .043 * k / (samples - 1), n = (side * samples + k) * 2
        this.positions.setXYZ(n, x + nx * width, .024, z + nz * width)
        this.positions.setXYZ(n + 1, x - nx * width, .024, z - nz * width)
        prev = at
      }
    }
    for (const mesh of [this.arrows, this.dashes, this.dodges]) {
      mesh.visible = mesh.count > 0
      if (mesh.visible) mesh.instanceMatrix.needsUpdate = true
    }
    this.positions.needsUpdate = true
  }
}
