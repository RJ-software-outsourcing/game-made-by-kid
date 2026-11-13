// Surprises in the sea and the sky: a whale, a big ship, a (friendly) kraken, dolphins, an airplane
// with a banner to read, a hot-air balloon, and UFOs that sometimes drop off a visiting alien.
// One show at a time, every 35-70 seconds, placed where Coji can see it.
import * as THREE from 'three'
import * as L from './land.js'
import { Parts, SMOOTH, SHINE, GLOW, box, cyl, cone, sphere, torus, textCanvas } from './build.js'
import { sfx, sayAs } from './audio.js'
import { makeDragon, disposeDragon } from './dragon.js'

const pick = (a) => a[Math.floor(Math.random() * a.length)]
const BANNERS = ['HELLO, COJI!', 'READ EVERY DAY!', 'HAVE A HAPPY DAY!', 'YOU ARE A STAR!', 'BE KIND!', 'LET\'S PLAY!']

export class Shows {
  constructor(game) {
    this.game = game
    this.scene = game.scene
    this.world = game.world
    this.list = []
    this.timer = 20
    this.dragonTimer = 70 + Math.random() * 80
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
    if (g.mode === 'play' && !g.dialogue.open) {
      this.timer -= dt
      this.dragonTimer -= dt
    }
    if (this.dragonTimer <= 0 && !this.list.some((s) => !s.quiet)) {
      this.dragonTimer = 150 + Math.random() * 120
      this.timer = Math.max(this.timer, 15)
      this.start('dragon')
    }
    if (this.timer <= 0 && !this.list.some((s) => !s.quiet)) {
      this.timer = 35 + Math.random() * 35
      this.start()
    }
    for (const s of this.list.slice()) {
      s.t += dt
      s.update(dt, t)
      if (s.done) {
        s.dispose?.()
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
      const sea = ['whale', 'whale', 'ship', 'pirates', 'kraken', 'dolphins']
      const sky = ['plane', 'balloon', 'ufo', 'ufo']
      kind = nearSea && Math.random() < 0.6 ? pick(sea) : pick(sky)
    }
    const make = { whale: whale, ship: ship, pirates: pirateBattle, kraken: kraken, dolphins: dolphins, plane: plane, balloon: balloon, ufo: ufo, dragon: dragon }[kind]
    const s = make(this)
    if (!s) return
    s.t = 0
    s.kind = kind
    this.scene.add(s.root)
    this.list.push(s)
    if (s.tip) g.ui.tip(s.tip, { key: 'show-' + kind, cooldown: 30, force: true, time: 6 })
  }

  // The UFO comes back for an alien.
  ufoPickup(it) {
    // Stop the alien as soon as the pickup is called. Previously it could walk several metres while
    // the UFO was approaching, leaving the beam shining beside it.
    it.path.length = 0
    it.ch.speed = 0
    it.beamWaiting = true
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

// A grand old ocean liner (in the style of the famous four-funnel ships): a long black hull with a
// pointed bow, a red bottom and a thin white line, rows of round portholes, white decks with windows,
// lifeboats, four tall buff funnels with black tops, and two masts. Every window sits exactly on the
// wall it belongs to.
const LINER = { L: 46, B: 5.6, stern: -21, mid0: -17, mid1: 11, bow: 25 }
function hullHalfWidth(z) {
  const { B, stern, mid0, mid1, bow } = LINER
  if (z < mid0) return (B / 2) * Math.sqrt(Math.max(0, 1 - ((mid0 - z) / (mid0 - stern)) ** 2))
  if (z > mid1) return (B / 2) * (1 - Math.pow((z - mid1) / (bow - mid1), 1.7))
  return B / 2
}
function hullSlice(y0, y1, inset = 0) {
  // the top-view outline, extruded upward from y0 to y1
  const pts = []
  const n = 40
  for (let i = 0; i <= n; i++) {
    const z = LINER.stern + ((LINER.bow - LINER.stern) * i) / n
    pts.push([Math.max(0.02, hullHalfWidth(z) - inset), z])
  }
  const shape = new THREE.Shape()
  shape.moveTo(pts[0][0], -pts[0][1])
  for (const [x, z] of pts) shape.lineTo(x, -z)
  for (let i = pts.length - 1; i >= 0; i--) shape.lineTo(-pts[i][0], -pts[i][1])
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: 4 })
  g.rotateX(-Math.PI / 2)
  g.translate(0, y0, 0)
  return g
}
function ship(S) {
  const [cx, cz, a] = S.seaPoint(80)
  const tx = -Math.sin(a)
  const tz = Math.cos(a)
  const root = new THREE.Group()
  const p = new Parts()
  const halfB = LINER.B / 2
  // hull: red below the waterline, black above, a thin white line near the top, a wooden deck
  p.add(hullSlice(-1.6, 0.35), '#9e2a22', { jitter: 0.03, rough: 0.6 })
  p.add(hullSlice(0.35, 3.0), '#1c1d22', { jitter: 0.04, rough: 0.45 })
  p.add(hullSlice(2.62, 2.74, -0.02), '#f1ead2', { jitter: 0, rough: 0.5 })
  p.add(hullSlice(3.0, 3.08, 0.05), '#c7a172', { jitter: 0.05, rough: 0.8 })
  // portholes: two rows along the straight middle of the hull, right on its sides
  for (const y of [1.25, 2.05])
    for (let z = LINER.mid0 + 1; z < LINER.mid1 - 0.5; z += 1.1)
      for (const sd of [-1, 1]) p.add(cyl(0.13, 0.13, 0.04, 10), '#fff0c4', { x: sd * (halfB + 0.015), y, z, rz: Math.PI / 2, mat: GLOW, jitter: 0, rough: 0.2 })
  // white decks (each one shorter and narrower), with windows on their own walls
  const decks = [
    { y0: 3.08, h: 1.15, w: 5.0, z0: -15.5, z1: 10.5 },
    { y0: 4.23, h: 1.0, w: 4.4, z0: -12.5, z1: 8.5 },
    { y0: 5.23, h: 0.85, w: 3.6, z0: -9, z1: 6 },
  ]
  for (const d of decks) {
    const len = d.z1 - d.z0
    p.add(box(d.w, d.h, len), '#f4f2ea', { y: d.y0 + d.h / 2, z: (d.z0 + d.z1) / 2, jitter: 0.02, rough: 0.55 })
    p.add(box(d.w + 0.12, 0.06, len + 0.12), '#c7a172', { y: d.y0 + d.h + 0.03, z: (d.z0 + d.z1) / 2, jitter: 0.04, rough: 0.8 })
    for (let z = d.z0 + 0.7; z < d.z1 - 0.5; z += 1.0)
      for (const sd of [-1, 1]) p.add(box(0.03, d.h * 0.42, 0.55), '#ffe6a8', { x: sd * (d.w / 2 + 0.016), y: d.y0 + d.h * 0.55, z, mat: GLOW, jitter: 0, rough: 0.2 })
  }
  // the bridge at the front, with a row of windows looking forward
  p.add(box(4.6, 1.0, 2.0), '#f4f2ea', { y: 6.58, z: 6.6, jitter: 0.02, rough: 0.55 })
  for (let i = 0; i < 6; i++) p.add(box(0.5, 0.36, 0.03), '#ffe6a8', { x: -1.6 + i * 0.64, y: 6.65, z: 7.615, mat: GLOW, jitter: 0, rough: 0.2 })
  // lifeboats along the top deck
  for (let z = -11.5; z < 7; z += 2.6)
    for (const sd of [-1, 1]) {
      p.add(sphere(0.32, 10, 6), '#ffffff', { x: sd * 2.05, y: 5.52, z, sx: 1, sy: 0.55, sz: 2.4, jitter: 0, rough: 0.5 })
      p.add(box(0.06, 0.5, 0.06), '#3a3a3a', { x: sd * 2.05, y: 5.4, z: z - 0.7, metal: 0.6, rough: 0.4 })
      p.add(box(0.06, 0.5, 0.06), '#3a3a3a', { x: sd * 2.05, y: 5.4, z: z + 0.7, metal: 0.6, rough: 0.4 })
    }
  // four tall funnels, leaning back a little: buff with black tops
  for (let k = 0; k < 4; k++) {
    const z = 4.2 - k * 5.0
    p.add(cyl(0.78, 0.84, 5.6, 16), '#d49a3c', { y: 6.08 + 2.8, z, sx: 1, sz: 1.3, rx: -0.09, flat: false, jitter: 0.03, rough: 0.6 })
    p.add(cyl(0.8, 0.8, 1.1, 16), '#141414', { y: 6.08 + 5.4, z: z - 0.48, sx: 1, sz: 1.3, rx: -0.09, flat: false, jitter: 0, rough: 0.5 })
  }
  // masts at the bow and the stern, with a line between them
  p.add(cyl(0.09, 0.13, 13, 8), '#c7a172', { y: 3 + 6.5, z: 16.5, rx: -0.06, flat: false })
  p.add(cyl(0.09, 0.13, 12, 8), '#c7a172', { y: 3 + 6, z: -17, rx: -0.06, flat: false })
  const span = 16.5 + 17
  p.add(box(0.03, 0.03, Math.hypot(span, 1)), '#333333', { y: 15.2, z: (16.5 - 17) / 2, rx: Math.atan2(1, span), jitter: 0 })
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

function fightingShip(pirate) {
  const root = new THREE.Group()
  const p = new Parts(SMOOTH)
  const hull = pirate ? '#3a2520' : '#244f78'
  const trim = pirate ? '#b92b2b' : '#f2e9d2'
  const sail = pirate ? '#29262b' : '#f4f0df'
  p.add(box(4.1, 1.2, 10.5), hull, { y: 0.5, sz: 1, jitter: 0.05, rough: 0.78 })
  p.add(sphere(2.15, 12, 8), hull, { y: 0.5, z: 4.7, sx: 0.95, sy: 0.55, sz: 1.55, jitter: 0.04, rough: 0.75 })
  p.add(box(4.3, 0.16, 9.4), '#a87945', { y: 1.14, z: -0.25, jitter: 0.04, rough: 0.85 })
  p.add(box(4.18, 0.16, 0.24), trim, { y: 0.8, z: 1.5, jitter: 0.01, rough: 0.55 })
  for (const z of [-2.5, 1.2]) {
    p.add(cyl(0.11, 0.15, 8.0, 8), '#6b4429', { y: 5.0, z, flat: false, jitter: 0.02, rough: 0.85 })
    p.add(box(4.8, 3.1, 0.08), sail, { y: 5.45, z: z + 0.04, jitter: 0.025, rough: 0.9 })
    p.add(box(5.2, 0.1, 0.1), '#6b4429', { y: 7.0, z, jitter: 0.01, rough: 0.85 })
  }
  for (const side of [-1, 1])
    for (const z of [-3.0, -0.7, 1.6]) {
      p.add(cyl(0.16, 0.19, 0.7, 8), '#24262b', { x: side * 2.25, y: 1.45, z, rz: Math.PI / 2, flat: false, jitter: 0, metal: 0.4, rough: 0.45 })
      p.add(sphere(0.12, 7, 5), '#17181b', { x: side * 2.62, y: 1.45, z, jitter: 0, metal: 0.3, rough: 0.4 })
    }
  p.add(box(3.2, 0.9, 1.8), hull, { y: 1.55, z: -4.1, jitter: 0.03, rough: 0.75 })
  p.add(box(1.8, 0.65, 0.07), pirate ? '#b92b2b' : '#295ea0', { y: 8.2, z: -2.5, x: 0.95, jitter: 0.02, rough: 0.8 })
  root.add(p.build({ shadow: false }))
  return root
}

// Two compact, low-poly ships exchange broadside cannon fire. Cannonballs and smoke only exist for
// the few seconds of the show, so the normal island scene pays no ongoing particle cost.
function pirateBattle(S) {
  const [cx, cz, a] = S.seaPoint(58)
  if (S.world.terrainY(cx, cz) > -2.5) return null
  const root = new THREE.Group()
  root.position.set(cx, 0, cz)
  root.rotation.y = -a
  const pirate = fightingShip(true)
  const navy = fightingShip(false)
  pirate.position.set(-10, 0, -2)
  navy.position.set(10, 0, 2)
  root.add(pirate, navy)
  const shots = []
  const ballGeo = new THREE.SphereGeometry(0.25, 8, 6)
  const ballMat = new THREE.MeshBasicMaterial({ color: 0x202226 })
  const fire = (from, to) => {
    const ball = new THREE.Mesh(ballGeo, ballMat)
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0xd9d4ca, transparent: true, opacity: 0.72, depthWrite: false, fog: true })
    const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.45, 7, 5), smokeMat)
    const start = from.position.clone().add(new THREE.Vector3(from === pirate ? 2.7 : -2.7, 1.6, (Math.random() - 0.5) * 3.8))
    const end = to.position.clone().add(new THREE.Vector3(0, 1.2, (Math.random() - 0.5) * 4))
    ball.position.copy(start)
    smoke.position.copy(start)
    root.add(ball, smoke)
    shots.push({ ball, smoke, start, end, t: 0 })
    sfx('boom')
  }
  return {
    root,
    nextShot: 1.6,
    turn: 0,
    tip: 'Pirates! The pirate ship and the navy are firing cannons! ☠️💥',
    dispose() {
      for (const q of shots) {
        root.remove(q.ball, q.smoke)
        q.smoke.geometry.dispose()
        q.smoke.material.dispose()
      }
      shots.length = 0
      ballGeo.dispose()
      ballMat.dispose()
      pirate.traverse((o) => o.geometry?.dispose())
      navy.traverse((o) => o.geometry?.dispose())
    },
    update(dt, t) {
      const T = this.t
      const travel = (T - 9) * 0.7
      pirate.position.z = -2 + travel
      navy.position.z = 2 + travel
      pirate.position.y = Math.sin(t * 1.3) * 0.15
      navy.position.y = Math.sin(t * 1.15 + 2) * 0.14
      pirate.rotation.z = Math.sin(t * 0.9) * 0.025
      navy.rotation.z = Math.sin(t * 0.8 + 1.7) * 0.025
      this.nextShot -= dt
      if (T > 1.5 && T < 14.5 && this.nextShot <= 0) {
        fire(this.turn++ % 2 ? navy : pirate, this.turn % 2 ? navy : pirate)
        this.nextShot = 1.45 + Math.random() * 0.85
      }
      for (let i = shots.length - 1; i >= 0; i--) {
        const q = shots[i]
        q.t += dt
        const k = Math.min(1, q.t / 0.72)
        q.ball.position.lerpVectors(q.start, q.end, k)
        q.ball.position.y += Math.sin(k * Math.PI) * 2.5
        q.smoke.scale.setScalar(1 + q.t * 2.8)
        q.smoke.material.opacity = Math.max(0, 0.72 - q.t * 1.2)
        if (k >= 1) {
          root.remove(q.ball, q.smoke)
          q.smoke.geometry.dispose()
          q.smoke.material.dispose()
          shots.splice(i, 1)
        }
      }
      if (T > 18) this.done = true
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

// A rare island-wide twenty-second event: Ember circles the castle, the whole sky goes dark, bolts
// strike near Coji wherever he is, and the King's panicked calls carry across the island.
function dragon(S) {
  const root = new THREE.Group()
  root.position.set(L.CASTLE.x, 0, L.CASTLE.z)
  const beast = makeDragon()
  root.add(beast)
  const points = new Float32Array(11 * 3)
  const lightningGeo = new THREE.BufferGeometry()
  lightningGeo.setAttribute('position', new THREE.BufferAttribute(points, 3))
  const lightning = new THREE.Line(lightningGeo, new THREE.LineBasicMaterial({ color: 0xeaf7ff, transparent: true, opacity: 0.95, depthWrite: false, fog: false }))
  lightning.visible = false
  root.add(lightning)
  const flash = new THREE.AmbientLight(0xcfe8ff, 0)
  root.add(flash)
  const strikes = [1.4, 3.8, 6.4, 9.1, 12.2, 15.4, 18.2]
  const fired = new Set()
  S.game.stormTarget = 1
  sfx('dragonRoar')
  if (S.world.king) {
    S.world.king.cheer = 20
    S.world.king.wave = 20
  }
  const redrawLightning = () => {
    const a = lightning.geometry.attributes.position.array
    // Put most bolts close enough for Coji to see. Coordinates are local to the castle-rooted show.
    const nearCoji = fired.size % 3 !== 0 || Math.hypot(S.game.player.x - L.CASTLE.x, S.game.player.z - L.CASTLE.z) > 30
    const tx = (nearCoji ? S.game.player.x : L.CASTLE.x) - L.CASTLE.x + (Math.random() - 0.5) * 15
    const tz = (nearCoji ? S.game.player.z : L.CASTLE.z) - L.CASTLE.z + (Math.random() - 0.5) * 15
    const worldX = tx + L.CASTLE.x
    const worldZ = tz + L.CASTLE.z
    const ground = S.world.surfaceY(worldX, worldZ) + 0.5
    const sx = tx + (Math.random() - 0.5) * 8
    const sz = tz + (Math.random() - 0.5) * 8
    for (let i = 0; i < 11; i++) {
      const k = i / 10
      a[i * 3] = L.lerp(sx, tx, k) + (i && i < 10 ? (Math.random() - 0.5) * 3.2 : 0)
      a[i * 3 + 1] = L.lerp(38, ground, k)
      a[i * 3 + 2] = L.lerp(sz, tz, k) + (i && i < 10 ? (Math.random() - 0.5) * 3.2 : 0)
    }
    lightning.geometry.attributes.position.needsUpdate = true
  }
  return {
    root,
    tip: '🐉 A red dragon is circling the castle! Thunder and lightning shake Sunny Island!',
    dispose() {
      S.game.stormTarget = 0
      S.game.ui.hideEventBanner()
      lightningGeo.dispose()
      lightning.material.dispose()
      disposeDragon(beast)
    },
    update(dt, t) {
      const T = this.t
      const a = T * 0.76
      beast.position.set(Math.cos(a) * 14.5, 20.5 + Math.sin(t * 2.1) * 1.25, Math.sin(a) * 14.5)
      beast.rotation.y = -a
      beast.rotation.z = Math.sin(t * 1.8) * 0.08
      beast.userData.animate(t, { roar: T < 2.2 })
      if (T > 1.9 && !this.firstCry) {
        this.firstCry = true
        S.game.ui.eventBanner('King Arlo is panicking!', '“Oh no! Ember is back! Help me!”', 5.4)
        sayAs('Oh no! Ember is back! Help me!', { who: 'man', seed: 41, pitch: 0.78, rate: 1.02, volume: 1, queue: true })
      }
      let active = -1
      strikes.forEach((at, i) => {
        if (T >= at && !fired.has(i)) {
          fired.add(i)
          redrawLightning()
          sfx('thunder')
        }
        if (T >= at && T < at + 0.2) active = i
      })
      lightning.visible = active >= 0
      flash.intensity = active >= 0 ? 3.4 * (1 - (T - strikes[active]) / 0.2) : 0
      if (active >= 0 && Math.floor(T * 50) % 2 === 0) redrawLightning()
      if (T > 7 && !this.secondCry) {
        this.secondCry = true
        S.game.ui.eventBanner('The King calls for help!', '“Knights! Ring the bells! Keep Ember away!”', 4.8)
        sayAs('Knights! Ring the bells! Keep Ember away from the castle!', { who: 'man', seed: 41, pitch: 0.76, rate: 1.04, volume: 1, queue: true })
      }
      if (T > 14 && !this.thirdCry) {
        this.thirdCry = true
        S.game.ui.eventBanner('King Arlo needs a hero!', '“Coji! Sunny Island needs someone brave!”', 4.5)
        sayAs('Coji! Sunny Island needs someone brave!', { who: 'man', seed: 41, pitch: 0.8, rate: 1.02, volume: 1, queue: true })
      }
      if (T >= 20) this.done = true
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
  let ground = S.world.surfaceY(hx, hz)
  let hoverY = ground + 9
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
      if (pickupFor && !this.took) {
        hx = pickupFor.e.x
        hz = pickupFor.e.z
        ground = S.world.surfaceY(hx, hz)
        hoverY = ground + 9
      }
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
        a.beamWaiting = false
        a.lifted = true
        const k = L.smoothstep(5.5, 8.6, T)
        a.ch.root.position.y = ground + 7 * k
        a.ch.root.scale.setScalar(0.85 * (1 - k * 0.6))
        if (k >= 1) {
          this.took = true
          a.alien = false
          a.beamWaiting = false
          a.life = -1
          g.crowd.remove(a)
        }
      }
      if (T > 14) this.done = true
    },
  }
}
