// Shared, cheap atmosphere for every photographic room: light shafts that breathe and
// carry dust, and fog that drifts in layers. All textures are drawn once and reused, so a
// frame costs a handful of drawImage calls.
CastleScenes["atmos-fx"] = (() => {
  const cache = new Map();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  function canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  // A soft beam: feathered sides, bright near the opening, fading with distance.
  function beam(color) {
    const key = "beam" + color;
    if (cache.has(key)) return cache.get(key);
    const c = canvas(64, 256),
      g = c.getContext("2d");
    const across = g.createLinearGradient(0, 0, 64, 0);
    across.addColorStop(0, color + "00");
    across.addColorStop(0.3, color + "70");
    across.addColorStop(0.5, color);
    across.addColorStop(0.7, color + "70");
    across.addColorStop(1, color + "00");
    g.fillStyle = across;
    g.fillRect(0, 0, 64, 256);
    g.globalCompositeOperation = "destination-in";
    const along = g.createLinearGradient(0, 0, 0, 256);
    along.addColorStop(0, "rgba(0,0,0,.25)");
    along.addColorStop(0.1, "rgba(0,0,0,1)");
    along.addColorStop(0.5, "rgba(0,0,0,.6)");
    along.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = along;
    g.fillRect(0, 0, 64, 256);
    cache.set(key, c);
    return c;
  }

  function dot(color) {
    const key = "dot" + color;
    if (cache.has(key)) return cache.get(key);
    const c = canvas(32, 32),
      g = c.getContext("2d");
    const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, "#ffffff");
    r.addColorStop(0.25, color);
    r.addColorStop(1, color + "00");
    g.fillStyle = r;
    g.fillRect(0, 0, 32, 32);
    cache.set(key, c);
    return c;
  }

  // Shafts of light. Each shaft: {x, y, angle (radians from straight down), length, width,
  // color, alpha}. They breathe as clouds pass, sway a little, and carry slow dust.
  function shafts(ctx, list, t, { dust = true, scale = 1 } = {}) {
    const still = reduced.matches;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    list.forEach((s, i) => {
      const time = still ? 0 : t;
      // Two slow waves plus a rare brighter swell: visible change within a few seconds.
      const swell = Math.max(0, Math.sin(time * 0.21 + i * 2.7)) ** 6 * 0.35;
      const breath = 0.55 + 0.25 * Math.sin(time * 0.53 + i * 1.9) + 0.15 * Math.sin(time * 1.31 + i * 0.7) + swell;
      const sway = Math.sin(time * 0.17 + i) * 0.035;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(-(s.angle + sway));
      ctx.globalAlpha = Math.max(0, s.alpha * breath);
      const img = beam(s.color);
      ctx.drawImage(img, -s.width * 0.3, 0, s.width * 0.6, s.length * 0.3);
      ctx.drawImage(img, -s.width / 2, s.length * 0.05, s.width, s.length * 0.95);
      // Dust caught in the shaft, drifting down and sideways.
      if (dust && !still) {
        const mote = dot("#fff4dc");
        const n = Math.round(10 * scale);
        for (let k = 0; k < n; k++) {
          const f = (k * 0.618 + time * (0.025 + (k % 3) * 0.012) + i * 0.31) % 1;
          const across = Math.sin(k * 12.9 + time * 0.4 + i) * 0.38 * (0.3 + f);
          const size = (1.2 + (k % 4) * 0.7) * Math.max(1, s.width / 90);
          ctx.globalAlpha = s.alpha * 3.2 * Math.sin(Math.PI * f) * (0.4 + 0.6 * Math.sin(time * 2 + k) ** 2);
          ctx.drawImage(mote, across * s.width - size, f * s.length - size, size * 2, size * 2);
        }
      }
      ctx.restore();
    });
    ctx.restore();
  }

  // A tileable fog texture: many soft blobs that wrap at the edges.
  function fogTexture(color, density = 1) {
    const key = "fog" + color + density;
    if (cache.has(key)) return cache.get(key);
    const W = 512,
      H = 128,
      c = canvas(W, H),
      g = c.getContext("2d");
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W,
        y = H * (0.25 + rnd() * 0.5),
        r = 18 + rnd() * 46,
        a = Math.min(0.6, (0.05 + rnd() * 0.09) * density);
      for (const dx of [-W, 0, W]) {
        const grad = g.createRadialGradient(x + dx, y, 0, x + dx, y, r);
        grad.addColorStop(0, color + Math.round(a * 255).toString(16).padStart(2, "0"));
        grad.addColorStop(1, color + "00");
        g.fillStyle = grad;
        g.beginPath();
        g.ellipse(x + dx, y, r * 1.9, r * 0.7, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    cache.set(key, c);
    return c;
  }

  // Fog bands drifting sideways. Each layer: {y, height, speed, alpha, color, stretch}.
  // `blend` "screen" suits dark rooms; on pale floors use "source-over" so the mist shows.
  function fog(ctx, width, layers, t, blend = "screen") {
    const time = reduced.matches ? 0 : t;
    ctx.save();
    ctx.globalCompositeOperation = blend;
    for (const L of layers) {
      const tex = fogTexture(L.color || "#d8e4f0", L.density || 1);
      const tileW = (L.stretch || 1.4) * Math.max(width, L.height * 4);
      let x = -((time * L.speed * tileW) % tileW);
      if (x > 0) x -= tileW;
      ctx.globalAlpha = L.alpha * (0.85 + 0.15 * Math.sin(time * 0.3 + L.y));
      for (; x < width; x += tileW) ctx.drawImage(tex, x, L.y - L.height / 2, tileW, L.height);
    }
    ctx.restore();
  }

  // A soft round glow, cached per colour.
  function glow(ctx, x, y, rx, ry, color, alpha = 1) {
    if (alpha <= 0 || rx <= 0 || ry <= 0) return;
    const key = "glow" + color;
    let tile = cache.get(key);
    if (!tile) {
      tile = canvas(96, 96);
      const g = tile.getContext("2d"),
        r = g.createRadialGradient(48, 48, 0, 48, 48, 48);
      r.addColorStop(0, color);
      r.addColorStop(0.42, color + "80");
      r.addColorStop(1, color + "00");
      g.fillStyle = r;
      g.fillRect(0, 0, 96, 96);
      cache.set(key, tile);
    }
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha *= Math.min(1, alpha);
    ctx.drawImage(tile, x - rx, y - ry, rx * 2, ry * 2);
    ctx.restore();
  }

  return { shafts, fog, glow, dot, beam, reduced };
})();
