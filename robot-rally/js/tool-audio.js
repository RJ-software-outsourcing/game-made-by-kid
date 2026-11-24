// Short mechanical sounds have different envelopes: an air bubble lifts in
// pitch, a brush spins down, and a brass bell rings at two inharmonic pitches.
export function toolSound(audio, event, pan, distance) {
  if (!audio.audible || !audio.inArena) return
  const ctx = audio.context,
    start = ctx.currentTime
  let tones
  if (event.kind === 'launch')
    tones = [
      ['sine', 340, 760, 0.105, 0.16],
      ['sine', 830, 1130, 0.061, 0.055]
    ]
  else if (event.kind === 'wave')
    tones = [
      ['sine', 658, 648, 0.38, 0.12],
      ['sine', 1493, 1480, 0.21, 0.048]
    ]
  else if(event.kind==='dash') tones=[['triangle',92,325,.22,.14],['sine',165,490,.14,.055]]
  else if(event.kind==='dodge') tones=[['triangle',465,215,.105,.080]]
  else if (event.weapon === 1 && event.kind === 'hit') tones = [['triangle', 149, 63, 0.11, 0.1]]
  else if (event.weapon === 2 && event.kind === 'hit') tones = [['sine', 790, 360, 0.075, 0.13]]
  else return
  for (const [type, from, to, length, level] of tones) {
    if (audio.effects.size >= 14) audio.stop(audio.effects.values().next().value, true)
    const player = ctx.createOscillator(),
      volume = ctx.createGain()
    player.type = type
    player.frequency.setValueAtTime(from, start)
    player.frequency.exponentialRampToValueAtTime(to, start + length)
    volume.gain.setValueAtTime(0.0001, start)
    volume.gain.exponentialRampToValueAtTime(level * distance, start + 0.009)
    volume.gain.exponentialRampToValueAtTime(0.0001, start + length)
    const stereo = ctx.createStereoPanner?.()
    player.connect(volume)
    if (stereo) {
      stereo.pan.value = pan
      volume.connect(stereo)
    }
    const out = stereo || volume
    out.connect(audio.ringMix)
    out.connect(audio.wall)
    const voice = { player, volume, stereo }
    audio.voices.add(voice)
    audio.effects.add(voice)
    player.onended = () => audio.cleanup(voice)
    player.start(start)
    player.stop(start + length + 0.006)
  }
}
