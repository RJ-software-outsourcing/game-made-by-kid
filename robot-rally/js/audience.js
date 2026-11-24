import * as T from '../vendor/three.module.js'

const TAU = Math.PI * 2
const cream = '#e4d9b6'
const teal = '#508580'
const ink = '#253638'
const rubber = '#344242'
const nickel = '#b3aaa0'
const amber = '#d99752'
const light = '#b1e5cb'
const shoulder = 0.102
const shoulderY = 0.215

// Four octagonal rings form a small, bevelled injection-moulded housing.
function housing(w, h, d, bevel) {
  const pos = [],
    index = []
  const rings = [
    [-h / 2, bevel],
    [-h / 2 + bevel, 0],
    [h / 2 - bevel, 0],
    [h / 2, bevel]
  ]
  for (let k = 0; k < rings.length; k++) {
    const [y, inset] = rings[k]
    const x = w / 2 - inset,
      z = d / 2 - inset
    const corner = Math.min(w, d) * 0.135
    const perimeter = [
      [-x + corner, z],
      [x - corner, z],
      [x, z - corner],
      [x, -z + corner],
      [x - corner, -z],
      [-x + corner, -z],
      [-x, -z + corner],
      [-x, z - corner]
    ]
    for (let i = 0; i < 8; i++) {
      pos.push(perimeter[i][0], y, perimeter[i][1])
      if (k < 3) {
        const a = k * 8 + i,
          b = k * 8 + ((i + 1) % 8)
        index.push(a, b, a + 8, b, b + 8, a + 8)
      }
    }
  }
  for (let i = 1; i < 7; i++) index.push(0, i + 1, i, 24, 24 + i, 25 + i)
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

class Pieces {
  constructor(templates) {
    this.templates = templates
    this.positions = []
    this.normals = []
    this.colors = []
    this.motion = []
    this.indices = []
    this.transform = new T.Object3D()
    this.normal = new T.Matrix3()
    this.v = new T.Vector3()
  }

  primitive(key, make) {
    if (!this.templates.has(key)) this.templates.set(key, make())
    return this.templates.get(key)
  }

  add(g, at, scale, color, rotation = [0, 0, 0], arm = 0, lamp = 0) {
    const offset = this.positions.length / 3
    const object = this.transform
    object.position.fromArray(at)
    object.scale.fromArray(scale)
    object.rotation.set(...rotation)
    object.updateMatrix()
    this.normal.getNormalMatrix(object.matrix)
    const tint = new T.Color(color)
    const p = g.attributes.position,
      n = g.attributes.normal
    for (let i = 0; i < p.count; i++) {
      this.v.fromBufferAttribute(p, i).applyMatrix4(object.matrix)
      this.positions.push(this.v.x, this.v.y, this.v.z)
      const lift = T.MathUtils.clamp((this.v.y - 0.055) / 0.095, 0, 1)
      this.motion.push(lift, arm, lamp)
      this.v.fromBufferAttribute(n, i).applyNormalMatrix(this.normal)
      this.normals.push(this.v.x, this.v.y, this.v.z)
      this.colors.push(tint.r, tint.g, tint.b)
    }
    const count = g.index?.count ?? p.count
    for (let i = 0; i < count; i++) this.indices.push(offset + (g.index ? g.index.getX(i) : i))
  }

  box(at, size, color, bevel = 0, arm = 0, rotation = [0, 0, 0]) {
    if (bevel) {
      const g = this.primitive('box' + [...size, bevel].join(','), () => housing(...size, bevel))
      this.add(g, at, [1, 1, 1], color, rotation, arm)
    } else {
      this.add(
        this.primitive('cube', () => new T.BoxGeometry()),
        at,
        size,
        color,
        rotation,
        arm
      )
    }
  }

  oval(at, radii, color, arm = 0, lamp = 0) {
    this.add(
      this.primitive('ellipsoid', () => new T.SphereGeometry(1, 10, 6)),
      at,
      radii,
      color,
      [0, 0, 0],
      arm,
      lamp
    )
  }

  pin(at, radius, length, color, axis = 'y', arm = 0, lamp = 0) {
    const g = this.primitive('cylinder', () => new T.CylinderGeometry(1, 1, 1, 8))
    const rotation = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]
    this.add(g, at, [radius, length, radius], color, rotation, arm, lamp)
  }

  finish(animated = false) {
    const g = new T.BufferGeometry()
    g.setAttribute('position', new T.Float32BufferAttribute(this.positions, 3))
    g.setAttribute(
      'normal',
      new T.Int16BufferAttribute(
        this.normals.map((v) => Math.round(v * 32767)),
        3,
        true
      )
    )
    g.setAttribute(
      'color',
      new T.Uint16BufferAttribute(
        this.colors.map((v) => Math.round(v * 65535)),
        3,
        true
      )
    )
    if (animated) g.setAttribute('response', new T.Float32BufferAttribute(this.motion, 3))
    g.setIndex(this.indices)
    g.computeBoundingSphere()
    return g
  }
}

function fan(templates, round) {
  const p = new Pieces(templates)
  for (const side of [-1, 1]) {
    p.box([side * 0.057, 0.027, 0.015], [0.095, 0.05, 0.138], rubber)
    p.pin([side * 0.053, 0.077, 0], 0.023, 0.072, nickel)
  }
  const suit = round ? '#bd8255' : '#669991'
  p.box([0, 0.158, 0], [0.187, 0.146, 0.145], suit, 0.019)
  p.box([0, 0.171, 0.073], [0.09, 0.041, 0.008], cream)
  p.box([0, 0.169, 0.079], [0.045, 0.011, 0.005], ink)
  p.pin([0, 0.249, 0], 0.045, 0.057, rubber)
  for (const side of [-1, 1]) {
    p.pin([side * shoulder, shoulderY, 0], 0.035, 0.034, nickel, 'x')
    p.box([side * 0.126, 0.18, 0.012], [0.041, 0.089, 0.053], cream, 0, side, [-0.14, 0, side * 0.32])
    p.box([side * 0.143, 0.147, 0.024], [0.05, 0.044, 0.053], rubber, 0, side)
  }
  if (round) {
    // A little survey camera with a cast dome, big glass lens and a side focus knob.
    p.oval([0, 0.355, 0], [0.14, 0.113, 0.111], cream)
    p.pin([0, 0.355, 0.08], 0.069, 0.081, ink, 'z')
    p.pin([0, 0.355, 0.123], 0.054, 0.011, nickel, 'z')
    p.pin([0, 0.355, 0.133], 0.044, 0.009, teal, 'z')
    p.pin([-0.01, 0.365, 0.139], 0.02, 0.003, light, 'z', 0, 0.4)
    p.pin([0.135, 0.349, -0.005], 0.041, 0.028, suit, 'x')
    p.pin([0, 0.462, -0.015], 0.027, 0.022, suit)
  } else {
    // A lunchbox-shaped helper with two phosphor eyes and a tiny radio aerial.
    p.box([0, 0.36, 0], [0.274, 0.175, 0.202], cream, 0.02)
    p.box([0, 0.357, 0.092], [0.24, 0.128, 0.049], ink, 0.011)
    for (const side of [-1, 1]) p.pin([side * 0.057, 0.359, 0.119], 0.017, 0.006, light, 'z', 0, 0.55)
    p.box([0, 0.327, 0.118], [0.027, 0.006, 0.005], teal)
    p.pin([-0.074, 0.459, -0.018], 0.008, 0.055, nickel)
    p.oval([-0.074, 0.491, -0.018], [0.019, 0.019, 0.019], amber)
  }
  return p.finish(true)
}

function stand(templates) {
  const p = new Pieces(templates)
  const wood = '#9b7050',
    edge = '#bea079',
    enamel = '#365958'
  for (const x of [-0.81, 0.81]) {
    p.box([x, -0.35, 0], [0.14, 0.045, 0.93], rubber)
    p.box([x, -0.2, 0.17], [0.091, 0.28, 0.58], enamel)
    p.box([x, -0.105, -0.25], [0.091, 0.48, 0.38], enamel)
  }
  p.box([0, -0.135, 0.37], [2.1, 0.136, 0.097], enamel, 0.013)
  p.box([0, -0.149, 0.422], [1.94, 0.014, 0.009], edge)
  p.box([0, -0.053, 0.2], [2.16, 0.066, 0.47], wood, 0.012)
  p.box([0, 0.102, -0.261], [2.16, 0.068, 0.43], wood, 0.012)
  for (const x of [-0.96, 0.96]) {
    p.box([x, 0.007, -0.3], [0.039, 0.19, 0.04], nickel)
    p.pin([x, -0.119, 0.423], 0.014, 0.009, nickel, 'z')
  }
  return p.finish()
}

function pennant(templates) {
  const p = new Pieces(templates)
  p.pin([0, 0.157, 0], 0.006, 0.337, '#d8c49c')
  p.pin([0, 0.331, 0], 0.01, 0.015, '#c99c55')
  // The fabric bows forward in the middle. The light stripe follows the same fold.
  const positions = [],
    indices = []
  const columns = 6
  for (let i = 0; i < columns; i++) {
    const u = i / (columns - 1)
    const x = 0.008 + u * 0.204
    const z = 0.032 * Math.sin(u * TAU * 0.76) + 0.008 * u
    const top = 0.31 - 0.028 * u
    const bottom = top - 0.102 * (1 - 0.88 * u)
    positions.push(x, bottom, z, x, top, z)
    if (i + 1 < columns) {
      const j = i * 2
      indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3)
    }
  }
  const cloth = new T.BufferGeometry()
  cloth.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  cloth.setIndex(indices)
  cloth.computeVertexNormals()
  p.add(cloth, [0, 0, 0], [1, 1, 1], '#f0e5c9')
  // A flag's instance colour is its team colour; narrow pale stitching stays visible at its hoist.
  p.box([0.012, 0.261, 0.002], [0.013, 0.099, 0.008], cream)
  cloth.dispose()
  return p.finish()
}

function fanMaterial() {
  const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.49, metalness: 0.23 })
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 response;
        attribute vec2 cheerPose;
        varying float lamp;
        mat2 liftedArm(float side) {
          float a = cheerPose.x * side * (side < 0.0 ? 0.79 : 1.0);
          return mat2(cos(a),sin(a),-sin(a),cos(a));
        }`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        if (response.y != 0.0) objectNormal.xy = liftedArm(response.y) * objectNormal.xy;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        lamp = response.z;
        if (response.y != 0.0) {
          vec2 pivot = vec2(response.y * 0.102,0.215);
          transformed.xy = pivot + liftedArm(response.y) * (transformed.xy-pivot);
        }
        transformed.y += cheerPose.y * response.x;`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float lamp;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb*lamp;'
      )
  }
  return mat
}

function shadeMaterial() {
  return new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec2 shadowUV; void main() { shadowUV = uv*2.0-1.0;
      gl_Position = projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 shadowUV; void main() {
      vec2 edge = max(abs(shadowUV)-vec2(0.65,0.32),0.0)/vec2(0.35,0.68);
      gl_FragColor = vec4(0.025,0.038,0.035,(1.0-smoothstep(0.0,1.0,length(edge)))*0.27);
      #include <colorspace_fragment>
    }`
  })
}

/** Far-side spectator stands in arena coordinates. time is seconds, excitement is 0..1.
 * Pass the active camera's world position, including while orbiting or looking down.
 */
export function createAudience() {
  const group = new T.Group()
  group.name = 'Workshop supporters'
  const templates = new Map()
  const sectors = 8
  const maxFans = sectors * 4
  function batch(name, geometry, material, capacity) {
    const m = new T.InstancedMesh(geometry, material, capacity)
    m.name = name
    m.count = 0
    m.frustumCulled = false
    m.instanceMatrix.setUsage(T.DynamicDrawUsage)
    group.add(m)
    return m
  }
  const paint = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0.17 })
  const fabric = new T.MeshStandardMaterial({
    vertexColors: true,
    side: T.DoubleSide,
    roughness: 0.8,
    metalness: 0.07
  })
  const enamel = fanMaterial(),
    shade = shadeMaterial()
  const seats = batch('Two-tier oak benches', stand(templates), paint, sectors)
  const shadow = batch('Bench contact', new T.PlaneGeometry(2.65, 1.42).rotateX(-Math.PI / 2), shade, sectors)
  shadow.renderOrder = -1
  const fans = [false, true].map((round) => {
    const g = fan(templates, round)
    const pose = new T.InstancedBufferAttribute(new Float32Array(maxFans * 2), 2).setUsage(T.DynamicDrawUsage)
    g.setAttribute('cheerPose', pose)
    return batch(round ? 'Little survey cameras' : 'Little radio helpers', g, enamel, maxFans)
  })
  const flags = batch('Team pennants', pennant(templates), fabric, maxFans)
  for (const geometry of templates.values()) geometry.dispose()
  templates.clear()

  const sections = [],
    visibleFans = []
  const dummy = new T.Object3D()
  dummy.rotation.order = 'YXZ'
  const tints = ['#fff3d9', '#d9e2cf', '#efdac5', '#d2dfdf', '#e5e0cd']
  const pennants = ['#db8754', '#58a69b', '#dfb769']
  const places = [
    [-0.63, -0.02, 0.22],
    [0.27, -0.02, 0.18],
    [-0.18, 0.136, -0.24],
    [0.74, 0.136, -0.29]
  ]
  for (let j = 0; j < sectors; j++) {
    const a = ((j + 0.12) * TAU) / sectors
    const radius = 6.57 + (j % 3) * 0.12
    const yaw = a + Math.PI,
      sy = Math.sin(yaw),
      cy = Math.cos(yaw)
    const section = {
      nx: Math.sin(a),
      nz: Math.cos(a),
      x: Math.sin(a) * radius,
      z: Math.cos(a) * radius,
      yaw,
      // Includes the contact shadow, seat ends and the full raised flag.
      bounds: new T.Sphere(new T.Vector3(Math.sin(a) * radius, 0.16, Math.cos(a) * radius), 1.75),
      people: []
    }
    for (let i = 0; i < (j % 3 === 1 ? 3 : 4); i++) {
      const [x, y, z] = places[i]
      const id = j * 4 + i
      section.people.push({
        x: section.x + cy * x + sy * z,
        y,
        z: section.z - sy * x + cy * z,
        yaw: yaw + Math.sin(id * 1.4) * 0.14,
        size: 0.84 + ((id * 7) % 12) * 0.029,
        type: (j + i + (i === 3 ? 1 : 0)) % 2,
        phase: id * 1.73,
        tint: new T.Color(tints[id % tints.length]),
        flag: i === 2 || (i === 0 && j % 3 === 0),
        flagColor: new T.Color(pennants[(j + i) % 3])
      })
    }
    sections.push(section)
  }

  function matrix(x, y, z, yaw, roll, size) {
    dummy.position.set(x, y, z)
    dummy.rotation.set(0, yaw, roll, 'YXZ')
    dummy.scale.setScalar(size)
    dummy.updateMatrix()
    return dummy.matrix
  }
  const frustum = new T.Frustum(), projection = new T.Matrix4()
  let mask = -1, farSide = -1,
    lastTime = 0,
    lastTick = -1,
    envelope = 0,
    asleep = false,
    disposed = false
  let camX = 0,
    camZ = 1

  function place(maskNext) {
    visibleFans.length = 0
    let n = 0,
      nf = 0
    const counts = [0, 0]
    for (let j = 0; j < sectors; j++) {
      if (!(maskNext & (1 << j))) continue
      const s = sections[j]
      seats.setMatrixAt(n, matrix(s.x, 0, s.z, s.yaw, 0, 1))
      shadow.setMatrixAt(n++, matrix(s.x, -0.375, s.z, s.yaw, 0, 1))
      for (const f of s.people) {
        const batch = fans[f.type]
        f.index = counts[f.type]++
        batch.setMatrixAt(f.index, matrix(f.x, f.y, f.z, f.yaw, 0, f.size))
        batch.setColorAt(f.index, f.tint)
        if (f.flag) {
          f.flagIndex = nf++
          flags.setColorAt(f.flagIndex, f.flagColor)
        }
        visibleFans.push(f)
      }
    }
    seats.count = shadow.count = n
    flags.count = nf
    seats.instanceMatrix.needsUpdate = shadow.instanceMatrix.needsUpdate = true
    for (let i = 0; i < 2; i++) {
      fans[i].count = counts[i]
      fans[i].instanceMatrix.needsUpdate = true
      fans[i].instanceColor.needsUpdate = true
    }
    flags.instanceColor.needsUpdate = true
    mask = maskNext
  }

  function update(time = 0, excitement = 0, cameraPosition, camera) {
    if (disposed) return
    if (camera) {
      camera.updateMatrixWorld()
      frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
    }
    const distance = cameraPosition ? Math.hypot(cameraPosition.x, cameraPosition.z) : 0
    // A camera straight overhead keeps its last azimuth.
    if (distance > 0.12) {
      camX = cameraPosition.x / distance
      camZ = cameraPosition.z / distance
    }
    let nextMask = 0, nextFarSide = 0
    for (let j = 0; j < sectors; j++) {
      const s = sections[j],
        dot = s.nx * camX + s.nz * camZ
      // A little hysteresis keeps a bench steady on the edge of an orbit.
      if (dot < (farSide & (1 << j) ? -0.3 : -0.38)) {
        nextFarSide |= 1 << j
        if (!camera || frustum.intersectsSphere(s.bounds)) nextMask |= 1 << j
      }
    }
    farSide = nextFarSide
    const changed = nextMask !== mask
    if (changed) place(nextMask)
    const elapsed = time - lastTime
    if (elapsed < 0 || elapsed > 1) envelope = 0
    const input = T.MathUtils.clamp(excitement, 0, 1)
    envelope = Math.max(input, envelope * Math.exp(-Math.max(0, elapsed) * 3.4))
    lastTime = time
    const quiet = envelope < 0.012
    const tick = Math.floor(time * 24)
    if (!changed && ((quiet && asleep) || (!quiet && !asleep && tick === lastTick))) return
    const intensity = quiet ? 0 : envelope
    for (const f of visibleFans) {
      const beat = 0.5 + 0.5 * Math.sin(time * 7.4 + f.phase)
      const lift = intensity * (0.014 + 0.042 * beat)
      const angle = intensity * (0.51 + 1.05 * beat)
      fans[f.type].geometry.attributes.cheerPose.setXY(f.index, angle, lift)
      if (f.flag) {
        const ca = Math.cos(angle),
          sa = Math.sin(angle)
        // Keep the staff inside the moving right gripper as its shoulder pivots.
        const dx = 0.143 - shoulder,
          dy = 0.147 - shoulderY
        const gx = (shoulder + ca * dx - sa * dy) * f.size,
          gz = 0.024 * f.size
        const gy = (shoulderY + sa * dx + ca * dy + lift) * f.size
        const sy = Math.sin(f.yaw),
          cy = Math.cos(f.yaw)
        const roll = -0.12 + intensity * 0.4 * Math.sin(time * 8.2 + f.phase)
        flags.setMatrixAt(
          f.flagIndex,
          matrix(f.x + cy * gx + sy * gz, f.y + gy, f.z - sy * gx + cy * gz, f.yaw, roll, f.size)
        )
      }
    }
    for (const m of fans) m.geometry.attributes.cheerPose.needsUpdate = true
    flags.instanceMatrix.needsUpdate = true
    lastTick = tick
    asleep = quiet
  }
  function dispose() {
    if (disposed) return
    disposed = true
    group.removeFromParent()
    for (const m of group.children) {
      m.dispose()
      m.geometry.dispose()
    }
    for (const m of [paint, fabric, enamel, shade]) m.dispose()
    group.clear()
  }
  update(0, 0)
  return { group, update, dispose }
}
