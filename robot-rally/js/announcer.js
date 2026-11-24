import { broadcastLines, broadcastTracks } from './broadcast-lines.js'
import { PlayByPlay, speakerFor } from './play-by-play.js'
import { duelKey, duelKinds, duelWords } from './duel-calls.js'
import { duelClips, duelTracks, duelRate } from './duel-recordings.js'

const presenters = {
  caller: { name: 'Daniel', role: 'Play-by-play', voices: /Daniel|Oliver|Arthur|Alex|Nathan|Aaron|Tom\b/i },
  analyst: {
    name: 'Samantha',
    role: 'Analysis',
    voices: /Samantha|Ava|Allison|Susan|Serena|Karen|Moira|Tessa/i
  }
}
const portraitSheet = new URL('../art/broadcast/presenters.webp', import.meta.url).href
const captionTime = (line) => Math.max(1.6, line.duration + 0.38)

function rosterName(name) {
  return Object.keys(broadcastLines).find(
    (id) => id !== 'yourBot' && id !== 'neutral' && id.toLowerCase() === name.toLowerCase()
  )
}

function pairTrack(names) {
  if (!names || names.length !== 2) return ''
  const known = duelKey(names[0], names[1])
  if (Object.hasOwn(duelClips, known)) return known
  const custom = duelKey('yourBot', names[1])
  return Object.hasOwn(duelClips, custom) ? custom : ''
}

// Unknown names keep their real spelling in captions. Each local backup is a
// complete line; the recording never splices a name onto a different voice.
export function lineFor(cue) {
  if (!cue) return null
  const index = duelKinds.indexOf(cue.kind)
  if (index >= 0 && (cue.side === 0 || cue.side === 1)) {
    const id = pairTrack(cue.names)
    const take = duelClips[id]?.[index * 2 + cue.side]
    if (take) {
      const [start, length, variant] = take
      return {
        id,
        offset: start / duelRate,
        duration: length / duelRate,
        custom: id.startsWith('yourbot-'),
        player: cue.names[0],
        words: duelWords(cue.kind, cue.side, cue.names, variant),
        speaker: speakerFor(cue.kind)
      }
    }
  }
  const name = String(cue.subject),
    subject = name === 'neutral' ? name : rosterName(name)
  let id = subject || 'yourBot'
  if (!Object.hasOwn(broadcastLines[id] || {}, cue.kind)) id = 'yourBot'
  const entry = broadcastLines[id]?.[cue.kind]
  if (!Array.isArray(entry)) return null
  const [offset, duration, recorded] = entry
  const custom = id === 'yourBot'
  const words = custom ? recorded.replace(/your bot/gi, () => name) : recorded
  return { id, offset, duration, custom, words, speaker: speakerFor(cue.kind) }
}

function localPresenter(speaker) {
  const synth = globalThis.speechSynthesis
  if (!synth || !globalThis.SpeechSynthesisUtterance) return null
  const voices = synth.getVoices().filter((v) => v.localService && /^en[-_]/i.test(v.lang))
  return (
    voices.find((v) => v.name.includes(presenters[speaker].name)) ||
    voices.find((v) => presenters[speaker].voices.test(v.name)) ||
    null
  )
}

export class Announcer {
  constructor(audio, caption) {
    this.audio = audio
    this.caption = caption
    this.words = caption.querySelector('span')
    const copy = document.createElement('div')
    this.label = document.createElement('small')
    this.label.style.cssText =
      'display:block;font:700 10px/1.45 system-ui,sans-serif;letter-spacing:.045em;color:#f3c883'
    copy.append(this.label, this.words)
    this.portrait = document.createElement('canvas')
    this.portrait.width = this.portrait.height = 96
    this.portrait.style.cssText =
      'display:block;width:clamp(32px,4.5vw,44px);height:auto;flex:none;align-self:center'
    this.portrait.setAttribute('aria-hidden', 'true')
    caption.replaceChildren(this.portrait, copy)
    this.brush = this.portrait.getContext('2d')
    this.tracks = new Map()
    this.serial = 0
  }

  track(subject) {
    const ctx = this.audio.context
    const url = Object.hasOwn(broadcastTracks, subject) ? broadcastTracks[subject] : duelTracks[subject]
    if (!ctx || typeof url !== 'string') return Promise.resolve(null)
    if (!this.tracks.has(subject)) {
      const promise = fetch(url)
        .then((response) => {
          if (!response.ok) throw Error('Commentary unavailable')
          return response.arrayBuffer()
        })
        .then((bytes) => (this.tracks.get(subject) === promise && this.audio.context === ctx
          ? this.audio.decodeRecording(bytes) : null))
        .catch(() => {
          if (this.tracks.get(subject) === promise) this.tracks.delete(subject)
          return null
        })
      this.tracks.set(subject, promise)
    }
    return this.tracks.get(subject)
  }

  warmOpening(player, rival) {
    if (this.audio.muted || !this.audio.context) return
    const line = lineFor({ subject: player, kind: 'vs' + rival })
    if (!line) return
    if (this.openingTrack && this.openingTrack !== line.id) this.tracks.delete(this.openingTrack)
    this.openingTrack = line.id
    this.track(line.id)
  }

  reset(enabled, names, time = 0, { archetype } = {}) {
    this.stop()
    this.active = enabled
    const player = String(names?.[0] || archetype || 'Your bot').trim() || 'Your bot'
    this.desk = enabled ? new PlayByPlay([player, names[1]], time) : null
    this.resultDelay = 1.05
    const playerTrack = enabled && rosterName(player)
    const subjects = enabled ? [playerTrack || 'yourBot', names[1], 'neutral'] : []
    const pair = enabled && pairTrack([player, names[1]])
    if (pair) subjects.push(pair)
    if (enabled && !broadcastLines[playerTrack]?.['vs' + names[1]] && !subjects.includes('yourBot'))
      subjects.push('yourBot')
    for (const id of this.tracks.keys()) if (!subjects.includes(id)) this.tracks.delete(id)
    if (enabled) {
      if (!this.sheet) {
        this.sheet = new Image()
        this.sheet.onload = () => this.paint(this.face || 'caller', this.pose || 0, true)
        this.sheet.src = portraitSheet
      }
      if (!this.audio.muted) for (const id of subjects) this.track(id)
      if (!playerTrack) globalThis.speechSynthesis?.getVoices()
    }
  }

  paint(speaker, pose, force = false) {
    if (!force && this.face === speaker && this.pose === pose) return
    this.face = speaker
    this.pose = pose
    if (!this.sheet?.naturalWidth || !this.brush) return
    const size = this.sheet.naturalWidth / 6
    this.brush.clearRect(0, 0, 96, 96)
    this.brush.drawImage(this.sheet, pose * size, speaker === 'analyst' ? size : 0, size, size, 0, 0, 96, 96)
  }

  animate(line, buffer = null) {
    this.paint(line.speaker, 0)
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const started = performance.now()
    const channel = buffer?.getChannelData(0)
    let beat = 0
    this.mouthTimer = setInterval(() => {
      let pose = [1, 3, 2, 1, 0, 3][beat % 6]
      if (channel) {
        const first = Math.floor((line.offset + (performance.now() - started) / 1000) * buffer.sampleRate)
        let energy = 0
        for (let k = 0; k < 72; k++) energy += (channel[first + k * 5] || 0) ** 2
        pose = energy < 0.035 ? 0 : energy < 0.3 ? 1 : energy < 0.9 ? 3 : 2
      }
      this.paint(line.speaker, beat++ % 23 === 14 ? 5 : pose)
    }, 92)
  }

  releaseVoice() {
    clearInterval(this.mouthTimer)
    this.paint(this.face || 'caller', 0)
    this.audio.narration(false)
  }

  clearVoiceWait() {
    clearTimeout(this.voiceWaitTimer)
    if (this.voicesReady) {
      globalThis.speechSynthesis?.removeEventListener('voiceschanged', this.voicesReady)
      this.voicesReady = null
    }
  }

  stop() {
    this.serial++
    this.clearVoiceWait()
    clearTimeout(this.hideTimer)
    clearTimeout(this.speechTimer)
    this.caption.hidden = true
    if (this.utterance) {
      this.utterance.onstart = this.utterance.onerror = this.utterance.onend = null
      this.utterance = null
      globalThis.speechSynthesis.cancel()
    }
    if (this.source) {
      this.source.onended = null
      this.source.stop()
      this.source.disconnect()
      this.source = null
    }
    this.releaseVoice()
  }

  canSpeak(serial) {
    return (
      serial === this.serial &&
      this.active &&
      !this.audio.muted &&
      !document.hidden &&
      this.audio.context?.state === 'running'
    )
  }

  recording(line, serial, requested) {
    this.track(line.id).then((buffer) => {
      if (!buffer || !this.canSpeak(serial) || performance.now() - requested > 1050) return
      const source = this.audio.context.createBufferSource()
      source.buffer = buffer
      source.connect(this.audio.mix)
      this.audio.narration(true)
      this.source = source
      this.animate(line, buffer)
      source.onended = () => {
        source.disconnect()
        if (this.source === source) {
          this.source = null
          this.releaseVoice()
        }
      }
      source.start(0, line.offset, line.duration)
    })
  }

  personalized(line, voice, serial, fallback) {
    const synth = globalThis.speechSynthesis
    const utterance = new SpeechSynthesisUtterance(line.words)
    utterance.voice = voice
    utterance.lang = voice.lang
    utterance.rate = line.speaker === 'analyst' ? 1.02 : 1.08
    utterance.volume = 0.82
    this.utterance = utterance
    let started = false
    const recover = () => {
      if (this.utterance !== utterance) return
      this.utterance = null
      utterance.onstart = utterance.onend = utterance.onerror = null
      clearTimeout(this.speechTimer)
      synth.cancel()
      this.releaseVoice()
      if (!started && this.canSpeak(serial)) fallback()
    }
    utterance.onstart = () => {
      if (!this.canSpeak(serial)) return recover()
      clearTimeout(this.speechTimer)
      started = true
      this.audio.narration(true)
      this.animate(line)
    }
    utterance.onerror = recover
    utterance.onend = () => {
      if (this.utterance !== utterance) return
      clearTimeout(this.speechTimer)
      this.utterance = null
      this.releaseVoice()
    }
    this.speechTimer = setTimeout(recover, 480)
    try {
      synth.speak(utterance)
    } catch {
      recover()
    }
  }

  customVoice(line, serial, record) {
    const synth = globalThis.speechSynthesis
    if (!synth || !globalThis.SpeechSynthesisUtterance) return record()
    const attempt = () => {
      const voice = localPresenter(line.speaker)
      if (!voice || !this.canSpeak(serial)) return false
      this.clearVoiceWait()
      this.personalized(line, voice, serial, record)
      return true
    }
    if (attempt()) return
    // WebKit may report an empty voice list on the very first tap, then deliver
    // voiceschanged once the device's local speech catalog has opened.
    if (synth.getVoices().length && this.canSpeak(serial)) return record()
    this.voicesReady = attempt
    synth.addEventListener('voiceschanged', attempt)
    this.voiceWaitTimer = setTimeout(() => {
      this.clearVoiceWait()
      if (serial === this.serial && !attempt()) record()
    }, 360)
  }

  speak(cue) {
    if (!this.active || !cue) return 0
    const line = lineFor(cue)
    if (!line) return 0
    this.stop()
    const serial = this.serial,
      person = presenters[line.speaker]
    this.words.textContent = line.words
    this.label.textContent = person.name + ' · ' + person.role
    this.caption.hidden = false
    this.caption.dataset.subject = cue.subject
    this.caption.dataset.kind = cue.kind
    this.caption.dataset.speaker = line.speaker
    this.caption.dataset.voice = person.name
    this.paint(line.speaker, 0)
    const visible = captionTime(line)
    this.hideTimer = setTimeout(() => {
      this.caption.hidden = true
    }, visible * 1000)
    if (!this.audio.muted) {
      const now = performance.now()
      const record = () => this.recording(line, serial, now)
      if (line.custom && /\p{Script=Latin}/u.test(line.player || cue.subject))
        this.customVoice(line, serial, record)
      else record()
    }
    return visible
  }

  opening() {
    if (this.desk) this.speak(this.desk.opening())
  }

  update(match, silent = false) {
    if (!this.active || !this.desk) return
    const cue = this.desk.nextCall(match)
    if (!cue) return
    const line = silent && lineFor(cue)
    const duration = silent ? (line ? captionTime(line) : 0) : this.speak(cue)
    if (duration) this.desk.next = Math.max(this.desk.next, match.time + duration)
  }

  finish(match) {
    if (this.active && this.desk) this.resultDelay = Math.max(1.05, this.speak(this.desk.finish(match)))
  }
}
