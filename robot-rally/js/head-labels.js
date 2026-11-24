import { Quaternion, Vector3 } from '../vendor/three.module.js'
import { supportPoints } from './model-outline.js'
import { endurancePercent, finishPrecision } from './endurance.js'
import { ringName } from './catalog.js'

export function liveAction(p) {
  if (p.win) return 'Winner'
  if (p.defeated || p.hp <= 0) return 'Down'
  if (p.maneuver === 'dash') return 'Dash'
  if (p.maneuver === 'dodge') return 'Dodge'
  if (p.rest) return 'Refill'
  if (p.counter > 0.19) return 'Push back'
  if (p.guard) return 'Shield'
  if (p.charge > 0) return p.build.weapon === 2 ? 'Aiming' : p.build.weapon === 3 ? 'Ring' : 'Wind up'
  return p.tactic || ''
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi))

// Text stays the same size at both rails. A short leader connects each plate
// to its own robot even when the two silhouettes pass one another.
const crownDirections = [new Vector3(0, 1, 0)]
for (const tilt of [0.43, 0.94, 1.5]) {
  for (let side = 0; side < 8; side++) {
    const yaw = (side * Math.PI) / 4
    crownDirections.push(
      new Vector3(Math.sin(tilt) * Math.cos(yaw), Math.cos(tilt), Math.sin(tilt) * Math.sin(yaw))
    )
  }
}
export class HeadLabels {
  constructor(root) {
    this.point = new Vector3()
    this.lanes = [0, 1].map((i) => {
      const node = document.createElement('div')
      node.className = 'head-label team-' + i
      node.innerHTML =
        '<div><b></b><strong></strong></div><i><u></u></i><div class="charge-strip"><span>ϟ</span><i><u></u></i></div><small></small><em></em>'
      root.append(node)
      return {
        node,
        name: node.querySelector('b'),
        hp: node.querySelector('strong'),
        bar: node.querySelector('u'),
        charge: node.querySelector('.charge-strip u'),
        tag: node.querySelector('small'),
        line: node.querySelector('em')
      }
    })
    this.hud = document.querySelector('.ring-hud')
  }
  reset(match, rival, models) {
    const names = [ringName(match.robots[0].build, rival), rival]
    this.order = 1
    this.width = 0
    this.settledLanes = 0
    this.lanes.forEach((lane, i) => {
      const model = models[i]
      lane.name.textContent = names[i]
      const bot = match.robots[i]
      lane.charge.parentElement.style.setProperty('--ready-mark', (100 * bot.readyEnergy / bot.s.capacity) + '%')
      lane.crown = supportPoints(model, crownDirections)
      lane.anchor = model.getPartPosition('brain', new Vector3())
      lane.lastEnergy = lane.lastHP = lane.lastAction = lane.lastTransform = lane.lastLine = undefined
    })
  }
  update(match, camera, models, w, h, inside, settled = false) {
    if (settled && this.settledLanes < 2) {
      // Each fitted silhouette needs just one new sample. Give the fallen
      // robot its plate first and measure the winner on the following frame.
      const i = this.settledLanes === 0 ? 1 - match.winner : match.winner
      const model = models[i]
      const inverse = model.group.getWorldQuaternion(new Quaternion()).invert()
      this.lanes[i].crown = supportPoints(
        model,
        crownDirections.map((d) => d.clone().applyQuaternion(inverse))
      )
      this.settledLanes++
    }
    if (w !== this.width || h !== this.height || inside !== this.inside) {
      this.plateWidth = parseFloat(getComputedStyle(this.lanes[0].node).width)
      this.inside = inside
      this.width = w
      this.height = h
      this.hudBottom = this.hud.getBoundingClientRect().bottom
    }
    const width = this.plateWidth
    const places = finishPrecision(match)
    const edge = width / 2 + 4
    for (let i = 0; i < 2; i++) {
      const lane = this.lanes[i],
        p = match.robots[i]
      const world = models[i].group.matrixWorld
      const anchor = this.point.copy(lane.anchor).applyMatrix4(world).project(camera)
      const ax = anchor.x,
        ay = anchor.y,
        az = anchor.z
      let top = ay
      for (const corner of lane.crown) {
        const c = this.point.copy(corner).applyMatrix4(world).project(camera)
        if (c.z >= -1 && c.z <= 1) top = Math.max(top, c.y)
      }
      lane.show = i !== inside && az >= -1 && az <= 1 && Math.abs(ax) < 1.02 && Math.abs(ay) < 1.02
      if (lane.node.hidden === lane.show) lane.node.hidden = !lane.show
      if (!lane.show) continue
      const hp = endurancePercent(p, places),
        state = liveAction(p)
      const action =
        state === 'Refill' ? 'Refill ' + Math.round((100 * p.energy) / p.s.capacity) + '%' : state
      const energy = Math.round((100 * p.energy) / p.s.capacity)
      if (energy !== lane.lastEnergy) {
        lane.charge.style.transform = 'scaleX(' + energy / 100 + ')'
        lane.lastEnergy = energy
      }
      lane.charge.parentElement.classList.toggle('refilling', p.rest)
      if (hp !== lane.lastHP) {
        lane.hp.textContent = hp + '%'
        lane.bar.style.transform = 'scaleX(' + hp / 100 + ')'
        lane.lastHP = hp
      }
      if (action !== lane.lastAction) {
        lane.tag.dataset.state = state
        lane.tag.textContent = action
        lane.tag.hidden = !action
        lane.lastAction = action
      }
      lane.tipX = ((1 + ax) * w) / 2
      lane.tipY = ((1 - ay) * h) / 2
      lane.x = clamp(lane.tipX, edge, w - edge)
      lane.y = clamp(
        ((1 - top) * h) / 2 - Math.max(9, h * 0.019),
        this.hudBottom + (action ? 52 : 35),
        h - 62
      )
    }
    const [a, b] = this.lanes
    if (a.show && b.show) {
      const dx = b.x - a.x,
        dy = Math.abs(a.y - b.y)
      // Keep left/right assignments steady while the two centers coincide.
      if (Math.abs(dx) > width + 6 || dy > 52) this.order = Math.sign(dx) || this.order
      if (dy < 51 && Math.abs(dx) < width + 8) {
        const half = (width + 8) / 2
        const center = clamp((a.x + b.x) / 2, edge + half, w - edge - half)
        a.x = center - this.order * half
        b.x = center + this.order * half
      }
    }
    for (const lane of this.lanes)
      if (lane.show) {
        const x = Math.round(lane.x),
          y = Math.round(lane.y)
        const transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-100%)'
        if (transform !== lane.lastTransform) {
          lane.node.style.transform = transform
          lane.lastTransform = transform
        }
        const dx = lane.tipX - x,
          dy = lane.tipY - y
        const line =
          'rotate(' +
          Math.atan2(dy, dx).toFixed(2) +
          'rad) scaleX(' +
          Math.max(3, Math.round(Math.hypot(dx, dy))) +
          ')'
        if (line !== lane.lastLine) {
          lane.line.style.transform = line
          lane.lastLine = line
        }
      }
  }
}
