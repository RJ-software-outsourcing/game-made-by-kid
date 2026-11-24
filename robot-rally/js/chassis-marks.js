import { BufferGeometry, Float32BufferAttribute, Matrix4, Vector3 } from '../vendor/three.module.js'
import { finishes } from './robot-forms.js'

// A small die-stamped identification plate sits flush on a different exposed
// casting on each chassis. The number is inked into the same surface batch.
const mounts = [
  [[0.231, 0.464, -0.114], [0, 0.97, 0.245], 0.177],
  [[0.342, 0.105, 0.124], [0, 0.994, 0.113], 0.201],
  [[0.308, 0.103, 0.301], [0, 1, 0], 0.15],
  [[0.271, 0.316, 0.107], [0.481, -0.137, 0.866], 0.156],
  [[0.312, 0.378, -0.154], [0, 0.978, 0.207], 0.183],
  [[0.207, 0.219, 0.288], [0.08, 0.828, 0.555], 0.149]
]
const bars = ['abcedf', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg']
const segments = {
  a: [0, 1, 1, 1],
  b: [1, 1, 1, 0.5],
  c: [1, 0.5, 1, 0],
  d: [0, 0, 1, 0],
  e: [0, 0.5, 0, 0],
  f: [0, 1, 0, 0.5],
  g: [0, 0.5, 1, 0.5]
}

function stencil(digit) {
  const points = [],
    indices = []
  for (const [i, n] of [0, digit].entries()) {
    for (const bar of bars[n]) {
      const [ax, ay, bx, by] = segments[bar]
      const dx = (bx - ax) * 0.17,
        dy = (by - ay) * 0.31,
        length = Math.hypot(dx, dy)
      const ux = dx / length,
        uy = dy / length,
        offset = points.length / 3
      for (const [along, across] of [
        [0.005, 0],
        [0.019, -0.019],
        [length - 0.019, -0.019],
        [length - 0.005, 0],
        [length - 0.019, 0.019],
        [0.019, 0.019]
      ]) {
        const y = ay * 0.31 + uy * along + ux * across
        const x = ax * 0.17 + ux * along - uy * across + 0.15 * y
        points.push(-0.227 + 0.236 * i + x, y - 0.154, 0.033)
      }
      for (let j = 1; j < 5; j++) indices.push(offset, offset + j, offset + j + 1)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function chassisMark(p, chassis) {
  const [position, vector, width] = mounts[chassis]
  const normal = new Vector3(...vector).normalize()
  const right = new Vector3(1, 0, 0)
  right.addScaledVector(normal, -right.dot(normal)).normalize()
  const pose = new Matrix4().makeBasis(right, normal.clone().cross(right), normal)
  pose
    .scale(new Vector3(width, width, width))
    .setPosition(new Vector3(...position).addScaledVector(normal, 0.003))
  const first = p.pieces.length
  p.block([0, 0, -0.012], [1, 0.48, 0.076], 0.033, '#28343a', finishes.metal)
  p.add(
    p.template('race number ' + chassis, () => stencil(chassis + 1)),
    '#eee7cc',
    finishes.porcelain,
    [0, 0, 0]
  )
  for (const side of [-1, 1])
    p.cylinder([side * 0.408, 0, 0.026], 0.036, 0.025, '#a6ada8', 'z', finishes.metal, 8)
  for (let i = first; i < p.pieces.length; i++) p.pieces[i].matrix.premultiply(pose)
}
