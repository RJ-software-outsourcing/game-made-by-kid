// The instruments use the reflector's clear radius as the modelling unit.
// x is along the glass, y across its face, and z is height above the slate.
CastleScenes["meridian-models"] = (() => {
  const radius = 0.054,
    beamHeight = 0.076,
    hub = beamHeight / radius;
  const silverOffset = 0.00085,
    sag = 0.18;
  const tau = 2 * Math.PI;
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (a) => {
    const len = Math.hypot(...a) || 1;
    return a.map((v) => v / len);
  };
  const addScaled = (a, b, t) => a.map((v, i) => v + b[i] * t);
  const Z = [0, 0, 1],
    Y = [0, 1, 0];
  function builder() {
    const vertices = [],
      triangles = [];
    let turning = false;
    function vertex(p, n) {
      vertices.push([...p, ...n, turning]);
      return vertices.length - 1;
    }
    function quad(a, b, c, d, m) {
      triangles.push([a, b, c, m], [a, c, d, m]);
    }
    function plate(points, m) {
      const n = unit(cross(sub(points[1], points[0]), sub(points[2], points[0])));
      const ids = points.map((p) => vertex(p, n));
      for (let j = 1; j + 1 < ids.length; j++) triangles.push([ids[0], ids[j], ids[j + 1], m]);
    }
    // A profile describes the section of an actual turned casting, including
    // the bevels, lips and recessed grooves between visible material changes.
    function lathe(o, axis, profile, material, sides = 40, smooth = true) {
      const u = unit(cross(Math.abs(axis[2]) > 0.9 ? Y : Z, axis)),
        v = cross(axis, u);
      const ring = Array.from({ length: sides + 1 }, (_, i) => {
        const a = (tau * i) / sides;
        return u.map((n, j) => n * Math.cos(a) + v[j] * Math.sin(a));
      });
      for (let k = 1; k < profile.length; k++) {
        const [r0, h0] = profile[k - 1],
          [r1, h1, mat] = profile[k];
        const dz = h1 - h0,
          dr = r1 - r0,
          len = Math.hypot(dz, dr);
        if (!len) continue;
        const normal = (d) => d.map((v, j) => (v * dz - axis[j] * dr) / len);
        const pos = (r, h, d) => o.map((v, j) => v + axis[j] * h + d[j] * r);
        if (smooth) {
          let prev;
          for (const d of ring) {
            const n = normal(d),
              pair = [vertex(pos(r0, h0, d), n), vertex(pos(r1, h1, d), n)];
            if (prev) quad(prev[0], pair[0], pair[1], prev[1], mat || material);
            prev = pair;
          }
        } else {
          for (let i = 0; i < sides; i++) {
            const d = ring[i],
              e = ring[i + 1],
              n = normal(unit(addScaled(d, e, 1)));
            quad(
              vertex(pos(r0, h0, d), n),
              vertex(pos(r0, h0, e), n),
              vertex(pos(r1, h1, e), n),
              vertex(pos(r1, h1, d), n),
              mat || material,
            );
          }
        }
      }
    }
    function pin(a, b, r, m, sides = 10) {
      const dir = sub(b, a),
        h = Math.hypot(...dir),
        bevel = Math.min(r * 0.24, h * 0.2);
      lathe(
        a,
        unit(dir),
        [
          [0, 0],
          [r * 0.83, 0],
          [r, bevel],
          [r, h - bevel],
          [r * 0.82, h],
          [0, h],
        ],
        m,
        sides,
      );
    }
    function tube(points, r, m, sides = 8) {
      const up = unit(cross(sub(points[1], points[0]), sub(points.at(-1), points[0])));
      let previous;
      for (let i = 0; i < points.length; i++) {
        const tangent = unit(sub(points[Math.min(i + 1, points.length - 1)], points[Math.max(0, i - 1)]));
        const across = unit(cross(tangent, up));
        const row = [];
        for (let j = 0; j < sides; j++) {
          const t = (tau * j) / sides,
            n = across.map((v, k) => v * Math.cos(t) + up[k] * Math.sin(t));
          row.push(vertex(addScaled(points[i], n, r), n));
        }
        if (previous)
          for (let j = 0; j < sides; j++) {
            const k = (j + 1) % sides;
            quad(previous[j], previous[k], row[k], row[j], m);
          }
        previous = row;
      }
    }
    return { vertices, triangles, plate, lathe, pin, tube, setTurning: (on) => (turning = on) };
  }
  function foot(b, receiver) {
    const r = receiver ? 0.77 : 0.94;
    b.lathe(
      [0, 0, 0],
      Z,
      [
        [0, 0],
        [r, 0],
        [r, 0.075],
        [r * 0.94, 0.11],
        [r * 0.92, 0.16],
        [r * 0.87, 0.18],
        [0, 0.18],
      ],
      "slate",
      12,
      false,
    );
    b.lathe(
      [0, 0, 0],
      Z,
      [
        [0, 0.15],
        [r * 0.9, 0.15],
        [r * 0.92, 0.18, "edge"],
        [r * 0.92, 0.205],
        [r * 0.78, 0.22],
        [r * 0.76, 0.26],
        [0, 0.26],
      ],
      "bronze",
    );
  }
  function makeMirror() {
    const b = builder();
    foot(b, false);
    // Fixed vernier dial and the turning spindle that runs through it.
    b.lathe(
      [0, 0, 0],
      Z,
      [
        [0, 0.24],
        [0.76, 0.24],
        [0.78, 0.29],
        [0.75, 0.32, "edge"],
        [0.72, 0.328],
        [0.65, 0.36, "edge"],
        [0.59, 0.35],
        [0.57, 0.32],
        [0.5, 0.335],
        [0.46, 0.41],
        [0.36, 0.43],
        [0.29, 0.5],
        [0, 0.5],
      ],
      "bronze",
    );
    for (let i = 0; i < 44; i++) {
      const a = (tau * i) / 44,
        c = Math.cos(a),
        s = Math.sin(a),
        outer = i % 4 === 0 ? 0.728 : 0.702;
      b.plate(
        [
          [c * 0.653 - s * 0.008, s * 0.653 + c * 0.008, 0.365],
          [c * outer - s * 0.008, s * outer + c * 0.008, 0.347],
          [c * outer + s * 0.008, s * outer - c * 0.008, 0.347],
          [c * 0.653 + s * 0.008, s * 0.653 - c * 0.008, 0.365],
        ].reverse(),
        "mark",
      );
    }
    for (let i = 0; i < 6; i++) {
      const a = (tau * (i + 0.5)) / 6,
        x = 0.81 * Math.cos(a),
        y = 0.81 * Math.sin(a);
      b.lathe(
        [x, y, 0],
        Z,
        [
          [0.052, 0.178],
          [0.059, 0.183],
          [0.055, 0.216],
          [0.045, 0.221],
          [0, 0.221],
        ],
        "iron",
        6,
        false,
      );
    }
    // The fixed inclined index circle belongs to the observatory, not to the
    // moving optical drum. Three feet carry it above the azimuth carriage.
    const indexAxis = unit([0.21, 0.36, 1]),
      indexCenter = [0, 0, hub - 0.38];
    b.lathe(
      indexCenter,
      indexAxis,
      [
        [1.12, -0.047],
        [1.176, -0.047],
        [1.19, -0.03, "edge"],
        [1.19, 0.028],
        [1.174, 0.049, "edge"],
        [1.12, 0.049],
        [1.12, -0.047],
      ],
      "bronze",
      64,
    );
    for (const a of [-2.4, -0.55, 1.4]) {
      const x = 1.095 * Math.cos(a),
        y = 1.095 * Math.sin(a);
      b.pin([x * 0.48, y * 0.48, 0.27], [x, y, hub - 0.38 - 0.21 * x - 0.36 * y], 0.035, "bronze");
    }
    b.setTurning(true);
    // Cast U-shaped cradle and split braces. Both axle ends emerge from the ring.
    const arc = [];
    for (let i = 0; i <= 34; i++) {
      const a = (Math.PI * i) / 34;
      arc.push([1.15 * Math.cos(a), 0, hub - 0.98 * Math.sin(a)]);
    }
    b.tube(arc, 0.084, "bronze", 10);
    for (const side of [-1, 1]) {
      for (const y of [-0.19, 0.19]) {
        const brace = [
          [side * 0.17, y * 0.65, 0.4],
          [side * 0.48, y * 1.3, 0.49],
          [side * 0.78, y * 1.27, 0.68],
          [side * 1.01, y * 0.86, 0.91],
          [side * 1.15, y * 0.32, hub],
        ];
        b.tube(brace, 0.043, "edge", 8);
      }
      b.lathe(
        [side * 0.99, 0, hub],
        [side, 0, 0],
        [
          [0.115, 0],
          [0.13, 0.04],
          [0.11, 0.17],
          [0.167, 0.18],
          [0.176, 0.215],
          [0.147, 0.253, "edge"],
          [0.085, 0.265],
          [0.058, 0.297],
          [0, 0.305],
        ],
        "bronze",
        24,
      );
    }
    const o = [0, 0, hub];
    // A double-sided optical flat sits inside a deep, turned barrel. The open
    // space between the barrel and the fork stays visible from either flank.
    b.lathe(
      o,
      Y,
      [
        [0.958, -0.248],
        [1.026, -0.248, "edge"],
        [1.063, -0.217],
        [1.066, -0.187],
        [1.044, -0.163],
        [1.044, 0.163, "iron"],
        [1.066, 0.187],
        [1.063, 0.217],
        [1.026, 0.248, "edge"],
        [0.958, 0.248],
        [0.945, 0.197, "iron"],
      ],
      "bronze",
      64,
    );
    for (const side of [-1, 1]) {
      const axis = [0, side, 0],
        lift = silverOffset / radius,
        profile = [];
      for (let i = 14; i >= 0; i--) {
        const r = i / 14;
        profile.push([r, lift + sag * r * r]);
      }
      b.lathe(o, axis, profile, "silver", 64);
    }
    // Two deeply bowed spider ribs take the load of the opposite faces at
    // their rim. From the side the arches reveal the depth of the casting.
    for (const side of [-1, 1]) {
      const crown = [];
      for (let i = 0; i <= 28; i++) {
        const a = (Math.PI * i) / 28;
        crown.push([0.985 * Math.cos(a), side * (0.238 + 0.11 * Math.sin(a)), hub + 0.973 * Math.sin(a)]);
      }
      b.tube(crown, 0.032, "edge", 7);
    }
    for (let i = 0; i < 16; i++) {
      const a = (tau * i) / 16,
        ax = [Math.cos(a), 0, Math.sin(a)];
      const p = [ax[0] * 1.049, 0, hub + ax[2] * 1.049];
      b.lathe(
        p,
        ax,
        [
          [0.042, 0],
          [0.043, 0.018],
          [0.032, 0.031],
          [0, 0.033],
        ],
        "edge",
        8,
      );
    }
    return b;
  }
  function emblem(b, index) {
    const color = ["gold", "moon", "jade"][index],
      z = 0.65;
    // Raised inlay on an inclined stone facet, facing the entrance.
    const at = (x, t, h) => [x, 0.64 - 0.31 * t + h, z + t];
    const thickness = 0.032,
      R = 0.258;
    function strip(a, bp, c, d) {
      b.plate([at(...a, thickness), at(...bp, thickness), at(...c, thickness), at(...d, thickness)], color);
      b.plate([at(...a, 0), at(...bp, 0), at(...bp, thickness), at(...a, thickness)], "bronze");
    }
    if (index === 1) {
      for (let i = 0; i < 28; i++) {
        const u = i / 28,
          v = (i + 1) / 28;
        const outer = (t) => {
          const a = Math.PI / 3 + (t * 4 * Math.PI) / 3;
          return [R * Math.cos(a), R * Math.sin(a)];
        };
        const inner = (t) => {
          const a = 1.82 + t * (2 * Math.PI - 3.64);
          return [R * (0.72 + 0.895 * Math.cos(a)), R * 0.895 * Math.sin(a)];
        };
        strip(outer(u), outer(v), inner(v), inner(u));
      }
    } else {
      const count = index === 0 ? 24 : 10;
      const edge = (i) => {
        const a = Math.PI * 0.5 + (tau * i) / count,
          r = i % 2 ? R * (index === 0 ? 0.64 : 0.43) : R;
        return [r * Math.cos(a), r * Math.sin(a)];
      };
      for (let i = 0; i < count; i++) {
        const a = edge(i),
          d = edge(i + 1);
        b.plate([at(0, 0, thickness + 0.042), at(...a, thickness), at(...d, thickness)], color);
        b.plate([at(...a, 0), at(...d, 0), at(...d, thickness), at(...a, thickness)], "bronze");
      }
    }
  }
  function makeReceiver(index) {
    const b = builder();
    foot(b, true);
    // An octagonal stone lantern with a leaning, cast sign and an exposed
    // crystal collector. It can receive a grazing ray from either side.
    b.lathe(
      [0, 0, 0],
      Z,
      [
        [0.65, 0.24],
        [0.69, 0.29],
        [0.63, 0.36],
        [0.61, 0.46],
        [0.5, 0.88],
        [0.47, 0.92],
        [0.5, 0.945],
        [0.51, 0.98, "edge"],
        [0.4, 1.02],
        [0.33, 1.085],
        [0, 1.085],
      ],
      "slate",
      8,
      false,
    );
    // The circular bezel is fixed into the broad front facet.
    b.lathe(
      [0, 0.615, 0.65],
      unit([0, 1, 0.31]),
      [
        [0, -0.055],
        [0.35, -0.055],
        [0.348, 0.012],
        [0.326, 0.037, "edge"],
        [0.305, 0.034],
        [0, 0.034, "iron"],
      ],
      "bronze",
      38,
    );
    emblem(b, index);
    // A pair of nested meridian bands repeats the large armillary's ironwork.
    for (const tilt of [-0.53, 0.72]) {
      const loop = [];
      for (let i = 0; i <= 52; i++) {
        const a = (tau * i) / 52,
          z = 0.548 * Math.sin(a);
        loop.push([0.575 * Math.cos(a), z * Math.sin(tilt), hub + z * Math.cos(tilt)]);
      }
      // Set the closing point exactly; the tube follows this great circle.
      b.tube(loop.slice(0, -1), 0.024, "edge", 7);
    }
    const o = [0, 0, hub],
      glass = ["amber", "ice", "turquoise"][index],
      prof = [];
    for (let i = 0; i <= 18; i++) {
      const a = -Math.PI / 2 + (Math.PI * i) / 18;
      prof.push([0.49 * Math.cos(a), 0.49 * Math.sin(a)]);
    }
    b.lathe(o, Z, prof, glass, 36);
    b.lathe(
      o,
      Z,
      [
        [0.28, -0.44],
        [0.36, -0.425],
        [0.406, -0.377, "edge"],
        [0.429, -0.335],
        [0.416, -0.31],
      ],
      "bronze",
    );
    for (let i = 0; i < 4; i++) {
      const a = (tau * (i + 0.5)) / 4,
        c = Math.cos(a),
        s = Math.sin(a);
      b.tube(
        [
          [c * 0.27, s * 0.27, 0.96],
          [c * 0.39, s * 0.39, 1.03],
          [c * 0.51, s * 0.51, 1.2],
          [c * 0.5, s * 0.5, 1.39],
          [c * 0.465, s * 0.465, 1.49],
        ],
        0.037,
        "edge",
      );
    }
    return b;
  }
  function rail(layout) {
    // All three carriages ride the same circular rack. Recover its centre from
    // their axle locations for each arrangement; the feed enters at the plinth.
    const [a, b, c] = layout.mounts,
      x = b.x - a.x,
      y = b.y - a.y,
      m = c.x - a.x,
      n = c.y - a.y,
      d = 2 * (x * n - y * m);
    const cx = ((x * x + y * y) * n - (m * m + n * n) * y) / d,
      cy = ((m * m + n * n) * x - (x * x + y * y) * m) / d;
    const center = { x: a.x + cx, y: a.y + cy },
      radius = Math.hypot(cx, cy),
      mesh = builder();
    mesh.lathe(
      [0, 0, 0],
      Z,
      [
        [0.894, -0.009],
        [1.095, -0.009],
        [1.095, 0.002, "iron"],
        [1.08, 0.012, "edge"],
        [1.056, 0.012, "bronze"],
        [1.046, 0.001, "iron"],
        [1.021, 0.001],
        [1.014, 0.017, "bronze"],
        [0.994, 0.018, "edge"],
        [0.982, 0.001, "iron"],
        [0.94, 0.001],
        [0.93, 0.011, "bronze"],
        [0.904, 0.011],
        [0.894, 0, "edge"],
      ],
      "iron",
      128,
    );
    for (let j = 0; j < 64; j++) {
      const theta = (tau * j) / 64,
        co = Math.cos(theta),
        si = Math.sin(theta),
        rr = j % 4 === 0 ? 0.957 : 0.942;
      mesh.plate(
        [
          [0.922 * co - 0.004 * si, 0.922 * si + 0.004 * co, 0.012],
          [rr * co - 0.004 * si, rr * si + 0.004 * co, 0.012],
          [rr * co + 0.004 * si, rr * si - 0.004 * co, 0.012],
          [0.922 * co + 0.004 * si, 0.922 * si - 0.004 * co, 0.012],
        ],
        "mark",
      );
    }
    const lx = (layout.lamp.x - center.x) / radius,
      ly = (layout.lamp.y - center.y) / radius,
      length = Math.hypot(lx, ly);
    const dx = lx / length,
      dy = ly / length;
    const point = (along, side, z) => [dx * along - dy * side, dy * along + dx * side, z];
    for (const side of [-0.023, 0.023])
      mesh.pin(point(1.065, side, 0.0005), point(length, side, 0.0005), 0.013, "bronze", 10);
    for (let d = 1.105; d < length - 0.02; d += 0.32)
      mesh.plate(
        [
          point(d - 0.016, -0.052, 0.012),
          point(d + 0.016, -0.052, 0.012),
          point(d + 0.016, 0.052, 0.012),
          point(d - 0.016, 0.052, 0.012),
        ],
        "iron",
      );
    return { mesh, center, radius };
  }
  return { radius, beamHeight, silverOffset, sag, mirror: makeMirror, receiver: makeReceiver, rail };
})();
