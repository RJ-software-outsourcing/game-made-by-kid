// Probe with a smaller drawing buffer when several frames miss their deadline.
// Some iPads deliver a steady 30 Hz in Low Power Mode. If two probes still
// produce the same 30 Hz cadence, put the original detail back.
const floor = 0.58
export class RenderQuality {
  constructor() {
    this.scale = 1
    this.reset()
  }
  reset() {
    this.elapsed = 0
    this.frames = 0
    this.late = 0
    this.halfRate = 0
    this.probes = 0
    this.probeStart = this.scale
    this.hold = 0
    this.fastSeconds = 0
  }
  sample(seconds) {
    if (!(seconds > 0)) return false
    const dt = Math.min(seconds, 0.25)
    this.elapsed += dt
    this.frames++
    if (dt > 0.025) this.late++
    if (dt >= 0.029 && dt <= 0.037) this.halfRate++
    if (this.elapsed < 1.25 || this.frames < 8) return false
    const span = this.elapsed,
      mean = span / this.frames
    const steadyHalf = this.halfRate / this.frames > 0.86
    const slow = this.late / this.frames > 0.53 && mean > 0.025
    this.elapsed = this.frames = this.late = this.halfRate = 0
    const before = this.scale
    this.hold = Math.max(0, this.hold - span)
    if (slow) {
      this.fastSeconds = 0
      if (steadyHalf && (this.probes === 2 || (this.probes > 0 && this.scale === floor))) {
        this.scale = this.probeStart
        this.hold = 18
        this.probes = 0
      } else if (!steadyHalf || this.hold === 0) {
        if (steadyHalf && this.scale > floor) {
          if (this.probes === 0) this.probeStart = this.scale
          this.probes++
        } else this.probes = 0
        this.scale = Math.max(floor, this.scale - 0.14)
      }
    } else {
      this.probes = 0
      this.fastSeconds = mean < 0.0205 ? this.fastSeconds + span : 0
      if (this.fastSeconds >= 8) {
        this.scale = Math.min(1, this.scale + 0.08)
        this.fastSeconds = 0
      }
    }
    return before !== this.scale
  }
}
