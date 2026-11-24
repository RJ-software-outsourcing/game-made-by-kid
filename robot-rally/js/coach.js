import { slots, partFor } from './catalog.js'
import { endurancePercent } from './endurance.js'

export function attemptSummary(match, stage) {
  const [own, rival] = match.robots
  return { stage, rules: match.rules, build: { ...own.build }, own: endurancePercent(own), rival: endurancePercent(rival) }
}
export function compareAttempts(before, after, name) {
  if (!before || before.stage !== after.stage) return ''
  const changed = slots.filter((s) => before.build[s.id] !== after.build[s.id])
  if (!changed.length && before.own === after.own && before.rival === after.rival)
    return 'Same parts, same result. Try changing one part.'
  const lead =
    changed.length === 1 ? 'With ' + partFor(changed[0].id, after.build[changed[0].id]).name + ', ' : ''
  if (before.rival !== after.rival)
    return lead + name + ' finished with ' + after.rival + '% health. Last time it had ' + before.rival + '%.'
  if (before.own !== after.own)
    return lead + 'your bot finished with ' + after.own + '% health. Last time it had ' + before.own + '%.'
  return 'Both bots had the same health left as last time.'
}
export function coachingTip(match, round) {
  const [own, rival] = match.robots
  if (match.winner === 0) {
    if (own.flanks > 0)
      return 'You got past the shield for ' + own.flanks + (own.flanks === 1 ? ' side hit!' : ' side hits!')
    if (own.blocks > 0) return 'Your shield caught ' + own.blocks + (own.blocks === 1 ? ' hit.' : ' hits.')
    if (own.longHits > 0)
      return 'You landed ' + own.longHits + (own.longHits === 1 ? ' hit' : ' hits') + ' from far away.'
    return (
      'Your ' +
      partFor('weapon', own.build.weapon).name +
      ' landed ' +
      own.hits +
      (own.hits === 1 ? ' hit.' : ' hits.')
    )
  }
  const name = round.rival
  if (rival.blocks >= 2) return name + ' blocked ' + rival.blocks + ' of your hits.'
  if (rival.evades >= 2) return name + ' dodged ' + rival.evades + ' of your attacks.'
  if (rival.flanks >= 2) return name + ' hit your open side ' + rival.flanks + ' times.'
  if (rival.longHits) return name + ' landed ' + rival.longHits + (rival.longHits === 1 ? ' hit' : ' hits') + ' from far away.'
  if (own.rests >= 3 && rival.rests < own.rests)
    return name + ' took fewer battery breaks. Your bot needed ' + own.rests + '.'
  if (own.misses > own.hits && rival.hits)
    return name + ' landed ' + rival.hits + (rival.hits === 1 ? ' hit.' : ' hits.') +
      ' Your bot missed ' + own.misses + (own.misses === 1 ? ' attack.' : ' attacks.')
  if (match.winner === 2) return 'Both bots finished with the same health.'
  if (rival.hits > own.hits) return name + ' landed more hits. ' + rival.hits + ' to your ' + own.hits + '.'
  return name + ' kept ' + endurancePercent(rival) + '% of its health.'
}
