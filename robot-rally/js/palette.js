// Accent enamel and its companion ceramic coat, in sRGB.
export const paints = [
  ['ferrari', 'Ferrari Red', '#e21e28', '#8c151e'],
  ['night', 'Steel Blue', '#456676', '#303b46'],
  ['steel', 'Volt', '#e9ac3f', '#54676c'],
  ['teal', 'Lagoon', '#2c9d9b', '#f4edda'],
  ['blue', 'Blueberry', '#455da2', '#a8bcdf'],
  ['plum', 'Grape', '#8862ad', '#cbb3da'],
  ['berry', 'Cherry', '#b44e6b', '#e6adad'],
  ['leaf', 'Clover', '#648344', '#c1d3a4'],
  ['sun', 'Mango', '#de9138', '#f3d49c']
]
const coats = Object.fromEntries(paints.map((p) => [p[2], p[3]]))
Object.assign(coats, {
  '#eca044': '#e3c294',
  '#71b9d5': '#bbd9dd',
  '#cb6571': '#deb2aa',
  '#efb546': '#ebd49e'
})
export function coatFor(color) {
  return coats[color.toLowerCase()] || '#f4edda'
}

export const paintById = (id) => paints.find((paint) => paint[0] === id)
