// Solve in the horizontal plane of the mirror axles, then project into the photographed room.
CastleScenes["star-optics"] = (() => {
  const point = ([x, y]) => ({ x, y });
  function surfaceHit(from, dx, dy, center, a, limit = Infinity) {
    const { radius, sag, silverOffset } = CastleScenes["meridian-models"];
    const tx = Math.cos(a),
      ty = Math.sin(a),
      px = from.x - center.x,
      py = from.y - center.y;
    const u = px * tx + py * ty,
      v = -px * ty + py * tx,
      du = dx * tx + dy * ty,
      dv = -dx * ty + dy * tx;
    const curve = sag / radius;
    let best = null;
    for (const side of [-1, 1]) {
      const A = side * curve * du * du,
        B = 2 * side * curve * u * du - dv,
        C = side * (silverOffset + curve * u * u) - v;
      const disc = B * B - 4 * A * C;
      if (disc < 0) continue;
      const q = -0.5 * (B + Math.sign(B || 1) * Math.sqrt(disc));
      const roots = Math.abs(A) < 1e-9 ? [-C / B] : [q / A, C / q];
      for (const distance of roots) {
        if (!(distance > 1e-5 && distance < limit)) continue;
        const across = u + distance * du,
          slope = 2 * curve * across;
        if (Math.abs(across) > radius * 0.945 || side * dv - slope * du >= 0) continue;
        limit = distance;
        best = { distance, tangent: a + Math.atan(side * slope) };
      }
    }
    return best;
  }
  // Set the detents against the real optical surface. Carry the measured exit
  // ray onwards, including the small offset of the silver above the spindle.
  function aim(from, incoming, mount, next) {
    const dx = Math.cos(incoming),
      dy = Math.sin(incoming);
    const ideal = (incoming + Math.atan2(next.y - mount.y, next.x - mount.x)) / 2;
    function measure(angle) {
      const hit = surfaceHit(from, dx, dy, mount, angle);
      if (!hit) return null;
      const p = { x: from.x + dx * hit.distance, y: from.y + dy * hit.distance };
      const out = 2 * hit.tangent - incoming,
        delta = out - Math.atan2(next.y - p.y, next.x - p.x);
      return { point: p, out, error: Math.atan2(Math.sin(delta), Math.cos(delta)) };
    }
    let angle = ideal,
      reading = measure(angle);
    for (let i = 0; i < 6 && reading && Math.abs(reading.error) > 1e-8; i++) {
      const adjacent = measure(angle + 0.0001);
      if (!adjacent) break;
      const derivative = (adjacent.error - reading.error) / 0.0001;
      if (Math.abs(derivative) < 0.01) break;
      angle -= Math.max(-0.08, Math.min(0.08, reading.error / derivative));
      reading = measure(angle);
    }
    if (!reading || Math.abs(reading.error) > 0.0001) throw Error("Unreachable meridian detent");
    return { ...reading, angle };
  }
  function chart(index) {
    // All arrangements are fed from the same optical port in the armillary plinth.
    const lamp = point([0.5, 0.035]);
    const plans = [
      [
        [0.5, 0.4],
        [0.31, 0.45],
        [0.35, 0.21],
      ],
      [
        [0.5, 0.22],
        [0.68, 0.27],
        [0.64, 0.48],
      ],
      [
        [0.5, 0.48],
        [0.72, 0.45],
        [0.68, 0.24],
      ],
    ];
    const mounts = plans[index].map(point);
    const targets = [
      [0.13, 0.22],
      [0.87, 0.17],
      [0.86, 0.5],
    ].map(point);
    const direction = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
    const incoming = direction(lamp, mounts[0]);
    const first = aim(lamp, incoming, mounts[0], mounts[1]);
    const second = aim(first.point, first.out, mounts[1], mounts[2]);
    const a = first.angle,
      b = second.angle;
    const stops = [
      [a, a + 1.1],
      [b, b - 0.68, b + 1.22],
      targets.map((t) => aim(second.point, second.out, mounts[2], t).angle),
    ];
    for (let i = 0; i < index; i++) {
      stops[0].push(stops[0].shift());
      stops[1].push(stops[1].shift());
    }
    return { lamp, mounts, targets, stops, incoming };
  }
  function trace(faces, layout, movingAngles) {
    const receiverRadius = CastleScenes["meridian-models"].radius * 0.49;
    const { lamp, mounts, targets, stops, incoming } = layout;
    const path = [lamp],
      contacts = [],
      seen = new Set();
    let dx = Math.cos(incoming),
      dy = Math.sin(incoming),
      target = -1;
    const angles = movingAngles || stops.map((options, i) => options[faces[i]]);
    for (let bounce = 0; bounce < 9; bounce++) {
      const from = path.at(-1);
      const wallX = dx > 0 ? 0.98 : 0.02,
        wallY = dy > 0 ? 0.6 : 0.0;
      let distance = Math.min(
        Math.abs(dx) > 1e-7 ? (wallX - from.x) / dx : Infinity,
        Math.abs(dy) > 1e-7 ? (wallY - from.y) / dy : Infinity,
      );
      let mirror = -1,
        hitTangent = 0;
      const last = contacts.at(-1);
      mounts.forEach((center, i) => {
        if (last === i) return;
        const hit = surfaceHit(from, dx, dy, center, angles[i], distance);
        if (hit) {
          distance = hit.distance;
          mirror = i;
          hitTangent = hit.tangent;
        }
      });
      targets.forEach((center, i) => {
        const px = center.x - from.x,
          py = center.y - from.y;
        const across = px * dy - py * dx;
        if (Math.abs(across) >= receiverRadius) return;
        const along = px * dx + py * dy - Math.sqrt(receiverRadius ** 2 - across ** 2);
        if (along > 1e-5 && along < distance) {
          distance = along;
          target = i;
          mirror = -1;
        }
      });
      const hit = { x: from.x + dx * distance, y: from.y + dy * distance };
      path.push(hit);
      if (mirror < 0) break;
      contacts.push(mirror);
      seen.add(mirror);
      const angle = 2 * hitTangent - Math.atan2(dy, dx);
      dx = Math.cos(angle);
      dy = Math.sin(angle);
    }
    return { path, target, full: seen.size === 3, contacts };
  }
  function solutions(goal, layout) {
    const { stops } = layout;
    const matches = [];
    stops[0].forEach((_, a) =>
      stops[1].forEach((_, b) =>
        stops[2].forEach((_, c) => {
          const state = [a, b, c],
            ray = trace(state, layout);
          if (ray.target === goal) matches.push(state);
        }),
      ),
    );
    return matches;
  }
  function create(s, complete) {
    const signs = CastleScenes["chamber-rules"].signs;
    const first = s.rule.goal;
    const firstLayout = Math.floor(Math.random() * 3);
    const goals = [first, (first + 1 + Math.floor(Math.random() * 2)) % 3];
    const layout = chart(firstLayout),
      { stops } = layout;
    const room = CastleScenes["meridian-room"].create(s, layout, CastleScenes["meridian-models"].radius);
    let round = 0,
      stable = 0,
      faces,
      angles;
    function setRound() {
      const answers = solutions(goals[round], layout);
      if (answers.length !== 1 || !trace(answers[0], layout).full)
        throw Error("The meridian needs one complete light path.");
      faces = answers[0].map(
        (f, i) => (f + 1 + Math.floor(Math.random() * (stops[i].length - 1))) % stops[i].length,
      );
      if (!angles) angles = faces.map((f, i) => stops[i][f]);
      stable = 0;
    }
    setRound();
    const scroll = () => "Turn the mirrors. Shine the light on the " + signs[goals[round]] + ".";
    return {
      scroll,
      drawRoom: room.drawRoom,
      ground: room.ground,
      begin: () => s.hint(scroll()),
      update(dt) {
        angles = angles.map((a, i) => a + range(stops[i][faces[i]] - a, -4 * dt, 4 * dt));
        const ray = trace(faces, layout, angles);
        stable =
          ray.full &&
          ray.target === goals[round] &&
          angles.every((a, i) => Math.abs(a - stops[i][faces[i]]) < 0.001)
            ? stable + dt
            : 0;
        if (stable > 0.65) {
          s.chime(620);
          if (round === 1) complete();
          else {
            round++;
            setRound();
            s.hint(scroll());
          }
        }
      },
      pick(pos) {
        const idx = room.pick(pos, angles);
        if (idx < 0) return false;
        faces[idx] = (faces[idx] + 1) % stops[idx].length;
        stable = 0;
        s.chime(365 + idx * 89);
        return true;
      },
      draw() {
        const ray = trace(faces, layout, angles);
        room.draw(angles, ray, goals[round], stable);
      },
    };
  }
  const range = (v, a, b) => Math.max(a, Math.min(b, v));
  return { create, trace, solutions, chart };
})();
