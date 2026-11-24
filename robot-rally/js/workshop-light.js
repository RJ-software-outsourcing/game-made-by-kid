import * as T from '../vendor/three.module.js'

// The prefiltered cube is stored at 1/5.25 exposure in sRGB. Decode it once
// so chrome can reflect a bright window while the bench below it stays dark.
export function workshopProbe(texture, renderer) {
  const image = texture.image
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const hdr =
    renderer.capabilities.isWebGL2 ||
    (renderer.extensions.has('OES_texture_half_float') &&
      renderer.extensions.has('OES_texture_half_float_linear'))
  const Pixel = hdr ? Uint16Array : Uint8Array
  const lookup = new Pixel(256)
  for (let i = 0; i < lookup.length; i++) {
    const s = i / 255
    const linear = 5.25 * (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4)
    lookup[i] = hdr ? T.DataUtils.toHalfFloat(linear) : Math.round(255 * Math.min(1, linear))
  }
  const rgba = new Pixel(pixels.length)
  const opaque = hdr ? T.DataUtils.toHalfFloat(1) : 255
  for (let i = 0; i < pixels.length; i += 4) {
    rgba[i] = lookup[pixels[i]]
    rgba[i + 1] = lookup[pixels[i + 1]]
    rgba[i + 2] = lookup[pixels[i + 2]]
    rgba[i + 3] = opaque
  }
  const map = new T.DataTexture(
    rgba,
    canvas.width,
    canvas.height,
    T.RGBAFormat,
    hdr ? T.HalfFloatType : T.UnsignedByteType
  )
  map.name = 'Garage windows and work lights'
  map.mapping = T.CubeUVReflectionMapping
  map.colorSpace = T.LinearSRGBColorSpace
  map.minFilter = map.magFilter = T.LinearFilter
  map.needsUpdate = true
  texture.dispose()
  return map
}
