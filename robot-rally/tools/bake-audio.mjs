// Bake the game's original sound into one AAC-LC atlas. Requires Node and ffmpeg.
// Run from any directory: node robot-rally/tools/bake-audio.mjs
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { audioCues } from '../js/audio.js'

const RATE = 22050
const TAU = Math.PI * 2
function clip(channels, frames, rate) {
  return { rate, channels: Array.from({ length: channels }, () => new Float32Array(frames)) }
}

function randomGenerator(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

function recording(seconds, sample, seed = 7) {
  const sound = clip(1, Math.ceil(seconds * RATE), RATE)
  const data = sound.channels[0]
  const random = randomGenerator(seed)
  let previous = 0
  for (let i = 0; i < data.length; i++) {
    const noise = 2 * random() - 1
    const t = i / RATE
    const edge = Math.min(1, t * 1800, (data.length - 1 - i) / 40)
    data[i] = sample(t, noise, 0.5 * (noise - previous)) * edge
    previous = noise
  }
  return sound
}

function decay(time, rate) {
  return Math.exp(-rate * time)
}

function metalNote(time, pitch) {
  const angle = TAU * pitch * time
  return (
    Math.min(1, time * 360) *
    (0.5 * Math.sin(angle) * decay(time, 6.2) +
      0.24 * Math.sin(angle * 2.01) * decay(time, 12) +
      0.09 * Math.sin(angle * 2.72) * decay(time, 20) +
      0.06 * Math.sin(angle * 4.2) * decay(time, 38))
  )
}

function chime(notes) {
  const duration = notes[notes.length - 1][0] + 0.85
  const sound = clip(1, Math.ceil(duration * RATE), RATE)
  const data = sound.channels[0]
  for (const [start, frequency, strength] of notes) {
    const offset = Math.round(start * RATE)
    const length = Math.min(data.length - offset, Math.floor(RATE * 0.85))
    for (let i = 0; i < length; i++) {
      data[offset + i] += strength * metalNote(i / RATE, frequency)
    }
  }
  return sound
}

function makeEffect(kind) {
  let low = 0
  switch (kind) {
    case 'equip':
      return recording(0.27, (t, n, bright) => {
        const latch = t - 0.035
        return (
          bright * 0.44 * decay(t, 130) +
          (latch < 0 ? 0 : metalNote(latch, 930) * 0.42 + n * 0.14 * decay(latch, 100))
        )
      })
    case 'hit':
      return recording(0.42, (t, n, bright) => {
        low += 0.16 * (n - low)
        const thump = Math.sin(TAU * (76 * t + 2.5 * (1 - decay(t, 38))))
        const chassis = Math.sin(TAU * 249 * t) + 0.5 * Math.sin(TAU * 376 * t)
        return (
          0.65 * thump * decay(t, 21) +
          0.78 * low * decay(t, 29) +
          0.52 * bright * decay(t, 106) +
          0.12 * chassis * decay(t, 27)
        )
      })
    case 'guard':
      return recording(
        0.44,
        (t, n, bright) =>
          0.44 * bright * decay(t, 93) +
          0.48 * metalNote(t, 502) +
          0.13 * Math.sin(TAU * 118 * t) * decay(t, 28)
      )
    case 'miss':
      return recording(0.28, (t, n) => {
        const u = t / 0.28
        low += (0.11 + 0.27 * u) * (n - low)
        const shape = 4 * u * (1 - u)
        return shape * shape * (low * 0.63 + 0.065 * Math.sin(TAU * (280 * t - 370 * t * t)))
      })
    case 'charge':
      return recording(0.44, (t, n) => {
        const u = t / 0.44
        const sweep = TAU * (115 * t + 355 * t * t)
        return Math.sin(Math.PI * u) * (0.19 * Math.sin(sweep) + 0.1 * Math.sin(sweep * 1.98) + 0.04 * n)
      })
    case 'start':
      return chime([
        [0, 392, 0.62],
        [0.14, 494, 0.62],
        [0.3, 784, 0.7]
      ])
    case 'win':
      return chime([
        [0, 392, 0.61],
        [0.12, 494, 0.67],
        [0.25, 587.3, 0.68],
        [0.43, 784, 0.77],
        [0.43, 392, 0.28],
        [0.62, 987.8, 0.48]
      ])
    case 'lose':
      return chime([
        [0, 523.25, 0.52],
        [0.22, 440, 0.44],
        [0.46, 392, 0.46]
      ])
  }
}

// Place each little vowel in its own seat. Two resonances shape a breathy
// glottal pulse, while a delayed, quieter copy reaches the opposite ear.
function crowdRecording(cheering) {
  const rate = 16000
  const length = Math.ceil(rate * (cheering ? 2.15 : 6.8))
  const sound = clip(2, length, rate)
  const left = sound.channels[0]
  const right = sound.channels[1]
  const random = randomGenerator(cheering ? 1891 : 3019)
  const count = cheering ? 34 : 86
  for (let voice = 0; voice < count; voice++) {
    const start = Math.floor(cheering ? random() * 0.65 * rate : random() * length)
    const samples = Math.floor(rate * (0.22 + random() * (cheering ? 1.1 : 0.56)))
    const pan = random()
    const near = pan < 0.5 ? left : right
    const far = pan < 0.5 ? right : left
    const delay = 14 + Math.floor(21 * Math.abs(pan - 0.5))
    const echoDelay = Math.floor(rate * (0.031 + random() * 0.045))
    const pitch = (cheering ? 158 : 105) + random() * (cheering ? 196 : 124)
    const formant1 = (cheering ? 490 : 350) + 290 * random()
    const formant2 = (cheering ? 990 : 1140) + 510 * random()
    const r1 = 0.977,
      r2 = 0.958
    const c1 = 2 * r1 * Math.cos((TAU * formant1) / rate)
    const c2 = 2 * r2 * Math.cos((TAU * formant2) / rate)
    const volume = 0.36 + random() * 0.54
    const crossGain = 0.65 + 0.45 * Math.min(pan, 1 - pan)
    let phase = random(),
      a1 = 0,
      a2 = 0,
      b1 = 0,
      b2 = 0
    for (let i = 0; i < samples; i++) {
      const u = i / samples
      const arch = 4 * u * (1 - u)
      phase += (pitch / rate) * (0.94 + (cheering ? 0.29 : 0.095) * arch - 0.12 * u)
      let pulse = 0
      if (phase >= 1) {
        phase -= 1
        pulse = 1
      }
      const excitation = pulse + 0.079 * (2 * random() - 1)
      const a = c1 * a1 - r1 * r1 * a2 + excitation * (1 - r1)
      const b = c2 * b1 - r2 * r2 * b2 + excitation * (1 - r2)
      a2 = a1
      a1 = a
      b2 = b1
      b1 = b
      const value = volume * arch * arch * (a + 0.62 * b)
      const index = (start + i) % length
      near[index] += value
      far[(index + delay) % length] += value * crossGain
      far[(index + echoDelay) % length] += value * 0.22
    }
  }
  const claps = cheering ? 51 : 13
  for (let clap = 0; clap < claps; clap++) {
    const start = Math.floor(random() * (cheering ? length * 0.88 : length))
    const seat = random(),
      size = 0.09 + random() * 0.19
    let smooth = 0
    for (let i = 0; i < 720; i++) {
      const t = i / rate
      const noise = 2 * random() - 1
      smooth += 0.19 * (noise - smooth)
      const hands = decay(t, 126) + (t > 0.009 ? 0.32 * decay(t - 0.009, 151) : 0)
      const value = (noise - smooth) * size * hands * (cheering ? 1 : 0.4)
      left[(start + i) % length] += value * (1 - seat)
      right[(start + i + 11) % length] += value * seat
    }
  }
  if (cheering) {
    const fade = Math.floor(rate * 0.14)
    for (let i = 0; i < fade; i++) {
      const gain = i / fade
      left[length - 1 - i] *= gain
      right[length - 1 - i] *= gain
    }
  }
  return sound
}

// A near stand answers a far stand. Individual formant sweeps, slightly
// imperfect paired handclaps and short roof echoes follow the victory bell.
function ceremonyRecording() {
  const rate = 22050,
    duration = audioCues.ceremony[1]
  const sound = clip(2, Math.round(rate * duration), rate)
  const random = randomGenerator(48133)
  function seat(time, pan, sample, echo) {
    const i = Math.floor(time * rate)
    if (i >= sound.channels[0].length) return
    sound.channels[0][i] += sample * (0.88 - pan * 0.37)
    sound.channels[1][i] += sample * (0.51 + pan * 0.37)
    const wall = i + echo
    if (wall < sound.channels[0].length) {
      sound.channels[0][wall] += sample * (0.105 + pan * 0.06)
      sound.channels[1][wall] += sample * (0.17 - pan * 0.06)
    }
  }
  for (let row = 0; row < 43; row++) {
    const start = row < 25 ? random() * 0.72 : 1.02 + random() * 0.91
    const length = 0.44 + random() * 1.12,
      pitch = 136 + random() * 192
    const pan = row < 25 ? 0.4 * random() : 0.57 + 0.43 * random()
    const echo = Math.floor((0.035 + random() * 0.068) * rate)
    const seatGain = (0.13 + random() * 0.19) * (row < 25 ? 1 : 0.83)
    const throat = 0.928 + random() * 0.035
    let phase = random(),
      a = 0,
      a1 = 0,
      b = 0,
      b1 = 0
    for (let i = 0; i < length * rate; i++) {
      const u = i / (length * rate),
        rise = Math.sin(Math.PI * u)
      phase += (pitch * (0.85 + 0.42 * rise - 0.12 * u)) / rate
      let pulse = 0
      if (phase >= 1) {
        phase--
        pulse = 1
      }
      const air = pulse + (random() - 0.5) * 0.13
      const f1 = 2 * throat * Math.cos((TAU * (440 + 220 * rise)) / rate)
      const f2 = 1.91 * Math.cos((TAU * (1120 + 480 * u)) / rate)
      const nextA = f1 * a - throat * throat * a1 + air * (1 - throat)
      const nextB = f2 * b - 0.955 ** 2 * b1 + air * 0.045
      a1 = a
      a = nextA
      b1 = b
      b = nextB
      seat(start + i / rate, pan, (a + 0.72 * b) * rise ** 1.2 * seatGain, echo)
    }
  }
  for (let fan = 0; fan < 27; fan++) {
    const pan = random(),
      first = 0.12 + random() * 1.1,
      pace = 0.25 + random() * 0.16
    const echo = Math.floor(rate * (0.03 + random() * 0.065))
    for (let n = 0; n < 9; n++) {
      const start = first + n * pace + 0.038 * random()
      const strength = (0.12 + 0.12 * random()) * Math.min(1, (duration - start) / 0.8)
      if (strength <= 0) continue
      let smooth = 0
      for (let i = 0; i < 1150; i++) {
        const t = i / rate,
          noise = 2 * random() - 1
        smooth += 0.23 * (noise - smooth)
        const hands = decay(t, 128) + (t > 0.011 ? 0.42 * decay(t - 0.011, 147) : 0)
        seat(start + t, pan, (noise - smooth) * strength * hands, echo)
      }
    }
  }
  let peak = 0
  for (const ch of sound.channels) for (const v of ch) peak = Math.max(peak, Math.abs(v))
  for (const ch of sound.channels)
    for (let i = 0; i < ch.length; i++)
      ch[i] *= (0.96 / Math.max(peak, 0.0001)) * Math.min(1, i / 320, (ch.length - 1 - i) / 3600)
  return sound
}

function servoRecording() {
  // Gear teeth, a resonant hub and a soft brush whine. All frequencies complete
  // whole cycles in 1.25 s, so changing playback speed preserves a smooth loop.
  const length = Math.round(32000 * 1.25)
  const sound = clip(1, length, 32000)
  const samples = sound.channels[0]
  for (let i = 0; i < length; i++) {
    const turn = (TAU * i) / length
    const wobble = 0.08 * Math.sin(4 * turn)
    const hum = 0.23 * Math.sin(110 * turn + wobble) + 0.14 * Math.sin(221 * turn + 2 * wobble)
    const gear = 0.07 * Math.sin(438 * turn + 0.52 * Math.sin(9 * turn))
    const brush = 0.026 * Math.sin(902 * turn + 1.3 * Math.sin(32 * turn))
    samples[i] = (hum + gear + brush) * (0.87 + 0.13 * Math.sin(13 * turn))
  }
  return sound
}

const destination = fileURLToPath(new URL('../art/arena-audio.m4a', import.meta.url))
const rate = 32000
const pad = Math.round(0.1 * rate)
const last = audioCues.ceremony
const frames = Math.ceil((last[0] + last[1] + 0.2) * rate)
const pcm = new Float32Array(frames * 2)

for (const [name, [start, seconds]] of Object.entries(audioCues)) {
  const sound =
    name === 'ceremony'
      ? ceremonyRecording()
      : name === 'crowd' || name === 'cheer'
        ? crowdRecording(name === 'cheer')
        : name === 'servo'
          ? servoRecording()
          : makeEffect(name)
  const loop = name === 'crowd' || name === 'servo'
  const offset = Math.round(start * rate)
  const length = Math.round(seconds * rate)
  if (Math.abs(sound.channels[0].length / sound.rate - seconds) > 0.0001) {
    throw new Error('Wrong duration for ' + name)
  }
  // Loop handles give the AAC encoder the same sound on either side of a cue
  // seam as the player will hear. One-shots are separated by clean silence.
  for (let i = loop ? -pad : 0; i < length + (loop ? pad : 0); i++) {
    const position = (((i + length) % length) * sound.rate) / rate
    const lo = Math.floor(position),
      mix = position - lo
    for (let ch = 0; ch < 2; ch++) {
      const samples = sound.channels[ch] || sound.channels[0]
      const hi = loop ? (lo + 1) % samples.length : Math.min(lo + 1, samples.length - 1)
      const value = samples[lo] * (1 - mix) + samples[hi] * mix
      // Reserving headroom before encoding also allows the metal hit to ring.
      pcm[(offset + i) * 2 + ch] = value * 0.74
    }
  }
}

// Explicit mp42 branding selects the MPEG-4 audio reader in WebKit. Its
// decoded cue starts match Chromium even when the last AAC frame is padded.
const result = spawnSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'f32le',
    '-ar',
    String(rate),
    '-ac',
    '2',
    '-i',
    'pipe:0',
    '-c:a',
    'aac',
    '-profile:a',
    'aac_low',
    '-b:a',
    '96k',
    '-movflags',
    '+faststart',
    '-brand',
    'mp42',
    '-f',
    'mp4',
    destination
  ],
  { input: Buffer.from(pcm.buffer), stdio: ['pipe', 'inherit', 'inherit'] }
)
if (result.error) throw result.error
if (result.status !== 0) throw new Error('AAC encoder exited with ' + result.status)
console.log('Wrote ' + destination)
