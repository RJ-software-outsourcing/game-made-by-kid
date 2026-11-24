import { slots, parts, partFor, quoteSwap } from './catalog.js'
import { createMatch, step } from './match.js'
import { endurancePercent } from './endurance.js'

const margin = (m) => m.robots[0].hp / m.robots[0].s.hp - m.robots[1].hp / m.robots[1].s.hp
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0))

// Test one change first. Only a build with no useful single refit needs the
// second pass, where a motor, tool or other part can help its partner work.
export async function findPitTip(final, budget, cancelled = () => false) {
  if (final.winner === 0) return null
  const threshold = margin(final) + 0.08
  const [own, rival] = final.robots
  const changes = []
  for (const { id } of slots) {
    for (let choice = -1; choice < parts[id].length; choice++) {
      if (choice === own.build[id]) continue
      const { delta } = quoteSwap(own.build, id, choice, budget)
      changes.push({ id, choice, delta })
    }
  }
  // Making the cheaper trade first also makes both steps payable when one
  // of them frees up the coins needed for the other.
  changes.sort((a, b) => a.delta - b.delta)
  let slice = performance.now()
  async function tryPlans(plans) {
    let best = null
    for (const plan of plans) {
      const first = plan[0]
      let build = own.build
      for (const change of plan) {
        const quote = quoteSwap(build, change.id, change.choice, budget)
        if (quote.shortfall) { build = null; break }
        build = quote.next
      }
      if (!build) continue
      const trial = createMatch(build, rival.build, final.seed)
      while (trial.winner === null) {
        step(trial)
        if (trial.tick % 64 === 0 && performance.now() - slice >= 3) {
          await nextTask()
          if (cancelled()) return null
          slice = performance.now()
        }
      }
      const score = margin(trial), wins = trial.winner === 0
      if (!wins && (score < threshold || (best && score <= best.score))) continue
      const tested = plan.map(({ id, choice }, index) => {
        const name = choice < 0 ? partFor(id, own.build[id]).name : parts[id][choice].name
        if (index && (choice < 0) === (first.choice < 0)) return name
        return (choice < 0 ? 'without ' : 'with ') + name
      }).join(' and ')
      best = {
        ...first, wins, delta: plan.reduce((sum, change) => sum + change.delta, 0), score,
        evidence: testFinding(first.id, tested, final, trial),
        ...(plan.length > 1 ? { nextChange: plan[1] } : {})
      }
      if (wins) break
    }
    return best
  }
  const one = await tryPlans(changes.map((change) => [change]))
  if (one || cancelled()) return one
  const pairs = []
  for (const [index, a] of changes.entries())
    for (const b of changes.slice(index + 1))
      if (a.id !== b.id) pairs.push([a, b])
  const price = ([a, b]) => a.delta + b.delta
  pairs.sort((a, b) => price(a) - price(b))
  return tryPlans(pairs)
}

// Report something that happened with just this part changed in the same
// bout. A part can help for a different reason against another opponent.
function testFinding(slot, tested, before, after) {
  const a = before.robots[0], b = after.robots[0]
  const lead = 'In a test ' + tested + ', your bot '
  const more = (key, phrase) => b[key] > a[key] ? lead + phrase + ' (' + a[key] + ' → ' + b[key] + ').' : ''
  if (slot === 'cell' && b.rests < a.rests)
    return lead + 'took fewer battery breaks (' + a.rests + ' → ' + b.rests + ').'
  if (slot === 'shell' && endurancePercent(b) > endurancePercent(a))
    return lead + 'kept more health (' + endurancePercent(a) + '% → ' + endurancePercent(b) + '%).'
  return more('flanks', 'got past the shield more often') ||
    more('evades', 'dodged more hits') || more('longHits', 'landed more hits from far away') ||
    more('blocks', 'blocked more hits') || more('hits', 'landed more hits') ||
    (endurancePercent(after.robots[1]) < endurancePercent(before.robots[1])
      ? 'In a test ' + tested + ', the rival had less health left (' + endurancePercent(before.robots[1]) +
        '% → ' + endurancePercent(after.robots[1]) + '%).'
      : endurancePercent(b) > endurancePercent(a)
        ? lead + 'finished with more health (' + endurancePercent(a) + '% → ' + endurancePercent(b) + '%).'
        : after.winner === 0 ? lead + 'won the test bout.' : lead + 'finished closer to the rival.')
}
