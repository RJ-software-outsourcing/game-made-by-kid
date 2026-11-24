import { cost, rounds, slots, validBuild } from './catalog.js'
import { MATCH_RULES, ORIGINAL_REFILL_RULES, REFILL_RULES, supportedRules } from './match.js'

const prefix = (stage, rules = MATCH_RULES) =>
  'robot-rally.savings.' +
  rules +
  '.' +
  stage +
  '.' +
  slots.map((s) => rounds[stage].build[s.id]).join('') +
  '.'

// A price has its own small slot. If two tabs win at different prices at
// once, the more expensive result cannot overwrite the cheaper blueprint.
export function cheapestWin(storage, stage, budget = rounds[stage]?.budget) {
  const round = rounds[stage]
  if (!storage || !round) return null
  const books = [MATCH_RULES, REFILL_RULES, ORIGINAL_REFILL_RULES].map(rules => prefix(stage, rules))
  try {
    for (let price = 0; price <= budget; price++) {
      for (const book of books) {
        const raw = storage.getItem(book + price)
        if (!raw) continue
        let row
        try { row = JSON.parse(raw) } catch { continue }
        if (Number.isSafeInteger(row?.edition) && row.edition > 0 &&
            validBuild(row.build, budget) && cost(row.build) === price)
          return { edition: row.edition, build: row.build, price }
      }
    }
  } catch {}
  return null
}

export function rememberWin(storage, stage, edition, build, budget = rounds[stage]?.budget, rules = MATCH_RULES) {
  if (
    !storage ||
    !Number.isSafeInteger(edition) ||
    edition < 1 ||
    !rounds[stage] || !supportedRules(rules) ||
    !validBuild(build, budget)
  )
    return null
  const previous = cheapestWin(storage, stage, budget),
    price = cost(build)
  if (previous && previous.price <= price) return null
  try {
    storage.setItem(prefix(stage, rules) + price, JSON.stringify({ edition, build }))
    return previous ? previous.price - price : 0
  } catch {
    return null
  }
}
