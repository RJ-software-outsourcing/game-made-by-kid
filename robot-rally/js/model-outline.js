import { Matrix4, Vector3 } from '../vendor/three.module.js'

// Visit each fitted vertex in coordinates local to the assembled robot.
// Section draw ranges exclude the parts still on the shelf. Sliding tools
// and folding arms contribute at their current extension.
export function visitFittedVertices(robot, visit) {
  const relative = new Matrix4()
  const vertex = new Vector3()
  robot.group.updateWorldMatrix(true, true)
  const inverse = new Matrix4().copy(robot.group.matrixWorld).invert()
  for (const { node, geometry } of robot.shadowParts()) {
    const positions = geometry.attributes.position
    const displacements = geometry.morphAttributes.position?.[0]
    const extension = node.morphTargetInfluences?.[0] || 0
    const index = geometry.index
    const first = geometry.drawRange.start
    const end = Math.min(index?.count ?? positions.count, first + geometry.drawRange.count)
    const seen = new Uint8Array(positions.count)
    relative.multiplyMatrices(inverse, node.matrixWorld)
    for (let k = first; k < end; k++) {
      const i = index ? index.getX(k) : k
      if (seen[i]) continue
      seen[i] = 1
      vertex.fromBufferAttribute(positions, i)
      if (displacements && extension) {
        vertex.x += displacements.getX(i) * extension
        vertex.y += displacements.getY(i) * extension
        vertex.z += displacements.getZ(i) * extension
      }
      visit(vertex.applyMatrix4(relative))
    }
  }
}

export function supportPoints(robot, directions) {
  const best = new Float64Array(directions.length).fill(-Infinity)
  const points = directions.map(() => new Vector3())
  visitFittedVertices(robot, (vertex) => {
    for (let n = 0; n < directions.length; n++) {
      const extent = vertex.dot(directions[n])
      if (extent > best[n]) {
        best[n] = extent
        points[n].copy(vertex)
      }
    }
  })
  return points.filter((point, i) => points.findIndex((p) => p.equals(point)) === i)
}

// Frame the fitted silhouette instead of leaving extra space for a taller
// chassis. The camera keeps its perspective and the whole tool stays visible.
export function framePortrait(robot, camera, width, height) {
  robot.group.updateWorldMatrix(true, true)
  camera.updateMatrixWorld()
  const clip = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    .multiply(robot.group.matrixWorld)
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity
  visitFittedVertices(robot, vertex => {
    vertex.applyMatrix4(clip)
    left = Math.min(left, vertex.x)
    right = Math.max(right, vertex.x)
    bottom = Math.min(bottom, vertex.y)
    top = Math.max(top, vertex.y)
  })
  const size = Math.max((right - left) / 1.84, (top - bottom) / 1.78)
  if (size <= 0 || !Number.isFinite(size)) return
  const x = width * (1 + (left + right) / 2 - size) / 2
  const y = height * (1 - (top + bottom) / 2 - size) / 2
  camera.setViewOffset(width, height, x, y, width * size, height * size)
}
