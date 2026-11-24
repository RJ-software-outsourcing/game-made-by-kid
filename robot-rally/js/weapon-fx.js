import * as T from '../vendor/three.module.js'
import { STEP } from './match.js'

function bubbleFilm() {
  const material = new T.MeshPhysicalMaterial({
    color: 0xa3e6e0,
    metalness: 0.08,
    roughness: 0.065,
    iridescence: 1,
    iridescenceIOR: 1.36,
    iridescenceThicknessRange: [160, 540],
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    transparent: true,
    depthWrite: false,
    side: T.FrontSide
  })
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `
      float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
      float rim = pow(1.0-facing, 1.7);
      vec3 sheen = 0.55 + 0.45*cos(6.283*(facing*1.27 + normal.y*0.22 + vec3(0.02,0.34,0.67)));
      outgoingLight += sheen * (0.09 + rim*0.42);
      diffuseColor.a = 0.18 + rim*0.80;
      #include <opaque_fragment>
    `
    )
  }
  return material
}
const tau = Math.PI * 2

// The simulation supplies launch, interception and miss coordinates. Visuals
// share its clock. Camera cuts and pauses never move a bubble past its hit.
export class WeaponEffects {
  constructor(scene) {
    this.dummy = new T.Object3D()
    this.origins = new Map()
    this.ray = new T.Vector3()
    this.bubbles = new T.InstancedMesh(new T.SphereGeometry(0.158, 18, 12), bubbleFilm(), 48)
    this.waveMesh = new T.InstancedMesh(
      new T.TorusGeometry(1, 0.014, 5, 72),
      new T.MeshBasicMaterial({
        color: 0xffd288,
        transparent: true,
        opacity: 0.65,
        depthWrite: false
      }),
      8
    )
    this.bubbles.frustumCulled = this.waveMesh.frustumCulled = false
    scene.add(this.bubbles, this.waveMesh)
    this.clear()
  }
  clear() {
    this.arrivals = []
    this.waves = []
    this.pops = []
    this.origins.clear()
    this.bubbles.count = this.waveMesh.count = 0
    this.bubbles.visible = this.waveMesh.visible = false
  }
  resume(match, models) {
    // A restored bubble is already in flight. Reconstruct it from its fixed
    // launch mark, not the current position of the robot that fired it.
    for (const shot of match.shots) {
      const rig = models[shot.side],
        height = rig.getPartPosition('weapon', this.ray).y
      this.origins.set(shot.id, new T.Vector3(shot.x, height, shot.z))
    }
    for (const wave of match.waves) this.wave(wave, wave.start)
  }
  wave(e, time) {
    this.waves.push({ x: e.x, z: e.z, time, reach: e.reach, side: e.side })
  }
  arrive(e, time, spray) {
    // The hit is known at the next fixed step. The picture may still be
    // between steps, so finish that last piece of the flight on screen.
    const end = e.contactTime ?? time
    this.arrivals.push({ shot: e.flight, begin: time - STEP, end, x: e.x, z: e.z, y: e.y })
    if (!spray) return
    if (this.pops.length >= 6) this.pops.shift()
    this.pops.push({ x: e.x, z: e.z, y: e.y ?? 0.86, time: end, angle: e.heading || 0 })
  }
  flightPoint(shot, muzzle, time) {
    const t = T.MathUtils.clamp((time - shot.start) / (shot.end - shot.start), 0, 1)
    // Leave the individual chassis socket, then join the line used by the
    // collision detector. A wide shoulder cannot pull the bubble off course.
    const fromMuzzle = 1 - T.MathUtils.smoothstep(t, 0, 0.32)
    const targetY = shot.height ?? 0.86
    return this.dummy.position.set(
      T.MathUtils.lerp(shot.x, shot.tx, t) + (muzzle.x - shot.x) * fromMuzzle,
      T.MathUtils.lerp(muzzle.y, targetY, t) + 0.2 * Math.sin(t * Math.PI),
      T.MathUtils.lerp(shot.z, shot.tz, t) + (muzzle.z - shot.z) * fromMuzzle
    )
  }
  drawFlight(shot, time, models, arrival) {
    if (time < shot.start || time >= (arrival?.end ?? shot.end)) return
    let origin = this.origins.get(shot.id)
    if (!origin) {
      origin = new T.Vector3()
      models[shot.side].getToolRay(origin, this.ray)
      this.origins.set(shot.id, origin)
    }
    const d = this.dummy
    const duration = shot.end - shot.start
    for (let bead = 0; bead < 2; bead++) {
      const at = time - bead * .09 * duration
      if (at < shot.start) continue
      if (arrival && at >= arrival.begin) {
        this.flightPoint(shot, origin, arrival.begin)
        const t = T.MathUtils.clamp((at - arrival.begin) / Math.max(.00001, arrival.end - arrival.begin), 0, 1)
        d.position.x = T.MathUtils.lerp(d.position.x, arrival.x, t)
        d.position.y = T.MathUtils.lerp(d.position.y, arrival.y, t)
        d.position.z = T.MathUtils.lerp(d.position.z, arrival.z, t)
      } else this.flightPoint(shot, origin, at)
      d.position.y -= bead * .042
      const progress = (time - shot.start) / duration
      const size = bead ? .27 : .84 + .2 * Math.sin(progress * Math.PI)
      d.scale.set(size, size * (1 + .05 * Math.sin(progress * 10)), size)
      d.updateMatrix()
      this.bubbles.setMatrixAt(this.bubbles.count++, d.matrix)
    }
  }
  update(match, time, player, enemy) {
    const d = this.dummy, models = [player, enemy]
    d.rotation.set(0, 0, 0)
    this.bubbles.count = 0
    for (let i = this.arrivals.length - 1; i >= 0; i--) {
      const arrival = this.arrivals[i]
      if (time >= arrival.end) this.arrivals.splice(i, 1)
      else this.drawFlight(arrival.shot, time, models, arrival)
    }
    for (const shot of match.shots) this.drawFlight(shot, time, models)
    for (const id of this.origins.keys())
      if (!match.shots.some(s => s.id === id) && !this.arrivals.some(a => a.shot.id === id)) this.origins.delete(id)
    let n = this.bubbles.count
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const pop = this.pops[i],
        age = time - pop.time
      if (age > 0.31) {
        this.pops.splice(i, 1)
        continue
      }
      if (age < 0) continue
      for (let j = 0; j < 5 && n < 48; j++) {
        const angle = pop.angle + (j * tau) / 5,
          reach = age * (0.8 + j * 0.12)
        d.position.set(
          pop.x + Math.sin(angle) * reach,
          pop.y + age * (0.64 + (j % 3) * 0.45) - age * age * 3.1,
          pop.z + Math.cos(angle) * reach
        )
        d.scale.setScalar((0.23 + (j % 2) * 0.12) * Math.max(0.01, 1 - age / 0.32))
        d.updateMatrix()
        this.bubbles.setMatrixAt(n++, d.matrix)
      }
    }
    this.bubbles.count = n
    this.bubbles.visible = n > 0
    if (n) this.bubbles.instanceMatrix.needsUpdate = true
    let rings = 0
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i],
        age = time - w.time
      if (age > 0.52) {
        this.waves.splice(i, 1)
        continue
      }
      if (w.height === undefined) {
        const rig = w.side ? enemy : player
        rig.getToolRay(d.position, this.ray)
        w.height = d.position.y
      }
      for (let j = 0; j < 2; j++) {
        const progress = (age - j * 0.075) / 0.44
        if (progress <= 0 || progress >= 1 || rings >= 8) continue
        d.position.set(w.x, w.height * (1 - progress * 0.37) + 0.08 * Math.sin(progress * Math.PI), w.z)
        d.rotation.set(Math.PI / 2, 0, 0)
        d.scale.setScalar(0.38 + Math.min(w.reach - 0.38, progress * 0.44 * 5.65))
        d.updateMatrix()
        this.waveMesh.setMatrixAt(rings++, d.matrix)
      }
    }
    this.waveMesh.count = rings
    this.waveMesh.visible = rings > 0
    if (rings) this.waveMesh.instanceMatrix.needsUpdate = true
  }
}
