// Quests, clues and what everyone says. English level: KCIS Grade 1 (short, simple sentences).
//
// A dialogue node: { say: [lines], choices: [{ text, go }], onShow, then, auto }
//   say      lines spoken by the character
//   choices  2-3 answers for Coji; `go` returns the next node (or null to end)
//   onShow   runs when the node appears (give items, add clues…)
//   then     next node when there are no choices
//
// Quests: several can be active at the same time; each one keeps its own steps in order. A quest can
// be started by its giver, by its subject, or by friends who live nearby (OFFERS), and by people and
// animals walking near the subject.
// Clues depend on how far Coji is from where the next step happens (STEPS): far away the clue is
// general ("Someone in the village has honey."), close by it is clear ("Granny Bee sells honey. Her
// stall is right over there!"). A follow-up question gives a better clue, but far away never the best.
// Lines and Coji's answers come from pools, drawn with `draw()` so the same one does not come back soon.
import * as L from './land.js'

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
// A shuffled bag per key: every item comes out once before any comes back, and the last one of a
// bag is never the first one of the next bag. So a line is rarely seen twice in a row.
const BAGS = new Map()
export function draw(key, list) {
  if (!list || !list.length) return undefined
  if (list.length === 1) return list[0]
  let b = BAGS.get(key)
  if (!b || b.n !== list.length || !b.left.length) {
    const left = shuffle([...list.keys()])
    const last = b && b.n === list.length ? b.last : -1
    if (left[left.length - 1] === last) {
      const j = Math.floor(Math.random() * (left.length - 1))
      ;[left[j], left[left.length - 1]] = [left[left.length - 1], left[j]]
    }
    b = { n: list.length, left, last }
    BAGS.set(key, b)
  }
  const i = b.left.pop()
  b.last = i
  return list[i]
}
const N = (say, choices = null, extra = {}) => ({ say: [].concat(say), choices, ...extra })

// ---------- quests ----------

export const QUESTS = {
  bear: {
    title: 'The Hungry Bear',
    icon: '🐻',
    steps: [
      { text: 'Find out what Bear likes to eat.', done: (g) => g.knows('honey', 'bear') || g.has('honey') },
      { text: 'Get some honey. 🍯', done: (g) => g.has('honey') },
      { text: 'Give the honey to Bear.' },
    ],
    clues: {
      sweet: { text: 'Bear likes sweet food.' },
      bees: { text: 'Bear likes a sweet food. Bees make it! 🐝' },
      honey: { text: 'Bears love honey! 🍯' },
      hoot: { text: 'Hoot the owl knows a lot. Hoot lives in the forest.', place: 'owl' },
      village: { text: 'Someone in the village has honey. 🏡', place: 'village' },
      granny: { text: 'Granny Bee sells honey at the Market.', place: 'market' },
      coins: { text: 'Honey costs 5 coins. 🪙' },
      shells: { text: 'Penny at the Bank swaps treasures 🐚 for coins.', place: 'bank' },
      apples: { text: 'Granny Bee buys apples 🍎. Apple trees grow at the Farm.', place: 'farm' },
      momo: { text: 'Momo the cat has coins. Momo wants a fish 🐟.', place: 'harbor' },
      farbridge: { text: 'Bear sits on a bridge by the sea. Follow the big road around the island.', place: 'bridge' },
      bridge: { text: 'Bear sits on Bear Bridge. Take the forest trail to the sea.', place: 'bridge' },
    },
  },
  light: {
    title: 'The Dark Lighthouse',
    icon: '🗼',
    steps: [
      { text: 'Talk to Grandpa Gus at the lighthouse.' },
      { text: 'Find a big, bright light bulb. 💡', done: (g) => g.knows('price', 'light') },
      { text: 'Get the bulb from Tina.', done: (g) => g.has('bulb') },
      { text: 'Bring the bulb to Grandpa Gus.' },
    ],
    clues: {
      island: { text: 'Grandpa Gus lives far away, in a lighthouse on a little island. 🏝️', place: 'lighthouse' },
      path: { text: 'The lighthouse is on Lighthouse Island, across Bear Bridge.', place: 'lighthouse' },
      bearfirst: { text: 'Bruno the bear sits on the bridge. Help him first! 🐻', place: 'bridge' },
      lamp: { text: 'Grandpa Gus needs a big, bright bulb 💡.' },
      shops: { text: 'A shop in the village may have a big bulb. 🏡', place: 'village' },
      toyshop: { text: "Tina's Toy Shop has a big bulb.", place: 'toyshop' },
      price: { text: 'The bulb costs 8 coins. Or trade a soft feather 🪶.' },
      shells: { text: 'Penny at the Bank swaps treasures 🐚 for coins.', place: 'bank' },
      birds: { text: 'Birds have soft feathers. Look in the forest. 🌲', place: 'forest' },
      hoot: { text: 'Hoot the owl has soft feathers.', place: 'owl' },
      glasses: { text: 'Hoot lost her glasses 👓.' },
      forestglasses: { text: 'Someone in the forest lost these glasses. 🌲', place: 'forest' },
      water: { text: 'Something shiny is by the water. 💧' },
      pond: { text: 'Shiny glasses are by the pond!', place: 'glasses' },
    },
  },
  boo: {
    title: "Boo's Pumpkin Lantern",
    icon: '🎃',
    steps: [
      { text: 'Find a pumpkin. 🎃', done: (g) => g.has('pumpkin') },
      { text: 'Find a candle. 🕯️', done: (g) => g.has('candle') },
      { text: 'Bring the pumpkin and the candle to Boo.' },
    ],
    clues: {
      spooky: { text: 'Pumpkins grow in a spooky place. 👻', place: 'graveyard' },
      pumpkin: { text: 'Pumpkins grow in the Spooky Graveyard. 🎃', place: 'graveyard' },
      patch: { text: 'The pumpkins are at the back of the graveyard. Tap one! 🎃' },
      candlevillage: { text: 'Someone in the village sells candles. 🕯️', place: 'village' },
      candle: { text: 'Granny Bee sells candles at the Market. 🕯️', place: 'market' },
      candleprice: { text: 'A candle costs 2 coins. 🪙' },
      lantern: { text: 'A pumpkin + a candle = a pumpkin lantern!' },
    },
  },
}
// Quests in story order. A later quest (the King's!) can list `needs: ['bear', 'light', 'boo']`.
export const QUEST_ORDER = ['bear', 'light', 'boo']

export const allDone = (g) => QUEST_ORDER.every((q) => g.done(q))
export const isActive = (g, q) => g.at(q) >= 0
export const activeQuests = (g) => QUEST_ORDER.filter((q) => g.at(q) >= 0)
// A quest that nobody has started yet, and that can start now.
export function available(g, q) {
  const Q = QUESTS[q]
  return !!Q && g.at(q) < 0 && !g.done(q) && (Q.needs || []).every((n) => g.done(n))
}

// ---------- where things happen, and clues from far (0) to near (2) ----------

export const NEAR = 30 // closer than this: clear clues
export const MID = 65 // closer than this: good clues; farther: general clues
const levelAt = (d) => (d <= NEAR ? 2 : d <= MID ? 1 : 0)

const PATCH = L.PUMPKINS.reduce((m, p) => ({ x: m.x + p.x / L.PUMPKINS.length, z: m.z + p.z / L.PUMPKINS.length }), { x: 0, z: 0 })
// `area` is said far away, `who` close by.
const SPOTS = {
  granny: { area: 'the village', who: 'Granny Bee' },
  tina: { area: 'the village', who: 'Tina' },
  hoot: { area: 'the forest', who: 'Hoot the owl' },
  bruno: { area: 'Bear Bridge', who: 'Bruno the bear' },
  gus: { area: 'the lighthouse', who: 'Grandpa Gus' },
  boo: { area: 'the Spooky Graveyard', who: 'Boo' },
  patch: { area: 'the Spooky Graveyard', who: 'the pumpkins', x: PATCH.x, z: PATCH.z },
  glasses: { area: 'the pond', who: 'the glasses', x: L.GLASSES_SPOT.x, z: L.GLASSES_SPOT.z },
}
function spotPos(g, k) {
  const s = SPOTS[k]
  if (s.x !== undefined) return s
  return g.npcPos?.(k) || L.NPCS[k]
}

// Every quest step: where it happens (`at`, the nearest one counts), questions Coji can ask, and
// clues [far, mid, near] (several phrasings each).
const MORE_QS = ['Can you tell me more?', 'Tell me more, please!', 'What else do you know?', 'Do you know more?', 'Anything more?', 'Who knows more?']
const STEPS = {
  'bear.0': {
    at: ['granny', 'hoot', 'bruno'],
    qs: ['What does Bear like to eat?', 'What do bears eat?', 'What food does Bear like?', 'Do you know what bears like?', 'What can I give the bear?'],
    more: ['Is it sweet?', 'What sweet food?'],
    hint: [
      [
        { a: ['Bears like sweet things, I think.', 'Someone in {area} knows more!'], clue: 'sweet' },
        { a: ['Hmm... Something sweet, I think.', 'Go to {area} and find out!'], clue: 'sweet' },
        { a: ['Bears love sweet food!', 'Ask around {area}. They know more.'], clue: 'sweet' },
      ],
      [
        { a: ['Bear likes sweet, sticky food.', 'Bees make it! 🐝'], clue: 'bees' },
        { a: ['It is sweet and gold.', 'Bees make it in their hive. 🐝'], clue: 'bees' },
        { a: ['Bees make a sweet food.', 'Bears love it! 🐝'], clue: 'bees' },
      ],
      [
        { a: ['Bears love honey! 🍯'], clue: 'honey' },
        { a: ['Honey, of course!', 'Bears love honey. 🍯'], clue: 'honey' },
        { a: ['Honey! 🍯', 'Bears lick it off their paws. Yum!'], clue: 'honey' },
      ],
    ],
  },
  'bear.1': {
    at: ['granny'],
    qs: ['Where can I get honey?', 'Who has honey?', 'Do you know where honey is?', 'Where do I find honey?', 'I need honey. Who sells it?'],
    more: ['Who has honey?', 'Where in the village?'],
    hint: [
      [
        { a: ['Someone in the village has honey.', 'Go and ask!'], clue: 'village' },
        { a: ['Honey? Go to the village and find out!'], clue: 'village' },
        { a: ['I think the village has honey.', 'Ask the people there!'], clue: 'village' },
      ],
      [
        { a: ['Look for the Market in the village.', 'Granny Bee sells honey there!'], clue: 'granny' },
        { a: ['Granny Bee has honey.', 'She has a yellow stall at the Market.'], clue: 'granny' },
      ],
      [
        { a: ['Granny Bee sells honey!', 'Her yellow stall is right over there.', 'One jar is 5 coins. 🪙'], clue: ['granny', 'coins'] },
        { a: ['Look! The yellow stall!', 'That is Granny Bee. She has honey.', 'It costs 5 coins. 🪙'], clue: ['granny', 'coins'] },
      ],
    ],
  },
  'bear.2': {
    at: ['bruno'],
    qs: ['Where is the bear?', 'How do I get to Bear?', 'I have honey! Where is Bear?', 'Where is Bear Bridge?'],
    more: ['How do I get there?', 'Which way do I go?'],
    hint: [
      [
        { a: ['Bear is far away, on a bridge by the sea.', 'Follow the big road around the island!'], clue: 'farbridge' },
        { a: ['Bear sits on a bridge. It is far from here!', 'Walk on the big road. Look for the sea.'], clue: 'farbridge' },
      ],
      [
        { a: ['Bear is on Bear Bridge.', 'Take the forest trail to the sea!'], clue: 'bridge' },
        { a: ['Go to Bear Bridge.', 'It is past the forest, by the sea.'], clue: 'bridge' },
      ],
      [
        { a: ['Bear is right there, on the bridge!', 'Give him the honey! 🍯'], clue: 'bridge' },
        { a: ['Look! The big bear on the bridge!', 'Go, go, Coji!'], clue: 'bridge' },
      ],
    ],
  },
  'light.0': {
    at: ['gus'],
    qs: ['Where is Grandpa Gus?', 'Where is the lighthouse?', 'How do I get to the lighthouse?', 'Where does Grandpa Gus live?'],
    more: ['How do I get there?', 'Which way do I go?'],
    hint: [
      [
        { a: ['Grandpa Gus lives far away.', 'His lighthouse is on a little island.'], clue: 'island' },
        { a: ['Grandpa Gus lives in the tall lighthouse.', 'It is on a little island, far away!'], clue: 'island' },
      ],
      [
        { a: ['The lighthouse is across Bear Bridge.', 'Grandpa Gus lives there.'], clue: 'path' },
        { a: ['Cross Bear Bridge to the little island.', 'The lighthouse is there!'], clue: 'path' },
      ],
      [
        { a: ['Grandpa Gus is in the lighthouse.', 'It is right over there!'], clue: 'path' },
        { a: ['Look! The red and white tower!', 'Grandpa Gus lives there.'], clue: 'path' },
      ],
    ],
    extra: (g) => !g.done('bear') && ['But Bruno the bear sits on the bridge.', 'Help him first! 🐻'],
    extraClue: 'bearfirst',
  },
  'light.1': {
    at: ['tina'],
    qs: ['Where can I find a big bulb?', 'Who has a big bulb?', 'Do you know where a bulb is?', 'I need a big, bright bulb. Where is one?'],
    more: ['Which shop?', 'Who has one?'],
    hint: [
      [
        { a: ['A big bulb? Ask in the village.', 'The shops there have lots of things!'], clue: 'shops' },
        { a: ['Hmm... Go to the village and find out!', 'Look at the shops.'], clue: 'shops' },
      ],
      [
        { a: ['I saw a big bulb in a shop window.', 'Was it the Toy Shop?'], clue: 'toyshop' },
        { a: ['The Toy Shop in the village has a big bulb!'], clue: 'toyshop' },
      ],
      [
        { a: ['Tina has a big bulb in her Toy Shop!', 'Look in the window, right over there!'], clue: 'toyshop' },
        { a: ['Look! The Toy Shop!', 'The big bulb is in the window. Ask Tina!'], clue: 'toyshop' },
      ],
    ],
  },
  'light.2': (g) => {
    if (g.coins >= 8 || g.has('feather')) return L2.ready
    if (g.has('glasses')) return L2.glasses
    if (g.knows('glasses', 'light') || g.flag('knowGlasses')) return L2.pond
    return L2.feather
  },
  'light.3': {
    at: ['gus'],
    qs: ['I have the bulb! Where is Grandpa Gus?', 'Where is the lighthouse?', 'How do I get to Grandpa Gus?'],
    hint: [
      [{ a: ['Take the bulb to the lighthouse!', 'It is far, across Bear Bridge.'], clue: 'path' }],
      [{ a: ['Cross Bear Bridge.', 'Grandpa Gus is waiting!'], clue: 'path' }],
      [{ a: ['Grandpa Gus is right over there!', 'Give him the bulb! 💡'] }],
    ],
  },
  'boo.0': {
    at: ['patch'],
    qs: ['Where can I find a pumpkin?', 'Who has a pumpkin?', 'Do you know where pumpkins grow?', 'I need a pumpkin. Can you help?'],
    more: ['Where is that?', 'A spooky place?'],
    hint: [
      [
        { a: ['Pumpkins like spooky places! 👻', 'Go to the graveyard and find out.'], clue: 'spooky' },
        { a: ['I saw big orange things in a spooky place.', 'It is far, far away!'], clue: 'spooky' },
      ],
      [
        { a: ['Pumpkins grow in the Spooky Graveyard. 🎃'], clue: 'pumpkin' },
        { a: ['Go to the Spooky Graveyard.', 'Big pumpkins grow there!'], clue: 'pumpkin' },
      ],
      [
        { a: ['Look behind the gravestones!', 'Big orange pumpkins grow there. Tap one!'], clue: ['pumpkin', 'patch'] },
        { a: ['The pumpkins are right over there!', 'Tap one to pick it. 🎃'], clue: ['pumpkin', 'patch'] },
      ],
    ],
  },
  'boo.1': {
    at: ['granny'],
    qs: ['Where can I find a candle?', 'Who sells candles?', 'I need a candle. Who has one?', 'Do you know where candles are?'],
    more: ['Who sells them?', 'Where in the village?'],
    hint: [
      [
        { a: ['A candle? Ask in the village!', 'Someone there sells them.'], clue: 'candlevillage' },
        { a: ['Go to the village and find out!', 'They have candles there.'], clue: 'candlevillage' },
      ],
      [
        { a: ['Granny Bee sells candles at the Market. 🕯️'], clue: 'candle' },
        { a: ['Look for the Market in the village.', 'Granny Bee has candles!'], clue: 'candle' },
      ],
      [
        { a: ['Granny Bee sells candles!', 'Her stall is right over there.', 'A candle is 2 coins. 🪙'], clue: ['candle', 'candleprice'] },
        { a: ['Look! The yellow stall!', 'Granny Bee has candles. They cost 2 coins.'], clue: ['candle', 'candleprice'] },
      ],
    ],
  },
  'boo.2': {
    at: ['boo'],
    qs: ['I have a pumpkin and a candle!', 'Where is Boo?', 'Where does Boo live?'],
    hint: [
      [{ a: ['Boo lives in the Spooky Graveyard.', 'It is far away. Go and see her!'] }],
      [{ a: ['Boo is in the graveyard.', 'Pumpkin plus candle makes a lantern!'], clue: 'lantern' }],
      [{ a: ['Boo is right there!', 'Give her the pumpkin and the candle.'], clue: 'lantern' }],
    ],
  },
}
// "Get the bulb from Tina" needs 8 coins or a feather, so the clues follow what Coji needs now.
const L2 = {
  ready: {
    sub: 'ready',
    at: ['tina'],
    qs: ['Where is the Toy Shop?', 'Where is Tina?', 'How do I get to Tina?'],
    hint: [
      [{ a: ['Go back to the village.', 'Tina has the bulb in her Toy Shop!'], clue: 'toyshop' }],
      [{ a: ['The Toy Shop is in the village.', 'Tina is waiting for you!'], clue: 'toyshop' }],
      [{ a: ['Tina is right over there!', 'Go and get the bulb! 💡'] }],
    ],
  },
  feather: {
    sub: 'feather',
    at: ['hoot'],
    qs: ['Where can I find a soft feather?', 'Who has a soft feather?', 'Do you know where a feather is?', 'I need a feather. Can you help?'],
    more: ['Which bird?', 'Where are the birds?'],
    hint: [
      [
        { a: ['Birds have feathers!', 'Ask someone in the forest.'], clue: 'birds' },
        { a: ['Soft feathers? Go to the forest and find out!'], clue: 'birds' },
      ],
      [
        { a: ['Hoot the owl has soft feathers.', 'She lives in a big tree in the forest.'], clue: 'hoot' },
        { a: ['Owls have big, soft feathers.', 'Hoot lives in the forest!'], clue: 'hoot' },
      ],
      [
        { a: ['Hoot the owl is in that big tree!', 'Ask her for a feather.'], clue: 'hoot' },
        { a: ['Look up! Hoot the owl lives right there.', 'She has soft feathers.'], clue: 'hoot' },
      ],
    ],
  },
  pond: {
    sub: 'pond',
    at: ['glasses'],
    qs: ["Where are Hoot's glasses?", 'Did you see some glasses?', 'Where can I find glasses?'],
    more: ['Where is the water?', 'What water?'],
    hint: [
      [
        { a: ['Something shiny is by the water.', 'Go and look!'], clue: 'water' },
        { a: ['I saw something shiny by the water.', 'It is far from here.'], clue: 'water' },
      ],
      [
        { a: ['Shiny glasses are by the pond!'], clue: 'pond' },
        { a: ['Look by the pond, near the forest.', 'I saw shiny glasses there!'], clue: 'pond' },
      ],
      [
        { a: ['Look! Something shiny by the pond!', 'Walk over and pick it up!'], clue: 'pond' },
        { a: ['The glasses are by the water, right there!'], clue: 'pond' },
      ],
    ],
  },
  glasses: {
    sub: 'glasses',
    at: ['hoot'],
    qs: ['Whose glasses are these?', 'Who lost these glasses?', 'Do you know these glasses?'],
    more: ['Who has big eyes?', 'Who is it?'],
    hint: [
      [
        { a: ['Someone with big eyes lost them!', 'Ask in the forest.'], clue: 'forestglasses' },
        { a: ['Hmm... someone in the forest lost glasses.', 'Go and ask!'], clue: 'forestglasses' },
      ],
      [
        { a: ['Hoot the owl lost her glasses!', 'She lives in a big tree in the forest.'], clue: ['glasses', 'hoot'] },
        { a: ['Those are Hoot\'s glasses!', 'Take them to her in the forest.'], clue: ['glasses', 'hoot'] },
      ],
      [
        { a: ['Hoot lost her glasses!', 'She is in that big tree. Give them to her!'], clue: ['glasses', 'hoot'] },
        { a: ['Those are Hoot\'s glasses!', 'Look up! She lives right there.'], clue: ['glasses', 'hoot'] },
      ],
    ],
  },
}

// The step of quest q, where it happens and how near Coji is (or null when q is not active).
export function stepInfo(g, q) {
  const n = g.at(q)
  if (n < 0) return null
  const key = `${q}.${n}`
  let S = STEPS[key]
  if (typeof S === 'function') S = S(g)
  if (!S) return null
  const p = g.pos()
  let best = null
  for (const k of S.at) {
    const s = spotPos(g, k)
    if (!s) continue
    const d = Math.hypot(p.x - s.x, p.z - s.z)
    if (!best || d < best.d) best = { k, d, x: s.x, z: s.z }
  }
  if (!best) return null
  return { ...S, key, q, spot: best.k, x: best.x, z: best.z, dist: best.d, level: levelAt(best.d) }
}
// The active quest whose next step is nearest to Coji.
export function questNear(g) {
  let best = null
  for (const q of activeQuests(g)) {
    const S = stepInfo(g, q)
    if (S && (!best || S.dist < best.dist)) best = S
  }
  return best
}
const byNearest = (g) =>
  activeQuests(g)
    .map((q) => ({ q, d: stepInfo(g, q)?.dist ?? 1e9 }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.q)

// A clue for quest q at a level (default: how far Coji is).
function hint(g, q, want) {
  const S = stepInfo(g, q)
  if (!S) return null
  const lv = Math.max(0, Math.min(2, want ?? S.level))
  const h = draw(`hint:${S.key}:${S.sub || ''}:${lv}`, S.hint[lv])
  const sp = SPOTS[S.spot]
  const fill = (t) => t.split('{area}').join(sp.area).split('{who}').join(sp.who)
  const a = h.a.map(fill)
  const clue = [].concat(h.clue || [])
  const extra = S.extra?.(g)
  if (extra) {
    a.push(...extra)
    if (S.extraClue) clue.push(S.extraClue)
  }
  return { a, clue, q, level: lv, base: S.level, S }
}

// ---------- who can start a quest ----------

const OFFER_QS = ['Is something wrong?', 'Do you need help?', 'You look worried. Why?', 'Is there a problem?', 'What is the matter?', 'Is everything okay?']
export const OFFERS = {
  bear: {
    giver: 'pip',
    subject: 'bruno',
    lines: {
      pip: ['Oh, I have a problem, Coji.', 'A big bear sits on Bear Bridge.', 'He is very hungry. Nobody can cross the bridge!', 'Can you help the bear?'],
      bruno: ['Grrr... I am so hungry...', 'My tummy is empty. I can not move!', 'Can you find food for me?'],
      finn: ['Did you see the big bear?', 'He sits on Bear Bridge all day.', 'He is so hungry! He even looked at my fish.', 'Can you help him?'],
      momo: ['Meow! A big bear sits on the bridge.', 'His tummy says GRRR!', 'Can you help him? Then he will not want my fish!'],
      hoot: ['Who-who... My friend Bruno is sad.', 'He sits on Bear Bridge. He is so hungry!', 'Can you help him?'],
    },
    qs: { bruno: ['Are you okay, Bear?', 'Why are you sad, Bear?', 'Hello, Bear! What is wrong?'] },
    generic: [
      ['Did you see the big bear on the bridge?', 'He is so hungry!', 'Can you help him?'],
      ['A big bear sits on Bear Bridge.', 'Nobody can cross. He is too hungry to move!', 'Can you help him?'],
      ['Shh! Listen! GRRR!', 'That is the hungry bear on the bridge.', 'Can you help him?'],
    ],
    yes: () => ['Thank you, Coji!', 'First, find out what Bear likes to eat.', 'Ask people. Tap them to talk!'],
    yesSubject: () => ['Thank you, Coji!', 'You are so kind.', 'Grrr... What do I like? Ask me!'],
  },
  light: {
    giver: 'bruno',
    subject: 'gus',
    lines: {
      bruno: (g) => g.done('bear') && ['Coji, can you help one more friend?', 'Grandpa Gus lives in the lighthouse.', 'His light is broken. He is so sad.', 'Ships can not find the island at night!'],
      pip: ['Look at the lighthouse, Coji.', 'The light is off!', 'My boat can not sail at night.', 'Can you help Grandpa Gus?'],
      coco: ['Every night I look at the sea.', 'But the lighthouse is dark now!', 'Grandpa Gus is so sad.', 'Can you help him?'],
      kim: ['L-I-G-H-T. Light!', 'The lighthouse has no light now.', 'Grandpa Gus needs a helper.', 'Can you help him?'],
    },
    generic: [
      ['Did you see the lighthouse?', 'It is dark at night now!', 'Grandpa Gus needs help. Can you help him?'],
      ['The lighthouse light is broken.', 'Ships can not see the island!', 'Can you help Grandpa Gus?'],
    ],
    yes: (g) => ['Thank you, Coji!', 'Go and talk to Grandpa Gus.', 'He lives in the lighthouse.', ...(g.done('bear') ? [] : ['But the bear sits on the bridge. Help him first!'])],
  },
  boo: {
    giver: 'boo',
    subject: 'boo',
    lines: {
      bones: ['Rattle! Boo is my friend.', 'She is a little ghost.', 'But she is scared of the dark! Boo-hoo!', 'Can you help her?'],
      kim: ['Did you hear?', 'A little ghost lives in the graveyard.', 'Her name is Boo. She looks so sad!', 'Can you help her?'],
      bun: ['Hop! At night I hear a little ghost cry.', 'Boo-hoo! Boo-hoo!', 'She lives in the Spooky Graveyard.', 'Can you help her?'],
    },
    generic: [
      ['Did you hear?', 'A little ghost lives in the Spooky Graveyard.', 'Her name is Boo. She is scared of the dark!', 'Can you help her?'],
      ['Shh! Boo-hoo! Do you hear that?', 'It is Boo, the little ghost. She is sad.', 'Can you help her?'],
    ],
    yes: () => ['Thank you, Coji!', 'Boo wants a pumpkin lantern.', 'Find a pumpkin and a candle!'],
  },
}
// People and animals walking near a quest's subject can start it too.
const OFFER_NEAR = 40
function nearSubject(g, q) {
  const s = spotPos(g, OFFERS[q].subject)
  const p = g.pos()
  return s && Math.hypot(p.x - s.x, p.z - s.z) < OFFER_NEAR
}
const YES_HELP = ['Yes! I can help!', 'I will help!', 'Okay! Let me try!', 'Sure! I will do it!', 'Of course I will help!', 'I can do it!', 'Yes! Let me help!']
const NOT_NOW = ['Maybe later.', 'Not now, sorry.', 'Let me think about it.']
const OK_LATER = [['Okay. Come back soon!'], ['That is okay. Maybe later!'], ['Okay! Think about it.']]

// What `id` can say to start a quest now: { q, text, lines } or null.
// dyn: someone walking around (they offer a quest only near its subject).
function offerFor(g, id, dyn = !!CAST[id]?.dynamic) {
  for (const q of QUEST_ORDER) {
    if (!available(g, q)) continue
    const O = OFFERS[q]
    let lines = O.lines[id]
    if (typeof lines === 'function') lines = lines(g)
    if (!lines && dyn && nearSubject(g, q)) lines = draw('offer:' + q, O.generic)
    if (!lines) continue
    const qs = O.qs?.[id] || OFFER_QS
    return { q, text: draw('offerq:' + (O.qs?.[id] ? id : 'all'), qs), lines, subject: O.subject === id }
  }
  return null
}
function offerNode(g, of, back) {
  const O = OFFERS[of.q]
  const yes = (of.subject && O.yesSubject ? O.yesSubject : O.yes)(g)
  return N(of.lines, [
    { text: draw('q:yes', YES_HELP), go: () => N(yes, null, { onShow: () => g.startQuest(of.q) }) },
    { text: draw('q:notnow', NOT_NOW), go: () => (back ? N(draw('oklater', OK_LATER), null, { then: back }) : N(draw('oklater', OK_LATER))) },
  ])
}
// Someone who can not start a quest still talks about it.
const RUMORS = {
  bear: (g) => ['A big bear sits on Bear Bridge.', 'He is very hungry!', g.met('pip') ? 'Captain Pip knows more. Ask him!' : 'Ask Captain Pip at the harbor!'],
  light: (g) => ['The lighthouse light is off!', 'Grandpa Gus is so sad.', g.done('bear') ? 'Ask Bruno the bear about it.' : 'Ask Captain Pip about it.'],
  boo: () => ['Did you hear?', 'A little ghost lives in the Spooky Graveyard.', 'Her name is Boo. She looks sad!'],
}
const RUMOR_QS = ['Who needs help?', 'What can I do now?', 'Does someone need help?', 'Is anyone sad?']
function rumor(g) {
  const q = QUEST_ORDER.find((id) => available(g, id))
  return q ? { q, a: RUMORS[q](g) } : null
}

// ---------- Blankie Bear's tips ----------

const coinsTip = (g, what, n) => `${what} costs ${n} coins. You have ${g.coins}. Find treasures 🐚, sell apples 🍎, or do a job 💼!`
// [far, mid, near] (or one tip for any distance). S: the step info, w: the nearest spot's words.
const TIPS = {
  'bear.0': (g, S, w) => [
    `What does Bear like to eat? Go to ${w.area} and ask! 💬`,
    'What does Bear like to eat? Ask people around here! 💬',
    `Tap ${w.who} and ask what bears like to eat! 💬`,
  ],
  'bear.1': (g) => {
    if (!g.knows('granny', 'bear')) return ['Who has honey? Go to the village and ask people! 🏡', 'Who has honey? Look for the Market in the village! 🍯', 'Who has honey? Ask people here. The Market is close! 🍯']
    if (g.coins < 5) return coinsTip(g, 'Honey', 5)
    return ["Let's go to the Market in the village and buy honey! 🍯", "The Market is close. Let's buy honey from Granny Bee! 🍯", 'Tap Granny Bee to buy honey! 🍯']
  },
  'bear.2': () => [
    "Let's take the honey to Bear! He is far away, by the sea. Open the map 🗺️!",
    'Bear Bridge is not far! Take the forest trail to the sea. 🌉',
    'There is Bruno! Tap him and give him the honey! 🍯',
  ],
  'light.0': (g) =>
    g.done('bear')
      ? ["Let's go to the lighthouse and find Grandpa Gus! 🗼 Open the map 🗺️.", 'Cross Bear Bridge to the lighthouse! 🗼', 'Grandpa Gus is right there! Tap him. 👋']
      : 'Grandpa Gus lives across Bear Bridge. But Bruno the bear sits on it! Help him first. 🐻',
  'light.1': (g) =>
    g.knows('toyshop', 'light')
      ? ["Let's go to the Toy Shop in the village! 💡", 'The Toy Shop is close. Look for the big bulb! 💡', 'Tap Tina and ask about the big bulb! 💡']
      : ['Where is a big, bright bulb? Ask in the village! 💡', 'Which shop has a big bulb? Ask people here! 💡', 'Look at the shops here. Which one has a bulb? 💡'],
  'light.2': (g, S) => {
    if (S.sub === 'ready') return ["Let's go back to the Toy Shop and get the bulb! 💡", 'The Toy Shop is close. Get the bulb! 💡', 'Tap Tina and get the bulb! 💡']
    if (S.sub === 'glasses') return ['Who lost these glasses? Ask in the forest! 👓', 'Who lost these glasses? Someone with big eyes in the forest! 👓', 'Give the glasses to Hoot! She is in that big tree. 🦉']
    if (S.sub === 'pond') return ["Hoot's glasses are by the water. Open the map 🗺️ and find the pond!", 'Look by the pond for shiny glasses! 👓', 'Something shiny is by the pond! Walk over to it. 👓']
    return [`Tina wants 8 coins or a soft feather. You have ${g.coins} coins. Jobs 💼 pay coins!`, 'Who has a soft feather? Hoot the owl lives in the forest! 🪶', 'Hoot the owl is close! Tap her and ask for a feather. 🪶']
  },
  'light.3': () => ["Let's take the bulb to Grandpa Gus! 🗼 Open the map 🗺️.", 'Cross Bear Bridge to the lighthouse! 💡', 'Tap Grandpa Gus and give him the bulb! 💡'],
  'boo.0': () => ['Boo needs a pumpkin. Pumpkins like spooky places! 👻', 'Pumpkins grow in the Spooky Graveyard! 🎃', 'Pumpkins grow at the back of the graveyard. Tap one! 🎃'],
  'boo.1': (g) => {
    if (!g.knows('candle', 'boo') && !g.knows('candlevillage', 'boo')) return ['Who has candles? Go to the village and ask! 🕯️', 'Who has candles? Ask people here! 🕯️', 'Who has candles? Ask people here! 🕯️']
    if (g.coins < 2) return coinsTip(g, 'A candle', 2)
    return ["Let's buy a candle from Granny Bee at the Market! 🕯️", 'The Market is close. Buy a candle from Granny Bee! 🕯️', 'Tap Granny Bee to buy a candle! 🕯️']
  },
  'boo.2': () => [
    "Let's take the pumpkin and the candle to Boo in the graveyard! 👻",
    'The Spooky Graveyard is close. Boo is waiting! 👻',
    'Tap Boo and give her the pumpkin and the candle! 🎃',
  ],
}
const AVAIL_TIPS = {
  bear: (g) => (g.met('pip') ? ['A big bear sits on Bear Bridge. He is hungry! Talk to Captain Pip. 🐻', 'Someone needs help! Talk to Captain Pip at the harbor. ⚓'] : ['Tap Captain Pip to say hi! 👋']),
  light: (g) => (g.done('bear') ? ['The lighthouse is dark! Talk to Bruno or Grandpa Gus. 🗼'] : ['The lighthouse is dark! Ask Captain Pip about it. 🗼']),
  boo: () => ['Boo the little ghost needs a friend! Visit the Spooky Graveyard. 👻', 'Someone is sad in the Spooky Graveyard. Go and see! 👻'],
}
const END_TIPS = ['Explore the island, and do jobs to earn coins! 💼', 'Find treasures 💎 and swap them at the bank!', 'Sir Lance says the King will need a hero one day! 👑']

// What Blankie Bear says when nothing has happened for a while.
export function stepTip(g) {
  if (!g.flag('gotBag') && !g.met('pip') && !activeQuests(g).length) return 'Tap Captain Pip to say hi! 👋'
  const q = g.focus()
  const S = q && stepInfo(g, q)
  if (S) {
    const sp = SPOTS[S.spot]
    const t = TIPS[S.key](g, S, sp)
    return Array.isArray(t) ? t[S.level] : t
  }
  for (const id of QUEST_ORDER) if (available(g, id)) return draw('tip:' + id, AVAIL_TIPS[id](g))
  return draw('tip:end', END_TIPS)
}

// Who should get a gold "!" right now.
export function targets(g) {
  const t = new Set()
  if (!g.flag('gotBag')) t.add('pip')
  if (g.is('bear.1') && g.knows('granny', 'bear')) t.add('granny')
  if (g.is('bear.2')) t.add('bruno')
  if (g.is('light.0') || g.is('light.3')) t.add('gus')
  if (g.is('light.1') && g.knows('toyshop', 'light')) t.add('tina')
  if (g.is('light.2') && (g.coins >= 8 || g.has('feather'))) t.add('tina')
  if (g.is('boo.1') && g.knows('candle', 'boo')) t.add('granny')
  if (g.has('pumpkin') && g.has('candle') && g.is('boo.2')) t.add('boo')
  // nothing to do: the friends who can start a quest
  if (g.flag('gotBag') && !activeQuests(g).length) {
    if (available(g, 'bear')) t.add('pip')
    if (available(g, 'light') && g.done('bear')) t.add('bruno').add('gus')
    if (available(g, 'boo')) t.add('boo')
  }
  if (g.has('fish') && !g.flag('momoFed')) t.add('momo')
  if (g.has('carrot')) t.add('bun')
  if (g.has('glasses')) t.add('hoot')
  if (g.hasTreasure?.(true)) t.add('penny')
  return t
}

// ---------- Coji's answers: lots of ways to say things ----------

const REACT = {
  // after a clue
  help: ['Really? 😮', 'Oh! I see! 💡', 'Hmm... 🤔', 'Wow! 🤩', 'Is that true? 😮', 'Oh, okay! 👌', 'Good to know! 👍', 'Aha! 💡'],
  // after a story or chit-chat
  talk: ['Wow! 🤩', 'Ha ha! 😆', 'Cool! 😎', 'No way! 😲', 'That is funny! 😄', 'So cool! ✨', 'Hee hee! 😄', 'I like that! 👍', 'Really? 😮', 'Amazing! 🌟'],
  // after something sad
  sad: ['Oh no! 😢', 'Poor you! 🥺', 'I am sorry! 😟', 'Do not worry! 🤗', 'I will help! 💪', 'Oh, dear! 😟'],
}
const REPLY = {
  help: [['Yes, really!'], ['Yes! It is true!'], ['I think so!'], ['Good luck, Coji!'], ['You can do it, Coji!'], ['Go and see!'], ['Yes! You are a good helper!']],
  sad: [['Thank you, Coji.', 'You are so kind.'], ['You are a good friend, Coji.'], ['Thank you. I feel better now.'], ['A hug helps. Thank you!']],
}
const GENERIC_EXTRAS = [['Yes! Isn\'t it fun?'], ['Ha ha! You are funny, Coji.'], ['That is how it is on Sunny Island!'], ['Hee hee! I like you, Coji!']]
const THANKS = {
  help: ['Thank you!', 'Thanks a lot!', 'Got it, thanks!', 'Okay, thank you!', 'That helps! Thank you!', 'Good idea! Thanks!', 'I will go and look!', 'Great! I will try that!', 'Now I know! Thanks!', 'Cool! Thanks for the help!', 'I can do it! Thank you!', 'Oh! Thank you so much!'],
  talk: ['Okay!', 'I see!', 'Thank you!', 'Cool!', 'Nice!', 'Oh, okay!', 'Good to know!', 'Ha ha! Okay!', 'Thanks for telling me!'],
  story: ['What a fun story!', 'I like your story!', 'Thanks for telling me!', 'That is so cool!', 'Wow! Thank you!', 'Nice story!', 'Ha ha! I like it!'],
  sad: ['I will help you!', 'Do not be sad!', 'I am here to help!', 'Okay! Be brave!', 'Do not worry!'],
}
const STORY_QS = ['Tell me about you!', 'Tell me something fun!', 'Can you tell me a story?', 'Tell me more about you!']
const SMALL_QS = {
  mood: ['How are you?', 'How do you feel today?', 'How is your day?', 'Are you okay today?'],
  facts: ['Tell me a fun fact!', 'Tell me something cool!', 'Do you know a fun fact?', 'What is special about you?'],
  jokes: ['Tell me a joke!', 'Can you make me laugh?', 'Say something funny!', 'Do you know a joke?'],
  eat: ['What do you eat?', 'What is your favorite food?', 'What do you like to eat?'],
}
const BACK = ['Anything else, Coji?', 'What else?', 'Do you want to ask more?', 'Can I help with something else?', 'What now, Coji?', 'You are welcome! Anything else?']
const COJI_BYE = ['Bye!', 'See you later!', 'Bye-bye!', 'I have to go. Bye!', 'See you soon!', 'Bye for now!', 'Have a nice day!', 'Thanks! Bye!', 'Bye! See you!']
const NPC_BYE = ['Bye, Coji!', 'See you, Coji!', 'Have fun, Coji!', 'Come back soon!', 'Good luck, Coji!', 'See you later!', 'Bye-bye! Have a nice day!']
const MORE_INTROS = ['Hmm, let me think...', 'Oh! I remember now!', 'Wait! I know more!', 'My friend told me this:', 'Hmm! I think...', 'Oh, yes!']

// ---------- the cast ----------

export const CAST = {
  pip: {
    name: 'Captain Pip',
    voice: 1.0,
    // The welcome (with the bag) shows the first time only.
    first: (g) => {
      if (g.flag('gotBag')) return null
      const accept = () =>
        N(['Thank you, Coji!', 'First, find out what Bear likes to eat.', 'Ask people on the island. Tap them to talk!'], null, {
          onShow: () => g.startQuest('bear'),
        })
      const ask = () => {
        if (!available(g, 'bear')) return N(g.done('bear') ? ['You helped the hungry bear!', 'Thank you, Coji. Have fun on Sunny Island!'] : ['You are helping the hungry bear? Great!', 'Good luck, Coji!'])
        return N(['Oh, I have a problem, Coji.', 'A big bear sits on Bear Bridge.', 'He is very hungry. Nobody can cross the bridge!', 'Can you help the bear?'], [
          { text: 'Yes! I can help!', go: accept },
          {
            text: 'A bear? I am scared...',
            go: () =>
              N(["Don't worry. He is a kind bear.", 'He is just very, very hungry.'], [
                { text: 'Okay! I will help!', go: accept },
                { text: 'Will you come with me?', go: () => N(['I must stay with my boat.', 'But you are brave, Coji. You can do it!'], [{ text: 'Okay! I will try!', go: accept }]) },
              ]),
          },
          { text: 'Why is he hungry?', go: () => N(['He ate all his food in the winter.', 'Now his tummy is empty!', 'Can you help him?'], [{ text: 'Yes! Poor bear!', go: accept }, { text: 'I will find food for him!', go: accept }]) },
        ])
      }
      const gift = (hello) =>
        N([hello, 'I like your bear blanket.', 'Here is a bag for you. 🎒'], [
          { text: 'Thank you, Captain Pip!', go: () => N(['You are welcome!', 'There is water, an apple and 3 coins in it.'], null, { then: ask }) },
          { text: 'What is in the bag?', go: () => N(['Water, an apple and 3 coins!', 'Tap the Bag button to look inside.'], null, { then: ask }) },
          { text: 'Can I keep it?', go: () => N(['Yes! It is your bag now.', 'Every explorer needs a bag!'], null, { then: ask }) },
        ], { onShow: () => g.startBag() })
      const name = (lines) => N(lines, [
        { text: 'I am Coji!', go: () => gift('Coji! What a great name!') },
        { text: 'My name is Coji. I am six!', go: () => gift('Six years old? Wow! Hello, Coji!') },
      ])
      return N(['Ahoy! Welcome to Sunny Island! 🏝️', 'I am Captain Pip.'], [
        { text: 'Hello! I am Coji.', go: () => gift('Hello, Coji! Nice to meet you!') },
        { text: 'Where am I?', go: () => name(['You are on Sunny Island!', 'It is a happy island with many friends.', 'What is your name?']) },
        { text: 'Is this your boat?', go: () => name(['Yes! Her name is Sunny Sue.', 'She is fast and strong.', 'And what is your name?']) },
      ])
    },
    greet: () => draw('greet:pip', ['Ahoy, Coji!', 'Ahoy there, Coji!', 'Hello, sailor Coji!', 'Ahoy! A good day for the sea!']),
    chat: { q: 'Tell me about the island.', a: ['Sunny Island has a castle, a village, a farm and a forest.', 'Tap the map 🗺️ button to see it all!'] },
    topics: {
      'bear.0': { q: 'What does Bear like to eat?', a: ['Hmm, I am a sailor, not a bear! Ha ha!'] },
      'bear.1': { q: ['Where can I get honey?', 'Do you have honey?'], a: ['Honey? Not on my boat!'] },
      'bear.2': { q: 'I have honey!', a: ['Great job, Coji!'] },
      'light.0': { q: 'Do you know Grandpa Gus?', a: ['Yes! He keeps the lighthouse.', 'My boat can not sail at night without it!'] },
      'light.1': { q: 'Where can I find a big bulb?', a: ['A big bulb? Hmm...'] },
      'light.2': [{}, { q: 'How can I get coins?', a: ['Find treasures on the island.', 'Penny at the bank swaps them for coins.'], clue: 'shells', own: true }],
      'light.3': { q: 'I have the bulb!', a: ['Hooray!'] },
      'boo.0': { q: 'Do you have a pumpkin?', a: ['On my boat? No!'] },
      'boo.1': { q: 'Do you have a candle?', a: ['I use a lamp on my boat.'] },
      'boo.2': { a: ['Ahoy! Good work, Coji!'] },
      end: { q: 'Look at the lighthouse!', a: ['It is so bright!', 'Now my boat can sail at night.', 'Thank you, Coji. You are a hero!'] },
    },
  },

  finn: {
    name: 'Fisher Finn',
    voice: 0.9,
    greet: (g) => (g.met('finn') ? draw('greet:finn', ['Hi, Coji! The fish are shy today.', 'Hello again! 🎣', 'Shh! Hi, Coji!']) : 'Hi there! I am Fisher Finn. 🎣'),
    specials: (g) => [
      !g.has('fish') && {
        key: 'fish',
        text: draw('q:fish', ['Can I have a fish?', 'May I have a fish, please?', 'Do you have a fish for me?']),
        pri: 6,
        go: () => N(['Sure! Here is a fish. 🐟', 'Momo the cat loves fish!'], null, { onShow: () => g.give('fish') }),
      },
    ],
    chat: { q: 'What are you doing?', a: ['I am fishing!', 'Shh... Do not scare the fish.'] },
    topics: {
      'bear.0': { q: 'Do bears eat fish?', a: ['Some bears do!', 'But this bear does not like fish.'] },
      'bear.1': { q: 'Do you have honey?', a: ['No, I only have fish.'], more: { q: 'How can I get coins?', a: ['Momo the cat has coins!', 'Give Momo a fish. 🐟'], clue: 'momo' } },
      'bear.2': { q: 'I have the honey!', a: ['Go, go, Coji! The bear is waiting.'] },
      'light.0': { q: 'Where is the lighthouse?', a: ['It is the tall red and white tower.'] },
      'light.1': { q: 'Do you have a big bulb?', a: ['A bulb? No, just fish!'] },
      'light.2': { a: ['I have seagull feathers. They are too small!'] },
      'light.3': { q: 'I have the bulb!', a: ['Hurry, Coji!'] },
      'boo.0': { q: 'Do you have a pumpkin?', a: ['I only catch fish!'] },
      'boo.1': { q: 'Do you have a candle?', a: ['No, sorry. Fish do not need candles!'] },
      end: { q: 'Did you see the light?', a: ['Yes! It is so pretty at night!'] },
    },
  },

  momo: {
    name: 'Momo the Cat',
    voice: 1.6,
    animal: true,
    greet: (g) => (g.flag('momoFed') ? draw('greet:momo', ['Purr... Hello, Coji!', 'Meow! My friend Coji!', 'Purr, purr. Hi!']) : 'Meow... I am so hungry. Do you have a fish? 🐟'),
    specials: (g) => [
      g.has('fish') &&
        !g.flag('momoFed') && {
          key: 'givefish',
          text: 'Here is a fish for you!',
          pri: 9,
          go: () =>
            N(['Meow! A fish! Yum, yum, yum!', 'Thank you! I found these under the boat.', 'Here, take 3 coins! 🪙'], null, {
              onShow: () => {
                g.take('fish')
                g.addCoins(3)
                g.setFlag('momoFed')
                g.mood('momo', 'happy')
                g.sfx('happy')
              },
            }),
        },
      g.has('fish') &&
        g.flag('momoFed') && {
          key: 'givefish',
          text: 'Here is another fish!',
          pri: 3,
          go: () => N(['Purr... I am so full now.', 'Thank you, Coji!']),
        },
    ],
    chat: { q: 'Hi, Momo!', a: ['Meow! I like the sun. It is warm.'] },
    topics: {
      'bear.0': { q: 'Momo, what do bears eat?', a: ['Bears eat... not fish!', 'Fish is for cats! Meow!'] },
      'bear.1': (g) => [
        {},
        g.flag('momoFed')
          ? { q: 'Do you have more coins?', a: ['Meow! No more coins.', 'Look for treasures. Shells are on the beach!'], clue: 'shells', own: true }
          : { q: 'I need coins.', a: ['Meow! I have coins.', 'Bring me a fish, and they are yours!'], clue: 'momo', own: true },
      ],
      'bear.2': { q: 'Do you like bears?', a: ['Big bears? Meow! Too big!'] },
      'light.1': { q: 'Did you see a big bulb?', a: ['Meow? I like shiny things!'] },
      'light.2': { a: ['Meow? Let me think...'] },
      'boo.0': { q: 'Did you see pumpkins?', a: ['Meow! Big orange balls?'] },
      'boo.1': { q: 'Did you see a candle?', a: ['Meow? Candles are hot. Not for cats!'] },
      end: { q: 'Do you see the light?', a: ['Purr... The lighthouse is so pretty.'] },
    },
  },

  ben: {
    name: 'Burger Ben',
    voice: 0.85,
    greet: (g) => (g.met('ben') ? draw('greet:ben', ['Hi, Coji! Hungry?', 'Welcome back, Coji! 🍔', 'Hello, my friend! Burger time?']) : 'Welcome to Burger Hut! I am Burger Ben. 🍔'),
    specials: (g) => [{ key: 'shop', text: draw('q:benshop', ['Can I buy some food?', 'I am hungry! Can I buy food?', 'What food do you have?']), pri: 4, go: () => N(['Sure! Take a look!'], null, { onShow: () => g.later(() => g.openShop('ben')) }) }],
    chat: { q: 'What is good here?', a: ['The burger is the best!', 'It gives you lots of energy. ⚡'] },
    topics: {
      'bear.0': { q: 'Do bears eat burgers?', a: ['Ha ha! No, no!', 'Bears do not eat burgers.'] },
      'bear.1': { q: 'Do you have honey?', a: ['No honey here. Just burgers and fries!'] },
      'bear.2': { q: 'I have honey for Bear!', a: ['The bear will be so happy!'] },
      'light.0': { q: 'Where is the lighthouse?', a: ['The lighthouse? I can not see it from here.'] },
      'light.1': { q: 'Do you have a big bulb?', a: ['My lights are small.'] },
      'light.2': [{}, { q: 'How can I get coins?', a: ['Sell apples to Granny Bee.', 'Or swap treasures at the bank!', 'Or work here with me!'], clue: 'shells', own: true }],
      'light.3': { q: 'I have the bulb!', a: ['Go, Coji, go!'] },
      'boo.0': { q: 'Do you have a pumpkin?', a: ['No pumpkin burgers here! Ha ha!'] },
      'boo.1': { q: 'Do you have a candle?', a: ['No candles. Only burgers!'] },
      end: { q: 'The lighthouse is on!', a: ['Hooray! Have a burger to celebrate! Ha ha!'] },
    },
  },

  granny: {
    name: 'Granny Bee',
    voice: 1.15,
    greet: (g) => (g.met('granny') ? draw('greet:granny', ['Hello again, dear!', 'Oh, Coji! Hello, dear!', 'Bzzz! Hello, dear!']) : 'Hello, dear! I am Granny Bee. 🐝'),
    specials: (g) => [{ key: 'shop', text: draw('q:grannyshop', ['Can I see your shop?', 'What do you sell today?', 'Can I buy something?']), pri: 4, go: () => N(['Of course, dear!'], null, { onShow: () => g.later(() => g.openShop('granny')) }) }],
    chat: { q: 'What do you sell?', a: ['I sell honey, carrots and milk.', 'And I buy apples and berries!'] },
    topics: {
      'bear.0': { q: 'What does a bear like to eat?', a: ['Oh, dear! Bears love honey.', 'And I have honey!'], clue: ['honey', 'granny'], own: true },
      'bear.1': (g) => ({
        q: 'Can I have some honey?',
        a: g.coins >= 5 ? ['Yes, dear! One jar is 5 coins.', 'You can buy it in my shop.'] : ['Yes, dear! One jar is 5 coins.'],
        clue: ['granny', 'coins'],
        own: true,
        more: { q: g.coins >= 5 ? 'How can I get more coins?' : 'I do not have 5 coins.', a: ['I buy apples. One apple is one coin.', 'Apple trees grow at the farm.'], clue: 'apples' },
      }),
      'bear.2': { q: 'Thank you for the honey!', a: ['You are welcome, dear.'] },
      'light.0': { q: 'Where is the lighthouse?', a: ['Oh, dear. I do not go there.'] },
      'light.1': { q: 'Do you sell bulbs?', a: ['No, dear. Only food.'] },
      'light.2': { a: ['Let me think, dear...'] },
      'light.3': { q: 'I have the bulb!', a: ['Hurry, dear!'] },
      'boo.0': { q: 'Do you sell pumpkins?', a: ['Not today, dear.'] },
      'boo.1': { q: 'Do you sell candles?', a: ['Yes, dear! A candle is 2 coins.', 'Look in my shop!'], clue: ['candle', 'candleprice'], own: true },
      end: { q: 'Did you see the light?', a: ['What a bright light!', 'Thank you, dear.'] },
    },
  },

  penny: {
    name: 'Penny',
    voice: 1.1,
    greet: (g) => (g.met('penny') ? draw('greet:penny', ['Hello, Coji!', 'Hi, Coji! Any treasures today?', 'Welcome back to the bank!']) : 'Hello! Welcome to the bank. I am Penny. 🏦'),
    specials: (g) => [
      g.hasTreasure() && {
        key: 'swap',
        text: draw('q:swap', ['Can I swap my treasures?', 'I have treasures! Can I swap them?', 'Look at my treasures! Can I swap them?']),
        pri: 7,
        go: () => N([draw('swapyes', ['Yes! Let me see your treasures.', 'Ooh! Treasures! Let me see.', 'Of course! Show me!']), 'Rare things are worth more coins! 💎'], null, { onShow: () => g.later(() => g.openShop('bank')) }),
      },
      !g.hasTreasure() && {
        key: 'where',
        text: draw('q:treasure', ['Where can I find treasures?', 'How do I get coins?', 'What treasures can I find?']),
        pri: 3.95,
        go: () => {
          const tips = shuffle(TREASURE_TIPS.slice()).slice(0, 2).flat()
          return N(['Find treasures on the island!', ...tips, 'Bring them to me. I swap them for coins!'], [
            { text: draw('q:best', ['What is the best treasure?', 'Which one is worth the most?']), go: () => N(['A purple crystal! 💎', 'It is worth 8 coins.', 'Crystals shine at the foot of the mountain.']) },
            { text: draw('thx:help', THANKS.help), go: () => hub(g, 'penny', draw('back', BACK)) },
          ], { onShow: () => g.clue('shells') })
        },
      },
    ],
    chat: { q: 'What is a bank?', a: ['A bank keeps money safe.', 'I swap treasures for coins too!', 'Rare treasures are worth more coins.'] },
    topics: {
      'bear.0': { q: 'What do bears eat?', a: ['Bears? I only know coins! 🪙'] },
      'bear.1': [{}, { q: 'I need coins for honey.', a: ['Find treasures on the island!', 'Bring them to me. I swap them for coins!'], clue: 'shells', own: true }],
      'bear.2': { q: 'Do you like bears?', a: ['Yes, from far away! Ha ha.'] },
      'light.0': { q: 'Where is the lighthouse?', a: ['I have never been there.'] },
      'light.1': { q: 'Do you have a big bulb?', a: ['No. Only coins!'] },
      'light.2': [{}, { q: 'I need 8 coins.', a: ['Find treasures!', 'A crystal 💎 is 8 coins all by itself!'], clue: 'shells', own: true }],
      'light.3': { q: 'I have the bulb!', a: ['Good job!'] },
      'boo.0': { q: 'Where are pumpkins?', a: ['Pumpkins? Not in my bank!'] },
      'boo.1': { q: 'I need coins for a candle.', a: ['Coins? Find treasures!'] },
      end: { q: 'The light is on!', a: ['The island is safe now.', 'Good job, Coji!'] },
    },
  },

  tina: {
    name: 'Tina',
    voice: 1.3,
    greet: (g) => (g.met('tina') ? draw('greet:tina', ['Hi, Coji!', 'Hello again! Look at my new toys!', 'Hi, Coji! Do you want to play?']) : 'Hi! I am Tina. Welcome to my Toy Shop! 🧸'),
    specials: (g) => {
      if (!g.is('light.2')) return []
      return [
        g.coins >= 8 && {
          key: 'buybulb',
          text: 'Here are 8 coins!',
          pri: 9,
          go: () =>
            N(['Thank you!', 'Here is the Super Bright Bulb! 💡'], null, {
              onShow: () => {
                g.spend(8)
                g.give('bulb')
                g.sfx('happy')
              },
            }),
        },
        g.has('feather') && {
          key: 'tradebulb',
          text: 'I have a feather for you!',
          pri: 9,
          go: () =>
            N(['Oh! A soft owl feather!', 'It is perfect for my toy owl.', 'Here is the Super Bright Bulb! 💡'], null, {
              onShow: () => {
                g.take('feather')
                g.give('bulb')
                g.sfx('happy')
              },
            }),
        },
      ]
    },
    chat: { q: 'What toys do you have?', a: ['Balls, boats and teddy bears!', 'I like your bear blanket, Coji!'] },
    topics: {
      'bear.0': { q: 'Do you know about the bear?', a: ['The big bear? He is hungry.'] },
      'bear.1': { q: 'Where can I get honey?', a: ['Not in my Toy Shop!'] },
      'bear.2': { q: 'I have honey!', a: ['Yay!'] },
      'light.0': { q: 'Do you know Grandpa Gus?', a: ['Grandpa Gus? He is so nice.'] },
      'light.1': {
        q: ['Do you have a big light bulb?', 'Do you have a big bulb?'],
        a: ['Yes! Look in my window!', 'It is the Super Bright Bulb! 💡', 'It costs 8 coins.', 'Or... bring me a soft feather for my toy owl.'],
        clue: ['toyshop', 'price'],
        own: true,
      },
      'light.2': [
        {
          q: 'How can I get the bulb?',
          a: ['Bring me 8 coins.', 'Or bring me a soft feather!'],
          clue: 'price',
          own: true,
          more: { q: 'Where can I find a feather?', a: ['Owls have soft feathers.', 'Hoot lives in the forest.'], clue: 'hoot' },
        },
      ],
      'light.3': { q: 'Thank you for the bulb!', a: ['You are welcome!'] },
      'boo.0': { q: 'Do you have a pumpkin?', a: ['A toy pumpkin? No...'] },
      'boo.1': { q: 'Do you have a candle?', a: ['Birthday candles are too small!'] },
      end: { q: 'Did you see the lighthouse?', a: ['Yes! It looks like a big star!'] },
    },
  },

  leo: {
    name: 'Leo',
    voice: 1.45,
    greet: (g) => (g.met('leo') ? draw('greet:leo', ['Hi, Coji!', 'Coji! Do you want to play?', 'Hey, Coji! Look, I can hop on one foot!']) : 'Hi! I am Leo. Are you new here?'),
    specials: (g) => [
      !g.flag('leoWater') && {
        key: 'water',
        text: 'Can I have some water?',
        pri: 3,
        go: () =>
          N(['Sure! Take my water bottle. 💧', 'You can fill it at the well.'], null, {
            onShow: () => {
              g.give('water')
              g.setFlag('leoWater')
            },
          }),
      },
    ],
    chat: { q: 'Do you want to play?', a: ['Yes! Let us play tag later!'] },
    topics: {
      'bear.0': { q: 'What do bears eat?', a: ['My book says bears eat fish and berries.'] },
      'bear.1': [
        {},
        { q: 'How can I get coins?', a: ['I sell apples to Granny Bee.', 'Apple trees grow at the farm!'], clue: 'apples', own: true, more: { q: 'Where is the farm?', a: ['Go west from the village.', 'Look for the red barn!'] } },
      ],
      'bear.2': { q: 'Do you want to see the bear?', a: ['No way! He is too big!', 'You are so brave, Coji!'] },
      'light.0': { q: 'Where is the lighthouse?', a: ['I went there one time with my dad!'] },
      'light.1': { q: 'Where can I get a big bulb?', a: ['I saw lots of shiny things today!'] },
      'light.2': { a: ['Birds have feathers! Tweet tweet!'] },
      'light.3': { q: 'I have the bulb!', a: ['Run, Coji, run!'] },
      'boo.0': { q: 'Where can I find a pumpkin?', a: ['A pumpkin? You are so brave, Coji!'] },
      'boo.1': { q: 'Where can I find a candle?', a: ['I had a candle on my birthday cake! 🎂'] },
      end: { q: 'Look at the light!', a: ['It is so cool!', 'Now let us play tag!'] },
    },
  },

  bun: {
    name: 'Bun the Bunny',
    voice: 1.7,
    animal: true,
    greet: (g) => (g.has('carrot') ? 'Hop, hop! I smell a carrot! 🥕' : g.flag('bunFed') ? draw('greet:bun', ['Hop! Hi, Coji!', 'Hop, hop! My friend!', 'Wiggle, wiggle! Hello!']) : 'Hop, hop! I am Bun. Do you have a carrot? 🥕'),
    specials: (g) => [
      g.has('carrot') && {
        key: 'carrot',
        text: 'Here is a carrot!',
        pri: 9,
        go: () => {
          const lines = ['A carrot! Thank you, thank you!', 'Here are some berries for you! 🫐']
          const tell = !g.has('glasses') && !g.flag('hootHappy')
          if (tell) lines.push('And... I saw shiny glasses by the pond!')
          return N(lines, null, {
            onShow: () => {
              g.take('carrot')
              g.give('berries', 3)
              g.setFlag('bunFed')
              g.mood('bun', 'happy')
              g.sfx('happy')
              if (tell) g.clue('pond', 'light')
            },
          })
        },
      },
    ],
    chat: { q: 'Hi, Bun!', a: ['Hop, hop! I like the farm.', 'Carrots grow here!'] },
    topics: {
      'bear.0': { q: 'Bun, what do bears eat?', a: ['Not carrots!', 'Carrots are for bunnies!'] },
      'bear.1': { q: 'Do you like honey?', a: ['No, I like carrots!'] },
      'bear.2': { q: 'I have honey for Bear!', a: ['Hop! Go, go, go!'] },
      'light.0': { q: 'Where is the lighthouse?', a: ['The lighthouse? Too far for my little feet!'] },
      'light.1': { q: 'Did you see a big bulb?', a: ['No... I only look for carrots!'] },
      'light.2': (g) =>
        g.flag('bunFed') || g.has('glasses') || g.flag('hootHappy')
          ? {}
          : { q: 'Did you see any glasses?', a: ['Glasses? Hmm...', 'Give me a carrot, and I will tell you!'], own: true },
      'boo.0': { q: 'Did you see pumpkins?', a: ['Hop! Big and orange? Yes!'] },
      'boo.1': { q: 'Did you see a candle?', a: ['No... I only look for carrots!'] },
      end: { q: 'Did you see the light?', a: ['Hop, hop, hooray!'] },
    },
  },

  hoot: {
    name: 'Hoot the Owl',
    voice: 0.75,
    animal: true,
    greet: (g) => (g.flag('hootHappy') ? draw('greet:hoot', ['Who-who! Hello, Coji!', 'Who-who! I can see you now!', 'Hoo-hoo! My friend Coji!']) : 'Who-who! Who is there? I can not see well...'),
    specials: (g) => [
      g.has('glasses') && {
        key: 'glasses',
        text: 'Are these your glasses?',
        pri: 9,
        go: () =>
          N(['My glasses! Now I can see!', 'Oh! You are Coji with the bear blanket!', 'Thank you! Here is a soft feather 🪶 and 2 coins.'], null, {
            onShow: () => {
              g.take('glasses')
              g.give('feather')
              g.addCoins(2)
              g.setFlag('hootHappy')
              g.mood('hoot', 'happy')
              g.sfx('happy')
            },
          }),
      },
      !g.has('glasses') &&
        !g.flag('hootHappy') &&
        !g.is('light.2') && {
          key: 'okay',
          text: 'Are you okay, Hoot?',
          pri: 2,
          go: () =>
            N(['I lost my glasses.', 'I can not see well...', 'I think I was by the pond.'], null, {
              onShow: () => {
                g.setFlag('knowGlasses')
                g.clue('glasses', 'light')
              },
            }),
        },
    ],
    chat: { q: 'What do owls do?', a: ['Owls sleep in the day.', 'At night, we fly and look around. Who-who!'] },
    topics: {
      'bear.0': {
        q: 'Hoot, what does Bear like?',
        a: ['Who-who! I know!', 'Bear loves honey!'],
        clue: 'honey',
        own: true,
        more: { q: 'Where can I get honey?', a: ['Do not take it from the bees!', 'Granny Bee has honey at the market.'], clue: 'granny' },
      },
      'bear.1': { q: 'Where can I get honey?', a: ['Do not take it from the bees! Who-who!'], more: { q: 'I need coins.', a: ['Treasures are like coins.', 'Take them to the bank!'], clue: 'shells' } },
      'bear.2': { q: 'Where is the bear?', a: ['Who-who! I see him from my tree!'] },
      'light.0': { q: 'Where is the lighthouse?', a: ['Who-who!'] },
      'light.1': (g) =>
        g.flag('hootHappy')
          ? { q: 'Where can I find a big bulb?', a: ['I can see far now!', 'There is a big bulb in the Toy Shop window.'], clue: 'toyshop', own: true }
          : { q: 'Where can I find a big bulb?', a: ['I can not see well. I lost my glasses...'] },
      'light.2': (g) =>
        g.flag('hootHappy')
          ? { q: 'Thank you for the feather!', a: ['Who-who! Take it to Tina!'], own: true }
          : {
              q: 'Can I have a feather?',
              a: ['Who-who... I lost my glasses.', 'I can not see!', 'Find my glasses, and I will give you a feather.'],
              clue: 'glasses',
              own: true,
              mood: 'sad',
              more: { q: 'Where did you lose them?', a: ['I was by the pond...', 'Then I flew home.'], clue: 'pond' },
            },
      'light.3': { q: 'I have the bulb!', a: ['Who-who! Go, Coji!'] },
      'boo.0': { q: 'Where can I find a pumpkin?', a: ['Who-who! I fly over the graveyard at night.'] },
      'boo.1': { q: 'Where can I find a candle?', a: ['A candle? Owls see in the dark. Who-who!'] },
      end: { q: 'Can you see the light?', a: ['Who-who! What a bright light!'] },
    },
  },

  bruno: {
    name: 'Bruno the Bear',
    voice: 0.6,
    animal: true,
    greet: (g) => (g.done('bear') ? draw('greet:bruno', ['Hello, my friend Coji!', 'Coji! Big bear hug! 🤗', 'Hello! My tummy is happy!']) : 'Grrr... My tummy is empty...'),
    specials: (g) => [
      g.has('honey') &&
        !g.done('bear') && {
          key: 'honey',
          text: 'Here is some honey for you!',
          pri: 9,
          go: () => {
            const accept = () =>
              N(['Thank you, Coji! You are a good friend.', 'Here is a big bear hug! 🤗'], null, {
                onShow: () => g.startQuest('light'),
              })
            const offer = () =>
              N(['Coji, can you help one more friend?', 'Grandpa Gus lives in the lighthouse.', 'His light is broken. He is so sad.', 'Ships can not find the island at night!'], [
                { text: 'I will help Grandpa Gus!', go: accept },
                {
                  text: 'Where is the lighthouse?',
                  go: () => N(['Cross my bridge to the little island.', 'It is the tall red and white tower!'], [{ text: 'Okay! I will go!', go: accept }]),
                },
                { text: 'Maybe later.', go: () => N(['Okay. Grandpa Gus will wait.', 'Come back soon!']) },
              ])
            const next = () =>
              available(g, 'light') ? offer() : g.at('light') >= 0 ? N(['Now you can cross my bridge!', 'Grandpa Gus is waiting for you. 🗼']) : N(['Now you can cross my bridge!', 'Have fun, Coji!'])
            return N(['Honey! Yum, yum, yum!', 'Mmm... So sweet!', 'Thank you, Coji! My tummy is happy now.', 'I will move. You can cross the bridge!'], [
              { text: 'You are welcome, Bear!', go: () => N(['You are so kind, Coji.'], null, { then: next }) },
              { text: 'Can I have a hug?', go: () => N(['A big bear hug! 🤗', 'Squeeeeze!'], null, { then: next }) },
              { text: 'Was it yummy?', go: () => N(['Yummy, yummy, yummy!', 'The best honey on the island!'], null, { then: next }) },
            ], {
              onShow: () => {
                g.take('honey')
                g.completeQuest('bear')
                g.mood('bruno', 'happy')
                g.sfx('happy')
              },
            })
          },
        },
    ],
    chat: { q: 'Hi, Bear!', a: ['Grrr... Hello...'] },
    topics: {
      'bear.0': {
        q: 'Hi, Bear! Are you okay?',
        a: ['Grrr... I am so hungry...', 'My tummy is empty.'],
        own: true,
        mood: 'sad',
        more: {
          q: 'What do you want to eat?',
          a: ['Something sweet...', 'Something yummy...', 'Made by bees...'],
          clue: 'sweet',
          more: { q: 'Is it honey?', a: ['Yes! Honey! I want honey!'], clue: 'honey' },
        },
      },
      'bear.1': { q: 'I will get honey for you!', a: ['Honey... yes... please hurry...'], mood: 'sad' },
      'bear.2': { q: 'Are you still hungry?', a: ['Yes... so hungry...'], mood: 'sad', own: true },
      'light.0': { q: 'Where is the lighthouse?', a: ['Grandpa Gus is my friend.'] },
      'light.1': { q: 'Where can I find a bulb?', a: ['Hmm. Bears do not use bulbs.'] },
      'light.2': { a: ['No feathers here. I have fur! Ha ha!'] },
      'light.3': { q: 'I have the bulb!', a: ['Go, go! Grandpa Gus is waiting!'] },
      'boo.0': { q: 'Do you like pumpkins?', a: ['Yum! I like pumpkins.'] },
      'boo.1': { q: 'Do you have a candle?', a: ['A bear with a candle? Ha ha! No.'] },
      end: { q: 'How is your tummy?', a: ['Happy and full!', 'Thank you for the honey, Coji!'] },
    },
  },

  gus: {
    name: 'Grandpa Gus',
    voice: 0.8,
    // Meeting Gus is the first step of the lighthouse quest (and starts it, if nobody told Coji yet).
    first: (g) => {
      if (!(available(g, 'light') || g.is('light.0'))) return null
      const told = () => {
        if (g.at('light') < 0) g.startQuest('light', 1)
        else g.advance('light')
        g.clue('lamp', 'light')
      }
      const help = () =>
        N(['I need a new bulb.', 'A big, bright one!', 'Can you find one for me?'], [
          { text: 'Yes! I will find a bulb!', go: () => N(['Thank you, Coji!', 'Ask in the village. Maybe a shop has one.'], null, { onShow: told }) },
          { text: 'I will try my best!', go: () => N(['Thank you, Coji!', 'Ask in the village. Maybe a shop has one.'], null, { onShow: told }) },
        ])
      return N(['Oh! Hello, little one. Who are you?'], [
        {
          text: g.done('bear') ? 'I am Coji. Bear sent me!' : 'I am Coji!',
          go: () =>
            N(['Nice to meet you, Coji. I am Grandpa Gus.', 'Look at my lighthouse. The light is off.', 'The big bulb is broken!'], [
              { text: 'Can I help you?', go: help },
              { text: 'Oh no! What can we do?', go: help },
            ]),
        },
        {
          text: 'Why is it so dark here?',
          go: () =>
            N(['Hmm, you see it too.', 'I am Grandpa Gus. This is my lighthouse.', 'The big bulb is broken, so it is dark.'], [
              { text: 'Can I help you?', go: help },
              { text: 'What is a lighthouse for?', go: () => N(['A lighthouse shines at night.', 'Ships see the light and stay safe.'], [{ text: 'I can help!', go: help }]) },
            ]),
        },
      ])
    },
    greet: (g) => (g.done('light') ? 'Hello, my lighthouse hero!' : 'Hello, Coji!'),
    specials: (g) => [
      g.has('bulb') && {
        key: 'bulb',
        text: 'Here is the new bulb!',
        pri: 9,
        go: () =>
          N(['Oh, Coji! The Super Bright Bulb!', "Let's put it in.", 'One... two... three!'], null, {
            onShow: () => {
              g.take('bulb')
              g.later(() => g.finale())
            },
          }),
      },
    ],
    chat: { q: 'What do you do here?', a: ['I keep the light on.', 'The light helps ships at night.'] },
    topics: {
      'light.1': { q: 'Where can I find a big bulb?', a: ['Hmm... I live far from the shops.'] },
      'light.2': [{ q: 'Tina has a bulb!', a: ['Wonderful!', 'Please bring it to me.'], own: true }, {}],
      'light.3': { q: 'I am back!', a: ['Do you have the bulb?'], own: true },
      'boo.0': { q: 'Do you have a pumpkin?', a: ['No, I only have a lighthouse!'] },
      'boo.1': { q: 'Do you have a candle?', a: ['My light is a big bulb now!'] },
      end: { q: 'Look at the light!', a: ['Look, Coji! The light shines on the sea!', 'Thank you! You are a lighthouse hero!'] },
    },
  },
}

// ---------- building the conversation ----------

// Every topic Coji can ask `id` about now: one or more per active quest, the nearest step first.
function topicsFor(g, id) {
  const C = CAST[id]
  const out = []
  if (!C.topics) return out
  for (const q of byNearest(g)) {
    const key = `${q}.${g.at(q)}`
    let tp = C.topics[key]
    if (typeof tp === 'function') tp = tp(g)
    // nothing written for this step: just ask about it
    for (const t of [].concat(tp || {})) if (t) out.push({ tp: t, q, key })
  }
  return out
}
function topicQ(g, tp, q) {
  if (tp.q) return Array.isArray(tp.q) ? draw('tq:' + tp.q[0], tp.q) : tp.q
  const S = stepInfo(g, q)
  return draw('stepq:' + (S ? S.key + (S.sub || '') : q), S?.qs || ['Can you help me?'])
}

function back(g, id) {
  return () => hub(g, id, CAST[id].animal ? draw('back:animal', ['Anything else?', 'What else?', 'Anything more?']) : draw('back', BACK))
}
// Coji reacts ("Wow!"), the character answers, then Coji says thanks and the talk goes on.
function reactChoice(g, id, tone) {
  const C = CAST[id]
  const reply = tone === 'talk' ? draw('extras:' + id, [...(C.extras || []), ...GENERIC_EXTRAS]) : draw('reply:' + tone, REPLY[tone])
  return {
    text: draw('react:' + tone, REACT[tone]),
    go: () => N(reply, [{ text: draw('thx:' + (tone === 'help' ? 'help' : 'talk'), THANKS[tone === 'help' ? 'help' : 'talk']), go: back(g, id) }]),
  }
}
function thanksChoice(g, id, tone) {
  return { text: draw('thx:' + tone, THANKS[tone]), go: back(g, id) }
}

// The answer to a quest question: the character's own words, then a clue that fits the distance.
function topicNode(g, id, tp, q) {
  const say = [...(tp.a || [])]
  const clues = [].concat(tp.clue || [])
  const h = !tp.own && q ? hint(g, q) : null
  if (h) {
    say.push(...h.a)
    clues.push(...h.clue)
  }
  if (!say.length) say.push('Hmm...')
  const tone = tp.mood === 'sad' ? 'sad' : h || clues.length ? 'help' : 'talk'
  const choices = []
  if (h && h.level < Math.min(2, h.base + 1)) choices.push({ text: draw('moreq:' + h.S.key, [...(h.S.more || []), ...MORE_QS]), go: () => moreNode(g, id, q, h.level + 1) })
  if (tp.more) choices.push({ text: tp.more.q, go: () => topicNode(g, id, { own: true, ...tp.more }, q) })
  choices.push(reactChoice(g, id, tone))
  choices.push(thanksChoice(g, id, tone))
  if (choices.length > 3) choices.splice(choices.length - 2, 1)
  return N(say, choices, { onShow: () => clues.forEach((c) => g.clue(c, q)) })
}
// "Tell me more!": a better clue, but far away never the best one.
function moreNode(g, id, q, lv) {
  const h = hint(g, q, lv)
  if (!h) return back(g, id)()
  const choices = []
  if (h.level < Math.min(2, h.base + 1)) choices.push({ text: draw('moreq:' + h.S.key, [...(h.S.more || []), ...MORE_QS]), go: () => moreNode(g, id, q, h.level + 1) })
  choices.push(reactChoice(g, id, 'help'))
  choices.push(thanksChoice(g, id, 'help'))
  if (choices.length > 3) choices.splice(choices.length - 2, 1)
  return N([draw('moreintro', MORE_INTROS), ...h.a], choices, { onShow: () => h.clue.forEach((c) => g.clue(c, q)) })
}
// Chit-chat, stories and small talk: no clues. Sometimes the character asks Coji something back.
function talkNode(g, id, lines, endTone = 'talk') {
  const C = CAST[id]
  const asks = typeof C.asks === 'function' ? C.asks(g) : C.asks
  if (asks?.length && Math.random() < 0.35) {
    const a = draw('ask:' + id, asks)
    return N([...lines, a.q], a.opts.map(([text, reply]) => ({ text, go: () => N(reply, [reactChoice(g, id, 'talk'), thanksChoice(g, id, 'talk')]) })))
  }
  return N(lines, [reactChoice(g, id, 'talk'), thanksChoice(g, id, endTone)])
}

export function hub(g, id, line) {
  const C = CAST[id]
  const opts = []
  for (const s of C.specials ? C.specials(g) : []) if (s) opts.push({ key: 'sp:' + (s.key || s.text), ...s })
  const of = offerFor(g, id)
  if (of) opts.push({ key: 'offer:' + of.q, text: of.text, pri: 6, go: () => offerNode(g, of, back(g, id)) })
  const tps = topicsFor(g, id)
  tps.forEach(({ tp, q, key }, i) => opts.push({ key: 'tp:' + key + ':' + i, text: topicQ(g, tp, q), pri: i === 0 ? 5 : 3.9 - i * 0.01, go: () => topicNode(g, id, tp, q) }))
  if (!tps.length) {
    const end = allDone(g) && C.topics?.end
    const r = !end && !of && rumor(g)
    if (end) opts.push({ key: 'end', text: end.q, pri: 4.2, go: () => topicNode(g, id, { ...end, own: true }) })
    else if (r) opts.push({ key: 'rumor', text: draw('q:rumor', RUMOR_QS), pri: 4.2, go: () => N(r.a, [thanksChoice(g, id, 'help')]) })
    const chat = C.chats ? draw('chat:' + id, C.chats) : C.chat
    if (chat) opts.push({ key: 'chat', text: chat.q, pri: 2, go: () => talkNode(g, id, chat.a) })
  }
  if (C.story) opts.push({ key: 'story', text: draw('q:story', STORY_QS), pri: 3.5, go: () => talkNode(g, id, C.story, 'story') })
  const talks = typeof C.talks === 'function' ? C.talks(g) : C.talks
  if (talks) {
    const kind = draw('smallkind:' + id, Object.keys(talks))
    opts.push({ key: 'small', text: draw('q:small:' + kind, SMALL_QS[kind]), pri: 3, go: () => talkNode(g, id, draw(`small:${id}:${kind}`, talks[kind])) })
  }
  // Something already asked in this talk moves down, so other choices get a turn.
  const asked = g.asked()
  for (const o of opts) if (asked.has(o.key)) o.pri = (o.pri ?? 3) - 4
  opts.sort((a, b) => (b.pri ?? 3) - (a.pri ?? 3))
  const picked = opts.slice(0, 2).map((o) => ({
    text: o.text,
    go: () => {
      asked.add(o.key)
      return o.go()
    },
  }))
  picked.push({ text: draw('q:bye', COJI_BYE), go: () => N(C.bye ? C.bye(g) : C.animal ? draw('bye:animal', ['Bye-bye, Coji!', 'See you, Coji!', 'Bye! Come back soon!']) : draw('bye', NPC_BYE), null, { auto: true }) })
  return N(line, picked)
}

// Where a conversation starts.
export function talk(g, id) {
  const C = CAST[id]
  // Pip's welcome, Gus's broken lamp, Boo's lantern, Sir Lance's "Halt!": each decides if it is time.
  if (C.first) {
    const n = C.first(g)
    if (n) return n
  }
  if (C.greetNode) return C.greetNode(g)
  return hub(g, id, C.greet(g))
}

// ---------- jobs ----------

const JOB_QS = ['Can I work here? 💼', 'Do you need a helper? 💼', 'Can I help you work? 💼']
const job = (id, ask, yes) => (g) =>
  g.jobReady(id)
    ? { key: 'job', text: ask || draw('q:job', JOB_QS), pri: 4.5, go: () => N(yes, null, { onShow: () => g.later(() => g.openJob(id)) }) }
    : { key: 'job', text: ask || draw('q:job', JOB_QS), pri: 1, go: () => N(['Thank you! We are all done for now.', 'Come back a little later!']) }

// ---------- new friends ----------

Object.assign(CAST, {
  coco: {
    name: 'Coco',
    voice: 1.35,
    greet: (g) => (g.met('coco') ? draw('greet:coco', ['Hi, Coji! Ice cream time? 🍦', 'Hello again, Coji!', 'Hi! It is a hot day. Ice cream? 🍦']) : 'Hello! I am Coco. I sell ice cream! 🍦'),
    specials: (g) => [job('icecream', null, ['Yes! Help me scoop ice cream.', 'Read the order. Tap the right scoops!', 'One coin for each right order.'])(g)],
    chat: { q: 'What flavors do you have?', a: ['Pink strawberry, brown chocolate,', 'white vanilla, green mint and yellow lemon!'] },
    topics: {
      'bear.0': { q: 'What do bears like?', a: ['Bears love sweet things!', 'Like ice cream!'] },
      'bear.1': { q: 'Where can I get honey?', a: ['Not here! Only ice cream.'], more: { q: 'I need coins.', a: ['You can work here!', 'I pay one coin for each right order.'] } },
      'bear.2': { q: 'I have honey for Bear!', a: ['Yay!'] },
      'light.0': { q: 'Where is the lighthouse?', a: ['I can see it from my beach!'] },
      'light.1': { q: 'Where can I find a big bulb?', a: ['A bulb? Hmm...'] },
      'light.2': [{}, { q: 'How can I get coins?', a: ['Work here! Scoop ice cream for coins.', 'Or swap treasures at the bank.'], clue: 'shells', own: true }],
      'light.3': { q: 'I have the bulb!', a: ['Go, go, Coji!'] },
      'boo.0': { q: 'Do you have pumpkins?', a: ['Pumpkin ice cream? No...'] },
      'boo.1': { q: 'Do you have a candle?', a: ['No, only ice cream!'] },
      'boo.2': { a: ['Spooky and fun!'] },
      end: { q: 'Can I have ice cream?', a: ['Ha ha! Work with me and earn coins first!'] },
    },
  },
  max: {
    name: 'Max the Mailman',
    voice: 0.95,
    greet: (g) => (g.met('max') ? draw('greet:max', ['Hi, Coji! Any mail today?', 'Hello, Coji! My bag is so full!', 'Hi! Special delivery: a big hello!']) : 'Hello! I am Max. I bring the mail! 📮'),
    specials: (g) => [job('post', null, ['Yes! Help me sort the letters.', 'Letters come from all over the world.', 'Read the address. Put each letter in the right country box!', 'One coin for each right letter.'])(g)],
    chat: { q: 'What do you do?', a: ['I take letters to everyone on the island!', 'I walk a lot. My legs are strong!'] },
    topics: {
      'bear.0': { q: 'What do bears eat?', a: ['I took a letter to the bear once!', 'It smelled sweet!'] },
      'bear.1': [{}, { q: 'Where can I get coins?', a: ['Work here! Sort letters for coins.', 'Or find treasures for the bank.'], clue: 'shells', own: true }],
      'bear.2': { q: 'Where is the bear?', a: ['A bear? I do not take mail to bears! Ha ha.'] },
      'light.0': { q: 'Where is the lighthouse?', a: ['I have a letter for Grandpa Gus!'] },
      'light.1': { q: 'Where can I find a big bulb?', a: ['I took a big box to a shop.', 'It said BULB on it!'] },
      'light.2': { a: ['I find lots of letters, but no feathers.'] },
      'light.3': { q: 'I have the bulb!', a: ['Hurry!'] },
      'boo.0': { q: 'Where are the pumpkins?', a: ['Pumpkins? Brr! I do not go to spooky places!'] },
      'boo.1': { q: 'Who has candles?', a: ['I took a box of candles to a shop!'] },
      end: { q: 'Is there mail for me?', a: ['Yes! A thank-you card from Grandpa Gus!'] },
    },
  },
  kim: {
    name: 'Teacher Kim',
    voice: 1.1,
    greet: (g) => (g.met('kim') ? draw('greet:kim', ['Hello, Coji! Ready to read?', 'Hi, Coji! Did you read today?', 'Good day, Coji! 📚']) : 'Hello! I am Teacher Kim. Welcome to my school! 🏫'),
    specials: (g) => [job('school', draw('q:kimjob', ['Can I help you? 💼', 'Can I check words? 💼', 'Do you need a helper? 💼']), ['Yes! Help me check words.', 'Look at the picture. Tap the right word!', 'One coin for each right word.'])(g)],
    chat: { q: 'What do you teach?', a: ['Reading, writing and math!', 'And I read lots of stories.'] },
    topics: {
      'bear.0': { q: 'What do bears eat?', a: ['Bears eat fish and berries.'] },
      'bear.1': { q: 'Where can I get honey?', a: ['H-O-N-E-Y, honey!'], more: { q: 'I need coins.', a: ['Help me here! I pay one coin for each right word.'] } },
      'bear.2': { q: 'Where is the bear?', a: ['B-E-A-R, bear!'] },
      'light.0': { q: 'Where is the lighthouse?', a: ['Look east! Can you see a tall tower?'] },
      'light.1': { q: 'Where can I find a big bulb?', a: ['B-U-L-B, bulb!'] },
      'light.2': { a: ['F-E-A-T-H-E-R, feather!'] },
      'light.3': { q: 'I have the bulb!', a: ['Wonderful! Go, go!'] },
      'boo.0': { q: 'Where can I find a pumpkin?', a: ['P-U-M-P-K-I-N!'] },
      'boo.1': { q: 'Where can I find a candle?', a: ['C-A-N-D-L-E!'] },
      'boo.2': { q: 'I have a pumpkin and a candle!', a: ['Wonderful, Coji!'], clue: 'lantern' },
      end: { q: 'Can I learn more words?', a: ['Yes! Help me check words for coins.'] },
    },
  },
  lance: {
    name: 'Sir Lance',
    voice: 0.85,
    first: (g) => {
      if (g.met('lance')) return null
      const meet = () =>
        N(['Hello, Coji. I am Sir Lance, the King\'s knight.', 'I guard the castle. ⚔️'], [
          { text: 'Can I see the King?', go: () => N(['Not today, Coji.', 'The King is very busy.', 'Maybe one day he will need your help!']) },
          { text: 'Wow! A real knight!', go: () => N(['Yes! I keep the castle safe.', 'Look up! The King waves from his balcony.']) },
        ])
      return N(['Halt! Who goes there? 🛡️'], [
        { text: 'I am Coji!', go: meet },
        { text: 'Hello! My name is Coji.', go: meet },
      ])
    },
    greet: () => draw('greet:lance', ['Hello, Coji! Stand tall! 🛡️', 'Good day, brave Coji! ⚔️', 'Halt! Oh, it is you, Coji. Hello!']),
    chat: { q: 'Can I see the King?', a: ['Not today, Coji. The King is very busy.', 'Maybe one day he will need your help!'] },
    topics: {
      'bear.0': { q: 'What do bears eat?', a: ['I am not scared of bears!'] },
      'bear.1': { q: 'Where can I get honey?', a: ['Honey? Knights eat bread.'] },
      'bear.2': { q: 'Where is Bear Bridge?', a: ['A brave knight knows the way!'] },
      'light.0': { q: 'Where is the lighthouse?', a: ['I can see it from the castle wall.'] },
      'light.1': { q: 'Where can I find a big bulb?', a: ['A knight does not need bulbs!'] },
      'light.2': [{}, { q: 'How can I get coins?', a: ['Work hard, like a knight!', 'Jobs pay coins: burgers, ice cream, mail, and school.'], own: true }],
      'light.3': { q: 'I have the bulb!', a: ['Brave work, Coji!'] },
      'boo.0': { q: 'Are you scared of ghosts?', a: ['A knight is never scared!', '...Well, a little.'] },
      'boo.1': { q: 'Where can I find a candle?', a: ['The castle has many candles, but I must guard the gate.'] },
      'boo.2': { q: 'I have a pumpkin and a candle!', a: ['Take them to Boo, brave Coji!'], own: true },
      end: { q: 'Can I see the King now?', a: ['Not yet. Soon, Coji. Soon!', 'The King has a big job for a hero.'] },
    },
  },
  boo: {
    name: 'Boo the Ghost',
    voice: 1.55,
    animal: true,
    first: (g) => {
      if (!available(g, 'boo')) return null
      const yes = () =>
        N(['Yay! Thank you, Coji!', 'I need a pumpkin and a candle.', 'Then I can make a pumpkin lantern!'], g.has('pumpkin') && g.has('candle') ? [{ text: 'I have them here!', go: () => booLantern(g) }] : null, {
          onShow: () => g.startQuest('boo'),
        })
      return N(['Boo! Hee hee. Did I scare you?'], [
        {
          text: 'A little!',
          go: () =>
            N(['Sorry! I am Boo. I am a little ghost.', 'But I am scared of the dark! 😢', 'I want a pumpkin lantern. Can you help me?'], [
              { text: 'Yes! I will help you!', go: yes },
              { text: 'A ghost scared of the dark?', go: () => N(['Yes... it is so dark here at night!', 'Please help me?'], [{ text: 'Okay! I will help!', go: yes }]) },
            ]),
        },
        {
          text: 'No! You are cute!',
          go: () =>
            N(['Hee hee! Thank you! I am Boo.', 'But I am scared of the dark! 😢', 'I want a pumpkin lantern. Can you help me?'], [
              { text: 'Yes! I will help you!', go: yes },
              { text: 'Sure, Boo!', go: yes },
            ]),
        },
      ])
    },
    greet: (g) =>
      g.done('boo')
        ? draw('greet:boodone', ['Boo-hoo-ray! My lantern is so bright!', 'Boo! I am not scared now! Hee hee!'])
        : g.at('boo') >= 0
          ? g.met('boo')
            ? 'Boo! Did you find them?'
            : 'Boo! Hee hee. You came to help me? Yay!'
          : 'Boo! Hee hee. Hello!',
    bye: () => draw('bye:boo', ['Bye-bye! Boo!', 'Boo! See you soon!', 'Hee hee! Bye, Coji!']),
    specials: (g) => [
      g.has('pumpkin') &&
        g.has('candle') &&
        !g.done('boo') &&
        g.at('boo') >= 0 && {
          key: 'lantern',
          text: 'Here is a pumpkin and a candle!',
          pri: 9,
          go: () => booLantern(g),
        },
    ],
    chat: { q: 'What do ghosts do?', a: ['We float and say BOO!', 'And we play hide and seek. Hee hee!'] },
    topics: {
      'bear.0': { q: 'Boo, what do bears eat?', a: ['Boo! I do not eat. I am a ghost! Hee hee!'] },
      'bear.1': [{}, { q: 'Where can I get coins?', a: ['Ghosts do not have coins!', 'But I saw a shiny coin in my graveyard...'], own: true }],
      'light.1': { q: 'Do you have a bulb?', a: ['I wish! I am scared of the dark.'] },
      'boo.0': { q: 'Where can I find a pumpkin?', a: ['Hee hee! I know!'] },
      'boo.1': { q: 'Where can I find a candle?', a: ['Ghosts do not go shopping. Hee hee!'] },
      'boo.2': { q: 'Is a pumpkin and a candle enough?', a: ['Yes! Pumpkin plus candle makes a lantern!'], clue: 'lantern', own: true },
      end: { q: 'Are you happy now?', a: ['Yes! Thank you, Coji!', 'Come and play hide and seek!'] },
    },
  },
})

function booLantern(g) {
  return N(['Oooh! Let me make my lantern...', 'Pumpkin... candle... and... ta-da! 🎃✨', 'It is so bright! I am not scared now!', 'Thank you! Here are 5 coins!'], null, {
    onShow: () => {
      g.take('pumpkin')
      g.take('candle')
      g.completeQuest('boo')
      g.addCoins(5)
      g.mood('boo', 'happy')
      g.sfx('happy')
      g.later(() => g.booLantern())
    },
  })
}

// Jobs for Burger Ben.
const benSpecials = CAST.ben.specials
CAST.ben.specials = (g) => [...benSpecials(g), job('burger', null, ['Yes! Help me make burgers.', 'Read the order. Tap what goes on the burger!', 'One coin for each right burger.'])(g)]

const TREASURE_TIPS = [
  ['Shells 🐚 and starfish ⭐ are on the beach.'],
  ['Acorns 🌰 fall in the forest.'],
  ['Lucky clovers 🍀 grow in the meadows.'],
  ['Old dino bones 🦴 are by the farm!'],
  ['Pearls 🦪 are on the little islands.'],
  ['Old keys 🗝️ are in the Spooky Graveyard.'],
  ['Crystals 💎 shine at the foot of the mountain.'],
]

// ---------- little stories ("Tell me about you!") and replies to "Wow! / Ha ha!" ----------

const STORIES = {
  pip: [
    ['I was a little boy on a little boat.', 'Now I am a captain on a big boat!', 'I sail to many islands.', 'But Sunny Island is my favorite.'],
    ['Ha ha! I once saw a whale as big as my boat!', 'It sang a song: Ooo-ooo!'],
    ['One night, the sea was full of stars.', 'Little fish made the water glow!', 'It was so pretty. ✨'],
  ],
  finn: [
    ['Every morning, I fish here.', 'One day, I caught a fish as big as me!', 'Ha ha! It jumped back into the sea.'],
    ['Fishing is easy.', 'Sit. Wait. Wait some more. Fish!'],
    ['I once caught an old boot!', 'A little crab lived in it. I put it back. Ha ha!'],
  ],
  ben: [
    ['I love to cook!', 'My burgers are big and yummy.', 'My secret? A little love in every burger! ❤️'],
    ['I made the biggest burger in the world!', 'It was as big as a table!'],
    ['A seagull took my fries one day!', 'Now he comes back every day. His name is Fred.'],
  ],
  granny: [
    ['I have six bee boxes at home.', 'The bees make honey for me.', 'I say thank you to them every day. 🐝'],
    ['Bees dance to talk to their friends!', 'Isn\'t that sweet, dear?'],
    ['When I was a girl, I had a pet bee.', 'Her name was Buzzy. She was very busy!'],
  ],
  penny: [
    ['I love to count coins.', 'One, two, three... one hundred!', 'Counting is fun. Try it, Coji!'],
    ['A coin saved is a coin you have!'],
    ['I keep treasures in a big box.', 'Shells, pearls and one dino bone!', 'Shh! It is a secret.'],
  ],
  tina: [
    ['I make toys with my hands.', 'I made a toy boat, a toy bear and a toy owl.', 'Toys make kids smile. That makes me smile!'],
    ['My best toy is a robot.', 'It can dance! Beep boop!'],
    ['I made a kite as big as a door!', 'The wind took it up, up, up! 🪁'],
  ],
  leo: [
    ['I am six, like you!', 'I like to play tag and kick balls.', 'My best friend is a frog. His name is Hop!'],
    ['Can you run fast?', 'I can run super fast! Zoom!'],
    ['I built a sand castle on the beach.', 'Then a wave came. Splash! Ha ha!'],
  ],
  gus: [
    ['I was a sailor a long time ago.', 'Now I keep the light for the ships.', 'The ships are my friends at night.'],
    ['On a clear night,', 'I can see a hundred stars from the top!'],
    ['A seagull lives on my roof.', 'He says good morning every day. Squawk!'],
  ],
  coco: [
    ['I make ice cream every morning.', 'My favorite is pink strawberry.', 'What is your favorite, Coji?'],
    ['Ice cream melts fast in the sun!', 'Eat it quick! Ha ha!'],
    ['I made rainbow ice cream once.', 'Seven colors in one cone! 🌈'],
  ],
  max: [
    ['I walk all around the island.', 'I take letters to everyone.', 'My bag is heavy, but my legs are strong!'],
    ['A dog chased me today!', 'He just wanted a letter too.'],
    ['I once got a letter from the moon!', '...Ha ha! No. It was from Mars. Just kidding!'],
  ],
  kim: [
    ['I teach the kids at the school.', 'We read books and sing songs.', 'My favorite book is about a little bear!'],
    ['Reading is like a door.', 'You open a book, and go on a trip!'],
    ['Today a frog came into my class.', 'He sat on a chair. He wanted to read too! 🐸'],
  ],
  lance: [
    ['I am the King\'s knight.', 'I keep the castle safe, day and night.', 'At night I count the stars. Shh! Don\'t tell!'],
    ['My armor is heavy.', 'But my heart is light!'],
    ['When I was little, I had a wooden sword.', 'I fought the bushes in the garden. Ha ha!'],
  ],
  momo: [['Meow! I sleep on the warm boxes.', 'I watch the boats all day.', 'Fish is my best friend! Meow!'], ['Meow! I have a secret spot under the boat.', 'It is cool in the shade. Purr...']],
  bun: [['Hop! I live in a hole under the farm.', 'I have ten brothers and sisters!', 'We all love carrots!'], ['Hop! Today I hopped so high.', 'I saw the whole farm! Wow!']],
  hoot: [['Who-who! I am very old and very wise.', 'I sleep in the day and fly at night.', 'I can turn my head almost all the way around!'], ['Who-who! I have lived in my tree a long time.', 'I know every animal in the forest.']],
  bruno: [['I live in the forest by the sea.', 'I like honey, naps and big hugs.', 'Do you like hugs, Coji? 🤗'], ['My mom taught me to fish.', 'But I like honey more! Grrr... yum!']],
  boo: [['Boo! I am a little ghost.', 'I love hide and seek. I am very good at it!', 'But I do not like the dark. Shh!'], ['Hee hee! Last night I said BOO to a bat.', 'He said BOO back! We are friends now.']],
}
const EXTRAS = {
  pip: [['The sea is full of surprises!'], ['Ahoy! You are a good sailor, Coji!']],
  finn: [['Shh! You will scare the fish! Ha ha!'], ['Yes! Fish are funny.']],
  ben: [['Yum, yum! Ha ha!'], ['Cooking makes me happy!']],
  granny: [['Oh, you are a sweet child!'], ['Bzzz! Just like my bees!']],
  penny: [['Yes! Numbers are fun!'], ['One coin, two coins... ha ha!']],
  tina: [['Yay! You are so fun, Coji!'], ['I will make a toy Coji one day!']],
  leo: [['Ha ha! You are my new friend!'], ['Let\'s play later!']],
  gus: [['Ho ho! You are a smart one.'], ['The sea tells many stories.']],
  coco: [['Sweet like ice cream!'], ['Ha ha! Brain freeze!']],
  max: [['Yes! The island is big!'], ['Special delivery for Coji: a smile! 😄']],
  kim: [['Good thinking, Coji!'], ['Keep reading every day!']],
  lance: [['Ha! A brave answer!'], ['Stand tall, little hero!']],
  momo: [['Meow! Purr...'], ['Meow meow!'], ['Purr... You are nice, Coji.']],
  bun: [['Hop, hop! Hee hee!'], ['My ears are wiggling!'], ['Hop! You make me happy!']],
  hoot: [['Who-who! Wise words!'], ['Hoo-hoo! Ha ha!'], ['Who-who! You are a smart boy.']],
  bruno: [['Ho ho ho! Bear laugh!'], ['Grr... I mean, yes!'], ['Grrr-eat! Ha ha!']],
  boo: [['Hee hee! Boo!'], ['Spooky fun!'], ['Boo! You are funny, Coji!']],
}
for (const [id, list] of Object.entries(STORIES)) Object.defineProperty(CAST[id], 'story', { get: () => draw('story:' + id, list), configurable: true })
for (const [id, list] of Object.entries(EXTRAS)) CAST[id].extras = list

// ---------- small talk for the island animals: moods, facts, jokes, and questions back ----------

Object.assign(CAST.momo, {
  talks: {
    mood: [['Purr... I feel lazy today.', 'The sun is so warm!'], ['Meow! I feel playful!', 'Do you have a string?'], ['I am a little grumpy.', 'A seagull took my nap spot!'], ['Purr... I feel happy.', 'Boats, sun and you! Meow!']],
    facts: [['Cats sleep a lot.', 'I sleep sixteen hours a day! Purr...'], ['I can see in the dark!', 'My eyes shine at night.'], ['I land on my feet.', 'Always! Meow!'], ['My whiskers help me feel things.', 'They are like magic!']],
    jokes: [['What is my favorite color?', 'Purr-ple! Meow ha ha!'], ['I chased a fish in the water.', 'Now I am a wet cat! Meow!'], ['Why do cats like boxes?', 'We do not know! We just do! Meow!']],
  },
  asks: [
    { q: 'Do you like cats, Coji?', opts: [['Yes! Cats are cute!', ['Purr... You are my friend now!']], ['I like bears more!', ['Meow! Like your blanket bear? Okay!']]] },
    { q: 'Can you purr, Coji?', opts: [['Purrr... like this?', ['Ha ha! Good purr! You are a cat now!']], ['No, I can not!', ['That is okay. I will purr for you. Purrr...']]] },
  ],
})
Object.assign(CAST.bun, {
  talks: {
    mood: [['Hop! I feel bouncy!'], ['I am hungry.', 'I am always hungry! Hop!'], ['I feel happy.', 'The farm is so green!'], ['I feel a little sleepy.', 'I hopped all day!']],
    facts: [['Bunnies can jump very high!', 'Hop, hop, HOP!'], ['My long ears hear everything.', 'I can hear you think! Ha ha!'], ['My nose wiggles all the time.', 'Wiggle, wiggle!'], ['Bunnies like to dig.', 'I dig holes under the farm.']],
    jokes: [['I tried to count my brothers.', 'They hop too much! One, two... hop!'], ['What do bunnies like to read?', 'Hop-py books! Hee hee!'], ['My ears are so long.', 'I use them as a hat! Ha ha!']],
  },
  asks: [
    { q: 'Do you like carrots, Coji?', opts: [['Yes! Crunchy carrots!', ['Hop! We are carrot friends!']], ['I like apples more.', ['Apples are nice too. Hop!']]] },
    { q: 'Can you hop like me, Coji?', opts: [['Hop, hop, hop!', ['Wow! You are a good bunny!']], ['Not as high as you!', ['That is okay. Practice every day! Hop!']]] },
  ],
})
Object.assign(CAST.hoot, {
  talks: {
    mood: [['Who-who... I feel sleepy.', 'Owls sleep in the day.'], ['I feel wise today.', 'Ask me anything! Who-who!'], ['I am happy.', 'The forest is so quiet.']],
    facts: [['I can turn my head way around!', 'Look! Who-who!'], ['I fly with no sound.', 'Shh... like a whisper.'], ['Owls have big eyes.', 'They help us see at night.'], ['Baby owls are called owlets.', 'They are fluffy! Who-who!']],
    jokes: [['Who? Who? Who?', 'Who is the best? You, Coji! Who-who!'], ['I asked a tree a question.', 'It did not answer. Trees are shy! Who-who!']],
  },
  asks: [
    { q: 'Do you stay up at night, Coji?', opts: [['No, I go to bed!', ['Good! Kids need sleep. Who-who!']], ['Sometimes! Shh!', ['Who-who! Do not tell your mom! Ha ha!']]] },
    { q: 'Do you like to read, Coji?', opts: [['Yes! I love books!', ['Who-who! Reading makes you wise!']], ['I am learning!', ['Very good! A little every day. Who-who!']]] },
  ],
})
Object.assign(CAST.bruno, {
  talks: (g) =>
    g.done('bear')
      ? {
          mood: [['I feel great!', 'My tummy is happy now.'], ['I feel sleepy.', 'Honey makes me sleepy. Yawn!'], ['I am so happy!', 'I have a new friend. You!']],
          facts: [['Bears can smell food from far away!', 'Sniff, sniff...'], ['Bears sleep all winter.', 'It is a big, long nap!'], ['I can stand up tall.', 'Look! I am so big!'], ['Bears are good swimmers.', 'Splash!']],
          jokes: [['What do bears wear on their feet?', 'Nothing! Bear feet! Ha ha!'], ['I tried to climb a tree.', 'The tree said: you are too big! Ho ho!']],
        }
      : {
          mood: [['Grrr... I feel so hungry...'], ['My tummy says GRRR.', 'Sorry! That was my tummy.'], ['I feel weak...', 'I need food...']],
          facts: [['Bears can smell food from far away...', 'But I smell no food here...'], ['Bears sleep all winter.', 'Then we wake up so hungry!']],
        },
  asks: [{ q: 'Do you like hugs, Coji?', opts: [['Yes! I love hugs!', ['Big bear hug! Squeeze! 🤗']], ['A little hug, please.', ['A little bear hug. Squeeze! 🤗']]] }],
})
Object.assign(CAST.boo, {
  talks: (g) => ({
    mood: g.done('boo') ? [['Hee hee! I feel so happy!', 'My lantern is so bright!'], ['Boo! I feel brave now!']] : [['Boo! I feel playful!'], ['I feel a little scared.', 'Is it getting dark?'], ['Hee hee! I feel happy you are here!']],
    facts: [['Ghosts can float!', 'Look! Whee!'], ['I can go through walls!', 'But I say sorry first. Hee hee!'], ['I am not scary.', 'I am just a little white ghost with big eyes!']],
    jokes: [['What do ghosts eat for dinner?', 'Spook-ghetti! Hee hee!'], ['What is a ghost\'s favorite game?', 'Hide and shriek! Boo!'], ['I tried to scare a pumpkin.', 'It just smiled at me! Hee hee!']],
  }),
  asks: [{ q: 'Are you scared of ghosts, Coji?', opts: [['No! Ghosts are my friends!', ['Yay! Boo! Best friends!']], ['A little bit.', ['Do not worry. I am a nice ghost! Hee hee!']]] }],
})

// ---------- Mr. Bones (in the graveyard, now and then) ----------

CAST.bones = {
  name: 'Mr. Bones',
  voice: 0.7,
  animal: true,
  greet: () => 'Rattle, rattle!',
  greetNode: (g) => {
    const greet = draw('bones:hi', ['Rattle, rattle! Hello there!', 'Oh! A visitor! Rattle!', 'Hee hee! I am out for a walk!', 'Hello! Do not mind me. I am just bony!', 'Rattle! Did you see my other sock?'])
    const cfg = {
      bye: () => draw('bones:bye', ['Bye! Rattle, rattle!', 'See you! I will be here. I am always here! Ha ha!', 'Bye-bye! Rattle!']),
      options: (gg, used) => {
        const of = offerFor(gg, 'bones')
        return [
          of && { key: 'offer', pri: 6, text: of.text, go: () => offerNode(gg, of) },
          {
            key: 'help',
            pri: 5,
            text: draw('q:help', HELP_QS),
            go: () => {
              const h = (gg.is('boo.0') || gg.is('boo.1')) && Math.random() < 0.5 ? helpLines(gg, 1, []) : null
              if (h) return miniHub(gg, cfg, h.say, used, { onShow: h.onShow })
              return miniHub(gg, cfg, draw('bones:nohelp', [['Help? Hmm...', 'I forgot. Rattle, rattle!'], ['I can not help.', 'I am too busy looking for my other sock.'], ['Do you have milk?', 'Milk is good for bones!'], ['Help? Sure!', '...What were we talking about?']]), used)
            },
          },
          { key: 'who', text: 'Who are you?', go: () => miniHub(gg, cfg, draw('bones:who', [['I am Mr. Bones!', 'I am not scary. I am just bony!'], ['My name? It is on the tip of my tongue...', 'Oh! I have no tongue! Ha ha!'], ['I am Mr. Bones. I live here.', 'Under the grass. It is cozy!']]), used) },
          { key: 'joke', text: draw('q:small:jokes', SMALL_QS.jokes), go: () => miniHub(gg, cfg, draw('bones:joke', [['Why did the skeleton not go to the party?', 'He had no BODY to go with! Ha ha!'], ['I am so thin.', 'I can hide behind a stick! Rattle!'], ['I love to dance.', 'Shake, rattle and roll! Ha ha!']]), used) },
        ]
      },
    }
    return miniHub(g, cfg, [greet])
  },
}

// ---------- people and animals walking around (made on the fly) ----------

const HELP_QS = ['Can you help me?', 'Do you know anything?', 'I need help. Do you know something?', 'Can you give me a clue?']
const KNOW_NOT = [
  ['Hmm... I do not know. Sorry!'],
  ['Help? I am lost too! Ha ha!'],
  ['I do not know.', 'Ask someone else!'],
  ['Hmm, let me think...', '...No idea! Sorry!'],
  ['Oh, I wish I knew!', 'Good luck, Coji!'],
  ['I am new here.', 'I do not know much yet!'],
]
// A clue for the quest step nearest to Coji, or a little story about a quest nobody has started.
// chance: how likely this one knows something (close to the place, almost everyone knows).
function helpLines(g, chance, intros) {
  const S = questNear(g)
  if (!S) {
    const r = rumor(g)
    if (r) return { say: r.a }
    if (allDone(g)) return { say: draw('help:done', [['Help? You helped everyone, Coji!', 'You are a hero!'], ['Everyone is happy now!', 'Thank you, Coji!']]) }
    return null
  }
  if (Math.random() > (S.level === 2 ? Math.max(chance, 0.85) : chance)) return null
  const h = hint(g, S.q)
  const intro = intros.length ? [draw('intro:' + intros[0], intros)] : []
  return { say: [...intro, ...h.a], onShow: () => h.clue.forEach((c) => g.clue(c, h.q)) }
}
// A small talk for people and animals who walk around: two questions at a time, and "Bye!".
// cfg.options(g, used) lists { key, text, go, pri }; an answer comes back here with its lines.
function miniHub(g, cfg, lines, used = new Set(), extra = {}) {
  const opts = cfg.options(g, used).filter((o) => o && !used.has(o.key))
  for (const o of opts) o.r = (o.pri ?? 3) + Math.random()
  opts.sort((a, b) => b.r - a.r)
  const choices = opts.slice(0, 2).map((o) => ({
    text: o.text,
    go: () => {
      used.add(o.key)
      return o.go()
    },
  }))
  choices.push({ text: draw('q:bye', COJI_BYE), go: () => N(cfg.bye(), null, { auto: true }) })
  return N(lines, choices, extra)
}
// The answer, and sometimes a question back to Coji.
function answerWithAsk(g, cfg, lines, used, asks, key) {
  if (asks?.length && Math.random() < 0.35) {
    const a = draw('ask:' + key, asks)
    return N([...lines, a.q], a.opts.map(([text, reply]) => ({ text, go: () => miniHub(g, cfg, reply, used) })))
  }
  return miniHub(g, cfg, lines, used)
}
// Shared options: start a quest, help with a clue.
function questOptions(g, id, cfg, used, chance, intros) {
  const of = offerFor(g, id, true)
  return [
    of && { key: 'offer', pri: 6, text: of.text, go: () => offerNode(g, of) },
    {
      key: 'help',
      pri: 4,
      text: draw('q:help', HELP_QS),
      go: () => {
        const h = helpLines(g, chance, intros)
        return h ? miniHub(g, cfg, h.say, used, { onShow: h.onShow }) : miniHub(g, cfg, draw('knownot', KNOW_NOT), used)
      },
    },
  ]
}

const VILLAGER_GREETS = [
  (n) => `Hello! I am ${n}.`,
  (n) => `Hi there! My name is ${n}.`,
  (n) => `Oh, hello! You must be Coji! I am ${n}.`,
  (n) => `Hi, Coji! I am ${n}. Nice to meet you!`,
  (n) => `Good day! My name is ${n}.`,
  (n) => `Hello, hello! I am ${n}!`,
]
const VILLAGER_STORIES = [
  ['I am going to the beach.', 'I love to swim with the fish!'],
  ['I am looking for my cat.', 'She is white and fluffy. Her name is Snow.'],
  ['I just baked bread.', 'The whole village smells yummy!'],
  ['I am a painter.', 'Today I will paint the castle!'],
  ['I walk every day.', 'Walking makes me happy and strong!'],
  ['My grandpa lives on this island.', 'I came to see him. Yay!'],
  ['I collect pretty shells.', 'I have one hundred shells at home!'],
  ['I want to be a knight one day.', 'I practice with a stick! Ha ha!'],
  ['I am writing a book.', 'It is about a boy and a bear!'],
  ['I am going to the farm.', 'I want to see the baby chicks!'],
  ['I am going to the school.', 'I forgot my lunch box!'],
  ['I am going to Burger Hut.', 'I am so hungry! 🍔'],
  ['I am going to the ice cream stand.', 'Pink ice cream is the best!'],
  ['I am going home.', 'It is time for my nap. Yawn!'],
  ['I am going to the post office.', 'I have a letter for my grandma. 💌'],
  ['I am looking for my hat.', 'The wind took it away!'],
  ['I am just walking.', 'Look at the pretty clouds!'],
  ['I am going fishing with Fisher Finn.', 'I hope I catch a big one!'],
]
const VILLAGER_MOODS = [
  ['I am great, thank you!', 'The sun is out!'],
  ['I am a little tired.', 'I walked all day!'],
  ['I am so happy!', 'Today is my birthday! 🎂'],
  ['I am fine, thank you.', 'It is a nice day.'],
  ['I am hungry!', 'I want a big burger.'],
  ['I feel super!', 'I ate a good breakfast.'],
  ['I am a bit sad.', 'I lost my red ball. But I will find it!'],
  ['I am happy to see you, Coji!'],
]
const VILLAGER_LIKES = [
  ['I like to read books.', 'Books about dragons are the best!'],
  ['I like to swim.', 'Splash, splash!'],
  ['I like apples.', 'Red ones and green ones!'],
  ['I like to sing.', 'La, la, la!'],
  ['I like cats.', 'Meow! Ha ha!'],
  ['I like to draw.', 'I draw the sea and the boats.'],
  ['I like to ride my bike.', 'Ring, ring!'],
  ['I like rainy days.', 'I jump in the puddles!'],
  ['I like to dance.', 'Look! Spin, spin, spin!'],
  ['I like ice cream.', 'Yellow lemon is my favorite!'],
]
const PEOPLE_ASKS = [
  { q: 'Do you like Sunny Island, Coji?', opts: [['Yes! I love it!', ['Me too! It is the best island!']], ['It is so big!', ['Ha ha! Yes! There is so much to see!']]] },
  { q: "What is your bear's name, Coji?", opts: [['Blankie Bear!', ['Blankie Bear! What a cute name!']], ['It is a secret!', ['Ha ha! Okay! Hello, secret bear!']]] },
  { q: 'Do you like to read, Coji?', opts: [['Yes! I read every day!', ['Great! Reading makes you smart!']], ['I am learning!', ['Good for you! Keep going!']]] },
  { q: 'Are you hungry, Coji?', opts: [['Yes! A little!', ['Burger Ben has yummy food!']], ['No, I am okay.', ['Good! Have a fun day!']]] },
  { q: 'Can you count to ten, Coji?', opts: [['One, two, three... ten!', ['Wow! Great counting!']], ['Yes, I can!', ['Super! You are so smart!']]] },
  { q: 'What is your favorite color, Coji?', opts: [['Blue! Like the sea!', ['Blue is so pretty!']], ['Red! Like my bag!', ['Red is a happy color!']]] },
]
export function villagerCast(name, kid) {
  return {
    name,
    dynamic: true,
    voice: kid ? 1.4 : 1,
    greetNode: (g) => {
      const giftOk = !g.flag('gift-' + name) && Math.random() < 0.3
      const gift = pick([['apple', 'Here, take an apple! 🍎'], ['cookie', 'I have a cookie for you! 🍪'], ['water', 'Are you thirsty? Take this water! 💧']])
      const cfg = {
        bye: () => draw('vbye', ['Bye, Coji!', 'Have a nice day!', 'See you later!', 'Bye-bye! Have fun!', 'See you around, Coji!']),
        options: (gg, used) => [
          ...questOptions(gg, 'villager', cfg, used, 0.6, ['Hmm... I heard this:', 'My friend told me:', 'I heard people talk!', 'Oh! I know this!']),
          giftOk && { key: 'snack', pri: 3.5, text: draw('q:snack', ['Do you have a snack?', 'I am hungry. Do you have food?']), go: () => miniHub(gg, cfg, [gift[1]], used, { onShow: () => { gg.give(gift[0]); gg.setFlag('gift-' + name) } }) },
          { key: 'going', text: draw('q:going', ['Where are you going?', 'What are you doing today?']), go: () => answerWithAsk(gg, cfg, draw('vstory', VILLAGER_STORIES), used, PEOPLE_ASKS, 'people') },
          { key: 'mood', text: draw('q:small:mood', SMALL_QS.mood), go: () => answerWithAsk(gg, cfg, draw('vmood', VILLAGER_MOODS), used, PEOPLE_ASKS, 'people') },
          { key: 'likes', text: draw('q:likes', ['What do you like?', 'What is your favorite thing?', 'What do you like to do?']), go: () => answerWithAsk(gg, cfg, draw('vlikes', VILLAGER_LIKES), used, PEOPLE_ASKS, 'people') },
        ],
      }
      return miniHub(g, cfg, [draw('vgreet', VILLAGER_GREETS)(name)])
    },
  }
}

// Each animal: hello, food, moods, facts, jokes and a question back to Coji.
const CRITTERS = {
  deer: {
    name: 'Deer',
    hi: ['Hello! I am a deer. I can run very fast!', 'Oh! Hi there! You are quiet, like me.', 'Hello, Coji! Look at my big ears!', 'Hi! I was eating grass. Yum!', 'Shh... Hello! I am a shy deer.'],
    eat: [['I eat grass and leaves.', 'Crunchy and green!'], ['I love fresh leaves.', 'And apples, if I find them!'], ['Grass for breakfast, grass for lunch!', 'Grass for dinner too!']],
    mood: [['I feel happy!', 'The sun is warm today.'], ['I am a little sleepy.', 'I ran all morning!'], ['I feel great!', 'I can jump over a log!'], ['I am hungry.', 'Where is the green grass?']],
    facts: [['Baby deer have white spots.', 'The spots help them hide!'], ['I can hear very well.', 'My big ears turn this way and that way!'], ['Daddy deer have antlers.', 'They grow new ones every year!'], ['I can jump very high!', 'Higher than you! Ha ha!']],
    jokes: [['I tried to hide behind a tree.', 'But my bottom was still out! Ha ha!'], ['I ran so fast,', 'I passed my own shadow! Ha ha!']],
    asks: [
      { q: 'Can you run fast, Coji?', opts: [['Yes! I am fast!', ['Let us race one day! Ha ha!']], ['Not very fast.', ['That is okay. Walking is nice too.']]] },
      { q: 'Do you like the forest, Coji?', opts: [['Yes! I love the trees!', ['Me too! It is my home.']], ['It is a little dark.', ['Do not worry. The forest is friendly!']]] },
    ],
    bye: ['Bye-bye! Zoom!', 'See you, Coji!', 'Bye! I am off to find grass!'],
  },
  fox: {
    name: 'Fox',
    hi: ['Yip! I am a fox. Look at my fluffy tail!', 'Yip yip! Hello, Coji!', 'Oh, hello! I am a clever fox.', 'Hi! Do you like my orange fur?'],
    eat: [['I eat berries and bugs.', 'Yip yip!'], ['I like berries and mice.', 'And sometimes a little fish!'], ['I eat lots of things.', 'Berries are my favorite!']],
    mood: [['I feel playful today!', 'Do you want to play tag?'], ['I am a bit sleepy.', 'Foxes like to play at night.'], ['I am so happy!', 'I found a big red berry!']],
    facts: [['I sleep in a den under the ground.', 'It is warm and cozy.'], ['My tail keeps me warm.', 'I wrap it around me like a blanket!', 'Just like your blanket, Coji!'], ['I can hear a mouse under the snow!'], ['Baby foxes are called kits.', 'They are so cute!']],
    jokes: [['I chased my tail all morning!', 'I did not catch it. Ha ha!'], ['I am a clever fox.', 'I can count to ten! One, two... um... ten!']],
    asks: [
      { q: 'Do you have a tail, Coji?', opts: [['Yes! My blanket!', ['Ha ha! A blanket tail! I love it!']], ['No, I do not!', ['Oh no! You can borrow mine. Yip!']]] },
      { q: 'Do you like to play tag, Coji?', opts: [['Yes! Tag is fun!', ['Yip! You are it! Ha ha!']], ['Not really.', ['Okay. We can play hide and seek!']]] },
    ],
    bye: ['Yip! Bye-bye!', 'See you, Coji! Yip yip!', 'Bye! Swish goes my tail!'],
  },
  chicken: {
    name: 'Chicken',
    hi: ['Cluck cluck! I am a chicken!', 'Bawk! Oh, hello!', 'Cluck! Do you want an egg? Just kidding!', 'Hello! I am the boss of the farm. Cluck!'],
    eat: [['I eat seeds and corn.', 'Cluck!'], ['Corn, corn, corn!', 'I love yellow corn!'], ['I eat seeds and little bugs.', 'Peck, peck, peck!']],
    mood: [['I feel busy!', 'I have so many seeds to find.'], ['I am happy!', 'I laid an egg today! 🥚'], ['I am a little scared.', 'Is that a fox? Oh, no, it is you!']],
    facts: [['Chickens can not fly very high.', 'But I can flap my wings!'], ['I talk to my eggs!', 'Cluck, cluck! The chicks hear me.'], ['I have a red comb on my head.', 'It is not for my hair! Ha ha!'], ['A rooster says cock-a-doodle-doo!', 'I just say cluck.']],
    jokes: [['Why did the chicken cross the road?', 'To say hi to you, Coji! Cluck!'], ['Which came first, the chicken or the egg?', 'Me! I came first to say hi!']],
    asks: [
      { q: 'Do you like eggs, Coji?', opts: [['Yes! Yummy eggs!', ['Cluck! You are welcome! Ha ha!']], ['Not so much.', ['That is okay. Do you like corn?']]] },
      { q: 'Can you flap like me, Coji?', opts: [['Flap, flap!', ['Ha ha! Good flapping, Coji!']], ['I have no wings!', ['Use your arms! Flap, flap!']]] },
    ],
    bye: ['Cluck! Bye-bye!', 'Bawk! See you!', 'Cluck cluck! Bye, Coji!'],
  },
  squirrel: {
    name: 'Squirrel',
    hi: ['Squeak! I am a squirrel. I am very busy!', 'Hi! Hi! Hi! Sorry, I am in a hurry!', 'Squeak! Hello! Do you have a nut?', 'Oh, hello! I was up in a tree!'],
    eat: [['I eat nuts!', 'I hide them for winter. Shh!'], ['Nuts, seeds and acorns!', 'Crunch, crunch!'], ['I love acorns. 🌰', 'I keep them in my cheeks!']],
    mood: [['I feel so busy!', 'I have one hundred nuts to hide!'], ['I am happy!', 'I found a big acorn!'], ['Oh no, I feel silly.', 'I forgot where I hid my nuts!']],
    facts: [['I can jump from tree to tree!', 'Whee!'], ['My big tail helps me balance.', 'I do not fall!'], ['I hide nuts in the ground.', 'Some of them grow into trees!'], ['My teeth never stop growing!', 'So I chew a lot!']],
    jokes: [['Where did I hide my nut?', 'Here? There? Oh! It is on my head! Ha ha!'], ['I ran up a tree so fast,', 'I forgot why! Squeak!']],
    asks: [
      { q: 'Can you climb trees, Coji?', opts: [['Yes! A little!', ['Squeak! Come up and play!']], ['No, too high!', ['That is okay. I will come down to you!']]] },
      { q: 'Do you have a nut for me, Coji?', opts: [['Sorry, not now!', ['That is okay! I have lots!']], ['Look for acorns!', ['Yes! Acorns in the forest! Squeak!']]] },
    ],
    bye: ['Squeak! Bye! I am busy!', 'Bye-bye! Squeak!', 'See you! I have nuts to hide!'],
  },
  hedgehog: {
    name: 'Hedgehog',
    hi: ['Sniff sniff. I am a hedgehog. I am a bit shy.', 'Oh! Hello... Please do not be loud.', 'Sniff! Hi, Coji. You smell like apples!', 'Hello! Watch out for my spikes!'],
    eat: [['I eat bugs and worms.', 'Yummy for me!'], ['I like beetles and snails.', 'Crunchy!'], ['I eat bugs.', 'Sometimes berries too!']],
    mood: [['I feel shy today.', 'But you are nice!'], ['I am sleepy.', 'I like to sleep in the day.'], ['I feel happy!', 'I found a big, fat worm!']],
    facts: [['When I am scared, I roll into a ball!', 'Like this! Roll, roll!'], ['I have lots of spikes on my back.', 'About five thousand!'], ['I sleep all winter long.', 'Zzz...'], ['My nose is very good.', 'Sniff, sniff! I smell a bug!']],
    jokes: [['Do not hug me!', 'I am too pokey! Ha ha!'], ['I tried to play ball.', 'But I am the ball! Ha ha!']],
    asks: [{ q: 'Are you shy too, Coji?', opts: [['Yes, a little!', ['Shy friends are the best friends!']], ['No! I like to talk!', ['Then you talk, and I will listen. Sniff!']]] }],
    bye: ['Sniff... Bye-bye.', 'Bye! I will roll home!', 'See you, Coji. Sniff!'],
  },
  crab: {
    name: 'Crab',
    hi: ['Click click! I am a crab. I walk sideways!', 'Snip snap! Hello there!', 'Click! Hi, Coji! Watch my claws!', 'Hello! The sand is warm today. Click!'],
    eat: [['I eat little bits from the sea.', 'Click!'], ['Seaweed and tiny fish!', 'Snip, snap, yum!'], ['I find food in the sand.', 'Dig, dig, dig!']],
    mood: [['I feel snappy today!', 'Snip, snap!'], ['I am happy!', 'The waves tickle my legs.'], ['I am a little grumpy.', 'A seagull took my lunch!']],
    facts: [['I have ten legs!', 'Can you count them?'], ['I carry my bones on the outside!', 'It is called a shell.'], ['I walk sideways.', 'It is faster for me!'], ['I hide in the sand when birds come.', 'Shh!']],
    jokes: [['Why do I walk sideways?', 'So I can see the beach and the sea! Ha ha!'], ['I tried to walk forward.', 'I bumped into a rock! Click!']],
    asks: [{ q: 'Can you walk sideways, Coji?', opts: [['Like this? Step, step!', ['Click click! You are a good crab!']], ['No, that is hard!', ['Try it! Step to the side!']]] }],
    bye: ['Click! Bye-bye!', 'Snip snap! See you!', 'Bye! I will walk home... sideways!'],
  },
  frog: {
    name: 'Frog',
    hi: ['Ribbit! I am a frog. I can jump high!', 'Ribbit ribbit! Hello, Coji!', 'Hi! I just jumped out of the pond!', 'Ribbit! Is it raining? I love rain!'],
    eat: [['I eat flies!', 'I catch them with my long tongue. Ribbit!'], ['Bugs, bugs, bugs!', 'Zap! I got one!'], ['I eat flies and little worms.', 'Slurp!']],
    mood: [['I feel jumpy!', 'Hop, hop, hop!'], ['I am happy!', 'The pond is cool and wet.'], ['I feel a little dry.', 'I need to jump in the water!']],
    facts: [['I was a tadpole first!', 'I had a tail and no legs.'], ['I can drink water with my skin!'], ['I can jump very far.', 'Twenty times my size!'], ['I sing at night with my friends.', 'Ribbit! Ribbit!']],
    jokes: [['What does a happy frog say?', 'Hoppy, hoppy! Ha ha!'], ['I wanted a drink.', 'So I jumped in my cup. The pond! Ha ha!']],
    asks: [
      { q: 'Can you jump, Coji?', opts: [['Yes! Look at me!', ['Ribbit! Good jump!']], ['Not very high.', ['That is okay. Practice every day!']]] },
      { q: 'Do you like rain, Coji?', opts: [['Yes! I have rain boots!', ['Yay! Let us jump in puddles!']], ['Not really.', ['Ribbit! Rain is the best!']]] },
    ],
    bye: ['Ribbit! Bye-bye!', 'Hop, hop! See you!', 'Ribbit! Splash! Bye!'],
  },
  duckling: {
    name: 'Duckling',
    hi: ['Peep peep! I am a little duck!', 'Peep! Hello, big boy!', 'Peep peep! Where is my mommy? Oh, there she is!', 'Hi! I can swim! Peep!'],
    eat: [['I eat seeds and tiny bugs.', 'Peep!'], ['I eat little plants in the pond.', 'Dip, dip, yum!'], ['Seeds and bugs.', 'Peep, peep!']],
    mood: [['I feel happy!', 'I swam all morning!'], ['I am a little cold.', 'I will hide under my mommy.'], ['I feel brave today!', 'I swam all the way across the pond!']],
    facts: [['My feet are like paddles.', 'Paddle, paddle!'], ['My feathers keep me dry in the water.'], ['I walk in a line with my brothers and sisters.', 'One, two, three, four!'], ['When I grow up, I will fly!']],
    jokes: [['What does a duck say?', 'Quack! But I am small, so I say peep! Ha ha!'], ['I tried to quack.', 'But it came out peep! Peep!']],
    asks: [{ q: 'Can you swim, Coji?', opts: [['Yes, I can!', ['Peep! Let us swim together!']], ['Just a little.', ['That is okay! Paddle your feet!']]] }],
    bye: ['Peep! Bye-bye!', 'Peep peep! See you!', 'Bye! I am going to my mommy!'],
  },
}
const ANIMAL_INTROS = ['The birds told me:', 'I heard it in the woods:', 'Sniff sniff... I know!', 'My animal friends say:']
export function critterCast(kind) {
  const c = CRITTERS[kind] || CRITTERS.deer
  return {
    name: c.name,
    dynamic: true,
    animal: true,
    voice: 1.6,
    greetNode: (g) => {
      const say = (cat) => (used) => answerWithAsk(g, cfg, draw(`${kind}:${cat}`, c[cat]), used, c.asks, kind)
      const cfg = {
        bye: () => draw(kind + ':bye', c.bye),
        options: (gg, used) => [
          ...questOptions(gg, 'critter', cfg, used, 0.35, ANIMAL_INTROS),
          { key: 'eat', text: draw('q:small:eat', SMALL_QS.eat), go: () => say('eat')(used) },
          { key: 'mood', text: draw('q:small:mood', SMALL_QS.mood), go: () => say('mood')(used) },
          { key: 'facts', text: draw('q:small:facts', SMALL_QS.facts), go: () => say('facts')(used) },
          { key: 'jokes', text: draw('q:small:jokes', SMALL_QS.jokes), go: () => say('jokes')(used) },
        ],
      }
      return miniHub(g, cfg, [draw(kind + ':hi', c.hi)])
    },
  }
}

const ALIEN = {
  greet: [(n) => `Greetings, Earth kid! I am ${n} from the planet Pop! 👽`, (n) => `Beep boop! Hello! I am ${n}! 👽`, (n) => `Hello, Earth friend! My name is ${n}. 👽`],
  planet: [['Far, far away!', 'It is blue and has three moons.', 'We eat moon cheese every day!'], ['Pop is a tiny planet.', 'You can walk around it in one day!'], ['On Pop, it rains bubbles!', 'Pop, pop, pop! That is why it is called Pop!']],
  earth: [['Yes! Earth has burgers!', 'We do not have burgers on Pop.', 'Take me to your... burger! Ha ha!'], ['Earth is so green!', 'On Pop, the grass is purple.'], ['I love Earth trees!', 'On Pop, trees are made of jelly.']],
  fun: [['Beep boop!', 'That means hello in my language.'], ['I have three eyes.', 'One for reading, one for TV, and one for snacks!'], ['My UFO goes ZOOM!', 'It can fly to the moon and back for lunch.']],
  bye: ['Beep boop! Bye-bye, Earth kid!', 'Live long and eat burgers! Bye!', 'Zoom! See you in space!'],
}
export function alienCast(name) {
  return {
    name,
    dynamic: true,
    voice: 1.8,
    greetNode: (g) => {
      const cfg = {
        bye: () => draw('alien:bye', ALIEN.bye),
        options: (gg, used) => [
          ...questOptions(gg, 'alien', cfg, used, 0.5, ['Beep boop! My space computer says:', 'My UFO heard this:']),
          { key: 'planet', text: draw('q:planet', ['Where is the planet Pop?', 'What is Pop like?']), go: () => miniHub(gg, cfg, draw('alien:planet', ALIEN.planet), used) },
          { key: 'earth', text: draw('q:earth', ['Do you like Earth?', 'What do you like on Earth?']), go: () => miniHub(gg, cfg, draw('alien:earth', ALIEN.earth), used) },
          { key: 'fun', text: draw('q:alienfun', ['Say something in alien!', 'Tell me something cool!']), go: () => miniHub(gg, cfg, draw('alien:fun', ALIEN.fun), used) },
        ],
      }
      return miniHub(g, cfg, [draw('alien:greet', ALIEN.greet)(name)])
    },
  }
}

// ---------- the people who live in the village houses ----------

export const RESIDENTS = [
  {
    name: 'Mrs. Rose',
    stories: [['I grow roses in my garden.', 'Red, pink and yellow!', 'Smell them when you walk by!'], ['A bee sat on my nose today!', 'It said bzzz and flew away. Ha ha!'], ['I make rose tea.', 'It smells like a garden!']],
    moods: [['I am happy, dear.', 'My roses are so pretty today!'], ['A little tired.', 'I dug in my garden all day!']],
    gift: ['cookie', 'Here is a rose cookie! 🍪'],
    note: 'Gone to the market. Back soon! - Rose',
  },
  {
    name: 'Baker Tom',
    stories: [['I bake bread every morning.', 'I wake up when it is still dark!', 'Then the whole village smells yummy.'], ["I made a cake as big as a door!", "It was for the King's birthday. 🎂"], ['My favorite bread is round and soft.', 'Like a pillow! Yum!']],
    moods: [['I feel great!', 'My bread is in the oven.'], ['I am sleepy.', 'Bakers get up so early! Yawn!']],
    gift: ['cookie', 'A warm cookie for you! 🍪'],
    note: 'Bread in the oven. Back in 5 minutes! - Tom',
  },
  {
    name: 'Nora',
    stories: [['I am an artist.', 'I paint the sea, the sky and the castle.', 'One day I will paint you, Coji!'], ['I had blue paint on my nose all day!', 'Nobody told me! Ha ha!'], ['Mix red and yellow.', 'What do you get? Orange! 🧡']],
    moods: [['I feel happy!', 'The sky is so blue today.'], ['I am thinking.', 'What should I paint next?']],
    gift: ['apple', 'Here is an apple. Red, like my paint! 🍎'],
    note: 'Painting at the beach today! - Nora',
  },
  {
    name: 'Mr. Oak',
    stories: [['I am very, very old.', 'When I was small, the King was a baby!', 'He cried a lot. Ha ha!'], ['I planted the big tree in the plaza.', 'It was tiny then. Now it is huge!'], ['When I was a boy, I had a pet goat.', 'He ate my socks! Ha ha!']],
    moods: [['I am fine, young one.', 'My knees are old, but my heart is young!'], ['I feel sleepy.', 'Time for a little nap soon.']],
    gift: ['water', 'Drink water every day, young one. 💧'],
    note: 'Taking a nap. Please come back later! - Mr. Oak',
  },
  {
    name: 'Lily',
    kid: true,
    stories: [['I am seven!', 'My dog is called Biscuit.', 'He likes to run after balls.'], ['I lost my tooth today!', 'Look! There is a hole! Ha ha!'], ['I can do a cartwheel!', 'Well... almost!']],
    moods: [['I am so happy!', 'Biscuit learned a new trick!'], ['I am bored.', 'Do you want to play?']],
    gift: ['berries', 'I picked berries! Want some? 🫐'],
    note: 'At school! - Lily',
  },
  {
    name: 'Dr. Sam',
    stories: [['I am the island doctor.', 'Eat good food, drink water and sleep well!', 'Then you will be strong!'], ['Today I helped a bunny.', 'He ate too many carrots! Ha ha!'], ['Wash your hands, Coji!', 'Germs do not like soap!']],
    moods: [['I feel great!', 'Everyone on the island is healthy.'], ['I am busy!', 'A duck has a cold. Achoo!']],
    gift: ['water', 'Doctor says: drink water! 💧'],
    note: 'Helping a sick bunny at the farm. - Dr. Sam',
  },
]
export function residentCast(i) {
  const R = RESIDENTS[i]
  return {
    name: R.name,
    dynamic: true,
    voice: R.kid ? 1.45 : 1.05,
    greetNode: (g) => {
      const cfg = {
        bye: () => draw('rbye', ['Bye, Coji!', 'Come again!', 'Come back any time!', 'Bye-bye! Be good!']),
        options: (gg, used) => [
          ...questOptions(gg, 'resident', cfg, used, 0.75, ['Let me think...', 'Hmm! I heard this:', 'My neighbor told me:']),
          { key: 'story', text: draw('q:story', STORY_QS), go: () => answerWithAsk(gg, cfg, draw('res:story:' + i, R.stories), used, PEOPLE_ASKS, 'people') },
          { key: 'mood', text: draw('q:small:mood', SMALL_QS.mood), go: () => answerWithAsk(gg, cfg, draw('res:mood:' + i, R.moods), used, PEOPLE_ASKS, 'people') },
          !gg.flag('res-gift-' + i) && {
            key: 'snack',
            pri: 3.5,
            text: draw('q:snack', ['Do you have a snack?', 'I am hungry. Do you have food?']),
            go: () => miniHub(gg, cfg, [R.gift[1]], used, { onShow: () => { gg.give(R.gift[0]); gg.setFlag('res-gift-' + i) } }),
          },
        ],
      }
      const hello = g.met('res-' + i) ? draw('res:hi2', ['Hello again, Coji!', 'Oh, Coji! Hi!', 'Coji! Nice to see you again!']) : draw('res:hi', [`Hello! I am ${R.name}.`, `Oh! Hello there! I am ${R.name}.`])
      return miniHub(g, cfg, [hello, 'Welcome to my house! 🏡'])
    },
  }
}

// ---------- Old Sam (Turtle Island) and Picnic Pam (Flower Island) ----------

Object.assign(CAST, {
  sam: {
    name: 'Old Sam',
    voice: 0.8,
    greet: (g) => (g.met('sam') ? draw('greet:sam', ['Ahoy again, young Coji!', 'Well, well! Coji is back!', 'Ahoy! The turtles say hi!']) : 'Well, well! A visitor! I am Old Sam. 🐢'),
    specials: (g) => [
      {
        key: 'tale',
        text: draw('q:tale', ['Can you tell me a story?', 'Tell me a pirate story!', 'Do you know a story?']),
        pri: 4,
        go: () =>
          talkNode(g, 'sam', draw('sam:tales', [
            ['Long ago, a little crab lost his shell.', 'He looked and looked.', 'A turtle said: "Live with me!"', 'Now they are best friends. The end! 🦀🐢'],
            ['Once, a tiny fish wanted to see the moon.', 'She jumped and jumped, higher and higher.', 'A bird caught her and flew up!', 'She saw the moon, and the bird put her back. The end! 🐟🌙'],
            ['The King of this island was a little boy once.', 'He had a blanket, just like you!', 'Now he is a big King, but he still has it. Shh! 👑'],
            ['One day, a big wave took my hat.', 'A turtle swam out and brought it back!', 'That is why turtles are my friends. The end! 🐢'],
          ]), 'story'),
      },
    ],
    chat: { q: 'Why do you live here?', a: ['I like the quiet.', 'The turtles are my friends.', 'And the sea sings to me at night.'] },
    topics: {},
  },
  pam: {
    name: 'Picnic Pam',
    voice: 1.25,
    greet: (g) => (g.met('pam') ? draw('greet:pam', ['Hi, Coji! Picnic time!', 'Hello again! Smell the flowers!', 'Hi, Coji! Sit with me!']) : 'Hello! I am Pam. I love picnics! 🧺'),
    specials: (g) => [
      !g.flag('pamGift') && {
        key: 'picnic',
        text: 'Can I join your picnic?',
        pri: 6,
        go: () => N(['Of course! Here is a sandwich for you. 🥪', 'Sharing is caring!'], null, { onShow: () => { g.give('sandwich'); g.setFlag('pamGift') } }),
      },
    ],
    chat: { q: 'Why do you like flowers?', a: ['Flowers are so pretty!', 'Bees love them, and so do I.'] },
    topics: {},
  },
})
STORIES.sam = [['I was a pirate a long, long time ago.', 'A good pirate! I gave treasure away.', 'Look for my old chest on this island!'], ['Arr! I sailed on a ship called the Happy Fish.', 'It was small, but it was fast!']]
STORIES.pam = [['I come here every day.', 'I read a book and eat a sandwich.', 'Then I smell the flowers. Mmm!'], ['A butterfly sat on my sandwich!', 'I said: you can have a little bite. Ha ha!']]
for (const id of ['sam', 'pam']) Object.defineProperty(CAST[id], 'story', { get: () => draw('story:' + id, STORIES[id]), configurable: true })
CAST.sam.extras = [['Ho ho! The sea knows!'], ['Arr! I mean... yes!']]
CAST.pam.extras = [['Ha ha! Picnics are the best!'], ['Smell the flowers, Coji!']]

// Sir Percy walks around the castle.
CAST.percy = {
  name: 'Sir Percy',
  voice: 0.9,
  greetNode: (g) => {
    const cfg = {
      bye: () => draw('percy:bye', ['Farewell, little hero!', 'Stay brave, Coji!', 'Bye! I must walk on!']),
      options: (gg, used) => [
        ...questOptions(gg, 'percy', cfg, used, 0.7, ['A knight hears many things.', 'I heard this on my walk:']),
        { key: 'knights', text: draw('q:knights', ['What do knights do?', 'Is it fun to be a knight?']), go: () => miniHub(gg, cfg, draw('percy:knights', [['We keep the castle safe.', 'We help people.', 'And we are always kind!'], ['I walk around the castle all day.', 'Left foot, right foot! It is good exercise!'], ['Knights must be brave.', 'And polite! Please and thank you!']]), used) },
        { key: 'mood', text: draw('q:small:mood', SMALL_QS.mood), go: () => miniHub(gg, cfg, draw('percy:mood', [['I feel strong today!'], ['My feet are tired.', 'This castle is big!'], ['I am happy.', 'The King waved at me!']]), used) },
      ],
    }
    return miniHub(g, cfg, [draw('percy:hi', ['Good day, young Coji! ⚔️', 'Hello! I am Sir Percy. I walk around the castle all day!', 'Halt! ...Just kidding. Hello, Coji!'])])
  },
}
