import { cost, makeBuild, rounds, withPart } from './catalog.js'
import { createMatch, step } from './match.js'
import { pickMoment } from './replay.js'

const entrant = (name, blueprint, order) => ({ name, blueprint, order })
const b = makeBuild
// Each pit crew has a fixed shopping list. Between rounds it buys the next
// affordable change from that list using the same six shelves as the player.
const roster = [
  { name: 'Your bot', player: true },
  entrant('Buckler', rounds[0].build, ['shell', 'brain', 'lens', 'motor', 'cell', 'weapon']),
  entrant('Bubble', b(2, 2, 1, 1, 1, 0), ['brain', 'shell', 'cell', 'motor', 'lens', 'weapon']),
  entrant('Whirl', rounds[1].build, ['brain', 'motor', 'lens', 'shell', 'cell', 'weapon']),
  entrant('Bramble', rounds[2].build, ['motor', 'brain', 'shell', 'cell', 'lens', 'weapon']),
  entrant('Bean', b(0, 0, 0, 1, 1, 1), ['shell', 'motor', 'cell', 'brain', 'lens', 'weapon']),
  entrant('Chestnut', b(1, 0, 1, 0, 2, 1), ['brain', 'motor', 'shell', 'lens', 'cell', 'weapon']),
  entrant('Spark', b(0, 3, 1, 1, 0, 0), ['brain', 'motor', 'cell', 'shell', 'lens', 'weapon']),
  entrant('Goldcap', rounds[3].build, ['motor', 'brain', 'shell', 'lens', 'cell', 'weapon']),
  entrant('Dot', b(1, 0, 0, 1, 1, 1), ['brain', 'cell', 'motor', 'shell', 'lens', 'weapon']),
  entrant('Mint', b(2, 1, 0, 2, 1, 0), ['brain', 'cell', 'motor', 'shell', 'lens', 'weapon']),
  entrant('Acorn', b(1, 3, 0, 1, 1, 2), ['shell', 'brain', 'lens', 'cell', 'motor', 'weapon']),
  entrant('Sugar', b(1, 2, 2, 0, 1, 1), ['shell', 'brain', 'motor', 'cell', 'lens', 'weapon']),
  entrant('Chime', b(0, 0, 1, 2, 1, 1), ['motor', 'cell', 'shell', 'brain', 'lens', 'weapon']),
  entrant('Marble', b(1, 1, 1, 1, 0, 0), ['motor', 'brain', 'cell', 'lens', 'shell', 'weapon']),
  entrant('Mochi', b(1, 0, 0, 2, 2, 0), ['shell', 'cell', 'brain', 'lens', 'motor', 'weapon'])
]
const goldcapQualifiers = [b(2, 2, 0, 0, 1, 0, 3, 5), b(2, 2, 1, 0, 0, 1, 3, 5), b(2, 2, 2, 0, 2, 2, 3, 5)]
function shoppingList(crew, budget) {
  const stage = rounds.findIndex((r) => r.budget === budget)
  if (crew.name === 'Goldcap' && goldcapQualifiers[stage]) return goldcapQualifiers[stage]
  let build = b(0, 0, 0, 0, 0, 0, 0, crew.blueprint.chassis)
  for (const id of crew.order) {
    const proposed = withPart(build, id, crew.blueprint[id])
    if (cost(proposed) <= budget) build = proposed
  }
  return build
}
function offstageHeat(left, right, round, index) {
  const cap = rounds[round].budget,
    a = shoppingList(left, cap),
    b = shoppingList(right, cap)
  for (let leg = 0; ; leg++) {
    const m = createMatch(a, b, 5911 + round * 239 + index * 53 + leg)
    const events = []
    while (m.winner === null) {
      step(m)
      for (const e of m.events) events.push({ ...e, tick: m.tick })
    }
    // Three tied heats use the original draw order as the last tiebreaker.
    if (m.winner < 2 || leg === 2) return { final: m, moment: pickMoment(m, events), legs: leg + 1 }
  }
}
const enamel = ['#3d9a90', '#9b72a8', '#658250', '#bd7259', '#4c729b', '#aa5971', '#7d965b']
export function crewColor(name) {
  const team = rounds.find((r) => r.rival === name)
  return team?.color ?? enamel[roster.findIndex((crew) => crew.name === name) % enamel.length]
}
export function buildBracket() {
  let field = roster
  return rounds.map((_, r) => {
    const fixtures = [],
      winners = []
    for (let i = 0; i < field.length; i += 2) {
      const left = field[i],
        right = field[i + 1]
      const heat = left.player ? null : offstageHeat(left, right, r, i / 2)
      const winner = heat?.final.winner === 1 ? right : left
      fixtures.push({
        left: left.name,
        right: right.name,
        winner: winner.name,
        heat,
        build: left.player ? shoppingList(right, rounds[r].budget) : null
      })
      winners.push(winner)
    }
    field = winners
    return fixtures
  })
}
