// Small textures made in code at load time (nothing to download): ground detail and water ripples.
// They tile seamlessly, so a 512 px texture can cover the whole island without visible seams.
import * as THREE from 'three'

// Seamless value noise: the lattice wraps every `period` cells.
function hash2(x, y, seed) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2147483647)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}
function pnoise(x, y, period, seed) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const m = (a) => ((a % period) + period) % period
  const a = hash2(m(xi), m(yi), seed)
  const b = hash2(m(xi + 1), m(yi), seed)
  const c = hash2(m(xi), m(yi + 1), seed)
  const d = hash2(m(xi + 1), m(yi + 1), seed)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
// Fractal noise in 0..1 over a tile of `size` pixels with `cells` lattice cells at the base octave.
function fbm(px, py, size, cells, octaves, seed, gain = 0.5) {
  let sum = 0
  let amp = 1
  let norm = 0
  let f = cells
  for (let o = 0; o < octaves; o++) {
    sum += pnoise((px / size) * f, (py / size) * f, f, seed + o * 17) * amp
    norm += amp
    amp *= gain
    f *= 2
  }
  return sum / norm
}

// Cracks between stones: distance to the nearest cell edge (Worley F2 - F1), seamless.
function cells(px, py, size, n, seed) {
  const x = (px / size) * n
  const y = (py / size) * n
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  let f1 = 9
  let f2 = 9
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i
      const cy = yi + j
      const wx = ((cx % n) + n) % n
      const wy = ((cy % n) + n) % n
      const fx = cx + 0.15 + hash2(wx, wy, seed) * 0.7
      const fy = cy + 0.15 + hash2(wx, wy, seed + 1) * 0.7
      const d = Math.hypot(fx - x, fy - y)
      if (d < f1) {
        f2 = f1
        f1 = d
      } else if (d < f2) f2 = d
    }
  return f2 - f1
}

function dataTexture(data, size) {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

// Ground detail, all around 0.5 on average so it only modulates the painted colors:
//   R: grass (little blades and clumps)   G: sand (grain and wind ripples)
//   B: rock / paving stones (cracks)      A: big soft patches (to break up repetition)
export function groundDetail(size = 512) {
  const R = new Float32Array(size * size)
  // grass: clumpy noise plus thousands of short blade strokes, drawn wrapping around the edges
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) R[y * size + x] = 0.38 + fbm(x, y, size, 16, 4, 3) * 0.24
  let seed = 7
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (let s = 0; s < 14000; s++) {
    const x0 = rnd() * size
    const y0 = rnd() * size
    const a = rnd() * Math.PI * 2
    const len = 3 + rnd() * 7
    const v = (rnd() - 0.4) * 0.5
    for (let t = 0; t < len; t++) {
      const x = Math.floor(x0 + Math.cos(a) * t) & (size - 1)
      const y = Math.floor(y0 + Math.sin(a) * t) & (size - 1)
      const k = y * size + x
      R[k] = R[k] * 0.45 + (0.5 + v * (1 - t / len * 0.6)) * 0.55
    }
  }
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const k = y * size + x
      // sand: fine grain + soft ripples bent by noise
      const grain = hash2(x, y, 11) * 0.5 + pnoise(x / 2, y / 2, size / 2, 12) * 0.5
      const warp = fbm(x, y, size, 4, 2, 13) * 6
      const ripple = Math.sin(((x * 0.6 + y) / size) * Math.PI * 2 * 18 + warp) * 0.5 + 0.5
      const sand = 0.3 + grain * 0.28 + ripple * 0.14 + fbm(x, y, size, 8, 3, 14) * 0.2
      // rock: stones with dark cracks, some lumpy relief
      const crack = cells(x, y, size, 7, 21)
      const relief = fbm(x, y, size, 12, 4, 22)
      const rock = 0.22 + Math.min(1, crack * 7) * 0.38 + relief * 0.3
      const macro = fbm(x, y, size, 3, 3, 31)
      data[k * 4] = Math.round(Math.min(1, Math.max(0, R[k])) * 255)
      data[k * 4 + 1] = Math.round(Math.min(1, sand) * 255)
      data[k * 4 + 2] = Math.round(Math.min(1, rock) * 255)
      data[k * 4 + 3] = Math.round(macro * 255)
    }
  return dataTexture(data, size)
}

// Water ripples: a seamless normal map (RG = slope x/z, B = up) from layered noise.
export function waterNormals(size = 256) {
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = fbm(x, y, size, 6, 5, 41, 0.55)
  const data = new Uint8Array(size * size * 4)
  const at = (x, y) => h[(y & (size - 1)) * size + (x & (size - 1))]
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 9
      const dy = (at(x, y + 1) - at(x, y - 1)) * 9
      const l = Math.hypot(dx, dy, 1)
      const k = (y * size + x) * 4
      data[k] = Math.round((-dx / l * 0.5 + 0.5) * 255)
      data[k + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255)
      data[k + 2] = Math.round((1 / l * 0.5 + 0.5) * 255)
      data[k + 3] = Math.round(h[y * size + x] * 255)
    }
  return dataTexture(data, size)
}
