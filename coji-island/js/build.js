// Builder: colored primitives are merged into one mesh with vertex colors, so a whole house or a
// character's arm is a single draw call with one shared material.
//
// The look (v0.4): every shared material is physically based (MeshStandardMaterial), lit by the sun,
// the sky (an environment map made from the sky) and soft shadows. Each part can set its own
// roughness and metalness (glass, metal, varnish) through a `pbr` vertex attribute, so that costs no
// extra draw call. "Flat" parts get one normal per triangle baked in, so flat and smooth parts share
// one material (and one draw call) too.
import * as THREE from 'three'

const std = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, ...o })

// Smooth shading for round things (characters, tree tops, pots).
export const SMOOTH = std()
export const SMOOTH2 = std({ side: THREE.DoubleSide })
// Crisp facets (walls, rocks, planks). Parts bakes the facet normals and draws them with SMOOTH.
export const MAT = std()
export const MAT2 = std({ side: THREE.DoubleSide })
// Windows and lamps: they glow at night (emissive is turned up by the day/night code).
export const GLOW = std({ emissive: 0xffd27a, emissiveIntensity: 0, roughness: 0.3 })
// Always glowing (jack-o'-lanterns, magic).
export const SHINE = new THREE.MeshBasicMaterial({ vertexColors: true })
// Ground and decks: never see-through.
export const TERRAIN_MAT = std({ roughness: 0.95 })
export const DECK_MAT = std({ roughness: 0.78 })

// Which material a part really lands in, and whether it gets flat (facet) normals by default.
const CANON = new Map([
  [MAT, SMOOTH],
  [MAT2, SMOOTH2],
])
const FLAT_BY_DEFAULT = new Set([MAT, MAT2, GLOW, DECK_MAT])

// See-through: things between the camera and Coji fade to a soft dotted window around him,
// so trees, walls and roofs never hide him. The game updates these uniforms every frame.
export const SEE = {
  uSeePos: { value: new THREE.Vector2() },
  uSeeDepth: { value: 0 },
  uSeeR: { value: 0 },
  uSeeOn: { value: 0 },
}

// Per-part roughness/metalness. x = 0 means "use the material's own roughness".
export function pbrPatch(sh) {
  sh.vertexShader = 'attribute vec2 pbr;\nvarying vec2 vPbr;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vPbr = pbr;')
  sh.fragmentShader = 'varying vec2 vPbr;\n' + sh.fragmentShader
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  if (vPbr.x > 0.0) roughnessFactor = vPbr.x;')
    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = max(metalnessFactor, vPbr.y);')
}
export function seePatch(sh) {
  Object.assign(sh.uniforms, SEE)
  sh.fragmentShader = sh.fragmentShader
    .replace(
      'void main() {',
      `uniform vec2 uSeePos; uniform float uSeeDepth; uniform float uSeeR; uniform float uSeeOn;
      float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
      float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
      void main() {`,
    )
    .replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
      if (uSeeOn > 0.5 && vViewPosition.z < uSeeDepth - 1.3) {
        float f = distance(gl_FragCoord.xy, uSeePos) / uSeeR;
        if (f < 1.0 && bayer4(gl_FragCoord.xy) < (1.0 - f * f) * 0.7) discard;
      }`,
    )
}
function prepare(mat, { see = true } = {}) {
  // a mesh without the attribute reads (0, 0): the material's own roughness, not metal
  mat.defaultAttributeValues = { ...mat.defaultAttributeValues, pbr: [0, 0] }
  mat.onBeforeCompile = (sh) => {
    pbrPatch(sh)
    if (see) seePatch(sh)
  }
  mat.customProgramCacheKey = () => (see ? 'coji-see' : 'coji')
}
for (const m of [MAT, MAT2, SMOOTH, SMOOTH2, GLOW]) prepare(m)
prepare(DECK_MAT, { see: false })

// Small smooth 3D value noise (0..1), used to vary colors gently across a surface.
function hash3(x, y, z) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}
export function noise3(x, y, z) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const fx = x - xi
  const fy = y - yi
  const fz = z - zi
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const w = fz * fz * (3 - 2 * fz)
  const l = (a, b, t) => a + (b - a) * t
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz)
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w)
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _s = new THREE.Vector3()
const _p = new THREE.Vector3()
const _c = new THREE.Color()

// Shared primitive geometries (cloned when used).
const cache = new Map()
function cached(key, make) {
  let g = cache.get(key)
  if (!g) {
    g = make()
    cache.set(key, g)
  }
  return g
}
export const box = (w = 1, h = 1, d = 1) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d))
export const cyl = (rt, rb, h, seg = 8, open = false) =>
  cached(`c${rt},${rb},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open))
export const cone = (r, h, seg = 8) => cached(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg))
export const ico = (r, detail = 1) => cached(`i${r},${detail}`, () => new THREE.IcosahedronGeometry(r, detail))
export const sphere = (r, ws = 10, hs = 8, t0 = 0, tl = Math.PI, p0 = 0, pl = Math.PI * 2) =>
  cached(`s${r},${ws},${hs},${t0},${tl},${p0},${pl}`, () => new THREE.SphereGeometry(r, ws, hs, p0, pl, t0, tl))
export const torus = (r, tube, rs = 5, ts = 10, arc = Math.PI * 2) =>
  cached(`t${r},${tube},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(r, tube, rs, ts, arc))
export const plane = (w, h) => cached(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h))

export const color = (hex) => new THREE.Color(hex)

export class Parts {
  constructor(mat = MAT) {
    this.groups = new Map()
    this.mat = mat
  }

  // Add a primitive. o: {x,y,z, rx,ry,rz, sx,sy,sz, s (uniform scale), jitter, mat,
  //   flat (facet normals; default for MAT/GLOW), rough (0..1), metal (0..1)}
  add(geo, hex, o = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ')
    _q.setFromEuler(_e)
    const s = o.s ?? 1
    _s.set((o.sx ?? 1) * s, (o.sy ?? 1) * s, (o.sz ?? 1) * s)
    _p.set(o.x || 0, o.y || 0, o.z || 0)
    _m.compose(_p, _q, _s)
    if (o.matrix) _m.premultiply(o.matrix)
    g.applyMatrix4(_m)
    this.push(g, hex, o.jitter ?? 0.05, o.mat || this.mat, o)
    return this
  }

  // Add an already-positioned geometry.
  push(g, hex, jitter = 0.05, mat = this.mat, o = {}) {
    if (g.index) g = g.toNonIndexed()
    const flat = o.flat ?? FLAT_BY_DEFAULT.has(mat)
    mat = CANON.get(mat) || mat
    let grp = this.groups.get(mat)
    if (!grp) {
      grp = { pos: [], nor: [], col: [], pbr: [] }
      this.groups.set(mat, grp)
    }
    const pos = g.attributes.position.array
    const nor = g.attributes.normal ? g.attributes.normal.array : null
    _c.set(hex)
    const rough = o.rough ?? 0
    const metal = o.metal ?? 0
    const tris = pos.length / 9
    for (let t = 0; t < tris; t++) {
      const i0 = t * 9
      let fx = 0
      let fy = 1
      let fz = 0
      if (flat || !nor) {
        // the triangle's own normal, turned to agree with the geometry's normals
        const ax = pos[i0 + 3] - pos[i0]
        const ay = pos[i0 + 4] - pos[i0 + 1]
        const az = pos[i0 + 5] - pos[i0 + 2]
        const bx = pos[i0 + 6] - pos[i0]
        const by = pos[i0 + 7] - pos[i0 + 1]
        const bz = pos[i0 + 8] - pos[i0 + 2]
        fx = ay * bz - az * by
        fy = az * bx - ax * bz
        fz = ax * by - ay * bx
        const l = Math.hypot(fx, fy, fz) || 1
        fx /= l
        fy /= l
        fz /= l
        if (nor && fx * (nor[i0] + nor[i0 + 3] + nor[i0 + 6]) + fy * (nor[i0 + 1] + nor[i0 + 4] + nor[i0 + 7]) + fz * (nor[i0 + 2] + nor[i0 + 5] + nor[i0 + 8]) < 0) {
          fx = -fx
          fy = -fy
          fz = -fz
        }
      }
      for (let v = 0; v < 3; v++) {
        const i = i0 + v * 3
        const x = pos[i]
        const y = pos[i + 1]
        const z = pos[i + 2]
        grp.pos.push(x, y, z)
        if (flat || !nor) grp.nor.push(fx, fy, fz)
        else grp.nor.push(nor[i], nor[i + 1], nor[i + 2])
        // gentle color variation that flows across the surface (no confetti triangles)
        const k = jitter ? 1 + (noise3(x * 1.7, y * 1.7, z * 1.7) * 0.65 + noise3(x * 5.3 + 7, y * 5.3, z * 5.3) * 0.35 - 0.5) * jitter * 2.4 : 1
        grp.col.push(_c.r * k, _c.g * k, _c.b * k)
        grp.pbr.push(rough, metal)
      }
    }
  }

  // Darken the bottom of the object: less sky reaches the parts close to the ground.
  // h: how high the shading reaches; k: how dark it gets right at the bottom.
  aoBottom(h = 1, k = 0.4, minY = null) {
    if (minY == null) {
      minY = Infinity
      for (const grp of this.groups.values()) for (let i = 1; i < grp.pos.length; i += 3) minY = Math.min(minY, grp.pos[i])
    }
    for (const grp of this.groups.values())
      for (let i = 1; i < grp.pos.length; i += 3) {
        const t = Math.min(1, Math.max(0, (grp.pos[i] - minY) / h))
        const f = 1 - k * (1 - t * t * (3 - 2 * t))
        grp.col[i - 1] *= f
        grp.col[i] *= f
        grp.col[i + 1] *= f
      }
    return this
  }

  geometry(mat = MAT) {
    const grp = this.groups.get(CANON.get(mat) || mat)
    if (!grp) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(grp.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(grp.nor, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(grp.col, 3))
    g.setAttribute('pbr', new THREE.Float32BufferAttribute(grp.pbr, 2))
    g.computeBoundingSphere()
    return g
  }

  // Build a mesh (or a group when several materials were used).
  build({ shadow = true, receive = true } = {}) {
    const meshes = []
    for (const mat of this.groups.keys()) {
      const m = new THREE.Mesh(this.geometry(mat), mat)
      m.castShadow = shadow
      m.receiveShadow = receive
      meshes.push(m)
    }
    if (meshes.length === 1) return meshes[0]
    const grp = new THREE.Group()
    for (const m of meshes) grp.add(m)
    return grp
  }
}

// Paint text on a canvas (for signposts and labels).
export function textCanvas(text, { w = 256, h = 64, font = 'bold 34px Andika, sans-serif', fg = '#4a2f17', bg = null, pad = 0 } = {}) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')
  if (bg) {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
  }
  ctx.font = font
  ctx.fillStyle = fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2 + pad, h / 2 + 2, w - 12)
  return cv
}

// A camera-facing label (name tags, "!" markers).
export function makeSprite(drawFn, w, h, worldH) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  drawFn(cv.getContext('2d'), w, h)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 2
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false })
  const sp = new THREE.Sprite(mat)
  sp.scale.set((worldH * w) / h, worldH, 1)
  sp.renderOrder = 10
  return sp
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
