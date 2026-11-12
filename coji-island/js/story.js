// Quests, clues and what everyone says. English level: KCIS Grade 1 (short, simple sentences).
//
// A dialogue node: { say: [lines], choices: [{ text, go }], onShow, then }
//   say      lines spoken by the character (tap to go on)
//   choices  2-3 answers for Coji; `go` returns the next node (or null to end)
//   onShow   runs when the node appears (give items, add clues…)
//   then     next node when there are no choices
// Every character has a quest topic for every quest step. A first question gives a hint; asking a
// follow-up gives a better clue; chit-chat gives no clue.

export const QUESTS = {
  bear: {
    title: 'The Hungry Bear',
    icon: '🐻',
    steps: [
      { text: 'Find out what Bear likes to eat.', done: (g) => g.knows('honey') },
      { text: 'Get some honey. 🍯', done: (g) => g.has('honey') },
      { text: 'Give the honey to Bear.' },
    ],
    clues: {
      sweet: { text: 'Bear likes sweet food.' },
      honey: { text: 'Bears love honey! 🍯' },
      hoot: { text: 'Hoot the owl knows a lot. Hoot lives in the forest.', place: 'owl' },
      granny: { text: 'Granny Bee sells honey at the Market.', place: 'market' },
      coins: { text: 'Honey costs 5 coins. 🪙' },
      shells: { text: 'The Bank swaps shells 🐚 for coins.', place: 'bank' },
      apples: { text: 'Granny Bee buys apples 🍎. Apple trees grow at the Farm.', place: 'farm' },
      momo: { text: 'Momo the cat has coins. Momo wants a fish 🐟.', place: 'harbor' },
      bridge: { text: 'Bear is on the bridge in the forest.', place: 'bridge' },
    },
  },
  light: {
    title: 'The Dark Lighthouse',
    icon: '🗼',
    steps: [
      { text: 'Talk to Grandpa Gus at the lighthouse.' },
      { text: 'Find a big, bright light bulb. 💡', done: (g) => g.knows('price') },
      { text: 'Get the bulb from Tina.', done: (g) => g.has('bulb') },
      { text: 'Bring the bulb to Grandpa Gus.' },
    ],
    clues: {
      path: { text: 'The lighthouse is across Bear Bridge, up the hill.', place: 'lighthouse' },
      lamp: { text: 'Grandpa Gus needs a big, bright bulb 💡.' },
      toyshop: { text: "Tina's Toy Shop has a big bulb.", place: 'toyshop' },
      price: { text: 'The bulb costs 8 coins. Or trade a soft feather 🪶.' },
      shells: { text: 'The Bank swaps shells 🐚 for coins.', place: 'bank' },
      hoot: { text: 'Hoot the owl has soft feathers.', place: 'owl' },
      glasses: { text: 'Hoot lost her glasses 👓.' },
      pond: { text: 'Shiny glasses are by the pond!', place: 'glasses' },
    },
  },
}
export const QUEST_ORDER = ['bear', 'light']

// What Blankie Bear says when nothing has happened for a while.
export function stepTip(g) {
  const s = g.stage()
  switch (s) {
    case 'start':
      return 'Tap Captain Pip to say hi! 👋'
    case 'bear.0':
      return 'What does Bear like to eat? Tap people and ask them! 💬'
    case 'bear.1':
      if (!g.knows('granny')) return 'Who has honey? Ask people in the village. 💬'
      if (g.coins < 5) return `Honey costs 5 coins. You have ${g.coins}. Let's find more coins! 🐚🍎`
      return "Let's buy honey from Granny Bee at the Market! 🍯"
    case 'bear.2':
      return "Let's take the honey to Bear on the bridge! Open the map 🗺️ to find it."
    case 'light.0':
      return "Let's go to the lighthouse and talk to Grandpa Gus! 🗼"
    case 'light.1':
      return 'Where is a big, bright bulb? Ask people in the village! 💡'
    case 'light.2':
      if (g.coins >= 8 || g.has('feather')) return "Let's go to the Toy Shop and get the bulb! 💡"
      return `Tina wants 8 coins or a soft feather. You have ${g.coins} coins. 🪙🪶`
    case 'light.3':
      return "Let's take the bulb to Grandpa Gus! 🗼"
    default:
      return 'You can explore the island! 🏝️'
  }
}

// Who should get a gold "!" right now.
export function targets(g) {
  const s = g.stage()
  const t = new Set()
  if (s === 'start') t.add('pip')
  if (s === 'bear.1' && g.knows('granny')) t.add('granny')
  if (s === 'bear.2') t.add('bruno')
  if (s === 'light.0' || s === 'light.3') t.add('gus')
  if (s === 'light.1' && g.knows('toyshop')) t.add('tina')
  if (s === 'light.2' && (g.coins >= 8 || g.has('feather'))) t.add('tina')
  if (g.has('fish') && !g.flag('momoFed')) t.add('momo')
  if (g.has('carrot')) t.add('bun')
  if (g.has('glasses')) t.add('hoot')
  if (g.has('shell')) t.add('penny')
  return t
}

const N = (say, choices = null, extra = {}) => ({ say: [].concat(say), choices, ...extra })

// ---------- the cast ----------

export const CAST = {
  pip: {
    name: 'Captain Pip',
    voice: 1.0,
    first: (g) => {
      const accept = () =>
        N(['Thank you, Coji!', 'First, find out what Bear likes to eat.', 'Ask people on the island. Tap them to talk!'], null, {
          onShow: () => g.startQuest('bear'),
        })
      const ask = () =>
        N(['Oh, I have a problem, Coji.', 'A big bear sits on the bridge in the forest.', 'He is very hungry. Nobody can cross the bridge!', 'Can you help the bear?'], [
          { text: 'Yes! I can help!', go: accept },
          {
            text: 'A bear? I am scared...',
            go: () =>
              N(["Don't worry. He is a kind bear.", 'He is just very, very hungry.'], [
                { text: 'Okay! I will help!', go: accept },
                { text: 'Yes, I can do it!', go: accept },
              ]),
          },
        ])
      const gift = () =>
        N(['Hello, Coji! I like your bear blanket.', 'Here is a bag for you. 🎒', 'There is water, an apple and 3 coins in it.'], [
          { text: 'Thank you, Captain Pip!', go: ask },
          { text: 'Wow! A bag!', go: ask },
        ], { onShow: () => g.startBag() })
      return N(['Ahoy! Welcome to Sunny Island! 🏝️', 'I am Captain Pip. What is your name?'], [
        { text: 'I am Coji!', go: gift },
        { text: 'Hi! My name is Coji.', go: gift },
      ])
    },
    greet: () => 'Ahoy, Coji!',
    chat: { q: 'Tell me about the island.', a: ['Sunny Island has a village, a farm and a forest.', 'Tap the map 🗺️ button to see it all!'] },
    topics: {
      'bear.0': {
        q: 'What does Bear like to eat?',
        a: ['Hmm, I do not know.', 'Bears like sweet things, I think.'],
        clue: 'sweet',
        more: { q: 'Who knows about bears?', a: ['Hoot the owl knows a lot!', 'Hoot lives in a big tree in the forest.'], clue: 'hoot' },
      },
      'bear.1': {
        q: 'Where can I get honey?',
        a: ['Go to the village.', 'Look for the market.'],
        more: { q: 'Who sells honey?', a: ['Granny Bee! She has a yellow stall.'], clue: 'granny' },
      },
      'bear.2': { q: 'I have honey!', a: ['Great job, Coji!', 'Bear is on the bridge in the forest.', 'Go north from the village.'], clue: 'bridge' },
      'light.0': {
        q: 'Do you know Grandpa Gus?',
        a: ['Yes! He lives in the lighthouse.', 'But the light is off.', 'My boat can not sail at night!'],
        more: { q: 'How do I get there?', a: ['Cross Bear Bridge.', 'Then walk up the hill.'], clue: 'path' },
      },
      'light.1': {
        q: 'Where can I find a big bulb?',
        a: ['A big bulb? Hmm...', 'Ask in the village. The shops have lots of things.'],
        more: { q: 'Which shop?', a: ['Maybe the Toy Shop?', 'Tina has many things.'], clue: 'toyshop' },
      },
      'light.2': { q: 'How can I get coins?', a: ['Find shells on the beach.', 'Penny at the bank swaps them for coins.'], clue: 'shells' },
      'light.3': { q: 'I have the bulb!', a: ['Hooray! Take it to Grandpa Gus!'] },
      end: { q: 'Look at the lighthouse!', a: ['It is so bright!', 'Now my boat can sail at night.', 'Thank you, Coji. You are a hero!'] },
    },
  },

  finn: {
    name: 'Fisher Finn',
    voice: 0.9,
    greet: () => 'Hi there! I am Fisher Finn. 🎣',
    specials: (g) => [
      !g.has('fish') && {
        text: 'Can I have a fish?',
        pri: 6,
        go: () => N(['Sure! Here is a fish. 🐟', 'Momo the cat loves fish!'], null, { onShow: () => g.give('fish') }),
      },
    ],
    chat: { q: 'What are you doing?', a: ['I am fishing!', 'Shh... Do not scare the fish.'] },
    topics: {
      'bear.0': {
        q: 'Do bears eat fish?',
        a: ['Some bears do!', 'But this bear does not like fish.', 'He likes sweet things.'],
        clue: 'sweet',
        more: { q: 'What sweet things?', a: ['Hmm... Ask Burger Ben.', 'He knows a lot about food!'] },
      },
      'bear.1': { q: 'Do you have honey?', a: ['No, I only have fish.', 'But Momo the cat has coins!', 'Give Momo a fish.'], clue: 'momo' },
      'bear.2': { q: 'I have the honey!', a: ['Go, go, Coji! The bear is waiting.'], clue: 'bridge' },
      'light.0': { q: 'Where is the lighthouse?', a: ['Look! It is the tall red and white tower.', 'Cross Bear Bridge to get there.'], clue: 'path' },
      'light.1': {
        q: 'Do you have a big bulb?',
        a: ['A bulb? No, just fish!'],
        more: { q: 'Who has one?', a: ['I saw a big bulb in a shop window.', 'Was it the Toy Shop?'], clue: 'toyshop' },
      },
      'light.2': { q: 'Do you have a feather?', a: ['I have seagull feathers. They are too small!', 'Owl feathers are big and soft.'], clue: 'hoot' },
      'light.3': { q: 'I have the bulb!', a: ['Hurry to Grandpa Gus!'] },
      end: { q: 'Did you see the light?', a: ['Yes! It is so pretty at night!'] },
    },
  },

  momo: {
    name: 'Momo the Cat',
    voice: 1.6,
    animal: true,
    greet: (g) => (g.flag('momoFed') ? 'Purr... Hello, Coji!' : 'Meow... I am so hungry. Do you have a fish? 🐟'),
    specials: (g) => [
      g.has('fish') &&
        !g.flag('momoFed') && {
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
          text: 'Here is another fish!',
          pri: 3,
          go: () => N(['Purr... I am so full now.', 'Thank you, Coji!']),
        },
    ],
    chat: { q: 'Hi, Momo!', a: ['Meow! I like the sun. It is warm.'] },
    topics: {
      'bear.0': { q: 'Momo, what do bears eat?', a: ['Bears eat... not fish!', 'Fish is for cats! Meow!'] },
      'bear.1': (g) =>
        g.flag('momoFed')
          ? { q: 'Do you have more coins?', a: ['Meow! No more coins.', 'Try the beach. Shells are like coins!'], clue: 'shells' }
          : { q: 'I need coins.', a: ['Meow! I have coins.', 'Bring me a fish, and they are yours!'], clue: 'momo' },
      'bear.2': { q: 'Do you like bears?', a: ['Big bears? Meow! Too big!'] },
      'light.1': { q: 'Did you see a big bulb?', a: ['Meow? I saw a shiny thing in the Toy Shop window.'], clue: 'toyshop' },
      'light.2': { q: 'Did you see any glasses?', a: ['Meow! Shiny glasses by the pond!', 'I saw them!'], clue: 'pond' },
      end: { q: 'Do you see the light?', a: ['Purr... The lighthouse is so pretty.'] },
    },
  },

  ben: {
    name: 'Burger Ben',
    voice: 0.85,
    greet: (g) => (g.met('ben') ? 'Hi, Coji! Hungry?' : 'Welcome to Burger Hut! I am Burger Ben. 🍔'),
    specials: (g) => [{ text: 'Can I buy some food?', pri: 4, go: () => N(['Sure! Take a look!'], null, { onShow: () => g.later(() => g.openShop('ben')) }) }],
    chat: { q: 'What is good here?', a: ['The burger is the best!', 'It gives you lots of energy. ⚡'] },
    topics: {
      'bear.0': {
        q: 'Do bears eat burgers?',
        a: ['Ha ha! No, no!', 'Bears do not eat burgers.'],
        more: { q: 'What do bears eat?', a: ['Bears love honey!', 'Yum, yum!'], clue: 'honey' },
      },
      'bear.1': {
        q: 'Do you have honey?',
        a: ['No honey here. Just burgers and fries!'],
        more: { q: 'Who has honey?', a: ['Granny Bee at the market!'], clue: 'granny' },
      },
      'bear.2': { q: 'I have honey for Bear!', a: ['The bear will be so happy!', 'Go to the bridge in the forest.'], clue: 'bridge' },
      'light.0': { q: 'Where is the lighthouse?', a: ['Go to the forest and cross Bear Bridge.', 'Then walk up the hill!'], clue: 'path' },
      'light.1': { q: 'Do you have a big bulb?', a: ['My lights are small.', 'Try the Toy Shop! Tina has lots of things.'], clue: 'toyshop' },
      'light.2': { q: 'How can I get coins?', a: ['Sell apples to Granny Bee.', 'Or swap shells at the bank!'], clue: 'shells' },
      'light.3': { q: 'I have the bulb!', a: ['Go, Coji, go!'] },
      end: { q: 'The lighthouse is on!', a: ['Hooray! Have a burger to celebrate! Ha ha!'] },
    },
  },

  granny: {
    name: 'Granny Bee',
    voice: 1.15,
    greet: (g) => (g.met('granny') ? 'Hello again, dear!' : 'Hello, dear! I am Granny Bee. 🐝'),
    specials: (g) => [{ text: 'Can I see your shop?', pri: 4, go: () => N(['Of course, dear!'], null, { onShow: () => g.later(() => g.openShop('granny')) }) }],
    chat: { q: 'What do you sell?', a: ['I sell honey, carrots and milk.', 'And I buy apples and berries!'] },
    topics: {
      'bear.0': { q: 'What does a bear like to eat?', a: ['Oh, dear! Bears love honey.', 'And I have honey!'], clue: ['honey', 'granny'] },
      'bear.1': (g) => ({
        q: 'Can I have some honey?',
        a: g.coins >= 5 ? ['Yes, dear! One jar is 5 coins.', 'You can buy it in my shop.'] : ['Yes, dear! One jar is 5 coins.'],
        clue: ['granny', 'coins'],
        more: { q: g.coins >= 5 ? 'How can I get more coins?' : 'I do not have 5 coins.', a: ['I buy apples. One apple is one coin.', 'Apple trees grow at the farm.'], clue: 'apples' },
      }),
      'bear.2': { q: 'Thank you for the honey!', a: ['You are welcome, dear.', 'Bear is on the bridge. Go north!'], clue: 'bridge' },
      'light.0': { q: 'Where is the lighthouse?', a: ['Past Bear Bridge, dear.', 'It is on the big hill.'], clue: 'path' },
      'light.1': {
        q: 'Do you sell bulbs?',
        a: ['No, dear. Only food.'],
        more: { q: 'Who sells bulbs?', a: ['Tina at the Toy Shop, I think.'], clue: 'toyshop' },
      },
      'light.2': { q: 'Where can I find a feather?', a: ['Hoot the owl has soft feathers.', 'She lives in the big tree in the forest.'], clue: 'hoot' },
      'light.3': { q: 'I have the bulb!', a: ['Hurry, dear!'] },
      end: { q: 'Did you see the light?', a: ['What a bright light!', 'Thank you, dear.'] },
    },
  },

  penny: {
    name: 'Penny',
    voice: 1.1,
    greet: (g) => (g.met('penny') ? 'Hello, Coji!' : 'Hello! Welcome to the bank. I am Penny. 🏦'),
    specials: (g) => [
      g.has('shell') && {
        text: 'Can I swap my shells?',
        pri: 7,
        go: () => {
          const n = g.count('shell')
          return N([`Yes! ${n} ${n === 1 ? 'shell is' : 'shells are'} ${n} ${n === 1 ? 'coin' : 'coins'}!`, 'Here you go! 🪙'], null, {
            onShow: () => {
              g.take('shell', n)
              g.addCoins(n)
            },
          })
        },
      },
      !g.has('shell') && {
        text: 'How do I get coins?',
        pri: 3,
        go: () => N(['Find shells 🐚 on the beach.', 'Bring them here.', 'One shell is one coin!'], null, { onShow: () => g.clue('shells') }),
      },
    ],
    chat: { q: 'What is a bank?', a: ['A bank keeps money safe.', 'I swap shells for coins too!'] },
    topics: {
      'bear.0': {
        q: 'What do bears eat?',
        a: ['Bears? I do not know.', 'I only know coins! 🪙'],
        more: { q: 'How can I get coins?', a: ['Find shells on the beach.', 'One shell is one coin!'], clue: 'shells' },
      },
      'bear.1': { q: 'I need coins for honey.', a: ['Find shells on the beach.', 'Bring them to me. One shell is one coin!'], clue: 'shells' },
      'bear.2': { q: 'Do you like bears?', a: ['Yes, from far away! Ha ha.'] },
      'light.0': { q: 'Where is the lighthouse?', a: ['Cross the bridge in the forest.', 'Then go up the hill.'], clue: 'path' },
      'light.1': { q: 'Do you have a big bulb?', a: ['No.', 'But I saw a big bulb in the Toy Shop window.'], clue: 'toyshop' },
      'light.2': { q: 'I need 8 coins.', a: ['Find shells on the beach.', 'I will swap them for coins!'], clue: 'shells' },
      'light.3': { q: 'I have the bulb!', a: ['Good job! Go to the lighthouse!'] },
      end: { q: 'The light is on!', a: ['The island is safe now.', 'Good job, Coji!'] },
    },
  },

  tina: {
    name: 'Tina',
    voice: 1.3,
    greet: (g) => (g.met('tina') ? 'Hi, Coji!' : 'Hi! I am Tina. Welcome to my Toy Shop! 🧸'),
    specials: (g) => {
      if (g.stage() !== 'light.2') return []
      return [
        g.coins >= 8 && {
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
      'bear.0': {
        q: 'Do you know about the bear?',
        a: ['The big bear? He is hungry.', 'He likes sweet, sticky food.'],
        clue: 'sweet',
        more: { q: 'What is sweet and sticky?', a: ['Honey, of course!', 'Bees make honey.'], clue: 'honey' },
      },
      'bear.1': { q: 'Where can I get honey?', a: ['Granny Bee!', 'She has a yellow stall in the village.'], clue: 'granny' },
      'bear.2': { q: 'I have honey!', a: ['Yay! Go give it to the bear!'], clue: 'bridge' },
      'light.0': { q: 'Where is the lighthouse?', a: ['Cross Bear Bridge in the forest.', 'Then go up the hill.'], clue: 'path' },
      'light.1': {
        q: 'Do you have a big light bulb?',
        a: ['Yes! Look in my window!', 'It is the Super Bright Bulb! 💡', 'It costs 8 coins.', 'Or... bring me a soft feather for my toy owl.'],
        clue: ['toyshop', 'price'],
      },
      'light.2': {
        q: 'How can I get the bulb?',
        a: ['Bring me 8 coins.', 'Or bring me a soft feather!'],
        clue: 'price',
        more: { q: 'Where can I find a feather?', a: ['Owls have soft feathers.', 'Hoot lives in the forest.'], clue: 'hoot' },
      },
      'light.3': { q: 'Thank you for the bulb!', a: ['Take it to Grandpa Gus!'] },
      end: { q: 'Did you see the lighthouse?', a: ['Yes! It looks like a big star!'] },
    },
  },

  leo: {
    name: 'Leo',
    voice: 1.45,
    greet: (g) => (g.met('leo') ? 'Hi, Coji!' : 'Hi! I am Leo. Are you new here?'),
    specials: (g) => [
      !g.flag('leoWater') && {
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
      'bear.0': {
        q: 'What do bears eat?',
        a: ['My book says bears eat fish, berries and honey.'],
        more: { q: 'What does Bear like best?', a: ['Honey! He licks his paws and says,', '"Honey, honey!"'], clue: 'honey' },
      },
      'bear.1': {
        q: 'How can I get coins?',
        a: ['I sell apples to Granny Bee.', 'Apple trees grow at the farm!'],
        clue: 'apples',
        more: { q: 'Where is the farm?', a: ['Go west from the village.', 'Look for the red barn!'] },
      },
      'bear.2': { q: 'Do you want to see the bear?', a: ['No way! He is too big!', 'You are so brave, Coji!'] },
      'light.0': { q: 'Where is the lighthouse?', a: ['Look up! You can see it on the hill.', 'Go to the forest and cross the bridge.'], clue: 'path' },
      'light.1': { q: 'Where can I get a big bulb?', a: ['The Toy Shop!', 'I saw a big, shiny bulb there.'], clue: 'toyshop' },
      'light.2': {
        q: 'Where can I find a feather?',
        a: ['Birds have feathers!', 'Ask Hoot the owl.'],
        clue: 'hoot',
        more: { q: 'Where is Hoot?', a: ['In the big tree in the forest.', 'Go north!'] },
      },
      'light.3': { q: 'I have the bulb!', a: ['Run, Coji, run!'] },
      end: { q: 'Look at the light!', a: ['It is so cool!', 'Now let us play tag!'] },
    },
  },

  bun: {
    name: 'Bun the Bunny',
    voice: 1.7,
    animal: true,
    greet: (g) => (g.has('carrot') ? 'Hop, hop! I smell a carrot! 🥕' : g.flag('bunFed') ? 'Hop! Hi, Coji!' : 'Hop, hop! I am Bun. Do you have a carrot? 🥕'),
    specials: (g) => [
      g.has('carrot') && {
        text: 'Here is a carrot!',
        pri: 9,
        go: () => {
          const lines = ['A carrot! Thank you, thank you!', 'Here are some berries for you! 🫐']
          if (g.stage() === 'light.2' && !g.has('glasses') && !g.flag('hootHappy')) lines.push('And... I saw shiny glasses by the pond!')
          return N(lines, null, {
            onShow: () => {
              g.take('carrot')
              g.give('berries', 3)
              g.setFlag('bunFed')
              g.mood('bun', 'happy')
              g.sfx('happy')
              if (g.stage() === 'light.2') g.clue('pond')
            },
          })
        },
      },
    ],
    chat: { q: 'Hi, Bun!', a: ['Hop, hop! I like the farm.', 'Carrots grow here!'] },
    topics: {
      'bear.0': { q: 'Bun, what do bears eat?', a: ['Not carrots!', 'Carrots are for bunnies!'] },
      'bear.1': { q: 'Do you like honey?', a: ['No, I like carrots!', 'Granny Bee sells carrots. And honey too!'], clue: 'granny' },
      'bear.2': { q: 'I have honey for Bear!', a: ['Hop! Go, go, go!'] },
      'light.0': { q: 'Where is the lighthouse?', a: ['The lighthouse? Too far for my little feet!'] },
      'light.1': { q: 'Did you see a big bulb?', a: ['No... I only look for carrots!'] },
      'light.2': (g) =>
        g.flag('bunFed')
          ? { q: 'Did you see any glasses?', a: ['Yes! Shiny glasses by the pond!'], clue: 'pond' }
          : { q: 'Did you see any glasses?', a: ['Glasses? Hmm...', 'Give me a carrot, and I will tell you!'] },
      end: { q: 'Did you see the light?', a: ['Hop, hop, hooray!'] },
    },
  },

  hoot: {
    name: 'Hoot the Owl',
    voice: 0.75,
    animal: true,
    greet: (g) => (g.flag('hootHappy') ? 'Who-who! Hello, Coji!' : 'Who-who! Who is there? I can not see well...'),
    specials: (g) => [
      g.has('glasses') && {
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
        g.stage() !== 'light.2' && {
          text: 'Are you okay, Hoot?',
          pri: 2,
          go: () => N(['I lost my glasses.', 'I can not see well...', 'I think I was by the pond.'], null, { onShow: () => g.setFlag('knowGlasses') }),
        },
    ],
    chat: { q: 'What do owls do?', a: ['Owls sleep in the day.', 'At night, we fly and look around. Who-who!'] },
    topics: {
      'bear.0': {
        q: 'Hoot, what does Bear like?',
        a: ['Who-who! I know!', 'Bear loves honey!'],
        clue: 'honey',
        more: { q: 'Where can I get honey?', a: ['Do not take it from the bees!', 'Granny Bee has honey at the market.'], clue: 'granny' },
      },
      'bear.1': {
        q: 'Where can I get honey?',
        a: ['Granny Bee at the market. Who-who!'],
        clue: 'granny',
        more: { q: 'I need coins.', a: ['Shells on the beach are like coins.', 'Take them to the bank!'], clue: 'shells' },
      },
      'bear.2': { q: 'Where is the bear?', a: ['On the bridge!', 'Follow the forest road east.'], clue: 'bridge' },
      'light.0': { q: 'Where is the lighthouse?', a: ['Cross the bridge, then go up the hill. Who-who!'], clue: 'path' },
      'light.1': (g) =>
        g.flag('hootHappy')
          ? { q: 'Where can I find a big bulb?', a: ['I can see far now!', 'There is a big bulb in the Toy Shop window.'], clue: 'toyshop' }
          : { q: 'Where can I find a big bulb?', a: ['I can not see well. I lost my glasses...', 'Maybe a shop in the village has one?'] },
      'light.2': (g) =>
        g.flag('hootHappy')
          ? { q: 'Thank you for the feather!', a: ['Who-who! Take it to Tina!'] }
          : {
              q: 'Can I have a feather?',
              a: ['Who-who... I lost my glasses.', 'I can not see!', 'Find my glasses, and I will give you a feather.'],
              clue: 'glasses',
              more: { q: 'Where did you lose them?', a: ['I was by the pond...', 'Then I flew home.'], clue: 'pond' },
            },
      'light.3': { q: 'I have the bulb!', a: ['Who-who! Go, Coji!'] },
      end: { q: 'Can you see the light?', a: ['Who-who! What a bright light!'] },
    },
  },

  bruno: {
    name: 'Bruno the Bear',
    voice: 0.6,
    animal: true,
    greet: (g) => (g.done('bear') ? 'Hello, my friend Coji!' : 'Grrr... My tummy is empty...'),
    specials: (g) => [
      g.has('honey') &&
        !g.done('bear') && {
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
                  go: () => N(['Cross my bridge. Walk up the hill.', 'It is the tall red and white tower!'], [{ text: 'Okay! I will go!', go: accept }]),
                },
              ])
            return N(['Honey! Yum, yum, yum!', 'Mmm... So sweet!', 'Thank you, Coji! My tummy is happy now.', 'I will move. You can cross the bridge!'], [
              { text: 'You are welcome, Bear!', go: offer },
              { text: 'Yay! I am so happy!', go: offer },
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
      start: { q: 'Hi, Bear! Are you okay?', a: ['Grrr... I am so hungry...'] },
      'bear.0': {
        q: 'Hi, Bear! Are you okay?',
        a: ['Grrr... I am so hungry...', 'My tummy is empty.'],
        more: {
          q: 'What do you want to eat?',
          a: ['Something sweet...', 'Something yummy...', 'Made by bees...'],
          clue: 'sweet',
          more: { q: 'Is it honey?', a: ['Yes! Honey! I want honey!'], clue: 'honey' },
        },
      },
      'bear.1': { q: 'I will get honey for you!', a: ['Honey... yes... please hurry...', 'Grrr... my tummy...'] },
      'bear.2': { q: 'Are you still hungry?', a: ['Yes... so hungry...'] },
      'light.0': { q: 'Where is the lighthouse?', a: ['Cross the bridge. Walk up the hill!'], clue: 'path' },
      'light.1': { q: 'Where can I find a bulb?', a: ['Hmm. Bears do not use bulbs.', 'Ask in the village!'] },
      'light.2': { q: 'Do you have a feather?', a: ['No, I have fur! Ha ha!', 'Owls have feathers.'], clue: 'hoot' },
      'light.3': { q: 'I have the bulb!', a: ['Go, go! Grandpa Gus is waiting!'] },
      end: { q: 'How is your tummy?', a: ['Happy and full!', 'Thank you for the honey, Coji!'] },
    },
  },

  gus: {
    name: 'Grandpa Gus',
    voice: 0.8,
    first: (g) => {
      if (g.stage() !== 'light.0') return null
      const help = () =>
        N(['I need a new bulb.', 'A big, bright one!', 'Can you find one for me?'], [
          { text: 'Yes! I will find a bulb!', go: () => N(['Thank you, Coji!', 'Ask in the village. Maybe a shop has one.']) },
          { text: 'I will try my best!', go: () => N(['Thank you, Coji!', 'Ask in the village. Maybe a shop has one.']) },
        ], {
          onShow: () => {
            g.clue('lamp')
            g.advance()
          },
        })
      return N(['Oh! Hello, little one. Who are you?'], [
        {
          text: 'I am Coji. Bear sent me!',
          go: () =>
            N(['Nice to meet you, Coji. I am Grandpa Gus.', 'Look at my lighthouse. The light is off.', 'The big bulb is broken!'], [
              { text: 'Can I help you?', go: help },
              { text: 'Oh no! What can we do?', go: help },
            ]),
        },
        {
          text: 'Hi! I am Coji.',
          go: () =>
            N(['Nice to meet you, Coji. I am Grandpa Gus.', 'Look at my lighthouse. The light is off.', 'The big bulb is broken!'], [
              { text: 'Can I help you?', go: help },
              { text: 'Oh no! What can we do?', go: help },
            ]),
        },
      ])
    },
    greet: (g) => (g.stage() === 'end' ? 'Hello, my lighthouse hero!' : 'Hello, Coji!'),
    specials: (g) => [
      g.has('bulb') && {
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
      'light.0': { q: 'Hello!', a: ['Hello, little one.'] },
      'light.1': {
        q: 'Where can I find a big bulb?',
        a: ['Hmm... Maybe a shop in the village?', 'Ask the people there.'],
        more: { q: 'Which shop?', a: ['Tina has lots of things in her shop.'], clue: 'toyshop' },
      },
      'light.2': { q: 'Tina has a bulb!', a: ['Wonderful!', 'Please bring it to me.'] },
      'light.3': { q: 'I am back!', a: ['Do you have the bulb?'] },
      end: { q: 'Look at the light!', a: ['Look, Coji! The light shines on the sea!', 'Thank you! You are a lighthouse hero!'] },
    },
  },
}

// ---------- building the conversation ----------

function topicFor(C, g) {
  const s = g.stage()
  let tp = C.topics?.[s]
  if (typeof tp === 'function') tp = tp(g)
  return tp || null
}

function chain(g, id, tp) {
  const choices = []
  if (tp.more) choices.push({ text: tp.more.q, go: () => chain(g, id, tp.more) })
  choices.push({ text: 'Thank you!', go: () => hub(g, id, 'You are welcome! Anything else?') })
  return N(tp.a, choices, {
    onShow: () => {
      if (tp.clue) for (const c of [].concat(tp.clue)) g.clue(c)
    },
  })
}

export function hub(g, id, line) {
  const C = CAST[id]
  const opts = []
  for (const s of C.specials ? C.specials(g) : []) if (s) opts.push(s)
  const tp = topicFor(C, g)
  if (tp) opts.push({ text: tp.q, go: () => chain(g, id, tp), pri: 5 })
  else if (C.chat) opts.push({ text: C.chat.q, go: () => chain(g, id, C.chat), pri: 2 })
  opts.sort((a, b) => (b.pri ?? 3) - (a.pri ?? 3))
  const pick = opts.slice(0, 2)
  pick.push({ text: 'Bye!', go: () => N(C.animal ? 'Bye-bye, Coji!' : 'Bye, Coji!') })
  return N(line, pick)
}

// Where a conversation starts.
export function talk(g, id) {
  const C = CAST[id]
  const s = g.stage()
  // Pip's welcome repeats until the first quest is taken; Gus explains his lamp when Coji arrives.
  if ((id === 'pip' && s === 'start') || (id === 'gus' && s === 'light.0')) {
    const n = C.first(g)
    if (n) return n
  }
  return hub(g, id, C.greet(g))
}
