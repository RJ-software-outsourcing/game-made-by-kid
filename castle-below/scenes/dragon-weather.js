// The opening in the original court plate is in its native 1774 × 887 coordinates.
// The transparent court plate preserves the window tracery and the distant mountain silhouette.
CastleScenes["dragon-weather"] = function (game, sprite, bloom) {
  const { ctx, canvas } = game;
  const court = sprite("stormThrone"),
    mountains = sprite("stormMountains"),
    clouds = sprite("stormWind"),
    webs = sprite("stormWebs"),
    bolt = sprite("stormBolt");
  const flame = sprite("livingFlames"),
    sconce = sprite("emberSconce");
  const period = 1500,
    skyY = -36,
    skyHeight = 497;
  const wind = ctx.createPattern(clouds, "repeat-x");
  const windTransform = new DOMMatrix([period / clouds.width, 0, 0, skyHeight / clouds.height, 0, skyY]);
  function nightPlate(image) {
    const plate = document.createElement("canvas");
    plate.width = image.width;
    plate.height = image.height;
    const shade = plate.getContext("2d");
    shade.drawImage(image, 0, 0);
    shade.globalCompositeOperation = "source-atop";
    shade.fillStyle = "#060b1b";
    shade.fillRect(0, 0, plate.width, plate.height);
    return plate;
  }
  const nightRuins = nightPlate(court),
    rangeNight = nightPlate(mountains);
  const sunX = 970,
    sunY = 79;
  // Sample the very same moving cloud texture for the irregular bright edges around the fixed sun.
  const corona = document.createElement("canvas");
  corona.width = 448;
  corona.height = 196;
  const sunlight = corona.getContext("2d");
  const cloudHighlights = document.createElement("canvas");
  cloudHighlights.width = clouds.width;
  cloudHighlights.height = clouds.height;
  const contrast = cloudHighlights.getContext("2d");
  contrast.filter = "contrast(165%) brightness(210%)";
  contrast.drawImage(clouds, 0, 0);
  const cloudDetail = sunlight.createPattern(cloudHighlights, "repeat-x");
  const lens = document.createElement("canvas");
  lens.width = corona.width;
  lens.height = corona.height;
  const lensCtx = lens.getContext("2d");
  lensCtx.scale(lens.width / 2, lens.height / 2);
  const feather = lensCtx.createRadialGradient(1, 1, 0, 1, 1, 1);
  feather.addColorStop(0, "white");
  feather.addColorStop(0.35, "#ffffffed");
  feather.addColorStop(0.72, "#ffffff75");
  feather.addColorStop(1, "transparent");
  lensCtx.fillStyle = feather;
  lensCtx.fillRect(0, 0, 2, 2);
  const detailTransform = new DOMMatrix([
    period / clouds.width / 2,
    0,
    0,
    skyHeight / clouds.height / 2,
    0,
    (skyY - sunY + corona.height) / 2,
  ]);
  function drawSun(offset, darkness) {
    const through = cloudLight((sunX - offset) / period);
    const daylight = 1 - darkness;
    if (daylight <= 0.01) return;
    const pulse = 0.52 + 0.48 * through;
    detailTransform.e = (offset - sunX + corona.width) / 2;
    cloudDetail.setTransform(detailTransform);
    sunlight.clearRect(0, 0, corona.width, corona.height);
    sunlight.fillStyle = cloudDetail;
    sunlight.fillRect(0, 0, corona.width, corona.height);
    sunlight.globalCompositeOperation = "destination-in";
    sunlight.drawImage(lens, 0, 0);
    sunlight.globalCompositeOperation = "source-over";
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = daylight * pulse;
    bloom(sunX, sunY, 450 + 100 * through, 214 + 60 * through, "#fff3d7", "#c5dffeab");
    ctx.drawImage(corona, sunX - corona.width, sunY - corona.height, corona.width * 2, corona.height * 2);
    bloom(sunX, sunY, 118 + 60 * through, 71 + 29 * through, "#fff6dbee", "#ffe2aa91");
    bloom(sunX, sunY, 28 + 24 * through, 17 + 12 * through, "#fffff8", "#fff5dad6");
    ctx.restore();
  }

  const rangeX = 276,
    rangeY = 280;
  function drawMountains(darkness) {
    ctx.drawImage(mountains, rangeX, rangeY);
    if (darkness > 0) {
      ctx.save();
      ctx.globalAlpha = darkness * 0.59;
      ctx.drawImage(rangeNight, rangeX, rangeY);
      ctx.restore();
    }
  }
  function drawFlame(x, y, width, height, offset) {
    const frame = Math.floor(game.time() * 12 + offset) % 8;
    const sw = flame.width / 4,
      sh = flame.height / 2;
    ctx.drawImage(
      flame,
      (frame % 4) * sw,
      Math.floor(frame / 4) * sh,
      sw,
      sh,
      x - width / 2,
      y - height * 0.94,
      width,
      height,
    );
  }
  function brazier(x, y, w, h, index) {
    const t = game.time(),
      pulse = Math.sin(t * 4.7 + index * 2.4) * 0.06 + Math.sin(t * 8.2 + index) * 0.025;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    bloom(x, y - h * 0.32, w * 1.25, h * 0.87, "#ff9e38a6", "#ff52184d");
    ctx.globalAlpha *= 0.45 + pulse * 2;
    bloom(x, y + h * 0.09, w * 0.82, h * 0.13, "#f9a748a8", "#b961293a");
    ctx.restore();
    drawFlame(x, y, w * (1 - pulse), h * (1 + pulse), index * 2.71);
  }
  // Horizontal optical transmission of the cloud tile at the light's fixed elevation.
  const transmission = [
    215, 133, 119, 94, 63, 34, 19, 18, 39, 66, 46, 57, 72, 81, 111, 122, 137, 150, 173, 133, 109, 85, 43, 42,
    107, 168, 255, 255, 178, 132, 84, 19, 0, 20, 49, 93, 156, 205, 215, 230,
  ];
  function cloudLight(u) {
    const f = (u - Math.floor(u)) * transmission.length,
      i = Math.floor(f);
    return (
      (transmission[i] + (transmission[(i + 1) % transmission.length] - transmission[i]) * (f - i)) / 255
    );
  }
  const branches = [
    [652, 48, 600, 203, -0.16, 0, 0.03],
    [1048, 101, 700, 212, 0.14, 2, 0.1],
    [803, 190, 590, 157, -0.35, 1, 0.19],
    [1202, 196, 522, 160, -0.4, 3, 0.25],
    [584, 222, 492, 165, 0.2, 2, 0.38],
    [952, 41, 674, 215, 0.08, 1, 0.54],
    [864, 138, 620, 210, 0.35, 3, 0.7],
    [1094, 242, 502, 135, -0.15, 0, 0.79],
    [694, 91, 573, 215, -0.27, 3, 0.94],
    [944, 173, 728, 209, -0.23, 2, 1.08],
  ];
  function drawSwarm(elapsed, darkness, volley = 0) {
    const sw = webs.width / 2,
      sh = webs.height / 2;
    for (const [x, y, w, h, angle, frame, delay] of branches) {
      const a = elapsed - delay;
      if (a < 0 || a > 0.95) continue;
      const energy = Math.min(1, a / 0.055) * Math.exp(-a * 2.9);
      ctx.save();
      ctx.translate(volley % 2 ? court.width - x : x, y);
      ctx.rotate(volley % 2 ? -angle : angle);
      ctx.globalAlpha = Math.min(1, energy * darkness * 1.35);
      bloom(0, 0, w * 0.56, h * 0.81, "#a9b8ff70", "#746fc84a");
      const pattern = (frame + volley) % 4;
      ctx.drawImage(webs, (pattern % 2) * sw, Math.floor(pattern / 2) * sh, sw, sh, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }
  function draw(darkness, stormAge, falling) {
    const t = game.time(),
      w = canvas._w,
      h = canvas._h;
    const scale = Math.max((w + 20) / court.width, (h + 20) / court.height);
    const ox = (w - court.width * scale) / 2,
      oy = (h - court.height * scale) * 0.61;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    // Only the clouds translate. The light stays over the same spot on the court
    // and its halo opens or dims as differently dense parts of the cloud cover pass.
    const offset = (t * 4.5) % period;
    // One fill samples across the wrap. Separate drawImage edges can leave a fractional-pixel gap.
    windTransform.e = offset;
    wind.setTransform(windTransform);
    ctx.fillStyle = wind;
    ctx.fillRect(0, skyY, court.width, skyHeight);
    drawSun(offset, darkness);
    ctx.fillStyle = "rgba(4,8,22," + 0.82 * darkness + ")";
    ctx.fillRect(-12, -12, court.width + 24, 540);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    // Distant discharges are short, high in the clouds, and behind the towers.
    const interval = 2.55,
      cycle = Math.floor(t / interval);
    const since = t - cycle * interval - 0.36 * (1 + Math.sin(cycle * 2.31));
    if (!falling && since >= 0 && since < 0.55 && darkness < 0.12) {
      const x = 886 + 235 * Math.sin(cycle * 4.37);
      const flash =
        Math.min(1, since / 0.025) * Math.exp(-since * 8) + 0.32 * Math.exp(-Math.abs(since - 0.19) * 18);
      ctx.save();
      ctx.globalAlpha = Math.min(0.9, flash);
      if (cycle % 2 === 0) ctx.drawImage(bolt, x - 110, -24, 220, 238);
      else {
        const frame = cycle % 4,
          sw = webs.width / 2,
          sh = webs.height / 2;
        ctx.drawImage(webs, (frame % 2) * sw, Math.floor(frame / 2) * sh, sw, sh, x - 258, 25, 516, 154);
      }
      bloom(x, 88, 215, 122, "#ddeaffad", "#a0bcff57");
      ctx.restore();
    }
    if (darkness > 0) {
      const waves = falling ? 3 : 1;
      for (let i = 0; i < waves; i++) {
        const elapsed = stormAge - i * 1.3;
        if (elapsed >= 0 && elapsed < 2.05) drawSwarm(elapsed, darkness, i);
      }
    }
    ctx.restore();
    drawMountains(darkness);
    ctx.drawImage(court, 0, 0);
    if (darkness > 0) {
      ctx.globalAlpha = 0.58 * darkness;
      ctx.drawImage(nightRuins, 0, 0);
      ctx.globalAlpha = 1;
    }
    brazier(111, 430, 84, 125, 0);
    brazier(370, 471, 37, 69, 1);
    brazier(1403, 471, 37, 69, 2);
    brazier(1667, 430, 84, 126, 3);
    ctx.restore();

    // Portrait framing crops the wall-mounted bowls. Place a matched pair on the near columns.
    if (ox + 370 * scale < 10) {
      const width = Math.min(w * 0.13, 65),
        height = (width * sconce.height) / sconce.width,
        y = h * 0.56;
      for (const side of [-1, 1]) {
        const x = side < 0 ? width * 0.3 : w - width * 0.3;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(side < 0 ? 1 : -1, 1);
        ctx.drawImage(sconce, -width * 0.67, -height * 0.2, width, height);
        ctx.restore();
        brazier(x, y, width * 0.64, height * 1.48, side + 4);
      }
    }
  }
  return { draw };
};
