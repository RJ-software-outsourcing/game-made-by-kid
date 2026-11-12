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
  ghost: () => {
    tone({ type: 'sine', f: 320, f2: 640, dur: 0.6, gain: 0.12 })
    tone({ type: 'sine', f: 640, f2: 420, at: 0.5, dur: 0.6, gain: 0.08 })
    noise({ dur: 0.9, gain: 0.06, type: 'bandpass', f: 600, f2: 1400, q: 3 })
  },
  boo: () => {
    tone({ type: 'triangle', f: 520, f2: 780, dur: 0.18, gain: 0.12 })
    tone({ type: 'triangle', f: 660, f2: 990, at: 0.16, dur: 0.22, gain: 0.12 })
  },
  whale: () => {
    tone({ type: 'sine', f: 180, f2: 420, dur: 1.2, gain: 0.12 })
    tone({ type: 'sine', f: 420, f2: 260, at: 1.1, dur: 1.4, gain: 0.1 })
  },
  horn: () => {
    tone({ type: 'sawtooth', f: 110, dur: 1.3, gain: 0.08 })
    tone({ type: 'sawtooth', f: 138, dur: 1.3, gain: 0.06 })
  },
  bubbles: () => {
    for (let i = 0; i < 8; i++) tone({ type: 'sine', f: 300 + Math.random() * 500, f2: 900 + Math.random() * 600, at: i * 0.09, dur: 0.08, gain: 0.08 })
  },
  click: () => {
    for (let i = 0; i < 6; i++) tone({ type: 'square', f: 2200 + (i % 2) * 400, at: i * 0.05, dur: 0.02, gain: 0.04 })
  },
  plane: () => noise({ dur: 3, gain: 0.07, type: 'bandpass', f: 180, f2: 260, q: 4 }),
  ufo: () => {
    const c = ac()
    if (!c) return
    for (let i = 0; i < 4; i++) tone({ type: 'sine', f: 600, f2: 900, at: i * 0.35, dur: 0.18, gain: 0.08 })
    for (let i = 0; i < 4; i++) tone({ type: 'sine', f: 900, f2: 600, at: i * 0.35 + 0.17, dur: 0.18, gain: 0.08 })
  },
  beam: () => tone({ type: 'triangle', f: 200, f2: 1600, dur: 1.6, gain: 0.08 }),
  knock: () => {
    for (let i = 0; i < 3; i++) noise({ at: i * 0.18, dur: 0.07, gain: 0.35, type: 'lowpass', f: 600, f2: 300, q: 2 })
  },
  door: () => tone({ type: 'sawtooth', f: 140, f2: 210, dur: 0.5, gain: 0.04 }),
  // graveyard ambience
  howl: () => noise({ dur: 3.2, gain: 0.07, type: 'bandpass', f: 300, f2: 900, q: 8 }),
  bell: () => {
    for (const [f, g] of [[110, 0.12], [220, 0.05], [277, 0.03]]) tone({ type: 'sine', f, dur: 3.5, gain: g })
  },
  creak: () => tone({ type: 'sawtooth', f: 120, f2: 190, dur: 0.7, gain: 0.035 }),
  rattle: () => {
    for (let i = 0; i < 6; i++) noise({ at: i * 0.06, dur: 0.05, gain: 0.18, type: 'bandpass', f: 2400 + (i % 2) * 600, q: 6 })
  },
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
const SONGS = {
  happy: {
    chords: [
      [262, 330, 392],
      [220, 262, 330],
      [175, 220, 262],
      [196, 247, 294],
    ],
    melody: [523, 587, 659, 784, 659, 587, 523, 440, 523, 659, 784, 880, 784, 659, 587, 523],
  },
  // spooky: slow minor chords with a creepy music-box tune full of odd jumps
  spooky: {
    chords: [
      [110, 131, 165],
      [117, 139, 165],
      [104, 131, 156],
      [98, 117, 139],
    ],
    melody: [880, 0, 0, 831, 0, 622, 0, 0, 880, 932, 0, 0, 659, 0, 622, 0],
  },
}
let song = SONGS.happy
let mood = 'happy'
// A low, slowly beating drone and a howling wind under the spooky tune.
let drone = null
export function setMood(m) {
  if (m === mood || !SONGS[m]) return
  mood = m
  song = SONGS[m]
  const c = ctx
  if (!c) return
  if (m === 'spooky' && !drone) {
    const g = c.createGain()
    g.gain.value = 0.0001
    g.gain.exponentialRampToValueAtTime(0.5, c.currentTime + 2)
    g.connect(music)
    const oscs = [55, 58.3, 82.4].map((f, i) => {
      const o = c.createOscillator()
      o.type = i === 2 ? 'triangle' : 'sine'
      o.frequency.value = f
      const og = c.createGain()
      og.gain.value = i === 2 ? 0.15 : 0.45
      o.connect(og).connect(g)
      o.start()
      return o
    })
    if (!noiseBuf) noise({ dur: 0.01, gain: 0.0001 })
    const wind = c.createBufferSource()
    wind.buffer = noiseBuf
    wind.loop = true
    const wf = c.createBiquadFilter()
    wf.type = 'bandpass'
    wf.frequency.value = 400
    wf.Q.value = 5
    const lfo = c.createOscillator()
    lfo.frequency.value = 0.13
    const lg = c.createGain()
    lg.gain.value = 250
    lfo.connect(lg).connect(wf.frequency)
    const wg = c.createGain()
    wg.gain.value = 0.25
    wind.connect(wf).connect(wg).connect(g)
    wind.start()
    lfo.start()
    drone = { g, stop: [...oscs, wind, lfo] }
  } else if (m !== 'spooky' && drone) {
    const d = drone
    drone = null
    d.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.6)
    setTimeout(() => d.stop.forEach((o) => o.stop()), 3000)
  }
}
let spookyT = 0

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
    const ch = song.chords[bar]
    if (beat % 2 === 0) pluck(ch[(beat / 2) % 3] / 2, nextTime, 0.5)
    if (beat % 4 === 2) for (const f of ch) pluck(f, nextTime, 0.18)
    const m = song.melody[(beat / 2) % 16]
    if (beat % 2 === 0 && m && (mood === 'spooky' || Math.floor(beat / 32) % 2 === 1)) pluck(m, nextTime, 0.22)
    nextTime += mood === 'spooky' ? spb * 1.7 : spb
    beat++
    if (mood === 'spooky' && !muted) {
      spookyT--
      if (spookyT <= 0) {
        spookyT = 14 + Math.floor(Math.random() * 14)
        const f = ['howl', 'bell', 'creak', 'hoot'][Math.floor(Math.random() * 4)]
        SFX[f]()
      }
    }
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
// Read a line aloud. { kid: true } is Coji: a young, bright voice.
export function speak(text, { kid = false } = {}) {
  if (!('speechSynthesis' in window) || muted) return
  const clean = text.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim()
  if (!clean) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(clean)
  if (!voiceCache) {
    const vs = speechSynthesis.getVoices()
    // a light voice sounds most like a kid once the pitch is raised
    voiceCache = vs.find((v) => /en/i.test(v.lang) && /Junior|Kid|Child/i.test(v.name)) || vs.find((v) => /en-US/i.test(v.lang) && /Samantha|Ava|Allison|Google US|Aria|Jenny/i.test(v.name)) || vs.find((v) => /^en/i.test(v.lang)) || null
  }
  if (voiceCache) u.voice = voiceCache
  u.lang = 'en-US'
  u.rate = kid ? 1.02 : 0.88
  u.pitch = kid ? 1.75 : 1
  u.volume = 0.9
  speechSynthesis.speak(u)
}
