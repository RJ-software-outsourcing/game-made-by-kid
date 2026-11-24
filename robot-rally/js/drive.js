// The pit test and the match use the same battery and actuator. Steering,
// shields and the opponent's movement are handled by the match.
const profiles = [
  { energy: 11, windup: 0.3, cooldown: 1.14 },
  { energy: 8, windup: 0.2, cooldown: 1.1 },
  { energy: 8, windup: 0.35, cooldown: 1.1 },
  { energy: 9, windup: 0.2, cooldown: 1.46 }
]

export const energyPerPush = (build, s) => (profiles[build.brain] ?? profiles[0]).energy * s.draw * (s.tool?.drain ?? 1)

// A full battery and a target in reach show how often this tool can act.
export function readyHitsPerSecond(build, s) {
  const drive = (profiles[build.brain] ?? profiles[0])
  const recovery = drive.cooldown * s.tool.delay
  return build.brain === 3
    ? (2 * s.tempo) / (drive.windup * 2 + .19 + recovery)
    : s.tempo / (drive.windup + recovery)
}

export function driveState(build, s, originalRefill = false) {
  const pushCost = energyPerPush(build, s)
  const reserve = Math.min(s.capacity * .73, 22 * s.draw)
  return {
    build,
    s,
    energy: s.capacity,
    pushCost,
    readyEnergy: originalRefill ? reserve : Math.max(reserve, pushCost),
    charge: 0,
    cooldown: 0,
    rest: false,
    rests: 0,
    combo: false,
    attack: 0
  }
}

export function checkBattery(p) {
  if (p.rest) {
    if (p.energy >= p.readyEnergy) p.rest = false
    return false
  }
  if (p.energy >= p.pushCost) return false
  p.rest = true
  p.rests++
  return true
}

export function tickDrive(p, seconds, canStart) {
  p.attack = Math.max(0, p.attack - seconds * 2.8)
  p.energy = Math.min(p.s.capacity, p.energy + seconds * p.s.regen * (p.rest ? 1.38 : 1))
  p.cooldown = Math.max(0, p.cooldown - seconds)
  const drive = (profiles[p.build.brain] ?? profiles[0])
  if (p.charge > 0) {
    p.charge = Math.max(0, p.charge - seconds)
    if (p.charge > 0) return false
    p.attack = 1
    const second = p.build.brain === 3 && !p.combo && p.energy >= p.pushCost
    p.cooldown = (second ? 0.19 : drive.cooldown * (p.s.tool?.delay ?? 1)) / p.s.tempo
    p.combo = second
    return true
  }
  if (canStart) {
    p.energy -= p.pushCost
    p.charge = drive.windup / p.s.tempo
  }
  return false
}
