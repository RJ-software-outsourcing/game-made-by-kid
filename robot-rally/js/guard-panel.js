import * as T from '../vendor/three.module.js'
import { GUARD_HALF_ANGLE } from './match.js'
import { guardRadius } from './bumper-contact.js'

// A clear curved bumper makes the shield's facing visible before contact.
// The ends cover the exact angular sector used by the match's block check.
export function createGuardPanels() {
  const positions = [],
    uvs = [],
    indices = []
  const steps = 28
  const rows = [
    [0, 0],
    [0.045, 0.013],
    [0.085, 0.004],
    [0.48, -0.012],
    [0.91, 0.004],
    [0.955, 0.013],
    [1, 0]
  ]
  for (let j = 0; j < rows.length; j++) {
    const [v, lip] = rows[j]
    for (let i = 0; i <= steps; i++) {
      const u = i / steps,
        side = 2 * u - 1,
        angle = side * GUARD_HALF_ANGLE
      const tip = Math.pow(Math.abs(side), 6)
      const y = 0.55 + 0.46 * v + 0.062 * tip * (1 - 2 * v)
      const radius = guardRadius + lip - 0.022 * (1 - v)
      positions.push(radius * Math.sin(angle), y, radius * Math.cos(angle))
      uvs.push(u, v)
      if (i && j) {
        const n = j * (steps + 1) + i
        indices.push(n - steps - 2, n - steps - 1, n, n - steps - 2, n, n - 1)
      }
    }
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const material = new T.ShaderMaterial({
    side: T.DoubleSide,
    transparent: true,
    depthWrite: false,
    forceSinglePass: true,
    vertexShader: `
      attribute float recoil;
      varying float response;
      varying vec2 panelUv;
      varying vec3 normalView;
      varying vec3 sight;
      void main() {
        vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.0);
        normalView=normalMatrix*mat3(instanceMatrix)*normal;
        response=recoil;
        panelUv=uv;
        sight=-mv.xyz;
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `
      varying float response;
      varying vec2 panelUv;
      varying vec3 normalView;
      varying vec3 sight;
      void main() {
        vec3 n=normalize(normalView);
        float facing=abs(dot(n,normalize(sight)));
        float edge=pow(1.0-facing,2.2);
        float distanceToEdge=min(min(panelUv.x,1.0-panelUv.x)*2.0,min(panelUv.y,1.0-panelUv.y));
        float rim=1.0-smoothstep(0.037,0.065,distanceToEdge);
        float shine=pow(max(0.0,dot(n,normalize(vec3(-0.45,0.65,0.85)))),6.0);
        vec3 glass=mix(vec3(0.34,0.57,0.50),vec3(0.82,0.91,0.77),shine);
        vec3 metal=mix(vec3(0.31,0.25,0.14),vec3(0.99,0.84,0.51),0.23+shine*0.77);
        gl_FragColor=vec4(mix(glass,metal,rim)+response*vec3(.18,.19,.13),mix(0.10+0.24*edge+.19*response,0.94,rim));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  })
  const mesh = new T.InstancedMesh(geometry, material, 2),
    pose = new T.Object3D()
  const recoil = new T.InstancedBufferAttribute(new Float32Array(2), 1).setUsage(T.DynamicDrawUsage)
  geometry.setAttribute('recoil', recoil)
  mesh.name = 'Clear directional guard bumpers'
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage)
  mesh.frustumCulled = false
  mesh.renderOrder = 2
  mesh.count = 0
  mesh.visible = false
  function update(match, alpha) {
    let count = 0
    if (match.winner === null)
      for (const p of match.robots) {
        const guard = T.MathUtils.lerp(p.previousPose.guard, p.guard, alpha)
        if (guard <= 0.01) continue
        const rise = 0.24 + 0.76 * guard
        pose.position.set(
          T.MathUtils.lerp(p.prevX, p.x, alpha),
          0.56 * (1 - rise),
          T.MathUtils.lerp(p.prevZ, p.z, alpha)
        )
        pose.scale.set(1, rise, 1)
        const delta = p.heading - p.prevHeading
        pose.rotation.y = p.prevHeading + alpha * Math.atan2(Math.sin(delta), Math.cos(delta))
        const kick = T.MathUtils.lerp(p.previousPose.counter, p.counter, alpha)
        const stroke = 0.16 * Math.sin(Math.PI * kick)
        pose.position.x += Math.sin(pose.rotation.y) * stroke
        pose.position.z += Math.cos(pose.rotation.y) * stroke
        recoil.setX(count, kick)
        pose.updateMatrix()
        mesh.setMatrixAt(count++, pose.matrix)
      }
    mesh.count = count
    mesh.visible = count > 0
    if (count) {
      mesh.instanceMatrix.needsUpdate = true
      recoil.needsUpdate = true
    }
  }
  return { mesh, update }
}
