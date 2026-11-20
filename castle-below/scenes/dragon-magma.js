// Reveal one continuous stone fracture in world space. The hot channel and the dark
// rock lip cool independently, so a shield casts a real gap in both layers.
CastleScenes["dragon-magma"] = function (sprite, project) {
  const fault = sprite("moltenSweep"),
    emission = sprite("moltenGlow");
  const minLane = -1.2,
    maxLane = 10.2,
    samples = 176,
    rows = 24;
  const heated = new Float64Array(samples).fill(-Infinity);
  const distanceToTip = new Uint8Array(samples);
  let previous = null,
    lastHeat = -Infinity;
  function surface(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  const mask = surface(samples, rows),
    maskCtx = mask.getContext("2d");
  const rockMask = maskCtx.createImageData(samples, rows),
    heatMask = maskCtx.createImageData(samples, rows);
  const layer = surface(1024, 176),
    g = layer.getContext("2d");
  const cold = surface(layer.width, layer.height),
    cg = cold.getContext("2d");
  cg.filter = "saturate(.2) brightness(.45)";
  cg.drawImage(fault, 0, 0, cold.width, cold.height);

  function contact(lane, now) {
    if (lane === null) {
      previous = null;
      return;
    }
    const from = previous ?? lane,
      scale = samples / (maxLane - minLane);
    const left = Math.max(0, Math.floor((Math.min(from, lane) - minLane) * scale));
    const right = Math.min(samples - 1, Math.floor((Math.max(from, lane) - minLane) * scale));
    for (let i = left; i <= right; i++) heated[i] = now;
    lastHeat = now;
    previous = lane;
  }
  function draw(ctx, canvas, now) {
    if (now - lastHeat > 3.15) return;
    // Narrow the rock and the incandescent channel as they approach untouched stone.
    const taper = 7;
    let distance = taper;
    for (let x = 0; x < samples; x++) {
      distance = now - heated[x] > 3.15 ? 0 : Math.min(taper, distance + 1);
      distanceToTip[x] = distance;
    }
    distance = taper;
    for (let x = samples - 1; x >= 0; x--) {
      distance = now - heated[x] > 3.15 ? 0 : Math.min(taper, distance + 1);
      const tip = Math.min(distanceToTip[x], distance) / taper;
      const age = now - heated[x],
        opening = Math.min(1, age / 0.16 + 0.09);
      const scar = Math.max(0, Math.min(1, (3.15 - age) / 0.85));
      const heat = Math.max(0, Math.min(1, (2.42 - age) / 1.35));
      const pulse = 0.91 + 0.09 * Math.sin(now * 6 - x * 0.17);
      for (let y = 0; y < rows; y++) {
        const edge = Math.abs((y + 0.5) / rows - 0.52 - 0.03 * Math.sin(x * 0.24)) * 2;
        const feather = Math.max(0, Math.min(1, (opening * tip - edge) * 6));
        const alpha = 4 * (y * samples + x) + 3;
        rockMask.data[alpha] = 255 * scar * feather * Math.min(1, tip * 2.5);
        heatMask.data[alpha] = 255 * heat * feather * pulse * Math.min(1, tip * 2.5);
      }
    }
    const left = project(0.25, minLane),
      right = project(0.25, maxLane);
    const width = right.x - left.x,
      height = Math.min(canvas._h * 0.205, canvas._w * 0.26);
    const top = left.y - height * 0.54;
    function masked(image, opacity) {
      g.globalCompositeOperation = "source-over";
      g.clearRect(0, 0, layer.width, layer.height);
      g.drawImage(image, 0, 0, layer.width, layer.height);
      maskCtx.putImageData(opacity, 0, 0);
      g.globalCompositeOperation = "destination-in";
      g.drawImage(mask, 0, 0, layer.width, layer.height);
      ctx.drawImage(layer, left.x, top, width, height);
    }
    ctx.save();
    masked(cold, rockMask);
    masked(fault, heatMask);
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha *= 0.36;
    masked(emission, heatMask);
    ctx.restore();
  }
  return { contact, draw };
};
