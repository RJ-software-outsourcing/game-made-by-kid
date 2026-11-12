// Numbers to tune the game, and the colors of Coji's clothes.

// Kang Chiao sports uniform (from the photo): cream shirt with navy stripes (each with a thin white
// line), navy raglan shoulders/sleeves with white piping, navy V collar, school crest, navy shorts.
export const UNIFORM = {
  shirt: '#efe3c2',
  stripe: '#1c2340',
  stripeLine: '#ffffff',
  navy: '#1c2340',
  piping: '#ffffff',
  crest: '#e0b23a',
  shorts: '#1c2340',
  socks: '#ffffff',
  shoes: '#2a3768',
  soles: '#ffffff',
}

// Blankie Bear (被被熊): pale gray knit blanket with light-blue stripes and a little bear head.
export const BLANKIE = {
  knit: '#d9dcdc',
  stripe: '#aac4de',
  rib: '#cfd3d4',
  head: '#dedfdc',
  ears: '#a6bdd8',
  muzzle: '#ecebe6',
  features: '#86644e',
}

export const COJI = {
  skin: '#ffd7bf',
  hair: '#17171c',
  cheeks: '#f7a3a0',
}

export const TUNE = {
  walkSpeed: 6.4, // m/s
  tiredSpeed: 4.2, // when energy < 15
  energyPerMeter: 0.12,
  waterPerMeter: 0.14,
  waterPerSecond: 0.03,
  restPerSecond: 3,
  benchBonus: 1.5,
  napTo: 25,
  start: { energy: 100, water: 100, coins: 3 },
  shellRespawn: 120, // seconds
  treeRegrow: 75,
  bushRegrow: 60,
  carrotRegrow: 45,
}

// Energy cost multiplier from water (more water = less tiring).
export function energyCostFactor(water) {
  if (water <= 0) return 2
  if (water < 30) return 1.5
  if (water < 60) return 1
  return 0.7
}
// Rest speed multiplier from water.
export function restFactor(water) {
  if (water < 30) return 0.5
  if (water < 60) return 1
  return 1.6
}
