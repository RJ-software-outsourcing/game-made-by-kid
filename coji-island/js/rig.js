// One draw call per character. A character is built from many little meshes (head, arms, legs, eyes,
// clothes) that the animation code moves around. Drawing each one separately costs a draw call (and a
// shadow draw call) per piece, which is what slows an iPad down. mergeRig() fuses the pieces into one
// skinned mesh per material: every original piece becomes a "bone" that its own vertices follow, so
// all the existing animation code (rotating the arms, nodding the head, squashing the body) keeps
// working unchanged, but the GPU gets one draw call.
import * as THREE from 'three'

// The original pieces keep their place in the hierarchy (they are the bones now) but no longer draw.
const HIDDEN = new THREE.MeshBasicMaterial({ visible: false })
const _inv = new THREE.Matrix4()
const _m = new THREE.Matrix4()
const _n = new THREE.Matrix3()
const _v = new THREE.Vector3()

// keep: meshes that must stay separate (cloth that is simulated, things that get shown and hidden).
export function mergeRig(root, { keep = [] } = {}) {
  root.updateMatrixWorld(true)
  const keepSet = new Set(keep.filter(Boolean))
  const kept = (o) => {
    for (let p = o; p && p !== root; p = p.parent) if (keepSet.has(p)) return true
    return false
  }
  const meshes = []
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || !o.visible || kept(o)) return
    if (Array.isArray(o.material) || o.material.visible === false) return
    if (o.material.isShaderMaterial) return
    if (!o.geometry.attributes.position) return
    meshes.push(o)
  })
  if (meshes.length < 2) return null
  _inv.copy(root.matrixWorld).invert()
  const byMat = new Map()
  meshes.forEach((mesh, bone) => {
    const list = byMat.get(mesh.material) || []
    list.push({ mesh, bone })
    byMat.set(mesh.material, list)
  })
  const skeleton = new THREE.Skeleton(meshes)
  const out = []
  for (const [mat, list] of byMat) {
    let count = 0
    const geos = list.map(({ mesh }) => {
      const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry
      count += g.attributes.position.count
      return g
    })
    const hasUv = geos.every((g) => g.attributes.uv)
    const pos = new Float32Array(count * 3)
    const nor = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const pbr = new Float32Array(count * 2)
    const uv = hasUv ? new Float32Array(count * 2) : null
    const si = new Uint16Array(count * 4)
    const sw = new Float32Array(count * 4)
    let o = 0
    list.forEach(({ mesh, bone }, k) => {
      const g = geos[k]
      _m.multiplyMatrices(_inv, mesh.matrixWorld)
      _n.getNormalMatrix(_m)
      const P = g.attributes.position
      const N = g.attributes.normal
      const Cc = g.attributes.color
      const R = g.attributes.pbr
      const U = g.attributes.uv
      for (let i = 0; i < P.count; i++, o++) {
        _v.fromBufferAttribute(P, i).applyMatrix4(_m)
        pos.set([_v.x, _v.y, _v.z], o * 3)
        if (N) _v.fromBufferAttribute(N, i).applyMatrix3(_n).normalize()
        else _v.set(0, 1, 0)
        nor.set([_v.x, _v.y, _v.z], o * 3)
        if (Cc) col.set([Cc.getX(i), Cc.getY(i), Cc.getZ(i)], o * 3)
        else col.set([1, 1, 1], o * 3)
        if (R) pbr.set([R.getX(i), R.getY(i)], o * 2)
        if (uv) uv.set([U.getX(i), U.getY(i)], o * 2)
        si[o * 4] = bone
        sw[o * 4] = 1
      }
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('pbr', new THREE.BufferAttribute(pbr, 2))
    if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4))
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4))
    // a material that never had vertex colors gets white ones (so its color shows unchanged)
    const sm = new THREE.SkinnedMesh(geo, mat)
    sm.castShadow = list.some(({ mesh }) => mesh.castShadow)
    sm.receiveShadow = list.some(({ mesh }) => mesh.receiveShadow)
    sm.userData.rig = true
    root.add(sm)
    sm.updateMatrixWorld(true)
    sm.bind(skeleton)
    // the limbs swing a little beyond the pose they were built in
    sm.computeBoundingSphere()
    sm.boundingSphere.radius *= 1.25
    out.push(sm)
    for (const { mesh } of list) mesh.material = HIDDEN
  }
  return out
}
