// Voices around the island (outside the dialogue box):
// - People Coji walks past say hello out loud, with a little speech bubble to read.
// - Near the castle, the knights sometimes shout "Long live the King!" all together.
// Nobody talks over Coji or over each other: if a voice is busy, it waits for the next chance.
import * as L from './land.js'
import { makeSprite, roundRect } from './build.js'
import { sayAs, speechBusy, cheer } from './audio.js'

const pick = (a) => a[Math.floor(Math.random() * a.length)]
const GREET = {
  grownup: ['Hello, Coji!', 'Hi there!', 'Good morning!', 'Hello! Nice day!', 'Hi, Coji! How are you?', 'Hello, little friend!', 'Have a nice day!', 'Look! It is Coji! Hello!', 'Hi! Nice to see you!'],
  kid: ['Hi, Coji!', 'Hey, Coji! Hi!', 'Hello! Do you want to play?', 'Hi! I like your bear!', 'Hi, Coji! Bye, Coji!', 'Yay! It is Coji!'],
  knight: ['Good day, Coji!', 'Hello, young hero!', 'Good day to you!'],
  alien: ['Greetings, Earth friend!', 'Beep boop! Hello!', 'Hello, Earth boy!'],
  night: ['Good evening, Coji!', 'Good night, Coji!', 'Hello! Look at the stars!'],
}
const KING = 'Long live the King!'

const GIRLY = new Set(['bob', 'bun', 'pigtails'])
function kindOf(look) {
  if (look.grey) return 'alien'
  if (look.hat === 'helmet') return 'knight'
  if (look.kid) return 'kid'
  return 'grownup'
}
// a man's, a woman's or a child's voice, and a pitch that fits (older people a little lower)
function voiceOf(look) {
  if (look.grey) return { who: 'man', pitch: 1.7, rate: 1.15 }
  if (look.kid) return { who: 'kid', pitch: 1.35, rate: 1.05 }
  const old = look.hairStyle === 'bald' || /#f4f4f4|#ebe7e1|#ffffff/i.test(look.hair || '')
  const woman = !look.beard && (GIRLY.has(look.hairStyle) || look.dress)
  return { who: woman ? 'woman' : 'man', pitch: (woman ? 1.08 : 0.95) - (old ? 0.12 : 0), rate: old ? 0.92 : 1.0 }
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
    for (const b of this.bubbles) if (b.e === e) b.t = 0 // one bubble per person
    const sp = bubble(text)
    g.scene.add(sp)
    this.bubbles.push({ e, sp, t: 2.8, h: look.kid ? 2.0 : look.grey ? 2.1 : 2.55 })
  }

  // The knights on the castle walls shout for the King now and then while Coji is near the castle.
  knights(dt) {
    const g = this.game
    const p = g.player
    const d = Math.hypot(p.x - L.CASTLE.x, p.z - L.CASTLE.z)
    if (d > 60 || !g.crowd.knights.length) {
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
