// Lift the ringside camera as one body passes behind the other. On a clear
// side view, the camera stays near the crowd and the tools fill the frame.
export function ringsideLift(dx, dz, yaw) {
  const sideways = Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw))
  const coverage = 1 - Math.min(1, sideways / 1.3)
  return coverage * coverage * (3 - 2 * coverage) * 2.6
}
