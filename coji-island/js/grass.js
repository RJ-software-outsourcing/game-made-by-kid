// A meadow of real grass blades around Coji. The island is cut into 16 m tiles; tiles near Coji get
// thousands of little blades (one draw call each), colored like the ground under them, that sway in
// the wind and bend away from Coji's feet. Blades shrink into the ground at the edge of the circle,
// so tiles come and go without popping. Grass casts no shadows (cheap), but it does receive them.
import * as THREE from 'three'
import * as L from './land.js'

const TILE = 16
const R = 24 // radius of the grass circle (it fades over the last 6 m)
const DENS = 9 // blades per square meter on full grass

function grassMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader =
      'attribute vec3 gb;\nuniform float uTime;\nuniform vec3 uFocus;\nuniform vec3 uPlayer;\nuniform float uR;\n' +
      sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float gd = distance(transformed.xz, uFocus.xz);
        float gfade = 1.0 - smoothstep(uR - 6.0, uR, gd);
        float ghk = gb.x;
        transformed.y -= gb.z * ghk * (1.0 - gfade);
        float gw = sin(uTime * 1.9 + gb.y) * 0.6 + sin(uTime * 3.3 + gb.y * 1.9) * 0.25;
        vec2 gbend = vec2(gw * 0.1, gw * 0.055) * ghk * ghk * gfade;
        vec2 gpush = transformed.xz - uPlayer.xz;
        float gpl = length(gpush);
        if (gpl < 0.75) gbend += gpush / max(gpl, 0.001) * (0.75 - gpl) * 0.8 * ghk;
        transformed.xz += gbend;
        transformed.y -= length(gbend) * 0.45 * ghk;`,
      )
    // two-sided blades keep their upward normals on both sides (so they shade like the ground)
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      `float faceDirection = gl_FrontFacing ? 1.0 : -1.0;
      vec3 normal = normalize(vNormal);
      vec3 nonPerturbedNormal = normal;`,
    )
  }
  m.customProgramCacheKey = () => 'grass'
  return m
}

export class GrassField {
  constructor(world) {
    this.world = world
    this.tiles = new Map()
    this.uniforms = {
      uTime: { value: 0 },
      uFocus: { value: new THREE.Vector3() },
      uPlayer: { value: new THREE.Vector3(1e5, 0, 1e5) },
      uR: { value: R },
    }
    this.R = R
    this.mat = grassMaterial(this.uniforms)
    this.group = new THREE.Group()
    world.scene.add(this.group)
    this.bld = L.BUILDINGS.map((b) => ({ x: b.x, z: b.z, hw: b.w / 2 + 0.4, hd: b.d / 2 + 0.4, ca: Math.cos(b.rot || 0), sa: Math.sin(b.rot || 0) }))
  }

  // How grassy the ground is here (0..1).
  density(x, z) {
    const W = this.world
    const n = W.gn
    const fx = (x + L.HALF) / 1.45
    const fz = (z + L.HALF) / 1.45
    const i = Math.floor(fx)
    const j = Math.floor(fz)
    if (i < 0 || j < 0 || i >= n - 1 || j >= n - 1) return 0
    const m = W.terrainMats
    const u = fx - i
    const v = fz - j
    const k = j * n + i
    const wg = (m[k * 3] * (1 - u) + m[(k + 1) * 3] * u) * (1 - v) + (m[(k + n) * 3] * (1 - u) + m[(k + n + 1) * 3] * u) * v
    let d = L.smoothstep(0.5, 0.85, wg)
    if (d <= 0) return 0
    if (W.terrainY(x, z) < 0.4) return 0
    if (Math.hypot(x - L.PLAZA.x, z - L.PLAZA.z) < L.PLAZA.r + 1) return 0
    if (Math.abs(x - L.HARBOR.x) < 7.5 && Math.abs(z - (L.HARBOR.z + 1)) < 5.8) return 0
    if (Math.abs(x - L.CASTLE.x) < L.CASTLE.half + 1.5 && Math.abs(z - L.CASTLE.z) < L.CASTLE.half + 1.5) return 0
    if (L.nearRoad(x, z, 0.35) || L.onPier(x, z) || L.onDrawbridge(x, z) || L.bridgeAt(x, z, 0.5) || L.inMoat(x, z, 0.6) || L.inStream(x, z, 0.8) || L.inPond(x, z, 0.8)) return 0
    for (const b of this.bld) {
      const dx = x - b.x
      const dz = z - b.z
      if (Math.abs(dx * b.ca - dz * b.sa) < b.hw && Math.abs(dx * b.sa + dz * b.ca) < b.hd) return 0
    }
    return d
  }

  colorAt(x, z, out) {
    const W = this.world
    const n = W.gn
    const i = Math.min(n - 2, Math.max(0, Math.round((x + L.HALF) / 1.45)))
    const j = Math.min(n - 2, Math.max(0, Math.round((z + L.HALF) / 1.45)))
    const k = (j * n + i) * 3
    return out.setRGB(W.terrainCol[k], W.terrainCol[k + 1], W.terrainCol[k + 2])
  }

  buildTile(ix, iz) {
    const x0 = ix * TILE
    const z0 = iz * TILE
    let seed = (Math.imul(ix, 73856093) ^ Math.imul(iz, 19349663)) >>> 0 || 1
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    // density on a 2 m grid, so the expensive tests run only 81 times per tile
    const S = 2
    const gn = TILE / S + 1
    const dens = new Float32Array(gn * gn)
    let any = false
    for (let j = 0; j < gn; j++)
      for (let i = 0; i < gn; i++) {
        const d = this.density(x0 + i * S, z0 + j * S)
        dens[j * gn + i] = d
        if (d > 0) any = true
      }
    if (!any) return null
    const pos = []
    const col = []
    const gb = []
    const nor = []
    const idx = []
    const c = new THREE.Color()
    const W = this.world
    let v = 0
    for (let cj = 0; cj < gn - 1; cj++)
      for (let ci = 0; ci < gn - 1; ci++) {
        const d00 = dens[cj * gn + ci]
        const d10 = dens[cj * gn + ci + 1]
        const d01 = dens[(cj + 1) * gn + ci]
        const d11 = dens[(cj + 1) * gn + ci + 1]
        if (d00 + d10 + d01 + d11 <= 0) continue
        const count = Math.round(S * S * DENS)
        for (let b = 0; b < count; b++) {
          const u = rnd()
          const w = rnd()
          const d = (d00 * (1 - u) + d10 * u) * (1 - w) + (d01 * (1 - u) + d11 * u) * w
          if (rnd() > d) continue
          const x = x0 + (ci + u) * S
          const z = z0 + (cj + w) * S
          const y = W.terrainY(x, z) - 0.02
          const h = (0.22 + rnd() * 0.3) * (0.55 + 0.45 * d)
          const a = rnd() * Math.PI * 2
          const lean = 0.05 + rnd() * 0.14
          const la = rnd() * Math.PI * 2
          const lx = Math.cos(la) * lean
          const lz = Math.sin(la) * lean
          const wx = Math.cos(a) * 0.028
          const wz = Math.sin(a) * 0.028
          pos.push(x - wx, y, z - wz, x + wx, y, z + wz, x - wx * 0.7 + lx * 0.35, y + h * 0.5, z - wz * 0.7 + lz * 0.35, x + wx * 0.7 + lx * 0.35, y + h * 0.5, z + wz * 0.7 + lz * 0.35, x + lx, y + h, z + lz)
          this.colorAt(x, z, c)
          const k = 0.86 + rnd() * 0.28
          const dry = rnd() < 0.12 ? 1 : 0
          const base = [c.r * 0.5 * k, c.g * 0.55 * k, c.b * 0.5 * k]
          const mid = [c.r * 0.95 * k, c.g * 0.98 * k, c.b * 0.9 * k]
          const tip = [c.r * (1.25 + dry * 0.35) * k, c.g * (1.18 + dry * 0.1) * k, c.b * (0.95 - dry * 0.2) * k]
          col.push(...base, ...base, ...mid, ...mid, ...tip)
          const ph = rnd() * 6.283 + x * 0.35 + z * 0.27
          gb.push(0, ph, h, 0, ph, h, 0.5, ph, h, 0.5, ph, h, 1, ph, h)
          for (let q = 0; q < 5; q++) nor.push(0, 1, 0)
          idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2, v + 2, v + 3, v + 4)
          v += 5
        }
      }
    if (!v) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setAttribute('gb', new THREE.Float32BufferAttribute(gb, 3))
    g.setIndex(v > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1))
    g.computeBoundingSphere()
    const mesh = new THREE.Mesh(g, this.mat)
    mesh.receiveShadow = true
    mesh.castShadow = false
    return mesh
  }

  // focus: the middle of the grass circle (Coji). buildAll: build every missing tile now.
  update(focus, t, buildAll = false) {
    this.uniforms.uTime.value = t
    this.uniforms.uFocus.value.copy(focus)
    this.uniforms.uPlayer.value.copy(focus)
    if (!this.group.visible) return
    // drop far tiles
    for (const [key, tile] of this.tiles) {
      if (Math.hypot(tile.cx - focus.x, tile.cz - focus.z) > this.R + TILE) {
        if (tile.mesh) {
          this.group.remove(tile.mesh)
          tile.mesh.geometry.dispose()
        }
        this.tiles.delete(key)
      }
    }
    // build the nearest missing tile (one per frame, or all of them)
    const R = this.R
    const i0 = Math.floor((focus.x - R) / TILE)
    const i1 = Math.floor((focus.x + R) / TILE)
    const j0 = Math.floor((focus.z - R) / TILE)
    const j1 = Math.floor((focus.z + R) / TILE)
    let best = null
    let bd = Infinity
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const key = i + ',' + j
        if (this.tiles.has(key)) continue
        const nx = Math.max(i * TILE, Math.min(focus.x, (i + 1) * TILE))
        const nz = Math.max(j * TILE, Math.min(focus.z, (j + 1) * TILE))
        const d = Math.hypot(nx - focus.x, nz - focus.z)
        if (d > R) continue
        if (buildAll) this.addTile(i, j)
        else if (d < bd) {
          bd = d
          best = [i, j]
        }
      }
    if (best) this.addTile(best[0], best[1])
  }

  addTile(i, j) {
    const mesh = this.buildTile(i, j)
    if (mesh) this.group.add(mesh)
    this.tiles.set(i + ',' + j, { mesh, cx: (i + 0.5) * TILE, cz: (j + 0.5) * TILE })
  }

  setVisible(v) {
    this.group.visible = v
  }

  // A smaller grass circle (for slower devices).
  setRadius(r) {
    this.R = r
    this.uniforms.uR.value = r
  }
}
