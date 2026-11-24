// Opt-in measurements stay in this tab. Normal play allocates no timing samples.
export class PerformanceLog {
  constructor() {
    this.label = document.createElement('output')
    this.label.className = 'perf-label'
    this.label.setAttribute('aria-label', 'Rendering performance')
    document.body.append(this.label)
    this.frames = 0
    this.start = 0
    this.reset()
  }
  reset() {
    this.samples = []
    this.firstLiveFrame = true
    this.frames = 0
    this.start = 0
  }
  record(now, raw, metrics, live) {
    if (!raw) {
      // The renderer restarts its clock after a pause, tab switch or idle
      // turntable. Leave the bout samples intact and start a fresh FPS window.
      this.start = now
      this.frames = 0
      return
    }
    this.start ||= now - raw * 1000
    this.frames++
    if (live && raw > 0 && this.samples.length < 4500) {
      if (this.firstLiveFrame) this.firstLiveFrame = false
      else
        this.samples.push({
          ms: raw * 1000,
          ratio: metrics.pixelRatio,
          calls: metrics.draws,
          triangles: metrics.triangles
        })
    }
    if (now - this.start < 1000) return
    const fps = Math.round((this.frames * 1000) / (now - this.start))
    this.label.textContent =
      fps +
      ' FPS · ' +
      metrics.draws +
      ' draws · ' +
      (metrics.triangles / 1000).toFixed(1) +
      'k △ · ' +
      metrics.pixelRatio.toFixed(2) +
      '×'
    Object.assign(this.label.dataset, {
      fps,
      calls: metrics.draws,
      triangles: metrics.triangles,
      ratio: metrics.pixelRatio.toFixed(2)
    })
    this.frames = 0
    this.start = now
  }
  summary() {
    if (!this.samples.length) return null
    const samples = this.samples,
      ms = samples.map((x) => x.ms).sort((a, b) => a - b)
    const mean = ms.reduce((a, b) => a + b, 0) / ms.length
    return {
      frames: ms.length,
      fps: Math.round(1000 / mean),
      p95: Math.round(ms[Math.floor((ms.length - 1) * 0.95)]),
      maxFrame: Math.round(ms.at(-1)),
      minRatio: Math.min(...samples.map((s) => s.ratio)).toFixed(2),
      maxCalls: Math.max(...samples.map((s) => s.calls)),
      maxTriangles: Math.max(...samples.map((s) => s.triangles))
    }
  }
}
