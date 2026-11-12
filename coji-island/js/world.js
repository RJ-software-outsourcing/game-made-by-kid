// The island: sky, sea, terrain, roads, buildings, plants, characters and tap targets.
// The core is built up front; each zone's details are built when Coji gets near (or when idle).
import * as THREE from 'three'
import * as L from './land.js'
import { NavGrid } from './nav.js'
import { Parts, MAT, GLOW, box, cyl, ico, makeSprite } from './build.js'
import * as P from './props.js'
import { instanced, cloud, FLOWER_COLORS } from './nature.js'
import { Person, LOOKS, Bear, Owl, Cat, Bunny, makeDuck, makeGull, makeButterfly } from './characters.js'

const RES = 2
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

const DAY = {
  top: new THREE.Color('#4fb1ee'),
  horizon: new THREE.Color('#cdeefb'),
  sun: new THREE.Color('#fff1d8'),
  sunI: 2.4,
  hemiSky: new THREE.Color('#d6efff'),
  hemiGround: new THREE.Color('#d8c7a0'),
  hemiI: 1.25,
  fog: new THREE.Color('#cdeefb'),
}
const NIGHT = {
  top: new THREE.Color('#0b1236'),
  horizon: new THREE.Color('#33407a'),
  sun: new THREE.Color('#9fb6ff'),
  sunI: 0.55,
  hemiSky: new THREE.Color('#6f80c8'),
  hemiGround: new THREE.Color('#2a3350'),
  hemiI: 0.55,
  fog: new THREE.Color('#2a3566'),
}

export class World {
  constructor(scene, renderer) {
    this.scene = scene
    this.renderer = renderer
    this.t = 0
    this.entities = []
    this.byId = {}
    this.npcs = {}
    this.animated = []
    this.proxies = []
    this.groundMeshes = []
    this.zones = L.ZONES.map((z) => ({ ...z, built: false, items: {} }))
    this.night = 0
    this.lit = false
  }

  // ---------- heights ----------

  makeHeights() {
    const n = (L.HALF * 2) / RES + 1
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
    let i = Math.floor(fx)
    let j = Math.floor(fz)
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
    if (L.onBridge(x, z)) return L.bridgeDeckY(z, (a, b) => this.terrainY(a, b))
    return Math.max(this.terrainY(x, z), -0.3)
  }

  // ---------- core build ----------

  async buildCore(progress = () => {}) {
    this.rand = L.mulberry32(7)
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
    scene.fog = new THREE.Fog(DAY.fog.clone(), 110, 360)
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
        void main(){ float h = clamp(vDir.y, 0., 1.); vec3 c = mix(horizon, top, pow(h, 0.55));
          float s = max(dot(normalize(vDir), sunDir), 0.); c += vec3(1.,.95,.8) * pow(s, 64.) * (1.-night) * 0.6;
          c += vec3(1.) * pow(s, 900.) * (1.-night);
          gl_FragColor = vec4(c, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.skyMat)
    sky.renderOrder = -1
    scene.add(sky)
    this.sky = sky

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

    // clouds
    this.clouds = []
    const rand = L.mulberry32(11)
    for (let i = 0; i < 14; i++) {
      const c2 = cloud(rand)
      const a = rand() * Math.PI * 2
      const r = 60 + rand() * 170
      c2.position.set(Math.cos(a) * r, 38 + rand() * 22, Math.sin(a) * r)
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

  makeTerrain() {
    const n = this.gn
    const H = this.H
    const pos = []
    const col = []
    const nor = []
    const c = new THREE.Color()
    const sand = new THREE.Color('#f2e0a8')
    const wetSand = new THREE.Color('#d8c48c')
    const grassA = new THREE.Color('#93d36c')
    const grassB = new THREE.Color('#7fc65e')
    const forestA = new THREE.Color('#5fae55')
    const forestB = new THREE.Color('#6dbb5c')
    const rock = new THREE.Color('#a7a199')
    const tmpC = new THREE.Color()
    const rockTop = new THREE.Color('#ece8e2')
    const soil = new THREE.Color('#b59e74')
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const nrm = new THREE.Vector3()
    const M = L.MOUNTAIN
    const pushTri = (x1, z1, h1, x2, z2, h2, x3, z3, h3) => {
      a.set(x2 - x1, h2 - h1, z2 - z1)
      b.set(x3 - x1, h3 - h1, z3 - z1)
      nrm.crossVectors(a, b).normalize()
      const cx = (x1 + x2 + x3) / 3
      const cz = (z1 + z2 + z3) / 3
      const ch = (h1 + h2 + h3) / 3
      const slope = 1 - nrm.y
      const t = L.inland(cx, cz)
      const md = Math.hypot(cx - M.x, cz - M.z)
      const noise = L.vnoise(cx * 0.08, cz * 0.08)
      if (ch < -0.1) c.copy(wetSand).multiplyScalar(0.92 + 0.08 * noise)
      else if (md < M.r - 1 && ch > 2.2) c.copy(rock).lerp(rockTop, L.smoothstep(14, 20, ch))
      else if (L.inStream(cx, cz, 1.4) || L.inPond(cx, cz, 1.6)) c.copy(soil)
      else if ((ch < 0.95 && t < 18) || Math.hypot(cx - L.PLACES.beach.x - 6, cz - L.PLACES.beach.z) < 11) c.copy(sand)
      else {
        c.copy(grassA).lerp(grassB, noise)
        const f = L.forestness(cx, cz)
        if (f > 0) c.lerp(tmpC.copy(forestA).lerp(forestB, noise), f)
      }
      if (slope > 0.25 && ch > 0.9 && md < M.r) c.lerp(rock, 0.4)
      const j = 0.95 + Math.random() * 0.08
      for (const [x, h, z] of [[x1, h1, z1], [x2, h2, z2], [x3, h3, z3]]) {
        pos.push(x, h, z)
        nor.push(nrm.x, nrm.y, nrm.z)
        col.push(c.r * j, c.g * j, c.b * j)
      }
    }
    for (let jz = 0; jz < n - 1; jz++)
      for (let ix = 0; ix < n - 1; ix++) {
        const x0 = -L.HALF + ix * RES
        const z0 = -L.HALF + jz * RES
        const x1 = x0 + RES
        const z1 = z0 + RES
        const h00 = H[jz * n + ix]
        const h10 = H[jz * n + ix + 1]
        const h01 = H[(jz + 1) * n + ix]
        const h11 = H[(jz + 1) * n + ix + 1]
        if (h00 < -6.5 && h10 < -6.5 && h01 < -6.5 && h11 < -6.5) continue
        pushTri(x0, z0, h00, x0, z1, h01, x1, z0, h10)
        pushTri(x0, z1, h01, x1, z1, h11, x1, z0, h10)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.computeBoundingSphere()
    const mesh = new THREE.Mesh(g, MAT)
    mesh.receiveShadow = true
    this.scene.add(mesh)
    this.terrain = mesh
    this.groundMeshes.push(mesh)
    // sea floor far away
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
        const h = this.terrainY(x, z)
        const v = Math.round(L.clamp((h + 7) / 9, 0, 1) * 255)
        const k = (j * N + i) * 4
        data[k] = v
        data[k + 1] = v
        data[k + 2] = v
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
        uShallow: { value: new THREE.Color('#5fe0e3') },
        uDeep: { value: new THREE.Color('#2a8fd6') },
        uFoam: { value: new THREE.Color('#ffffff') },
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
      fragmentShader: `uniform sampler2D uHeight; uniform float uHalf; uniform float uTime; uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoam; uniform float uNight; varying vec3 vW;
        #include <fog_pars_fragment>
        void main(){
          vec2 uv = (vW.xz + uHalf) / (2.*uHalf);
          float h = -7.;
          if (uv.x > 0. && uv.x < 1. && uv.y > 0. && uv.y < 1.) h = texture2D(uHeight, uv).r * 9. - 7.;
          float depth = max(0., vW.y - h);
          vec3 col = mix(uShallow, uDeep, smoothstep(0.3, 5.5, depth));
          float band = sin(depth*7. - uTime*1.7 + sin(vW.x*0.25 + vW.z*0.2)*1.2)*0.5 + 0.5;
          float foam = smoothstep(0.45, 0.05, depth) + smoothstep(0.8, 1., band) * smoothstep(1.6, 0.3, depth) * 0.75;
          float sp = sin(vW.x*1.3 + uTime*1.9) * sin(vW.z*1.5 - uTime*1.4);
          col += smoothstep(0.95, 1., sp) * 0.22 * (1. - uNight);
          col = mix(col, uFoam, clamp(foam, 0., 1.) * 0.85);
          col *= mix(1., 0.4, uNight);
          float alpha = mix(0.5, 0.94, smoothstep(0., 2.6, depth));
          alpha = max(alpha, clamp(foam, 0., 1.) * 0.95);
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    })
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800, 90, 90).rotateX(-Math.PI / 2), this.seaMat)
    sea.position.y = 0
    sea.renderOrder = 2
    this.scene.add(sea)
    this.sea = sea
  }

  makeFreshWater() {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uNight: { value: 0 } }])
    this.freshMat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      fog: true,
      depthWrite: false,
      vertexShader: `varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vec4 wp = modelMatrix * vec4(position,1.); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uTime; uniform float uNight; varying vec3 vW;
        #include <fog_pars_fragment>
        void main(){ vec3 col = vec3(0.32, 0.74, 0.88);
          float r = sin(vW.x*1.4 + vW.z*0.6 + uTime*2.2) * sin(vW.z*1.2 - vW.x*0.5 - uTime*1.6);
          col = mix(col, vec3(1.), smoothstep(0.8, 1., r) * 0.6);
          col *= mix(1., 0.4, uNight);
          gl_FragColor = vec4(col, 0.85);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    })
    // stream ribbon
    const pts = resample(L.STREAM, 1.0)
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
    stream.material.side = THREE.DoubleSide
    stream.renderOrder = 3
    this.scene.add(stream)
    // pond
    const pond = new THREE.Mesh(new THREE.CircleGeometry(L.POND.r + 1.6, 28).rotateX(-Math.PI / 2), this.freshMat)
    pond.position.set(L.POND.x, L.getPondLevel(), L.POND.z)
    pond.renderOrder = 3
    this.scene.add(pond)
  }

  makeRoads() {
    const roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    const p = new Parts()
    for (const r of L.ROADS) {
      this.ribbon(p, r.pts, r.w + 0.6, 0.06, '#d9bd86', roadMat)
      this.ribbon(p, r.pts, r.w, 0.09, '#ecd6a3', roadMat)
    }
    const roads = p.build({ shadow: false, receive: true })
    this.scene.add(roads)
    // plaza with rings
    const pl = new Parts()
    const y = this.terrainY(0, 0) + 0.12
    pl.add(new THREE.CircleGeometry(L.PLAZA.r + 0.6, 40), '#d9c9a6', { rx: -Math.PI / 2, y: y - 0.01, mat: roadMat, jitter: 0.02 })
    pl.add(new THREE.RingGeometry(3.2, L.PLAZA.r, 40, 3), '#ece0c6', { rx: -Math.PI / 2, y, mat: roadMat, jitter: 0.05 })
    pl.add(new THREE.RingGeometry(1.8, 3.2, 30, 1), '#cdb990', { rx: -Math.PI / 2, y, mat: roadMat, jitter: 0.05 })
    const plaza = pl.build({ shadow: false, receive: true })
    this.scene.add(plaza)
    // harbor quay paving
    const q = new Parts()
    for (let i = 0; i < 7; i++)
      for (let j = 0; j < 5; j++) q.add(box(2.0, 0.2, 2.0), (i + j) % 2 ? '#e8dcc4' : '#ddd0b5', { x: -6 + i * 2, y: L.PIER.y - 0.06, z: 80 + j * 2, jitter: 0.03 })
    q.add(box(14.2, 0.3, 0.5), '#b98a5e', { y: L.PIER.y - 0.02, z: 89.2 })
    for (const x of [-5.5, -3.2, 3.2, 5.5]) {
      q.add(cyl(0.2, 0.26, 0.55, 6), '#5d5d66', { x, y: L.PIER.y + 0.25, z: 88.6 })
      q.add(cyl(0.3, 0.3, 0.1, 8), '#5d5d66', { x, y: L.PIER.y + 0.55, z: 88.6 })
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
      const row = (x, z, nx, nz) => [-1, 0, 1].map((k) => {
        const px = x + nx * half * k
        const pz = z + nz * half * k
        return [px, this.groundY(px, pz) + lift, pz]
      })
      const A = row(ax, az, anx, anz)
      const B = row(bx, bz, bnx, bnz)
      const v = []
      for (let k = 0; k < 2; k++) v.push(...A[k], ...A[k + 1], ...B[k], ...A[k + 1], ...B[k + 1], ...B[k])
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
      g.computeVertexNormals()
      p.push(g, hex, 0.05, mat)
    }
  }

  makeBuildings() {
    const signs = {
      burger: ['BURGER HUT', 4.6, 0.75, '#e94b3c', '#ffffff', [0, 3.45, 3.62]],
      market: ['MARKET', 2.6, 0.6, '#a8693f', '#fff3d6', [0, 2.6, 2.75]],
      bank: ['BANK', 2.4, 0.55, '#e6e1d8', '#3b4a5e', [0, 4.2, 4.12]],
      toyshop: ['TOY SHOP', 3.2, 0.55, '#ff8fb1', '#ffffff', [-1.5, 2.88, 3.1]],
    }
    for (const b of L.BUILDINGS) {
      let m
      switch (b.kind) {
        case 'house':
          m = P.house(b.color, b.w, b.d)
          break
        case 'burger':
          m = P.burgerHut()
          break
        case 'market':
          m = P.marketStall()
          break
        case 'bank':
          m = P.bank()
          break
        case 'toyshop':
          m = P.toyShop()
          break
        case 'shed':
          m = P.shed()
          break
        case 'cottage':
          m = P.cottage()
          break
        case 'warehouse':
          m = P.warehouse()
          break
        case 'lighthouse':
          m = P.lighthouse()
          this.lighthouse = m
          break
      }
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
        if (o.isMesh && o.material !== this.seaMat) {
          o.castShadow = true
          o.receiveShadow = true
        }
      })
      this.scene.add(g)
    }
  }

  makeDecks() {
    // pier
    const pier = P.pier(L.PIER.z1 - L.PIER.z0, L.PIER.x1 - L.PIER.x0)
    pier.position.set(0, L.PIER.y, L.PIER.z0)
    this.scene.add(pier)
    this.groundMeshes.push(pier)
    // Pip's boat
    const boat = P.boat()
    boat.position.set(5.6, -0.25, 106)
    boat.rotation.y = 0.05
    boat.traverse((o) => {
      if (o.isMesh) o.castShadow = true
    })
    this.scene.add(boat)
    this.boat = boat
    // bridge: an arched wooden deck with rails
    const p = new Parts()
    const B = L.BRIDGE
    const w = B.x1 - B.x0
    const gy = (a, b2) => this.terrainY(a, b2)
    const steps = 22
    for (let i = 0; i < steps; i++) {
      const z = B.z1 - ((i + 0.5) / steps) * (B.z1 - B.z0)
      const y = L.bridgeDeckY(z, gy)
      const zn = B.z1 - ((i + 1.5) / steps) * (B.z1 - B.z0)
      const slope = Math.atan2(L.bridgeDeckY(zn, gy) - y, -(B.z1 - B.z0) / steps)
      p.add(box(w + 0.4, 0.18, ((B.z1 - B.z0) / steps) * 0.92), i % 2 ? '#b98a5e' : '#c99a6a', { x: B.x, y: y - 0.09, z, rx: -slope, jitter: 0.04 })
      if (i % 3 === 0)
        for (const s of [-1, 1]) p.add(box(0.16, 0.9, 0.16), '#8b5a2b', { x: B.x + s * (w / 2 + 0.1), y: y + 0.35, z })
    }
    for (const s of [-1, 1])
      for (let i = 0; i < steps; i++) {
        const z = B.z1 - ((i + 0.5) / steps) * (B.z1 - B.z0)
        p.add(box(0.12, 0.12, ((B.z1 - B.z0) / steps) * 1.02), '#a8693f', { x: B.x + s * (w / 2 + 0.1), y: L.bridgeDeckY(z, gy) + 0.8, z })
      }
    const bridge = p.build({ receive: true })
    this.scene.add(bridge)
    this.groundMeshes.push(bridge)
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
          mesh = P.well()
          e.tapR = 1.8
          e.reach = 2.3
          e.solid = 1.5
          break
        case 'spring':
          mesh = P.spring()
          e.tapR = 1.8
          e.reach = 2.2
          e.solid = 1.3
          break
        case 'fountain':
          mesh = P.fountain()
          e.tapR = 1.7
          e.reach = 2.2
          e.solid = 1.4
          break
        case 'bench':
          mesh = P.bench()
          mesh.rotation.y = o.rot
          e.tapR = 1.4
          e.tapH = 1.4
          e.reach = 1.2
          e.rot = o.rot
          break
        case 'sign': {
          const boards = o.boards.map((k) => {
            const [tx, tz] = targets[k]
            return { text: `${L.PLACES[k].icon} ${L.PLACES[k].name}`, angle: Math.atan2(-(tz - o.z), tx - o.x) }
          })
          mesh = P.signpost(boards)
          e.tapR = 1.3
          e.tapH = 3.4
          e.reach = 2.2
          e.boards = o.boards
          e.solid = 0.5
          break
        }
        case 'appletree':
          e.tapR = 2.2
          e.tapH = 4.5
          e.reach = 2.4
          e.solid = 0.8
          e.fruit = true
          break
        case 'berrybush':
          e.tapR = 1.5
          e.tapH = 1.6
          e.reach = 1.9
          e.solid = 1.0
          e.fruit = true
          break
        case 'carrots':
          e.tapR = 2.4
          e.tapH = 1
          e.reach = 2.6
          e.solid = 2.0
          e.fruit = true
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
    // NPC tap targets (models come with their zone)
    for (const [id, n] of Object.entries(L.NPCS)) {
      const animal = ['bruno', 'hoot', 'momo', 'bun'].includes(id)
      const e = { id, kind: 'npc', x: n.x, z: n.z, zone: n.zone, reach: 2.2, tapR: 1.3, tapH: 2.6 }
      if (id === 'bruno') Object.assign(e, { tapR: 2.2, tapH: 3.2, reach: 3.0 })
      if (id === 'hoot') Object.assign(e, { tapR: 1.3, tapH: 2.0, tapY: L.NPCS.hoot.perch - 0.4, reach: 2.6 })
      if (id === 'momo') Object.assign(e, { tapR: 1.1, tapH: 1.8, reach: 1.8 })
      if (id === 'bun') Object.assign(e, { tapR: 1.1, tapH: 1.4, reach: 1.7 })
      if (id === 'ben') Object.assign(e, { reach: 1.3 })
      if (id === 'granny') Object.assign(e, { reach: 1.5 })
      if (id === 'finn') Object.assign(e, { y: L.PIER.y })
      if (id === 'pip') Object.assign(e, { y: L.PIER.y })
      e.animal = animal
      this.addEntity(e)
    }
    // pickups: shells on the beaches, hidden coins, the owl's glasses
    let k = 0
    for (const deg of [8, 24, 42, 60, 76, 104, 120, 138, 156, 172, 196, 214, 232]) {
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

  // ---------- plants: positions now, meshes when the zone is built ----------

  planDecor() {
    const rand = L.mulberry32(42)
    const taken = new Map()
    const key = (x, z) => `${Math.round(x / 3)},${Math.round(z / 3)}`
    const blockers = [
      ...L.BUILDINGS.map((b) => [b.x, b.z, Math.max(b.w, b.d) / 2 + 3]),
      ...this.entities.map((e) => [e.x, e.z, e.kind === 'npc' ? 3.5 : 2.6]),
      [L.START.x, L.START.z, 4],
      [L.OWL_TREE.x, L.OWL_TREE.z, 4],
    ]
    const free = (x, z, pad) => {
      for (const [bx, bz, r] of blockers) if (Math.hypot(x - bx, z - bz) < r + pad) return false
      return !L.nearRoad(x, z, 1.5 + pad) && !L.inStream(x, z, 2.2 + pad) && !L.inPond(x, z, 2 + pad) && !L.onBridge(x, z) && Math.abs(x - L.BRIDGE.x) + Math.abs(z + 53) > 12
    }
    const add = (type, item) => {
      const zid = this.zoneOf(item.x, item.z)
      const zone = this.zones.find((zz) => zz.id === zid)
      ;(zone.items[type] ||= []).push(item)
    }
    this.solids = []
    const M = L.MOUNTAIN
    // trees
    for (let i = 0; i < 6000; i++) {
      const x = (rand() * 2 - 1) * L.HALF
      const z = (rand() * 2 - 1) * L.HALF
      const t = L.inland(x, z)
      if (t < 3) continue
      const h = this.terrainY(x, z)
      const md = Math.hypot(x - M.x, z - M.z)
      const forest = L.forestness(x, z) > 0.5
      const cape = x > 40 && z < -56
      const village = Math.hypot(x, z) < 34
      const beachy = t < 15 && h < 1.0
      let density = 0.12
      if (forest) density = 0.85
      else if (md < M.r + 4) density = 0.55
      else if (cape) density = 0.12
      else if (village) density = 0.06
      if (Math.hypot(x - L.PLACES.farm.x, z - L.PLACES.farm.z) < 16) density = 0.02
      if (rand() > density) continue
      if (md < M.block && h > 13) continue
      if (!free(x, z, 0.5)) continue
      const kk = key(x, z)
      if (taken.has(kk)) continue
      taken.set(kk, 1)
      let type = 'round'
      if (beachy) type = 'palm'
      else if (forest || md < M.r + 4) type = rand() < 0.55 ? 'pine' : 'round'
      const s = type === 'palm' ? 0.9 + rand() * 0.3 : 0.8 + rand() * 0.5
      add(type, { x, y: h - 0.1, z, s, ry: rand() * 6.28, tint: 0.88 + rand() * 0.2 })
      if (md > M.block) this.solids.push([x, z, 0.75])
    }
    // the owl's big tree
    add('owltree', { x: L.OWL_TREE.x, y: this.terrainY(L.OWL_TREE.x, L.OWL_TREE.z), z: L.OWL_TREE.z })
    this.solids.push([L.OWL_TREE.x, L.OWL_TREE.z, 1.4])
    // bushes, rocks, flowers, grass, mushrooms
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
    scatter(220, 'bush', (x, z, h) => h > 0.9 && rand() < 0.6, (x, h, z) => ({ x, y: h, z, s: 0.7 + rand() * 0.6, ry: rand() * 6, tint: 0.9 + rand() * 0.2 }), 0.8)
    scatter(140, 'rock', (x, z, h) => h > 0.3, (x, h, z) => ({ x, y: h - 0.1, z, s: 0.6 + rand() * 1.2, ry: rand() * 6, tint: 0.9 + rand() * 0.2 }), 0.7)
    for (let c = 0; c < 70; c++) {
      const cx = (rand() * 2 - 1) * L.HALF
      const cz = (rand() * 2 - 1) * L.HALF
      const col = FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)]
      for (let i = 0; i < 12; i++) {
        const x = cx + (rand() * 2 - 1) * 4
        const z = cz + (rand() * 2 - 1) * 4
        if (L.inland(x, z) < 6) continue
        const h = this.terrainY(x, z)
        if (h < 0.95 || Math.hypot(x - M.x, z - M.z) < M.r) continue
        if (L.nearRoad(x, z, 0.4) || L.inStream(x, z, 1.5) || L.inPond(x, z, 1.5)) continue
        add('flower:' + col, { x, y: h, z, s: 0.9 + rand() * 0.5, ry: rand() * 6 })
      }
    }
    scatter(4000, 'grass', (x, z, h) => h > 0.95 && Math.hypot(x - M.x, z - M.z) > M.r - 2, (x, h, z) => ({ x, y: h, z, s: 0.8 + rand() * 0.8, ry: rand() * 6, tint: 0.85 + rand() * 0.3 }))
    scatter(260, 'mushroom', (x, z, h) => z < -24 && x < 40 && h > 0.9, (x, h, z) => ({ x, y: h, z, s: 0.8 + rand() * 0.8, ry: rand() * 6 }))
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rand() * 0.2
      const r = L.POND.r + 0.8 + rand() * 1.2
      const x = L.POND.x + Math.cos(a) * r
      const z = L.POND.z + Math.sin(a) * r
      if (L.nearRoad(x, z, 1)) continue
      add('reeds', { x, y: this.terrainY(x, z), z, s: 0.8 + rand() * 0.5, ry: rand() * 6 })
    }
    // farm fence
    const fence = []
    for (let i = 0; i < 18; i++) {
      const x = -72 + i * 1.6
      if (Math.abs(x - L.PLACES.farm.x) < 2.5) continue
      fence.push({ x, y: this.terrainY(x, 24), z: 24 })
    }
    this.zones.find((z) => z.id === 'farm').items.fence = fence
  }

  makeNav() {
    const nav = new NavGrid(L.HALF, 1)
    nav.build((x, z) => {
      if (Math.abs(x) > L.HALF - 2 || Math.abs(z) > L.HALF - 2) return false
      if (L.onPier(x, z) || L.onBridge(x, z)) return true
      const h = this.terrainY(x, z)
      if (h < 0.18) return false
      if (L.inStream(x, z, 0.7) || L.inPond(x, z, 0.9) || L.inMountain(x, z)) return false
      const gx = this.terrainY(x + 0.5, z) - this.terrainY(x - 0.5, z)
      const gz = this.terrainY(x, z + 0.5) - this.terrainY(x, z - 0.5)
      return Math.hypot(gx, gz) < 0.8
    })
    for (const b of L.BUILDINGS) {
      if (b.round) nav.blockCircle(b.x, b.z, b.w / 2 + 0.4)
      else nav.blockRect(b.x, b.z, b.w, b.d, b.rot, b.kind === 'burger' ? 0.2 : 0.4)
    }
    // the burger hut's outdoor tables
    const bh = L.BUILDINGS.find((b) => b.kind === 'burger')
    for (const dz of [-1.8, 1.8]) nav.blockCircle(bh.x + 6.4, bh.z + dz, 1.0)
    for (const e of this.entities) {
      if (e.solid) nav.blockCircle(e.x, e.z, e.solid)
      if (e.kind === 'bench') nav.blockRect(e.x, e.z, 2.0, 0.7, e.rot, 0.1)
      if (e.kind === 'npc' && e.id !== 'hoot' && e.id !== 'bruno' && e.id !== 'finn' && e.id !== 'pip') nav.blockCircle(e.x, e.z, 0.6)
    }
    for (const [x, z, r] of this.solids) nav.blockCircle(x, z, r)
    nav.blockCircle(8, 84.5, 0.9) // Momo's crate
    // the fishing spot and the captain stay reachable but solid
    nav.blockCircle(L.NPCS.finn.x, L.NPCS.finn.z, 0.5)
    nav.blockCircle(L.NPCS.pip.x, L.NPCS.pip.z, 0.5)
    this.nav = nav
  }

  // Block or open the bridge (Bruno sits on it until he gets honey).
  setBridgeBlocked(blocked) {
    const B = L.BRIDGE
    this.nav.blockRect(B.x, (B.z0 + B.z1) / 2, B.x1 - B.x0 + 1, 6, 0, 0, this.nav.dyn, blocked ? 1 : 0)
  }

  // ---------- ambient life ----------

  makeAmbient() {
    // seagulls over the harbor and beach
    this.gulls = []
    for (let i = 0; i < 5; i++) {
      const g = makeGull()
      g.userData.c = i < 3 ? [0, 92] : [80, 10]
      g.userData.r = 10 + i * 4
      g.userData.h = 11 + i * 1.5
      g.userData.sp = 0.25 + i * 0.05
      g.userData.ph = i * 1.7
      this.scene.add(g)
      this.gulls.push(g)
    }
    this.flies = []
  }

  // ---------- zones ----------

  // Build the next zone that Coji is close to (or any, when idle). Returns true if it built one.
  stream(px, pz, idle) {
    let pick = null
    let pd = Infinity
    for (const z of this.zones) {
      if (z.built) continue
      const d = z.id === 'wild' ? 0 : Math.hypot(px - z.x, pz - z.z) - z.r
      if (z.id === 'wild' && !idle) continue
      if (d < 110 || idle) {
        if (d < pd) {
          pd = d
          pick = z
        }
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
          p.add(box(1.6, 0.1, 0.06), '#f4ede0', { x: it.x + 0.8, y: it.y + 0.75, z: it.z })
          p.add(box(1.6, 0.1, 0.06), '#f4ede0', { x: it.x + 0.8, y: it.y + 0.4, z: it.z })
        }
        group.add(p.build())
        continue
      }
      const small = type === 'grass' || type.startsWith('flower') || type === 'mushroom'
      group.add(instanced(type, items, { shadow: !small, receive: false }))
    }
    // tappable objects with fruit
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
      if (e.kind === 'npc') this.makeNpc(e, group)
    }
    if (zone.id === 'harbor') {
      const crate = new Parts()
      crate.add(box(1.2, 0.9, 1.2), '#c89a5a', { y: 0.45 })
      crate.add(box(1.24, 0.12, 1.24), '#a8783f', { y: 0.75 })
      const cm = crate.build()
      cm.position.set(8, this.terrainY(8, 84.5), 84.5)
      group.add(cm)
    }
    if (zone.id === 'forest') {
      this.ducks = []
      for (let i = 0; i < 3; i++) {
        const d = makeDuck(i === 1)
        d.userData.ph = (i / 3) * Math.PI * 2
        d.userData.r = 3 + i * 1.2
        group.add(d)
        this.ducks.push(d)
      }
    }
    if (zone.id === 'farm' || zone.id === 'village' || zone.id === 'lighthouse') {
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

  owlTree(it) {
    const p = new Parts()
    p.add(cyl(0.6, 0.85, 5.5, 8), '#7a4e27', { y: 2.75 })
    p.add(ico(0.42, 0), '#3a2414', { y: 2.2, z: 0.62, sz: 0.4, sy: 1.3 })
    p.add(cyl(0.18, 0.25, 2.2, 6), '#7a4e27', { y: 4.35, z: 1.1, rx: Math.PI / 2 - 0.15 })
    p.add(ico(2.8, 1), '#4f9f4a', { y: 7.2, sy: 0.85 })
    p.add(ico(1.9, 1), '#5aad52', { x: 1.9, y: 6.4, z: 0.6 })
    p.add(ico(1.9, 1), '#479442', { x: -1.8, y: 6.6, z: -0.6 })
    p.add(ico(1.6, 1), '#5fb456', { x: 0.2, y: 8.6, z: -0.4 })
    const m = p.build()
    m.position.set(it.x, it.y - 0.1, it.z)
    return m
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
    else ch = new Person(LOOKS[e.id])
    let y = e.y
    if (e.id === 'hoot') y = this.terrainY(L.OWL_TREE.x, L.OWL_TREE.z) + n.perch - 0.1
    if (e.id === 'momo') y = this.terrainY(8, 84.5) + 0.9
    if (e.id === 'bruno') y = this.groundY(n.x, n.z)
    let { x, z } = n
    if (e.id === 'hoot') {
      x = L.OWL_TREE.x
      z = L.OWL_TREE.z + 1.5
    }
    if (e.id === 'momo') x = 8
    ch.root.position.set(x, y, e.id === 'momo' ? 84.5 : z)
    ch.root.rotation.y = n.face
    ch.baseY = y
    ch.homeFace = n.face
    ch.id = e.id
    group.add(ch.root)
    e.ch = ch
    this.npcs[e.id] = e
    this.onNpcBuilt?.(e)
  }

  // ---------- per frame ----------

  update(dt, t, focus) {
    this.t = t
    this.seaMat.uniforms.uTime.value = t
    this.freshMat.uniforms.uTime.value = t
    // sun follows Coji so shadows stay sharp nearby
    const snap = 2
    const fx = Math.round(focus.x / snap) * snap
    const fz = Math.round(focus.z / snap) * snap
    this.sun.target.position.set(fx, 0, fz)
    this.sun.position.set(fx + this.sunOffset.x, this.sunOffset.y, fz + this.sunOffset.z)
    this.sun.target.updateMatrixWorld()
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt
      if (c.position.x > 260) c.position.x = -260
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
    if (this.lit) {
      const { beam } = this.lighthouse.userData
      beam.rotation.y += dt * 0.9
    }
    if (this.fw) this.updateFireworks(dt)
  }

  // ---------- day and night ----------

  setNight(k) {
    this.night = k
    const lerpC = (a, b) => a.clone().lerp(b, k)
    this.skyMat.uniforms.top.value.copy(lerpC(DAY.top, NIGHT.top))
    this.skyMat.uniforms.horizon.value.copy(lerpC(DAY.horizon, NIGHT.horizon))
    this.skyMat.uniforms.night.value = k
    this.scene.fog.color.copy(lerpC(DAY.fog, NIGHT.fog))
    this.scene.background.copy(this.scene.fog.color)
    this.sun.color.copy(lerpC(DAY.sun, NIGHT.sun))
    this.sun.intensity = L.lerp(DAY.sunI, NIGHT.sunI, k)
    this.hemi.color.copy(lerpC(DAY.hemiSky, NIGHT.hemiSky))
    this.hemi.groundColor.copy(lerpC(DAY.hemiGround, NIGHT.hemiGround))
    this.hemi.intensity = L.lerp(DAY.hemiI, NIGHT.hemiI, k)
    this.seaMat.uniforms.uNight.value = k
    this.freshMat.uniforms.uNight.value = k
    GLOW.emissiveIntensity = k * 0.9
    this.stars.material.opacity = k
  }

  lightUp() {
    this.lit = true
    const { lamp, beam } = this.lighthouse.userData
    lamp.material.color.set(0xfff6c8)
    lamp.scale.setScalar(1.3)
    beam.visible = true
    if (!this.lampLight) {
      this.lampLight = new THREE.PointLight(0xfff0b0, 30, 60, 1.6)
      this.lampLight.position.copy(lamp.getWorldPosition(new THREE.Vector3()))
      this.scene.add(this.lampLight)
    }
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
    const dot = document.createElement('canvas')
    dot.width = dot.height = 64
    const dctx = dot.getContext('2d')
    const grad = dctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.75)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    dctx.fillStyle = grad
    dctx.fillRect(0, 0, 64, 64)
    const mat = new THREE.PointsMaterial({ size: 1.3, map: new THREE.CanvasTexture(dot), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
    const points = new THREE.Points(g, mat)
    points.frustumCulled = false
    this.scene.add(points)
    this.fw = { points, N, vel: new Float32Array(N * 3), life: new Float32Array(N), next: 0, timer: 0, cursor: 0 }
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
      const f = Math.max(0, fw.life[k] / 1.6)
      col.array[k * 3] *= 0.985
      col.array[k * 3 + 1] *= 0.985
      col.array[k * 3 + 2] *= 0.985
      if (f <= 0) pos.array[k * 3 + 1] = -100
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
    const saved = { p: root.position.clone(), r: root.rotation.y }
    this.portraitScene.add(root)
    root.position.set(0, 0, 0)
    root.rotation.y = 0
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
    parent.add(root)
    root.position.copy(saved.p)
    root.rotation.y = saved.r
    // copy to a canvas (flip vertically, linear → sRGB)
    const cv = document.createElement('canvas')
    cv.width = size
    cv.height = size
    const ctx = cv.getContext('2d')
    const img = ctx.createImageData(size, size)
    const toS = (v) => {
      const c = v / 255
      const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
      return Math.round(Math.min(1, s) * 255)
    }
    const lut = new Uint8Array(256)
    for (let i = 0; i < 256; i++) lut[i] = toS(i)
    const buf = this.portraitBuf
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const s = ((size - 1 - y) * size + x) * 4
        const d = (y * size + x) * 4
        const a = buf[s + 3]
        img.data[d] = lut[buf[s]]
        img.data[d + 1] = lut[buf[s + 1]]
        img.data[d + 2] = lut[buf[s + 2]]
        img.data[d + 3] = a
      }
    ctx.putImageData(img, 0, 0)
    return cv.toDataURL()
  }
}

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
