import { bubbleContact } from './bubble-motion.js'

// Pick a short, committed drive from what the bot can currently see. Once a
// dash starts its wheels cannot turn it into a new dash every simulation tick.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const signedAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a))
export function maneuverState() {
  return {
    maneuver: '',
    maneuverUntil: 0,
    nextManeuver: 0,
    steerX: 0,
    steerZ: 0,
    dashes: 0,
    dodges: 0,
    evades: 0
  }
}

function bubbleThreat(p, m, i) {
  for (const shot of m.shots) {
    if (shot.side === i || shot.end - m.time < 0.09) continue
    const life = shot.end - shot.start,
      t = clamp((m.time - shot.start) / life, 0, 1)
    const dx = shot.tx - shot.x,
      dz = shot.tz - shot.z
    const x = shot.x + dx * t - p.x,
      z = shot.z + dz * t - p.z
    if (Math.abs(signedAngle(Math.atan2(x, z) - p.heading)) > (p.s.field * Math.PI) / 360) continue
    const vx = dx / life,
      vz = dz / life
    const crossing = -(x * vx + z * vz) / (vx * vx + vz * vz || 1)
    const reaction = 0.23 + (p.s.tempo - 1) * 0.2 + (p.s.aim - 0.67) * 0.22
    if (crossing < 0.07 || crossing > reaction || crossing > shot.end - m.time + 0.03) continue
    const gapX = x + vx * crossing,
      gapZ = z + vz * crossing
    if (Math.hypot(gapX, gapZ) > 0.61) continue
    // Both starting marks use their own left and right. A wall closes the
    // outward escape lane, so choose the clear lane first.
    const size = Math.hypot(dx, dz),
      nx = -dz / size,
      nz = dx / size
    const side = gapX * nx + gapZ * nz > 0.03 ? -1 : gapX * nx + gapZ * nz < -0.03 ? 1 : p.dodges % 2 ? -1 : 1
    const room = Math.hypot(p.x + nx * side * 0.65, p.z + nz * side * 0.65)
    const sign = room > 3.04 ? -side : side
    return { x: nx * sign, z: nz * sign, shot }
  }
  return null
}

export function driveManeuver(p, other, index, m, intent, stepSeconds) {
  const { brain: logic, weapon } = p.build
  if (p.rest || m.time >= p.maneuverUntil) p.maneuver = ''
  if (!p.maneuver && !p.rest && p.charge <= 0 && m.time >= p.nextManeuver && m.winner === null) {
    let kind = '',
      dx = 0,
      dz = 0
    const energy = (logic === 0 ? 2.1 : 2.6) * (1 + p.s.armor)
    if (p.energy >= p.pushCost + energy) {
      const threat = logic !== 2 && m.shots.length ? bubbleThreat(p, m, index) : null
      if (threat) {
        kind = 'dodge'
        dx = threat.x
        dz = threat.z
        // A moving robot can already be rolling clear. Only credit its dodge
        // if the bubble would cross its previous course before flight ends.
        const shot = threat.shot
        if (bubbleContact(shot, shot.end, shot.end - m.time + stepSeconds, p, p, false))
          shot.dodgedBy = index
      } else if (
        logic === 0 &&
        weapon < 2 &&
        p.gateTactic === 'Cut in' &&
        p.cooldown < 0.48 &&
        intent.dist > p.s.tool.reach + 0.26 &&
        intent.dist < 3.12
      ) {
        kind = 'dash'
        dx = intent.dashX ?? intent.ux
        dz = intent.dashZ ?? intent.uz
      } else if (
        logic === 3 &&
        other.build.weapon < 2 &&
        other.charge > 0 &&
        intent.dist < other.s.tool.reach + 0.22 &&
        p.attack < 0.1
      ) {
        kind = 'dodge'
        p.dodgeFrom = { x: p.x, z: p.z, tick: m.tick }
        const side = p.dodges % 2 ? -1 : 1
        dx = -intent.uz * side
        dz = intent.ux * side
      }
    }
    if (kind) {
      p.energy -= energy
      p.maneuver = kind
      p.steerX = dx
      p.steerZ = dz
      p.maneuverUntil = m.time + (kind === 'dash' ? 0.38 : 0.34)
      p.nextManeuver = p.maneuverUntil + (kind === 'dash' ? 1.48 : logic === 3 ? 1.1 : 1.7) / p.s.tempo
      if (kind === 'dash') p.dashes++
      else p.dodges++
      m.events.push({ kind, side: index, x: p.x, z: p.z })
    }
  }
  if (!p.maneuver) return
  const dash = p.maneuver === 'dash'
  // A charge brakes into tool range. A dodge commits sideways and leaves
  // the turret free to keep tracking the other bot.
  const speed = p.s.speed * (dash ? 1.93 * Math.min(1, Math.max(0.15, (intent.dist - 1.26) * 2.45)) : 1.62)
  intent.vx = p.steerX * speed
  intent.vz = p.steerZ * speed
  if (!dash) intent.canStart = false
}
