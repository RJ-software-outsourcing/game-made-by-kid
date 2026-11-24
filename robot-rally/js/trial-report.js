import { createMatch, roundSeed, step, STEP } from './match.js'
import { rounds } from './catalog.js'
import { drivingRadius } from './court-motion.js'
export const trialTicks = Math.round(8 / STEP)
export function openingScore(build, stage) {
  const match = createMatch(build, rounds[stage].build, roundSeed(stage))
  const run = trialRun()
  sampleRoute(match, run)
  while (match.tick < trialTicks && match.winner === null) {
    step(match)
    sampleRoute(match, run)
  }
  return trialScore(match, run)
}

export function trialRun() {
  return { route: [], distance: 0, biggest: 0, left: 0, right: 0, reachTicks: 0 }
}

export function trialScore(match, run) {
  const bot = match.robots[0]
  return {
    route: run.route,
    seconds: Math.round(match.time * 10) / 10,
    // Distance around corners counts too. One width spans the two farthest
    // places a drive base can reach on opposite sides of the ring.
    widths: Math.round((10 * run.distance) / (2 * drivingRadius)) / 10,
    biggest: Math.min(100, Math.round((100 * run.biggest) / match.robots[1].s.hp)),
    health: Math.round((100 * bot.hp) / bot.s.hp),
    refills: bot.rests,
    misses: bot.misses,
    hits: bot.hits,
    power: Math.round((100 * bot.energy) / bot.s.capacity),
    dodges: bot.dodges,
    dashes: bot.dashes,
    blocks: bot.blocks,
    brain: bot.build.brain,
    left: run.left,
    right: run.right,
    farHits: bot.longHits,
    reachSeconds: Math.round(run.reachTicks * STEP * 10) / 10
  }
}
// Give the child one movement to look for when replaying the other part.
export function trialMove(before, after) {
  const moves = [
    ['dodges', 'dodge', 'dodges'],
    ['dashes', 'dash', 'dashes'],
    ['blocks', 'block', 'blocks']
  ]
  const move = moves.find(([key]) => before[key] !== after[key]) || moves.find(([key]) => after[key] > 0)
  if (!move) return null
  const [key, single, plural] = move
  return (report) => report[key] + ' ' + (report[key] === 1 ? single : plural)
}

export function sampleRoute(match, run) {
  const [p, rival] = match.robots
  if (p.inReach) run.reachTicks++
  const dx = p.x - p.prevX, dz = p.z - p.prevZ
  run.distance += Math.hypot(dx, dz)
  // Measure the wheels' sideways travel relative to the line of sight at
  // the start of this step. A rival driving past a stationary bot adds zero.
  if (p.tactic === 'Circle wide' || p.tactic === 'Cut left' || p.tactic === 'Cut right') {
    const x = rival.prevX - p.prevX, z = rival.prevZ - p.prevZ
    const sideways = (dz * x - dx * z) / (Math.hypot(x, z) || 1)
    if (sideways < 0) run.left -= sideways
    else run.right += sideways
  }
  for (const event of match.events) {
    const damage = event.side === 0 ? event.damage : event.reply
    if (damage > run.biggest) run.biggest = damage
  }
  if (!(match.tick % 5) || match.winner !== null) run.route.push([p.x, p.z])
}

const count = (n, noun) => n + ' ' + noun + (n === 1 ? '' : 's')
export function trialDetail(slot, before, after) {
  const moves = trialMove(before, after)
  const hits = (v) => count(v.hits, 'hit')
  const distance = (v) => count(v.widths, 'ring width')
  const power = (v) => v.power + '% power left'
  const shell = (v) => v.health + '% health left'
  const rows = {
    pair: [hits, shell, distance],
    brain: [moves, hits, distance],
    motor: [distance, hits, power],
    cell: [power, (v) => count(v.refills, 'refill'), hits],
    shell: [shell, distance, hits],
    lens: [(v) => 'Hits: ' + v.hits + ' of ' + (v.hits + v.misses), distance, power],
    weapon: [hits, (v) => 'Biggest hit: ' + v.biggest + '% health', (v) => v.reachSeconds + ' sec in reach']
  }
  return rows[slot].filter(Boolean)
}

export function trialSummary(slot, before, after, fitted, candidate) {
  if (fitted === candidate) return 'This is the part on your bot.'
  if (before.seconds < 8 || after.seconds < 8) return 'A bot went down early. Check how long each run lasted.'
  if (slot === 'pair') {
    if (before.dodges !== after.dodges)
      return 'With both changes, your bot made ' + count(after.dodges, 'sidestep') + '. Before, it made ' + before.dodges + '.'
    if (before.hits !== after.hits)
      return 'With both changes, your bot landed ' + count(after.hits, 'hit') + '. Before, it landed ' + before.hits + '.'
    return 'Your bot kept ' + after.health + '% health with both changes and ' + before.health + '% before.'
  }
  if (slot === 'brain') {
    if (after.brain === 0 && after.dashes) return candidate + ' dashed in ' + count(after.dashes, 'time') + '.'
    if (after.brain === 1 && Math.max(after.left, after.right) >= 1.5)
      return candidate + ' swept around the other bot.'
    if (after.brain === 2 && after.blocks) return candidate + ' blocked ' + count(after.blocks, 'hit') + '.'
    if (after.brain === 3 && Math.min(after.left, after.right) >= 0.5)
      return candidate + ' cut left and right.'
    if (after.dodges > before.dodges) return candidate + ' tried more dodges.'
  }
  if (slot === 'weapon' && before.reachSeconds !== after.reachSeconds)
    return (after.reachSeconds > before.reachSeconds ? candidate : fitted) + ' kept the rival in reach for longer.'
  if (slot === 'weapon' && before.farHits !== after.farHits)
    return (after.farHits > before.farHits ? candidate : fitted) + ' landed more hits from far away.'
  const [key, action] = {
    brain: ['hits', 'landed more hits'],
    motor: ['widths', 'drove farther'],
    cell: ['power', 'had more power left'],
    shell: ['health', 'kept more health'],
    lens: ['hits', 'landed more hits'],
    weapon: ['biggest', 'made the biggest hit']
  }[slot]
  if (before[key] !== after[key])
    return (before[key] > after[key] ? fitted : candidate) + ' ' + action + ' this time.'
  if (before.hits !== after.hits)
    return (before.hits > after.hits ? fitted : candidate) + ' landed more hits this time.'
  return 'Both parts landed ' + (after.hits === 1 ? 'one hit' : after.hits + ' hits') + ' this time.'
}
export function routeMap(route) {
  if (!route?.length) return ''
  const coords = route.map(([x, z]) => [(50 + 14 * x).toFixed(1), (50 + 14 * z).toFixed(1)])
  const [sx, sy] = coords[0],
    [ex, ey] = coords.at(-1)
  // Samples arrive every five fixed ticks. Put arrows two seconds apart
  // so a child can see which way each turn goes and where the bot slowed.
  let arrows = ''
  const interval = Math.round(2 / (5 * STEP))
  for (let i = interval; i < coords.length - 2; i += interval) {
    const [x, y] = coords[i], [ax, ay] = coords[i - 1], [bx, by] = coords[i + 1]
    const dx = bx - ax, dy = by - ay
    if (Math.hypot(dx, dy) < 2.5) continue
    const degrees = (Math.atan2(dy, dx) * 180) / Math.PI
    arrows += '<path transform="translate(' + x + ' ' + y + ') rotate(' + degrees.toFixed(1) +
      ')" d="M-2.8 -2.6 1.9 0 -2.8 2.6" fill="none" stroke="#d5fff1" stroke-width="1.8" stroke-linejoin="round"/>'
  }
  return (
    '<svg class="trial-route" viewBox="0 0 100 100" role="img" aria-label="Path across the arena. The flag marks the finish."><circle cx="50" cy="50" r="46" fill="#24383b" stroke="#94a79b"/><path d="M6 50h88M50 6v88" stroke="#516464" stroke-dasharray="2 4"/><polyline fill="none" stroke="#83e4cb" stroke-width="2" stroke-linejoin="round" points="' +
    coords.map((p) => p.join(',')).join(' ') +
    '"/>' + arrows + '<circle cx="' +
    sx +
    '" cy="' +
    sy +
    '" r="3" fill="#24383b" stroke="#ecf1d7"/><g transform="translate(' +
    ex +
    ' ' +
    ey +
    ')"><path d="M0 2v-9l7 2-7 2" fill="#ffd77e" stroke="#ffd77e" stroke-width="1.5"/></g></svg>'
  )
}
