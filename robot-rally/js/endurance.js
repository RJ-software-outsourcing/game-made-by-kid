import {escapeText} from './markup.js'
// A robot with a sliver of endurance is still in play. At the bell, show
// extra decimals only if whole percentages would hide the winning margin.
export const endurancePercent = (p, decimals = 0) => {
  if (p.hp <= 0) return 0
  const precision = 10 ** decimals
  return Math.min(100, Math.max(1, Math.round((100 * precision * p.hp) / p.s.hp)) / precision)
}

export function finishPrecision(match) {
  if (match.winner === null || match.winner === 2) return 0
  const [a, b] = match.robots
  for (let places = 0; places < 3; places++) {
    if (endurancePercent(a, places) !== endurancePercent(b, places)) return places
  }
  return 3
}

export function finishCaption(match, rival, ownName = 'Your bot') {
  const [own, other] = match.robots
  if (own.hp === 0 && other.hp === 0) return 'Both bots ran out of health together.'
  if (own.hp === 0) return ownName + ' ran out of health first.'
  if (other.hp === 0) return rival + ' ran out of health first.'
  if (match.winner === 2) return 'Time! Both bots have the same health left.'
  return 'Time! ' + (match.winner === 0 ? ownName : rival) + ' has more health left.'
}

export function finishPanel(final, names) {
  const places = finishPrecision(final)
  return `<div class="finish-endurance"><p>${escapeText(finishCaption(final,names[1],names[0]))}</p>
    <div>${final.robots
      .map(
        (p, i) => `<span><b>${escapeText(names[i])}</b><strong>${endurancePercent(p, places)}%</strong>
      <i aria-hidden="true" style="--fill:${p.hp / p.s.hp}"></i></span>`
      )
      .join('')}</div></div>`
}
