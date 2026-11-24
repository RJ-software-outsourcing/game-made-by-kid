import { TIME_LIMIT } from './match.js'

export function fightLine(event, names) {
  const who = names[event.side],
    target = names[1 - event.side]
  switch (event.kind) {
    case 'win':
      return who + ' wins!'
    case 'tie':
      return 'The bout ends in a tie.'
    case 'hit':
      if (event.doubleHit) return who + ' lands two quick hits on ' + target + '!'
      if (event.flanking) return who + ' hits the open side of ' + target + '.'
      if (event.weapon === 2) return who + ' hits ' + target + ' with a bubble.'
      if (event.weapon === 3) return who + ' hits ' + target + ' with a wave.'
      if (event.weapon === 1) return who + ' sweeps ' + target + '.'
      return who + ' bumps ' + target + '.'
    case 'guard':
      return target + ' blocks ' + who + (event.reply ? ' and hits back!' : '.')
    case 'miss':
      if (event.evaded) return target + ' dodges ' + who + (event.weapon === 2 ? '’s bubble!' : '’s swing!')
      if (event.outOfReach) return who + ' swings. ' + target + ' is out of reach.'
      if (event.weapon === 2) return who + '’s bubble misses ' + target + '.'
      if (event.weapon === 3) return who + '’s wave stops short of ' + target + '.'
      return who + ' misses ' + target + '.'
    case 'dodge':
      return who + ' dodges sideways.'
    case 'charge':
      return who + ' starts a refill.'
    case 'ready':
      return who + ' has power again.'
    case 'dash':
      return who + ' dashes in.'
    default:
      return ''
  }
}
export class FightLog {
  constructor(root) {
    this.root = root
  }
  reset(names) {
    this.names = names
    this.lastKey = ''
    this.root.replaceChildren()
  }
  finish(winner, time) {
    this.add({ kind: winner < 2 ? 'win' : 'tie', side: winner < 2 ? winner : 0 }, time)
  }
  add(event, time, history) {
    const line = fightLine(event, this.names)
    if (!line) return
    const key = event.side + line
    if (key === this.lastKey && time - this.lastTime < 0.5) return
    this.lastKey = key
    this.lastTime = time
    const entry = {
      line,
      left: Math.max(0, Math.ceil(TIME_LIMIT - time)),
      side: event.kind === 'guard' || event.evaded ? 1 - event.side : event.side
    }
    if (history) {
      history.push(entry)
      if (history.length > 3) history.shift()
    } else this.append(entry)
  }
  append({ line, left, side }) {
    const row = document.createElement('li'),
      stamp = document.createElement('time')
    stamp.textContent = left + 's'
    stamp.setAttribute('aria-label', left + ' seconds left')
    row.append(stamp, document.createTextNode(line))
    row.dataset.side = side
    this.root.append(row)
    while (this.root.children.length > 3) this.root.firstElementChild.remove()
  }
}
