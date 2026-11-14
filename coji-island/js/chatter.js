// Voices around the island (outside the dialogue box):
// - People Coji walks past say hello out loud, with a little speech bubble to read.
// - Near the castle, the knights sometimes shout "Long live the King!" all together.
// Nobody talks over Coji or over each other: if a voice is busy, it waits for the next chance.
import * as L from './land.js'
import { makeSprite, roundRect } from './build.js'
import { sayAs, speechBusy, cheer, sfx } from './audio.js'

const pick = (a) => a[Math.floor(Math.random() * a.length)]
const GREET = {
  grownup: ['Hello, Coji!', 'Hi there!', 'Good morning!', 'Hello! Nice day!', 'Hi, Coji! How are you?', 'Hello, little friend!', 'Have a nice day!', 'Look! It is Coji! Hello!', 'Hi! Nice to see you!'],
  kid: ['Hi, Coji!', 'Hey, Coji! Hi!', 'Hello! Do you want to play?', 'Hi! I like your bear!', 'Hi, Coji! Bye, Coji!', 'Yay! It is Coji!'],
  knight: ['Good day, Coji!', 'Hello, young hero!', 'Good day to you!'],
  alien: ['Greetings, Earth friend!', 'Beep boop! Hello!', 'Hello, Earth boy!'],
  night: ['Good evening, Coji!', 'Good night, Coji!', 'Hello! Look at the stars!'],
}
const KING = 'Long live the King!'
// Shopkeepers should carry across the ring road, not wait until Coji is already at the counter.
const STORE_NEAR = 18
const STORE_RESET = 25
const STORE_SHOUTS = {
  ben: ['Fresh burgers! Hot and yummy!', 'Burgers and fries! Come and eat!', 'Hungry, Coji? Burger time!'],
  granny: ['Honey, carrots and milk!', 'Fresh food at the Market!', 'Apples and berries wanted here!'],
  penny: ['Bring me your treasures!', 'Treasures in, coins out!', 'Shells, pearls and crystals wanted!'],
  tina: ['Toys, kites and teddy bears!', 'Come and see my new toys!', 'A Super Bright Bulb is in my shop!'],
  coco: ['Cold ice cream for a sunny day!', 'Strawberry, chocolate and mint!', 'Ice cream! Get it before it melts!'],
}

const GIRLY = new Set(['bob', 'bun', 'pigtails'])
function kindOf(look) {
  if (look.grey) return 'alien'
  if (look.hat === 'helmet') return 'knight'
  if (look.kid) return 'kid'
  return 'grownup'
}
// Bright, friendly voices fit the island. Only armored knights (and the King's scripted calls) keep
// a deep voice; age changes the pace a little, not the warmth of the pitch.
function voiceOf(look) {
  if (look.grey) return { who: 'man', pitch: 1.7, rate: 1.15 }
  if (look.kid) return { who: 'kid', pitch: 1.35, rate: 1.05 }
  if (look.hat === 'helmet') return { who: 'man', pitch: 0.82, rate: 0.9 }
  const old = look.hairStyle === 'bald' || /#f4f4f4|#ebe7e1|#ffffff/i.test(look.hair || '')
  const woman = !look.beard && (GIRLY.has(look.hairStyle) || look.dress)
  return { who: woman ? 'woman' : 'man', pitch: (woman ? 1.22 : 1.16) - (old ? 0.05 : 0), rate: old ? 0.94 : 1.03 }
}
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)

function bubble(text) {
  const w = 512
  const h = 128
  return makeSprite(
    (ctx) => {
      ctx.font = 'bold 46px Andika, sans-serif'
      const tw = Math.min(w - 40, ctx.measureText(text).width + 56)
      const x = (w - tw) / 2
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      roundRect(ctx, x, 10, tw, 84, 30)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(w / 2 - 14, 92)
      ctx.lineTo(w / 2, 118)
      ctx.lineTo(w / 2 + 14, 92)
      ctx.fill()
      ctx.fillStyle = '#3b2a1a'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, w / 2, 54, w - 60)
    },
    w,
    h,
    0.62,
  )
}

export class Chatter {
  constructor(game) {
    this.game = game
    this.cool = 6 // seconds until the next hello (anyone)
    this.said = new Map() // who said hello, and when (play time)
    this.bubbles = []
    this.kingT = 8
    this.catT = 8
    this.storeInside = new Set()
    this.storeQueue = []
  }

  update(dt) {
    const g = this.game
    for (const b of this.bubbles.slice()) {
      b.t -= dt
      const r = b.e.ch.root.position
      b.sp.position.set(r.x, r.y + b.h, r.z)
      b.sp.material.opacity = Math.min(1, b.t * 2.5)
      if (b.t <= 0 || !b.e.ch.root.parent) {
        g.scene.remove(b.sp)
        b.sp.material.map?.dispose()
        b.sp.material.dispose()
        this.bubbles.splice(this.bubbles.indexOf(b), 1)
      }
    }
    if (g.mode !== 'play' || g.dialogue.open || g.ui.anyPanel()) return
    // a voice that never finishes (the browser can get stuck) is cleared, so voices keep working
    this.busy = speechBusy() ? (this.busy || 0) + dt : 0
    if (this.busy > 10) {
      speechSynthesis.cancel()
      this.busy = 0
    }
    this.knights(dt)
    this.cool -= dt
    this.watchStores()
    this.cats(dt)
    if (this.cool > 0) return
    const p = g.player
    // only while Coji walks past people
    if (!p.path.length) return
    const now = g.state.play
    let best = null
    let bd = 3.8
    for (const e of Object.values(g.world.npcs)) {
      const ch = e.ch
      if (!ch?.look || g.talking === e || e.id === 'coji') continue
      const r = ch.root.position
      const d = Math.hypot(r.x - p.x, r.z - p.z)
      if (d < bd && now - (this.said.get(e.id) ?? -1e9) > 90) {
        best = e
        bd = d
      }
    }
    if (!best) return
    // someone else is talking: wait a moment; after that, just show the bubble (no voice)
    if (this.busy > 0 && this.busy < 2) {
      this.cool = 0.4
      return
    }
    this.hello(best)
  }

  hello(e) {
    const g = this.game
    const look = e.ch.look
    const kind = kindOf(look)
    const text = g.world.night > 0.5 && kind !== 'alien' ? pick(GREET.night) : pick(GREET[kind])
    const v = voiceOf(look)
    sayAs(text, { ...v, seed: hash(e.id), volume: 0.8 })
    this.said.set(e.id, g.state.play)
    this.cool = 5 + Math.random() * 4
    if (e.ch.wave !== undefined) e.ch.wave = 1.2
    this.showBubble(e, text, look.kid ? 2.0 : look.grey ? 2.1 : 2.55)
  }

  showBubble(e, text, h = 2.55) {
    const g = this.game
    for (const b of this.bubbles) if (b.e === e) b.t = 0 // one bubble per character
    const sp = bubble(text)
    g.scene.add(sp)
    this.bubbles.push({ e, sp, t: 2.8, h })
  }

  // Crossing a shop's doorstep triggers a product-specific call. Leaving the area arms it again,
  // so the shopkeeper calls out on every new pass rather than only once per game.
  watchStores() {
    const g = this.game
    const p = g.player
    for (const id of Object.keys(STORE_SHOUTS)) {
      const e = g.world.npcs[id]
      if (!e?.ch) continue
      const r = e.ch.root.position
      const d = Math.hypot(r.x - p.x, r.z - p.z)
      if (d < STORE_NEAR && !this.storeInside.has(id)) {
        this.storeInside.add(id)
        if (!this.storeQueue.includes(id)) this.storeQueue.push(id)
      } else if (d > STORE_RESET) this.storeInside.delete(id)
    }
    if (!this.storeQueue.length || this.cool > 0 || this.busy > 0) return
    // A queued call is cancelled if Coji walked past before the voice became available.
    let id
    let e
    while (this.storeQueue.length) {
      id = this.storeQueue.shift()
      e = g.world.npcs[id]
      const r = e?.ch?.root.position
      if (r && Math.hypot(r.x - p.x, r.z - p.z) < STORE_RESET) break
      id = null
      e = null
    }
    if (!id || !e?.ch) return
    const text = pick(STORE_SHOUTS[id])
    const v = voiceOf(e.ch.look)
    sayAs(text, { ...v, seed: hash(id + text), volume: 0.85 })
    this.showBubble(e, text)
    if (e.ch.wave !== undefined) e.ch.wave = 1.4
    this.said.set(id, g.state.play)
    this.cool = 5
  }

  // Momo and the island cats make real cat sounds now and then when Coji is close.
  cats(dt) {
    this.catT -= dt
    if (this.catT > 0 || this.cool > 0 || this.busy > 0 || this.storeQueue.length) return
    const p = this.game.player
    let cat = null
    let best = 15
    for (const e of Object.values(this.game.world.npcs)) {
      if (e.id !== 'momo' && !e.cat) continue
      const r = e.ch?.root.position
      if (!r) continue
      const d = Math.hypot(r.x - p.x, r.z - p.z)
      if (d < best) {
        best = d
        cat = e
      }
    }
    if (!cat) return
    const text = pick(['Meow!', 'Meow, meow!', 'Mew!', 'Purr... meow!'])
    sfx('meow')
    this.showBubble(cat, text, 1.15)
    cat.ch.talk = 0.7
    this.catT = 14 + Math.random() * 18
    this.cool = 2.5
  }

  // The knights on the castle walls shout for the King now and then while Coji is near the castle.
  knights(dt) {
    const g = this.game
    const p = g.player
    if (g.shows?.list.some((s) => s.kind === 'dragon')) {
      this.kingT = Math.max(this.kingT, 5)
      return
    }
    const d = Math.hypot(p.x - L.CASTLE.x, p.z - L.CASTLE.z)
    if (d > 34 || !g.crowd.knights.length) {
      // the first shout comes soon after Coji arrives
      this.kingT = Math.min(this.kingT, 6 + Math.random() * 6)
      return
    }
    this.kingT -= dt
    if (this.kingT > 0) return
    if (this.busy > 0) {
      this.kingT = 1
      return
    }
    this.kingT = 55 + Math.random() * 55
    for (const k of g.crowd.knights) {
      k.ch.cheer = 2.2
      k.ch.wave = 2.2
    }
    const percy = g.crowd.items.find((it) => it.circle)
    if (percy) percy.ch.wave = 2.2
    cheer(0.15)
    sayAs(KING, { who: 'man', seed: 3, pitch: 0.8, rate: 0.9, volume: 1 })
    sayAs(KING, { who: 'man', seed: 8, pitch: 0.62, rate: 0.86, volume: 1, queue: true })
    g.ui.toast(`⚔️ The knights shout: "${KING}" 👑`)
  }
}
