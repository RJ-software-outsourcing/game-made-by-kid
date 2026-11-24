// The first name is the robot that performed the action. Each sentence can
// be read in one breath and says exactly what the simulation observed.
const scripts = {
  counter: [
    (a, b) => a + ' blocks ' + b + ', then hits right back!',
    (a, b) => b + ' hits the shield. ' + a + ' pushes back!'
  ],
  flank: [
    (a, b) => a + ' gets around ' + b + ' and lands a hit!',
    (a, b) => a + ' tags ' + b + ' from the side!'
  ],
  evaded: [
    (a, b) => a + ' dodges! ' + b + ' misses!',
    (a, b) => 'What a dodge by ' + a + '! ' + b + ' misses!'
  ],
  waveHit: [
    (a, b) => a + ' catches ' + b + ' with a sound wave!',
    (a, b) => 'That sound wave from ' + a + ' hits ' + b + '!'
  ],
  reasonRecharge: [
    (a, b) => a + ' leads! It hit ' + b + ' during a refill.',
    (a, b) => a + ' is ahead. It scored while ' + b + ' was charging up.'
  ],
  reasonWheels: [
    (a, b) => a + ' has the lead! Those fast wheels dodged a hit from ' + b + '.',
    (a, b) => b + ' missed that quick dodge! ' + a + ' has faster wheels and the lead.'
  ],
  reasonArmor: [
    (a, b) => a + ' leads! Its armor soaked up part of a hit from ' + b + '.',
    (a, b) => a + ' is ahead. Its thick shell softened a hit from ' + b + '!'
  ],
  shortSwing: [
    (a, b) => b + ' swings! ' + a + ' is out of reach!',
    (a, b) => 'Just short! ' + b + ' could not reach ' + a + '!'
  ],
  reasonReach: [
    (a, b) => a + ' leads! It hits from far away. ' + b + ' cannot reach that far!',
    (a, b) => 'Look at that reach! ' + a + ' hit from far away while ' + b + ' swung short!'
  ]
}

export const duelKinds = Object.keys(scripts)
export const duelKey = (home, rival) => home.toLowerCase() + '-' + rival.toLowerCase()
export function duelWords(kind, side, names, variant) {
  const words = scripts[kind]?.[variant]
  return words ? words(names[side], names[1 - side]) : ''
}
