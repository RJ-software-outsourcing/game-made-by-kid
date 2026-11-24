// Factory shells and removable competition equipment. Each family has its own
// castings, attachment points and finish; dimensions are in model units.
import * as T from '../vendor/three.module.js'
import { colors, finishes, armorCowl, facePlate, revolved } from './robot-forms.js'
const { graphite, rubber, steel, darkSteel, cyan } = colors
const { porcelain, lacquer, metal, soft, glass, lit } = finishes
const tau = Math.PI * 2,
  brass = '#bd9467'
const spokeCounts = [4, 5, 3, 6, 4, 3]
const widthFactor = [1.03, 0.93, 1.1, 0.98, 1.12, 0.88]

// Six different housings: a riveted bevel-fold, a lengthwise twin rail, a
// turned annular shell, a padded rectangular drum, an open truss, and an ogive.
function housing(p, c, key, at, w, h, d, skin = p.paint, coat = porcelain) {
  const [x, y, z] = at
  if (c === 0) {
    armorCowl(p, key, at, w, d, -h * 0.5, h * 0.3, h * 0.55, Math.min(w, d) * 0.17, skin, coat)
  } else if (c === 1) {
    armorCowl(p, key, at, w * 0.82, d, -h * 0.48, h * 0.26, h * 0.54, Math.min(w, d) * 0.2, skin, coat)
    for (const s of [-1, 1])
      p.block(
        [x + s * w * 0.413, y - 0.061 * h, z],
        [w * 0.16, h * 0.71, d * 0.86],
        Math.min(w, h, d) * 0.085,
        skin,
        coat,
        [-0.08, 0, 0]
      )
  } else if (c === 2) {
    revolved(
      p,
      key,
      [
        [0.34, -0.5],
        [0.48, -0.39],
        [0.5, -0.24],
        [0.5, 0.15],
        [0.435, 0.42],
        [0.3, 0.5],
        [0, 0.5]
      ],
      at,
      [w, h, d],
      skin,
      coat,
      [0, 0, 0],
      20
    )
  } else if (c === 3) {
    p.block(at, [w, h, d], Math.min(w, h, d) * 0.29, skin, coat, [0, 0, 0], 3)
    p.block(
      [x, y - h * 0.29, z],
      [w * 1.015, h * 0.105, d * 1.015],
      Math.min(w, h, d) * 0.045,
      darkSteel,
      metal
    )
  } else if (c === 4) {
    const contour = [
      [-0.48, -0.21],
      [-0.27, -0.5],
      [0.21, -0.5],
      [0.5, -0.22],
      [0.44, 0.33],
      [0.19, 0.5],
      [-0.24, 0.5],
      [-0.49, 0.24]
    ]
    facePlate(
      p,
      key,
      contour.map(([xx, yy]) => [xx * w, yy * h]),
      [x, y, z - d * 0.5],
      d,
      skin,
      coat
    )
    for (const s of [-1, 1])
      p.rod(
        [x + s * w * 0.41, y - h * 0.17, z - d * 0.45],
        [x + s * w * 0.42, y + h * 0.18, z + d * 0.42],
        Math.min(w, h, d) * 0.066,
        darkSteel,
        metal,
        8
      )
  } else {
    revolved(
      p,
      key,
      [
        [0, -0.5],
        [0.32, -0.44],
        [0.47, -0.24],
        [0.5, 0.04],
        [0.43, 0.3],
        [0.27, 0.47],
        [0, 0.5]
      ],
      at,
      [w, h, d],
      skin,
      coat,
      [0, 0, 0],
      26
    )
  }
}
function bolt(p, x, y, z, r = 0.017, axis = 'z') {
  p.cylinder([x, y, z], r, 0.011, darkSteel, axis, metal, 8)
  if (axis === 'z') p.block([x, y, z + 0.007], [r * 0.88, r * 0.19, 0.005], 0, graphite, soft, [0, 0, 0.5])
}
export function powerKit(p, c, t) {
  const w = [0.415, 0.478, 0.398, 0.392, 0.511, 0.443][c],
    h = [0.29, 0.244, 0.304, 0.351, 0.239, 0.268][c]
  const d = [0.223, 0.245, 0.235, 0.205, 0.227, 0.263][c]
  if (t === 0) {
    housing(p, c, 'single power cassette', [0, 0, -0.029], w, h, d, p.paint, lacquer)
    const rear = -0.029 - d * 0.5
    p.block([0, 0, rear], [w * 0.68, h * 0.58, 0.044], 0.014, graphite, soft)
    for (const side of [-1, 1]) {
      p.block([side * w * 0.205, 0.008, rear - 0.026], [0.035, h * 0.33, 0.013], 0.005, steel, metal)
      p.cylinder([side * w * 0.34, 0, rear + 0.008], 0.021, 0.03, brass, 'z', metal, 8)
    }
    for (let i = 0; i < 3; i++)
      p.block(
        [0, (i - 1) * 0.03, rear - 0.024],
        [w * 0.23, 0.013, 0.011],
        0.002,
        i === 2 ? cyan : darkSteel,
        i === 2 ? lit : metal
      )
  } else if (t === 1) {
    housing(p, c, 'regen magazine', [0, 0.003, -0.029], w * 0.79, h * 1.29, d * 0.93, p.paint.coat)
    for (const s of [-1, 1])
      p.rod(
        [s * w * 0.321, -h * 0.51, -d * 0.48],
        [s * w * 0.321, h * 0.53, -d * 0.48],
        0.021,
        p.paint,
        metal,
        10
      )
    const rear = -0.029 - d * 0.465
    p.block([0, 0.017, rear], [w * 0.53, h * 0.8, 0.052], 0.014, graphite, soft)
    for (let fin = 0; fin < 4; fin++)
      p.block(
        [0, (fin - 1.35) * h * 0.18, rear - 0.029],
        [w * 0.42, h * 0.085, 0.028],
        0.005,
        brass,
        metal,
        [-0.2, 0, 0]
      )
    for (const side of [-1, 1])
      p.block([side * w * 0.18, h * 0.68, -0.028], [0.031, 0.073, 0.07], 0.008, darkSteel, metal)
    p.block([0, h * 0.68 + 0.03, -0.028], [w * 0.44, 0.031, 0.075], 0.011, graphite, soft)
  } else if (t === 2) {
    const angle = c === 3 || c === 5 ? 0.17 : 0
    p.block([0, 0.004, 0], [w * 0.86, h * 0.87, d * 0.76], 0.04, darkSteel, metal)
    p.cylinder([0, 0.015, -0.105], h * 0.63, w * 1.15, p.paint, 'x', lacquer, c === 4 ? 8 : 18)
    for (const x of [-0.49, -0.27, 0.27, 0.49])
      p.cylinder([w * x, 0.015, -0.105], h * 0.65, 0.023, steel, 'x', metal, c === 4 ? 8 : 18)
    p.block([0, 0.01, -0.103 - h * 0.61], [w * 0.48, 0.056, 0.029], 0.009, graphite, soft, [0, 0, angle])
    for (const side of [-1, 1]) {
      const end = side * w * 0.576
      p.cylinder([end, 0.015, -0.105], h * 0.48, 0.03, darkSteel, 'x', metal, c === 4 ? 8 : 16)
      p.ring([end + side * 0.016, 0.015, -0.105], h * 0.35, 0.011, brass, 'x', metal)
      p.cylinder([end + side * 0.021, 0.015, -0.105], h * 0.19, 0.031, steel, 'x', metal, 6)
    }
  } else {
    for (const s of [-1, 1]) {
      housing(
        p,
        c,
        'paired pack',
        [s * w * 0.273, 0, -0.051],
        w * 0.46,
        h * 1.2,
        d * 0.93,
        s < 0 ? p.paint : p.paint.coat,
        lacquer
      )
      const rear = -0.051 - d * 0.465
      p.cylinder([s * w * 0.273, h * 0.6, -0.051], 0.047, 0.05, brass, 'y', metal, 8)
      p.block([s * w * 0.273, 0, rear], [w * 0.205, h * 0.69, 0.046], 0.014, graphite, soft)
      p.block([s * w * 0.273, 0.01, rear - 0.025], [0.024, h * 0.38, 0.011], 0.003, cyan, lit)
      p.rod([s * w * 0.273, h * 0.69, -0.051], [s * w * 0.18, h * 0.84, -0.078], 0.017, graphite, soft)
    }
    p.rod([-w * 0.18, h * 0.84, -0.078], [w * 0.18, h * 0.84, -0.078], 0.017, graphite, soft)
    p.block([0, -h * 0.31, -0.109], [w * 0.77, 0.04, 0.077], 0.008, graphite, soft)
  }
  for (const s of [-1, 1]) bolt(p, s * w * 0.39, -h * 0.25, -d * 0.45, 0.017)
}

// The running radius is shared with the wheel animation. Cut the tire down
// to make room for raised tread instead of burying the tread in a smooth drum.
const tireSections = [
  [
    [0.59, -0.72],
    [0.82, -0.92],
    [0.94, -0.74],
    [0.97, -0.48],
    [0.97, 0.48],
    [0.94, 0.74],
    [0.82, 0.92],
    [0.59, 0.72]
  ],
  [
    [0.59, -0.7],
    [0.79, -0.87],
    [0.98, -0.58],
    [1, -0.35],
    [0.96, -0.15],
    [0.96, 0.15],
    [1, 0.35],
    [0.98, 0.58],
    [0.79, 0.87],
    [0.59, 0.7]
  ],
  [
    [0.59, -0.85],
    [0.83, -0.98],
    [0.91, -0.72],
    [0.91, 0.72],
    [0.83, 0.98],
    [0.59, 0.85]
  ],
  [
    [0.56, -0.82],
    [0.7, -0.94],
    [0.79, -0.78],
    [0.78, -0.52],
    [0.66, -0.39],
    [0.66, 0.39],
    [0.78, 0.52],
    [0.79, 0.78],
    [0.7, 0.94],
    [0.56, 0.82]
  ]
]

function rollerTread(p, c, side, r, half) {
  const count = c === 1 || c === 5 ? 8 : 9
  const up = new T.Vector3(0, 1, 0)
  const shaft = new T.Vector3()
  const rotation = new T.Quaternion()
  const radius = 0.19 * r
  const length = Math.hypot(half * 1.57, r * 0.46)
  const barrel = p.template(
    'competition roller barrel',
    () =>
      new T.LatheGeometry(
        [
          [0.45, -0.5],
          [0.86, -0.37],
          [1, -0.13],
          [1, 0.13],
          [0.86, 0.37],
          [0.45, 0.5]
        ].map(([x, y]) => new T.Vector2(x, y)),
        p.compact ? 7 : 12
      )
  )
  for (let i = 0; i < count; i++) {
    const a = (tau * i) / count,
      cs = Math.cos(a),
      sn = Math.sin(a)
    const center = new T.Vector3(0, r * 0.81 * cs, r * 0.81 * sn)
    shaft.set(side * half * 1.57, -r * 0.46 * sn, r * 0.46 * cs).normalize()
    rotation.setFromUnitVectors(up, shaft)
    p.add(barrel, '#303a3e', soft, center.toArray(), [radius, length, radius], rotation)
    const pinAt = length * 0.6
    const pins = [-1, 1].map((end) => center.clone().addScaledVector(shaft, end * pinAt))
    p.rod(pins[0].toArray(), pins[1].toArray(), radius * 0.39, steel, metal, 8)
    for (const pin of pins) {
      const root = [pin.x * 0.82, pin.y * 0.78, pin.z * 0.78]
      p.rod(root, pin.toArray(), r * 0.065, darkSteel, metal, 7)
    }
  }
}

export function motorKit(p, c, t, side, r, width) {
  if (t < 0) {
    // Narrow factory carrier wheels still spin. These contain no purchased
    // outer tire, drive pack, sights or selectable motor cassette.
    p.cylinder([0, 0, 0], r, 0.099, rubber, 'x', soft, 18)
    p.cylinder([0, 0, 0], r * 0.52, 0.113, darkSteel, 'x', metal, 12)
    p.cylinder([side * 0.059, 0, 0], r * 0.23, 0.015, steel, 'x', metal, 6)
    return
  }
  const w = width * widthFactor[c],
    half = w * 0.5
  const tire = p.template(
    'race tire ' + [t, r, w].join(','),
    () =>
      new T.LatheGeometry(
        tireSections[t].map(([radial, axial]) => new T.Vector2(r * radial, half * axial)),
        p.compact ? 20 : 30
      )
  )
  p.add(tire, rubber, soft, [0, 0, 0], [1, 1, 1], [0, 0, Math.PI * 0.5])
  p.cylinder([0, 0, 0], r * (t === 1 ? 0.3 : 0.67), w * 0.94, graphite, 'x', soft, p.compact ? 12 : 20)
  const x = side * (half + 0.007)
  if (t === 1) {
    // An open race rim shows daylight between the swept spokes.
    p.ring([side * half * 0.64, 0, 0], r * 0.61, r * 0.065, p.paint, 'x', lacquer)
  } else if (c === 0 || c === 3) {
    p.cylinder([x, 0, 0], r * (c === 0 ? 0.53 : 0.62), 0.028, p.paint, 'x', lacquer, c === 0 ? 8 : 16)
    p.ring([x + side * 0.017, 0, 0], r * 0.65, 0.012, steel, 'x', metal)
  } else if (c === 2 || c === 5) {
    p.cylinder([x, 0, 0], r * 0.71, 0.028, c === 2 ? p.paint.coat : p.paint, 'x', lacquer, 20)
    p.ring(
      [x + side * 0.024, 0, 0],
      r * (c === 2 ? 0.46 : 0.64),
      0.013,
      c === 2 ? p.paint : steel,
      'x',
      metal
    )
  } else {
    p.ring([x, 0, 0], r * 0.64, 0.015, p.paint, 'x', lacquer)
  }
  const spokes = t === 1 ? spokeCounts[c] + 2 : spokeCounts[c]
  for (let i = 0; i < spokes; i++) {
    const a = (tau * i) / spokes
    if (t === 1) {
      const outer = a + 0.31 * side
      p.rod(
        [x, r * 0.24 * Math.cos(a), r * 0.24 * Math.sin(a)],
        [side * half * 0.65, r * 0.62 * Math.cos(outer), r * 0.62 * Math.sin(outer)],
        r * (c === 4 ? 0.076 : 0.066),
        p.paint.coat,
        metal,
        8
      )
      continue
    }
    const n = c === 2 || c === 5 ? 0.31 : 0.43
    p.block(
      [x + side * 0.024, r * n * Math.cos(a), r * n * Math.sin(a)],
      [0.021, r * (c === 2 || c === 5 ? 0.23 : 0.46), r * (c === 1 ? 0.14 : 0.19)],
      0.008,
      c === 4 ? p.paint : darkSteel,
      metal,
      [a + (c === 4 ? -0.21 : 0), 0, 0]
    )
  }
  p.cylinder(
    [x + side * 0.041, 0, 0],
    r * (t === 2 ? 0.4 : 0.27),
    0.036,
    t === 2 ? p.paint : steel,
    'x',
    metal,
    t === 2 ? 6 : 8
  )
  p.cylinder([x + side * 0.062, 0, 0], r * 0.137, 0.014, graphite, 'x', soft, 6)
  if (t === 3) {
    rollerTread(p, c, side, r, half)
  } else if (t === 2) {
    for (let i = 0; i < 11; i++) {
      for (const shoulder of [-1, 1]) {
        const a = (tau * (i + shoulder * 0.12)) / 11
        p.block(
          [half * shoulder * 0.47, r * 0.948 * Math.cos(a), r * 0.948 * Math.sin(a)],
          [w * 0.57, r * 0.103, r * 0.258],
          0.008,
          '#3e4749',
          soft,
          new T.Quaternion().setFromEuler(new T.Euler(a, shoulder * 0.43, 0, 'XYZ'))
        )
      }
    }
  } else if (t === 0) {
    for (let i = 0; i < 8; i++) {
      const a = (tau * i) / 8
      p.block(
        [0, r * 0.983 * Math.cos(a), r * 0.983 * Math.sin(a)],
        [w * 0.67, r * 0.033, r * 0.15],
        0.003,
        '#3b4447',
        soft,
        [a, side * 0.12, 0]
      )
    }
  }
}

const padProfiles = [
  [
    [-0.24, 0.019],
    [-0.17, 0.123],
    [0.15, 0.122],
    [0.24, 0.027],
    [0.195, -0.073],
    [0.09, -0.118],
    [-0.16, -0.103]
  ],
  [
    [-0.255, -0.033],
    [-0.205, 0.068],
    [-0.079, 0.116],
    [0.154, 0.087],
    [0.244, 0.018],
    [0.183, -0.072],
    [-0.169, -0.095]
  ],
  [
    [-0.211, -0.065],
    [-0.238, 0.034],
    [-0.137, 0.13],
    [0.092, 0.135],
    [0.223, 0.061],
    [0.214, -0.049],
    [0.106, -0.117],
    [-0.095, -0.13]
  ],
  [
    [-0.181, -0.106],
    [-0.219, -0.021],
    [-0.201, 0.079],
    [-0.114, 0.139],
    [0.123, 0.135],
    [0.217, 0.068],
    [0.221, -0.036],
    [0.152, -0.116]
  ],
  [
    [-0.212, -0.091],
    [-0.231, 0.06],
    [-0.123, 0.13],
    [0.015, 0.089],
    [0.147, 0.133],
    [0.232, 0.045],
    [0.173, -0.089],
    [0.003, -0.113]
  ],
  [
    [-0.221, -0.037],
    [-0.165, 0.091],
    [-0.042, 0.135],
    [0.113, 0.118],
    [0.213, 0.042],
    [0.206, -0.046],
    [0.086, -0.119],
    [-0.081, -0.116]
  ]
]
export function toolNose(p, c, t) {
  const gunmetalBrush = '#48565c'
  const prof = padProfiles[c],
    n = spokeCounts[c]
  if (t === 0) {
    facePlate(p, 'frame-specific ram ' + c, prof, [0, 0, 0.106], 0.102, p.paint, lacquer)
    facePlate(
      p,
      'frame pressure pad ' + c,
      prof.map(([x, y]) => [x * 0.91, y * 0.91]),
      [0, 0, 0.195],
      0.059,
      graphite,
      soft
    )
    if (c === 2 || c === 3 || c === 5) {
      p.ring([0, 0.002, 0.251], 0.072, 0.009, p.paint.coat, 'z', lacquer)
      p.cylinder([0, 0.002, 0.256], 0.034, 0.012, darkSteel, 'z', metal, 6)
    } else {
      for (let i = 0; i < (c === 4 ? 2 : 3); i++)
        p.block(
          [-0.091 + i * (c === 4 ? 0.18 : 0.09), 0.003, 0.251],
          [0.051, 0.119, 0.023],
          0.009,
          p.paint.coat,
          soft,
          [0, 0, c === 1 ? 0.34 : -0.19]
        )
    }
  } else if (t === 1) {
    const groups = 8 + (c % 3)
    p.cylinder([0, 0, 0.142], 0.126, 0.089, gunmetalBrush, 'z', metal, c === 4 ? 10 : 16)
    p.cylinder([0, 0, 0.194], 0.16, 0.063, p.paint, 'z', lacquer, groups * 2)
    p.ring([0, 0, 0.228], 0.138, 0.012, steel, 'z', metal)
    for (let i = 0; i < groups; i++) {
      const a = (tau * i) / groups,
        cs = Math.cos(a),
        sn = Math.sin(a)
      p.rod([cs * 0.08, sn * 0.08, 0.221], [cs * 0.143, sn * 0.143, 0.237], 0.018, darkSteel, metal, 8)
      for (let j = 0; j < (p.compact ? 2 : 3); j++) {
        const offset = (j - 1) * 0.013,
          x = 0.15 * cs - offset * sn,
          y = 0.15 * sn + offset * cs
        p.rod(
          [x, y, 0.213],
          [x + cs * 0.032 - sn * 0.021, y + sn * 0.032 + cs * 0.021, 0.278 + (i % 2) * 0.01],
          0.01,
          graphite,
          soft,
          6
        )
      }
    }
    p.cylinder([0, 0, 0.253], 0.082, 0.094, steel, 'z', metal, c === 4 ? 8 : 12)
    p.cylinder([0, 0, 0.298], 0.048, 0.013, gunmetalBrush, 'z', metal, 6)
  } else if (t === 2) {
    const wide = c === 2 || c === 5 ? 0.142 : 0.12
    p.cylinder([0, 0, 0.144], wide, 0.142, p.paint, 'z', lacquer, [8, 12, 20, 12, 6, 24][c])
    for (const s of [-1, 1])
      p.rod([s * wide * 0.84, -0.015, 0.104], [s * 0.088, 0.017, 0.31], 0.02, p.paint.coat, metal, 10)
    p.cylinder([0, 0, 0.238], 0.072, 0.151, graphite, 'z', soft, 16)
    p.ring([0, 0, 0.303], 0.077, 0.013, steel, 'z', metal)
    p.ring([0, 0, 0.352], c === 1 ? 0.119 : 0.105, 0.021, p.paint.coat, 'z', lacquer)
    p.block([wide * 0.66, 0.076, 0.146], [0.059, 0.049, 0.111], 0.011, cyan, glass)
  } else {
    revolved(
      p,
      'resonator shell ' + c,
      [
        [0.034, 0],
        [0.087, 0.027],
        [0.103, 0.094],
        [0.135, 0.148],
        [0.18, 0.194],
        [0.188, 0.213],
        [0.165, 0.216],
        [0.125, 0.168],
        [0.082, 0.094],
        [0.044, 0.056]
      ],
      [0, 0, 0.112],
      [c === 1 ? 1.11 : 1, 1, c === 3 ? 0.89 : 1],
      p.paint.coat,
      metal,
      [Math.PI / 2, 0, 0],
      c === 4 ? 10 : 30
    )
    for (let i = 0; i < n; i++) {
      const a = (tau * i) / n,
        xc = Math.cos(a),
        yc = Math.sin(a)
      p.rod([0.077 * xc, 0.077 * yc, 0.118], [0.165 * xc, 0.165 * yc, 0.309], 0.017, p.paint, metal, 8)
    }
    p.ring([0, 0, 0.326], 0.177, 0.011, steel, 'z', metal)
    p.cylinder([0, 0, 0.238], 0.033, 0.09, graphite, 'z', soft, 8)
  }
}
