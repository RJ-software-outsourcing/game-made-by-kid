import { chooseLane } from './positioning.js'
import { settleBots } from './court-motion.js'
import { driveManeuver, maneuverState } from './maneuvers.js'
import { bubbleContact } from './bubble-motion.js'
import { wheelState, rollWheels } from './wheel-motion.js'
import { checkBattery, driveState, tickDrive } from './drive.js'
import { stats, strikeForce, normalizeBuild } from './catalog.js'
import {
  guardHalfAngle,
  leadingHand,
  locateContact,
  surfaceContact,
  bodyImpactHeight,
  guardImpactHeight
} from './bumper-contact.js'

export const STEP = 1 / 30
export const TIME_LIMIT = 36
// Bump when a rules change alters the outcome at a given fixed tick.
export const ORIGINAL_REFILL_RULES = 9
export const REFILL_RULES = 10
const FLIGHT_IMPULSE_RULES = 11
export const MATCH_RULES = FLIGHT_IMPULSE_RULES
export const supportedRules = (rules) => Number.isSafeInteger(rules) && rules >= ORIGINAL_REFILL_RULES && rules <= MATCH_RULES
export const roundSeed = (stage) => 197 + stage * 101
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
export const GUARD_HALF_ANGLE = guardHalfAngle
const meleeArc = [0.76, 1.24]
export const startReach = (robot) => robot.s.tool.reach + 0.17
export const startArc = (weapon) => weapon >= 2 ? Math.PI : meleeArc[Math.max(0, weapon)] + 0.18
const shieldEnergy = (robot) => 5.5 * robot.s.draw

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a))
function fighter(build, side, seed, rules) {
  build = normalizeBuild(build)
  const s = stats(build)
  return {
    ...driveState(build, s, rules === ORIGINAL_REFILL_RULES),
    ...maneuverState(),
    ...wheelState((-side * Math.PI) / 2),
    aimPhase: 0.45 + ((seed * 37) % 101) / 420,
    x: side * 2.5,
    z: 0,
    heading: (-side * Math.PI) / 2,
    hp: s.hp,
    prevX: side * 2.5,
    prevZ: 0,
    prevHeading: (-side * Math.PI) / 2,
    move: 0,
    hit: 0,
    lastImpact: { tick: -1, bearing: 0, points: 0 },
    vx: 0,
    vz: 0,
    inReach: false,
    hand: 1,
    windingHand: 1,
    palmX: 0,
    palmZ: 0,
    palmY: bodyImpactHeight(build),
    guard: 0,
    counter: 0,
    win: 0,
    previousPose: { move: 0, attack: 0, hit: 0, guard: 0, counter: 0, charge: 0 },
    hits: 0,
    longHits: 0,
    doubleHits: 0,
    blocks: 0,
    misses: 0,
    damage: 0,
    flanks: 0,
    pushX: 0,
    pushZ: 0
  }
}
// Both robots plan from the same snapshot. Contacts land together, including double knockouts.
export function createMatch(a, b, seed = 1, rules = MATCH_RULES) {
  return {
    rules,
    robots: [fighter(a, -1, seed, rules), fighter(b, 1, seed, rules)],
    time: 0,
    tick: 0,
    seed: seed >>> 0 || 1,
    events: [],
    shots: [],
    waves: [],
    shotId: 0,
    winner: null
  }
}
// A lens accumulates tracking confidence between attempts. Equal builds on
// opposite starting marks get the same precision, with no first-mover luck.
function aimed(p, chance) {
  p.aimPhase += chance
  if (p.aimPhase < 1) return false
  p.aimPhase -= 1
  return true
}
// A wide lens can track a circling opponent better than a more expensive
// narrow lens. The garage uses the same calculation as a push in the ring.
export function trackingChance(p, q, aimError = 0, flanking = false) {
  const evasive = q.build.brain === 1 ? (p.s.field >= 100 ? 0.04 : 0.25) : 0
  return clamp(
    p.s.aim +
      0.12 -
      evasive -
      Math.max(0, aimError - 0.6) * 0.28 +
      0.055 * (p.s.speed - q.s.speed) +
      (flanking ? 0.1 : 0),
    0.37,
    0.98
  )
}
function plan(p, other, index, m) {
  const dx = other.x - p.x,
    dz = other.z - p.z,
    dist = Math.hypot(dx, dz) || 0.001
  const ux = dx / dist,
    uz = dz / dist,
    strategy = p.build.brain
  const orbit = strategy === 1,
    guarding = strategy === 2
  const wasRefilling = p.rest
  if (checkBattery(p)) m.events.push({ kind: 'charge', side: index })
  else if (wasRefilling && !p.rest && m.rules >= REFILL_RULES) m.events.push({ kind: 'ready', side: index })
  const guard = guarding && !p.rest && (p.charge <= 0 || other.charge > 0)
  const turning = guarding && dist < 2.65 ? 0.36 + p.s.aim * 0.12 : 4.4 + p.s.tempo
  const desired = Math.atan2(ux, uz)
  const heading = p.heading + clamp(wrapAngle(desired - p.heading), -turning * STEP, turning * STEP)
  const aimError = Math.abs(wrapAngle(desired - heading))
  p.inReach = dist < startReach(p) && aimError <= startArc(p.build.weapon)
  // The counter and a new push may land on the same tick. Save the shield's
  // charge first; a depleted battery cannot power both actions for free.
  const incoming = other.charge > 0 && other.charge <= STEP && dist <= other.s.tool.reach + 0.4
  const reserve = guard && incoming && aimError <= GUARD_HALF_ANGLE ? shieldEnergy(p) : 0
  const intent = {
    vx: 0,
    vz: 0,
    ux,
    uz,
    dist,
    guard,
    heading,
    aimError,
    canStart:
      !p.rest &&
      p.cooldown <= 0 &&
      p.charge <= 0 &&
      p.inReach &&
      p.energy + p.s.regen * STEP >= p.pushCost + reserve
  }
  chooseLane(p, other, intent, m.time)
  driveManeuver(p, other, index, m, intent, STEP)
  // Tires need time to bite when the pilot changes lanes. Grippy wheels and
  // a light shell change heading faster. A powered dodge gets a short boost.
  const dxv = intent.vx - p.vx,
    dzv = intent.vz - p.vz
  const acceleration = ((9 + p.s.force * 0.48) / p.s.mass) * (p.maneuver ? 2.7 : 1)
  const weight = Math.min(1, (acceleration * STEP) / (Math.hypot(dxv, dzv) || 1))
  intent.vx = p.vx + dxv * weight
  intent.vz = p.vz + dzv * weight
  return intent
}
export function step(m) {
  m.events.length = 0
  if (m.winner !== null) return
  m.tick++
  m.time = m.tick * STEP
  const pair = m.robots,
    intents = pair.map((p, i) => plan(p, pair[1 - i], i, m))
  const pending = [0, 0],
    shieldCost = [0, 0]
  function impact(i, accuracy, inRange, weapon, source, shieldContact = true) {
    const p = pair[i],
      q = pair[1 - i],
      target = intents[1 - i]
    if (!accuracy || !inRange) {
      p.misses++
      m.events.push({ kind: 'miss', side: i, weapon })
      return
    }
    const error = source
      ? Math.abs(wrapAngle(Math.atan2(source.x - q.x, source.z - q.z) - target.heading))
      : target.aimError
    const flanking = q.build.brain === 2 && error > GUARD_HALF_ANGLE
    const blocked =
      shieldContact && target.guard && !flanking && q.energy - shieldCost[1 - i] >= shieldEnergy(q)
    const strategy = p.build.brain
    const strength = strategy === 0 ? 1.19 : strategy === 3 ? 0.83 : 1
    const force = strikeForce(p.build, p.s)
    const armor = weapon === 3 ? q.s.armor * 0.18 : q.s.armor
    const absorption = weapon === 1 || weapon === 3 ? 0.68 : 0.38
    const damage =
      0.85 *
      force *
      p.s.tool.power *
      strength *
      (1 - armor) *
      (blocked ? absorption : 1) *
      (flanking ? 1.47 : 1)
    pending[1 - i] += damage
    p.damage += damage
    p.hits++
    if (flanking) p.flanks++
    let reply = 0
    if (blocked) {
      q.blocks++
      shieldCost[1 - i] += shieldEnergy(q)
      if (intents[i].dist <= 1.95) {
        reply = q.s.force * 0.43 * (1 - p.s.armor)
        pending[i] += reply
        q.damage += reply
        q.counter = 1
      }
    }
    // Keep the part of a real impact absorbed by the shell. Ring commentary
    // can then explain protection even when the other bot pierces most of it.
    const shellSaved = (damage * armor) / (1 - armor)
    const counterShellSaved = (reply * p.s.armor) / (1 - p.s.armor)
    m.events.push({
      kind: blocked ? 'guard' : 'hit',
      side: i,
      weapon,
      flanking,
      damage,
      reply,
      shellSaved,
      counterShellSaved
    })
  }
  // A travelling tool can arrive after its owner has steered around the
  // target. Carry its direction into the combined impulse for this tick.
  function rangedImpulse(event, dx, dz) {
    if (!event.damage || m.rules < FLIGHT_IMPULSE_RULES) return
    const length = Math.hypot(dx, dz)
    if (!length) return
    const target = intents[1 - event.side]
    target.kickX = (target.kickX || 0) + event.damage * (dx / length + target.ux)
    target.kickZ = (target.kickZ || 0) + event.damage * (dz / length + target.uz)
    event.impulseBearing = Math.atan2(-dx, -dz)
  }
  pair.forEach((p, i) => {
    const q = pair[1 - i],
      v = intents[i]
    p.prevX = p.x
    p.prevZ = p.z
    p.prevHeading = p.heading
    const pose = p.previousPose
    pose.move = p.move
    pose.attack = p.attack
    pose.hit = p.hit
    pose.counter = p.counter
    p.counter = Math.max(0, p.counter - STEP * 2.9)
    pose.guard = p.guard
    pose.charge = p.charge
    p.hit = Math.max(0, p.hit - STEP * 3.1)
    p.guard = v.guard ? 1 : 0
    p.move = Math.min(1, Math.hypot(v.vx, v.vz) / 2)
    p.heading = v.heading
    p.vx = v.vx
    p.vz = v.vz
    v.fired = tickDrive(p, STEP, v.canStart)
    if (!pose.charge && p.charge > 0) p.windingHand = leadingHand(p, q)
  })
  for (let n = m.shots.length - 1; n >= 0; n--) {
    const shot = m.shots[n]
    const q = pair[1 - shot.side]
    const canBlock = q.energy - shieldCost[1 - shot.side] >= shieldEnergy(q)
    const touch = bubbleContact(shot, m.time, STEP, q, intents[1 - shot.side], canBlock)
    if (!touch && m.time + 1e-8 < shot.end) continue
    m.shots.splice(n, 1)
    impact(shot.side, true, !!touch, 2, touch || shot, touch?.shield === true)
    const e = m.events.at(-1)
    e.shotId = shot.id
    rangedImpulse(e, shot.tx - shot.x, shot.tz - shot.z)
    e.flight = shot
    if (shot.burst) e.burst = shot.burst
    e.contactTime = touch?.time ?? shot.end
    if (e.kind === 'miss' && shot.dodgedBy === 1 - shot.side) {
      e.evaded = true
      q.evades++
    }
    e.x = touch?.x ?? shot.tx
    e.z = touch?.z ?? shot.tz
    e.travel = Math.hypot(e.x - shot.x, e.z - shot.z)
    if (e.kind === 'hit' && e.travel >= 1.55) pair[shot.side].longHits++
    e.y = e.kind === 'guard' ? guardImpactHeight : bodyImpactHeight(q.build)
    e.heading = Math.atan2(shot.x - q.x, shot.z - q.z)
  }
  for (let n = m.waves.length - 1; n >= 0; n--) {
    const wave = m.waves[n],
      q = pair[1 - wave.side]
    const r = Math.min(wave.reach, 0.38 + (m.time - wave.start) * 5.65)
    const arrived = Math.hypot(q.x - wave.x, q.z - wave.z) <= r + 0.37
    if (!arrived && r < wave.reach) continue
    impact(wave.side, true, arrived, 3, wave)
    const contact = surfaceContact(wave.x, wave.z, q, m.events.at(-1))
    rangedImpulse(contact, q.x - wave.x, q.z - wave.z)
    if (wave.burst) contact.burst = wave.burst
    contact.travel = Math.hypot(contact.x - wave.x, contact.z - wave.z)
    if (contact.kind === 'hit' && contact.travel >= 1.55) pair[wave.side].longHits++
    m.waves.splice(n, 1)
  }
  pair.forEach((p, i) => {
    const q = pair[1 - i],
      v = intents[i],
      target = intents[1 - i]
    if (v.fired) {
      p.hand = p.windingHand
      const flanking = q.build.brain === 2 && target.aimError > GUARD_HALF_ANGLE
      const chance = trackingChance(p, q, v.aimError, flanking)
      const weapon = p.build.weapon ?? 0
      // tickDrive sets combo when the first tap schedules a second tap.
      // Carry the first launch tick through either tool's flight to the hit.
      const burst = p.combo ? m.tick : p.firstTap || 0
      p.firstTap = p.combo ? m.tick : 0
      const accurate = weapon === 3 || aimed(p, chance)
      if (weapon === 2) {
        const flight = Math.max(0.16, (v.dist - 0.66) / 6.5)
        const lead = flight * (0.4 + p.s.aim * 0.55)
        const miss = accurate ? 0 : p.hand * 1.02
        const shot = {
          id: ++m.shotId,
          side: i,
          start: m.time,
          end: m.time + flight,
          x: p.x + v.ux * 0.59,
          z: p.z + v.uz * 0.59,
          tx: q.x + target.vx * lead - v.uz * miss,
          tz: q.z + target.vz * lead + v.ux * miss,
          height: bodyImpactHeight(q.build),
          aimed: accurate
        }
        m.shots.push(shot)
        if (burst) shot.burst = burst
        m.events.push({ kind: 'launch', side: i, weapon, x: shot.x, z: shot.z })
      } else if (weapon === 3) {
        const wave = { side: i, weapon, x: p.x, z: p.z, reach: p.s.tool.reach, start: m.time }
        if (burst) wave.burst = burst
        m.waves.push(wave)
        m.events.push({ ...wave, kind: 'wave' })
      } else {
        const arc = meleeArc[Math.max(0, weapon)]
        const reach = p.s.tool.reach + 0.42
        impact(i, accurate && v.aimError <= arc, v.dist <= reach, weapon)
        const blow = m.events.at(-1)
        if (burst) blow.burst = burst
        // Credit a sidestep only if the same swing would have connected
        // at the position the defender just vacated.
        if (blow.kind === 'miss') blow.outOfReach = v.dist > reach
        const from = q.dodgeFrom
        if (blow.kind === 'miss' && accurate && from && (m.tick - from.tick) * STEP < 0.65) {
          const x = from.x - p.x,
            z = from.z - p.z
          if (Math.hypot(x, z) <= reach && Math.abs(wrapAngle(Math.atan2(x, z) - v.heading)) <= arc) {
            blow.evaded = true
            q.evades++
          }
        }
        q.dodgeFrom = null
      }
    }
  })
  pair.forEach((p, i) => {
    const v = intents[i]
    rollWheels(p, v, STEP)
    p.energy = Math.max(0, p.energy - shieldCost[i])
    if (pending[i]) {
      p.hp = Math.max(0, p.hp - pending[i])
      p.hit = 1
      const kick = clamp((pending[i] * 0.15) / p.s.mass, 0.56, 3.55)
      p.pushX -= v.ux * kick
      p.pushZ -= v.uz * kick
      if (v.kickX !== undefined) {
        p.pushX += v.kickX * kick / pending[i]
        p.pushZ += v.kickZ * kick / pending[i]
      }
    }
    p.x += (v.vx + p.pushX) * STEP
    p.z += (v.vz + p.pushZ) * STEP
    p.pushX *= 0.87
    p.pushZ *= 0.87
  })
  const [a, b] = pair
  settleBots(pair, intents)
  for (const e of m.events) {
    if (e.kind === 'hit' && e.burst) {
      const bot = pair[e.side]
      if (bot.lastBurstHit === e.burst && (m.tick - bot.lastTapTick) * STEP <= 0.69) {
        e.doubleHit = true
        bot.doubleHits++
      }
      bot.lastBurstHit = e.burst
      bot.lastTapTick = m.tick
    }
    if (e.weapon < 2 && ['hit', 'guard', 'miss'].includes(e.kind))
      locateContact(pair[e.side], pair[1 - e.side], e)
    if (e.damage > 0) {
      const struck = pair[1 - e.side], attacker = pair[e.side]
      rememberImpact(struck, m.tick, e.damage, e.impulseBearing ?? e.heading)
      if (e.reply > 0)
        rememberImpact(attacker, m.tick, e.reply,
          Math.atan2(struck.prevX - attacker.prevX, struck.prevZ - attacker.prevZ))
    }
  }
  if (a.hp <= 0 || b.hp <= 0 || m.time >= TIME_LIMIT) {
    const balance = a.hp / a.s.hp - b.hp / b.s.hp
    m.winner = Math.abs(balance) < 0.00001 ? 2 : balance > 0 ? 0 : 1
    if (m.winner < 2) {
      pair[m.winner].win = 1
      pair[1 - m.winner].defeated = true
    }
  }
}

// When two contacts arrive together the chassis visibly rocks away from
// the harder one. This animation record has no effect on the judge or drive.
function rememberImpact(bot, tick, points, bearing) {
  const hit = bot.lastImpact
  if (hit.tick === tick && hit.points >= points) return
  bot.lastImpact = { tick, points, bearing }
}
