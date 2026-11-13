// HUD and panels: stats, quest card, Blankie's tips, toasts, bag, shop, menu, finale.
import { ITEMS, SHOPS } from './items.js'
import { QUESTS } from './story.js'
import { sfx, isMuted, setMuted, unlock } from './audio.js'

const $ = (s, el = document) => el.querySelector(s)

export const BLANKIE_SVG = `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
  <circle cx="14" cy="15" r="10" fill="#a6bdd8"/><circle cx="50" cy="15" r="10" fill="#a6bdd8"/>
  <circle cx="14" cy="15" r="5" fill="#c4d4e8"/><circle cx="50" cy="15" r="5" fill="#c4d4e8"/>
  <circle cx="32" cy="35" r="24" fill="#e1e2df" stroke="#cfd3d4" stroke-width="2"/>
  <path d="M12 30 q20 -6 40 0 M10 40 q22 -6 44 0" stroke="#d3d6d6" stroke-width="2" fill="none"/>
  <circle cx="23" cy="31" r="3.2" fill="#86644e"/><circle cx="41" cy="31" r="3.2" fill="#86644e"/>
  <ellipse cx="32" cy="43" rx="10" ry="8" fill="#f1f0eb"/>
  <ellipse cx="32" cy="39.5" rx="4.2" ry="3.2" fill="#86644e"/>
  <path d="M32 42 v4.5" stroke="#86644e" stroke-width="2" stroke-linecap="round"/>
  <circle cx="17" cy="40" r="3.5" fill="#f6c3c0" opacity=".7"/><circle cx="47" cy="40" r="3.5" fill="#f6c3c0" opacity=".7"/>
</svg>`

export class UI {
  constructor(game) {
    this.game = game
    this.hud = $('#hud')
    this.energyEl = $('#st-energy')
    this.waterEl = $('#st-water')
    this.coinsEl = $('#coins')
    this.questEl = $('#quest')
    this.hintEl = $('#hint')
    $('.hint-face', this.hintEl).innerHTML = BLANKIE_SVG
    this.toastsEl = $('#toasts')
    this.lastCoins = null
    this.tipTimes = {}

    this.questEl.addEventListener('click', () => {
      this.questEl.classList.toggle('open')
      this.renderQuest()
      sfx('tap')
    })
    $('#btn-bag').addEventListener('click', () => this.openBag())
    $('#btn-map').addEventListener('click', () => game.openMap())
    $('#btn-rest').addEventListener('click', () => game.toggleRest())
    $('#btn-menu').addEventListener('click', () => this.openPanel('menu'))
    const snd = $('#btn-sound')
    snd.textContent = isMuted() ? '🔇' : '🔊'
    snd.addEventListener('click', () => {
      setMuted(!isMuted())
      snd.textContent = isMuted() ? '🔇' : '🔊'
      unlock()
    })
    for (const id of ['bag', 'shop', 'map', 'menu']) {
      const p = $('#' + id)
      $('.close', p)?.addEventListener('click', () => this.closePanel(id))
      p.addEventListener('click', (e) => {
        if (e.target === p) this.closePanel(id)
      })
    }
    $('#menu').addEventListener('click', async (e) => {
      const a = e.target.closest('[data-act]')?.dataset.act
      if (a === 'resume') this.closePanel('menu')
      if (a === 'restart') {
        this.closePanel('menu')
        if (await this.confirm('Start over from the beginning?')) game.restart()
      }
    })
    $('#finale').addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]')?.dataset.act
      if (a === 'explore') {
        $('#finale').classList.add('hidden')
        game.afterFinale()
      }
      if (a === 'again') game.restart()
    })
    this.hintEl.addEventListener('click', () => this.hideHint())
  }

  show() {
    this.hud.classList.remove('hidden')
  }
  hide() {
    this.hud.classList.add('hidden')
  }

  anyPanel() {
    return ['bag', 'shop', 'map', 'menu', 'confirm', 'job'].some((id) => !$('#' + id).classList.contains('hidden'))
  }
  openPanel(id) {
    unlock()
    sfx('open')
    $('#' + id).classList.remove('hidden')
  }
  closePanel(id) {
    const p = $('#' + id)
    if (p.classList.contains('hidden')) return
    sfx('close')
    p.classList.add('hidden')
    if (id === 'map') this.game.onMapClosed?.()
  }

  confirm(q) {
    return new Promise((resolve) => {
      const p = $('#confirm')
      $('.confirm-q', p).textContent = q
      p.classList.remove('hidden')
      const on = (e) => {
        const a = e.target.closest('[data-act]')?.dataset.act
        if (!a) return
        p.removeEventListener('click', on)
        p.classList.add('hidden')
        resolve(a === 'yes')
      }
      p.addEventListener('click', on)
    })
  }

  // ---------- stats ----------
  update(s) {
    this.energyEl.querySelector('i').style.width = `${Math.max(0, s.energy)}%`
    this.waterEl.querySelector('i').style.width = `${Math.max(0, s.water)}%`
    this.energyEl.classList.toggle('low', s.energy < 25)
    this.waterEl.classList.toggle('low', s.water < 25)
    if (this.lastCoins !== s.coins) {
      if (this.lastCoins !== null) {
        this.coinsEl.parentElement.classList.remove('bump')
        void this.coinsEl.offsetWidth
        this.coinsEl.parentElement.classList.add('bump')
      }
      this.lastCoins = s.coins
      this.coinsEl.textContent = s.coins
    }
    $('#btn-rest').classList.toggle('on', !!this.game.player?.resting)
    $('#btn-bag').classList.toggle('glow', s.energy < 25 && this.game.hasFood())
  }

  // ---------- quest card ----------
  // Several quests can be active. The card shows one (the last one started or moved on, or the one
  // Coji is close to); the label shows the others' icons, and the open card lists them all.
  renderQuest() {
    const s = this.game.state
    const el = this.questEl
    const quests = s.quests || {}
    const id = this.game.focusQuest?.()
    $('.q-label', el).textContent = '⭐ MISSION'
    if (!id) {
      if (s.done.length) {
        const left = Object.keys(QUESTS).some((k) => !s.done.includes(k))
        el.classList.remove('hidden')
        $('.q-icon', el).textContent = '🏝️'
        $('.q-title', el).textContent = 'FREE TIME'
        $('.q-step', el).textContent = left ? 'Someone needs help! Talk to friends. 💬' : 'Explore Sunny Island!'
        $('.q-dots', el).innerHTML = ''
        $('.q-clues', el).innerHTML = ''
        $('.q-toggle', el).textContent = ''
      } else el.classList.add('hidden')
      return
    }
    const q = QUESTS[id]
    const step = quests[id]
    const others = Object.keys(quests).filter((k) => k !== id && QUESTS[k])
    el.classList.remove('hidden')
    if (others.length) $('.q-label', el).textContent = `⭐ MISSIONS: ${others.length + 1} · ${[id, ...others].map((k) => QUESTS[k].icon).join(' ')}`
    $('.q-icon', el).textContent = q.icon
    $('.q-title', el).textContent = q.title.toUpperCase()
    $('.q-step', el).textContent = q.steps[step].text
    $('.q-dots', el).innerHTML = q.steps.map((_, i) => `<i class="${i < step ? 'done' : i === step ? 'now' : ''}"></i>`).join('')
    const list = (k) => (s.clues[k] || []).filter((c) => QUESTS[k].clues[c])
    const clues = list(id)
    let html = clues.length ? clues.map((c) => `<div>💡 ${q.clues[c].text}</div>`).join('') : '<div class="none">No clues yet. Talk to people! 💬</div>'
    for (const k of others) {
      const o = QUESTS[k]
      html += `<div><b>${o.icon} ${o.title}:</b> ${o.steps[quests[k]].text}</div>`
      html += list(k).map((c) => `<div>💡 ${o.clues[c].text}</div>`).join('')
    }
    $('.q-clues', el).innerHTML = html
    const n = clues.length + others.reduce((a, k) => a + list(k).length, 0)
    $('.q-toggle', el).textContent = el.classList.contains('open') ? '▲ Hide clues' : `💡 Clues: ${n} · tap to see`
  }
  flashQuest() {
    this.questEl.classList.remove('flash')
    void this.questEl.offsetWidth
    this.questEl.classList.add('flash')
  }

  // ---------- tips from Blankie Bear ----------
  // key + cooldown (seconds) keep the same tip from repeating too often. once: show only one time ever.
  tip(text, { key = text, cooldown = 30, once = false, force = false, time = 6.5 } = {}) {
    const now = performance.now() / 1000
    const seen = this.game.state.tips
    if (once && seen[key]) return false
    if (!force && this.tipTimes[key] && now - this.tipTimes[key] < cooldown) return false
    // Let a tip that just appeared stay readable for a few seconds.
    if (!force && this.tipUntil && now < this.tipUntil && now - this.tipShown < 3.5) return false
    this.tipTimes[key] = now
    if (once) seen[key] = 1
    this.tipUntil = now + time
    this.tipShown = now
    $('.hint-text', this.hintEl).textContent = text
    this.hintEl.classList.remove('hidden')
    this.hintEl.style.animation = 'none'
    void this.hintEl.offsetWidth
    this.hintEl.style.animation = ''
    clearTimeout(this.tipT)
    this.tipT = setTimeout(() => this.hideHint(), time * 1000)
    return true
  }
  hideHint() {
    this.hintEl.classList.add('hidden')
    this.tipUntil = 0
  }
  setHintVisible(v) {
    this.hintEl.style.visibility = v ? '' : 'hidden'
  }

  toast(text, big = false) {
    const t = document.createElement('div')
    t.className = 'toast' + (big ? ' big' : '')
    t.textContent = text
    this.toastsEl.append(t)
    setTimeout(() => t.remove(), 2300)
  }

  // ---------- bag ----------
  openBag() {
    // show the first thing straight away, so its "what to do" is visible
    this.sel = Object.keys(this.game.state.bag).find((k) => this.game.state.bag[k] > 0) || null
    this.renderBag()
    this.openPanel('bag')
  }
  renderBag() {
    const s = this.game.state
    const grid = $('#bag .bag-grid')
    $('#bag .bag-coins').textContent = s.coins
    const ids = Object.keys(s.bag).filter((k) => s.bag[k] > 0)
    grid.innerHTML = ''
    if (!ids.length) grid.innerHTML = '<div class="bag-empty">Your bag is empty.</div>'
    for (const id of ids) {
      const it = ITEMS[id]
      const b = document.createElement('button')
      b.className = 'slot' + (this.sel === id ? ' sel' : '') + (it.quest ? ' quest-item' : '')
      b.innerHTML = `${it.icon}<small>${it.name}</small>${s.bag[id] > 1 ? `<b>×${s.bag[id]}</b>` : ''}`
      b.addEventListener('click', () => {
        this.sel = id
        sfx('tap')
        this.renderBag()
      })
      grid.append(b)
    }
    const info = $('#bag .bag-info')
    const id = this.sel && s.bag[this.sel] > 0 ? this.sel : null
    if (!id) {
      info.innerHTML = ids.length ? '<div class="txt">Tap something in your bag.</div>' : '<div class="txt">Find food, water and shells on the island!</div>'
      return
    }
    const it = ITEMS[id]
    let fx = []
    if (it.energy) fx.push(`⚡ +${it.energy}`)
    if (it.water) fx.push(`💧 +${it.water}`)
    const verb = it.water && !it.energy ? 'Drink' : it.water ? 'Drink' : it.energy ? 'Eat' : null
    info.innerHTML = `<span class="big-e">${it.icon}</span><div class="txt">${it.name}<small>${it.desc}${fx.length ? ' ' + fx.join(' ') : ''}</small><em>👉 ${it.use || ''}</em></div>`
    if (verb && !it.quest) {
      const btn = document.createElement('button')
      btn.className = 'big-btn'
      btn.textContent = verb === 'Eat' ? '😋 Eat' : '🥤 Drink'
      btn.addEventListener('click', () => {
        this.game.useItem(id)
        this.renderBag()
      })
      info.append(btn)
    }
  }

  // ---------- shop ----------
  openShop(id) {
    this.shopId = id
    this.shopMsg('')
    this.renderShop()
    this.openPanel('shop')
  }
  shopMsg(text, ok = false) {
    const m = $('#shop .shop-msg')
    m.textContent = text
    m.classList.toggle('ok', ok)
  }
  renderShop() {
    const s = this.game.state
    const shop = SHOPS[this.shopId]
    $('#shop .shop-title').textContent = shop.title
    $('#shop .shop-coins').textContent = s.coins
    const body = $('#shop .shop-body')
    body.innerHTML = ''
    const sec = (t) => {
      const d = document.createElement('div')
      d.className = 'shop-sec'
      d.textContent = t
      body.append(d)
    }
    if (shop.buy.length) sec('Buy')
    for (const [id, price] of shop.buy) {
      const it = ITEMS[id]
      const row = document.createElement('div')
      row.className = 'shop-row'
      const fx = [it.energy && `⚡ +${it.energy}`, it.water && `💧 +${it.water}`].filter(Boolean).join(' ')
      row.innerHTML = `<span class="e">${it.icon}</span><div class="n">${it.name}<small>${fx || it.desc}</small></div>`
      const b = document.createElement('button')
      b.className = 'big-btn'
      b.innerHTML = `<i class="coin-ico"></i>${price}`
      b.addEventListener('click', () => {
        if (s.coins < price) {
          sfx('nope')
          const need = price - s.coins
          this.shopMsg(`You need ${need} more ${need === 1 ? 'coin' : 'coins'}. 🪙`)
          return
        }
        this.game.buy(id, price)
        this.shopMsg(`You got ${it.icon} ${it.name}!`, true)
        this.renderShop()
      })
      row.append(b)
      body.append(row)
    }
    if (shop.sell.length) {
      // the bank swaps treasures for coins: things you have come first
      const swap = this.shopId === 'bank'
      sec(swap ? 'Swap your treasures for coins' : 'Sell')
      const list = swap ? [...shop.sell].sort((a, b) => (s.bag[b[0]] ? 1 : 0) - (s.bag[a[0]] ? 1 : 0) || a[1] - b[1]) : shop.sell
      for (const [id, price] of list) {
        const it = ITEMS[id]
        const have = s.bag[id] || 0
        const row = document.createElement('div')
        row.className = 'shop-row' + (have ? '' : ' none')
        const one = it.name.toLowerCase()
        const rate = swap ? `1 ${one} = ${price} ${price === 1 ? 'coin' : 'coins'}. You have ${have}.` : `You have ${have}.`
        row.innerHTML = `<span class="e">${it.icon}</span><div class="n">${it.name}<small>${rate}</small></div>`
        const b = document.createElement('button')
        b.className = 'big-btn soft'
        b.innerHTML = `${swap ? 'Swap' : 'Sell'} +<i class="coin-ico"></i>${price}`
        b.disabled = have < 1
        b.addEventListener('click', () => {
          if ((s.bag[id] || 0) < 1) return
          this.game.sell(id, price)
          this.shopMsg(`Thank you! +${price} 🪙`, true)
          this.renderShop()
        })
        row.append(b)
        if (swap && have > 1) {
          const all = document.createElement('button')
          all.className = 'big-btn soft'
          all.innerHTML = `All +<i class="coin-ico"></i>${price * have}`
          all.addEventListener('click', () => {
            const n = s.bag[id] || 0
            for (let i = 0; i < n; i++) this.game.sell(id, price)
            this.shopMsg(`${n} ${n === 1 ? one : it.plural || one + 's'} = ${n * price} coins! Thank you! 🪙`, true)
            this.renderShop()
          })
          row.append(all)
        }
        body.append(row)
      }
    }
  }

  showFinale() {
    $('#finale').classList.remove('hidden')
  }
}
