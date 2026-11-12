// Walkable grid + A* path-finding, so a tap anywhere finds a way around houses, trees and water.

export class NavGrid {
  constructor(half, cell = 1) {
    this.half = half
    this.cell = cell
    this.n = Math.round((half * 2) / cell)
    const size = this.n * this.n
    this.walk = new Uint8Array(size) // static walkability
    this.dyn = new Uint8Array(size) // temporary blocks (e.g. the bear on the bridge)
    this.g = new Float32Array(size)
    this.came = new Int32Array(size)
    this.seen = new Uint32Array(size)
    this.closed = new Uint32Array(size)
    this.stamp = 0
    this.heap = new Int32Array(size)
    this.f = new Float32Array(size)
  }

  i(x) {
    return Math.floor((x + this.half) / this.cell)
  }
  center(i) {
    return -this.half + (i + 0.5) * this.cell
  }
  inside(ix, iz) {
    return ix >= 0 && iz >= 0 && ix < this.n && iz < this.n
  }
  ok(ix, iz) {
    if (!this.inside(ix, iz)) return false
    const k = iz * this.n + ix
    return this.walk[k] === 1 && this.dyn[k] === 0
  }
  okAt(x, z) {
    return this.ok(this.i(x), this.i(z))
  }

  build(isWalkable) {
    const n = this.n
    for (let iz = 0; iz < n; iz++) {
      const z = this.center(iz)
      for (let ix = 0; ix < n; ix++) this.walk[iz * n + ix] = isWalkable(this.center(ix), z) ? 1 : 0
    }
  }

  // Mark a circle (or a rotated rectangle) as blocked. Used for obstacles.
  blockCircle(x, z, r, arr = this.walk, value = 0) {
    const i0 = this.i(x - r)
    const i1 = this.i(x + r)
    const j0 = this.i(z - r)
    const j1 = this.i(z + r)
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        if (!this.inside(i, j)) continue
        const dx = this.center(i) - x
        const dz = this.center(j) - z
        if (dx * dx + dz * dz <= r * r) arr[j * this.n + i] = value
      }
  }
  blockRect(x, z, w, d, rot, pad = 0, arr = this.walk, value = 0) {
    const c = Math.cos(rot)
    const s = Math.sin(rot)
    const hw = w / 2 + pad
    const hd = d / 2 + pad
    const r = Math.hypot(hw, hd)
    const i0 = this.i(x - r)
    const i1 = this.i(x + r)
    const j0 = this.i(z - r)
    const j1 = this.i(z + r)
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        if (!this.inside(i, j)) continue
        const dx = this.center(i) - x
        const dz = this.center(j) - z
        // rotate into the rectangle's frame (rotation about y)
        const lx = dx * c - dz * s
        const lz = dx * s + dz * c
        if (Math.abs(lx) <= hw && Math.abs(lz) <= hd) arr[j * this.n + i] = value
      }
  }

  // Closest walkable cell center to (x, z), searching outward up to maxR cells.
  nearest(x, z, maxR = 8) {
    const ci = this.i(x)
    const cj = this.i(z)
    if (this.ok(ci, cj)) return { x, z }
    let best = null
    let bd = Infinity
    for (let r = 1; r <= maxR; r++) {
      for (let j = cj - r; j <= cj + r; j++)
        for (let i = ci - r; i <= ci + r; i++) {
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue
          if (!this.ok(i, j)) continue
          const dx = this.center(i) - x
          const dz = this.center(j) - z
          const d = dx * dx + dz * dz
          if (d < bd) {
            bd = d
            best = { x: this.center(i), z: this.center(j) }
          }
        }
      if (best) return best
    }
    return null
  }

  // Straight walk from a to b stays on walkable cells?
  clear(ax, az, bx, bz) {
    const dist = Math.hypot(bx - ax, bz - az)
    const steps = Math.ceil(dist / (this.cell * 0.35))
    for (let s = 1; s <= steps; s++) {
      const t = s / steps
      if (!this.okAt(ax + (bx - ax) * t, az + (bz - az) * t)) return false
    }
    return true
  }

  // A* over 8 neighbours (no corner cutting). Returns [{x, z}, ...] ending at the goal, or null.
  find(sx, sz, tx, tz, maxNodes = 60000) {
    const start = this.nearest(sx, sz, 4)
    const goal = this.nearest(tx, tz, 10)
    if (!start || !goal) return null
    if (this.clear(sx, sz, goal.x, goal.z)) return [goal]
    const n = this.n
    const si = this.i(start.x)
    const sj = this.i(start.z)
    const gi = this.i(goal.x)
    const gj = this.i(goal.z)
    const startK = sj * n + si
    const goalK = gj * n + gi
    const stamp = ++this.stamp
    const { g, came, seen, closed, heap, f } = this
    let size = 0
    const push = (k) => {
      let p = size++
      heap[p] = k
      while (p > 0) {
        const parent = (p - 1) >> 1
        if (f[heap[parent]] <= f[heap[p]]) break
        const tmp = heap[parent]
        heap[parent] = heap[p]
        heap[p] = tmp
        p = parent
      }
    }
    const pop = () => {
      const top = heap[0]
      heap[0] = heap[--size]
      let p = 0
      for (;;) {
        const l = 2 * p + 1
        const r = l + 1
        let m = p
        if (l < size && f[heap[l]] < f[heap[m]]) m = l
        if (r < size && f[heap[r]] < f[heap[m]]) m = r
        if (m === p) break
        const tmp = heap[m]
        heap[m] = heap[p]
        heap[p] = tmp
        p = m
      }
      return top
    }
    const h = (i, j) => {
      const dx = Math.abs(i - gi)
      const dy = Math.abs(j - gj)
      return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy)
    }
    g[startK] = 0
    seen[startK] = stamp
    came[startK] = -1
    f[startK] = h(si, sj)
    push(startK)
    let found = false
    let count = 0
    while (size > 0 && count++ < maxNodes) {
      const k = pop()
      if (closed[k] === stamp) continue
      closed[k] = stamp
      if (k === goalK) {
        found = true
        break
      }
      const i = k % n
      const j = (k - i) / n
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue
          const ni = i + di
          const nj = j + dj
          if (!this.ok(ni, nj)) continue
          if (di && dj && (!this.ok(i + di, j) || !this.ok(i, j + dj))) continue
          const nk = nj * n + ni
          if (closed[nk] === stamp) continue
          const cost = g[k] + (di && dj ? Math.SQRT2 : 1)
          if (seen[nk] !== stamp || cost < g[nk]) {
            seen[nk] = stamp
            g[nk] = cost
            came[nk] = k
            f[nk] = cost + h(ni, nj) * 1.001
            push(nk)
          }
        }
    }
    if (!found) return null
    const cells = []
    for (let k = goalK; k !== -1; k = came[k]) cells.push(k)
    cells.reverse()
    const pts = cells.map((k) => ({ x: this.center(k % n), z: this.center(Math.floor(k / n)) }))
    pts[pts.length - 1] = { x: goal.x, z: goal.z }
    // String-pulling: skip points that can be seen directly.
    const out = []
    let ax = sx
    let az = sz
    let idx = 0
    while (idx < pts.length) {
      let far = idx
      for (let k = idx + 1; k < pts.length; k++) {
        if (this.clear(ax, az, pts[k].x, pts[k].z)) far = k
        else break
      }
      out.push(pts[far])
      ax = pts[far].x
      az = pts[far].z
      idx = far + 1
    }
    return out
  }
}
