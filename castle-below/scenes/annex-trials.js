// Each room owns its puzzle. The wrapper only handles the scroll, victory pause and return.
//
// Every puzzle reads its play mode and parameters from `s.rule` (built by chamber-rules).
// Hints under the scene only report progress. They never repeat the English instruction,
// so the scroll is the one place to learn what to do.
CastleScenes["annex-trials"] = (() => {
  const range = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const R = () => CastleScenes["chamber-rules"];
  function stations(s, y = 0.5) {
    const gap = Math.min(s.w() * 0.295, s.h() * 0.38);
    return [-1, 0, 1].map((n) => ({ x: s.w() / 2 + n * gap, y: s.h() * y }));
  }
  function touched(p, nodes, r) {
    return nodes.findIndex(
      (n) => Math.abs(n.x - p.x) <= Math.max(23, r) && Math.abs(n.y - p.y) <= Math.max(24, r),
    );
  }
  // Coji takes a few steps toward the thing he is working with.
  function stepToward(s, lane) {
    if (s.player.path.length) return;
    const y = range(4.5 + lane * 1.5, 2.6, 6.4);
    if (Math.abs(s.player.y - y) > 0.2) s.player.path = [{ x: s.player.x, y }];
  }

  function trial(hint, result, setup) {
    return {
      hint,
      result,
      create(s, finish) {
        let ending = -1,
          settled = false,
          started = false;
        const complete = () => {
          if (ending >= 0) return;
          ending = 0;
          s.game.stop();
          s.chime(523);
          s.tone(784, 0.8, "sine", 0.13, 784, 0.16);
          s.hint(result);
        };
        const puzzle = setup(s, complete);
        return {
          ...s.base,
          ground: puzzle.ground || s.base.ground,
          project: puzzle.project || s.base.project,
          heroScale: puzzle.heroScale,
          scroll: () => puzzle.scroll?.() || s.rule.text,
          begin() {
            started = true;
            puzzle.begin?.();
          },
          terminal: () => ending >= 0,
          interact(pos) {
            if (puzzle.pick) return started && ending < 0 ? puzzle.pick(pos) : true;
            // The lower floor is for walking, unless the puzzle has targets down there too.
            if (!puzzle.ownsTaps && pos.y > s.h() * 0.74) return false;
            if (started && ending < 0) puzzle.tap(pos);
            return true;
          },
          update(dt) {
            if (ending >= 0) {
              ending += dt;
              puzzle.finishUpdate?.(dt);
              if (ending >= 1.15 && !settled) {
                settled = true;
                finish();
              }
              return;
            }
            if (started) puzzle.update(dt);
            if (!s.player.moving) s.player.facing = 4;
          },
          draw() {
            (puzzle.drawRoom || s.drawRoom)();
            puzzle.draw();
          },
          shadeForeground: () => puzzle.overlay?.(),
        };
      },
    };
  }

  // ------------------------------------------------------------------ bells
  // The same bronze photograph, finished three ways: polished gold, silver and red paint.
  // Blend modes keep every scratch and highlight of the original casting.
  const FINISH = [
    { color: "#b98a2c", glaze: "#ffe6a8", glazeAlpha: 0.1, satAlpha: 0, mix: 0.82 },
    { color: "#9aa6b4", glaze: "#f4f8ff", glazeAlpha: 0.26, satAlpha: 1, mix: 1 },
    { color: "#8c271f", glaze: "#ff9a80", glazeAlpha: 0.04, satAlpha: 0, mix: 0.85 },
  ];
  const finishCache = new Map();
  function bellSprite(s, finish) {
    const atlas = s.sprite("annexInstruments");
    if (finishCache.has(finish)) return finishCache.get(finish);
    const cell = atlas.width / 3,
      c = document.createElement("canvas");
    c.width = c.height = Math.round(cell);
    const g = c.getContext("2d");
    g.drawImage(atlas, 0, 0, cell, cell, 0, 0, c.width, c.height);
    const f = FINISH[finish];
    if (f.satAlpha) {
      // Silver: take the colour out, then brighten the metal.
      g.globalCompositeOperation = "saturation";
      g.fillStyle = "#808080";
      g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = "soft-light";
      g.fillStyle = f.color;
      g.fillRect(0, 0, c.width, c.height);
    } else {
      // Not a full repaint: some bronze shows through worn edges, like a real finish.
      g.globalCompositeOperation = "color";
      g.globalAlpha = f.mix;
      g.fillStyle = f.color;
      g.fillRect(0, 0, c.width, c.height);
      g.globalAlpha = 1;
    }
    g.globalCompositeOperation = "screen";
    g.globalAlpha = f.glazeAlpha;
    g.fillStyle = f.glaze;
    g.fillRect(0, 0, c.width, c.height);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "destination-in";
    g.drawImage(atlas, 0, 0, cell, cell, 0, 0, c.width, c.height);
    finishCache.set(finish, c);
    return c;
  }
  const bells = trial("Read the scroll. Then play the bells.", "You played the song!", (s, complete) => {
    const rule = s.rule,
      layout = rule.layout;
    let round = 0,
      cursor = 0,
      clock = 0,
      played = 0,
      advance = -1,
      listening = false;
    const light = [0, 0, 0],
      swing = [0, 0, 0];
    // Bigger bells sing lower: the pitch belongs to the casting, not to its place.
    const PITCH = [196, 262, 349];
    const scale = (i) => [1.12, 0.94, 0.76][layout.size[i]];
    const size = () => Math.min(s.w() * 0.27, s.h() * 0.27);
    const current = () => rule.rounds[Math.min(round, rule.rounds.length - 1)];
    const listen = () => !!current().melody;
    function ring(i) {
      light[i] = 0.59;
      swing[i] = 1;
      s.chime(PITCH[layout.size[i]]);
      s.tone(PITCH[layout.size[i]] / 2, 1.4, "sine", 0.06);
    }
    function startRound(replay) {
      cursor = played = 0;
      if (listen()) {
        listening = true;
        clock = replay ? -0.9 : -0.65;
        s.hint(replay ? "Listen again." : "Listen to the bells…");
      } else {
        listening = false;
        s.hint(replay ? "Oops! Read the scroll again." : "Your turn!");
      }
    }
    function nextRound() {
      round++;
      if (round === rule.rounds.length) return complete();
      s.chime(523 + round * 60);
      if (rule.perRound) s.notice(current().line);
      startRound(false);
    }
    function judge(i) {
      ring(i);
      const answer = current().answer;
      if (i !== answer[cursor]) {
        s.tone(150, 0.4, "triangle", 0.12, 90, 0.08);
        startRound(true);
        return;
      }
      if (++cursor === answer.length) {
        s.hint("Well done!");
        advance = 0.65;
      } else s.hint("Good!");
    }
    return {
      scroll: () => (rule.perRound ? current().line : rule.text),
      begin: () => startRound(false),
      finishUpdate(dt) {
        for (let i = 0; i < 3; i++) light[i] = Math.max(0, light[i] - dt);
      },
      update(dt) {
        for (let i = 0; i < 3; i++) {
          light[i] = Math.max(0, light[i] - dt);
          swing[i] = Math.max(0, swing[i] - dt * 0.55);
        }
        if (advance > 0 && (advance -= dt) <= 0) {
          advance = -1;
          nextRound();
          return;
        }
        if (!listening) return;
        const notes = current().melody;
        clock += dt;
        if (played < notes.length && clock >= played * 0.82) ring(notes[played++]);
        if (clock >= notes.length * 0.82 + 0.2) {
          listening = false;
          s.hint("Your turn!");
        }
      },
      tap(p) {
        const spots = stations(s);
        const i = touched(p, spots, size() * 0.51);
        if (i < 0 || listening || cursor >= current().answer.length) return;
        stepToward(s, i - 1);
        s.spark(spots[i].x, spots[i].y + size() * 0.2, "#ffe0a0", () => judge(i), 0.26);
      },
      draw() {
        const t = s.game.time();
        stations(s).forEach((p, i) => {
          const d = size() * scale(i),
            power = light[i] / 0.59;
          const g = s.ctx,
            x = p.x,
            pin = p.y - d * 0.45,
            thickness = Math.max(3, d * 0.032);
          // Damped swing: a heavy bell rocks slowly and settles.
          const a = Math.sin((1 - swing[i]) * 9.5) * swing[i] * swing[i] * 0.2 + Math.sin(t * 0.7 + i * 2) * 0.006;
          // Rope from the rafters to the crown, twisted fibres catching the light.
          const cord = g.createLinearGradient(x - thickness / 2, 0, x + thickness / 2, 0);
          cord.addColorStop(0, "#21190f");
          cord.addColorStop(0.44, "#96764a");
          cord.addColorStop(0.68, "#665031");
          cord.addColorStop(1, "#312318");
          g.fillStyle = cord;
          g.fillRect(x - thickness / 2, 0, thickness, pin + d * 0.014);
          g.save();
          g.strokeStyle = "#302415b0";
          g.lineWidth = Math.max(1, thickness * 0.24);
          g.beginPath();
          for (let y = 0; y < pin; y += thickness * 1.2) {
            g.moveTo(x - thickness * 0.45, y);
            g.lineTo(x + thickness * 0.45, y + thickness * 0.55);
          }
          g.stroke();
          g.restore();
          s.shadow(x + a * d * 0.6, p.y + size() * 0.7, d * 0.42, d * 0.08);
          if (power) s.glow(x, p.y, d * 0.85, d * 0.92, "#ffe19a", power * 0.75);
          g.save();
          g.translate(x, pin);
          g.rotate(a);
          g.drawImage(bellSprite(s, layout.finish[i]), -d / 2, d * 0.45 - d / 2, d, d);
          // Warm light from the window sweeps across the metal as it rocks.
          if (s.game.effects()) {
            g.globalCompositeOperation = "screen";
            s.glow(d * (0.12 - a * 1.6), d * 0.4, d * 0.16, d * 0.3, "#ffd8a0", 0.18 + power * 0.3);
            g.globalCompositeOperation = "source-over";
          }
          g.restore();
          // Sound rings travel out from a struck bell.
          if (power > 0.05 && s.game.effects()) {
            g.save();
            g.globalCompositeOperation = "screen";
            for (let k = 0; k < 2; k++) {
              const q = (1 - power + k * 0.35) % 1;
              g.strokeStyle = "rgba(255,226,160," + (0.4 * (1 - q) * power).toFixed(3) + ")";
              g.lineWidth = Math.max(1.2, d * 0.012);
              g.beginPath();
              g.ellipse(x, p.y + d * 0.25, d * (0.55 + q * 0.7), d * (0.2 + q * 0.26), 0, 0, Math.PI * 2);
              g.stroke();
            }
            g.restore();
          }
        });
      },
    };
  });

  // ----------------------------------------------------------------- sluice
  // A flow sight-glass set into the valve stem, between the cast-iron legs: water swirls
  // and bubbles behind the glass while the valve is open; the glass is dry and dark when shut.
  function sightGlass(g, x, y, r, flow, t) {
    g.save();
    // Bezel: heavy cast brass with bolts, sitting in the stem.
    const bezel = g.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.2, x, y, r * 1.35);
    bezel.addColorStop(0, "#e2c27a");
    bezel.addColorStop(0.5, "#8a6630");
    bezel.addColorStop(1, "#2f210d");
    g.fillStyle = "rgba(0,0,0,.5)";
    g.beginPath();
    g.arc(x + r * 0.08, y + r * 0.12, r * 1.32, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = bezel;
    g.beginPath();
    g.arc(x, y, r * 1.28, 0, Math.PI * 2);
    g.fill();
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 + 0.3;
      g.fillStyle = "#3a2a10";
      g.beginPath();
      g.arc(x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1, r * 0.11, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#f0d590";
      g.beginPath();
      g.arc(x + Math.cos(a) * r * 1.1 - r * 0.03, y + Math.sin(a) * r * 1.1 - r * 0.03, r * 0.05, 0, Math.PI * 2);
      g.fill();
    }
    // Glass and what is behind it.
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = "#0b1114";
    g.fillRect(x - r, y - r, r * 2, r * 2);
    if (flow > 0.02) {
      const water = g.createRadialGradient(x, y, r * 0.1, x, y, r);
      water.addColorStop(0, "rgba(120,225,235," + 0.85 * flow + ")");
      water.addColorStop(1, "rgba(20,90,115," + 0.95 * flow + ")");
      g.fillStyle = water;
      g.fillRect(x - r, y - r, r * 2, r * 2);
      // A small paddle wheel spins in the stream, the way real flow indicators show it.
      g.save();
      g.translate(x, y);
      g.rotate(t * 7 * flow);
      g.strokeStyle = "rgba(230,250,255," + 0.75 * flow + ")";
      g.lineWidth = Math.max(1.2, r * 0.13);
      g.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI * 2) / 3;
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
      }
      g.stroke();
      g.restore();
      for (let k = 0; k < 6; k++) {
        const f = (t * 0.9 + k * 0.17) % 1;
        g.fillStyle = "rgba(235,255,255," + 0.7 * flow * Math.sin(Math.PI * f) + ")";
        g.beginPath();
        g.arc(x + Math.sin(k * 2.3 + t) * r * 0.5, y + r - f * r * 2, r * 0.08, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Reflection on the curved glass.
    const sheen = g.createLinearGradient(x - r, y - r, x + r, y + r);
    sheen.addColorStop(0, "rgba(255,255,255,.45)");
    sheen.addColorStop(0.35, "rgba(255,255,255,.04)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = sheen;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.restore();
  }
  // A short brass spout set into the stone base, seen almost end-on.
  function spout(g, x, y, r) {
    const body = g.createLinearGradient(x, y - r, x, y + r);
    body.addColorStop(0, "#d9b46a");
    body.addColorStop(0.45, "#8c6a33");
    body.addColorStop(1, "#3a2810");
    g.fillStyle = "rgba(0,0,0,.45)";
    g.beginPath();
    g.ellipse(x, y + r * 0.35, r * 1.25, r * 1.05, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(x, y, r * 1.1, r * 0.95, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#120c06";
    g.beginPath();
    g.ellipse(x, y + r * 0.08, r * 0.62, r * 0.52, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(255,236,180,.55)";
    g.lineWidth = Math.max(0.8, r * 0.14);
    g.beginPath();
    g.ellipse(x, y, r * 1.0, r * 0.86, 0, Math.PI * 1.1, Math.PI * 1.75);
    g.stroke();
  }
  // Water pouring from a spout and splashing on the flagstones.
  function pour(g, x, y0, y1, r, flow, t, glow) {
    if (flow < 0.02) return;
    const w = r * 0.9 * flow;
    const body = g.createLinearGradient(x - w, 0, x + w, 0);
    body.addColorStop(0, "rgba(140,215,230,.15)");
    body.addColorStop(0.35, "rgba(210,250,255," + 0.8 * flow + ")");
    body.addColorStop(0.65, "rgba(150,225,240," + 0.6 * flow + ")");
    body.addColorStop(1, "rgba(120,200,220,.12)");
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(x - w * 0.8, y0);
    g.quadraticCurveTo(x - w * 0.6, (y0 + y1) / 2, x - w * 1.1, y1);
    g.lineTo(x + w * 1.1, y1);
    g.quadraticCurveTo(x + w * 0.6, (y0 + y1) / 2, x + w * 0.8, y0);
    g.closePath();
    g.fill();
    // Ripples running down the falling water.
    g.strokeStyle = "rgba(255,255,255," + 0.55 * flow + ")";
    g.lineWidth = Math.max(0.8, r * 0.12);
    g.beginPath();
    for (let k = 0; k < 4; k++) {
      const f = (t * 2.2 + k / 4) % 1,
        yy = y0 + (y1 - y0) * f;
      g.moveTo(x - w * 0.5, yy);
      g.lineTo(x + w * 0.4, yy + r * 0.2);
    }
    g.stroke();
    // Splash ring on the floor.
    for (let k = 0; k < 2; k++) {
      const f = (t * 1.6 + k * 0.5) % 1;
      g.strokeStyle = "rgba(220,250,255," + 0.5 * flow * (1 - f) + ")";
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(x, y1, r * (0.8 + f * 2.2), r * (0.25 + f * 0.6), 0, 0, Math.PI * 2);
      g.stroke();
    }
    glow(x, y1, r * 2.4, r * 0.8, "#cdf6ff", 0.5 * flow);
  }
  const sluice = trial("Read the scroll. Then turn the wheels.", "You opened the water gates!", (s, complete) => {
    const rule = s.rule,
      weights = rule.layout.weights,
      total = weights.reduce((a, b) => a + b, 0),
      open = [false, false, false],
      angle = [0, 0, 0],
      turn = [0, 0, 0];
    // Measured on the manifold photograph: the stem between the legs and the stone base face.
    const STEM_V = 0.7,
      BASE_V = 0.875;
    let round = 0,
      stage = 0,
      water = 0,
      hold = 0,
      wrongHold = 0,
      told = false;
    const bubbles = Array.from({ length: 14 }, (_, i) => ({ u: (i * 0.618) % 1, v: (i * 0.37) % 1 }));
    function pipe() {
      const im = s.sprite("wheelPipe"),
        w = Math.min(s.w() * 0.86, s.h() * 0.83);
      return { w, h: (w * im.height) / im.width, x: (s.w() - w) / 2, bottom: s.h() * 0.69 };
    }
    function wheels() {
      const p = pipe();
      return [0.22, 0.5, 0.785].map((u) => ({ x: p.x + p.w * u, y: p.bottom - p.h * 0.52 }));
    }
    const size = () => pipe().w * 0.213;
    const sum = () => weights.reduce((n, v, i) => n + (open[i] ? v : 0), 0);
    const current = () => rule.rounds[Math.min(round, rule.rounds.length - 1)];
    const goal = () => (stage === 1 ? current().then : current().target);
    // A tall sight glass stands on the manifold, so the level reads at a glance.
    function column() {
      const p = pipe(),
        img = s.sprite("sluiceGauge");
      const pipeTop = p.bottom - p.h * 0.93;
      const top = Math.max(s.h() * 0.105, pipeTop - Math.min(s.h() * 0.4, p.w * 0.6));
      const height = pipeTop - top + p.h * 0.05;
      const frameH = img.height * 0.76; // crop the mounting lugs below the frame
      const width = (height * frameH) / img.width;
      return { x: s.w() / 2, top, height, width, frameH };
    }
    function tell() {
      const n = rule.rounds.length;
      s.hint(n > 1 ? "Water gate " + (round + 1) + " of " + n : "Turn the wheels.");
    }
    function settled() {
      s.chime(440 + round * 90);
      if (stage === 0 && current().then !== undefined) {
        stage = 1;
        s.hint("Good! Now the next part.");
        return;
      }
      stage = 0;
      round++;
      if (round === rule.rounds.length) return complete();
      if (rule.perRound) s.notice(current().line);
      tell();
    }
    // Coji stands nearer the camera here, so the beakers on the floor stay in view.
    s.player.x = 0.05;
    return {
      scroll: () => (rule.perRound ? current().line : rule.text),
      begin: tell,
      finishUpdate(dt) {
        water = Math.max(0, water - dt * 7);
      },
      update(dt) {
        for (let i = 0; i < 3; i++) {
          angle[i] += (Number(open[i]) * Math.PI * 0.68 - angle[i]) * Math.min(1, dt * 7);
          turn[i] += (Number(open[i]) - turn[i]) * Math.min(1, dt * 9);
        }
        water += range(sum() - water, -dt * 2.4, dt * 2.4);
        const still = Math.abs(water - sum()) < 0.03;
        const exact = current().exact;
        const right = still && sum() === goal() && (!exact || stage === 1 || exact.every((v, i) => v === open[i]));
        hold = right ? hold + dt : 0;
        if (hold >= 0.72) {
          hold = 0;
          told = false;
          settled();
          return;
        }
        // Calm, wordless nudge when the water rests somewhere the scroll did not ask for.
        wrongHold = still && !right && sum() > 0 ? wrongHold + dt : 0;
        if (wrongHold > 2.6 && !told) {
          told = true;
          s.hint("Hmm… read the scroll again.");
        }
        if (!still) told = false;
        for (const b of bubbles) {
          b.v -= dt * (0.18 + 0.5 * (Math.abs(sum() - water) > 0.05 ? 1 : 0.15));
          if (b.v < 0) b.v += 1;
        }
      },
      tap(p) {
        const spots = wheels();
        const i = touched(p, spots, size() * 0.56);
        if (i < 0) return;
        stepToward(s, i - 1);
        s.spark(spots[i].x, spots[i].y, "#9ff0ff", () => {
          open[i] = !open[i];
          s.tone(117, 0.24, "triangle", 0.2, 62);
          s.tone(open[i] ? 520 : 300, 0.12, "square", 0.04, open[i] ? 700 : 220, 0.18);
          s.rush(900, 300, 0.5, open[i] ? 0.16 : 0.08);
          told = false;
          wrongHold = 0;
        });
      },
      draw() {
        const g = s.ctx,
          c = column(),
          img = s.sprite("sluiceGauge"),
          t = s.game.time();
        const cx = c.x;
        // Inner glass, measured on the frame photograph (before rotating it upright).
        const inner = { x: cx - c.width * (0.5 - 56 / c.frameH), w: c.width * ((233 - 56) / c.frameH) };
        const glassTop = c.top + c.height * 0.069,
          glassH = c.height * 0.862;
        const surface = glassTop + glassH - (water / total) * glassH;
        const filling = sum() - water > 0.04,
          draining = water - sum() > 0.04;
        g.save();
        g.beginPath();
        g.rect(inner.x, glassTop, inner.w, glassH);
        g.clip();
        g.fillStyle = "#06161dd8";
        g.fillRect(inner.x, glassTop, inner.w, glassH);
        const fill = g.createLinearGradient(0, surface, 0, glassTop + glassH);
        fill.addColorStop(0, "#c8fff6f0");
        fill.addColorStop(0.06, "#5fd8e6e0");
        fill.addColorStop(1, "#11506ae8");
        g.fillStyle = fill;
        g.beginPath();
        g.moveTo(inner.x, glassTop + glassH);
        for (let j = 0; j <= 16; j++)
          g.lineTo(inner.x + (inner.w * j) / 16, surface + Math.sin(j * 0.9 + t * 3.1) * Math.min(filling ? 3 : 1.4, water * 0.6));
        g.lineTo(inner.x + inner.w, glassTop + glassH);
        g.fill();
        // Inflow: a thin jet pours from the top while the level rises.
        if (filling) {
          const jet = g.createLinearGradient(0, glassTop, 0, surface);
          jet.addColorStop(0, "rgba(200,255,255,.9)");
          jet.addColorStop(1, "rgba(120,220,235,.6)");
          g.fillStyle = jet;
          const jw = inner.w * 0.18;
          g.fillRect(cx - jw / 2 + Math.sin(t * 9) * 0.8, glassTop, jw, surface - glassTop);
          s.glow(cx, surface, inner.w * 0.5, inner.w * 0.18, "#dffbff", 0.6);
        }
        if (water > 0.05 && s.game.effects())
          for (const b of bubbles) {
            const by = glassTop + glassH - b.v * (glassTop + glassH - surface);
            if (by < surface + 3) continue;
            s.glow(inner.x + inner.w * (0.2 + b.u * 0.6), by, 2.2, 2.2, "#dffbff", filling ? 0.8 : 0.35);
          }
        const sheen = g.createLinearGradient(inner.x, 0, inner.x + inner.w, 0);
        sheen.addColorStop(0, "#ffffff00");
        sheen.addColorStop(0.18, "#ffffff2a");
        sheen.addColorStop(0.32, "#ffffff00");
        sheen.addColorStop(0.8, "#ffffff10");
        sheen.addColorStop(1, "#ffffff00");
        g.fillStyle = sheen;
        g.fillRect(inner.x, glassTop, inner.w, glassH);
        g.strokeStyle = "#fff6d6b0";
        g.lineWidth = 1.5;
        g.beginPath();
        for (let n = 1; n < total; n++) {
          const y = glassTop + glassH - (n / total) * glassH;
          g.moveTo(inner.x, y);
          g.lineTo(inner.x + inner.w * 0.3, y);
          g.moveTo(inner.x + inner.w * 0.7, y);
          g.lineTo(inner.x + inner.w, y);
        }
        g.stroke();
        g.restore();
        g.save();
        g.translate(cx, c.top + c.height / 2);
        g.rotate(-Math.PI / 2);
        g.drawImage(img, 0, 0, img.width, c.frameH, -c.height / 2, -c.width / 2, c.height, c.width);
        g.restore();
        // Engraved brass scale beside the glass.
        const plateX = cx + c.width / 2 + 2,
          plateW = Math.max(22, c.width * 0.42);
        const brass = g.createLinearGradient(plateX, 0, plateX + plateW, 0);
        brass.addColorStop(0, "#5a4220");
        brass.addColorStop(0.35, "#c9a25a");
        brass.addColorStop(0.6, "#9b7535");
        brass.addColorStop(1, "#4a3418");
        g.fillStyle = brass;
        g.strokeStyle = "#20160a";
        g.lineWidth = 1;
        g.beginPath();
        g.roundRect(plateX, glassTop - 6, plateW, glassH + 12, 4);
        g.fill();
        g.stroke();
        g.save();
        g.font = "700 " + Math.max(12, Math.min(19, (glassH / total) * 0.7)) + "px Georgia,serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        for (let n = 0; n <= total; n++) {
          const y = glassTop + glassH - (n / total) * glassH;
          g.fillStyle = "#f3dda0";
          g.fillText(String(n), plateX + plateW / 2, y + 1);
          g.fillStyle = "#2a1c0a";
          g.fillText(String(n), plateX + plateW / 2, y);
        }
        g.restore();

        const pipeBox = pipe();
        s.shadow(s.w() / 2, pipeBox.bottom, pipeBox.w * 0.45, pipeBox.h * 0.075);
        g.drawImage(s.sprite("wheelPipe"), pipeBox.x, pipeBox.bottom - pipeBox.h, pipeBox.w, pipeBox.h);
        wheels().forEach((p, i) => {
          const d = size();
          s.shadow(p.x, p.y + d * 0.52, d * 0.43, d * 0.09);
          s.instrument(1, p.x, p.y, d, d, angle[i]);
          // State lives in the valve itself: the sight-glass in its stem runs with water.
          const stemY = pipeBox.bottom - pipeBox.h * (1 - STEM_V);
          sightGlass(g, p.x, stemY, d * 0.11, turn[i], t + i);
          // Amount lives in the base: one brass spout per measure of water, pouring when open.
          const n = weights[i],
            baseY = pipeBox.bottom - pipeBox.h * (1 - BASE_V),
            sr = Math.min(d * 0.07, (d * 0.95) / (n * 2.6)),
            gap = sr * 2.6;
          for (let k = 0; k < n; k++) {
            const sx = p.x + (k - (n - 1) / 2) * gap;
            spout(g, sx, baseY, sr);
            pour(g, sx, baseY + sr * 0.3, pipeBox.bottom + d * 0.16, sr, turn[i], t * 1.0 + k * 0.37 + i, s.glow);
          }
        });
      },
    };
  });

  const mirrors = trial("Read the scroll. Then turn the mirrors.", "You lit the signs!", (s, done) =>
    CastleScenes["star-optics"].create(s, done),
  );

  // -------------------------------------------------------------------- ice
  // Words engraved into ice: a dark groove, then pale frosted letters with a cold glow.
  function engrave(g, text, x, y, size, squash, alpha = 1, width = Infinity) {
    g.save();
    g.translate(x, y);
    g.scale(1, squash);
    g.globalAlpha *= alpha;
    let px = size;
    g.font = "700 " + px + "px Georgia,serif";
    while (g.measureText(text).width > width && px > 9) g.font = "700 " + (px -= 1) + "px Georgia,serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "rgba(10,30,50,.55)";
    g.fillText(text, 1, 1.5);
    g.shadowColor = "rgba(160,225,255,.9)";
    g.shadowBlur = px * 0.35;
    g.fillStyle = "#f2fbff";
    g.fillText(text, 0, 0);
    g.restore();
  }
  // The camera never moves. Each row: a question on a frosted ice sign, three floating slabs
  // with the answers engraved in them. The right one glides out to the bridge, which is laid
  // from the far steps back to the near edge of the pool, so it always starts and ends on the
  // pool's real banks. A wrong slab cracks and sinks, and the row rises again.
  const ice = trial("Read the question. Then pick the ice.", "You crossed the ice!", (s, complete) => {
    const rule = s.rule,
      rows = R().iceRows,
      quiz = rule.rows;
    // Measured on the ice plate: horizon, Coji's spot on the near rocks, the pool's banks.
    const H = 0.47,
      V0 = 0.93,
      NEAR_BANK = 0.748,
      FAR_BANK = 0.538,
      C = 0.7;
    const vOf = (x) => H + (V0 - H) / (1 + C * x);
    const xOf = (v) => ((V0 - H) / (v - H) - 1) / C;
    // Coji waits on the rocks at the water's edge; the walk ends on the foot of the steps.
    const SHORE = xOf(0.79),
      FAR = xOf(0.528);
    s.player.x = SHORE;
    s.player.y = 4.5;
    const kOf = (v) => (v - H) / (V0 - H);
    const lane = () => Math.min(s.plate().pw * 0.21, s.w() * 0.33);
    function project(x, y, z = 0) {
      const plate = s.plate(),
        v = vOf(x),
        k = kOf(v);
      return { x: s.w() / 2 + ((y - 4.5) / 2.2) * lane() * k, y: plate.top + v * plate.ph - (z / 82) * s.base.heroSize() * 0.53 * k, k };
    }
    const heroScale = () => kOf(vOf(s.player.x));
    // Bridge slots, far (built first) to near (built last).
    const slotX = (b) => xOf(FAR_BANK) + ((xOf(NEAR_BANK) - xOf(FAR_BANK)) * b) / (rows - 1);
    // The three answer slabs lie on the flagstones in front of Coji, nearest the camera.
    const CHOICE_V = 0.875;
    let row = 1,
      rise = 0,
      chosen = null,
      sinking = null,
      walking = false,
      order = [0, 1, 2];
    const built = [];
    function slabAt(v, laneIndex, boost = 1) {
      const plate = s.plate(),
        k = kOf(v);
      const width = lane() * 0.88 * k * boost;
      return { x: s.w() / 2 + (laneIndex - 1) * lane() * k * boost, y: plate.top + v * plate.ph, width, height: width * (0.3 + 0.32 * k) };
    }
    const choiceSlab = (slot) => {
      const t = slabAt(CHOICE_V, slot, 0.92);
      return { ...t, y: t.y + (1 - rise) * t.height * 0.5 };
    };
    const shuffleOrder = () => {
      for (let i = 2; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    };
    function tell() {
      s.hint(built.length ? "Bridge " + built.length + " of " + rows : "Read the ice sign. Tap the right answer.");
    }
    function nextRow() {
      row++;
      rise = 0;
      order = [0, 1, 2];
      if (row > rows) {
        walking = true;
        s.hint("The bridge is ready!");
        const path = [];
        for (let b = rows - 1; b >= 0; b--) path.push({ x: slotX(b), y: 4.5 });
        path.push({ x: FAR, y: 4.5 });
        s.player.path = path;
        return;
      }
      tell();
    }
    function drawSlab(b, word, alpha = 1, bob = 0, wordAlpha = 1) {
      const g = s.ctx;
      if (s.game.effects()) {
        s.glow(b.x, b.y + b.height * 0.3, b.width * 0.62, b.height * 0.25, "#6cc6ff", 0.24 * alpha);
        s.shadow(b.x, b.y + b.height * 0.36, b.width * 0.52, b.height * 0.15, 0.4 * alpha);
      }
      g.save();
      g.globalAlpha *= alpha;
      s.instrument(3, b.x, b.y + bob, b.width, b.height);
      if (word)
        engrave(g, word, b.x, b.y + bob - b.height * 0.1, b.width * 0.19, range((b.height / b.width) * 1.7, 0.38, 0.95), wordAlpha, b.width * 0.78);
      g.restore();
    }
    // The question, engraved on a block of ice that hangs among the icicles.
    function drawSign() {
      if (row > rows || walking) return;
      const g = s.ctx,
        t = s.game.time();
      const w = Math.min(s.w() * 0.66, 560),
        h = Math.max(54, Math.min(84, s.h() * 0.1));
      const x = s.w() / 2,
        y = s.plate().top + s.plate().ph * 0.16 + Math.sin(t * 0.8) * 2;
      s.glow(x, y, w * 0.62, h * 1.1, "#9fdcff", 0.35 * rise);
      g.save();
      g.globalAlpha = rise;
      s.instrument(3, x, y, w, h * 1.55);
      g.restore();
      engrave(g, quiz[row].q, x, y - h * 0.08, Math.min(30, h * 0.42), 1, rise, w * 0.86);
    }
    return {
      project,
      heroScale,
      ownsTaps: true,
      begin: tell,
      scroll: () => rule.text,
      update(dt) {
        rise = Math.min(1, rise + dt * 1.6);
        if (chosen) {
          chosen.t += dt / 0.8;
          if (chosen.t >= 1) {
            built.push(chosen);
            chosen = null;
            s.tone(630, 0.25, "sine", 0.06);
            nextRow();
          }
        }
        if (sinking) {
          sinking.t += dt / 0.8;
          if (sinking.t >= 1) {
            sinking = null;
            rise = 0;
            shuffleOrder();
          }
        }
        if (walking && !s.player.path.length && s.player.x >= FAR - 0.05) {
          walking = false;
          complete();
        }
      },
      tap(p) {
        if (walking || chosen || sinking || rise < 1 || row > rows) return;
        let slot = -1;
        for (let l = 0; l < 3; l++) {
          const t = choiceSlab(l);
          if (Math.abs(p.x - t.x) < t.width * 0.5 && Math.abs(p.y - t.y) < Math.max(30, t.height * 0.75)) slot = l;
        }
        if (slot < 0) return;
        const answer = order[slot],
          t = choiceSlab(slot);
        s.spark(t.x, t.y, "#bfe9ff", () => {
          if (answer === quiz[row].right) {
            chosen = { slot, t: 0, word: quiz[row].answers[answer] };
            s.tone(315, 0.16, "sine", 0.09, 180);
            s.hint("Yes!");
          } else {
            sinking = { slot, t: 0 };
            s.tone(170, 0.4, "sawtooth", 0.11, 35);
            s.rush(2050, 280, 0.45, 0.34);
            s.hint("Crack! Read the question again.");
          }
        }, 0.28);
      },
      draw() {
        const g = s.ctx,
          t = s.game.time();
        // The bridge so far: far slabs first so nearer ones overlap them.
        built.forEach((b, i) => drawSlab(slabAt(vOf(slotX(i)), 1, 1.35), b.word, 1, 0, 0.35));
        if (chosen) {
          const from = choiceSlab(chosen.slot),
            to = slabAt(vOf(slotX(built.length)), 1, 1.35),
            q = chosen.t * chosen.t * (3 - 2 * chosen.t);
          const b = {
            x: from.x + (to.x - from.x) * q,
            y: from.y + (to.y - from.y) * q - Math.sin(Math.PI * q) * from.height * 1.2,
            width: from.width + (to.width - from.width) * q,
            height: from.height + (to.height - from.height) * q,
          };
          s.glow(b.x, b.y, b.width * 0.7, b.height * 0.8, "#cfefff", 0.5 * (1 - q));
          drawSlab(b, chosen.word, 1, 0, 1 - 0.65 * q);
        }
        drawSign();
      },
      // The answer slabs are nearer the camera than Coji, so they draw after him.
      overlay() {
        const g = s.ctx,
          t = s.game.time();
        if (walking || row > rows) return;
        for (let l = 0; l < 3; l++) {
          if (chosen?.slot === l) continue;
          const b = choiceSlab(l);
          const bob = 0;
          if (sinking?.slot === l) {
            const q = sinking.t;
            for (let n = 0; n < 4; n++) {
              const ax = n % 2 ? 0.5 : -0.5,
                ay = n < 2 ? -0.5 : 0.5;
              g.save();
              g.globalAlpha = 1 - q * q;
              g.translate(b.x + ax * b.width * q * 0.18, b.y + ay * b.height * q * 0.18 + b.height * q * q * 0.8);
              g.rotate((n % 2 ? 1 : -1) * q * 0.25);
              g.beginPath();
              g.moveTo(0, 0);
              g.lineTo(ax * b.width, 0);
              g.lineTo(ax * b.width, ay * b.height);
              g.lineTo(0, ay * b.height);
              g.closePath();
              g.clip();
              s.instrument(4, 0, 0, b.width, b.height);
              g.restore();
            }
            s.glow(b.x, b.y + b.height * 0.3, b.width * 0.7 * q, b.height * 0.4 * q, "#dff4ff", 0.7 * (1 - q));
            continue;
          }
          drawSlab(b, quiz[row].answers[order[l]], rise, bob);
          if (rise < 1) s.glow(b.x, b.y + b.height * 0.2, b.width * 0.6, b.height * 0.25, "#e8f8ff", 0.5 * (1 - rise));
        }
      },
    };
  });

  // ------------------------------------------------------------------ forge
  // The photographed iron chain and hook from the fixtures sheet (bottom-left cell):
  // links repeat every 140 source pixels, the hook occupies the last 106.
  function photoChain(s, x, top, bottom) {
    const img = s.sprite("royalFixtures");
    if (!img.width) return;
    const k = img.width / 1200,
      sx = 168 * k,
      sw = 64 * k,
      linkTop = (400 + 20) * k,
      link = 140 * k,
      hookTop = (400 + 290) * k,
      hookH = 106 * k;
    const width = Math.max(10, (bottom - top) * 0.09),
      scale = width / sw,
      hookDraw = hookH * scale;
    const g = s.ctx;
    g.save();
    g.beginPath();
    g.rect(x - width, top, width * 2, bottom - top - hookDraw * 0.85 + 1);
    g.clip();
    for (let y = top; y < bottom - hookDraw * 0.85; y += link * scale) g.drawImage(img, sx, linkTop, sw, link, x - width / 2, y, width, link * scale);
    g.restore();
    g.drawImage(img, sx, hookTop, sw, hookH, x - width / 2, bottom - hookDraw, width, hookDraw);
  }
  let coldBlanks = null;
  function coldMetal(img) {
    if (coldBlanks?.src === img) return coldBlanks.canvas;
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = "saturation";
    g.fillStyle = "#808080";
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "multiply";
    g.fillStyle = "#6e7480";
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "destination-in";
    g.drawImage(img, 0, 0);
    coldBlanks = { src: img, canvas: c };
    return c;
  }
  const forge = trial("Read the scroll. Then make the sword.", "You made a sword!", (s, complete) => {
    const rule = s.rule,
      steps = rule.steps,
      totalHits = steps.filter((st) => st.act === "hit").length;
    // Measured on the forge photograph.
    const SPOT = {
      anvil: [0.5, 0.505],
      hook: [0.5, 0.309],
      fire0: [0.138, 0.558],
      fire1: [0.862, 0.547],
      water: [0.154, 0.672],
    };
    const at = (key) => s.platePoint(...SPOT[key]);
    // Where the bar really flies to: the place itself, or its edge button when off-screen.
    const dest = (key) => (key === "anvil" || key === "hook" ? at(key) : edgeButton(key) || at(key));
    let cursor = 0,
      hitsDone = 0,
      heat = 0,
      cooling = false,
      busy = false,
      flight = null,
      inFire = null,
      steam = 0,
      flare = [0, 0],
      drop = -1,
      sparkBurst = -1,
      idle = 0,
      done = false;
    const size = () => Math.min(s.plate().pw * 0.169, s.w() * 0.53);
    const expected = () => steps[cursor];
    function fail(message, restart) {
      s.tone(150, 0.4, "triangle", 0.12, 90);
      s.hint(message);
      if (restart) {
        cursor = 0;
        hitsDone = 0;
        heat = 0;
      }
    }
    function advance() {
      cursor++;
      // A run of hits is over: the bar loses its glow and wants the fire again.
      if (steps[cursor - 1].act === "hit" && steps[cursor]?.act === "heat") cooling = true;
      if (cursor === steps.length) done = true;
    }
    // The bar flies along an arc between the anvil and a fire or the water bucket.
    function fly(fromKey, toKey, then) {
      flight = { from: fromKey, to: toKey, t: 0, then };
      busy = true;
    }
    function heatIn(fire) {
      const want = expected();
      if (want.act !== "heat") return fail(heat > 0.5 ? "It is already hot. Read the scroll again." : "Read the scroll again.");
      if (want.fire !== null && want.fire !== fire) return fail("Not that fire! Read the scroll again.");
      fly("anvil", "fire" + fire, () => {
        inFire = { fire, t: 0 };
        flare[fire] = 1;
        s.rush(500, 2200, 0.8, 0.22);
      });
    }
    function strike() {
      const want = expected();
      drop = 0;
      busy = true;
      if (heat < 0.5) {
        fail(want.act === "heat" ? "Clink! The metal is cold." : "Read the scroll again.");
        return;
      }
      if (want.act !== "hit") return fail("Too many hits! Start again.", true);
      sparkBurst = 0.18;
      hitsDone++;
      advance();
    }
    function quench() {
      const want = expected();
      if (want.act !== "cool") return fail(heat > 0.5 ? "Too soon! Start again." : "Read the scroll again.", heat > 0.5);
      fly("anvil", "water", () => {
        steam = 1;
        heat = 0;
        s.rush(3000, 600, 1.2, 0.3);
        flight = { from: "water", to: "anvil", t: 0, then: () => advance() };
      });
    }
    // Places that fall outside a narrow screen get a round button on that edge, showing the
    // real hearth or bucket from the photograph.
    function edgeButton(key) {
      const p = at(key),
        r = Math.max(30, Math.min(s.w() * 0.07, s.h() * 0.075));
      if (p.x > r && p.x < s.w() - r) return null;
      const right = p.x > s.w() / 2;
      // The bucket sits under the left fire: keep its button clear of the fire's.
      const y = key === "water" && edgeButton("fire0") ? at("fire0").y + r * 2.5 : p.y;
      return { x: right ? s.w() - r - 8 : r + 8, y, r };
    }
    function hitTest(p) {
      const d = size();
      const near = (q, rx, ry = rx) => Math.abs(p.x - q.x) < rx && Math.abs(p.y - q.y) < ry;
      for (const key of ["fire0", "fire1", "water"]) {
        const b = edgeButton(key);
        if (b && Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.15) return key;
      }
      for (const fire of [0, 1])
        if (!edgeButton("fire" + fire) && near(at("fire" + fire), s.plate().pw * 0.075, s.plate().ph * 0.09)) return "fire" + fire;
      if (!edgeButton("water") && near(at("water"), Math.max(32, d * 0.2), Math.max(30, d * 0.2))) return "water";
      const anvil = at("anvil");
      if (near({ x: anvil.x, y: anvil.y + d * 0.1 }, d * 0.55, Math.max(34, d * 0.42))) return "anvil";
      return null;
    }
    return {
      ownsTaps: true,
      scroll: () => rule.text,
      begin: () => s.hint("Read the scroll. Then tap the fire, the anvil or the water."),
      finishUpdate(dt) {
        steam = Math.max(0, steam - dt * 0.8);
      },
      update(dt) {
        idle += dt;
        flare = flare.map((f) => Math.max(0, f - dt * 0.9));
        steam = Math.max(0, steam - dt * 0.7);
        if (sparkBurst >= 0) sparkBurst += dt;
        if (sparkBurst > 0.6) sparkBurst = -1;
        if (cooling) {
          heat = Math.max(0, heat - dt * 0.7);
          if (!heat) cooling = false;
        }
        if (drop >= 0) {
          drop += dt;
          if (drop >= 0.18 && drop - dt < 0.18) {
            if (sparkBurst >= 0) {
              s.tone(210, 0.39, "triangle", 0.28, 55);
              s.chime(500 + hitsDone * 90);
            } else s.tone(900, 0.12, "square", 0.05, 600);
          }
          if (drop > 0.55) {
            drop = -1;
            busy = false;
            if (done && steps.at(-1).act === "hit") complete();
          }
        }
        if (flight) {
          flight.t += dt / 0.55;
          if (flight.t >= 1) {
            const then = flight.then;
            flight = null;
            busy = false;
            then?.();
            if (flight) busy = true;
            else if (done) complete();
          }
        }
        if (inFire) {
          inFire.t += dt;
          heat = Math.min(1, heat + dt * 1.6);
          if (inFire.t > 1.1) {
            const f = inFire.fire;
            inFire = null;
            fly("fire" + f, "anvil", () => {
              advance();
              s.hint("Hot!");
            });
          }
        }
      },
      tap(p) {
        if (busy || inFire || done) return;
        const target = hitTest(p);
        if (!target) return;
        idle = 0;
        const d = size();
        if (target === "anvil") {
          stepToward(s, 0);
          s.spark(at("hook").x, at("anvil").y - d * 0.62, "#ffc27a", strike, 0.2);
        } else if (target === "water") {
          stepToward(s, -1);
          const b = edgeButton("water") || at("water");
          s.spark(b.x, b.y, "#bfe9ff", quench, 0.25);
        } else {
          const fire = Number(target.slice(4));
          stepToward(s, fire ? 1 : -1);
          const b = edgeButton(target) || at(target);
          s.spark(b.x, b.y, "#ffb060", () => heatIn(fire), 0.3);
        }
        busy = true;
        setTimeout(() => {
          if (!flight && !inFire && drop < 0) busy = false;
        }, 420);
      },
      draw() {
        const g = s.ctx,
          d = size(),
          t = s.game.time();
        const anvil = at("anvil");
        // Fires roar when the bar goes in.
        for (const fire of [0, 1]) {
          const f = dest("fire" + fire);
          const glowAmt = 0.25 + 0.75 * flare[fire] + (inFire?.fire === fire ? 0.5 : 0);
          s.glow(f.x, f.y - d * 0.05, d * (0.35 + 0.3 * flare[fire]), d * 0.28, "#ff8a30", glowAmt * 0.8);
          if (flare[fire] > 0.02 || inFire?.fire === fire) {
            g.save();
            g.globalCompositeOperation = "screen";
            g.globalAlpha = Math.min(1, flare[fire] + (inFire?.fire === fire ? 0.6 : 0));
            s.cel(s.sprite("livingFlames"), Math.floor(t * 14 + fire * 3) % 8, 4, 2, f.x, f.y - d * 0.16, d * 0.42, d * 0.5);
            g.restore();
          }
        }
        // The bar: on the anvil, in flight, in the fire or over the water.
        const blanks = s.sprite("forgeBlanks"),
          cell = blanks.width / 3;
        const stage = hitsDone >= totalHits && totalHits ? 2 : hitsDone > 0 ? 1 : 0;
        const crop = [
          [0.254, 0.307, 0.367, 0.067],
          [0.181, 0.312, 0.702, 0.063],
          [0.136, 0.31, 0.768, 0.065],
        ][stage];
        let bx = anvil.x,
          by = anvil.y,
          scale = 1,
          lift = 0;
        if (flight) {
          const a = dest(flight.from),
            b = dest(flight.to),
            q = flight.t * flight.t * (3 - 2 * flight.t);
          bx = a.x + (b.x - a.x) * q;
          by = a.y + (b.y - a.y) * q;
          lift = Math.sin(Math.PI * q) * d * 0.5;
          scale = 1 - 0.25 * Math.sin(Math.PI * q);
        } else if (inFire) {
          const f = dest("fire" + inFire.fire);
          bx = f.x;
          by = f.y;
          scale = 0.7;
        }
        const drawBar = (img) =>
          g.drawImage(img, (stage + crop[0]) * cell, crop[1] * cell, crop[2] * cell, crop[3] * cell, bx - d * 0.34 * scale, by - lift - d * 0.08 * scale, d * 0.68 * scale, d * 0.08 * scale);
        if (!inFire || inFire.t > 0.15) {
          drawBar(coldMetal(blanks));
          if (heat > 0.01) {
            g.save();
            g.globalAlpha = heat;
            drawBar(blanks);
            g.restore();
            s.glow(bx, by - lift - d * 0.04 * scale, d * 0.4 * scale, d * 0.12 * scale, "#ff9a40", heat * (0.55 + 0.1 * Math.sin(t * 7)));
          }
        }
        // Heat haze rising off a hot bar.
        if (heat > 0.3 && s.game.effects())
          for (let k = 0; k < 5; k++) {
            const f = (t * 0.8 + k / 5) % 1;
            s.glow(bx + Math.sin(k * 2 + t * 3) * d * 0.12, by - lift - d * (0.06 + f * 0.3), d * 0.05, d * 0.08, "#ffb070", heat * 0.25 * (1 - f));
          }
        // What can be touched breathes softly at the start and after a quiet moment,
        // all alike, so it shows how to play without giving the order away.
        if ((idle < 4 || idle > 7) && !busy && !inFire && !done) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
          const ring = (q, r) => {
            g.save();
            g.globalCompositeOperation = "screen";
            g.strokeStyle = "rgba(255,226,160," + (0.25 + 0.35 * pulse) + ")";
            g.lineWidth = 2.5;
            g.beginPath();
            g.ellipse(q.x, q.y, r * (1 + 0.06 * pulse), r * 0.42 * (1 + 0.06 * pulse), 0, 0, Math.PI * 2);
            g.stroke();
            g.restore();
          };
          for (const key of ["fire0", "fire1", "water"]) {
            const b = edgeButton(key);
            ring(b ? { x: b.x, y: b.y + b.r * 0.9 } : { x: at(key).x, y: at(key).y + d * 0.1 }, b ? b.r * 0.9 : d * (key === "water" ? 0.22 : 0.42));
          }
          ring({ x: anvil.x, y: anvil.y + d * 0.06 }, d * 0.45);
        }
        // Steam from the bucket after quenching.
        if (steam > 0) {
          const w = dest("water");
          for (let i = 0; i < 9; i++) {
            const q = (1 - steam + i * 0.11) % 1;
            s.glow(w.x + Math.sin(i * 2.3 + t) * d * 0.12 * q, w.y - d * 0.1 - q * d * 0.7, d * (0.08 + q * 0.2), d * (0.08 + q * 0.2), "#e8eef4", steam * 0.5 * (1 - q));
          }
        }
        // A trip hammer on a real iron chain from the pulley hook in the photograph.
        // A tap lets the chain run: the hammer falls onto the anvil and is hauled back up.
        const hook = at("hook");
        const rest = anvil.y - d * 0.6 + Math.sin(t * 1.1) * d * 0.008;
        let hy = rest;
        if (drop >= 0) {
          const q = drop < 0.18 ? (drop / 0.18) ** 2 : 1 - Math.min(1, (drop - 0.18) / 0.37);
          hy = rest + (anvil.y - d * 0.17 - rest) * q;
        }
        const hx = hook.x;
        photoChain(s, hx, hook.y + d * 0.04, hy - d * 0.3);
        s.shadow(hx, anvil.y - d * 0.02, d * 0.16, d * 0.03, 0.25 + 0.45 * (drop >= 0 ? 1 : 0));
        s.instrument(5, hx, hy, d * 0.68, d * 0.8, 0);
        if (sparkBurst >= 0 && drop >= 0.18) {
          const q = Math.min(1, (drop - 0.18) / 0.35),
            strength = 1 - q;
          s.glow(anvil.x, anvil.y - d * 0.035, d * (0.26 + q * 0.3), d * 0.2, "#ffcf80", strength);
          if (s.game.effects()) {
            g.save();
            g.globalCompositeOperation = "lighter";
            g.strokeStyle = "#ffcb73";
            g.globalAlpha = strength * strength;
            g.lineWidth = Math.max(1, d * 0.006);
            g.beginPath();
            for (let n = 0; n < 22; n++) {
              const vx = Math.cos(n * 2.4) * (0.28 + (n % 4) * 0.12);
              const vy = -0.18 - (n % 5) * 0.098;
              const px = anvil.x + vx * d * q,
                py = anvil.y - d * 0.035 + d * (vy * q + 0.31 * q * q);
              g.moveTo(px, py);
              g.lineTo(px - vx * d * 0.045, py - (vy + 0.62 * q) * d * 0.045);
            }
            g.stroke();
            g.restore();
          }
        }
        // Edge buttons: a round window onto the real hearth or bucket.
        for (const key of ["fire0", "fire1", "water"]) {
          const b = edgeButton(key);
          if (!b) continue;
          const plate = s.plate(),
            f = at(key),
            img = s.sprite("forgeRoom"),
            right = b.x > s.w() / 2;
          g.save();
          g.beginPath();
          g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          g.clip();
          const k = img.width / plate.pw;
          const sx = (f.x - plate.left) * k,
            sy = (f.y - plate.top) * k,
            span = b.r * 2.2 * k;
          g.drawImage(img, sx - span / 2, sy - span / 2, span, span, b.x - b.r * 1.1, b.y - b.r * 1.1, b.r * 2.2, b.r * 2.2);
          g.restore();
          g.strokeStyle = "#e9c27a";
          g.lineWidth = 2.5;
          g.beginPath();
          g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          g.stroke();
          s.lettering(right ? "▶" : "◀", b.x + (right ? b.r * 0.62 : -b.r * 0.62), b.y, Math.max(12, b.r * 0.4), "#ffe7b0");
        }
      },
    };
  });
  return { bells, sluice, mirrors, ice, forge };
})();
