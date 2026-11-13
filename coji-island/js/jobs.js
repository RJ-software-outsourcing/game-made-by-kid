// Jobs: short reading mini-games that pay coins. A shift has 5 rounds; each right answer pays 1 coin,
// a perfect shift pays 1 more. After a shift the job needs a little rest (JOB_REST seconds of play).
import { sfx } from './audio.js'
import { ITEMS } from './items.js'

export const JOB_REST = 60
const ROUNDS = 5
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const shuffle = (a) => {
  const b = a.slice()
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}
const listWords = (w) => (w.length === 1 ? w[0] : w.length === 2 ? `${w[0]} and ${w[1]}` : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`)
const CUSTOMERS = ['🧒', '👧', '👦', '👩', '👨', '👵', '👴', '🐻', '🐱', '🐰', '🦉']

// ---------- Burger Kitchen ----------
const TOPPINGS = [
  { id: 'cheese', word: 'cheese', icon: '🧀' },
  { id: 'tomato', word: 'tomato', icon: '🍅' },
  { id: 'lettuce', word: 'lettuce', icon: '🥬' },
  { id: 'pickles', word: 'pickles', icon: '🥒' },
  { id: 'onion', word: 'onion', icon: '🧅' },
  { id: 'egg', word: 'egg', icon: '🍳' },
]
function burgerRound(i) {
  const n = i < 2 ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2)
  const items = shuffle(TOPPINGS).slice(0, n + 1)
  const want = items.slice(0, n)
  const no = items[n]
  const w = want.map((t) => t.word)
  let text
  if (i >= 3 && Math.random() < 0.4) text = `I want ${listWords(w)}. No ${no.word}, please!`
  else
    text = pick(
      n === 1
        ? [`A burger with ${w[0]}, please!`, `I want ${w[0]} on my burger.`]
        : n === 2
          ? [`A burger with ${w[0]} and ${w[1]}, please!`, `I want ${w[0]} and ${w[1]}.`]
          : [`Can I have ${listWords(w)} on my burger?`, `A burger with ${listWords(w)}, please!`],
    )
  return { kind: 'build', who: pick(CUSTOMERS), text, options: TOPPINGS, answer: want.map((t) => t.id), serve: 'Serve! 🍔', preview: 'burger' }
}

// ---------- Ice Cream Stand ----------
const FLAVORS = [
  { id: 'strawberry', word: 'strawberry', color: 'pink', hex: '#ff8fb1' },
  { id: 'chocolate', word: 'chocolate', color: 'brown', hex: '#7a4a2a' },
  { id: 'vanilla', word: 'vanilla', color: 'white', hex: '#fff6dc' },
  { id: 'mint', word: 'mint', color: 'green', hex: '#8fe08a' },
  { id: 'lemon', word: 'lemon', color: 'yellow', hex: '#ffe066' },
  { id: 'blueberry', word: 'blueberry', color: 'blue', hex: '#7fb2ff' },
]
function iceRound(i) {
  const n = i < 2 ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2)
  const want = shuffle(FLAVORS).slice(0, n)
  const useColor = Math.random() < 0.6
  const words = want.map((f) => (useColor ? `${f.color}` : f.word))
  const num = ['One', 'Two', 'Three'][n - 1]
  const text =
    n === 1
      ? pick([`One ${words[0]} scoop, please!`, `I want a ${words[0]} scoop.`])
      : pick([`${num} scoops: ${listWords(words)}, please!`, `I want ${listWords(words.map((w) => `a ${w} scoop`))}.`])
  return { kind: 'build', who: pick(CUSTOMERS), text, options: FLAVORS.map((f) => ({ id: f.id, word: f.word, swatch: f.hex })), answer: want.map((f) => f.id), serve: 'Serve! 🍦', preview: 'cone', flavors: FLAVORS }
}

// ---------- Sort the Mail ----------
// A letter with an address. Read the country, then put it in the right country box.
// The boxes look alike on purpose (Japan / Jamaica, India / Italy...), so the child has to read.
const COUNTRIES = [
  { id: 'japan', name: 'Japan', flag: '🇯🇵', city: 'Tokyo', look: ['jamaica', 'jordan'] },
  { id: 'jamaica', name: 'Jamaica', flag: '🇯🇲', city: 'Kingston', look: ['japan', 'jordan'] },
  { id: 'jordan', name: 'Jordan', flag: '🇯🇴', city: 'Amman', look: ['japan', 'jamaica'] },
  { id: 'korea', name: 'Korea', flag: '🇰🇷', city: 'Seoul', look: ['kenya', 'kuwait'] },
  { id: 'kenya', name: 'Kenya', flag: '🇰🇪', city: 'Nairobi', look: ['korea', 'kuwait'] },
  { id: 'kuwait', name: 'Kuwait', flag: '🇰🇼', city: 'Kuwait City', look: ['korea', 'kenya'] },
  { id: 'india', name: 'India', flag: '🇮🇳', city: 'Delhi', look: ['italy', 'iceland'] },
  { id: 'italy', name: 'Italy', flag: '🇮🇹', city: 'Rome', look: ['india', 'iceland'] },
  { id: 'iceland', name: 'Iceland', flag: '🇮🇸', city: 'Reykjavik', look: ['italy', 'ireland'] },
  { id: 'ireland', name: 'Ireland', flag: '🇮🇪', city: 'Dublin', look: ['iceland', 'italy'] },
  { id: 'canada', name: 'Canada', flag: '🇨🇦', city: 'Toronto', look: ['china', 'chile'] },
  { id: 'china', name: 'China', flag: '🇨🇳', city: 'Beijing', look: ['canada', 'chile'] },
  { id: 'chile', name: 'Chile', flag: '🇨🇱', city: 'Santiago', look: ['china', 'canada'] },
  { id: 'france', name: 'France', flag: '🇫🇷', city: 'Paris', look: ['finland', 'fiji'] },
  { id: 'finland', name: 'Finland', flag: '🇫🇮', city: 'Helsinki', look: ['france', 'fiji'] },
  { id: 'fiji', name: 'Fiji', flag: '🇫🇯', city: 'Suva', look: ['finland', 'france'] },
  { id: 'spain', name: 'Spain', flag: '🇪🇸', city: 'Madrid', look: ['sweden', 'singapore'] },
  { id: 'sweden', name: 'Sweden', flag: '🇸🇪', city: 'Stockholm', look: ['spain', 'singapore'] },
  { id: 'singapore', name: 'Singapore', flag: '🇸🇬', city: 'Singapore', look: ['spain', 'sweden'] },
  { id: 'taiwan', name: 'Taiwan', flag: '🇹🇼', city: 'Taipei', look: ['thailand', 'turkey'] },
  { id: 'thailand', name: 'Thailand', flag: '🇹🇭', city: 'Bangkok', look: ['taiwan', 'turkey'] },
  { id: 'turkey', name: 'Turkey', flag: '🇹🇷', city: 'Ankara', look: ['taiwan', 'thailand'] },
  { id: 'brazil', name: 'Brazil', flag: '🇧🇷', city: 'Rio', look: ['britain', 'belgium'] },
  { id: 'britain', name: 'Britain', flag: '🇬🇧', city: 'London', look: ['brazil', 'belgium'] },
  { id: 'belgium', name: 'Belgium', flag: '🇧🇪', city: 'Brussels', look: ['brazil', 'britain'] },
]
const PEOPLE = ['Mr. Lee', 'Ms. Park', 'Grandma Ana', 'Uncle Bob', 'Miss Mia', 'Dr. Kato', 'Mrs. Smith', 'Little Tim', 'Aunt Rosa', 'Mr. Chen']
const STREETS = ['12 Park Road', '5 Sun Street', '88 Lake Lane', '3 Hill Road', '21 Rose Street', '7 Moon Avenue', '40 Tree Lane']
const usedCountries = []
function postRound() {
  let c = pick(COUNTRIES)
  for (let k = 0; k < 8 && usedCountries.includes(c.id); k++) c = pick(COUNTRIES)
  usedCountries.push(c.id)
  if (usedCountries.length > 10) usedCountries.shift()
  const boxes = shuffle([c.id, ...c.look.slice(0, 2)]).map((id) => COUNTRIES.find((x) => x.id === id))
  return {
    kind: 'choice',
    letter: true,
    address: [pick(PEOPLE), pick(STREETS), c.city, c.name.toUpperCase()],
    options: boxes.map((b) => ({ id: b.id, word: b.name, icon: '📮' + b.flag })),
    answer: [c.id],
    ask: 'Read the address. Which country box?',
  }
}

// ---------- Word Check ----------
const WORDS = [
  ['🐱', 'cat', 'cap', 'can'],
  ['🐶', 'dog', 'dot', 'dig'],
  ['☀️', 'sun', 'sit', 'run'],
  ['🐝', 'bee', 'bed', 'see'],
  ['🦆', 'duck', 'dock', 'luck'],
  ['🚌', 'bus', 'bun', 'but'],
  ['🐟', 'fish', 'dish', 'fist'],
  ['🎩', 'hat', 'hot', 'ham'],
  ['🛏️', 'bed', 'bad', 'bee'],
  ['🐷', 'pig', 'pin', 'big'],
  ['🦊', 'fox', 'box', 'fix'],
  ['🌙', 'moon', 'noon', 'moan'],
  ['🐸', 'frog', 'flag', 'from'],
  ['🌳', 'tree', 'three', 'free'],
  ['🦀', 'crab', 'cram', 'grab'],
  ['🍰', 'cake', 'lake', 'cave'],
  ['🚀', 'rocket', 'pocket', 'socket'],
  ['🐻', 'bear', 'pear', 'bean'],
  ['👑', 'crown', 'clown', 'brown'],
  ['🧦', 'sock', 'rock', 'sick'],
  ['🦉', 'owl', 'own', 'bowl'],
  ['⭐', 'star', 'stair', 'stay'],
  ['🌧️', 'rain', 'train', 'ran'],
  ['🚂', 'train', 'rain', 'trail'],
  ['🐑', 'sheep', 'ship', 'sleep'],
  ['🍎', 'apple', 'ample', 'ankle'],
  ['🐍', 'snake', 'snack', 'shake'],
  ['🌽', 'corn', 'horn', 'cord'],
]
const usedWords = []
function schoolRound() {
  let w = pick(WORDS)
  for (let k = 0; k < 6 && usedWords.includes(w[1]); k++) w = pick(WORDS)
  usedWords.push(w[1])
  if (usedWords.length > 12) usedWords.shift()
  const opts = shuffle(w.slice(1)).map((x) => ({ id: x, word: x }))
  return { kind: 'choice', picture: w[0], text: 'What is this? Tap the word.', options: opts, answer: [w[1]] }
}

export const JOBS = {
  burger: { title: '🍔 Burger Kitchen', who: 'ben', gen: burgerRound, done: 'burgers' },
  icecream: { title: '🍦 Ice Cream Stand', who: 'coco', gen: iceRound, done: 'orders' },
  post: { title: '📮 Sort the Mail', who: 'max', gen: postRound, done: 'letters' },
  school: { title: '🏫 Word Check', who: 'kim', gen: schoolRound, done: 'words' },
}

// ---------- the job panel ----------

export class JobRunner {
  constructor(game) {
    this.game = game
    this.el = document.getElementById('job')
    this.$ = (s) => this.el.querySelector(s)
    this.$('.close').addEventListener('click', () => this.quit())
    this.$('.job-serve').addEventListener('click', () => this.serve())
  }

  start(id) {
    this.id = id
    this.job = JOBS[id]
    this.begin()
  }

  // A help request (from help.js): a few rounds, and a gift at the end instead of coins.
  startHelp(job) {
    this.id = null
    this.job = job
    this.begin()
  }

  get rounds() {
    return this.job.rounds || ROUNDS
  }

  begin() {
    this.round = 0
    this.right = 0
    this.$('.job-title').textContent = this.job.title
    this.game.ui.openPanel('job')
    this.next()
  }

  quit() {
    // Leaving a job early still pays what was earned (a help request only gives its gift at the end).
    if (this.right > 0 && !this.paid && !this.job.gift) this.pay()
    this.game.ui.closePanel('job')
  }

  next() {
    this.paid = false
    if (this.round >= this.rounds) return this.finish()
    this.r = this.job.gen(this.round)
    this.sel = new Set()
    this.locked = false
    this.render()
  }

  render() {
    const r = this.r
    this.$('.job-dots').innerHTML = Array.from({ length: this.rounds }, (_, i) => `<i class="${i < this.round ? 'done' : i === this.round ? 'now' : ''}"></i>`).join('')
    this.$('.job-earn').innerHTML = this.job.gift ? `🎁` : `<i class="coin-ico"></i>+${this.right}`
    const prompt = this.$('.job-prompt')
    if (r.note) prompt.innerHTML = `<div class="note">${r.note}</div><div class="ask">${r.text}</div>`
    else if (r.letter)
      prompt.innerHTML = `<div class="ask">${r.ask}</div><div class="letter"><div class="stamp">✉️</div><div class="addr">${r.address.map((l, i) => `<div class="${i === r.address.length - 1 ? 'country' : ''}">${l}</div>`).join('')}</div><div class="postmark">AIR MAIL</div></div>`
    else if (r.picture) prompt.innerHTML = `<div class="picture">${r.picture}</div><div class="ask">${r.text}</div>`
    else prompt.innerHTML = `<div class="order"><span class="who">${r.who}</span><div class="bubble">${r.text}</div></div>`
    const opts = this.$('.job-options')
    opts.innerHTML = ''
    opts.className = 'job-options ' + (r.kind === 'build' ? 'grid' : 'list')
    for (const o of r.options) {
      const b = document.createElement('button')
      b.className = 'job-opt'
      b.dataset.id = o.id
      b.innerHTML = `${o.icon ? `<span class="e">${o.icon}</span>` : ''}${o.swatch ? `<span class="swatch" style="background:${o.swatch}"></span>` : ''}<span class="w">${o.word}</span>`
      b.addEventListener('click', () => this.tap(o.id, b))
      opts.append(b)
    }
    const serve = this.$('.job-serve')
    serve.classList.toggle('hidden', r.kind !== 'build')
    serve.textContent = r.serve || 'Done!'
    this.$('.job-msg').textContent = ''
    this.$('.job-msg').className = 'job-msg'
    this.drawPreview()
  }

  drawPreview() {
    const r = this.r
    const pv = this.$('.job-preview')
    if (r.preview === 'burger') {
      const fill = TOPPINGS.filter((t) => this.sel.has(t.id))
        .map((t) => t.icon)
        .join('')
      pv.innerHTML = `<div class="burger"><div class="bun top"></div><div class="fill">${fill || '&nbsp;'}</div><div class="patty"></div><div class="bun bottom"></div></div>`
    } else if (r.preview === 'cone') {
      const scoops = r.flavors.filter((f) => this.sel.has(f.id))
      pv.innerHTML = `<div class="icecone"><div class="scoops">${scoops.map((f) => `<i style="background:${f.hex}"></i>`).join('')}</div><div class="cone"></div></div>`
    } else pv.innerHTML = ''
  }

  tap(id, btn) {
    if (this.locked) return
    sfx('tap')
    if (this.r.kind === 'build') {
      if (this.sel.has(id)) this.sel.delete(id)
      else this.sel.add(id)
      btn.classList.toggle('on', this.sel.has(id))
      this.drawPreview()
    } else {
      this.sel = new Set([id])
      this.check()
    }
  }

  serve() {
    if (this.locked) return
    if (!this.sel.size) {
      sfx('nope')
      this.$('.job-msg').textContent = 'Tap what the customer wants first!'
      return
    }
    this.check()
  }

  check() {
    this.locked = true
    const ans = new Set(this.r.answer)
    const ok = ans.size === this.sel.size && [...ans].every((a) => this.sel.has(a))
    const msg = this.$('.job-msg')
    for (const b of this.el.querySelectorAll('.job-opt')) {
      if (ans.has(b.dataset.id)) b.classList.add('right')
      else if (this.sel.has(b.dataset.id)) b.classList.add('wrong')
    }
    if (ok) {
      this.right++
      sfx('coin')
      msg.textContent = this.job.gift ? pick(['✅ Great job!', '✅ Yes! That is right!', '✅ You did it!', '✅ Super!']) : pick(['✅ Great job! +1', '✅ Perfect! +1', '✅ Yummy! +1', '✅ You did it! +1'])
      msg.className = 'job-msg ok'
    } else {
      sfx('nope')
      msg.textContent = '❌ Oops! The green ones were right.'
      msg.className = 'job-msg bad'
    }
    if (!this.job.gift) this.$('.job-earn').innerHTML = `<i class="coin-ico"></i>+${this.right}`
    this.round++
    setTimeout(() => this.next(), ok ? 1100 : 1900)
  }

  pay() {
    this.paid = true
    const bonus = this.right === ROUNDS ? 1 : 0
    const total = this.right + bonus
    const g = this.game
    g.state.jobs[this.id] = g.state.play
    g.state.energy = Math.max(1, g.state.energy - 4)
    if (total > 0) g.addCoins(total)
    g.save()
    return { total, bonus }
  }

  finish() {
    if (this.job.gift) return this.finishHelp()
    const { total, bonus } = this.pay()
    const stars = '⭐'.repeat(Math.max(1, Math.round((this.right / ROUNDS) * 3)))
    this.$('.job-dots').innerHTML = ''
    this.$('.job-preview').innerHTML = ''
    this.$('.job-serve').classList.add('hidden')
    this.$('.job-msg').textContent = ''
    this.$('.job-prompt').innerHTML = `<div class="job-done"><div class="stars">${stars}</div><b>${this.right} of ${ROUNDS} ${this.job.done} right!</b><span>You earned <i class="coin-ico"></i>${total}${bonus ? ' (+1 bonus coin for a perfect job!)' : ''}</span></div>`
    const opts = this.$('.job-options')
    opts.className = 'job-options list'
    opts.innerHTML = ''
    const b = document.createElement('button')
    b.className = 'big-btn'
    b.textContent = 'Thank you! 👋'
    b.addEventListener('click', () => this.game.ui.closePanel('job'))
    opts.append(b)
    sfx(this.right >= 4 ? 'quest' : 'happy')
  }

  finishHelp() {
    const j = this.job
    const it = ITEMS[j.gift]
    this.paid = true
    j.onDone?.()
    this.$('.job-dots').innerHTML = ''
    this.$('.job-preview').innerHTML = ''
    this.$('.job-serve').classList.add('hidden')
    this.$('.job-msg').textContent = ''
    this.$('.job-prompt').innerHTML = `<div class="job-done"><div class="stars">🎁</div><b>You helped ${j.who}! ${this.right} of ${this.rounds} ${j.done}.</b><span>${j.who} gave you a gift: ${it.icon} ${it.name}!</span><span>${it.desc}</span></div>`
    const opts = this.$('.job-options')
    opts.className = 'job-options list'
    opts.innerHTML = ''
    const b = document.createElement('button')
    b.className = 'big-btn'
    b.textContent = pick(['Thank you! 👋', 'Yay! Thanks! 😊', 'Wow! Thank you! 🎁'])
    b.addEventListener('click', () => this.game.ui.closePanel('job'))
    opts.append(b)
    sfx('quest')
  }
}
