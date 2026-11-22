// Props are registered to the room photograph. Smoke, drops and embers travel
// independently of the camera, with depth provided by their size and speed.
CastleScenes["annex-atmosphere"] = function (s) {
  const { ctx, game, level, cel } = s;
  const plate = s.sprite(level.id + "Room");
  const air = s.sprite("royalAir"),
    props = s.sprite("royalFixtures");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const tau = 2 * Math.PI;
  let pw, ph, left, top;
  const px = (u) => left + u * pw;
  const py = (v) => top + v * ph;
  function image(sheet, index, x, y, size, alpha, angle = 0) {
    if (alpha <= 0 || x + size / 2 < 0 || x - size / 2 > s.w()) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    cel(sheet, index, 3, 2, x, y, size, size, angle);
    ctx.restore();
  }
  function suspended(index, u, v, height, angle) {
    const length = ph * height;
    ctx.save();
    ctx.translate(px(u), py(v));
    ctx.rotate(angle);
    cel(props, index, 3, 2, 0, length / 2, length, length);
    ctx.restore();
  }
  function mist(index, time, strength) {
    for (let i = 0; i < 5; i++) {
      const depth = i % 3;
      const t = (i * 0.283 + time * (0.036 + depth * 0.011)) % 1;
      const x = px(-0.14 + t * 1.28);
      const y = py(0.5 + depth * 0.078 + 0.012 * Math.sin(t * tau + i));
      image(
        air,
        index,
        x,
        y,
        pw * (0.25 + depth * 0.074),
        strength * (0.35 + depth * 0.07) * Math.sin(t * Math.PI),
      );
    }
  }
  function hall(t, power, still) {
    for (const [u, phase] of [
      [0.275, 0],
      [0.724, 1.8],
    ]) {
      const wind = Math.sin(t * 1.36 + phase) * 0.69 + Math.sin(t * 2.1 + phase) * 0.31;
      const fold = still ? 0 : Math.round((1 + wind) * power);
      suspended(fold, u, -0.017, 0.424, still ? 0 : wind * 0.052 * power);
    }
    if (still) return;
    mist(0, t, power);
    // Warm light travels from the brazier to its actual reflection on the flagstones.
    for (const u of [0.114, 0.231, 0.772, 0.883]) {
      const pulse = 0.61 + 0.25 * Math.sin(t * 8.1 + u * 21) + 0.13 * Math.sin(t * 13.5 + u * 63);
      s.glow(px(u), py(0.695), pw * 0.049, ph * 0.021, "#ffad63", power * pulse * 0.58);
    }
    for (let i = 0; i < 26; i++) {
      const f = (i * 0.618 + t * (0.062 + (i % 5) * 0.009)) % 1;
      const u = 0.41 + ((i * 0.271) % 1) * 0.18 + f * 0.056 + 0.008 * Math.sin(i + f * 8);
      const v = 0.11 + f * 0.52;
      const r = Math.max(0.7, ph * (0.0011 + (i % 3) * 0.00055));
      s.glow(px(u), py(v), r, r * 1.23, "#d8ecff", power * 0.73 * Math.sin(f * Math.PI));
    }
  }
  function swamp(t, power, still) {
    if (still) return;
    mist(1, t, power);
    // Each drop meets a photographed pool beside the causeway. The ring starts on that beat.
    for (const [i, [u, v]] of [
      [0.217, 0.61],
      [0.802, 0.64],
      [0.146, 0.756],
      [0.873, 0.78],
      [0.657, 0.6],
      [0.322, 0.643],
    ].entries()) {
      const f = (i * 0.291 + t * (0.46 + (i % 3) * 0.05)) % 1;
      const x = px(u),
        y = py(v);
      if (f < 0.34) {
        const drop = f / 0.34;
        s.glow(
          x,
          y - (1 - drop * drop) * ph * 0.147,
          ph * 0.0022,
          ph * (0.002 + 0.006 * drop),
          "#d8efe0",
          power * 0.88,
        );
      } else {
        const r = (f - 0.34) / 0.66;
        ctx.save();
        ctx.strokeStyle = "rgba(197,228,190," + 0.67 * power * (1 - r) + ")";
        ctx.lineWidth = Math.max(0.7, ph * 0.0015 * (1 - r * 0.5));
        for (let j = 0; j < 2; j++) {
          const a = r - j * 0.15;
          if (a <= 0) continue;
          ctx.beginPath();
          ctx.ellipse(x, y, ph * (0.006 + 0.047 * a), ph * (0.0015 + 0.009 * a), 0, 0, tau);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    for (let i = 0; i < 8; i++) {
      const f = (t * (0.063 + 0.009 * (i % 3)) + i * 0.237) % 1;
      const u = 0.07 + ((i * 0.327) % 0.83) + 0.105 * f + 0.019 * Math.sin(f * 8 + i);
      image(
        props,
        4,
        px(u),
        py(0.09 + f * 0.65),
        ph * (0.017 + (i % 3) * 0.009),
        power * 0.9 * Math.sin(Math.PI * f),
        i + f * 4.2,
      );
    }
    for (let i = 0; i < 3; i++) {
      const f = (t * 0.105 + i * 0.033 + 0.15) % 1;
      const x = px(1.02 - f * 1.17),
        y = py(0.29 + 0.058 * Math.sin(4.7 * f + i * 0.22) + i * 0.021);
      image(
        air,
        3 + (Math.sin(t * 11 + i) > 0 ? 1 : 0),
        x,
        y,
        ph * (0.052 + i * 0.006),
        power * 0.86 * Math.sin(Math.PI * f),
      );
    }
  }
  function foundry(t, power, still) {
    for (const [u, offset] of [
      [0.289, 0],
      [0.707, 1.9],
    ]) {
      suspended(3, u, -0.017, 0.354, still ? 0 : Math.sin(t * 1.64 + offset) * 0.092 * power);
    }
    if (still) return;
    for (const [i, u] of [0.09, 0.231, 0.5, 0.765, 0.903].entries()) {
      const centre = i === 2,
        sourceY = centre ? 0.475 : 0.47;
      for (let j = 0; j < 3; j++) {
        const f = (t * (centre ? 0.21 : 0.28) + i * 0.179 + j / 3) % 1;
        const size = ph * (0.076 + 0.19 * f);
        const x = px(u) + ph * (0.015 * Math.sin(f * 6 + i) + f * 0.055);
        image(
          air,
          2,
          x,
          py(sourceY) - ph * 0.29 * f - size * 0.39,
          size,
          power * (centre ? 0.34 : 0.65) * Math.sin(Math.PI * f),
        );
      }
      for (let j = 0; j < 8; j++) {
        const f = (t * (0.47 + 0.047 * (j % 4)) + j * 0.311 + i * 0.17) % 1,
          side = j % 2 ? 1 : -1;
        const dx = side * (0.017 + 0.004 * (j % 4)) * ph * f;
        const dy = ph * (-(0.31 + 0.047 * (j % 4)) * f + 0.4 * f * f);
        const r = ph * (0.0014 + 0.00045 * (j % 3));
        s.glow(px(u) + dx, py(sourceY) + dy, r * 1.5, r * 2.5, "#ffbd72", power * 0.9 * Math.sin(Math.PI * f));
      }
    }
  }
  const draw = { king: hall, witch: swamp, colossus: foundry }[level.id];
  return function atmosphere(calm, surge, waterTime) {
    const scale = Math.max(s.w() / plate.width, s.h() / plate.height);
    pw = plate.width * scale;
    ph = plate.height * scale;
    left = (s.w() - pw) / 2;
    top = (s.h() - ph) / 2;
    const still = !game.effects() || reduced.matches || calm <= 0;
    draw(level.id === "witch" ? waterTime : game.time(), Math.min(1, calm * (0.78 + 0.22 * surge)), still);
  };
};
