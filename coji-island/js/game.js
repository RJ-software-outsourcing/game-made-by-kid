// The game: renderer, main loop, Coji, taps, talking, stats, tips, saving and the finale.
import * as THREE from 'three'
import * as L from './land.js'
import { World } from './world.js'
import { Person, LOOKS, Skeleton } from './characters.js'
import { FollowCam } from './camera.js'
import { UI } from './ui.js'
import { Dialogue } from './dialogue.js'
import { CAST, QUESTS, talk, stepTip, targets } from './story.js'
import { ITEMS } from './items.js'
import { TUNE, energyCostFactor, restFactor } from './config.js'
import { sfx, unlock, startMusic, setMood } from './audio.js'
import { JobRunner, JOB_REST } from './jobs.js'
import { Crowd } from './crowd.js'
import { Shows } from './shows.js'
import { makeSprite, roundRect, SEE } from './build.js'

const SAVE_KEY = 'coji-island-save-v1'
const FOOD = ['apple', 'berries', 'burger', 'fries', 'carrot', 'milk', 'juice']
const DRINKS = ['water', 'juice', 'milk']

export function freshState() {
  return {
    v: 1,
    energy: TUNE.start.energy,
    water: TUNE.start.water,
    coins: 0,
    bag: {},
    quest: null,
    step: 0,
    done: [],
    clues: {},
    flags: {},
    met: {},
    tips: {},
    x: L.START.x,
    z: L.START.z,
    face: L.START.face,
    harvest: {},
    taken: {},
    jobs: {},
    play: 0,
  }
}
export function readSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY))
    if (s && s.v === 1) return { ...freshState(), ...s }
  } catch {
    // no save
  }
  return null
}
function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // ignore
  }
}

const PICKUPS = new Set(['shell', 'coin', 'glasses', 'mushroom'])
const regrowOf = (kind) => ({ appletree: TUNE.treeRegrow, berrybush: TUNE.bushRegrow, carrots: TUNE.carrotRegrow, pumpkin: 80 })[kind]

const angleTo = (a, b) => {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

export async function init({ onProgress }) {
  const canvas = document.getElementById('scene')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const game = new Game(renderer, canvas)
  await game.load(onProgress)
  return game
}

class Game {
  constructor(renderer, canvas) {
    this.renderer = renderer
    this.canvas = canvas
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.3, 1600)
    this.world = new World(this.scene, renderer)
    this.mode = 'title'
    this.state = freshState()
    this.afterTalk = []
    this.portraits = {}
    this.markers = []
    this.lastAction = performance.now()
    this.saveT = 0
    this.tipT = 0
    this.streamT = 0
    this.frames = []
    this.skeletons = []
    this.spook = 0
    this.nightK = 0
    this.asked = new Set()
    const touch = matchMedia('(pointer: coarse)').matches
    this.maxPR = Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 1.75)
    this.pr = this.maxPR
  }

  async load(progress) {
    progress(0.15, 'Getting the crayons…')
    try {
      await Promise.race([Promise.all([document.fonts.load('bold 40px Andika'), document.fonts.load('800 40px "Baloo 2"')]), new Promise((r) => setTimeout(r, 1500))])
    } catch {
      // fonts are optional
    }
    progress(0.2, 'Building the island…')
    await this.world.buildCore((p) => progress(0.2 + p * 0.65, p < 0.5 ? 'Building the island…' : 'Planting trees…'))
    this.world.onNpcBuilt = (e) => this.npcBuilt(e)
    this.world.camera = this.camera

    this.coji = new Person(LOOKS.coji)
    this.scene.add(this.coji.root)
    this.player = { x: L.START.x, z: L.START.z, face: L.START.face, path: [], target: null, speed: 0, resting: false, bench: null, nap: 0 }
    this.placeCoji()
    this.makeRing()
    this.makeZzz()

    this.cam = new FollowCam(this.camera, this.canvas, {
      onTap: (x, y) => this.onTap(x, y),
      groundY: (x, z) => this.world.groundY(x, z),
      clear: (f, c) => this.world.cameraClear(f, c),
    })
    this.cam.override = this.titleView(0)
    this.cam.snap(this.cam.override.focus)
    this.cam.cy = this.cam.override.yaw
    this.cam.cp = this.cam.override.pitch
    this.cam.cd = this.cam.override.dist

    this.ui = new UI(this)
    this.dialogue = new Dialogue({
      portrait: (id) => this.portraitOf(id),
      nameOf: (id) => (id === 'coji' ? 'Coji' : CAST[id].name),
      voiceOf: (id) => CAST[id]?.voice ?? 1,
      onChange: () => this.afterChange(),
      onClose: () => this.endTalk(),
      onTalk: (id) => {
        const n = this.world.npcs[id]
        if (n) n.ch.talk = 0.7
      },
    })
    this.g = this.makeApi()
    this.jobs = new JobRunner(this)
    this.crowd = new Crowd(this)
    this.shows = new Shows(this)

    progress(0.9, 'Waking up the animals…')
    this.world.buildAllNear(L.START.x, L.START.z)
    this.resize()
    window.addEventListener('resize', () => this.resize())
    window.visualViewport?.addEventListener('resize', () => this.resize())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.save()
    })
    window.addEventListener('pagehide', () => this.save())
    window.addEventListener('keydown', (e) => this.onKey(e))
    this.clock = new THREE.Clock()
    // Compile shaders now so the first frames of play don't stutter.
    this.renderer.compile(this.scene, this.camera)
    this.loop()
    progress(1, 'Ready!')
  }

  titleView(t) {
    return { focus: new THREE.Vector3(0, 2, 70), yaw: 0.5 + t * 0.04, pitch: 0.42, dist: 52 }
  }

  resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setPixelRatio(this.pr)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.fov = w < h ? 62 : 50
    this.camera.updateProjectionMatrix()
  }

  // ---------- start / save ----------

  hasSave() {
    return !!readSave()
  }

  start(fresh) {
    unlock()
    startMusic()
    if (fresh) clearSave()
    this.state = (!fresh && readSave()) || freshState()
    const s = this.state
    this.player.x = s.x
    this.player.z = s.z
    this.player.face = s.face
    this.player.path = []
    this.player.target = null
    this.placeCoji()
    this.world.buildAllNear(s.x, s.z)
    if (s.done.includes('bear') && !s.quest && !s.done.includes('light')) this.startQuest('light', true)
    this.world.setBridgeBlocked(!s.done.includes('bear'))
    if (s.done.includes('light')) this.world.lightUp()
    for (const e of Object.values(this.world.npcs)) this.applyNpcState(e)
    if (this.world.booLantern) this.world.booLantern.visible = s.done.includes('boo')
    this.mode = 'play'
    this.cam.override = null
    this.cam.yaw = s.face + Math.PI
    this.ui.show()
    this.ui.renderQuest()
    this.ui.update(s)
    this.lastAction = performance.now()
    this.checkQuest()
    setTimeout(() => {
      if (!s.met.pip) this.ui.tip("Hi! I'm Blankie Bear. 🧸 Tap Captain Pip to say hi! 👋", { key: 'welcome', force: true, time: 8 })
      else this.ui.tip(stepTip(this.g), { key: 'idle', force: true })
    }, 1600)
  }

  save() {
    if (this.mode === 'title') return
    const s = this.state
    s.x = this.player.x
    s.z = this.player.z
    s.face = this.player.face
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(s))
    } catch {
      // storage full or blocked: keep playing
    }
  }

  restart() {
    clearSave()
    this.mode = 'title'
    location.reload()
  }

  // ---------- the API the story uses ----------

  makeApi() {
    const game = this
    const S = () => game.state
    return {
      stage: () => game.stage(),
      has: (id, n = 1) => (S().bag[id] || 0) >= n,
      count: (id) => S().bag[id] || 0,
      give: (id, n = 1) => game.give(id, n),
      take: (id, n = 1) => game.take(id, n),
      get coins() {
        return S().coins
      },
      addCoins: (n) => game.addCoins(n),
      spend: (n) => {
        S().coins -= n
        game.ui.update(S())
      },
      flag: (k) => !!S().flags[k],
      setFlag: (k, v = true) => {
        S().flags[k] = v
      },
      met: (id) => !!S().met[id],
      knows: (c) => (S().clues[S().quest] || []).includes(c),
      clue: (c) => game.addClue(c),
      startQuest: (id) => game.startQuest(id),
      completeQuest: (id) => game.completeQuest(id),
      advance: () => game.advance(),
      done: (id) => S().done.includes(id),
      mood: (id, m) => {
        const n = game.world.npcs[id]
        if (n) n.ch.mood = m
        if (id === 'hoot' && m === 'happy' && n) n.ch.glasses.visible = true
      },
      sfx: (n) => sfx(n),
      later: (fn) => game.afterTalk.push(fn),
      openShop: (id) => game.ui.openShop(id),
      startBag: () => {
        if (S().flags.gotBag) return
        S().flags.gotBag = true
        game.give('water', 1, true)
        game.give('apple', 1, true)
        game.addCoins(3)
      },
      finale: () => game.finale(),
      quest: () => S().quest,
      asked: () => game.asked,
      jobReady: (id) => S().jobs[id] === undefined || S().play - S().jobs[id] > JOB_REST,
      openJob: (id) => game.jobs.start(id),
      booLantern: () => {
        if (game.world.booLantern) game.world.booLantern.visible = true
      },
    }
  }

  stage() {
    const s = this.state
    if (s.quest) return `${s.quest}.${s.step}`
    if (s.done.includes('boo')) return 'end'
    if (s.done.includes('light')) return 'free'
    if (s.done.includes('bear')) return 'light.0'
    return 'start'
  }

  give(id, n = 1, quiet = false) {
    const s = this.state
    s.bag[id] = (s.bag[id] || 0) + n
    const it = ITEMS[id]
    if (!quiet) {
      this.ui.toast(`+${n} ${it.icon} ${it.name}`)
      sfx('pick')
    }
    this.afterChange()
  }
  take(id, n = 1) {
    const s = this.state
    s.bag[id] = Math.max(0, (s.bag[id] || 0) - n)
    if (!s.bag[id]) delete s.bag[id]
    this.afterChange()
  }
  addCoins(n) {
    this.state.coins += n
    this.ui.toast(`+${n} 🪙`)
    sfx('coin')
    this.afterChange()
  }
  hasFood() {
    return FOOD.some((f) => this.state.bag[f] > 0)
  }

  addClue(c) {
    const s = this.state
    const q = s.quest
    if (!q || !QUESTS[q].clues[c]) return
    const list = (s.clues[q] ||= [])
    if (list.includes(c)) return
    list.push(c)
    sfx('clue')
    this.ui.toast('💡 New clue!')
    this.ui.renderQuest()
    this.ui.flashQuest()
    this.newClue = true
    this.checkQuest()
  }

  startQuest(id, quiet = false) {
    const s = this.state
    s.quest = id
    s.step = 0
    s.clues[id] ||= []
    if (!quiet) {
      sfx('quest')
      this.ui.toast(`New quest! ${QUESTS[id].icon} ${QUESTS[id].title}`, true)
    }
    this.ui.renderQuest()
    this.ui.flashQuest()
    this.checkQuest()
    this.save()
  }
  completeQuest(id) {
    const s = this.state
    if (!s.done.includes(id)) s.done.push(id)
    if (s.quest === id) {
      s.quest = null
      s.step = 0
    }
    sfx('quest')
    this.ui.toast('⭐ Quest done! ⭐', true)
    if (id === 'bear') {
      this.world.setBridgeBlocked(false)
      this.bearMove = { t: 0 }
    }
    this.ui.renderQuest()
    this.save()
  }
  advance() {
    const s = this.state
    if (!s.quest) return
    if (s.step < QUESTS[s.quest].steps.length - 1) {
      s.step++
      sfx('step')
      this.ui.toast('✅ Good job! Next step!')
      this.ui.renderQuest()
      this.ui.flashQuest()
      this.checkQuest()
      this.save()
    }
  }
  checkQuest() {
    const s = this.state
    if (!s.quest) return
    const st = QUESTS[s.quest].steps[s.step]
    if (st?.done && st.done(this.g)) this.advance()
  }
  afterChange() {
    this.ui?.update(this.state)
    this.checkQuest()
  }

  // ---------- Coji ----------

  placeCoji() {
    const p = this.player
    const r = this.coji.root
    r.position.set(p.x, this.world.surfaceY(p.x, p.z), p.z)
    r.rotation.y = p.face
  }

  makeRing() {
    const g = new THREE.Group()
    const mat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false })
    const outer = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.05, 32).rotateX(-Math.PI / 2), mat(0xffffff))
    const inner = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.68, 32).rotateX(-Math.PI / 2), mat(0xffc21a))
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 4).rotateX(Math.PI), mat(0xffc21a))
    for (const m of [outer, inner, arrow]) {
      m.renderOrder = 20
      g.add(m)
    }
    this.scene.add(g)
    this.ring = g
    this.ringParts = { outer, inner, arrow }
    this.ringT = 0
  }
  showRing(x, z) {
    this.ring.position.set(x, this.world.surfaceY(x, z) + 0.06, z)
    this.ringT = 1
  }
  makeZzz() {
    this.zzz = makeSprite(
      (ctx, w, h) => {
        ctx.font = 'bold 54px "Baloo 2", sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = '#5b7bb8'
        ctx.lineWidth = 8
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.strokeText('Zzz', w / 2, h / 2)
        ctx.fillText('Zzz', w / 2, h / 2)
      },
      128,
      64,
      0.7,
    )
    this.zzz.visible = false
    this.scene.add(this.zzz)
  }

  stopRest() {
    const p = this.player
    if (!p.resting) return
    p.resting = false
    p.bench = null
    this.coji.stand()
    this.coji.setRest(false)
    this.placeCoji()
    this.ui.update(this.state)
  }
  startRest(bench) {
    const p = this.player
    p.path = []
    p.target = null
    p.resting = true
    p.bench = bench || null
    this.coji.sit()
    this.coji.setRest(true)
    if (bench) {
      p.x = bench.x
      p.z = bench.z
      p.face = bench.rot
    }
    sfx('rest')
    this.ui.update(this.state)
    this.ui.tip(bench ? 'Resting on the bench... 💤 Tap the ground to get up.' : 'Resting... 💤 Tap the ground to get up.', { key: 'rest', cooldown: 20, force: true })
  }
  toggleRest() {
    unlock()
    if (this.mode !== 'play') return
    this.lastAction = performance.now()
    if (this.player.resting) this.stopRest()
    else this.startRest(null)
  }

  // ---------- taps ----------

  onTap(cx, cy) {
    unlock()
    if (this.mode !== 'play' || this.dialogue.open || this.ui.anyPanel() || this.player.nap > 0) return
    this.lastAction = performance.now()
    const rect = this.canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1)
    const ray = new THREE.Raycaster()
    ray.setFromCamera(ndc, this.camera)
    // Characters and things first
    const hits = ray.intersectObjects(this.world.proxies, false)
    for (const h of hits) {
      const e = h.object.userData.entity
      if (!this.active(e)) continue
      if (e.kind === 'grave') return this.tapGrave(e)
      if (e.kind === 'king') {
        sfx('tap')
        return this.ui.tip("That's King Arlo! 👑 He waves from his castle. Sir Lance guards the gate.", { key: 'king', cooldown: 3, force: true })
      }
      return this.goTo(e)
    }
    const g = ray.intersectObjects(this.world.groundMeshes, false)[0]
    let point = g?.point
    if (!point) {
      const t = -ray.ray.origin.y / ray.ray.direction.y
      if (t > 0) point = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t)
    }
    if (point) this.walkTo(point.x, point.z)
  }

  active(e) {
    if (e.kind === 'npc') return !!e.ch
    if (PICKUPS.has(e.kind)) return !!e.mesh && e.mesh.visible
    if (e.fruit) return !!e.mesh
    return true
  }

  walkTo(x, z, quiet = false) {
    this.stopRest()
    const p = this.player
    p.target = null
    const path = this.world.nav.find(p.x, p.z, x, z)
    if (!path) {
      if (!quiet) this.cantGo(x, z)
      return false
    }
    p.path = path
    const last = path[path.length - 1]
    this.showRing(last.x, last.z)
    sfx('walk')
    return true
  }

  cantGo(x, z) {
    sfx('nope')
    const s = this.state
    if (!s.done.includes('bear')) {
      this.world.setBridgeBlocked(false)
      const p2 = this.world.nav.find(this.player.x, this.player.z, x, z)
      this.world.setBridgeBlocked(true)
      if (p2) {
        this.ui.tip('Bruno the bear is sitting on the bridge. Nobody can cross! 🐻', { key: 'bearblock', cooldown: 6, force: true })
        return
      }
    }
    this.ui.tip("Coji can't go there. Try another way! 🙂", { key: 'cantgo', cooldown: 4, force: true })
  }

  goTo(e) {
    this.stopRest()
    const p = this.player
    const reach = e.reach ?? 2
    const d = Math.hypot(p.x - e.x, p.z - e.z)
    if (d <= reach + 0.5) {
      p.path = []
      p.target = null
      return this.interact(e)
    }
    const ux = (p.x - e.x) / d
    const uz = (p.z - e.z) / d
    let path = this.world.nav.find(p.x, p.z, e.x + ux * reach, e.z + uz * reach)
    if (!path || Math.hypot(path[path.length - 1].x - e.x, path[path.length - 1].z - e.z) > reach + 2.5) path = this.world.nav.find(p.x, p.z, e.x, e.z)
    if (!path) return this.cantGo(e.x, e.z)
    p.path = path
    p.target = e
    const last = path[path.length - 1]
    this.showRing(last.x, last.z)
    sfx('walk')
  }

  interact(e) {
    const p = this.player
    p.face = Math.atan2(e.x - p.x, e.z - p.z)
    switch (e.kind) {
      case 'npc':
        return this.startTalk(e)
      case 'well':
      case 'spring':
      case 'fountain':
        return this.drink(e)
      case 'bench':
        return this.startRest(e)
      case 'appletree':
      case 'berrybush':
      case 'carrots':
      case 'pumpkin':
        return this.harvest(e)
      case 'sign':
        return this.readSign(e)
      case 'shell':
      case 'coin':
      case 'glasses':
      case 'mushroom':
        return this.collect(e)
      case 'chest':
        return this.openChest(e)
      case 'door':
        return this.crowd.knock(e)
    }
  }

  drink(e) {
    const s = this.state
    s.water = 100
    sfx('drink')
    this.coji.cheer = 0.8
    this.ui.toast('💧 Gulp, gulp! Water is full!')
    if (e.kind !== 'fountain' && (s.bag.water || 0) < 2) {
      this.give('water', 1, true)
      this.ui.tip('Ahh! And your water bottle is full too! 💧', { key: 'bottle', cooldown: 60, force: true })
    }
    this.afterChange()
    this.save()
  }

  harvest(e) {
    const s = this.state
    const regrow = regrowOf(e.kind)
    const t = s.harvest[e.id]
    if (t !== undefined && s.play - t < regrow) {
      const what = { appletree: 'apples', berrybush: 'berries', carrots: 'carrots', pumpkin: 'pumpkins' }[e.kind]
      this.ui.tip(`No ${what} now. They will grow back soon! 🌱`, { key: 'regrow-' + e.kind, cooldown: 5, force: true })
      return
    }
    s.harvest[e.id] = s.play
    if (e.kind === 'appletree') this.give('apple', 2)
    if (e.kind === 'berrybush') this.give('berries', 3)
    if (e.kind === 'carrots') this.give('carrot', 1)
    if (e.kind === 'pumpkin') this.give('pumpkin', 1)
    e.shake = 0.7
    this.coji.cheer = 0.6
    this.save()
  }

  readSign(e) {
    const names = e.boards.map((k) => `${L.PLACES[k].icon} ${L.PLACES[k].name}`).join(', ')
    sfx('tap')
    this.ui.tip(`The sign says: ${names}. Follow the arrows!`, { key: 'sign-' + e.id, cooldown: 2, force: true, time: 9 })
  }

  collect(e) {
    const s = this.state
    if (!e.mesh || !e.mesh.visible) return
    e.mesh.visible = false
    if (e.sparkle) e.sparkle.visible = false
    s.taken[e.id] = s.play
    if (e.kind === 'shell') this.give('shell', 1)
    if (e.kind === 'mushroom') this.give('mushroom', 1)
    if (e.kind === 'coin') this.addCoins(1)
    if (e.kind === 'glasses') {
      this.give('glasses', 1)
      this.ui.tip('Round glasses! 👓 Who lost them?', { key: 'glasses', once: true, force: true })
    }
    this.save()
  }

  useItem(id) {
    const s = this.state
    const it = ITEMS[id]
    if (!s.bag[id]) return
    if (it.energy && !it.water && s.energy >= 98) return this.ui.toast('Coji is not hungry now. 😊')
    if (it.water && !it.energy && s.water >= 98) return this.ui.toast('Coji is not thirsty now. 😊')
    if (it.energy) s.energy = Math.min(100, s.energy + it.energy)
    if (it.water) s.water = Math.min(100, s.water + it.water)
    this.take(id)
    sfx(DRINKS.includes(id) ? 'drink' : 'eat')
    this.coji.cheer = 0.6
    const fx = [it.energy && `+${it.energy} ⚡`, it.water && `+${it.water} 💧`].filter(Boolean).join('  ')
    this.ui.toast(`${it.icon} Yum! ${fx}`)
    this.save()
  }
  buy(id, price) {
    this.state.coins -= price
    this.give(id, 1)
    this.save()
  }
  sell(id, price) {
    this.take(id, 1)
    this.state.coins += price
    sfx('coin')
    this.afterChange()
    this.save()
  }

  // ---------- talking ----------

  startTalk(e) {
    const id = e.cast || e.id
    const ch = e.ch
    this.asked = new Set()
    const p = this.player
    this.talking = e
    document.body.classList.add('talking')
    this.ui.setHintVisible(false)
    this.ui.hideHint()
    if (id === 'momo') sfx('meow')
    if (id === 'hoot') sfx('hoot')
    if (id === 'bun') sfx('hop')
    if (id === 'bruno' && !this.state.done.includes('bear')) sfx('growl')
    if (id === 'boo') sfx('boo')
    if (id === 'bones') sfx('rattle')
    p.face = Math.atan2(e.x - p.x, e.z - p.z)
    e.talkFace = Math.atan2(p.x - ch.root.position.x, p.z - ch.root.position.z)
    const node = talk(this.g, id)
    this.state.met[id] = 1
    this.dialogue.start(id, node)
  }

  endTalk() {
    const e = this.talking
    this.talking = null
    document.body.classList.remove('talking')
    if (e) e.talkFace = null
    this.ui.setHintVisible(true)
    const jobs = this.afterTalk.splice(0)
    for (const fn of jobs) fn()
    if (this.newClue && this.mode === 'play') {
      this.newClue = false
      this.ui.tip('You found a clue! Tap the quest card to read your clues. 💡', { key: 'clue-help', once: true, force: true })
    }
    this.lastAction = performance.now()
    this.save()
  }

  portraitOf(id) {
    if (this.portraits[id]) return this.portraits[id]
    if (id === 'bones') return this.world.portrait(this.talking.ch)
    const ch = id === 'coji' ? this.coji : this.world.npcs[id]?.ch
    if (!ch) return ''
    const savedHead = ch.head?.rotation.clone()
    const url = this.world.portrait(ch)
    if (savedHead) ch.head.rotation.copy(savedHead)
    this.portraits[id] = url
    return url
  }

  // ---------- characters ----------

  npcBuilt(e, opts = {}) {
    // marker ("!" or "…") and a name tag above the head
    const ch = e.ch
    const h = ch.faceY !== undefined ? ch.faceY + (ch.P ? ch.P.headR + 0.75 : 0.9) : 2.8
    const bang = makeSprite((ctx, w, hh) => {
      ctx.fillStyle = '#ffcf3f'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.arc(w / 2, hh / 2, w / 2 - 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#7a4300'
      ctx.font = 'bold 76px "Baloo 2", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('!', w / 2, hh / 2 + 6)
    }, 128, 128, 0.85)
    const dots = makeSprite((ctx, w, hh) => {
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      roundRect(ctx, 6, 10, w - 12, hh - 30, 30)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(w / 2 - 12, hh - 22)
      ctx.lineTo(w / 2, hh - 4)
      ctx.lineTo(w / 2 + 12, hh - 22)
      ctx.fill()
      ctx.fillStyle = '#7a8ca8'
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath()
        ctx.arc(w / 2 + i * 26, hh / 2 - 6, 9, 0, Math.PI * 2)
        ctx.fill()
      }
    }, 128, 96, 0.6)
    const name = CAST[e.id].name
    const tag = makeSprite((ctx, w, hh) => {
      ctx.font = 'bold 44px Andika, sans-serif'
      const tw = Math.min(w - 8, ctx.measureText(name).width + 36)
      ctx.fillStyle = 'rgba(59,42,30,0.78)'
      roundRect(ctx, (w - tw) / 2, 6, tw, hh - 12, (hh - 12) / 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(name, w / 2, hh / 2 + 2)
    }, 512, 80, 0.5)
    for (const s of [bang, dots, tag]) {
      s.visible = false
      this.scene.add(s)
    }
    const m = { e, bang, dots, tag, h, noDots: opts.noDots }
    this.markers.push(m)
    if (this.mode === 'play') this.applyNpcState(e)
  }

  applyNpcState(e) {
    const s = this.state
    const ch = e.ch
    if (!ch) return
    if (e.id === 'bruno') {
      if (s.done.includes('bear') && !this.bearMove) {
        this.placeBear(1)
        ch.mood = 'idle'
      } else if (!s.done.includes('bear')) ch.mood = 'hungry'
    }
    if (e.id === 'hoot' && s.flags.hootHappy) ch.glasses.visible = true
  }

  // Bruno hops off the bridge to the side of the road (k: 0..1).
  placeBear(k) {
    const e = this.world.npcs.bruno
    if (!e) return
    const from = { x: L.NPCS.bruno.x, z: L.NPCS.bruno.z }
    const to = L.BEAR_SPOT
    const x = L.lerp(from.x, to.x, k)
    const z = L.lerp(from.z, to.z, k)
    const y = L.lerp(this.world.groundY(from.x, from.z), this.world.groundY(to.x, to.z), k) + Math.sin(Math.min(1, k * 3) * Math.PI) * 0.6 * (k < 1 ? 1 : 0)
    e.ch.root.position.set(x, y, z)
    e.ch.baseY = this.world.groundY(to.x, to.z)
    if (k >= 1) {
      e.ch.root.position.y = e.ch.baseY
      e.ch.homeFace = L.BEAR_SPOT.face
      e.ch.root.rotation.y = L.BEAR_SPOT.face
    }
    e.x = x
    e.z = z
    e.proxy.position.set(x, this.world.groundY(x, z) + 1.6, z)
    e.proxy.updateMatrixWorld()
  }

  updateNpcs(dt, t) {
    const p = this.player
    for (const e of Object.values(this.world.npcs)) {
      const ch = e.ch
      const r = ch.root
      const dx = p.x - r.position.x
      const dz = p.z - r.position.z
      const d = Math.hypot(dx, dz)
      const toCoji = Math.atan2(dx, dz)
      if (e.talkFace != null && e.id !== 'finn' && e.id !== 'hoot') {
        r.rotation.y += angleTo(r.rotation.y, e.talkFace) * Math.min(1, dt * 6)
      } else if (ch.homeFace !== undefined && e.id !== 'finn') {
        r.rotation.y += angleTo(r.rotation.y, ch.homeFace) * Math.min(1, dt * 1.5)
      }
      // look at Coji when he is close
      const rel = angleTo(r.rotation.y, toCoji)
      ch.lookYaw = d < 9 ? Math.max(-1.1, Math.min(1.1, rel)) : 0
      // wave hello the first time Coji comes close
      if (d < 8 && !e.waved && ch.wave !== undefined && !ch.seated) {
        e.waved = true
        ch.wave = 1.4
      }
      if (d > 16) e.waved = false
      ch.update(dt, t)
    }
    if (this.bearMove) {
      this.bearMove.t += dt / 1.6
      if (!this.talking) {
        const k = Math.min(1, this.bearMove.t)
        this.placeBear(k)
        if (k >= 1) {
          this.bearMove = null
          const b = this.world.npcs.bruno
          if (b) setTimeout(() => (b.ch.mood = 'idle'), 4000)
        }
      } else this.bearMove.t = 0
    }
  }

  updateMarkers(t) {
    const p = this.player
    const tg = this.mode === 'play' ? targets(this.g) : new Set()
    for (const m of this.markers) {
      const e = m.e
      const r = e.ch.root
      const d = Math.hypot(p.x - r.position.x, p.z - r.position.z)
      const talking = this.talking === e
      const y = r.position.y + m.h + Math.sin(t * 3 + r.position.x) * 0.1
      const isTarget = tg.has(e.id)
      m.bang.visible = this.mode === 'play' && isTarget && !talking
      m.dots.visible = this.mode === 'play' && !isTarget && !talking && d < 30 && !m.noDots
      m.tag.visible = this.mode === 'play' && !talking && d < 10
      m.bang.position.set(r.position.x, y + 0.1, r.position.z)
      m.dots.position.set(r.position.x, y, r.position.z)
      m.tag.position.set(r.position.x, r.position.y + m.h - 0.55, r.position.z)
      const k = isTarget ? 1 + Math.sin(t * 6) * 0.08 : 1
      m.bang.scale.set(0.85 * k, 0.85 * k, 1)
    }
  }

  // ---------- per frame ----------

  loop() {
    requestAnimationFrame(() => this.loop())
    const raw = this.clock.getDelta()
    const dt = Math.min(0.05, raw)
    const t = this.clock.elapsedTime
    const t0 = performance.now()
    this.frame(dt, t)
    this.adapt(raw, performance.now() - t0)
  }

  frame(dt, t) {
    const paused = this.mode !== 'play' || this.dialogue.open || this.ui.anyPanel()
    if (this.mode === 'title') this.cam.override = this.titleView(t)
    if (this.mode === 'play' && !paused) this.updatePlayer(dt)
    else this.player.speed = 0
    if (this.mode === 'play' && !paused) this.state.play += dt
    this.coji.speed = this.player.speed
    this.coji.update(dt, t)
    if (this.mode === 'play') {
      this.crowd.update(dt, t)
      this.shows.update(dt, t)
    }
    this.updateNpcs(dt, t)
    this.updateSkeletons(dt, t)
    const sp = this.mode === 'title' ? 0 : L.spookiness(this.player.x, this.player.z)
    this.spook += (sp - this.spook) * Math.min(1, dt * 1.5)
    this.world.setEnv(this.nightK, this.spook)
    setMood(this.spook > 0.45 ? 'spooky' : 'happy')
    this.updateMarkers(t)
    // the tap ring fades
    if (this.ringT > 0) {
      // stays while Coji walks there, then fades
      if (!this.player.path.length) this.ringT = Math.max(0, this.ringT - dt * 2)
      const { outer, inner, arrow } = this.ringParts
      const a = Math.min(1, this.ringT * 1.5)
      outer.material.opacity = a * 0.9
      inner.material.opacity = a * 0.95
      arrow.material.opacity = a
      const pulse = 1 + Math.sin(t * 6) * 0.12
      outer.scale.set(pulse, 1, pulse)
      arrow.position.y = 1.0 + Math.abs(Math.sin(t * 5)) * 0.6
      arrow.rotation.y = t * 2
    }
    this.zzz.visible = this.player.resting || this.player.nap > 0
    if (this.zzz.visible) this.zzz.position.set(this.player.x + 0.3, this.coji.root.position.y + 2.0 + Math.sin(t * 2) * 0.15, this.player.z)
    const focus = this.coji.root.position
    this.world.update(dt, t, focus)
    this.cam.update(dt, focus)
    this.updateSeeThrough()
    // build nearby zones (one per few frames), the rest when idle
    this.streamT -= dt
    if (this.streamT <= 0) {
      this.streamT = 0.3
      const idle = this.mode === 'play' && t > 4
      this.world.stream(this.player.x, this.player.z, idle)
    }
    if (this.mode === 'play') {
      this.syncWorld(dt)
      this.tipT -= dt
      if (this.tipT <= 0 && !paused) {
        this.tipT = 0.5
        this.updateTips()
      }
      this.saveT -= dt
      if (this.saveT <= 0) {
        this.saveT = 5
        this.save()
      }
      this.uiT = (this.uiT || 0) - dt
      if (this.uiT <= 0) {
        this.uiT = 0.2
        this.ui.update(this.state)
      }
    }
    if (this.fin) this.updateFinale(dt)
    this.renderer.render(this.scene, this.camera)
  }

  updatePlayer(dt) {
    const p = this.player
    const s = this.state
    let moved = 0
    if (p.nap > 0) {
      p.nap -= dt
      s.energy = Math.min(TUNE.napTo, s.energy + (TUNE.napTo / 4) * dt)
      if (p.nap <= 0) {
        this.coji.stand()
        this.coji.setRest(false)
        this.placeCoji()
        this.ui.tip('Coji feels a little better. Eat something soon! 🍎', { key: 'napdone', force: true })
      }
      p.speed = 0
    } else if (p.path.length) {
      const wp = p.path[0]
      const dx = wp.x - p.x
      const dz = wp.z - p.z
      const d = Math.hypot(dx, dz)
      const speed = s.energy < 15 ? TUNE.tiredSpeed : TUNE.walkSpeed
      const step = Math.min(d, speed * dt)
      if (d > 0.001) {
        p.x += (dx / d) * step
        p.z += (dz / d) * step
        const want = Math.atan2(dx, dz)
        p.face += angleTo(p.face, want) * Math.min(1, dt * 12)
      }
      moved = step
      p.speed = speed
      if (d - step < 0.05) p.path.shift()
      if (!p.path.length && p.target) {
        const e = p.target
        p.target = null
        const dd = Math.hypot(p.x - e.x, p.z - e.z)
        if (dd < (e.reach ?? 2) + 3.5) this.interact(e)
        else this.ui.tip("Coji can't get closer. 🙂", { key: 'closer', cooldown: 4, force: true })
      }
    } else {
      p.speed = 0
    }
    // stats
    if (moved > 0) {
      s.energy -= moved * TUNE.energyPerMeter * energyCostFactor(s.water)
      s.water -= moved * TUNE.waterPerMeter
    }
    s.water = Math.max(0, s.water - TUNE.waterPerSecond * dt)
    if (p.resting) {
      const gain = TUNE.restPerSecond * restFactor(s.water) * (p.bench ? TUNE.benchBonus : 1) * dt
      s.energy = Math.min(100, s.energy + gain)
      if (s.energy >= 100 && !this.restFull) {
        this.restFull = true
        this.ui.toast('⚡ Full of energy!')
      }
    } else this.restFull = false
    if (s.energy <= 0 && p.nap <= 0) {
      s.energy = 0
      p.nap = 4
      p.path = []
      p.target = null
      this.coji.sit()
      this.coji.setRest(true)
      sfx('rest')
      this.ui.tip('Oh no! Coji is too tired and takes a nap... 😴 Eat food to keep your energy up!', { key: 'nap', force: true, time: 8 })
    }
    // place Coji
    const r = this.coji.root
    const sitting = p.resting || p.nap > 0
    const gy = this.world.surfaceY(p.x, p.z)
    r.position.set(p.x, sitting ? (p.bench ? this.world.groundY(p.x, p.z) + 0.2 : gy - 0.25) : gy, p.z)
    r.rotation.y = p.face
    // walk over shells and coins to pick them up
    for (const e of this.world.entities) {
      if (!PICKUPS.has(e.kind)) continue
      if (!e.mesh || !e.mesh.visible) continue
      if (Math.abs(e.x - p.x) < 1.1 && Math.abs(e.z - p.z) < 1.1 && Math.hypot(e.x - p.x, e.z - p.z) < 1.1) this.collect(e)
    }
  }

  // Pickups come back, fruit grows back.
  syncWorld(dt) {
    const s = this.state
    for (const e of this.world.entities) {
      if (!e.mesh) continue
      if (PICKUPS.has(e.kind)) {
        let has = s.taken[e.id] === undefined
        if (!has && (e.kind === 'shell' || e.kind === 'mushroom') && s.play - s.taken[e.id] > TUNE.shellRespawn) {
          delete s.taken[e.id]
          has = true
        }
        if (e.kind === 'glasses' && (s.flags.hootHappy || s.bag.glasses)) has = false
        e.mesh.visible = has
        if (e.sparkle) e.sparkle.visible = has
      } else if (e.fruit && e.fruitMesh) {
        const regrow = regrowOf(e.kind)
        const t = s.harvest[e.id]
        e.fruitMesh.visible = t === undefined || s.play - t >= regrow
      }
      if (e.kind === 'chest' && s.flags.chestOpen) e.mesh.userData.lid.rotation.x = Math.max(-1.9, e.mesh.userData.lid.rotation.x - dt * 3)
      if (e.kind === 'chest') e.mesh.userData.coins.visible = !s.flags.chestOpen || e.mesh.userData.lid.rotation.x > -1.8
      if (e.shake > 0) {
        e.shake -= dt
        e.mesh.rotation.z = Math.sin(e.shake * 40) * 0.06 * e.shake
      }
    }
  }

  updateTips() {
    const s = this.state
    const ui = this.ui
    const g = this.g
    const p = this.player
    const hasDrink = DRINKS.some((d) => s.bag[d] > 0)
    if (s.energy < 12 && p.nap <= 0) {
      if (ui.tip(this.hasFood() ? 'Coji is very tired! 😫 Open your bag 🎒 and eat something!' : 'Coji is very tired! 😫 Rest 💤 or find food 🍎.', { key: 'e2', cooldown: 25 })) return
    }
    if (s.water < 12) {
      if (ui.tip(hasDrink ? 'Coji is very thirsty! 🥵 Open your bag 🎒 and drink!' : 'Coji is very thirsty! 🥵 Find water at the well in the village! 💧', { key: 'w2', cooldown: 25 })) return
    }
    if (s.energy < 30 && !p.resting) {
      if (ui.tip(this.hasFood() ? 'Coji is getting tired. 😓 Eat something from your bag 🎒!' : 'Coji is getting tired. 😓 Find food 🍎 or rest on a bench 💤.', { key: 'e1', cooldown: 45 })) return
    }
    if (s.water < 30) {
      if (ui.tip(hasDrink ? 'Coji is thirsty. 💧 Drink water from your bag 🎒!' : 'Coji is thirsty. 💧 Find the well, the spring or a fountain!', { key: 'w1', cooldown: 45 })) return
    }
    // first time near friends and things
    let near = null
    let nd = 9
    for (const e of Object.values(this.world.npcs)) {
      if (s.met[e.id]) continue
      const d = Math.hypot(p.x - e.ch.root.position.x, p.z - e.ch.root.position.z)
      if (d < nd) {
        nd = d
        near = e
      }
    }
    if (near && ui.tip(`Look! It's ${CAST[near.id].name}. Tap to say hi! 👋`, { key: 'meet-' + near.id, once: true })) return
    const THINGS = {
      well: 'This is a well. Tap it to drink water! 💧',
      spring: 'Fresh spring water! Tap it to drink. 💧',
      fountain: 'A water fountain! Tap it to drink. 💧',
      bench: 'A bench! Tap it to sit and rest. 💤',
      appletree: 'An apple tree! Tap it to get apples. 🍎',
      berrybush: 'A berry bush! Tap it to pick berries. 🫐',
      carrots: 'Carrots! Tap to pick one. 🥕',
      sign: 'A signpost! Tap it to read where to go. 🪧',
      grave: 'A gravestone... Tap it if you dare! 👻',
      pumpkin: 'Pumpkins! Tap one to pick it. 🎃',
      shell: 'A shiny shell! Walk to it to pick it up. 🐚',
      coin: 'A shiny coin! Walk to it to pick it up. 🪙',
    }
    for (const e of this.world.entities) {
      const msg = THINGS[e.kind]
      if (!msg || s.tips['thing-' + e.kind]) continue
      if (e.kind === 'shell' || e.kind === 'coin') {
        if (!e.mesh || !e.mesh.visible) continue
      }
      if (Math.hypot(p.x - e.x, p.z - e.z) < 7 && ui.tip(msg, { key: 'thing-' + e.kind, once: true })) return
    }
    if (Math.hypot(p.x - L.CASTLE.x, p.z - L.CASTLE.z) < 34 && ui.tip('Look up! Knights walk on the castle walls. ⚔️', { key: 'knights', once: true })) return
    if (this.spook > 0.6 && ui.tip('Ooh, it is spooky here! 👻 Do not worry, the ghosts are friendly.', { key: 'spooky', once: true })) return
    if (this.skeletons.some((k) => Math.hypot(k.e.x - p.x, k.e.z - p.z) < 9) && ui.tip('A skeleton! 💀 It is friendly. Tap it to talk!', { key: 'skeleton', once: true })) return
    // nothing happening: what to do next
    if (performance.now() - this.lastAction > 28000) {
      if (ui.tip(stepTip(g), { key: 'idle', cooldown: 40 })) this.lastAction = performance.now() - 8000
    }
  }

  onKey(e) {
    if (this.mode !== 'play') return
    if (this.dialogue.open) return
    const k = e.key.toLowerCase()
    if (k === 'b') this.ui.anyPanel() ? this.ui.closePanel('bag') : this.ui.openBag()
    if (k === 'm') this.ui.anyPanel() ? this.ui.closePanel('map') : this.openMap()
    if (k === 'escape') for (const id of ['bag', 'shop', 'map', 'menu']) this.ui.closePanel(id)
  }

  // ---------- map ----------

  async openMap() {
    if (this.mode !== 'play') return
    this.lastAction = performance.now()
    if (!this.mapMod) this.mapMod = await import('./map.js')
    const el = document.getElementById('map')
    const canvas = el.querySelector('.map-canvas')
    this.ui.openPanel('map')
    const draw = () => {
      const s = this.state
      const stars = []
      const q = s.quest
      if (q) {
        for (const c of s.clues[q] || []) {
          const place = QUESTS[q].clues[c].place
          if (!place) continue
          if (place === 'owl') stars.push([L.OWL_TREE.x, L.OWL_TREE.z])
          else if (place === 'glasses') stars.push([L.GLASSES_SPOT.x, L.GLASSES_SPOT.z])
          else stars.push([L.PLACES[place].x, L.PLACES[place].z])
        }
      }
      const tg = [...targets(this.g)].map((id) => {
        const n = this.world.npcs[id]
        return n ? [n.ch.root.position.x, n.ch.root.position.z] : [L.NPCS[id].x, L.NPCS[id].z]
      })
      if (!this.mapTrees) {
        this.mapTrees = []
        for (const z of this.world.zones) for (const type of ['round', 'pine', 'palm']) for (const it of z.items[type] || []) this.mapTrees.push([it.x, it.z])
      }
      this.mapMod.drawMap(canvas, {
        sample: (x, z) => this.world.terrainY(x, z),
        trees: this.mapTrees,
        player: this.player,
        camYaw: this.cam.cy ?? this.cam.yaw,
        stars,
        targets: tg,
        bearOnBridge: !s.done.includes('bear'),
        lit: s.done.includes('light'),
      })
      el.querySelector('.map-here').textContent = this.mapMod.placeName(this.player.x, this.player.z)
    }
    draw()
    clearInterval(this.mapTimer)
    this.mapTimer = setInterval(() => {
      if (el.classList.contains('hidden')) return clearInterval(this.mapTimer)
      draw()
    }, 120)
    this.ui.tip('The red arrow is Coji. ⭐ shows places from your clues.', { key: 'map-help', once: true, force: true })
  }
  onMapClosed() {
    clearInterval(this.mapTimer)
  }

  // ---------- finale ----------

  finale() {
    const s = this.state
    if (!s.done.includes('light')) s.done.push('light')
    s.quest = null
    s.step = 0
    this.save()
    this.mode = 'finale'
    this.ui.hide()
    const lh = this.world.lighthouse.position
    this.cam.override = { focus: new THREE.Vector3(lh.x - 4, lh.y + 7, lh.z + 6), yaw: -0.7, pitch: 0.22, dist: 46 }
    this.fin = { t: 0, lit: false, fw: false, shown: false, boom: 0 }
    this.coji.cheer = 6
  }

  updateFinale(dt) {
    const f = this.fin
    f.t += dt
    if (!f.back) {
      this.nightK = L.smoothstep(0.5, 4, f.t)
      if (f.t > 3 && !f.lit) {
        f.lit = true
        this.world.lightUp()
        sfx('finale')
      }
      if (f.t > 4 && !f.fw) {
        f.fw = true
        this.world.fireworks(true)
      }
      if (f.fw) {
        f.boom -= dt
        if (f.boom <= 0) {
          f.boom = 0.7 + Math.random() * 0.6
          sfx('boom')
        }
      }
      if (f.t > 8 && !f.shown) {
        f.shown = true
        this.ui.showFinale()
      }
    } else {
      f.bt += dt
      this.nightK = 1 - L.smoothstep(0, 8, f.bt)
      if (f.bt > 6 && this.world.fw) this.world.fireworks(false)
      if (f.bt > 8) this.fin = null
    }
  }

  afterFinale() {
    this.mode = 'play'
    this.cam.override = null
    this.ui.show()
    this.ui.renderQuest()
    this.fin.back = true
    this.fin.bt = 0
    this.ui.tip('Thank you, Coji! 🧸 Now you can explore the island!', { key: 'free', force: true })
  }

  // ---------- adaptive quality ----------

  // If frames are slow (below ~25 fps), lower the resolution, then the shadow detail.
  // Very long gaps mean the tab was hidden or throttled, not that drawing is slow: skip those.
  adapt(raw, cpuMs) {
    if (raw > 0.1 || this.mode === 'title') return
    this.frames.push(raw)
    if (this.frames.length < 120) return
    const avg = this.frames.reduce((a, b) => a + b, 0) / this.frames.length
    this.frames.length = 0
    void cpuMs
    if (avg > 0.04 && this.pr > 1) {
      this.pr = Math.max(1, this.pr - 0.25)
      this.resize()
    } else if (avg > 0.045 && this.pr <= 1 && !this.lowShadows) {
      this.lowShadows = true
      const sh = this.world.sun.shadow
      sh.mapSize.set(1024, 1024)
      sh.map?.dispose()
      sh.map = null
    }
  }
}

// ---------- the graveyard: ghosts and skeletons ----------

Game.prototype.tapGrave = function (e) {
  const now = performance.now()
  if (e.lastPop && now - e.lastPop < 900) return
  e.lastPop = now
  sfx('ghost')
  this.world.popGhost(e.x, e.y + 0.6, e.z)
  if (e.mesh) e.shake = 0.5
  if (Math.random() < 0.3 && this.skeletons.length < 2) this.spawnSkeleton(e)
}

Game.prototype.spawnSkeleton = function (grave) {
  const ch = new Skeleton()
  const ux = Math.sin(grave.rot) * 1.3
  const uz = Math.cos(grave.rot) * 1.3
  const x = grave.x + ux
  const z = grave.z + uz
  const y = this.world.groundY(x, z)
  ch.root.position.set(x, y - 1.9, z)
  ch.root.rotation.y = grave.rot
  this.scene.add(ch.root)
  const e = this.world.addEntity({ id: `bones-${Date.now()}`, cast: 'bones', kind: 'npc', x, z, y, reach: 2.0, tapR: 1.0, tapH: 2.2, zone: 'graveyard' })
  e.ch = ch
  this.skeletons.push({ e, ch, state: 'rise', t: 0, life: 25 + Math.random() * 12, target: null })
  sfx('rattle')
}

Game.prototype.updateSkeletons = function (dt, t) {
  const G = L.GRAVEYARD
  for (let i = this.skeletons.length - 1; i >= 0; i--) {
    const k = this.skeletons[i]
    const { ch, e } = k
    const r = ch.root
    const gy = this.world.groundY(e.x, e.z)
    k.t += dt
    if (k.state === 'rise') {
      r.position.y = gy - 1.9 * (1 - L.smoothstep(0, 1.4, k.t))
      if (k.t > 1.4) {
        k.state = 'walk'
        k.t = 0
      }
    } else if (k.state === 'walk') {
      k.life -= dt
      if (this.talking === e) {
        ch.speed = 0
        r.rotation.y += angleTo(r.rotation.y, Math.atan2(this.player.x - e.x, this.player.z - e.z)) * Math.min(1, dt * 6)
      } else {
        if (!k.target || Math.hypot(k.target[0] - e.x, k.target[1] - e.z) < 0.4) {
          for (let tries = 0; tries < 8; tries++) {
            const a = Math.random() * Math.PI * 2
            const rr = Math.random() * 9
            const tx = G.x + Math.cos(a) * rr
            const tz = G.z + Math.sin(a) * rr
            if (this.world.nav.okAt(tx, tz) && this.world.nav.clear(e.x, e.z, tx, tz)) {
              k.target = [tx, tz]
              break
            }
          }
          if (!k.target) k.target = [G.x, G.z]
        }
        const dx = k.target[0] - e.x
        const dz = k.target[1] - e.z
        const d = Math.hypot(dx, dz) || 1
        const step = Math.min(d, 1.3 * dt)
        e.x += (dx / d) * step
        e.z += (dz / d) * step
        ch.speed = 1.3
        r.rotation.y += angleTo(r.rotation.y, Math.atan2(dx, dz)) * Math.min(1, dt * 5)
      }
      r.position.set(e.x, this.world.groundY(e.x, e.z), e.z)
      const far = Math.hypot(this.player.x - L.GRAVEYARD.x, this.player.z - L.GRAVEYARD.z) > L.GRAVEYARD.r + 22
      if ((k.life <= 0 || far) && this.talking !== e) {
        k.state = 'sink'
        k.t = 0
        sfx('rattle')
      }
    } else if (k.state === 'sink') {
      ch.speed = 0
      r.position.y = gy - 1.9 * L.smoothstep(0, 1.2, k.t)
      if (k.t > 1.2) {
        this.scene.remove(r)
        this.scene.remove(e.proxy)
        this.world.proxies.splice(this.world.proxies.indexOf(e.proxy), 1)
        this.world.entities.splice(this.world.entities.indexOf(e), 1)
        this.skeletons.splice(i, 1)
        continue
      }
    }
    e.proxy.position.set(e.x, r.position.y + 1.1, e.z)
    e.proxy.updateMatrixWorld()
    ch.lookYaw = Math.hypot(this.player.x - e.x, this.player.z - e.z) < 6 ? Math.max(-1, Math.min(1, angleTo(r.rotation.y, Math.atan2(this.player.x - e.x, this.player.z - e.z)))) : 0
    ch.update(dt, t)
  }
}

// Tell the see-through shader where Coji is on screen, so things in front of him fade.
const _v = new THREE.Vector3()
Game.prototype.updateSeeThrough = function () {
  const on = this.mode === 'play' || this.mode === 'finale'
  SEE.uSeeOn.value = on ? 1 : 0
  if (!on) return
  const cam = this.camera
  cam.updateMatrixWorld()
  _v.copy(this.coji.root.position)
  _v.y += 0.9
  const depth = -_v.clone().applyMatrix4(cam.matrixWorldInverse).z
  _v.project(cam)
  const size = this.renderer.getDrawingBufferSize(new THREE.Vector2())
  SEE.uSeePos.value.set((_v.x * 0.5 + 0.5) * size.x, (_v.y * 0.5 + 0.5) * size.y)
  SEE.uSeeDepth.value = depth
  SEE.uSeeR.value = (size.y * 1.35) / (2 * Math.tan((cam.fov * Math.PI) / 360) * Math.max(1, depth))
}

// The treasure chest on Turtle Island: coins, once.
Game.prototype.openChest = function (e) {
  const s = this.state
  if (s.flags.chestOpen) {
    this.ui.tip('The chest is empty now. Old Sam says the sea brings new treasure one day! 🌊', { key: 'chest-empty', cooldown: 5, force: true })
    return
  }
  s.flags.chestOpen = true
  sfx('quest')
  this.addCoins(6)
  this.coji.cheer = 1
  this.ui.tip('A treasure chest! It has 6 shiny coins! 🪙✨', { key: 'chest', force: true })
  this.save()
}

Game.prototype.removeMarkers = function (e) {
  const i = this.markers.findIndex((m) => m.e === e)
  if (i < 0) return
  const m = this.markers[i]
  for (const sp of [m.bang, m.dots, m.tag]) {
    this.scene.remove(sp)
    sp.material.map?.dispose()
    sp.material.dispose()
  }
  this.markers.splice(i, 1)
  delete this.portraits[e.id]
}
