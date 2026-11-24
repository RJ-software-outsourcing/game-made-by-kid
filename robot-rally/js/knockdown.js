import { Vector3 } from '../vendor/three.module.js'
import { supportPoints } from './model-outline.js'

const gravity = Array.from({ length: 33 }, (_, i) => {
  const tilt = (i * Math.PI) / 32
  return new Vector3(0, -Math.cos(tilt), -Math.sin(tilt))
})

// Roll around the lowest fitted part. A roof-mounted core or battery can
// reach the floor before the frame does.
export function fallSupport(robot) {
  const points = supportPoints(robot, gravity)
  return (tilt) => {
    const y = -Math.cos(tilt),
      z = -Math.sin(tilt)
    let rise = -Infinity
    for (const point of points) rise = Math.max(rise, point.y * y + point.z * z)
    return rise
  }
}
