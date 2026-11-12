// The dialogue box: the character's lines type out, tap to go on, then Coji picks an answer.
import { sfx, voice, speak } from './audio.js'

const CHARS_PER_SEC = 42

export class Dialogue {
  constructor({ portrait, nameOf, voiceOf, onChange, onClose, onTalk }) {
    this.el = document.getElementById('dlg')
    this.img = this.el.querySelector('.dlg-portrait img')
    this.nameEl = this.el.querySelector('.dlg-name')
    this.textEl = this.el.querySelector('.dlg-text')
    this.choicesEl = this.el.querySelector('.dlg-choices')
    this.nextEl = this.el.querySelector('.dlg-next')
    this.portrait = portrait
    this.nameOf = nameOf
    this.voiceOf = voiceOf
    this.onChange = onChange
    this.onClose = onClose
    this.onTalk = onTalk
    this.open = false
    this.el.querySelector('.dlg-box').addEventListener('click', (e) => {
      if (e.target.closest('.choice') || e.target.closest('.dlg-say')) return
      this.next()
    })
    this.el.querySelector('.dlg-say').addEventListener('click', (e) => {
      e.stopPropagation()
      speak(this.fullText || '', this.who === 'coji' ? 1.3 : this.voiceOf(this.who))
    })
    window.addEventListener('keydown', (e) => {
      if (!this.open) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (this.choices && !this.typing) {
          this.choose(this.choices[0])
        } else this.next()
      }
      const n = parseInt(e.key, 10)
      if (n >= 1 && this.choices && !this.typing && this.choices[n - 1]) this.choose(this.choices[n - 1])
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
    this.lines = node.say.slice()
    this.choices = null
    this.lineIdx = 0
    this.speak(this.npc, this.lines[0])
  }

  speak(who, text) {
    this.who = who
    this.fullText = text
    this.el.classList.toggle('coji', who === 'coji')
    this.nameEl.textContent = this.nameOf(who)
    const src = this.portrait(who)
    if (src && this.img.getAttribute('src') !== src) this.img.src = src
    this.choicesEl.innerHTML = ''
    this.nextEl.classList.add('hidden')
    this.typing = true
    this.shown = 0
    this.textEl.textContent = ''
    this.typeStart = performance.now()
    if (who !== 'coji') this.onTalk?.(who)
    cancelAnimationFrame(this.raf)
    let lastBlip = 0
    const step = () => {
      const n = Math.min(text.length, Math.floor(((performance.now() - this.typeStart) / 1000) * CHARS_PER_SEC))
      if (n !== this.shown) {
        this.shown = n
        this.textEl.textContent = text.slice(0, n)
        if (who !== 'coji' && n - lastBlip >= 3) {
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
    this.textEl.textContent = this.fullText
    if (this.cojiLine) {
      // Coji's own answer: go on by itself after a moment.
      clearTimeout(this.autoT)
      this.autoT = setTimeout(() => this.next(), 900)
      return
    }
    const last = this.lineIdx >= this.lines.length - 1
    if (last && this.node.choices?.length) {
      this.choices = this.node.choices
      this.choicesEl.innerHTML = ''
      for (const c of this.choices) {
        const b = document.createElement('button')
        b.className = 'choice'
        b.textContent = c.text
        b.addEventListener('click', (e) => {
          e.stopPropagation()
          this.choose(c)
        })
        this.choicesEl.append(b)
      }
    } else {
      this.nextEl.classList.remove('hidden')
    }
  }

  next() {
    if (!this.open) return
    if (this.typing) {
      cancelAnimationFrame(this.raf)
      this.shown = this.fullText.length
      this.doneTyping()
      return
    }
    if (this.cojiLine) {
      clearTimeout(this.autoT)
      const go = this.cojiLine
      this.cojiLine = null
      return this.show(go())
    }
    if (this.choices) return // waiting for an answer
    sfx('tap')
    if (this.lineIdx < this.lines.length - 1) {
      this.lineIdx++
      return this.speak(this.npc, this.lines[this.lineIdx])
    }
    if (this.node.then) return this.show(this.node.then())
    this.close()
  }

  choose(c) {
    if (!this.choices) return
    sfx('choice')
    this.choices = null
    this.cojiLine = c.go
    this.speak('coji', c.text)
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
