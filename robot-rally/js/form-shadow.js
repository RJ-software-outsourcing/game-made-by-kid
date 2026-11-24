import * as T from '../vendor/three.module.js'

// Sample the outer surface of each rigid component, including the installed
// tool and wheels. Components stay separate so light passes through the gaps
// under a Rover, between its ears and around the Orb's smaller axle.
const directions = [[0, 1, 0]]
const triangles = []
const around = 10,
  rings = 5
for (let row = 0; row < rings; row++) {
  const lat = Math.PI * (0.5 - (row + 1) / (rings + 1))
  for (let col = 0; col < around; col++) {
    const lng = (2 * Math.PI * col) / around
    directions.push([Math.cos(lat) * Math.sin(lng), Math.sin(lat), Math.cos(lat) * Math.cos(lng)])
    const i = 1 + row * around + col,
      j = 1 + row * around + ((col + 1) % around)
    if (row === 0) triangles.push(0, i, j)
    if (row < rings - 1) triangles.push(i, i + around, j + around, i, j + around, j)
    if (row === rings - 1) triangles.push(i, rings * around + 1, j)
  }
}
directions.push([0, -1, 0])
const skins = new WeakMap()
function silhouette(geometry) {
  if (skins.has(geometry)) return skins.get(geometry)
  const p = geometry.attributes.position,
    index = geometry.index,
    source = []
  const first = geometry.drawRange.start,
    end = Math.min(index?.count ?? p.count, first + geometry.drawRange.count)
  const seen = new Uint8Array(p.count)
  for (let i = first; i < end; i++) {
    const v = index ? index.getX(i) : i
    if (!seen[v]) {
      source.push(v)
      seen[v] = 1
    }
  }
  const morph = geometry.morphAttributes.position?.[0]
  const coords = [],
    offsets = []
  for (const [x, y, z] of directions) {
    let best = -Infinity,
      bestAt = source[0] ?? 0
    for (const v of source) {
      const dot = p.getX(v) * x + p.getY(v) * y + p.getZ(v) * z
      if (dot > best) {
        best = dot
        bestAt = v
      }
    }
    coords.push(p.getX(bestAt), p.getY(bestAt), p.getZ(bestAt))
    if (morph) offsets.push(morph.getX(bestAt), morph.getY(bestAt), morph.getZ(bestAt))
  }
  const skin = { coords, offsets: morph ? offsets : null }
  skins.set(geometry, skin)
  return skin
}
export function createFormShadow(robot) {
  const group = new T.Group(),
    bindings = [],
    indices = []
  group.name = 'Animated component shadows'
  for (const { node, geometry } of robot.shadowParts()) {
    if (!geometry.attributes.position?.count) continue
    const offset = bindings.length * directions.length
    bindings.push({ node, skin: silhouette(geometry) })
    for (const idx of triangles) indices.push(offset + idx)
  }
  const g = new T.BufferGeometry()
  const positions = new T.Float32BufferAttribute(
    new Float32Array(bindings.length * directions.length * 3),
    3
  ).setUsage(T.DynamicDrawUsage)
  g.setAttribute('position', positions)
  g.setIndex(indices)
  const mat = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false })
  const mesh = new T.InstancedMesh(g, mat, 1)
  mesh.frustumCulled = false
  mesh.castShadow = true
  mesh.count = 0
  mesh.setMatrixAt(0, new T.Matrix4())
  mesh.onBeforeShadow = () => {
    mesh.count = 1
  }
  mesh.onAfterShadow = () => {
    mesh.count = 0
  }
  group.add(mesh)
  const inverse = new T.Matrix4(),
    transform = new T.Matrix4(),
    point = new T.Vector3()
  function update() {
    robot.group.updateWorldMatrix(true, true)
    group.updateWorldMatrix(true, false)
    inverse.copy(group.matrixWorld).invert()
    let dest = 0
    for (const {
      node,
      skin: { coords, offsets }
    } of bindings) {
      transform.multiplyMatrices(inverse, node.matrixWorld)
      const amount = node.morphTargetInfluences?.[0] || 0
      for (let i = 0; i < coords.length; i += 3) {
        point.fromArray(coords, i)
        if (offsets && amount) {
          point.x += offsets[i] * amount
          point.y += offsets[i + 1] * amount
          point.z += offsets[i + 2] * amount
        }
        point.applyMatrix4(transform)
        positions.setXYZ(dest++, point.x, point.y, point.z)
      }
    }
    positions.needsUpdate = true
  }
  update()
  return {
    group,
    update,
    dispose() {
      group.removeFromParent()
      g.dispose()
      mat.dispose()
      mesh.dispose()
    }
  }
}
