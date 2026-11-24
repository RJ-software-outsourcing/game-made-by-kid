import { paints } from './palette.js'

const sheets = ['kit-rivet.png', 'kit-rover.png', 'kit-rotor.png', 'kit-knuckle.png', 'kit-strider.png', 'kit-comet.png']
const rows = ['brain', 'motor', 'cell', 'shell', 'lens', 'weapon']
const sources = new Map(), displayed = new Map()
const basePaint = 'night'

// The standard PNG contains every PBR swatch as a private palette chunk.
// Changing the 768 color bytes plus their stored CRC leaves the native decoder
// to handle transparency, antialiasing, lighting and all pixel decompression.
async function loadSheet(file) {
  const response = await fetch(new URL('../art/' + file, import.meta.url))
  if (!response.ok) throw Error('Part sheet ' + response.status)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const view = new DataView(bytes.buffer), swatches = new Map(), decoder = new TextDecoder()
  let palette = -1
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset), start = offset + 8, end = start + length
    if (end + 4 > bytes.length) throw Error('Incomplete part sheet')
    const tag = view.getUint32(offset + 4)
    if (tag === 0x504c5445 && length === 768) palette = start // PLTE
    if (tag === 0x72704c74) { // rpLt
      let pos = start
      while (pos < end) {
        const size = bytes[pos++], nameEnd = pos + size, next = nameEnd + 772
        if (next > end) throw Error('Incomplete paint palette')
        swatches.set(decoder.decode(bytes.subarray(pos, nameEnd)), bytes.subarray(nameEnd, next))
        pos = next
      }
    }
    offset = end + 4
  }
  if (palette < 0 || !swatches.size) throw Error('Missing paint palette')
  return { bytes, palette, swatches }
}
function paintedSheet(file, color) {
  const key = `${file}/${color}`
  let record = displayed.get(key)
  if (!record) {
    if (!sources.has(file)) sources.set(file, loadSheet(file).catch(error => { sources.delete(file); throw error }))
    record = { users: 0, timer: 0 }
    record.ready = sources.get(file).then(async ({ bytes, palette, swatches }) => {
      const swatch = swatches.get(color)
      if (!swatch) throw Error('Missing paint ' + color)
      const png = new Blob([bytes.subarray(0, palette), swatch, bytes.subarray(palette + swatch.length)], { type: 'image/png' })
      const url = URL.createObjectURL(png)
      const probe = new Image()
      probe.src = url
      try {
        await probe.decode()
        return url
      } catch (error) {
        URL.revokeObjectURL(url)
        throw error
      }
    })
    displayed.set(key, record)
  }
  clearTimeout(record.timer)
  record.users++
  return { ready: record.ready, release() {
    if (--record.users) return
    // A shelf rerender replaces four cards at once. Reuse their existing
    // decoded sheet through that change, then release it when leaving the shelf.
    record.timer = setTimeout(() => {
      if (record.users) return
      displayed.delete(key)
      record.ready.then(url => URL.revokeObjectURL(url), () => {})
    }, 1000)
  } }
}
if (globalThis.customElements && !customElements.get('rally-part-picture')) {
  customElements.define('rally-part-picture', class extends HTMLElement {
    connectedCallback() {
      const { file, paint } = this.dataset
      if (paint === basePaint || !sheets.includes(file)) return
      const sheet = paintedSheet(file, paint)
      this.sheet = sheet
      sheet.ready.then(url => {
        if (this.sheet === sheet) this.querySelector('image')?.setAttribute('href', url)
      }, () => {}) // The printed Steel Blue portrait remains usable offline on any failed read.
    }
    disconnectedCallback() { this.sheet?.release(); this.sheet = null }
  })
}

export function partArt(slot, index, chassis = 0, paint = basePaint) {
  const id = typeof slot === 'string' ? slot : slot?.id
  const row = rows.indexOf(id === 'cpu' || id === 'logic' ? 'brain' : id)
  if (row < 0 || !Number.isInteger(index) || index < 0 || index > 3) return ''
  const file = sheets[Number.isInteger(chassis) ? chassis : 0] ?? sheets[0]
  const color = paints.find(swatch => paint === swatch[0] || paint === swatch[2])?.[0] ?? basePaint
  return `<rally-part-picture class="part-art" aria-hidden="true" data-file="${file}" data-paint="${color}" style="background:none"><svg width="100%" height="100%" viewBox="0 0 160 120" focusable="false"><svg width="160" height="120" overflow="hidden" viewBox="${index * 160} ${row * 120} 160 120"><image width="640" height="720" href="./art/${file}"/></svg></svg></rally-part-picture>`
}
