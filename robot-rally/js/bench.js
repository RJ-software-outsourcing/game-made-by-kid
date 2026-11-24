import { stats } from './catalog.js'
import { checkBattery, driveState, tickDrive } from './drive.js'
import { STEP } from './match.js'

export const benchSlots = ['motor', 'shell', 'brain', 'cell']
export const testLength = { roll: 5, push: 10 }
export const defaultTest = (slot) => (slot === 'motor' || slot === 'shell' ? 'roll' : 'push')

export function createTest(current, candidate, mode) {
  const lanes = [current, candidate].map((build) => ({
    ...driveState(build, stats(build)),
    travel: 0,
    pushes: 0,
    compression: 0
  }))
  return { mode, lanes, tick: 0, time: 0, duration: testLength[mode], done: false }
}

export function advanceTest(test) {
  if (test.done) return
  test.tick++
  test.time = test.tick * STEP
  for (const lane of test.lanes) {
    if (test.mode === 'roll') lane.travel = lane.s.speed * test.time
    else {
      checkBattery(lane)
      const canPush = !lane.rest && lane.cooldown <= 0 && lane.charge <= 0
      if (tickDrive(lane, STEP, canPush)) {
        lane.pushes++
        lane.compression = lane.s.force / 22
      } else lane.compression = Math.max(0, lane.compression - STEP * 3)
    }
  }
  test.done = test.tick >= Math.round(test.duration / STEP)
}
