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

// A made-up room echo: stereo noise fading out over `sec` seconds.
function roomIR(c, sec) {
  const n = Math.floor(c.sampleRate * sec)
  const b = c.createBuffer(2, n, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch)
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2)
  }
  return b
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
      // a soft room reverb on the music only: it glues the notes together so the tune sounds smooth
      try {
        const verb = ctx.createConvolver()
        verb.buffer = roomIR(ctx, 1.8)
        const wet = ctx.createGain()
        wet.gain.value = 0.32
        music.connect(verb).connect(wet).connect(master)
      } catch {
        // no reverb: the music still plays dry
      }
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
  pickVoice()
  // iPad: speech only works after it was started once from a tap, so start a silent one now (then
  // people can greet Coji and the knights can shout later, without a tap)
  if (!speechPrimed && 'speechSynthesis' in window) {
    speechPrimed = true
    try {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      speechSynthesis.speak(u)
    } catch {
      // no speech
    }
  }
}
let speechPrimed = false
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
// one second of white noise, made once
function noiseBuffer(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}
function noise({ at = 0, dur = 0.2, gain = 0.2, type = 'lowpass', f = 800, f2 = f, q = 1 }) {
  const c = ac()
  if (!c) return
  const t0 = c.currentTime + at
  const s = c.createBufferSource()
  s.buffer = noiseBuffer(c)
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

// ---------- background tune: a smooth, sunny island song ----------
// 16 bars in C major at a relaxed 92 beats a minute, all made with oscillators:
// - soft sustained chords that fade into each other (no gaps between bars)
// - a warm bass on beats 1 and 3, and a gentle broken-chord ripple in eighth notes
// - a singable melody on a soft mallet (A part, then B part), a flute on every other time round
// - a quiet shaker for a little swing
// Everything goes through a soft reverb. Notes are planned a little ahead on the audio clock; if
// the page was busy for a moment, the missed notes are skipped (never played all at once).
let musicOn = false
let nextTime = 0
let timer = null
const SONGS = { happy: true, spooky: true }
let mood = 'happy'
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12)
// chords: [bass note, pad notes...] (MIDI numbers), one per bar
const CH = {
  C: [48, 60, 64, 67],
  Am: [45, 57, 60, 64],
  F: [53, 57, 60, 65],
  G: [55, 55, 59, 62],
  Dm: [50, 57, 62, 65],
  Em: [52, 55, 59, 64],
}
const BARS = ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G', 'F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C']
// melody per bar: [eighth-note step, MIDI note, length in eighths]
const MELODY = [
  [[0, 76, 2], [2, 79, 2], [4, 84, 2], [6, 79, 2]],
  [[0, 81, 3], [3, 79, 1], [4, 76, 4]],
  [[0, 77, 2], [2, 81, 2], [4, 84, 2], [6, 81, 2]],
  [[0, 79, 4], [4, 74, 2], [6, 71, 2]],
  [[0, 76, 1], [1, 76, 1], [2, 79, 2], [4, 84, 2], [6, 83, 1], [7, 81, 1]],
  [[0, 81, 2], [2, 76, 2], [4, 72, 4]],
  [[0, 74, 2], [2, 77, 2], [4, 81, 2], [6, 77, 2]],
  [[0, 79, 6]],
  [[0, 81, 2], [2, 81, 1], [3, 79, 1], [4, 77, 2], [6, 81, 2]],
  [[0, 83, 2], [2, 83, 1], [3, 81, 1], [4, 79, 4]],
  [[0, 79, 2], [2, 76, 2], [4, 71, 2], [6, 76, 2]],
  [[0, 84, 6], [6, 83, 2]],
  [[0, 81, 2], [2, 84, 2], [4, 81, 2], [6, 77, 2]],
  [[0, 79, 2], [2, 83, 2], [4, 86, 2], [6, 83, 2]],
  [[0, 84, 4], [4, 79, 2], [6, 76, 2]],
  [[0, 72, 6]],
]
const ARP = [0, 1, 2, 3, 2, 1, 2, 3]
const EIGHTH = 60 / 92 / 2
let hStep = 0

// soft sustained chord: two slightly detuned oscillators per note, slow fade in and out
function pad(notes, t, dur) {
  const c = ctx
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1300
  const g = c.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.11, t + 0.45)
  g.gain.setValueAtTime(0.11, t + dur)
  g.gain.linearRampToValueAtTime(0, t + dur + 1.0)
  lp.connect(g).connect(music)
  for (const m of notes)
    for (const d of [-6, 6]) {
      const o = c.createOscillator()
      o.type = 'triangle'
      o.frequency.value = midi(m)
      o.detune.value = d
      o.connect(lp)
      o.start(t)
      o.stop(t + dur + 1.05)
    }
}
// round, warm bass
function bass(m, t, dur, gain = 0.5) {
  const c = ctx
  const o = c.createOscillator()
  o.type = 'triangle'
  o.frequency.value = midi(m)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 600
  const g = c.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.02)
  g.gain.setTargetAtTime(gain * 0.45, t + 0.03, dur * 0.5)
  g.gain.setTargetAtTime(0, t + dur, 0.08)
  o.connect(lp).connect(g).connect(music)
  o.start(t)
  o.stop(t + dur + 0.5)
}
// a soft mallet (like a marimba): a pure tone with a little sparkle on top, ringing out gently
function mallet(m, t, len, gain) {
  const c = ctx
  const f = midi(m)
  const ring = 0.25 + len * 0.18
  for (const [mul, k, tc] of [
    [1, 1, ring],
    [2, 0.22, ring * 0.5],
    [4, 0.06, 0.08],
  ]) {
    const o = c.createOscillator()
    o.frequency.value = f * mul
    const g = c.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain * k, t + 0.008)
    g.gain.setTargetAtTime(0, t + 0.01, tc)
    o.connect(g).connect(music)
    o.start(t)
    o.stop(t + tc * 6 + 0.05)
  }
}
// a breathy flute: slow attack, held, with a gentle vibrato
function flute(m, t, dur, gain) {
  const c = ctx
  const o = c.createOscillator()
  o.frequency.value = midi(m)
  const vib = c.createOscillator()
  vib.frequency.value = 5
  const vg = c.createGain()
  vg.gain.setValueAtTime(0, t)
  vg.gain.linearRampToValueAtTime(midi(m) * 0.006, t + 0.35)
  vib.connect(vg).connect(o.frequency)
  const g = c.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.07)
  g.gain.setValueAtTime(gain, t + Math.max(0.08, dur - 0.05))
  g.gain.linearRampToValueAtTime(0, t + dur + 0.18)
  o.connect(g).connect(music)
  for (const n of [o, vib]) {
    n.start(t)
    n.stop(t + dur + 0.25)
  }
}
function shaker(t, gain) {
  const c = ctx
  const s = c.createBufferSource()
  s.buffer = noiseBuffer(c)
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 7000
  const g = c.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.004)
  g.gain.setTargetAtTime(0, t + 0.006, 0.025)
  s.connect(hp).connect(g).connect(music)
  s.start(t, Math.random() * 0.5)
  s.stop(t + 0.15)
}

function scheduleHappy(c) {
  // fell behind (the page was busy or in the background)? skip the missed notes, don't bunch them up
  if (nextTime < c.currentTime) {
    const missed = Math.ceil((c.currentTime - nextTime) / EIGHTH)
    hStep += missed
    nextTime += missed * EIGHTH
  }
  while (nextTime < c.currentTime + 0.6) {
    const t = nextTime
    const step = hStep % 8
    const barN = Math.floor(hStep / 8)
    const bar = barN % 16
    const round = Math.floor(barN / 16)
    const ch = CH[BARS[bar]]
    if (step === 0) {
      pad(ch.slice(1), t, EIGHTH * 8)
      bass(ch[0], t, EIGHTH * 3.5)
    }
    if (step === 4) bass(bar % 4 === 3 ? ch[0] + 7 : ch[0], t, EIGHTH * 3.5, 0.4)
    // the ripple: quiet broken chords, a little louder when the melody rests
    const arpTone = ch[1 + (ARP[step] % 3)] + (ARP[step] === 3 ? 12 : 0) + 12
    mallet(arpTone, t, 1, round % 2 === 1 && bar < 8 ? 0.11 : 0.06)
    if (step % 2 === 1) shaker(t, step === 3 || step === 7 ? 0.05 : 0.03)
    // the tune: every time round on the B part; the A part every other time (flute or mallet)
    if (round % 2 === 0 || bar >= 8)
      for (const [st, m, len] of MELODY[bar])
        if (st === step) {
          if (round % 2 === 1) flute(m - 12, t, len * EIGHTH, 0.2)
          else mallet(m, t, len, 0.3)
        }
    nextTime += EIGHTH
    hStep++
  }
}
// A low, slowly beating drone and a howling wind under the spooky tune.
let drone = null
export function setMood(m) {
  if (m === mood || !SONGS[m]) return
  mood = m
  sBeat = 0
  hStep = 0
  scareT = 24
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
    const wind = c.createBufferSource()
    wind.buffer = noiseBuffer(c)
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
    // a wailing "theremin" that glides between eerie notes (moved by the spooky scheduler)
    const th = c.createOscillator()
    th.type = 'sine'
    th.frequency.value = 880
    const vib = c.createOscillator()
    vib.frequency.value = 5.5
    const vg = c.createGain()
    vg.gain.value = 9
    vib.connect(vg).connect(th.frequency)
    const tg = c.createGain()
    tg.gain.value = 0.0001
    th.connect(tg).connect(music)
    th.start()
    vib.start()
    drone = { g, stop: [...oscs, wind, lfo, th, vib], theremin: th, thereminGain: tg }
  } else if (m !== 'spooky' && drone) {
    const d = drone
    drone = null
    d.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.6)
    d.thereminGain.gain.setTargetAtTime(0.0001, c.currentTime, 0.3)
    setTimeout(() => d.stop.forEach((o) => o.stop()), 3000)
  }
}

// ---------- the spooky graveyard: crazy, creepy and fast ----------
// A pounding heartbeat, a chromatic bass that creeps up and down, organ stabs on dissonant chords,
// a wailing theremin, a wonky music box, wild organ runs, a tempo that speeds up and snaps back,
// and every so often a sudden scare (a loud stab with a whoosh and a howl or a bell).
const A2 = 110
const semis = (f, n) => f * Math.pow(2, n / 12)
const SPOOK_BASS = [0, 0, 12, 0, 1, 0, 6, 0, 0, 0, 12, 0, -1, 0, 6, 5]
const SPOOK_BOX = [1760, 0, 2093, 1976, 0, 1480, 0, 1245, 1760, 0, 2489, 0, 2349, 0, 1480, 0]
const SPOOK_CHORDS = [
  [0, 3, 6, 9],
  [1, 4, 7, 10],
  [-1, 2, 5, 8],
  [0, 3, 6, 11],
]
const THEREMIN = [880, 1047, 1245, 1480, 1760, 1661, 1319]
let sBeat = 0
let scareT = 40

function saw(f, t, dur, gain, cut0, cut1, type = 'sawtooth') {
  const c = ctx
  const fl = c.createBiquadFilter()
  fl.type = 'lowpass'
  fl.Q.value = 6
  fl.frequency.setValueAtTime(cut0, t)
  fl.frequency.exponentialRampToValueAtTime(cut1, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  fl.connect(g).connect(music)
  for (const d of [-7, 7]) {
    const o = c.createOscillator()
    o.type = type
    o.frequency.value = f
    o.detune.value = d
    o.connect(fl)
    o.start(t)
    o.stop(t + dur + 0.05)
  }
}
function thump(t, gain) {
  const c = ctx
  const o = c.createOscillator()
  const g = c.createGain()
  o.frequency.setValueAtTime(120, t)
  o.frequency.exponentialRampToValueAtTime(42, t + 0.16)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
  o.connect(g).connect(music)
  o.start(t)
  o.stop(t + 0.25)
}
function scheduleSpooky(c) {
  while (nextTime < c.currentTime + 0.4) {
    const t = nextTime
    const step = sBeat % 16 // eighth notes, two bars
    const bar = Math.floor(sBeat / 8)
    const phrase = bar % 8
    // heartbeat: lub-dub on every bar
    if (sBeat % 8 === 0) thump(t, 1.1)
    if (sBeat % 8 === 1) thump(t, 0.7)
    // creeping chromatic bass, shifted down a step every other phrase
    const shift = Math.floor(bar / 8) % 2 ? -2 : 0
    saw(semis(A2, SPOOK_BASS[step] + shift), t, 0.2, 0.32, 900, 140)
    // organ stab on dissonant chords
    if (sBeat % 8 === 0) {
      const ch = SPOOK_CHORDS[Math.floor(bar / 2) % 4]
      for (const n of ch) saw(semis(220, n + shift), t, phrase % 2 ? 0.5 : 1.3, 0.09, 2600, 400)
    }
    // the music box plays every other two bars, a little out of tune
    if (Math.floor(bar / 2) % 2 === 1 && SPOOK_BOX[step]) saw(SPOOK_BOX[step] * (1 + (Math.random() - 0.5) * 0.012), t, 0.45, 0.07, 6000, 3000, 'triangle')
    // wild organ runs at the end of a phrase: up, then down
    if (phrase === 7) {
      const dir = Math.floor(bar / 8) % 2 ? -1 : 1
      for (let k = 0; k < 2; k++) saw(semis(440, dir * ((step % 8) * 2 + k)), t + k * spookStep() * 0.5, 0.14, 0.08, 4000, 900, 'square')
    }
    // the theremin glides to a new note each bar and swells in and out
    if (drone && sBeat % 8 === 0) {
      const f = THEREMIN[Math.floor(Math.random() * THEREMIN.length)]
      drone.theremin.frequency.setTargetAtTime(f, t, 0.18)
      drone.thereminGain.gain.setTargetAtTime(phrase % 4 === 3 ? 0.0001 : 0.09, t, 0.4)
    }
    nextTime += spookStep()
    sBeat++
    if (!muted && --scareT <= 0) {
      scareT = 70 + Math.floor(Math.random() * 60)
      // a sudden scare
      for (const n of [0, 1, 6, 7]) saw(semis(110, n), nextTime, 1.6, 0.16, 5000, 200)
      noise({ at: nextTime - c.currentTime, dur: 0.9, gain: 0.25, type: 'bandpass', f: 300, f2: 3000, q: 2 })
      const f = ['howl', 'bell', 'creak', 'hoot'][Math.floor(Math.random() * 4)]
      setTimeout(() => SFX[f](), Math.max(0, (nextTime - c.currentTime) * 1000 + 400))
    }
  }
}
// eighth-note length: the tempo speeds up through each 8-bar phrase, then snaps back
function spookStep() {
  const phrase = Math.floor(sBeat / 8) % 8
  return 60 / (132 + phrase * 9) / 2
}

function schedule() {
  const c = ctx
  if (!c) return
  if (mood === 'spooky') {
    if (nextTime < c.currentTime) nextTime = c.currentTime + 0.05
    return scheduleSpooky(c)
  }
  scheduleHappy(c)
}

export function startMusic() {
  const c = ac()
  if (!c || musicOn) return
  musicOn = true
  nextTime = c.currentTime + 0.1
  timer = setInterval(schedule, 100)
}
export function stopMusic() {
  musicOn = false
  clearInterval(timer)
}

// ---------- read aloud (only when the 🔊 button is pressed) ----------
// Coji's voice. The browser's voice list loads a moment after the page starts, so it is fetched early
// (and again when it changes) and one cute voice is chosen and kept for the whole game. Before that
// first choice is ready, Coji waits a moment instead of speaking in the default (deep) voice.
// Best first: real child voices, then young, bright voices; each with its own gentle pitch.
const KID_VOICES = [
  [/\bAna\b.*(Online|Natural)/i, 1.05, 1.0], // Edge: a child's voice
  [/Nicky/i, 1.3, 1.02],
  [/Samantha/i, 1.38, 1.02],
  [/Google US English/i, 1.32, 1.02],
  [/Ava|Allison|Susan|Zoe|Joelle|Aria|Jenny|Michelle/i, 1.32, 1.02],
  [/Karen|Tessa|Moira|Fiona|Kate|Serena|Catherine/i, 1.32, 1.0],
]
// funny or robotic voices are never picked (including the old computer voices Junior and Kathy)
const SKIP_VOICES = /Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Grandma|Grandpa|Rocko|Shelley|Flo|Eddy|Reed|Sandy|Fred|Ralph|Junior|Kathy|Princess|Victoria|Vicki|Agnes|Bruce/i
let kidVoice = null
let voiceLocked = false
function pickVoice() {
  if (!('speechSynthesis' in window) || voiceLocked) return !!kidVoice
  const vs = speechSynthesis.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang) && !SKIP_VOICES.test(v.name))
  if (!vs.length) return false
  for (const [re, pitch, rate] of KID_VOICES) {
    const v = vs.find((x) => re.test(x.name) && /en[-_]US/i.test(x.lang)) || vs.find((x) => re.test(x.name))
    if (v) {
      kidVoice = { v, pitch, rate }
      return true
    }
  }
  const v = vs.find((x) => /en[-_]US/i.test(x.lang)) || vs[0]
  kidVoice = { v, pitch: 1.3, rate: 1.0 }
  return true
}
if ('speechSynthesis' in window) {
  pickVoice()
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice)
}

let waitT = null
// Read a line aloud. { kid: true } is Coji.
export function speak(text, { kid = false } = {}) {
  if (!('speechSynthesis' in window) || muted) return
  const clean = text.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim()
  if (!clean) return
  clearTimeout(waitT)
  if (kid && !pickVoice()) {
    // the voices are not loaded yet: wait a little (up to ~1 s), then speak
    let tries = 0
    const again = () => {
      if (pickVoice() || ++tries > 8) say(clean, kid)
      else waitT = setTimeout(again, 120)
    }
    waitT = setTimeout(again, 120)
    return
  }
  say(clean, kid)
}
function say(clean, kid) {
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(clean)
  u.lang = 'en-US'
  if (kid && kidVoice) {
    voiceLocked = true // the same voice from now on
    u.voice = kidVoice.v
    u.lang = kidVoice.v.lang
    u.pitch = kidVoice.pitch
    u.rate = kidVoice.rate
  } else {
    u.pitch = kid ? 1.3 : 1
    u.rate = kid ? 1.0 : 0.88
  }
  u.volume = 0.95
  speechSynthesis.speak(u)
}

// ---------- other people's voices (greetings, the knights) ----------
// Natural voices for men, women and children. A person keeps the same voice (picked from their name),
// and nobody ever talks over Coji or over someone else: if a voice is busy, the line is skipped.
const PEOPLE_VOICES = {
  man: /Daniel|Aaron|Alex\b|Arthur|Gordon|Guy|Ryan|Rishi|Thomas|Oliver|Lee|Google UK English Male|Microsoft (Guy|Ryan|Christopher|Eric|Andrew)/i,
  woman: /Samantha|Karen|Moira|Tessa|Fiona|Kate|Serena|Martha|Catherine|Allison|Ava|Susan|Google US English|Google UK English Female|Microsoft (Aria|Jenny|Michelle|Sonia|Emma)/i,
  kid: /\bAna\b.*(Online|Natural)|Nicky|Samantha|Google US English/i,
}
let peopleVoices = null
function voicesFor(kind) {
  if (!('speechSynthesis' in window)) return []
  if (!peopleVoices || !peopleVoices.man.length) {
    const vs = speechSynthesis.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang) && !SKIP_VOICES.test(v.name))
    peopleVoices = {}
    for (const k of Object.keys(PEOPLE_VOICES)) peopleVoices[k] = vs.filter((v) => PEOPLE_VOICES[k].test(v.name))
    peopleVoices.any = vs
  }
  return peopleVoices[kind]?.length ? peopleVoices[kind] : peopleVoices.any
}
export const speechBusy = () => 'speechSynthesis' in window && (speechSynthesis.speaking || speechSynthesis.pending)
// who: 'man' | 'woman' | 'kid'; seed picks the same voice for the same person.
export function sayAs(text, { who = 'woman', seed = 0, pitch = 1, rate = 1, volume = 0.85, queue = false } = {}) {
  if (!('speechSynthesis' in window) || muted) return false
  if (!queue && speechBusy()) return false
  const clean = text.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim()
  if (!clean) return false
  const list = voicesFor(who)
  const u = new SpeechSynthesisUtterance(clean)
  u.lang = 'en-US'
  if (list.length) {
    u.voice = list[Math.abs(seed) % list.length]
    u.lang = u.voice.lang
  }
  u.pitch = pitch
  u.rate = rate
  u.volume = volume
  speechSynthesis.speak(u)
  return true
}

// A crowd cheering far away (the knights): soft swells of noise, like many voices at once.
export function cheer(at = 0) {
  const c = ac()
  if (!c || muted) return
  for (let i = 0; i < 2; i++) {
    const t0 = c.currentTime + at + i * 1.25
    const s = c.createBufferSource()
    s.buffer = noiseBuffer(c)
    s.loop = true
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.4
    bp.frequency.setValueAtTime(700, t0)
    bp.frequency.linearRampToValueAtTime(1100, t0 + 0.5)
    bp.frequency.linearRampToValueAtTime(800, t0 + 1.1)
    const g = c.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(0.09, t0 + 0.18)
    g.gain.setTargetAtTime(0, t0 + 0.7, 0.18)
    s.connect(bp).connect(g).connect(master)
    s.start(t0)
    s.stop(t0 + 1.6)
  }
}
