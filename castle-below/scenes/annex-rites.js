// Shared visual grammar for the three halls. The silhouettes and sounds belong to each move.
CastleScenes["annex-rites"] = function (s) {
  const { ctx, clamp, game, level, tone, rush } = s;
  const kind = level.id;
  const endings = { king: 6.8, witch: 6.2, colossus: 7.2 };
  const endTime = endings[kind];

  let waterTime = game.time();
  const ease = (a, b, t) => {
    const n = clamp((t - a) / (b - a));
    return n * n * (3 - 2 * n);
  };
  const shieldMove = (move) => ["soul", "curse", "steam"].includes(move);
  function sound(move) {
    switch (move) {
      case "bones":
        [0, 0.15, 0.43].forEach((t, i) => {
          rush(2200, 390, 0.11, 0.58, t);
          tone(250 - i * 36, 0.13, "triangle", 0.18, 84, t);
        });
        break;
      case "soul":
        [146, 219, 368, 584].forEach((n, i) =>
          tone(n, 1.68 - i * 0.1, "sine", 0.19 / (1 + i * 0.35), n * 0.99, i * 0.055),
        );
        break;
      case "charge":
        rush(820, 175, 0.66, 0.6);
        [0.55, 0.89].forEach((t) => {
          tone(94, 0.24, "triangle", 0.47, 36, t);
          rush(380, 80, 0.19, 0.46, t);
        });
        break;
      case "pool":
        [0, 0.19, 0.53, 0.67].forEach((t, i) => {
          tone(70 + i * 18, 0.16, "sine", 0.3, 200 + i * 29, t);
          rush(420, 90, 0.16, 0.27, t);
        });
        break;
      case "doubles":
        [660, 831, 988].forEach((n, i) => {
          tone(n, 0.56, "sine", 0.17, n * 1.025, i * 0.24);
          tone(n * 2, 0.27, "sine", 0.044, n * 1.98, i * 0.24 + 0.12);
        });
        break;
      case "curse":
        rush(830, 3600, 1.48, 0.53);
        tone(239, 1.48, "triangle", 0.19, 639);
        tone(245, 1.4, "sine", 0.14, 651, 0.08);
        break;
      case "flock":
        [0, 0.32].forEach((t) => {
          tone(620, 0.21, "sawtooth", 0.095, 250, t);
          rush(2150, 570, 0.2, 0.6, t);
        });
        [0.63, 0.77, 0.92].forEach((t) => rush(650, 260, 0.13, 0.52, t));
        break;
      case "hammer":
        [0, 0.12, 0.24, 0.36].forEach((t) => rush(3100, 670, 0.065, 0.57, t));
        tone(149, 0.62, "triangle", 0.34, 52, 0.5);
        tone(329, 0.42, "sine", 0.11, 325, 0.51);
        break;
      case "steam":
        rush(570, 2850, 1.54, 0.61);
        tone(710, 1.52, "sine", 0.14, 1440);
        tone(1065, 1.4, "sine", 0.072, 2155, 0.09);
        break;
    }
  }
  function endingSound() {
    if (kind === "king")
      [110, 165, 224].forEach((n, i) => tone(n, 2.85, "triangle", 0.16 / (i + 1), n * 0.6, i * 0.12));
    if (kind === "witch") {
      rush(1700, 170, 2.5, 0.56);
      [699, 466, 311].forEach((n, i) => tone(n, 1.1, "sine", 0.09, 103, i * 0.45));
    }
    if (kind === "colossus") {
      rush(1100, 68, 2.65, 0.75);
      tone(87, 2.9, "sawtooth", 0.14, 30);
      tone(190, 0.8, "triangle", 0.18, 48, 0.55);
    }
  }
  function recovery(age) {
    return ease(2.32, endTime - 0.55, age);
  }
  function updateWater(dt, phase, age, move) {
    const speed =
      phase === "fallen" ? (1 - recovery(age)) * 1.8 : move === "pool" && phase === "strike" ? 2.4 : 1;
    waterTime += dt * speed;
  }
  // Composite the photographic background in the browser. Only the translucent
  // atmosphere is repainted at its own resolution and cadence.
  function createBackdrop(s) {
    const { ctx } = s;
    const atmosphere = CastleScenes["annex-atmosphere"](s);
    const track = kind === "king" ? document.createElement("canvas") : null;
    let brush;
    if (track) {
      track.width = 448;
      track.height = 256;
      brush = document.createElement("canvas");
      brush.width = 64;
      brush.height = 64;
      const g = brush.getContext("2d"),
        grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "white");
      grad.addColorStop(0.55, "#ffffffba");
      grad.addColorStop(1, "#ffffff00");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }
    function floorTrack(x, y, origin, width, alpha) {
      const g = track.getContext("2d"),
        w = s.w(),
        h = s.h(),
        texture = s.sprite("ossuaryLight");
      const scale = Math.max(w / texture.width, h / texture.height);
      g.setTransform(track.width / w, 0, 0, track.height / h, 0, 0);
      g.globalCompositeOperation = "source-over";
      g.clearRect(0, 0, w, h);
      for (let i = 0; i <= 15; i++) {
        const t = i / 15,
          r = width * (0.09 + 0.5 * t);
        const px = origin.x + (x - origin.x) * t,
          py = origin.y + (y - origin.y) * t;
        g.drawImage(brush, px - r, py - r * 0.29, 2 * r, r * 0.58);
      }
      g.globalCompositeOperation = "source-in";
      g.drawImage(
        texture,
        (w - texture.width * scale) / 2,
        (h - texture.height * scale) / 2,
        texture.width * scale,
        texture.height * scale,
      );
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = clamp(alpha * 1.4);
      ctx.drawImage(track, 0, 0, w, h);
      ctx.restore();
    }
    function room(phase, move, q, age, b, mark) {
      const fallen = phase === "fallen",
        recoveryAmount = fallen ? recovery(age) : 0;
      const summon =
        phase === "warning"
          ? ease(0, 0.82, q)
          : phase === "strike"
            ? 1
            : phase === "rest"
              ? 1 - ease(0, 0.34, q)
              : 0;
      const calm = fallen ? 1 - recoveryAmount : 1;
      s.drawRoom({
        overlay: true,
        heat: kind === "colossus" ? calm : 1,
        waterTime,
        atmosphere: fallen ? calm : 1,
      });
      const w = s.w(),
        h = s.h();
      atmosphere(calm, summon, waterTime);
      if (kind === "witch") {
        const mist = fallen
          ? (0.7 + 0.3 * ease(0, 1, age)) * calm
          : summon * (move === "doubles" ? 0.59 : move === "pool" ? 0.5 : 0.28);
        if (mist > 0 && game.effects()) {
          for (let i = 0; i < 5; i++) {
            const drift = Math.sin(game.time() * 0.31 + i * 2.3);
            s.glow(
              w * (0.1 + i * 0.2 + drift * 0.04),
              h * (0.58 + Math.cos(i * 3.1) * 0.055),
              w * 0.29,
              h * 0.07,
              "#a5c993",
              mist * 0.54,
            );
          }
        }
        return;
      }
      if (kind !== "king") return;
      const power = fallen
        ? (0.83 + 0.17 * Math.sin(age * 3) ** 2) * calm
        : summon * (move === "soul" ? 1 : move === "charge" ? 0.64 : 0.76);
      if (power <= 0) return;
      const mask = s.sprite("ossuaryLight"),
        scale = Math.max(w / mask.width, h / mask.height);
      const pw = scale * mask.width,
        ph = scale * mask.height,
        left = (w - pw) / 2,
        top = (h - ph) / 2;
      ctx.save();
      ctx.fillStyle = "rgba(3,11,28," + power * 0.64 + ")";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "screen";
      const seam = Math.floor(mask.height * 0.574);
      function illuminate(y, height, strength) {
        ctx.globalAlpha = clamp(strength);
        ctx.drawImage(mask, 0, y, mask.width, height, left, top + y * scale, pw, height * scale);
      }
      illuminate(0, seam, power * (move === "soul" || fallen ? 1.0 : 0.65));
      const floorPower = fallen ? 1 - ease(2.32, endTime - 1.35, age) : power;
      // Run the reaction over the actual mortar and inlaid tiles. At death this
      // front retreats towards the dais before the light leaves the high windows.
      const spread = phase === "warning" ? ease(0, 0.92, q) : 1;
      const crest = fallen ? calm : move === "soul" && phase === "strike" ? q : spread;
      const stripHeight = Math.ceil((mask.height - seam) / 22);
      for (let row = seam; row < mask.height; row += stripHeight) {
        const depth = (row - seam) / (mask.height - seam);
        const intensity = fallen
          ? 1 - ease(crest - 0.16, crest + 0.12, depth)
          : move === "soul"
            ? 0.34 + 0.64 * Math.exp(-16 * (depth - crest) ** 2)
            : 0.14 + 0.73 * Math.exp(-32 * (depth - crest * 0.84) ** 2);
        illuminate(row, Math.min(stripHeight, mask.height - row), floorPower * intensity);
      }
      if (game.effects() && (move === "soul" || fallen)) {
        s.glow(left + pw * 0.5, top + ph * 0.26, pw * 0.148, ph * 0.26, "#9edbff", power * 0.72);
        s.glow(left + pw * 0.5, top + ph * 0.62, pw * 0.11, ph * 0.065, "#afdfff", floorPower * 0.57);
      }
      ctx.restore();
      if (!fallen && move === "bones" && mark !== undefined) {
        const x = s.base.project(0.5, mark).x,
          y = h * 0.875;
        for (const side of [-1, 1]) {
          const start = { x: left + pw * (0.5 + side * 0.44), y: top + ph * 0.615 };
          floorTrack(x, y, start, w * 0.125, power * 0.82);
          s.glow(start.x, start.y, pw * 0.1, ph * 0.042, "#c5e4ff", power * 0.65);
        }
      }
      if (!fallen && move === "charge" && mark !== undefined)
        floorTrack(s.base.project(0.5, mark).x, h * 0.875, b, w * 0.22, power * 0.86);
    }
    return room;
  }
  const layer = document.getElementById("roomAtmosphere"),
    painter = layer.getContext("2d");
  const paint = createBackdrop(
    CastleScenes["annex-stage"]({ ...game, ctx: painter }, s.sprite, () => null, level),
  );
  const photo = s.sprite(kind + "Room");
  layer.style.backgroundImage = 'url("' + photo.src + '")';
  let previous = -1,
    lastPhase = "",
    previousFx;
  function room(phase, move, q, age, b, mark) {
    ctx.save();
    ctx.resetTransform();
    ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);
    ctx.restore();
    const w = s.w(),
      h = s.h(),
      ratio = Math.min(1, 840 / Math.max(w, h));
    const width = Math.ceil(w * ratio),
      height = Math.ceil(h * ratio);
    const stamp = Math.floor(game.time() * 24);
    if (
      layer.width === width &&
      layer.height === height &&
      stamp === previous &&
      phase === lastPhase &&
      previousFx === game.effects()
    )
      return;
    if (layer.width !== width || layer.height !== height) {
      layer.width = width;
      layer.height = height;
    }
    previous = stamp;
    lastPhase = phase;
    previousFx = game.effects();
    painter.setTransform(width / w, 0, 0, height / h, 0, 0);
    painter.clearRect(0, 0, w, h);
    paint(phase, move, q, age, b, mark);
  }
  function cue(move, progress) {
    if (move === "doubles") return;
    const p = s.base.project(s.player.x, s.player.y),
      size = s.base.heroSize();
    const strength = (0.34 + 0.6 * ease(0, 0.38, progress)) * (0.83 + 0.17 * Math.cos(progress * Math.PI * 4));
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = strength;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (shieldMove(move)) {
      const r = size * 0.66,
        cy = p.y - size * 0.47;
      ctx.lineWidth = Math.max(2, size * 0.026);
      ctx.strokeStyle = "#91ffed";
      ctx.shadowBlur = 6;
      ctx.shadowColor = "#51dfef";
      for (const a of [-1.57, 0.52, 2.62]) {
        ctx.beginPath();
        ctx.arc(p.x, cy, r, a - 0.61, a + 0.61);
        ctx.stroke();
      }
      s.glow(p.x, cy, r, r, "#71eadc", 0.14);
    } else {
      const slide = (progress * 2) % 1;
      ctx.lineWidth = Math.max(2, size * 0.022);
      ctx.strokeStyle = "#ffe1a5";
      for (const sign of [-1, 1]) {
        const x = p.x + sign * size * (0.38 + slide * 0.28),
          y = p.y - size * 0.085;
        ctx.beginPath();
        ctx.moveTo(x - sign * size * 0.14, y - size * 0.045);
        ctx.lineTo(x, y);
        ctx.lineTo(x - sign * size * 0.14, y + size * 0.045);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  // One world-space front drives damage, steam rendering and the shield wake.
  function steamField(q, b) {
    const p = s.base.project(s.player.x, s.player.y),
      shield = game.shieldBounds();
    const cy = p.y - shield.lift,
      sourceY = b.y - b.height * 0.55;
    const depth = cy - sourceY;
    const front = sourceY + (depth * q) / 0.69,
      rear = front - depth * 0.26;
    return {
      cx: p.x,
      cy,
      r: shield.radius,
      sourceX: b.x,
      sourceY,
      front,
      rear,
      touching: front >= cy - shield.radius && rear <= cy + shield.radius,
      exposed: front >= cy && rear <= cy,
    };
  }
  // Subtract the circular barrier AND the wedge between its two tangent rays.
  function clipWake(f) {
    const { cx, cy, sourceX, sourceY } = f,
      dx = cx - sourceX,
      dy = cy - sourceY;
    const dist = Math.hypot(dx, dy),
      r = Math.min(f.r, dist * 0.96);
    const back = Math.atan2(-dy, -dx),
      spread = Math.acos(r / dist);
    const a = back - spread,
      b = back + spread,
      L = Math.hypot(s.w(), s.h()) * 4;
    const px = (t) => cx + r * Math.cos(t),
      py = (t) => cy + r * Math.sin(t);
    const far = (t) => {
      const x = px(t) - sourceX,
        y = py(t) - sourceY,
        d = Math.hypot(x, y);
      return [px(t) + (L * x) / d, py(t) + (L * y) / d];
    };
    ctx.beginPath();
    ctx.rect(-s.w() * 6, -s.h() * 6, s.w() * 13, s.h() * 13);
    ctx.moveTo(px(a), py(a));
    ctx.arc(cx, cy, r, a, b);
    ctx.lineTo(...far(b));
    ctx.lineTo(...far(a));
    ctx.closePath();
    ctx.clip("evenodd");
  }
  function steam(q, b) {
    const f = steamField(q, b),
      cloud = s.sprite("ventCloud"),
      w = s.w(),
      height = f.front - f.rear;
    const span = w * (0.19 + 1.48 * q),
      alpha = ease(0, 0.15, q) * (1 - ease(0.91, 1, q));
    ctx.save();
    if (s.player.guard) clipWake(f);
    // Each vent emits separate billows. Preserve the photographed aspect ratio
    // as perspective brings the front towards Coji.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const lane = i / 5;
        const curl = Math.sin(q * 12 + i * 2.7 + side);
        const cloudHeight =
          height * (0.72 + 0.18 * Math.cos(i * 3.2 + q * 8)) * (0.36 + 0.64 * ease(0, 0.28, q));
        const cloudWidth = (cloudHeight * cloud.width) / cloud.height;
        const x = b.x + side * (b.height * 0.19 * (1 - q) + span * (0.012 + 0.47 * lane));
        ctx.globalAlpha = alpha * (0.8 + 0.12 * curl);
        ctx.drawImage(
          cloud,
          x - cloudWidth / 2,
          f.front - cloudHeight - height * 0.057 * (1 + curl),
          cloudWidth,
          cloudHeight,
        );
      }
    }
    ctx.restore();
    if (s.player.guard && f.touching) {
      const toward = Math.atan2(f.sourceY - f.cy, f.sourceX - f.cx);
      ctx.save();
      clipWake(f);
      ctx.globalAlpha = alpha * 0.88;
      for (const side of [-1, 1]) {
        const a = toward + side * (0.88 + 0.34 * q),
          x = f.cx + Math.cos(a) * f.r,
          y = f.cy + Math.sin(a) * f.r;
        ctx.drawImage(cloud, x - f.r * 0.47, y - f.r * 0.18, f.r * 0.94, f.r * 0.41);
      }
      ctx.restore();
      s.glow(
        f.cx + Math.cos(toward) * f.r,
        f.cy + Math.sin(toward) * f.r,
        f.r * 0.4,
        f.r * 0.13,
        "#d9ffff",
        alpha * 0.79,
      );
    }
  }
  return { endTime, sound, endingSound, updateWater, room, cue, steamField, steam };
};
