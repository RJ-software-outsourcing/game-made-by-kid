// Evaluate the retail catalogue through the same fixed-step bout used on screen.
import { cost, parts, rounds, slots } from '../js/catalog.js'
import { createMatch, step } from '../js/match.js'

function* choices(build = {}, slot = 0) {
  if (slot === slots.length) {
    yield { ...build }
    return
  }
  const { id } = slots[slot]
  for (let index = -1; index < parts[id].length; index++) {
    build[id] = index
    yield* choices(build, slot + 1)
  }
}

const scores = rounds.map((r) => ({
  stage: r.stage,
  budget: r.budget,
  legal: 0,
  wins: 0,
  draws: 0,
  lowest: Infinity,
  tactics: Array(5).fill(0)
}))
let openingSweep = 0
for (const build of choices()) {
  const price = cost(build)
  let successes = 0
  for (const [stage, rival] of rounds.entries()) {
    if (price > rival.budget) continue
    const report = scores[stage]
    report.legal++
    const match = createMatch(build, rival.build, 197 + stage * 101)
    while (match.winner === null) step(match)
    if (match.winner === 2) report.draws++
    if (match.winner !== 0) continue
    successes++
    report.wins++
    report.tactics[build.brain+1]++
    report.lowest = Math.min(report.lowest, price)
  }
  if (price <= rounds[0].budget && successes === rounds.length) openingSweep++
}
console.table(
  scores.map((s) => ({
    Round: s.stage,
    Budget: s.budget,
    Affordable: s.legal,
    Wins: s.wins,
    Draws: s.draws,
    'Cheapest win': s.lowest,
    ...Object.fromEntries(['Bare',...parts.brain.map(p=>p.name)].map((name,i)=>[name,s.tactics[i]]))
  }))
)
console.log('Opening-budget builds that can sweep the cup: ' + openingSweep)
if (openingSweep || scores.some((s) => !s.wins)) process.exitCode = 1
