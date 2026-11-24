import { parts, slots, partFor, comparePart, partReading } from './catalog.js'
import { icon } from './icons.js'
import { partArt } from './part-art.js'
import { loadoutRadar } from './radar.js'

const coins = (n) => icon('coin', 19) + '<b>' + n + '</b>'
export const wallet = (amount) =>
  '<span class="wallet-chip" aria-label="' + amount + ' coins">' + coins(amount) + '</span>'

export function inventory(build, activeSlot) {
  return (
    '<div class="loadout-list"><strong>On your bot</strong>' +
    slots
      .map(({ id, short, icon: glyph }) => {
        const fitted = build[id] >= 0,
          item = partFor(id, build[id])
        return (
          '<div class="gear-row"' +
          (id === activeSlot ? ' data-selected' : '') +
          '>' +
          icon(glyph, 17) +
          '<span><small>' +
          short +
          '</small><b>' +
          (fitted ? item.name : 'Empty') +
          '</b></span>' +
          (fitted
            ? '<button data-sell="' +
              id +
              '" aria-label="Sell ' +
              item.name +
              ' for ' +
              item.price +
              ' coins">Sell ' +
              coins(item.price) +
              '</button>'
            : '<i>—</i>') +
          '</div>'
        )
      })
      .join('') +
    '</div>'
  )
}
export function partShelf(build, shelf, choice, bank, canSpeak, paintId) {
  const id = shelf.id,
    fitted = build[id],
    item = parts[id][choice]
  const categories = slots
    .map(
      (s) =>
        '<button data-slot="' +
        s.id +
        '" aria-pressed="' +
        (s.id === id) +
        '">' +
        icon(s.icon, 21) +
        s.short +
        '</button>'
    )
    .join('')
  const cards = parts[id]
    .map(
      (p, i) =>
        '<button class="kit-card" data-choice="' +
        i +
        '" aria-pressed="' +
        (i === choice) +
        '" aria-label="' +
        partReading(id, i, fitted).slice(0, 2).join(' ') +
        (fitted === i ? ' Equipped.' : '') +
        '">' +
        (fitted === i ? '<i class="fitted-mark" aria-label="Equipped">' + icon('check', 15) + '</i>' : '') +
        partArt(id, i, build.chassis, paintId) +
        '<b>' +
        p.name +
        '</b><span>' +
        coins(p.price) +
        '</span></button>'
    )
    .join('')
  const reason =
    choice === fitted
      ? 'Equipped'
      : fitted >= 0
        ? 'Sell ' + partFor(id, fitted).name + ' first'
        : bank < item.price
          ? 'Not enough coins'
          : ''
  const { stat, gain, from, to, delta } = comparePart(id, choice, fitted)
  const installed = choice === fitted
  const amount = installed ? gain : delta
  const change = amount > 0 ? '+' + amount : amount < 0 ? '−' + Math.abs(amount) : 'Same'
  const forecast = installed ? to + ' on your bot' : from + ' → ' + to
  return (
    '<div class="shelf-head"><h2 id="bay-title" tabindex="-1">Parts</h2>' +
    wallet(bank) +
    '</div><div class="shelf-tabs">' +
    categories +
    '</div>' +
    '<div class="kit-select">' +
    cards +
    '</div><article class="shop-detail"><div class="kit-title"><h3>' +
    item.name +
    '</h3>' +
    (canSpeak
      ? '<button class="speak-part" data-act="hear" aria-label="Read this part aloud">' +
        icon('sound', 23) +
        '</button>'
      : '') +
    '</div>' +
    '<div class="stat-ticket" data-change="' + (amount < 0 ? 'down' : 'up') + '"><strong>' +
    change +
    ' ' +
    stat +
    '</strong><span>' +
    forecast +
    '</span></div><p>' +
    item.description +
    '</p></article>' +
    '<div class="kit-actions"><button data-act="try-part" class="kit-test">' +
    icon('flag', 20) +
    (installed ? ' Test without' : ' Test drive') + '</button><button data-act="fit" class="kit-equip" ' +
    (reason ? 'disabled' : '') +
    '>' +
    (reason || 'Buy ' + coins(item.price)) +
    '</button></div>'
  )
}
export function previewStats(before, after, rival, name, compare, activeSlot) {
  const chart = loadoutRadar(before, after, rival, compare ? name : '')
  return (
    '<div class="dial-graph">' +
    chart +
    '<button class="rival-toggle" data-act="rival-radar" aria-pressed="' +
    compare +
    '">' +
    icon('scan', 17) +
    (compare ? 'Show fitted' : 'See rival') +
    '</button></div>' +
    inventory(before, activeSlot)
  )
}
