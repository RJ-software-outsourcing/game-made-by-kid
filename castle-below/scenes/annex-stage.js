// Shared camera, photographic plates and audio for the western trial chambers.
CastleScenes["annex-stage"] = function (game, sprite, sound, level) {
  const { canvas, ctx, player } = game;
  const room = sprite(level.id + "Room");
  const voices = new Set();
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const w = () => canvas._w,
    h = () => canvas._h;
  const heroSize = () => Math.min(w() * 0.245, h() * 0.185);
  function project(x, y, z = 0) {
    const origin = level.id === "ice" ? player.x : 0.5;
    const k = 1 / (1 + 0.21 * Math.max(-1.4, x - origin));
    const depth = level.boss ? clamp((x - 0.5) / 7) : 0;
    const lift = heroSize() * 0.53 * (1 - depth) + Math.min(h() * 0.51, w() * 0.73) * 0.49 * depth;
    return {
      x: w() * (0.5 + (y - 4.5) * 0.103 * (level.boss ? 0.85 + 0.15 * k : k)),
      y: h() * (0.41 + 0.465 * k) - (z / 82) * lift,
      k,
    };
  }
  function ground(pos) {
    if (pos.y < h() * 0.66) return null;
    // The boss hazards occupy one lateral row. Keep feet, targets and impacts on it.
    const k = level.boss ? 1 : clamp((pos.y / h() - 0.41) / 0.465, 0.86, 1);
    return { x: 0.5 + (1 / k - 1) / 0.21, y: clamp(4.5 + (pos.x / w() - 0.5) / (0.103 * k), 0.55, 8.45) };
  }
  function hitHero(pos) {
    const p = project(player.x, player.y),
      size = heroSize();
    return (
      Math.hypot(
        (pos.x - p.x) / Math.max(25, size * 0.36),
        (pos.y - p.y + size * 0.46) / Math.max(26, size * 0.55),
      ) < 1
    );
  }
  const lights = new Map();
  function glow(x, y, rx, ry, color, alpha = 1) {
    if (rx <= 0 || ry <= 0 || alpha <= 0) return;
    if (!lights.has(color)) {
      const tile = document.createElement("canvas");
      tile.width = tile.height = 96;
      const g = tile.getContext("2d"),
        light = g.createRadialGradient(48, 48, 0, 48, 48, 48);
      light.addColorStop(0, color);
      light.addColorStop(0.42, color + "80");
      light.addColorStop(1, color + "00");
      g.fillStyle = light;
      g.fillRect(0, 0, 96, 96);
      lights.set(color, tile);
    }
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha *= clamp(alpha);
    ctx.drawImage(lights.get(color), x - rx, y - ry, rx * 2, ry * 2);
    ctx.restore();
  }
  const palette = {
    bells: "#ffc784",
    sluice: "#91ddeb",
    mirrors: "#9ac9ff",
    ice: "#acdffa",
    forge: "#ff973a",
    king: "#8dcffd",
    witch: "#b7e787",
    colossus: "#ff9d48",
  };
  const accent = palette[level.id];
  // Light anchors are measured on each source photograph, before the viewport crops it.
  const flames = {
    king: [
      [0.114, 0.375, 0.094],
      [0.231, 0.481, 0.051],
      [0.772, 0.48, 0.052],
      [0.883, 0.373, 0.094],
    ],
    ice: [
      [0.397, 0.373, 0.048],
      [0.601, 0.372, 0.049],
    ],
    forge: [
      [0.13, 0.539, 0.085],
      [0.874, 0.545, 0.102],
    ],
    colossus: [
      [0.094, 0.472, 0.17],
      [0.902, 0.469, 0.17],
      [0.234, 0.48, 0.075],
      [0.764, 0.48, 0.075],
    ],
  };
  const lamps = {
    bells: [[0.499, 0.385, 0.115, "#ffbf80"]],
    ice: [
      [0.501, 0.065, 0.16, "#c7eeff"],
      [0.501, 0.36, 0.067, "#ffddaa"],
    ],
    witch: [[0.494, 0.311, 0.094, "#d4f3b4"]],
    king: [[0.502, 0.219, 0.092, "#bce4ff"]],
  };
  // Trace only water inside the photograph. Preserve the railings, masonry and ice banks.
  const waterAreas = {
    sluice: [
      {
        fall: true,
        points: [
          [0.417, 0.259],
          [0.481, 0.259],
          [0.478, 0.33],
          [0.454, 0.37],
          [0.418, 0.36],
        ],
      },
      {
        fall: true,
        points: [
          [0.524, 0.258],
          [0.584, 0.257],
          [0.584, 0.36],
          [0.553, 0.37],
          [0.525, 0.33],
        ],
      },
      {
        points: [
          [0.016, 0.69],
          [0.139, 0.652],
          [0.133, 0.814],
          [0.012, 0.921],
        ],
      },
      {
        points: [
          [0.855, 0.655],
          [0.979, 0.699],
          [0.992, 0.918],
          [0.865, 0.815],
        ],
      },
    ],
    ice: [
      {
        points: [
          [0.22, 0.555],
          [0.77, 0.551],
          [0.84, 0.622],
          [0.715, 0.708],
          [0.36, 0.729],
          [0.19, 0.654],
        ],
      },
    ],
  };
  function waterPatch({ points, fall }) {
    const xs = points.map(([x]) => x * room.width),
      ys = points.map(([, y]) => y * room.height);
    const x = Math.floor(Math.min(...xs)),
      y = Math.floor(Math.min(...ys));
    const width = Math.ceil(Math.max(...xs)) - x,
      height = Math.ceil(Math.max(...ys)) - y;
    const surface = document.createElement("canvas");
    surface.width = width;
    surface.height = height;
    const g = surface.getContext("2d");
    const mask = document.createElement("canvas");
    mask.width = width;
    mask.height = height;
    const m = mask.getContext("2d");
    m.filter = "blur(3px)";
    m.beginPath();
    xs.forEach((px, i) => (i ? m.lineTo(px - x, ys[i] - y) : m.moveTo(px - x, ys[i] - y)));
    m.closePath();
    m.fill();
    return { x, y, width, height, g, mask, surface, fall, lastFrame: -1 };
  }
  const water = (waterAreas[level.id] || []).map(waterPatch);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function animateWater(t, scale, left, top) {
    const frame = Math.floor(t * 18);
    for (const patch of water) {
      const { x, y, width, height, g, mask, surface, fall } = patch;
      if (left + (x + width) * scale < 0 || left + x * scale > w()) continue;
      if (frame !== patch.lastFrame) {
        patch.lastFrame = frame;
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = 1;
        if (fall) {
          // Two overlapping flows hide the wrap as highlights descend behind the pipe.
          for (let i = 0; i < 2; i++) {
            const phase = (frame / 16 + i * 0.5) % 1;
            g.globalAlpha = i === 0 ? 1 : Math.sin(phase * Math.PI) ** 2;
            g.drawImage(room, x, y + (0.5 - phase) * 12, width, height, 0, 0, width, height);
          }
        } else {
          for (let j = 0; j < height; j += 3) {
            const dy = Math.min(3, height - j);
            const ripple = Math.sin(j * 0.13 - frame * 0.16 + x) + 0.45 * Math.sin(j * 0.22 - frame * 0.1);
            g.drawImage(room, x + ripple * 2, y + j + ripple * 0.65, width, dy, 0, j, width, dy);
          }
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = "destination-in";
        g.drawImage(mask, 0, 0);
      }
      ctx.drawImage(surface, left + x * scale, top + y * scale, width * scale, height * scale);
    }
  }
  function drawRoom({ overlay = false, heat = 1, waterTime = game.time(), atmosphere = 1 } = {}) {
    const width = w(),
      height = h(),
      t = level.boss && reduced.matches ? 0 : game.time();
    const approach = level.id === "ice" ? clamp((player.x - 0.5) / 8.96) : 0;
    const scale = Math.max(width / room.width, height / room.height) * (1 + 0.22 * approach);
    const left = (width - room.width * scale) / 2,
      top = (height - room.height * scale) * (level.id === "ice" ? 0.41 : 0.5);
    if (!overlay) ctx.drawImage(room, left, top, room.width * scale, room.height * scale);
    if (heat < 1 && level.id === "colossus") {
      ctx.save();
      ctx.globalAlpha = 1 - heat;
      ctx.drawImage(sprite("coldFoundry"), left, top, room.width * scale, room.height * scale);
      ctx.restore();
    }
    if (level.id === "ice") {
      const img = sprite("frostBeyond"),
        pw = room.width * scale,
        ph = room.height * scale;
      const x = left + pw * 0.5,
        y = top + ph * 0.414,
        rx = pw * 0.02,
        arch = ph * 0.113;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x - rx, y);
      ctx.lineTo(x - rx, y - arch * 0.59);
      ctx.quadraticCurveTo(x - rx, y - arch * 0.84, x, y - arch);
      ctx.quadraticCurveTo(x + rx, y - arch * 0.84, x + rx, y - arch * 0.59);
      ctx.lineTo(x + rx, y);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, x - rx, y - arch, rx * 2, arch);
      if (game.effects() && !reduced.matches) {
        ctx.fillStyle = "#fff9e1";
        for (let i = 0; i < 20; i++) {
          const f = (i * 0.411 + t * (0.21 + 0.03 * (i % 3))) % 1;
          ctx.globalAlpha = 0.36 + 0.45 * Math.sin(f * Math.PI);
          ctx.fillRect(
            x + rx * (2 * ((i * 0.618 + f * 0.45) % 1) - 1),
            y - arch + f * arch,
            Math.max(1, ph * 0.0016),
            Math.max(1, ph * 0.0024),
          );
        }
      }
      ctx.restore();
    }
    if (!game.effects()) return;
    const pw = room.width * scale,
      ph = room.height * scale;
    if (!reduced.matches && water.length) animateWater(waterTime, scale, left, top);
    for (const [u, v, r, color] of lamps[level.id] || []) {
      const light = 0.34 + 0.14 * Math.sin(t * 0.91 + u * 7) + 0.085 * Math.sin(t * 1.73 + v * 4);
      glow(left + u * pw, top + v * ph, r * pw, r * pw * 0.88, color, light * atmosphere);
    }
    for (const [u, v, size] of flames[level.id] || []) {
      const x = left + u * pw,
        y = top + v * ph,
        f = size * ph;
      if (x < -f || x > width + f) continue;
      const flicker = 0.5 + 0.11 * Math.sin(t * 6.4 + u * 11) + 0.08 * Math.sin(t * 8.1 + v);
      glow(x, y - f * 0.19, f * 1.15, f * 0.83, "#ffab49", flicker * 0.7 * heat);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.85 * heat;
      cel(sprite("livingFlames"), Math.floor(t * 12 + u * 29) % 8, 4, 2, x, y - f * 0.37, f * 0.95, f);
      ctx.restore();
    }
    if (!level.boss && !reduced.matches) {
      // Use source-plate coordinates so a portrait crop or a step onto the ice
      // cannot detach snow, reflected light or stars from the opening.
      const portals = {
        ice: [0.5, 0.379, 0.025, 0.047],
        bells: [0.5, 0.32, 0.13, 0.16],
        forge: [0.5, 0.35, 0.056, 0.099],
        sluice: [0.5, 0.24, 0.085, 0.11],
      };
      const [u, v, rw, rh] = portals[level.id];
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(left + u * pw, top + v * ph, pw * rw, ph * rh, 0, 0, Math.PI * 2);
      ctx.clip();
      for (let i = 0; i < 16; i++) {
        const f = (i * 0.37 + t * (level.id === "ice" ? 0.22 : 0.075)) % 1;
        const dx = (((i * 0.618 + f * 0.27) % 1) - 0.5) * 2,
          dy = f * 2 - 1;
        glow(
          left + (u + dx * rw) * pw,
          top + (v + dy * rh) * ph,
          Math.max(1, ph * 0.0022),
          Math.max(1, ph * 0.003),
          accent,
          0.78 * Math.sin(f * Math.PI),
        );
      }
      ctx.restore();
      if (level.id === "ice" || level.id === "sluice") {
        const pulse = 0.5 + 0.22 * Math.sin(t * 1.35) + 0.16 * Math.sin(t * 1.97);
        glow(left + pw * 0.5, top + ph * 0.651, pw * 0.102, ph * 0.022, "#bde4ff", pulse * 0.54);
      }
    }
    const hot = level.id === "forge" || level.id === "colossus";
    const cold = level.id === "ice";
    const drift = hot ? 0.115 : 0.038;
    for (let i = 0; i < 19; i++) {
      const v = (i * 0.618 + t * drift * (0.65 + (i % 3) * 0.19)) % 1;
      const x = width * ((i * 0.371 + 0.022 * Math.sin(t * 0.47 + i * 3)) % 1);
      const y = height * (cold ? 0.13 + v * 0.67 : 0.78 - v * 0.6);
      const r = Math.max(0.9, Math.min(3, width * 0.0023)) * (0.5 + (i % 4) * 0.18);
      glow(x, y, r * 1.5, r * (hot ? 2.2 : 1.1), accent, 0.46 * heat * atmosphere * Math.sin(Math.PI * v));
    }
  }
  function shadow(x, y, rx, ry, opacity = 0.55) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    const d = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    d.addColorStop(0, "rgba(8,6,10," + opacity + ")");
    d.addColorStop(1, "rgba(8,6,10,0)");
    ctx.fillStyle = d;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  function cel(image, index, cols, rows, x, y, width, height, angle = 0) {
    const sw = image.width / cols,
      sh = image.height / rows;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(
      image,
      (index % cols) * sw,
      Math.floor(index / cols) * sh,
      sw,
      sh,
      -width / 2,
      -height / 2,
      width,
      height,
    );
    ctx.restore();
  }
  function instrument(index, x, y, width, height = width, angle = 0) {
    cel(sprite("annexInstruments"), index, 3, 3, x, y, width, height, angle);
  }
  function lettering(message, x, y, size = 16, color = "#fff3d5") {
    ctx.save();
    ctx.font = "600 " + size + "px Georgia,serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#1c171acc";
    ctx.strokeText(message, x, y);
    ctx.fillStyle = color;
    ctx.fillText(message, x, y);
    ctx.restore();
  }
  function tone(freq, seconds = 0.4, type = "sine", power = 0.16, end = freq, delay = 0) {
    const ac = sound();
    if (!ac || ac.state !== "running") return;
    const source = ac.createOscillator(),
      gain = ac.createGain(),
      t = ac.currentTime + delay;
    source.type = type;
    source.frequency.setValueAtTime(freq, t);
    source.frequency.exponentialRampToValueAtTime(end, t + seconds);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(power, t + Math.min(0.035, seconds * 0.15));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    source.connect(gain).connect(ac.destination);
    voices.add(source);
    source.onended = () => {
      voices.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    source.start(t);
    source.stop(t + seconds + 0.01);
  }
  let windNoise;
  function rush(high, low, seconds, power = 0.3, delay = 0) {
    const ac = sound();
    if (!ac || ac.state !== "running") return;
    if (!windNoise) {
      windNoise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const data = windNoise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ac.createBufferSource(),
      filter = ac.createBiquadFilter(),
      gain = ac.createGain(),
      t = ac.currentTime + delay;
    src.buffer = windNoise;
    src.loop = true;
    filter.type = "bandpass";
    filter.Q.value = 0.84;
    filter.frequency.setValueAtTime(high, t);
    filter.frequency.exponentialRampToValueAtTime(low, t + seconds);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(power, t + 0.055);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    src.connect(filter).connect(gain).connect(ac.destination);
    voices.add(src);
    src.onended = () => {
      voices.delete(src);
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    src.start(t);
    src.stop(t + seconds + 0.01);
  }
  function quiet() {
    for (const voice of voices) voice.stop();
  }
  function chime(note) {
    tone(note, 0.85, "sine", 0.22);
    tone(note * 2.41, 0.57, "sine", 0.075);
    tone(note * 3.79, 0.32, "sine", 0.032);
  }
  function hint(text) {
    if (game.roomHint.textContent !== text) game.roomHint.textContent = text;
  }
  const base = { heroSize, project, ground, hitHero, quiet, cameraOffset: () => ({ x: 0, y: 0 }) };
  return {
    game,
    sprite,
    level,
    ctx,
    player,
    w,
    h,
    base,
    clamp,
    glow,
    shadow,
    drawRoom,
    instrument,
    cel,
    lettering,
    tone,
    chime,
    rush,
    hint,
    accent,
  };
};
