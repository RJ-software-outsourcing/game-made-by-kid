import { toolSound } from './tool-audio.js'
// Offsets and lengths are seconds of source audio. The offline baker uses the
// same table to place each sound, including handles around both looping cues.
export const audioCues = {
  equip: [0.2, 0.27],
  hit: [0.75, 0.42],
  guard: [1.45, 0.44],
  miss: [2.16, 0.28],
  charge: [2.72, 0.44],
  start: [3.46, 1.15],
  win: [4.9, 1.47],
  lose: [6.68, 1.31],
  cheer: [8.3, 2.15],
  crowd: [10.78, 6.8],
  servo: [17.88, 1.25],
  ceremony: [19.45, 4.35]
}
const asset = new URL('../art/arena-audio.m4a', import.meta.url)
const level = {
  equip: 0.58,
  hit: 0.78,
  guard: 0.7,
  miss: 0.72,
  charge: 0.7,
  start: 0.7,
  win: 0.68,
  lose: 0.62,
  cheer: 0.7,
  ceremony: 0.88
}
const gap = {
  equip: 0.045,
  hit: 0.028,
  guard: 0.04,
  miss: 0.055,
  cheer: 0.75,
  ceremony: 2.5,
  charge: 0.15,
  start: 0.4,
  win: 0.6,
  lose: 0.6
}
const clamp = (number, low, high) => Math.min(high, Math.max(low, number))
// Shell thickness changes the short body resonance. Padding absorbs the high
// click; a clear shield has its own separate recording.
const shellResponses = [
  { pitch: 1.13, cutoff: 7600 },
  { pitch: 0.94, cutoff: 1250 },
  { pitch: 0.8, cutoff: 4100 },
  { pitch: 1.02, cutoff: 4950 }
]
// Direct ring sound, audience level and reflected sound from the roof.
const viewpoints = [
  [1, 1, 0.14],
  [1.12, 0.78, 0.095],
  [0.79, 1.14, 0.19],
  [0.94, 1.03, 0.15],
  [1.1, 0.7, 0.085]
]

export class RallyAudio {
  constructor() {
    this.context = null
    this.muted = false
    this.inArena = false
    this.onTestStand = false
    this.atlas = null
    this.bytes = null
    this.decoding = null
    this.retryAt = 0
    this.failures = 0
    this.retryTimer = 0
    this.bed = null
    this.drives = [null, null]
    this.voices = new Set()
    this.effects = new Set()
    this.lastPlay = new Map()
    this.viewpoint = 0
    this.lastRise = -Infinity
    this.lastCheer = -Infinity
    this.sync = () => this.syncContext()
    this.recover = () => {
      if (
        !this.muted &&
        !document.hidden &&
        this.context &&
        (this.context.state !== 'running' || !this.atlas)
      )
        this.unlock()
    }
    this.online = () => {
      this.failures = 0
      this.retryAt = 0
      this.recover()
    }
  }

  fetchBytes() {
    if (!this.bytes && !this.disposed && Date.now() >= this.retryAt) {
      this.abort = new AbortController()
      this.bytes = fetch(asset, { signal: this.abort.signal })
        .then((response) => {
          if (!response.ok) throw new Error('Audio asset unavailable')
          return response.arrayBuffer()
        })
        .catch(() => {
          this.bytes = null
          this.failedLoad()
          return null
        })
    }
    return this.bytes
  }

  failedLoad() {
    this.failures++
    this.retryAt = Date.now() + Math.min(30000, 2500 * 2 ** Math.min(4, this.failures))
  }
  retryLater() {
    if (
      this.retryTimer ||
      this.failures > 3 ||
      this.disposed ||
      this.muted ||
      document.hidden ||
      (!this.inArena && !this.onTestStand) ||
      navigator.onLine === false
    )
      return
    this.retryTimer = setTimeout(
      () => {
        this.retryTimer = 0
        if (!document.hidden && (this.inArena || this.onTestStand) && !this.muted) this.loadAtlas()
      },
      Math.max(250, this.retryAt - Date.now())
    )
  }

  decodeRecording(bytes) {
    // The ring and the broadcast booth are mastered at 32 kHz. Store their
    // PCM at that rate and let the speakers resample only what is playing.
    if (!this.decoder) {
      this.decoder = this.context
      const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext
      if (Offline && this.context.sampleRate > 32000) {
        try { this.decoder = new Offline(2, 1, 32000) } catch {}
      }
    }
    return this.decoder.decodeAudioData(bytes)
  }

  loadAtlas() {
    if (this.atlas || this.decoding || this.muted || !this.context || this.disposed) return
    const bytes = this.fetchBytes()
    if (!bytes) {
      this.retryLater()
      return
    }
    const ctx = this.context
    this.decoding = bytes
      .then((data) => (data && ctx === this.context ? this.decodeRecording(data) : null))
      .then((atlas) => {
        if (!atlas || ctx !== this.context) return
        this.atlas = atlas
        this.failures = 0
        // The crowd reflects the current screen. Transient events are never
        // queued: a missed hit during loading must stay in the past.
        this.startBed()
      })
      .catch(() => {
        this.failedLoad()
      })
      .finally(() => {
        this.decoding = null
        this.bytes = null
        if (!this.atlas) this.retryLater()
      })
  }

  unlock() {
    if (this.disposed || this.muted || document.hidden) return Promise.resolve(false)
    try {
      if (!this.context) {
        const Context = globalThis.AudioContext || globalThis.webkitAudioContext
        if (!Context) return Promise.resolve(false)
        const ctx = (this.context = new Context({ latencyHint: 'interactive' }))
        this.mix = ctx.createGain()
        this.mix.gain.value = this.muted ? 0 : 0.83
        const limiter = ctx.createDynamicsCompressor()
        limiter.threshold.value = -9
        limiter.knee.value = 8
        limiter.ratio.value = 7
        limiter.attack.value = 0.004
        limiter.release.value = 0.13
        this.mix.connect(limiter).connect(ctx.destination)
        this.ringMix = ctx.createGain()
        this.crowdMix = ctx.createGain()
        this.ringMix.connect(this.mix)
        this.crowdMix.connect(this.mix)

        this.wall = ctx.createDelay(0.2)
        this.wall.delayTime.value = 0.064
        const absorb = ctx.createBiquadFilter()
        absorb.type = 'lowpass'
        absorb.frequency.value = 2350
        this.reflection = ctx.createGain()
        this.reflection.gain.value = viewpoints[this.viewpoint][2]
        this.wall.connect(absorb).connect(this.reflection).connect(this.mix)
        this.perspective(this.viewpoint)

        const primer = ctx.createBufferSource()
        primer.buffer = ctx.createBuffer(1, 1, 22050)
        primer.connect(this.mix)
        primer.onended = () => primer.disconnect()
        primer.start()
        document.addEventListener('visibilitychange', this.sync)
        window.addEventListener('pageshow', this.sync)
        window.addEventListener('online', this.online)
        document.addEventListener('pointerdown', this.recover, { passive: true })
        ctx.onstatechange = () => {
          if (ctx.state === 'running') {
            if (this.muted || document.hidden) this.syncContext()
            else this.startBed()
          } else {
            this.stopAll()
          }
        }
      }
      const ready = this.syncContext()
      this.loadAtlas()
      return ready
    } catch {
      return Promise.resolve(false)
    }
  }

  syncContext() {
    const ctx = this.context
    if (!ctx || ctx.state === 'closed') return Promise.resolve(false)
    if (document.hidden || this.muted) {
      clearTimeout(this.retryTimer)
      this.retryTimer = 0
      this.stopAll()
      return ctx.suspend().then(
        () => false,
        () => false
      )
    }
    if (ctx.state === 'running') {
      this.startBed()
      return Promise.resolve(true)
    }
    return ctx.resume().then(
      () => {
        if (ctx !== this.context || this.muted || document.hidden) return false
        this.startBed()
        return true
      },
      () => false
    )
  }

  mute(value) {
    this.muted = Boolean(value)
    if (!this.context) {
      // Honour a saved mute before requesting the atlas or waking audio hardware.
      if (!this.muted) this.fetchBytes()
      return
    }
    this.mix.gain.value = this.muted ? 0 : 0.83
    this.syncContext()
    if (!this.muted) this.loadAtlas()
  }

  get audible() {
    return Boolean(this.atlas && this.context?.state === 'running' && !this.muted && !document.hidden)
  }

  makeVoice(name, { pan = 0, gain = 1, pitch = 1, loop = false, spatial = true, cutoff } = {}) {
    const ctx = this.context,
      [start, length] = audioCues[name]
    const player = ctx.createBufferSource()
    player.buffer = this.atlas
    player.playbackRate.value = pitch
    const volume = ctx.createGain()
    volume.gain.value = gain
    const stereo = spatial && ctx.createStereoPanner ? ctx.createStereoPanner() : null
    const filter = cutoff ? ctx.createBiquadFilter() : null
    if (filter) {
      filter.type = 'lowpass'
      filter.frequency.value = cutoff
      filter.Q.value = 0.62
      player.connect(filter).connect(volume)
    } else player.connect(volume)
    if (stereo) {
      stereo.pan.value = pan
      volume.connect(stereo)
    }
    const output = stereo || volume
    const crowd = name === 'crowd' || name === 'cheer' || name === 'ceremony'
    const ring = this.inArena && ['servo', 'hit', 'guard', 'miss', 'charge'].includes(name)
    output.connect(crowd ? this.crowdMix : ring ? this.ringMix : this.mix)
    if (!loop && ring) output.connect(this.wall)
    const voice = { player, volume, stereo, filter }
    this.voices.add(voice)
    player.onended = () => this.cleanup(voice)
    if (loop) {
      player.loop = true
      player.loopStart = start
      player.loopEnd = start + length
      player.start(0, start + Math.random() * length)
    } else {
      this.effects.add(voice)
      player.start(0, start, length)
    }
    return voice
  }

  cleanup(voice) {
    if (!this.voices.delete(voice)) return
    this.effects.delete(voice)
    voice.player.onended = null
    voice.player.disconnect()
    voice.volume.disconnect()
    voice.filter?.disconnect()
    voice.stereo?.disconnect()
  }

  stop(voice, immediate) {
    if (!voice || !this.voices.has(voice)) return
    if (immediate) {
      voice.player.stop()
      this.cleanup(voice)
    } else {
      const now = this.context.currentTime
      voice.volume.gain.cancelScheduledValues(now)
      voice.volume.gain.setTargetAtTime(0, now, 0.009)
      voice.player.stop(now + 0.05)
    }
  }

  stopAll() {
    for (const voice of this.voices) this.stop(voice, true)
    this.bed = null
    this.drives.fill(null)
    this.lastPlay.clear()
  }

  finish(won) {
    if (!this.audible) {
      this.ambience(false)
      return
    }
    for (const drive of this.drives) this.stop(drive, false)
    this.drives.fill(null)
    if (this.bed) {
      const now = this.context.currentTime
      this.bed.volume.gain.cancelScheduledValues(now)
      this.bed.volume.gain.setTargetAtTime(won ? 0.64 : 0.47, now, 0.12)
      this.bed.volume.gain.setTargetAtTime(0, now + 1.4, 0.38)
    }
    this.play(won ? 'ceremony' : 'cheer', 0, won ? 1 : 0.58)
    this.play(won ? 'win' : 'lose')
    clearTimeout(this.finishTimer)
    this.finishTimer = setTimeout(() => this.ambience(false), won ? 4650 : 2700)
  }

  ambience(active) {
    clearTimeout(this.finishTimer)
    this.inArena = Boolean(active)
    if (!this.inArena) {
      clearTimeout(this.retryTimer)
      this.retryTimer = 0
      this.stopAll()
      this.lastRise = this.lastCheer = -Infinity
    } else {
      this.loadAtlas()
      this.startBed()
    }
  }

  perspective(index) {
    this.viewpoint = viewpoints[index] ? index : 0
    if (!this.reflection || !this.context) return
    const now = this.context.currentTime
    const [direct, crowd, wet] = viewpoints[this.viewpoint]
    for (const [node, value] of [
      [this.ringMix, direct * (this.narrating ? 0.65 : 1)],
      [this.crowdMix, crowd * (this.narrating ? 0.32 : 1)],
      [this.reflection, wet * (this.narrating ? 0.48 : 1)]
    ]) {
      node.gain.cancelScheduledValues(now)
      node.gain.setTargetAtTime(value, now, 0.12)
    }
  }
  narration(active) {
    if (Boolean(this.narrating) === active) return
    this.narrating = active
    this.perspective(this.viewpoint)
  }

  react(event, closeFinish) {
    if (!this.audible || !this.inArena || !this.bed || !['hit', 'guard'].includes(event.kind)) return
    const now = this.context.currentTime
    const big = event.kind === 'guard' || event.flanking
    if (now - this.lastRise > 0.42) {
      this.lastRise = now
      const gain = this.bed.volume.gain
      if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(now)
      else gain.cancelScheduledValues(now)
      gain.setTargetAtTime(closeFinish ? 0.77 : big ? 0.66 : 0.54, now, 0.09)
      gain.setTargetAtTime(0.45, now + 0.36, 0.45)
    }
    if ((big || closeFinish) && now - this.lastCheer > 2.25) {
      this.lastCheer = now
      this.play('cheer', 0, closeFinish ? 0.79 : 0.58)
    }
  }

  testStand(active) {
    this.onTestStand = active
    if (active) this.loadAtlas()
    if (!active) {
      for (const voice of this.drives) this.stop(voice, false)
      this.drives.fill(null)
    }
  }

  startBed() {
    if (!this.audible || !this.inArena || this.bed) return
    this.bed = this.makeVoice('crowd', { gain: 0, loop: true, spatial: false })
    this.bed.volume.gain.setTargetAtTime(0.45, this.context.currentTime, 0.24)
  }

  // speed is normalized wheel motion (0..1), pan is the robot's screen position.
  // Two independent axle loops use slightly different pitches. Changes ramp over
  // several frames, keeping the bearings audible without masking an impact.
  drive(side, pan, speed, distanceGain = 1) {
    if (!this.audible || (!this.inArena && !this.onTestStand) || (side !== 0 && side !== 1)) return
    let voice = this.drives[side]
    const pace = clamp(Number.isFinite(speed) ? speed : 0, 0, 1)
    if (pace < (voice ? 0.025 : 0.075)) {
      this.stop(voice, false)
      this.drives[side] = null
      return
    }
    if (!voice) {
      voice = this.drives[side] = this.makeVoice('servo', { gain: 0, loop: true })
      voice.next = 0
    }
    const now = this.context.currentTime
    if (now < voice.next) return
    voice.next = now + 0.065
    const balance = clamp(Number.isFinite(pan) ? pan : 0, -1, 1)
    voice.player.playbackRate.setTargetAtTime(0.65 + 0.8 * pace + side * 0.055, now, 0.07)
    voice.volume.gain.setTargetAtTime(
      (0.035 + pace * 0.13) * distanceGain * (this.onTestStand ? 0.65 : 1),
      now,
      0.055
    )
    voice.stereo?.pan.setTargetAtTime(balance, now, 0.055)
  }

  matchEvent(event, match, view) {
    const point = event.kind === 'charge' ? match.robots[event.side] : event
    const force = event.damage ? Math.min(1.2, 0.66 + event.damage * 0.027) : 1
    const pan = view.panFor(point),
      distance = view.gainFor(point)
    toolSound(this, event, pan, distance)
    this.play(event.kind, pan, force * distance, {
      side: event.side,
      shell: match.robots[1 - event.side].build.shell
    })
    this.react(
      event,
      match.robots.some((p) => p.hp / p.s.hp < 0.22)
    )
  }

  play(kind, pan = 0, intensity = 1, contact) {
    if (!this.audible || !Object.prototype.hasOwnProperty.call(level, kind)) return
    const now = this.context.currentTime
    const key = contact ? kind + contact.side : kind
    if (now - (this.lastPlay.get(key) ?? -Infinity) < gap[kind]) return
    this.lastPlay.set(key, now)
    const response = kind === 'hit' && contact ? shellResponses[contact.shell] : null
    if (this.effects.size >= 14) this.stop(this.effects.values().next().value, true)
    const melody = kind === 'win' || kind === 'lose' || kind === 'start' || kind === 'ceremony'
    this.makeVoice(kind, {
      pan: clamp(Number.isFinite(pan) ? pan : 0, -1, 1),
      gain: level[kind] * clamp(Number.isFinite(intensity) ? intensity : 1, 0, 1.4),
      pitch: melody ? 1 : (response?.pitch ?? 1) * (0.94 + Math.random() * 0.13),
      cutoff: response?.cutoff
    })
  }

  dispose() {
    clearTimeout(this.finishTimer)
    this.disposed = true
    clearTimeout(this.retryTimer)
    this.abort?.abort()
    this.stopAll()
    if (this.context) {
      document.removeEventListener('visibilitychange', this.sync)
      window.removeEventListener('pageshow', this.sync)
      window.removeEventListener('online', this.online)
      document.removeEventListener('pointerdown', this.recover)
      this.context.onstatechange = null
      this.context.close().catch(() => {})
    }
    this.context = this.decoder = this.atlas = this.bytes = this.mix = this.wall = null
    this.ringMix = this.crowdMix = this.reflection = null
  }
}
