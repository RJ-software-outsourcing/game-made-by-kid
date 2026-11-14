// Someone needs help! Every few minutes a villager runs up to Coji with a little problem: a lost pet,
// a shopping list, a letter to read, signs that lost their letters... Helping is a short reading game
// (3 rounds, in the job panel). At the end Coji gets a gift for his bag (not coins): toys he can keep
// or swap at the bank, or a snack to eat.
import { Person, randomLook } from './characters.js'
import * as L from './land.js'

const pick = (a) => a[Math.floor(Math.random() * a.length)]
const shuffle = (a) => {
  const b = a.slice()
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}
// same shape as story.js dialogue nodes
const N = (say, choices = null, extra = {}) => ({ say: [].concat(say), choices, ...extra })
const NAMES = ['Lily', 'Sam', 'Nora', 'Leo', 'Maya', 'Ben', 'Iris', 'Tom', 'Rin', 'Ali', 'Gina', 'Max', 'Pia', 'Ken', 'Sara', 'Dan']
const listWords = (w) => (w.length === 1 ? w[0] : w.length === 2 ? `${w[0]} and ${w[1]}` : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`)

// ---------- the little reading and math games ----------

const PETS = [
  ['dog', '🐶'], ['cat', '🐱'], ['rabbit', '🐰'], ['duck', '🦆'], ['pig', '🐷'], ['cow', '🐮'],
  ['hen', '🐔'], ['frog', '🐸'], ['fish', '🐟'], ['bird', '🐦'], ['horse', '🐴'], ['sheep', '🐑'], ['turtle', '🐢'], ['mouse', '🐭'],
]
function petRound(i, used) {
  const pets = shuffle(PETS.filter((p) => !used.includes(p[0]))).slice(0, i < 1 ? 3 : 4)
  const want = pets[0]
  used.push(want[0])
  const clues = {
    dog: 'It wags its tail and barks.', cat: 'It has whiskers and likes to purr.', rabbit: 'It has long ears and hops.', duck: 'It swims and says quack.',
    pig: 'It has a curly tail and likes mud.', cow: 'It eats grass and gives milk.', hen: 'It has feathers and lays eggs.', frog: 'It jumps and says ribbit.',
    fish: 'It has fins and lives in water.', bird: 'It has feathers and can fly.', horse: 'It has hooves and can gallop.', sheep: 'It has thick wool.',
    turtle: 'It carries a hard shell.', mouse: 'It is tiny and likes cheese.',
  }
  const text = `${clues[want[0]]} Which animal am I looking for?`
  return { kind: 'choice', who: '🙋', text, options: shuffle(pets).map(([w, icon]) => ({ id: w, word: w, icon })), answer: [want[0]] }
}

const FOODS = [
  ['milk', '🥛'], ['bread', '🍞'], ['eggs', '🥚'], ['apples', '🍎'], ['cheese', '🧀'], ['bananas', '🍌'],
  ['carrots', '🥕'], ['rice', '🍚'], ['cake', '🍰'], ['corn', '🌽'], ['grapes', '🍇'], ['pears', '🍐'],
]
function shopRound(i) {
  const n = i === 0 ? 2 : 3
  const opts = shuffle(FOODS).slice(0, 6)
  const want = opts.slice(0, n).map((f) => f[0])
  const skip = opts[n][0]
  const text = pick([`Please get ${listWords(want)}, but do not take the ${skip}.`, `My list says ${listWords(want)}. Leave the ${skip} on the shelf.`])
  return { kind: 'build', who: '🧺', text, options: shuffle(opts).map(([w, icon]) => ({ id: w, word: '', icon })), answer: want, serve: 'Done! 🛒' }
}

const PLACES = ['park', 'beach', 'farm', 'zoo', 'library', 'shop', 'lake', 'castle']
const THINGS = ['kite', 'ball', 'hat', 'cake', 'dog', 'boat', 'book', 'bike']
const COLORS = ['red', 'blue', 'green', 'yellow', 'pink', 'purple', 'orange', 'brown']
const FROM = ['Mia', 'Dad', 'Mom', 'Grandma', 'Ken', 'Ava', 'Uncle Bo', 'Lulu']
function letterRound() {
  const place = pick(PLACES)
  const thing = pick(THINGS)
  const color = pick(COLORS)
  const who = pick(FROM)
  const note = `Dear Pal,<br>I am at the ${place}.<br>I have a ${color} ${thing}.<br>Love, ${who}`
  const q = pick(['place', 'color', 'thing', 'who'])
  const opts = (right, pool) => shuffle([right, ...shuffle(pool.filter((x) => x !== right)).slice(0, 2)]).map((w) => ({ id: w, word: w }))
  if (q === 'place') return { kind: 'choice', note, text: `Where is ${who}?`, options: opts(place, PLACES), answer: [place] }
  if (q === 'color') return { kind: 'choice', note, text: `What color is the ${thing}?`, options: opts(color, COLORS), answer: [color] }
  if (q === 'thing') return { kind: 'choice', note, text: `What does ${who} have?`, options: opts(thing, THINGS), answer: [thing] }
  return { kind: 'choice', note, text: 'Who is the letter from?', options: opts(who, FROM), answer: [who] }
}

const GAPS = [
  ['ship', '🚢', 'sh', 0], ['chair', '🪑', 'ch', 0], ['three', '3️⃣', 'th', 0], ['frog', '🐸', 'fr', 0], ['star', '⭐', 'st', 0],
  ['train', '🚂', 'tr', 0], ['clock', '🕐', 'cl', 0], ['green', '🟢', 'gr', 0], ['brush', '🖌️', 'br', 0], ['snake', '🐍', 'sn', 0],
  ['beach', '🏖️', 'ch', 3], ['whale', '🐋', 'wh', 0], ['queen', '👑', 'qu', 0], ['flower', '🌼', 'fl', 0], ['cloud', '☁️', 'cl', 0],
]
const BLENDS = ['sh', 'ch', 'th', 'wh', 'ph', 'tr', 'fr', 'st', 'cl', 'gr', 'br', 'sn', 'qu', 'fl']
function signRound(i, used) {
  let g = pick(GAPS)
  for (let k = 0; k < 8 && used.includes(g[0]); k++) g = pick(GAPS)
  used.push(g[0])
  const [word, icon, letters, at] = g
  const shown = word.slice(0, at) + '__' + word.slice(at + letters.length)
  const opts = shuffle([letters, ...shuffle(BLENDS.filter((x) => x !== letters)).slice(0, 2)])
  return { kind: 'choice', picture: icon, text: `Complete <b class="gap">${shown}</b>. Which two letters are missing?`, options: opts.map((l) => ({ id: l, word: l })), answer: [letters] }
}

function mathRound() {
  const two = 10 + Math.floor(Math.random() * 80)
  const one = 1 + Math.floor(Math.random() * 9)
  const add = Math.random() < 0.5
  const answer = add ? two + one : two - one
  const nearby = shuffle([...new Set([answer - 1, answer + 1, add ? answer - 2 : answer + 2, answer + one].filter((n) => n >= 0 && n !== answer))]).slice(0, 2)
  return {
    kind: 'choice',
    who: '🧮',
    text: `What is <b>${two} ${add ? '+' : '−'} ${one}</b>?`,
    options: shuffle([answer, ...nearby]).map((n) => ({ id: String(n), word: String(n) })),
    answer: [String(answer)],
  }
}

const RHYMES = [
  ['cat', 'hat', ['dog', 'sun']], ['dog', 'log', ['cup', 'hen']], ['sun', 'run', ['bed', 'cat']], ['bee', 'tree', ['cow', 'map']],
  ['cake', 'lake', ['ball', 'sock']], ['moon', 'spoon', ['star', 'fish']], ['fish', 'dish', ['bird', 'boat']], ['star', 'car', ['tree', 'pig']],
  ['bed', 'red', ['fox', 'cup']], ['frog', 'log', ['bear', 'kite']], ['king', 'ring', ['duck', 'hat']], ['bell', 'shell', ['frog', 'sun']],
]
function rhymeRound(i, used) {
  let r = pick(RHYMES)
  for (let k = 0; k < 8 && used.includes(r[0]); k++) r = pick(RHYMES)
  used.push(r[0])
  return { kind: 'choice', who: '🎵', text: `Which word rhymes with <b>${r[0]}</b>?`, options: shuffle([r[1], ...r[2]]).map((w) => ({ id: w, word: w })), answer: [r[1]] }
}

const OPPOSITES = [
  ['ancient', 'modern'], ['arrive', 'leave'], ['brave', 'afraid'], ['careful', 'careless'], ['empty', 'full'], ['narrow', 'wide'],
  ['noisy', 'quiet'], ['smooth', 'rough'], ['borrow', 'lend'], ['remember', 'forget'], ['early', 'late'], ['victory', 'defeat'],
]
function oppRound(i, used) {
  let o = pick(OPPOSITES)
  for (let k = 0; k < 8 && used.includes(o[0]); k++) o = pick(OPPOSITES)
  used.push(o[0])
  const flip = Math.random() < 0.5
  const [a, b] = flip ? [o[1], o[0]] : o
  const others = shuffle(OPPOSITES.filter((x) => x !== o).flat()).slice(0, 2)
  return { kind: 'choice', who: '🧒', text: `What is the opposite of <b>${a}</b>?`, options: shuffle([b, ...others]).map((w) => ({ id: w, word: w })), answer: [b] }
}

const SWATCH = { red: '#e94b3c', blue: '#3b7dd8', green: '#4caf50', yellow: '#ffd23f', pink: '#ff8fb1', purple: '#9b6bdf', orange: '#ff9f43', brown: '#8b5a2b' }
function colorRound(i, used) {
  const cols = shuffle(Object.keys(SWATCH).filter((c) => !used.includes(c))).slice(0, i < 1 ? 3 : 4)
  const want = cols[0]
  used.push(want)
  const thing = pick(['kite', 'ball', 'hat', 'boat', 'balloon'])
  return { kind: 'choice', who: '🪁', text: pick([`My ${thing} is ${want}. Which one is mine?`, `I want the ${want} ${thing}, please!`]), options: shuffle(cols).map((c) => ({ id: c, word: '', swatch: SWATCH[c] })), answer: [want] }
}

// ---------- who needs help, and what they give ----------

export const REQUESTS = [
  { id: 'pet', kid: true, title: '🐾 Find My Pets', gen: petRound, done: 'pets found', call: ['Coji! Coji! Help!', 'Oh no, oh no!'], problem: ['My pets ran away!', 'Can you help me find them?'], gifts: ['ball', 'yoyo', 'lollipop'] },
  { id: 'shop', kid: false, title: '🛒 The Shopping List', gen: shopRound, done: 'things found', call: ['Excuse me, Coji!', 'Oh dear, Coji!'], problem: ['I lost my glasses. I cannot read my list!', 'Can you help me get the food?'], gifts: ['cupcake', 'pie', 'sandwich'] },
  { id: 'letter', kid: false, title: '✉️ Read My Letters', gen: letterRound, done: 'letters read', call: ['Hello, Coji! Can you read?', 'Coji, wait!'], problem: ['I got some letters. My eyes are so tired.', 'Can you read them for me?'], gifts: ['book', 'medal', 'crayons'] },
  { id: 'sign', kid: false, title: '🔤 Fix the Signs', gen: signRound, done: 'signs fixed', call: ['Coji! Over here!', 'Hey, Coji!'], problem: ['The wind blew letters off my signs!', 'Can you help me fix them?'], gifts: ['toycar', 'kite', 'medal'] },
  { id: 'count', kid: true, title: '🧮 Number Challenge', gen: mathRound, done: 'answers solved', call: ['Hi, Coji! Can you solve a number challenge?', 'Coji! I have a math puzzle!'], problem: ['It mixes a two-digit number with a one-digit number.', 'Can you add and subtract with me?'], gifts: ['crayons', 'ball', 'lollipop'] },
  { id: 'rhyme', kid: true, title: '🎵 Rhyme Time', gen: rhymeRound, done: 'rhymes found', call: ['La la la! Hi, Coji!', 'Coji! I need you!'], problem: ['I am making a song. It needs words that rhyme.', 'Can you help me?'], gifts: ['yoyo', 'kite', 'cupcake'] },
  { id: 'opp', kid: false, title: '↔️ Opposites', gen: oppRound, done: 'words right', call: ['Hello, Coji!', 'Coji, do you have a minute?'], problem: ['My little boy is playing a word game.', 'He needs help with opposites. Can you help him?'], gifts: ['book', 'toycar', 'pie'] },
  { id: 'kites', kid: true, title: '🎨 Which Color?', gen: colorRound, done: 'colors right', call: ['Coji! My things are all mixed up!', 'Help, help!'], problem: ['My friends and I have lots of toys.', 'Can you help me find mine?'], gifts: ['kite', 'crayons', 'lollipop'] },
]

const YES = ['Yes! I can help you!', 'Sure! What can I do?', 'Of course! Let me help.', 'Okay! I will help you.', 'No problem! I can do it.']
const NO = ['Sorry, not now.', 'Maybe later, okay?', 'I am busy now. Sorry!']
const THANK = ['Thank you so much, Coji!', 'You are a great helper!', 'Wow, you did it! Thank you!', 'You are so kind, Coji!']

function helperCast(H, it) {
  const r = it.req
  return {
    name: r.name,
    dynamic: true,
    voice: r.kid ? 1.4 : 1,
    greetNode: (g) => {
      if (r.state === 'done') return N([pick(THANK), pick(['Have fun with your gift!', 'See you, Coji!', 'Bye-bye!'])], null, { auto: true })
      if (r.state === 'no') return N([pick(['Oh, hi again!', 'Hello, Coji!']), 'Can you help me now?'], [
        { text: pick(YES), go: () => N([pick(['Hooray! Thank you!', 'Yay! Let us start!'])], null, { onShow: () => g.later(() => H.begin(it)) }) },
        { text: pick(NO), go: () => N([pick(['Okay. Bye!', 'That is okay.'])], null, { auto: true }) },
      ])
      return N([pick(r.call), `I am ${r.name}.`, ...r.problem], [
        { text: pick(YES), go: () => N([pick(['Hooray! Thank you!', 'Yay! Let us start!', 'Oh, thank you, Coji!'])], null, { onShow: () => g.later(() => H.begin(it)) }) },
        { text: pick(NO), go: () => N([pick(['Okay. Maybe later!', 'That is okay. Bye!'])], null, { auto: true, onShow: () => (r.state = 'no') }) },
      ])
    },
  }
}

export class Helpers {
  constructor(game) {
    this.game = game
    this.t = 70 + Math.random() * 50 // the first one comes after a minute or two of play
    this.active = null
  }

  update(dt) {
    const g = this.game
    if (g.mode !== 'play') return
    if (this.active) return this.follow(dt)
    if (g.dialogue.open || g.ui.anyPanel() || g.player.resting || g.player.nap > 0) return
    this.t -= dt
    if (this.t > 0) return
    const p = g.player
    if (L.spookiness(p.x, p.z) > 0.1 || L.onBridge(p.x, p.z) || L.onPier(p.x, p.z)) {
      this.t = 15
      return
    }
    this.t = 150 + Math.random() * 120
    this.spawn()
  }

  spawn() {
    const g = this.game
    const crowd = g.crowd
    const s = crowd.spot(() => true)
    if (!s) {
      this.t = 15
      return
    }
    const last = g.state.lastHelp
    const req = { ...pick(REQUESTS.filter((r) => r.id !== last)) }
    req.name = pick(NAMES)
    req.gift = pick(req.gifts)
    req.used = []
    req.state = 'ask'
    g.state.lastHelp = req.id
    const ch = new Person(randomLook(Math.random, req.kid))
    // the dialogue holds on to `holder`; holder.item is the walker the crowd moves around
    const holder = { req }
    holder.item = crowd.add('helper', ch, s[0], s[1], helperCast(this, holder), { speed: req.kid ? 2.6 : 2.1, life: 150, follow: true, req })
    this.active = holder.item
    this.repath = 0
    g.ui.tip(`Someone is running to you! ${req.kid ? '🧒' : '🙋'} Maybe they need help!`, { key: 'helper', cooldown: 30, force: true })
  }

  // walk up to Coji, then ask
  follow(dt) {
    const g = this.game
    const it = this.active
    if (!g.crowd.items.includes(it)) {
      this.active = null
      return
    }
    // after asking once they wait nearby (tap them to help later), even if the box was just closed
    if (it.req.state !== 'ask' || it.asked || g.talking === it.e) return
    const p = g.player
    const e = it.e
    const d = Math.hypot(p.x - e.x, p.z - e.z)
    if (d < 2.4) {
      it.path = []
      if (!g.dialogue.open && !g.ui.anyPanel() && !g.player.path.length) {
        it.ch.root.rotation.y = Math.atan2(p.x - e.x, p.z - e.z)
        g.startTalk(e)
        it.asked = true
        it.follow = false
        it.stay = true
        it.home = [e.x, e.z]
      }
      return
    }
    this.repath -= dt
    if (this.repath <= 0 || !it.path.length) {
      this.repath = 1.2
      const a = Math.atan2(e.z - p.z, e.x - p.x)
      const path = g.world.nav.find(e.x, e.z, p.x + Math.cos(a) * 1.6, p.z + Math.sin(a) * 1.6, 3000)
      if (path) it.path = path
    }
  }

  begin(holder) {
    const r = holder.req
    const g = this.game
    g.jobs.startHelp({
      title: r.title,
      rounds: 3,
      done: r.done,
      gift: r.gift,
      who: r.name,
      gen: (i) => r.gen(i, r.used),
      onDone: () => this.finish(holder),
    })
  }

  finish(holder) {
    const g = this.game
    const r = holder.req
    const it = holder.item
    r.state = 'done'
    g.give(r.gift, 1)
    g.state.helped = (g.state.helped || 0) + 1
    it.stay = false
    it.follow = false
    it.life = 25
    g.save()
    if (this.active === it) this.active = null
  }
}

