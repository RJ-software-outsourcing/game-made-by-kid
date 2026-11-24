import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cost,
  buyPart,
  sellPart,
  partFor,
  bareBuild,
  rounds,
  cupRound,
  slots,
  starter,
  makeBuild,
  parts,
  validBuild
} from '../js/catalog.js'
import { createMatch, step, STEP, TIME_LIMIT, roundSeed, MATCH_RULES, REFILL_RULES, ORIGINAL_REFILL_RULES } from '../js/match.js'
import { driveState } from '../js/drive.js'
import { stats } from '../js/catalog.js'
import { wheelState, rollWheels } from '../js/wheel-motion.js'
import { RenderQuality } from '../js/render-quality.js'
import { createTest, advanceTest } from '../js/bench.js'
import { attemptSummary, compareAttempts } from '../js/coach.js'
import { explainMoment, pickMoment, replayMoment, recordedHighlight } from '../js/replay.js'
import { buildBracket } from '../js/bracket.js'
import { draw as tournamentDraw } from '../js/tournament-draw.js'
import { checkpoint, interruptedTick, raceResume } from '../js/checkpoint.js'
import { freshCup, readCup, saveCup, saveAudio } from '../js/progress.js'

function duel(build, n) {
  const r = rounds[n],
    m = createMatch(build, r.build, 197 + n * 101)
  while (m.winner === null) {
    step(m)
    for (const p of m.robots) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z) && Math.hypot(p.x, p.z) < 3.081)
      assert.ok(p.energy >= 0 && p.energy <= p.s.capacity)
      assert.ok(p.hp >= 0 && p.hp <= p.s.hp)
    }
    assert.ok(m.time <= TIME_LIMIT + STEP)
  }
  return m
}
test('every opponent uses a legal shop build with the same spending cap', () => {
  assert.equal(slots.length, 6)
  for (const s of slots) {
    assert.equal(parts[s.id].length, 4)
    for (const p of parts[s.id]) assert.ok(p.price > 0 && p.description.length > 6)
  }
  rounds.forEach((r, i) => {
    assert.ok(validBuild(r.build, r.budget))
    assert.ok(!i || rounds[i - 1].budget < r.budget)
  })
})
test('the opening scout clue changes a losing build into a winning one', () => {
  assert.equal(duel(bareBuild(), 0).winner, 1)
  const flank = { ...starter, brain: 1 },
    m = duel(flank, 0)
  assert.equal(m.winner, 0)
  assert.ok(m.robots[0].flanks > 0)
  assert.deepEqual(m, duel(flank, 0))
})
test('the whole cup has affordable winning builds and every match terminates', () => {
  const builds = [
    makeBuild(0, 0, 0, 0, 0, 0, 0),
    makeBuild(0, 1, 0, 0, 0, 0, 3),
    makeBuild(0, 1, 0, 1, 2, 0, 3),
    makeBuild(0, 0, 2, 0, 3, 1, 1)
  ]
  for (const [i, b] of builds.entries()) {
    assert.ok(validBuild(b, rounds[i].budget))
    assert.equal(duel(b, i).winner, 0)
    assert.ok(duel(b, i).time <= 36)
  }
})
test('a draw at simultaneous zero stamina never advances a robot', () => {
  const m = createMatch(starter, starter)
  m.robots.forEach((p) => {
    p.hp = 0
  })
  step(m)
  assert.equal(m.winner, 2)
})
test('the refill mark can power the fitted tool on every battery and core', () => {
  for (let brain = -1; brain < 4; brain++)
    for (let cell = -1; cell < 4; cell++)
      for (let weapon = -1; weapon < 4; weapon++) {
        const build = { ...starter, brain, cell, weapon }
        const lane = driveState(build, stats(build))
        assert.ok(lane.pushCost <= lane.readyEnergy && lane.readyEnergy <= lane.s.capacity)
      }
})
test('an interrupted old Pulse Bell bout finishes as saved, and new refills wait for a whole swing', () => {
  const build = { ...starter, brain: -1, cell: -1, weapon: 3 }
  const cup = { ...freshCup(), build }
  const race = (rules) => createMatch(build, rounds[0].build, roundSeed(0), rules)
  const legacy = race(ORIGINAL_REFILL_RULES)
  const map = new Map()
  const session = { getItem: k => map.get(k), setItem: (k,v) => map.set(k,v) }
  while (legacy.tick < 293) step(legacy)
  checkpoint(session, cup, legacy)
  const offer = raceResume(session, null).findMatch(cup)
  assert.equal(offer.rules, ORIGINAL_REFILL_RULES)
  const resumed = race(offer.rules)
  while (resumed.tick < offer.tick) step(resumed)
  assert.deepEqual(resumed, legacy)
  while (resumed.winner === null) step(resumed)
  assert.equal(resumed.robots[0].rests, 63)
  assert.equal(resumed.tick, 627)
  const modern = race(MATCH_RULES)
  let completed = 0
  while (modern.winner === null) {
    const previousEnergy = modern.robots[0].energy
    step(modern)
    if (modern.events.some(e => e.kind === 'ready' && e.side === 0)) {
      assert.ok(previousEnergy >= modern.robots[0].pushCost)
      completed++
    }
  }
  assert.ok(completed > 1)
  assert.equal(modern.robots[0].rests, completed + Number(modern.robots[0].rest))
  assert.ok(completed < 10)
})
test('a quarterfinal saved before flight-direction recoil keeps its recorded finish', () => {
  const build = makeBuild(0, 0, 0, 0, 0, 0, 3)
  const cup = { ...freshCup(), round: 1, build }
  const duel = rules => createMatch(build, rounds[1].build, roundSeed(1), rules)
  const old = duel(REFILL_RULES)
  while (old.tick < 271) step(old)
  const entries = new Map()
  const tab = { getItem: k => entries.get(k), setItem: (k,v) => entries.set(k,v) }
  checkpoint(tab, cup, old)
  const offer = raceResume(tab, null).findMatch(cup)
  assert.equal(offer.rules, REFILL_RULES)
  const resumed = duel(offer.rules), fresh = duel(MATCH_RULES)
  while (resumed.winner === null) step(resumed)
  while (fresh.winner === null) step(fresh)
  assert.deepEqual([resumed.tick, resumed.winner], [526, 0])
  assert.deepEqual([fresh.tick, fresh.winner], [495, 1])
})
test('invalid, overspent and inaccessible saves safely start a fresh cup', () => {
  const s = {
    value: null,
    getItem() {
      return this.value
    },
    setItem(_, v) {
      this.value = v
    }
  }
  const cup = { ...freshCup(), round: 1, muted: true, build: makeBuild(0, 1, 1, 0, 1, 0) }
  assert.ok(saveCup(s, cup))
  assert.deepEqual(readCup(s), cup)
  for (const invalid of [
    '{',
    'null',
    JSON.stringify({ ...cup, round: 9 }),
    JSON.stringify({ ...cup, build: { cpu: -1 } }),
    JSON.stringify({ ...cup, round: 0, build: makeBuild(3, 3, 3, 3, 3, 3) })
  ]) {
    s.value = invalid
    assert.deepEqual(readCup(s), freshCup())
  }
  assert.deepEqual(readCup(undefined), freshCup())
  assert.equal(saveCup(undefined, cup), false)
  assert.equal(cost(starter), 84)
})

test('all sixteen entrants progress through the same fixed bracket and rival loadouts', () => {
  const bracket = buildBracket()
  assert.deepEqual(tournamentDraw,
    bracket.map((round) => round.map(({ left, right, winner }) => ({ left, right, winner }))))
  assert.equal(new Set(bracket[0].flatMap((f) => [f.left, f.right])).size, 16)
  for (const [n, heats] of bracket.entries()) {
    assert.equal(heats.length, 8 / 2 ** n)
    assert.equal(heats[0].right, rounds[n].rival)
    assert.deepEqual(heats[0].build, rounds[n].build)
    if (n > 0)
      assert.deepEqual(
        heats.flatMap((f) => [f.left, f.right]),
        bracket[n - 1].map((f) => f.winner)
      )
  }
})

test('a slow motion highlight reproduces the same contact without changing the result', () => {
  const m = createMatch(starter, rounds[0].build, 197),
    events = []
  while (m.winner === null) {
    step(m)
    for (const e of m.events) events.push({ ...e, tick: m.tick })
  }
  const moment = pickMoment(m, events),
    original = structuredClone(m)
  assert.ok(['hit', 'guard', 'miss', 'dash', 'dodge'].includes(moment.kind))
  const clip = replayMoment(m, moment, 197)
  while (clip.match.tick < moment.tick) step(clip.match)
  assert.ok(clip.match.events.some((e) => e.kind === moment.kind && e.side === moment.side))
  assert.deepEqual(m, original)
})

test('the replay distinguishes a wide swing from a confirmed dodge and a near bubble from a long one', () => {
  const final = createMatch(starter, rounds[0].build)
  final.winner = 0
  const wide = { kind: 'miss', weapon: 0, side: 1 }
  const dodge = { ...wide, evaded: true }
  const bubble = { kind: 'hit', weapon: 2, side: 0, damage: 10, travel: 0.7 }
  assert.equal(pickMoment(final, [wide, bubble]), bubble)
  assert.equal(pickMoment(final, [wide, bubble, dodge]), dodge)
  assert.equal(explainMoment(wide, 'Buckler', 'Rivet'), 'Buckler missed Rivet.')
  assert.match(explainMoment(dodge, 'Buckler', 'Rivet'), /Rivet dodged Buckler/)
  assert.doesNotMatch(explainMoment(bubble, 'Buckler', 'Rivet'), /far away/)
  assert.match(explainMoment({ ...bubble, travel: 2 }, 'Buckler', 'Rivet'), /far away/)
})

test('an interrupted bout belongs to its exact cup, opponent and installed parts', () => {
  const storage = {
    entry: null,
    getItem() {
      return this.entry
    },
    setItem(_, v) {
      this.entry = v
    },
    removeItem() {
      this.entry = null
    }
  }
  const cup = freshCup(),
    m = createMatch(cup.build, rounds[0].build, 197)
  for (let i = 0; i < 120; i++) step(m)
  checkpoint(storage, cup, m)
  assert.equal(interruptedTick(storage, cup), 120)
  assert.equal(interruptedTick(storage, { ...cup, edition: 2 }), null)
  assert.equal(interruptedTick(storage, { ...cup, build: { ...cup.build, motor: 1 } }), null)
  const saved = JSON.parse(storage.entry)
  for (const change of [{ rival: { ...saved.rival, motor: 3 } }, { rules: 0 }, { seed: 42 }]) {
    storage.entry = JSON.stringify({ ...saved, ...change })
    assert.equal(interruptedTick(storage, cup), null)
  }
  checkpoint(storage, cup, null)
  assert.equal(interruptedTick(storage, cup), null)
})
test('an older tab cannot undo promotion, a trophy or a new tournament', () => {
  const s = {
    value: null,
    getItem() {
      return this.value
    },
    setItem(_, v) {
      this.value = v
    }
  }
  const first = freshCup(),
    advanced = { ...first, round: 2 }
  saveCup(s, advanced)
  saveCup(s, first)
  assert.deepEqual(readCup(s), advanced)
  const trophy = { ...first, round: 3, champion: true }
  saveCup(s, trophy)
  saveCup(s, { ...trophy, champion: false })
  assert.deepEqual(readCup(s), trophy)
  const second = { ...first, edition: 2 }
  saveCup(s, second)
  saveCup(s, trophy)
  assert.deepEqual(readCup(s), second)
})

test('swapping starting sides preserves the result; equal robots draw', () => {
  for (const [n, r] of rounds.entries()) {
    const run = (a, b) => {
      const m = createMatch(a, b, 197 + n * 101)
      while (m.winner === null) step(m)
      return m
    }
    const left = run(starter, r.build),
      right = run(r.build, starter)
    assert.equal(left.winner, 1 - right.winner)
    assert.ok(Math.abs(left.robots[0].hp - right.robots[1].hp) < 0.001)
    assert.equal(run(r.build, r.build).winner, 2)
  }
})

test('a purchase needs an empty slot and enough cash; selling each part gives its full price', () => {
  const cap = cost(starter)
  assert.equal(buyPart(starter, 'motor', 0, cap), null)
  let build = sellPart(starter, 'motor')
  assert.equal(cap - cost(build), parts.motor[0].price)
  assert.equal(buyPart(build, 'motor', 3, cap), null)
  assert.equal(sellPart(build, 'motor'), null)
  for (const { id } of slots) if (build[id] >= 0) build = sellPart(build, id)
  assert.equal(cost(build), 0)
  assert.ok(validBuild(build, cap))
  assert.equal(partFor('weapon', build.weapon).price, 0)
  const match = duel(build, 0)
  assert.ok(match.tick > 0 && match.winner !== null)
  build = buyPart(build, 'motor', 3, cap)
  assert.equal(cost(build), parts.motor[3].price)
  assert.equal(starter.motor, 0)
})
test('all twenty-four parts have a short English name and a child-facing explanation', () => {
  for (const s of slots) {
    const names = new Set()
    for (const p of parts[s.id]) {
      names.add(p.name)
      assert.doesNotMatch(p.name + p.description, /\p{Script=Han}/u)
      assert.match(p.description, /[.!?]$/)
      assert.ok(p.description.split(/\s+/).length <= 24)
    }
    assert.equal(names.size, 4)
  }
})

test('a push needs its full power cost before the robot can start it', () => {
  for (let logic = 0; logic < 4; logic++) {
    const b = { ...starter, brain: logic },
      m = createMatch(b, b, 197)
    for (const [i, robot] of m.robots.entries()) {
      robot.x = i ? 0.7 : -0.7
      robot.energy = robot.pushCost - 0.01
    }
    step(m)
    for (const robot of m.robots) {
      assert.ok(robot.rest)
      assert.equal(robot.charge, 0)
      assert.equal(robot.rests, 1)
    }
  }
})
test('the report compares changes only between attempts against the same opponent', () => {
  const first = attemptSummary(duel(starter, 0), 0)
  assert.equal(compareAttempts(null, first, 'Buckler'), '')
  assert.match(compareAttempts(first, first, 'Buckler'), /Same parts, same result/)
  assert.equal(compareAttempts(first, { ...first, stage: 1 }, 'Whirl'), '')
  const second = attemptSummary(duel({ ...starter, brain: 1 }, 0), 0)
  assert.match(compareAttempts(first, second, 'Buckler'), /With Orbit Core, (Buckler|your bot) finished with/)
})

test('workbench rolls and spring pushes use real parts and never spend a coin', () => {
  const before = { ...starter }
  for (const [slot, index, mode] of [
    ['motor', 1, 'roll'],
    ['shell', 2, 'roll'],
    ['brain', 1, 'push'],
    ['cell', 2, 'push'],
    ['motor', 2, 'push']
  ]) {
    const candidate = { ...starter, [slot]: index }
    const t = createTest(starter, candidate, mode)
    while (!t.done) advanceTest(t)
    const [installed, proposed] = t.lanes
    assert.equal(t.time, t.duration)
    const snapshot = structuredClone(t)
    advanceTest(t)
    assert.deepEqual(t, snapshot)
    if (mode === 'roll') {
      assert.equal(proposed.travel, proposed.s.speed * t.duration)
      assert.ok(slot === 'motor' ? proposed.travel > installed.travel : proposed.travel < installed.travel)
    } else if (slot === 'cell') assert.ok(proposed.pushes > installed.pushes)
    else if (slot === 'motor') assert.ok(proposed.s.force > installed.s.force)
    else assert.notEqual(proposed.pushes, installed.pushes)
    assert.deepEqual(starter, before)
  }
})

test('resolution reacts to sustained load, preserves detail at a fixed 30 Hz and recovers', () => {
  const rates = new RenderQuality()
  const run = (fps, seconds) => {
    for (let i = 0; i < fps * seconds; i++) rates.sample(1 / fps)
  }
  run(60, 2)
  rates.sample(0.23)
  run(60, 2)
  assert.equal(rates.scale, 1)
  rates.reset()
  run(30, 5)
  assert.equal(rates.scale, 1)
  run(30, 5)
  assert.equal(rates.scale, 1)
  run(12, 6)
  assert.equal(rates.scale, 0.58)
  run(60, 65)
  assert.equal(rates.scale, 1)
})

test('a defending robot reserves battery for the arriving hit before winding up a push', () => {
  const m = createMatch({ ...starter, brain: 2 }, starter)
  const [guard, incoming] = m.robots
  guard.x = -0.7
  incoming.x = 0.7
  guard.energy = guard.pushCost + 0.1
  incoming.charge = STEP / 2
  incoming.aimPhase = 0.99
  const opening = guard.energy
  step(m)
  assert.equal(guard.blocks, 1)
  assert.equal(guard.charge, 0)
  assert.ok(Math.abs(guard.energy - (opening + guard.s.regen * STEP - 5.5 * guard.s.draw)) < 0.000001)
})

test('sound, a workshop receipt and a concurrent match record keep separate changes', () => {
  const values = new Map()
  const storage = { getItem: (k) => values.get(k), setItem: (k, v) => values.set(k, v) }
  const a = freshCup(),
    b = freshCup()
  a.build = { ...a.build, brain: 1 }
  saveCup(storage, a, 'build')
  saveAudio(storage, { ...b, muted: true })
  assert.equal(readCup(storage).build.brain, 1)
  assert.equal(readCup(storage).muted, true)
  b.lastTry = attemptSummary(duel(b.build, 0), 0)
  saveCup(storage, b, 'record')
  assert.deepEqual(readCup(storage).lastTry.build, b.build)
  assert.equal(readCup(storage).build.brain, 1)
  a.build = { ...a.build, motor: 1 }
  saveCup(storage, a, 'build')
  assert.deepEqual(readCup(storage).lastTry, b.lastTry)
  assert.equal(readCup(storage).muted, true)
})

test('reopened bout records reproduce the saved score without changing the current cup', () => {
  const first = attemptSummary(duel(bareBuild(), 0), 0)
  assert.equal(recordedHighlight(first, 0).final.winner, 1)
  const m = duel({ ...starter, brain: 1 }, 0),
    me = m.robots[0]
  const win = { build: me.build, blocks: me.blocks, hits: me.hits, flanks: me.flanks, tick: m.tick }
  const before = structuredClone(win)
  const archive = recordedHighlight(win, 0)
  assert.equal(archive.final.winner, 0)
  assert.ok(archive.moment.flanking)
  assert.deepEqual(win, before)
  assert.equal(recordedHighlight({ ...win, tick: win.tick + 1 }, 0), null)
  assert.equal(recordedHighlight({ ...first, own: first.own + 1 }, 0), null)
})

test('a semifinal counter build can solve the championship by changing its approach and wheels', () => {
  const semifinal = makeBuild(0, 1, 0, 1, 2, 0, 3)
  assert.equal(duel(semifinal, 2).winner, 0)
  assert.notEqual(duel(semifinal, 3).winner, 0)
  const final = { ...semifinal, brain: 3, motor: 2 }
  assert.ok(validBuild(final, rounds[3].budget))
  assert.equal(duel(final, 3).winner, 0)
})

test('drive wheels roll backwards on retreat and turn independently on a flank', () => {
  const p = { ...wheelState(0), heading: 0, build: starter, move: 1, charge: 0, attack: 0, rest: true }
  rollWheels(p, { vx: 0, vz: -2 }, STEP)
  assert.ok(p.leftTravel < 0)
  assert.equal(p.leftTravel, p.rightTravel)
  Object.assign(p, wheelState(0), { build: { ...starter, brain: 1 }, rest: false })
  for (let i = 0; i < 15; i++) rollWheels(p, { vx: 2, vz: 0 }, STEP)
  assert.ok(p.bodyHeading > 1.4)
  assert.ok(p.leftTravel > p.rightTravel)
  p.charge = 0.2
  for (let i = 0; i < 8; i++) rollWheels(p, { vx: 0, vz: 0 }, STEP)
  assert.ok(Math.abs(p.bodyHeading) < 0.01)
})

test('a part trial uses the same opening against the current rival and never changes a loadout', async () => {
  const { partTrial } = await import('../js/part-trial.js')
  const build = Object.freeze({ ...starter })
  for (let stage = 0; stage < 4; stage++) {
    for (const slot of ['brain', 'lens'])
      for (let index = 0; index < 4; index++) {
        const t = partTrial(build, slot, index, stage)
        assert.ok(t.moment.tick > 0 && t.moment.tick <= t.final.tick)
        assert.deepEqual(t.final.robots[0].build, { ...build, [slot]: index })
        assert.deepEqual(t.final.robots[1].build, rounds[stage].build)
        const original = createMatch(build, rounds[stage].build, 197 + stage * 101)
        while (original.tick < t.final.tick) step(original)
        assert.equal(t.results[0].hits, original.robots[0].hits)
        const baseline = t.originalRun
        assert.equal(baseline.moment.tick, t.moment.tick)
        assert.deepEqual(baseline.final, original)
        const atKey = replayMoment(baseline.final, baseline.moment, original.seed).match
        while (atKey.tick < t.moment.tick) step(atKey)
        if (baseline.moment.kind === 'observe') {
          assert.ok(atKey.events.every((e) => e.kind === 'charge'))
          assert.ok(baseline.moment.description.length > 0)
        } else {
          assert.ok(
            atKey.events.some((e) => e.kind === baseline.moment.kind && e.side === baseline.moment.side)
          )
        }
        const replay = replayMoment(t.final, t.moment, t.final.seed).match
        while (replay.tick < t.moment.tick) step(replay)
        assert(replay.events.some((e) => e.kind === t.moment.kind && e.side === t.moment.side))
      }
  }
  const orbit = partTrial(starter, 'brain', 1, 0)
  assert.equal(orbit.moment.flanking, true)
  const guard = partTrial(starter, 'brain', 2, 2)
  assert.deepEqual([guard.moment.kind, guard.moment.side], ['guard', 1])
})

test('rewinding a highlight reproduces exact poses, battery and contact without changing its starting frame', async () => {
  const { seekMoment } = await import('../js/replay.js')
  const { partTrial } = await import('../js/part-trial.js')
  const t = partTrial(starter, 'brain', 1, 0),
    clip = replayMoment(t.final, t.moment, t.final.seed)
  const saved = structuredClone(clip.initial)
  const expected = structuredClone(saved)
  while (expected.tick < clip.moment.tick) step(expected)
  for (const target of [clip.until, clip.start, clip.moment.tick, clip.start, clip.moment.tick])
    seekMoment(clip, target)
  assert.deepEqual(clip.match, expected)
  assert.deepEqual(clip.initial, saved)
  assert.deepEqual(
    clip.match.events.find((e) => e.side === t.moment.side),
    expected.events.find((e) => e.side === t.moment.side)
  )
})
test('the lens that tracks better depends on the opponent’s strategy', async () => {
  const { trackingChance } = await import('../js/match.js')
  const tracking = (lens, logic) => {
    const m = createMatch({ ...starter, lens }, { ...starter, brain: logic })
    return trackingChance(...m.robots)
  }
  assert(tracking(1, 1) > tracking(2, 1))
  assert(tracking(2, 0) > tracking(1, 0))
})

test('personal savings records survive a new cup; a dearer win never hides a cheaper working blueprint', async () => {
  const { cheapestWin, rememberWin } = await import('../js/savings.js')
  const map = new Map(),
    storage = { getItem: (key) => map.get(key), setItem: (key, v) => map.set(key, v) }
  const expensive = { ...starter, brain: 1, cell: 1 },
    cheap = { ...starter, brain: 1 }
  assert.equal(duel(expensive, 0).winner, 0)
  assert.equal(duel(cheap, 0).winner, 0)
  assert.equal(rememberWin(storage, 0, 1, expensive), 0)
  assert.equal(rememberWin(storage, 0, 2, cheap), 10)
  assert.equal(rememberWin(storage, 0, 3, expensive), null)
  assert.deepEqual(cheapestWin(storage, 0), { edition: 2, build: cheap, price: cost(cheap) })
  assert.equal(cheapestWin(storage, 1), null)
  assert.equal(rememberWin(storage, 0, 4, { ...cheap, brain: 99 }), null)
  const invalid = [...map.keys()][0].replace(/\d+$/, String(cost(cheap) - 1))
  map.set(invalid, '{')
  assert.equal(cheapestWin(storage, 0).price, cost(cheap))
  const bestKey = [...map.keys()].find(key => key.endsWith('.' + cost(cheap)))
  const legacyKey = bestKey.replace('.savings.' + MATCH_RULES + '.', '.savings.' + ORIGINAL_REFILL_RULES + '.')
  map.set(legacyKey, map.get(bestKey))
  map.set(bestKey, '{')
  assert.deepEqual(cheapestWin(storage, 0), { edition: 2, build: cheap, price: cost(cheap) })
})

test('an evicted window can resume, without discarding a newer position written by another window', () => {
  function store() {
    const rows = new Map()
    return {
      get length() {
        return rows.size
      },
      key: (i) => [...rows.keys()][i],
      getItem: (k) => rows.get(k) ?? null,
      setItem: (k, v) => rows.set(k, v),
      removeItem: (k) => rows.delete(k)
    }
  }
  const device = store(),
    session = store(),
    a = raceResume(session, device),
    b = raceResume(store(), device)
  const cup = freshCup(),
    m = createMatch(cup.build, rounds[0].build, 197)
  for (let i = 0; i < 100; i++) step(m)
  a.save(cup, m)
  const changedShop = { ...cup, build: { ...cup.build, brain: 1 } }
  assert.equal(b.find(changedShop), null)
  assert.deepEqual(b.findMatch(changedShop), { tick: 100, build: cup.build })
  assert.deepEqual(a.findMatch(changedShop), { tick: 100, build: cup.build })
  const corrupt = store()
  checkpoint(corrupt, cup, { ...m, robots: [{ build: makeBuild(3, 3, 3, 3, 3, 3) }, m.robots[1]] })
  assert.equal(raceResume(corrupt, store()).findMatch(changedShop), null)
  assert.equal(b.find(cup), 100)
  for (let i = 0; i < 42; i++) step(m)
  a.save(cup, m)
  b.save(cup, null)
  assert.equal(raceResume(store(), device).find(cup), 142)
  const c = raceResume(store(), device)
  assert.equal(c.find(cup), 142)
  c.save(cup, m)
  a.save(cup, null)
  assert.equal(raceResume(store(), device).find(cup), 142)
  c.save(cup, null)
  assert.equal(raceResume(store(), device).find(cup), null)
  a.save(cup, m)
  assert.equal(raceResume(store(), device).find({ ...cup, round: 1 }), null)
  assert.equal(device.length, 0)
})

test('winning paint follows the original bot through a reload and a later respray', () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  }
  const cup = freshCup()
  const match = createMatch(cup.build, rounds[0].build, roundSeed(0))
  match.paint = 'plum'
  step(match)
  const resume = raceResume(storage, storage)
  resume.save(cup, match)
  storage.setItem('robot-rally.enamel.v1', 'night')
  assert.equal(resume.findMatch(cup).paint, 'plum')
  cup.wins[0] = { build: cup.build, paint: 'plum', hits: 12, blocks: 1, flanks: 3, tick: 800 }
  cup.round = 1
  saveCup(storage, cup)
  assert.equal(readCup(storage).wins[0].paint, 'plum')
  cup.wins[0].paint = 'bad-value'
  saveCup(storage, cup)
  assert.equal(readCup(storage).wins[0].paint, undefined)
})

test('old separate brain and strategy migrate into one paid core and a bare named bot stays bare', async () => {
  const { normalizeBuild, cleanName, statScales } = await import('../js/catalog.js')
  const old = { cpu: 3, logic: 1, motor: 1, cell: 0, shell: 0, lens: 0, weapon: 2, chassis: 2 }
  const migrated = normalizeBuild(old)
  assert.deepEqual(Object.keys(parts).sort(), slots.map((s) => s.id).sort())
  assert.equal(migrated.brain, 1)
  assert.equal(cost(migrated), parts.brain[1].price + 22 + 10 + 10 + 9 + 26)
  assert.equal(Object.hasOwn(migrated, 'cpu'), false)
  const values = new Map(),
    storage = { getItem: (k) => values.get(k), setItem: (k, v) => values.set(k, v) }
  const cup = freshCup()
  cup.build.name = cleanName('  星河 <Bolt> 🚀  ')
  assert.ok(saveCup(storage, cup, 'build'))
  const b = readCup(storage).build
  assert.equal(b.name, '星河 <Bolt> 🚀')
  assert.equal(cost(b), 0)
  assert.ok(slots.every(({ id }) => b[id] === -1 && statScales[id][1] >= 0))
  assert.equal(buyPart(b, 'brain', '2', 124), null)
})

test('two garage windows share one wallet and a stale sell cannot remove a replacement', async () => {
  const { garageReceipts, freshCup, readCup } = await import('../js/progress.js')
  const { buyPart, sellPart } = await import('../js/catalog.js')
  const data = new Map()
  let full = false
  const disk = { getItem: (k) => data.get(k) ?? null, setItem(k, v) {
    if (full) throw Error('Storage full')
    data.set(k, v)
  } }
  const a = garageReceipts(disk), b = garageReceipts(disk)
  const original = freshCup()
  const buy = (id, n) => (build, budget) => buyPart(build, id, n, budget)
  const first = a(original, buy('motor', 2))
  const second = b(original, buy('weapon', 1))
  assert.ok(first.applied && second.applied)
  assert.equal(second.cup.build.motor, 2)
  const sell = (build) => build.motor === 2 ? sellPart(build, 'motor') : null
  const sold = a(first.cup, sell)
  assert.equal(sold.cup.build.weapon, 1)
  assert.ok(b(second.cup, buy('motor', 0)).applied)
  assert.equal(a(first.cup, sell).applied, false)
  assert.equal(readCup(disk).build.motor, 0)
  full = true
  const named = a(sold.cup, (build) => ({ ...build, name: 'Weld' }))
  const next = a(named.cup, (build) => ({ ...build, chassis: 4 }))
  assert.equal(next.cup.build.name, 'Weld')
  assert.equal(next.cup.build.weapon, 1)
})

test('the shelf and its spoken preview compare against the part actually fitted', async () => {
  const { partShelf } = await import('../js/equipment.js')
  const { comparePart, readPart } = await import('../js/catalog.js')
  const { readerCues } = await import('../js/part-reader-cues.js')
  const { shopComparisons } = await import('../js/shop-comparisons.js')
  for (const shelf of slots) {
    for (const [choice] of parts[shelf.id].entries()) {
      for (let fitted = -1; fitted < 4; fitted++) {
        const { stat, gain, from, to, delta } = comparePart(shelf.id, choice, fitted)
        const build = { ...bareBuild(), [shelf.id]: fitted }
        const html = partShelf(build, shelf, choice, 100, true)
        const amount = fitted === choice ? gain : delta
        const sign = amount > 0 ? '+' + amount : amount < 0 ? '−' + Math.abs(amount) : 'Same'
        assert.ok(html.includes('<strong>' + sign + ' ' + stat + '</strong>'))
        assert.ok(html.includes(fitted === choice ? to + ' on your bot' : from + ' → ' + to))
        const cue = shopComparisons[shelf.id].lines[choice][fitted] || readerCues[shelf.id][choice]
        assert.equal(cue.text, readPart(shelf.id, choice, fitted))
      }
    }
  }
})
test('new finals share Goldcap’s purse and unfinished original cups keep their paid parts', async () => {
  const { garageReceipts } = await import('../js/progress.js')
  const key = 'robot-rally.cup.v1', data = new Map()
  const store = { getItem: k => data.get(k) ?? null, setItem: (k, value) => data.set(k, value), removeItem: k => data.delete(k) }
  const premium = { ...bareBuild(), brain: 2, motor: 3, cell: 3, shell: 3, lens: 3, weapon: 3 }
  const fresh = { ...freshCup(), round: 3 }
  assert.equal(cupRound(fresh).budget, cost(rounds[3].build))
  assert.ok(cost(premium) > cupRound(fresh).budget)
  data.set(key, JSON.stringify({ round: 3, build: premium, edition: 4 }))
  const original = readCup(store)
  assert.equal(cupRound(original).budget, 235)
  assert.equal(cost(original.build), 227)
  const checkout = garageReceipts(store)
  const sold = checkout(original, build => sellPart(build, 'weapon'))
  const bought = checkout(sold.cup, (build, budget) => buyPart(build, 'weapon', 3, budget))
  assert.ok(bought.applied)
  assert.equal(cupRound(readCup(store)).budget, 235)
  const match = createMatch(bought.cup.build, rounds[3].build, roundSeed(3))
  step(match)
  checkpoint(store, bought.cup, match)
  assert.equal(interruptedTick(store, bought.cup), 1)
  assert.equal(interruptedTick(store, fresh), null)
})
