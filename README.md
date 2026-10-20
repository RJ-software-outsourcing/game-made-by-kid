# Games Made by Kid 🎮

A growing collection of little browser games. Plain HTML/JS, no build step.

Live site: https://rj-software-outsourcing.github.io/game-made-by-kid/

| Game | Path |
|---|---|
| 🐳🧽🧸 Deep Sea Hide & Seek | `/deep-sea-hide-and-seek/` |

## iPad and phones

The games work on touch screens. In Deep Sea Hide & Seek, touch and hold anywhere in the sea to swim
toward that spot (slide your finger to steer; the longer you hold, the faster you go), and use the 💬 button to
say hi. A mouse click-and-hold works the same way. For a full-screen experience on iPad, open the
site in Safari, tap Share → **Add to Home Screen**, and launch it from there.

## How it is organized

- `index.html`, `home.js`, `home.css`: the home page. It only reads `games.json` and renders the list.
- `games.json`: the list of games. **This is the only place the home page learns about a game.**
- `<game-id>/`: one self-contained folder per game. A game is downloaded only when someone opens it,
  and the home page prefetches a game's page when you point at its card.

## Adding a game

1. Create a folder, e.g. `my-game/`, with its own `index.html` (use relative paths like `style.css`, `js/main.js`).
2. Add an entry to `games.json` (`id`, `title`, `description`, `path`, `icon`, `colors`, `controls`).
3. Push to `main`: GitHub Actions publishes it (`.github/workflows/deploy.yml`).

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
