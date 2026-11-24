import * as T from '../vendor/three.module.js'
import { chassisWheels, tireWidths } from './wheel-motion.js'

// A tire leaves a short rubber streak only while a push slides its chassis.
// Each quad joins two actual wheel positions from adjacent simulation ticks.
const capacity = 128
export const markLifetime = 2.8

export class TireMarks {
  constructor() {
    const geometry = new T.InstancedBufferGeometry()
    geometry.setAttribute('position', new T.Float32BufferAttribute([0, 0, -1, 1, 0, -1, 1, 0, 1, 0, 0, 1], 3))
    geometry.setIndex([0, 1, 2, 0, 2, 3])
    this.stroke = new T.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(
      T.DynamicDrawUsage
    )
    this.rubber = new T.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(
      T.DynamicDrawUsage
    )
    geometry.setAttribute('stroke', this.stroke)
    geometry.setAttribute('rubber', this.rubber)
    const material = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      forceSinglePass: true,
      uniforms: { time: { value: 0 } },
      vertexShader: `
        attribute vec4 stroke, rubber;
        uniform float time;
        varying vec3 imprint;
        void main(){
          vec2 delta=stroke.zw-stroke.xy;
          vec2 normal=normalize(vec2(-delta.y,delta.x));
          vec2 floorPoint=mix(stroke.xy,stroke.zw,position.x)+normal*rubber.x*position.z;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(floorPoint.x,0.006,floorPoint.y,1.0);
          float fade=1.0-smoothstep(0.6,${markLifetime.toFixed(1)},time-rubber.y);
          imprint=vec3(position.z,rubber.w+length(delta)*position.x,fade*rubber.z*smoothstep(-0.033,0.0,time-rubber.y));
        }`,
      fragmentShader: `
        varying vec3 imprint;
        void main(){
          float crosswise=abs(imprint.x);
          float edge=1.0-smoothstep(0.56,1.0,crosswise);
          float groove=0.7+0.3*smoothstep(0.06,0.24,abs(crosswise-0.38));
          float grain=0.91+0.09*sin(imprint.y*190.0+imprint.x*2.7);
          gl_FragColor=vec4(0.075,0.062,0.049,edge*groove*grain*imprint.z);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    })
    this.mesh = new T.Mesh(geometry, material)
    this.mesh.name = 'Rubber tire scuffs'
    this.mesh.renderOrder = 0
    this.mesh.frustumCulled = false
    this.clear()
  }
  clear() {
    this.next = 0
    this.mesh.geometry.instanceCount = 0
    this.mesh.visible = false
    this.last = -Infinity
  }
  record(match) {
    let changed = false
    for (const p of match.robots) {
      const skid = p.maneuver==='dodge' ? 1.25 : p.maneuver==='dash' ? .8 : 0
      const slide = Math.max(skid, Math.hypot(p.pushX, p.pushZ))
      if (slide < 0.48 || (!skid && p.hit < 0.25)) continue
      const before = p.prevBodyHeading,
        now = p.bodyHeading
      const sx = Math.sin(before),
        cx = Math.cos(before),
        sn = Math.sin(now),
        cn = Math.cos(now)
      const form = chassisWheels[p.build.chassis ?? 0]
      for (const offset of form.rear ? [form.axle[1], form.rear] : [form.axle[1]])
        for (const side of [-1, 1]) {
          const axle = side * form.axle[0]
          const ax = p.prevX + axle * cx + offset * sx,
            az = p.prevZ - axle * sx + offset * cx
          const bx = p.x + axle * cn + offset * sn,
            bz = p.z - axle * sn + offset * cn
          if (Math.hypot(bx - ax, bz - az) < 0.019) continue
          const index = this.next
          this.stroke.setXYZW(index, ax, az, bx, bz)
          this.rubber.setXYZW(
            index,
            (tireWidths[p.build.motor] ?? .105) * form.wheelScale * 0.39,
            match.time,
            Math.min(0.23, slide * 0.12),
            side < 0 ? p.leftTravel : p.rightTravel
          )
          this.next = (index + 1) % capacity
          this.mesh.geometry.instanceCount = Math.min(capacity, this.mesh.geometry.instanceCount + 1)
          changed = true
        }
    }
    if (changed) {
      this.last = match.time
      this.stroke.needsUpdate = this.rubber.needsUpdate = true
    }
  }
  show(time, enabled) {
    this.mesh.material.uniforms.time.value = time
    this.mesh.visible = enabled && time < this.last + markLifetime
  }
}
