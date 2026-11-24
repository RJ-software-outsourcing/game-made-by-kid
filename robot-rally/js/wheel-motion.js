// Visual odometry stays on the simulation clock. An orbiting chassis steers
// into its path while its head can keep looking at the opponent.
export const tireWidths = [0.165, 0.13, 0.21, 0.195]
// Half-track, axle offsets and tire scale are shared by the mesh, odometry,
// grounding shadows and skid marks. Positive Z is the nose of the chassis.
export const chassisWheels = [
  { axle: [0.35, 0.03], wheelScale: 1 },
  { axle: [0.493, 0.403], rear: -0.442, wheelScale: 1.1 },
  { axle: [0.448, 0.232], rear: -0.247, wheelScale: 0.86 },
  { axle: [0.414, -0.01], wheelScale: 1.03 },
  { axle: [0.635, 0.01], wheelScale: 1.09 },
  { axle: [0.4, -0.122], wheelScale: 0.92 }
]
const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a))
const clamp = (x, min, max) => Math.max(min, Math.min(max, x))

export function wheelState(heading) {
  return {
    bodyHeading: heading,
    prevBodyHeading: heading,
    leftTravel: 0,
    rightTravel: 0,
    prevLeftTravel: 0,
    prevRightTravel: 0
  }
}
export function rollWheels(p, intent, seconds) {
  p.prevBodyHeading = p.bodyHeading
  p.prevLeftTravel = p.leftTravel
  p.prevRightTravel = p.rightTravel
  let desired = p.heading
  const steering = !(p.guard >= .5) || p.maneuver === 'dodge' || p.build.weapon === 2
  const firing = p.build.weapon < 2 && (p.charge || p.attack > 0.22)
  if (steering && !firing && p.move > 0.06) {
    const path = Math.atan2(intent.vx, intent.vz)
    let bearing = angle(path - p.heading)
    // Reverse towards the boards without swinging the entire body around.
    if (Math.abs(bearing) > Math.PI * 0.64) bearing = angle(bearing + Math.PI)
    desired = p.heading + (Math.abs(bearing)<1e-8 ? 0 : clamp(bearing, -1.48, 1.48))
  }
  const rotation = clamp(angle(desired - p.bodyHeading), -seconds * 9.5, seconds * 9.5)
  const middle = p.bodyHeading + rotation / 2
  const forward = (intent.vx * Math.sin(middle) + intent.vz * Math.cos(middle)) * seconds
  p.bodyHeading += rotation
  const halfTrack = chassisWheels[p.build.chassis ?? 0].axle[0]
  p.leftTravel += forward + halfTrack * rotation
  p.rightTravel += forward - halfTrack * rotation
}
