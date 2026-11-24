import test from 'node:test'
import assert from 'node:assert/strict'
import { starter, rounds, makeBuild, cost, validBuild } from '../js/catalog.js'
import { createMatch, step, roundSeed, STEP } from '../js/match.js'
import { readCup } from '../js/progress.js'
import { compareLine, rating } from '../js/radar.js'

test('the dotted test-drive range counts only time when the tool can start at that angle and distance', async () => {
  const { startReach, startArc } = await import('../js/match.js')
  const { openingScore, trialTicks } = await import('../js/trial-report.js')
  for (const weapon of [-1, 0, 1, 2, 3]) {
    const build = { ...starter, weapon, brain: 1 }
    const bout = createMatch(build, rounds[0].build, roundSeed(0))
    let reachable = 0
    while (bout.tick < trialTicks && bout.winner === null) {
      const [bot, rival] = bout.robots, before = bot.charge
      step(bout)
      const dx = rival.prevX - bot.prevX, dz = rival.prevZ - bot.prevZ
      const bearing = Math.atan2(dx, dz) - bot.heading
      const angle = Math.abs(Math.atan2(Math.sin(bearing), Math.cos(bearing)))
      const inside = Math.hypot(dx, dz) < startReach(bot) && angle <= startArc(weapon)
      assert.equal(bot.inReach, inside)
      if (!before && bot.charge > 0) assert.ok(inside)
      if (inside) reachable++
    }
    assert.equal(openingScore(build, 0).reachSeconds, Math.round(reachable * STEP * 10) / 10)
  }
})

test('the same bot on either starting mark has the same result for every tool and strategy', () => {
  for (let logic = 0; logic < 4; logic++) {
    for (let weapon = 0; weapon < 4; weapon++) {
      const bot = makeBuild(2, logic, 1, 1, 1, 1, weapon)
      const match = createMatch(bot, { ...bot, chassis: 2 }, 433)
      while (match.winner === null) {
        step(match)
        const [a, b] = match.robots
        assert.ok(Math.abs(a.hp - b.hp) < 1e-8)
        assert.ok(Math.abs(a.energy - b.energy) < 1e-8)
        assert.ok(Math.hypot(a.x + b.x, a.z + b.z) < 1e-7)
      }
      assert.equal(match.winner, 2)
    }
  }
})
test('bubbles fly across the ring and an opponent that moves off the line can avoid one', () => {
  const bot = { ...starter, weapon: 2, lens: 3 }
  const match = createMatch(bot, { ...rounds[0].build, weapon: 0 }, roundSeed(0))
  while (!match.shots.some((s) => s.aimed)) {
    step(match)
    assert.equal(match.winner, null)
  }
  const saved = structuredClone(match),
    shot = match.shots.find((s) => s.aimed)
  const health = match.robots[1].hp
  assert.ok(shot.end - shot.start >= 0.16)
  assert.ok(Math.hypot(shot.tx - shot.x, shot.tz - shot.z) > 1.3)
  function land(m, dodge) {
    while (m.shots.some((s) => s.id === shot.id)) {
      const target = m.robots[1]
      target.x = shot.tx
      target.z = shot.tz + (dodge ? 1.35 : 0)
      assert.equal(target.hp, health)
      step(m)
    }
    assert.ok(m.time - shot.start > STEP * 2)
    return m.events.find((e) => e.side === 0 && e.weapon === 2)
  }
  assert.ok(['hit', 'guard'].includes(land(match, false).kind))
  assert.equal(land(saved, true).kind, 'miss')
  assert.equal(saved.robots[1].hp, health)
})
test('the bell takes time to cross the ring and the brush has a short sweep', () => {
  const eventsFor = (weapon) => {
    const match = createMatch({ ...starter, weapon, cell: 3 }, rounds[0].build, 197),
      events = []
    while (match.winner === null && match.time < 9) {
      step(match)
      for (const e of match.events) if (e.side === 0) events.push({ ...e, t: match.time })
    }
    return events
  }
  const bell = eventsFor(3),
    wave = bell.find((e) => e.kind === 'wave')
  assert.ok(wave)
  const sound = bell.find((e) => e.kind === 'hit' || e.kind === 'guard')
  assert.ok(sound.t - wave.t > STEP * 2)
  const brush = eventsFor(1)
  assert.ok(brush.some((e) => e.kind === 'guard' || e.kind === 'hit'))
  assert.ok(brush.every((e) => e.kind !== 'wave' && e.kind !== 'launch'))
})
test('strategy changes the physical route before any model is drawn', () => {
  const tracks = []
  for (let logic = 0; logic < 4; logic++) {
    const m = createMatch({ ...starter, brain: logic }, rounds[0].build, 197)
    let lateral = 0,
      guardTime = 0,
      reversals = 0,
      last = 0
    while (m.time < 5.5) {
      step(m)
      const p = m.robots[0],
        q = m.robots[1],
        dx = p.x - p.prevX,
        dz = p.z - p.prevZ
      lateral += Math.abs(dz)
      if (p.guard) guardTime += STEP
      const rx = q.x - p.x,
        rz = q.z - p.z,
        len = Math.hypot(rx, rz)
      const side = (rx * dz - rz * dx) / len
      if (Math.abs(side) > 0.006) {
        if (last && Math.sign(side) !== last) reversals++
        last = Math.sign(side)
      }
    }
    tracks.push({ lateral, guardTime, reversals })
  }
  assert.ok(tracks.every((s) => s.lateral > 1.7))
  assert.ok(tracks[2].guardTime > 4)
  assert.ok(tracks[3].reversals >= 3)
  assert.ok(tracks[1].reversals < tracks[3].reversals)
})
test('an old six-part garage keeps its round and receives the starter tool and body', () => {
  const legacy = { ...starter, motor: 1 }
  delete legacy.weapon
  delete legacy.chassis
  const data = { round: 1, build: legacy, edition: 2, champion: false, wins: [] }
  const storage = { getItem: (key) => (key === 'robot-rally.cup.v1' ? JSON.stringify(data) : null) }
  const cup = readCup(storage)
  assert.equal(cup.round, 1)
  assert.equal(cup.edition, 2)
  assert.deepEqual(cup.build, { ...starter, motor: 1 })
  assert.ok(validBuild(cup.build, rounds[1].budget))
  assert.equal(cost(cup.build), 95)
})
test('each equipment category moves exactly its own radar axis on every chassis', () => {
  const basic = rating(starter)
  for (const [axis, id] of ['brain', 'motor', 'cell', 'shell', 'lens', 'weapon'].entries()) {
    const blank = rating({ ...starter, [id]: -1 })
    const equipped = rating({ ...starter, [id]: 3 })
    assert.ok(equipped[axis] > blank[axis])
    assert.deepEqual(
      equipped.filter((_, i) => i !== axis),
      blank.filter((_, i) => i !== axis)
    )
  }
  for (let chassis = 0; chassis < 6; chassis++) {
    assert.deepEqual(rating({ ...starter, chassis }), basic)
    assert.equal(cost({ ...starter, chassis }), cost(starter))
  }
})

test('a shield holds space even with two robots pressed against the rail', async () => {
  const { settleBots } = await import('../js/court-motion.js')
  for (const angle of [0, 0.3, 1.4, 2.8]) {
    for (const shields of [0, 1, 2]) {
      const bots = createMatch(starter, { ...starter, shell: 2 }).robots
      bots.forEach((p, i) => {
        p.x = (3.1 + 0.04 * i) * Math.cos(angle)
        p.z = (3.1 + 0.04 * i) * Math.sin(angle)
        p.heading = angle + i * Math.PI
      })
      settleBots(
        bots,
        bots.map((_, i) => ({ guard: i < shields, aimError: 0.1 }))
      )
      const [a, b] = bots
      assert.ok(bots.every((p) => Math.hypot(p.x, p.z) <= 3.080001))
      const separation = Math.hypot(a.x - b.x, a.z - b.z)
      assert.ok(Math.abs(separation - [1.28, 1.5, 1.64][shields]) < 1e-6)
    }
  }
  const [light, heavy] = createMatch({ ...starter, shell: 0 }, { ...starter, shell: 2 }).robots
  light.x = 0
  heavy.x = 1.18
  settleBots([light, heavy], [{ guard: false }, { guard: true, aimError: 1.5 }])
  assert.ok(Math.abs(light.x) > heavy.x - 1.18)
  assert.ok(Math.abs(heavy.x - light.x - 1.28) < 1e-6)
})

test('eight seconds of different software produces real dashes, side steps and shield blocks', async () => {
  const { openingScore, trialMove } = await import('../js/trial-report.js')
  const [rush, orbit, anchor] = [0, 1, 2].map((logic) => openingScore({ ...starter, brain: logic }, 1))
  assert.ok(rush.dashes > 1 && !orbit.dashes && !anchor.dashes)
  assert.ok(orbit.dodges > 1 && !anchor.dodges)
  assert.ok(anchor.blocks > 1 && !rush.blocks)
  assert.equal(trialMove(orbit, anchor)(orbit), orbit.dodges + ' dodges')
  assert.match(trialMove(rush, rush)(rush), /dodge|dash/)
})

test('both Zigzag taps must land before the booth and log can call a double hit', async () => {
  const { fightLine } = await import('../js/fight-log.js')
  const observed = new Set()
  for (let weapon = 0; weapon < 4; weapon++) for (let stage = 0; stage < 4; stage++) {
    const m = createMatch({ ...starter, brain: 3, motor: 1, weapon }, rounds[stage].build, roundSeed(stage))
    const contacts = new Map()
    let pairs = 0
    while (m.winner === null) {
      step(m)
      for (const e of m.events) {
        if (e.side || !e.burst || !['hit', 'guard', 'miss'].includes(e.kind)) continue
        const earlier = contacts.get(e.burst)
        const landed = earlier?.kind === 'hit' && e.kind === 'hit' && (m.tick - earlier.tick) * STEP <= .69
        assert.equal(Boolean(e.doubleHit), landed)
        if (e.doubleHit) {
          assert.match(fightLine(e, ['Zig', 'Buckler']), /Zig lands two quick hits on Buckler/)
          observed.add(weapon)
          pairs++
        }
        contacts.set(e.burst, { kind: e.kind, tick: m.tick })
      }
    }
    assert.equal(pairs, m.robots[0].doubleHits)
  }
  assert.equal(observed.size, 4)
})

test('ringside rises when a bot is behind the other in any direction', async () => {
  const { ringsideLift } = await import('../js/ringside.js')
  for (const yaw of [0, 0.17, 1.6, 3.9]) {
    const x = Math.sin(yaw),
      z = Math.cos(yaw)
    assert.ok(ringsideLift(x * 1.5, z * 1.5, yaw) > 2.5)
    assert.equal(ringsideLift(z * 1.5, -x * 1.5, yaw), 0)
  }
})

test('stepping aside avoids a live bubble that hits an otherwise identical bot', () => {
  const m = createMatch(starter, rounds[1].build, roundSeed(1))
  // Observe the approaching shot before the steering decision.
  while (m.tick < 164) step(m)
  const shot = m.shots.find((e) => e.side === 1).id
  const originalDodges = m.robots[0].dodges
  const twin = structuredClone(m)
  twin.robots[0].nextManeuver = 10000
  const outcome = (match) => {
    while (match.winner === null) {
      step(match)
      const event = match.events.find((e) => e.shotId === shot)
      if (event) return event.kind
    }
  }
  assert.equal(outcome(m), 'miss')
  assert.equal(outcome(twin), 'hit')
  assert.equal(m.robots[0].evades, twin.robots[0].evades + 1)
  assert.equal(m.robots[0].dodges, originalDodges + 1)
})

test('a near bubble can trigger a sidestep without earning a dodge for an already clear course', async () => {
  const { driveManeuver } = await import('../js/maneuvers.js')
  function threatened(sideSpeed) {
    const match = createMatch(starter, rounds[1].build)
    const [bot, other] = match.robots
    Object.assign(bot, { x: 0, z: 0, vx: sideSpeed, vz: 0, heading: 0 })
    const shot = { side: 1, start: 0, end: .37, x: 0, z: 2, tx: 0, tz: -.5 }
    match.shots = [shot]
    match.time = .1
    driveManeuver(bot, other, 0, match, {}, STEP)
    assert.equal(bot.maneuver, 'dodge')
    return shot.dodgedBy
  }
  assert.equal(threatened(0), 0)
  assert.equal(threatened(3.8), undefined)
})

test('the Battle radar compares rolling speed with the fitted shell on', () => {
  const build = { ...starter, brain: 0, motor: -1, cell: -1, shell: 3, lens: 0, weapon: 0 }
  assert.equal(compareLine(build, rounds[0].build, 'Buckler'), 'Your light shell helps you keep up with Buckler.')
})

test('the same opponent gives the four cores genuinely two-dimensional runs, and fast ranged builds can kite', () => {
  const track = (brain, motor, weapon) => {
    const m = createMatch({ ...starter, brain, motor, weapon }, rounds[0].build, roundSeed(0))
    let xMin = Infinity,
      xMax = -Infinity,
      zMin = Infinity,
      zMax = -Infinity,
      path = 0,
      gap = 0,
      samples = 0
    const sectors = new Set()
    while (m.tick < 240 && m.winner === null) {
      step(m)
      const [p, q] = m.robots
      xMin = Math.min(xMin, p.x)
      xMax = Math.max(xMax, p.x)
      zMin = Math.min(zMin, p.z)
      zMax = Math.max(zMax, p.z)
      path += Math.hypot(p.x - p.prevX, p.z - p.prevZ)
      sectors.add(Math.floor(((Math.atan2(p.z, p.x) + Math.PI) * 4) / Math.PI) % 8)
      if (m.tick > 50) {
        gap += Math.hypot(q.x - p.x, q.z - p.z)
        samples++
      }
    }
    return { width: xMax - xMin, depth: zMax - zMin, sectors: sectors.size, path, gap: gap / samples }
  }
  for (let brain = 0; brain < 4; brain++) {
    const route = track(brain, 0, 0)
    assert.ok(route.width > 2.7 && route.depth > 2.15 && route.sectors >= 5)
  }
  const fast = track(1, 1, 2),
    stock = track(1, 0, 2),
    close = track(1, 1, 0)
  assert.ok(fast.path > stock.path * 1.44)
  assert.ok(fast.gap > close.gap + 0.4)
})

test('trial cards compare the same eight seconds and explain what the selected part changed', async () => {
  const { openingScore, trialDetail, trialSummary } = await import('../js/trial-report.js')
  const slow = openingScore({ ...starter, motor: 0 }, 0)
  const fast = openingScore({ ...starter, motor: 1 }, 0)
  assert.equal(slow.seconds, 8)
  assert.equal(fast.seconds, 8)
  assert.ok(fast.widths > slow.widths)
  assert.match(trialSummary('motor', slow, fast, 'Button Wheels', 'Skates'), /Skates drove farther/)
  assert.ok(trialDetail('motor', slow, fast)[0](fast).includes('ring widths'))
  const lens = trialDetail('lens', slow, fast)[0](fast)
  assert.equal(lens, 'Hits: ' + fast.hits + ' of ' + (fast.hits + fast.misses))
  const short = { ...fast, seconds: 5.4 }
  assert.match(trialSummary('weapon', slow, short, 'Bash Pad', 'Pulse Bell'), /early/)
})

test('Paths keeps arrows on the floor and labels only maneuvers that move the wheels', async () => {
  const { ReplayTrails } = await import('../js/replay-trails.js')
  const paths = new ReplayTrails()
  const bot = { x: 0, z: 0, maneuver: '' }
  const match = { robots: [bot, { ...bot }] }
  const floorMarks = () => Array.from({ length: paths.arrows.count }, (_, i) => paths.arrows.instanceMatrix.array[i * 16 + 14])
  paths.reset(match, true)
  for (let k = 1; k < 77; k++) {
    bot.z = k * .1
    paths.record(match)
  }
  const before = floorMarks().filter(z => z >= 2)
  bot.z += .1
  paths.record(match)
  assert.ok(before.length >= 5)
  assert.ok(before.every(z => floorMarks().includes(z)))

  bot.maneuver = 'dodge'
  for (let k = 0; k < 3; k++) paths.record(match)
  assert.equal(paths.dodges.count, 0)
  for (let k = 0; k < 4; k++) {
    bot.x += .12
    paths.record(match)
  }
  assert.equal(paths.dodges.count, 1)
  // A sidestep to the right leaves an arrow pointing right.
  assert.ok(paths.dodges.instanceMatrix.array[8] > 1)
  bot.maneuver = 'dash'
  bot.z += .3
  paths.record(match)
  assert.equal(paths.dashes.count, 1)
  paths.reset(match, true)
  assert.equal(paths.dashes.count + paths.dodges.count + paths.arrows.count, 0)
})

test('the rematch coach keeps its part advice tied to a real affordable improvement', async () => {
  const { bareBuild, quoteSwap } = await import('../js/catalog.js')
  const { coachingTip } = await import('../js/coach.js')
  const { findPitTip } = await import('../js/pit-tip.js')
  const run = (build, stage) => {
    const bout = createMatch(build, rounds[stage].build, roundSeed(stage))
    const far = [0, 0]
    while (bout.winner === null) {
      step(bout)
      for (const e of bout.events) if (e.kind === 'hit' && e.travel >= 1.55) far[e.side]++
    }
    assert.deepEqual(bout.robots.map(p => p.longHits), far)
    return bout
  }
  for (let stage = 0; stage < rounds.length; stage++) {
    const lost = run(bareBuild(), stage)
    assert.equal(lost.winner, 1)
    assert.doesNotMatch(coachingTip(lost, rounds[stage]), /Try /)
    const tip = await findPitTip(lost, rounds[stage].budget)
    assert.ok(tip?.evidence)
    const swap = quoteSwap(lost.robots[0].build, tip.id, tip.choice, rounds[stage].budget)
    assert.equal(swap.shortfall, 0)
    const follow = tip.nextChange
      ? quoteSwap(swap.next, tip.nextChange.id, tip.nextChange.choice, rounds[stage].budget)
      : swap
    assert.equal(follow.shortfall, 0)
    const tested = run(follow.next, stage)
    assert.equal(tip.wins, tested.winner === 0)
    assert.ok(tip.wins || tested.robots[1].hp < lost.robots[1].hp || tested.robots[0].hp > lost.robots[0].hp)
  }
})

test('trying an empty slot can reveal a winning refit without selling the fitted part', async () => {
  const { bareBuild, quoteSwap } = await import('../js/catalog.js')
  const { findPitTip } = await import('../js/pit-tip.js')
  const fitted = { ...bareBuild(), brain: 0, motor: 1, chassis: 3 }
  const race = (build) => {
    const match = createMatch(build, rounds[0].build, roundSeed(0))
    while (match.winner === null) step(match)
    return match
  }
  const budget = rounds[0].budget
  const lost = race(fitted)
  assert.equal(lost.winner, 1)
  const tip = await findPitTip(lost, budget)
  assert.deepEqual([tip.id, tip.choice, tip.delta, tip.wins], ['brain', -1, -22, true])
  assert.match(tip.evidence, /test without Rush Core/)
  const trial = quoteSwap(fitted, tip.id, tip.choice, budget)
  assert.equal(trial.remaining, 102)
  assert.equal(race(trial.next).winner, 0)
  assert.equal(fitted.brain, 0)
  assert.equal(budget - cost(fitted), 80)
})

test('the coach tests an affordable pair only when a single change falls short', async () => {
  const { bareBuild, quoteSwap, slots } = await import('../js/catalog.js')
  const { findPitTip } = await import('../js/pit-tip.js')
  const fitted = { ...bareBuild(), brain: 2, cell: 0, weapon: 2 }
  const round = rounds[1]
  function run(build) {
    const match = createMatch(build, round.build, roundSeed(1))
    while (match.winner === null) step(match)
    return match
  }
  const lost = run(fitted)
  assert.equal(lost.winner, 1)
  const gap = (match) => match.robots[0].hp / match.robots[0].s.hp - match.robots[1].hp / match.robots[1].s.hp
  for (const { id } of slots) for (let choice = -1; choice < 4; choice++) {
    const quote = quoteSwap(fitted, id, choice, round.budget)
    if (quote.shortfall) continue
    const single = run(quote.next)
    assert.notEqual(single.winner, 0)
    assert.ok(gap(single) < gap(lost) + .08)
  }
  const plan = await findPitTip(lost, round.budget)
  assert.equal(plan.wins, true)
  assert.ok(plan.nextChange)
  const first = quoteSwap(fitted, plan.id, plan.choice, round.budget)
  const second = quoteSwap(first.next, plan.nextChange.id, plan.nextChange.choice, round.budget)
  assert.equal(first.shortfall + second.shortfall, 0)
  assert.equal(second.delta + first.delta, plan.delta)
  assert.equal(run(second.next).winner, 0)
})
