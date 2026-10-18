// All sounds are synthesized with Web Audio: no audio files, works offline.

let ctx = null
let master = null
let musicBus = null
let muted = false
try {
  muted = localStorage.getItem('hs-muted') === '1'
} catch {
  // storage blocked: default to sound on
}

export function ac() {
  if (!('AudioContext' in window)) return null
  try {
    if (!ctx) {
      ctx = new AudioContext()
      master = ctx.createGain()
      master.gain.value = muted ? 0 : 0.9
      master.connect(ctx.destination)
      musicBus = ctx.createGain()
      musicBus.gain.value = 0.55
      musicBus.connect(master)
    }
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch {
    return null
  }
}

export const isMuted = () => muted
export function setMuted(m) {
  muted = m
  try {
    localStorage.setItem('hs-muted', m ? '1' : '0')
  } catch {
    // ignore
  }
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05)
}

function tone({ type = 'sine', from, to = from, start = 0, dur, gain, vib, at, dest }) {
  const c = ac()
  if (!c) return
  const t0 = at ?? c.currentTime + start
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, t0)
  osc.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur / 3))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(dest ?? master)
  if (vib) {
    const lfo = c.createOscillator()
    const depth = c.createGain()
    lfo.frequency.value = vib[0]
    depth.gain.value = vib[1]
    lfo.connect(depth).connect(osc.frequency)
    lfo.start(t0)
    lfo.stop(t0 + dur + 0.05)
  }
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

let noiseBuffer = null
function noise({ start = 0, dur, gain, filter = 'lowpass', freqFrom, freqTo = freqFrom, attack = 0.01 }) {
  const c = ac()
  if (!c) return
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const t0 = c.currentTime + start
  const src = c.createBufferSource()
  src.buffer = noiseBuffer
  const f = c.createBiquadFilter()
  f.type = filter
  f.frequency.setValueAtTime(freqFrom, t0)
  f.frequency.exponentialRampToValueAtTime(freqTo, t0 + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f).connect(g).connect(master)
  src.start(t0)
  src.stop(t0 + dur + 0.05)
}

const rnd = (a, b) => a + Math.random() * (b - a)

export const sfx = {
  move() {
    tone({ from: 660, to: 880, dur: 0.08, gain: 0.05, type: 'triangle' })
  },
  select() {
    ;[523, 784, 1047].forEach((f, i) => tone({ from: f, start: i * 0.06, dur: 0.18, gain: 0.06, type: 'triangle' }))
  },
  tick() {
    tone({ from: 1200, to: 900, dur: 0.06, gain: 0.04, type: 'square' })
  },
  go() {
    ;[392, 523, 659, 784].forEach((f, i) => tone({ from: f, start: i * 0.08, dur: 0.25, gain: 0.07, type: 'triangle' }))
  },
  rpsBeat(i) {
    tone({ from: 180 + i * 40, to: 90, dur: 0.18, gain: 0.18 })
    noise({ dur: 0.08, gain: 0.08, filter: 'highpass', freqFrom: 3000 })
  },
  reveal() {
    tone({ from: 300, to: 1200, dur: 0.25, gain: 0.06, type: 'triangle' })
    tone({ from: 1200, start: 0.22, dur: 0.3, gain: 0.05, type: 'triangle', vib: [12, 30] })
  },
  tie() {
    tone({ from: 600, to: 500, dur: 0.15, gain: 0.06, type: 'triangle' })
    tone({ from: 600, to: 500, start: 0.18, dur: 0.15, gain: 0.06, type: 'triangle' })
  },
  ghost() {
    tone({ from: 300, to: 600, dur: 0.5, gain: 0.07, vib: [6, 40] })
    tone({ from: 600, to: 250, start: 0.45, dur: 0.6, gain: 0.06, vib: [6, 40] })
  },
  bubble() {
    const f = rnd(500, 900)
    tone({ from: f, to: f * 2.2, dur: 0.09, gain: 0.04 })
  },
  bubbles() {
    for (let i = 0; i < 4; i++) {
      const f = rnd(400, 900)
      tone({ from: f, to: f * 2, start: i * 0.07, dur: 0.08, gain: 0.03 })
    }
  },
  alert() {
    tone({ from: 880, to: 1320, dur: 0.1, gain: 0.06, type: 'square' })
    tone({ from: 1320, start: 0.1, dur: 0.15, gain: 0.05, type: 'square' })
  },
  hmm() {
    tone({ from: 300, to: 380, dur: 0.25, gain: 0.05, type: 'triangle', vib: [8, 10] })
  },
  found() {
    ;[784, 988, 1175, 1568].forEach((f, i) => tone({ from: f, start: i * 0.07, dur: 0.3, gain: 0.07, type: 'triangle' }))
    noise({ dur: 0.4, gain: 0.03, filter: 'highpass', freqFrom: 4000 })
  },
  giggle() {
    const p = rnd(700, 1000)
    ;[0, 0.08, 0.16].forEach((t, i) => tone({ from: p * (i === 1 ? 1.15 : 1), start: t, dur: 0.06, gain: 0.035, vib: [30, 20] }))
  },
  win() {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319]
    notes.forEach((f, i) => tone({ from: f, start: i * 0.12, dur: i === notes.length - 1 ? 0.7 : 0.18, gain: 0.08, type: 'triangle' }))
    notes.forEach((f, i) => tone({ from: f / 2, start: i * 0.12, dur: 0.15, gain: 0.04 }))
  },
  lose() {
    ;[523, 494, 466, 440].forEach((f, i) =>
      tone({ from: f, to: i === 3 ? 400 : f, start: i * 0.25, dur: i === 3 ? 0.8 : 0.24, gain: 0.07, type: 'triangle', vib: i === 3 ? [6, 12] : undefined }),
    )
  },
  // Character voices (Space key).
  whale() {
    tone({ from: 220, to: 440, dur: 0.6, gain: 0.08, vib: [5, 15] })
    tone({ from: 440, to: 330, start: 0.55, dur: 0.6, gain: 0.07, vib: [5, 15] })
    noise({ start: 0.1, dur: 0.6, gain: 0.04, filter: 'bandpass', freqFrom: 800, freqTo: 2500, attack: 0.1 })
  },
  sponge() {
    ;[0, 0.11, 0.22, 0.33].forEach((t, i) => tone({ from: 900 - i * 60, to: 1300 - i * 80, start: t, dur: 0.08, gain: 0.05, type: 'square' }))
  },
  bear() {
    const p = rnd(650, 1100)
    tone({ from: p, to: p * 1.7, dur: 0.07, gain: 0.07, type: 'triangle' })
    tone({ from: p * 1.7, to: p * 1.2, start: 0.07, dur: 0.09, gain: 0.06, type: 'triangle' })
    tone({ from: 520, to: 1050, start: 0.2, dur: 0.35, gain: 0.04, vib: [9, 25] })
  },
  // Easter eggs.
  chest() {
    ;[1047, 1319, 1568, 2093, 1568, 2093, 2637].forEach((f, i) => tone({ from: f, start: i * 0.07, dur: 0.2, gain: 0.05, type: 'triangle' }))
  },
  duck() {
    tone({ from: 900, to: 1400, dur: 0.08, gain: 0.08, type: 'square' })
    tone({ from: 1400, to: 800, start: 0.08, dur: 0.12, gain: 0.06, type: 'square' })
  },
  boing() {
    tone({ from: 200, to: 600, dur: 0.25, gain: 0.07, vib: [18, 60] })
  },
  flip() {
    tone({ from: 400, to: 1600, dur: 0.35, gain: 0.06, type: 'triangle' })
    tone({ from: 1600, to: 1200, start: 0.35, dur: 0.2, gain: 0.05, type: 'triangle' })
  },
  sub() {
    tone({ from: 1000, dur: 0.12, gain: 0.05, type: 'square' })
    tone({ from: 1500, start: 0.18, dur: 0.12, gain: 0.05, type: 'square' })
  },
  whaleSong() {
    tone({ from: 120, to: 260, dur: 1.4, gain: 0.08, vib: [3, 8] })
    tone({ from: 260, to: 160, start: 1.3, dur: 1.6, gain: 0.07, vib: [3, 8] })
    tone({ from: 300, to: 520, start: 0.6, dur: 1.2, gain: 0.03, vib: [4, 10] })
  },
}

// ---------- Background music: a soft music-box melody over slow bass notes ----------

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]
const CHORDS = [0, -3, -7, -5] // I - vi - IV - V
let musicTimer = 0
let nextT = 0
let step = 0
let mel = 4
let mode = 'calm'

export function setMusicMode(m) {
  mode = m
}

export function startMusic() {
  const c = ac()
  if (!c || musicTimer) return
  nextT = c.currentTime + 0.1
  musicTimer = setInterval(() => {
    while (nextT < c.currentTime + 0.25) {
      playStep(nextT)
      nextT += mode === 'tense' ? 0.24 : 0.34
      step++
    }
  }, 60)
}

function playStep(t) {
  const base = 261.6 // C4
  const chord = CHORDS[Math.floor(step / 8) % 4]
  if (step % 8 === 0) {
    tone({ at: t, from: (base / 2) * 2 ** (chord / 12), dur: 2.2, gain: 0.06, dest: musicBus })
    tone({ at: t, from: (base / 2) * 2 ** ((chord + 7) / 12), dur: 2.2, gain: 0.025, dest: musicBus })
  }
  if (Math.random() < (mode === 'tense' ? 0.55 : 0.7)) {
    mel = Math.max(0, Math.min(SCALE.length - 1, mel + Math.floor(Math.random() * 5) - 2))
    const f = base * 2 ** ((SCALE[mel] + chord + 12) / 12)
    tone({ at: t, from: f, dur: 0.5, gain: 0.03, type: 'triangle', dest: musicBus })
    tone({ at: t, from: f * 2, dur: 0.25, gain: 0.008, dest: musicBus })
  }
  if (mode === 'tense' && step % 2 === 0) {
    tone({ at: t, from: step % 4 === 0 ? 110 : 98, dur: 0.18, gain: 0.04, dest: musicBus })
  }
}
