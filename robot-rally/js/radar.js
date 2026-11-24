import { slots, statScales, partGain, stats } from './catalog.js'
import { trackingChance } from './match.js'
const labels = slots.map((s) => statScales[s.id][0])
export function rating(build) {
  return slots.map(({ id }) => (statScales[id][1] + partGain(id, build[id])) / 100)
}
const comparisons = [
  ['Your brain gets moves ready faster.', ' has a quicker brain.'],
  ['Your bot can roll faster.', ' can roll faster.'],
  ['Your battery starts with more power.', ' starts with more battery power.'],
  ['Your shell can take more bumps.', ' can take more bumps.'],
  ['Your eyes can aim better head-on.', ' can aim better head-on.'],
  ['Your tool has more attack points.', ' has more attack points.']
]
export function compareLine(build, rival, name) {
  const a = rating(build), b = rating(rival)
  let i = 0
  for (let j = 1; j < a.length; j++) if (Math.abs(a[j] - b[j]) > Math.abs(a[i] - b[i])) i = j
  if (Math.abs(a[i] - b[i]) < 0.035) return 'Your bots have similar stats.'
  const ahead = a[i] > b[i]
  if (i === 1 || i === 4) {
    const you = { build, s: stats(build) }, other = { build: rival, s: stats(rival) }
    if (i === 1 && (ahead ? you.s.speed <= other.s.speed : other.s.speed <= you.s.speed))
      return ahead ? 'Your heavy shell slows your wheels.' : 'Your light shell helps you keep up with ' + name + '.'
    if (i === 4) {
      const gap = trackingChance(you, other) - trackingChance(other, you)
      if (Math.abs(gap) < 0.01) return 'Both bots aim about as well head-on.'
      return gap > 0 ? comparisons[i][0] : name + comparisons[i][1]
    }
  }
  return ahead ? comparisons[i][0] : name + comparisons[i][1]
}
const point = (i, r) => [
  130 + 63 * r * Math.sin((i * Math.PI) / 3),
  84 - 63 * r * Math.cos((i * Math.PI) / 3)
]
const shape = (values) => values.map((v, i) => point(i, v).join(',')).join(' ')
export function radar(build, rival, name) {
  const a = rating(build), b = rating(rival)
  return drawRadar(a, b, 'You', name)
}
export function statChanges(before, after, rival) {
  const fitted = rating(before, rival)
  return rating(after, rival).map((value, i) => {
    const start = Math.round(fitted[i] * 100),
      end = Math.round(value * 100)
    return { label: labels[i], before: start, after: end, change: end - start }
  })
}
export function loadoutRadar(before, after, rival, rivalName = '') {
  const fitted = rating(before)
  const trying = rating(after)
  const changed = slots.some(({ id }) => before[id] !== after[id])
  return drawRadar(
    trying,
    rivalName ? rating(rival) : fitted,
    changed ? 'Trying' : 'Fitted',
    rivalName || (changed ? 'Fitted' : ''),
    changed ? fitted : null
  )
}
function drawRadar(a, b, first, second, fitted) {
  const change = fitted ? a.findIndex((v, i) => v !== fitted[i]) : -1
  let movement = ''
  if (change >= 0) {
    const [x, y] = point(change, a[change])
    const [oldX, oldY] = point(change, fitted[change])
    const direction = a[change] > fitted[change] ? 'up' : 'down'
    movement = `<g class="dial-change" data-direction="${direction}"><path d="M${oldX} ${oldY}L${x} ${y}"/><circle cx="${x}" cy="${y}" r="5.8"/></g>`
  }
  const axis = labels
    .map((label, i) => {
      const [x, y] = point(i, 1),
        [lx, ly] = point(i, 1.17)
      const anchor = i === 0 || i === 3 ? 'middle' : i < 3 ? 'start' : 'end'
      return (
        '<path d="M130 84L' +
        x +
        ' ' +
        y +
        '"/><text x="' +
        lx +
        '" y="' +
        (ly + 4) +
        (i === change ? '" class="dial-active-axis' : '') +
        '" text-anchor="' +
        anchor +
        '">' +
        label +
        '</text>'
      )
    })
    .join('')
  return (
    '<div class="chart"><svg viewBox="0 0 260 169" role="img" aria-label="' +
    labels
      .map(
        (x, i) =>
          x +
          ' out of 100. ' +
          first +
          ' ' +
          Math.round(a[i] * 100) +
          (second ? ', ' + second + ' ' + Math.round(b[i] * 100) : '')
      )
      .join('. ') +
    '"><g class="grid">' +
    [0.25, 0.5, 0.75, 1].map((r) => '<polygon points="' + shape(Array(6).fill(r)) + '"/>').join('') +
    axis +
    '</g>' +
    (second ? '<polygon class="theirs" points="' + shape(b) + '"/>' : '') +
    '<polygon class="mine" points="' +
    shape(a) +
    '"/>' +
    a
      .map((v, i) => {
        const [x, y] = point(i, v)
        return '<circle cx="' + x + '" cy="' + y + '" r="2.7"/>'
      })
      .join('') +
    movement +
    '</svg><div class="legend"><span>' +
    first +
    '</span>' +
    (second ? '<span>' + second + '</span>' : '') +
    '</div></div>'
  )
}
