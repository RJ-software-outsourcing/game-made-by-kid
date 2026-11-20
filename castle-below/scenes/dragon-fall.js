// The last cel marks contact with the dais. Keep it on screen as the storm clears.
CastleScenes["dragon-fall"] = function (sprite) {
  const atlas = sprite("dragonFall"),
    embers = sprite("dragonFallEmbers"),
    bolt = sprite("stormBolt"),
    fire = sprite("livingFlames");
  const size = atlas.width / 9,
    emberSize = embers.width / 9;
  const tongues = document.createElement("canvas");
  tongues.width = fire.width;
  tongues.height = fire.height;
  const brush = tongues.getContext("2d");
  brush.drawImage(fire, 0, 0);
  brush.globalCompositeOperation = "destination-in";
  const fh = fire.height / 2,
    fw = fire.width / 4;
  for (let y = 0; y < tongues.height; y += fh) {
    brush.save();
    brush.beginPath();
    brush.rect(0, y, tongues.width, fh);
    brush.clip();
    const fade = brush.createLinearGradient(0, y, 0, y + fh);
    fade.addColorStop(0, "white");
    fade.addColorStop(0.45, "white");
    fade.addColorStop(0.89, "transparent");
    brush.fillStyle = fade;
    brush.fillRect(0, y, tongues.width, fh);
    brush.restore();
  }
  const light = document.createElement("canvas");
  light.width = light.height = size;
  const g = light.getContext("2d");
  const groundAt = 3.65,
    clearAt = 6.15;
  function ease(t) {
    t = Math.min(1, Math.max(t, 0));
    return t * t * (3 - 2 * t);
  }
  // Shoulder/wing height and breast height measured on the same cels as the fall.
  const landmarks = [
    [0, 0.35, 0.49],
    [9, 0.33, 0.45],
    [18, 0.21, 0.41],
    [34, 0.31, 0.53],
    [44, 0.44, 0.62],
    [53, 0.45, 0.67],
    [65, 0.71, 0.78],
  ];
  function draw(ctx, b, age, paintStart) {
    const f = Math.min(65, Math.round((65 * age) / groundAt));
    const sx = (f % 9) * size,
      sy = Math.floor(f / 9) * size;
    const arrival = ease(age / 0.28);
    ctx.save();
    if (arrival < 1) {
      ctx.globalAlpha = 1 - arrival;
      paintStart();
    }
    ctx.globalAlpha = arrival;
    ctx.drawImage(atlas, sx, sy, size, size, b.left, b.top, b.w, b.h);
    const heat = ease(age / 0.36) * (1 - ease((age - groundAt + 0.1) / 1.5));
    if (heat > 0) {
      const j = Math.max(
        1,
        landmarks.findIndex((key) => key[0] >= f),
      );
      const [i, wy, chest] = landmarks[j - 1],
        [next, wy2, chest2] = landmarks[j];
      const u = (f - i) / (next - i),
        wingY = wy + (wy2 - wy) * u,
        chestY = chest + (chest2 - chest) * u;
      g.clearRect(0, 0, size, size);
      g.save();
      g.scale(size, size);
      g.globalCompositeOperation = "screen";
      g.globalAlpha = 0.83 + 0.13 * Math.sin(age * 7.7);
      g.drawImage(
        embers,
        (f % 9) * emberSize,
        Math.floor(f / 9) * emberSize,
        emberSize,
        emberSize,
        0,
        0,
        1,
        1,
      );
      for (let k = -1; k <= 1; k++) {
        const frame = (Math.floor(age * 12) + (k + 1) * 3) % 8;
        const y = k === 0 ? chestY : wingY;
        g.save();
        g.translate(0.5 + k * 0.24, y);
        g.rotate(k * 0.36);
        g.globalAlpha = 0.46;
        g.drawImage(tongues, (frame % 4) * fw, Math.floor(frame / 4) * fh, fw, fh, -0.16, -0.28, 0.32, 0.53);
        g.restore();
        // Bridge the burning shoulder ridges to the sternum, moving with the folding wings.
        const pulse = Math.sin(Math.PI * (age * 1.68 + (k + 1) * 0.33));
        const dx = k === 0 ? 0.06 : -0.28 * k;
        const dy = k === 0 ? 0.28 : chestY - wingY + 0.13;
        const length = Math.hypot(dx, dy);
        g.save();
        g.translate(0.49 + 0.34 * k, y - 0.12);
        g.rotate(Math.atan2(dy, dx) - Math.PI / 2);
        g.globalAlpha = 0.16 + 0.84 * pulse * pulse;
        g.drawImage(bolt, -0.21, 0, 0.42, length);
        g.restore();
      }
      g.restore();
      g.globalCompositeOperation = "destination-in";
      g.drawImage(atlas, sx, sy, size, size, 0, 0, size, size);
      g.globalCompositeOperation = "source-over";
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = heat;
      ctx.drawImage(light, b.left, b.top, b.w, b.h);
    }
    ctx.restore();
  }
  return {
    draw,
    groundAt,
    endAt: clearAt + 0.45,
    darkness(age, initial) {
      return (
        (initial + (0.96 - initial) * ease(age / 0.35)) *
        (1 - ease((age - groundAt - 0.15) / (clearAt - groundAt - 0.15)))
      );
    },
  };
};

// Generate a single voiced bellow from an irregular glottal pulse and three changing
// vocal-tract resonances. Its breath, cavern reflections and bowed-metal tail share a stereo cue.
CastleScenes["dragon-roar"] = function (ac, attacking = false) {
  const rate = 24000,
    n = Math.ceil((attacking ? 3.45 : 4.75) * rate);
  const buffer = ac.createBuffer(2, n, rate);
  const left = buffer.getChannelData(0),
    right = buffer.getChannelData(1);
  const dry = new Float32Array(n);
  let phase = 0,
    cycles = 0,
    noise = 0,
    low = 0,
    rasp = 0,
    seed = 1947;
  const tau = 2 * Math.PI;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    const random = seed / 2147483648 - 1;
    noise += 0.18 * (random - noise);
    low += 0.025 * (random - low);
    rasp += 0.067 * (random - rasp);
    const voiceTime = Math.max(0, t - 0.12);
    const open =
      Math.min(1, voiceTime / 0.42) * Math.exp(-Math.max(0, voiceTime - (attacking ? 1.18 : 0.83)) * 1.65);
    const pitch = 51 + 39 * open + 4 * Math.sin(t * 15.2) + 6 * rasp;
    phase += pitch / rate;
    if (phase >= 1) {
      phase -= 1;
      cycles++;
    }
    const p = phase / pitch;
    const rough = (cycles % 3 === 0 ? 0.66 : 1) * (0.93 + 0.18 * Math.sin(cycles * 1.76));
    const throat =
      Math.sin(tau * (260 + 290 * open) * p) * Math.exp(-245 * p) +
      0.69 * Math.sin(tau * (690 + 275 * open) * p) * Math.exp(-360 * p) +
      0.28 * Math.sin(tau * (1480 - 170 * open) * p) * Math.exp(-570 * p);
    const breath = Math.min(1, t / 0.17) * Math.exp(-Math.max(0, t - 0.22) * 4.1) * (noise - low) * 0.39;
    const voice =
      open *
      (rough * throat * 0.57 +
        Math.sin(tau * phase) * 0.2 +
        noise * (0.22 + 0.19 * Math.sin(phase * Math.PI)));
    dry[i] = (breath + voice) * (attacking ? Math.min(1, (n - i) / (rate * 0.35)) : 1);
    const ring = Math.min(1, t / 0.85) * Math.exp(-Math.max(0, t - 1.3) * 1.17);
    const overtone =
      (Math.sin(tau * 177 * t + 2 * Math.sin(t * 2.3)) +
        0.66 * Math.sin(tau * 257.3 * t + 0.6 * Math.sin(t * 5))) *
      (attacking ? 0 : 0.052) *
      ring;
    left[i] = dry[i] * 0.78 + overtone;
    right[i] = dry[i] * 0.77 + overtone * 0.84;
  }
  for (const [seconds, gain, channel] of [
    [0.139, 0.23, left],
    [0.183, 0.23, right],
    [0.327, 0.13, right],
    [0.417, 0.11, left],
    [0.59, 0.07, left],
    [0.67, 0.07, right],
  ]) {
    const lag = Math.round(seconds * rate);
    for (let i = lag; i < n; i++) channel[i] += gain * dry[i - lag];
  }
  return buffer;
};
