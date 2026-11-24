import * as THREE from '../vendor/three.module.js'
import { bakeSurfaces, acquireSurfaceMaterial, releaseSurfaceMaterial } from './surface-batch.js'

const TAU = Math.PI * 2

function canvas2D(size) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  return canvas.getContext('2d')
}

function seededRandom() {
  let seed = 5783
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

function canvasMap(context) {
  const texture = new THREE.CanvasTexture(context.canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

// Bake court paint, etched markings, and the fine grain in one texture.
// These remain anchored to the floor as the camera orbits.
function deckMap(arena) {
  const size = arena ? 1024 : 768
  const ctx = canvas2D(size)
  const tile = canvas2D(96)
  const grain = tile.createImageData(96, 96)
  const random = seededRandom()
  for (let i = 0; i < grain.data.length; i += 4) {
    const value = Math.floor(220 * random())
    grain.data[i] = grain.data[i + 1] = grain.data[i + 2] = value
    grain.data[i + 3] = 255
  }
  tile.putImageData(grain, 0, 0)
  ctx.fillStyle = arena ? '#464e53' : '#646d71'
  ctx.fillRect(0, 0, size, size)
  ctx.globalAlpha = arena ? 0.079 : 0.091
  ctx.fillStyle = ctx.createPattern(tile.canvas, 'repeat')
  ctx.fillRect(0, 0, size, size)
  ctx.globalAlpha = 1
  ctx.translate(size / 2, size / 2)
  ctx.scale(size / 2, size / 2)

  const arc = (x, y, r, start, end, color, width) => {
    ctx.beginPath()
    ctx.arc(x, y, r, start, end)
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.stroke()
  }
  const circle = (radius, color, width) => arc(0, 0, radius, 0, TAU, color, width)
  const segment = (x1, y1, x2, y2, color, width) => {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.stroke()
  }
  const tick = (angle, inner, outer, color, width) => {
    const x = Math.cos(angle),
      y = Math.sin(angle)
    segment(x * inner, y * inner, x * outer, y * outer, color, width)
  }

  // A shallow groove has a dark wall and a slim reflected edge.
  const groove = (radius) => {
    circle(radius, 'rgba(48,58,49,0.28)', 0.0033)
    circle(radius - 0.0038, 'rgba(255,255,244,0.64)', 0.0026)
  }
  if (arena) {
    const teal = '#52998e',
      orange = '#c47b46',
      white = '#a4aaa7'
    const polygon = (vertices, color) => {
      ctx.beginPath()
      vertices.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
    }
    // The ring is assembled from bolted steel sheets. Stagger the joints so
    // a wheel never crosses four corners at once. The camera reads the bevel
    // and captive fastener even on the cheaper diffuse-only deck material.
    ctx.save()
    ctx.beginPath()
    ctx.arc(0, 0, .868, 0, TAU)
    ctx.clip()
    for (let course = 0; course < 5; course++) {
      const top = -.974 + course * .395
      for (let column = -2; column < 3; column++) {
        const left = column * .674 + (course % 2 ? -.237 : .129)
        const w = .674, h = .395
        ctx.fillStyle = (course + column) % 2 ? 'rgba(161,171,180,.037)' : 'rgba(8,13,20,.078)'
        ctx.fillRect(left, top, w, h)
        segment(left, top, left + w, top, '#293239', .0042)
        segment(left, top, left, top + h, '#293239', .0042)
        segment(left + .004, top + .004, left + w, top + .004, '#63696a', .0016)
        segment(left + .004, top + .004, left + .004, top + h, '#60686a', .0016)
        for (const x of [left + .018, left + w - .018]) for (const y of [top + .017, top + h - .017]) {
          ctx.beginPath()
          ctx.arc(x, y, .0043, 0, TAU)
          ctx.fillStyle = '#31393b'
          ctx.fill()
          arc(x, y, .0044, .17, 2.54, '#737b79', .0017)
        }
      }
    }
    ctx.restore()
    const field = ctx.createRadialGradient(-.20, -.28, .04, 0, 0, .91)
    field.addColorStop(0, 'rgba(176,169,138,.12)')
    field.addColorStop(.55, 'rgba(129,136,134,.02)')
    field.addColorStop(1, 'rgba(8,16,23,.24)')
    ctx.fillStyle = field
    ctx.fillRect(-1, -1, 2, 2)
    // Two fixed banks throw long, feathered pools over the ring. The base
    // illumination is baked, while the contestants still cast live shadows.
    for (const [x, y, angle, tint] of [[-.24,-.16,-.64,'rgba(204,179,140,.14)'], [.28,.13,-.68,'rgba(153,176,198,.10)']]) {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.scale(.29, .65)
      const pool = ctx.createRadialGradient(0, 0, .04, 0, 0, 1)
      pool.addColorStop(0, tint)
      pool.addColorStop(1, 'rgba(123,136,140,0)')
      ctx.fillStyle = pool
      ctx.fillRect(-1, -1, 2, 2)
      ctx.restore()
    }
    circle(0.923, '#354449', 0.116)
    circle(0.873, white, 0.011)
    circle(0.861, '#838e7c', 0.003)
    groove(0.964)
    for (let i = 0; i < 16; i++) {
      const a = (TAU * i) / 16
      tick(a, 0.705, 0.869, 'rgba(45,61,54,.25)', 0.0041)
      tick(a + 0.004, 0.707, 0.867, 'rgba(238,238,208,.57)', 0.0021)
      tick(a, 0.896, 0.947, '#82877d', 0.0043)
    }
    for (const side of [-1, 1]) {
      const ink = side < 0 ? teal : orange
      const start = side < 0 ? Math.PI * 0.67 : -Math.PI * 0.33
      arc(0, 0, 0.894, start, start + Math.PI * 0.66, ink, 0.033)
      // Each launch dock is stencilled on the level playing surface. Its
      // steel corner retainers and recessed tread strips are modelled below.
      ctx.save()
      ctx.scale(side, 1)
      polygon(
        [
          [0.462, -0.149],
          [0.505, -0.186],
          [0.711, -0.186],
          [0.748, -0.144],
          [0.748, 0.144],
          [0.711, 0.186],
          [0.505, 0.186],
          [0.462, 0.149]
        ],
        'rgba(62,77,68,.18)'
      )
      polygon(
        [
          [0.455, -0.154],
          [0.5, -0.197],
          [0.721, -0.197],
          [0.747, -0.171],
          [0.513, -0.171],
          [0.478, -0.139]
        ],
        ink
      )
      polygon(
        [
          [0.455, 0.154],
          [0.5, 0.197],
          [0.721, 0.197],
          [0.747, 0.171],
          [0.513, 0.171],
          [0.478, 0.139]
        ],
        ink
      )
      segment(0.593, -0.113, 0.593, 0.113, 'rgba(250,246,214,.63)', 0.005)
      for (let j = 0; j < 3; j++) {
        const x = 0.32 + j * 0.043
        polygon(
          [
            [x + 0.036, -0.056],
            [x, -0.003],
            [x + 0.036, 0.056],
            [x + 0.022, 0.056],
            [x - 0.016, -0.003],
            [x + 0.022, -0.056]
          ],
          ink
        )
      }
      ctx.restore()
    }
    // Opposing chevrons and the faceted bolt head form the cup's field mark.
    // Paint remains muted beneath the robots and the score depends on no text.
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = ((i + 0.5) * TAU) / 6
      if (!i) ctx.moveTo(0.201 * Math.cos(a), 0.201 * Math.sin(a))
      else ctx.lineTo(0.201 * Math.cos(a), 0.201 * Math.sin(a))
    }
    ctx.closePath()
    ctx.strokeStyle = 'rgba(84,103,91,.57)'
    ctx.lineWidth = 0.012
    ctx.stroke()
    polygon(
      [
        [-0.133, 0.002],
        [-0.075, -0.101],
        [0.006, -0.101],
        [-0.046, -0.016],
        [-0.098, 0.069]
      ],
      '#719186'
    )
    polygon(
      [
        [0.133, -0.002],
        [0.075, 0.101],
        [-0.006, 0.101],
        [0.046, 0.016],
        [0.098, -0.069]
      ],
      '#a38d71'
    )
    polygon(
      [
        [0.035, -0.128],
        [-0.063, 0.015],
        [-0.005, 0.008],
        [-0.036, 0.129],
        [0.07, -0.024],
        [0.012, -0.017]
      ],
      '#60766c'
    )
    ctx.setLineDash([0.028, 0.025])
    segment(0, -0.844, 0, -0.23, 'rgba(69,88,80,.45)', 0.0045)
    segment(0, 0.23, 0, 0.844, 'rgba(69,88,80,.45)', 0.0045)
    ctx.setLineDash([])
    // The well-worn middle has paired rubber arcs where a wheel locked up.
    // Individual scratches cut through the court paint, catching a fine edge.
    ctx.lineCap = 'round'
    for (let i = 0; i < 19; i++) {
      const theta = random() * TAU,
        r = Math.sqrt(random()) * 0.64
      const x = Math.cos(theta) * r,
        y = Math.sin(theta) * r,
        curve = 0.07 + random() * 0.21
      const start = random() * TAU,
        length = 0.22 + random() * 0.55
      for (const track of [0, 0.06]) {
        for (let j = 0; j < 3; j++)
          arc(
            x,
            y,
            curve + track + j * 0.0035,
            start + j * 0.045,
            start + length - j * 0.025,
            'rgba(8,13,17,' + (0.13 + random() * 0.17) + ')',
            0.002 + random() * 0.006
          )
      }
    }
    for (let i = 0; i < 36; i++) {
      const theta = random() * TAU,
        r = 0.23 + random() * 0.65
      const x = Math.cos(theta) * r,
        y = Math.sin(theta) * r,
        dir = random() * TAU,
        l = 0.015 + random() * 0.075
      const endX = x + Math.cos(dir) * l,
        endY = y + Math.sin(dir) * l
      segment(x, y, endX, endY, 'rgba(62,73,63,.25)', 0.0018)
      segment(x, y + 0.0019, endX, endY + 0.0019, 'rgba(185,193,187,.41)', 0.0012)
    }
    ctx.lineCap = 'butt'
  } else {
    millTableFinish(ctx, random, { segment, circle, arc, tick })
  }
  // The last few millimetres of the top are rolled down into the bezel.
  const shade = ctx.createRadialGradient(0, 0, 0.951, 0, 0, 1)
  shade.addColorStop(0, 'rgba(69,73,58,0)')
  shade.addColorStop(0.72, 'rgba(69,73,58,0.085)')
  shade.addColorStop(1, 'rgba(69,73,58,0.22)')
  ctx.fillStyle = shade
  ctx.fillRect(-1, -1, 2, 2)
  return canvasMap(ctx)
}

// Rotary milling table photographed under the workshop lights. The oil and
// interrupted cutter marks are baked once; the polished metal reflects live.
function millTableFinish(ctx, random, { segment, circle, arc, tick }) {
  const sheen = ctx.createLinearGradient(-0.81, -0.58, 0.69, 0.85)
  sheen.addColorStop(0, 'rgba(25,35,40,.25)')
  sheen.addColorStop(0.36, 'rgba(173,181,181,.14)')
  sheen.addColorStop(0.64, 'rgba(76,87,89,.03)')
  sheen.addColorStop(1, 'rgba(28,33,35,.23)')
  ctx.fillStyle = sheen
  ctx.fillRect(-1, -1, 2, 2)

  // Wiping a part on the front edge leaves a thin crescent of oil. Most of
  // the flat wheel contact area stays clean enough to see the tire silhouette.
  for (const [x, y, rotation, extent] of [
    [-0.53, 0.38, -0.55, 0.28],
    [0.48, -0.49, 0.36, 0.2],
    [0.67, 0.18, -0.98, 0.13]
  ]) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rotation)
    ctx.scale(extent, extent * 0.47)
    const film = ctx.createRadialGradient(-0.08, -0.08, 0.15, 0, 0, 1)
    film.addColorStop(0, 'rgba(37,33,26,.05)')
    film.addColorStop(0.65, 'rgba(35,33,28,.24)')
    film.addColorStop(0.81, 'rgba(58,48,33,.17)')
    film.addColorStop(1, 'rgba(47,45,39,0)')
    ctx.fillStyle = film
    ctx.fillRect(-1, -1, 2, 2)
    ctx.restore()
  }
  for (let i = 0; i < 151; i++) {
    const r = 0.045 + i * 0.006,
      a = random() * TAU
    arc(
      0,
      0,
      r,
      a,
      a + 0.68 + random() * 3.63,
      i % 3 ? 'rgba(195,202,197,.19)' : 'rgba(26,37,42,.35)',
      0.0018
    )
  }
  for (let i = 0; i < 53; i++) {
    const theta = random() * TAU,
      r = Math.sqrt(random()) * 0.84,
      x = Math.cos(theta) * r,
      y = Math.sin(theta) * r
    const a = random() * TAU,
      length = 0.019 + random() * 0.14,
      endX = x + Math.cos(a) * length,
      endY = y + Math.sin(a) * length
    segment(x, y, endX, endY, 'rgba(30,39,42,.32)', 0.0021)
    segment(x, y + 0.0025, endX, endY + 0.0025, 'rgba(195,202,193,.43)', 0.0016)
  }
  const bore = (x, y) => {
    const shank = ctx.createLinearGradient(x - 0.021, y - 0.025, x + 0.021, y + 0.025)
    shank.addColorStop(0, '#293438')
    shank.addColorStop(0.47, '#4e575a')
    shank.addColorStop(0.85, '#b1b6b1')
    shank.addColorStop(1, '#777e7e')
    ctx.beginPath()
    ctx.arc(x, y, 0.024, 0, TAU)
    ctx.fillStyle = shank
    ctx.fill()
    arc(x, y, 0.025, 0.85, 3.7, '#485050', 0.0028)
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6 + 0.19,
        px = x + 0.0124 * Math.cos(a),
        py = y + 0.0124 * Math.sin(a)
      if (i) ctx.lineTo(px, py)
      else ctx.moveTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = '#252e31'
    ctx.fill()
  }
  for (let i = 0; i < 6; i++) {
    const a = (i * TAU) / 6 + 0.22
    ctx.save()
    ctx.rotate(a)
    // The stepped mouth, deep slot and bright lower bevel read at grazing angles.
    ctx.lineCap = 'round'
    segment(0.229, 0, 0.791, 0, '#808888', 0.026)
    segment(0.229, -0.003, 0.791, -0.003, '#313b40', 0.02)
    segment(0.231, -0.001, 0.789, -0.001, '#232c30', 0.009)
    ctx.restore()
    for (const da of [-0.115, 0.115]) bore(0.742 * Math.cos(a + da), 0.742 * Math.sin(a + da))
  }
  circle(0.819, '#4d575b', 0.006)
  circle(0.824, 'rgba(185,194,194,.56)', 0.0026)
  circle(0.928, '#3e484c', 0.007)
  circle(0.935, '#8d9694', 0.003)
  for (let i = 0; i < 120; i++) {
    const major = i % 10 === 0,
      mid = i % 5 === 0
    tick(
      (i * TAU) / 120,
      major ? 0.847 : mid ? 0.864 : 0.882,
      0.907,
      major ? '#353e40' : '#50595b',
      major ? 0.0056 : 0.0031
    )
  }
  // A single ochre datum on the gauge ring matches the indicator on the cast iron base.
  arc(0, 0, 0.93, 0.072, 0.179, '#b37434', 0.012)
}

function contactMap() {
  const ctx = canvas2D(96)
  const shade = ctx.createRadialGradient(48, 48, 22, 48, 48, 48)
  shade.addColorStop(0, 'rgba(21,33,32,0.46)')
  shade.addColorStop(0.7, 'rgba(21,33,32,0.35)')
  shade.addColorStop(0.83, 'rgba(21,33,32,0.20)')
  shade.addColorStop(1, 'rgba(21,33,32,0)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, 96, 96)
  return canvasMap(ctx)
}

// A segment follows the circular rim. Flat end caps and sloping faces keep
// each replaceable bumper visibly separate at both high and low camera angles.
function bumperSection(profile, width, steps = 5) {
  const pos = [],
    normals = [],
    indices = []
  const point = (r, y, angle) => [r * Math.sin(angle), y, r * Math.cos(angle)]
  for (let edge = 0; edge < profile.length; edge++) {
    const a = profile[edge],
      b = profile[(edge + 1) % profile.length]
    const dr = b[0] - a[0],
      dy = b[1] - a[1],
      length = Math.hypot(dr, dy)
    const first = pos.length / 3
    for (let j = 0; j <= steps; j++) {
      const angle = width * (j / steps - 0.5)
      for (const [r, y] of [a, b]) {
        pos.push(...point(r, y, angle))
        normals.push((dy * Math.sin(angle)) / length, -dr / length, (dy * Math.cos(angle)) / length)
      }
      if (j < steps) {
        const n = first + j * 2
        indices.push(n, n + 2, n + 3, n, n + 3, n + 1)
      }
    }
  }
  for (const sign of [-1, 1]) {
    const angle = sign * width * 0.5,
      first = pos.length / 3
    for (const [r, y] of profile) {
      pos.push(...point(r, y, angle))
      normals.push(sign * Math.cos(angle), 0, -sign * Math.sin(angle))
    }
    for (let i = 1; i < profile.length - 1; i++) {
      if (sign > 0) indices.push(first, first + i + 1, first + i)
      else indices.push(first, first + i, first + i + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  g.setIndex(indices)
  return g
}

function combatFittings(add, paint) {
  const { steel, black, grey, yellow, teal, orange, glow } = paint
  const chassis = bumperSection(
    [
      [4.11, -0.28],
      [4.34, -0.28],
      [4.41, -0.16],
      [4.41, 0.12],
      [4.37, 0.24],
      [4.22, 0.24],
      [4.12, 0.12]
    ],
    0.298
  )
  const cushion = bumperSection(
    [
      [4.02, -0.01],
      [4.19, -0.01],
      [4.25, 0.074],
      [4.25, 0.215],
      [4.2, 0.285],
      [4.094, 0.285],
      [4.036, 0.239],
      [4.004, 0.168],
      [4.004, 0.064]
    ],
    0.267
  )
  const rubRail = bumperSection(
    [
      [3.995, 0.079],
      [4.019, 0.061],
      [4.027, 0.08],
      [4.027, 0.163],
      [4.017, 0.176],
      [3.987, 0.156],
      [3.987, 0.099]
    ],
    0.25
  )
  const chine = bumperSection(
    [
      [4.359, -0.158],
      [4.421, -0.145],
      [4.421, -0.122],
      [4.36, -0.124]
    ],
    0.282
  )
  const bracket = new THREE.BoxGeometry(0.152, 0.28, 0.186)
  const bolt = new THREE.CylinderGeometry(0.031, 0.033, 0.022, 6)
  const lampSlot = new THREE.BoxGeometry(0.242, 0.064, 0.026),
    lamp = new THREE.BoxGeometry(0.17, 0.025, 0.014)
  const band = new THREE.BoxGeometry(0.415, 0.014, 0.105),
    stripe = new THREE.BoxGeometry(0.059, 0.007, 0.102)
  const shearBolt = new THREE.CylinderGeometry(0.022, 0.026, 0.014, 6)
  const arc = (geometry, material, angle) => add(geometry, material, 0, 0, 0, angle)
  function padPart(geometry, material, angle, r, y, side = 0, twist = 0, emission = 0) {
    add(
      geometry,
      material,
      Math.sin(angle) * r + Math.cos(angle) * side,
      y,
      Math.cos(angle) * r - Math.sin(angle) * side,
      angle + twist,
      emission
    )
  }
  for (let i = 0; i < 20; i++) {
    // The battle ramps enter through these two full-width breaks.
    if (i === 6 || i === 16) continue
    const a = (i * TAU) / 20
    arc(chassis, grey, a)
    arc(cushion, black, a)
    arc(rubRail, grey, a)
    arc(chine, steel, a)
    for (const s of [-1, 1]) {
      const aa = a + s * 0.127
      padPart(bracket, grey, aa, 4.31, 0.067)
      padPart(bolt, steel, aa, 4.31, 0.224)
    }
    padPart(lampSlot, black, a, 4.414, 0.013)
    padPart(lamp, glow, a, 4.433, 0.015, 0, 0, 0.56)
    if (i % 5 === 0 || i === 7 || i === 17) {
      // A stripe belongs to the removable steel cap, rather than wrapping the
      // whole arena in a caution pattern. The two opposing mouths stay open.
      padPart(band, yellow, a, 4.294, 0.249)
      for (const s of [-1, 0, 1]) padPart(stripe, black, a, 4.294, 0.259, s * 0.112, -0.37)
    }
  }
  // Flush timing sockets straddle the opposing launch boxes. The robot can
  // roll straight across them without changing the level battle surface.
  const pocket = new THREE.BoxGeometry(0.44, 0.012, 0.092),
    lens = new THREE.BoxGeometry(0.261, 0.008, 0.035)
  const channel = new THREE.BoxGeometry(0.06, 0.009, 0.69)
  for (const side of [-1, 1]) {
    const team = side < 0 ? teal : orange
    for (const z of [-0.66, 0.66]) {
      add(pocket, grey, side * 2.48, 0.005, z, 0)
      add(lens, team, side * 2.48, 0.012, z, 0, 0.26)
      for (const dx of [-0.176, 0.176]) add(shearBolt, steel, side * 2.48 + dx, 0.011, z, 0)
    }
    for (let k = 0; k < 3; k++) add(channel, black, side * (2.82 + k * 0.092), 0.004, 0, 0)
  }
}

function makeStage(arena) {
  const group = new THREE.Group()
  group.name = arena ? 'Rally court' : 'Assembly turntable'
  const radius = arena ? 4.3 : 1.55
  const depth = arena ? 0.36 : 0.255
  const segments = arena ? 112 : 80
  const finish = (color, roughness, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
  const enamel = arena ? finish('#737f78', 0.36, 0.18) : finish('#363e41', 0.54, 0.49)
  const silver = finish(arena ? '#a3aba1' : '#8a9494', 0.34, 0.57)
  const rubber = finish('#354546', 0.86, 0.1)
  const petrol = finish('#387269', 0.43, 0.32)
  const groove = finish('#263b3b', 0.59, 0.24)
  const amber = finish('#d79345', 0.4, 0.22)
  const housing = [],
    fittings = [],
    sourceShapes = new Set(),
    ringFinishes = []
  function surface(pieces, geometry, material, matrix) {
    pieces.push({
      geometry,
      matrix,
      color: material.color,
      finish: [material.roughness, material.metalness, 0]
    })
    sourceShapes.add(geometry)
  }
  function mesh(name, geometry, material) {
    const part = new THREE.Mesh(geometry, material)
    part.name = name
    part.receiveShadow = true
    group.add(part)
    return part
  }
  // Each profile revolves through the full circumference. Chamfers stay smooth
  // and only the visible outside walls are tessellated.
  function rim(name, profile, material) {
    const points = profile.map(([r, y]) => new THREE.Vector2(r * radius, y * depth))
    const geometry = new THREE.LatheGeometry(points, segments)
    geometry.name = name
    surface(housing, geometry, material, new THREE.Matrix4())
  }
  rim(
    'Non-slip plinth',
    [
      [0.91, -1],
      [0.951, -0.97],
      [0.964, -0.85],
      [0.964, -0.76],
      [0.956, -0.7]
    ],
    rubber
  )
  rim(
    'Brushed lower rim',
    [
      [0.956, -0.77],
      [0.974, -0.7],
      [0.975, -0.64],
      [0.965, -0.6]
    ],
    silver
  )
  rim(
    'Inlaid housing',
    [
      [0.963, -0.66],
      [0.985, -0.58],
      [0.985, -0.4],
      [0.973, -0.36]
    ],
    arena ? petrol : groove
  )
  rim(
    'Rolled enamel surround',
    [
      [0.973, -0.4],
      [0.992, -0.34],
      [1, -0.26],
      [1, -0.15],
      [0.996, -0.11],
      [0.981, -0.045],
      [0.965, 0]
    ],
    enamel
  )
  rim(
    'Machined upper seam',
    [
      [0.985, -0.37],
      [0.996, -0.33],
      [0.996, -0.3]
    ],
    silver
  )

  const deckMaterial = finish('#ffffff', arena ? 0.74 : 0.48, arena ? 0.20 : 0.56)
  deckMaterial.envMapIntensity = arena ? 0.48 : 0.64
  deckMaterial.map = deckMap(arena)
  const deck = mesh('Playing surface', new THREE.CircleGeometry(radius * 0.965, segments), deckMaterial)
  deck.rotation.x = -Math.PI / 2
  // The matte court is flat and the arena lights stay put. On a slow device,
  // bake the workshop's reflected light into two linear RGB coefficients.
  // Painted marks, directional light and the robots' moving shadows stay live.
  const matte = arena ? new THREE.MeshLambertMaterial({ color: '#e0d8cd', map: deckMaterial.map }) : null
  if (matte)
    matte.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_end>',
        '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(.29,.33,.34) + vec3(.008,.009,.010);'
      )
    }

  const dummy = new THREE.Object3D()
  function hardware(name, geometry, material, count, place) {
    const batch = material.emissive.getHex() ? new THREE.InstancedMesh(geometry, material, count) : null
    if (batch) batch.name = name
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * TAU
      dummy.position.set(0, 0, 0)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      place(dummy, angle, i)
      dummy.updateMatrix()
      if (batch) batch.setMatrixAt(i, dummy.matrix)
      else surface(fittings, geometry, material, dummy.matrix.clone())
    }
    if (batch) {
      batch.computeBoundingSphere()
      group.add(batch)
    }
  }
  const bolts = arena ? 16 : 8
  const head = arena ? 0.031 : 0.022
  const boltPos = (object, angle, y) =>
    object.position.set(Math.sin(angle) * radius * 0.943, y, Math.cos(angle) * radius * 0.943)
  hardware(
    'Countersunk fasteners',
    new THREE.CylinderGeometry(head, head * 0.84, 0.003, 10),
    silver,
    bolts,
    (object, angle) => boltPos(object, angle, 0.001)
  )
  hardware(
    'Recessed tool slots',
    new THREE.BoxGeometry(head * 1.13, 0.001, head * 0.18),
    groove,
    bolts,
    (object, angle) => {
      boltPos(object, angle, 0.003)
      object.rotation.y = angle + 0.5
    }
  )
  const stations = arena ? 16 : 12
  const bandPos = (object, angle, r, y) => {
    object.position.set(Math.sin(angle) * r, y, Math.cos(angle) * r)
    object.rotation.y = angle
  }
  hardware(
    'Service slots',
    new THREE.BoxGeometry(arena ? 0.33 : 0.122, depth * 0.092, 0.014),
    rubber,
    stations,
    (object, angle) => bandPos(object, angle, radius * 0.985, -depth * 0.5)
  )
  const light = finish(arena ? '#e8e4bb' : '#e6a04d', 0.36, 0.14)
  light.emissive = new THREE.Color(arena ? '#e6b076' : '#f18b32')
  light.emissiveIntensity = 0.32
  hardware(
    'Recessed amber indicators',
    new THREE.BoxGeometry(arena ? 0.22 : 0.069, depth * 0.048, 0.015),
    light,
    stations,
    (object, angle) => bandPos(object, angle, radius * 0.987, -depth * 0.5)
  )
  if (arena) {
    const armour = finish('#455657', 0.56, 0.38),
      pad = finish('#293537', 0.87, 0.07)
    const yellow = finish('#d7a93b', 0.53, 0.21),
      teamTeal = finish('#3a9d92', 0.46, 0.22)
    const teamOrange = finish('#ca7950', 0.46, 0.23)
    ringFinishes.push(armour, pad, yellow, teamTeal, teamOrange)
    combatFittings(
      (geometry, material, x, y, z, angle, emission = 0) => {
        dummy.position.set(x, y, z)
        dummy.rotation.set(0, angle, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        surface(fittings, geometry, material, dummy.matrix.clone())
        fittings[fittings.length - 1].finish[2] = emission
      },
      { steel: silver, black: pad, grey: armour, yellow, teal: teamTeal, orange: teamOrange, glow: light }
    )
    // Low field-side timing pods stay below the competitors' wheels.
    const six = 6
    hardware('Timing pod brackets', new THREE.BoxGeometry(0.16, 0.065, 0.42), rubber, six, (object, angle) =>
      bandPos(object, angle + 0.24, radius - 0.06, -depth + 0.045)
    )
    hardware('Timing pod bases', new THREE.CylinderGeometry(0.115, 0.142, 0.1, 12), groove, six, (object, angle) =>
      bandPos(object, angle + 0.24, radius + 0.12, -depth + 0.05)
    )
    hardware('Timing pod caps', new THREE.CylinderGeometry(0.091, 0.108, 0.045, 12), amber, six, (object, angle) =>
      bandPos(object, angle + 0.24, radius + 0.12, -depth + 0.12)
    )
  }
  // The enclosure and fixed fittings never move relative to one another.
  // Separate the two draws so tiny fasteners keep their original shadow flags.
  const surfaces = acquireSurfaceMaterial()
  mesh('Enamel and brushed rim', bakeSurfaces(housing), surfaces)
  mesh('Fixed hardware', bakeSurfaces(fittings), surfaces).receiveShadow = false
  for (const shape of sourceShapes) shape.dispose()
  const shade = new THREE.MeshBasicMaterial({
    map: contactMap(),
    transparent: true,
    depthWrite: false,
    toneMapped: false
  })
  const shadow = mesh('Ground contact', new THREE.PlaneGeometry(radius * 2.62, radius * 2.62), shade)
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -depth - 0.011
  shadow.renderOrder = -2
  shadow.receiveShadow = false

  let disposed = false
  return {
    group,
    setLeanDeck(active) {
      deck.material = active && matte ? matte : deckMaterial
    },
    dispose() {
      if (disposed) return
      disposed = true
      const materials = new Set([
        enamel,
        silver,
        rubber,
        petrol,
        groove,
        amber,
        light,
        deckMaterial,
        shade,
        ...ringFinishes
      ])
      for (const child of group.children) {
        child.geometry.dispose()
        if (child.isInstancedMesh) child.dispose()
      }
      for (const material of materials) {
        material.map?.dispose()
        material.dispose()
      }
      matte?.dispose()
      releaseSurfaceMaterial()
      group.clear()
    }
  }
}

export function createPodium() {
  return makeStage(false)
}

export function createArena() {
  return makeStage(true)
}
