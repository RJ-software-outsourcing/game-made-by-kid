// Surprises in the sea and the sky: a whale, a big ship, a (friendly) kraken, dolphins, an airplane
// with a banner to read, a hot-air balloon, and UFOs that sometimes drop off a visiting alien.
// One show at a time, every 35-70 seconds, placed where Coji can see it.
import * as THREE from 'three'
import * as L from './land.js'
import { Parts, SMOOTH, SHINE, box, cyl, cone, sphere, torus, textCanvas } from './build.js'
import { sfx } from './audio.js'

const pick = (a) => a[Math.floor(Math.random() * a.length)]
const BANNERS = ['HELLO, COJI!', 'READ EVERY DAY!', 'HAVE A HAPPY DAY!', 'YOU ARE A STAR!', 'BE KIND!', 'LET\'S PLAY!']

export class Shows {
  constructor(game) {
    this.game = game
    this.scene = game.scene
    this.world = game.world
    this.list = []
    this.timer = 20
  }

  // Look out to sea from where Coji is: a point straight out from the island.
  seaPoint(extra) {
    const p = this.game.player
    const a = Math.atan2(p.z, p.x) + (Math.random() - 0.5) * 0.5
    const r = L.coastRadius(a) + extra
    return [Math.cos(a) * r, Math.sin(a) * r, a]
  }

  update(dt, t) {
    const g = this.game
    if (g.mode === 'play' && !g.dialogue.open) this.timer -= dt
    if (this.timer <= 0 && !this.list.some((s) => !s.quiet)) {
      this.timer = 35 + Math.random() * 35
      this.start()
    }
    for (const s of this.list.slice()) {
      s.t += dt
      s.update(dt, t)
      if (s.done) {
        this.scene.remove(s.root)
        this.list.splice(this.list.indexOf(s), 1)
      }
    }
  }

  start(kind) {
    const g = this.game
    const p = g.player
    const nearSea = L.inland(p.x, p.z) < 42 || L.ISLETS.some((I) => Math.hypot(p.x - I.x, p.z - I.z) < I.r + 6) || L.onPier(p.x, p.z)
    const spooky = L.spookiness(p.x, p.z) > 0.2
    if (spooky) return
    if (!kind) {
      const sea = ['whale', 'whale', 'ship', 'kraken', 'dolphins']
      const sky = ['plane', 'balloon', 'ufo', 'ufo']
      kind = nearSea && Math.random() < 0.6 ? pick(sea) : pick(sky)
    }
    const make = { whale: whale, ship: ship, kraken: kraken, dolphins: dolphins, plane: plane, balloon: balloon, ufo: ufo }[kind]
    const s = make(this)
    if (!s) return
    s.t = 0
    this.scene.add(s.root)
    this.list.push(s)
    if (s.tip) g.ui.tip(s.tip, { key: 'show-' + kind, cooldown: 30, force: true, time: 6 })
  }

  // The UFO comes back for an alien.
  ufoPickup(it) {
    const s = ufo(this, it)
    s.t = 0
    this.scene.add(s.root)
    this.list.push(s)
  }
}

// ---------- the sea ----------

function whale(S) {
  const [x, z, a] = S.seaPoint(28 + Math.random() * 15)
  if (S.world.terrainY(x, z) > -2.5) return null
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)
  const p = new Parts(SMOOTH)
  p.add(sphere(3, 24, 16), '#3f6fb5', { sx: 1, sy: 0.85, sz: 2.6 })
  p.add(sphere(2.4, 20, 12), '#dfe8f2', { y: -0.9, z: 1.2, sx: 0.95, sy: 0.6, sz: 2.0 })
  for (const s of [-1, 1]) {
    p.add(sphere(0.32, 12, 10), '#1d1717', { x: s * 2.2, y: 0.5, z: 4.6, jitter: 0 })
    p.add(sphere(0.12, 8, 6), '#ffffff', { x: s * 2.28, y: 0.62, z: 4.75, jitter: 0 })
    p.add(sphere(1, 12, 8), '#3f6fb5', { x: s * 2.8, y: -1.2, z: 2, sx: 1.6, sy: 0.25, sz: 0.8, rz: s * 0.4 })
  }
  p.add(sphere(0.4, 10, 8), '#f4a6a0', { x: 2.5, y: -0.1, z: 4.3, sz: 0.3, jitter: 0 })
  p.add(sphere(0.4, 10, 8), '#f4a6a0', { x: -2.5, y: -0.1, z: 4.3, sz: 0.3, jitter: 0 })
  body.add(p.build({ shadow: false }))
  const tail = new THREE.Group()
  tail.position.set(0, 0.2, -7.2)
  const tp = new Parts(SMOOTH)
  tp.add(sphere(1.2, 12, 8), '#3f6fb5', { z: -0.6, sx: 0.8, sy: 0.7, sz: 1.4 })
  for (const s of [-1, 1]) tp.add(sphere(1.4, 12, 8), '#3f6fb5', { x: s * 1.5, z: -1.8, sx: 1.5, sy: 0.18, sz: 0.8, ry: s * 0.4 })
  tail.add(tp.build({ shadow: false }))
  body.add(tail)
  const spout = new THREE.Group()
  const sm = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false })
  for (let i = 0; i < 14; i++) {
    const sp = new THREE.Sprite(sm)
    sp.userData.k = i / 14
    spout.add(sp)
  }
  spout.position.set(0, 2.6, 2.5)
  body.add(spout)
  const heading = a + Math.PI / 2
  root.position.set(x, -6, z)
  root.rotation.y = Math.atan2(Math.cos(heading), Math.sin(heading))
  root.scale.setScalar(0.9)
  sfx('whale')
  return {
    root,
    tip: 'Look at the sea! A big whale! 🐳',
    update(dt, t) {
      const T = this.t
      const up = L.smoothstep(0, 3, T) * (1 - L.smoothstep(15, 19, T))
      root.position.y = -6 + up * 5.4 + Math.sin(t * 1.2) * 0.2
      const dir = new THREE.Vector3(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y))
      root.position.addScaledVector(dir, dt * 1.6)
      body.rotation.x = T > 15 ? -L.smoothstep(15, 18, T) * 0.6 : Math.sin(t * 0.8) * 0.05
      tail.rotation.x = Math.sin(t * 2) * 0.25 + (T > 15 ? -0.6 : 0)
      const blow = (T % 5) < 1.6 && T > 3 && T < 15
      spout.visible = blow
      if (blow)
        for (const sp of spout.children) {
          const k = (sp.userData.k + (T % 5) * 0.8) % 1
          sp.position.set(Math.sin(k * 20) * k * 0.8, k * 4.5, Math.cos(k * 17) * k * 0.6)
          sp.scale.setScalar(0.5 + k * 1.2)
        }
      if (Math.floor(T) === 6 && !this.sang) {
        this.sang = true
        sfx('whale')
      }
      if (T > 19) this.done = true
    },
  }
}

function ship(S) {
  const [cx, cz, a] = S.seaPoint(70)
  const tx = -Math.sin(a)
  const tz = Math.cos(a)
  const root = new THREE.Group()
  const p = new Parts()
  p.add(box(6, 2.6, 26), '#ffffff', { y: 0.6 })
  p.add(box(6.05, 0.5, 26.05), '#3b7dd8', { y: -0.4 })
  p.add(cone(3.05, 6, 4), '#ffffff', { y: 0.6, z: 15.6, rx: Math.PI / 2, ry: Math.PI / 4, sx: 1, sz: 0.62 })
  for (let k = 0; k < 3; k++) p.add(box(5 - k * 0.8, 1.6, 18 - k * 4), '#f4f1ea', { y: 2.7 + k * 1.6, z: -1 })
  for (let k = 0; k < 2; k++) {
    p.add(cyl(0.8, 0.9, 2.6, 12), '#e94b3c', { y: 7.6, z: -4 + k * 4.5 })
    p.add(cyl(0.82, 0.82, 0.5, 12), '#2b2b2b', { y: 8.9, z: -4 + k * 4.5 })
  }
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 12; i++) for (const s of [-1, 1]) p.add(box(0.06, 0.4, 0.6), '#3b7dd8', { x: s * (2.52 - r * 0.4), y: 2.7 + r * 1.6, z: -8 + i * 1.3 - r * 0.6, jitter: 0 })
  root.add(p.build({ shadow: false }))
  const len = 140
  const sx = cx - tx * len * 0.5
  const sz = cz - tz * len * 0.5
  root.rotation.y = Math.atan2(tx, tz)
  root.position.set(sx, 0, sz)
  sfx('horn')
  return {
    root,
    tip: 'Look! A big ship on the sea! 🚢',
    update(dt, t) {
      const k = this.t / 48
      root.position.set(sx + tx * len * k, Math.sin(t) * 0.15, sz + tz * len * k)
      root.rotation.z = Math.sin(t * 0.7) * 0.02
      if (Math.floor(this.t) === 20 && !this.honked) {
        this.honked = true
        sfx('horn')
      }
      if (k >= 1) this.done = true
    },
  }
}

function kraken(S) {
  const [x, z] = S.seaPoint(24 + Math.random() * 10)
  if (S.world.terrainY(x, z) > -2) return null
  const root = new THREE.Group()
  root.position.set(x, 0, z)
  const arms = []
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const arm = new THREE.Group()
    arm.position.set(Math.cos(a) * 4, -6, Math.sin(a) * 4)
    let parent = arm
    const segs = []
    for (let k = 0; k < 9; k++) {
      const r = 0.55 * (1 - k / 11)
      const sp = new Parts(SMOOTH)
      sp.add(cyl(r * 0.85, r, 1.1, 10), '#9a63d8', { y: 0.55, jitter: 0 })
      sp.add(sphere(r * 0.45, 8, 6), '#f3b5ff', { y: 0.55, z: r * 0.85, sz: 0.4, jitter: 0 })
      const seg = sp.build({ shadow: false })
      seg.position.y = k === 0 ? 0 : 1.1
      parent.add(seg)
      segs.push(seg)
      parent = seg
    }
    arm.rotation.y = -a
    arm.userData = { segs, ph: i * 0.9 }
    root.add(arm)
    arms.push(arm)
  }
  const head = new Parts(SMOOTH)
  head.add(sphere(3, 20, 14), '#9a63d8', { sy: 1.2 })
  for (const s of [-1, 1]) {
    head.add(sphere(0.7, 14, 10), '#ffffff', { x: s * 1.1, y: 0.9, z: 2.6, jitter: 0 })
    head.add(sphere(0.38, 12, 8), '#1d1717', { x: s * 1.1, y: 0.95, z: 3.15, jitter: 0 })
    head.add(sphere(0.14, 8, 6), '#ffffff', { x: s * 1.0, y: 1.1, z: 3.42, jitter: 0 })
  }
  const hm = head.build({ shadow: false })
  hm.position.y = -5
  root.add(hm)
  const toCoji = Math.atan2(S.game.player.x - x, S.game.player.z - z)
  hm.rotation.y = toCoji
  sfx('bubbles')
  return {
    root,
    tip: 'Whoa! A friendly kraken is waving at you! 🐙',
    update(dt, t) {
      const T = this.t
      const up = L.smoothstep(0, 2.5, T) * (1 - L.smoothstep(11, 14, T))
      hm.position.y = -5 + up * 4.6 + Math.sin(t * 1.5) * 0.2
      for (const arm of arms) {
        arm.position.y = -6 + up * 5.8
        arm.userData.segs.forEach((seg, k) => {
          seg.rotation.x = Math.sin(t * 1.6 + arm.userData.ph + k * 0.5) * 0.25 + 0.06
          seg.rotation.z = Math.cos(t * 1.2 + arm.userData.ph + k * 0.4) * 0.12
        })
      }
      if (T > 14) this.done = true
    },
  }
}

function dolphins(S) {
  const [x, z, a] = S.seaPoint(18 + Math.random() * 10)
  if (S.world.terrainY(x, z) > -1.5) return null
  const root = new THREE.Group()
  const tx = -Math.sin(a)
  const tz = Math.cos(a)
  const pods = []
  for (let i = 0; i < 3; i++) {
    const d = new Parts(SMOOTH)
    d.add(sphere(0.6, 14, 10), '#7f95ad', { sz: 2.2 })
    d.add(sphere(0.45, 12, 8), '#e6edf4', { y: -0.2, z: 0.2, sz: 1.8, sy: 0.6 })
    d.add(cone(0.3, 0.8, 8), '#7f95ad', { z: 1.6, rx: Math.PI / 2 })
    d.add(cone(0.25, 0.6, 4), '#7f95ad', { y: 0.6, z: -0.2, rx: -0.3 })
    d.add(box(1.2, 0.08, 0.4), '#7f95ad', { z: -1.4 })
    for (const s of [-1, 1]) d.add(sphere(0.08, 8, 6), '#1d1717', { x: s * 0.42, y: 0.15, z: 0.9, jitter: 0 })
    const m = d.build({ shadow: false })
    m.userData.ph = i * 0.8
    root.add(m)
    pods.push(m)
  }
  sfx('click')
  return {
    root,
    tip: 'Look! Dolphins are jumping! 🐬',
    update(dt) {
      const T = this.t
      pods.forEach((m, i) => {
        const k = T * 1.1 - m.userData.ph
        const along = k * 4
        const jump = Math.sin(k * 2.2)
        m.position.set(x + tx * (along - 10) + (i - 1) * 1.5 * tz, jump * 2.2 - 0.6, z + tz * (along - 10) - (i - 1) * 1.5 * tx)
        m.rotation.y = Math.atan2(tx, tz)
        m.rotation.x = -Math.cos(k * 2.2) * 0.9
        m.visible = jump > -0.3
      })
      if (T > 12) this.done = true
    },
  }
}

// ---------- the sky ----------

function skyPath(S, alt, len, sideOffset = 12) {
  const p = S.game.player
  const a = Math.random() * Math.PI * 2
  const dx = Math.cos(a)
  const dz = Math.sin(a)
  const ox = -dz * sideOffset
  const oz = dx * sideOffset
  return { from: new THREE.Vector3(p.x - dx * len * 0.5 + ox, alt, p.z - dz * len * 0.5 + oz), dir: new THREE.Vector3(dx, 0, dz), len }
}

function plane(S) {
  const path = skyPath(S, 30 + Math.random() * 10, 160, 18)
  const root = new THREE.Group()
  const p = new Parts(SMOOTH)
  p.add(cyl(0.7, 0.5, 5, 12), '#ffcf3f', { rx: Math.PI / 2 })
  p.add(sphere(0.7, 12, 10), '#ffcf3f', { z: 2.5 })
  p.add(box(8, 0.15, 1.4), '#e94b3c', { z: 0.6 })
  p.add(box(2.8, 0.12, 0.8), '#e94b3c', { z: -2.3 })
  p.add(box(0.12, 1.2, 0.9), '#e94b3c', { y: 0.6, z: -2.3 })
  p.add(sphere(0.5, 10, 8), '#9fdcff', { y: 0.5, z: 1.2, sy: 0.7 })
  root.add(p.build({ shadow: false }))
  const prop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.06), new THREE.MeshLambertMaterial({ color: 0x555555 }))
  prop.position.z = 3.25
  root.add(prop)
  const text = pick(BANNERS)
  const cv = textCanvas(text, { w: 1024, h: 160, font: 'bold 110px "Baloo 2", Andika, sans-serif', fg: '#e94b3c', bg: '#ffffff' })
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.2), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }))
  banner.position.set(0, -0.3, -12)
  banner.rotation.y = Math.PI / 2
  root.add(banner)
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.6, 4), new THREE.MeshBasicMaterial({ color: 0x777777 }))
  rope.rotation.x = Math.PI / 2
  rope.position.set(0, -0.2, -4.6)
  root.add(rope)
  root.rotation.y = Math.atan2(path.dir.x, path.dir.z)
  sfx('plane')
  return {
    root,
    tip: `Look up! An airplane! The banner says: "${text}" ✈️`,
    update(dt, t) {
      const k = this.t / 22
      root.position.copy(path.from).addScaledVector(path.dir, path.len * k)
      root.position.y += Math.sin(t) * 0.5
      prop.rotation.z += dt * 40
      banner.position.y = -0.3 + Math.sin(t * 6) * 0.1
      banner.rotation.x = Math.sin(t * 5) * 0.08
      if (k >= 1) this.done = true
    },
  }
}

function balloon(S) {
  const path = skyPath(S, 22 + Math.random() * 8, 90, 10)
  const root = new THREE.Group()
  const cols = ['#e94b3c', '#ffcf3f', '#3b7dd8', '#5ac46f', '#ff8fb1', '#ffffff']
  for (let i = 0; i < 12; i++) {
    const g = new THREE.SphereGeometry(3.4, 4, 16, (i / 12) * Math.PI * 2, (Math.PI * 2) / 12)
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: cols[i % cols.length], flatShading: false }))
    m.scale.set(1, 1.15, 1)
    m.position.y = 5
    root.add(m)
  }
  const p = new Parts(SMOOTH)
  p.add(box(1.4, 1, 1.4), '#a8693f', { y: -0.5 })
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) p.add(cyl(0.03, 0.03, 3.4, 4), '#6b4a2b', { x: x * 1.3, y: 1.3, z: z * 1.3, rx: z * 0.3, rz: -x * 0.3 })
  root.add(p.build({ shadow: false }))
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 8), new THREE.MeshBasicMaterial({ color: 0xffb347 }))
  flame.position.y = 1.2
  root.add(flame)
  return {
    root,
    tip: 'Look up! A hot-air balloon! 🎈',
    update(dt, t) {
      const k = this.t / 50
      root.position.copy(path.from).addScaledVector(path.dir, path.len * k)
      root.position.y += Math.sin(t * 0.6) * 1.2
      root.rotation.y += dt * 0.1
      flame.visible = Math.sin(t * 3) > 0
      if (k >= 1) this.done = true
    },
  }
}

// A UFO. Visit: flies in, hovers, maybe beams down an alien, flies away. Pickup: comes back for one.
function ufo(S, pickupFor) {
  const g = S.game
  const root = new THREE.Group()
  const p = new Parts(SMOOTH)
  p.add(sphere(3, 24, 10), '#c9d3df', { sy: 0.28 })
  p.add(sphere(1.6, 18, 10, 0, Math.PI / 2), '#9fe3f7', { y: 0.4 })
  p.add(torus(3.0, 0.15, 6, 32), '#8a96a6', { rx: Math.PI / 2 })
  root.add(p.build({ shadow: false }))
  const lights = []
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: ['#ff5d5d', '#ffe066', '#5ac46f', '#5bc0eb'][i % 4] }))
    l.position.set(Math.cos(a) * 2.6, -0.2, Math.sin(a) * 2.6)
    root.add(l)
    lights.push(l)
  }
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x9dffb0, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }))
  beam.visible = false
  root.add(beam)
  // where it hovers: near Coji on land (or over the alien it collects)
  let hx
  let hz
  if (pickupFor) {
    hx = pickupFor.e.x
    hz = pickupFor.e.z
  } else {
    const spot = g.crowd?.spot((x, z) => S.world.terrainY(x, z) > 0.6, 30)
    if (!spot) return { root, update() { this.done = true } }
    ;[hx, hz] = spot
  }
  const ground = S.world.terrainY(hx, hz)
  const hoverY = ground + 9
  const from = new THREE.Vector3(hx + 90, 60, hz - 60)
  const to = new THREE.Vector3(hx - 90, 70, hz + 60)
  const dropAlien = !pickupFor && Math.random() < 0.6
  sfx('ufo')
  return {
    root,
    tip: pickupFor ? null : 'Look up! A UFO! 🛸',
    quiet: !!pickupFor,
    update(dt, t) {
      const T = this.t
      root.rotation.y += dt * 1.5
      lights.forEach((l, i) => (l.visible = Math.floor(t * 6 + i) % 2 === 0))
      const hover = new THREE.Vector3(hx, hoverY + Math.sin(t * 2) * 0.3, hz)
      if (T < 4) root.position.lerpVectors(from, hover, L.smoothstep(0, 4, T))
      else if (T < 10) root.position.copy(hover)
      else root.position.lerpVectors(hover, to, L.smoothstep(10, 14, T))
      const beaming = T > 5 && T < 9 && (dropAlien || pickupFor)
      beam.visible = beaming
      if (beaming) {
        const h = hoverY - ground
        beam.scale.set(1, h, 1)
        beam.position.y = -h / 2
        beam.material.opacity = 0.25 + Math.sin(t * 10) * 0.08
        if (!this.beamed) {
          this.beamed = true
          sfx('beam')
        }
      }
      if (dropAlien && T > 6.5 && !this.dropped) {
        this.dropped = true
        const it = g.crowd.spawnAlien(hx, hz)
        it.lifted = true
        it.ch.root.position.y = ground + 6
        this.alien = it
        g.ui.tip('An alien came down from the UFO! 👽 Tap to say hello!', { key: 'alien', cooldown: 20, force: true })
      }
      if (this.alien && this.alien.lifted) {
        const k = L.smoothstep(6.5, 8.8, T)
        this.alien.ch.root.position.y = ground + 6 * (1 - k)
        if (k >= 1) this.alien.lifted = false
      }
      if (pickupFor && T > 5.5 && !this.took) {
        const a = pickupFor
        a.lifted = true
        const k = L.smoothstep(5.5, 8.6, T)
        a.ch.root.position.y = ground + 7 * k
        a.ch.root.scale.setScalar(0.85 * (1 - k * 0.6))
        if (k >= 1) {
          this.took = true
          a.alien = false
          a.life = -1
          g.crowd.remove(a)
        }
      }
      if (T > 14) this.done = true
    },
  }
}
