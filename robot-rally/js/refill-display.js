import * as T from '../vendor/three.module.js'

// A retractable pit display lives on the battery housing. Its six lamps
// read the same charge as the drive, including on a paused or resumed tick.
function faceTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#354941'
  g.beginPath()
  g.roundRect(2, 2, 252, 124, 12)
  g.fill()
  const glass = g.createLinearGradient(0, 0, 0, 128)
  glass.addColorStop(0, '#2e3e36')
  glass.addColorStop(0.6, '#11231e')
  glass.addColorStop(1, '#21352c')
  g.fillStyle = glass
  g.beginPath()
  g.roundRect(7, 7, 242, 114, 8)
  g.fill()
  g.fillStyle = '#ffdd82'
  g.font = '800 45px "Avenir Next",system-ui,sans-serif'
  g.textAlign = 'center'
  g.fillText('REFILL', 139, 56)
  g.beginPath()
  g.moveTo(46, 15)
  g.lineTo(24, 42)
  g.lineTo(36, 42)
  g.lineTo(31, 63)
  g.lineTo(53, 33)
  g.lineTo(42, 33)
  g.fill()
  g.strokeStyle = '#99a596'
  g.lineWidth = 3
  g.strokeRect(23, 70, 202, 35)
  g.fillStyle = '#a7b5a5'
  g.fillRect(225, 80, 7, 14)
  const map = new T.CanvasTexture(c)
  map.colorSpace = T.SRGBColorSpace
  return map
}
export class RefillDisplay {
  constructor(scene) {
    const geometry = new T.PlaneGeometry(0.66, 0.33)
    this.state = new T.InstancedBufferAttribute(new Float32Array(4), 2).setUsage(T.DynamicDrawUsage)
    geometry.setAttribute('meter', this.state)
    const material = new T.ShaderMaterial({
      uniforms: { face: { value: faceTexture() } },
      vertexShader: `
        attribute vec2 meter; varying vec2 displayUv; varying vec2 level;
        void main(){displayUv=uv; level=meter;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
      fragmentShader: `
        uniform sampler2D face; varying vec2 displayUv; varying vec2 level;
        void main(){
          vec4 ink=texture2D(face,displayUv);
          if(ink.a<.45)discard;
          vec2 battery=(displayUv-vec2(.114,.223))/vec2(.735,.19);
          if(battery.x>=0. && battery.x<1. && battery.y>=0. && battery.y<1. && fract(battery.x*6.)<.89){
            float cell=floor(battery.x*6.);
            float full=step((cell+.001)/6.,level.x);
            float next=(1.-full)*step(cell,ceil(level.x*6.));
            ink.rgb=mix(vec3(.055,.09,.07),vec3(.98,.68,.17),max(full,next*level.y*.64));
          }
          gl_FragColor=vec4(ink.rgb,1.);
          #include <colorspace_fragment>
        }`
    })
    this.panel = new T.InstancedMesh(geometry, material, 2)
    this.panel.frustumCulled = false
    this.panel.name = 'Battery-mounted refill displays'
    this.posts = new T.InstancedMesh(
      new T.CylinderGeometry(0.017, 0.023, 1, 8),
      new T.MeshStandardMaterial({ color: 0x839487, metalness: 0.7, roughness: 0.37 }),
      2
    )
    this.posts.name = 'Battery display hinges'
    this.posts.frustumCulled = false
    this.panel.instanceMatrix.setUsage(T.DynamicDrawUsage)
    this.posts.instanceMatrix.setUsage(T.DynamicDrawUsage)
    scene.add(this.panel, this.posts)
    this.pose = new T.Object3D()
    this.anchor = new T.Vector3()
    this.rear = new T.Vector3()
    this.facing = new T.Vector3()
    this.clean()
  }
  clean() {
    this.panel.visible = this.posts.visible = false
    this.panel.count = this.posts.count = 0
  }
  update(match, camera, models, inside, time, reduced) {
    let n = 0
    for (let i = 0; i < 2; i++) {
      const p = match.robots[i]
      if (!p.rest || match.winner !== null || i === inside) continue
      const model = models[i],
        pose = this.pose,
        anchor = this.anchor
      model.getPartPosition('gauge', anchor)
      model.getPartPosition('cell', this.rear)
      const eye = this.facing.copy(camera.position)
      model.group.worldToLocal(eye)
      const angle = Math.atan2(eye.x, eye.z),
        front = Math.cos(angle) >= 0
      const height = anchor.y
      // The folding charge display travels on the waist rail. Put its arm
      // on the spectator-facing edge so a rear battery cannot hide the lamps.
      const width = 0.66,
        length = front ? Math.max(0.56, anchor.z + 0.12) : Math.max(0.6, -this.rear.z + 0.09)
      anchor.set(Math.sin(angle) * width, height, Math.cos(angle) * length)
      model.group.localToWorld(anchor)
      pose.position.copy(anchor)
      pose.position.y += 0.15
      pose.quaternion.copy(camera.quaternion)
      pose.scale.setScalar(1)
      pose.updateMatrix()
      this.panel.setMatrixAt(n, pose.matrix)
      pose.position.copy(anchor)
      pose.position.y += 0.03
      pose.quaternion.identity()
      pose.scale.set(1, 0.07, 1)
      pose.updateMatrix()
      this.posts.setMatrixAt(n, pose.matrix)
      const pulse = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(time * 6)
      this.state.setXY(n++, p.energy / p.s.capacity, pulse)
    }
    this.panel.count = this.posts.count = n
    this.panel.visible = this.posts.visible = n > 0
    if (n) {
      this.panel.instanceMatrix.needsUpdate =
        this.posts.instanceMatrix.needsUpdate =
        this.state.needsUpdate =
          true
    }
  }
}
