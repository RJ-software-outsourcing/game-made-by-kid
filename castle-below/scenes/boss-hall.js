// The Hall of Monsters: a vaulted gallery with the four boss doors set into its side walls.
// The doors are the corridor's portal paintings, drawn onto each wall in perspective.
CastleScenes["boss-hall"] = (() => {
  // Measured on trial-vault.webp: where each side wall meets the floor, near and far,
  // and the recesses (as fractions t along that line) that hold a door.
  const V = [0.5, 0.49];
  const walls = {
    left: { near: [0.13, 0.83] },
    right: { near: [0.87, 0.83] },
  };
  const slots = [
    { wall: "left", t: [0.06, 0.3] },
    { wall: "right", t: [0.06, 0.3] },
    { wall: "left", t: [0.36, 0.5] },
    { wall: "right", t: [0.36, 0.5] },
  ];
  function create(s, { doors, cleared, enter }) {
    let g = s.ctx;
    let leaving = null;
    const along = (wall, t) => {
      const n = walls[wall].near;
      return [n[0] + (V[0] - n[0]) * t, n[1] + (V[1] - n[1]) * t];
    };
    const height = (t) => 0.5 * (1 - t);
    // Screen quad of a door: near and far bottom corners and their heights.
    function quad(i) {
      const slot = slots[i],
        [t0, t1] = slot.t;
      const a = s.platePoint(...along(slot.wall, t0)),
        b = s.platePoint(...along(slot.wall, t1));
      const ph = s.plate().ph;
      return { a, b, ha: height(t0) * ph, hb: height(t1) * ph, wall: slot.wall };
    }
    // The doors never move, so their perspective strips and plaques are painted once into a
    // layer the size of the view and reused every frame (rebuilt on resize or a new clear).
    let layer = null;
    function doorLayer() {
      const key = Math.round(s.w()) + "x" + Math.round(s.h()) + ":" + doors.map((d) => +cleared.has(d.id)).join("");
      if (layer?.key === key) return layer.canvas;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const c = document.createElement("canvas");
      c.width = Math.ceil(s.w() * dpr);
      c.height = Math.ceil(s.h() * dpr);
      const main = g;
      g = c.getContext("2d");
      g.scale(dpr, dpr);
      for (let i = 0; i < doors.length; i++) paintDoor(i);
      g = main;
      layer = { key, canvas: c };
      return c;
    }
    function drawDoor(i) {
      const q = quad(i),
        cx = (q.a.x + q.b.x) / 2,
        cy = (q.a.y + q.b.y) / 2,
        ch = (q.ha + q.hb) / 2;
      s.glow(cx, cy, Math.abs(q.b.x - q.a.x) * 0.7, ch * 0.08, doors[i].color, 0.4 + 0.2 * Math.sin(s.game.time() * 1.6 + i));
      if (leaving?.i === i) s.glow(cx, cy - ch * 0.5, ch * 0.6, ch * 0.7, "#fff4d8", Math.min(1, leaving.t * 1.6));
    }
    function paintDoor(i) {
      const door = doors[i],
        q = quad(i),
        img = s.sprite("hallPortals");
      if (!img.width) return;
      const cell = img.width / 6,
        sx0 = (door.portal % 6) * cell + cell * 0.08,
        sy0 = Math.floor(door.portal / 6) * cell,
        sw = cell * 0.84;
      const strips = 28;
      // Doors nearer the camera are wider on screen; draw in vertical strips so the
      // painting recedes along the wall.
      for (let k = 0; k < strips; k++) {
        const u0 = k / strips,
          u1 = (k + 1) / strips;
        const x0 = q.a.x + (q.b.x - q.a.x) * u0,
          x1 = q.a.x + (q.b.x - q.a.x) * u1;
        const y0 = q.a.y + (q.b.y - q.a.y) * u0,
          h0 = q.ha + (q.hb - q.ha) * u0;
        const h1 = q.ha + (q.hb - q.ha) * u1;
        const h = Math.max(h0, h1);
        g.drawImage(img, sx0 + sw * u0, sy0, sw / strips + 0.5, cell, Math.min(x0, x1), y0 - h, Math.abs(x1 - x0) + 0.6, h);
      }
      // The plaque above.
      const cx = (q.a.x + q.b.x) / 2,
        cy = (q.a.y + q.b.y) / 2,
        ch = (q.ha + q.hb) / 2;
      const label = (cleared.has(door.id) ? "✓ " : "") + door.name;
      const size = Math.max(12, Math.min(18, ch * 0.075));
      g.save();
      g.font = "600 " + size + "px system-ui";
      const width = g.measureText(label).width + 18;
      g.fillStyle = "#211c1af0";
      g.fillRect(cx - width / 2, cy - ch - size * 2.2, width, size * 1.7);
      g.strokeStyle = door.color;
      g.strokeRect(cx - width / 2, cy - ch - size * 2.2, width, size * 1.7);
      g.fillStyle = "#ffe9be";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(label, cx, cy - ch - size * 1.35);
      g.restore();
    }
    function hit(pos) {
      for (let i = 0; i < doors.length; i++) {
        const q = quad(i);
        const minX = Math.min(q.a.x, q.b.x),
          maxX = Math.max(q.a.x, q.b.x);
        const u = (pos.x - q.a.x) / (q.b.x - q.a.x || 1);
        if (pos.x < minX - 6 || pos.x > maxX + 6) continue;
        const base = q.a.y + (q.b.y - q.a.y) * u,
          h = q.ha + (q.hb - q.ha) * u;
        if (pos.y <= base + 8 && pos.y >= base - h - 40) return i;
      }
      return -1;
    }
    return {
      ...s.base,
      scroll: () => "This is the hall of monsters. Read the names. Tap a door to go in.",
      begin() {},
      terminal: () => false,
      interact(pos) {
        if (leaving) return true;
        const i = hit(pos);
        if (i < 0) return false;
        const q = quad(i);
        // Coji simply walks toward the door; the doorway brightens as he reaches it.
        s.player.path = [{ x: s.player.x, y: q.wall === "left" ? 1.2 : 7.8 }];
        leaving = { i, t: 0 };
        s.tone(110, 0.9, "sine", 0.1, 70);
        return true;
      },
      update(dt) {
        if (!s.player.moving) s.player.facing = 4;
        if (leaving) {
          leaving.t += dt;
          if (leaving.t > 0.9) {
            const door = doors[leaving.i];
            leaving = null;
            enter(door);
          }
        }
      },
      draw() {
        s.drawRoom();
        g.drawImage(doorLayer(), 0, 0, s.w(), s.h());
        for (let i = 0; i < doors.length; i++) drawDoor(i);
      },
    };
  }
  return { create };
})();
