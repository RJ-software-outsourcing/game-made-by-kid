import * as THREE from '../vendor/three.module.js'

// CPU-only spans. Accent identity survives even when a team chooses the exact
// same RGB value as the steel, ivory enamel, rubber or another fixed finish.
export const paintSpans = new WeakMap()

let sharedMaterial
let references = 0

export function acquireSurfaceMaterial() {
  if (!sharedMaterial) {
    sharedMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })
    sharedMaterial.name = 'Kiln enamel, steel, rubber and phosphor'
    sharedMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 surface;\nvarying vec4 vSurface;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurface = surface;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec4 vSurface;')
        .replace(
          '#include <roughnessmap_fragment>',
          '#include <roughnessmap_fragment>\nroughnessFactor = vSurface.x;'
        )
        .replace(
          '#include <metalnessmap_fragment>',
          '#include <metalnessmap_fragment>\nmetalnessFactor = vSurface.y;'
        )
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vSurface.z;'
        )
    }
  }
  references++
  return sharedMaterial
}

export function releaseSurfaceMaterial() {
  if (--references === 0) {
    sharedMaterial.dispose()
    sharedMaterial = undefined
  }
}

export function bakeSurfaces(pieces, paint) {
  let vertices = 0
  let elements = 0
  for (const { geometry } of pieces) {
    vertices += geometry.attributes.position.count
    elements += geometry.index?.count ?? geometry.attributes.position.count
  }
  const positions = new Float32Array(vertices * 3)
  const normals = new Int16Array(vertices * 3)
  const colors = new Uint16Array(vertices * 3)
  const finishes = new Uint8Array(vertices * 4)
  const indices = vertices > 65535 ? new Uint32Array(elements) : new Uint16Array(elements)
  const nMatrix = new THREE.Matrix3()
  const v = new THREE.Vector3()
  let offset = 0
  let index = 0
  const spans = []
  for (const { geometry, matrix, color, finish } of pieces) {
    nMatrix.getNormalMatrix(matrix)
    const p = geometry.attributes.position
    const n = geometry.attributes.normal
    if (paint && (color === paint || color === paint.coat))
      spans.push([offset * 3, (offset + p.count) * 3, color === paint ? 0 : 1])
    const [red, green, blue] = color.toArray().map((value) => Math.round(value * 65535))
    const [roughness, metalness, emission] = finish.map((value) => Math.round(value * 255))
    // Powder coat uses the fourth byte for an exposed lip. On a machined
    // cylinder it instead measures distance along the shaft or out from
    // the axle center, so the turning marks follow the actual moving part.
    const turned = geometry.type === 'CylinderGeometry' && finish[1] > .6
    let shaftEnd = 0, capTop = 0, capBottom = 0
    if (turned) {
      const m = matrix.elements, dims = geometry.parameters
      const radial = Math.hypot(m[0], m[1], m[2])
      const station = (distance) => 8 + Math.min(247, Math.round(distance * 235))
      shaftEnd = station(dims.height * Math.hypot(m[4], m[5], m[6]))
      capTop = station(dims.radiusTop * radial)
      capBottom = station(dims.radiusBottom * radial)
    }
    for (let i = 0; i < p.count; i++) {
      const j = (offset + i) * 3
      v.fromBufferAttribute(p, i).applyMatrix4(matrix).toArray(positions, j)
      v.fromBufferAttribute(n, i).applyNormalMatrix(nMatrix).multiplyScalar(32767).round().toArray(normals, j)
      colors[j] = red
      colors[j + 1] = green
      colors[j + 2] = blue
      const f = (offset + i) * 4
      finishes[f] = roughness
      finishes[f + 1] = metalness
      finishes[f + 2] = emission
      if (turned) {
        const axial = n.getY(i)
        if (Math.abs(axial) < .99) finishes[f + 3] = p.getY(i) > 0 ? shaftEnd : 8
        else if (p.getX(i) === 0 && p.getZ(i) === 0) finishes[f + 3] = 8
        else finishes[f + 3] = axial > 0 ? capTop : capBottom
      } else if (finish[1] < .46) finishes[f + 3] = geometry.userData.fold?.[i] || 0
    }
    const count = geometry.index?.count ?? p.count
    for (let i = 0; i < count; i++) indices[index++] = offset + (geometry.index ? geometry.index.getX(i) : i)
    offset += p.count
  }
  const combined = new THREE.BufferGeometry()
  if (spans.length) paintSpans.set(combined, spans)
  combined.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  combined.setAttribute('normal', new THREE.BufferAttribute(normals, 3, true))
  combined.setAttribute('color', new THREE.BufferAttribute(colors, 3, true))
  combined.setAttribute('surface', new THREE.BufferAttribute(finishes, 4, true))
  combined.setIndex(new THREE.BufferAttribute(indices, 1))
  combined.computeBoundingSphere()
  return combined
}
