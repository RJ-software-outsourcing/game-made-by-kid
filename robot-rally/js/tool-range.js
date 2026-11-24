import * as T from '../vendor/three.module.js'
import { startArc, startReach } from './match.js'

// A strip of paint on the test mat, clipped at the boards. The ends of a
// close-range arc mark the limits of the turn before the tool can wind up.
export class ToolRange {
  constructor() {
    const material = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { inside: { value: 0 } },
      vertexShader: `
        varying vec2 floorPoint;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          floorPoint = world.xz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: `
        varying vec2 floorPoint;
        uniform float inside;
        void main() {
          float court = 1.0 - smoothstep(3.88, 3.98, length(floorPoint));
          if (court < 0.01) discard;
          vec3 color = mix(vec3(0.92, 0.57, 0.15), vec3(1.0, 0.89, 0.47), inside);
          gl_FragColor = vec4(color, court * (0.74 + 0.2 * inside));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    })
    this.mesh = new T.Mesh(new T.BufferGeometry(), material)
    this.mesh.name = 'Tool range on test mat'
    this.mesh.renderOrder = 2
  }
  fit(fighter) {
    const radius = startReach(fighter), arc = startArc(fighter.build.weapon)
    if (radius === this.radius && arc === this.arc) return
    this.radius = radius
    this.arc = arc
    const count = Math.ceil(2 * arc * radius / 0.24)
    const vertices = [], indices = []
    for (let n = 0; n < count; n++) {
      for (const fraction of [0.10, 0.80]) {
        const angle = -arc + (n + fraction) * 2 * arc / count
        for (const r of [radius - .022, radius + .022])
          vertices.push(Math.sin(angle) * r, .019, Math.cos(angle) * r)
      }
      const i = n * 4
      indices.push(i, i + 1, i + 2, i + 2, i + 1, i + 3)
    }
    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
    geometry.setIndex(indices)
    this.mesh.geometry.dispose()
    this.mesh.geometry = geometry
  }
  update(position, heading, inReach) {
    this.mesh.position.set(position.x, 0, position.z)
    this.mesh.rotation.y = heading
    this.mesh.material.uniforms.inside.value = Number(inReach)
  }
}
