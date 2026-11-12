// The island: sky, sea, terrain, roads, buildings, plants, characters and tap targets.
// The core is built up front; each zone's details are built when Coji gets near (or when idle).
import * as THREE from 'three'
import * as L from './land.js'
import { NavGrid } from './nav.js'
import { Parts, MAT, SMOOTH, GLOW, box, cyl, ico, makeSprite } from './build.js'
import * as P from './props.js'
import { instanced, cloud, blob, FLOWER_COLORS } from './nature.js'
import { Person, LOOKS, Bear, Owl, Cat, Bunny, Ghost, makeDuck, makeGull, makeButterfly } from './characters.js'

const RES = 1.45 // terrain grid spacing (2 × HALF / RES must be a whole number)

// Give the browser a moment to paint the loading bar. Falls back to a timer when the tab is hidden
// (animation frames pause there), so loading keeps going in the background.
const nextFrame = () =>
  new Promise((r) => {
    let done = false
    const go = () => {
      if (!done) {
        done = true
        r()
      }
    }
    requestAnimationFrame(go)
    setTimeout(go, 60)
  })

const C = (h) => new THREE.Color(h)
const DAY = { top: C('#2b8ef0'), horizon: C('#a9dcff'), sun: C('#fff3de'), sunI: 2.5, hemiSky: C('#cfe9ff'), hemiGround: C('#d8c7a0'), hemiI: 1.2, fog: C('#b4defd'), near: 160, far: 520 }
const NIGHT = { top: C('#0b1236'), horizon: C('#33407a'), sun: C('#9fb6ff'), sunI: 0.55, hemiSky: C('#6f80c8'), hemiGround: C('#2a3350'), hemiI: 0.55, fog: C('#2a3566'), near: 120, far: 420 }
const SPOOK = { top: C('#443470'), horizon: C('#9284b0'), sun: C('#cfc0f0'), sunI: 1.25, hemiSky: C('#a99bd0'), hemiGround: C('#544a62'), hemiI: 1.0, fog: C('#6a5f88'), near: 24, far: 130 }

export class World {
  constructor(scene, renderer) {
    this.scene = scene
    this.renderer = renderer
    this.t = 0
    this.entities = []
    this.byId = {}
    this.npcs = {}
    this.proxies = []
    this.groundMeshes = []
    this.zones = L.ZONES.map((z) => ({ ...z, built: false, items: {} }))
    this.night = 0
    this.spook = 0
    this.lit = false
    this.pops = []
    this.flies = []
    this.lamps = []
  }

  // ---------- heights ----------

  makeHeights() {
    const n = Math.round((L.HALF * 2) / RES) + 1
    this.gn = n
    const H = new Float32Array(n * n)
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) H[j * n + i] = L.heightAt(-L.HALF + i * RES, -L.HALF + j * RES)
    this.H = H
  }

  // Terrain height exactly as the mesh draws it.
  terrainY(x, z) {
    const n = this.gn
    const fx = (x + L.HALF) / RES
    const fz = (z + L.HALF) / RES
    const i = Math.floor(fx)
    const j = Math.floor(fz)
    if (i < 0 || j < 0 || i >= n - 1 || j >= n - 1) return -7
    const u = fx - i
    const v = fz - j
    const H = this.H
    const h00 = H[j * n + i]
    const h10 = H[j * n + i + 1]
    const h01 = H[(j + 1) * n + i]
    const h11 = H[(j + 1) * n + i + 1]
    if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v)
  }

  // Where feet stand: decks first, then the terrain.
  groundY(x, z) {
    if (L.onPier(x, z)) return L.PIER.y
    if (L.onDrawbridge(x, z)) return this.drawbridgeY()
    const t = L.bridgeT(x, z)
    if (t !== null) return L.bridgeDeckY(t, (a, b) => this.terrainY(a, b))
    return Math.max(this.terrainY(x, z), -0.3)
  }
  drawbridgeY() {
    return L.PADS[0].h + 0.12
  }

  // ---------- core build ----------

  async buildCore(progress = () => {}) {
    this.makeHeights()
    progress(0.1)
    this.makeSky()
    this.makeTerrain()
    progress(0.3)
    await nextFrame()
    this.makeSea()
    this.makeFreshWater()
    this.makeRoads()
    progress(0.45)
    await nextFrame()
    this.makeBuildings()
    this.makeDecks()
    progress(0.6)
    await nextFrame()
    this.makeObjects()
    this.makeLamps()
    this.planDecor()
    progress(0.75)
    await nextFrame()
    this.makeNav()
    progress(0.9)
    this.makeAmbient()
    progress(1)
  }

  makeSky() {
    const scene = this.scene
    scene.fog = new THREE.Fog(DAY.fog.clone(), DAY.near, DAY.far)
    scene.background = DAY.horizon.clone()
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: DAY.top.clone() },
        horizon: { value: DAY.horizon.clone() },
        sunDir: { value: new THREE.Vector3(0.45, 0.62, 0.35).normalize() },
        night: { value: 0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform float night; varying vec3 vDir;
        void main(){ float h = clamp(vDir.y, 0., 1.); vec3 c = mix(horizon, top, pow(h, 0.45));
          float s = max(dot(normalize(vDir), sunDir), 0.); c += vec3(1.,.95,.8) * pow(s, 48.) * (1.-night) * 0.5;
          c += vec3(1.) * pow(s, 700.) * (1.-night);
          gl_FragColor = vec4(c, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.skyMat)
    sky.renderOrder = -1
    scene.add(sky)

    const hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemiI)
    scene.add(hemi)
    this.hemi = hemi
    const sun = new THREE.DirectionalLight(DAY.sun, DAY.sunI)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const c = sun.shadow.camera
    c.left = -38
    c.right = 38
    c.top = 38
    c.bottom = -38
    c.near = 1
    c.far = 160
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 0.04
    scene.add(sun)
    scene.add(sun.target)
    this.sun = sun
    this.sunOffset = new THREE.Vector3(45, 70, 35)

    // big puffy clouds
    this.clouds = []
    const rand = L.mulberry32(11)
    for (let i = 0; i < 22; i++) {
      const c2 = cloud(rand)
      const a = rand() * Math.PI * 2
      const r = 70 + rand() * 230
      c2.position.set(Math.cos(a) * r, 34 + rand() * 26, Math.sin(a) * r)
      c2.scale.setScalar(0.9 + rand() * 0.8)
      c2.userData.speed = 0.6 + rand() * 0.8
      scene.add(c2)
      this.clouds.push(c2)
    }
    // stars (night only)
    const sp = []
    for (let i = 0; i < 500; i++) {
      const th = rand() * Math.PI * 2
      const ph = Math.acos(rand() * 0.9 + 0.08)
      sp.push(Math.sin(ph) * Math.cos(th) * 800, Math.cos(ph) * 800, Math.sin(ph) * Math.sin(th) * 800)
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3))
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }))
    scene.add(this.stars)
  }

  // Smooth terrain: one vertex per grid point, colors blended per vertex.
  makeTerrain() {
    const n = this.gn
    const H = this.H
    const pos = new Float32Array(n * n * 3)
    const col = new Float32Array(n * n * 3)
    const c = new THREE.Color()
    const tmp = new THREE.Color()
    const sand = C('#f2e0a8')
    const wetSand = C('#d8c48c')
    const grassA = C('#93d36c')
    const grassB = C('#7cc45c')
    const forestA = C('#5aa851')
    const forestB = C('#6dba5c')
    const rock = C('#a7a199')
    const rockTop = C('#f1eee9')
    const soil = C('#b59e74')
    const spookA = C('#5d6b4f')
    const spookB = C('#6b5d6e')
    const M = L.MOUNTAIN
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i
        const x = -L.HALF + i * RES
        const z = -L.HALF + j * RES
        const h = H[k]
        pos[k * 3] = x
        pos[k * 3 + 1] = h
        pos[k * 3 + 2] = z
        const hx = H[j * n + Math.min(n - 1, i + 1)] - H[j * n + Math.max(0, i - 1)]
        const hz = H[Math.min(n - 1, j + 1) * n + i] - H[Math.max(0, j - 1) * n + i]
        const slope = Math.hypot(hx, hz) / (2 * RES)
        const noise = L.vnoise(x * 0.09, z * 0.09)
        const big = L.vnoise(x * 0.025 + 7, z * 0.025 - 3)
        const md = Math.hypot(x - M.x, z - M.z)
        const isle = Math.hypot(x - L.ISLET.x, z - L.ISLET.z) < L.ISLET.r + 4
        if (h < -0.1) c.copy(wetSand).multiplyScalar(0.94 + 0.06 * noise)
        else {
          c.copy(grassA).lerp(grassB, noise * 0.7 + big * 0.3)
          const f = L.forestness(x, z)
          if (f > 0) c.lerp(tmp.copy(forestA).lerp(forestB, noise), f)
          const sp = L.spookiness(x, z)
          if (sp > 0) c.lerp(tmp.copy(spookA).lerp(spookB, noise), sp)
          const beach = (L.inland(x, z) < 20 || isle) && h < 1.15 ? L.smoothstep(1.05, 0.8, h) : 0
          const beachPad = L.smoothstep(13, 8, Math.hypot(x - L.PLACES.beach.x, z - L.PLACES.beach.z))
          c.lerp(sand, Math.max(beach, beachPad))
          if (md < M.r + 1 && h > 1.6) {
            const r = L.smoothstep(1.6, 4, h) * L.smoothstep(M.r + 1, M.r - 3, md)
            c.lerp(tmp.copy(rock).lerp(rockTop, L.smoothstep(13, 18, h)), r)
          }
          if (slope > 0.45 && h > 1.2) c.lerp(rock, Math.min(0.6, (slope - 0.45) * 1.5))
          const bank = Math.max(L.smoothstep(L.STREAM_HALF + 1.8, L.STREAM_HALF, L.polyDist(x, z, L.STREAM).d), L.smoothstep(L.POND.r + 2.2, L.POND.r, Math.hypot(x - L.POND.x, z - L.POND.z)))
          const cd = Math.hypot(x - L.CASTLE.x, z - L.CASTLE.z)
          const moat = L.smoothstep(2.6, 1.2, Math.abs(cd - (L.CASTLE.moatIn + L.CASTLE.moatOut) / 2))
          c.lerp(soil, Math.max(bank, moat) * 0.85)
        }
        const jit = 0.96 + L.vnoise(x * 0.9, z * 0.9) * 0.08
        col[k * 3] = c.r * jit
        col[k * 3 + 1] = c.g * jit
        col[k * 3 + 2] = c.b * jit
      }
    const idx = []
    for (let j = 0; j < n - 1; j++)
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i
        const b = a + 1
        const d = a + n
        const e = d + 1
        if (H[a] < -6.5 && H[b] < -6.5 && H[d] < -6.5 && H[e] < -6.5) continue
        idx.push(a, d, b, d, e, b)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    g.computeBoundingSphere()
    const mesh = new THREE.Mesh(g, SMOOTH)
    mesh.receiveShadow = true
    this.scene.add(mesh)
    this.terrain = mesh
    this.groundMeshes.push(mesh)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x9c8f6a }))
    floor.position.y = -7.2
    this.scene.add(floor)
  }

  makeSea() {
    const N = 256
    const data = new Uint8Array(N * N * 4)
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const x = -L.HALF + ((i + 0.5) / N) * L.HALF * 2
        const z = -L.HALF + ((j + 0.5) / N) * L.HALF * 2
        const v = Math.round(L.clamp((this.terrainY(x, z) + 7) / 9, 0, 1) * 255)
        const k = (j * N + i) * 4
        data[k] = data[k + 1] = data[k + 2] = v
        data[k + 3] = 255
      }
    const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat)
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.needsUpdate = true
    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uHeight: { value: null },
        uHalf: { value: L.HALF },
        uShallow: { value: C('#5fe3e0') },
        uDeep: { value: C('#1f86d6') },
        uFoam: { value: C('#ffffff') },
        uSky: { value: DAY.horizon.clone() },
        uSun: { value: new THREE.Vector3(0.45, 0.62, 0.35).normalize() },
        uNight: { value: 0 },
      },
    ])
    uniforms.uHeight.value = tex
    this.seaMat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      fog: true,
      depthWrite: false,
      vertexShader: `uniform float uTime; varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vec4 wp = modelMatrix * vec4(position,1.);
          wp.y += sin(wp.x*0.16 + uTime*1.1)*0.07 + cos(wp.z*0.13 + uTime*0.9)*0.07;
          vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform sampler2D uHeight; uniform float uHalf; uniform float uTime; uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoam; uniform vec3 uSky; uniform vec3 uSun; uniform float uNight; varying vec3 vW;
        #include <fog_pars_fragment>
        void main(){
          vec2 uv = (vW.xz + uHalf) / (2.*uHalf);
          float h = -7.;
          if (uv.x > 0. && uv.x < 1. && uv.y > 0. && uv.y < 1.) h = texture2D(uHeight, uv).r * 9. - 7.;
          float depth = max(0., vW.y - h);
          vec3 col = mix(uShallow, uDeep, smoothstep(0.3, 6., depth));
          // little waves tilt the surface: sky reflection and sun glints
          vec3 n = normalize(vec3(sin(vW.x*0.9 + uTime*1.6)*0.08 + sin(vW.z*1.7 - uTime*1.2)*0.05, 1., cos(vW.z*0.8 + uTime*1.3)*0.08 + cos(vW.x*1.5 + uTime)*0.05));
          vec3 v = normalize(cameraPosition - vW);
          float fres = pow(1. - max(dot(v, n), 0.), 3.);
          col = mix(col, uSky, fres * 0.55);
          float glint = pow(max(dot(reflect(-uSun, n), v), 0.), 120.);
          col += vec3(1.) * glint * 0.8 * (1. - uNight);
          float band = sin(depth*7. - uTime*1.7 + sin(vW.x*0.25 + vW.z*0.2)*1.2)*0.5 + 0.5;
          float foam = smoothstep(0.45, 0.05, depth) + smoothstep(0.8, 1., band) * smoothstep(1.6, 0.3, depth) * 0.75;
          col = mix(col, uFoam, clamp(foam, 0., 1.) * 0.85);
          col *= mix(1., 0.4, uNight);
          float alpha = mix(0.5, 0.95, smoothstep(0., 2.6, depth));
          alpha = max(alpha, clamp(foam, 0., 1.) * 0.95);
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    })
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800, 90, 90).rotateX(-Math.PI / 2), this.seaMat)
    sea.renderOrder = 2
    this.scene.add(sea)
  }

  makeFreshWater() {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uNight: { value: 0 } }])
    this.freshMat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      fog: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vec4 wp = modelMatrix * vec4(position,1.); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uTime; uniform float uNight; varying vec3 vW;
        #include <fog_pars_fragment>
        void main(){ vec3 col = vec3(0.3, 0.74, 0.9);
          float r = sin(vW.x*1.4 + vW.z*0.6 + uTime*2.2) * sin(vW.z*1.2 - vW.x*0.5 - uTime*1.6);
          col = mix(col, vec3(1.), smoothstep(0.8, 1., r) * 0.6);
          col *= mix(1., 0.4, uNight);
          gl_FragColor = vec4(col, 0.86);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    })
    const pts = resample(L.STREAM, 0.8)
    const pos = []
    const half = L.STREAM_HALF + 0.9
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az, anx, anz] = pts[i]
      const [bx, bz, bnx, bnz] = pts[i + 1]
      const ya = L.streamLevelAt(ax, az)
      const yb = L.streamLevelAt(bx, bz)
      const A1 = [ax + anx * half, ya, az + anz * half]
      const A2 = [ax - anx * half, ya, az - anz * half]
      const B1 = [bx + bnx * half, yb, bz + bnz * half]
      const B2 = [bx - bnx * half, yb, bz - bnz * half]
      pos.push(...A1, ...A2, ...B1, ...A2, ...B2, ...B1)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    const stream = new THREE.Mesh(g, this.freshMat)
    stream.renderOrder = 3
    this.scene.add(stream)
    const pond = new THREE.Mesh(new THREE.CircleGeometry(L.POND.r + 1.6, 32).rotateX(-Math.PI / 2), this.freshMat)
    pond.position.set(L.POND.x, L.getPondLevel(), L.POND.z)
    pond.renderOrder = 3
    this.scene.add(pond)
    const moat = new THREE.Mesh(new THREE.RingGeometry(L.CASTLE.moatIn - 0.9, L.CASTLE.moatOut + 0.9, 64, 1).rotateX(-Math.PI / 2), this.freshMat)
    moat.position.set(L.CASTLE.x, L.getMoatLevel(), L.CASTLE.z)
    moat.renderOrder = 3
    this.scene.add(moat)
  }

  makeRoads() {
    const roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    const p = new Parts()
    for (const r of L.ROADS) {
      this.ribbon(p, r.pts, r.w + 0.7, 0.07, '#d6b981', roadMat)
      this.ribbon(p, r.pts, r.w, 0.1, '#eed9a8', roadMat)
    }
    const roads = p.build({ shadow: false, receive: true })
    this.scene.add(roads)
    const pl = new Parts()
    const y = this.terrainY(L.PLAZA.x, L.PLAZA.z) + 0.13
    const at = { x: L.PLAZA.x, z: L.PLAZA.z, rx: -Math.PI / 2, mat: roadMat }
    pl.add(new THREE.CircleGeometry(L.PLAZA.r + 0.6, 48), '#d9c9a6', { ...at, y: y - 0.01, jitter: 0.02 })
    pl.add(new THREE.RingGeometry(3.2, L.PLAZA.r, 48, 3), '#ece0c6', { ...at, y, jitter: 0.04 })
    pl.add(new THREE.RingGeometry(1.8, 3.2, 32, 1), '#cdb990', { ...at, y, jitter: 0.04 })
    const plaza = pl.build({ shadow: false, receive: true })
    this.scene.add(plaza)
    const q = new Parts()
    const hz = L.HARBOR.z
    for (let i = 0; i < 7; i++)
      for (let j = 0; j < 5; j++) q.add(box(2.0, 0.2, 2.0), (i + j) % 2 ? '#e8dcc4' : '#ddd0b5', { x: -6 + i * 2, y: L.PIER.y - 0.06, z: hz - 4 + j * 2, jitter: 0.03 })
    q.add(box(14.2, 0.3, 0.5), '#b98a5e', { y: L.PIER.y - 0.02, z: hz + 5.2 })
    for (const x of [-5.5, -3.2, 3.2, 5.5]) {
      q.add(cyl(0.2, 0.26, 0.55, 8), '#5d5d66', { x, y: L.PIER.y + 0.25, z: hz + 4.6 })
      q.add(cyl(0.3, 0.3, 0.1, 8), '#5d5d66', { x, y: L.PIER.y + 0.55, z: hz + 4.6 })
    }
    const quay = q.build({ receive: true })
    this.scene.add(quay)
    this.groundMeshes.push(roads, plaza, quay)
  }

  ribbon(p, pts, w, lift, hex, mat) {
    const s = resample(pts, 1.0)
    const half = w / 2
    for (let i = 0; i < s.length - 1; i++) {
      const [ax, az, anx, anz] = s[i]
      const [bx, bz, bnx, bnz] = s[i + 1]
      const row = (x, z, nx, nz) =>
        [-1, -0.5, 0, 0.5, 1].map((k) => {
          const px = x + nx * half * k
          const pz = z + nz * half * k
          return [px, this.groundY(px, pz) + lift, pz]
        })
      const A = row(ax, az, anx, anz)
      const B = row(bx, bz, bnx, bnz)
      const v = []
      for (let k = 0; k < 4; k++) v.push(...A[k], ...A[k + 1], ...B[k], ...A[k + 1], ...B[k + 1], ...B[k])
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
      g.computeVertexNormals()
      p.push(g, hex, 0.03, mat)
    }
  }

  makeBuildings() {
    const signs = {
      burger: ['BURGER HUT', 4.6, 0.8, '#e94b3c', '#ffffff', [0, 4.05, 3.89]],
      market: ['MARKET', 2.6, 0.6, '#a8693f', '#fff3d6', [0, 2.6, 2.75]],
      bank: ['BANK', 2.4, 0.55, '#e6e1d8', '#3b4a5e', [0, 4.2, 4.12]],
      toyshop: ['TOY SHOP', 3.2, 0.55, '#ff8fb1', '#ffffff', [-1.5, 2.88, 3.1]],
      post: ['POST OFFICE', 3.8, 0.6, '#e94b3c', '#ffffff', [0, 3.35, 3.12]],
      school: ['SCHOOL', 3.2, 0.7, '#3b7dd8', '#ffffff', [0, 4.25, 3.36]],
      icecream: ['ICE CREAM', 3.4, 0.6, '#ff8fb1', '#ffffff', [0, 3.3, 1.95]],
    }
    for (const b of L.BUILDINGS) {
      const make = {
        house: () => P.house(b.color, b.w, b.d),
        burger: P.burgerHut,
        market: P.marketStall,
        bank: P.bank,
        toyshop: P.toyShop,
        shed: P.shed,
        cottage: P.cottage,
        warehouse: P.warehouse,
        lighthouse: P.lighthouse,
        post: P.postOffice,
        school: P.school,
        icecream: P.iceCreamStand,
        castle: P.castle,
      }[b.kind]
      const m = make()
      if (b.kind === 'lighthouse') this.lighthouse = m
      if (b.kind === 'castle') this.castle = m
      const g = m.isGroup ? m : new THREE.Group().add(m)
      g.position.set(b.x, this.terrainY(b.x, b.z) - 0.05, b.z)
      g.rotation.y = b.rot
      const s = signs[b.kind]
      if (s) {
        const sign = P.shopSign(s[0], s[1], s[2], s[3], s[4])
        sign.position.set(...s[5])
        g.add(sign)
      }
      g.traverse((o) => {
        if (o.isMesh && !o.userData.noShadow) {
          o.castShadow = true
          o.receiveShadow = true
        }
      })
      this.scene.add(g)
    }
  }

  makeDecks() {
    const pier = P.pier(L.PIER.z1 - L.PIER.z0, L.PIER.x1 - L.PIER.x0)
    pier.position.set(0, L.PIER.y, L.PIER.z0)
    this.scene.add(pier)
    this.groundMeshes.push(pier)
    const boat = P.boat()
    boat.position.set(5.6, -0.25, L.PIER.z0 + 18)
    boat.rotation.y = 0.05
    boat.traverse((o) => {
      if (o.isMesh) o.castShadow = true
    })
    this.scene.add(boat)
    this.boat = boat
    // Bear Bridge: an arched wooden bridge across the strait to Lighthouse Island
    const B = L.BRIDGE
    const gy = (a, b) => this.terrainY(a, b)
    const len = Math.hypot(B.bx - B.ax, B.bz - B.az)
    const ux = (B.bx - B.ax) / len
    const uz = (B.bz - B.az) / len
    const heading = Math.atan2(ux, uz)
    const p = new Parts()
    const steps = 26
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps
      const y = L.bridgeDeckY(t, gy)
      const slope = Math.atan2(L.bridgeDeckY(Math.min(1, t + 0.02), gy) - L.bridgeDeckY(Math.max(0, t - 0.02), gy), 0.04 * len)
      const x = B.ax + ux * t * len
      const z = B.az + uz * t * len
      p.add(box(B.w + 0.4, 0.18, (len / steps) * 0.92), i % 2 ? '#b98a5e' : '#c99a6a', { x, y: y - 0.09, z, ry: heading, rx: -slope, order: 'YXZ', jitter: 0.04 })
      for (const s of [-1, 1]) {
        const px = x + uz * s * (B.w / 2 + 0.1)
        const pz = z - ux * s * (B.w / 2 + 0.1)
        if (i % 3 === 0) p.add(box(0.16, 1.0, 0.16), '#8b5a2b', { x: px, y: y + 0.4, z: pz, ry: heading, order: 'YXZ' })
        p.add(box(0.12, 0.12, (len / steps) * 1.04), '#a8693f', { x: px, y: y + 0.85, z: pz, ry: heading, rx: -slope, order: 'YXZ' })
      }
    }
    // posts in the water
    for (const t of [0.25, 0.5, 0.75])
      for (const s of [-1, 1]) {
        const x = B.ax + ux * t * len + uz * s * (B.w / 2)
        const z = B.az + uz * t * len - ux * s * (B.w / 2)
        p.add(cyl(0.22, 0.26, 4, 7), '#7d5634', { x, y: L.bridgeDeckY(t, gy) - 2.1, z })
      }
    const bridge = p.build({ receive: true })
    this.scene.add(bridge)
    this.groundMeshes.push(bridge)
    // the castle's drawbridge
    const D = L.DRAWBRIDGE
    const db = new Parts()
    const dy = this.drawbridgeY()
    for (let z = D.z0; z < D.z1; z += 0.5) db.add(box(D.x1 - D.x0, 0.16, 0.46), (z * 2) % 2 ? '#a8783f' : '#b98a5e', { y: dy - 0.08, z: L.CASTLE.z + z + 0.25, jitter: 0.04 })
    for (const s of [-1, 1]) db.add(box(0.14, 0.14, D.z1 - D.z0), '#6b4a2b', { x: s * (D.x1 - 0.1), y: dy + 0.02, z: L.CASTLE.z + (D.z0 + D.z1) / 2 })
    const drawbridge = db.build({ receive: true })
    this.scene.add(drawbridge)
    this.groundMeshes.push(drawbridge)
  }

  // ---------- tap targets ----------

  addEntity(e) {
    e.y = e.y ?? this.groundY(e.x, e.z)
    const r = e.tapR ?? 1.2
    const h = e.tapH ?? 2.4
    const proxy = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), new THREE.MeshBasicMaterial())
    proxy.position.set(e.x, e.y + h / 2 + (e.tapY ?? 0), e.z)
    proxy.visible = false
    proxy.userData.entity = e
    this.scene.add(proxy)
    proxy.updateMatrixWorld()
    e.proxy = proxy
    this.proxies.push(proxy)
    this.entities.push(e)
    this.byId[e.id] = e
    return e
  }

  makeObjects() {
    const targets = L.SIGN_TARGETS
    for (const o of L.OBJECTS) {
      const y = this.terrainY(o.x, o.z)
      let mesh = null
      const e = { id: o.id, kind: o.kind, x: o.x, z: o.z, y, zone: this.zoneOf(o.x, o.z) }
      switch (o.kind) {
        case 'well':
          Object.assign(e, { tapR: 1.8, reach: 2.3, solid: 1.5 })
          mesh = P.well()
          break
        case 'spring':
          Object.assign(e, { tapR: 1.8, reach: 2.2, solid: 1.3 })
          mesh = P.spring()
          break
        case 'fountain':
          Object.assign(e, { tapR: 1.7, reach: 2.2, solid: 1.4 })
          mesh = P.fountain()
          break
        case 'bench':
          mesh = P.bench()
          mesh.rotation.y = o.rot
          Object.assign(e, { tapR: 1.4, tapH: 1.4, reach: 1.2, rot: o.rot })
          break
        case 'sign': {
          const boards = o.boards.map((k) => {
            const [tx, tz] = targets[k]
            return { text: `${L.PLACES[k].icon} ${L.PLACES[k].name}`, angle: Math.atan2(-(tz - o.z), tx - o.x) }
          })
          mesh = P.signpost(boards)
          Object.assign(e, { tapR: 1.3, tapH: 3.4, reach: 2.2, boards: o.boards, solid: 0.5 })
          break
        }
        case 'appletree':
          Object.assign(e, { tapR: 2.2, tapH: 4.5, reach: 2.4, solid: 0.8, fruit: true })
          break
        case 'berrybush':
          Object.assign(e, { tapR: 1.5, tapH: 1.6, reach: 1.9, solid: 1.0, fruit: true })
          break
        case 'carrots':
          Object.assign(e, { tapR: 2.4, tapH: 1, reach: 2.6, solid: 2.0, fruit: true })
          break
      }
      if (mesh) {
        mesh.position.set(o.x, y, o.z)
        mesh.traverse((m) => {
          if (m.isMesh) {
            m.castShadow = true
            m.receiveShadow = true
          }
        })
        this.scene.add(mesh)
        e.mesh = mesh
      }
      this.addEntity(e)
    }
    // characters (models come with their zone)
    for (const [id, n] of Object.entries(L.NPCS)) {
      const e = { id, kind: 'npc', x: n.x, z: n.z, zone: n.zone, reach: 2.2, tapR: 1.3, tapH: 2.6 }
      if (id === 'bruno') Object.assign(e, { tapR: 2.2, tapH: 3.2, reach: 3.0 })
      if (id === 'hoot') Object.assign(e, { tapR: 1.4, tapH: 2.0, tapY: n.perch - 0.4, reach: 2.6 })
      if (id === 'momo') Object.assign(e, { tapR: 1.1, tapH: 1.8, reach: 1.8 })
      if (id === 'bun') Object.assign(e, { tapR: 1.1, tapH: 1.4, reach: 1.7 })
      if (id === 'ben') Object.assign(e, { reach: 3.3 })
      if (id === 'coco') Object.assign(e, { reach: 2.6 })
      if (id === 'granny') Object.assign(e, { reach: 1.8 })
      if (id === 'boo') Object.assign(e, { tapR: 1.5, tapH: 2.8, reach: 2.4 })
      if (id === 'finn' || id === 'pip') Object.assign(e, { y: L.PIER.y })
      this.addEntity(e)
    }
    // the King on the castle balcony: tapping him just shows a tip
    const kb = this.castle.userData.balcony.clone().add(this.castle.position)
    this.kingPos = kb
    this.addEntity({ id: 'king', kind: 'king', x: kb.x, z: kb.z, y: kb.y, tapR: 1.6, tapH: 3, zone: 'castle' })
    // pickups: shells on the beaches, hidden coins, the owl's glasses
    let k = 0
    for (const deg of [8, 24, 52, 66, 78, 104, 118, 140, 156, 172, 196, 214, 240, 258, 290, 340]) {
      const a = (deg * Math.PI) / 180
      const R = L.coastRadius(a)
      for (let r = R + 2; r > R - 22; r -= 0.5) {
        const x = Math.cos(a) * r
        const z = Math.sin(a) * r
        const h = this.terrainY(x, z)
        if (h > 0.32 && h < 0.75 && !L.nearRoad(x, z, 2) && !L.onPier(x, z) && Math.abs(x) > 4) {
          this.addEntity({ id: `shell-${k++}`, kind: 'shell', x, z, tapR: 1.0, tapH: 1.2, reach: 0.9, zone: this.zoneOf(x, z) })
          break
        }
      }
    }
    L.HIDDEN_COINS.forEach(([x, z], i) => this.addEntity({ id: `coin-${i}`, kind: 'coin', x, z, tapR: 1.0, tapH: 1.6, reach: 0.9, zone: this.zoneOf(x, z) }))
    this.addEntity({ id: 'glasses', kind: 'glasses', x: L.GLASSES_SPOT.x, z: L.GLASSES_SPOT.z, tapR: 1.0, tapH: 1.2, reach: 0.9, zone: 'forest' })
    // graveyard: gravestones (tap for a ghost) and pumpkins
    for (const g of L.GRAVES) this.addEntity({ id: g.id, kind: 'grave', x: g.x, z: g.z, rot: g.rot, type: g.type, tapR: 0.9, tapH: 1.6, zone: 'graveyard', solid: 0.6 })
    for (const pk of L.PUMPKINS) this.addEntity({ id: pk.id, kind: 'pumpkin', x: pk.x, z: pk.z, tapR: 1.0, tapH: 1.2, reach: 1.3, zone: 'graveyard', fruit: true })
  }

  zoneOf(x, z) {
    let best = 'wild'
    let bd = Infinity
    for (const zn of L.ZONES) {
      if (zn.id === 'wild') continue
      const d = Math.hypot(x - zn.x, z - zn.z)
      if (d < zn.r && d < bd) {
        bd = d
        best = zn.id
      }
    }
    return best
  }

  // Street lamps along the roads (they glow at night and in the graveyard).
  makeLamps() {
    const posts = []
    const spots = []
    for (const r of L.ROADS) {
      if (r.w < 3.5) continue
      const s = resample(r.pts, 1)
      for (let i = 4; i < s.length; i += 15) {
        const [x0, z0, nx, nz] = s[i]
        const side = (i / 15) % 2 ? 1 : -1
        const x = x0 + nx * (r.w / 2 + 1.1) * side
        const z = z0 + nz * (r.w / 2 + 1.1) * side
        if (this.terrainY(x, z) < 0.5 || L.nearRoad(x, z, 0.3) || L.inMoat(x, z, 1.5) || L.onPier(x, z)) continue
        if (L.BUILDINGS.some((b) => Math.hypot(x - b.x, z - b.z) < Math.max(b.w, b.d) / 2 + 2)) continue
        if (this.entities.some((e) => Math.hypot(x - e.x, z - e.z) < 2.5)) continue
        if (Math.hypot(x - L.GRAVEYARD.x, z - L.GRAVEYARD.z) < L.GRAVEYARD.r + 5) continue
        if (L.onDrawbridge(x, z) || Math.hypot(x, z - L.CASTLE.z - L.DRAWBRIDGE.z1) < 4) continue
        if (spots.some(([a, b]) => Math.hypot(x - a, z - b) < 8)) continue
        spots.push([x, z])
        posts.push({ x, y: this.terrainY(x, z) - 0.05, z })
      }
    }
    this.lampSpots = spots
    this.scene.add(instanced('lamppost', posts))
    this.scene.add(instanced('lamphead', posts, { shadow: false }))
  }

  // ---------- plants: positions now, meshes when the zone is built ----------

  planDecor() {
    const rand = L.mulberry32(42)
    const taken = new Map()
    const key = (x, z) => `${Math.round(x / 3)},${Math.round(z / 3)}`
    const blockers = [
      ...L.BUILDINGS.map((b) => [b.x, b.z, Math.max(b.w, b.d) / 2 + 3]),
      ...this.entities.filter((e) => e.kind !== 'grave' && e.kind !== 'pumpkin').map((e) => [e.x, e.z, e.kind === 'npc' ? 3.5 : 2.6]),
      ...this.lampSpots.map(([x, z]) => [x, z, 1.5]),
      [L.START.x, L.START.z, 4],
      [L.OWL_TREE.x, L.OWL_TREE.z, 4],
      [L.BEAR_SPOT.x, L.BEAR_SPOT.z, 3],
    ]
    const free = (x, z, pad) => {
      for (const [bx, bz, r] of blockers) if (Math.hypot(x - bx, z - bz) < r + pad) return false
      if (Math.hypot(x - L.GRAVEYARD.x, z - L.GRAVEYARD.z) < L.GRAVEYARD.r + 1.5) return false
      if (Math.hypot(x - L.CASTLE.x, z - L.CASTLE.z) < L.CASTLE.moatOut + 1.5) return false
      return !L.nearRoad(x, z, 1.5 + pad) && !L.inStream(x, z, 2.2 + pad) && !L.inPond(x, z, 2 + pad) && L.bridgeT(x, z, 3) === null
    }
    const add = (type, item) => {
      const zid = this.zoneOf(item.x, item.z)
      const zone = this.zones.find((zz) => zz.id === zid)
      ;(zone.items[type] ||= []).push(item)
    }
    this.solids = []
    this.treeSpots = []
    const M = L.MOUNTAIN
    for (let i = 0; i < 6500; i++) {
      const x = (rand() * 2 - 1) * L.HALF
      const z = (rand() * 2 - 1) * L.HALF
      const isle = Math.hypot(x - L.ISLET.x, z - L.ISLET.z) < L.ISLET.r - 2
      const t = isle ? 10 : L.inland(x, z)
      if (t < 3) continue
      const h = this.terrainY(x, z)
      if (h < 0.35) continue
      const md = Math.hypot(x - M.x, z - M.z)
      const forest = L.forestness(x, z) > 0.5
      const beachy = t < 16 && h < 1.0
      let density = 0.12
      if (forest) density = 0.85
      else if (md < M.r + 4) density = 0.55
      else if (isle) density = 0.1
      else if (Math.hypot(x - L.VILLAGE.x, z - L.VILLAGE.z) < 28) density = 0.05
      if (Math.hypot(x - L.PLACES.farm.x, z - L.PLACES.farm.z) < 16) density = 0.02
      if (rand() > density) continue
      if (md < M.block && h > 12) continue
      if (!free(x, z, 0.5)) continue
      const kk = key(x, z)
      if (taken.has(kk)) continue
      taken.set(kk, 1)
      let type = 'round'
      if (beachy) type = 'palm'
      else if (forest || md < M.r + 4) type = rand() < 0.55 ? 'pine' : 'round'
      const s = type === 'palm' ? 0.9 + rand() * 0.3 : 0.8 + rand() * 0.5
      add(type, { x, y: h - 0.1, z, s, ry: rand() * 6.28, tint: 0.88 + rand() * 0.2 })
      this.treeSpots.push([x, z, h + 6.2 * s, 1.9 * s])
      if (md > M.block) this.solids.push([x, z, 0.75])
    }
    add('owltree', { x: L.OWL_TREE.x, y: this.terrainY(L.OWL_TREE.x, L.OWL_TREE.z), z: L.OWL_TREE.z })
    this.solids.push([L.OWL_TREE.x, L.OWL_TREE.z, 1.4])
    const scatter = (n, type, test, make, solid = 0) => {
      for (let i = 0; i < n; i++) {
        const x = (rand() * 2 - 1) * L.HALF
        const z = (rand() * 2 - 1) * L.HALF
        if (L.inland(x, z) < 2) continue
        const h = this.terrainY(x, z)
        if (!test(x, z, h)) continue
        if (!free(x, z, 0)) continue
        add(type, make(x, h, z))
        if (solid) this.solids.push([x, z, solid])
      }
    }
    scatter(260, 'bush', (x, z, h) => h > 0.9 && rand() < 0.6, (x, h, z) => ({ x, y: h, z, s: 0.7 + rand() * 0.6, ry: rand() * 6, tint: 0.9 + rand() * 0.2 }), 0.8)
    scatter(150, 'rock', (x, z, h) => h > 0.3, (x, h, z) => ({ x, y: h - 0.1, z, s: 0.6 + rand() * 1.2, ry: rand() * 6, tint: 0.9 + rand() * 0.2 }), 0.7)
    for (let c = 0; c < 80; c++) {
      const cx = (rand() * 2 - 1) * L.HALF
      const cz = (rand() * 2 - 1) * L.HALF
      const col = FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)]
      for (let i = 0; i < 14; i++) {
        const x = cx + (rand() * 2 - 1) * 4
        const z = cz + (rand() * 2 - 1) * 4
        if (L.inland(x, z) < 6) continue
        const h = this.terrainY(x, z)
        if (h < 0.95 || Math.hypot(x - M.x, z - M.z) < M.r || L.spookiness(x, z) > 0.2) continue
        if (L.nearRoad(x, z, 0.4) || L.inStream(x, z, 1.5) || L.inPond(x, z, 1.5) || L.inMoat(x, z, 1.5)) continue
        add('flower:' + col, { x, y: h, z, s: 0.9 + rand() * 0.5, ry: rand() * 6 })
      }
    }
    scatter(4500, 'grass', (x, z, h) => h > 0.95 && Math.hypot(x - M.x, z - M.z) > M.r - 2 && !L.inMoat(x, z, 1), (x, h, z) => ({ x, y: h, z, s: 0.8 + rand() * 0.8, ry: rand() * 6, tint: 0.85 + rand() * 0.3 }))
    scatter(300, 'mushroom', (x, z, h) => L.forestness(x, z) > 0.4 && h > 0.9, (x, h, z) => ({ x, y: h, z, s: 0.8 + rand() * 0.8, ry: rand() * 6 }))
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rand() * 0.2
      const r = L.POND.r + 0.8 + rand() * 1.2
      const x = L.POND.x + Math.cos(a) * r
      const z = L.POND.z + Math.sin(a) * r
      if (L.nearRoad(x, z, 1) || L.inStream(x, z, 1)) continue
      add('reeds', { x, y: this.terrainY(x, z), z, s: 0.8 + rand() * 0.5, ry: rand() * 6 })
    }
    // farm fence
    const F = L.PLACES.farm
    const fence = []
    for (let i = 0; i < 16; i++) {
      const x = F.x - 14 + i * 1.6
      if (Math.abs(x - F.x) < 2) continue
      fence.push({ x, y: this.terrainY(x, F.z + 19), z: F.z + 19 })
    }
    this.zones.find((z) => z.id === 'farm').items.fence = fence
  }

  makeNav() {
    const nav = new NavGrid(L.HALF, 1)
    nav.build((x, z) => {
      if (Math.abs(x) > L.HALF - 2 || Math.abs(z) > L.HALF - 2) return false
      if (L.onPier(x, z) || L.onBridge(x, z) || L.onDrawbridge(x, z)) return true
      const h = this.terrainY(x, z)
      if (h < 0.18) return false
      if (L.inStream(x, z, 0.6) || L.inPond(x, z, 0.9) || L.inMountain(x, z) || L.inMoat(x, z, 0.4)) return false
      const gx = this.terrainY(x + 0.5, z) - this.terrainY(x - 0.5, z)
      const gz = this.terrainY(x, z + 0.5) - this.terrainY(x, z - 0.5)
      return Math.hypot(gx, gz) < 0.8
    })
    for (const b of L.BUILDINGS) {
      if (b.round) nav.blockCircle(b.x, b.z, b.w / 2 + 0.4)
      else nav.blockRect(b.x, b.z, b.w, b.d, b.rot, b.kind === 'burger' ? 0.2 : 0.4)
    }
    // castle corner towers stick out of the walls
    const ch = L.CASTLE.half
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) nav.blockCircle(L.CASTLE.x + sx * ch, L.CASTLE.z + sz * ch, 2.8)
    const bh = L.BUILDINGS.find((b) => b.kind === 'burger')
    for (const dz of [-1.8, 1.8]) {
      const c = Math.cos(bh.rot)
      const s = Math.sin(bh.rot)
      nav.blockCircle(bh.x + 6.4 * c + dz * s, bh.z - 6.4 * s + dz * c, 1.0)
    }
    for (const e of this.entities) {
      if (e.solid) nav.blockCircle(e.x, e.z, e.solid)
      if (e.kind === 'bench') nav.blockRect(e.x, e.z, 2.0, 0.7, e.rot, 0.1)
      if (e.kind === 'npc' && !['hoot', 'bruno', 'finn', 'pip', 'boo'].includes(e.id)) nav.blockCircle(e.x, e.z, 0.6)
    }
    for (const [x, z, r] of this.solids) nav.blockCircle(x, z, r)
    for (const [x, z] of this.lampSpots) nav.blockCircle(x, z, 0.35)
    nav.blockCircle(8, L.NPCS.momo.z, 0.9) // Momo's crate
    nav.blockCircle(L.NPCS.finn.x, L.NPCS.finn.z, 0.5)
    nav.blockCircle(L.NPCS.pip.x, L.NPCS.pip.z, 0.5)
    // graveyard fence: a ring with a gap at the gate
    const G = L.GRAVEYARD
    for (let a = 0; a < Math.PI * 2; a += 0.04) {
      const x = G.x + Math.sin(a) * G.r
      const z = G.z + Math.cos(a) * G.r
      const gate = Math.abs(Math.atan2(Math.sin(a - G.rot), Math.cos(a - G.rot))) < 0.2
      if (!gate) nav.blockCircle(x, z, 0.5)
    }
    this.nav = nav
  }

  // How far (0..1) from the focus toward the camera the view is free of tree tops.
  cameraClear(f, c) {
    const dx = c.x - f.x
    const dz = c.z - f.z
    const len2 = dx * dx + dz * dz
    if (len2 < 1) return 1
    let best = 1
    const minX = Math.min(f.x, c.x) - 3
    const maxX = Math.max(f.x, c.x) + 3
    const minZ = Math.min(f.z, c.z) - 3
    const maxZ = Math.max(f.z, c.z) + 3
    for (const [x, z, top, r] of this.treeSpots) {
      if (x < minX || x > maxX || z < minZ || z > maxZ) continue
      const t = Math.max(0, Math.min(1, ((x - f.x) * dx + (z - f.z) * dz) / len2))
      if (t < 0.15 || t >= best) continue
      const px = f.x + dx * t - x
      const pz = f.z + dz * t - z
      if (px * px + pz * pz > r * r) continue
      if (f.y + (c.y - f.y) * t > top) continue
      best = t
    }
    return best
  }

  // Block or open Bear Bridge (Bruno sits on it until he gets honey).
  setBridgeBlocked(blocked) {
    this.nav.blockCircle(L.BRIDGE_MID[0], L.BRIDGE_MID[1], 3.4, this.nav.dyn, blocked ? 1 : 0)
  }

  // ---------- ambient life ----------

  makeAmbient() {
    this.gulls = []
    for (let i = 0; i < 5; i++) {
      const g = makeGull()
      g.userData.c = i < 3 ? [0, 98] : [L.PLACES.beach.x, L.PLACES.beach.z]
      g.userData.r = 10 + i * 4
      g.userData.h = 11 + i * 1.5
      g.userData.sp = 0.25 + i * 0.05
      g.userData.ph = i * 1.7
      this.scene.add(g)
      this.gulls.push(g)
    }
  }

  // ---------- zones ----------

  // Build the next zone Coji is close to (or any, when idle). Returns true if it built one.
  stream(px, pz, idle) {
    let pick = null
    let pd = Infinity
    for (const z of this.zones) {
      if (z.built) continue
      if (z.id === 'wild' && !idle) continue
      const d = z.id === 'wild' ? 0 : Math.hypot(px - z.x, pz - z.z) - z.r
      if ((d < 110 || idle) && d < pd) {
        pd = d
        pick = z
      }
    }
    if (!pick) return false
    this.buildZone(pick)
    return true
  }

  buildAllNear(px, pz) {
    for (const z of this.zones) if (!z.built && z.id !== 'wild' && Math.hypot(px - z.x, pz - z.z) - z.r < 110) this.buildZone(z)
  }

  buildZone(zone) {
    zone.built = true
    const group = new THREE.Group()
    for (const [type, items] of Object.entries(zone.items)) {
      if (!items.length) continue
      if (type === 'owltree') {
        for (const it of items) group.add(this.owlTree(it))
        continue
      }
      if (type === 'fence') {
        const p = new Parts()
        for (const it of items) {
          p.add(box(0.14, 1.0, 0.14), '#f4ede0', { x: it.x, y: it.y + 0.5, z: it.z })
          p.add(cyl(0.1, 0.1, 0.05, 6), '#f4ede0', { x: it.x, y: it.y + 1.02, z: it.z })
          p.add(box(1.6, 0.1, 0.06), '#f4ede0', { x: it.x + 0.8, y: it.y + 0.75, z: it.z })
          p.add(box(1.6, 0.1, 0.06), '#f4ede0', { x: it.x + 0.8, y: it.y + 0.4, z: it.z })
        }
        group.add(p.build())
        continue
      }
      const small = type === 'grass' || type.startsWith('flower') || type === 'mushroom'
      group.add(instanced(type, items, { shadow: !small }))
    }
    for (const e of this.entities) {
      if (e.zone !== zone.id) continue
      if (e.kind === 'appletree' || e.kind === 'berrybush' || e.kind === 'carrots') {
        const m = e.kind === 'appletree' ? P.appleTree() : e.kind === 'berrybush' ? P.berryBush() : P.carrotPatch()
        m.position.set(e.x, e.y - 0.05, e.z)
        m.traverse((o) => {
          if (o.isMesh) o.castShadow = true
        })
        e.mesh = m
        e.fruitMesh = m.userData.fruit
        group.add(m)
      }
      if (e.kind === 'shell' || e.kind === 'coin' || e.kind === 'glasses') {
        const m = e.kind === 'shell' ? P.shellMesh() : e.kind === 'coin' ? P.coinMesh() : P.glassesMesh()
        m.position.set(e.x, e.y + (e.kind === 'coin' ? 0.55 : 0.02), e.z)
        m.rotation.y = Math.random() * 6
        e.mesh = m
        group.add(m)
        const sparkle = this.sparkle()
        sparkle.position.set(e.x, e.y + 0.9, e.z)
        e.sparkle = sparkle
        group.add(sparkle)
      }
      if (e.kind === 'grave') {
        const m = P.gravestone(e.type)
        m.position.set(e.x, e.y - 0.05, e.z)
        m.rotation.y = e.rot
        e.mesh = m
        group.add(m)
      }
      if (e.kind === 'pumpkin') {
        const m = new THREE.Group()
        const pk = P.pumpkin(0.9 + (e.x % 1) * 0.2)
        m.add(pk)
        m.add(P.pumpkinVine())
        m.position.set(e.x, e.y, e.z)
        m.rotation.y = e.x
        e.mesh = m
        e.fruitMesh = pk
        group.add(m)
      }
      if (e.kind === 'npc') this.makeNpc(e, group)
    }
    if (zone.id === 'harbor') {
      const crate = new Parts()
      crate.add(box(1.2, 0.9, 1.2), '#c89a5a', { y: 0.45 })
      crate.add(box(1.24, 0.12, 1.24), '#a8783f', { y: 0.75 })
      const cm = crate.build()
      cm.position.set(8, this.terrainY(8, L.NPCS.momo.z), L.NPCS.momo.z)
      group.add(cm)
    }
    if (zone.id === 'forest') {
      this.ducks = []
      for (let i = 0; i < 3; i++) {
        const d = makeDuck(i === 1)
        d.userData.ph = (i / 3) * Math.PI * 2
        d.userData.r = 2.5 + i * 1.1
        group.add(d)
        this.ducks.push(d)
      }
    }
    if (zone.id === 'castle') this.buildCastleLife(group)
    if (zone.id === 'graveyard') this.buildGraveyard(group)
    if (['farm', 'village', 'lighthouse', 'school', 'post'].includes(zone.id)) {
      const cols = ['#ff9fd1', '#ffe066', '#9fd8ff', '#c9a7ff']
      for (let i = 0; i < 3; i++) {
        const b = makeButterfly(cols[(i + this.flies.length) % cols.length])
        b.userData.c = [zone.x + (Math.random() - 0.5) * 20, zone.z + (Math.random() - 0.5) * 20]
        b.userData.ph = Math.random() * 10
        group.add(b)
        this.flies.push(b)
      }
    }
    this.scene.add(group)
  }

  buildCastleLife(group) {
    // the King on the balcony, waving now and then
    const king = new Person(LOOKS.king)
    king.root.position.copy(this.kingPos)
    king.root.rotation.y = 0
    king.homeFace = 0
    group.add(king.root)
    this.king = king
    // flags flutter
    this.castleFlags = this.castle.userData.flags
  }

  buildGraveyard(group) {
    const G = L.GRAVEYARD
    const y = this.terrainY(G.x, G.z)
    const yard = P.graveyardFence(G.r, G.rot)
    yard.position.set(G.x, y, G.z)
    group.add(yard)
    // dead trees
    for (const [lx, lz, s] of [[-8, -6, 1.1], [7, -7, 0.9], [-9, 5, 0.8], [9, 4, 1.0]]) {
      const c = Math.cos(G.rot)
      const sn = Math.sin(G.rot)
      const x = G.x + lx * c + lz * sn
      const z = G.z - lx * sn + lz * c
      const t = P.deadTree()
      t.position.set(x, this.terrainY(x, z) - 0.05, z)
      t.rotation.y = lx + lz
      t.scale.setScalar(s)
      group.add(t)
      this.nav.blockCircle(x, z, 0.6)
    }
    // jack-o'-lanterns by the gate
    const [gx, gz] = L.ahead(G.x, G.z, G.rot, G.r + 0.3)
    for (const s of [-1, 1]) {
      const j = P.jackOLantern()
      const x = gx + Math.cos(G.rot) * s * 3.8 + Math.sin(G.rot) * 0.8
      const z = gz - Math.sin(G.rot) * s * 3.8 + Math.cos(G.rot) * 0.8
      j.position.set(x, this.terrainY(x, z), z)
      j.rotation.y = G.rot
      group.add(j)
    }
    // Boo's own lantern (lit after Boo's quest)
    const bl = P.jackOLantern(1.3)
    const [bx, bz] = L.ahead(L.NPCS.boo.x, L.NPCS.boo.z, G.rot + 0.9, 1.8)
    bl.position.set(bx, this.terrainY(bx, bz), bz)
    bl.rotation.y = G.rot
    bl.visible = false
    group.add(bl)
    this.booLantern = bl
    // drifting mist and floating wisps
    this.mists = []
    const mistTex = softDot('rgba(220,215,240,0.9)')
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, opacity: 0.35, depthWrite: false, fog: false }))
      const a = (i / 7) * Math.PI * 2
      m.position.set(G.x + Math.cos(a) * 6, y + 0.35 + i * 0.05, G.z + Math.sin(a) * 6)
      m.userData.a = a
      m.renderOrder = 4
      group.add(m)
      this.mists.push(m)
    }
    this.wisps = []
    const wispTex = softDot('rgba(170,255,190,1)')
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: wispTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))
      s.scale.set(0.6, 0.6, 1)
      s.userData.ph = i * 1.3
      group.add(s)
      this.wisps.push(s)
    }
    this.bats = []
    for (let i = 0; i < 4; i++) {
      const b = P.bat()
      b.userData.ph = i * 1.6
      group.add(b)
      this.bats.push(b)
    }
  }

  owlTree(it) {
    const p = new Parts()
    p.add(cyl(0.6, 0.85, 5.5, 10), '#7a4e27', { y: 2.75 })
    p.add(ico(0.42, 1), '#3a2414', { y: 2.2, z: 0.62, sz: 0.4, sy: 1.3 })
    p.add(cyl(0.18, 0.25, 2.2, 7), '#7a4e27', { y: 4.35, z: 1.1, rx: Math.PI / 2 - 0.15 })
    const g = new THREE.Group()
    g.add(p.build())
    const leaves = new Parts()
    leaves.add(blobGeo(2.8, 1), '#4f9f4a', { y: 7.2, sy: 0.85, mat: SMOOTH })
    leaves.add(blobGeo(1.9, 2), '#5aad52', { x: 1.9, y: 6.4, z: 0.6, mat: SMOOTH })
    leaves.add(blobGeo(1.9, 3), '#479442', { x: -1.8, y: 6.6, z: -0.6, mat: SMOOTH })
    leaves.add(blobGeo(1.6, 4), '#5fb456', { x: 0.2, y: 8.6, z: -0.4, mat: SMOOTH })
    g.add(leaves.build())
    g.position.set(it.x, it.y - 0.1, it.z)
    g.rotation.y = Math.atan2(L.NPCS.hoot.x - it.x, L.NPCS.hoot.z - it.z)
    return g
  }

  sparkle() {
    return makeSprite(
      (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
        g.addColorStop(0, 'rgba(255,255,255,1)')
        g.addColorStop(0.25, 'rgba(255,240,170,0.8)')
        g.addColorStop(1, 'rgba(255,240,170,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.moveTo(w / 2, 4)
        ctx.lineTo(w / 2 + 5, h / 2 - 5)
        ctx.lineTo(w - 4, h / 2)
        ctx.lineTo(w / 2 + 5, h / 2 + 5)
        ctx.lineTo(w / 2, h - 4)
        ctx.lineTo(w / 2 - 5, h / 2 + 5)
        ctx.lineTo(4, h / 2)
        ctx.lineTo(w / 2 - 5, h / 2 - 5)
        ctx.closePath()
        ctx.fill()
      },
      64,
      64,
      0.8,
    )
  }

  makeNpc(e, group) {
    const n = L.NPCS[e.id]
    let ch
    if (e.id === 'bruno') ch = new Bear()
    else if (e.id === 'hoot') ch = new Owl()
    else if (e.id === 'momo') ch = new Cat()
    else if (e.id === 'bun') ch = new Bunny()
    else if (e.id === 'boo') ch = new Ghost(true)
    else ch = new Person(LOOKS[e.id])
    let y = e.y
    let { x, z } = n
    if (e.id === 'hoot') {
      x = L.OWL_TREE.x + Math.sin(this.owlFace()) * 1.5
      z = L.OWL_TREE.z + Math.cos(this.owlFace()) * 1.5
      y = this.terrainY(L.OWL_TREE.x, L.OWL_TREE.z) + n.perch - 0.1
    }
    if (e.id === 'momo') {
      x = 8
      y = this.terrainY(8, n.z) + 0.9
    }
    if (e.id === 'bruno') y = this.groundY(n.x, n.z)
    if (e.id === 'boo') y = this.terrainY(n.x, n.z) + n.float
    ch.root.position.set(x, y, z)
    ch.root.rotation.y = n.face
    ch.baseY = y
    ch.homeFace = n.face
    ch.id = e.id
    group.add(ch.root)
    e.ch = ch
    this.npcs[e.id] = e
    this.onNpcBuilt?.(e)
  }
  owlFace() {
    return Math.atan2(L.NPCS.hoot.x - L.OWL_TREE.x, L.NPCS.hoot.z - L.OWL_TREE.z)
  }

  // A little ghost pops out of a grave, floats up and fades away.
  popGhost(x, y, z) {
    const g = new Ghost(false)
    g.root.position.set(x, y + 0.2, z)
    g.root.scale.setScalar(0.2)
    g.setOpacity(0.95)
    this.scene.add(g.root)
    this.pops.push({ g, t: 0, x, y, z, dir: Math.random() < 0.5 ? -1 : 1 })
  }

  // ---------- per frame ----------

  update(dt, t, focus) {
    this.t = t
    this.seaMat.uniforms.uTime.value = t
    this.freshMat.uniforms.uTime.value = t
    const snap = 2
    const fx = Math.round(focus.x / snap) * snap
    const fz = Math.round(focus.z / snap) * snap
    this.sun.target.position.set(fx, 0, fz)
    this.sun.position.set(fx + this.sunOffset.x, this.sunOffset.y, fz + this.sunOffset.z)
    this.sun.target.updateMatrixWorld()
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt
      if (c.position.x > 300) c.position.x = -300
    }
    this.boat.position.y = -0.25 + Math.sin(t * 1.2) * 0.08
    this.boat.rotation.z = Math.sin(t * 0.9) * 0.025
    for (const g of this.gulls) {
      const u = g.userData
      const a = t * u.sp + u.ph
      g.position.set(u.c[0] + Math.cos(a) * u.r, u.h + Math.sin(t * 0.7 + u.ph) * 1.2, u.c[1] + Math.sin(a) * u.r)
      g.rotation.y = -a
      g.rotation.z = 0.25
      const f = Math.sin(t * 6 + u.ph) * 0.45
      u.wings[0].rotation.z = -f
      u.wings[1].rotation.z = f
    }
    if (this.ducks) {
      const py = L.getPondLevel()
      for (const d of this.ducks) {
        const u = d.userData
        const a = t * 0.18 + u.ph
        d.position.set(L.POND.x + Math.cos(a) * u.r, py - 0.05 + Math.sin(t * 2 + u.ph) * 0.02, L.POND.z + Math.sin(a) * u.r)
        d.rotation.y = -a + Math.PI
      }
    }
    for (const b of this.flies) {
      const u = b.userData
      const ph = t * 0.5 + u.ph
      const x = u.c[0] + Math.sin(ph) * 5 + Math.sin(ph * 2.3) * 2
      const z = u.c[1] + Math.cos(ph * 0.8) * 5
      b.position.set(x, this.terrainY(x, z) + 1.0 + Math.sin(t * 3 + u.ph) * 0.3, z)
      b.rotation.y = ph
      const f = Math.sin(t * 18 + u.ph) * 0.9
      u.wings[0].rotation.z = f
      u.wings[1].rotation.z = -f
    }
    for (const e of this.entities) {
      if (e.kind === 'coin' && e.mesh) e.mesh.rotation.y += dt * 2
      if (e.sparkle && e.sparkle.visible) {
        const s = 0.6 + Math.abs(Math.sin(t * 3 + e.x)) * 0.5
        e.sparkle.scale.set(s, s, 1)
      }
    }
    if (this.castleFlags) for (const [i, f] of this.castleFlags.entries()) f.rotation.y = Math.sin(t * 2.4 + i) * 0.35
    if (this.king) {
      const k = this.king
      const cycle = (t % 9) / 9
      if (cycle < 0.18) k.wave = 0.2
      k.lookYaw = Math.sin(t * 0.4) * 0.5
      k.update(dt, t)
    }
    // graveyard life
    if (this.mists) {
      const G = L.GRAVEYARD
      for (const m of this.mists) {
        const a = m.userData.a + t * 0.05
        m.position.x = G.x + Math.cos(a) * 6
        m.position.z = G.z + Math.sin(a) * 6
        m.material.opacity = 0.22 + Math.sin(t * 0.7 + m.userData.a * 3) * 0.1
      }
      for (const w of this.wisps) {
        const ph = t * 0.4 + w.userData.ph
        const x = G.x + Math.sin(ph) * 8
        const z = G.z + Math.cos(ph * 1.3) * 8
        w.position.set(x, this.terrainY(x, z) + 1.4 + Math.sin(t * 2 + w.userData.ph) * 0.5, z)
        w.material.opacity = 0.5 + Math.sin(t * 3 + w.userData.ph) * 0.3
      }
      for (const b of this.bats) {
        const ph = t * 0.9 + b.userData.ph
        b.position.set(G.x + Math.cos(ph) * (6 + b.userData.ph), 8 + Math.sin(t * 2 + b.userData.ph) * 1.5, G.z + Math.sin(ph) * (6 + b.userData.ph))
        b.rotation.y = -ph
        const f = Math.sin(t * 16 + b.userData.ph) * 0.8
        b.userData.wings[0].rotation.z = f
        b.userData.wings[1].rotation.z = -f
      }
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i]
      p.t += dt
      const k = p.t / 1.8
      p.g.root.position.set(p.x + Math.sin(p.t * 5) * 0.3 * p.dir, p.y + 0.2 + k * 3.2, p.z)
      p.g.root.scale.setScalar(Math.min(1, 0.2 + p.t * 2.2) * 0.9)
      p.g.setOpacity(0.95 * (1 - L.smoothstep(0.55, 1, k)))
      p.g.update(dt, t)
      if (k >= 1) {
        this.scene.remove(p.g.root)
        this.pops.splice(i, 1)
      }
    }
    if (this.lit) this.lighthouse.userData.beam.rotation.y += dt * 0.9
    if (this.fw) this.updateFireworks(dt)
  }

  // ---------- day, night and spooky ----------

  setEnv(night, spook) {
    if (Math.abs(night - this.night) < 0.002 && Math.abs(spook - this.spook) < 0.002 && this.envSet) return
    this.envSet = true
    this.night = night
    this.spook = spook
    const s = spook * (1 - night * 0.6)
    const mix = (k) => {
      const v = DAY[k].clone ? DAY[k].clone().lerp(NIGHT[k], night) : L.lerp(DAY[k], NIGHT[k], night)
      return v.lerp ? v.lerp(SPOOK[k], s) : L.lerp(v, SPOOK[k], s)
    }
    this.skyMat.uniforms.top.value.copy(mix('top'))
    this.skyMat.uniforms.horizon.value.copy(mix('horizon'))
    this.skyMat.uniforms.night.value = Math.max(night, s * 0.8)
    this.scene.fog.color.copy(mix('fog'))
    this.scene.fog.near = mix('near')
    this.scene.fog.far = mix('far')
    this.scene.background.copy(this.scene.fog.color)
    this.sun.color.copy(mix('sun'))
    this.sun.intensity = mix('sunI')
    this.hemi.color.copy(mix('hemiSky'))
    this.hemi.groundColor.copy(mix('hemiGround'))
    this.hemi.intensity = mix('hemiI')
    this.seaMat.uniforms.uNight.value = Math.max(night, s * 0.5)
    this.seaMat.uniforms.uSky.value.copy(mix('horizon'))
    this.freshMat.uniforms.uNight.value = Math.max(night, s * 0.5)
    GLOW.emissiveIntensity = Math.max(night * 0.9, s * 0.8)
    this.stars.material.opacity = night
  }
  setNight(k) {
    this.setEnv(k, this.spook)
  }

  lightUp() {
    this.lit = true
    const { lamp, beam } = this.lighthouse.userData
    lamp.material.color.set(0xfff6c8)
    lamp.scale.setScalar(1.3)
    beam.visible = true
  }

  // ---------- fireworks ----------

  fireworks(on) {
    if (!on) {
      if (this.fw) {
        this.scene.remove(this.fw.points)
        this.fw = null
      }
      return
    }
    const N = 900
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3))
    const mat = new THREE.PointsMaterial({ size: 1.3, map: softDot('rgba(255,255,255,1)'), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
    const points = new THREE.Points(g, mat)
    points.frustumCulled = false
    this.scene.add(points)
    this.fw = { points, N, vel: new Float32Array(N * 3), life: new Float32Array(N), timer: 0, cursor: 0 }
  }

  updateFireworks(dt) {
    const fw = this.fw
    const pos = fw.points.geometry.attributes.position
    const col = fw.points.geometry.attributes.color
    fw.timer -= dt
    if (fw.timer <= 0) {
      fw.timer = 0.6 + Math.random() * 0.6
      const lh = this.lighthouse.position
      const cx = lh.x + (Math.random() - 0.5) * 40
      const cz = lh.z + 10 + (Math.random() - 0.5) * 30
      const cy = 28 + Math.random() * 12
      const c = new THREE.Color().setHSL(Math.random(), 1, 0.5)
      for (let i = 0; i < 110; i++) {
        const k = fw.cursor
        fw.cursor = (fw.cursor + 1) % fw.N
        const th = Math.random() * Math.PI * 2
        const ph = Math.acos(Math.random() * 2 - 1)
        const sp = 7 + Math.random() * 3
        pos.array[k * 3] = cx
        pos.array[k * 3 + 1] = cy
        pos.array[k * 3 + 2] = cz
        fw.vel[k * 3] = Math.sin(ph) * Math.cos(th) * sp
        fw.vel[k * 3 + 1] = Math.cos(ph) * sp
        fw.vel[k * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp
        fw.life[k] = 1.6
        col.array[k * 3] = c.r
        col.array[k * 3 + 1] = c.g
        col.array[k * 3 + 2] = c.b
      }
    }
    for (let k = 0; k < fw.N; k++) {
      if (fw.life[k] <= 0) continue
      fw.life[k] -= dt
      fw.vel[k * 3 + 1] -= 5 * dt
      for (let a = 0; a < 3; a++) {
        fw.vel[k * 3 + a] *= 1 - 1.2 * dt
        pos.array[k * 3 + a] += fw.vel[k * 3 + a] * dt
      }
      col.array[k * 3] *= 0.985
      col.array[k * 3 + 1] *= 0.985
      col.array[k * 3 + 2] *= 0.985
      if (fw.life[k] <= 0) pos.array[k * 3 + 1] = -100
    }
    pos.needsUpdate = true
    col.needsUpdate = true
  }

  // ---------- portraits for the dialogue box ----------

  portrait(ch, size = 192) {
    if (!this.portraitScene) {
      const s = new THREE.Scene()
      s.add(new THREE.HemisphereLight(0xffffff, 0xb7d6a0, 1.6))
      const d = new THREE.DirectionalLight(0xffffff, 1.8)
      d.position.set(2, 3, 4)
      s.add(d)
      this.portraitScene = s
      this.portraitCam = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
      this.portraitRT = new THREE.WebGLRenderTarget(size, size, { samples: 4 })
      this.portraitBuf = new Uint8Array(size * size * 4)
    }
    const root = ch.root
    const parent = root.parent
    const saved = { p: root.position.clone(), r: root.rotation.y, s: root.scale.x }
    this.portraitScene.add(root)
    root.position.set(0, 0, 0)
    root.rotation.y = 0
    root.scale.setScalar(1)
    if (ch.head) ch.head.rotation.set(0, 0, 0)
    root.updateMatrixWorld(true)
    const fy = ch.faceY ?? 1.5
    const dist = ch.portraitDist ?? 2.4
    this.portraitCam.position.set(0.25 * dist, fy + 0.15 * dist, dist)
    this.portraitCam.lookAt(0, fy - 0.08, 0)
    const r = this.renderer
    const prevTarget = r.getRenderTarget()
    const prevClear = r.getClearAlpha()
    r.setRenderTarget(this.portraitRT)
    r.setClearColor(0x000000, 0)
    r.clear()
    r.render(this.portraitScene, this.portraitCam)
    r.readRenderTargetPixels(this.portraitRT, 0, 0, size, size, this.portraitBuf)
    r.setRenderTarget(prevTarget)
    r.setClearAlpha(prevClear)
    if (parent) parent.add(root)
    root.position.copy(saved.p)
    root.rotation.y = saved.r
    root.scale.setScalar(saved.s)
    const cv = document.createElement('canvas')
    cv.width = size
    cv.height = size
    const ctx = cv.getContext('2d')
    const img = ctx.createImageData(size, size)
    const lut = new Uint8Array(256)
    for (let i = 0; i < 256; i++) {
      const c = i / 255
      lut[i] = Math.round(Math.min(1, c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255)
    }
    const buf = this.portraitBuf
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const s = ((size - 1 - y) * size + x) * 4
        const d = (y * size + x) * 4
        img.data[d] = lut[buf[s]]
        img.data[d + 1] = lut[buf[s + 1]]
        img.data[d + 2] = lut[buf[s + 2]]
        img.data[d + 3] = buf[s + 3]
      }
    ctx.putImageData(img, 0, 0)
    return cv.toDataURL()
  }
}

// A soft round dot texture (mist, wisps, fireworks).
const dotCache = new Map()
function softDot(color) {
  if (dotCache.has(color)) return dotCache.get(color)
  const cv = document.createElement('canvas')
  cv.width = cv.height = 64
  const ctx = cv.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(cv)
  dotCache.set(color, tex)
  return tex
}

const blobGeo = (r, seed) => blob(r, 1, seed)

// Points every `step` along a polyline with their unit normals: [x, z, nx, nz].
function resample(pts, step) {
  const out = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]
    const [bx, bz] = pts[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const n = Math.max(1, Math.round(len / step))
    for (let k = 0; k < n; k++) {
      const t = k / n
      out.push([ax + (bx - ax) * t, az + (bz - az) * t])
    }
  }
  out.push([...pts[pts.length - 1]])
  return out.map((p, i) => {
    const a = out[Math.max(0, i - 1)]
    const b = out[Math.min(out.length - 1, i + 1)]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const l = Math.hypot(dx, dz) || 1
    return [p[0], p[1], -dz / l, dx / l]
  })
}
