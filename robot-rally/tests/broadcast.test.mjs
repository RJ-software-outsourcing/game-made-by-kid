import test from 'node:test'
import assert from 'node:assert/strict'
import { frames, rounds, starter } from '../js/catalog.js'
import { createMatch, roundSeed, step } from '../js/match.js'
import { PlayByPlay, speakerFor } from '../js/play-by-play.js'
import { lineFor } from '../js/announcer.js'

test('caller and analyst trade turns, using actual fighters and the same shell lead as the judge', () => {
  let wins = 0,
    losses = 0,
    explanations = 0
  const reasons = new Set()
  for (const [chassis, frame] of frames.entries())
    for (const [stage, rival] of rounds.entries()) {
      const m = createMatch({ ...starter, brain: chassis % 4, chassis }, rival.build, roundSeed(stage))
      const names = [frame.name, rival.rival],
        desk = new PlayByPlay(names)
      assert.ok(lineFor(desk.opening()).words.includes(rival.rival))
      let previous = 'caller',
        time = -100
      while (m.winner === null) {
        step(m)
        const cue = desk.nextCall(m)
        if (!cue) continue
        const side = names.indexOf(cue.subject),
          p = m.robots[side],
          q = m.robots[1 - side]
        const line = lineFor(cue),
          role = speakerFor(cue.kind)
        assert.ok(line)
        assert.notEqual(role, previous)
        assert.ok(m.time - time >= 3.32)
        previous = role
        time = m.time
        if (side < 0) {
          const [a, b] = m.robots
          assert.ok(Math.abs(a.hp / a.s.hp - b.hp / b.s.hp) <= 0.055)
          if (cue.kind === 'reasonFull') assert.ok(a.hp === a.s.hp && b.hp === b.s.hp)
          continue
        }
        assert.ok(line.words.includes(cue.subject))
        const gap = p.hp / p.s.hp - q.hp / q.s.hp
        if (role === 'analyst') {
          reasons.add(cue.kind)
          explanations++
          assert.ok(cue.kind === 'reasonClose' ? gap < 0 : gap > 0)
          if (cue.kind === 'reasonHits') assert.ok(p.hits >= 2 && p.hits > q.hits)
          if (cue.kind === 'reasonBlocks') assert.ok(p.blocks >= 2 && p.blocks > q.blocks)
          if (cue.kind === 'reasonFlank') assert.ok(p.flanks > 0)
          if (cue.kind === 'reasonRange') assert.ok(p.longHits > 0)
          if (cue.kind === 'reasonReach')
            assert.ok(p.longHits > 0 && p.s.tool.reach > q.s.tool.reach && desk.notes[1 - side].shortSwings >= 2)
          if (cue.kind === 'reasonMisses') assert.ok(q.misses >= 2 && q.misses > p.misses)
          if (cue.kind === 'reasonArmor')
            assert.ok(p.s.armor > q.s.armor && desk.notes[side].shellSaved >= p.s.hp * 0.03)
          if (cue.kind === 'reasonWheels')
            assert.ok(desk.notes[side].quickEvades > 0 && p.s.speed > q.s.speed)
        }
      }
      const result = desk.finish(m)
      assert.ok(lineFor(result))
      assert.equal(result.subject, m.winner === 2 ? 'neutral' : names[m.winner])
      if (m.winner === 0) wins++
      if (m.winner === 1) losses++
    }
  assert.ok(explanations >= 24 && reasons.size >= 5 && wins > 0 && losses > 0)
})

test('a naked bash, a missed dodge and a recharge opening are attributed to the right robot', () => {
  const bots = [0, 1].map((side) => ({
    x: side * 2.6,
    z: 0,
    build: { weapon: -1, brain: -1 },
    rest: false,
    s: { hp: 100 },
    hp: 100,
    hits: 0,
    blocks: 0,
    misses: 0,
    flanks: 0
  }))
  const m = { robots: bots, events: [], time: 1, winner: null },
    desk = new PlayByPlay(['Teacup', 'Buckler'])
  m.events = [{ kind: 'hit', side: 0, weapon: -1, damage: 4 }]
  desk.nextCall(m)
  assert.equal(desk.play.kind, 'bash')
  m.time = 1.1
  m.events = [
    { kind: 'dodge', side: 0 },
    { kind: 'hit', side: 1, weapon: 2, damage: 4 }
  ]
  desk.nextCall(m)
  m.time = 1.2
  m.events = [{ kind: 'miss', side: 1, weapon: 2 }]
  desk.nextCall(m)
  assert.equal(desk.notes[0].dodgedMisses, 0)
  m.time = 1.3
  m.events = [
    { kind: 'dodge', side: 0 },
    { kind: 'miss', side: 1, weapon: 2, evaded: true }
  ]
  desk.nextCall(m)
  assert.equal(desk.notes[0].dodgedMisses, 1)
  m.time = 1.4
  m.robots[1].rest = true
  m.shots = [{ id: 7, side: 0 }]
  m.events = [
    { kind: 'launch', side: 0, weapon: 2, x: 0, z: 0 },
    { kind: 'hit', side: 0, weapon: 2, damage: 7, x: 2.4, z: 0, shotId: 7 }
  ]
  desk.nextCall(m)
  desk.nextCall(m)
  assert.equal(desk.notes[0].rechargeHits, 1)
})

test('custom names keep complete match captions and a complete offline voice fallback', () => {
  for (const name of ['Little Comet', '閃電', '<Moon>', '$&', 'toString', 'Buckler']) {
    const desk = new PlayByPlay([name, 'Buckler']),
      opening = lineFor(desk.opening())
    assert.ok(opening.words.includes(name))
    assert.ok(opening.words.includes('Buckler'))
    assert.equal(opening.id, 'yourBot')
    const analysis = lineFor({ subject: name, kind: 'reasonBlocks' })
    assert.ok(analysis.words.includes(name))
    assert.equal(analysis.speaker, 'analyst')
  }
  assert.deepEqual(new PlayByPlay(['Rivet', 'Buckler']).finish({ winner: 2 }), {
    subject: 'neutral',
    kind: 'tie'
  })
})

test('a confirmed exchange names both robots and keeps the actor in the correct role', async () => {
  const { duelRate, duelClips } = await import('../js/duel-recordings.js')
  const { duelKinds } = await import('../js/duel-calls.js')
  for (const frame of [...frames.map((f) => f.name), 'Little Bolt', '藍色']) {
    for (const { rival } of rounds)
      for (const side of [0, 1]) {
        const names = [frame, rival]
        for (const kind of duelKinds) {
          const call = lineFor({ kind, names, side, subject: names[side] })
          assert.ok(call.words.includes(frame) && call.words.includes(rival))
          assert.ok(Object.hasOwn(duelClips, call.id))
          assert.equal(call.custom, frame === 'Little Bolt' || frame === '藍色')
          assert.equal(call.speaker, kind.startsWith('reason') ? 'analyst' : 'caller')
          assert.ok(call.offset > 0 && call.duration * duelRate > 30000)
        }
      }
  }
  const shot = lineFor({ kind: 'waveHit', names: ['Knuckle', 'Whirl'], side: 0, subject: 'Knuckle' })
  assert.match(shot.words, /Knuckle catches Whirl|from Knuckle hits Whirl/)
})
