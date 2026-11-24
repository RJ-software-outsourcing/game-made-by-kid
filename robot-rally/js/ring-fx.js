import * as THREE from '../vendor/three.module.js'
import { palmHeight as contactY, guardImpactHeight } from './bumper-contact.js'

const TAU = 2 * Math.PI
const burstCount = 6
const sparkCount = 12
const puffCount = 4

const fragmentOutput = `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`

// All bursts use the same three instanced batches, including simultaneous hits.
function batch(scene, name, shape, capacity, fields, vertexShader, fragmentShader, surface) {
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.setAttribute('position', shape.getAttribute('position'))
  if (shape.index) geometry.setIndex(shape.index)
  shape.dispose()
  const attributes = {}
  for (const [key, size] of Object.entries(fields)) {
    const attribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity * size), size)
    attribute.setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute(key, attribute)
    attributes[key] = attribute
  }
  geometry.instanceCount = 0
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    ...surface
  })
  material.forceSinglePass = true
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.frustumCulled = false
  mesh.visible = false
  mesh.renderOrder = 3
  scene.add(mesh)
  const streams = Object.values(attributes)
  return {
    attributes,
    mesh,
    display(count) {
      mesh.visible = count > 0
      geometry.instanceCount = count
      if (!count) return
      for (const attr of streams) {
        attr.clearUpdateRanges()
        attr.addUpdateRange(0, count * attr.itemSize)
        attr.needsUpdate = true
      }
    },
    dispose() {
      mesh.removeFromParent()
      geometry.dispose()
      material.dispose()
    }
  }
}

function filamentShape() {
  // x and y are the radial cross section. z is travel from tail to tip.
  const rings = [
    [0, 0.05],
    [0.27, 0.39],
    [0.79, 0.65],
    [0.91, 1],
    [1, 0.08]
  ]
  const p = []
  const index = []
  const sides = 6
  for (let i = 0; i < rings.length; i++) {
    for (let j = 0; j < sides; j++) {
      const t = (j * TAU) / sides
      const [along, radius] = rings[i]
      p.push(radius * Math.cos(t), radius * Math.sin(t), along)
      if (i + 1 < rings.length) {
        const a = i * sides + j,
          b = i * sides + ((j + 1) % sides)
        index.push(a, b, a + sides, b, b + sides, a + sides)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
  g.setIndex(index)
  return g
}

const sparkVertex = `
  attribute vec4 originAge;
  attribute vec4 velocityLife;
  attribute vec4 style;
  varying vec3 tint;
  varying float alpha;
  void main() {
    float t = max(0.0, originAge.w - (1.0 - position.z) * style.y);
    float drag = 1.0 + 0.75 * t;
    vec3 p = originAge.xyz + velocityLife.xyz * t / drag - vec3(0.0, 2.7*t*t, 0.0);
    vec3 tangent = normalize(velocityLife.xyz / (drag*drag) - vec3(0.0, 5.4*t, 0.0));
    vec3 reference = abs(tangent.y) > 0.96 ? vec3(1,0,0) : vec3(0,1,0);
    vec3 right = normalize(cross(reference, tangent));
    vec3 up = cross(tangent, right);
    float progress = originAge.w / velocityLife.w;
    p += (right * position.x + up * position.y) * style.x * (1.0 - 0.55*progress);
    float heat = (1.0 - progress) * (0.48 + 0.52 * position.z);
    vec3 warm = mix(vec3(0.90,0.26,0.035),vec3(2.28,1.42,0.63),heat);
    vec3 cool = mix(vec3(0.05,0.67,0.60),vec3(1.2,2.0,1.73),heat);
    tint = mix(warm,cool,style.z) * style.w;
    alpha = (1.0 - smoothstep(0.24,1.0,progress)) * (0.46 + 0.53*position.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
  }`
const sparkFragment = `
  varying vec3 tint;
  varying float alpha;
  void main() {
    gl_FragColor = vec4(tint,alpha);
    ${fragmentOutput}
  }`

const volumeVertex = `
  attribute vec4 centerScale;
  attribute vec4 aspectAlpha;
  attribute vec2 kindSeed;
  varying vec3 local;
  varying vec3 eyeNormal;
  varying vec3 toEye;
  varying float opacity;
  varying vec2 kind;
  void main() {
    vec3 size = centerScale.w * aspectAlpha.xyz;
    vec3 p = centerScale.xyz + size * position;
    vec4 mv = modelViewMatrix * vec4(p,1.0);
    local = position;
    eyeNormal = normalMatrix * (position / aspectAlpha.xyz);
    toEye = -mv.xyz;
    opacity = aspectAlpha.w;
    kind = kindSeed;
    gl_Position = projectionMatrix * mv;
  }`
const volumeFragment = `
  varying vec3 local;
  varying vec3 eyeNormal;
  varying vec3 toEye;
  varying float opacity;
  varying vec2 kind;
  void main() {
    float chord = clamp(dot(normalize(eyeNormal),normalize(toEye)),0.0,1.0);
    float core = step(1.5,kind.x);
    float guard = mod(kind.x,2.0);
    float wisp = 0.72 + 0.18*sin(4.1*local.x + 2.7*local.y + kind.y)
                    + 0.10*sin(3.7*local.z - 1.9*local.y - kind.y);
    float density = pow(chord, mix(2.1,4.5,core)) * mix(wisp,1.0,core);
    vec3 haze = mix(vec3(0.75,0.55,0.34),vec3(0.27,0.67,0.64),guard);
    vec3 hot = mix(vec3(2.8,2.1,1.10),vec3(1.7,2.7,2.32),guard);
    gl_FragColor = vec4(mix(haze,hot,core),density * opacity);
    ${fragmentOutput}
  }`

function shieldShape() {
  const g = new THREE.BufferGeometry()
  // Rings across the surface give the directional shield its bowed profile, even edge-on.
  const segments = 40,
    bands = 7
  const points = [0, 0, 0],
    indices = []
  for (let i = 1; i <= bands; i++) {
    for (let j = 0; j < segments; j++) {
      const a = (TAU * j) / segments
      points.push((Math.cos(a) * i) / bands, (Math.sin(a) * i) / bands, 0)
      const current = 1 + (i - 1) * segments + j
      const next = 1 + (i - 1) * segments + ((j + 1) % segments)
      if (i === 1) indices.push(0, current, next)
      else indices.push(current - segments, current, next, current - segments, next, next - segments)
    }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  g.setIndex(indices)
  return g
}

const shieldVertex = `
  attribute vec4 contact;
  varying vec2 disc;
  varying vec3 eyeNormal;
  varying vec3 toEye;
  varying float age;
  void main() {
    float t = contact.w;
    float s = sin(contact.z), c = cos(contact.z);
    vec3 forward = vec3(s,0.0,c), right = vec3(c,0.0,-s);
    float r = length(position.xy);
    vec2 dir = position.xy / max(r,0.00001);
    float theta = r * 1.02;
    float growth = 0.78 + 0.22*smoothstep(0.0,0.115,t);
    vec3 lateral = right * dir.x + vec3(0.0,dir.y*0.87,0.0);
    vec3 p = vec3(contact.x,${guardImpactHeight},contact.y) +
      0.80 * growth * (sin(theta)*lateral + (cos(theta)-1.0)*forward);
    vec4 mv = modelViewMatrix * vec4(p,1.0);
    eyeNormal = normalMatrix * (cos(theta)*forward + sin(theta)*lateral);
    toEye = -mv.xyz;
    disc = position.xy;
    age = t;
    gl_Position = projectionMatrix * mv;
  }`
const shieldFragment = `
  varying vec2 disc;
  varying vec3 eyeNormal;
  varying vec3 toEye;
  varying float age;
  void main() {
    float r = length(disc);
    float fresnel = pow(1.0-abs(dot(normalize(eyeNormal), normalize(toEye))),1.6);
    float pulse = (1.0-smoothstep(0.12,0.40,age)) * smoothstep(0.0,0.025,age);
    float waveCenter = 0.12 + 0.93 * (1.0-exp(-11.0*age));
    float delta = (r-waveCenter)/0.087;
    float wave = exp(-delta*delta);
    float arc = 1.0-smoothstep(0.012,0.060,abs(r-0.90));
    float highlights = 0.35 + 0.65*smoothstep(0.1,0.8,abs(disc.x + 0.3*disc.y));
    float edge = (1.0-smoothstep(0.87,1.0,r));
    float alpha = (0.13 + 0.22*fresnel + 0.50*wave)*edge + arc*0.78*highlights;
    vec3 jade = mix(vec3(0.018,0.38,0.31),vec3(0.37,1.32,0.99),
                    clamp(0.25*fresnel + 0.47*wave + arc*0.78,0.0,1.0));
    gl_FragColor = vec4(jade,alpha*pulse);
    ${fragmentOutput}
  }`

/** A world-space contact effect. Heading points from the defender toward the attacker (+Z = 0).
 * update takes elapsed seconds; the active render camera supplies the viewing direction in shaders.
 */
export function createRingEffects(scene) {
  const sparks = batch(
    scene,
    'Warm metal filaments',
    filamentShape(),
    burstCount * sparkCount,
    { originAge: 4, velocityLife: 4, style: 4 },
    sparkVertex,
    sparkFragment,
    { side: THREE.DoubleSide }
  )
  const volumes = batch(
    scene,
    'Contact light and pad dust',
    new THREE.SphereGeometry(1, 12, 8),
    burstCount * puffCount,
    { centerScale: 4, aspectAlpha: 4, kindSeed: 2 },
    volumeVertex,
    volumeFragment,
    { side: THREE.FrontSide }
  )
  const shields = batch(
    scene,
    'Curved deflection light',
    shieldShape(),
    burstCount,
    { contact: 4 },
    shieldVertex,
    shieldFragment,
    { side: THREE.DoubleSide }
  )
  volumes.mesh.renderOrder = 2
  sparks.mesh.renderOrder = 4

  const pool = Array.from({ length: burstCount }, () => ({
    age: 2,
    x: 0,
    z: 0,
    heading: 0,
    guard: 0,
    sparks: Array.from({ length: sparkCount }, () => ({})),
    wisps: Array.from({ length: puffCount - 1 }, () => ({}))
  }))
  let next = 0
  let seed = 91421
  let disposed = false
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  function spawn(x, z, guard, heading = 0, force = 1, height=contactY) {
    if (disposed) return
    const b = pool[next]
    next = (next + 1) % pool.length
    b.age = 0
    b.x = x
    b.z = z
    b.y = height
    b.heading = heading
    b.guard = guard ? 1 : 0
    const s = Math.sin(heading),
      c = Math.cos(heading)
    const count = Math.max(4, Math.min(sparkCount, Math.round((guard ? 7 : sparkCount)*Math.sqrt(force))))
    for (let j = 0; j < b.sparks.length; j++) {
      const p = b.sparks[j]
      if (j >= count) {
        p.life = 0
        continue
      }
      const a = (TAU * (j + random() * 0.7)) / count
      const speed = (1.15 + random() * 1.8)*Math.sqrt(force)
      const side = Math.cos(a) * speed
      const outward = (random() * 0.9 - 0.25) * speed
      p.vx = side * c + outward * s
      p.vy = (Math.sin(a) * 0.6 + 0.4 + random() * 0.35) * speed
      p.vz = -side * s + outward * c
      p.life = (0.21 + random() * 0.22) * (guard ? 0.83 : 1)
      p.width = (0.014 + random() * 0.01) * (guard ? 0.88 : 1)
      p.trail = 0.047 + random() * 0.042
      p.heat = 0.87 + random() * 0.31
    }
    for (const p of b.wisps) {
      const a = random() * TAU
      const speed = 0.32 + random() * 0.52
      p.vx = Math.cos(a) * speed
      p.vz = Math.sin(a) * speed
      p.vy = 0.29 + random() * 0.5
      p.life = 0.34 + random() * 0.19
      p.seed = random() * TAU
      p.size = 0.105 + random() * 0.045
    }
    update(0)
  }
  function update(dt, _cam) {
    if (disposed) return
    let ns = 0,
      nv = 0,
      ng = 0
    const elapsed = Math.max(0, dt)
    const sa = sparks.attributes,
      va = volumes.attributes
    for (const b of pool) {
      if (b.age >= 0.55) continue
      const t = (b.age += elapsed)
      if (t >= 0.55) continue
      if (b.guard && t < 0.4) shields.attributes.contact.setXYZW(ng++, b.x, b.z, b.heading, t)
      for (const p of b.sparks) {
        if (t >= p.life) continue
        sa.originAge.setXYZW(ns, b.x, b.y, b.z, t)
        sa.velocityLife.setXYZW(ns, p.vx, p.vy, p.vz, p.life)
        sa.style.setXYZW(ns++, p.width, p.trail, b.guard, p.heat)
      }
      if (t < 0.115) {
        const f = t / 0.115
        va.centerScale.setXYZW(nv, b.x, b.y, b.z, 0.13 * (1 - 0.55 * f))
        va.aspectAlpha.setXYZW(nv, 1, 0.82, 0.96, (1 - f) * (1 - f))
        va.kindSeed.setXY(nv++, 2 + b.guard, 0)
      }
      for (const p of b.wisps) {
        if (t >= p.life) continue
        const f = t / p.life
        const opacity = Math.sin(Math.PI * f) * (b.guard ? 0.12 : 0.2)
        va.centerScale.setXYZW(
          nv,
          b.x + p.vx * t,
          b.y + p.vy * t,
          b.z + p.vz * t,
          p.size * (0.38 + 1.27 * f)
        )
        va.aspectAlpha.setXYZW(nv, p.size * 4 + 0.72, 0.82, 1, opacity)
        va.kindSeed.setXY(nv++, b.guard, p.seed)
      }
    }
    sparks.display(ns)
    volumes.display(nv)
    shields.display(ng)
  }
  function clear() {
    for (const b of pool) b.age = 2
    next = 0
    seed = 91421
    sparks.display(0)
    volumes.display(0)
    shields.display(0)
  }
  function dispose() {
    if (disposed) return
    disposed = true
    sparks.dispose()
    volumes.dispose()
    shields.dispose()
  }
  return { spawn, update, clear, dispose }
}
