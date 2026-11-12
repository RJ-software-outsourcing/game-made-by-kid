// Low-poly builder: colored primitives are merged into one mesh with vertex colors, so a whole
// house or a character's arm is a single draw call with one shared material.
import * as THREE from 'three'

export const MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
export const MAT2 = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide })
// Windows and lamps: they glow at night (emissive is turned up by the day/night code).
export const GLOW = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0xffd27a, emissiveIntensity: 0 })

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
  constructor() {
    this.groups = new Map()
  }

  // Add a primitive. o: {x,y,z, rx,ry,rz, sx,sy,sz, s (uniform scale), jitter, mat}
  add(geo, hex, o = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0)
    _q.setFromEuler(_e)
    const s = o.s ?? 1
    _s.set((o.sx ?? 1) * s, (o.sy ?? 1) * s, (o.sz ?? 1) * s)
    _p.set(o.x || 0, o.y || 0, o.z || 0)
    _m.compose(_p, _q, _s)
    if (o.matrix) _m.premultiply(o.matrix)
    g.applyMatrix4(_m)
    this.push(g, hex, o.jitter ?? 0.05, o.mat || MAT)
    return this
  }

  // Add an already-positioned geometry.
  push(g, hex, jitter = 0.05, mat = MAT) {
    if (g.index) g = g.toNonIndexed()
    let grp = this.groups.get(mat)
    if (!grp) {
      grp = { pos: [], nor: [], col: [] }
      this.groups.set(mat, grp)
    }
    const pos = g.attributes.position.array
    const nor = g.attributes.normal ? g.attributes.normal.array : null
    _c.set(hex)
    const tris = pos.length / 9
    for (let t = 0; t < tris; t++) {
      const k = jitter ? 1 + (Math.random() * 2 - 1) * jitter : 1
      for (let v = 0; v < 3; v++) {
        const i = t * 9 + v * 3
        grp.pos.push(pos[i], pos[i + 1], pos[i + 2])
        if (nor) grp.nor.push(nor[i], nor[i + 1], nor[i + 2])
        else grp.nor.push(0, 1, 0)
        grp.col.push(_c.r * k, _c.g * k, _c.b * k)
      }
    }
  }

  geometry(mat = MAT) {
    const grp = this.groups.get(mat)
    if (!grp) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(grp.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(grp.nor, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(grp.col, 3))
    g.computeBoundingSphere()
    return g
  }

  // Build a mesh (or a group when several materials were used).
  build({ shadow = true, receive = false } = {}) {
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
