import test from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from '../vendor/three.module.js'
import { createRobot } from '../js/robot.js'
import { makeBuild, rounds, starter } from '../js/catalog.js'
import { createMatch, roundSeed, step } from '../js/match.js'
import { guardRadius } from '../js/bumper-contact.js'

test('a long-range hit pushes along the flight path, including when the attacker turns away', () => {
  const seen = new Set()
  for (const weapon of [2, 3]) {
    const bout = createMatch({ ...starter, brain: 1, weapon }, rounds[0].build, roundSeed(0))
    while (bout.winner === null) {
      const defender = bout.robots[1], before = [defender.pushX, defender.pushZ]
      const waves = bout.waves.slice()
      step(bout)
      const impulses = bout.events.filter(e => e.side === 0 ? e.damage > 0 : e.reply > 0)
      if (impulses.length !== 1) continue
      const e = impulses[0]
      if (e.side !== 0 || e.weapon !== weapon) continue
      const origin = weapon === 2 ? e.flight : waves.find(w => w.side === 0)
      const dx = (weapon === 2 ? origin.tx : defender.prevX) - origin.x
      const dz = (weapon === 2 ? origin.tz : defender.prevZ) - origin.z
      const x = defender.pushX / .87 - before[0], z = defender.pushZ / .87 - before[1]
      const cosine = (dx*x + dz*z) / (Math.hypot(dx,dz) * Math.hypot(x,z))
      assert.ok(cosine > .999999)
      const attacker = bout.robots[0]
      const sx = defender.prevX - attacker.prevX, sz = defender.prevZ - attacker.prevZ
      if ((sx*dx + sz*dz) / (Math.hypot(sx,sz) * Math.hypot(dx,dz)) < .997)
        seen.add(weapon)
    }
  }
  assert.deepEqual(seen, new Set([2, 3]))
})

test('a struck chassis tips away from the incoming tool, including a shield reply', () => {
  const seen = new Set()
  for (let weapon = 0; weapon < 4; weapon++) {
    const bout = createMatch({ ...starter, weapon }, rounds[0].build, roundSeed(0))
    const model = createRobot(starter)
    const body = model.group.getObjectByName('Suspended chassis')
    try {
      while (bout.winner === null) {
        step(bout)
        for (const [side, p] of bout.robots.entries()) {
          const blows = []
          for (const e of bout.events) {
            if (e.side !== side && e.damage) blows.push([e.damage, e.impulseBearing ?? e.heading, e.weapon])
            if (e.side === side && e.reply) {
              const q = bout.robots[1 - side]
              blows.push([e.reply, Math.atan2(q.prevX - p.prevX, q.prevZ - p.prevZ), 'reply'])
            }
          }
          if (!blows.length) continue
          const [points, bearing, tool] = blows.sort((a, b) => b[0] - a[0])[0]
          seen.add(tool)
          assert.deepEqual(p.lastImpact, { tick: bout.tick, bearing, points })
          const angle = bearing - p.bodyHeading
          model.update({ time: bout.time })
          const pitch = body.rotation.x, roll = body.rotation.z
          model.update({ time: bout.time, hit: 1, hitFront: Math.cos(angle), hitSide: Math.sin(angle) })
          const toward = (body.rotation.x - pitch) * Math.cos(angle) - (body.rotation.z - roll) * Math.sin(angle)
          assert.ok(toward < -0.19)
        }
      }
    } finally { model.dispose() }
  }
  assert.deepEqual(seen, new Set([0, 1, 2, 3, 'reply']))
})

test('the visible gripper reaches the recorded hit, including when low detail is active', () => {
  const builds = [starter, makeBuild(0, 1, 0, 0, 1, 0)]
  let count = 0,
    near = 0,
    blocked = 0
  for (const build of builds) {
    const match = createMatch(build, rounds[0].build, roundSeed(0))
    const robot = createRobot(build)
    try {
      while (match.winner === null) {
        step(match)
        const e = match.events.find((e) => !e.side && ['hit', 'guard'].includes(e.kind))
        if (!e) continue
        const [p, other] = match.robots,
          target = new Vector3(e.x, e.y, e.z)
        robot.setArenaDetail(count % 2 === 1)
        robot.group.position.set(p.x, 0, p.z)
        robot.group.rotation.y = p.bodyHeading
        robot.update({
          time: match.time,
          attack: p.attack,
          move: p.move,
          hand: p.hand,
          guard: p.guard,
          hit: p.hit,
          look: p.heading - p.bodyHeading,
          palmTarget: target
        })
        robot.group.updateMatrixWorld()
        const arm = robot.group
          .getObjectByName('Suspended chassis')
          .children.find((node) => node.name === 'Shoulder joint' && Math.sign(node.position.x) === p.hand)
        const gripper = arm.children.find((node) => node.isMesh && node.visible)
        const vertex = new Vector3()
        let closest = Infinity
        for (let i = 0; i < gripper.geometry.attributes.position.count; i++) {
          gripper.getVertexPosition(i, vertex).applyMatrix4(gripper.matrixWorld)
          closest = Math.min(closest, vertex.distanceTo(target))
        }
        if (closest < 0.13) near++
        if (e.kind === 'guard') {
          assert.ok(Math.abs(Math.hypot(e.x - other.prevX, e.z - other.prevZ) - guardRadius) < 1e-6)
          blocked++
        }
        count++
      }
    } finally {
      robot.dispose()
    }
  }
  assert.ok(blocked > 0 && count > 10)
  assert.ok(near / count > 0.85)
})

test('the press and brush meet the hit flash on every chassis in real bouts', () => {
  const origin = new Vector3()
  const ray = new Vector3()
  for (let chassis = 0; chassis < 6; chassis++) {
    for (const weapon of [0, 1]) {
      const build = makeBuild(0, 1, 1, 2, 2, 1, weapon, chassis)
      const round = chassis % rounds.length
      const match = createMatch(build, rounds[round].build, roundSeed(round))
      const robot = createRobot(build)
      let contacts = 0
      try {
        while (match.winner === null) {
          step(match)
          const hit = match.events.find((e) => e.side === 0 && (e.kind === 'hit' || e.kind === 'guard'))
          if (!hit) continue
          const [player] = match.robots
          const target = new Vector3(hit.x, hit.y, hit.z)
          robot.setArenaDetail(contacts % 2 === 1)
          robot.group.position.set(player.x, 0, player.z)
          robot.group.rotation.y = player.bodyHeading
          robot.update({
            time: match.time,
            attack: player.attack,
            fire: 1,
            move: player.move,
            look: player.heading - player.bodyHeading,
            hand: player.hand,
            guard: player.guard,
            hit: player.hit,
            palmTarget: target,
            toolContact: target
          })
          robot.getToolRay(origin, ray)
          assert.ok(origin.distanceTo(target) < 0.035, 'tool missed its contact on chassis ' + chassis)
          contacts++
        }
        assert.ok(contacts > 0, 'fixture had no contacts')
      } finally {
        robot.dispose()
      }
    }
  }
})

test('tire scuffs begin beneath each fitted wheel on all six chassis', async () => {
  const { TireMarks } = await import('../js/tire-marks.js')
  for (let chassis = 0; chassis < 6; chassis++) {
    const build = { ...starter, chassis }, model = createRobot(build), marks = new TireMarks()
    try {
      const p = { build, prevX: .2, prevZ: -.3, x: .24, z: -.22, prevBodyHeading: -.23,
        bodyHeading: -.2, maneuver: 'dodge', pushX: 0, pushZ: 0, leftTravel: .1, rightTravel: .13 }
      marks.record({ time: 2, robots: [p] })
      const wheels = model.group.children.filter(n => n.visible && ['Drive wheel', 'Rear drive wheel'].includes(n.name))
      assert.equal(marks.mesh.geometry.instanceCount, wheels.length)
      model.group.position.set(p.prevX, 0, p.prevZ)
      model.group.rotation.y = p.prevBodyHeading
      const before = wheels.map(n => n.getWorldPosition(new Vector3()))
      model.group.position.set(p.x, 0, p.z)
      model.group.rotation.y = p.bodyHeading
      const after = wheels.map(n => n.getWorldPosition(new Vector3()))
      for (let i = 0; i < wheels.length; i++) {
        const j = before.findIndex(v => Math.hypot(v.x - marks.stroke.getX(i), v.z - marks.stroke.getY(i)) < 1e-5)
        assert.ok(j >= 0)
        assert.ok(Math.hypot(after[j].x - marks.stroke.getZ(i), after[j].z - marks.stroke.getW(i)) < 1e-5)
      }
    } finally {
      model.dispose()
      marks.mesh.geometry.dispose()
      marks.mesh.material.dispose()
    }
  }
})

test('each bubble reaches its measured impact before it pops between fixed steps', async () => {
  const { Group, Matrix4 } = await import('../vendor/three.module.js')
  const { WeaponEffects } = await import('../js/weapon-fx.js')
  const { STEP } = await import('../js/match.js')
  const rig = { getToolRay(out) { out.set(-.7, .74, .2) } }
  const effects = new WeaponEffects(new Group()), matrix = new Matrix4()
  const kinds = new Set()
  let count = 0
  for (let chassis = 0; chassis < 6; chassis++) {
    const match = createMatch({ ...starter, chassis, brain: chassis % 4, weapon: 2 }, rounds[chassis % 4].build, roundSeed(chassis % 4))
    while (match.winner === null) {
      step(match)
      for (const e of match.events.filter(e => e.flight)) {
        kinds.add(e.kind)
        assert.ok(e.contactTime <= match.time + 1e-8 && e.contactTime >= match.time - STEP - 1e-8)
        effects.clear()
        effects.arrive(e, match.time, false)
        const justBefore = e.contactTime - 1e-8
        // No earlier display frame exists if contact is exactly at launch.
        if (justBefore <= e.flight.start || justBefore <= match.time - STEP) continue
        effects.update({ shots: [] }, justBefore, rig, rig)
        assert.ok(effects.bubbles.count >= 1)
        effects.bubbles.getMatrixAt(0, matrix)
        const pos = new Vector3().setFromMatrixPosition(matrix)
        assert.ok(pos.distanceTo(new Vector3(e.x, e.y, e.z)) < .001)
        effects.update({ shots: [] }, e.contactTime, rig, rig)
        assert.equal(effects.bubbles.count, 0)
        assert.equal(effects.arrivals.length + effects.origins.size, 0)
        count++
      }
    }
  }
  assert.ok(count > 20)
  assert.deepEqual([...kinds].sort(), ['guard', 'hit', 'miss'])
})
