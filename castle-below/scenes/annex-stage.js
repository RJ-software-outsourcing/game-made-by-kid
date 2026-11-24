// Shared camera, photographic plates and audio for the western trial chambers.
CastleScenes["annex-stage"] = function (game, sprite, sound, level) {
  const { canvas, ctx, player } = game;
  const room = sprite(level.id + "Room");
  // A room may borrow another room's photograph and its measured lights (`level.look`).
  const look = level.look || level.id;
  const voices = new Set();
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const w = () => canvas._w,
    h = () => canvas._h;
  const heroSize = () => Math.min(w() * 0.245, h() * 0.185);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  // The plate fills the view and never moves. Depth comes from light, air and
  // perspective-correct props, not from sliding the photograph around.
  let box = null;
  function plateBox() {
    const width = w(),
      height = h();
    const scale = Math.max(width / room.width, height / room.height);
    const pw = room.width * scale,
      ph = room.height * scale;
    box = { scale, left: (width - pw) / 2, top: (height - ph) * (level.id === "ice" ? 0.41 : 0.5), pw, ph };
    return box;
  }
  // Plate coordinates (0..1 of the source photograph) to screen pixels.
  function platePoint(u, v) {
    const b = box || plateBox();
    return { x: b.left + u * b.pw, y: b.top + v * b.ph };
  }

  function project(x, y, z = 0) {
    const k = 1 / (1 + 0.21 * Math.max(-1.4, x - 0.5));
    const depthMix = level.boss ? clamp((x - 0.5) / 7) : 0;
    const lift = heroSize() * 0.53 * (1 - depthMix) + Math.min(h() * 0.51, w() * 0.73) * 0.49 * depthMix;
    const floorY = h() * (0.41 + 0.465 * k);
    return {
      x: w() * (0.5 + (y - 4.5) * 0.103 * (level.boss ? 0.85 + 0.15 * k : k)),
      y: floorY - (z / 82) * lift,
      k,
    };
  }
  function ground(pos) {
    if (pos.y < h() * 0.66) return null;
    // The boss hazards occupy one lateral row. Keep feet, targets and impacts on it.
    const k = level.boss ? 1 : clamp((pos.y / h() - 0.41) / 0.465, 0.86, 1);
    const x = pos.x;
    return { x: 0.5 + (1 / k - 1) / 0.21, y: clamp(4.5 + (x / w() - 0.5) / (0.103 * k), 0.55, 8.45) };
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
    bosshall: "#ffc27a",
  };
  const accent = palette[look];
  // Light anchors are measured on each source photograph, before the viewport crops it.
  const flames = {
    // Wall sconces down the gallery, near to far.
    bosshall: [
      [0.139, 0.215, 0.07],
      [0.861, 0.215, 0.07],
      [0.286, 0.34, 0.035],
      [0.714, 0.34, 0.035],
      [0.35, 0.395, 0.022],
      [0.65, 0.395, 0.022],
    ],
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
  const water = (waterAreas[look] || []).map(waterPatch);
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
          // Rows of the photograph shift sideways and up/down, so the reflections wobble
          // like a moving water surface; deeper rows (nearer the camera) move more.
          for (let j = 0; j < height; j += 2) {
            const dy = Math.min(2, height - j),
              depth = 0.6 + (j / height) * 0.9;
            const ripple = Math.sin(j * 0.11 - frame * 0.21 + x) + 0.55 * Math.sin(j * 0.27 - frame * 0.13) + 0.3 * Math.sin(j * 0.05 + frame * 0.07);
            g.drawImage(room, x + ripple * 4.5 * depth, y + j + ripple * 1.3 * depth, width, dy, 0, j, width, dy);
          }
          // Glints sliding across the surface.
          g.globalCompositeOperation = "screen";
          for (let k = 0; k < 14; k++) {
            const f = (k * 0.137 + frame * 0.004 * (1 + (k % 3))) % 1;
            const gx = ((k * 0.618 + frame * 0.002) % 1) * width,
              gy = f * height;
            const r = 2 + (k % 4) * 2;
            const glint = g.createRadialGradient(gx, gy, 0, gx, gy, r * 3);
            glint.addColorStop(0, "rgba(220,255,255," + 0.5 * Math.sin(Math.PI * f) + ")");
            glint.addColorStop(1, "rgba(220,255,255,0)");
            g.fillStyle = glint;
            g.fillRect(gx - r * 3, gy - r, r * 6, r * 2);
          }
          g.globalCompositeOperation = "source-over";
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
    const { scale, left, top } = plateBox();
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
      const y = top + ph * 0.414,
        x = left + pw * 0.5,
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
    drawFog(t);
    for (const [u, v, r, color] of lamps[look] || []) {
      const light = 0.34 + 0.14 * Math.sin(t * 0.91 + u * 7) + 0.085 * Math.sin(t * 1.73 + v * 4);
      glow(left + u * pw, top + v * ph, r * pw, r * pw * 0.88, color, light * atmosphere);
    }
    for (const [u, v, size] of flames[look] || []) {
      const y = top + v * ph,
        x = left + u * pw,
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
        bosshall: [0.5, 0.47, 0.018, 0.04],
      };
      const [u, v, rw, rh] = portals[look];
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
      const y = height * (cold ? 0.13 + v * 0.67 : 0.78 - v * 0.6);
      const x = width * ((i * 0.371 + 0.022 * Math.sin(t * 0.47 + i * 3)) % 1);
      const r = Math.max(0.9, Math.min(3, width * 0.0023)) * (0.5 + (i % 4) * 0.18);
      glow(x, y, r * 1.5, r * (hot ? 2.2 : 1.1), accent, 0.46 * heat * atmosphere * Math.sin(Math.PI * v));
    }
  }

  // ---------------------------------------------------------------- light & air
  // Measured on each plate: where daylight or fire enters, the colour Coji picks up from
  // the room, which side lights his outline, and how wet (reflective) the floor is.
  // Rays: [u, v, angle from straight down, length (plate heights), width (plate widths), colour, alpha]
  const lightProfiles = {
    bells: {
      tint: "#ff9f5a", tintAlpha: 0.15, rim: "#ffd29a", rimFrom: [0, -1], reflect: 0.13,
      rays: [
        [0.5, 0.2, -0.32, 0.86, 0.11, "#ffc58a", 0.13],
        [0.5, 0.2, 0.02, 0.9, 0.15, "#ffd3a0", 0.15],
        [0.5, 0.2, 0.34, 0.86, 0.11, "#ffc58a", 0.13],
        [0.31, 0.24, -0.62, 0.7, 0.08, "#ffb877", 0.09],
        [0.69, 0.24, 0.62, 0.7, 0.08, "#ffb877", 0.09],
      ],
      air: { color: "#ffd8a4", count: 9, rise: -0.004, sway: 0.012, size: 0.05 },
      grade: ["#2a1306", 0.5, "#ff9a4a", 0.07],
    },
    sluice: {
      tint: "#6fd2e6", tintAlpha: 0.14, rim: "#b8f3ff", rimFrom: [0, -1], reflect: 0.24,
      rays: [
        [0.5, 0.12, -0.12, 0.62, 0.09, "#a8ecff", 0.12],
        [0.5, 0.12, 0.13, 0.62, 0.09, "#a8ecff", 0.12],
        [0.5, 0.12, 0, 0.66, 0.14, "#c6f4ff", 0.1],
      ],
      air: { color: "#bff2ff", count: 10, rise: 0.006, sway: 0.01, size: 0.04 },
      grade: ["#031820", 0.52, "#5fd6ea", 0.05],
    },
    ice: {
      tint: "#8fc8ff", tintAlpha: 0.16, rim: "#e6f7ff", rimFrom: [0, -1], reflect: 0.2,
      rays: [
        [0.47, -0.02, 0.06, 0.78, 0.15, "#e6f5ff", 0.3],
        [0.5, -0.02, -0.1, 0.74, 0.1, "#e6f5ff", 0.24],
        [0.44, -0.02, 0.2, 0.7, 0.08, "#d8eeff", 0.18],
        [0.5, 0.33, 0, 0.36, 0.09, "#ffe2b0", 0.16],
      ],
      air: { color: "#ffffff", count: 14, rise: 0.05, sway: 0.03, size: 0.035, snow: true },
      grade: ["#020b1c", 0.55, "#9fd4ff", 0.06],
    },
    forge: {
      tint: "#ff8a3d", tintAlpha: 0.16, rim: "#ffb36b", rimFrom: [-1, 0], rimBoth: true, reflect: 0.12,
      rays: [
        [0.5, 0.25, 0.04, 0.48, 0.06, "#d8e4ff", 0.13],
        [0.5, 0.25, 0.22, 0.46, 0.05, "#d8e4ff", 0.09],
        [0.5, -0.02, 0.03, 0.62, 0.05, "#e6ecff", 0.08],
      ],
      air: { color: "#ff9a3c", count: 12, rise: -0.06, sway: 0.02, size: 0.035, ember: true },
      grade: ["#1e0a03", 0.55, "#ff7a2a", 0.07],
    },
    mirrors: {
      tint: "#7aa6ff", tintAlpha: 0.14, rim: "#cfe3ff", rimFrom: [-1, -1], reflect: 0.2,
      air: { color: "#cfe0ff", count: 8, rise: -0.003, sway: 0.01, size: 0.04 },
      grade: ["#030716", 0.5, "#7aa6ff", 0.04],
    },
    king: {
      tint: "#7fb8ff", tintAlpha: 0.15, rim: "#d4ecff", rimFrom: [0, -1], reflect: 0.1,
      air: { color: "#bfe0ff", count: 8, rise: -0.004, sway: 0.012, size: 0.04 },
      grade: ["#030814", 0.5, "#8dcffd", 0.04],
    },
    witch: {
      tint: "#9fd477", tintAlpha: 0.15, rim: "#dcf7b8", rimFrom: [0, -1], reflect: 0.16,
      air: { color: "#c9f29a", count: 9, rise: -0.01, sway: 0.02, size: 0.04 },
      grade: ["#071206", 0.52, "#b7e787", 0.04],
    },
    bosshall: {
      tint: "#ffb070", tintAlpha: 0.13, rim: "#ffd29a", rimFrom: [-1, -1], rimBoth: true, reflect: 0.22,
      air: { color: "#ffd8a4", count: 8, rise: -0.004, sway: 0.012, size: 0.04 },
      grade: ["#05060f", 0.5, "#7d8cff", 0.04],
    },
    colossus: {
      tint: "#ff8a3d", tintAlpha: 0.16, rim: "#ffb36b", rimFrom: [0, -1], rimBoth: true, reflect: 0.08,
      air: { color: "#ff9a3c", count: 11, rise: -0.06, sway: 0.02, size: 0.035, ember: true },
      grade: ["#1a0802", 0.55, "#ff7a2a", 0.06],
    },
  };
  const light = { id: look, ...lightProfiles[look] };

  function drawRays(t) {
    if (!light.rays || !box) return;
    const { left, top, pw, ph } = box;
    CastleScenes["atmos-fx"].shafts(
      ctx,
      light.rays.map(([u, v, angle, length, width, color, alpha]) => ({
        x: left + u * pw,
        y: top + v * ph,
        angle,
        length: length * ph,
        width: width * pw,
        color,
        alpha: alpha * 1.3,
      })),
      t,
    );
  }
  // Fog that drifts across the room, behind Coji and the props.
  // [v (plate), height (plate heights), speed (screens per second), alpha, colour]
  const fogBands = {
    bells: [[0.6, 0.12, 0.006, 0.35, "#ffd8b0"], [0.3, 0.2, -0.004, 0.18, "#ffcf9a"]],
    sluice: [[0.37, 0.14, 0.01, 0.55, "#cdeffa"], [0.78, 0.12, -0.012, 0.4, "#bfe8f2"], [0.55, 0.1, 0.007, 0.3, "#d6f2ff"]],
    ice: [[0.56, 0.1, 0.012, 0.75, "#dceeff"], [0.66, 0.09, -0.009, 0.55, "#e4f2ff"], [0.44, 0.12, 0.005, 0.35, "#cfe4ff"]],
    forge: [[0.2, 0.22, 0.008, 0.28, "#9c8678"], [0.68, 0.1, -0.006, 0.25, "#d9a888"]],
    king: [[0.66, 0.12, 0.007, 0.45, "#c8dcff"], [0.78, 0.1, -0.005, 0.3, "#b8cff5"]],
    witch: [[0.68, 0.14, 0.009, 0.55, "#c9f0a8"], [0.8, 0.1, -0.007, 0.4, "#b6e292"]],
    colossus: [[0.25, 0.24, 0.01, 0.3, "#8d7466"], [0.72, 0.1, -0.006, 0.28, "#ffb27a"]],
    bosshall: [[0.62, 0.1, 0.006, 0.35, "#cdd6ff"], [0.75, 0.08, -0.005, 0.28, "#ffd8b0"]],
  };
  function drawFog(t) {
    const bands = fogBands[look];
    if (!bands || !box) return;
    const { top, ph } = box;
    CastleScenes["atmos-fx"].fog(
      ctx,
      w(),
      bands.map(([v, height, speed, alpha, color]) => ({ y: top + v * ph, height: height * ph, speed, alpha, color })),
      t,
    );
  }

  // Air in front of everything: big, soft, out-of-focus motes close to the lens and small
  // sharp ones further away. Near motes slide with the camera much more than the plate.
  let bokeh = null;
  function soft(color) {
    const key = "soft" + color;
    if (lights.has(key)) return lights.get(key);
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, color);
    r.addColorStop(0.55, color + "66");
    r.addColorStop(0.8, color + "1c");
    r.addColorStop(1, color + "00");
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    lights.set(key, c);
    return c;
  }
  function drawAir(t, dt) {
    const air = light.air;
    if (!air) return;
    if (!bokeh)
      bokeh = Array.from({ length: air.count }, (_, i) => ({
        u: (i * 0.618 + 0.13) % 1,
        v: (i * 0.383 + 0.29) % 1,
        z: 0.35 + ((i * 0.71) % 1) * 0.65, // 0 = far and sharp, 1 = at the lens
        phase: i * 2.1,
      }));
    const width = w(),
      height = h();
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const sprite = soft(air.color);
    for (const m of bokeh) {
      if (!reduced.matches) {
        m.v += air.rise * dt * (0.6 + m.z);
        m.u += Math.sin(t * 0.4 + m.phase) * air.sway * dt;
        if (m.v > 1.1) m.v -= 1.2;
        if (m.v < -0.1) m.v += 1.2;
        m.u = ((m.u % 1) + 1) % 1;
      }
      const size = height * air.size * (0.35 + m.z * 1.1);
      const x = m.u * (width + size * 2) - size;
      const y = m.v * height;
      const twinkle = air.ember ? 0.55 + 0.45 * Math.sin(t * 3.1 + m.phase * 3) : 0.75 + 0.25 * Math.sin(t * 0.8 + m.phase);
      ctx.globalAlpha = (air.snow ? 0.38 : air.ember ? 0.42 : 0.2) * twinkle * (1.1 - m.z * 0.55);
      ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    }
    ctx.restore();
  }

  // Colour grade + vignette, cached per viewport: pulls Coji, props and plate into one light.
  let gradeCache = null;
  function drawGrade() {
    if (!light.grade) return;
    const width = Math.ceil(w()),
      height = Math.ceil(h());
    if (!gradeCache || gradeCache.width !== width || gradeCache.height !== height) {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const g = c.getContext("2d");
      const [shade, depthAlpha, warm, warmAlpha] = light.grade;
      const r = Math.hypot(width, height) / 2;
      const v = g.createRadialGradient(width / 2, height * 0.46, r * 0.35, width / 2, height * 0.5, r * 1.05);
      v.addColorStop(0, shade + "00");
      v.addColorStop(0.62, shade + "40");
      v.addColorStop(1, shade + Math.round(depthAlpha * 255).toString(16).padStart(2, "0"));
      g.fillStyle = v;
      g.fillRect(0, 0, width, height);
      // A faint wash of the room's light colour from above.
      const top = g.createLinearGradient(0, 0, 0, height * 0.7);
      top.addColorStop(0, warm + Math.round(warmAlpha * 255).toString(16).padStart(2, "0"));
      top.addColorStop(1, warm + "00");
      g.fillStyle = top;
      g.fillRect(0, 0, width, height);
      gradeCache = c;
    }
    ctx.drawImage(gradeCache, 0, 0, w(), h());
  }

  // Coji's magic reaches the instruments: a spark leaves his hand and arcs to the target.
  const sparks = [];
  function spark(x, y, color = "#bfe9ff", onArrive, seconds = 0.3) {
    const p = project(player.x, player.y, player.z || 0);
    const from = { x: p.x, y: p.y - heroSize() * 0.62 };
    if (!game.effects() || reduced.matches) {
      onArrive?.();
      return;
    }
    sparks.push({ from, to: { x, y }, color, t: 0, seconds, onArrive, trail: [] });
  }
  function drawSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.t += dt / s.seconds;
      const q = Math.min(1, s.t);
      const ease = q * q * (3 - 2 * q);
      const lift = Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y) * 0.22;
      const x = s.from.x + (s.to.x - s.from.x) * ease;
      const y = s.from.y + (s.to.y - s.from.y) * ease - Math.sin(Math.PI * q) * lift;
      s.trail.push({ x, y });
      if (s.trail.length > 9) s.trail.shift();
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      s.trail.forEach((pt, n) => {
        const k = (n + 1) / s.trail.length;
        glow(pt.x, pt.y, 10 * k, 10 * k, s.color, 0.55 * k);
      });
      glow(x, y, 16, 16, "#ffffff", 0.9);
      glow(x, y, 34, 34, s.color, 0.7);
      ctx.restore();
      if (s.t >= 1) {
        sparks.splice(i, 1);
        glow(s.to.x, s.to.y, 60, 60, s.color, 0.8);
        s.onArrive?.();
      }
    }
  }

  let lastForeground = -1;
  function foreground() {
    const t = game.time();
    const dt = lastForeground < 0 ? 0 : Math.min(0.1, Math.max(0, t - lastForeground));
    lastForeground = t;
    drawSparks(dt);
    if (!game.effects()) return;
    box || plateBox();
    drawRays(reduced.matches ? 0 : t);
    drawAir(t, dt);
    drawGrade();
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
  const base = { heroSize, project, ground, hitHero, quiet, light, foreground, cameraOffset: () => ({ x: 0, y: 0 }) };
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
    plate: () => box || plateBox(),
    platePoint,
    spark,
    light,
    notice: (text) => hint(text),
  };
};
