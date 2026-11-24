import { readerBytesPerSecond, readerCues } from './part-reader-cues.js'

const baseTrack = 'shop-reader.mp3'

// Independently encoded MPEG frames share a format and have no bit reservoir.
// Only the chosen name, comparison and description enter the tablet decoder.
function clipBytes(bytes, cue) {
  const ranges = cue.byteRanges
  if (!ranges) {
    const offset = Math.round(cue.start * readerBytesPerSecond)
    const length = Math.round(cue.duration * readerBytesPerSecond)
    return offset + length <= bytes.byteLength ? bytes.slice(offset, offset + length) : null
  }
  const result = new Uint8Array(Math.round(cue.duration * readerBytesPerSecond))
  let used = 0
  for (const [start, length] of ranges) {
    if (start + length > bytes.byteLength || used + length > result.length) return null
    result.set(new Uint8Array(bytes, start, length), used)
    used += length
  }
  return used === result.length ? result.buffer : null
}

// Keep the common part introductions and the current shelf of comparisons.
// Decode only the chosen reading, including while tapping quickly on a tablet.
export class PartReader {
  constructor(audio) {
    this.audio = audio
    this.selection = 0
    this.tracks = new Map()
    this.onVisibility = () => {
      if (document.hidden) this.stop()
    }
    this.onState = () => {
      if (this.audio.muted || this.context?.state !== 'running') this.stop()
    }
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  load(file = baseTrack) {
    if (this.tracks.has(file)) return this.tracks.get(file).bytes
    if (file !== baseTrack) {
      for (const [name, record] of this.tracks) {
        if (name === baseTrack) continue
        record.abort.abort()
        this.tracks.delete(name)
      }
    }
    const abort = new AbortController()
    const bytes = fetch(new URL('../art/' + file, import.meta.url), { signal: abort.signal })
      .then((response) => {
        if (!response.ok) throw Error('Shop voice unavailable')
        return response.arrayBuffer()
      })
      .catch((error) => {
        if (this.tracks.get(file)?.bytes === bytes) this.tracks.delete(file)
        throw error
      })
    this.tracks.set(file, { abort, bytes })
    return bytes
  }

  selected(id) {
    return !this.disposed && this.selection === id && !this.audio.muted && !document.hidden
  }

  async play(slot, index, fitted = -1) {
    this.stop()
    if (!Number.isInteger(index) || !Object.hasOwn(readerCues, slot)) return false
    let cue = readerCues[slot][index], file = baseTrack
    const id = this.selection
    if (!cue || !this.selected(id)) return false
    try {
      // Call unlock synchronously within the tap gesture before awaiting I/O.
      const unlocking = this.audio.unlock()
      const ctx = this.audio.context
      if (ctx && this.context !== ctx) {
        this.context?.removeEventListener('statechange', this.onState)
        this.context = ctx
        ctx.addEventListener('statechange', this.onState)
      }
      if (fitted >= 0 && fitted !== index) {
        const { shopComparisons } = await import('./shop-comparisons.js')
        if (!this.selected(id)) return false
        const shelf = shopComparisons[slot]
        const replacement = shelf.lines[index]?.[fitted]
        if (replacement) {
          cue = replacement
          file = shelf.file
        }
      }
      const [ready, bytes] = await Promise.all([unlocking, this.load(file)])
      if (!ready || !this.selected(id) || ctx?.state !== 'running') return false
      // One decoder at a time. After it finishes only the most recent selection
      // can start another decode or reach the speakers.
      if (this.decoding) await this.decoding.catch(() => {})
      if (!this.selected(id) || ctx.state !== 'running') return false
      let buffer = this.lastCue === cue ? this.lastBuffer : null
      if (!buffer) {
        const selected = clipBytes(bytes, cue)
        if (!selected) return false
        const decode = ctx.decodeAudioData(selected)
        this.decoding = decode
        try {
          buffer = await decode
        } finally {
          if (this.decoding === decode) this.decoding = null
        }
        if (!this.selected(id) || ctx.state !== 'running') return false
        this.lastCue = cue
        this.lastBuffer = buffer
      }
      const source = ctx.createBufferSource(),
        gain = ctx.createGain()
      source.buffer = buffer
      source.connect(gain).connect(this.audio.mix)
      const voice = { source, gain }
      this.voice = voice
      source.onended = () => {
        source.disconnect()
        gain.disconnect()
        if (this.voice === voice) {
          this.voice = null
          this.audio.narration(false)
        }
      }
      source.start()
      this.audio.narration(true)
      return true
    } catch {
      if (this.selection === id) this.stop()
      return false
    }
  }

  stop() {
    this.selection++
    const voice = this.voice
    if (!voice) return
    this.voice = null
    if (this.context.state === 'running' && !this.audio.muted && !document.hidden) {
      const now = this.context.currentTime
      voice.gain.gain.setTargetAtTime(0, now, 0.003)
      voice.source.stop(now + 0.016)
    } else {
      voice.source.stop()
      voice.source.disconnect()
      voice.gain.disconnect()
      voice.source.onended = null
    }
    this.audio.narration(false)
  }

  dispose() {
    this.disposed = true
    this.stop()
    for (const { abort } of this.tracks.values()) abort.abort()
    this.tracks.clear()
    this.lastCue = this.lastBuffer = null
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.context?.removeEventListener('statechange', this.onState)
    this.context = null
  }
}
