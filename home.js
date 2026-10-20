// The home page only knows about games.json. Each game lives in its own folder and is
// not downloaded until you open it, so adding games never slows down this page or the others.

const list = document.getElementById('games')
const status = document.getElementById('status')

function card(game) {
  const li = document.createElement('li')
  const a = document.createElement('a')
  a.className = 'game'
  a.href = game.path
  a.style.setProperty('--c1', game.colors?.[0] ?? '#0b1f5c')
  a.style.setProperty('--c2', game.colors?.[1] ?? '#3b2a8f')

  const icon = document.createElement('div')
  icon.className = 'icon'
  icon.textContent = game.icon ?? '🎲'
  const title = document.createElement('h2')
  title.textContent = game.title
  const desc = document.createElement('p')
  desc.textContent = game.description ?? ''
  const meta = document.createElement('span')
  meta.className = 'meta'
  meta.textContent = game.controls ? `🎹 ${game.controls}` : ''
  const play = document.createElement('span')
  play.className = 'play'
  play.textContent = 'Play ▶'
  a.append(icon, title, desc, meta, play)

  // Warm the cache as soon as someone points at a game, so it opens instantly on click.
  let warmed = false
  const warm = () => {
    if (warmed) return
    warmed = true
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = game.path
    document.head.append(link)
  }
  a.addEventListener('pointerenter', warm, { once: true })
  a.addEventListener('focus', warm, { once: true })
  a.addEventListener('touchstart', warm, { once: true, passive: true })

  li.append(a)
  return li
}

try {
  const res = await fetch('games.json')
  if (!res.ok) throw new Error(res.status)
  const { games } = await res.json()
  list.replaceChildren(...games.map(card))
  status.hidden = games.length > 0
  if (!games.length) status.textContent = 'No games yet — check back soon!'
} catch {
  status.textContent = "Couldn't load the game list. Please try again."
}
