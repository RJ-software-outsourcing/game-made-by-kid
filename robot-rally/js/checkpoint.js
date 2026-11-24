import { paintById } from './palette.js'
import { rounds, cupRound, slots, validBuild } from './catalog.js'
import { TIME_LIMIT, STEP, roundSeed, MATCH_RULES, supportedRules } from './match.js'
const key = 'robot-rally.interrupted.v1'
const devicePrefix = 'robot-rally.race.v1.'

function get(storage, name) {
  try {
    return storage?.getItem(name)
  } catch {
    return null
  }
}
function put(storage, name, value) {
  try {
    if (value === null) storage?.removeItem(name)
    else storage?.setItem(name, value)
  } catch {}
}
function parse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
function tickFor(data, cup, allowWorkshopChanges = false) {
  if (!data || cup.champion || data.edition !== cup.edition || data.round !== cup.round) return null
  if (!supportedRules(data.rules) || data.seed !== roundSeed(cup.round)) return null
  if (!slots.every((s) => data.rival?.[s.id] === rounds[cup.round].build[s.id])) return null
  if ((data.rival?.chassis ?? 0) !== (rounds[cup.round].build.chassis ?? 0)) return null
  if (!Number.isSafeInteger(data.tick) || data.tick < 0 || data.tick > Math.ceil(TIME_LIMIT / STEP))
    return null
  if (!validBuild(data.build, cupRound(cup).budget)) return null
  if (!allowWorkshopChanges && !slots.every((s) => data.build[s.id] === cup.build[s.id])) return null
  if (!allowWorkshopChanges && (data.build.chassis ?? 0) !== (cup.build.chassis ?? 0)) return null
  return data.tick
}
export function checkpoint(storage, cup, match, source) {
  const raw = match
    ? JSON.stringify({
        round: cup.round,
        edition: cup.edition,
        build: match.robots[0].build,
        rival: match.robots[1].build,
        rules: match.rules ?? MATCH_RULES,
        seed: match.seed,
        tick: match.tick,
        paint: match.paint,
        ...source
      })
    : null
  put(storage, key, raw)
  return raw
}
function snapshot(data, tick) {
  const paint = paintById(data.paint)
  return { tick, build: data.build, ...(paint ? { paint: paint[0] } : {}),
    ...(data.rules !== MATCH_RULES ? { rules: data.rules } : {}) }
}
export function interruptedTick(storage, cup) {
  return tickFor(parse(get(storage, key)), cup)
}

// iPadOS can discard an entire Safari window. Keep a small device copy per
// open game, while giving a surviving tab its own position first.
export function raceResume(session, device) {
  const owner =
    globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2)
  const deviceKey = devicePrefix + owner
  let offer = null
  function consumeOffer() {
    if (offer && get(device, offer.name) === offer.raw) put(device, offer.name, null)
    offer = null
  }
  function save(cup, match) {
    consumeOffer()
    const raw = checkpoint(session, cup, match, { owner, updated: Date.now() })
    put(device, deviceKey, raw)
  }
  function scan(cup, allowWorkshopChanges) {
    offer = null
    const tabRaw = get(session, key),
      tab = parse(tabRaw)
    const tabTick = tickFor(tab, cup, allowWorkshopChanges)
    if (tabTick !== null) {
      if (typeof tab.owner === 'string') offer = { name: devicePrefix + tab.owner, raw: tabRaw }
      return snapshot(tab, tabTick)
    }
    let latest = -1,
      result = null
    try {
      for (let i = device.length - 1; i >= 0; i--) {
        const name = device.key(i)
        if (!name?.startsWith(devicePrefix)) continue
        const raw = get(device, name),
          data = parse(raw)
        if (
          !data ||
          data.edition < cup.edition ||
          (data.edition === cup.edition && (data.round < cup.round || cup.champion))
        ) {
          put(device, name, null)
          continue
        }
        const next = tickFor(data, cup, allowWorkshopChanges)
        if (
          next !== null &&
          Number.isFinite(data.updated) &&
          (data.updated > latest || (data.updated === latest && next > result?.tick))
        ) {
          latest = data.updated
          result = snapshot(data, next)
          offer = { name, raw }
        }
      }
    } catch {}
    return result
  }
  return {
    save,
    find: (cup) => scan(cup, false)?.tick ?? null,
    // A different window can change the shared workshop while this robot is
    // already competing. The running robot keeps its original loadout.
    findMatch: (cup) => scan(cup, true)
  }
}
