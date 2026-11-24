// Frame-specific carriers, suspension, optics, armor and articulated press arms.
import * as T from '../vendor/three.module.js'
import { colors, finishes, facePlate, armorCowl } from './robot-forms.js'
import {
  reflect,
  hose,
  rivet,
  shield,
  taperSleeve,
  ram,
  boltedHub,
  palmShoe,
  triangleTruss,
  louver,
  landingPlate,
  ringSection,
  spring,
  knuckleDrive,
  knucklePalm,
  knuckleCarrier,
  knuckleArm,
  knuckleBridge,
  wristStroke,
  alloy,
  bright,
  gun,
  black,
  copper,
  oil,
  tau,
  lerp
} from './robot-contenders.js'
export { wristStroke, stockWheel } from './robot-contenders.js'
const { graphite, rubber, darkSteel, steel } = colors
const { porcelain, lacquer, metal, soft, lit, glass } = finishes
const guardProfiles = [
  { x: 0.218, y: 0.229, z: 0.237, w: 0.79, h: 0.79, d: 0.42, flank: 0.329 },
  { x: 0.273, y: 0.105, z: 0.492, w: 0.95, h: 0.62, d: 0.91, flank: 0.419 },
  { x: 0.272, y: 0.175, z: 0.389, w: 0.87, h: 0.56, d: 0.53, flank: 0.522 },
  { x: 0.208, y: 0.294, z: 0.135, w: 0.78, h: 0.75, d: 0.4, flank: 0.335 },
  { x: 0.327, y: 0.267, z: 0.137, w: 1.04, h: 0.72, d: 0.41, flank: 0.504 },
  { x: 0.236, y: 0.178, z: 0.321, w: 0.76, h: 0.77, d: 0.72, flank: 0.375 }
]
export function serviceArmor(p, c, t) {
  const { x, y, z, w, h, d, flank } = guardProfiles[c]
  for (const s of [-1, 1]) {
    const front = (name, points, at, peak, coating) => {
      shield(
        p,
        name + ' ' + c + ' ' + s,
        points.map(([u, v]) => [s * u * w, v * h]),
        at,
        0.075,
        [s * peak[0] * w, peak[1] * h, peak[2]],
        coating
      )
    }
    if (t === 0) {
      front(
        'sacrificial corner',
        [
          [-0.072, 0.073],
          [0.087, 0.091],
          [0.143, 0.048],
          [0.111, -0.094],
          [-0.033, -0.102],
          [-0.073, -0.022]
        ],
        [s * x, y, z + 0.033],
        [0.05, 0.031, 0.033],
        p.paint.coat
      )
      p.rod(
        [s * (x + 0.06), y + 0.025, z - 0.011],
        [s * flank, y + 0.032, z - 0.25 * d],
        0.025,
        gun,
        metal,
        10
      )
    } else if (t === 1) {
      // The elastomer ribs are separated by steel hoops; the middle stays open.
      for (let j = 0; j < 3; j++) {
        const xx = x + 0.018 * j,
          yy = y + 0.05 - j * 0.048
        p.block([s * xx, yy, z + 0.082 - j * 0.025], [w * 0.231, 0.046, 0.086], 0.018, graphite, soft, [
          -0.17,
          s * 0.31,
          -s * 0.12
        ])
      }
      p.rod(
        [s * (x - 0.079), y + 0.052, z + 0.113],
        [s * (x - 0.018), y - 0.087, z + 0.063],
        0.021,
        p.paint,
        metal,
        9
      )
      p.rod(
        [s * (x + 0.104), y + 0.039, z + 0.076],
        [s * flank, y - 0.014, z - 0.39 * d],
        0.039,
        p.paint.coat,
        soft,
        10
      )
    } else if (t === 2) {
      const scale = [
        [-0.133, 0.07],
        [-0.083, 0.135],
        [0.13, 0.101],
        [0.181, 0.031],
        [0.134, -0.076],
        [0.034, -0.124],
        [-0.108, -0.069]
      ]
      for (let j = 0; j < 2; j++) {
        front(
          'layered scute ' + j,
          scale,
          [s * (x + 0.044 * j), y - 0.064 * j, z + 0.082 - 0.044 * j],
          [0.039, 0.068, 0.054],
          j ? p.paint.coat : p.paint
        )
        rivet(p, s * (x + 0.071 + 0.043 * j), y + 0.067 - 0.064 * j, z + 0.124 - 0.044 * j, 0.016)
      }
      p.rod(
        [s * (x + 0.117), y + 0.033, z + 0.044],
        [s * flank, y + 0.087, z - 0.46 * d],
        0.034,
        alloy,
        metal,
        10
      )
    } else {
      // Cut-through triangular lattice: each cell remains open to the frame.
      const a = [s * (x - 0.091 * w), y + 0.036, z + 0.08],
        b = [s * (x - 0.043 * w), y + 0.128 * h, z + 0.096],
        k = [s * (x + 0.159 * w), y + 0.076 * h, z + 0.023],
        m = [s * (x + 0.129 * w), y - 0.103 * h, z + 0.045],
        n = [s * (x - 0.039 * w), y - 0.096 * h, z + 0.102]
      for (const [v, vv] of [
        [a, b],
        [b, k],
        [k, m],
        [m, n],
        [n, a],
        [a, k],
        [a, m]
      ])
        p.rod(v, vv, 0.024, p.paint, metal, 6)
      p.rod(k, [s * flank, y + 0.024, z - 0.364 * d], 0.027, p.paint.coat, metal, 8)
      for (const q of [b, k, n]) p.cylinder(q, 0.028, 0.029, alloy, 'z', metal, 6)
    }
    rivet(p, s * x, y + 0.021, z + 0.103, t === 0 ? 0.013 : 0.017)
  }
}
function rivetCarrier(p) {
  // A gantry on two close wheel legs carries an offset optical pod, balanced
  // by a rear power bridge. The diagonal rods leave the central bay visible.
  armorCowl(
    p,
    'rivet central transmission',
    [0, -0.07, -0.02],
    0.385,
    0.371,
    -0.105,
    0.02,
    0.056,
    0.065,
    gun,
    metal
  )
  p.cylinder([0, 0.054, -0.04], 0.066, 0.211, alloy, 'y', metal, 12)
  for (const s of [-1, 1]) {
    triangleTruss(p, [s * 0.142, -0.051, -0.153], [s * 0.33, 0.312, -0.184], [s * 0.217, 0.067, 0.104], 0.027)
    triangleTruss(
      p,
      [s * 0.13, 0.007, 0.122],
      [s * 0.283, 0.319, 0.083],
      [s * 0.33, 0.312, -0.184],
      0.023,
      gun
    )
    landingPlate(p, 'gantry segment ', s, [s * 0.237, 0.241, 0.148], 0.264, 0.285, 0.146, p.paint)
    p.rod([s * 0.113, 0.219, 0.187], [s * 0.264, 0.312, 0.121], 0.022, alloy, metal, 10)
    louver(p, s, 0.219, 0.22, 0.207, 2)
    ram(p, [s * 0.255, 0.049, -0.139], [s * 0.303, 0.338, -0.184], 0.035, darkSteel)
    hose(
      p,
      [
        [s * 0.148, 0.007, -0.123],
        [s * 0.287, 0.042, -0.234],
        [s * 0.355, 0.215, -0.205],
        [s * 0.301, 0.358, -0.144]
      ],
      0.017
    )
    p.rod([s * 0.277, 0.317, -0.096], [s * 0.184, 0.428, -0.075], 0.035, gun, metal, 10)
  }
  p.rod([-0.325, 0.352, -0.125], [0.335, 0.352, -0.125], 0.046, alloy, metal, 12)
  armorCowl(
    p,
    'rivet ballast tower',
    [0.224, 0.282, -0.102],
    0.221,
    0.286,
    -0.041,
    0.146,
    0.211,
    0.057,
    p.paint,
    porcelain
  )
  for (let i = 0; i < 4; i++)
    p.block([0.243, 0.347 + i * 0.032, 0.04], [0.122, 0.015, 0.031], 0.003, gun, metal)
  p.rod([0.117, 0.247, -0.169], [0.416, 0.409, -0.066], 0.049, gun, metal, 12)
  p.rod([-0.277, 0.28, 0.149], [-0.366, 0.248, 0.108], 0.032, alloy, metal, 10)
  p.cylinder([-0.157, 0.418, -0.036], 0.074, 0.089, gun, 'y', metal, 12)
}
function crawlerCarrier(p) {
  // Paired track pontoons and a suspended differential below an exposed deck.
  armorCowl(p, 'crawler belly skid', [0, -0.064, 0], 0.537, 0.969, -0.097, 0.028, 0.083, 0.104, gun, metal)
  for (const s of [-1, 1]) {
    armorCowl(
      p,
      'crawler side pontoon',
      [s * 0.321, 0.002, -0.029],
      0.216,
      1.037,
      -0.086,
      0.067,
      0.173,
      0.083,
      p.paint,
      porcelain
    )
    armorCowl(
      p,
      'pontoon rub rail',
      [s * 0.391, -0.01, -0.049],
      0.092,
      1.034,
      -0.055,
      0.025,
      0.106,
      0.041,
      gun,
      metal
    )
    p.rod([s * 0.258, 0.105, -0.312], [s * 0.233, 0.106, 0.303], 0.032, alloy, metal, 10)
    p.rod([s * 0.254, 0.141, -0.387], [s * 0.079, 0.042, -0.214], 0.022, copper, metal, 8)
    for (const z of [-0.349, 0.266]) {
      triangleTruss(
        p,
        [s * 0.263, 0.075, z - 0.075],
        [s * 0.458, -0.085, z + 0.013],
        [s * 0.281, 0.158, z + 0.121],
        0.024,
        alloy
      )
      ram(p, [s * 0.32, 0.153, z - 0.015], [s * 0.463, -0.046, z + 0.087], 0.044, gun)
      p.cylinder([s * 0.461, -0.052, z + 0.082], 0.054, 0.046, alloy, 'x', metal, 10)
    }
    landingPlate(p, 'split dozer beak ', s, [s * 0.192, 0.061, 0.414], 0.352, 0.204, 0.261, p.paint.coat)
    p.rod([s * 0.055, -0.019, 0.51], [s * 0.337, -0.018, 0.452], 0.04, gun, metal, 9)
    armorCowl(
      p,
      'rear gearbox cover',
      [s * 0.221, 0.07, -0.401],
      0.223,
      0.23,
      -0.038,
      0.053,
      0.117,
      0.066,
      gun,
      metal
    )
    hose(
      p,
      [
        [s * 0.259, 0.104, -0.341],
        [s * 0.103, 0.091, -0.346],
        [s * 0.098, 0.134, -0.233],
        [s * 0.181, 0.148, -0.203]
      ],
      0.015
    )
  }
  p.rod([-0.378, 0.012, 0.389], [0.378, 0.012, 0.389], 0.048, alloy, metal, 10)
  p.cylinder([0, 0.109, -0.034], 0.135, 0.113, gun, 'y', metal, 16)
}
function rotorCarrier(p) {
  ringSection(p, 'raceway', 0.499, 0.322, 0.069, 0.144, 0, tau, gun, metal)
  ringSection(p, 'lower brass track', 0.485, 0.451, 0.016, 0.052, 0, tau, copper, metal)
  for (let j = 0; j < 6; j++) {
    const a = ((j + 0.5) * tau) / 6,
      ss = Math.sin(a),
      cc = Math.cos(a)
    p.rod([0.17 * ss, -0.021, 0.17 * cc], [0.461 * ss, 0.049, 0.461 * cc], 0.041, alloy, metal, 10)
    p.cylinder([0.378 * ss, 0.063, 0.378 * cc], 0.057, 0.064, graphite, 'y', soft, 12)
    p.cylinder([0.378 * ss, 0.103, 0.378 * cc], 0.028, 0.028, gun, 'y', metal, 8)
  }
  p.cylinder([0, 0.023, 0], 0.135, 0.207, gun, 'y', metal, 12)
  for (const s of [-1, 1]) {
    landingPlate(p, 'rotor bearing fairing ', s, [s * 0.324, 0.122, 0.223], 0.233, 0.158, 0.177, p.paint)
    triangleTruss(p, [s * 0.18, 0.088, -0.023], [s * 0.431, 0.154, -0.129], [s * 0.362, 0.094, -0.228], 0.022)
  }
}
function siegeCarrier(p) {
  // Two cantilever booms over a ladder-like bridge. The center is deliberately
  // open beneath its little sensor car, revealing opposing diagonal actuators.
  p.rod([-0.521, 0.326, -0.137], [0.521, 0.326, -0.137], 0.038, alloy, metal, 10)
  p.rod([-0.495, 0.238, 0.051], [0.495, 0.238, 0.051], 0.042, gun, metal, 12)
  for (const s of [-1, 1]) {
    const heel = [s * 0.205, -0.104, -0.069],
      peak = [s * 0.452, 0.357, -0.165],
      toe = [s * 0.473, 0.264, 0.07]
    triangleTruss(p, heel, peak, toe, 0.032, alloy)
    triangleTruss(p, [s * 0.205, -0.075, 0.105], toe, [s * 0.124, 0.25, -0.163], 0.028, gun)
    ram(p, [s * 0.229, -0.047, 0.091], [s * 0.376, 0.217, 0.041], 0.037, s < 0 ? copper : alloy)
    armorCowl(
      p,
      'boom cap',
      [s * 0.355, 0.284, -0.111],
      0.433,
      0.321,
      -0.041,
      0.054,
      0.115,
      0.073,
      p.paint,
      porcelain
    )
    landingPlate(p, 'boom counterweight ', s, [s * 0.449, 0.282, -0.187], 0.217, 0.192, 0.165, p.paint.coat)
    p.block([s * 0.362, 0.361, -0.109], [0.217, 0.021, 0.092], 0.01, gun, metal)
    hose(
      p,
      [
        [s * 0.441, 0.28, 0.023],
        [s * 0.508, 0.129, 0.073],
        [s * 0.459, 0.04, 0.035],
        [s * 0.298, 0.135, -0.047]
      ],
      0.02
    )
    p.rod([s * 0.122, 0.276, -0.18], [s * 0.044, 0.428, -0.05], 0.027, steel, metal, 9)
  }
  armorCowl(
    p,
    'siege hip differential',
    [0, -0.112, -0.05],
    0.413,
    0.371,
    -0.071,
    0.072,
    0.093,
    0.065,
    gun,
    metal
  )
  p.cylinder([0, 0.385, -0.054], 0.07, 0.106, gun, 'y', metal, 12)
  p.cylinder([-0.028, 0.091, -0.106], 0.074, 0.174, gun, 'y', metal, 10)
  p.cylinder([-0.028, 0.111, -0.106], 0.083, 0.034, copper, 'y', metal, 12)
  for (const s of [-1, 1]) {
    p.rod([s * 0.098, 0.064, -0.045], [s * 0.043, 0.251, -0.034], 0.025, alloy, metal, 10)
    p.rod([s * 0.114, 0.06, -0.159], [s * 0.158, 0.235, -0.178], 0.017, gun, metal, 8)
  }
}
function cometCarrier(p) {
  // A rear counterweight balances two offset forward press booms. The tool
  // spring, service loop and drive chain are visible from either side.
  armorCowl(p, 'interceptor skeg', [0, -0.049, -0.07], 0.379, 0.674, -0.109, 0.085, 0.118, 0.09, gun, metal)
  for (const s of [-1, 1]) {
    const rear = [s * 0.186, 0.259, -0.336],
      nose = [s * 0.161, 0.052, 0.411]
    p.rod(rear, nose, 0.046, gun, metal, 10)
    p.rod([s * 0.272, 0.066, -0.283], nose, 0.026, alloy, metal, 10)
    p.rod([s * 0.165, -0.019, 0.03], rear, 0.033, alloy, metal, 10)
    landingPlate(p, 'forward chine ', s, [s * 0.203, 0.155, 0.258], 0.22, 0.187, 0.299, p.paint)
    shield(
      p,
      'tail fin ' + s,
      reflect(
        [
          [-0.075, 0.185],
          [0.015, 0.199],
          [0.119, -0.03],
          [0.055, -0.074],
          [-0.092, -0.045]
        ],
        s
      ),
      [s * 0.243, 0.206, -0.313],
      0.193,
      [s * 0.026, 0.039, 0.039],
      p.paint.coat
    )
    boltedHub(p, s, 0.332, 0.156, -0.01 + s * 0.095, 0.082)
    p.rod([s * 0.171, 0.147, -0.116], [s * 0.431, 0.197, 0.03 + s * 0.1], 0.04, gun, metal, 10)
    hose(
      p,
      [
        [s * 0.352, 0.18, -0.042],
        [s * 0.336, 0.001, -0.138],
        [s * 0.206, 0.008, -0.309],
        [s * 0.171, 0.132, -0.313]
      ],
      0.018
    )
  }
  p.rod([-0.271, 0.112, -0.281], [0.271, 0.112, -0.281], 0.047, gun, metal, 10)
  p.cylinder([0, 0.185, -0.066], 0.105, 0.111, alloy, 'y', metal, 14)
}
export const carriers = [
  rivetCarrier,
  crawlerCarrier,
  rotorCarrier,
  knuckleCarrier,
  siegeCarrier,
  cometCarrier
]

export function sensorBridge(p, c) {
  if (c === 3) {
    knuckleBridge(p)
    return
  }
  if (c === 0) {
    armorCowl(
      p,
      'offset operator hood',
      [-0.038, -0.003, -0.042],
      0.746,
      0.613,
      -0.117,
      0.11,
      0.229,
      0.119,
      p.paint,
      porcelain
    )
    for (const s of [-1, 1]) {
      p.rod([s * 0.334, -0.026, 0.172], [s * 0.284, 0.129, -0.236], 0.03, alloy, metal, 10)
      p.cylinder([s * 0.347, -0.026, 0.103], 0.068, 0.061, gun, 'x', metal, 12)
    }
    p.block([0.177, 0.151, -0.121], [0.13, 0.069, 0.208], 0.014, gun, metal, [-0.15, 0, 0])
  } else if (c === 1) {
    armorCowl(
      p,
      'low periscope base',
      [0, -0.057, -0.049],
      0.782,
      0.656,
      -0.074,
      0.063,
      0.193,
      0.145,
      gun,
      metal
    )
    for (const s of [-1, 1]) {
      armorCowl(
        p,
        'periscope fairing',
        [s * 0.256, 0.012, -0.044],
        0.253,
        0.585,
        -0.039,
        0.031,
        0.141,
        0.077,
        p.paint,
        porcelain
      )
      p.rod([s * 0.301, 0.045, 0.21], [s * 0.291, 0.154, -0.215], 0.019, alloy, metal, 8)
    }
  } else if (c === 2) {
    ringSection(p, 'rotating upper race', 0.51, 0.34, -0.045, 0.02, 0, tau, gun, metal)
    for (let i = 0; i < 4; i++) {
      const a = ((0.4 + i) * tau) / 4
      ringSection(p, 'painted sector', 0.529, 0.352, 0.01, 0.102, a - 0.48, a + 0.49, p.paint, porcelain)
      ringSection(
        p,
        'retainer strip',
        0.526,
        0.497,
        0.074,
        0.114,
        a - 0.29,
        a + 0.15,
        p.paint.coat,
        porcelain
      )
      p.cylinder([0.423 * Math.sin(a), 0.11, 0.423 * Math.cos(a)], 0.023, 0.013, alloy, 'y', metal, 6)
    }
    // Only two ribs span the rotary table, leaving the bearing aperture open.
    for (const s of [-1, 1])
      p.rod([s * 0.309, 0.015, -0.176], [s * 0.078, 0.047, 0.313], 0.025, alloy, metal, 10)
    p.block([0, 0.065, 0.303], [0.252, 0.141, 0.191], 0.017, gun, metal)
  } else if (c === 4) {
    armorCowl(
      p,
      'sensor car crucible',
      [0, -0.058, -0.044],
      0.8,
      0.539,
      -0.108,
      0.08,
      0.164,
      0.099,
      gun,
      metal
    )
    for (const s of [-1, 1]) {
      landingPlate(p, 'sensor car brow ', s, [s * 0.239, 0.049, 0.042], 0.277, 0.145, 0.273, p.paint)
      p.rod([s * 0.361, -0.057, 0.175], [s * 0.299, 0.11, -0.178], 0.035, alloy, metal, 10)
    }
  } else {
    armorCowl(
      p,
      'cantilever nose bridge',
      [0, -0.059, -0.125],
      0.548,
      0.664,
      -0.069,
      0.068,
      0.18,
      0.094,
      gun,
      metal
    )
    for (const s of [-1, 1]) {
      armorCowl(
        p,
        'intake wing',
        [s * 0.181, 0.011, -0.088],
        0.158,
        0.627,
        -0.049,
        0.059,
        0.215,
        0.065,
        p.paint,
        porcelain
      )
      p.rod([s * 0.217, -0.017, 0.203], [s * 0.201, 0.168, -0.287], 0.024, alloy, metal, 9)
    }
  }
  const at = c === 2 ? 0.12 : 0
  p.block([-0.023, 0.006, 0.253 + at], [0.444, 0.151, 0.094], 0.017, black, soft)
  p.block([-0.083, 0.013, 0.31 + at], [0.19, 0.071, 0.045], 0.009, '#23373d', glass)
  p.block([0.104, 0.022, 0.308 + at], [0.108, 0.051, 0.037], 0.009, '#293d40', glass)
}
const opticProfiles = [
  [-0.021, 0.022, 0.95],
  [-0.09, 0.0, 0.91],
  [0.029, 0.04, 0.84],
  [-0.013, 0.028, 0.88],
  [0.033, 0.017, 0.91],
  [-0.055, 0.021, 0.82]
]
export function integratedOptic(p, c, t) {
  const [off, y, w] = opticProfiles[c]
  const poly = [
    [-0.409, 0.049],
    [-0.329, 0.118],
    [0.235, 0.111],
    [0.38, 0.044],
    [0.307, -0.073],
    [-0.331, -0.072]
  ]
  shield(
    p,
    'optic seat ' + c,
    poly.map(([x, h]) => [x * w, h]),
    [off, y, 0.331],
    0.107,
    [0, 0.017, 0.015],
    gun,
    metal
  )
  if (t === 0) {
    facePlate(
      p,
      'simple sensor window ' + c,
      [
        [-0.2, -0.042],
        [0.15, -0.042],
        [0.23, 0.011],
        [0.13, 0.061],
        [-0.203, 0.045]
      ],
      [off, y, 0.35],
      0.032,
      '#192e35',
      glass
    )
    for (const s of [-1, 1])
      p.cylinder([off + s * 0.259, y + 0.009, 0.353], 0.025, 0.024, alloy, 'z', metal, 6)
  } else if (t === 1) {
    // Three actual panes meet at an angle like a protective windscreen.
    for (const [j, rot] of [
      [-1, -0.21],
      [0, 0],
      [1, 0.21]
    ]) {
      p.block(
        [off + j * 0.166, y + 0.015, 0.372 - Math.abs(j) * 0.018],
        [0.162, 0.085, 0.052],
        0.01,
        '#152e36',
        glass,
        [0, rot, 0]
      )
      p.block(
        [off + j * 0.166, y + 0.067, 0.371 - Math.abs(j) * 0.018],
        [0.157, 0.02, 0.038],
        0.004,
        p.paint.coat,
        porcelain,
        [0, rot, 0]
      )
    }
  } else if (t === 2) {
    const z = 0.412
    p.cylinder([off + 0.092, y + 0.012, z], 0.107, 0.152, gun, 'z', metal, 8)
    p.cylinder([off + 0.092, y + 0.012, z + 0.069], 0.102, 0.051, p.paint, 'z', porcelain, 10)
    p.cylinder([off + 0.092, y + 0.012, z + 0.099], 0.075, 0.019, '#204049', 'z', glass, 12)
    p.ring([off + 0.092, y + 0.012, z + 0.105], 0.082, 0.008, alloy, 'z')
    for (let j = 0; j < 3; j++)
      p.block(
        [off - 0.125 + j * 0.035, y + 0.013, 0.374],
        [0.019, 0.066, 0.047],
        0.004,
        steel,
        metal,
        [-0.13, 0, 0]
      )
  } else {
    for (const s of [-1, 1]) {
      const cX = off + s * 0.142
      p.cylinder([cX, y + 0.017, 0.375], 0.081, 0.09, gun, 'z', metal, 6)
      p.cylinder([cX, y + 0.017, 0.419], 0.063, 0.015, '#1c3740', 'z', glass, 6)
      p.block([cX, y + 0.088, 0.398], [0.119, 0.025, 0.049], 0.006, s < 0 ? p.paint : p.paint.coat, porcelain)
    }
  }
}
export function sensorLight(p, c, t, victory) {
  const glow = victory ? '#ffd087' : '#a2e4d7',
    [off, y] = opticProfiles[c]
  if (t < 0) {
    const z = c === 3 ? 0.363 : 0.338
    p.block([-0.084, 0.001, z], [0.103, 0.018, 0.006], 0.002, glow, lit, [0, 0, 0.15])
    p.block([0.11, 0.007, z - 0.004], [0.023, 0.025, 0.007], 0.003, glow, lit)
  } else if (t === 0) {
    p.block([off - 0.051, y - 0.008, 0.393], [0.154, 0.02, 0.007], 0.002, glow, lit, [0, 0, -0.06])
    p.block([off + 0.111, y + 0.002, 0.392], [0.031, 0.027, 0.006], 0.002, glow, lit)
  } else if (t === 1) {
    for (let i = -1; i <= 1; i++)
      p.block(
        [off + i * 0.166, y - 0.003, 0.402 - Math.abs(i) * 0.018],
        [i === 1 ? 0.055 : 0.088, 0.014, 0.007],
        0.002,
        glow,
        lit,
        [0, i * 0.21, 0]
      )
  } else if (t === 2) {
    p.block([off + 0.092, y - 0.013, 0.529], [0.049, 0.014, 0.005], 0.002, glow, lit, [0, 0, 0.27])
  } else {
    for (const s of [-1, 1])
      p.block([off + s * 0.142, y - 0.006, 0.431], [0.067, 0.016, 0.005], 0.002, glow, lit, [0, 0, s * 0.19])
  }
}
export function serviceBrain(p, c, t) {
  const w = [0.42, 0.46, 0.3, 0.4, 0.44, 0.39][c],
    d = [0.26, 0.31, 0.21, 0.27, 0.27, 0.3][c]
  armorCowl(p, 'bus receiver ' + c, [0, 0.013, -0.012], w, d, -0.03, 0.047, 0.064, 0.05, gun, metal)
  for (const s of [-1, 1])
    p.rod([s * w * 0.413, 0.066, -d * 0.381], [s * w * 0.415, 0.054, d * 0.396], 0.018, alloy, metal, 9)
  if (t === 0) {
    armorCowl(
      p,
      'single module cartridge',
      [0, 0.057, 0],
      w * 0.71,
      d * 0.77,
      -0.018,
      0.038,
      0.061,
      0.044,
      p.paint,
      porcelain
    )
    p.block([-0.018, 0.113, -0.039], [0.067, 0.018, 0.056], 0.004, black, soft)
  } else if (t === 1) {
    for (let i = 0; i < 4; i++)
      p.block(
        [(i - 1.5) * w * 0.162, 0.106, -0.015],
        [0.03, 0.11, d * 0.68],
        0.004,
        i === 0 ? p.paint : copper,
        metal,
        [-0.31, 0, 0]
      )
  } else if (t === 2) {
    for (const s of [-1, 1]) {
      p.block([s * w * 0.155, 0.092, -0.015], [w * 0.29, 0.036, d * 0.72], 0.006, p.paint.coat, metal, [
        0,
        0,
        -s * 0.23
      ])
      p.block([s * w * 0.155, 0.113, -0.015], [w * 0.23, 0.013, d * 0.58], 0.004, '#385963', glass, [
        0,
        0,
        -s * 0.23
      ])
    }
  } else {
    for (const s of [-1, 1]) {
      armorCowl(
        p,
        'dual coprocessor',
        [s * w * 0.18, 0.079, 0],
        w * 0.32,
        d * 0.74,
        -0.019,
        0.041,
        0.08,
        0.031,
        s < 0 ? p.paint : p.paint.coat,
        porcelain
      )
      p.cylinder([s * w * 0.18, 0.154, -0.058], 0.024, 0.015, steel, 'y', metal, 6)
    }
  }
  for (let i = 0; i < 4; i++)
    p.block([(i - 1.5) * w * 0.138, 0.025, d * 0.48], [0.031, 0.025, 0.037], 0.003, copper, metal)
}

export const armPlans = [
  { palm: [0.139, -0.548, 0.162], elbow: [0.13, -0.109, -0.048], radius: 0.112, shoulder: 1.08 },
  { palm: [0.088, -0.102, 0.303], elbow: [0.073, -0.024, 0.121], radius: 0.066, shoulder: 0.58 },
  { palm: [0.071, -0.143, 0.329], elbow: [0.123, -0.077, 0.097], radius: 0.061, shoulder: 0.68 },
  { palm: knucklePalm },
  { palm: [0.095, -0.139, 0.343], elbow: [0.191, -0.054, 0.096], radius: 0.091, shoulder: 1.01 },
  { palm: [0.054, -0.218, 0.425], elbow: [0.091, -0.037, 0.091], radius: 0.079, shoulder: 0.72 }
]
const rivetCounterArm = {
  palm: [0.057, -0.223, 0.23],
  elbow: [0.032, -0.065, 0.063],
  radius: 0.052,
  shoulder: 0.57
}
export function handPlan(c, s) {
  return c === 0 && s < 0 ? rivetCounterArm : armPlans[c]
}
export function machineArm(p, c, s) {
  if (c === 3) return knuckleArm(p, s)
  const plan = handPlan(c, s),
    mirror = (a) => [s * a[0], a[1], a[2]],
    wrist = mirror(plan.palm),
    elbow = mirror(plan.elbow)
  const mount = lerp(elbow, wrist, 0.11),
    end = lerp(elbow, wrist, 0.75),
    contact = lerp(elbow, wrist, 0.9),
    r = plan.radius
  boltedHub(p, s, 0.057, 0, 0, c === 1 ? 0.063 : 0.084)
  p.rod([s * 0.015, 0, 0], elbow, c === 1 ? 0.04 : 0.052, gun, metal, 10)
  p.rod([s * 0.014, -0.012, -0.064], [elbow[0], elbow[1], elbow[2] - 0.078], 0.028, alloy, metal, 10)
  const esp = [Math.abs(elbow[0]) + 0.04, elbow[1], elbow[2]]
  boltedHub(p, s, ...esp, c === 4 ? 0.101 : c === 1 ? 0.058 : 0.074)
  if (c === 0 && s < 0) {
    landingPlate(
      p,
      'light counterarm bearing ',
      s,
      [s * 0.009, 0.012, 0.032],
      0.156,
      0.111,
      0.125,
      p.paint.coat
    )
    p.rod([s * 0.064, 0.005, -0.038], elbow, 0.021, alloy, metal, 8)
  } else if (c === 0 || c === 4) {
    const shape =
      c === 4
        ? [
            [-0.2, 0.006],
            [-0.111, 0.113],
            [0.157, 0.084],
            [0.2, 0.024],
            [0.181, -0.048],
            [-0.104, -0.075]
          ]
        : [
            [-0.122, 0.088],
            [0.119, 0.111],
            [0.162, 0.021],
            [0.081, -0.11],
            [-0.111, -0.07]
          ]
    shield(
      p,
      'outer boom shoulder ' + c + s,
      reflect(shape, s),
      [s * 0.022, 0.047, 0.048],
      c === 4 ? 0.311 : 0.166,
      [s * 0.031, 0.041, 0.071],
      p.paint, porcelain, s
    )
    if (c === 4)
      hose(
        p,
        [
          [s * 0.059, -0.014, -0.043],
          [s * 0.263, -0.056, -0.021],
          [s * 0.299, -0.192, 0.159],
          [s * 0.224, -0.205, 0.269],
          lerp(mount, end, 0.64)
        ],
        0.019
      )
    else
      hose(
        p,
        [
          [s * 0.05, -0.019, -0.087],
          [s * 0.276, -0.091, -0.122],
          [s * 0.311, -0.343, -0.039],
          [s * 0.229, -0.467, 0.091],
          lerp(mount, end, 0.59)
        ],
        0.021
      )
  } else if (c === 1) {
    p.block([s * 0.024, 0.013, 0.076], [0.126, 0.076, 0.215], 0.016, p.paint, porcelain, [-0.13, 0, s * 0.1])
    triangleTruss(p, [s * 0.014, 0.031, 0.013], elbow, [s * 0.129, 0.032, 0.152], 0.017, alloy)
  } else if (c === 2) {
    landingPlate(p, 'sweep motor apron ', s, [s * 0.043, 0.025, 0.018], 0.171, 0.121, 0.155, p.paint.coat)
    hose(
      p,
      [
        [s * 0.011, 0.02, -0.036],
        [s * 0.139, -0.034, -0.031],
        [s * 0.186, -0.127, 0.076],
        lerp(mount, end, 0.54)
      ],
      0.013
    )
  } else {
    p.rod([s * 0.007, 0.021, -0.031], [s * 0.127, 0.065, 0.122], 0.021, alloy, metal, 10)
    landingPlate(p, 'spring press heel ', s, [s * 0.035, 0.039, 0.004], 0.15, 0.158, 0.133, p.paint)
    hose(
      p,
      [
        [s * 0.018, 0.035, -0.045],
        [s * 0.15, 0.057, -0.027],
        [s * 0.169, -0.021, 0.136],
        lerp(mount, end, 0.55)
      ],
      0.016
    )
  }
  if (c === 5) {
    p.rod(mount, end, r * 0.48, gun, metal, 12)
    taperSleeve(
      p,
      'spring heel',
      mount,
      lerp(mount, end, 0.19),
      r * 1.11,
      r * 0.99,
      p.paint.coat,
      porcelain,
      12
    )
    spring(p, lerp(mount, end, 0.14), lerp(mount, end, 0.93), r * 1.03)
  } else {
    taperSleeve(
      p,
      'actuator casting',
      mount,
      lerp(mount, end, 0.65),
      r * 1.14,
      r * 0.96,
      p.paint,
      porcelain,
      c === 4 ? 8 : 12
    )
    taperSleeve(
      p,
      'lock nut',
      lerp(mount, end, 0.33),
      lerp(mount, end, 0.48),
      r * 1.13,
      r * 1.08,
      gun,
      metal,
      10
    )
    taperSleeve(
      p,
      'machined neck',
      lerp(mount, end, 0.6),
      lerp(mount, end, 0.81),
      r,
      r * 0.64,
      alloy,
      metal,
      14
    )
    p.rod(lerp(mount, end, 0.77), end, r * 0.55, bright, metal, 12)
  }
  const gap = c === 4 ? 0.075 : c === 1 ? 0.051 : 0.064
  for (const k of [-1, 1]) {
    const a = [mount[0] + k * gap, mount[1], mount[2]],
      b = [end[0] + k * gap, end[1], end[2]]
    p.rod(a, b, c === 4 ? 0.023 : 0.016, k > 0 ? copper : bright, metal, 8)
    p.rod(a, lerp(a, b, 0.2), c === 4 ? 0.032 : 0.023, gun, metal, 8)
  }
  taperSleeve(p, 'forward wiper', lerp(mount, end, 0.91), end, r * 0.95, r * 0.87, darkSteel, metal, 12)
  const count = () => p.pieces.reduce((a, v) => a + v.geometry.attributes.position.count, 0),
    p0 = count()
  p.rod(end, contact, r * 0.48, bright, metal, 12)
  const p1 = count()
  taperSleeve(p, 'clamp bushing', contact, wrist, r * 0.76, r * 0.83, copper, metal, 10)
  if (c === 0 && s > 0) {
    // Rectangular press shoe below the piston, unlike the short counter-arm.
    p.block(
      [wrist[0], wrist[1] + 0.011, wrist[2] - 0.035],
      [0.252, 0.129, 0.202],
      0.018,
      gun,
      metal,
      [-0.11, 0, 0]
    )
    p.block(
      [wrist[0], wrist[1] - 0.044, wrist[2] - 0.034],
      [0.281, 0.056, 0.217],
      0.014,
      graphite,
      soft,
      [-0.11, 0, 0]
    )
    for (const k of [-1, 1])
      p.block(
        [wrist[0] + k * 0.101, wrist[1] + 0.042, wrist[2] + 0.047],
        [0.045, 0.098, 0.052],
        0.009,
        p.paint.coat,
        porcelain
      )
  } else palmShoe(p, s, wrist, c === 4 ? 1.16 : c === 1 ? 0.77 : 0.89)
  const g = p.geometry(),
    pos = g.attributes.position,
    morph = new Float32Array(pos.count * 3),
    dir = new T.Vector3(...wrist).normalize(),
    a = new T.Vector3(...end),
    b = new T.Vector3(...contact).sub(a),
    tmp = new T.Vector3(),
    l = b.lengthSq()
  for (let i = p0; i < pos.count; i++) {
    const w = i >= p1 ? 1 : T.MathUtils.clamp(tmp.fromBufferAttribute(pos, i).sub(a).dot(b) / l, 0, 1)
    morph.set([dir.x * wristStroke * w, dir.y * wristStroke * w, dir.z * wristStroke * w], i * 3)
  }
  g.morphAttributes.position = [new T.Float32BufferAttribute(morph, 3)]
  g.morphTargetsRelative = true
  g.computeBoundingSphere()
  return g
}

function treadLoop(p, s, r) {
  const x = s * 0.423,
    lo = -0.441,
    hi = 0.404,
    rootY = r + 0.006,
    band = r * 0.89
  const pts = []
  for (let i = 0; i <= 12; i++) {
    const a = (i * Math.PI) / 12
    pts.push([rootY + band * Math.cos(a), hi + band * Math.sin(a)])
  }
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i * Math.PI) / 12
    pts.push([rootY + band * Math.cos(a), lo + band * Math.sin(a)])
  }
  const geo = p.template('crawler closed belt ' + [s, r], () => {
    const pos = [],
      idx = []
    for (const [y, z] of pts) {
      const near = Math.max(lo, Math.min(hi, z)),
        v = Math.hypot(y - rootY, z - near),
        ny = (y - rootY) / v,
        nz = (z - near) / v
      for (const [dx, n] of [
        [-0.046, 0.012],
        [0.046, 0.012],
        [0.046, -0.014],
        [-0.046, -0.014]
      ])
        pos.push(x + dx, y + ny * n, z + nz * n)
    }
    for (let j = 0; j < pts.length; j++)
      for (let k = 0; k < 4; k++) {
        const a = 4 * j + k,
          b = j * 4 + ((k + 1) % 4),
          c = ((j + 1) % pts.length) * 4 + k,
          d = ((j + 1) % pts.length) * 4 + ((k + 1) % 4)
        idx.push(a, c, b, b, c, d)
      }
    const g = new T.BufferGeometry()
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  })
  p.add(geo, graphite, soft, [0, 0, 0])
  for (const y of [rootY - band, rootY + band])
    for (let i = 0; i < 9; i++) {
      p.block([x, y, lo + 0.047 + i * 0.095], [0.105, 0.024, 0.047], 0.004, oil, soft, [0, s * 0.1, 0])
    }
  for (const z of [-0.275, 0.009, 0.259]) {
    p.cylinder([x, r * 0.76, z], r * 0.64, 0.112, gun, 'x', metal, 14)
    p.cylinder([x + s * 0.061, r * 0.76, z], r * 0.41, 0.016, alloy, 'x', metal, 10)
    p.cylinder([x + s * 0.073, r * 0.76, z], r * 0.17, 0.013, black, 'x', soft, 6)
  }
}
export function machineDrive(p, c, r) {
  if (c === 3) {
    knuckleDrive(p, r)
    return
  }
  if (c === 1) {
    for (const s of [-1, 1]) {
      treadLoop(p, s, r)
      p.rod([s * 0.413, r, -0.442], [s * 0.413, r, 0.403], 0.038, gun, metal, 10)
      for (const z of [-0.442, 0.403])
        p.rod([s * 0.284, r + 0.08, z * 0.68], [s * 0.49, r, z], 0.038, alloy, metal, 10)
    }
    return
  }
  if (c === 2) {
    for (const z of [-0.247, 0.232]) {
      p.rod([-0.447, r, z], [0.447, r, z], 0.035, gun, metal, 10)
      for (const s of [-1, 1]) {
        triangleTruss(
          p,
          [s * 0.197, 0.269, z * 0.4],
          [s * 0.426, r, z],
          [s * 0.283, r + 0.021, z + 0.067],
          0.023,
          alloy
        )
        p.cylinder([s * 0.37, r, z], 0.067, 0.061, gun, 'x', metal, 10)
      }
    }
    p.cylinder([0, 0.187, 0], 0.151, 0.145, gun, 'y', metal, 12)
    return
  }
  const wide = c === 4,
    comet = c === 5,
    ax = wide ? 0.635 : comet ? 0.4 : 0.35,
    z = comet ? -0.122 : wide ? 0.01 : 0.03
  for (const s of [-1, 1]) {
    const hip = [s * (wide ? 0.205 : 0.16), wide ? 0.562 : comet ? 0.285 : 0.431, comet ? -0.161 : -0.092]
    const knee = [
      s * (wide ? 0.488 : comet ? 0.272 : 0.294),
      wide ? 0.389 : comet ? 0.254 : 0.313,
      wide ? 0.161 : comet ? 0.016 : 0.124
    ]
    const hub = [s * ax, r, z]
    triangleTruss(p, hip, knee, [s * (ax - 0.026), r, z - 0.085], wide ? 0.034 : 0.027, alloy)
    ram(p, knee, hub, wide ? 0.059 : 0.044, s < 0 ? copper : gun)
    p.rod(
      [hip[0], hip[1] - 0.013, hip[2] - 0.096],
      [hub[0], hub[1] + 0.011, hub[2] - 0.119],
      0.035,
      gun,
      metal,
      10
    )
    boltedHub(p, s, Math.abs(knee[0]) + 0.025, knee[1], knee[2], wide ? 0.079 : 0.058)
    landingPlate(
      p,
      'wheel kneecap ' + c,
      s,
      [knee[0] - s * 0.047, knee[1] + 0.022, knee[2] + 0.014],
      wide ? 0.198 : 0.152,
      wide ? 0.168 : 0.127,
      0.094,
      p.paint.coat
    )
    if (wide) {
      const shoulder = [s * 0.514, 0.927, -0.106]
      triangleTruss(p, [s * 0.161, 0.542, 0.014], shoulder, [s * 0.612, r + 0.071, -0.059], 0.031, alloy)
      p.rod([s * 0.477, 0.751, -0.044], [s * 0.321, 0.555, -0.034], 0.021, copper, metal, 8)
      landingPlate(
        p,
        'strider exposed A frame ',
        s,
        [s * 0.441, 0.715, -0.044],
        0.134,
        0.162,
        0.089,
        p.paint.coat
      )
      hose(p, [hip, [s * 0.311, 0.416, -0.164], [s * 0.513, 0.272, -0.141], hub], 0.017)
    }
  }
  const h = wide ? 0.552 : comet ? 0.237 : 0.411,
    zTail = comet ? 0.37 : -0.33
  p.cylinder([0, h, -0.111], 0.066, wide ? 0.41 : 0.304, gun, 'x', metal, 12)
  p.rod([0, h, -0.105], [0, 0.084, zTail], 0.031, gun, metal, 10)
  p.cylinder([0, 0.081, zTail], 0.081, 0.095, rubber, 'x', soft, 12)
  if (comet) {
    for (const s of [-1, 1]) {
      p.rod([s * 0.123, 0.234, 0.071], [s * 0.065, 0.083, zTail], 0.03, alloy, metal, 10)
      p.rod([s * 0.065, 0.083, zTail], [s * 0.142, 0.169, 0.145], 0.022, gun, metal, 8)
      p.cylinder([s * 0.061, 0.082, zTail], 0.03, 0.022, copper, 'x', metal, 8)
    }
  }
}
