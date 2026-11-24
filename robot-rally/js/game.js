import {
  slots,
  parts,
  rounds,
  cupRound,
  frames,
  cost,
  partFor,
  withPart,
  buyPart,
  sellPart,
  cleanName,
  limitNameInput,
  botName as nameOf,
  ringName,
  readPart
} from './catalog.js'
import {
  readCup,
  freshCup,
  saveCup,
  saveAudio,
  isAhead,
  isCupKey,
  isAudioKey,
  garageReceipts
} from './progress.js'
import { createMatch, roundSeed, step, STEP } from './match.js'
import { finishPanel } from './endurance.js'
import {
  openingScore,
  trialTicks,
  trialRun,
  trialScore,
  trialDetail,
  trialSummary,
  sampleRoute,
  routeMap
} from './trial-report.js'
import { cheapestWin, rememberWin } from './savings.js'
import { deviceTest, deviceReport, deviceCsv } from './device-test.js'
import { View, studioLight, cameras } from './view.js'
import { FightLog } from './fight-log.js'
import { Scoreboard } from './scoreboard.js'
import { Announcer } from './announcer.js'
import { PartReader } from './part-reader.js'
import { RallyAudio } from './audio.js'
import { raceResume } from './checkpoint.js'
import { escapeText } from './markup.js'
import { icon } from './icons.js'
import { partShelf, previewStats, wallet } from './equipment.js'
import { paints, paintById } from './palette.js'
import { radar, compareLine } from './radar.js'
import { findPitTip } from './pit-tip.js'
import { coachingTip, attemptSummary, compareAttempts } from './coach.js'
import { explainMoment, findMatchMoment, replayMoment } from './replay.js'
import { ReplayTrails } from './replay-trails.js'
import { draw as tournamentDraw } from './tournament-draw.js'
import { offlineSupport } from './offline.js'

const $ = (id) => document.getElementById(id)
function store(kind) {
  try {
    return window[kind]
  } catch {
    return null
  }
}
const disk = store('localStorage'),
  session = store('sessionStorage')
const receipt = garageReceipts(disk)
let cup = readCup(disk),
  view,
  mode = 'body',
  slot = 'weapon',
  choice = 0,
  trying = false,
  rivalRadar = false
let match,
  matchStage,
  accumulator = 0,
  countdown = 0,
  resultTimer = 0,
  paused = false,
  replaying = false
let highlight = null
let practice = null,
  savedResult = null,
  offer = null,
  modal = '',
  modalFocus,
  paths = false,
  pathRenderer,
  toastTimer
const round = () => cupRound(cup)
const audio = new RallyAudio(),
  recovery = raceResume(session, disk)
const partReader = new PartReader(audio)
const announcer = new Announcer(audio, $('announcer-caption'))
const board = new Scoreboard($('scores'), $('clock'), (side) => camera(view.teamCamera(side)))
const fightLog = new FightLog($('fight-log'))
const paintKey = 'robot-rally.enamel.v1'

let enamel = paintById('night')
try {
  enamel = paintById(disk.getItem(paintKey)) || enamel
} catch {}
const marks = (name, size = 19) => icon(name, size)
const btn = (action, label, cls = 'soft') =>
  '<button class="' + cls + '" data-act="' + action + '">' + label + '</button>'
const money = (amount) => '<span class="credit">' + marks('coin', 16) + amount + ' coins</span>'
const text = (id, value) => {
  const node = $(id)
  if (node.textContent !== String(value)) node.textContent = value
}
const listenButton = () => (window.speechSynthesis ? btn('hear', marks('sound', 16) + ' Hear it') : '')
let benchmark = null,
  lastDeviceReport = null,
  photoUrl = null
let voiceGeneration = 0
let spoken = ''
function hear(line) {
  if (!line || cup.muted || !window.speechSynthesis) return
  partReader.stop()
  speechSynthesis.cancel()
  const generation = ++voiceGeneration
  const u = new SpeechSynthesisUtterance(line)
  u.lang = 'en-US'
  u.rate = 0.86
  const v = speechSynthesis.getVoices().find((v) => v.lang === 'en-US')
  if (v) u.voice = v
  u.onstart = () => {
    if (generation === voiceGeneration) audio.narration(true)
  }
  u.onend = u.onerror = () => {
    if (generation === voiceGeneration) audio.narration(false)
  }
  speechSynthesis.speak(u)
}
function hearPart() {
  if (cup.muted) {
    toast('Sound is off')
    return
  }
  silenceVoice()
  const generation = voiceGeneration
  partReader.play(slot, choice, cup.build[slot]).then((played) => {
    if (!played && generation === voiceGeneration && mode === 'pick' && !modal)
      hear(readPart(slot, choice, cup.build[slot]))
  })
}
function silenceVoice() {
  partReader.stop()
  voiceGeneration++
  window.speechSynthesis?.cancel()
  audio.narration(false)
}
function toast(line) {
  text('toast', line)
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => text('toast', ''), 2400)
}
function soundState() {
  audio.mute(cup.muted)
  if (cup.muted) {
    announcer.stop()
    silenceVoice()
  }
  $('sound').innerHTML = marks(cup.muted ? 'mute' : 'sound')
  $('sound').setAttribute('aria-label', cup.muted ? 'Turn sound on' : 'Mute sound')
}
function soundToggle() {
  cup.muted = !cup.muted
  soundState()
  audio.unlock()
  saveAudio(disk, cup)
}
function preview() {
  return mode === 'pick' && trying ? withPart(cup.build, slot, choice) : cup.build
}
function draw() {
  const r = round(),
    b = preview(),
    home = mode === 'home'
  $('home').hidden = !home
  $('bay').hidden = home
  const bank = r.budget - cost(cup.build)
  $('garage').dataset.mode = mode
  const fitting = mode === 'pick' || mode === 'parts'
  $('equipment-dial').hidden = !fitting
  if (fitting) $('equipment-dial').innerHTML = previewStats(cup.build, b, r.build, r.rival, rivalRadar, slot)
  $('wallet').innerHTML = wallet(bank)
  $('wallet').setAttribute('aria-label', bank + ' coins left from a ' + r.budget + ' coin budget')
  text('round-name', cup.champion ? 'Cup champion' : 'Round ' + (cup.round + 1) + ' of 4 · ' + r.stage)
  text('bot-name', nameOf(b))
  $('trying-part').hidden = !(mode === 'pick' && trying && cup.build[slot] !== choice)
  if (!$('trying-part').hidden) text('trying-part', 'Trying ' + partFor(slot, choice).name)
  text('rival-name', r.rival)
  $('inspect').setAttribute('aria-label', 'Scout ' + r.rival)
  text('rival-habit', r.habit)
  document.querySelector('#home .eyebrow').textContent = cup.champion ? 'FINAL RIVAL' : 'NEXT RIVAL'
  $('rival-dial').hidden = !home
  if (home) {
    $('cup-draw').innerHTML = '<h3>Tournament Bracket</h3>' + bracketTree()
    $('rival-dial').innerHTML =
      radar(b, r.build, r.rival) + '<p class="chart-clue">' + compareLine(b, r.build, r.rival) + '</p>'
  }
  $('battle-start').innerHTML = cup.champion
    ? 'Winner’s podium ' + marks('trophy')
    : offer
      ? 'Resume match ' + marks('play')
      : 'Start bout ' + marks('flag')
  for (const n of $('dock').children)
    n.setAttribute(
      'aria-pressed',
      String(
        (mode === 'home' && n.dataset.nav === 'battle') ||
          n.dataset.nav === mode ||
          (n.dataset.nav === 'parts' && mode === 'pick')
      )
    )
  if (!home) drawBay(b)
  view?.setRobots(b, r, cup.champion)
  if (view) {
    view.bodyCards.open(mode === 'body' ? b : null, enamel[2], $('bay'))
    view.previewPart(mode === 'pick' ? slot : null)
    view.resizePending = true
    view.wakeShop()
  }
}
function bayHead(title) {
  return (
    '<div class="shelf-head"><h2 id="bay-title" tabindex="-1">' +
    title +
    '</h2>' +
    wallet(round().budget - cost(cup.build)) +
    '</div>'
  )
}
function drawBay(b) {
  const bank = round().budget - cost(cup.build)
  let html = '',
    footer = '',
    detail = ''
  if (mode === 'pick' || mode === 'parts') {
    const shelf = slots.find((s) => s.id === slot)
    const reading = readPart(slot, choice, cup.build[slot])
    if (spoken && reading !== spoken) silenceVoice()
    spoken = reading
    html = partShelf(cup.build, shelf, choice, bank, true, enamel[0])
  } else if (mode === 'body') {
    const displayOrder = [3, 4, 5, 0, 1, 2]
    html =
      bayHead('Choose a body') +
      '<div class="frame-options" role="group" aria-label="Six robot bodies">' +
      displayOrder
        .map((i) => {
          const frame = frames[i]
          return (
            '<button class="frame-option" data-frame="' +
            i +
            '" aria-pressed="' +
            (b.chassis === i) +
            '"><i class="body-art" style="--body-x:' +
            i * 20 +
            '%"></i><strong>' +
            frame.name +
            '</strong></button>'
          )
        })
        .join('') +
      '</div><p class="body-note">' +
      frames[b.chassis ?? 0].note +
      ' Every part fits.</p>'
  } else if (mode === 'paint') {
    html =
      bayHead('Paint shop', 'home') +
      '<p class="panel-note">Tap a color to paint your bot.</p><div class="paints">' +
      paints
        .map(
          (p) =>
            '<button data-paint="' +
            p[0] +
            '" class="paint-choice" aria-pressed="' +
            (enamel === p) +
            '"><i class="swatch" style="--paint:' +
            p[2] +
            ';--coat:' +
            p[3] +
            '"></i>' +
            p[1] +
            '</button>'
        )
        .join('') +
      '</div>'
  }
  $('bay').innerHTML = html + detail + footer
}
function changeMode(next, selectedSlot) {
  const previous = mode
  clearTimeout(toastTimer)
  text('toast', '')
  silenceVoice()
  trying = false
  mode = next === 'parts' ? 'pick' : next === 'battle' ? 'home' : next
  if (selectedSlot) {
    slot = selectedSlot
    choice = Math.max(0, cup.build[slot])
  }
  draw()
  if (mode === 'home' && !cup.champion && !offer && cup.announcer)
    announcer.warmOpening(ringName(cup.build, round().rival), round().rival)
  if (selectedSlot) {
    view?.facePart(slot)
    if (cup.voice) hearPart()
  }
  if (next !== 'home') $('bay-title')?.focus({ preventScroll: true })
  else
    $('dock')
      .querySelector('[data-nav="' + (previous === 'pick' ? 'parts' : previous) + '"]')
      ?.focus({ preventScroll: true })
}
async function editGarage(choose, after) {
  const edition = cup.edition,
    stage = cup.round,
    champion = cup.champion
  function applyReceipt() {
    if (match || benchmark || cup.edition !== edition || cup.round !== stage || cup.champion !== champion)
      return
    const result = receipt(cup, choose)
    cup = result.cup
    if (result.applied) after()
    else {
      offer = recovery.findMatch(cup)
      draw()
      toast('Your garage has been updated')
    }
  }
  // Installed games share this lock across windows. Local-network HTTP
  // still rechecks the latest affordable loadout on each individual tap.
  let entered = false
  try {
    if (navigator.locks) {
      await navigator.locks.request('robot-rally.garage', () => {
        entered = true
        applyReceipt()
      })
      return
    }
  } catch (error) {
    if (entered) throw error
  }
  applyReceipt()
}
function apply() {
  const id = slot,
    item = choice
  return editGarage(
    (build, budget) => buyPart(build, id, item, budget),
    () => {
      audio.play('equip')
      changeMode('parts')
      $('bay').querySelector('[data-choice="' + item + '"]')?.focus({ preventScroll: true })
      view?.facePart(id)
      toast(parts[id][item].name + ' fitted')
    }
  )
}
function show(type, kicker, title, body, close = true) {
  if (!$('overlay').open) modalFocus = document.activeElement
  if (view?.mode === 'shop') view.freeze(true)
  modal = type
  $('overlay').dataset.type = type
  text('modal-kicker', kicker)
  text('modal-title', title)
  $('modal-body').innerHTML = body
  $('dismiss').hidden = !close
  $('hear-result').hidden = type !== 'result' || !window.speechSynthesis || cup.muted
  $('overlay').setAttribute('aria-labelledby', 'modal-title')
  if (!$('overlay').open) $('overlay').showModal()
}
function hide() {
  modal = ''
  delete $('overlay').dataset.type
  delete $('overlay').dataset.keyboard
  if (view?.mode === 'shop') view.freeze(false)
  if ($('overlay').open) $('overlay').close()
  silenceVoice()
  if (modalFocus?.isConnected) modalFocus.focus({ preventScroll: true })
}
function closeModal() {
  if (modal === 'practice') {
    endPractice()
    return
  }
  if (modal === 'pause') {
    resumePlay()
    return
  }
  if (modal === 'result') {
    backToGarage()
    return
  }
  if (modal === 'recovery') {
    hide()
    return
  }
  hide()
}
function scout() {
  const r = round()
  spoken = r.rival + '. ' + r.habit + ' ' + r.hint
  show(
    'scout',
    'RIVAL SCOUT',
    r.rival,
    '<p class="copy">' +
      r.habit +
      ' ' +
      r.hint +
      '</p><div class="scout-list">' +
      slots
        .map(
          (s) =>
            '<div class="spec-row"><span>' +
            s.short +
            '</span><b>' +
            partFor(s.id, r.build[s.id]).name +
            '</b></div>'
        )
        .join('') +
      '</div><div class="summary-line"><span class="small">Same budget as you</span>' +
      money(r.budget) +
      '</div><div class="modal-row">' +
      listenButton() +
      btn('scout-parts', 'Pick parts', 'dark-action') +
      '</div>'
  )
}
function cupMap() {
  const stops = rounds
    .map((r, i) => {
      const win = cup.wins[i],
        done = cup.champion || i < cup.round
      const status = done ? marks('check') + ' Won' : i === cup.round ? 'Up next' : marks('flag', 16)
      const stop =
        '<span><small>' + r.stage + '</small><br><b>' + r.rival + '</b></span><span>' + status + '</span>'
      return win
        ? '<button class="cup-stop" data-win="' + i + '">' + stop + '</button>'
        : '<div class="cup-stop ' + (cup.round === i ? 'current' : '') + '">' + stop + '</div>'
    })
    .join('')
  show(
    'cup',
    'KNOCKOUT TOURNAMENT',
    'Bolt Cup',
    '<div class="cup-track">' +
      stops +
      '</div><p class="copy">Win to move up and earn a bigger budget. You can try each rival again.</p>' +
      '<div class="modal-row">' +
      btn('bracket', 'All matches') +
      btn('close', 'Back to garage', 'dark-action') +
      '</div>'
  )
}
function winningBuild(stage) {
  const r = rounds[stage],
    record = cup.wins[stage]
  if (!record) return cupMap()
  const best = cheapestWin(disk, stage, cupRound(cup, stage).budget)
  const detail = slots
    .map(
      (s) =>
        '<div class="spec-row"><span>' +
        s.short +
        '</span><b>' +
        partFor(s.id, record.build[s.id]).name +
        '</b></div>'
    )
    .join('')
  show(
    'winning-build',
    r.stage.toUpperCase(),
    nameOf(record.build) + ' beat ' + r.rival,
    '<div class="summary-line"><span class="small">Winning build</span>' +
      money(cost(record.build)) +
      '</div><div class="scout-list">' +
      detail +
      '</div>' +
      (best ? '<p class="small">Your lowest winning price here is ' + best.price + ' coins.</p>' : '') +
      btn('cup', 'Back to cup', 'dark-action')
  )
}
function bracketTree() {
  const columns = tournamentDraw
    .map((fixtures, stage) => {
      const matches = fixtures
        .map((f, index) => {
          const mine = index === 0,
            active = mine && stage === cup.round && !cup.champion
          const played = cup.champion || stage < cup.round
          const entrant = (name, side) => {
            const known = stage <= cup.round || cup.champion
            const label = known ? (name === 'Your bot' ? ringName(cup.build, f.right) : name) : '—'
            return (
              '<div class="' +
              (known && played && name === f.winner ? 'advanced' : '') +
              '">' +
              escapeText(label) +
              (known && played && name === f.winner ? ' ✓' : '') +
              '</div>'
            )
          }
          return (
            '<div class="draw-pair ' +
            (active ? 'fight-now' : '') +
            '"><div class="draw-bots">' +
            entrant(f.left, 0) +
            entrant(f.right, 1) +
            '</div></div>'
          )
        })
        .join('')
      return (
        '<section class="draw-round"><h3>' +
        ['Round of 16', 'Quarterfinal', 'Semifinal', 'Final'][stage] +
        '</h3><div class="draw-pairs">' +
        matches +
        '</div></section>'
      )
    })
    .join('')
  return '<div class="draw-tree">' + columns + '</div>'
}
function bracketScreen() {
  show(
    'bracket',
    'ROUND ' + (cup.round + 1) + ' OF 4 · ' + round().stage.toUpperCase(),
    'Tournament Bracket',
    bracketTree() +
      '<div class="bracket-start"><b>' +
      escapeText(ringName(cup.build, round().rival)) +
      ' vs ' +
      round().rival +
      '</b>' +
      btn(
        cup.champion ? 'close' : 'enter-ring',
        cup.champion ? 'Done' : 'Start bout ' + marks('flag'),
        'dark-action'
      ) +
      '</div>'
  )
}
function help() {
  const steps = [
    'Pick a <b>body</b> and a <b>color</b>. Name your bot.',
    '<b>Scout</b> your rival. Sell a part to get its coins back. Buy a part for an empty slot.',
    'Tap <b>Battle</b>. Your brain steers. Tap <b>Paths</b> to see dashes and dodges.',
    'The top bar shows health. When the gold bar refills to the white mark, your bot has power again.',
    'Win four rounds to take the cup!'
  ]
  spoken = steps.join(' ').replace(/<\/?b>/g, '')
  show(
    'help',
    'PIT GUIDE',
    'How to play',
    '<ol class="instructions"><li>' + steps.join('</li><li>') + '</li></ol><div class="modal-row">' +
      btn('game-options', marks('wrench', 16) + ' Options') +
      listenButton() +
      btn('close', 'Got it', 'dark-action') +
      '</div>'
  )
}
function options() {
  const full = Boolean(document.fullscreenElement || document.webkitFullscreenElement)
  const canFull =
    document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen
  const status = offline?.state
  show(
    'options',
    'PIT GUIDE',
    'Game options',
    '<div class="modal-row">' +
      btn('announcer-option', marks('audio') + (cup.announcer ? ' Announcer on' : ' Announcer off')) +
      btn('sound-option', marks(cup.muted ? 'mute' : 'sound') + (cup.muted ? ' Sound off' : ' Sound on')) +
      (canFull ? btn('full', full ? 'Leave full screen' : 'Full screen') : '') +
      '</div>' +
      btn('read-parts', marks('book') + (cup.voice ? ' Read parts aloud · On' : ' Read parts aloud · Off')) +
      '<p class="copy">Check this device with the same short match in all five camera views.</p>' +
      btn('run-check', marks('camera') + ' Run device check', 'dark-action') +
      (lastDeviceReport ? btn('show-check', 'Last results') : '') +
      (status
        ? '<p class="small">' +
          {
            ready: 'Ready to play offline.',
            preparing: 'Saving the game for offline play.',
            retry: 'Offline download is waiting.'
          }[status] +
          '</p>'
        : '')
  )
}
function beginCheck() {
  hide()
  delete $('battle').dataset.finish
  $('victory-call').hidden = true
  fightLog.reset(['Test bot', round().rival])
  $('garage').hidden = true
  $('battle').hidden = false
  $('countdown').hidden = true
  $('camera').disabled = $('tactics').disabled = true
  $('pause').setAttribute('aria-label', 'Stop device check')
  $('pause').innerHTML = marks('close')
  $('practice-label').hidden = false
  benchmark = deviceTest({
    view,
    scores: board,
    sound: audio,
    label: (line, cam) => {
      text('practice-label', line)
      $('camera').lastElementChild.textContent = cam
      board.camera(-1, true)
    },
    done: finishCheck
  })
}
function finishCheck(report, note) {
  syncGarage()
  benchmark?.stop()
  benchmark = null
  $('camera').disabled = $('tactics').disabled = false
  $('pause').setAttribute('aria-label', 'Pause match')
  $('pause').innerHTML = marks('pause')
  $('practice-label').hidden = true
  $('battle').hidden = true
  $('garage').hidden = false
  view.exit(cup.build, round(), cup.champion)
  draw()
  if (report) {
    lastDeviceReport = report
    showCheck()
  } else if (note)
    show(
      'check',
      'DEVICE CHECK',
      'Check stopped',
      '<p class="copy">' + note + '</p>' + btn('close', 'Back to garage', 'dark-action')
    )
  else options()
}
function showCheck() {
  show(
    'check',
    'DEVICE CHECK',
    'Frame timing',
    deviceReport(lastDeviceReport) +
      '<div class="modal-row">' +
      btn('save-check', 'Save CSV') +
      btn('close', 'Done', 'dark-action') +
      '</div>'
  )
}
function exportCheck() {
  const url = URL.createObjectURL(
      new Blob([deviceCsv(lastDeviceReport)], { type: 'text/csv;charset=utf-8' })
    ),
    a = document.createElement('a')
  a.href = url
  a.download = 'bolt-cup-frame-timing.csv'
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
function practiceResult() {
  paused = true
  view.freeze(true)
  audio.ambience(false)
  const id = practice.slot
  const oldPart = partFor(id, practice.fitted[id]).name,
    newPart = partFor(id, practice.build[id]).name
  const same = oldPart === newPart
  const seen = trialScore(match, practice.run)
  const other = same ? seen : openingScore(practice.candidate ? practice.fitted : practice.build, matchStage)
  const [before, after] = practice.candidate ? [other, seen] : [seen, other]
  const pair = practice.secondSlot
  const rows = trialDetail(pair ? 'pair' : id, before, after)
  const short = before.seconds < 8 || after.seconds < 8
  const column = (which, name, v) =>
    `<div class="trial-column"><small>${which}${short ? ' · ' + v.seconds + ' sec' : ''}</small><b>${name}</b>${routeMap(v.route)}${rows.map((row) => '<span>' + row(v) + '</span>').join('')}</div>`
  const summary = trialSummary(pair ? 'pair' : id, before, after, oldPart, newPart)
  const names = (build) => [id, pair].map((s) => partFor(s, build[s]).name).join(' + ')
  show(
    'practice',
    '8-SECOND TEST DRIVE',
    pair ? 'Two-part test' : practice.candidate ? newPart : oldPart,
    '<p class="copy">' +
      summary +
      '</p><div class="trial-columns">' +
      column('Fitted', pair ? names(practice.fitted) : oldPart, before) +
      (same ? '' : column(pair ? 'Try both' : practice.build[id] < 0 ? 'Empty slot' : 'Try-on',
        pair ? names(practice.build) : newPart, after)) +
      '</div><div class="modal-row">' +
      (same ? '' : btn('other-trial', pair ? (practice.candidate ? 'Watch fitted bot' : 'Watch both changes') : practice.candidate ? 'Watch fitted part' :
        practice.build[id] < 0 ? 'Watch empty slot' : 'Watch new part')) +
      (pair ? btn('second-shelf', slots.find((s) => s.id === pair).short) : '') +
      btn('end-trial', pair ? slots.find((s) => s.id === id).short : 'Back to part', 'dark-action') +
      '</div>',
    false
  )
}
function endPractice(shelf = practice.slot) {
  syncGarage()
  const t = practice
  practice = null
  hide()
  match = null
  paused = false
  audio.ambience(false)
  if (pathRenderer) pathRenderer.group.visible = false
  $('battle').hidden = true
  $('garage').hidden = false
  view.exit(cup.build, round(), cup.champion)
  mode = 'pick'
  slot = shelf
  const removed = t.build[slot] < 0
  choice = Math.max(0, removed ? cup.build[slot] : t.build[slot])
  trying = !removed
  draw()
  view.facePart(slot)
  $('bay').querySelector('[data-choice="' + choice + '"]')?.focus({ preventScroll: true })
}
function testPart(id, candidate) {
  const fitted = { ...cup.build }
  return startRace(null, false, { slot: id, build: withPart(fitted, id, candidate), fitted, candidate: true })
}
function practiceCaption() {
  if (!practice || !match) return
  const { slot, candidate, secondSlot, fitted } = practice
  const choice = match.robots[0].build[slot]
  let label
  if (secondSlot) label = candidate ? 'Trying both changes' : 'Fitted bot'
  else if (candidate && choice < 0) label = 'Without ' + partFor(slot, fitted[slot]).name
  else label = (candidate ? 'Trying ' : 'Fitted ') + partFor(slot, choice).name
  const dots = view.weaponTrial && paths && view.cam !== 4
  text('practice-label', 'Test drive · ' + label + (dots ? ' · Dots show reach' : ''))
}
function camera(label) {
  $('camera').lastElementChild.textContent = label
  board.camera(view.cam === 4 ? view.onboardSide : -1)
  audio.perspective(view.cam)
  practiceCaption()
}
function setPaths(on, reset = false) {
  paths = on
  if (!pathRenderer) {
    pathRenderer = new ReplayTrails()
    view.arena.add(pathRenderer.group)
  }
  if (reset) pathRenderer.reset(match, on)
  pathRenderer.group.visible = on
  if (on && !reset) pathRenderer.draw()
  view.showRoutes = on
  $('tactics').setAttribute('aria-pressed', String(on))
  practiceCaption()
}
function startRace(resumed = null, asReplay = false, trial = null) {
  if (!view) return
  hide()
  if (!trial) offer = null
  mode = 'home'
  replaying = asReplay
  practice = trial
  matchStage = asReplay ? savedResult.stage : cup.round
  const r = rounds[matchStage],
    b = trial
      ? trial.candidate
        ? trial.build
        : trial.fitted
      : asReplay
        ? savedResult.build
        : resumed?.build || cup.build
  if (view.mode === 'arena') view.releaseArenaModels()
  const paint = paintById(asReplay ? savedResult.paint : resumed?.paint) || enamel
  view.setPaint(paint[2])
  view.setRobots(b, r, false)
  match = createMatch(b, r.build, roundSeed(matchStage), asReplay ? savedResult.rules : resumed?.rules)
  match.paint = paint[0]
  if (trial) {
    trial.run = trialRun()
    sampleRoute(match, trial.run)
  }
  countdown = trial ? 0.55 : resumed?.tick ? 0 : 2.3
  accumulator = 0
  resultTimer = 0
  paused = false
  $('garage').hidden = true
  $('battle').hidden = false
  $('countdown').hidden = !countdown
  text('countdown', 'Ready?')
  fightLog.reset([ringName(b, r.rival), r.rival])
  delete $('battle').dataset.finish
  $('victory-call').hidden = true
  board.reset(r.rival, ringName(b, r.rival))
  board.update(match)
  view.enter(match)
  view.openingTime = trial ? 0 : countdown
  camera(cameras[0])
  setPaths(!!trial, true)
  audio.unlock()
  announcer.reset(!trial && cup.announcer, [ringName(b, r.rival), r.rival], match.time, {
    archetype: frames[b.chassis ?? 0].name
  })
  if (resumed?.tick) {
    const recent = []
    while (match.tick < resumed.tick && match.winner === null) {
      step(match)
      announcer.update(match, true)
      for (const event of match.events) fightLog.add(event, match.time, recent)
      if (match.tick % 3 === 0) pathRenderer.record(match)
      if (match.tick > resumed.tick - 90) view.scuffs.record(match)
    }
    for (const row of recent) fightLog.append(row)
    view.weaponEffects.resume(match, view.labelModels)
    board.update(match)
  }
  if (trial) {
    if (trial.slot === 'lens') view.showLensTrial()
    if (trial.slot === 'weapon' || trial.secondSlot === 'weapon') view.showWeaponTrial(match.robots[0])
    view.cam = 2
    view.cameraSnap = true
    camera(cameras[2])
  }
  $('practice-label').hidden = !trial
  audio.ambience(true)
  if (!resumed?.tick) audio.play('start')
  if (!trial && !resumed?.tick) announcer.opening()
  if (!asReplay && !trial) {
    if (match.winner === null) recovery.save(cup, match)
    else finishBout()
  }
}
function startHighlight() {
  const moment = (savedResult.moment ??= findMatchMoment(match))
  if (!moment) {
    toast('This match had no hits to replay.')
    return
  }
  const final = match
  const clip = replayMoment(final, moment, final.seed)
  highlight = { ...clip, final }
  replaying = true
  paused = false
  accumulator = 0
  countdown = 0
  hide()
  match = clip.match
  delete $('battle').dataset.finish
  $('victory-call').hidden = true
  fightLog.reset([ringName(match.robots[0].build, rounds[matchStage].rival), rounds[matchStage].rival])
  view.enter(match)
  view.replaySpeed = 0.5
  view.weaponEffects.resume(match, view.labelModels)
  const [a, b] = match.robots
  view.ringsideYaw = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2 + 0.14
  camera(cameras[0])
  setPaths(false, true)
  $('countdown').hidden = true
  $('practice-label').hidden = false
  text('practice-label', 'Key move · Half speed')
  $('pause').setAttribute('aria-label', 'End key move')
  $('pause').innerHTML = marks('close')
  audio.ambience(true)
  announcer.reset(false)
  board.update(match)
}
function finishHighlight() {
  match = highlight.final
  highlight = null
  accumulator = 0
  audio.ambience(false)
  view.enter(match)
  view.victoryTime = 5.65
  $('battle').dataset.finish = finishState()
  fightLog.finish(match.winner, match.time)
  camera(cameras[0])
  setPaths(false, true)
  $('pause').setAttribute('aria-label', 'Pause match')
  $('pause').innerHTML = marks('pause')
  $('practice-label').hidden = true
  board.update(match)
  resultScreen()
}
function frame(dt) {
  if (benchmark) {
    benchmark.advance()
    return
  }
  if (!match || paused || view.mode !== 'arena') return
  if (practice && (match.tick >= trialTicks || match.winner !== null)) {
    practiceResult()
    return
  }
  if (highlight && (match.tick >= highlight.until || match.winner !== null)) {
    highlight.hold = (highlight.hold || 0) + dt
    if (highlight.hold > 0.85) finishHighlight()
    return
  }
  if (match.winner !== null) {
    resultTimer += dt
    if (
      resultTimer >= Math.max(announcer.resultDelay || 1.05, match.winner === 0 ? 5.65 : 2.7) &&
      !$('overlay').open
    )
      resultScreen()
    return
  }
  if (countdown > 0) {
    countdown = Math.max(0, countdown - dt)
    if (view.openingTime) view.openingTime = countdown
    text('countdown', countdown > 1.35 ? 'Ready?' : countdown > 0.55 ? 'Set…' : 'Go!')
    $('countdown').hidden = !countdown
    return
  }
  accumulator += dt * (highlight ? 0.5 : 1)
  while (
    accumulator >= STEP &&
    match.winner === null &&
    (!highlight || match.tick < highlight.until) &&
    (!practice || match.tick < trialTicks)
  ) {
    accumulator -= STEP
    step(match)
    if (practice) sampleRoute(match, practice.run)
    if (match.tick % 3 === 0) pathRenderer.record(match)
    view.scuffs.record?.(match)
    if (highlight && match.tick === highlight.moment.tick)
      text(
        'practice-label',
        explainMoment(highlight.moment, rounds[matchStage].rival, ringName(match.robots[0].build, rounds[matchStage].rival))
      )
    announcer.update(match)
    for (const e of match.events) {
      fightLog.add(e, match.time)
      view.event(e)
      audio.matchEvent(e, match, view)
    }
    if (!practice && !replaying && match.winner === null && match.tick % 90 === 0) recovery.save(cup, match)
  }
  view.blend = Math.min(1, accumulator / STEP)
  board.update(match)
  for (const [i, p] of match.robots.entries()) audio.drive(i, view.panFor(p), p.move, view.gainFor(p))
  if (match.winner !== null && !highlight) finishBout()
}
function finishState() {
  return ['won', 'lost', 'tie'][match.winner]
}
function finishBout() {
  if (practice) {
    audio.ambience(false)
    return
  }
  const won = match.winner === 0
  $('battle').dataset.finish = finishState()
  if (won) {
    text('victory-title', matchStage === rounds.length - 1 ? 'CUP CHAMPION' : 'VICTORY')
    text('victory-name', nameOf(match.robots[0].build))
    $('victory-call').hidden = false
  }
  fightLog.finish(match.winner, match.time)
  announcer.finish(match)
  if (!replaying) recordResult()
  audio.finish(won)
}
function recordResult() {
  const [a, b] = match.robots,
    r = cupRound(cup, matchStage)
  const report = attemptSummary(match, matchStage)
  savedResult = {
    stage: matchStage,
    rules: match.rules,
    paint: match.paint,
    build: { ...a.build },
    tip: coachingTip(match, r),
    change: compareAttempts(cup.lastTry, report, r.rival)
  }
  recovery.save(cup, null)
  if (match.winner === 0) {
    rememberWin(disk, matchStage, cup.edition, a.build, r.budget, match.rules)
    cup.wins[matchStage] = {
      paint: match.paint,
      rules: match.rules,
      build: { ...a.build },
      hits: a.hits,
      blocks: a.blocks,
      flanks: a.flanks,
      tick: match.tick
    }
    cup.lastTry = null
    cup.champion = matchStage === rounds.length - 1
    cup.round = Math.min(matchStage + 1, rounds.length - 1)
    saveCup(disk, cup)
  } else {
    cup.lastTry = report
    saveCup(disk, cup, 'record')
    const result = savedResult,
      finished = match
    findPitTip(finished, r.budget, () => savedResult !== result).then((tip) => {
      if (!tip || result !== savedResult) return
      result.refit = tip
      if (modal === 'result') resultScreen()
      else if (!match && mode === 'pick') draw()
    })
  }
}
function resultScreen() {
  paused = true
  view.freeze(true)
  const r = rounds[matchStage],
    a = match.robots[0],
    won = match.winner === 0
  const title = won
    ? matchStage === 3
      ? 'Cup champion!'
      : 'You win!'
    : match.winner === 2
      ? 'A tie!'
      : 'Back to the garage!'
  const note = won
    ? matchStage === 3
      ? 'Four wins! Your bot takes home the Bolt Cup.'
      : 'Next up is ' + round().rival + '. You can now spend ' + round().budget + ' coins.'
    : savedResult.tip
  const lesson =
    (!won && savedResult.refit?.evidence) || savedResult.change || (won ? savedResult.tip : r.hint)
  spoken = [title, note, lesson].filter(Boolean).join(' ').replaceAll(' → ', ' to ')
  show(
    'result',
    r.stage.toUpperCase(),
    title,
    '<p class="copy">' +
      note +
      '</p>' +
      finishPanel(match, [ringName(a.build, r.rival), r.rival]) +
      (lesson ? '<p class="small">' + lesson + '</p>' : '') +
      (!won && savedResult.refit
        ? btn('try-tip', savedResult.refit.nextChange ? 'Test both changes' : savedResult.refit.choice < 0
          ? 'Try without ' + partFor(savedResult.refit.id, a.build[savedResult.refit.id]).name
          : 'Try ' + partFor(savedResult.refit.id, savedResult.refit.choice).name, 'coach-link')
        : '') +
      '<div class="modal-row">' +
      btn('highlight', 'Key move') +
      btn('replay', 'Full match') +
      btn('garage', won ? (matchStage === 3 ? 'See trophy' : 'Next round') : 'Back to parts', 'dark-action') +
      '</div>',
    false
  )
}
function backToGarage() {
  announcer.stop()
  syncGarage()
  practice = null
  const lost = match && match.winner !== null && match.winner !== 0
  hide()
  match = null
  paused = false
  replaying = false
  audio.ambience(false)
  if (pathRenderer) pathRenderer.group.visible = false
  $('battle').hidden = true
  $('garage').hidden = false
  view.exit(cup.build, round(), cup.champion)
  changeMode(lost ? 'parts' : 'battle')
}
function pausePlay() {
  if (highlight) return finishHighlight()
  announcer.stop()
  if (!match || match.winner !== null || paused) return
  paused = true
  view.freeze(true)
  audio.ambience(false)
  if (!practice && !replaying) recovery.save(cup, match)
  show(
    'pause',
    'TIME OUT',
    'Paused',
    '<p class="copy">Your bots are waiting on the ring.</p><div class="modal-row">' +
      btn('leave', 'Garage') +
      btn('resume', 'Keep playing', 'dark-action') +
      '</div>',
    false
  )
}
function resumePlay() {
  hide()
  paused = false
  accumulator = 0
  view.freeze(false)
  audio.unlock()
  audio.ambience(true)
}
function podium() {
  show(
    'podium',
    'BOLT CUP',
    'Cup champion!',
    '<p class="copy">' +
      escapeText(nameOf(cup.wins[3]?.build || cup.build)) +
      ' beat all four rivals. Your trophy is on the garage stand.</p>' +
      btn('photo', marks('camera') + ' Champion photo', 'primary') +
      '<div class="modal-row">' +
      btn('close', 'See my bot') +
      btn('new-cup', 'New cup') +
      '</div>'
  )
}
async function photo() {
  show('photo', 'WINNER’S PODIUM', 'Champion photo', '<p class="copy">Getting the camera ready…</p>')
  try {
    const { championPhoto } = await import('./champion-photo.js')
    if (modal !== 'photo') return
    const blob = await championPhoto(view, cup.wins[3] || { build: cup.build }, cup.edition, round())
    if (modal !== 'photo') return
    if (!blob) throw Error('No portrait')
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    photoUrl = URL.createObjectURL(blob)
    show(
      'photo',
      'WINNER’S PODIUM',
      'Champion photo',
      '<img class="keepsake" alt="Your champion robot, trophy and winning parts" src="' +
        photoUrl +
        '"><div class="modal-row">' +
        btn('close', 'Done') +
        btn('save-photo', marks('camera') + ' Save photo', 'dark-action') +
        '</div>'
    )
  } catch {
    if (modal === 'photo')
      show(
        'photo',
        'WINNER’S PODIUM',
        'Champion photo',
        '<p class="copy">The camera needs another try.</p>' + btn('photo', 'Try again')
      )
  }
}
function runAction(act) {
  if (act === 'rename') {
    show(
      'name',
      'YOUR GARAGE',
      'Name your bot',
      '<form id="name-form"><input id="bot-input" aria-label="Robot name" autocorrect="off" autocomplete="off" spellcheck="false" enterkeyhint="done" placeholder="' +
        frames[cup.build.chassis].name +
        '"><button class="dark-action" type="submit">Save name</button></form>'
    )
    const input = $('bot-input')
    input.value = cup.build.name || ''
    function limit() {
      const text = limitNameInput(input.value)
      if (text !== input.value) input.value = text
    }
    input.oninput = (e) => {
      if (!e.isComposing) limit()
    }
    input.addEventListener('compositionend', limit)
    input.focus()
    positionNameForm()
    $('name-form').onsubmit = (e) => {
      e.preventDefault()
      const name = cleanName(input.value)
      editGarage(
        (build) => ({ ...build, name }),
        () => {
          hide()
          draw()
        }
      )
    }
    return
  }
  if (act === 'close') return closeModal()
  if (act === 'game-options') return options()
  if (act === 'read-parts') {
    cup.voice = !cup.voice
    saveAudio(disk, cup)
    if (!cup.voice) silenceVoice()
    options()
    return
  }
  if (act === 'announcer-option') {
    cup.announcer = !cup.announcer
    saveAudio(disk, cup)
    options()
    return
  }
  if (act === 'run-check' && view) return beginCheck()
  if (act === 'show-check') return showCheck()
  if (act === 'save-check') return exportCheck()
  if (act === 'sound-option') {
    soundToggle()
    return options()
  }
  if (act === 'full') {
    const root = document.documentElement
    const call =
      document.fullscreenElement || document.webkitFullscreenElement
        ? (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)
        : (root.requestFullscreen || root.webkitRequestFullscreen)?.call(root)
    Promise.resolve(call)
      .then(options)
      .catch(() => toast('Full screen is unavailable in this window.'))
    return
  }

  if (act === 'home' || act === 'parts') return changeMode(act)
  if (act === 'photo') return photo()
  if (act === 'save-photo' && photoUrl) {
    const a = document.createElement('a')
    a.href = photoUrl
    a.download = 'bolt-cup-champion-' + cup.edition + '.png'
    document.body.append(a)
    a.click()
    a.remove()
    return
  }
  if (act === 'fit') return apply()
  if (act === 'try-part') return testPart(slot, cup.build[slot] === choice ? -1 : choice)
  if (act === 'other-trial') return startRace(null, false, { ...practice, candidate: !practice.candidate })
  if (act === 'end-trial') return endPractice()
  if (act === 'second-shelf' && practice?.secondSlot) return endPractice(practice.secondSlot)
  if (act === 'hear') return mode === 'pick' && !modal ? hearPart() : hear(spoken)
  if (act === 'rival-radar') {
    rivalRadar = !rivalRadar
    draw()
    $('equipment-dial').querySelector('[data-act="rival-radar"]')?.focus({ preventScroll: true })
    return
  }
  if (act === 'enter-ring') return startRace()
  if (act === 'bracket') return bracketScreen()
  if (act === 'cup') return cupMap()
  if (act === 'scout-parts') {
    hide()
    return changeMode('pick', round().focus)
  }
  if (act === 'resume') return resumePlay()
  if (act === 'leave') {
    if (practice) return endPractice()
    if (!replaying) recovery.save(cup, null)
    return backToGarage()
  }
  if (act === 'try-tip' && savedResult?.refit) {
    const tip = savedResult.refit
    backToGarage()
    if (tip.nextChange) {
      if (!slots.every(({ id }) => cup.build[id] === savedResult.build[id])) return
      const next = tip.nextChange
      const fitted = { ...cup.build }
      return startRace(null, false, { slot: tip.id, secondSlot: next.id, fitted, candidate: true,
        build: { ...fitted, [tip.id]: tip.choice, [next.id]: next.choice } })
    }
    changeMode('pick', tip.id)
    if (tip.choice < 0) {
      if (cup.build[tip.id] === savedResult.build[tip.id]) testPart(tip.id, -1)
      return
    }
    choice = tip.choice
    trying = true
    draw()
    view.facePart(slot)
    return
  }
  if (act === 'garage') return backToGarage()
  if (act === 'highlight') return startHighlight()
  if (act === 'replay') return startRace(null, true)
  if (act === 'continue-match') return startRace(offer)
  if (act === 'fresh-match') {
    recovery.save(cup, null)
    offer = null
    return bracketScreen()
  }
  if (act === 'new-cup') {
    const edition = cup.edition + 1
    const oldBody = cup.build.chassis,
      oldName = cup.build.name
    cup = { ...freshCup(), edition, muted: cup.muted, voice: cup.voice, announcer: cup.announcer }
    cup.build.chassis = oldBody
    if (oldName) cup.build.name = oldName
    saveCup(disk, cup)
    hide()
    changeMode('body')
  }
}
document.addEventListener('click', (e) => {
  const n = e.target.closest('button')
  if (!n) return
  audio.unlock()
  if (n.dataset.win !== undefined) return winningBuild(Number(n.dataset.win))
  if (n.dataset.act) return runAction(n.dataset.act)
  if (n.dataset.nav) return changeMode(n.dataset.nav)
  if (n.dataset.sell) {
    const id = n.dataset.sell,
      fitted = cup.build[id],
      sold = partFor(id, fitted)
    return editGarage(
      (build) => (build[id] === fitted ? sellPart(build, id) : null),
      () => {
        trying = false
        audio.play('equip')
        draw()
        $('bay').querySelector('[data-choice="' + choice + '"]')?.focus({ preventScroll: true })
        toast('Sold ' + sold.name + ' · +' + sold.price + ' coins')
      }
    )
  }
  if (n.dataset.slot) return changeMode('pick', n.dataset.slot)
  if (n.dataset.choice !== undefined) {
    trying = true
    choice = Number(n.dataset.choice)
    silenceVoice()
    draw()
    if (cup.voice) hearPart()
    $('bay')
      .querySelector('[data-choice="' + choice + '"]')
      ?.focus({ preventScroll: true })
    view?.facePart(slot)
    return
  }
  if (n.dataset.frame !== undefined) {
    const chassis = Number(n.dataset.frame)
    return editGarage(
      (build) => ({ ...build, chassis }),
      () => {
        draw()
        $('bay')
          .querySelector('[data-frame="' + chassis + '"]')
          ?.focus({ preventScroll: true })
        audio.play('equip')
      }
    )
  }
  if (n.dataset.paint) {
    enamel = paintById(n.dataset.paint)
    try {
      disk?.setItem(paintKey, enamel[0])
    } catch {}
    view?.setPaint(enamel[2])
    draw()
    $('bay')
      .querySelector('[data-paint="' + enamel[0] + '"]')
      ?.focus({ preventScroll: true })
    audio.play('equip')
    return
  }
})
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented || $('overlay').open) return
  if (benchmark) {
    e.preventDefault()
    finishCheck(null)
    return
  }
  if (match) {
    e.preventDefault()
    pausePlay()
    return
  }
})
$('sound').onclick = soundToggle
$('help').onclick = help
$('scout').onclick = scout
$('inspect').onclick = scout
$('cup-open').onclick = cupMap
$('dismiss').onclick = closeModal
$('hear-result').onclick = () => hear(spoken)
$('overlay').addEventListener('cancel', (e) => {
  e.preventDefault()
  closeModal()
})
$('battle-start').disabled = true
$('battle-start').onclick = () => {
  if (cup.champion) return podium()
  if (offer)
    return show(
      'recovery',
      'BACK IN THE RING',
      'Resume match?',
      '<p class="copy">Pick up where your bot left off, or use your current build in a fresh match.</p><div class="modal-row">' +
        btn('fresh-match', 'Fresh match') +
        btn('continue-match', 'Resume', 'dark-action') +
        '</div>'
    )
  startRace()
}
$('pause').onclick = () => (benchmark ? finishCheck(null) : pausePlay())
$('camera').onclick = () => camera(view.camera())
$('tactics').onclick = () => {
  setPaths(!paths)
  if (paths) {
    view.cam = 2
    view.cameraSnap = true
    camera(cameras[2])
    view.invalidate()
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (benchmark) finishCheck(null, 'The check paused when the game went into the background.')
    else pausePlay()
  }
})
window.addEventListener('pagehide', () => {
  if (match && !practice && !replaying && match.winner === null) recovery.save(cup, match)
})
// Safari can shrink only the visual viewport when the on-screen keyboard
// opens. Keep the field and its Save button together in the visible space.
function positionNameForm() {
  const viewport = window.visualViewport
  if (modal !== 'name' || !viewport) return
  const panel = $('overlay')
  if (viewport.height > innerHeight - 100) {
    delete panel.dataset.keyboard
    return
  }
  panel.dataset.keyboard = 'true'
  panel.style.setProperty(
    '--keyboard-top',
    Math.round(viewport.offsetTop + Math.max(6, (viewport.height - panel.offsetHeight) / 2)) + 'px'
  )
}
window.visualViewport?.addEventListener('resize', positionNameForm)
window.visualViewport?.addEventListener('scroll', positionNameForm)
let garageChanged = false
function syncGarage() {
  view?.setPaint(enamel[2])
  if (!garageChanged) return
  garageChanged = false
  const newer = readCup(disk)
  if (
    isAhead(newer, cup) ||
    (newer.edition === cup.edition && newer.round === cup.round && newer.champion === cup.champion)
  ) {
    cup = newer
    offer = recovery.findMatch(cup)
  }
}
window.addEventListener('storage', (e) => {
  if (e.key === paintKey) {
    const active = paintById(e.newValue)
    if (active) {
      enamel = active
      if (!match && !benchmark) {
        view?.setPaint(active[2])
        draw()
      }
    }
    return
  }
  if (isAudioKey(e.key)) {
    const opts = readCup(disk)
    cup.muted = opts.muted
    cup.voice = opts.voice
    cup.announcer = opts.announcer
    if (match && !practice && !highlight) {
      if (cup.announcer && !announcer.active)
        announcer.reset(
          true,
          [ringName(match.robots[0].build, rounds[matchStage].rival), rounds[matchStage].rival],
          match.time
        )
      else if (!cup.announcer) announcer.reset(false)
    }
    soundState()
    return
  }
  if (!isCupKey(e.key)) return
  garageChanged = true
  if (!match && !benchmark) {
    syncGarage()
    draw()
  }
})
for (const el of document.querySelectorAll('[data-icon]')) el.innerHTML = marks(el.dataset.icon)
soundState()
offer = recovery.findMatch(cup)
draw()
const offline = offlineSupport(() => {})
offline?.prepare()
try {
  let late
  const light = await studioLight((t) => {
    if (view) view.setStudioLight(t)
    else late = t
  })
  view = new View(
    frame,
    () => {
      if (benchmark) finishCheck(null, 'The 3D view is restarting. Try the device check again.')
      else pausePlay()
      $('boot-notice').hidden = false
      $('boot-notice').dataset.graphics = 'true'
      $('boot-notice').querySelector('span').textContent = 'Restoring the 3D view…'
    },
    () => {
      $('boot-notice').hidden = true
    },
    light
  )
  if (late) view.setStudioLight(late)
  view.onPartSelect = (id) => changeMode('pick', id)
  view.onCameraChange = camera
  view.setPaint(enamel[2])
  draw()
  $('battle-start').disabled = false
} catch (error) {
  console.error(error)
  $('boot-notice').hidden = false
  $('boot-notice').dataset.graphics = 'true'
  $('boot-notice').querySelector('span').textContent = 'The 3D view could not start.'
}
