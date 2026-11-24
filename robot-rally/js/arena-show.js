import * as T from '../vendor/three.module.js'

const sectors = 8
export const fountainBays = [0, 2, 4, 6]
export const fountainRadius = 4.99
export const projector = { x: 2.09, y: 2.64, z: 7.02 }
const projectorTarget = { x: 0.4, y: 0.08, z: 2.64 }

function world(bay, x, y, radius) {
  const a = ((bay + 0.12) * Math.PI * 2) / sectors
  return [Math.sin(a) * radius + Math.cos(a) * x, y, Math.cos(a) * radius - Math.sin(a) * x]
}

// Camera-facing shafts fade toward the floor and away from any lens on their
// own side of the ring. No extra dynamic lights or fullscreen bloom pass.
function lightShafts() {
  const starts = [], ends = [], corners = [], colors = [], indices = []
  for (let bay = 0; bay < sectors; bay++) {
    const start = world(bay, projector.x, projector.y, projector.z)
    const end = world(bay, projectorTarget.x, projectorTarget.y, projectorTarget.z)
    const color = new T.Color(bay % 2 ? '#e1edec' : '#ffe1ac')
    const first = starts.length / 3
    for (const [across, along] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) {
      starts.push(...start)
      ends.push(...end)
      corners.push(across, along)
      colors.push(color.r, color.g, color.b)
    }
    indices.push(first, first + 1, first + 2, first + 1, first + 3, first + 2)
  }
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(starts, 3))
  g.setAttribute('destination', new T.Float32BufferAttribute(ends, 3))
  g.setAttribute('corner', new T.Float32BufferAttribute(corners, 2))
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  g.setIndex(indices)
  const material = new T.ShaderMaterial({
    vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide,
    forceSinglePass: true, blending: T.AdditiveBlending, toneMapped: false,
    vertexShader: `
      attribute vec3 destination;
      attribute vec2 corner;
      varying vec2 coord;
      varying vec3 tint;
      varying float strength;
      void main(){
        coord=corner; tint=color;
        vec3 center=mix(position,destination,corner.y);
        vec3 direction=normalize(destination-position);
        vec3 side=cross(direction,normalize(cameraPosition-center));
        side*=inversesqrt(max(dot(side,side),0.001));
        center+=side*corner.x*mix(0.082,0.57,corner.y);
        float alignment=dot(normalize(position.xz),cameraPosition.xz/max(0.1,length(cameraPosition.xz)));
        strength=1.0-smoothstep(0.05,0.70,alignment);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(center,1.0);
      }`,
    fragmentShader: `
      varying vec2 coord;
      varying vec3 tint;
      varying float strength;
      void main(){
        float edge=pow(max(0.0,1.0-coord.x*coord.x),2.7);
        float fade=pow(1.0-coord.y,1.3);
        gl_FragColor=vec4(tint,0.34*edge*fade*strength);
        #include <colorspace_fragment>
      }`
  })
  const mesh = new T.Mesh(g, material)
  mesh.name = 'Courtside spotlight haze'
  mesh.frustumCulled = false
  mesh.renderOrder = 1
  return mesh
}

// Store the entire short cue once. The clock samples the same trajectories
// during live play, a freeze-frame, slow motion or a backwards replay seek.
function sparkField() {
  let seed = 0x6242
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const particles = [[], []]
  const palette = ['#fff0aa', '#ffb62e', '#ff8f31', '#59f8d4', '#ff7859']
  function particle(tier, origin, velocity, color, clock, life, type, width) {
    particles[tier].push({ origin, velocity, color, cue: [clock, life, type, width] })
  }
  for (const [station, bay] of fountainBays.entries()) {
    const source = world(bay, 0, -0.015, fountainRadius)
    const az = ((bay + 0.12) * Math.PI * 2) / sectors
    for (let j = 0; j < 64; j++) {
      const angle = random() * Math.PI * 2, spread = random() * 1.38
      const velocity = [Math.sin(angle) * spread + Math.sin(az) * 0.20, 3.2 + random() * 2.35,
        Math.cos(angle) * spread + Math.cos(az) * 0.20]
      const clock = 0.035 + (j / 64) * 1.22 + station % 2 * 0.13
      particle(j % 2, source, velocity, palette[j % 3], clock, 0.5 + random() * 0.40, 0, 0.12 + random() * 0.10)
    }
    // Two comets fan out from each actual rail housing. Their crowns open
    // over the far seats in succession, with the ring itself left clear.
    for (const side of [-1, 1]) {
      const rise = 0.54
      const launch = 0.025 + (side + 1) * 0.21 + (station % 2) * 0.10
      const center = world(bay, side * 1.30, 1.91 + (side + 1) * 0.15, fountainRadius + 0.12)
      const lift = center.map((coordinate, i) => (coordinate - source[i]) / rise)
      lift[1] += 1.48 * rise
      for (let tail = 0; tail < 8; tail++)
        particle(tail % 2, source, lift, palette[tail % 3], launch + tail * 0.011,
          rise - tail * 0.011, 2, 0.30 - tail * 0.022)
      for (let j = 0; j < 42; j++) {
        const y = 1 - 2 * ((j + 0.5) / 42), angle = j * 2.399963 + station + side
        const h = Math.sqrt(1 - y * y), speed = 1.03 + random() * 0.68
        const velocity = [Math.sin(angle) * h * speed, y * speed + 0.70, Math.cos(angle) * h * speed]
        particle(j % 2, center, velocity, palette[j % 6 < 4 ? 1 : (side + 1) / 2 + 3],
          launch + rise + random() * 0.025, 0.93 + random() * 0.32, 1, 0.22 + random() * 0.13)
      }
    }
  }
  const p = [], v = [], c = [], cue = []
  for (const tier of particles) for (const row of tier) {
    p.push(...row.origin)
    v.push(...row.velocity)
    const tint = new T.Color(row.color)
    c.push(tint.r, tint.g, tint.b)
    cue.push(...row.cue)
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(p, 3))
  geometry.setAttribute('velocity', new T.Float32BufferAttribute(v, 3))
  geometry.setAttribute('color', new T.Float32BufferAttribute(c, 3))
  geometry.setAttribute('cue', new T.Float32BufferAttribute(cue, 4))
  const uniforms = { clock: { value: 0 }, victory: { value: 0 }, pixels: { value: 500 } }
  const material = new T.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, vertexColors: true,
    blending: T.AdditiveBlending, toneMapped: false,
    vertexShader: `
      attribute vec3 velocity;
      attribute vec4 cue;
      uniform float clock, victory, pixels;
      varying vec3 tint;
      varying float intensity;
      varying vec2 direction;
      void main(){
        float age=clock-cue.x;
        direction=vec2(0.,-1.);
        if(age<0.0 || age>cue.y || (cue.z>0.5 && victory<0.5)){
          gl_Position=vec4(2.,2.,2.,1.); gl_PointSize=1.; intensity=0.; tint=vec3(0.); return;
        }
        float progress=age/cue.y;
        float crown=step(0.5,cue.z)*(1.0-step(1.5,cue.z));
        vec3 pos=position+velocity*age*(1.0-crown*progress*0.24);
        pos.y-=(cue.z>0.5?1.48:3.45)*age*age;
        vec4 eye=modelViewMatrix*vec4(pos,1.);
        gl_Position=projectionMatrix*eye;
        float gravity=cue.z>0.5?1.48:3.45;
        vec3 motion=velocity*(1.-.48*crown*progress)-vec3(0.,2.*gravity*age,0.);
        vec3 eyeMotion=mat3(modelViewMatrix)*motion;
        vec2 screenMotion=eyeMotion.xy-eye.xy*eyeMotion.z/eye.z;
        direction=screenMotion*vec2(1.,-1.)/max(.001,length(screenMotion));
        gl_PointSize=clamp(cue.w*pixels/max(0.1,-eye.z),3.,36.);
        intensity=(1.0-smoothstep(0.43,1.,progress))*smoothstep(0.,0.065,progress);
        if(cue.z>0.5){
          float alignment=dot(normalize(position.xz),cameraPosition.xz/max(0.1,length(cameraPosition.xz)));
          intensity*=1.-smoothstep(.10,.72,alignment);
          if(cue.z>1.5)intensity*=1.0+progress*2.0;
        }
        tint=color;
      }`,
    fragmentShader: `
      varying vec3 tint;
      varying float intensity;
      varying vec2 direction;
      void main(){
        vec2 p=gl_PointCoord*2.-1.;
        float along=dot(p,direction);
        float across=dot(p,vec2(-direction.y,direction.x));
        vec2 tip=vec2(along-.28,across);
        float core=exp(-15.*dot(tip,tip));
        float trail=exp(-20.*across*across-2.7*along*along)
          *smoothstep(-.98,-.45,along)*(1.-smoothstep(.22,.63,along));
        float halo=exp(-4.4*dot(p,p));
        float alpha=intensity*min(1.,core+.84*trail+.21*halo);
        if(alpha<.009)discard;
        gl_FragColor=vec4(mix(tint,vec3(1.,.99,.84),core*.72),alpha);
        #include <colorspace_fragment>
      }`
  })
  const points = new T.Points(geometry, material)
  const viewport = new T.Vector2()
  points.onBeforeRender = (renderer, scene, camera) => {
    uniforms.pixels.value = renderer.getDrawingBufferSize(viewport).y * camera.projectionMatrix.elements[5] * 0.5
  }
  points.name = 'Rail fountains and victory fireworks'
  points.frustumCulled = false
  points.renderOrder = 2
  points.visible = false
  return { points, uniforms, full: p.length / 3, lean: particles[0].length }
}

export function createArenaShow() {
  const group = new T.Group()
  const shafts = lightShafts()
  const { points, uniforms, full, lean } = sparkField()
  group.add(shafts, points)
  let lastImpact = -Infinity
  return {
    group,
    impact(time) {
      if(time-lastImpact>4.7 || time<lastImpact) lastImpact=time
    },
    clear() {lastImpact=-Infinity},
    update(matchSeconds, victorySeconds = -1, reducedMotion = false, lowDetail = false) {
      shafts.visible = !lowDetail
      const win = victorySeconds >= 0
      // Three separated volleys carry the winner through the crowd chant.
      // During play a clean flank or a big counter cues the rail fountains.
      const clock = win ? victorySeconds % 1.85 : matchSeconds < 2.4 ? matchSeconds : matchSeconds - lastImpact
      points.visible = !reducedMotion && clock >= 0 && clock < 2.4 && (!win || victorySeconds<5.48)
      if (!points.visible) return
      points.geometry.setDrawRange(0, lowDetail ? lean : full)
      uniforms.clock.value = clock
      uniforms.victory.value = win ? 1 : 0
    },
    dispose() {
      for (const mesh of group.children) {
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
      group.clear()
    }
  }
}
