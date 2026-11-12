// Title screen. It shows right away; the 3D game loads in the background and appears behind it.
const $ = (id) => document.getElementById(id)
document.documentElement.classList.add(matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse')

const title = $('title')
const fill = $('load-fill')
const text = $('load-text')
const btnNew = $('btn-new')
const btnCont = $('btn-continue')
let game = null

const progress = (p, msg) => {
  fill.style.width = `${Math.round(p * 100)}%`
  if (msg) text.textContent = msg
}

let hasSave = false
try {
  hasSave = !!localStorage.getItem('coji-island-save-v1')
} catch {
  // storage blocked
}
if (hasSave) {
  btnCont.classList.remove('hidden')
  btnNew.textContent = '✨ New game'
  btnNew.classList.add('soft')
}

progress(0.05, 'Loading the 3D tools…')
import('./game.js')
  .then((m) => m.init({ onProgress: progress }))
  .then((g) => {
    game = g
    window.cojiGame = g // handy for debugging in the browser console
    title.classList.add('ready')
    btnNew.disabled = false
    btnCont.disabled = false
    ;(hasSave ? btnCont : btnNew).focus({ preventScroll: true })
  })
  .catch((err) => {
    console.error(err)
    text.textContent = 'Oops! The island could not load. Please check the internet and reload. 🙏'
  })

function go(fresh) {
  title.classList.add('hidden')
  game.start(fresh)
}
btnNew.addEventListener('click', async () => {
  if (!game) return
  if (hasSave && !(await game.ui.confirm('Start a new game? Your saved game will be gone.'))) return
  go(true)
})
btnCont.addEventListener('click', () => game && go(false))
