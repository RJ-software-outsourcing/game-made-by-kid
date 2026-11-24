export const slots = [
  { id: 'brain', name: 'Tactical brain', short: 'Brain', icon: 'chip' },
  { id: 'motor', name: 'Drive motor', short: 'Wheels', icon: 'wheel' },
  { id: 'cell', name: 'Power cell', short: 'Battery', icon: 'battery' },
  { id: 'shell', name: 'Body shell', short: 'Armor', icon: 'shield' },
  { id: 'lens', name: 'Camera lens', short: 'Eyes', icon: 'eye' },
  { id: 'weapon', name: 'Arena weapon', short: 'Weapon', icon: 'wrench' }
]

const part = (name, price, tag, description, properties) => ({ name, price, tag, description, ...properties })
export const parts = {
  brain: [
    part('Rush Core', 22, 'Flank and dash', 'Swing to the side, then dash in for a hard hit.', {
      tempo: 1,
      draw: 1
    }),
    part('Orbit Core', 31, 'Wide circle', 'Race in a wide circle. Shoot or swipe as you pass.', {
      tempo: 1.24,
      draw: 1.2
    }),
    part(
      'Anchor Core',
      35,
      'Shield patrol',
      'Move to an open lane. Turn your shield toward a hit and push back.',
      { tempo: 1.06, draw: 0.65 }
    ),
    part('Zigzag Core', 32, 'Dodge and tap', 'Cut left, then right. Slip past a hit and tap twice.', {
      tempo: 1.32,
      draw: 0.84
    })
  ],
  motor: [
    part('Button Wheels', 11, 'Low cost', 'Little wheels roll slowly. They leave coins for other parts.', {
      speed: 1.65,
      force: 13
    }),
    part('Skates', 22, 'Fast', 'Race around the ring. Great for a bubble bot that needs room.', {
      speed: 2.75,
      force: 14
    }),
    part('Grippers', 29, 'Strong', 'Big treads push hard. They take longer to catch a fast bot.', {
      speed: 1.58,
      force: 22
    }),
    part(
      'Trail Wheels',
      40,
      'Fast and strong',
      'Wide wheels run fast and push hard. They cost lots of coins.',
      { speed: 2.55, force: 21 }
    )
  ],
  cell: [
    part(
      'Pocket Cell',
      10,
      'Low cost',
      'A little battery for little jobs. It needs a rest after a few hits.',
      { capacity: 32, regen: 4.6 }
    ),
    part('Spring Cell', 20, 'Quick refill', 'It fills up fast. Your bot can use its tool again soon.', {
      capacity: 37,
      regen: 8.1
    }),
    part(
      'Lunchbox Cell',
      27,
      'Big tank',
      'Start with lots of power. Great for a busy tool that taps twice.',
      { capacity: 65, regen: 5.4 }
    ),
    part('Twin Cells', 39, 'Big and quick', 'Two full cells keep your tool humming. They fill up fast too.', {
      capacity: 74,
      regen: 8.7
    })
  ],
  shell: [
    part('Eggshell', 10, 'Light', 'Your bot zips along. A hard bump can really shake it.', {
      hp: 82,
      armor: 0.01,
      mass: 0.93
    }),
    part('Bounce Vest', 22, 'Soft pads', 'Soft pads soak up bumps. Your wheels can still move easily.', {
      hp: 92,
      armor: 0.12,
      mass: 1
    }),
    part('Turtle Armor', 32, 'Heavy', 'Thick plates stop big hits. Heavy armor slows your wheels.', {
      hp: 112,
      armor: 0.23,
      mass: 1.24
    }),
    part('Honey Shell', 43, 'Light and tough', 'Little honeycomb pockets keep this shell strong and light.', {
      hp: 108,
      armor: 0.22,
      mass: 0.96
    })
  ],
  lens: [
    part(
      'Button Eye',
      9,
      'Looks ahead',
      'It sees what is straight ahead. A bot at your side may slip away.',
      { aim: 0.67, field: 92 }
    ),
    part('Wide Eyes', 19, 'Sees the sides', 'See left and right. Catch a bot that rolls around you.', {
      aim: 0.79,
      field: 118
    }),
    part('Hawk Eye', 27, 'Sharp aim', 'See a small target far ahead. Keep it in front of you.', {
      aim: 0.91,
      field: 78
    }),
    part(
      'Twin Eyes',
      38,
      'Wide and sharp',
      'Two sharp eyes see far and wide. It is hard to sneak past them.',
      { aim: 0.96, field: 110 }
    )
  ],
  weapon: [
    part('Bash Pad', 10, 'Close push', 'Get close and bump! Strong wheels give this soft pad a big push.', {
      reach: 1.52,
      power: 1.12,
      drain: 1,
      delay: 1
    }),
    part('Spin Brush', 18, 'Side sweep', 'Spin past their side. The soft brush can reach around a shield.', {
      reach: 1.91,
      power: 0.84,
      drain: 0.92,
      delay: 0.83
    }),
    part(
      'Bubble Popper',
      26,
      'Far shot',
      'Send a bubble from far away. Fast wheels help you stay out of reach.',
      { reach: 3.75, power: 0.78, drain: 1.22, delay: 1.14 }
    ),
    part(
      'Pulse Bell',
      32,
      'Ring wave',
      'Ring a bell to send out a wave. It shakes thick armor and needs lots of power.',
      { reach: 2.55, power: 1.04, drain: 1.5, delay: 1.29 }
    )
  ]
}
const bare = {
  brain: { name: 'Basic steering', tempo: 0.85, draw: 1.12 },
  motor: { name: 'Factory rollers', speed: 1.28, force: 10 },
  cell: { name: 'Built-in charge', capacity: 21, regen: 3.45 },
  shell: { name: 'Bare frame', hp: 68, armor: 0, mass: 0.91 },
  lens: { name: 'Basic sensor', aim: 0.52, field: 70 },
  weapon: { name: 'Body bump', reach: 1.48, power: 0.73, drain: 0.92, delay: 1.14 }
}
export const partFor = (id, index) => parts[id]?.[index] ?? { ...bare[id], price: 0 }
// Garage points come from the same part properties used by the bout.
// Reach, grip, field of view and refill rate describe how those points play.
const scales = [
  ['brain', 'Tactics', (p) => 60 * p.tempo],
  ['motor', 'Speed', (p) => 30 * p.speed],
  ['cell', 'Power', (p) => p.capacity],
  ['shell', 'Armor', (p) => 100 * (1 - ((1 - p.armor) * 50) / p.hp)],
  ['lens', 'Aim', (p) => 100 * p.aim],
  ['weapon', 'Attack', (p) => 70 * p.power]
]
export const statScales = Object.fromEntries(
  scales.map(([id, label, points]) => {
    const base = Math.round(points(bare[id]))
    return [id, [label, base, parts[id].map((p) => Math.round(points(p)) - base)]]
  })
)
export const partGain = (id, index) => statScales[id][2][index] ?? 0
export function comparePart(id, index, fitted) {
  const [stat, base] = statScales[id]
  const gain = partGain(id, index)
  const from = base + partGain(id, fitted), to = base + gain
  return { stat, gain, from, to, delta: to - from }
}
export function partReading(id, index, fitted = -1) {
  const item = parts[id][index]
  const { stat, gain, delta, from, to } = comparePart(id, index, fitted)
  const label = stat.toLowerCase()
  let change = `Adds ${gain} ${label} ${gain === 1 ? 'point' : 'points'}.`
  if (fitted >= 0 && fitted !== index) {
    const amount = Math.abs(delta)
    change = delta
      ? `Your ${label} goes from ${from} to ${to}. That's ${amount} ${delta > 0 ? 'more' : 'fewer'} ${amount === 1 ? 'point' : 'points'}.`
      : `Your ${label} stays at ${from}.`
  }
  return [`${item.name}. ${item.price} coins.`, change, item.description]
}
export const readPart = (id, index, fitted) => partReading(id, index, fitted).join(' ')
export const makeBuild = (_cpu, brain, motor, cell, shell, lens, weapon = 0, chassis = 0) =>
  normalizeBuild({ brain, motor, cell, shell, lens, weapon, chassis })
const letters =
  typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null
export function limitNameInput(value) {
  if (typeof value !== 'string') return ''
  let text = '',
    count = 0
  for (const entry of letters ? letters.segment(value) : value) {
    if (count++ === 16) break
    text += letters ? entry.segment : entry
  }
  return text
}
export function cleanName(value) {
  if (typeof value !== 'string') return ''
  const text = value
    .normalize('NFC')
    .replace(/\s+/gu, ' ')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, '')
    .trim()
  return limitNameInput(text).trim()
}
export function normalizeBuild(build) {
  if (!build) return build
  const brain = build.brain ?? build.logic ?? build.cpu
  const { cpu, logic, ...rest } = build
  return {
    weapon: 0,
    chassis: 0,
    ...rest,
    ...(build.name !== undefined ? { name: cleanName(build.name) } : {}),
    brain
  }
}
export const bareBuild = (chassis = 3) => makeBuild(-1, -1, -1, -1, -1, -1, -1, chassis)
export const starter = makeBuild(0, 0, 0, 0, 1, 0)
export const withPart = (build, id, index) => normalizeBuild({ ...build, [id]: index })
export function buyPart(build, id, index, budget) {
  if (!slots.some((s) => s.id === id) || build[id] !== -1 || !Number.isInteger(index) || !parts[id]?.[index])
    return null
  return cost(build) + parts[id][index].price <= budget ? withPart(build, id, index) : null
}
export function sellPart(build, id) {
  return slots.some((s) => s.id === id) && build[id] >= 0 ? withPart(build, id, -1) : null
}
export const frames = [
  { name: 'Rivet', note: 'One big press arm and one little claw guard a side cab.', center: 0.86 },
  { name: 'Rover', note: 'Low wheel pods tuck under a wedge of steel.', center: 0.71 },
  { name: 'Rotor', note: 'A round steel collar wraps around a low turret.', center: 0.8 },
  { name: 'Knuckle', note: 'Two silver piston arms hang from wide steel shoulders.', center: 0.96 },
  { name: 'Strider', note: 'Wide legs hold up a triangle frame. Its arms reach out front.', center: 0.9 },
  { name: 'Comet', note: 'Two spring arms sit beside a pointed nose and tall tail fins.', center: 0.69 }
]
export const botName = (build) => cleanName(build.name) || frames[build.chassis ?? 0].name
export function ringName(build, rival) {
  const name = botName(build)
  return name.localeCompare(rival, undefined, { sensitivity: 'base' }) === 0 ? 'Your ' + name : name
}
export const rounds = [
  {
    stage: 'Round of 16',
    budget: 124,
    rival: 'Buckler',
    code: 'TUK',
    color: '#eca044',
    build: makeBuild(0, 2, 0, 0, 2, 1, 0, 4),
    habit: 'Patrols the ring with a thick shield.',
    hint: 'Circle around the shield, or send bubbles from far away.',
    focus: 'brain'
  },
  {
    stage: 'Quarterfinal',
    budget: 161,
    rival: 'Whirl',
    code: 'ZIP',
    color: '#71b9d5',
    build: makeBuild(0, 1, 1, 2, 1, 2, 2, 1),
    habit: 'Circles wide and sends bubbles.',
    hint: 'Whirl stays far away. Rush in with a bell, or try fast wheels and bubbles.',
    focus: 'weapon'
  },
  {
    stage: 'Semifinal',
    budget: 190,
    rival: 'Bramble',
    code: 'POM',
    color: '#cb6571',
    build: makeBuild(1, 3, 2, 2, 2, 1, 1, 3),
    habit: 'Cuts across the ring and sweeps twice.',
    hint: 'Bramble is heavy. Stay away and send bubbles, or guard up close.',
    focus: 'weapon'
  },
  {
    stage: 'Final',
    budget: 205,
    rival: 'Goldcap',
    code: 'REX',
    color: '#efb546',
    build: makeBuild(3, 2, 2, 3, 2, 3, 3, 5),
    habit: 'Guards a lane and rings a heavy bell.',
    hint: 'The bell needs power. Keep out of its reach, or circle past the shield.',
    focus: 'weapon'
  }
]
// The first release promised 235 coins for its final. A tournament already
// saved under that purse keeps it through the podium, including its replays.
const originalFinal = { ...rounds.at(-1), budget: 235 }
export function cupRound(cup, stage = cup?.round) {
  return stage === rounds.length - 1 && cup?.finalBudget === originalFinal.budget
    ? originalFinal : rounds[stage]
}
export const cost = (build) => slots.reduce((sum, s) => sum + partFor(s.id, build[s.id]).price, 0)
export function validBuild(build, budget) {
  return (
    build &&
    (build.chassis === undefined ||
      (Number.isInteger(build.chassis) && build.chassis >= 0 && build.chassis < frames.length)) &&
    slots.every(({ id }) => Number.isInteger(build[id]) && (build[id] === -1 || parts[id][build[id]])) &&
    cost(build) <= budget
  )
}
export function stats(build) {
  const motor = partFor('motor', build.motor),
    shell = partFor('shell', build.shell),
    cell = partFor('cell', build.cell),
    cpu = partFor('brain', build.brain ?? build.logic)
  return {
    tool: partFor('weapon', build.weapon ?? 0),
    speed: motor.speed / shell.mass,
    force: motor.force,
    hp: shell.hp,
    armor: shell.armor,
    mass: shell.mass,
    regen: cell.regen,
    capacity: cell.capacity,
    tempo: cpu.tempo,
    draw: cpu.draw,
    aim: partFor('lens', build.lens).aim,
    field: partFor('lens', build.lens).field
  }
}

export function strikeForce(build, s = stats(build)) {
  if (build.weapon === 2) return 13.4 + 0.15 * s.force
  if (build.weapon === 3) return 12 + s.force * 0.42
  return s.force
}
// Coaching may simulate a refit. The shop still requires two separate trades.
export function quoteSwap(build, id, index, budget) {
  const next = withPart(build, id, index)
  const delta = partFor(id, index).price - partFor(id, build[id]).price
  const remaining = budget - cost(next)
  return { next, delta, remaining, shortfall: Math.max(0, -remaining) }
}
