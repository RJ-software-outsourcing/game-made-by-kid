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
    function drawRoom() {
      const c = view(),
        p = c.plate;
      g.drawImage(s.sprite(p.image), c.left, c.top, c.pw, c.ph);
      if (!s.game.effects()) return;
      const t = reduced.matches ? 0 : s.game.time();
      const moon = c.platePoint(p.moon);
      glow(moon.x, moon.y, c.ph * 0.089, c.ph * 0.079, "#b7daff", 0.25 + 0.045 * Math.sin(t * 0.72));
      p.lamps.forEach((l, i) => {
        const pos = c.platePoint(l),
          flicker = 0.62 + 0.12 * Math.sin(t * 5 + i) * Math.sin(t * 2.7 + i);
        glow(pos.x, pos.y, c.ph * 0.028, c.ph * 0.041, "#ffbe78", flicker);
      });
      const orb = c.platePoint(p.orb);
      glow(orb.x, orb.y, c.ph * 0.038, c.ph * 0.033, "#9fd8ff", 0.49 + 0.1 * Math.cos(t * 1.8));
      if (!reduced.matches)
        for (let i = 0; i < 15; i++) {
          const f = (t * 0.045 + i * 0.371) % 1;
          const pos = c.platePoint([
            p.orb[0] + ((i % 5) - 2) * 0.025 + 0.018 * Math.sin(4 * f + i),
            p.orb[1] + 0.09 * (0.5 - f),
          ]);
          glow(pos.x, pos.y, 1.4, 1.4, "#c4e9ff", Math.sin(Math.PI * f) * 0.55);
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
      if (effects) {
        const orb = c.platePoint(c.plate.orb);
        const light = g.createLinearGradient(orb.x, orb.y, port.x, port.y);
        light.addColorStop(0, "#afdfff70");
        light.addColorStop(0.35, "#9bd5ff12");
        light.addColorStop(0.84, "#92ceff36");
        light.addColorStop(1, "#bde3ff99");
        line(orb, port, light, Math.max(1, c.ph * 0.0019));
      }
      glow(port.x, port.y, port.size * 0.021, port.size * 0.013, "#c0e9ff", 0.9);
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
    return { drawRoom, draw, pick, ground };
  }
  return { create, camera };
})();
