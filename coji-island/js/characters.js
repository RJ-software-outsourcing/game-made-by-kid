// Coji, the islanders and the animals: low-poly models built from colored primitives,
// with simple procedural animation (walk, breathe, look, talk, wave).
import * as THREE from 'three'
import { Parts, MAT2, box, cyl, cone, ico, sphere, torus } from './build.js'
import { UNIFORM, BLANKIE, COJI } from './config.js'

const KID = { leg: 0.44, hip: 0.15, torso: 0.46, bodyR: 0.25, headR: 0.4, arm: 0.42, armR: 0.072, legR: 0.09, neck: 0.03 }
const ADULT = { leg: 0.7, hip: 0.18, torso: 0.66, bodyR: 0.33, headR: 0.39, arm: 0.6, armR: 0.092, legR: 0.115, neck: 0.06 }

const lerp = (a, b, t) => a + (b - a) * t
const darker = (hex, k = 0.85) => new THREE.Color(hex).multiplyScalar(k)

// ---------- heads ----------

function addFace(p, r, o) {
  p.add(ico(r, 2), o.skin, { sy: 0.97, jitter: 0.015 })
  // ears
  for (const s of [-1, 1]) p.add(ico(r * 0.2, 1), o.skin, { x: s * r * 0.97, y: -r * 0.05, sx: 0.55, jitter: 0 })
  // eyes with a sparkle
  const ey = -r * 0.04
  for (const s of [-1, 1]) {
    p.add(ico(r * 0.13, 1), '#1d1717', { x: s * r * 0.36, y: ey, z: r * 0.86, sz: 0.6, sy: 1.1, jitter: 0 })
    p.add(ico(r * 0.045, 0), '#ffffff', { x: s * r * 0.36 + r * 0.05, y: ey + r * 0.06, z: r * 0.93, jitter: 0 })
    p.add(ico(r * 0.12, 1), o.cheeks || '#f4a6a0', { x: s * r * 0.58, y: -r * 0.25, z: r * 0.75, sz: 0.35, jitter: 0 })
  }
  // little open smile (a flattened half sphere) and nose
  p.add(sphere(r * 0.13, 10, 4, Math.PI / 2, Math.PI / 2), '#8e3b36', { y: -r * 0.3, z: r * 0.92, sz: 0.3, jitter: 0 })
  p.add(ico(r * 0.06, 0), darker(o.skin, 0.9), { y: -r * 0.12, z: r * 0.98, jitter: 0 })
  if (o.glasses) {
    for (const s of [-1, 1]) p.add(torus(r * 0.17, r * 0.025, 4, 12), o.glasses, { x: s * r * 0.36, y: ey, z: r * 0.97, jitter: 0 })
    p.add(box(r * 0.2, r * 0.03, r * 0.03), o.glasses, { y: ey + r * 0.05, z: r * 1.0, jitter: 0 })
  }
}

function addHair(p, r, o) {
  const c = o.hair
  switch (o.hairStyle) {
    case 'bowl': {
      // Coji: a cap tilted back (bangs at the brow, covers the back), plus a jagged fringe.
      p.add(sphere(r * 1.08, 14, 9, 0, Math.PI * 0.62), c, { rx: -0.62, y: r * 0.02, jitter: 0.03 })
      for (let i = -2; i <= 2; i++)
        p.add(cone(r * 0.16, r * 0.34, 4), c, { x: i * r * 0.19, y: r * 0.3, z: r * 0.86, rx: Math.PI + 0.35, rz: i * 0.08, jitter: 0.03 })
      for (const s of [-1, 1]) p.add(ico(r * 0.3, 1), c, { x: s * r * 0.86, y: r * 0.1, z: r * 0.1, sx: 0.45, sy: 1.1, jitter: 0.03 })
      break
    }
    case 'short':
      p.add(sphere(r * 1.06, 12, 8, 0, Math.PI * 0.55), c, { rx: -0.5, y: r * 0.06, jitter: 0.04 })
      break
    case 'bun':
      p.add(sphere(r * 1.06, 12, 8, 0, Math.PI * 0.55), c, { rx: -0.45, y: r * 0.06, jitter: 0.04 })
      p.add(ico(r * 0.38, 1), c, { y: r * 0.95, z: -r * 0.35 })
      break
    case 'bob':
      p.add(sphere(r * 1.08, 12, 8, 0, Math.PI * 0.68), c, { rx: -0.35, y: r * 0.02, jitter: 0.04 })
      break
    case 'pigtails':
      p.add(sphere(r * 1.07, 12, 8, 0, Math.PI * 0.58), c, { rx: -0.45, y: r * 0.05, jitter: 0.04 })
      for (const s of [-1, 1]) {
        p.add(ico(r * 0.32, 1), c, { x: s * r * 1.05, y: -r * 0.2, z: -r * 0.2, sy: 1.4 })
        p.add(ico(r * 0.1, 0), '#ff5d8f', { x: s * r * 0.98, y: r * 0.18, z: -r * 0.2 })
      }
      break
    case 'bald':
      for (const s of [-1, 1]) p.add(ico(r * 0.42, 1), c, { x: s * r * 0.75, y: -r * 0.05, z: -r * 0.25, sx: 0.5 })
      p.add(ico(r * 0.5, 1), c, { y: -r * 0.05, z: -r * 0.72, sz: 0.5 })
      break
  }
  if (o.beard) {
    p.add(ico(r * 0.62, 1), o.beard, { y: -r * 0.55, z: r * 0.45, sz: 0.65, sy: 0.85 })
    p.add(ico(r * 0.2, 1), o.beard, { x: -r * 0.17, y: -r * 0.2, z: r * 0.92, sx: 1.6, sy: 0.6, sz: 0.5 })
    p.add(ico(r * 0.2, 1), o.beard, { x: r * 0.17, y: -r * 0.2, z: r * 0.92, sx: 1.6, sy: 0.6, sz: 0.5 })
  }
  switch (o.hat) {
    case 'captain':
      p.add(cyl(r * 1.05, r * 0.95, r * 0.42, 12), '#ffffff', { y: r * 0.72 })
      p.add(cyl(r * 0.98, r * 0.98, r * 0.16, 12), '#22325e', { y: r * 0.55 })
      p.add(cyl(r * 0.6, r * 0.6, r * 0.05, 12), '#1a1a1a', { y: r * 0.5, z: r * 0.62, sz: 0.9, rx: 0.25 })
      p.add(ico(r * 0.12, 0), '#f1c232', { y: r * 0.72, z: r * 0.98 })
      break
    case 'chef':
      p.add(cyl(r * 0.85, r * 0.8, r * 0.5, 12), '#ffffff', { y: r * 0.85 })
      p.add(ico(r * 0.62, 1), '#ffffff', { y: r * 1.25, sx: 1.25, sz: 1.25, sy: 0.75 })
      break
    case 'cap':
      p.add(sphere(r * 1.06, 12, 6, 0, Math.PI * 0.45), o.hatColor, { y: r * 0.12 })
      p.add(cyl(r * 0.55, r * 0.55, r * 0.05, 10), darker(o.hatColor, 0.9), { y: r * 0.5, z: r * 0.7, rx: 0.15, sx: 1.1 })
      break
    case 'bucket':
      p.add(cyl(r * 0.8, r * 1.0, r * 0.45, 10), o.hatColor, { y: r * 0.72 })
      p.add(cyl(r * 1.35, r * 1.35, r * 0.06, 12), o.hatColor, { y: r * 0.5 })
      break
  }
}

// ---------- people ----------

// Stacked colored rings make a striped shirt.
function bandedTorso(p, rb, rt, y0, h, bands, seg = 10) {
  let acc = 0
  for (const [f, c] of bands) {
    const r0 = lerp(rb, rt, acc)
    const r1 = lerp(rb, rt, acc + f)
    p.add(new THREE.CylinderGeometry(r1, r0, h * f, seg, 1, true), c, { y: y0 + h * (acc + f / 2), jitter: 0.02, mat: MAT2 })
    acc += f
  }
}

export class Person {
  constructor(look) {
    this.look = look
    const P = look.kid ? KID : ADULT
    this.P = P
    const o = look
    const root = new THREE.Group()
    this.root = root
    this.phase = Math.random() * 6
    this.seed = Math.random() * 10
    this.speed = 0
    this.talk = 0
    this.wave = 0
    this.lookYaw = 0
    this.cheer = 0

    // Legs: pivot at the hip.
    const legs = []
    for (const s of [-1, 1]) {
      const p = new Parts()
      const L = P.leg
      const longPants = o.pantsLong
      p.add(cyl(P.legR, P.legR * 0.92, L, 7), longPants ? o.pants : o.skin, { y: -L / 2 })
      if (!longPants && !o.dress) {
        p.add(cyl(P.legR * 1.45, P.legR * 1.35, L * 0.36, 8), o.pants, { y: -L * 0.16 })
        if (o.piping) p.add(box(0.02, L * 0.34, 0.03), o.piping, { x: s * P.legR * 1.42, y: -L * 0.16, jitter: 0 })
      }
      if (o.socks) p.add(cyl(P.legR * 1.06, P.legR * 1.02, L * 0.22, 7), o.socks, { y: -L + L * 0.15 })
      p.add(box(P.legR * 2.3, 0.1, P.legR * 3.3), o.shoes, { y: -L + 0.07, z: P.legR * 0.55 })
      if (o.soles) p.add(box(P.legR * 2.35, 0.035, P.legR * 3.4), o.soles, { y: -L + 0.018, z: P.legR * 0.55, jitter: 0 })
      const leg = p.build()
      leg.position.set(s * P.bodyR * 0.45, P.leg, 0)
      root.add(leg)
      legs.push(leg)
    }
    ;[this.legR, this.legL] = legs // s=-1 is the right side (character faces +z)

    // Body: torso + head + arms. Pivot at the hips.
    const body = new THREE.Group()
    body.position.y = P.leg
    root.add(body)
    this.body = body
    this.bodyY = P.leg
    const p = new Parts()
    const shirtTop = P.hip * 0.6 + P.torso
    if (o.uniform) {
      const U = UNIFORM
      p.add(cyl(P.bodyR * 1.06, P.bodyR * 1.1, P.hip, 10), U.shorts, { y: P.hip / 2 - 0.02 })
      const stripe = [
        [0.05, U.stripe],
        [0.018, U.stripeLine],
        [0.13, U.shirt],
      ]
      bandedTorso(p, P.bodyR * 1.12, P.bodyR * 0.9, P.hip * 0.6, P.torso, [[0.08, U.shirt], ...stripe, ...stripe, ...stripe, ...stripe, [0.124, U.navy]])
      p.add(sphere(P.bodyR * 0.9, 10, 4, 0, Math.PI / 2), U.navy, { y: shirtTop, sy: 0.45 })
      // V collar and crest
      p.add(box(0.13, 0.13, 0.02), U.navy, { y: shirtTop - 0.06, z: P.bodyR * 0.92, rz: Math.PI / 4, jitter: 0 })
      p.add(torus(0.115, 0.03, 4, 12), U.navy, { y: shirtTop + 0.02, rx: Math.PI / 2 })
      p.add(cyl(0.035, 0.035, 0.012, 10), U.crest, { x: 0.1, y: shirtTop - 0.14, z: P.bodyR * 0.98, rx: Math.PI / 2 - 0.15, jitter: 0 })
    } else {
      p.add(cyl(P.bodyR * 1.04, P.bodyR * 1.08, P.hip, 10), o.dress || o.pants, { y: P.hip / 2 - 0.02 })
      if (o.stripes) {
        const bands = []
        for (let i = 0; i < 5; i++) bands.push([0.12, o.shirt], [0.08, o.stripes])
        bandedTorso(p, P.bodyR * 1.05, P.bodyR * 0.9, P.hip * 0.6, P.torso, bands)
      } else {
        bandedTorso(p, P.bodyR * 1.05, P.bodyR * 0.9, P.hip * 0.6, P.torso, [[1, o.shirt]])
      }
      p.add(sphere(P.bodyR * 0.9, 10, 4, 0, Math.PI / 2), o.shirt, { y: shirtTop, sy: 0.45 })
      if (o.dress) p.add(cyl(P.bodyR * 1.05, P.bodyR * 1.7, P.leg * 0.55, 10), o.dress, { y: -P.leg * 0.2 })
      if (o.apron) {
        p.add(box(P.bodyR * 1.3, P.torso * 0.75, 0.04), o.apron, { y: P.hip * 0.6 + P.torso * 0.4, z: P.bodyR * 1.0, jitter: 0.02 })
        p.add(box(P.bodyR * 1.3, P.leg * 0.45, 0.04), o.apron, { y: -P.leg * 0.12, z: P.bodyR * 1.08, jitter: 0.02 })
      }
      if (o.coat) {
        for (const s of [-1, 1]) p.add(box(P.bodyR * 0.7, P.torso, 0.05), o.coat, { x: s * P.bodyR * 0.55, y: P.hip * 0.6 + P.torso / 2, z: P.bodyR * 0.88, rz: s * 0.04 })
        for (let i = 0; i < 3; i++) p.add(ico(0.03, 0), '#f1c232', { x: P.bodyR * 0.25, y: P.hip + 0.12 + i * 0.17, z: P.bodyR * 0.96 })
      }
      if (o.bow) {
        for (const s of [-1, 1]) p.add(cone(0.06, 0.1, 4), o.bow, { x: s * 0.05, y: shirtTop - 0.02, z: P.bodyR * 0.85, rz: (s * Math.PI) / 2 })
      }
      if (o.collar) p.add(torus(0.12, 0.03, 4, 12), o.collar, { y: shirtTop + 0.02, rx: Math.PI / 2 })
    }
    p.add(cyl(0.09, 0.1, P.neck + 0.08, 8), o.skin, { y: shirtTop + 0.02 })
    const torsoMesh = p.build()
    body.add(torsoMesh)

    // Head
    const head = new THREE.Group()
    const headY = shirtTop + P.neck + P.headR * 0.92
    head.position.y = headY
    const hp = new Parts()
    addFace(hp, P.headR, o)
    addHair(hp, P.headR, o)
    head.add(hp.build())
    body.add(head)
    this.head = head
    this.headY = headY

    // Arms: pivot at the shoulder.
    const arms = []
    for (const s of [-1, 1]) {
      const ap = new Parts()
      const A = P.arm
      const sleeve = o.uniform ? UNIFORM.navy : o.coat || o.shirt
      ap.add(cyl(P.armR * 1.35, P.armR * 1.3, A * (o.longSleeves ? 0.85 : 0.36), 7), sleeve, { y: -A * (o.longSleeves ? 0.42 : 0.17) })
      if (o.uniform) ap.add(box(0.02, A * 0.34, 0.025), UNIFORM.piping, { x: s * P.armR * 1.33, y: -A * 0.17, jitter: 0 })
      ap.add(cyl(P.armR, P.armR * 0.9, A, 7), o.skin, { y: -A / 2 - 0.01 })
      ap.add(ico(P.armR * 1.25, 1), o.skin, { y: -A - 0.02 })
      const arm = ap.build()
      arm.position.set(s * (P.bodyR * 0.95 + P.armR), shirtTop - 0.06, 0)
      arm.rotation.z = s * 0.12
      body.add(arm)
      arms.push(arm)
    }
    ;[this.armR, this.armL] = arms

    if (o.rod) {
      const rp = new Parts()
      rp.add(cyl(0.025, 0.035, 2.6, 5), '#8b5a2b', { y: 1.2 })
      const rod = rp.build()
      rod.position.set(0, -P.arm, 0.05)
      rod.rotation.x = 1.6
      this.armR.add(rod)
      // The line hangs straight down from the rod tip into the water.
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 2.2, 3), new THREE.MeshBasicMaterial({ color: 0xeeeeee }))
      line.position.set(0, 2.4 - 0.594, 0.924)
      line.rotation.x = 2.14
      rod.add(line)
    }

    if (o.blankie) this.addBlankie()
    if (o.sit) this.sit()
    root.traverse((m) => {
      if (m.isMesh) m.castShadow = true
    })
  }

  // Blankie Bear: a knit cape with light-blue stripes, a scarf, and the bear head on the right shoulder.
  addBlankie() {
    const P = this.P
    const B = BLANKIE
    const top = P.hip * 0.6 + P.torso + 0.02
    const cols = 6
    const rows = 7
    const W = 0.74
    const H = 0.7
    const rowColor = [B.knit, B.knit, B.stripe, B.knit, B.stripe, B.knit, B.rib]
    const pos = []
    const col = []
    const rest = []
    const c = new THREE.Color()
    const vtx = (u, v) => [u, v]
    for (let r = 0; r < rows; r++)
      for (let k = 0; k < cols; k++) {
        const u0 = (k / cols) * 2 - 1
        const u1 = ((k + 1) / cols) * 2 - 1
        const v0 = r / rows
        const v1 = (r + 1) / rows
        const quad = [vtx(u0, v0), vtx(u0, v1), vtx(u1, v0), vtx(u0, v1), vtx(u1, v1), vtx(u1, v0)]
        c.set(rowColor[r])
        const j = 1 + (Math.random() * 2 - 1) * 0.05
        for (const [u, v] of quad) {
          rest.push(u, v)
          pos.push(0, 0, 0)
          col.push(c.r * j, c.g * j, c.b * j)
        }
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    const cape = new THREE.Mesh(g, MAT2)
    cape.castShadow = true
    cape.frustumCulled = false
    this.body.add(cape)
    this.cape = { mesh: cape, rest, top, W, H, sway: 0 }
    this.updateCape(0, 0)

    // Scarf part around the neck
    const sp = new Parts()
    sp.add(torus(0.2, 0.075, 6, 14), B.knit, { y: top + 0.02, rx: Math.PI / 2 + 0.12, jitter: 0.06 })
    // a corner of the blanket hangs over the left shoulder
    sp.add(cone(0.12, 0.3, 4), B.knit, { x: 0.17, y: top - 0.12, z: 0.17, rx: Math.PI + 0.25, rz: 0.15, sz: 0.35, jitter: 0.06 })
    sp.add(cone(0.08, 0.12, 4), B.stripe, { x: 0.18, y: top - 0.04, z: 0.2, rx: Math.PI + 0.25, rz: 0.15, sz: 0.3, jitter: 0.04 })
    this.body.add(sp.build())

    // The little bear head on the right shoulder, looking back at the player.
    const bh = new THREE.Group()
    const bp = new Parts()
    bp.add(ico(0.16, 1), B.head, { sy: 0.92, jitter: 0.06 })
    for (const s of [-1, 1]) {
      bp.add(ico(0.065, 1), B.ears, { x: s * 0.115, y: 0.11, sz: 0.6 })
      bp.add(ico(0.02, 0), B.features, { x: s * 0.055, y: 0.035, z: 0.145, jitter: 0 })
    }
    bp.add(ico(0.075, 1), B.muzzle, { y: -0.035, z: 0.12, sz: 0.6, jitter: 0.04 })
    bp.add(ico(0.028, 0), B.features, { y: -0.01, z: 0.168, sx: 1.3, jitter: 0 })
    bp.add(box(0.012, 0.045, 0.01), B.features, { y: -0.055, z: 0.16, rz: 0.25, jitter: 0 })
    bh.add(bp.build())
    bh.scale.setScalar(1.3)
    bh.position.set(-0.25, top + 0.14, -0.12)
    bh.rotation.set(0.3, -2.6, 0.15)
    this.body.add(bh)
    this.bearHead = bh
  }

  updateCape(dt, t) {
    const cp = this.cape
    const P = this.P
    const target = Math.min(1, this.speed / 6)
    cp.sway += (target - cp.sway) * Math.min(1, dt * 4)
    const attr = cp.mesh.geometry.attributes.position
    const a = attr.array
    const R = P.bodyR
    for (let i = 0, n = cp.rest.length / 2; i < n; i++) {
      const u = cp.rest[i * 2]
      const v = cp.rest[i * 2 + 1]
      const flare = 1 + 0.3 * v
      const x = u * (cp.W / 2) * flare
      let y = cp.top - v * cp.H
      // wrap around the back and over the shoulders
      let z = -(R * 0.95 + 0.05) + u * u * 0.16 - v * 0.05
      if (v < 0.15) {
        z += (0.15 - v) * 1.4
        y += (0.15 - v) * 0.3
      }
      const flutter = Math.sin(t * 9 + v * 5 + u * 2) * 0.03 * cp.sway * v
      const breeze = Math.sin(t * 1.7 + u * 1.5) * 0.012 * v
      z -= cp.sway * 0.32 * v * v + flutter + breeze
      y += cp.sway * 0.12 * v * v
      a[i * 3] = x
      a[i * 3 + 1] = y
      a[i * 3 + 2] = z
    }
    attr.needsUpdate = true
    cp.mesh.geometry.computeVertexNormals()
  }

  sit() {
    this.seated = true
    this.bodyY = 0.42
    this.body.position.y = this.bodyY
    for (const leg of [this.legL, this.legR]) {
      leg.position.y = 0.42
      leg.rotation.x = -1.45
    }
  }

  stand() {
    this.seated = false
    this.bodyY = this.P.leg
    this.body.position.y = this.bodyY
    for (const leg of [this.legL, this.legR]) {
      leg.position.y = this.P.leg
      leg.rotation.x = 0
    }
  }

  update(dt, t) {
    const P = this.P
    const moving = this.speed > 0.2 && !this.seated
    if (moving) this.phase += dt * Math.min(20, this.speed * 3.1)
    const amp = moving ? Math.min(1, this.speed / 4) : 0
    this.swing = lerp(this.swing || 0, Math.sin(this.phase) * amp, Math.min(1, dt * 12))
    const sw = this.swing
    if (!this.seated) {
      this.legL.rotation.x = sw * 0.75
      this.legR.rotation.x = -sw * 0.75
      this.body.position.y = this.bodyY + Math.abs(Math.sin(this.phase)) * 0.05 * amp + (this.cheer > 0 ? Math.abs(Math.sin(t * 10)) * 0.15 : 0)
    } else {
      this.body.position.y = this.bodyY
    }
    this.armL.rotation.x = -sw * 0.65
    this.armR.rotation.x = sw * 0.65
    // breathing
    this.body.scale.y = 1 + Math.sin(t * 2.2 + this.seed) * 0.012
    // waving / cheering
    if (this.wave > 0) {
      this.wave -= dt
      this.armR.rotation.x = -2.7
      this.armR.rotation.z = -0.4 + Math.sin(t * 12) * 0.35
    } else if (this.cheer > 0) {
      this.cheer -= dt
      this.armR.rotation.x = -2.9
      this.armL.rotation.x = -2.9
      this.armR.rotation.z = -0.3
      this.armL.rotation.z = 0.3
    } else {
      this.armR.rotation.z = -0.12
      this.armL.rotation.z = 0.12
    }
    if (this.look.rod) this.armR.rotation.x = -0.6 + Math.sin(t * 0.8) * 0.05
    // head: look toward a direction, nod while talking
    this.head.rotation.y = lerp(this.head.rotation.y, this.lookYaw, Math.min(1, dt * 5))
    this.head.rotation.x = this.talk > 0 ? Math.sin(t * 9) * 0.07 : Math.sin(t * 0.7 + this.seed) * 0.03
    if (this.talk > 0) this.talk -= dt
    if (this.cape) this.updateCape(dt, t)
  }

  // Where the face is (for the portrait camera), in root space.
  get faceY() {
    return this.bodyY + this.headY
  }
}

// ---------- looks ----------

export const LOOKS = {
  coji: {
    kid: true,
    skin: COJI.skin,
    hair: COJI.hair,
    hairStyle: 'bowl',
    cheeks: COJI.cheeks,
    uniform: true,
    pants: UNIFORM.shorts,
    piping: UNIFORM.piping,
    socks: UNIFORM.socks,
    shoes: UNIFORM.shoes,
    soles: UNIFORM.soles,
    blankie: true,
  },
  pip: { skin: '#f7cfb0', hair: '#7a4a2a', hairStyle: 'short', beard: '#7a4a2a', hat: 'captain', shirt: '#ffffff', coat: '#2b4c8c', longSleeves: true, pants: '#f4f1ea', pantsLong: true, shoes: '#2a2a2a' },
  finn: { skin: '#e8b48f', hair: '#3b2a1f', hairStyle: 'short', hat: 'bucket', hatColor: '#f2c94c', shirt: '#4a90c8', stripes: '#ffffff', pants: '#5a6b8c', pantsLong: true, shoes: '#6b4a2b', rod: true, sit: true },
  ben: { skin: '#f3cfb0', hair: '#c46a2b', hairStyle: 'short', hat: 'chef', shirt: '#ffffff', apron: '#ef5b5b', pants: '#3a3a4a', pantsLong: true, shoes: '#2a2a2a' },
  granny: { skin: '#f5d3ba', hair: '#ebe7e1', hairStyle: 'bun', glasses: '#8a5a3a', shirt: '#a678c9', apron: '#f7c843', longSleeves: true, dress: '#7b5aa6', pants: '#7b5aa6', shoes: '#5a3a2a' },
  penny: { skin: '#e8b894', hair: '#2d1e14', hairStyle: 'bob', glasses: '#333333', shirt: '#ffffff', coat: '#3b7a5e', bow: '#e2465a', longSleeves: true, pants: '#2f3b4a', pantsLong: true, shoes: '#2a2a2a' },
  tina: { skin: '#f7d6c0', hair: '#e8a93a', hairStyle: 'pigtails', shirt: '#ff9bbd', dress: '#5bc0eb', pants: '#5bc0eb', shoes: '#ff6f91', collar: '#ffffff' },
  leo: { kid: true, skin: '#e9b48c', hair: '#5a3a22', hairStyle: 'short', hat: 'cap', hatColor: '#e94b3c', shirt: '#5ac46f', pants: '#3b5998', socks: '#ffffff', shoes: '#e94b3c' },
  gus: { skin: '#f7d0b4', hair: '#f4f4f4', hairStyle: 'bald', beard: '#f4f4f4', hat: 'cap', hatColor: '#2b3a67', shirt: '#d9534f', stripes: '#ffffff', longSleeves: true, pants: '#4a4a5a', pantsLong: true, shoes: '#3a2a1a' },
}

// ---------- animals ----------

class Animal {
  constructor() {
    this.root = new THREE.Group()
    this.seed = Math.random() * 10
    this.talk = 0
    this.mood = 'idle'
    this.lookYaw = 0
    this.speed = 0
  }
  finish() {
    this.root.traverse((m) => {
      if (m.isMesh) m.castShadow = true
    })
    return this
  }
  get faceY() {
    return this.faceH
  }
}

export class Bear extends Animal {
  constructor() {
    super()
    const brown = '#9b6a43'
    const tan = '#e2bf92'
    const p = new Parts()
    p.add(ico(1.0, 1), brown, { y: 1.0, sx: 1.15, sy: 1.05, sz: 0.95 })
    p.add(ico(0.72, 1), tan, { y: 0.92, z: 0.45, sz: 0.6, sy: 1.1 })
    for (const s of [-1, 1]) {
      p.add(cyl(0.3, 0.34, 0.95, 8), brown, { x: s * 0.55, y: 0.35, z: 0.7, rx: Math.PI / 2 })
      p.add(ico(0.36, 1), brown, { x: s * 0.55, y: 0.38, z: 1.2 })
      p.add(ico(0.22, 1), tan, { x: s * 0.55, y: 0.4, z: 1.48, sz: 0.4 })
    }
    this.root.add(p.build())
    const head = new THREE.Group()
    head.position.set(0, 2.1, 0.15)
    const hp = new Parts()
    hp.add(ico(0.64, 1), brown, { sy: 0.92 })
    hp.add(ico(0.3, 1), tan, { y: -0.15, z: 0.5, sz: 0.75 })
    hp.add(ico(0.11, 0), '#2b1d14', { y: -0.05, z: 0.76, sx: 1.3 })
    for (const s of [-1, 1]) {
      hp.add(ico(0.075, 1), '#1d1414', { x: s * 0.24, y: 0.12, z: 0.55, sz: 0.7, jitter: 0 })
      hp.add(ico(0.025, 0), '#ffffff', { x: s * 0.24 + 0.03, y: 0.15, z: 0.61, jitter: 0 })
      hp.add(ico(0.22, 1), brown, { x: s * 0.46, y: 0.48, z: -0.05, sz: 0.6 })
      hp.add(ico(0.12, 1), tan, { x: s * 0.46, y: 0.47, z: 0.05, sz: 0.4 })
      hp.add(ico(0.1, 1), '#f2a0a0', { x: s * 0.42, y: -0.12, z: 0.45, sz: 0.4, jitter: 0 })
    }
    hp.add(sphere(0.1, 8, 4, Math.PI / 2, Math.PI / 2), '#7a2f2a', { y: -0.27, z: 0.66, sz: 0.4, jitter: 0 })
    head.add(hp.build())
    this.root.add(head)
    this.head = head
    const arms = []
    for (const s of [-1, 1]) {
      const ap = new Parts()
      ap.add(cyl(0.22, 0.26, 0.85, 8), brown, { y: -0.4 })
      ap.add(ico(0.27, 1), brown, { y: -0.85 })
      const arm = ap.build()
      arm.position.set(s * 0.9, 1.6, 0.2)
      arm.rotation.x = -0.5
      arm.rotation.z = s * 0.25
      this.root.add(arm)
      arms.push(arm)
    }
    ;[this.armR, this.armL] = arms
    this.faceH = 2.1
    this.portraitDist = 3.2
    this.finish()
  }
  update(dt, t) {
    const hungry = this.mood === 'hungry'
    const b = Math.sin(t * 1.6 + this.seed)
    this.root.children[0].scale.set(1 + b * 0.015, 1 + b * 0.02, 1 + b * 0.015)
    this.head.rotation.y = lerp(this.head.rotation.y, this.lookYaw, Math.min(1, dt * 4))
    if (this.mood === 'happy') {
      this.head.rotation.x = Math.sin(t * 6) * 0.1
      this.armR.rotation.x = -2.6 + Math.sin(t * 8) * 0.3
      this.armL.rotation.x = -2.6 - Math.sin(t * 8) * 0.3
      this.root.position.y = this.baseY + Math.abs(Math.sin(t * 5)) * 0.2
    } else if (hungry) {
      this.head.rotation.x = 0.25 + Math.sin(t * 0.9) * 0.05
      this.armR.rotation.x = -0.9 + Math.sin(t * 3) * 0.25
      this.armL.rotation.x = -0.5
      this.armR.rotation.z = 0.5
    } else {
      this.head.rotation.x = Math.sin(t * 0.8) * 0.04
      this.armR.rotation.x = -0.5
      this.armL.rotation.x = -0.5
      this.armR.rotation.z = -0.25
      if (this.root.position.y > this.baseY) this.root.position.y = this.baseY
    }
    if (this.talk > 0) {
      this.talk -= dt
      this.head.rotation.z = Math.sin(t * 7) * 0.06
    } else this.head.rotation.z = 0
  }
}

export class Owl extends Animal {
  constructor() {
    super()
    const brown = '#9c7650'
    const p = new Parts()
    p.add(ico(0.45, 1), brown, { y: 0.45, sy: 1.15, sz: 0.95 })
    p.add(ico(0.34, 1), '#efdcb8', { y: 0.4, z: 0.26, sz: 0.5 })
    for (const s of [-1, 1]) p.add(ico(0.08, 0), '#f2a33a', { x: s * 0.13, y: 0.02, z: 0.18, sy: 0.5 })
    this.root.add(p.build())
    const head = new THREE.Group()
    head.position.y = 1.05
    const hp = new Parts()
    hp.add(ico(0.4, 1), brown, { sy: 0.88 })
    for (const s of [-1, 1]) {
      hp.add(cyl(0.16, 0.16, 0.05, 12), '#f3e6cc', { x: s * 0.16, y: 0.02, z: 0.31, rx: Math.PI / 2 - 0.2, jitter: 0 })
      hp.add(cone(0.08, 0.24, 4), brown, { x: s * 0.24, y: 0.36, rz: -s * 0.35 })
    }
    hp.add(cone(0.06, 0.15, 4), '#f2a33a', { y: -0.08, z: 0.38, rx: Math.PI / 2 + 0.4 })
    head.add(hp.build())
    const ep = new Parts()
    for (const s of [-1, 1]) {
      ep.add(ico(0.075, 1), '#1d1414', { x: s * 0.16, y: 0.03, z: 0.35, sz: 0.5, jitter: 0 })
      ep.add(ico(0.025, 0), '#ffffff', { x: s * 0.16 + 0.03, y: 0.06, z: 0.385, jitter: 0 })
    }
    this.eyes = ep.build()
    head.add(this.eyes)
    const gp = new Parts()
    for (const s of [-1, 1]) gp.add(torus(0.13, 0.02, 4, 12), '#3a3030', { x: s * 0.16, y: 0.03, z: 0.4, rx: -0.2, jitter: 0 })
    gp.add(box(0.08, 0.02, 0.02), '#3a3030', { y: 0.06, z: 0.42, jitter: 0 })
    this.glasses = gp.build()
    this.glasses.visible = false
    head.add(this.glasses)
    this.root.add(head)
    this.head = head
    const wings = []
    for (const s of [-1, 1]) {
      const wp = new Parts()
      wp.add(ico(0.3, 1), '#86623f', { y: -0.2, sx: 0.32, sz: 0.75 })
      const w = wp.build()
      w.position.set(s * 0.42, 0.75, -0.02)
      this.root.add(w)
      wings.push(w)
    }
    ;[this.wingR, this.wingL] = wings
    this.faceH = 1.05
    this.portraitDist = 1.9
    this.finish()
  }
  update(dt, t) {
    this.head.rotation.y = lerp(this.head.rotation.y, this.lookYaw, Math.min(1, dt * 4))
    this.head.rotation.z = Math.sin(t * 0.9 + this.seed) * 0.15
    const blink = Math.sin(t * 1.3 + this.seed) > 0.97 ? 0.15 : 1
    this.eyes.scale.y = blink
    const flap = this.mood === 'happy' ? Math.sin(t * 14) * 0.6 : this.talk > 0 ? Math.sin(t * 6) * 0.15 : 0
    this.wingR.rotation.z = -Math.abs(flap)
    this.wingL.rotation.z = Math.abs(flap)
    if (this.talk > 0) this.talk -= dt
  }
}

export class Cat extends Animal {
  constructor() {
    super()
    const o = '#f0a050'
    const dark = '#d7782d'
    const p = new Parts()
    p.add(ico(0.3, 1), o, { y: 0.3, sy: 1.15, sz: 1.1 })
    p.add(ico(0.18, 1), '#fff4e6', { y: 0.3, z: 0.2, sz: 0.5 })
    for (const s of [-1, 1]) p.add(ico(0.09, 1), '#fff4e6', { x: s * 0.12, y: 0.06, z: 0.24 })
    for (let i = 0; i < 3; i++) p.add(box(0.06, 0.03, 0.3), dark, { y: 0.45 - i * 0.1, z: -0.25, ry: 0, jitter: 0 })
    this.root.add(p.build())
    const head = new THREE.Group()
    head.position.set(0, 0.68, 0.08)
    const hp = new Parts()
    hp.add(ico(0.26, 1), o, { sx: 1.1, sy: 0.92 })
    for (const s of [-1, 1]) {
      hp.add(cone(0.1, 0.18, 4), o, { x: s * 0.14, y: 0.22, rz: -s * 0.25 })
      hp.add(cone(0.05, 0.1, 4), '#ffb3b3', { x: s * 0.14, y: 0.2, z: 0.03, rz: -s * 0.25 })
      hp.add(ico(0.035, 1), '#1d1717', { x: s * 0.1, y: 0.03, z: 0.22, sz: 0.6, sy: 1.3, jitter: 0 })
      hp.add(box(0.14, 0.008, 0.008), '#ffffff', { x: s * 0.2, y: -0.06, z: 0.2, rz: s * 0.1, jitter: 0 })
    }
    hp.add(ico(0.1, 1), '#fff4e6', { y: -0.07, z: 0.2, sx: 1.3, sz: 0.6 })
    hp.add(ico(0.025, 0), '#ff8fa3', { y: -0.03, z: 0.26 })
    hp.add(box(0.05, 0.02, 0.02), dark, { y: 0.2, z: 0.18, jitter: 0 })
    head.add(hp.build())
    this.root.add(head)
    this.head = head
    const tail = new THREE.Group()
    tail.position.set(0, 0.12, -0.3)
    const tp = new Parts()
    tp.add(cyl(0.05, 0.06, 0.5, 6), o, { y: 0.25 })
    tp.add(ico(0.06, 0), dark, { y: 0.5 })
    tail.add(tp.build())
    tail.rotation.x = -0.9
    this.root.add(tail)
    this.tail = tail
    this.faceH = 0.68
    this.portraitDist = 1.4
    this.finish()
  }
  update(dt, t) {
    this.tail.rotation.z = Math.sin(t * 2 + this.seed) * 0.5
    this.head.rotation.y = lerp(this.head.rotation.y, this.lookYaw, Math.min(1, dt * 4))
    this.head.rotation.z = this.talk > 0 ? Math.sin(t * 8) * 0.1 : Math.sin(t * 0.6) * 0.05
    if (this.talk > 0) this.talk -= dt
    if (this.mood === 'happy') this.root.position.y = this.baseY + Math.abs(Math.sin(t * 6)) * 0.12
  }
}

export class Bunny extends Animal {
  constructor() {
    super()
    const w = '#f7f4f0'
    const p = new Parts()
    p.add(ico(0.32, 1), w, { y: 0.3, sz: 1.2 })
    p.add(ico(0.1, 1), '#ffffff', { y: 0.32, z: -0.38 })
    for (const s of [-1, 1]) p.add(ico(0.1, 1), w, { x: s * 0.15, y: 0.06, z: 0.25, sz: 1.5, sy: 0.5 })
    this.root.add(p.build())
    const head = new THREE.Group()
    head.position.set(0, 0.6, 0.18)
    const hp = new Parts()
    hp.add(ico(0.24, 1), w)
    for (const s of [-1, 1]) {
      hp.add(ico(0.1, 1), w, { x: s * 0.09, y: 0.33, z: -0.03, sy: 3.2, sz: 0.45, rz: -s * 0.15 })
      hp.add(ico(0.06, 1), '#ffb6c8', { x: s * 0.09, y: 0.33, z: 0.015, sy: 3.4, sz: 0.3, rz: -s * 0.15, jitter: 0 })
      hp.add(ico(0.035, 1), '#1d1717', { x: s * 0.1, y: 0.04, z: 0.2, sz: 0.6, jitter: 0 })
      hp.add(ico(0.04, 1), '#ffc2d1', { x: s * 0.14, y: -0.06, z: 0.17, sz: 0.4, jitter: 0 })
    }
    hp.add(ico(0.03, 0), '#ff8fa3', { y: -0.03, z: 0.24 })
    head.add(hp.build())
    this.root.add(head)
    this.head = head
    this.faceH = 0.62
    this.portraitDist = 1.4
    this.hop = 0
    this.finish()
  }
  update(dt, t) {
    this.head.rotation.y = lerp(this.head.rotation.y, this.lookYaw, Math.min(1, dt * 4))
    this.hop -= dt
    if (this.hop < -2.5 - (this.seed % 2)) this.hop = 0.45
    const h = this.hop > 0 ? Math.sin((this.hop / 0.45) * Math.PI) * 0.25 : 0
    const happy = this.mood === 'happy' ? Math.abs(Math.sin(t * 7)) * 0.3 : 0
    this.root.position.y = this.baseY + Math.max(h, happy)
    this.head.rotation.z = this.talk > 0 ? Math.sin(t * 9) * 0.08 : 0
    if (this.talk > 0) this.talk -= dt
  }
}

export function makeDuck(white) {
  const p = new Parts()
  const c = white ? '#ffffff' : '#f6d64a'
  p.add(ico(0.25, 1), c, { y: 0.12, sx: 1.0, sy: 0.75, sz: 1.35 })
  p.add(ico(0.16, 1), c, { y: 0.38, z: 0.22 })
  p.add(box(0.12, 0.05, 0.14), '#f39c34', { y: 0.36, z: 0.4, jitter: 0 })
  for (const s of [-1, 1]) p.add(ico(0.025, 0), '#111111', { x: s * 0.09, y: 0.42, z: 0.32, jitter: 0 })
  p.add(cone(0.08, 0.15, 4), c, { y: 0.2, z: -0.34, rx: -1.2 })
  return p.build()
}

export function makeGull() {
  const g = new THREE.Group()
  const p = new Parts()
  p.add(ico(0.22, 1), '#ffffff', { sz: 2.0, sy: 0.8 })
  p.add(ico(0.13, 1), '#ffffff', { z: 0.42, y: 0.08 })
  p.add(cone(0.04, 0.14, 4), '#f2b134', { z: 0.6, y: 0.06, rx: Math.PI / 2 })
  g.add(p.build({ shadow: false }))
  const wings = []
  for (const s of [-1, 1]) {
    const wp = new Parts()
    wp.add(box(0.75, 0.03, 0.3), '#f2f2f2', { x: s * 0.38 })
    wp.add(box(0.2, 0.035, 0.28), '#9aa3ad', { x: s * 0.68 })
    const w = wp.build({ shadow: false })
    g.add(w)
    wings.push(w)
  }
  g.userData.wings = wings
  return g
}

export function makeButterfly(hex) {
  const g = new THREE.Group()
  const wings = []
  for (const s of [-1, 1]) {
    const wp = new Parts()
    wp.add(new THREE.CircleGeometry(0.16, 6), hex, { x: s * 0.13, rx: -Math.PI / 2, mat: MAT2, jitter: 0 })
    const w = wp.build({ shadow: false })
    g.add(w)
    wings.push(w)
  }
  g.userData.wings = wings
  return g
}
