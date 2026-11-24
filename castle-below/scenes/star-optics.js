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
    // Symmetric layouts: the first mirror stands under the light port, the other two
    // form a left/right pair. The three receivers fan out evenly around the armillary:
    // left, front and right.
    const plans = [
      [
        [0.5, 0.2],
        [0.3, 0.38],
        [0.7, 0.38],
      ],
      [
        [0.5, 0.2],
        [0.7, 0.38],
        [0.3, 0.38],
      ],
      [
        [0.5, 0.25],
        [0.22, 0.36],
        [0.78, 0.36],
      ],
    ];
    const mounts = plans[index].map(point);
    const targets = [
      [0.11, 0.26],
      [0.5, 0.485],
      [0.89, 0.26],
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
    const rule = s.rule;
    const firstLayout = Math.floor(Math.random() * 3);
    const layout = chart(firstLayout),
      { stops } = layout;
    const room = CastleScenes["meridian-room"].create(s, layout, CastleScenes["meridian-models"].radius);
    // Mirror rounds list the signs that count ("Not this one" accepts either remaining sign).
    // Comet rounds are solved by turning the armillary crystal itself until its beam meets
    // the comet. While the crystal points at the sky, no light reaches the floor port.
    let round = 0,
      stable = 0,
      wrong = 0,
      faces,
      angles;
    const lit = [];
    const crystal = room.crystal;
    const cometRound = () => !!rule.rounds[round].comet;
    const allowed = () => (cometRound() ? [] : rule.rounds[round].allowed.filter((g) => !lit.includes(g)));
    function setRound() {
      stable = wrong = 0;
      if (cometRound()) {
        crystal.aim = 0;
        if (!faces) faces = stops.map(() => 0);
        if (!angles) angles = faces.map((f, i) => stops[i][f]);
        return;
      }
      crystal.aim = 0;
      const goals = allowed();
      for (const goal of goals) {
        const answers = solutions(goal, layout);
        if (answers.length !== 1 || !trace(answers[0], layout).full)
          throw Error("The meridian needs one complete light path.");
      }
      // Start every mirror away from the answer; never start on any sign that would count.
      const answer = solutions(goals[0], layout)[0];
      for (let tries = 0; tries < 40; tries++) {
        faces = answer.map((f, i) => (f + 1 + Math.floor(Math.random() * (stops[i].length - 1))) % stops[i].length);
        const ray = trace(faces, layout);
        if (!(ray.full && goals.includes(ray.target))) break;
      }
      angles = angles || faces.map((f, i) => stops[i][f]);
    }
    setRound();
    const scroll = () => (rule.perRound ? rule.rounds[round].line : rule.text);
    const tell = () => s.hint("Light " + (round + 1) + " of " + rule.rounds.length);
    function advance(target) {
      s.chime(620);
      if (target !== undefined) lit.push(target);
      if (round === rule.rounds.length - 1) complete();
      else {
        round++;
        setRound();
        if (rule.perRound) s.notice(rule.rounds[round].line);
        tell();
      }
    }
    return {
      scroll,
      drawRoom: room.drawRoom,
      ground: room.ground,
      begin: tell,
      update(dt) {
        angles = angles.map((a, i) => a + range(stops[i][faces[i]] - a, -4 * dt, 4 * dt));
        room.updateCrystal(dt);
        if (cometRound()) {
          stable = crystal.onComet() ? stable + dt : 0;
          if (stable > 0.8) advance();
          return;
        }
        const ray = trace(faces, layout, angles);
        const feeding = crystal.feedsPort();
        const resting = feeding && ray.full && angles.every((a, i) => Math.abs(a - stops[i][faces[i]]) < 0.001);
        stable = resting && allowed().includes(ray.target) ? stable + dt : 0;
        // A full path onto a sign the scroll did not ask for: one gentle reminder.
        wrong = resting && ray.target >= 0 && !allowed().includes(ray.target) ? wrong + dt : 0;
        if (wrong > 0.9 && wrong - dt <= 0.9) {
          s.tone(160, 0.35, "triangle", 0.1, 100);
          s.hint(lit.includes(ray.target) ? "That one is done. Read the scroll again." : "Not that sign. Read the scroll again.");
        }
        if (stable > 0.65) advance(ray.target);
      },
      pick(pos) {
        // The big crystal turns only when the scroll asks for the comet.
        if (room.hitCrystal(pos)) {
          if (cometRound()) {
            crystal.aim = (crystal.aim + 1) % crystal.stops();
            stable = 0;
            s.chime(300 + crystal.aim * 70);
          } else s.hint("The big crystal will not turn now. Use the mirrors.");
          return true;
        }
        if (cometRound()) return false;
        const idx = room.pick(pos, angles);
        if (idx < 0) return false;
        faces[idx] = (faces[idx] + 1) % stops[idx].length;
        stable = 0;
        s.chime(365 + idx * 89);
        return true;
      },
      draw() {
        const ray = trace(faces, layout, angles);
        const feeding = crystal.feedsPort();
        room.draw(angles, feeding ? ray : { path: [layout.lamp], target: -1, full: false, contacts: [] }, feeding && allowed().includes(ray.target) ? ray.target : -1, stable);
      },
    };
  }
  const range = (v, a, b) => Math.max(a, Math.min(b, v));
  return { create, trace, solutions, chart };
})();
