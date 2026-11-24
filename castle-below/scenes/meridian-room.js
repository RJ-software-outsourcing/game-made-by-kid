// Coordinates on the two photographed plates. The outlet is in the armillary's
// brass foot; the near limit is the viewer's edge of the inlaid floor circle.
CastleScenes["meridian-room"] = (() => {
  const plates = {
    nave: {
      image: "mirrorsRoom",
      aspect: 1.5,
      outlet: [0.494, 0.435],
      near: 0.73,
      orb: [0.495, 0.317],
      moon: [0.298, 0.061],
      // Moonbeams through the broken dome: [u, v, angle, length, width]
      beams: [
        [0.31, 0.07, 0.92, 0.3, 0.05],
        [0.33, 0.065, 1.02, 0.36, 0.075],
        [0.35, 0.07, 1.12, 0.3, 0.05],
      ],
      // The comet hangs still in the open sky; the crystal's sky aims are measured around it.
      comet: [0.5, 0.15],
      skyAims: [[0.3, 0.05], "comet", [0.66, 0.03], [0.84, 0.13]],
      sky: 0.27,
      lamps: [
        [0.052, 0.323],
        [0.166, 0.335],
        [0.836, 0.337],
        [0.947, 0.315],
      ],
    },
    tower: {
      image: "meridianTower",
      aspect: 2 / 3,
      outlet: [0.492, 0.478],
      near: 0.722,
      orb: [0.493, 0.382],
      moon: [0.295, 0.105],
      beams: [
        [0.31, 0.11, 0.85, 0.24, 0.07],
        [0.33, 0.105, 0.97, 0.28, 0.1],
      ],
      comet: [0.52, 0.17],
      skyAims: [[0.28, 0.08], "comet", [0.7, 0.06], [0.88, 0.16]],
      sky: 0.3,
      lamps: [
        [0.024, 0.33],
        [0.16, 0.352],
        [0.366, 0.358],
        [0.63, 0.357],
        [0.84, 0.353],
        [0.965, 0.329],
      ],
    },
  };
  const beamHeight = () => CastleScenes["meridian-models"].beamHeight;
  const colors = ["#ffd28a", "#b9e4ff", "#93f2dc"];
  function camera(w, h, lane = 4.5, depth = 0.5) {
    const plate = w / h < 0.86 ? plates.tower : plates.nave;
    const ph = Math.max(h, w / plate.aspect) * (1.045 + 0.025 * Math.max(0, depth - 0.5)),
      pw = ph * plate.aspect;
    const margin = (pw - w) * 0.5;
    const left = -margin + Math.max(-margin, Math.min(margin, (4.5 - lane) * w * 0.01)),
      top = (h - ph) * 0.49;
    const unit = Math.min(w * (plate === plates.tower ? 1.24 : 1.02), pw * 0.99);
    const platePoint = ([u, v]) => ({ x: left + pw * u, y: top + ph * v });
    const outlet = platePoint(plate.outlet);
    const farDepth = 0.035,
      nearDepth = 0.6,
      convergence = 0.64;
    const farGround = outlet.y + (beamHeight() * unit) / (1 + convergence);
    const travel = Math.min(top + ph * plate.near - farGround, unit * 0.33);
    function project(p, z = 0) {
      const depth = (p.y - farDepth) / (nearDepth - farDepth);
      const k = 1 / (1 + convergence * (1 - depth));
      return {
        x: outlet.x + (p.x - 0.5) * unit * k,
        y: farGround + travel * depth * k - z * unit * k,
        size: unit * k,
      };
    }
    return { plate, pw, ph, left, top, platePoint, project };
  }
  function create(s, layout, mirrorHalfWidth) {
    const { ctx: g, glow } = s;
    const models = CastleScenes["meridian-renderer"].create(s, layout);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const view = () => camera(s.w(), s.h(), s.player.y, s.player.x);
    // The dome's iron ribs and walls, cut from the photograph wherever it is not sky, so
    // a comet can pass behind them. Built once per plate; skipped if pixels cannot be read.
    const ribs = new Map();
    function ribLayer(p) {
      if (ribs.has(p)) return ribs.get(p);
      let layer = null;
      try {
        const img = s.sprite(p.image),
          w = img.width,
          h = Math.ceil(img.height * p.sky);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const q = c.getContext("2d");
        q.drawImage(img, 0, 0, w, h, 0, 0, w, h);
        const data = q.getImageData(0, 0, w, h);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
          const r = px[i],
            gg = px[i + 1],
            b = px[i + 2];
          const lum = 0.3 * r + 0.59 * gg + 0.11 * b;
          // Night sky is blue-dominant or nearly black; stars and the moon are neutral highlights.
          const sky = (b >= r + 6 && lum < 150) || lum < 14 || (lum > 170 && Math.abs(r - b) < 25);
          px[i + 3] = sky ? 0 : 255;
        }
        q.putImageData(data, 0, 0);
        layer = c;
      } catch (error) {
        layer = null;
      }
      ribs.set(p, layer);
      return layer;
    }
    // The armillary crystal: aim 0 feeds the floor port; the others send its beam into the sky.
    const crystal = {
      aim: 0,
      shown: null,
      stops: () => 1 + view().plate.skyAims.length,
      target(c = view()) {
        const p = c.plate,
          orb = c.platePoint(p.orb);
        const pt = this.aim === 0 ? c.project(layout.lamp, beamHeight()) : c.platePoint(p.skyAims[this.aim - 1] === "comet" ? p.comet : p.skyAims[this.aim - 1]);
        return Math.atan2(pt.y - orb.y, pt.x - orb.x);
      },
      settled: () => crystal.shown !== null && Math.abs(crystal.shown - crystal.target()) < 0.012,
      feedsPort: () => crystal.aim === 0 && crystal.settled(),
      onComet: () => crystal.aim > 0 && view().plate.skyAims[crystal.aim - 1] === "comet" && crystal.settled(),
    };
    function updateCrystal(dt) {
      const goal = crystal.target();
      if (crystal.shown === null) crystal.shown = goal;
      let d = goal - crystal.shown;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      crystal.shown += Math.max(-dt * 2.2, Math.min(dt * 2.2, d));
    }
    function hitCrystal(pos) {
      const c = view(),
        orb = c.platePoint(c.plate.orb);
      return Math.hypot(pos.x - orb.x, pos.y - orb.y) < c.ph * 0.1;
    }
    // A comet that stays put but is never still. The body is painted once, like a long
    // exposure: hundreds of faint strands fan and curve into the dust tail, a few hundred
    // straight blue strands make the ion tail, then the whole is softened. Coma breathing,
    // shimmer and streamers flowing outward are animated on top.
    let cometBody = null;
    function paintComet() {
      const W = 640,
        H = 320,
        hx = 48,
        hy = H * 0.5;
      const sharp = document.createElement("canvas");
      sharp.width = W;
      sharp.height = H;
      const q = sharp.getContext("2d");
      let seed = 11;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
      q.lineCap = "round";
      // Dust tail: wide, curved (it lags behind the comet's path), warm white.
      for (let i = 0; i < 700; i++) {
        const spread = gauss() * 0.16,
          len = W * (0.35 + 0.6 * rnd() ** 0.6);
        const bend = 0.18 + 0.12 * rnd();
        const ex = hx + Math.cos(spread) * len,
          ey = hy + Math.sin(spread) * len + len * bend * 0.5;
        q.strokeStyle = "rgba(255,242,222," + (0.018 + 0.035 * rnd()) + ")";
        q.lineWidth = 1 + rnd() * 2.2;
        q.beginPath();
        q.moveTo(hx, hy);
        q.quadraticCurveTo(hx + (ex - hx) * 0.55, hy + (ey - hy) * 0.25, ex, ey);
        q.stroke();
      }
      // Ion tail: narrow, straight, blue, slightly off the dust tail.
      for (let i = 0; i < 260; i++) {
        const spread = -0.06 + gauss() * 0.02,
          len = W * (0.55 + 0.42 * rnd());
        q.strokeStyle = "rgba(140,190,255," + (0.02 + 0.04 * rnd()) + ")";
        q.lineWidth = 0.8 + rnd() * 1.4;
        q.beginPath();
        q.moveTo(hx, hy);
        q.lineTo(hx + Math.cos(spread) * len, hy + Math.sin(spread) * len);
        q.stroke();
      }
      // Soften: shrink and enlarge (a blur that works in every browser), then keep a little detail.
      const small = document.createElement("canvas");
      small.width = W / 5;
      small.height = H / 5;
      const sq = small.getContext("2d");
      sq.imageSmoothingQuality = "high";
      sq.drawImage(sharp, 0, 0, small.width, small.height);
      const body = document.createElement("canvas");
      body.width = W;
      body.height = H;
      const b = body.getContext("2d");
      b.imageSmoothingQuality = "high";
      b.drawImage(small, 0, 0, W, H);
      b.globalAlpha = 0.45;
      b.drawImage(sharp, 0, 0);
      b.globalAlpha = 1;
      // Coma: a small green-white glow around the nucleus.
      const coma = b.createRadialGradient(hx, hy, 0, hx, hy, 46);
      coma.addColorStop(0, "rgba(255,255,255,1)");
      coma.addColorStop(0.12, "rgba(235,255,245,.9)");
      coma.addColorStop(0.4, "rgba(170,240,215,.35)");
      coma.addColorStop(1, "rgba(150,220,210,0)");
      b.fillStyle = coma;
      b.fillRect(0, 0, W, H);
      return { canvas: body, W, H, hx, hy };
    }
    let cometFlare = 0;
    function comet(c, p, t, dt) {
      cometFlare = crystal.onComet() ? Math.min(1, cometFlare + dt * 1.5) : Math.max(0, cometFlare - dt * 0.8);
      cometBody ??= paintComet();
      const head = c.platePoint(p.comet),
        u = c.ph;
      const tailDir = -0.4; // away from the moon, rising gently to the right across open sky
      const scale = (u * 0.36) / cometBody.W;
      const breathe = 0.88 + 0.08 * Math.sin(t * 1.1) + 0.04 * Math.sin(t * 3.3);
      g.save();
      g.globalCompositeOperation = "screen";
      g.translate(head.x, head.y);
      g.rotate(tailDir);
      g.scale(scale, scale);
      g.globalAlpha = Math.min(1, 0.85 * breathe + cometFlare * 0.3);
      g.drawImage(cometBody.canvas, -cometBody.hx, -cometBody.hy);
      // Shimmer: the same body, nudged, fading in and out, so the tail seems to ripple.
      g.globalAlpha = 0.18 + 0.12 * Math.sin(t * 0.7);
      g.drawImage(cometBody.canvas, -cometBody.hx + 6 * Math.sin(t * 0.5), -cometBody.hy + 3 * Math.cos(t * 0.6));
      // Streamers drifting out along the ion tail.
      for (let k = 0; k < 6; k++) {
        const f = (t * 0.05 + k / 6) % 1,
          x = cometBody.W * (0.08 + 0.85 * f);
        const ion = g.createLinearGradient(x, 0, x + 70, 0);
        ion.addColorStop(0, "rgba(150,200,255,0)");
        ion.addColorStop(0.5, "rgba(170,210,255," + (0.22 * (1 - f)).toFixed(3) + ")");
        ion.addColorStop(1, "rgba(150,200,255,0)");
        g.globalAlpha = 1;
        g.fillStyle = ion;
        g.fillRect(x, -cometBody.H * 0.06 + Math.sin(k * 2.1 + t * 0.4) * 3, 70, 4);
      }
      g.restore();
      glow(head.x, head.y, u * 0.008, u * 0.008, "#ffffff", 0.9 + 0.1 * cometFlare);
      if (cometFlare > 0) {
        glow(head.x, head.y, u * 0.05 * cometFlare, u * 0.05 * cometFlare, "#d8f6ff", 0.6 * cometFlare);
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4 + t * 0.3;
          glow(head.x + Math.cos(a) * u * 0.05 * cometFlare, head.y + Math.sin(a) * u * 0.05 * cometFlare, u * 0.006, u * 0.006, "#e8f6ff", cometFlare * 0.7);
        }
      }
    }
    // The crystal's beam when it points into the sky.
    function skyBeam(c) {
      if (crystal.aim === 0 && crystal.feedsPort()) return;
      const orb = c.platePoint(c.plate.orb),
        a = crystal.shown,
        L = c.ph * 0.9;
      const end = { x: orb.x + Math.cos(a) * L, y: orb.y + Math.sin(a) * L };
      g.save();
      g.globalCompositeOperation = "screen";
      g.lineCap = "round";
      line(orb, end, "rgba(120,190,255,.14)", Math.max(8, c.ph * 0.02));
      line(orb, end, "rgba(170,220,255,.32)", Math.max(3, c.ph * 0.008));
      line(orb, end, "rgba(240,250,255,.85)", Math.max(1.5, c.ph * 0.003));
      g.restore();
    }
    let lastRoomTime = -1;
    function drawRoom() {
      const c = view(),
        p = c.plate;
      g.drawImage(s.sprite(p.image), c.left, c.top, c.pw, c.ph);
      if (!s.game.effects()) return;
      const t = reduced.matches ? 0 : s.game.time();
      const layer = ribLayer(p);
      const dt = lastRoomTime < 0 ? 0 : Math.max(0, Math.min(0.1, t - lastRoomTime));
      lastRoomTime = t;
      comet(c, p, t, dt);
      skyBeam(c);
      // The dome's iron ribs pass in front of the comet and the crystal's sky beam.
      if (layer) g.drawImage(layer, c.left, c.top, c.pw, c.ph * p.sky);
      CastleScenes["atmos-fx"].shafts(
        g,
        p.beams.map(([u, v, angle, length, width]) => {
          const at = c.platePoint([u, v]);
          return { x: at.x, y: at.y, angle, length: length * c.ph, width: width * c.pw, color: "#c6defb", alpha: 0.2 };
        }),
        t,
      );
      const moon = c.platePoint(p.moon);
      glow(moon.x, moon.y, c.ph * 0.089, c.ph * 0.079, "#b7daff", 0.25 + 0.06 * Math.sin(t * 0.72));
      p.lamps.forEach((l, i) => {
        const pos = c.platePoint(l),
          flicker = 0.62 + 0.12 * Math.sin(t * 5 + i) * Math.sin(t * 2.7 + i);
        glow(pos.x, pos.y, c.ph * 0.028, c.ph * 0.041, "#ffbe78", flicker);
      });
      // The crystal gathers energy: motes spiral in from all around, the core pulses,
      // and slow rays turn around it.
      const orb = c.platePoint(p.orb),
        R = c.ph * 0.05;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
      glow(orb.x, orb.y, R * 2.2, R * 2, "#6fb8ff", 0.22 + 0.12 * pulse);
      glow(orb.x, orb.y, R * 0.9, R * 0.85, "#dff3ff", 0.55 + 0.3 * pulse);
      if (!reduced.matches) {
        g.save();
        g.globalCompositeOperation = "screen";
        g.translate(orb.x, orb.y);
        for (let i = 0; i < 6; i++) {
          g.save();
          g.rotate(t * 0.35 + (i * Math.PI) / 3);
          const ray = g.createLinearGradient(0, 0, R * 2.4, 0);
          ray.addColorStop(0, "rgba(210,240,255," + (0.35 + 0.25 * pulse) + ")");
          ray.addColorStop(1, "rgba(160,210,255,0)");
          g.fillStyle = ray;
          g.beginPath();
          g.moveTo(0, -R * 0.06);
          g.lineTo(R * 2.4, 0);
          g.lineTo(0, R * 0.06);
          g.fill();
          g.restore();
        }
        g.restore();
        for (let i = 0; i < 22; i++) {
          const f = (t * 0.22 + i * 0.137) % 1,
            ang = i * 2.39 + f * 3.2,
            dist = R * (3.2 * (1 - f) + 0.25);
          glow(orb.x + Math.cos(ang) * dist, orb.y + Math.sin(ang) * dist * 0.7, 2.2, 2.2, "#cdeaff", Math.min(1, f * 3) * 0.85);
        }
      }
    }
    function mirrorGeometry(c, p, a) {
      const dx = Math.cos(a) * mirrorHalfWidth,
        dy = Math.sin(a) * mirrorHalfWidth;
      const l = { x: p.x - dx, y: p.y - dy },
        r = { x: p.x + dx, y: p.y + dy };
      return {
        l,
        r,
        foot: c.project(p),
        hub: c.project(p, beamHeight()),
        left: c.project(l, beamHeight()),
        right: c.project(r, beamHeight()),
      };
    }
    function pick(pos, angles) {
      const c = view();
      let best = -1,
        score = Infinity;
      layout.mounts.forEach((p, i) => {
        const { foot, hub, left, right } = mirrorGeometry(c, p, angles[i]);
        const dx = right.x - left.x,
          dy = right.y - left.y;
        const u = Math.max(
          0,
          Math.min(1, ((pos.x - left.x) * dx + (pos.y - left.y) * dy) / (dx * dx + dy * dy || 1)),
        );
        const near = Math.hypot(pos.x - left.x - u * dx, pos.y - left.y - u * dy);
        const base = Math.hypot(pos.x - foot.x, pos.y - (foot.y - 0.015 * foot.size));
        const rank = Math.min(near, base);
        if (rank < Math.max(22, hub.size * 0.037) && rank < score) {
          best = i;
          score = rank;
        }
      });
      return best;
    }
    function line(a, b, color, width) {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    }
    function draw(angles, ray, goal, stable) {
      const c = view();
      models.drawRail(c);
      const fixtures = models.frame(c, angles, ray.target);
      fixtures.forEach((f) => models.groundLight(c, f));
      const beams = [];
      const effects = s.game.effects();
      for (let i = 1; i < ray.path.length; i++) {
        const a = ray.path[i - 1],
          b = ray.path[i],
          dy = b.y - a.y;
        const fade = i === ray.path.length - 1 && ray.target < 0;
        const at = (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + dy * t });
        const start = c.project(a, beamHeight()),
          end = c.project(b, beamHeight());
        const fadeAlong = (color) => {
          if (!fade) return color;
          if (Math.hypot(end.x - start.x, end.y - start.y) < 1) return color;
          const grad = g.createLinearGradient(start.x, start.y, end.x, end.y);
          grad.addColorStop(0, color);
          grad.addColorStop(0.5, color);
          grad.addColorStop(1, "transparent");
          return grad;
        };
        const core = fadeAlong("#e4f7ff"),
          halo = fadeAlong("#80cfff70");
        if (effects) {
          const floorA = c.project(a),
            floorB = c.project(b);
          line(floorA, floorB, "#79b3d71a", Math.max(2, start.size * 0.008));
        }
        const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 1.35));
        let first = null,
          previous = start;
        for (let j = 0; j <= steps; j++) {
          const p = at(j / steps),
            screen = c.project(p, beamHeight());
          const visible = !fixtures.some((f) => f.hides(screen, p));
          if (visible && !first) first = screen;
          if (first && (!visible || j === steps)) {
            beams.push({ a: first, b: visible ? screen : previous, core, halo });
            first = null;
          }
          previous = screen;
        }
      }
      const port = c.project(layout.lamp, beamHeight());
      if (effects && crystal.feedsPort()) {
        // The crystal's light runs down into the port: a bright core, a soft halo and
        // packets of energy travelling down it.
        const orb = c.platePoint(c.plate.orb);
        const t = reduced.matches ? 0 : s.game.time();
        g.save();
        g.globalCompositeOperation = "screen";
        g.lineCap = "round";
        line(orb, port, "rgba(120,190,255,.16)", Math.max(6, c.ph * 0.016));
        line(orb, port, "rgba(160,215,255,.35)", Math.max(3, c.ph * 0.007));
        line(orb, port, "rgba(235,248,255,.9)", Math.max(1.4, c.ph * 0.0028));
        g.restore();
        for (let i = 0; i < 3; i++) {
          const f = (t * 0.9 + i / 3) % 1;
          glow(orb.x + (port.x - orb.x) * f, orb.y + (port.y - orb.y) * f, c.ph * 0.012, c.ph * 0.012, "#e6f6ff", Math.sin(Math.PI * f));
        }
        glow(port.x, port.y, c.ph * 0.03, c.ph * 0.02, "#bfe6ff", 0.7);
      }
      if (crystal.feedsPort()) glow(port.x, port.y, port.size * 0.021, port.size * 0.013, "#c0e9ff", 0.9);
      fixtures.forEach((f) => {
        f.draw();
        if (!f.mirror && ray.target === f.i) {
          const at = c.project(f.p, beamHeight());
          glow(
            at.x,
            at.y,
            f.size * 0.57,
            f.size * 0.5,
            colors[f.i],
            f.i === goal && stable > 0 ? 0.66 : 0.43,
          );
          glow(f.foot.x, f.foot.y + f.size * 0.06, f.size * 1.12, f.size * 0.15, colors[f.i], 0.27);
        }
      });
      for (const { a, b, halo, core } of beams) {
        if (effects) line(a, b, halo, Math.max(2, a.size * 0.0046));
        line(a, b, core, Math.max(1.1, a.size * 0.00155));
      }
      // Keep a contact glint on the silver itself, even when the beam is edge-on.
      ray.contacts.forEach((_, i) => {
        const point = ray.path[i + 1],
          contact = c.project(point, beamHeight());
        if (fixtures.some((f) => f.hides(contact, point))) return;
        glow(
          contact.x,
          contact.y,
          Math.max(3, contact.size * 0.009),
          Math.max(2, contact.size * 0.006),
          "#d9f7ff",
          0.85,
        );
      });
    }
    function ground(pos) {
      const rim = view().project({ x: 0.5, y: 0.6 });
      return pos.y > rim.y ? s.base.ground(pos) : null;
    }
    return { drawRoom, draw, pick, ground, crystal, updateCrystal, hitCrystal };
  }
  return { create, camera };
})();
