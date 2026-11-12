// The dialogue box. All of a character's lines appear together (they type out quickly; tap to show
// them at once), then Coji's answers appear as buttons. No arrows to tap through.
import { sfx, voice, speak } from './audio.js'

// Coji's answers are spoken (after the child has read and chosen them) in a kid's voice.
// The characters' lines are not read aloud: reading them is the point.

const CHARS_PER_SEC = 60

export class Dialogue {
  constructor({ portrait, nameOf, voiceOf, onChange, onClose, onTalk }) {
    this.el = document.getElementById('dlg')
    this.img = this.el.querySelector('.dlg-portrait img')
    this.nameEl = this.el.querySelector('.dlg-name')
    this.textEl = this.el.querySelector('.dlg-text')
    this.choicesEl = this.el.querySelector('.dlg-choices')
    this.portrait = portrait
    this.nameOf = nameOf
    this.voiceOf = voiceOf
    this.onChange = onChange
    this.onClose = onClose
    this.onTalk = onTalk
    this.open = false
    this.el.querySelector('.dlg-box').addEventListener('click', (e) => {
      if (e.target.closest('button')) return
      this.tapBox()
    })
    this.el.querySelector('.dlg-close').addEventListener('click', (e) => {
      e.stopPropagation()
      sfx('close')
      this.close()
    })
    window.addEventListener('keydown', (e) => {
      if (!this.open) return
      if (e.key === 'Escape') return this.close()
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (this.typing || this.cojiLine) this.tapBox()
        else if (this.buttons?.length) this.buttons[0].click()
      }
      const n = parseInt(e.key, 10)
      if (n >= 1 && !this.typing && this.buttons?.[n - 1]) this.buttons[n - 1].click()
    })
  }

  start(npcId, node) {
    this.npc = npcId
    this.open = true
    this.el.classList.remove('hidden')
    this.show(node)
  }

  show(node) {
    if (!node) return this.close()
    this.node = node
    node.onShow?.()
    this.onChange?.()
    this.cojiLine = null
    this.speakAll(this.npc, node.say.join('\n'))
  }

  // Type out the text; when done, show the answers.
  speakAll(who, text) {
    this.who = who
    this.fullText = text
    this.el.classList.toggle('coji', who === 'coji')
    this.nameEl.textContent = this.nameOf(who)
    const src = this.portrait(who)
    if (src && this.img.getAttribute('src') !== src) this.img.src = src
    this.choicesEl.innerHTML = ''
    this.buttons = []
    this.typing = true
    this.textEl.textContent = ''
    const start = performance.now()
    if (who !== 'coji') this.onTalk?.(who)
    cancelAnimationFrame(this.raf)
    let lastBlip = 0
    let shown = 0
    const step = () => {
      const n = Math.min(text.length, Math.floor(((performance.now() - start) / 1000) * CHARS_PER_SEC))
      if (n !== shown) {
        shown = n
        this.textEl.textContent = text.slice(0, n)
        if (who !== 'coji' && n - lastBlip >= 4) {
          lastBlip = n
          voice(this.voiceOf(who))
        }
      }
      if (n < text.length) this.raf = requestAnimationFrame(step)
      else this.doneTyping()
    }
    this.raf = requestAnimationFrame(step)
  }

  doneTyping() {
    this.typing = false
    cancelAnimationFrame(this.raf)
    this.textEl.textContent = this.fullText
    if (this.cojiLine) {
      // Coji's own answer moves on by itself after a moment.
      clearTimeout(this.autoT)
      this.autoT = setTimeout(() => this.afterCoji(), 900 + Math.min(1600, this.fullText.length * 45))
      return
    }
    const node = this.node
    if (node.choices?.length) {
      for (const c of node.choices) this.addButton(c.text, () => this.choose(c), true)
    } else if (node.auto) {
      clearTimeout(this.autoT)
      this.autoT = setTimeout(() => this.close(), 1300)
    } else if (node.then) {
      this.addButton('OK! 👍', () => {
        sfx('tap')
        this.show(node.then())
      })
    } else {
      this.addButton('OK! 👍', () => {
        sfx('tap')
        this.close()
      })
    }
  }

  addButton(text, fn, isAnswer = false) {
    const b = document.createElement('button')
    b.className = isAnswer ? 'choice' : 'choice ok'
    b.textContent = text
    b.addEventListener('click', (e) => {
      e.stopPropagation()
      fn()
    })
    this.choicesEl.append(b)
    this.buttons.push(b)
  }

  tapBox() {
    if (!this.open) return
    if (this.typing) {
      this.doneTyping()
      return
    }
    if (this.cojiLine) {
      clearTimeout(this.autoT)
      this.afterCoji()
    }
  }

  choose(c) {
    if (this.typing || this.cojiLine) return
    sfx('choice')
    this.cojiLine = c.go
    this.speakAll('coji', c.text)
    speak(c.text, { kid: true })
  }

  afterCoji() {
    const go = this.cojiLine
    this.cojiLine = null
    if (go) this.show(go())
  }

  close() {
    if (!this.open) return
    this.open = false
    cancelAnimationFrame(this.raf)
    clearTimeout(this.autoT)
    this.cojiLine = null
    this.el.classList.add('hidden')
    if ('speechSynthesis' in window) speechSynthesis.cancel()
    this.onClose?.()
  }
}
