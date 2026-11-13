// Life on the island: villagers and animals that come and go near Coji, the people who live in the
// village houses, knights on the castle walls, Sir Percy walking round the castle, and visiting aliens.
// Only things near Coji exist; they are removed again when he walks away.
import * as THREE from 'three'
import * as L from './land.js'
import { Person, Critter, Cat, randomLook, LOOKS, RESIDENT_LOOKS } from './characters.js'
import { CAST, villagerCast, critterCast, alienCast, residentCast, RESIDENTS } from './story.js'
import { sfx } from './audio.js'
import { Parts, SMOOTH, box, cyl, sphere } from './build.js'

const NAMES = ['Mia', 'Ollie', 'Ava', 'Zoe', 'Ella', 'Jack', 'Lucy', 'Ruby', 'Ivy', 'Theo', 'Hana', 'Kai', 'Mei', 'Jun', 'Rosa', 'Omar', 'Lena', 'Nico', 'Tess', 'Yuki']
const ALIEN_NAMES = ['Zib', 'Blip', 'Norp', 'Zuzu', 'Pim']
const NEAR = 38 // spawn within this distance
const FAR = 58 // remove beyond this distance
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const CAT_HELLOS = ['Meow! Hello, Coji!', 'Mew! Purr, purr...', 'Meow! Nice to see you!', 'Purr... I like gentle pets.']

function catCast(name) {
  return {
    name,
    animal: true,
    voice: 1.65,
    greet: () => pick(CAT_HELLOS),
    chat: { q: 'Can I pet you?', a: ['Meow! Purr, purr...', 'That feels nice!'] },
    bye: () => pick(['Meow! Bye-bye!', 'Purr... See you!', 'Mew! Come back soon!']),
    topics: {},
  }
}

function islandCar(color, driverColor) {
  const root = new THREE.Group()
  const p = new Parts(SMOOTH)
  p.add(box(2.0, 0.52, 3.4), color, { y: 0.58, z: 0.05, jitter: 0.02, rough: 0.55 })
  p.add(box(1.72, 0.7, 1.75), color, { y: 1.12, z: -0.25, jitter: 0.015, rough: 0.5 })
  p.add(box(1.78, 0.1, 1.84), '#f5f0df', { y: 1.52, z: -0.25, jitter: 0.01, rough: 0.6 })
  // Windows and a clearly visible driver make the cars feel occupied even at low polygon count.
  p.add(box(1.25, 0.42, 0.04), '#77b9d2', { y: 1.2, z: 0.65, jitter: 0, rough: 0.18 })
  for (const side of [-1, 1]) p.add(box(0.04, 0.4, 1.12), '#77b9d2', { x: side * 0.88, y: 1.2, z: -0.22, jitter: 0, rough: 0.18 })
  p.add(sphere(0.25, 10, 8), driverColor, { x: -0.38, y: 1.35, z: 0.03, jitter: 0.02, rough: 0.75 })
  p.add(sphere(0.26, 10, 7), '#513521', { x: -0.38, y: 1.49, z: 0.01, sy: 0.48, jitter: 0.03, rough: 0.9 })
  for (const x of [-1.03, 1.03])
    for (const z of [-1.08, 1.08]) {
      p.add(cyl(0.34, 0.34, 0.22, 10), '#24262b', { x, y: 0.42, z, rz: Math.PI / 2, flat: false, jitter: 0, rough: 0.8 })
      p.add(cyl(0.14, 0.14, 0.23, 8), '#b9c0c8', { x, y: 0.42, z, rz: Math.PI / 2, flat: false, jitter: 0, metal: 0.7, rough: 0.35 })
    }
  for (const x of [-0.62, 0.62]) p.add(sphere(0.13, 8, 6), '#fff4aa', { x, y: 0.65, z: 1.76, sz: 0.35, jitter: 0, rough: 0.2 })
  root.add(p.build({ shadow: false }))
  return root
}

export class Crowd {
  constructor(game) {
    this.game = game
    this.world = game.world
    this.items = []
    this.n = 0
    this.spawnT = 2
    this.homes = L.BUILDINGS.map((b, i) => ({ b, i })).filter((h) => h.b.kind === 'house').map((h, k) => ({ ...h, k }))
    this.knights = []
    this.outsideChecked = false
    // villagers and animals who walked away are kept and reused (building a new one takes a moment)
    this.pool = { adult: [], kid: [] }
    this.animalPool = {}
    this.makeDoors()
    this.makeIslandCats()
    this.makeTraffic()
  }

  makeTraffic() {
    this.trafficCum = [0]
    for (let i = 0; i < L.RING.length - 1; i++) {
      const a = L.RING[i]
      const b = L.RING[i + 1]
      this.trafficCum.push(this.trafficCum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]))
    }
    this.trafficTotal = this.trafficCum[this.trafficCum.length - 1]
    const specs = [
      ['#e94b3c', '#d8a17d', 6],
      ['#3b7dd8', '#8d5b3e', 28],
      ['#f2c94c', '#edc3a5', 52],
    ]
    this.cars = specs.map(([color, skin, wait], i) => {
      const root = islandCar(color, skin)
      root.visible = false
      this.game.scene.add(root)
      return { root, wait, life: 0, distance: 0, speed: 5.2 + i * 0.45 }
    })
  }

  startCar(car) {
    const hit = L.polyDist(this.game.player.x, this.game.player.z, L.RING)
    const segLen = this.trafficCum[hit.seg + 1] - this.trafficCum[hit.seg]
    car.distance = (this.trafficCum[hit.seg] + hit.t * segLen - 24 + this.trafficTotal) % this.trafficTotal
    car.life = 28 + Math.random() * 12
    car.root.visible = true
  }

  updateTraffic(dt) {
    for (const car of this.cars) {
      if (!car.root.visible) {
        car.wait -= dt
        if (car.wait <= 0) this.startCar(car)
        continue
      }
      car.life -= dt
      car.distance = (car.distance + car.speed * dt) % this.trafficTotal
      let seg = 0
      while (seg < this.trafficCum.length - 2 && this.trafficCum[seg + 1] < car.distance) seg++
      const a = L.RING[seg]
      const b = L.RING[seg + 1]
      const k = (car.distance - this.trafficCum[seg]) / (this.trafficCum[seg + 1] - this.trafficCum[seg])
      const x = L.lerp(a[0], b[0], k)
      const z = L.lerp(a[1], b[1], k)
      car.root.position.set(x, this.world.surfaceY(x, z) + 0.05, z)
      car.root.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1])
      if (car.life <= 0) {
        car.root.visible = false
        car.wait = 30 + Math.random() * 55
      }
    }
  }

  // ---------- registering talkers ----------

  add(kind, ch, x, z, cast, extra = {}) {
    const id = `${kind}-${++this.n}`
    CAST[id] = cast
    const y = this.world.surfaceY(x, z)
    ch.root.position.set(x, y, z)
    ch.baseY = y
    ch.id = id
    this.game.scene.add(ch.root)
    const e = this.world.addEntity({ id, kind: 'npc', x, z, y, reach: extra.reach ?? 1.8, tapR: extra.tapR ?? 1.2, tapH: extra.tapH ?? 2.4, zone: 'crowd' })
    e.ch = ch
    e.walker = true
    this.world.npcs[id] = e
    this.game.npcBuilt(e, { noDots: kind === 'animal' })
    const it = { id, kind, e, ch, wait: 1 + Math.random() * 2, path: [], speed: extra.speed ?? 1.7, life: extra.life ?? Infinity, home: extra.home, ...extra }
    this.items.push(it)
    return it
  }

  remove(it) {
    const { e, ch } = it
    if (this.game.talking === e) return false
    this.game.scene.remove(ch.root)
    this.game.scene.remove(e.proxy)
    const w = this.world
    w.proxies.splice(w.proxies.indexOf(e.proxy), 1)
    w.entities.splice(w.entities.indexOf(e), 1)
    delete w.npcs[e.id]
    delete CAST[e.id]
    this.game.removeMarkers(e)
    this.items.splice(this.items.indexOf(it), 1)
    if (it.kind === 'villager') {
      const list = this.pool[ch.look.kid ? 'kid' : 'adult']
      if (list.length < 5) list.push(ch)
    } else if (it.kind === 'animal') {
      const list = (this.animalPool[it.animal] ||= [])
      if (list.length < 3) list.push(ch)
    }
    return true
  }

  // ---------- spawning ----------

  spot(test, tries = 30) {
    const p = this.game.player
    for (let i = 0; i < tries; i++) {
      const a = Math.random() * Math.PI * 2
      const d = 16 + Math.random() * (NEAR - 16)
      const x = p.x + Math.cos(a) * d
      const z = p.z + Math.sin(a) * d
      if (!this.world.nav.okAt(x, z) || L.spookiness(x, z) > 0.05 || L.onBridge(x, z) || L.onPier(x, z)) continue
      if (test(x, z)) return [x, z]
    }
    return null
  }

  spawnVillager() {
    const s = this.spot((x, z) => L.nearRoad(x, z, 3))
    if (!s) return
    const kid = Math.random() < 0.3
    const rand = Math.random
    const name = pick(NAMES.filter((n) => !this.items.some((it) => CAST[it.id]?.name === n)))
    const reuse = this.pool[kid ? 'kid' : 'adult']
    const ch = reuse.length ? reuse.splice(Math.floor(Math.random() * reuse.length), 1)[0] : new Person(randomLook(rand, kid))
    ch.speed = 0
    ch.talk = 0
    this.add('villager', ch, s[0], s[1], villagerCast(name, kid), { speed: kid ? 2.2 : 1.6, roads: true })
  }

  spawnAnimal() {
    const p = this.game.player
    const kinds = []
    const near = (pt, r) => Math.hypot(p.x - pt.x, p.z - pt.z) < r
    if (near(L.POND, 30)) kinds.push('frog', 'duckling')
    if (near(L.PLACES.farm, 35)) kinds.push('chicken', 'chicken')
    if (L.inland(p.x, p.z) < 30) kinds.push('crab')
    kinds.push('deer', 'fox', 'squirrel', 'hedgehog', 'squirrel')
    const kind = pick(kinds)
    const s = this.spot((x, z) => {
      const h = this.world.terrainY(x, z)
      if (kind === 'crab') return h < 0.9 && L.inland(x, z) < 22
      if (kind === 'frog' || kind === 'duckling') return Math.hypot(x - L.POND.x, z - L.POND.z) < 16
      if (kind === 'chicken') return Math.hypot(x - L.PLACES.farm.x, z - L.PLACES.farm.z) < 20
      // the others like the edges of the ring road and the forest
      return h > 0.9 && !L.nearRoad(x, z, 0.5) && (L.polyDist(x, z, L.RING).d < 14 || L.forestness(x, z) > 0.3)
    })
    if (!s) return
    const ch = this.animalPool[kind]?.pop() || new Critter(kind)
    ch.speed = 0
    const small = ['hedgehog', 'crab', 'frog', 'duckling', 'squirrel'].includes(kind)
    this.add('animal', ch, s[0], s[1], critterCast(kind), { speed: kind === 'deer' ? 2.4 : kind === 'fox' ? 2.0 : small ? 0.9 : 1.2, animal: kind, tapR: small ? 0.7 : 1.1, tapH: small ? 0.8 : 1.8, reach: small ? 1.2 : 1.8 })
  }

  // Friendly cats live all around the island. Some sit in a favorite sunny spot; others roam nearby.
  makeIslandCats() {
    const V = L.PLACES.village
    const F = L.PLACES.farm
    const S = L.PLACES.school
    const B = L.PLACES.beach
    const cats = [
      { name: 'Mittens', x: V.x - 8, z: V.z + 3, fixed: true, colors: { coat: '#f5f2e9', dark: '#77747a', white: '#ffffff', eyes: '#77b45a' } },
      { name: 'Pumpkin', x: F.x + 8, z: F.z + 7, fixed: true, colors: { coat: '#e98a35', dark: '#9d4f25', white: '#fff1dc', eyes: '#79bd63' } },
      { name: 'Luna', x: L.GAZEBO.x - 4, z: L.GAZEBO.z + 4, fixed: true, colors: { coat: '#454653', dark: '#24252d', white: '#f4f3f0', eyes: '#e7c85b' } },
      { name: 'Shadow', x: S.x + 9, z: S.z + 5, roam: 9, colors: { coat: '#34343b', dark: '#17171c', white: '#e9e7e2', eyes: '#d7c84c' } },
      { name: 'Sunny', x: B.x - 7, z: B.z - 5, roam: 11, colors: { coat: '#d8b487', dark: '#8e694b', white: '#fff8ea', eyes: '#6dad73' } },
    ]
    for (const c of cats) {
      const spot = this.catSpot(c.x, c.z)
      if (!spot) continue
      const ch = new Cat(c.colors)
      ch.root.scale.setScalar(0.95 + Math.random() * 0.12)
      const it = this.add('cat', ch, spot[0], spot[1], catCast(c.name), {
        speed: 1.05,
        fixed: !!c.fixed,
        permanent: true,
        home: spot,
        roamRadius: c.roam || 0,
        tapR: 0.75,
        tapH: 1.05,
        reach: 1.25,
      })
      it.e.cat = true
      if (c.fixed) ch.homeFace = Math.random() * Math.PI * 2
    }
  }

  catSpot(x, z) {
    for (let ring = 0; ring <= 8; ring++) {
      const n = Math.max(1, ring * 8)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        const px = x + Math.cos(a) * ring
        const pz = z + Math.sin(a) * ring
        if (this.world.nav.okAt(px, pz) && !L.onBridge(px, pz) && !L.inStream(px, pz, 1) && !L.inPond(px, pz, 1)) return [px, pz]
      }
    }
    return null
  }

  spawnAlien(x, z) {
    const ch = new Person(LOOKS.alien)
    ch.root.scale.setScalar(0.85)
    const it = this.add('alien', ch, x, z, alienCast(pick(ALIEN_NAMES)), { speed: 1.4, life: 50, alien: true })
    return it
  }

  // ---------- village houses: knock on the door ----------

  makeDoors() {
    for (const h of this.homes) {
      const b = h.b
      const [x, z] = L.ahead(b.x, b.z, b.rot, b.d / 2 + 0.9)
      const e = this.world.addEntity({ id: `door-${h.k}`, kind: 'door', x, z, tapR: 1.0, tapH: 2.6, reach: 1.1, zone: 'village', home: h })
      h.door = e
    }
  }

  knock(door) {
    const h = door.home
    sfx('knock')
    this.game.ui.tip('Knock, knock! 🚪', { key: 'knock', cooldown: 0, force: true, time: 2 })
    const out = this.items.find((it) => it.resident === h.k)
    if (out) return this.game.startTalk(out.e)
    if (Math.random() < 0.25 && this.game.state.met[`res-${h.k}`]) {
      setTimeout(() => this.game.ui.tip(`Nobody is home. A note says: "${RESIDENTS[h.k].note}"`, { key: 'note-' + h.k, cooldown: 0, force: true, time: 9 }), 900)
      return
    }
    setTimeout(() => {
      const it = this.spawnResident(h, true)
      if (it && !this.game.dialogue.open) {
        sfx('door')
        this.game.startTalk(it.e)
        this.game.state.met[`res-${h.k}`] = 1
      }
    }, 900)
  }

  spawnResident(h, atDoor) {
    if (this.items.some((it) => it.resident === h.k)) return null
    const b = h.b
    const [x, z] = L.ahead(b.x, b.z, b.rot, b.d / 2 + (atDoor ? 0.35 : 1.8 + Math.random()))
    const ch = new Person(RESIDENT_LOOKS[h.k % RESIDENT_LOOKS.length])
    const it = this.add('resident', ch, x, z, residentCast(h.k % RESIDENTS.length), { speed: 1.2, resident: h.k, stay: true, life: 60, home: [x, z] })
    ch.root.rotation.y = b.rot
    return it
  }

  // ---------- the castle guards ----------

  makeKnights() {
    if (this.knights.length) return
    const C = L.CASTLE
    const base = this.world.terrainY(C.x, C.z) - 0.05 + 5.2
    const runs = [
      [[-9.55, -7], [-9.55, 7]],
      [[9.55, 7], [9.55, -7]],
      [[-7, -9.55], [7, -9.55]],
    ]
    for (const [a, b] of runs) {
      const ch = new Person(LOOKS.guard)
      ch.root.position.set(C.x + a[0], base, C.z + a[1])
      this.game.scene.add(ch.root)
      this.knights.push({ ch, a, b, t: Math.random(), dir: 1, wait: 0, base })
    }
    // Sir Percy walks round the castle on the loop road
    const ch = new Person(LOOKS.percy)
    const it = this.add('knight', ch, C.x + C.loop, C.z, CAST.percy, { speed: 1.4, circle: true, ang: 0 })
    delete CAST[it.id]
    CAST[it.id] = CAST.percy
  }

  // ---------- every frame ----------

  update(dt, t) {
    const g = this.game
    const p = g.player
    if (g.mode !== 'play') return
    this.updateTraffic(dt)
    const dCastle = Math.hypot(p.x - L.CASTLE.x, p.z - L.CASTLE.z)
    if (dCastle < 75) this.makeKnights()
    for (const k of this.knights) this.walkKnight(k, dt, t)

    this.spawnT -= dt
    if (this.spawnT <= 0) {
      this.spawnT = 1.5
      const vill = this.items.filter((it) => it.kind === 'villager').length
      const ani = this.items.filter((it) => it.kind === 'animal').length
      const onRing = L.polyDist(p.x, p.z, L.RING).d < 14
      const spooky = L.spookiness(p.x, p.z) > 0.2
      if (!spooky && vill < 3 && Math.random() < 0.5) this.spawnVillager()
      if (!spooky && ani < (onRing ? 6 : 4) && Math.random() < 0.6) this.spawnAnimal()
      // residents step outside when Coji comes to the village
      const dVillage = Math.hypot(p.x - L.VILLAGE.x, p.z - L.VILLAGE.z)
      if (dVillage < 36 && !this.outsideChecked) {
        this.outsideChecked = true
        for (const h of this.homes) if (Math.random() < 0.35) this.spawnResident(h, false)
      }
      if (dVillage > 60) this.outsideChecked = false
    }
    for (const it of this.items.slice()) {
      const e = it.e
      const d = Math.hypot(p.x - e.x, p.z - e.z)
      it.life -= dt
      if ((!it.permanent && d > FAR && !it.circle) || (it.life <= 0 && !it.alien && !it.permanent && d > 12)) {
        if (this.remove(it)) continue
      }
      if (it.alien && it.life <= 0 && !it.leaving && g.talking !== e) {
        it.leaving = true
        g.shows?.ufoPickup(it)
      }
      if (it.lifted) continue
      this.walk(it, dt)
    }
  }

  walk(it, dt) {
    const g = this.game
    const e = it.e
    const ch = it.ch
    if (g.talking === e) {
      ch.speed = 0
      return
    }
    if (it.fixed) {
      ch.speed = 0
      e.y = g.world.surfaceY(e.x, e.z)
      ch.baseY = e.y
      ch.root.position.set(e.x, e.y, e.z)
      return
    }
    if (it.circle) {
      it.ang += (dt * it.speed) / L.CASTLE.loop
      e.x = L.CASTLE.x + Math.cos(it.ang) * L.CASTLE.loop
      e.z = L.CASTLE.z + Math.sin(it.ang) * L.CASTLE.loop
      ch.speed = it.speed
      ch.root.rotation.y = Math.atan2(-Math.sin(it.ang), Math.cos(it.ang))
    } else if (it.path.length) {
      const wp = it.path[0]
      const dx = wp.x - e.x
      const dz = wp.z - e.z
      const d = Math.hypot(dx, dz)
      const step = Math.min(d, it.speed * dt)
      if (d > 0.001) {
        e.x += (dx / d) * step
        e.z += (dz / d) * step
        const want = Math.atan2(dx, dz)
        let diff = (want - ch.root.rotation.y) % (Math.PI * 2)
        if (diff > Math.PI) diff -= Math.PI * 2
        if (diff < -Math.PI) diff += Math.PI * 2
        ch.root.rotation.y += diff * Math.min(1, dt * 6)
      }
      ch.speed = it.speed
      if (d - step < 0.05) it.path.shift()
      if (!it.path.length) it.wait = 2 + Math.random() * 4
    } else {
      ch.speed = 0
      it.wait -= dt
      // someone coming to ask Coji for help is steered by help.js
      if (it.wait <= 0 && !it.follow) this.chooseTarget(it)
    }
    e.y = g.world.surfaceY(e.x, e.z)
    ch.baseY = e.y
    ch.root.position.set(e.x, e.y, e.z)
    e.proxy.position.set(e.x, e.y + (e.proxy.geometry.parameters.height || 2) / 2, e.z)
    e.proxy.updateMatrixWorld()
  }

  chooseTarget(it) {
    const e = it.e
    const nav = this.world.nav
    for (let k = 0; k < 8; k++) {
      let tx
      let tz
      if (it.roamRadius && it.home) {
        const a = Math.random() * Math.PI * 2
        const r = 2 + Math.random() * it.roamRadius
        tx = it.home[0] + Math.cos(a) * r
        tz = it.home[1] + Math.sin(a) * r
      } else if (it.stay) {
        tx = it.home[0] + (Math.random() - 0.5) * 3
        tz = it.home[1] + (Math.random() - 0.5) * 3
      } else {
        const a = Math.random() * Math.PI * 2
        const r = it.roads ? 8 + Math.random() * 14 : 3 + Math.random() * 8
        tx = e.x + Math.cos(a) * r
        tz = e.z + Math.sin(a) * r
        if (it.roads && !L.nearRoad(tx, tz, 1.5)) continue
        if (it.animal === 'frog' || it.animal === 'duckling') if (Math.hypot(tx - L.POND.x, tz - L.POND.z) > 16) continue
        if (it.animal === 'crab' && L.inland(tx, tz) > 22) continue
      }
      if (!nav.okAt(tx, tz) || L.spookiness(tx, tz) > 0.05) continue
      const path = nav.find(e.x, e.z, tx, tz, 4000)
      if (path) {
        it.path = path
        return
      }
    }
    it.wait = 2
  }

  walkKnight(k, dt, t) {
    const C = L.CASTLE
    if (k.wait > 0) {
      k.wait -= dt
      k.ch.speed = 0
    } else {
      const len = Math.hypot(k.b[0] - k.a[0], k.b[1] - k.a[1])
      k.t += (k.dir * dt * 1.1) / len
      if (k.t >= 1 || k.t <= 0) {
        k.t = Math.max(0, Math.min(1, k.t))
        k.dir *= -1
        k.wait = 2 + Math.random() * 2
      }
      k.ch.speed = 1.1
    }
    const x = C.x + k.a[0] + (k.b[0] - k.a[0]) * k.t
    const z = C.z + k.a[1] + (k.b[1] - k.a[1]) * k.t
    k.ch.root.position.set(x, k.base, z)
    const dx = (k.b[0] - k.a[0]) * k.dir
    const dz = (k.b[1] - k.a[1]) * k.dir
    // walking: face the way they go; resting: look out over the walls
    const want = k.wait > 0 ? Math.atan2(x - C.x, z - C.z) : Math.atan2(dx, dz)
    k.ch.root.rotation.y += (((want - k.ch.root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 4)
    k.ch.update(dt, t)
  }
}
