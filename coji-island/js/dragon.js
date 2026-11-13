// A reusable low-poly dragon with an animation rig. Shows can fly it now; a future story quest can
// reuse the same model for landing, roaring and close-up conversations without rebuilding it.
import * as THREE from 'three'
import { Parts, SMOOTH, box, cyl, cone, sphere, torus } from './build.js'

const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k)

function wing(side, colors) {
  const root = new THREE.Group()
  root.position.set(side * 1.05, 0.5, 0.3)

  // A scalloped membrane gives the silhouette fingers instead of one flat triangle.
  const pos = [
    0, 0, 0,
    side * 5.9, 0.55, -1.2,
    side * 4.9, -0.15, 0.65,
    0, 0, 0,
    side * 4.9, -0.15, 0.65,
    side * 4.2, -0.45, 2.5,
    0, 0, 0,
    side * 4.2, -0.45, 2.5,
    side * 2.55, -0.28, 3.55,
    0, 0, 0,
    side * 2.55, -0.28, 3.55,
    side * 1.2, 0.02, 3.1,
  ]
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.computeVertexNormals()
  const mat = new THREE.MeshStandardMaterial({ color: colors.wing, side: THREE.DoubleSide, transparent: true, opacity: 0.92, roughness: 0.72, metalness: 0 })
  mat.userData.dragonOwned = true
  const membrane = new THREE.Mesh(geo, mat)
  membrane.castShadow = false
  root.add(membrane)

  const bones = new Parts(SMOOTH)
  bones.add(cyl(0.1, 0.16, 5.95, 8), colors.dark, { x: side * 2.9, y: 0.27, z: -0.6, rz: -side * (Math.PI / 2 - 0.1), jitter: 0.02, rough: 0.75 })
  bones.add(cyl(0.075, 0.11, 4.85, 7), colors.dark, { x: side * 2.35, y: -0.06, z: 1.22, rz: -side * 1.3, rx: -0.34, jitter: 0.02, rough: 0.78 })
  bones.add(cyl(0.055, 0.09, 3.65, 7), colors.dark, { x: side * 1.7, y: -0.12, z: 2.05, rz: -side * 1.15, rx: -0.62, jitter: 0.02, rough: 0.8 })
  root.add(bones.build({ shadow: false }))
  return root
}

function tail(colors) {
  const root = new THREE.Group()
  root.position.set(0, 0.05, -2.65)
  const joints = []
  let parent = root
  for (let i = 0; i < 6; i++) {
    const joint = new THREE.Group()
    joint.position.z = i ? -1.05 : 0
    const p = new Parts(SMOOTH)
    const r = 0.55 - i * 0.065
    p.add(sphere(r, 10, 8), i % 2 ? colors.body : colors.red, { z: -0.48, sy: 0.82, sz: 1.3, jitter: 0.025, rough: 0.7 })
    if (i < 4) p.add(cone(0.12 - i * 0.012, 0.42, 6), colors.horn, { y: r * 0.82, z: -0.45, rx: -0.18, jitter: 0.015, rough: 0.82 })
    joint.add(p.build({ shadow: false }))
    parent.add(joint)
    joints.push(joint)
    parent = joint
  }
  const tip = new Parts(SMOOTH)
  tip.add(cone(0.28, 1.45, 8), colors.dark, { z: -1.0, rx: -Math.PI / 2, jitter: 0.02, rough: 0.74 })
  parent.add(tip.build({ shadow: false }))
  return { root, joints }
}

export function makeDragon({ color = '#c42b32', wingColor = '#9f1e2c', belly = '#efb85a' } = {}) {
  const colors = {
    red: color,
    body: new THREE.Color(color).lerp(new THREE.Color('#ff5d45'), 0.18),
    dark: shade(color, 0.62),
    wing: wingColor,
    belly,
    horn: '#f1d59b',
  }
  const root = new THREE.Group()
  root.name = 'Ember the red dragon'

  const body = new Parts(SMOOTH)
  body.add(sphere(1.45, 22, 15), colors.red, { sy: 0.78, sz: 2.15, jitter: 0.025, rough: 0.66 })
  body.add(sphere(0.92, 16, 11), colors.body, { y: 0.35, z: 2.15, sy: 0.8, sz: 1.35, rx: -0.16, jitter: 0.02, rough: 0.64 })
  body.add(sphere(0.72, 18, 12), colors.body, { y: 0.48, z: 3.25, sx: 1.08, sy: 0.82, sz: 1.18, jitter: 0.018, rough: 0.62 })
  body.add(sphere(0.58, 16, 10), colors.body, { y: 0.34, z: 4.05, sx: 1.32, sy: 0.62, sz: 1.15, jitter: 0.016, rough: 0.6 })

  // Warm belly plates make the body readable from below while the dragon circles overhead.
  for (let i = 0; i < 7; i++) body.add(box(1.35 - i * 0.09, 0.08, 0.48, 1, 1, 1), colors.belly, { y: -1.03 + Math.sin(i / 6 * Math.PI) * 0.32, z: 1.75 - i * 0.62, rx: -0.12 + i * 0.025, jitter: 0.01, rough: 0.78 })

  // Face: bright irises, pupils, catch-lights, nostrils and swept horns remain visible at distance.
  for (const side of [-1, 1]) {
    body.add(sphere(0.18, 10, 8), '#fff2bf', { x: side * 0.34, y: 0.64, z: 4.55, sx: 1.1, sy: 0.82, sz: 0.45, ry: side * 0.16, jitter: 0, rough: 0.18 })
    body.add(sphere(0.1, 9, 7), '#72d06d', { x: side * 0.35, y: 0.64, z: 4.68, sx: 0.72, sy: 1.05, sz: 0.35, ry: side * 0.16, jitter: 0, rough: 0.12 })
    body.add(sphere(0.048, 7, 6), '#160b0b', { x: side * 0.35, y: 0.64, z: 4.76, sx: 0.42, sy: 1.45, sz: 0.3, jitter: 0, rough: 0.1 })
    body.add(sphere(0.027, 5, 4), '#ffffff', { x: side * 0.325, y: 0.69, z: 4.8, jitter: 0, rough: 0.05 })
    body.add(sphere(0.045, 7, 5), '#351015', { x: side * 0.23, y: 0.38, z: 4.72, sx: 0.7, sy: 0.45, sz: 0.35, jitter: 0, rough: 0.35 })
    body.add(cone(0.19, 0.95, 8), colors.horn, { x: side * 0.42, y: 1.12, z: 3.45, rx: -0.45, rz: side * 0.24, jitter: 0.015, rough: 0.8 })
    body.add(cone(0.13, 0.55, 7), colors.horn, { x: side * 0.5, y: 0.82, z: 3.92, rx: 0.2, rz: side * 0.5, jitter: 0.015, rough: 0.82 })
  }

  // Four tucked flying legs and ivory claws.
  const legs = []
  for (const side of [-1, 1])
    for (const back of [-1, 1]) {
      const leg = new THREE.Group()
      leg.position.set(side * 1.05, -0.72, back * 1.05 - 0.15)
      const lp = new Parts(SMOOTH)
      lp.add(sphere(0.38, 11, 8), colors.dark, { sy: 1.35, sz: 0.72, rz: side * 0.15, jitter: 0.025, rough: 0.72 })
      lp.add(sphere(0.28, 10, 7), colors.body, { y: -0.48, z: 0.18, sx: 1.25, sy: 0.6, sz: 1.05, jitter: 0.02, rough: 0.7 })
      for (let c = -1; c <= 1; c++) lp.add(cone(0.055, 0.28, 6), colors.horn, { x: c * 0.12, y: -0.5, z: 0.43, rx: Math.PI / 2, jitter: 0.01, rough: 0.82 })
      leg.add(lp.build({ shadow: false }))
      root.add(leg)
      legs.push(leg)
    }

  // A line of crown-like spines runs from the neck to the back.
  for (let i = 0; i < 9; i++) body.add(cone(0.16 + Math.sin((i / 8) * Math.PI) * 0.1, 0.62, 7), i % 2 ? colors.horn : colors.belly, { y: 1.05 + Math.sin((i / 8) * Math.PI) * 0.28, z: 2.45 - i * 0.65, rx: -0.18, jitter: 0.015, rough: 0.8 })
  root.add(body.build({ shadow: false }))

  const jaw = new THREE.Group()
  jaw.position.set(0, 0.06, 4.18)
  const jp = new Parts(SMOOTH)
  jp.add(sphere(0.5, 14, 8), colors.dark, { y: -0.02, z: 0.1, sx: 1.25, sy: 0.28, sz: 1.05, jitter: 0.015, rough: 0.62 })
  jp.add(sphere(0.34, 12, 7), '#6d1c26', { y: 0.04, z: 0.2, sx: 1.35, sy: 0.16, sz: 0.85, jitter: 0, rough: 0.4 })
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) jp.add(cone(0.04, 0.18, 5), '#fff4d0', { x: side * (0.16 + i * 0.11), y: 0.08, z: -0.03 + i * 0.13, rx: Math.PI, jitter: 0, rough: 0.6 })
  jaw.add(jp.build({ shadow: false }))
  root.add(jaw)

  const wings = [wing(-1, colors), wing(1, colors)]
  wings.forEach((w) => root.add(w))
  const t = tail(colors)
  root.add(t.root)

  root.userData.wings = wings
  root.userData.jaw = jaw
  root.userData.tail = t.joints
  root.userData.legs = legs
  root.userData.animate = (time, { roar = false } = {}) => {
    const flap = Math.sin(time * 5.4) * 0.52
    wings[0].rotation.z = 0.08 + flap
    wings[1].rotation.z = -0.08 - flap
    wings[0].rotation.x = 0.06 + Math.sin(time * 2.7) * 0.05
    wings[1].rotation.x = 0.06 + Math.sin(time * 2.7) * 0.05
    t.joints.forEach((j, i) => {
      j.rotation.y = Math.sin(time * 1.8 - i * 0.58) * (0.13 + i * 0.018)
      j.rotation.x = Math.sin(time * 1.25 - i * 0.4) * 0.035
    })
    legs.forEach((leg, i) => (leg.rotation.x = 0.2 + Math.sin(time * 3 + i) * 0.08))
    jaw.rotation.x = roar ? 0.3 + Math.sin(time * 16) * 0.035 : 0.035 + Math.max(0, Math.sin(time * 1.4)) * 0.035
  }
  return root
}

export function disposeDragon(dragon) {
  dragon.traverse((o) => {
    o.geometry?.dispose()
    if (o.material?.userData?.dragonOwned) o.material.dispose()
  })
}
