// Two small games that share the craft rooms' scroll, stage and victory flow.
//
// The Lookout: Coji looks out over the town from the bell tower. Press and hold to raise
// the telescope, drag to look around, and press "Found it!" when the clue's thing is in the
// middle of the lens. Art and object positions live in LOOKOUT_ART so a new panorama can be
// dropped in without touching the game.
//
// The Treasure Grabber: a brass-and-glass cabinet with a real chain and hook. Tap inside
// the cabinet to slide the hook, press GRAB to lower it; it catches a prize only when it is
// right over the prize's loop. The scroll says what the prize does, never its name.
CastleScenes["annex-games"] = (() => {
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

  function wrap(hint, result, setup) {
    return {
      hint,
      result,
      create(s, finish) {
        let ending = -1,
          settled = false,
          started = false;
        const complete = () => {
          if (ending >= 0) return;
          ending = 0;
          s.game.stop();
          s.chime(523);
          s.tone(784, 0.8, "sine", 0.13, 784, 0.16);
          s.hint(result);
        };
        const game = setup(s, complete);
        return {
          ...s.base,
          scroll: () => game.scroll(),
          begin() {
            started = true;
            game.begin?.();
          },
          terminal: () => ending >= 0,
          interact(pos) {
            if (started && ending < 0) game.tap?.(pos);
            return true;
          },
          update(dt) {
            if (ending >= 0) {
              ending += dt;
              if (ending >= 1.15 && !settled) {
                settled = true;
                finish();
              }
              return;
            }
            if (started) game.update(dt);
            if (!s.player.moving) s.player.facing = 4;
          },
          draw() {
            s.drawRoom();
            game.draw?.();
          },
          shadeForeground: () => game.overlay?.(),
          quiet() {
            s.base.quiet();
            game.quiet?.();
          },
        };
      },
    };
  }

  // A round brass button drawn like a machined dial, with engraved lettering.
  function brassButton(g, x, y, r, label, pressed, glow) {
    g.save();
    g.fillStyle = "rgba(0,0,0,.5)";
    g.beginPath();
    g.arc(x + r * 0.06, y + r * 0.12, r * 1.04, 0, Math.PI * 2);
    g.fill();
    const rim = g.createLinearGradient(x - r, y - r, x + r, y + r);
    rim.addColorStop(0, "#f1d68f");
    rim.addColorStop(0.5, "#9a7335");
    rim.addColorStop(1, "#3c2a10");
    g.fillStyle = rim;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    const face = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 0.86);
    face.addColorStop(0, pressed ? "#b8913f" : "#e7c674");
    face.addColorStop(1, pressed ? "#5a4018" : "#8a6428");
    g.fillStyle = face;
    g.beginPath();
    g.arc(x, y + (pressed ? r * 0.04 : 0), r * 0.84, 0, Math.PI * 2);
    g.fill();
    if (glow) {
      g.globalCompositeOperation = "screen";
      g.fillStyle = "rgba(255,226,150,.25)";
      g.beginPath();
      g.arc(x, y, r * 1.2, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = "source-over";
    }
    g.font = "800 " + Math.max(11, r * 0.36) + "px Georgia,serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "rgba(255,240,200,.55)";
    g.fillText(label, x + 1, y + 1.5 + (pressed ? r * 0.04 : 0));
    g.fillStyle = "#2a1c08";
    g.fillText(label, x, y + (pressed ? r * 0.04 : 0));
    g.restore();
  }

  // ------------------------------------------------------------------ lookout
  // Things to find, measured on the bell-tower photograph (u, v of the source image, radius
  // in image widths). Replace this table together with the room image to change the view.
  const LOOKOUT_ART = {
    castle: [0.525, 0.44, 0.035],
    spireL: [0.217, 0.445, 0.018],
    spireR: [0.783, 0.445, 0.018],
    bellsL: [0.215, 0.335, 0.03],
    bellsR: [0.785, 0.335, 0.03],
    wallLampL: [0.116, 0.255, 0.025],
    wallLampR: [0.884, 0.255, 0.025],
    floorLamp: [0.03, 0.56, 0.032],
    gearL: [0.135, 0.5, 0.04],
    gearR: [0.865, 0.5, 0.04],
    ropeL: [0.13, 0.75, 0.04],
    ropeBig: [0.045, 0.84, 0.05],
    ropeR: [0.845, 0.74, 0.04],
    barrel: [0.89, 0.665, 0.035],
    blanket: [0.95, 0.64, 0.04],
    chest: [0.055, 0.68, 0.04],
    leafA: [0.16, 0.875, 0.025],
    leafB: [0.205, 0.79, 0.022],
  };
  const lookout = wrap("Press and hold to look through the telescope.", "You found them all!", (s, complete) => {
    const rule = s.rule,
      canvas = s.game.canvas,
      g = s.ctx;
    const MAG = 2.6;
    let round = 0,
      scope = false,
      raise = 0,
      lens = { x: 0, y: 0 },
      press = null,
      found = -1,
      wrong = 0,
      pressedButton = null;
    const current = () => rule.rounds[round];
    const lensR = () => Math.min(s.w(), s.h()) * 0.3;
    const buttons = () => {
      const r = Math.max(34, Math.min(48, s.h() * 0.06));
      return {
        found: { x: r + 18, y: s.h() - r - 22, r, label: "Found it!" },
        lower: { x: r * 2.9 + 18, y: s.h() - r * 0.8 - 22, r: r * 0.68, label: "Lower" },
      };
    };
    const inside = (p, b) => Math.hypot(p.x - b.x, p.y - b.y) < b.r;
    function point(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    // Long press raises the telescope; while it is up, dragging moves the lens.
    function down(e) {
      if (!started()) return;
      const p = point(e);
      if (scope) {
        const b = buttons();
        if (inside(p, b.found)) return (pressedButton = "found");
        if (inside(p, b.lower)) return (pressedButton = "lower");
        press = { drag: true };
        lens = p;
        return;
      }
      press = { at: performance.now(), p };
    }
    function move(e) {
      if (!press) return;
      const p = point(e);
      if (scope && press.drag) lens = p;
      else if (!scope && Math.hypot(p.x - press.p.x, p.y - press.p.y) > 24) press = null;
    }
    function up() {
      if (pressedButton) {
        const which = pressedButton;
        pressedButton = null;
        if (which === "found") check();
        else {
          scope = false;
          s.hint("Press and hold to look again.");
        }
      }
      press = null;
    }
    let isStarted = false;
    const started = () => isStarted;
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    // The lens centre, in source-image coordinates. When a narrow screen crops the photo,
    // the screen's edges reach the photo's edges, so nothing in the view is out of reach.
    function aimed() {
      const b = s.plate();
      const u = b.pw > s.w() + 1 ? lens.x / s.w() : (lens.x - b.left) / b.pw;
      const v = b.ph > s.h() + 1 ? lens.y / s.h() : (lens.y - b.top) / b.ph;
      return { u: clamp(u), v: clamp(v) };
    }
    function check() {
      const { u, v } = aimed(),
        aspect = s.plate().ph / s.plate().pw;
      const hit = current().find.some((id) => {
        const [x, y, r] = LOOKOUT_ART[id];
        return Math.hypot(u - x, (v - y) * aspect) < r * 1.25;
      });
      if (hit) {
        found = 0.9;
        s.chime(660);
        s.hint("You found it!");
      } else {
        wrong = 0.5;
        s.tone(160, 0.35, "triangle", 0.1, 100);
        s.hint("Not that. Read the clue again.");
      }
    }
    return {
      scroll: () => (rule.perRound ? current().line : rule.text),
      begin() {
        isStarted = true;
        s.hint("Press and hold to look through the telescope.");
      },
      update(dt) {
        raise = clamp(raise + (scope ? dt : -dt) * 3);
        wrong = Math.max(0, wrong - dt);
        if (press && !scope && press.at && performance.now() - press.at > 380) {
          scope = true;
          lens = press.p;
          press = { drag: true };
          s.tone(220, 0.4, "sine", 0.06, 440);
          s.hint("Move the lens. Press Found it! when you see it.");
        }
        if (found > 0 && (found -= dt) <= 0) {
          found = -1;
          scope = false;
          round++;
          if (round === rule.rounds.length) return complete();
          if (rule.perRound) s.notice(current().line);
          s.hint("Clue " + (round + 1) + " of " + rule.rounds.length);
        }
      },
      overlay() {
        if (raise <= 0) return;
        const R = lensR() * (0.6 + 0.4 * raise),
          b = s.plate(),
          img = s.sprite(s.level.id + "Room"),
          t = s.game.time();
        const k = img.width / b.pw;
        const aim = aimed();
        const sx = aim.u * img.width,
          sy = aim.v * img.height,
          sr = (R / MAG) * k;
        g.save();
        // Darken the room around the lens, as through a telescope tube.
        g.globalAlpha = raise;
        g.fillStyle = "rgba(4,3,6,.72)";
        g.beginPath();
        g.rect(0, 0, s.w(), s.h());
        g.arc(lens.x, lens.y, R * 1.06, 0, Math.PI * 2, true);
        g.fill("evenodd");
        // The magnified view.
        g.save();
        g.beginPath();
        g.arc(lens.x, lens.y, R, 0, Math.PI * 2);
        g.clip();
        g.drawImage(img, sx - sr, sy - sr, sr * 2, sr * 2, lens.x - R, lens.y - R, R * 2, R * 2);
        // Lens edge: dark falloff and a cool glass sheen.
        const fall = g.createRadialGradient(lens.x, lens.y, R * 0.55, lens.x, lens.y, R);
        fall.addColorStop(0, "rgba(0,0,0,0)");
        fall.addColorStop(1, "rgba(0,0,0,.75)");
        g.fillStyle = fall;
        g.fillRect(lens.x - R, lens.y - R, R * 2, R * 2);
        g.globalCompositeOperation = "screen";
        const glare = g.createLinearGradient(lens.x - R, lens.y - R, lens.x + R * 0.2, lens.y + R * 0.2);
        glare.addColorStop(0, "rgba(255,255,255,.18)");
        glare.addColorStop(0.35, "rgba(255,255,255,0)");
        g.fillStyle = glare;
        g.fillRect(lens.x - R, lens.y - R, R * 2, R * 2);
        if (found > 0) s.glow(lens.x, lens.y, R * 0.5, R * 0.5, "#fff2c0", found);
        if (wrong > 0) s.glow(lens.x, lens.y, R * 0.7, R * 0.7, "#ff7a6e", wrong * 0.6);
        g.restore();
        // Fine cross-hair etched in the eyepiece.
        g.strokeStyle = "rgba(255,240,210,.35)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(lens.x - R * 0.12, lens.y);
        g.lineTo(lens.x + R * 0.12, lens.y);
        g.moveTo(lens.x, lens.y - R * 0.12);
        g.lineTo(lens.x, lens.y + R * 0.12);
        g.stroke();
        // Brass eyepiece rim.
        const rim = g.createLinearGradient(lens.x - R, lens.y - R, lens.x + R, lens.y + R);
        rim.addColorStop(0, "#f0d48c");
        rim.addColorStop(0.5, "#8a6428");
        rim.addColorStop(1, "#2e200c");
        g.strokeStyle = rim;
        g.lineWidth = Math.max(6, R * 0.07);
        g.beginPath();
        g.arc(lens.x, lens.y, R + g.lineWidth * 0.45, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = "rgba(255,240,200,.4)";
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(lens.x, lens.y, R + Math.max(6, R * 0.07) * 0.85, Math.PI * 1.1, Math.PI * 1.6);
        g.stroke();
        g.restore();
        // Buttons exist only while the telescope is up.
        if (scope) {
          const bt = buttons();
          brassButton(g, bt.found.x, bt.found.y, bt.found.r, bt.found.label, pressedButton === "found", 0.5 + 0.5 * Math.sin(t * 3) > 0.5);
          brassButton(g, bt.lower.x, bt.lower.y, bt.lower.r, bt.lower.label, pressedButton === "lower", false);
        }
      },
      quiet() {
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      },
    };
  });

  // --------------------------------------------------------------------- claw
  // Prize photographs and where their loop is (fraction of the drawn height from the top).
  const PRIZES = {
    key: { sprite: "offeringKey", h: 0.11, loop: 0.2 },
    crystal: { sprite: "offeringCrystal", h: 0.17, loop: 0.1 },
    bear: { sprite: "bebear", h: 0.22, loop: 0.08 },
    bell: { atlas: 0, h: 0.17, loop: 0.06 },
    mirror: { atlas: 2, h: 0.19, loop: 0.08 },
    lamp: { atlas: 8, h: 0.17, loop: 0.2 },
  };
  const claw = wrap("Tap to move the hook. Press GRAB.", "You won all the prizes!", (s, complete) => {
    const rule = s.rule,
      g = s.ctx;
    const order = rule.order;
    let round = 0,
      hookX = 0.5,
      targetX = 0.5,
      state = "idle",
      t0 = 0,
      held = null,
      pressed = 0,
      message = 0;
    const taken = new Set();
    const current = () => rule.rounds[round];
    // Cabinet box on screen.
    function cab() {
      const w = Math.min(s.w() * 0.62, s.h() * 0.95),
        h = Math.min(s.h() * 0.62, w * 0.82);
      return { x: (s.w() - w) / 2, y: s.h() * 0.1, w, h };
    }
    const floorY = (c) => c.y + c.h * 0.86;
    const slotX = (c, i) => c.x + c.w * (0.12 + (i * 0.76) / (order.length - 1));
    const prizeSize = (c, id) => c.h * PRIZES[id].h;
    function sprite(id) {
      const p = PRIZES[id];
      if (p.sprite) {
        const img = s.sprite(p.sprite);
        return { img, sx: 0, sy: 0, sw: img.width, sh: img.height };
      }
      const img = s.sprite("annexInstruments"),
        cell = img.width / 3;
      return { img, sx: (p.atlas % 3) * cell, sy: Math.floor(p.atlas / 3) * cell, sw: cell, sh: cell };
    }
    function drawPrize(id, x, base, c, swing = 0) {
      const sp = sprite(id);
      if (!sp.img.width) return;
      const h = prizeSize(c, id),
        w = (h * sp.sw) / sp.sh;
      s.shadow(x, base, w * 0.45, h * 0.07, 0.5);
      g.save();
      g.translate(x, base - h);
      g.rotate(swing);
      g.drawImage(sp.img, sp.sx, sp.sy, sp.sw, sp.sh, -w / 2, 0, w, h);
      g.restore();
    }
    // The photographed chain and hook, hanging from the trolley.
    function hook(c, x, depth) {
      const img = s.sprite("royalFixtures");
      if (!img.width) return;
      const k = img.width / 1200,
        sx = 168 * k,
        sw = 64 * k,
        link = 140 * k,
        linkTop = 420 * k,
        hookTop = 690 * k,
        hookH = 106 * k;
      const width = c.w * 0.05,
        scale = width / sw,
        hookDraw = hookH * scale;
      const top = c.y + c.h * 0.08,
        bottom = top + depth;
      g.save();
      g.beginPath();
      g.rect(x - width, top, width * 2, Math.max(0, bottom - top - hookDraw * 0.85 + 1));
      g.clip();
      for (let y = bottom - hookDraw * 0.85 - link * scale; y > top - link * scale; y -= link * scale)
        g.drawImage(img, sx, linkTop, sw, link, x - width / 2, y, width, link * scale);
      g.restore();
      g.drawImage(img, sx, hookTop, sw, hookH, x - width / 2, bottom - hookDraw, width, hookDraw);
      return bottom;
    }
    // A brass window frame stretched without distorting its corner bolts (nine-slice).
    function frame(c) {
      const img = s.sprite("sluiceGauge");
      if (!img.width) return;
      const fh = img.height * 0.76,
        cw = img.width * 0.07,
        ch = fh * 0.2,
        th = c.w * 0.045;
      const src = [
        [0, cw, img.width - cw, img.width],
        [0, ch, fh - ch, fh],
      ];
      const dst = [
        [c.x - th, c.x - th + th * 1.4, c.x + c.w + th - th * 1.4, c.x + c.w + th],
        [c.y - th, c.y - th + th * 1.4, c.y + c.h + th - th * 1.4, c.y + c.h + th],
      ];
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          if (i === 1 && j === 1) continue;
          g.drawImage(img, src[0][i], src[1][j], src[0][i + 1] - src[0][i], src[1][j + 1] - src[1][j], dst[0][i], dst[1][j], dst[0][i + 1] - dst[0][i], dst[1][j + 1] - dst[1][j]);
        }
    }
    // The GRAB button sits in the bottom-right corner, clear of Coji and the hint bar.
    function grabButton() {
      const r = Math.max(34, Math.min(52, s.h() * 0.065));
      return { x: s.w() - r - 22, y: s.h() - r - 26, r };
    }
    function prizeAt(c, x) {
      let best = -1,
        dist = Infinity;
      order.forEach((id, i) => {
        if (taken.has(id) || held?.id === id) return;
        const d = Math.abs(slotX(c, i) - x);
        if (d < dist) {
          dist = d;
          best = i;
        }
      });
      return best >= 0 && dist < c.w * 0.045 ? best : -1;
    }
    return {
      scroll: () => (rule.perRound ? current().line : rule.text),
      begin: () => s.hint("Tap inside the glass to move the hook. Then press GRAB."),
      tap(p) {
        const c = cab(),
          b = grabButton();
        if (Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.2) {
          if (state === "idle") {
            state = "down";
            t0 = 0;
            pressed = 0.3;
            s.tone(180, 0.3, "triangle", 0.1, 120);
          }
          return;
        }
        if (state === "idle" && p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h)
          targetX = clamp((p.x - c.x) / c.w, 0.08, 0.92);
      },
      update(dt) {
        const c = cab();
        pressed = Math.max(0, pressed - dt);
        message = Math.max(0, message - dt);
        if (state === "idle") hookX += clamp(targetX - hookX, -dt * 0.5, dt * 0.5);
        t0 += dt;
        if (state === "down" && t0 > 1.1) {
          const i = prizeAt(c, c.x + c.w * hookX);
          held = i >= 0 ? { id: order[i], slot: i } : null;
          if (held) s.tone(300, 0.15, "square", 0.06, 260);
          state = "up";
          t0 = 0;
        }
        if (state === "up" && t0 > 1.0) {
          if (!held) {
            state = "idle";
            s.hint("Missed! Put the hook right over a prize.");
          } else {
            state = "carry";
            t0 = 0;
          }
        }
        if (state === "carry") {
          hookX += clamp(0.95 - hookX, -dt * 0.5, dt * 0.5);
          if (Math.abs(hookX - 0.95) < 0.005) {
            const right = held.id === current().prize;
            if (right) {
              taken.add(held.id);
              s.chime(620 + round * 80);
              s.hint("A prize!");
              held = null;
              state = "idle";
              targetX = hookX;
              round++;
              if (round === rule.rounds.length) return complete();
              if (rule.perRound) s.notice(current().line);
            } else {
              s.tone(150, 0.4, "triangle", 0.12, 90);
              s.hint("Not that one. Read the scroll again.");
              state = "return";
              t0 = 0;
            }
          }
        }
        if (state === "return") {
          const back = (slotX(c, held.slot) - c.x) / c.w;
          hookX += clamp(back - hookX, -dt * 0.6, dt * 0.6);
          if (Math.abs(hookX - back) < 0.005) {
            held = null;
            state = "idle";
            targetX = hookX;
          }
        }
      },
      draw() {
        const c = cab(),
          t = s.game.time();
        // Cabinet interior: dark glass box lit from above.
        const inside = g.createLinearGradient(0, c.y, 0, c.y + c.h);
        inside.addColorStop(0, "rgba(18,14,10,.82)");
        inside.addColorStop(1, "rgba(8,6,5,.9)");
        g.fillStyle = inside;
        g.fillRect(c.x, c.y, c.w, c.h);
        s.glow(c.x + c.w / 2, c.y + c.h * 0.1, c.w * 0.45, c.h * 0.2, "#ffd9a0", 0.35);
        // Stone floor of the cabinet.
        const slab = s.sprite("trialSlab");
        if (slab.width) g.drawImage(slab, 0, slab.height * 0.4, slab.width, slab.height * 0.6, c.x, floorY(c) - c.h * 0.02, c.w, c.h * 0.16);
        // Rail across the top.
        const rail = g.createLinearGradient(0, c.y + c.h * 0.05, 0, c.y + c.h * 0.09);
        rail.addColorStop(0, "#e2c37a");
        rail.addColorStop(1, "#5e4419");
        g.fillStyle = rail;
        g.fillRect(c.x, c.y + c.h * 0.05, c.w, c.h * 0.035);
        // Prizes on the floor.
        order.forEach((id, i) => {
          if (taken.has(id) || held?.id === id) return;
          drawPrize(id, slotX(c, i), floorY(c), c);
        });
        // The hook and anything it carries.
        const x = c.x + c.w * hookX;
        const lowest = floorY(c) - c.y - c.h * 0.08 - c.h * 0.08;
        let depth = c.h * 0.12;
        if (state === "down") depth += (lowest - c.h * 0.12) * Math.min(1, t0 / 1.0);
        if (state === "up") depth = c.h * 0.12 + (lowest - c.h * 0.12) * (1 - Math.min(1, t0 / 1.0));
        const swing = state === "carry" || state === "return" ? Math.sin(t * 5) * 0.08 : 0;
        const tip = hook(c, x, depth);
        if (held && tip) {
          const h = prizeSize(c, held.id);
          drawPrize(held.id, x, tip + h * (1 - PRIZES[held.id].loop) + h * 0.02, c, swing);
        }
        // Prize chute on the right.
        g.fillStyle = "rgba(0,0,0,.55)";
        g.fillRect(c.x + c.w * 0.9, floorY(c) - c.h * 0.02, c.w * 0.1, c.h * 0.16);
        // Glass: reflections over everything inside.
        g.save();
        g.globalCompositeOperation = "screen";
        const glass = g.createLinearGradient(c.x, c.y, c.x + c.w, c.y + c.h);
        glass.addColorStop(0, "rgba(255,255,255,.12)");
        glass.addColorStop(0.3, "rgba(255,255,255,0)");
        glass.addColorStop(0.62, "rgba(255,255,255,.05)");
        glass.addColorStop(0.68, "rgba(255,255,255,0)");
        g.fillStyle = glass;
        g.fillRect(c.x, c.y, c.w, c.h);
        g.restore();
        frame(c);
      },
      overlay() {
        const b = grabButton();
        brassButton(g, b.x, b.y, b.r, "GRAB", pressed > 0, state === "idle");
      },
    };
  });

  return { lookout, claw, LOOKOUT_ART };
})();
