// All sounds are made with Web Audio: no files to download.
let ctx = null
let master = null
let music = null
let muted = false
try {
  muted = localStorage.getItem('coji-muted') === '1'
} catch {
  // storage blocked: sound on
}

function ac() {
  if (!('AudioContext' in window || 'webkitAudioContext' in window)) return null
  try {
    if (!ctx) {
      try {
        // Safari: play even when the ringer switch is on silent.
        if (navigator.audioSession) navigator.audioSession.type = 'playback'
      } catch {
        // not supported
      }
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      master = ctx.createGain()
      master.gain.value = muted ? 0 : 0.8
      master.connect(ctx.destination)
      music = ctx.createGain()
      music.gain.value = 0.16
      music.connect(master)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && ctx.state !== 'running') ctx.resume()
      })
    }
    if (ctx.state !== 'running') ctx.resume()
    return ctx
  } catch {
    return null
  }
}

// Call on every tap: iPad only plays sound after a touch.
export function unlock() {
  ac()
}
export const isMuted = () => muted
export function setMuted(m) {
  muted = m
  try {
    localStorage.setItem('coji-muted', m ? '1' : '0')
  } catch {
    // ignore
  }
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05)
  if ('speechSynthesis' in window && m) speechSynthesis.cancel()
}

function tone({ type = 'sine', f, f2 = f, at = 0, dur = 0.15, gain = 0.2, dest }) {
  const c = ac()
  if (!c) return
  const t0 = c.currentTime + at
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(f, t0)
  if (f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur / 3))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g).connect(dest || master)
  o.start(t0)
  o.stop(t0 + dur + 0.05)
}

let noiseBuf = null
function noise({ at = 0, dur = 0.2, gain = 0.2, type = 'lowpass', f = 800, f2 = f, q = 1 }) {
  const c = ac()
  if (!c) return
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t0 = c.currentTime + at
  const s = c.createBufferSource()
  s.buffer = noiseBuf
  const fl = c.createBiquadFilter()
  fl.type = type
  fl.Q.value = q
  fl.frequency.setValueAtTime(f, t0)
  fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  s.connect(fl).connect(g).connect(master)
  s.start(t0)
  s.stop(t0 + dur + 0.05)
}

const SFX = {
  tap: () => tone({ type: 'sine', f: 660, f2: 880, dur: 0.07, gain: 0.08 }),
  walk: () => tone({ type: 'triangle', f: 520, f2: 700, dur: 0.08, gain: 0.07 }),
  nope: () => {
    tone({ type: 'square', f: 300, f2: 220, dur: 0.12, gain: 0.05 })
    tone({ type: 'square', f: 260, f2: 190, at: 0.12, dur: 0.16, gain: 0.05 })
  },
  pick: () => {
    tone({ type: 'triangle', f: 880, dur: 0.08, gain: 0.15 })
    tone({ type: 'triangle', f: 1320, at: 0.07, dur: 0.12, gain: 0.13 })
  },
  coin: () => {
    tone({ type: 'square', f: 988, dur: 0.07, gain: 0.07 })
    tone({ type: 'square', f: 1319, at: 0.07, dur: 0.22, gain: 0.07 })
  },
  eat: () => {
    for (let i = 0; i < 3; i++) noise({ at: i * 0.13, dur: 0.08, gain: 0.25, type: 'bandpass', f: 1600, f2: 900, q: 2 })
  },
  drink: () => {
    for (let i = 0; i < 3; i++) tone({ type: 'sine', f: 380 + i * 40, f2: 760 + i * 60, at: i * 0.16, dur: 0.12, gain: 0.16 })
  },
  open: () => tone({ type: 'sine', f: 520, f2: 780, dur: 0.12, gain: 0.1 }),
  close: () => tone({ type: 'sine', f: 700, f2: 480, dur: 0.12, gain: 0.08 }),
  choice: () => tone({ type: 'triangle', f: 740, f2: 990, dur: 0.1, gain: 0.12 }),
  clue: () => {
    ;[1047, 1319, 1568, 2093].forEach((f, i) => tone({ type: 'sine', f, at: i * 0.07, dur: 0.25, gain: 0.1 }))
  },
  quest: () => {
    ;[523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.11, dur: 0.3, gain: 0.15 }))
    tone({ type: 'triangle', f: 1047, at: 0.5, dur: 0.6, gain: 0.12 })
  },
  step: () => {
    ;[784, 988, 1175].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.09, dur: 0.22, gain: 0.13 }))
  },
  happy: () => {
    ;[659, 784, 988, 1319].forEach((f, i) => tone({ type: 'sine', f, at: i * 0.08, dur: 0.2, gain: 0.14 }))
  },
  growl: () => {
    noise({ dur: 0.6, gain: 0.35, type: 'lowpass', f: 300, f2: 120, q: 4 })
    tone({ type: 'sawtooth', f: 80, f2: 60, dur: 0.6, gain: 0.08 })
  },
  meow: () => tone({ type: 'sine', f: 700, f2: 1100, dur: 0.35, gain: 0.14 }),
  hoot: () => {
    tone({ type: 'sine', f: 420, f2: 380, dur: 0.25, gain: 0.18 })
    tone({ type: 'sine', f: 420, f2: 360, at: 0.32, dur: 0.35, gain: 0.18 })
  },
  hop: () => tone({ type: 'sine', f: 500, f2: 1200, dur: 0.12, gain: 0.12 }),
  rest: () => {
    ;[392, 330, 262].forEach((f, i) => tone({ type: 'sine', f, at: i * 0.18, dur: 0.4, gain: 0.1 }))
  },
  finale: () => {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319, 1568]
    notes.forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.14, dur: 0.4, gain: 0.14 }))
    ;[523, 659, 784].forEach((f) => tone({ type: 'sine', f, at: 1.2, dur: 1.6, gain: 0.1 }))
  },
  boom: () => noise({ dur: 0.7, gain: 0.25, type: 'lowpass', f: 900, f2: 80, q: 1 }),
}

export function sfx(name) {
  if (muted) return
  SFX[name]?.()
}

// A short "voice" blip when a character talks (pitch by character).
export function voice(pitch = 1) {
  if (muted) return
  const base = 330 * pitch
  tone({ type: 'triangle', f: base, f2: base * (1.1 + Math.random() * 0.3), dur: 0.07, gain: 0.07 })
}

// ---------- background tune: a gentle ukulele-like loop ----------
let musicOn = false
let nextTime = 0
let beat = 0
let timer = null
const CHORDS = [
  [262, 330, 392],
  [220, 262, 330],
  [175, 220, 262],
  [196, 247, 294],
]
const MELODY = [523, 587, 659, 784, 659, 587, 523, 440, 523, 659, 784, 880, 784, 659, 587, 523]

function pluck(f, t, gain) {
  const c = ctx
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = 'triangle'
  o.frequency.value = f
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
  o.connect(g).connect(music)
  o.start(t)
  o.stop(t + 0.55)
}

function schedule() {
  const c = ctx
  if (!c) return
  const spb = 60 / 100 / 2
  while (nextTime < c.currentTime + 0.4) {
    const bar = Math.floor(beat / 8) % 4
    const ch = CHORDS[bar]
    if (beat % 2 === 0) pluck(ch[(beat / 2) % 3] / 2, nextTime, 0.5)
    if (beat % 4 === 2) for (const f of ch) pluck(f, nextTime, 0.18)
    if (beat % 2 === 0 && Math.floor(beat / 32) % 2 === 1) pluck(MELODY[(beat / 2) % 16], nextTime, 0.22)
    nextTime += spb
    beat++
  }
}

export function startMusic() {
  const c = ac()
  if (!c || musicOn) return
  musicOn = true
  nextTime = c.currentTime + 0.1
  timer = setInterval(schedule, 120)
}
export function stopMusic() {
  musicOn = false
  clearInterval(timer)
}

// ---------- read aloud (only when the 🔊 button is pressed) ----------
let voiceCache = null
export function speak(text, pitch = 1) {
  if (!('speechSynthesis' in window)) return
  const clean = text.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim()
  if (!clean) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(clean)
  if (!voiceCache) {
    const vs = speechSynthesis.getVoices()
    voiceCache = vs.find((v) => /en-US/i.test(v.lang) && /Samantha|Google US|Aria|Jenny/i.test(v.name)) || vs.find((v) => /^en/i.test(v.lang)) || null
  }
  if (voiceCache) u.voice = voiceCache
  u.lang = 'en-US'
  u.rate = 0.85
  u.pitch = Math.max(0.5, Math.min(1.8, pitch))
  speechSynthesis.speak(u)
}
