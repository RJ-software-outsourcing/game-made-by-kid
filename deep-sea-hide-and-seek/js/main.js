import { ac, isMuted, setMuted, setMusicMode, sfx, startMusic } from './audio.js'
import { CHAR_IDS, CHARS, drawChar, drawPortrait, drawSilhouette, loadBear } from './characters.js'
import { HOME, World, WORLD_H, WORLD_W, heart, lightSprite, setWorldSize } from './world.js'

const $ = (id) => document.getElementById(id)
const TAU = Math.PI * 2
const rand = (a, b) => a + Math.random() * (b - a)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const smooth = (a, b, x) => {
  const k = clamp((x - a) / (b - a), 0, 1)
  return k * k * (3 - 2 * k)
}
const angDiff = (a, b) => Math.abs(((a - b + Math.PI * 3) % TAU) - Math.PI)

// ---------- Canvas ----------

const canvas = $('game')
const ctx = canvas.getContext('2d')
const lightC = document.createElement('canvas')
const lctx = lightC.getContext('2d')
let W = 0
let H = 0
let DPR = 1

function resize() {
  W = window.innerWidth
  H = window.innerHeight
  // Cap the pixel count: a full-screen 2x canvas is a lot of pixels to fill every frame.
  DPR = Math.min(2, window.devicePixelRatio || 1, Math.sqrt(3_000_000 / (W * H)))
  canvas.width = Math.round(W * DPR)
  canvas.height = Math.round(H * DPR)
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'
  lightC.width = Math.ceil(W / 2)
  lightC.height = Math.ceil(H / 2)
}
window.addEventListener('resize', () => {
  resize()
  if (G.phase === 'menu') G.world = newWorld()
})
resize()

function newWorld() {
  setWorldSize(W, H)
  return new World()
}

// ---------- Settings ----------

const settings = { hide: 20, seek: 3, char: 0 }
try {
  Object.assign(settings, JSON.parse(localStorage.getItem('hs-settings') || '{}'))
} catch {
  // ignore
}
function saveSettings() {
  try {
    localStorage.setItem('hs-settings', JSON.stringify(settings))
  } catch {
    // ignore
  }
}

// ---------- Game state ----------

const PLAYER_SPEED = 230
const SEEKER_PLAYER_SPEED = 260
const CATCH_R = 75 // player seeker finds a hider within this distance
// The player-seeker's flashlight shines the way they swim.
const FLASH_R = 300
const FLASH_HALF = 0.62 // half-angle of the beam, in radians
// The computer seeker's flashlight (hiders can see it, and it matches what the AI can see).
const AI_FLASH_R = 260
const AI_FLASH_HALF = 0.65
const SEEKER_COUNT_SECS = 3 // when the player seeks, the count is a quick animation, not a real wait

const G = {
  phase: 'menu', // menu | rps | hide | seek | ending | result
  t: 0,
  world: newWorld(),
  chars: [],
  player: null,
  seeker: null,
  timer: 0,
  stars: 0,
  particles: [],
  popups: [],
  cam: { x: HOME.x, y: HOME.y, scale: 1 },
  holdT: 0,
  result: null,
  burst,
  addStar,
}

function makeChar(id, isPlayer) {
  return {
    id,
    isPlayer,
    name: CHARS[id].name,
    role: 'hider',
    x: HOME.x,
    y: HOME.y,
    vx: 0,
    vy: 0,
    facing: 1,
    hidden: false,
    spot: null,
    found: false,
    mode: 'idle',
    goal: null,
    goalSpot: null,
    speed: 0,
    noise: 0,
    emoteT: 0,
    emoteNoise: 0,
    bubble: null,
    dir: 0,
    checked: new Map(),
    sneakT: rand(4, 8),
    visReal: 1, // how clearly the player-seeker sees this hider (0..1)
    visGhost: 0, // how strong the faint moving shadow is (0..1)
    giggleT: 0,
    alertCD: 0,
  }
}

// ---------- Particles & popups ----------

function burst(x, y, type, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU)
    const s = rand(40, 160)
    G.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (type === 'bubble' || type === 'heart' ? 60 : 0),
      life: rand(0.8, 1.6),
      max: 1.6,
      type,
      color: type === 'confetti' ? `hsl(${rand(0, 360)},90%,65%)` : null,
      size: rand(4, 9),
      rot: rand(0, TAU),
    })
  }
}

function popup(x, y, text, color = '#fff') {
  G.popups.push({ x, y, text, color, life: 1.8 })
}

function addStar(msg) {
  G.stars++
  $('hud-stars').textContent = `⭐ ${G.stars}`
  showBanner(msg, 1600)
}

let bannerTimer = 0
function showBanner(text, ms = 1800) {
  const b = $('banner')
  b.textContent = text
  b.classList.remove('hidden')
  // restart the pop animation
  b.style.animation = 'none'
  void b.offsetWidth
  b.style.animation = ''
  clearTimeout(bannerTimer)
  bannerTimer = setTimeout(() => b.classList.add('hidden'), ms)
}

let tipTimer = 0
function setTip(text) {
  const tip = $('tip')
  tip.textContent = text || ''
  tip.classList.toggle('hidden', !text)
  clearTimeout(tipTimer)
  if (text) tipTimer = setTimeout(() => tip.classList.add('hidden'), 8000)
}

// ---------- Screens ----------

const screens = ['menu', 'rps', 'count', 'result']
function showScreen(name) {
  if (name !== 'menu' && name !== 'rps' && name !== 'result') portraits = []
  for (const s of screens) $('screen-' + s).classList.toggle('hidden', s !== name)
}

// Portrait canvases drawn every frame while visible.
let portraits = []

function buildMenu() {
  const cards = $('cards')
  cards.innerHTML = ''
  portraits = []
  CHAR_IDS.forEach((id, i) => {
    const card = document.createElement('button')
    card.className = 'card'
    card.style.setProperty('--c', CHARS[id].color)
    card.innerHTML = `<canvas></canvas><div class="name">${CHARS[id].name}</div><div class="tag">${CHARS[id].tag}</div>`
    card.addEventListener('click', () => {
      if (settings.char === i) startGame()
      else selectChar(i)
    })
    cards.appendChild(card)
    portraits.push({ canvas: card.querySelector('canvas'), id, card, idx: i })
  })
  selectChar(settings.char, true)
  updateSettingsUI()
}

function selectChar(i, silent) {
  settings.char = (i + CHAR_IDS.length) % CHAR_IDS.length
  saveSettings()
  portraits.forEach((p) => p.card.classList.toggle('selected', p.idx === settings.char))
  if (!silent) {
    sfx.move()
    voice(CHAR_IDS[settings.char])
  }
}

function voice(id) {
  sfx[id]()
}

function updateSettingsUI() {
  $('set-hide').textContent = `${settings.hide} sec`
  $('set-seek').textContent = `${settings.seek} min`
}

document.querySelectorAll('.step').forEach((b) =>
  b.addEventListener('click', () => {
    ac()
    const d = Number(b.dataset.d)
    if (b.dataset.set === 'hide') settings.hide = clamp(settings.hide + d, 10, 30)
    else settings.seek = clamp(settings.seek + d, 1, 5)
    saveSettings()
    updateSettingsUI()
    sfx.move()
  }),
)

function goMenu() {
  G.phase = 'menu'
  G.player = null
  G.chars = []
  G.particles = []
  G.popups = []
  G.world = newWorld()
  showScreen('menu')
  buildMenu()
  $('hud').classList.add('hidden')
  $('hide-count').classList.add('hidden')
  $('noise').classList.add('hidden')
  $('btn-home').classList.add('hidden')
  setTip('')
  $('banner').classList.add('hidden')
  setMusicMode('calm')
  clearTimeout(rpsTimer)
}

// ---------- Rock paper scissors ----------

const HANDS = ['✊', '✌️', '✋']
const HAND_NAMES = ['rock', 'scissors', 'paper']
const beats = (a, b) => (a === 0 && b === 1) || (a === 1 && b === 2) || (a === 2 && b === 0)

const rps = { contenders: [], picks: {}, choice: 0, stage: 'pick', cards: {}, target: null }
const rand3 = () => Math.floor(Math.random() * 3)
let rpsTimer = 0

function startGame() {
  ac()
  startMusic()
  sfx.select()
  G.world = newWorld()
  G.stars = 0
  $('hud-stars').textContent = '⭐ 0'
  const playerId = CHAR_IDS[settings.char]
  G.chars = CHAR_IDS.map((id) => makeChar(id, id === playerId))
  G.player = G.chars.find((c) => c.isPlayer)
  // Decide up front who ends up as the seeker: the player half of the time, otherwise one of the
  // other two. The computer's picks below are chosen to make the game come out that way.
  const others = G.chars.filter((c) => !c.isPlayer)
  rps.target = Math.random() < 0.5 ? G.player.id : others[Math.floor(Math.random() * others.length)].id
  G.phase = 'rps'
  $('btn-home').classList.remove('hidden')
  showScreen('rps')
  const wrap = $('rps-players')
  wrap.innerHTML = ''
  portraits = []
  rps.cards = {}
  // player first, then the others
  const order = [G.player, ...G.chars.filter((c) => !c.isPlayer)]
  for (const c of order) {
    const el = document.createElement('div')
    el.className = 'rps-player' + (c.isPlayer ? ' me' : '')
    el.innerHTML = `<div class="rps-hand"></div><canvas></canvas><div class="name">${c.isPlayer ? '⭐ ' : ''}${c.name}</div>`
    wrap.appendChild(el)
    rps.cards[c.id] = el
    portraits.push({ canvas: el.querySelector('canvas'), id: c.id, card: el })
  }
  startRpsRound(CHAR_IDS.slice())
}

function startRpsRound(contenders) {
  rps.contenders = contenders
  rps.picks = {}
  $('rps-title').textContent = contenders.length === CHAR_IDS.length ? 'Rock, Paper, Scissors!' : 'One more time!'
  for (const [id, el] of Object.entries(rps.cards)) {
    el.classList.toggle('out', !contenders.includes(id))
    el.classList.remove('loser')
    const hand = el.querySelector('.rps-hand')
    hand.className = 'rps-hand'
  }
  if (contenders.includes(G.player.id)) {
    rps.stage = 'pick'
    $('rps-choices').classList.remove('hidden')
    $('rps-msg').textContent = 'What will you pick?'
    setRpsChoice(rps.choice)
  } else {
    rps.stage = 'anim'
    $('rps-choices').classList.add('hidden')
    $('rps-msg').textContent = 'Watch them play…'
    rpsTimer = setTimeout(() => playRps(null), 900)
  }
}

function setRpsChoice(i) {
  rps.choice = (i + 3) % 3
  document.querySelectorAll('.rps-btn').forEach((b) => b.classList.toggle('selected', Number(b.dataset.g) === rps.choice))
}

document.querySelectorAll('.rps-btn').forEach((b) =>
  b.addEventListener('click', () => {
    if (G.phase !== 'rps' || rps.stage !== 'pick') return
    setRpsChoice(Number(b.dataset.g))
    playRps(rps.choice)
  }),
)

// Hand that beats X is (X + 2) % 3; the hand X beats is (X + 1) % 3.
function assignPicks(playerPick) {
  const picks = rps.picks
  const cs = rps.contenders
  const me = G.player.id
  const inGame = cs.includes(me)
  const base = inGame ? playerPick : rand3()
  if (inGame) picks[me] = playerPick
  const target = cs.includes(rps.target) ? rps.target : null
  if (!target) {
    for (const id of cs) if (id !== me) picks[id] = rand3()
    return
  }
  if (target === me) {
    // The player loses: everyone else beats their pick.
    for (const id of cs) if (id !== me) picks[id] = (playerPick + 2) % 3
  } else {
    // The target loses to the player's pick (or to a random hand if the player is out).
    for (const id of cs) {
      if (id === me) continue
      picks[id] = id === target ? (base + 1) % 3 : base
    }
  }
}

function playRps(playerPick) {
  rps.stage = 'anim'
  $('rps-choices').classList.add('hidden')
  assignPicks(playerPick)
  for (const id of rps.contenders) {
    const hand = rps.cards[id].querySelector('.rps-hand')
    hand.textContent = '✊'
    hand.className = 'rps-hand shake'
  }
  const words = ['Rock…', 'Paper…', 'Scissors!']
  words.forEach((w, i) =>
    setTimeout(() => {
      if (G.phase !== 'rps') return
      $('rps-msg').textContent = w
      sfx.rpsBeat(i)
    }, i * 450),
  )
  rpsTimer = setTimeout(revealRps, 1400)
}

function revealRps() {
  if (G.phase !== 'rps') return
  for (const id of rps.contenders) {
    const hand = rps.cards[id].querySelector('.rps-hand')
    hand.textContent = HANDS[rps.picks[id]]
    hand.className = 'rps-hand show'
  }
  const unique = [...new Set(rps.contenders.map((id) => rps.picks[id]))]
  if (unique.length !== 2) {
    sfx.tie()
    $('rps-msg').textContent = 'A tie! Again 🤝'
    rpsTimer = setTimeout(() => startRpsRound(rps.contenders), 1700)
    return
  }
  const lose = beats(unique[0], unique[1]) ? unique[1] : unique[0]
  const losers = rps.contenders.filter((id) => rps.picks[id] === lose)
  for (const id of losers) rps.cards[id].classList.add('loser')
  if (losers.length === 1) {
    const id = losers[0]
    sfx.ghost()
    $('rps-msg').textContent = id === G.player.id ? "You're the seeker! 👻" : `${CHARS[id].name} is the seeker! 👻`
    rpsTimer = setTimeout(() => beginHide(id), 2200)
  } else {
    sfx.reveal()
    $('rps-msg').textContent = `${losers.map((id) => (id === G.player.id ? 'You' : CHARS[id].name)).join(' & ')} lost with ${HAND_NAMES[lose]}, go again!`
    rpsTimer = setTimeout(() => startRpsRound(losers), 2200)
  }
}

// ---------- Hide phase ----------

function beginHide(seekerId) {
  G.phase = 'hide'
  G.seeker = G.chars.find((c) => c.id === seekerId)
  G.timer = G.seeker.isPlayer ? SEEKER_COUNT_SECS : settings.hide
  G.lastSec = -1
  const hiders = G.chars.filter((c) => c !== G.seeker)
  for (const [i, c] of G.chars.entries()) {
    c.role = c === G.seeker ? 'seeker' : 'hider'
    c.x = HOME.x + (i - (G.chars.length - 1) / 2) * 90
    c.y = HOME.y
    c.vx = c.vy = 0
    c.hidden = false
    c.found = false
    c.spot = null
    c.mode = 'idle'
    c.bubble = null
  }
  G.seeker.x = HOME.x
  G.seeker.y = HOME.y - 110
  // AI hiders pick different spots, reachable in time.
  const taken = new Set()
  for (const h of hiders) {
    if (h.isPlayer) continue
    const options = G.world.spots.filter((s) => !taken.has(s))
    const s = options[Math.floor(Math.random() * options.length)]
    taken.add(s)
    sendToSpot(h, s, Math.max(150, (dist(h, s) / (settings.hide * 0.75)) | 0), 'goHide')
  }
  const p = G.player
  G.cam.x = p.x
  G.cam.y = p.y
  $('hud').classList.remove('hidden')
  $('hud-role').textContent = p === G.seeker ? "You're the seeker 👻" : 'Go hide! 🙈'
  updateFoundHud()
  setMusicMode('calm')
  sfx.go()
  $('hide-count').classList.add('hidden')
  if (p === G.seeker) {
    showScreen('count')
    $('count-num').textContent = settings.hide
    $('count-text').textContent = `You're the seeker! Counting to ${settings.hide}…`
    setTip('')
  } else {
    showScreen(null)
    $('hide-count').classList.remove('hidden')
    showBanner('Quick, hide! 🙈', 1600)
    setTip('Hide behind coral, rocks, kelp or a big shell! Move with ⬅️➡️⬆️⬇️')
  }
}

function sendToSpot(c, s, speed, mode) {
  c.goalSpot = s
  // Sit slightly off-center so a little bit peeks out (cute and fair).
  const a = rand(0, TAU)
  const off = s.r * rand(0.15, 0.35)
  c.goal = { x: s.x + Math.cos(a) * off, y: s.y + Math.sin(a) * off * 0.6 }
  c.speed = speed
  c.mode = mode
}

// ---------- Seek phase ----------

function beginSeek() {
  G.phase = 'seek'
  $('hide-count').classList.add('hidden')
  G.timer = settings.seek * 60
  G.lastSec = Math.ceil(G.timer)
  setMusicMode('tense')
  for (const h of G.chars) {
    if (h.role !== 'hider' || h.isPlayer) continue
    if (h.mode === 'goHide') {
      h.x = h.goal.x
      h.y = h.goal.y
      h.mode = 'hidden'
    }
  }
  const s = G.seeker
  s.mode = 'patrol'
  s.goalSpot = null
  s.dir = Math.PI / 2
  for (const h of G.chars) {
    h.visReal = h.role === 'hider' ? 0 : 1
    h.visGhost = 0
  }
  if (G.player === s) {
    showScreen(null)
    showBanner('Go find them! 🔦')
    setTip('Your flashlight shines where you swim 🔦 Watch for faint moving shadows 👀')
  } else {
    showBanner('Ready or not, here I come! 👻')
    s.bubble = { text: 'Here I come!', t: 2 }
    setTip("Move slowly to stay quiet 🤫 Keep out of the seeker's light!")
    $('noise').classList.remove('hidden')
    $('hud-role').textContent = 'Stay hidden! 🤫'
  }
  sfx.ghost()
  updateFoundHud()
}

function updateFoundHud() {
  const el = $('hud-found')
  if (G.player && G.player === G.seeker && (G.phase === 'seek' || G.phase === 'ending')) {
    const hiders = G.chars.filter((c) => c.role === 'hider')
    el.textContent = 'Found: ' + hiders.map((h) => (h.found ? '✅' : '❓')).join(' ')
  } else if (G.seeker && G.player !== G.seeker) {
    el.textContent = `Seeker: ${G.seeker.name}`
  } else el.textContent = ''
}

function catchHider(h, by) {
  if (h.found) return
  h.found = true
  h.visReal = 1
  h.visGhost = 0
  h.hidden = false
  h.mode = 'follow'
  h.spot = null
  sfx.found()
  burst(h.x, h.y, 'confetti', 16)
  popup(h.x, h.y - 70, h.isPlayer ? 'Found you!' : `Found ${h.name}!`, '#ffd84d')
  if (by && !by.isPlayer) by.bubble = { text: 'Found you!', t: 2 }
  updateFoundHud()
  if (G.player === G.seeker) {
    const left = G.chars.filter((c) => c.role === 'hider' && !c.found).length
    if (left === 0) endGame(true, 'Found everyone! 🎉', 'You are the best seeker ever!')
    else showBanner(`Found ${h.name}! ${left} more to go`, 1600)
  } else {
    // The first one caught loses.
    if (h.isPlayer) endGame(false, 'Found you!', 'You were found first… try again! 💪')
    else endGame(true, 'You win! 🎉', `${h.name} was found first. Super hiding!`)
  }
}

function endGame(win, title, sub) {
  if (G.phase === 'ending' || G.phase === 'result') return
  G.phase = 'ending'
  G.result = { win, title, sub }
  setTip('')
  $('noise').classList.add('hidden')
  setTimeout(showResult, 2200)
}

function showResult() {
  if (G.phase !== 'ending') return
  G.phase = 'result'
  setMusicMode('calm')
  $('hud').classList.add('hidden')
  $('result-title').textContent = G.result.title
  $('result-sub').textContent = G.result.sub + (G.stars ? `  ⭐×${G.stars}` : '')
  showScreen('result')
  portraits = [{ canvas: $('result-char'), id: G.player.id, dance: G.result.win, sad: !G.result.win }]
  if (G.result.win) {
    sfx.win()
    for (let i = 0; i < 4; i++) setTimeout(() => burst(G.player.x + rand(-200, 200), G.player.y - 100, 'confetti', 25), i * 300)
  } else sfx.lose()
}

// ---------- Input ----------

const keys = { up: false, down: false, left: false, right: false }
const KEYMAP = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
}

window.addEventListener('keydown', (e) => {
  ac()
  startMusic()
  const k = KEYMAP[e.key]
  if (k) {
    e.preventDefault()
    if (!keys[k]) onNav(k)
    keys[k] = true
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (!e.repeat) onAction()
  } else if (e.key === 'm' || e.key === 'M') toggleMute()
})
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.key]
  if (k) keys[k] = false
})
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false
})

function onNav(k) {
  if (G.phase === 'menu') {
    if (k === 'left') selectChar(settings.char - 1)
    if (k === 'right') selectChar(settings.char + 1)
  } else if (G.phase === 'rps' && rps.stage === 'pick') {
    if (k === 'left') setRpsChoice(rps.choice - 1)
    if (k === 'right') setRpsChoice(rps.choice + 1)
    if (k === 'left' || k === 'right') sfx.move()
  }
}

function onAction() {
  if (G.phase === 'menu') startGame()
  else if (G.phase === 'rps' && rps.stage === 'pick') playRps(rps.choice)
  else if (G.phase === 'result') goMenu()
  else if ((G.phase === 'hide' || G.phase === 'seek') && !(G.phase === 'hide' && G.player === G.seeker)) emote(G.player)
}

function emote(c) {
  if (c.emoteT > 0) return
  c.emoteT = 0.9
  c.emoteNoise = 0.5
  voice(c.id)
  if (c.id === 'whale') burst(c.x + c.facing * 4, c.y - 40, 'bubble', 10)
  else if (c.id === 'sponge') popup(c.x, c.y - 60, 'Ha ha ha!', '#ffe14d')
  else if (c.id === 'shrimp') burst(c.x, c.y - 30, 'coin', 8)
  else burst(c.x, c.y - 30, 'heart', 7)
}

function toggleMute() {
  ac()
  setMuted(!isMuted())
  $('btn-mute').textContent = isMuted() ? '🔇' : '🔊'
}
$('btn-mute').textContent = isMuted() ? '🔇' : '🔊'
$('btn-mute').addEventListener('click', toggleMute)
$('btn-home').addEventListener('click', () => {
  sfx.move()
  goMenu()
})
$('btn-start').addEventListener('click', startGame)
$('btn-again').addEventListener('click', goMenu)

// Touch controls
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  const dpad = $('dpad')
  const action = $('btn-action')
  const showTouch = () => {
    const playing = G.phase === 'hide' || G.phase === 'seek'
    dpad.classList.toggle('hidden', !playing)
    action.classList.toggle('hidden', !playing)
  }
  setInterval(showTouch, 300)
  dpad.querySelectorAll('button').forEach((b) => {
    const k = b.dataset.k
    const on = (e) => {
      e.preventDefault()
      ac()
      startMusic()
      keys[k] = true
      b.classList.add('on')
    }
    const off = (e) => {
      e.preventDefault()
      keys[k] = false
      b.classList.remove('on')
    }
    b.addEventListener('pointerdown', on)
    b.addEventListener('pointerup', off)
    b.addEventListener('pointerleave', off)
    b.addEventListener('pointercancel', off)
  })
  action.addEventListener('click', onAction)
}

// ---------- Update ----------

function moveToward(c, tx, ty, speed, dt) {
  const dx = tx - c.x
  const dy = ty - c.y
  const d = Math.hypot(dx, dy)
  if (d < 4) {
    c.vx = c.vy = 0
    return true
  }
  const s = Math.min(speed, d / dt)
  c.vx = (dx / d) * s
  c.vy = (dy / d) * s
  c.x += c.vx * dt
  c.y += c.vy * dt
  if (Math.abs(c.vx) > 5) c.facing = Math.sign(c.vx)
  return false
}

function updatePlayer(dt) {
  const p = G.player
  const frozen = G.phase === 'ending' || (G.phase === 'hide' && p === G.seeker) || p.found
  let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
  let dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0)
  if (frozen) dx = dy = 0
  const len = Math.hypot(dx, dy) || 1
  if (dx || dy) G.holdT += dt
  else G.holdT = 0
  const isSeeker = p === G.seeker
  const max = isSeeker ? SEEKER_PLAYER_SPEED : PLAYER_SPEED
  // Hiders start slow and speed up the longer a key is held (sneaking vs. running).
  const f = isSeeker ? Math.min(1, 0.5 + G.holdT * 2) : 0.28 + 0.72 * smooth(0.35, 1.5, G.holdT)
  const tvx = (dx / len) * max * f
  const tvy = (dy / len) * max * f
  const k = Math.min(1, dt * 9)
  p.vx += (tvx - p.vx) * k
  p.vy += (tvy - p.vy) * k
  p.x = clamp(p.x + p.vx * dt, 60, WORLD_W - 60)
  p.y = clamp(p.y + p.vy * dt, 80, WORLD_H - 130)
  if (Math.abs(p.vx) > 8) p.facing = Math.sign(p.vx)
  const speed = Math.hypot(p.vx, p.vy)
  if (isSeeker && speed > 25) {
    // Turn the flashlight toward the direction of travel.
    const diff = ((Math.atan2(p.vy, p.vx) - p.dir + Math.PI * 3) % TAU) - Math.PI
    p.dir += diff * Math.min(1, dt * 10)
  }
  p.dir = ((p.dir % TAU) + TAU) % TAU
  p.noise = isSeeker ? 0 : Math.max((speed / PLAYER_SPEED) ** 1.6, p.emoteNoise > 0 ? 1 : 0)
}

/**
 * How well the player-seeker can see a hider.
 * - In the flashlight beam: clearer the closer they are (and fading out at the beam's edges).
 * - Outside the beam: invisible while still; moving shows a faint shadow, stronger the faster they go.
 */
function updateVisibility(h, p) {
  const d = dist(h, p)
  const ang = angDiff(Math.atan2(h.y - p.y, h.x - p.x), p.dir)
  const near = 1 - smooth(45, 95, d) // a tiny glow around the seeker
  let beam = 0
  if (d < FLASH_R) {
    const edge = 1 - smooth(FLASH_HALF * 0.55, FLASH_HALF, ang)
    const clarity = 1 - 0.75 * (d / FLASH_R) ** 1.5
    beam = edge * clarity * (1 - smooth(FLASH_R * 0.85, FLASH_R, d))
  }
  const lit = Math.max(near, beam)
  const motion = smooth(15, 170, Math.hypot(h.vx, h.vy))
  h.visReal = lit
  h.visGhost = motion * 0.05 * (1 - smooth(200, 430, d)) * (1 - lit)
}

function updateHiderAI(h, dt) {
  if (h.mode === 'goHide' || h.mode === 'sneak') {
    if (moveToward(h, h.goal.x, h.goal.y, h.speed, dt)) h.mode = 'hidden'
    h.noise = h.mode === 'sneak' ? 0.32 : 0
  } else if (h.mode === 'hidden') {
    h.noise = 0
    h.vx = h.vy = 0
    if (G.phase !== 'seek') return
    h.sneakT -= dt
    if (h.sneakT <= 0) {
      const s = G.seeker
      const left = G.chars.filter((c) => c.role === 'hider' && !c.found).length
      // When the player is the seeker, hiders move more often and faster, especially with
      // several of them left, so there is always something to notice.
      let wait = [5, 10]
      let chance = 0.4
      let speed = [65, 130]
      let minSeeker = 380
      let minSpotSeeker = 300
      if (G.player === s) {
        const crowd = left >= 2
        wait = crowd ? [1.5, 3.5] : [3, 6]
        chance = crowd ? 0.9 : 0.6
        speed = crowd ? [130, 200] : [100, 160]
        minSeeker = 150
        minSpotSeeker = 180
      }
      h.sneakT = rand(wait[0], wait[1])
      if (dist(h, s) > minSeeker && Math.random() < chance) {
        const taken = new Set(G.chars.filter((c) => c !== h && c.goalSpot).map((c) => c.goalSpot))
        const options = G.world.spots.filter(
          (sp) => !taken.has(sp) && sp !== h.goalSpot && dist(sp, h) < (G.player === s ? 750 : 600) && dist(sp, s) > minSpotSeeker,
        )
        if (options.length) sendToSpot(h, options[Math.floor(Math.random() * options.length)], rand(speed[0], speed[1]), 'sneak')
      }
    }
  } else if (h.mode === 'follow') {
    // Found hiders follow the seeker around happily.
    const lead = G.seeker
    const idx = G.chars.filter((c) => c.mode === 'follow').indexOf(h)
    const tx = lead.x - lead.facing * (80 + idx * 70)
    if (dist(h, { x: tx, y: lead.y }) > 20) moveToward(h, tx, lead.y + 10, 280, dt)
    h.noise = 0
  }
}

function pickSpotToCheck(s) {
  const now = G.t
  const fresh = G.world.spots.filter((sp) => now - (s.checked.get(sp) ?? -999) > 30)
  const pool = fresh.length ? fresh : G.world.spots
  const weights = pool.map((sp) => 1 / (1 + dist(sp, s) / 350))
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) return pool[i]
  }
  return pool[0]
}

function nearestSpot(p, maxD) {
  let best = null
  let bd = maxD
  for (const sp of G.world.spots) {
    const d = dist(sp, p)
    if (d < bd) {
      bd = d
      best = sp
    }
  }
  return best
}

function updateSeekerAI(s, dt) {
  s.alertCD -= dt
  const hiders = G.chars.filter((c) => c.role === 'hider' && !c.found)
  // Perception
  for (const h of hiders) {
    const d = dist(s, h)
    if (!h.hidden) {
      if (d < 60) return catchHider(h, s)
      const a = Math.atan2(h.y - s.y, h.x - s.x)
      if (s.mode !== 'chase' && d < 250 && angDiff(a, s.dir) < 0.65) {
        s.mode = 'chase'
        s.target = h
        s.bubble = { text: '!', t: 1 }
        sfx.alert()
      }
    }
    if (h.noise > 0.3 && d < 100 + 400 * h.noise && s.mode !== 'chase' && s.alertCD <= 0) {
      s.mode = 'investigate'
      s.goal = { x: h.x, y: h.y }
      s.alertCD = 2.5
      s.bubble = { text: '?!', t: 1.2 }
      sfx.alert()
    }
  }
  let mvx = 0
  let mvy = 0
  if (s.mode === 'patrol') {
    if (!s.goalSpot) s.goalSpot = pickSpotToCheck(s)
    const sp = s.goalSpot
    if (dist(s, sp) < sp.r * 0.5) {
      s.mode = 'check'
      s.checkT = 1.3
      s.bubble = { text: '?', t: 1.3 }
      sfx.hmm()
    } else {
      moveToward(s, sp.x, sp.y, 100, dt)
      mvx = s.vx
      mvy = s.vy
    }
  } else if (s.mode === 'check') {
    s.checkT -= dt
    s.dir += Math.sin(G.t * 4) * dt * 3
    if (s.checkT <= 0) {
      const sp = s.goalSpot
      s.checked.set(sp, G.t)
      // Sometimes the seeker doesn't look carefully enough: lucky hiders stay hidden.
      const h = hiders.find((c) => c.hidden && c.spot === sp && Math.random() < 0.8)
      s.goalSpot = null
      s.mode = 'patrol'
      if (h) return catchHider(h, s)
      s.bubble = { text: 'Nobody…', t: 1 }
    }
  } else if (s.mode === 'investigate') {
    if (moveToward(s, s.goal.x, s.goal.y, 175, dt)) {
      const sp = nearestSpot(s.goal, 220)
      s.mode = 'patrol'
      s.goalSpot = sp && G.t - (s.checked.get(sp) ?? -999) > 3 ? sp : null
    } else {
      mvx = s.vx
      mvy = s.vy
    }
  } else if (s.mode === 'chase') {
    const h = s.target
    if (!h || h.found) {
      s.mode = 'patrol'
    } else if (h.hidden) {
      s.mode = 'patrol'
      s.goalSpot = h.spot
    } else if (dist(s, h) > 380) {
      s.mode = 'patrol'
      s.goalSpot = nearestSpot(h, 400)
      s.bubble = { text: 'Huh?', t: 1 }
    } else {
      moveToward(s, h.x, h.y, 185, dt)
      mvx = s.vx
      mvy = s.vy
    }
  }
  if (mvx || mvy) {
    const target = Math.atan2(mvy, mvx)
    let diff = ((target - s.dir + Math.PI * 3) % TAU) - Math.PI
    s.dir += diff * Math.min(1, dt * 5)
  }
  s.dir = ((s.dir % TAU) + TAU) % TAU
}

function update(dt) {
  G.t += dt
  const t = G.t
  G.world.update(dt, t, G.phase === 'hide' || G.phase === 'seek' ? G : {})

  const playing = G.phase === 'hide' || G.phase === 'seek' || G.phase === 'ending'
  if (playing) {
    updatePlayer(dt)
    for (const c of G.chars) {
      c.emoteT = Math.max(0, c.emoteT - dt)
      c.emoteNoise = Math.max(0, c.emoteNoise - dt)
      if (c.bubble && (c.bubble.t -= dt) <= 0) c.bubble = null
      if (c.isPlayer) continue
      if (c.role === 'hider') updateHiderAI(c, dt)
      else if (G.phase === 'seek') updateSeekerAI(c, dt)
    }
    // hidden status
    for (const c of G.chars) {
      if (c.role !== 'hider' || c.found) {
        c.hidden = false
        c.spot = null
        continue
      }
      c.spot = G.world.spotAt(c.x, c.y)
      c.hidden = !!c.spot
    }
  }

  if (G.phase === 'hide') {
    G.timer -= dt
    const playerSeeks = G.player === G.seeker
    // The seeker counts up 1..N. When the player seeks, that count is sped up to a few seconds.
    const total = playerSeeks ? SEEKER_COUNT_SECS : settings.hide
    const counted = clamp(Math.floor((1 - G.timer / total) * settings.hide) + 1, 1, settings.hide)
    const left = Math.max(1, Math.ceil(G.timer))
    const shown = playerSeeks ? counted : left
    if (shown !== G.lastSec) {
      G.lastSec = shown
      if (playerSeeks) {
        sfx.tick()
        $('count-num').textContent = counted
      } else {
        if (left <= 5) sfx.alert()
        else sfx.tick()
        const hc = $('hide-count')
        hc.querySelector('b').textContent = left
        hc.classList.toggle('urgent', left <= 5)
        hc.classList.remove('bump')
        void hc.offsetWidth
        hc.classList.add('bump')
      }
    }
    if (!playerSeeks) G.seeker.bubble = { text: `${counted}…`, t: 0.2 }
    if (G.timer <= 0) beginSeek()
  } else if (G.phase === 'seek') {
    G.timer -= dt
    const sec = Math.ceil(G.timer)
    if (sec !== G.lastSec) {
      G.lastSec = sec
      if (sec <= 10 && sec > 0) sfx.tick()
    }
    if (G.player === G.seeker) {
      for (const h of G.chars) {
        if (h.role !== 'hider' || h.found) continue
        if (dist(h, G.player) < CATCH_R) catchHider(h, G.player)
        if (h.found) continue
        updateVisibility(h, G.player)
        // A faint giggle when a hiding friend is really close (a sound clue only, no visual hint).
        if (h.hidden) {
          h.giggleT -= dt
          if (dist(h, G.player) < 170 && h.giggleT <= 0) {
            h.giggleT = rand(5, 8)
            sfx.giggle()
          }
        }
      }
    }
    if (G.timer <= 0 && G.phase === 'seek') {
      if (G.player === G.seeker) endGame(false, "Time's up!", 'Some friends are still hiding… try again! 🔍')
      else endGame(true, 'You win! 🎉', "Time's up and the seeker never found you!")
    }
  }

  // HUD
  if (playing) {
    const tm = Math.max(0, Math.ceil(G.timer))
    const el = $('hud-timer')
    // Only touch the DOM when something changed (DOM writes every frame are slow).
    const text = G.phase === 'hide' ? `🙈 ${tm}` : `⏰ ${Math.floor(tm / 60)}:${String(tm % 60).padStart(2, '0')}`
    if (el.textContent !== text) {
      el.textContent = text
      el.classList.toggle('urgent', G.phase === 'seek' && tm <= 10)
      el.classList.toggle('hidden', G.phase === 'hide')
    }
    if (G.player !== G.seeker) {
      const width = `${Math.round(G.player.noise * 20) * 5}%`
      const fill = $('noise-fill')
      if (fill.style.width !== width) fill.style.width = width
    }
  }

  // camera: the whole playground always fits in the window
  const cam = G.cam
  cam.scale = Math.min(W / WORLD_W, H / WORLD_H)
  cam.x = WORLD_W / 2
  cam.y = WORLD_H / 2

  // particles
  for (const p of G.particles) {
    p.life -= dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    if (p.type === 'coin' || p.type === 'confetti') p.vy += 160 * dt
    else p.vx *= 1 - dt
    p.rot += dt * 4
  }
  G.particles = G.particles.filter((p) => p.life > 0)
  for (const p of G.popups) {
    p.life -= dt
    p.y -= 30 * dt
  }
  G.popups = G.popups.filter((p) => p.life > 0)
}

// ---------- Render ----------

const snow = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), z: rand(0.3, 1), s: rand(0.8, 2.2) }))

function worldTransform() {
  const c = G.cam
  ctx.setTransform(DPR * c.scale, 0, 0, DPR * c.scale, DPR * (W / 2 - c.x * c.scale), DPR * (H / 2 - c.y * c.scale))
}

function toScreen(x, y) {
  const c = G.cam
  return [(x - c.x) * c.scale + W / 2, (y - c.y) * c.scale + H / 2]
}

function charOpts(c) {
  const speed = Math.hypot(c.vx, c.vy)
  const closed = G.phase === 'hide' && c === G.seeker
  return { facing: c.facing, t: G.t + c.id.length, closed, moving: Math.min(1, speed / 250) }
}

const playerSeekView = () => G.player && G.player === G.seeker && G.phase === 'seek'

function drawCharacter(c) {
  const o = charOpts(c)
  if (c.found && c.role === 'hider') {
    // happy hop when found
    o.scale = 1 + Math.abs(Math.sin(G.t * 6)) * 0.05
  }
  const prev = ctx.globalAlpha
  if (c.role === 'hider' && !c.found && !c.isPlayer && playerSeekView()) {
    if (c.visReal < 0.02) return
    ctx.globalAlpha = prev * c.visReal
  }
  drawChar(ctx, c.id, c.x, c.y, o)
  ctx.globalAlpha = prev
}

function render() {
  const t = G.t
  const playing = G.phase === 'hide' || G.phase === 'seek' || G.phase === 'ending'
  const playerSeeks = G.player && G.player === G.seeker
  // background
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  const camY = G.cam.y / WORLD_H
  bg.addColorStop(0, `rgb(${12 - camY * 6},${28 - camY * 14},${72 - camY * 30})`)
  bg.addColorStop(1, '#030716')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  worldTransform()
  G.world.drawBack(ctx, t)

  // characters hidden behind spots
  const behind = G.chars.filter((c) => c.hidden && !c.isPlayer)
  for (const c of behind) drawCharacter(c)
  const playerHidden = G.player && G.player.hidden
  if (playerHidden) drawCharacter(G.player)

  G.world.drawSpots(ctx, t)
  G.world.drawFront(ctx, t)

  // visible characters, sorted by depth
  const visible = G.chars.filter((c) => !c.hidden).sort((a, b) => a.y - b.y)
  for (const c of visible) drawCharacter(c)

  // marine snow (screen space, parallax)
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  ctx.fillStyle = 'rgba(200,220,255,0.5)'
  for (const s of snow) {
    const x = (((s.x * W - G.cam.x * s.z * 0.3 + t * 6 * s.z) % W) + W) % W
    const y = (((s.y * H - G.cam.y * s.z * 0.3 + t * 12 * s.z) % H) + H) % H
    ctx.globalAlpha = 0.25 + 0.4 * s.z
    ctx.fillRect(x, y, s.s, s.s)
  }
  ctx.globalAlpha = 1

  // darkness with light holes
  // A hider gets a bright sea to watch everyone; a seeker searches in the dark.
  const seekView = playerSeekView()
  const dark = seekView ? 0.72 : playing ? 0.32 : 0.6
  lctx.setTransform(1, 0, 0, 1, 0, 0)
  lctx.globalCompositeOperation = 'source-over'
  lctx.clearRect(0, 0, lightC.width, lightC.height)
  lctx.fillStyle = `rgba(1,3,16,${dark})`
  lctx.fillRect(0, 0, lightC.width, lightC.height)
  lctx.globalCompositeOperation = 'destination-out'
  const hole = (x, y, r, a) => {
    const [sx, sy] = toScreen(x, y)
    const k = 0.5
    const rr = r * G.cam.scale * k
    if (sx * k + rr < 0 || sy * k + rr < 0 || sx * k - rr > lightC.width || sy * k - rr > lightC.height) return
    lctx.globalAlpha = a
    lctx.drawImage(lightSprite(), sx * k - rr, sy * k - rr, rr * 2, rr * 2)
    lctx.globalAlpha = 1
  }
  for (const l of G.world.lights(t)) hole(l.x, l.y, l.r, l.a)
  const s = G.seeker
  const showCone = playing && s && G.phase !== 'hide'
  const coneR = playerSeeks ? FLASH_R : AI_FLASH_R
  const coneHalf = playerSeeks ? FLASH_HALF : AI_FLASH_HALF
  if (G.player && playing) hole(G.player.x, G.player.y, seekView ? 95 : playerSeeks ? 300 : 260, 1)
  if (showCone) {
    if (!playerSeeks) hole(s.x, s.y, 140, 0.8)
    const [sx, sy] = toScreen(s.x, s.y)
    const k = 0.5
    const R = coneR * G.cam.scale * k
    const g = lctx.createRadialGradient(sx * k, sy * k, 0, sx * k, sy * k, R)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    lctx.fillStyle = g
    // Three nested wedges give the beam soft edges and a bright center.
    for (const f of [1, 0.78, 0.56]) {
      lctx.globalAlpha = playerSeeks ? 0.55 : 0.42
      lctx.beginPath()
      lctx.moveTo(sx * k, sy * k)
      lctx.arc(sx * k, sy * k, R, s.dir - coneHalf * f, s.dir + coneHalf * f)
      lctx.closePath()
      lctx.fill()
    }
    lctx.globalAlpha = 1
  }
  ctx.drawImage(lightC, 0, 0, W, H)

  // glow pass
  worldTransform()
  ctx.globalCompositeOperation = 'lighter'
  G.world.drawGlow(ctx, t)
  if (showCone) {
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, coneR)
    g.addColorStop(0, `rgba(255,240,150,${playerSeeks ? 0.3 : 0.22})`)
    g.addColorStop(1, 'rgba(255,240,150,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(s.x, s.y)
    ctx.arc(s.x, s.y, coneR, s.dir - coneHalf * 0.85, s.dir + coneHalf * 0.85)
    ctx.closePath()
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'

  // faint shadows of hiders moving outside the flashlight: the faster they move, the clearer
  if (seekView) {
    for (const h of G.chars) {
      if (h.isPlayer || h.found || h.visGhost < 0.02) continue
      drawSilhouette(ctx, h.id, h.x, h.y, charOpts(h), '#a9ccff', h.visGhost)
    }
  }

  // the player, see-through when hidden so they can still find themselves
  if (playerHidden) {
    ctx.save()
    ctx.globalAlpha = 0.5
    drawCharacter(G.player)
    ctx.restore()
    label(G.player.x, G.player.y - 66, '🙈 Hidden!', '#9fffc8')
  }

  // particles
  for (const p of G.particles) {
    const a = Math.min(1, p.life / 0.4)
    ctx.save()
    ctx.globalAlpha = a
    ctx.translate(p.x, p.y)
    if (p.type === 'bubble') {
      ctx.strokeStyle = 'rgba(190,230,255,0.9)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, p.size, 0, TAU)
      ctx.stroke()
    } else if (p.type === 'heart') {
      ctx.fillStyle = '#ff7eb6'
      ctx.scale(1.4, 1.4)
      heart(ctx)
    } else if (p.type === 'coin') {
      ctx.fillStyle = '#ffd34a'
      ctx.scale(Math.cos(p.rot), 1)
      ctx.beginPath()
      ctx.arc(0, 0, 6, 0, TAU)
      ctx.fill()
    } else {
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
    }
    ctx.restore()
  }

  // name tags and speech bubbles
  if (playing) {
    for (const c of G.chars) {
      if (c.hidden && !c.isPlayer) continue
      if (c.hidden) continue
      // In the dark, the seeker player only sees tags of hiders inside their light.
      if (seekView && !c.isPlayer && !c.found && c.visReal < 0.6) continue
      if (G.phase === 'hide' && playerSeeks && !c.isPlayer) continue
      const tag = c.isPlayer ? `⭐ ${c.name}` : c.role === 'seeker' ? `👻 ${c.name}` : c.name
      label(c.x, c.y + 62, tag, c.isPlayer ? '#ffd84d' : c.role === 'seeker' ? '#ff9fb8' : '#fff', 15)
    }
    for (const c of G.chars) if (c.bubble) speech(c.x, c.y - 70, c.bubble.text)
  }
  for (const p of G.popups) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, p.life)
    label(p.x, p.y, p.text, p.color, 26)
    ctx.restore()
  }

  // off-screen arrow pointing at the seeker (so the hider knows where danger is)
  if (playing && s && !playerSeeks) {
    const [sx, sy] = toScreen(s.x, s.y)
    const m = 50
    if (sx < 0 || sy < 0 || sx > W || sy > H) {
      const ax = clamp(sx, m, W - m)
      const ay = clamp(sy, m + 60, H - m)
      const a = Math.atan2(sy - ay, sx - ax)
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
      ctx.save()
      ctx.translate(ax, ay)
      ctx.fillStyle = 'rgba(255,120,160,0.85)'
      ctx.beginPath()
      ctx.arc(0, 0, 24, 0, TAU)
      ctx.fill()
      ctx.rotate(a)
      ctx.beginPath()
      ctx.moveTo(34, 0)
      ctx.lineTo(22, -10)
      ctx.lineTo(22, 10)
      ctx.fill()
      ctx.restore()
      ctx.font = '24px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('👻', ax, ay + 1)
    }
  }

  // DOM portraits
  for (const p of portraits) {
    const o = {}
    if (p.dance) {
      o.facing = Math.sin(t * 3) > 0 ? 1 : -1
      o.moving = 1
    }
    if (p.sad) o.closed = Math.sin(t * 1.5) > 0.6
    if (p.card && G.phase === 'menu' && !p.card.classList.contains('selected')) o.t = t * 0.5
    drawPortrait(p.canvas, p.id, o.t ?? t * (p.dance ? 2 : 1), o)
  }
}

function label(x, y, text, color, size = 18) {
  ctx.font = `800 ${size}px 'Baloo 2', 'PingFang TC', 'Microsoft JhengHei', sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 5
  ctx.strokeStyle = 'rgba(5,10,40,0.85)'
  ctx.strokeText(text, x, y)
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
}

function speech(x, y, text) {
  ctx.font = `800 22px 'Baloo 2', 'PingFang TC', 'Microsoft JhengHei', sans-serif`
  const w = Math.max(44, ctx.measureText(text).width + 24)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.roundRect(x - w / 2, y - 22, w, 36, 18)
  ctx.moveTo(x - 8, y + 13)
  ctx.lineTo(x, y + 24)
  ctx.lineTo(x + 8, y + 13)
  ctx.fill()
  ctx.fillStyle = '#2a2a4a'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y - 3)
}

// ---------- Main loop ----------

let last = performance.now()
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  requestAnimationFrame(frame) // schedule first so one bad frame can't freeze the game
  update(dt)
  render()
}

if (location.search.includes('debug')) window.__hs = { G, keys, beginHide, beginSeek, render, update, startGame, assignPicks, rps, beats, step: (sec) => { for (let i = 0; i < sec * 30; i++) update(1 / 30) } }

loadBear().then(() => {
  goMenu()
  requestAnimationFrame(frame)
})
