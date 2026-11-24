import { guardHalfAngle, guardRadius } from './bumper-contact.js'

export const bubbleBodyRadius = 0.55

function crossing(rx, rz, vx, vz, radius) {
  const outside = rx * rx + rz * rz - radius * radius
  if (outside <= 0) return 0
  const speed2 = vx * vx + vz * vz
  const toward = rx * vx + rz * vz
  const disc = toward * toward - speed2 * outside
  if (speed2 < 1e-12 || toward >= 0 || disc < 0) return null
  const t = (-toward - Math.sqrt(disc)) / speed2
  return t <= 1 ? t : null
}

// Intersect this tick of flight with the moving bot. A raised shield occupies
// only its forward arc, so a bubble can pass just behind the shield's lip.
export function bubbleContact(shot, time, dt, target, motion, canBlock = true) {
  const duration = shot.end - shot.start
  const t0 = Math.max(0, Math.min(1, (time - dt - shot.start) / duration))
  const t1 = Math.max(0, Math.min(1, (time - shot.start) / duration))
  const dx = shot.tx - shot.x,
    dz = shot.tz - shot.z
  const x = shot.x + dx * t0,
    z = shot.z + dz * t0
  const sx = dx * (t1 - t0),
    sz = dz * (t1 - t0)
  const rx = x - target.x,
    rz = z - target.z
  const vx = sx - (motion.vx + target.pushX) * dt
  const vz = sz - (motion.vz + target.pushZ) * dt
  const contact = (t, shield) => ({
    x: x + sx * t, z: z + sz * t, shield,
    time: shot.start + (t0 + (t1 - t0) * t) * duration
  })
  if (canBlock && motion.guard) {
    const t = crossing(rx, rz, vx, vz, guardRadius)
    if (t !== null) {
      const bearing = Math.atan2(rx + vx * t, rz + vz * t) - motion.heading
      if (Math.cos(bearing) >= Math.cos(guardHalfAngle)) return contact(t, true)
    }
  }
  const t = crossing(rx, rz, vx, vz, bubbleBodyRadius)
  return t === null ? null : contact(t, false)
}
