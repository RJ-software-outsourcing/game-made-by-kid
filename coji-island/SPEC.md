# Coji's Island Adventure: game spec (v0.1, POC)

A cute 3D adventure game for a 6-year-old reader. Coji walks around a small island, talks to people
and animals in simple English, collects things in his bag, keeps his energy and water up, and solves
one quest at a time. The POC ends after **2 quests**.

- Platform: web (Safari on iPad first, desktop Chrome/Safari/Edge too). Lives in `coji-island/`.
- Language: English, at the reading level of KCIS Grade 1 (see "English" below).
- Engine: [three.js](https://threejs.org) r170, loaded from jsDelivr. Plain ES modules, no build step
  (same as the rest of this repo).

---

## 1. Main character: Coji

- 6-year-old boy, short black hair with straight bangs, big dark eyes.
- **Kang Chiao sports uniform** (from the umbrella photo): cream shirt with navy horizontal stripes,
  each stripe with a thin white line under it; navy raglan shoulders and short sleeves with white
  piping down the outside; navy V-neck collar; small round school crest on the left chest; navy
  shorts. White socks, navy-and-white sneakers.
- **Blankie Bear (被被熊)** is always draped on his shoulders like a cape: pale gray knit blanket
  with wide light-blue stripes, a knit scarf part around the neck, and the little bear head (pale
  gray, round blue ears, brown eyes, nose and mouth) on his right shoulder, looking back at the
  player. The cape sways when Coji walks.
- Blankie Bear is also the **helper voice**: all tips appear in a bubble with the bear's face.

All uniform/blanket colors are in one place: `js/config.js` (`UNIFORM`, `BLANKIE`).

## 2. Controls

| Action | iPad / touch | Mouse |
|---|---|---|
| Walk somewhere | Tap the ground | Click the ground |
| Talk / use something | Tap the person, animal or object (Coji walks there first) | Click it |
| Look around | Drag with one finger | Drag |
| Zoom | Pinch | Mouse wheel |
| Bag / Map / Rest | Buttons at the bottom right | Same |

- A tap is a touch that moves less than ~10 px. Anything longer is a camera drag, so looking around
  never makes Coji walk by accident.
- Coji finds his own way around houses, trees and water (grid path-finding, A*). If a place cannot be
  reached yet, Blankie says why (e.g. "Bear is on the bridge!").
- Tap targets on characters are bigger than the characters, so small fingers can hit them.

## 3. The island (Sunny Island)

Roads connect everything. Wooden signposts with arrows stand at the main crossings (reading practice).

| Place | Where | What is there |
|---|---|---|
| ⚓ Harbor | South | Coji's start. Pier, Captain Pip's boat, Fisher Finn, Momo the cat, bench, shells on the beach |
| 🍔 Burger Hut | Road between harbor and village | Burger Ben sells food and drinks |
| 🏡 Village | Center | Plaza with the **well** (free water), benches, houses, Leo |
| 🍯 Market | Village, west side | Granny Bee's stall: buys and sells (honey, carrots, milk; buys apples) |
| 🏦 Bank | Village, north-east | Penny swaps shells for coins |
| 🧸 Toy Shop | Village, south-east | Tina; has the Super Bright Bulb |
| 🥕 Farm | West | Apple trees, carrot patch, Bun the bunny, bench |
| 🏖️ Sunny Beach | East | Palm trees, shells, a water fountain, bench |
| 🌲 Forest | North | Berry bushes, a spring (free water), Hoot the owl in the big tree, the pond |
| 🦆 Pond | Forest, west | Ducks; Hoot's lost glasses are near it |
| 🌉 Bear Bridge | Forest, over the stream | Bruno the bear sits on it until he is fed |
| 🗼 Lighthouse | North-east cape (only reachable over the bridge) | Grandpa Gus |
| ⛰️ Mount Puff | North | Too steep to climb; a landmark |

## 4. Characters

| Who | Where | Does | Needs / gives |
|---|---|---|---|
| Captain Pip | Harbor pier | Welcomes Coji, gives the bag (water bottle, apple, 3 coins) and the first quest | |
| Fisher Finn | Pier | Gives a free fish (one at a time) | |
| Momo the cat 🐱 | Harbor crates | | Hungry: give a fish → Momo finds **3 coins** for Coji |
| Burger Ben | Burger Hut | Shop: burger 4, fries 2, juice 2, water 1 | |
| Granny Bee | Market | Shop: honey 5, carrot 1, milk 2. Buys apples (1) and berries (1) | |
| Penny | Bank | Swaps shells for coins, 1 shell = 1 coin | |
| Tina | Toy Shop | Has the Super Bright Bulb: 8 coins, or trade an owl feather | |
| Leo | Village plaza | Friendly kid, lots of clues, gives a water bottle once | |
| Bun the bunny 🐰 | Farm | | Give a carrot → a basket of berries (+ a clue) |
| Hoot the owl 🦉 | Forest, big tree | Wise; many clues | Lost glasses: bring them → an **owl feather** + 2 coins |
| Bruno the bear 🐻 | Bear Bridge | Blocks the bridge | Hungry: give honey → moves away, gives quest 2 |
| Grandpa Gus | Lighthouse | Lighthouse keeper | Needs a new bulb |
| Ducks, seagulls, butterflies | Pond, harbor, meadows | Ambient life | |

Helping animals always gives something good (coins, berries, a feather, an open bridge).

## 5. Systems

### 5.1 Energy ⚡ and water 💧 (0 to 100)
- Walking uses both. Per meter walked: energy −0.12, water −0.14. Water also drops slowly over time
  (−0.03/s). Nothing drops while a dialogue, the bag, the shop or the map is open.
- **Water slows energy loss**: water ≥ 60 → energy cost ×0.7; 30–60 → ×1; below 30 → ×1.5;
  0 → ×2.
- **Rest** (💤 button anywhere, or tap a bench): energy comes back 3/s × water factor
  (water ≥ 60: ×1.6, 30–60: ×1, below 30: ×0.5). Benches are 1.5× faster. Tapping the ground ends
  the rest.
- Eat from the bag for energy, drink for water. The well, the spring and the beach fountain fill
  water to 100 for free; the well and the spring also fill a water bottle for the bag (up to 2).
- Below 15 energy Coji walks slower. At 0 he sits down and naps for a few seconds (back to 25
  energy). No game over, ever.

### 5.2 Bag 🎒
A grid of items with counts. Tap an item to see what it is and use it (Eat / Drink). Quest items
cannot be eaten.

| Item | Use | Where from |
|---|---|---|
| 🍎 Apple | +15 energy (sell for 1 coin) | Apple trees at the farm (tap a tree; it regrows) |
| 🫐 Berries | +8 energy (sell for 1 coin) | Berry bushes in the forest, Bun |
| 🍔 Burger | +45 energy | Burger Ben, 4 coins |
| 🍟 Fries | +20 energy | Burger Ben, 2 coins |
| 🧃 Juice | +30 water, +10 energy | Burger Ben, 2 coins |
| 🥛 Milk | +20 water, +15 energy | Granny Bee, 2 coins |
| 💧 Water bottle | +40 water | Pip, Leo, Burger Ben (1 coin); refills at the well |
| 🥕 Carrot | +10 energy (Bun loves them) | Granny Bee (1 coin), carrot patch |
| 🐟 Fish | For Momo | Fisher Finn |
| 🐚 Shell | Swap at the bank | Beaches (shells come back after a while) |
| 🍯 Honey | Quest item | Granny Bee, 5 coins |
| 👓 Owl's glasses | Quest item | Near the pond |
| 🪶 Owl feather | Quest item | Hoot |
| 💡 Super Bright Bulb | Quest item | Tina |

### 5.3 Coins 🪙
Shown at the top right. Ways to earn: swap shells at the bank, sell apples/berries to Granny Bee,
feed Momo, help Hoot, a few hidden coins around the island. Shops show the price and, if Coji
can't pay, how many coins are missing (a little math practice).

### 5.4 Dialogue
- Tap a character: Coji walks to them, they turn to face him, and a dialogue box opens at the bottom
  with their portrait (rendered from the 3D model), name, and text that types out. Tap to continue.
- When it is Coji's turn there are always **2 or 3 answer buttons**. The chosen answer is shown as
  Coji's line, so the child reads both sides.
- A 🔊 button reads the current line aloud (speech synthesis). It never plays automatically: the
  child is practicing reading.
- **Every character talks about the current quest.** Each character has a quest topic for every quest
  step. How much they help depends on what the player asks: the first question gives a hint, a
  follow-up question gives a better clue, and chit-chat answers give no clue. Example (Bruno):
  "Are you okay?" → "My tummy is empty…" → "What do you want to eat?" → "Something sweet… made by
  bees…" → "Is it honey?" → "Yes! Honey!" (clue found).
- Animals talk too (it's that kind of island), with their own sounds ("Meow!", "Who-who!").

### 5.5 Quests
- **Only one quest at a time.** The quest card at the top left shows the quest name, the current
  step in big letters, step dots, and the clues found so far (tap the card to open/close the clues).
- Quests are given by characters in dialogue. Steps move forward automatically when their condition
  is met (a clue is known, an item is in the bag) or through dialogue (giving an item).
- Clues are short sentences. Some clues put a ⭐ marker on the map (e.g. "Granny Bee sells honey at
  the Market").
- The current target character gets a gold "!" over the head once the player knows about them;
  everyone else who can talk has a small "…" bubble.

### 5.6 Map 🗺️
Full-screen picture of the island: land, beaches, forest, roads, the stream, all places with icon and
name, Coji's position and facing direction, and ⭐ markers from clues. The 3D world has matching
landmarks (lighthouse, Mount Puff, the well, signposts), so the child can compare the map with what
they see.

### 5.7 Tips from Blankie Bear
A bubble at the bottom with Blankie's face. One tip at a time, each kind has a cool-down so tips don't
nag:
- Energy below 30 / below 12, water below 30 / below 12 (and "you have an apple in your bag" if
  that's true).
- First time near a character: "Look! It's Burger Ben. Tap to say hi!"
- First time near something to use: well, bench, apple tree, berry bush, shells, signpost.
- New clue found, new quest, step done.
- Nothing happening for 30 s: a reminder of what to do next for the current step.
- Can't get somewhere (blocked bridge, water).

### 5.8 Saving
Auto-saves to `localStorage` every few seconds and after every important event (position, stats,
coins, bag, quest, clues, flags). The title screen shows **Continue** when a save exists and
**New game** (asks first if it would overwrite a save).

## 6. The POC story

Coji arrives at Sunny Island on Captain Pip's boat.

### Quest 1: The Hungry Bear 🐻 (from Captain Pip)
Bruno the bear sits on the bridge to the lighthouse. He is hungry and grumpy, and nobody can cross.
1. **Find out what Bear likes to eat.** Done when the clue "Bears love honey" is found
   (Bruno himself, Hoot, Burger Ben, Granny Bee, Tina, Leo can all lead there).
2. **Get some honey.** Granny Bee sells honey for 5 coins. Coji starts with 3, so he needs 2 more:
   shells → bank, apples → Granny Bee, or fish → Momo.
3. **Give the honey to Bear.** Bruno eats it, moves off the bridge, and gives quest 2.

### Quest 2: The Dark Lighthouse 🗼 (from Bruno)
The lighthouse lamp is broken, so ships can't find the island at night.
1. **Talk to Grandpa Gus at the lighthouse.** He needs a new, very bright bulb.
2. **Find a big, bright light bulb.** Clues point to Tina's Toy Shop. Done when Tina shows it.
3. **Get the bulb from Tina.** Two ways: pay 8 coins, or trade an owl feather. The feather comes
   from Hoot after Coji finds Hoot's glasses by the pond (helping an animal pays off).
4. **Bring the bulb to Grandpa Gus.**

**Finale:** the sky turns to night, the lighthouse lights up and its beam sweeps the sea,
fireworks pop, and a "You did it!" screen thanks the player. They can keep exploring or start over.

## 7. English

- Level: KCIS Grade 1 (myView 1.1 stories, e.g. "First, list some places you go."). Short sentences
  (mostly under 10 words), present tense, high-frequency words, simple questions. New nouns are
  concrete and shown with an emoji (honey 🍯, bulb 💡, feather 🪶).
- UI labels are simple words with icons (Bag, Map, Rest, Eat, Drink, Buy, Sell).
- Fonts: **Andika** (made for beginning readers) for all reading text, **Baloo 2** for titles.
  Reading text ≥ 20 px, buttons ≥ 48 px tall.

## 8. Look and feel

- Cute, bright, cheerful. Low-poly models with flat shading and vertex colors (no textures), soft
  pastel palette, warm sun with soft shadows, sky gradient, fog toward the horizon, puffy clouds.
- Water shader: shallow turquoise near the shore with moving white foam lines, deep blue farther out.
- Small life everywhere: swaying trees, seagulls, ducks, butterflies, characters that breathe, look
  at Coji, wave and nod when talking.
- Synthesized sounds (Web Audio, no files): taps, pickups, coins, eating, drinking, animal voices,
  quest jingles, a light background tune. 🔊 button mutes everything.

## 9. Performance and loading

Goal: the title screen in well under a second, playable within a few seconds on an iPad, smooth
movement.

- **No asset files.** Every model is generated in code, so the download is three.js (~170 KB gzip) +
  the game code. Nothing else to wait for.
- **Title first:** `index.html` shows the title screen immediately (HTML/CSS only). three.js is
  preloaded (`modulepreload`) while the title is visible, then the game module is imported in the
  background. The 3D island fades in behind the title as soon as it is built.
- **Stream the world:** only the core (terrain, water, roads, buildings, landmarks) is built up front.
  Each zone's details (trees, flowers, rocks, characters, animals, pickups) are built when Coji gets
  near, and the rest are filled in during idle frames. Placement data and obstacles are computed up
  front so path-finding knows everything from the start.
- **On demand:** the map module and the speech voice are loaded the first time they are used.
- **Cheap rendering:** one shared vertex-colored material; static parts merged into a few meshes per
  zone; trees, flowers, grass and rocks are instanced; one shadow-casting light whose shadow box
  follows Coji.
- **Adaptive quality:** pixel ratio capped at 1.75; if the frame rate stays low, the game lowers the
  pixel ratio and the shadow map size by itself.
- iPad: no page zoom/scroll/bounce, safe-area insets, audio unlocked on the first tap, works as a
  Home Screen web app.

## 10. Code layout

```
coji-island/
  index.html     title screen, HUD markup, import map
  style.css      all UI styles
  SPEC.md        this file
  js/
    boot.js        title screen; imports the game in the background
    game.js        renderer, main loop, Coji movement, taps, stats, tips, finale
    config.js      tunable numbers and character colors
    land.js        island shape, heights and layout data (pure JS, no three.js)
    nav.js         walkable grid + A* path-finding
    build.js       low-poly builder: merges colored primitives into one mesh
    world.js       sky, terrain, water, roads, buildings, zones, day/night
    props.js       buildings and objects (houses, shops, lighthouse, well, signposts…)
    nature.js      trees, bushes, rocks, flowers, clouds (instanced)
    characters.js  Coji, people and animals, with simple animations
    camera.js      follow camera; tap / drag / pinch / wheel input
    state.js       game state, bag, coins, quest progress, saving
    items.js       item catalog
    story.js       quests, clues and every character's dialogue
    dialogue.js    dialogue box (typing text, choices, portraits, read aloud)
    ui.js          HUD, quest card, tips, bag, shop, toasts, finale screen
    map.js         map screen (loaded on first use)
    audio.js       synthesized sounds and music
```

## 11. Later (not in the POC)

- More quests toward a bigger final goal (e.g. island festival, fixing Pip's boat to sail home).
- Day/night cycle during normal play, weather (rain → Coji's yellow boots and dino umbrella!).
- More shops and trading, a small house for Coji, a sticker book of helped animals.
- Parent settings: tip frequency, read-aloud on/off, text size.
