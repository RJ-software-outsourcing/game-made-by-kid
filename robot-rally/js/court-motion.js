import { guardHalfAngle } from './bumper-contact.js'

const facingShield = (intent) => intent.guard && intent.aimError <= guardHalfAngle
export const drivingRadius = 3.08

// Keep both drive bases on the floor. A pair pressed against the same
// curved rail can slide along it while keeping its full contact distance.
export function settleBots(pair, intents) {
  const radius = drivingRadius
  for (const p of pair) {
    const length = Math.hypot(p.x, p.z)
    if (length > radius) {
      p.x *= radius / length
      p.z *= radius / length
    }
  }
  const [a, b] = pair,
    dx = b.x - a.x,
    dz = b.z - a.z,
    distance = Math.hypot(dx, dz)
  const guards = Number(facingShield(intents[0])) + Number(facingShield(intents[1]))
  const gap = guards === 2 ? 1.64 : guards === 1 ? 1.5 : 1.28
  if (distance >= gap) return
  const nx = distance > 1e-6 ? dx / distance : Math.sin(a.heading),
    nz = distance > 1e-6 ? dz / distance : Math.cos(a.heading)
  const push = gap - distance,
    share = b.s.mass / (a.s.mass + b.s.mass)
  let mx = (a.x + b.x) / 2 + nx * push * (0.5 - share),
    mz = (a.z + b.z) / 2 + nz * push * (0.5 - share)
  const half = gap / 2,
    length2 = mx * mx + mz * mz,
    along = Math.abs(mx * nx + mz * nz)
  // Both ends of the centered segment fit if its farthest end fits.
  if (length2 + 2 * half * along + half * half > radius * radius) {
    const h = half * along
    const s = (Math.sqrt(h * h + length2 * (radius * radius - half * half)) - h) / length2
    mx *= s
    mz *= s
  }
  a.x = mx - nx * half
  a.z = mz - nz * half
  b.x = mx + nx * half
  b.z = mz + nz * half
}
