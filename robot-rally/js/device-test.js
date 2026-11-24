import { makeBuild, rounds, frames } from './catalog.js'
import { createMatch, roundSeed, step, STEP } from './match.js'
import { cameras } from './view.js'
import { PerformanceLog } from './performance.js'

const kit = makeBuild(1, 1, 3, 2, 2, 2, 2, 4),
  stage = 3
const warmMs = 1000,
  sampleMs = 4200
const startTick = Math.round(2 / STEP),
  sampleStart = startTick + Math.round(warmMs / (1000 * STEP)),
  sampleEnd = sampleStart + Math.round(sampleMs / (1000 * STEP))
function testBout() {
  const m = createMatch(kit, rounds[stage].build, roundSeed(stage))
  while (m.tick < startTick && m.winner === null) step(m)
  return m
}

// Every camera watches the same passage of the final at normal simulation
// speed. Sample real delivered frames after the driver's one-second warmup.
export function deviceTest({ view, scores, sound, label, done }) {
  const savedScale = view.quality
  const temporaryLog = !view.performanceLog
  if (temporaryLog) view.performanceLog = new PerformanceLog()
  const results = []
  let camera = 0,
    match,
    started,
    sampling = false,
    viewport
  function begin() {
    match = testBout()
    sampling = false
    if (!camera) {
      view.setRobots(kit, rounds[stage], false)
      view.enter(match)
      view.lockCamera = true
      sound.unlock()
      sound.ambience(true)
    } else {
      view.match = match
      view.fx.clear()
      view.weaponEffects.clear()
      view.scuffs.clear()
    }
    view.weaponEffects.resume(match, view.labelModels)
    view.adaptive.scale = 1
    view.adaptive.reset()
    view.resizePending = true
    view.cam = camera
    view.cameraSnap = true
    if (camera === 3) {
      view.orbitPitch = 0.59
      view.orbitYaw = -0.8
      view.zoom = 0.94
    }
    view.blend = 1
    started = performance.now()
    scores.reset(rounds[stage].rival, frames[kit.chassis].name)
    scores.update(match)
    label('Warming up · ' + cameras[camera], cameras[camera])
  }
  function advanceTo(tick) {
    while (match.tick < tick && match.winner === null) {
      step(match)
      view.scuffs.record(match)
      for (const e of match.events) {
        view.event(e)
        sound.matchEvent(e, match, view)
      }
      if (match.tick % 3 === 0) {
        scores.update(match)
        match.robots.forEach((p, i) => sound.drive(i, view.panFor(p), p.move, view.gainFor(p)))
      }
    }
  }
  function stop() {
    view.lockCamera = false
    sound.ambience(false)
    view.adaptive.scale = savedScale
    view.adaptive.reset()
    if (temporaryLog) {
      view.performanceLog.label.remove()
      view.performanceLog = null
    }
  }
  begin()
  return {
    stop,
    advance() {
      const size = view.width + ' × ' + view.height
      if (viewport && size !== viewport) {
        done(null, 'The screen size changed. Run the check in the new orientation.')
        return
      }
      viewport = size
      const now = performance.now(),
        elapsed = now - started
      if (!sampling && elapsed >= warmMs) {
        advanceTo(sampleStart)
        sampling = true
        started = now
        view.performanceLog.reset()
        label('Measuring · ' + cameras[camera], cameras[camera])
      } else if (sampling && elapsed >= sampleMs) {
        advanceTo(sampleEnd)
        const summary = view.performanceLog.summary()
        if (!summary) {
          done(null, 'Too few frames were available. Run the check again.')
          return
        }
        results.push({ camera: cameras[camera], fromTick: sampleStart, toTick: match.tick, ...summary })
        if (++camera === cameras.length) {
          done({ viewport, results })
          return
        }
        begin()
        return
      }
      const phaseStart = sampling ? sampleStart : startTick
      const position = phaseStart + (performance.now() - started) / (1000 * STEP)
      advanceTo(Math.min(sampling ? sampleEnd : sampleStart, Math.floor(position)))
      view.blend = Math.min(1, Math.max(0, position - match.tick))
    }
  }
}

export function deviceReport({ viewport, results }) {
  return `<p class="copy">${viewport} · Same 4.2-second passage for each camera.</p>
    <table class="device-report"><thead><tr><th>Camera</th><th>FPS</th><th>95th frame</th><th>Min scale</th></tr></thead>
    <tbody>${results.map((s) => `<tr><th>${s.camera}</th><td>${s.fps}</td><td>${s.p95} ms</td><td>${s.minRatio}×</td></tr>`).join('')}</tbody></table>`
}

export function deviceCsv({ viewport, results }) {
  const rows = [
    [
      'Viewport',
      'Camera',
      'From tick',
      'To tick',
      'Frames',
      'Average FPS',
      '95th percentile ms',
      'Max frame ms',
      'Minimum pixel ratio',
      'Maximum draw calls',
      'Maximum triangles'
    ]
  ]
  for (const r of results)
    rows.push([
      viewport,
      r.camera,
      r.fromTick,
      r.toTick,
      r.frames,
      r.fps,
      r.p95,
      r.maxFrame,
      r.minRatio,
      r.maxCalls,
      r.maxTriangles
    ])
  return '\uFEFF' + rows.map((row) => row.join(',')).join('\r\n') + '\r\n'
}
