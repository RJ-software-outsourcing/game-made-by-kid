import { supportedRules } from './match.js'
import { paintById } from './palette.js'
import { rounds, cupRound, bareBuild, validBuild, normalizeBuild } from './catalog.js'

const KEY = 'robot-rally.cup.v1'
const AUDIO_KEY = 'robot-rally.audio.v1'
export const freshCup = () => ({
  finalBudget: rounds.at(-1).budget,
  edition: 1,
  round: 0,
  build: bareBuild(3),
  champion: false,
  muted: false,
  voice: false,
  announcer: true,
  wins: [],
  lastTry: null
})
function victories(value) {
  const count = value.round + (value.champion === true && value.round === rounds.length - 1 ? 1 : 0)
  const wins = []
  for (let stage = 0; stage < count; stage++) {
    const entry = value.wins?.[stage]
    const build = normalizeBuild(entry?.build)
    if (!entry || !validBuild(build, cupRound(value, stage).budget)) continue
    if (
      !['hits', 'blocks', 'flanks', 'tick'].every(
        (key) => Number.isSafeInteger(entry[key]) && entry[key] >= 0 && entry[key] <= 1080
      )
    )
      continue
    const paint = paintById(entry.paint)
    wins[stage] = {
      ...(supportedRules(entry.rules) ? { rules: entry.rules } : {}),
      ...(paint ? { paint: paint[0] } : {}),
      build,
      hits: entry.hits,
      blocks: entry.blocks,
      flanks: entry.flanks,
      tick: entry.tick
    }
  }
  return wins
}
function lastAttempt(value, round) {
  const item = value.lastTry
  const build = normalizeBuild(item?.build)
  if (!item || item.stage !== value.round || !validBuild(build, round.budget)) return null
  if (![item.own, item.rival].every((n) => Number.isInteger(n) && n >= 0 && n <= 100)) return null
  return { stage: item.stage, ...(supportedRules(item.rules) ? { rules: item.rules } : {}),
    build, own: item.own, rival: item.rival }
}
function readAudio(storage, fallback) {
  try {
    const v = JSON.parse(storage.getItem(AUDIO_KEY))
    if (v?.version === 1 && typeof v.muted === 'boolean' && typeof v.voice === 'boolean')
      return { muted: v.muted, voice: v.voice, announcer: v.announcer !== false }
  } catch {}
  return {
    muted: fallback?.muted === true,
    voice: fallback?.voice === true,
    announcer: fallback?.announcer !== false
  }
}

export function saveAudio(storage, cup) {
  try {
    storage.setItem(
      AUDIO_KEY,
      JSON.stringify({ version: 1, muted: cup.muted, voice: cup.voice, announcer: cup.announcer !== false })
    )
    return true
  } catch {
    return false
  }
}

export function readCup(storage) {
  let cup = freshCup()
  try {
    const value = JSON.parse(storage.getItem(KEY))
    if (value && typeof value === 'object')
      value.finalBudget = value.finalBudget === undefined || value.finalBudget === 235 ? 235 : rounds.at(-1).budget
    const r = cupRound(value)
    const build = normalizeBuild(value?.build)
    if (Number.isInteger(value?.round) && r && validBuild(build, r.budget)) {
      cup = {
        finalBudget: value.finalBudget,
        edition: Number.isSafeInteger(value.edition) && value.edition > 0 ? value.edition : 1,
        round: value.round,
        build,
        champion: value.champion === true && value.round === rounds.length - 1,
        muted: value.muted === true,
        voice: value.voice === true,
        announcer: value.announcer !== false,
        wins: victories(value),
        lastTry: lastAttempt(value, r)
      }
    }
  } catch {}
  return { ...cup, ...readAudio(storage, cup) }
}

export function saveCup(storage, cup, change = 'progress') {
  try {
    const existing = readCup(storage)
    if (isAhead(existing, cup)) return true
    let next = cup
    if (
      existing.edition === cup.edition &&
      existing.round === cup.round &&
      existing.champion === cup.champion
    ) {
      // A receipt edits the whole affordable loadout. A result edits a match
      // record. Separate tabs can do both without losing either change.
      if (change === 'build') next = { ...cup, lastTry: existing.lastTry, wins: existing.wins }
      if (change === 'record') next = { ...cup, build: existing.build }
    }
    storage.setItem(KEY, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

// Apply the selected shop action to the most recent wallet and equipment.
// A Safari window can wake with old buttons still on screen. Rechecking the
// actual slot before writing also keeps a second tap from refunding it twice.
export function garageReceipts(storage) {
  let unsaved
  return (cup, choose) => {
    let raw
    try {
      raw = storage?.getItem(KEY)
    } catch {}
    const stored = raw && raw !== unsaved ? readCup(storage) : cup
    if (isAhead(stored, cup)) return { cup: stored, applied: false }
    const base = isAhead(cup, stored) ? cup : stored
    const budget = cupRound(base).budget
    const build = choose(base.build, budget)
    if (!build || !validBuild(build, budget)) return { cup: base, applied: false }
    const updated = { ...base, build }
    try {
      storage?.setItem(KEY, JSON.stringify(updated))
      unsaved = undefined
    } catch {
      // Keep playing from memory if this device cannot write another save.
      unsaved = raw
    }
    return { cup: updated, applied: true }
  }
}

export function isAhead(other, cup) {
  return (
    other.edition > cup.edition ||
    (other.edition === cup.edition &&
      (other.round > cup.round || (other.round === cup.round && other.champion && !cup.champion)))
  )
}
export const isCupKey = (key) => key === KEY

export const isAudioKey = (key) => key === AUDIO_KEY
