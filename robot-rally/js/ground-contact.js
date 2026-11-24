import * as T from '../vendor/three.module.js'
import { chassisWheels, tireWidths } from './wheel-motion.js'
import { visitFittedVertices } from './model-outline.js'

const side = 160
const span = 2.12
const textures = new Map()

// Paint the broad underbody occlusion and the darker patches precisely where
// a pair of tires meets the floor. All three views share the same small map.
export function contactTexture(build) {
  const chassis = build.chassis ?? 0,
    motor = build.motor
  const key = chassis * (tireWidths.length + 1) + motor + 1
  if (textures.has(key)) return textures.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = side
  const ctx = canvas.getContext('2d')
  ctx.setTransform(side / span, 0, 0, side / span, side / 2, side / 2)
  const patch = (x, z, width, length, density) => {
    ctx.save()
    ctx.translate(x, z)
    ctx.scale(width, length)
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
    grad.addColorStop(0, 'rgba(18,24,23,' + density + ')')
    grad.addColorStop(0.48, 'rgba(18,24,23,' + density * 0.67 + ')')
    grad.addColorStop(1, 'rgba(18,24,23,0)')
    ctx.fillStyle = grad
    ctx.fillRect(-1, -1, 2, 2)
    ctx.restore()
  }
  const { axle, rear, wheelScale } = chassisWheels[chassis]
  patch(0, 0, chassis === 2 ? 0.86 : 0.77, chassis === 1 ? 0.98 : 0.72, 0.43)
  const rubber = (tireWidths[motor] ?? 0.105) * wheelScale
  for (const x of [-axle[0], axle[0]]) {
    for (const z of rear === undefined ? [axle[1]] : [axle[1], rear]) {
      patch(x, z, rubber * 1.4, 0.25 * wheelScale, 0.34)
      patch(x, z, rubber * 0.78, 0.105 * wheelScale, 0.77)
    }
  }
  const texture = new T.CanvasTexture(canvas)
  textures.set(key, texture)
  return texture
}
export function groundContact() {
  const mesh = new T.Mesh(
    new T.PlaneGeometry(span, span),
    new T.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      toneMapped: false
    })
  )
  mesh.rotation.order = 'YXZ'
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.009
  mesh.renderOrder = 1
  return mesh
}

// At the bell the same underbody shadow would leave tire marks under a bot
// resting on its shoulder. Stamp the lowest fitted metal in its landed pose.
// One small texture serves every knockdown for the lifetime of the arena.
export function landedContact(robot, angle, rise, reuse) {
  const size = 96,
    cells = 24
  const lows = new Float32Array(cells * cells).fill(Infinity)
  const sin = Math.sin(angle),
    cos = Math.cos(angle)
  visitFittedVertices(robot, ({ x, y, z }) => {
    const h = y * cos + z * sin + rise
    if (h > 0.7) return
    const col = Math.floor(cells * (x / span + 0.5))
    const row = Math.floor(cells * ((z * cos - y * sin) / span + 0.5))
    if (col < 0 || col >= cells || row < 0 || row >= cells) return
    const i = row * cells + col
    lows[i] = Math.min(lows[i], Math.max(0, h))
  })
  const canvas = reuse?.image || document.createElement('canvas')
  if (!reuse) canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(size, size),
    data = image.data
  for (let i = 0; i < lows.length; i++) {
    const h = lows[i]
    if (!Number.isFinite(h)) continue
    const cx = (((i % cells) + 0.5) * size) / cells,
      cy = ((Math.floor(i / cells) + 0.5) * size) / cells
    const radius = 4.2 + h * 18,
      radius2 = radius * radius
    const darkness = 202 / (1 + h * 8)
    for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(size - 1, Math.ceil(cy + radius)); y++) {
      for (
        let x = Math.max(0, Math.floor(cx - radius));
        x <= Math.min(size - 1, Math.ceil(cx + radius));
        x++
      ) {
        const d = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) / radius2
        if (d >= 1) continue
        const k = 4 * (y * size + x)
        data[k] = 18
        data[k + 1] = 24
        data[k + 2] = 23
        data[k + 3] = Math.max(data[k + 3], darkness * (1 - d) ** 2)
      }
    }
  }
  ctx.putImageData(image, 0, 0)
  const map = reuse || new T.CanvasTexture(canvas)
  map.needsUpdate = true
  return map
}
