import * as T from '../vendor/three.module.js'

// The part catalog specifies horizontal angle. Derive the vertical camera
// angle for the actual drawing area, including a narrow iPad split window.
export const verticalLensAngle = (field, aspect) =>
  T.MathUtils.radToDeg(2 * Math.atan(Math.tan(T.MathUtils.degToRad(field) / 2) / aspect))

// A sight diagram on the mat, seen only from outside during a lens trial.
// Its two edges are the left and right rays of the robot's actual gimbal.
export class LensField {
  constructor() {
    const material = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        eye: { value: new T.Vector2() },
        forward: { value: new T.Vector2() },
        opening: { value: new T.Vector2() }
      },
      vertexShader: `
        varying vec2 floorPoint;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          floorPoint = world.xz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: `
        uniform vec2 eye, forward, opening;
        varying vec2 floorPoint;
        void main() {
          vec2 delta = floorPoint - eye;
          float ahead = dot(delta, forward);
          float sideways = abs(dot(delta, vec2(forward.y, -forward.x)));
          float inside = ahead * opening.x - sideways * opening.y;
          float aa = max(0.008, fwidth(inside));
          float coverage = smoothstep(-aa, aa, inside);
          float distanceFromEye = length(delta);
          float court = 1.0 - smoothstep(3.91, 4.00, length(floorPoint));
          float near = smoothstep(0.12, 0.37, distanceFromEye);
          float edge = 1.0 - smoothstep(0.013, 0.025 + aa, abs(inside));
          float dash = smoothstep(0.06, 0.14, fract(distanceFromEye * 2.6));
          float opacity = (coverage * 0.105 + edge * (0.23 + 0.54 * dash)) * near * court;
          if (opacity < 0.004) discard;
          gl_FragColor = vec4(mix(vec3(0.045, 0.41, 0.33), vec3(0.11, 0.63, 0.47), edge), opacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      extensions: { derivatives: true }
    })
    this.mesh = new T.Mesh(new T.PlaneGeometry(8, 8).rotateX(-Math.PI / 2), material)
    this.mesh.name = 'Trial lens field on the mat'
    this.mesh.position.y = 0.018
    this.mesh.renderOrder = 1
    this.mesh.visible = false
    this.origin = new T.Vector3()
    this.target = new T.Vector3()
  }
  update(model, field, visible) {
    this.mesh.visible = visible
    if (!visible) return
    model.lensView(this.origin, this.target)
    const { eye, forward, opening } = this.mesh.material.uniforms
    eye.value.set(this.origin.x, this.origin.z)
    forward.value.set(this.target.x - this.origin.x, this.target.z - this.origin.z).normalize()
    const halfAngle = T.MathUtils.degToRad(field) / 2
    opening.value.set(Math.sin(halfAngle), Math.cos(halfAngle))
  }
}
