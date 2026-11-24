import { rounds } from './catalog.js'
import { createMatch, step, STEP, roundSeed, ORIGINAL_REFILL_RULES } from './match.js'
import { endurancePercent } from './endurance.js'

// Keep only event metadata. Replaying the seeded simulation avoids a video
// download or keeping hundreds of rendered Retina frames in memory.
export function pickMoment(match, events) {
  const side = match.winner === 1 ? 1 : 0
  const rank = (e) => {
    if (e.kind === 'guard' && e.side !== side) return e.reply ? 6 : 4
    if (e.kind === 'miss' && e.side !== side) return e.evaded ? 6 : 1
    if (e.kind === 'hit' && e.side === side) {
      const landed = Math.min(0.9, e.damage / match.robots[1 - side].s.hp)
      return (e.flanking || e.doubleHit ? 6 : e.travel >= 1.55 ? 5 : 3) + landed
    }
    return 0
  }
  return events.reduce((best, e) => (rank(e) > 0 && (!best || rank(e) > rank(best)) ? e : best), null)
}
export function replayMoment(original, moment, seed) {
  const replay = createMatch(original.robots[0].build, original.robots[1].build, seed, original.rules)
  const lead = Math.max(0, moment.tick - Math.round(1.55 / STEP))
  while (replay.tick < lead && replay.winner === null) step(replay)
  return {
    match: replay,
    start: lead,
    initial: copyState(replay),
    until: Math.min(original.tick, moment.tick + Math.round(1.05 / STEP)),
    moment
  }
}

// All match state is plain data. Keep one start position, then reconstruct at
// most 2.6 seconds. Dragging backwards never touches the formal match record.
const copyState = (m) => ({
  ...m,
  waves: m.waves.map((wave) => ({ ...wave })),
  shots: m.shots.map((shot) => ({ ...shot })),
  events: m.events.map((event) => ({ ...event })),
  robots: m.robots.map((robot) => ({ ...robot, previousPose: { ...robot.previousPose } }))
})
export function seekMoment(clip, requested, visit) {
  const tick = Math.max(clip.start, Math.min(clip.until, Math.round(requested)))
  const match = copyState(clip.initial)
  visit?.(match, true, tick)
  while (match.tick < tick && match.winner === null) {
    step(match)
    visit?.(match, false, tick)
  }
  clip.match = match
  return match
}

export function explainMoment(moment, rival, own = 'Your bot') {
  const attacker = moment.side === 0 ? own : rival,
    defender = moment.side === 0 ? rival : own
  if (moment.kind === 'observe') return moment.description
  if (moment.kind === 'guard')
    return defender + (moment.reply ? ' blocked and pushed back!' : ' caught the hit on its shield.')
  if (moment.doubleHit) return attacker + ' landed both taps on ' + defender + '!'
  if (moment.flanking) return attacker + ' got around the shield!'
  if (moment.kind === 'miss') {
    if (moment.evaded)
      return defender + ' dodged ' + attacker + '’s ' + (moment.weapon === 2 ? 'bubble!' : 'swing!')
    if (moment.outOfReach) return attacker + ' swung. ' + defender + ' was out of reach.'
    return attacker + ' missed ' + defender + '.'
  }
  if (moment.weapon === 2)
    return (
      attacker + ' hit ' + defender + ' with a bubble' + (moment.travel >= 1.55 ? ' from far away!' : '.')
    )
  if (moment.weapon === 3) return 'The ring from ' + attacker + ' reached ' + defender + '.'
  if (moment.weapon === 1) return attacker + ' swept in with its brush.'
  return attacker + ' landed a close bump.'
}

export function findMatchMoment(match) {
  const copy = createMatch(match.robots[0].build, match.robots[1].build, match.seed, match.rules)
  const events = []
  while (copy.tick < match.tick && copy.winner === null) {
    step(copy)
    for (const e of copy.events)
      if (['hit', 'guard', 'miss'].includes(e.kind)) events.push({ ...e, tick: copy.tick })
  }
  return pickMoment(match, events)
}

export function recordedHighlight(record, stage) {
  const final = createMatch(record.build, rounds[stage].build, roundSeed(stage), record.rules ?? ORIGINAL_REFILL_RULES)
  const contacts = []
  while (final.winner === null) {
    step(final)
    for (const event of final.events) contacts.push({ ...event, tick: final.tick })
  }
  // An older saved card can outlive a rule change. Only offer a replay when
  // the newly simulated result agrees with the numbers on the original card.
  const [me, rival] = final.robots
  if ('tick' in record) {
    if (
      final.winner !== 0 ||
      final.tick !== record.tick ||
      record.hits !== me.hits ||
      record.blocks !== me.blocks ||
      record.flanks !== me.flanks
    )
      return null
  } else {
    // Older cards could round a surviving robot's last sliver down to 0%.
    const agrees = (value, p) => value === endurancePercent(p) || (value === 0 && (100 * p.hp) / p.s.hp < 0.5)
    if (final.winner === 0 || !agrees(record.own, me) || !agrees(record.rival, rival)) return null
  }
  const moment = pickMoment(final, contacts)
  return moment ? { final, moment } : null
}
