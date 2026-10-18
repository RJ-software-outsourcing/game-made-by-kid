// The three playable characters, drawn on canvas in local coordinates (about ±50 px).
// Blankie Bear (被被熊) is the traced drawing from the kcis-grade1-vocabulary project,
// rendered once from SVG into an image.

export const CHARS = {
  whale: { id: 'whale', name: 'Mr. Whale', tag: 'Big & gentle', color: '#5aa9ff' },
  sponge: { id: 'sponge', name: 'Mr. Sponge', tag: 'Always giggling', color: '#ffd84d' },
  bear: { id: 'bear', name: 'Blankie Bear', tag: 'Cozy & cuddly', color: '#a9c3f7' },
}
export const CHAR_IDS = ['whale', 'sponge', 'bear']

const TAU = Math.PI * 2

// ---------- 被被熊 ----------

const INK = '#1f2433'
const EDGE_D =
  'M257,319 C218,382 116,456 58,535 Q44,541 62,560 C116,583 221,612 318,626 C380,636 418,646 448,662 ' +
  'C520,612 630,560 729,528 C793,511 844,488 839,470 C812,403 721,364 642,333 C609,313 590,300 572,290'
const OUTLINE_D = `${EDGE_D} L420,330 Z`
const BANDS = [
  'M150,433 C134,470 124,520 130,566 L138,615 L200,630 L190,570 C176,500 192,420 214,376 L170,360 Z',
  'M237,300 L237,349 C238,430 245,540 276,603 L292,650 L450,700 L448,661 L452,598 C380,520 320,420 296,342 L296,300 Z',
  'M372,330 L383,372 C440,450 520,540 625,577 L650,600 L760,540 L726,517 C618,496 543,426 484,360 L476,330 Z',
  'M560,295 L568,318 C617,372 708,422 830,458 L880,480 L880,380 L620,250 Z',
]
const STRIPES = [
  'M150,433 C134,470 124,520 130,566',
  'M214,376 C192,420 176,500 190,570',
  'M237,349 C238,430 245,540 276,603',
  'M296,342 C320,420 380,520 452,598',
  'M383,372 C440,450 520,540 625,577',
  'M484,360 C543,426 618,496 726,517',
  'M568,318 C617,372 708,422 830,458',
]
const HEAD = {
  leftEarFill: 'M266,226 C255,222 248,219 244,214 C230,195 230,160 252,142 C275,124 320,124 346,140 L300,190 Z',
  leftEarLine: 'M266,226 C255,222 248,219 244,214 C230,195 230,160 252,142 C275,124 320,124 346,140',
  rightEarFill: 'M469,122 C478,102 503,89 534,89 C562,89 586,103 592,125 C597,146 589,163 576,174 L520,135 Z',
  rightEarLine: 'M469,122 C478,102 503,89 534,89 C562,89 586,103 592,125 C597,146 589,163 576,174',
  fill:
    'M575,172 C592,186 603,212 602,245 C596,270 583,290 561,307 C529,329 480,346 430,349 ' +
    'C400,350 360,348 305,344 C282,341 265,333 256,318 C246,290 252,252 265,228 C272,210 285,193 300,175 ' +
    'C331,143 371,123 400,120 C425,118 450,120 470,122 C510,129 550,146 575,172 Z',
  nose: 'M403,226 C410,221 418,218 426,218 C426,226 421,233 417,238 C412,234 406,230 403,226 Z',
  noseLine: 'M417,238 C416,246 415,254 415,264',
  mouth: 'M388,258 C398,268 432,268 442,258',
}

function pencil(id, base, strokes) {
  return `<pattern id="${id}" width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(25)">
<rect width="30" height="30" fill="${base}"/><g stroke-linecap="round">
<path d="M3,-2 V32" stroke="${strokes[0]}" stroke-width="2.4" opacity="0.8"/>
<path d="M9,4 V26" stroke="${strokes[1]}" stroke-width="2"/>
<path d="M14,-2 V17 M14,22 V32" stroke="${strokes[2]}" stroke-width="2.2" opacity="0.75"/>
<path d="M20,-2 V32" stroke="${strokes[3]}" stroke-width="2.6"/>
<path d="M25,6 V30" stroke="${strokes[4]}" stroke-width="2" opacity="0.8"/></g></pattern>`
}

function bearSvg(closed) {
  const eyes = closed
    ? `<path d="M356,200 Q370,214 384,199" fill="none" stroke-width="7"/><path d="M451,188 Q465,200 479,187" fill="none" stroke-width="7"/>`
    : `<ellipse cx="370" cy="203" rx="13" ry="6.5" transform="rotate(-24 370 203)" fill="${INK}" stroke="none"/>
<ellipse cx="465" cy="190" rx="14" ry="5.5" transform="rotate(5 465 190)" fill="${INK}" stroke="none"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 70 860 610" width="860" height="610"><defs>
${pencil('p', '#aac1f6', ['#95b0f1', '#c3d3fa', '#8ea9ef', '#b6c9f8', '#93aef0'])}
${pencil('pe', '#97b2f2', ['#829fec', '#b0c4f7', '#7c9ae9', '#a6bdf5', '#859fec'])}
<clipPath id="c"><path d="${OUTLINE_D}"/></clipPath></defs>
<path d="${OUTLINE_D}" fill="#fffefb"/>
<g clip-path="url(#c)">${BANDS.map((b) => `<path d="${b}" fill="url(#p)"/>`).join('')}</g>
<g fill="none" stroke="${INK}" stroke-linecap="round" stroke-linejoin="round">
${STRIPES.map((s) => `<path d="${s}" stroke-width="8"/>`).join('')}<path d="${EDGE_D}" stroke-width="6"/></g>
<g stroke="${INK}" stroke-linecap="round" stroke-linejoin="round">
<path d="${HEAD.leftEarFill}" fill="url(#pe)" stroke="none"/><path d="${HEAD.rightEarFill}" fill="url(#pe)" stroke="none"/>
<path d="${HEAD.leftEarLine}" fill="none" stroke-width="7"/><path d="${HEAD.rightEarLine}" fill="none" stroke-width="7"/>
<path d="${HEAD.fill}" fill="#fffefb" stroke-width="7"/>
<ellipse cx="328" cy="252" rx="24" ry="13" fill="#f7a8c0" stroke="none" opacity="0.8"/>
<ellipse cx="530" cy="238" rx="24" ry="13" fill="#f7a8c0" stroke="none" opacity="0.8"/>
${eyes}
<path d="${HEAD.nose}" fill="#fffefb" stroke-width="5"/><path d="${HEAD.noseLine}" fill="none" stroke-width="5"/>
<path d="${HEAD.mouth}" fill="none" stroke-width="5.5"/></g></svg>`
}

const BEAR_W = 132
const BEAR_H = (BEAR_W * 610) / 860
const bearImgs = { open: null, closed: null }

function rasterize(svg) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      // Pre-render at 3x display size so it stays crisp and is cheap to draw each frame.
      const cv = document.createElement('canvas')
      cv.width = BEAR_W * 3
      cv.height = Math.round(BEAR_H * 3)
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)
      resolve(cv)
    }
    img.onerror = () => resolve(null)
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
}

export async function loadBear() {
  const [open, closed] = await Promise.all([rasterize(bearSvg(false)), rasterize(bearSvg(true))])
  bearImgs.open = open
  bearImgs.closed = closed
}

function bear(c, f, t, closed, mv) {
  const img = closed ? bearImgs.closed : bearImgs.open
  if (!img) return
  c.save()
  c.scale(f, 1)
  c.rotate(Math.sin(t * 2.2) * 0.05 + mv * 0.08)
  // The blanket ripples a little: squash/stretch while swimming.
  c.scale(1 + Math.sin(t * 6) * 0.02 * (1 + mv), 1 - Math.sin(t * 6) * 0.02 * (1 + mv))
  c.drawImage(img, -BEAR_W / 2, -BEAR_H / 2 - 4, BEAR_W, BEAR_H)
  c.restore()
}

// ---------- Mr. Whale ----------

function whale(c, f, t, closed, mv) {
  c.save()
  c.scale(f, 1)
  // tail
  c.save()
  c.translate(-38, 0)
  c.rotate(Math.sin(t * (4 + mv * 8)) * 0.25)
  c.fillStyle = '#3d8ae8'
  c.strokeStyle = '#2a5fa8'
  c.lineWidth = 3
  c.beginPath()
  c.moveTo(6, -10)
  c.quadraticCurveTo(-12, -10, -26, -30)
  c.quadraticCurveTo(-18, -8, -14, -2)
  c.quadraticCurveTo(-20, 6, -30, 20)
  c.quadraticCurveTo(-12, 10, 6, 10)
  c.closePath()
  c.fill()
  c.stroke()
  c.restore()
  // body
  const g = c.createLinearGradient(0, -38, 0, 38)
  g.addColorStop(0, '#86c6ff')
  g.addColorStop(1, '#4a95f0')
  c.fillStyle = g
  c.beginPath()
  c.ellipse(0, 0, 46, 36, 0, 0, TAU)
  c.fill()
  c.save()
  c.clip()
  c.fillStyle = '#e2f1ff'
  c.beginPath()
  c.ellipse(10, 32, 46, 20, 0, 0, TAU)
  c.fill()
  c.strokeStyle = 'rgba(120,160,220,0.6)'
  c.lineWidth = 2
  for (const dx of [-4, 8, 20]) {
    c.beginPath()
    c.moveTo(dx - 10, 20)
    c.quadraticCurveTo(dx, 26, dx + 10, 21)
    c.stroke()
  }
  c.restore()
  c.strokeStyle = '#2a5fa8'
  c.lineWidth = 3
  c.beginPath()
  c.ellipse(0, 0, 46, 36, 0, 0, TAU)
  c.stroke()
  // fin
  c.save()
  c.translate(-2, 14)
  c.rotate(0.6 + Math.sin(t * (4 + mv * 6)) * 0.35)
  c.fillStyle = '#3d8ae8'
  c.beginPath()
  c.ellipse(0, 9, 7, 13, 0, 0, TAU)
  c.fill()
  c.stroke()
  c.restore()
  // eye
  c.lineCap = 'round'
  if (closed) {
    c.strokeStyle = '#1b2a44'
    c.lineWidth = 3
    c.beginPath()
    c.arc(22, -9, 8, 0.15 * Math.PI, 0.85 * Math.PI)
    c.stroke()
  } else {
    c.fillStyle = '#fff'
    c.beginPath()
    c.arc(22, -8, 11, 0, TAU)
    c.fill()
    c.strokeStyle = '#2a5fa8'
    c.lineWidth = 2
    c.stroke()
    c.fillStyle = '#1b2a44'
    c.beginPath()
    c.arc(25, -7, 6.5, 0, TAU)
    c.fill()
    c.fillStyle = '#fff'
    c.beginPath()
    c.arc(27.5, -10, 2.6, 0, TAU)
    c.arc(23, -4.5, 1.2, 0, TAU)
    c.fill()
  }
  // blush + smile
  c.fillStyle = 'rgba(255,130,170,0.65)'
  c.beginPath()
  c.ellipse(26, 9, 7, 4, 0, 0, TAU)
  c.fill()
  c.strokeStyle = '#1b2a44'
  c.lineWidth = 2.5
  c.beginPath()
  c.arc(37, 6, 6, 0.2 * Math.PI, 0.8 * Math.PI)
  c.stroke()
  // tiny top hat
  c.save()
  c.translate(2, -33)
  c.rotate(-0.15)
  c.fillStyle = '#2b2b3d'
  c.fillRect(-15, -3, 30, 6)
  c.fillRect(-10, -21, 20, 19)
  c.fillStyle = '#ff5d8f'
  c.fillRect(-10, -8, 20, 4)
  c.restore()
  c.restore()
}

// ---------- Mr. Sponge ----------

const HOLES = [
  [-22, -30, 4],
  [18, -32, 3],
  [-25, 5, 3.5],
  [24, 8, 4],
  [-4, -36, 2.5],
  [26, -18, 2.5],
  [-27, -14, 2.5],
]

function sponge(c, f, t, closed, mv) {
  const wave = Math.sin(t * (5 + mv * 6))
  c.lineCap = 'round'
  // legs + shoes
  c.strokeStyle = '#e8c22f'
  c.lineWidth = 4
  for (const lx of [-12, 12]) {
    c.beginPath()
    c.moveTo(lx, 32)
    c.lineTo(lx, 44)
    c.stroke()
  }
  c.fillStyle = '#222'
  c.beginPath()
  c.ellipse(-13 + f * 2, 47, 7, 4, 0, 0, TAU)
  c.ellipse(13 + f * 2, 47, 7, 4, 0, 0, TAU)
  c.fill()
  // arms
  c.strokeStyle = '#e8c22f'
  c.beginPath()
  c.moveTo(-32, 0)
  c.lineTo(-44, -8 + wave * 8)
  c.moveTo(32, 0)
  c.lineTo(44, -8 - wave * 8)
  c.stroke()
  c.fillStyle = '#ffe14d'
  c.beginPath()
  c.arc(-44, -8 + wave * 8, 4.5, 0, TAU)
  c.arc(44, -8 - wave * 8, 4.5, 0, TAU)
  c.fill()
  // body with wavy edges
  c.beginPath()
  const L = -32
  const R = 32
  const T = -42
  const B = 32
  c.moveTo(L, T)
  for (let i = 0; i < 4; i++) c.quadraticCurveTo(L + 8 + i * 16, T - 5, L + 16 + i * 16, T)
  for (let i = 0; i < 5; i++) c.quadraticCurveTo(R + 4, T + 7.4 + i * 14.8, R, T + 14.8 + i * 14.8)
  c.lineTo(L, B)
  for (let i = 0; i < 5; i++) c.quadraticCurveTo(L - 4, B - 7.4 - i * 14.8, L, B - 14.8 - i * 14.8)
  c.closePath()
  c.fillStyle = '#ffe14d'
  c.fill()
  c.strokeStyle = '#c9a20a'
  c.lineWidth = 3
  c.stroke()
  c.fillStyle = '#cfc23a'
  for (const [hx, hy, r] of HOLES) {
    c.beginPath()
    c.ellipse(hx, hy, r, r * 1.2, 0, 0, TAU)
    c.fill()
  }
  // shirt, shorts, tie
  c.fillStyle = '#fff'
  c.fillRect(L + 1.5, 12, R - L - 3, 7)
  c.fillStyle = '#8b5a2b'
  c.fillRect(L + 1.5, 19, R - L - 3, 13)
  c.fillStyle = '#222'
  for (const bx of [-20, -8, 4, 16]) c.fillRect(bx, 21, 6, 2.5)
  c.fillStyle = '#e8343a'
  c.beginPath()
  c.moveTo(-3, 12)
  c.lineTo(3, 12)
  c.lineTo(4, 22)
  c.lineTo(0, 26)
  c.lineTo(-4, 22)
  c.closePath()
  c.fill()
  // eyes
  for (const ex of [-11, 11]) {
    if (closed) {
      c.strokeStyle = '#333'
      c.lineWidth = 2.5
      c.beginPath()
      c.arc(ex, -16, 8, 0.15 * Math.PI, 0.85 * Math.PI)
      c.stroke()
      continue
    }
    c.fillStyle = '#fff'
    c.beginPath()
    c.arc(ex, -16, 11, 0, TAU)
    c.fill()
    c.strokeStyle = '#555'
    c.lineWidth = 1.5
    c.stroke()
    c.fillStyle = '#3fa0ff'
    c.beginPath()
    c.arc(ex + f * 2.5, -15, 5.5, 0, TAU)
    c.fill()
    c.fillStyle = '#111'
    c.beginPath()
    c.arc(ex + f * 2.5, -15, 2.6, 0, TAU)
    c.fill()
    c.fillStyle = '#fff'
    c.beginPath()
    c.arc(ex + f * 2.5 + 1.5, -17, 1.2, 0, TAU)
    c.fill()
    c.strokeStyle = '#111'
    c.lineWidth = 1.8
    c.beginPath()
    for (const a of [-0.6, 0, 0.6]) {
      c.moveTo(ex + Math.sin(a) * 11, -16 - Math.cos(a) * 11)
      c.lineTo(ex + Math.sin(a) * 16, -16 - Math.cos(a) * 16)
    }
    c.stroke()
  }
  // cheeks with freckles
  c.fillStyle = 'rgba(255,120,100,0.55)'
  c.beginPath()
  c.arc(-22, -1, 6, 0, TAU)
  c.arc(22, -1, 6, 0, TAU)
  c.fill()
  c.fillStyle = '#c4582f'
  for (const s of [-1, 1]) {
    c.beginPath()
    c.arc(s * 22 - 2, -2, 1, 0, TAU)
    c.arc(s * 22 + 2, -2, 1, 0, TAU)
    c.arc(s * 22, 1, 1, 0, TAU)
    c.fill()
  }
  // nose
  c.fillStyle = '#ffe14d'
  c.strokeStyle = '#c9a20a'
  c.lineWidth = 2
  c.beginPath()
  c.ellipse(f * 3, -5, 4, 6, f * 0.5, 0, TAU)
  c.fill()
  c.stroke()
  // big smile + two teeth
  c.fillStyle = '#fff'
  c.strokeStyle = '#555'
  c.lineWidth = 1.2
  c.fillRect(-6, 8.5, 5, 6)
  c.strokeRect(-6, 8.5, 5, 6)
  c.fillRect(1, 8.5, 5, 6)
  c.strokeRect(1, 8.5, 5, 6)
  c.strokeStyle = '#7a3b10'
  c.lineWidth = 2.5
  c.beginPath()
  c.moveTo(-17, 2)
  c.quadraticCurveTo(0, 18, 17, 2)
  c.stroke()
}

// ---------- Public drawing API ----------

/**
 * Draw a character centered at (x, y).
 * o: { facing: 1|-1, t: seconds, closed: eyes closed, scale, moving: 0..1 }
 */
export function drawChar(ctx, id, x, y, o = {}) {
  const { facing = 1, t = 0, closed = false, scale = 1, moving = 0, bob = true } = o
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  if (bob) ctx.translate(0, Math.sin(t * 2.6 + id.length) * 3)
  if (id === 'whale') whale(ctx, facing, t, closed, moving)
  else if (id === 'sponge') sponge(ctx, facing, t, closed, moving)
  else bear(ctx, facing, t, closed, moving)
  ctx.restore()
}

const sil = document.createElement('canvas')
sil.width = sil.height = 200
const sctx = sil.getContext('2d')

/** Draw a one-color silhouette of a character (shadows, ghosts). */
export function drawSilhouette(ctx, id, x, y, o, color, alpha) {
  sctx.setTransform(1, 0, 0, 1, 0, 0)
  sctx.globalCompositeOperation = 'source-over'
  sctx.clearRect(0, 0, 200, 200)
  drawChar(sctx, id, 100, 100, { ...o, scale: 1 })
  sctx.globalCompositeOperation = 'source-in'
  sctx.fillStyle = color
  sctx.fillRect(0, 0, 200, 200)
  const s = o.scale ?? 1
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.drawImage(sil, x - 100 * s, y - 100 * s, 200 * s, 200 * s)
  ctx.restore()
}

/** Draw a character into a small DOM canvas (menu cards, result screen). */
export function drawPortrait(canvas, id, t, o = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (!w || !h) return // not on screen
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  const c = canvas.getContext('2d')
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  c.clearRect(0, 0, w, h)
  drawChar(c, id, w / 2, h / 2 + 4, { t, scale: Math.min(w, h) / 125, ...o })
}
