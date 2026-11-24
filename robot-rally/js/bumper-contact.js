// Positions are in arena units. The clear shield and its contact light share
// the same radius and angular sector as the visible guard.
export const guardRadius = 0.835
export const guardHalfAngle = 0.56
export const palmHeight = 0.89
export const guardImpactHeight = 0.77
// Half-width, half-length and chest height at the visible panel struck by a tool.
const hulls = [
  [0.31, 0.27, 0.758],
  [0.44, 0.47, 0.38],
  [0.5, 0.5, 0.42],
  [0.33, 0.21, 0.855],
  [0.4, 0.2, 0.85],
  [0.36, 0.39, 0.505]
]
export const bodyImpactHeight = (build) => hulls[build.chassis ?? 0][2]
export const wristStroke = 0.46
export const shoulderOffset = 0.502
export const palmRest = [0.041, -0.463, 0.235]
export const restReach = Math.hypot(...palmRest)
export const sleeveLength = 0.15
export const sleeveMount = [0.035, -0.154, 0.023]
const wrap = (n) => Math.atan2(Math.sin(n), Math.cos(n))
export function leadingHand(robot, opponent) {
  const bearing = Math.atan2(opponent.x - robot.x, opponent.z - robot.z) - robot.bodyHeading
  const flank = Math.sin(bearing)
  if (Math.abs(flank) > 0.36 && robot.build.brain !== 3) return Math.sign(flank)
  return (robot.hits + robot.misses) % 2 ? -1 : 1
}
export function contactPoint(p, other, e, hand = p.hand) {
  const shoulder = e.kind === 'guard' ? hand * shoulderOffset : 0
  return surfaceContact(
    p.prevX + Math.cos(p.prevBodyHeading) * shoulder,
    p.prevZ - Math.sin(p.prevBodyHeading) * shoulder,
    other,
    e,
    hand
  )
}
export function surfaceContact(x, z, other, e, hand = 0) {
  const dx = x - other.prevX,
    dz = z - other.prevZ
  let angle = Math.atan2(dx, dz)
  let radius
  if (e.kind === 'guard') {
    const offset = wrap(angle - other.heading)
    angle = other.heading + Math.max(-guardHalfAngle * 0.94, Math.min(guardHalfAngle * 0.94, offset))
    radius = guardRadius
  } else {
    const local = angle - other.prevBodyHeading
    const [width, length] = hulls[other.build.chassis ?? 0]
    const plating = [0.01, 0.035, 0.065, 0.045][other.build.shell] ?? 0
    radius = 1 / Math.hypot(Math.sin(local) / (width + plating), Math.cos(local) / (length + plating))
  }
  const miss = e.kind === 'miss' ? hand * 0.63 : 0
  e.x = other.prevX + Math.sin(angle) * radius + Math.cos(angle) * miss
  e.z = other.prevZ + Math.cos(angle) * radius - Math.sin(angle) * miss
  e.y = e.kind === 'guard' ? guardImpactHeight : bodyImpactHeight(other.build)
  e.heading = angle
  return e
}
export function locateContact(p, other, e) {
  contactPoint(p, other, e)
  p.palmX = e.x
  p.palmZ = e.z
  p.palmY = e.y
}
