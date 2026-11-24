import { createMatch, roundSeed, step, STEP } from './match.js'
import { partFor, rounds } from './catalog.js'

// A short opening against the real rival lets a child compare one part while
// keeping the other five, the opponent, and the starting positions identical.
export function partTrial(build, slot, index, stage) {
  if (slot !== 'brain' && slot !== 'lens') return null
  const rival = rounds[stage],
    seed = roundSeed(stage)
  const trial = createMatch({ ...build, [slot]: index }, rival.build, seed)
  const original = createMatch(build, rival.build, seed)
  let moment,
    originalMoment,
    best = 0,
    previousPush = -Infinity
  while (trial.tick < Math.round(8 / STEP) && trial.winner === null && original.winner === null) {
    step(trial)
    step(original)
    for (const event of trial.events) {
      if (event.kind === 'charge') continue
      const mine = event.side === 0,
        contact = mine && event.kind !== 'miss'
      let score = mine ? 2 : 1
      if (slot === 'brain') {
        if (index === 0 && contact) score = 4
        if (index === 1 && event.flanking && mine) score = 6
        if (index === 2 && event.kind === 'guard' && !mine) score = 6
        if (index === 3 && mine && trial.tick - previousPush < 0.8 / STEP) score = 6
      } else if (mine) {
        const prior = original.events.find((e) => e.side === 0 && e.kind !== 'charge')
        score = prior && (prior.kind === 'miss') !== (event.kind === 'miss') ? 6 : contact ? 4 : 3
      }
      if (score > best) {
        best = score
        moment = { ...event, tick: trial.tick }
        const prior =
          original.events.find((e) => e.kind !== 'charge' && e.side === event.side) ??
          original.events.find((e) => e.kind !== 'charge')
        const me = original.robots[0]
        originalMoment = prior
          ? { ...prior, tick: original.tick }
          : {
              kind: 'observe',
              side: 0,
              tick: original.tick,
              description: me.rest
                ? 'Your bot is refilling.'
                : me.charge > 0
                  ? 'Your bot is winding up.'
                  : me.guard
                    ? 'Your bot is holding its shield.'
                    : 'Your bot is finding an opening.'
            }
      }
      if (mine) previousPush = trial.tick
    }
  }
  if (!moment) return null
  return {
    final: trial,
    moment,
    slot,
    index,
    original: build[slot],
    originalRun: { final: original, moment: originalMoment },
    seconds: Number(trial.time.toFixed(1)),
    results: [original, trial].map((m) => {
      const p = m.robots[0]
      return { hits: p.hits, misses: p.misses, blocks: p.blocks }
    })
  }
}

export function trialResults(trial) {
  const { slot, index, original, results, seconds } = trial
  const row = (part, result, label) =>
    `<li><span>${label} · ${partFor(slot,part).name}</span><b>${result.hits} hits</b><small>${result.misses} misses · ${result.blocks} blocks</small></li>`
  return `<section class="trial-results" aria-label="Test drive results"><h3 id="trial-heading" tabindex="-1">First ${seconds} seconds</h3><ul>${index === original ? '' : row(original, results[0], 'Fitted')}${row(index, results[1], index === original ? 'Fitted' : 'Trying')}</ul></section>`
}
