import * as T from '../vendor/three.module.js'
import { contactTexture } from './ground-contact.js'
import { paintById } from './palette.js'
import { createRobot } from './robot.js'
import { slots, partFor, cost, frames } from './catalog.js'

const W = 880,
  H = 1134,
  margin = 32,
  photoH = 478
function cover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw = w / scale,
    sh = h / scale
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) * 0.53, sw, sh, x, y, w, h)
}
function text(ctx, words, x, y, size, weight, color, align = 'left', available) {
  ctx.textAlign = align
  ctx.fillStyle = color
  const face = 'px "Avenir Next",system-ui,sans-serif'
  ctx.font = weight + ' ' + size + face
  if (available) {
    const measured = ctx.measureText(words).width
    if (measured > available) ctx.font = weight + ' ' + Math.floor(size * available / measured) + face
  }
  ctx.fillText(words, x, y)
}

function portrait(ctx, view, record, x, y, w, h) {
  const r = view.renderer,
    camera = new T.PerspectiveCamera(31, w / h, 0.05, 50)
  const model = createRobot(record.build, paintById(record.paint)?.[2] || view.paintColor)
  model.setFinishMaterial(view.workshopFinish)
  const trophy = view.trophy.group
  const visible = trophy.visible,
    position = trophy.position.clone(),
    rotation = trophy.rotation.clone(),
    scale = trophy.scale.clone()
  const size = [view.bufferWidth, view.bufferHeight, view.bufferRatio]
  const contactX = view.shopShadow.position.x,
    contactYaw = view.shopShadow.rotation.y,
    contactMap = view.shopShadow.material.map
  view.shop.add(model.group)
  view.player.group.visible = false
  try {
    model.group.position.set(-0.38, 0, 0)
    view.shopShadow.position.x = model.group.position.x
    model.group.rotation.y = view.shopShadow.rotation.y = 0.16
    view.shopShadow.material.map = contactTexture(record.build)
    model.update({ time: 1.65, win: 0.55 })
    trophy.visible = true
    trophy.position.set(0.76, 0, -0.02)
    trophy.rotation.y = -0.18
    trophy.scale.setScalar(1)
    camera.position.set(1.06, 1.48, 4.5)
    camera.lookAt(0.02, 0.84, 0)
    view.bufferSize(w, h, 1)
    r.setViewport(0, 0, w, h)
    r.setScissorTest(false)
    r.clear()
    view.shop.userData.key.shadow.needsUpdate = true
    r.render(view.shop, camera)
    ctx.drawImage(r.domElement, x, y, w, h)
  } finally {
    model.dispose()
    trophy.position.copy(position)
    trophy.rotation.copy(rotation)
    trophy.scale.copy(scale)
    trophy.visible = visible
    view.shopShadow.position.x = contactX
    view.shopShadow.rotation.y = contactYaw
    view.shopShadow.material.map = contactMap
    view.player.group.visible = true
    view.bufferSize(...size)
    r.setViewport(0, 0, size[0], size[1])
    r.clear()
    view.shop.userData.key.shadow.needsUpdate = true
    r.render(view.shop, view.shopCam)
  }
}

export async function championPhoto(view, record, edition, final) {
  const backdrop = new Image()
  backdrop.src = new URL('../art/workshop.webp', import.meta.url).href
  await backdrop.decode()
  if (view.mode !== 'shop' || view.lost || !view.champion || !view.trophy) return null
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d'),
    pw = W - margin * 2
  ctx.fillStyle = '#f5f1e4'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#17483e'
  ctx.fillRect(0, 0, W, 130)
  ctx.fillStyle = '#ddb16a'
  ctx.fillRect(0, 124, W, 6)
  text(ctx, 'Bolt Cup', margin, 56, 32, 750, '#fff8df')
  text(ctx, 'ROBOT RALLY', margin, 92, 17, 650, '#c3d8c2')
  text(ctx, 'Cup ' + edition, W - margin, 56, 23, 600, '#f4d191', 'right')
  text(ctx, 'Champion portrait', W - margin, 94, 28, 700, '#fff9e9', 'right')
  cover(ctx, backdrop, margin, 152, pw, photoH)
  const shade = ctx.createLinearGradient(0, 152, 0, 152 + photoH)
  shade.addColorStop(0, 'rgba(33,43,34,0.02)')
  shade.addColorStop(1, 'rgba(14,35,27,0.32)')
  ctx.fillStyle = shade
  ctx.fillRect(margin, 152, pw, photoH)
  portrait(ctx, view, record, margin, 152, pw, photoH)
  const champion = record.build.name || frames[record.build.chassis ?? 0].name
  text(ctx, champion, margin, 680, 46, 750, '#173c33', 'left', pw)
  text(ctx, 'Winning build', margin, 710, 20, 650, '#53695a')
  text(ctx, 'Defeated ' + final.rival, W - margin, 710, 20, 650, '#53695a', 'right')
  for (const [i, slot] of slots.entries()) {
    const col = i % 2,
      row = Math.floor(i / 2),
      x = margin + col * 420,
      y = 745 + row * 74
    const part = partFor(slot.id, record.build[slot.id])
    ctx.fillStyle = '#d3d5c4'
    ctx.fillRect(x, y - 20, 392, 1)
    text(ctx, slot.name, x, y + 5, 17, 600, '#526b5c')
    text(ctx, part.name, x, y + 36, 25, 650, '#173c33')
    text(ctx, part.price + ' coins', x + 388, y + 34, 19, 550, '#5c6d60', 'right')
  }
  ctx.fillStyle = '#e2e9d8'
  ctx.fillRect(margin, 1037, pw, 64)
  text(ctx, 'Build cost', margin + 19, 1079, 21, 650, '#45604b')
  text(
    ctx,
    cost(record.build) + ' / ' + final.budget + ' coins',
    W - margin - 19,
    1081,
    29,
    750,
    '#194938',
    'right'
  )
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}
