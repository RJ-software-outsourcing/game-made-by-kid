import { liveAction } from './head-labels.js'
import { partFor } from './catalog.js'
import { TIME_LIMIT } from './match.js'
import { escapeText } from './markup.js'
import { icon } from './icons.js'
import { endurancePercent, finishPrecision } from './endurance.js'

const meters = [
  { key: 'hp', icon: 'shield', name: 'Health' },
  { key: 'energy', icon: 'bolt', name: 'Power' }
]

export class Scoreboard {
  constructor(root, clock, selectCamera) {
    this.root = root
    this.clock = clock
    this.clock.setAttribute('role', 'timer')
    this.root.onclick = (e) => {
      const button = e.target.closest('[data-team-camera]')
      if (button && !button.disabled) selectCamera(Number(button.dataset.teamCamera))
    }
  }
  reset(rival, own = 'Rivet') {
    const teams = (this.teams = [own, rival])
    this.root.innerHTML = teams
      .map((rawName, i) => {
        const name = escapeText(rawName)
        const rows = meters
          .map(
            ({ key, icon: glyph, name: label }) => `
        <div class="meter-row ${key === 'energy' ? 'battery-row' : ''}">${icon(glyph, 13)}
          <div class="bar ${key === 'energy' ? 'energy' : ''}" role="progressbar" aria-label="${name} ${label}" aria-valuemin="0" aria-valuemax="100">
            <i id="${key}-${i}"></i></div><small id="${key}-text-${i}" aria-hidden="true"></small></div>`
          )
          .join('')
        return `<div class="score ${i ? 'rival-score' : ''}"><div class="stat-label"><span class="fighter-name">${name}${icon('camera', 13)}</span><small id="stance-${i}"></small></div>${rows}
          <button class="score-camera" data-team-camera="${i}" aria-label="View from ${name}" aria-pressed="false"></button></div>`
      })
      .join('')
    this.lanes = teams.map((_, i) => ({
      stance: this.root.querySelector('#stance-' + i),
      meters: meters.map(({ key }) => ({
        bar: this.root.querySelector('#' + key + '-' + i),
        text: this.root.querySelector('#' + key + '-text-' + i),
        previous: -1,
        fill: -1
      }))
    }))
    this.seconds = -1
  }
  camera(side, locked = false) {
    this.root.dataset.onboard = String(side === 0 || side === 1)
    for (const button of this.root.querySelectorAll('[data-team-camera]')) {
      const index = Number(button.dataset.teamCamera),
        active = index === side
      button.disabled = locked
      button.setAttribute('aria-pressed', String(active))
      button.setAttribute(
        'aria-label',
        active ? 'Leave ' + this.teams[index] + ' camera' : 'View from ' + this.teams[index]
      )
    }
  }
  update(match) {
    const places = finishPrecision(match)
    for (let i = 0; i < 2; i++) {
      const p = match.robots[i],
        lane = this.lanes[i]
      const action = liveAction(p),
        strategy = partFor('brain', p.build.brain).name
      const stance = action ? strategy + ' · ' + action : strategy
      if (lane.stance.textContent !== stance) lane.stance.textContent = stance
      for (let k = 0; k < 2; k++) {
        const percent = k === 0 ? endurancePercent(p, places) : Math.round((100 * p.energy) / p.s.capacity)
        const meter = lane.meters[k]
        if (k === 1 && meter.refilling !== p.rest) {
          const track = meter.bar.parentElement
          track.classList.toggle('refilling', p.rest)
          track.style.setProperty('--ready-mark', (100 * p.readyEnergy / p.s.capacity) + '%')
          if (p.rest) track.setAttribute('aria-description', 'Refilling to ' + Math.ceil(100 * p.readyEnergy / p.s.capacity) + ' percent.')
          else track.removeAttribute('aria-description')
          meter.refilling = p.rest
        }
        const fill = k === 0 ? p.hp / p.s.hp : percent / 100
        if (fill !== meter.fill) {
          meter.bar.style.transform = 'scaleX(' + fill + ')'
          meter.fill = fill
        }
        if (percent === meter.previous) continue
        meter.previous = percent
        meter.text.textContent = percent + '%'
        meter.bar.parentElement.setAttribute('aria-valuenow', String(percent))
      }
    }
    const seconds = Math.max(0, Math.ceil(TIME_LIMIT - match.time))
    if (seconds === this.seconds) return
    this.seconds = seconds
    this.clock.textContent = seconds
    this.clock.setAttribute('aria-label', seconds + ' seconds left')
  }
}
