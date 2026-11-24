// A course lasts long enough to cross a lane. The turret tracks the rival
// independently, so a robot can shoot across its direction of travel.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const TAU = Math.PI * 2

function nextGate(p, other, intent, time) {
  const strategy = p.build.brain,
    ranged = p.build.weapon >= 2
  const lap = (p.gateNumber ?? -1) + 1
  p.gateNumber = lap
  const bearing = Math.atan2(p.z - other.z, p.x - other.x)
  const wheel = p.s.speed
  const direction = strategy === 3 ? (lap % 2 ? -1 : 1) : 1
  const crossAfter = ranged ? 2.75 : strategy === 2 ? 4.65 : strategy === 3 ? 3.1 : 3.7
  if (time >= (p.nextCross ?? crossAfter)) {
    // Break a close orbit and change ends. One bot goes to open floor and the
    // other has to turn, give chase, or use the range of its tool.
    const radius = strategy === 2 ? 2.27 : 2.82
    const out = Math.hypot(p.x, p.z) > 0.34 ? Math.atan2(p.z, p.x) : bearing
    const side = strategy === 3 && lap % 2 ? -1 : 1
    let best = -Infinity
    for (const turn of [1.05, 1.48, 1.93, 2.34, 2.8]) {
      const theta = out + turn * side
      const x = Math.cos(theta) * radius,
        z = Math.sin(theta) * radius
      const trip = Math.hypot(x - p.x, z - p.z)
      const clearance = Math.hypot(x - other.x, z - other.z)
      const score =
        -Math.abs(trip - (ranged ? 3.7 : 3.05)) +
        (ranged ? 0.58 * clearance : -0.24 * Math.abs(clearance - 2.15))
      if (score > best) {
        best = score
        p.gateX = x
        p.gateZ = z
      }
    }
    p.gateUntil = time + clamp(Math.hypot(p.gateX - p.x, p.gateZ - p.z) / (wheel * 1.12), 1.15, 2.45)
    p.nextCross = p.gateUntil + crossAfter
    p.gateRest = p.rest
    p.gateTactic = ranged
      ? 'Switch ends'
      : strategy === 2
        ? 'Cover lane'
        : strategy === 3
          ? 'Break wide'
          : 'Loop wide'
    return
  }
  let angle, gap, duration, tactic
  if (p.rest || (ranged && intent.dist < other.s.tool.reach + 0.3)) {
    angle = direction * 1.48
    gap = Math.min(4, p.s.tool.reach + 1)
    duration = 0.98
    tactic = p.rest ? 'Pit turn' : 'Keep away'
  } else if (strategy === 1) {
    angle = 1.05
    gap = Math.max(1.32, p.s.tool.reach - 0.34)
    duration = 0.88
    tactic = 'Circle wide'
  } else if (strategy === 2) {
    angle = 0.84
    gap = Math.max(1.36, p.s.tool.reach - 0.43)
    duration = 1.15
    tactic = 'Patrol'
  } else if (strategy === 3) {
    angle = direction * (lap % 3 === 0 ? 1.75 : 1.24)
    gap = ranged ? p.s.tool.reach - 0.62 : lap % 3 === 0 ? 2.05 : 1.04
    duration = 0.76
    tactic = direction > 0 ? 'Cut left' : 'Cut right'
  } else {
    const exit = lap % 3 === 1
    angle = exit ? 1.95 : 0.97
    gap = ranged ? p.s.tool.reach - 0.58 : exit ? 2.28 : 0.84
    duration = exit ? 0.89 : 0.93
    tactic = exit ? 'Sweep out' : 'Cut in'
  }
  // Select a destination on the floor. Penalize gates that have too little
  // runway, point into a rail, or would take the bot out of firing distance.
  const idealX = other.x + Math.cos(bearing + angle) * gap
  const idealZ = other.z + Math.sin(bearing + angle) * gap
  let best = -Infinity
  for (const radius of [1.14, 2.05, 2.83]) {
    for (let k = 0; k < 12; k++) {
      const a = bearing + (direction * TAU * k) / 12
      const x = Math.cos(a) * radius,
        z = Math.sin(a) * radius
      const trip = Math.hypot(x - p.x, z - p.z)
      const forward = ((x - p.x) * -intent.uz + (z - p.z) * intent.ux) * direction
      const score =
        -Math.hypot(x - idealX, z - idealZ) -
        Math.max(0, 1.12 - trip) * 2 +
        Math.min(1.4, forward) * 0.26 -
        Math.abs(Math.hypot(x - other.x, z - other.z) - gap) * 0.24
      if (score > best) {
        best = score
        p.gateX = x
        p.gateZ = z
      }
    }
  }
  p.gateUntil = time + duration * clamp(2 / wheel, 0.78, 1.35)
  p.gateTactic = tactic
  p.gateRest = p.rest
}

export function chooseLane(p, other, intent, time) {
  if (
    p.gateUntil === undefined ||
    time >= p.gateUntil ||
    p.gateRest !== p.rest ||
    Math.hypot(p.x - p.gateX, p.z - p.gateZ) < 0.32
  )
    nextGate(p, other, intent, time)
  const dx = p.gateX - p.x,
    dz = p.gateZ - p.z,
    distance = Math.hypot(dx, dz) || 1
  p.tactic = p.gateTactic
  const speed = p.s.speed * (p.rest ? 0.72 : p.build.brain === 2 ? 0.89 : 1.27)
  intent.vx = (dx / distance) * speed
  intent.vz = (dz / distance) * speed
  if (p.build.brain === 0 && p.build.weapon < 2 && !p.rest && p.gateTactic !== 'Sweep out') {
    const lead = clamp((intent.dist - 1.12) / Math.max(1, speed * 2), 0, 0.42)
    const x = other.x + (other.x - other.prevX) * 30 * lead - p.x
    const z = other.z + (other.z - other.prevZ) * 30 * lead - p.z
    const length = Math.hypot(x, z) || 1
    intent.dashX = x / length
    intent.dashZ = z / length
  }
}
