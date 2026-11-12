# Coji's Island Adventure: game spec (v0.3)

A cute 3D adventure game for a 6-year-old reader. **The game is about reading English while having
fun**: everything the child needs (quests, clues, jobs, signs, chit-chat, even the banner behind a
plane) is short, simple text to read. Coji walks around a small island, talks to people and animals,
collects things in his bag, keeps his energy and water up, does little jobs for coins, and solves one
quest at a time. This version has **3 quests**; the King's quest in the castle will be the last one
(to be designed).

- Platform: web (Safari on iPad first, desktop Chrome/Safari/Edge too). Lives in `coji-island/`.
- Language: English, at the reading level of KCIS Grade 1 (see "English" below).
- Engine: [three.js](https://threejs.org) r170, loaded from jsDelivr. Plain ES modules, no build step
  (same as the rest of this repo).

## What changed in v0.3

- **Coji**: shoes stand on roads and the plaza instead of sinking in; Blankie's blanket drapes over
  his arms like real cloth and covers his lap when he rests on a bench. His chosen answers are spoken
  in a kid's voice.
- **A busier island**: villagers and animals (deer, foxes, chickens, squirrels, hedgehogs, crabs,
  frogs, ducklings) wander near Coji, mostly along the ring road. They can be talked to, and sometimes
  they help with the quest. Houses have doors to knock on, and their owners come out to chat. Knights
  walk on the castle walls and Sir Percy patrols the castle road.
- **Shows**: every minute or so something happens at sea or in the sky: a whale, a pirate ship, a
  kraken, dolphins, a plane pulling a banner to read, a hot-air balloon, or a UFO that beams an alien
  down (and comes back for it later).
- **Two new small islands** with bridges: Turtle Island (Old Sam, a treasure chest, sea turtles) and
  Flower Island (Pam, a gazebo, lots of flowers).
- **Mushrooms** to collect in the forest. Look up at the sky by dragging down.
- **Spookier graveyard**: much darker all around, scarier music (drone, wind, howls, bells); ghosts
  turn to face you; skeletons sink back after about 30 seconds.
- **Easier to play**: messages show in the middle of the screen (above the bag); the bag explains what
  each thing is for; the quest card says "MISSION"; a clear marker shows where Coji is walking;
  trees and buildings between the camera and Coji turn see-through; Coji gets tired and thirsty more
  slowly.
- **More to read in talks**: characters tell little stories ("Tell me about you!"), Coji's answers vary
  and can react ("Wow!", "Really?"), and goodbyes change.
- **Harder mail job**: read a full address and drop the letter in the right country box.
- The 🔊 read-aloud button in the dialogue is gone (the child reads; only Coji's own answer is
  spoken, after it is chosen).
- The cottage on Lighthouse Island sits on the ground beside the path, and the island's slopes are
  gentle enough to walk up.

## What changed in v0.2

- Coji: new hairstyle (layered bangs, short sides and back, cowlick), sneakers, a red backpack, and
  Blankie Bear held in his arms instead of worn as a cape.
- New island layout: the King's **castle** in the middle (moat, drawbridge, knight at the gate, the
  King on his balcony), the village just south of it, and a **ring road** around the island with eight
  places spread evenly along it. Lighthouse Island is now its own little island.
- **Jobs**: four places where Coji can work for coins with short reading mini-games.
- **Spooky Graveyard** with ghosts, skeletons, pumpkins and its own quest.
- Bluer sky with big white clouds; smoother terrain, round tree tops, roof tiles, street lamps and more
  detail, at the same speed.
- Dialogue without arrows: a character's lines appear together and the answers show right away.
- The Burger Hut sign stands on the roof edge so it is never hidden.

---

## 1. Main character: Coji

- 6-year-old boy, short black hair: straight, slightly spiky bangs above the eyes, short at the sides
  (ears show) and back, a shiny streak and a little cowlick on top. Big dark eyes, pink cheeks.
- **Kang Chiao sports uniform** (from the umbrella photo): cream shirt with navy horizontal stripes,
  each stripe with a thin white line under it; navy raglan shoulders and short sleeves with white
  piping down the outside; navy V-neck collar; small round school crest on the left chest; navy
  shorts. White socks.
- **Sneakers**: navy uppers with a white toe cap, white side stripe, white velcro strap, white sole.
- **Backpack**: red, with a lighter front pocket, a handle loop, dark straps over the shoulders and a
  little yellow charm.
- **Blankie Bear (被被熊)** is hugged in both arms: the little bear head (pale gray, round blue ears,
  brown eyes, nose and mouth) at his chest, and the pale gray knit blanket with light-blue stripes
  hanging down in front in soft folds and over both arms. The blanket sways when he walks. Resting on
  a bench, Coji spreads it over his lap.
- **Voice**: when the child picks an answer, Coji says it in a kid's voice (speech synthesis, higher
  pitch). Other characters are not read aloud: reading them is the point.
- Blankie Bear is also the **helper voice**: all tips appear in a bubble with the bear's face.

Colors live in one place: `js/config.js` (`UNIFORM`, `BLANKIE`, `BACKPACK`, `COJI`).

## 2. Controls

| Action | iPad / touch | Mouse |
|---|---|---|
| Walk somewhere | Tap the ground | Click the ground |
| Talk / use something | Tap the person, animal or object (Coji walks there first) | Click it |
| Tap a gravestone | A ghost pops out right away (no walking) | Same |
| Look around | Drag with one finger | Drag |
| Look up at the sky | Drag down | Drag down |
| Zoom | Pinch | Mouse wheel |
| Bag / Map / Rest | Buttons at the bottom right | Same (also B / M keys) |

- A tap is a touch that moves less than ~10 px. Anything longer is a camera drag.
- Where Coji is going is shown by a bright marker (white and yellow rings with a bouncing arrow),
  drawn on top of everything so it is easy to see even on the pale plaza. It stays until he arrives.
- Coji finds his own way around houses, trees and water (grid path-finding, A*). If a place cannot be
  reached yet, Blankie says why (e.g. "Bruno the bear is sitting on the bridge!").
- The camera slides in front of tree tops, and anything still between the camera and Coji (trees,
  houses, walls) turns see-through around him (dithered), so he is never hidden.

## 3. The island (Sunny Island)

The castle sits in the middle, inside a round moat. A small loop road goes around the moat. A **ring
road** circles the whole island just inside the beach; spokes join the castle loop to it. The places
on the ring are spread evenly, one every 45°. Wooden signposts with arrows stand at the main crossings.

| Place | Where | What is there |
|---|---|---|
| 🏰 Castle | Center | Walls, towers with flags, a keep. Moat and drawbridge. **Sir Lance** guards the closed gate; **King Arlo** waves from the balcony |
| 🏡 Village | Just south of the castle | Plaza with the **well**, benches, houses, Leo; Market, Bank, Toy Shop |
| ⚓ Harbor | Ring, south | Coji's start. Pier, Captain Pip's boat, Fisher Finn, Momo the cat |
| 📮 Post Office | Ring, south-east | Max the mailman (job) |
| 🏖️ Sunny Beach + 🍦 Ice Cream | Ring, east | Palm trees, shells, fountain, Coco's ice cream stand (job) |
| 🌉 Bear Bridge → 🗼 Lighthouse Island | Ring, north-east | A long bridge across the sea to the lighthouse and Gus's cottage; Bruno sits on it until fed |
| 🐢 Turtle Island | Off the west coast, by bridge | Palm trees, sea turtles, **Old Sam** (a retired, kind pirate) and his old treasure chest (6 coins, once) |
| 🌸 Flower Island | Off the south-east coast, by bridge | Flowers everywhere, a gazebo, **Pam** who comes to read and smell the flowers |
| 🏫 School | Ring, north | Teacher Kim (job), bell tower, a swing |
| 👻 Spooky Graveyard | Ring, north-west | Gravestones, ghosts, skeletons, pumpkins, Boo |
| 🥕 Farm | Ring, west | Apple trees, carrot patch, Bun the bunny, red barn |
| 🍔 Burger Hut | Ring, south-west | Burger Ben (shop + job) |
| 🌲 Forest, 🦆 Pond, ⛰️ Mount Puff | Inside the ring, north | Hoot's big tree, berries, the spring, ducks; a creek runs from the mountain into the pond |

## 4. Characters

| Who | Where | Does | Needs / gives |
|---|---|---|---|
| Captain Pip | Harbor pier | Welcomes Coji, gives the bag (water, apple, 3 coins) and quest 1 | |
| Fisher Finn | Pier | Gives a free fish (one at a time) | |
| Momo the cat 🐱 | Harbor crates | | Give a fish → **3 coins** |
| Burger Ben | Burger Hut | Shop (burger 4, fries 2, juice 2, water 1) + **Burger Kitchen job** | |
| Granny Bee | Market | Shop: honey 5, carrot 1, milk 2, candle 2. Buys apples and berries (1 each) | |
| Penny | Bank | Swaps shells for coins, 1 shell = 1 coin | |
| Tina | Toy Shop | Super Bright Bulb: 8 coins, or trade an owl feather | |
| Leo | Village plaza | Friendly kid, clues, a water bottle once | |
| Coco | Ice cream stand | **Ice Cream job** | |
| Max the Mailman | Post Office | **Sort the Mail job** | |
| Teacher Kim | School | **Word Check job** | |
| Sir Lance 🛡️ | Castle gate | Guards the castle. "The King is very busy" (for now) | |
| Knights 🛡️ | Castle walls | Three guards march along the wall tops | |
| Sir Percy 🛡️ | Castle loop road | Walks around the castle; can be talked to | |
| Old Sam 🏴‍☠️ | Turtle Island | Tells pirate stories, points to his chest | |
| Pam | Flower Island | Reads, has picnics, loves flowers | |
| House owners | At their houses | Knock on a door: Mrs. Rose, Baker Tom, Nora, Mr. Oak, Lily or Dr. Sam comes out to chat (sometimes nobody is home and there is a note to read). They stand outside now and then | Sometimes a clue or a treat |
| Villagers | Near Coji, on the roads | Random kids and grown-ups who walk around; chat, little stories; sometimes a clue for the quest | |
| Wild animals | Ring road, forest, beach, pond, farm | Deer, foxes, squirrels, hedgehogs, crabs (beach), frogs and ducklings (pond), chickens (farm). Talkable; some give a hint | |
| Aliens 👽 | Wherever a UFO drops one | Friendly, funny talk; the UFO picks them up later | |
| King Arlo 👑 | Castle balcony | Waves now and then. Tapping him shows a tip | The final quest (later) |
| Bun the bunny 🐰 | Farm | | Give a carrot → berries (+ a clue) |
| Hoot the owl 🦉 | Forest, big tree | Wise; many clues | Bring her glasses → **owl feather** + 2 coins |
| Bruno the bear 🐻 | Bear Bridge | Blocks the bridge | Give honey → moves away, gives quest 2 |
| Grandpa Gus | Lighthouse Island | Lighthouse keeper | Needs a new bulb |
| Boo the ghost 👻 | Graveyard | A shy little ghost, scared of the dark | Gives quest 3 |
| Mr. Bones 💀 | Graveyard (sometimes) | Climbs out of a grave, walks around, chats; almost never helps | |
| Ducks, seagulls, butterflies, bats | Pond, harbor, meadows, graveyard | Ambient life | |

Helping animals always gives something good (coins, berries, a feather, an open bridge).

## 5. Systems

### 5.1 Energy ⚡ and water 💧 (0 to 100)
- Walking uses both. Per meter walked: energy −0.055, water −0.065. Water also drops slowly over time
  (−0.012/s). (v0.3 halved these: a full bar lasts a long walk around the island.) Nothing drops while a dialogue, a job, the bag, the shop or the map is open.
- **Water slows energy loss**: water ≥ 60 → energy cost ×0.7; 30–60 → ×1; below 30 → ×1.5; 0 → ×2.
- **Rest** (💤 button anywhere, or tap a bench): energy comes back 3/s × water factor
  (water ≥ 60: ×1.6, 30–60: ×1, below 30: ×0.5). Benches are 1.5× faster.
- The well, the spring and the beach fountain fill water to 100 for free; the well and the spring
  also fill a water bottle for the bag (up to 2).
- Below 15 energy Coji walks slower. At 0 he naps for a few seconds (back to 25). No game over, ever.
- A job shift costs 4 energy.

### 5.2 Bag 🎒

| Item | Use | Where from |
|---|---|---|
| 🍎 Apple | +15 energy (sell for 1 coin) | Apple trees at the farm (they regrow) |
| 🫐 Berries | +8 energy (sell for 1 coin) | Berry bushes in the forest, Bun |
| 🍔 Burger | +45 energy | Burger Ben, 4 coins |
| 🍟 Fries | +20 energy | Burger Ben, 2 coins |
| 🧃 Juice | +30 water, +10 energy | Burger Ben, 2 coins |
| 🥛 Milk | +20 water, +15 energy | Granny Bee, 2 coins |
| 💧 Water bottle | +40 water | Pip, Leo, Burger Ben (1 coin); refills at the well |
| 🥕 Carrot | +10 energy (Bun loves them) | Granny Bee (1 coin), carrot patch |
| 🍄 Mushroom | +6 energy (sell for 1 coin) | Forest floor (34 of them; they come back) |
| 🍪 Cookie, 🥪 Sandwich | +12 / +30 energy | Gifts from house owners and villagers |
| 🎃 Pumpkin | +20 energy; Boo's quest | Graveyard pumpkin patch (regrows) |
| 🕯️ Candle | Boo's quest | Granny Bee, 2 coins |
| 🐟 Fish | For Momo | Fisher Finn |
| 🐚 Shell | Swap at the bank | Beaches (shells come back after a while) |
| 🍯 Honey, 👓 glasses, 🪶 feather, 💡 bulb | Quest items | See the quests |

Tap something in the bag to see what it is **and what to do with it** ("👉 Give it to Momo the cat
at the harbor."). The first thing is picked when the bag opens. Messages like "+1 🍎 Apple" or
"Yum! +15 ⚡" pop up in the middle of the screen, above the bag and shops.

### 5.3 Coins 🪙
Ways to earn: **jobs**, swap shells at the bank, sell apples/berries to Granny Bee, feed Momo, help
Hoot, finish Boo's quest, Old Sam's chest, hidden coins. Shops show the price and how many coins are missing.

### 5.4 Jobs 💼
Talk to the job person and choose "Can I work here? 💼". A shift is 5 rounds; each right answer pays
1 coin, a perfect shift pays 1 more. Wrong answers show the right ones in green. After a shift the
job rests for 60 seconds of play ("Come back a little later!"). Leaving early still pays.

| Job | Who | What the child does | Skill |
|---|---|---|---|
| 🍔 Burger Kitchen | Burger Ben | Read the order ("I want cheese and tomato. No onion, please!") and tap the toppings; the burger builds up | Reading sentences, "and", "no" |
| 🍦 Ice Cream Stand | Coco | Read the order ("Two scoops: pink and green, please!") and tap the scoops; the cone fills up | Color and flavor words |
| 📮 Sort the Mail | Max | Read a letter's address (name, street, city, COUNTRY) and drop it in the right one of 3 country boxes; the boxes look alike (Spain / Sweden / Singapore) so the child must read carefully | Reading an address, capital letters, look-alike words |
| 🏫 Word Check | Teacher Kim | See a picture (🐱) and tap the right word (cat / cap / can) | Phonics, CVC words |

### 5.5 Dialogue
- Tap a character: Coji walks over, they turn to face him, and the dialogue box opens with their
  portrait (rendered from the 3D model), name, and **all their lines together** (they type out
  quickly; tapping shows them at once). No arrows to tap through.
- Coji's answers appear right away as **2 or 3 buttons**. The chosen answer is shown as Coji's line,
  then the conversation moves on by itself.
- When a conversation ends there is one "OK! 👍" button; after "Bye!" the box closes by itself. A ✕
  button closes it any time.
- Something already asked moves down the list, so the other choices get a turn.
- No read-aloud button: the child reads the lines. After the child taps an answer, Coji says it out
  loud in a kid's voice.
- **Small talk**: "Tell me about you!" gets a little story (a few short lines). Coji's answers vary
  and sometimes react ("Wow! 🤩", "Really? 😮", "Ha ha!"), and the character answers the reaction.
  Thanks and goodbyes change each time.
- **Every character talks about the current quest.** The first question gives a hint, a follow-up
  gives a better clue, chit-chat gives no clue.

### 5.6 Quests
- **Only one quest at a time.** The quest card (top left) shows the quest, the current step, step
  dots and the clues found (tap to open). Clues with a place put a ⭐ on the map.
- The target character gets a gold "!" over the head; everyone else has a small "…" bubble.

### 5.7 The Spooky Graveyard 👻
- Walking in makes the world turn spooky: a dark night-purple sky, close dark fog and very dim light
  over the whole island, glowing lamps, drifting mist, green wisps, bats, and a scary tune (low
  drone, wind, far-off howls, a church bell, creaks, owl hoots). Walking out turns it back.
- **Tap a gravestone**: a little ghost pops out, turns to look at you, floats up with a "whoo" and
  fades away. Each tap has a 30% chance that a **skeleton (Mr. Bones)** climbs out (at most 2), walks
  around for 25–37 seconds, then sinks back (also right away if Coji leaves the graveyard).
  You can talk to him; he is funny but almost never helpful (sometimes a small clue in Boo's quest).
- Pumpkins grow at the back (food, and needed for Boo's quest). Jack-o'-lanterns glow by the gate.

### 5.8 Life on the island
- **Crowd** (`crowd.js`): up to 3 villagers and 4–6 animals appear within ~38 m of Coji (out of sight
  when possible) and walk along roads and paths; they are removed when far away. Each can be talked
  to: little stories, jokes, and now and then a real clue for the current quest.
- **Houses**: every house has a door to tap. Knock knock! The owner comes out and talks (a clue, a
  story, sometimes a cookie). If nobody is home, there is a note on the door to read. Owners also
  step outside by themselves sometimes.
- **Knights**: three knights march on the castle walls; Sir Percy walks around the castle road.
- **Shows** (`shows.js`): the first one after ~20 s, then one every 35–70 s, near Coji. At sea: a
  whale (spout), a pirate ship (horn), a kraken (purple tentacles), dolphins. In the sky: a plane with
  a banner to read ("READ EVERY DAY!"), a hot-air balloon, a UFO. Blankie points each one out
  ("Look up! A hot-air balloon! 🎈"). The UFO sometimes beams down an alien, who walks around and can
  be talked to, then comes back to beam it up.

### 5.9 Map 🗺️
The whole island: ring road, castle and moat, places with icons and names, Coji's arrow and what the
camera sees, ⭐ markers from clues, "!" for target characters, and "You are here".

### 5.10 Tips from Blankie Bear
Low energy/water (and "eat from your bag" if there is food), first time near a character or something
to use (well, bench, trees, shells, signpost, gravestone, pumpkin), the graveyard and the first
skeleton, new clues, and a reminder after 30 seconds of nothing happening (mentions jobs when coins
are needed).

### 5.11 Saving
Auto-saves to `localStorage` (position, stats, coins, bag, quests, clues, flags such as the opened
chest, job rests).

## 6. Story

Coji arrives at Sunny Island on Captain Pip's boat.

### Quest 1: The Hungry Bear 🐻 (from Captain Pip)
1. **Find out what Bear likes to eat.** (clue "Bears love honey")
2. **Get some honey.** Granny Bee, 5 coins (jobs, shells, apples, Momo).
3. **Give the honey to Bear.** Bruno moves off Bear Bridge and gives quest 2.

### Quest 2: The Dark Lighthouse 🗼 (from Bruno)
1. **Talk to Grandpa Gus** on Lighthouse Island.
2. **Find a big, bright light bulb.** (Tina's Toy Shop)
3. **Get the bulb from Tina.** 8 coins, or an owl feather (find Hoot's glasses by the pond).
4. **Bring the bulb to Grandpa Gus.** Finale: night falls, the lighthouse beam sweeps the sea,
   fireworks, "You did it!". Then free time.

### Quest 3: Boo's Pumpkin Lantern 🎃 (from Boo, after the lighthouse)
Everyone mentions the sad little ghost in the graveyard. Boo is scared of the dark.
1. **Find a pumpkin.** (graveyard pumpkin patch)
2. **Find a candle.** (Granny Bee, 2 coins)
3. **Bring the pumpkin and the candle to Boo.** A glowing jack-o'-lantern appears; Boo gives 5 coins.

### Last quest (later): the King 👑
Sir Lance keeps the castle gate closed: "The King has a big job for a hero." The final quest will
open the gate and involve King Arlo (to be designed).

## 7. English

- Level: KCIS Grade 1 (myView 1.1). Short sentences, present tense, high-frequency words, simple
  questions. New nouns are concrete and shown with an emoji.
- Fonts: **Andika** for reading text, **Baloo 2** for titles. Reading text ≥ 20 px, buttons ≥ 48 px.
- Reading is everywhere and always has a reason: clues to solve the quest, the bag's "what to do",
  orders and addresses in jobs, signposts, notes on doors, banners in the sky, and stories from
  friends.

## 8. Look and feel

- Cute, bright, cheerful. Blue sky with big puffy white clouds, soft shadows, light fog far away.
- Smooth-shaded terrain with blended colors (grass, forest, sand, rock, the graveyard's purple-green);
  characters, tree tops and bushes are smooth and round; buildings keep crisp edges with roof tiles,
  ridge caps, shutters, porch lamps and mailboxes. Street lamps along the main roads glow at night
  and in the graveyard.
- Water: turquoise shallows with foam lines, deep blue farther out, sky reflections and sun glints.
- Synthesized sounds and music (Web Audio, no files). 🔊 mutes everything.

## 9. Performance and loading

- **No asset files.** Every model is generated in code: the download is three.js (~170 KB gzip) +
  the game code.
- **Title first**, the island loads behind it (~2 s on a laptop).
- **Stream the world:** the core is built up front; each zone's details are built when Coji gets near,
  the rest during idle time. The map module is loaded on first use.
- **Cheap rendering:** a few shared materials, merged static meshes, instanced plants and lamps, one
  shadow light that follows Coji. About 100 draw calls and ~250k visible triangles; ~1 ms per frame
  on an M1 laptop.
- **Life stays cheap:** villagers, animals, residents and shows exist only near Coji (about 10 extra
  characters at most) and are removed when far away; see-through is a tiny shader addition, not
  extra draw calls.
- **Adaptive quality:** if the frame rate stays low (< ~25 fps), the game lowers the pixel ratio and
  then the shadow map size by itself (throttled/hidden frames are ignored).

## 10. Code layout

```
coji-island/
  index.html     title screen, HUD, dialogue, bag, shop, job, map and finale markup
  style.css      all UI styles
  SPEC.md        this file
  js/
    boot.js        title screen; imports the game in the background
    game.js        renderer, main loop, state and saving, Coji, taps, talking, tips, graveyard, finale
    config.js      tunable numbers and character colors
    land.js        island layout, heights, roads, castle, graveyard (pure JS, no three.js)
    nav.js         walkable grid + A* path-finding
    build.js       low-poly builder: merges colored primitives into one mesh; materials (with the
                   see-through effect around Coji)
    world.js       sky, terrain, water, roads, buildings, lamps, zones, spooky/day/night, fireworks
    props.js       buildings and objects (houses, shops, castle, lighthouse, graveyard pieces…)
    nature.js      trees, bushes, rocks, flowers, lamps, clouds (instanced)
    characters.js  Coji, people, animals, ghosts and skeletons, with simple animations
    camera.js      follow camera (can look up); tap / drag / pinch / wheel input
    items.js       item catalog and shops
    story.js       quests, clues and every character's dialogue (incl. villagers, residents, animals)
    crowd.js       wandering villagers and animals, house doors and residents, knights
    shows.js       sea and sky shows: whale, ship, kraken, dolphins, plane, balloon, UFO
    jobs.js        the four job mini-games
    dialogue.js    dialogue box (lines, answers, portraits; speaks Coji's chosen answer)
    ui.js          HUD, quest card, tips, bag, shop, toasts, finale screen
    map.js         map screen (loaded on first use)
    audio.js       synthesized sounds and music (happy and spooky tunes)
```

## 11. Later

- The King's final quest in the castle.
- Day/night cycle during normal play, weather (rain → Coji's yellow boots and dino umbrella!).
- A small house for Coji, a sticker book of helped friends, more jobs.
- Parent settings: tip frequency, read-aloud on/off, text size.
