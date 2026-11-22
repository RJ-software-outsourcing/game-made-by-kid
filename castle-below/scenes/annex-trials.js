// Each room owns its puzzle. The wrapper only handles the scroll, victory pause and return.
CastleScenes["annex-trials"] = (() => {
  const range = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function stations(s, y = 0.5) {
    const gap = Math.min(s.w() * 0.295, s.h() * 0.38);
    return [-1, 0, 1].map((n) => ({ x: s.w() / 2 + n * gap, y: s.h() * y }));
  }
  function touched(p, nodes, r) {
    return nodes.findIndex(
      (n) => Math.abs(n.x - p.x) <= Math.max(23, r) && Math.abs(n.y - p.y) <= Math.max(24, r),
    );
  }
  function trial(hint, result, setup) {
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
        const puzzle = setup(s, complete);
        return {
          ...s.base,
          ground: puzzle.ground || s.base.ground,
          scroll: () => puzzle.scroll?.() || s.rule.text,
          begin() {
            started = true;
            puzzle.begin?.();
          },
          terminal: () => ending >= 0,
          interact(pos) {
            if (puzzle.pick) return started && ending < 0 ? puzzle.pick(pos) : true;
            if (s.level.id !== "ice" && pos.y > s.h() * 0.74) return false;
            if (started && ending < 0) puzzle.tap(pos);
            return true;
          },
          update(dt) {
            if (ending >= 0) {
              ending += dt;
              puzzle.finishUpdate?.(dt);
              if (ending >= 1.15 && !settled) {
                settled = true;
                finish();
              }
              return;
            }
            if (started) puzzle.update(dt);
            if (!s.player.moving) s.player.facing = 4;
          },
          draw() {
            (puzzle.drawRoom || s.drawRoom)();
            puzzle.draw();
          },
        };
      },
    };
  }
  const bells = trial(
    "Watch the bells, then echo their song.",
    "You played the song!",
    (s, complete) => {
      let round = 0,
        melody = [],
        cursor = 0,
        clock = 0,
        played = 0,
        listening = true;
      const light = [0, 0, 0],
        pitch = [262, 330, 392];
      const size = () => Math.min(s.w() * 0.27, s.h() * 0.27);
      function ring(i) {
        light[i] = 0.59;
        s.chime(pitch[i]);
      }
      function replay() {
        listening = true;
        cursor = played = 0;
        clock = -0.65;
        s.hint("Watch and listen. Melody " + (round + 1) + " of 3.");
      }
      function next() {
        for (let i = melody.length; i < 3 + round; i++)
          melody.push(
            i === 0 ? Math.floor(Math.random() * 3) : (melody[i - 1] + 1 + Math.floor(Math.random() * 2)) % 3,
          );
        replay();
      }
      function fadeNotes(dt) {
        for (let i = 0; i < 3; i++) light[i] = Math.max(0, light[i] - dt);
      }
      return {
        begin: next,
        finishUpdate: fadeNotes,
        update(dt) {
          fadeNotes(dt);
          if (!listening) return;
          clock += dt;
          if (played < melody.length && clock >= played * 0.78) ring(melody[played++]);
          if (clock >= melody.length * 0.78) {
            listening = false;
            s.hint(s.rule.order === "back" ? "Your turn. Last bell first!" : "Your turn. Play the same song.");
          }
        },
        tap(p) {
          const i = touched(p, stations(s), size() * 0.51);
          if (i < 0 || listening) return;
          ring(i);
          if (i !== melody[s.rule.order === "back" ? melody.length - 1 - cursor : cursor]) {
            replay();
            s.hint("Listen again. The same melody will play.");
            return;
          }
          if (++cursor === melody.length) {
            if (++round === 3) complete();
            else next();
          } else s.hint("Your turn · " + cursor + " / " + melody.length);
        },
        draw() {
          stations(s).forEach((p, i) => {
            const d = size() * (1.06 - i * 0.09),
              power = light[i] / 0.59;
            // Fix the bell eye to the rafters; swing the casting around this same pin.
            const g = s.ctx,
              pin = p.y - d * 0.45,
              thickness = Math.max(3, d * 0.032);
            const cord = g.createLinearGradient(p.x - thickness / 2, 0, p.x + thickness / 2, 0);
            cord.addColorStop(0, "#21190f");
            cord.addColorStop(0.44, "#96764a");
            cord.addColorStop(0.68, "#665031");
            cord.addColorStop(1, "#312318");
            g.fillStyle = cord;
            g.fillRect(p.x - thickness / 2, 0, thickness, pin + d * 0.014);
            g.save();
            g.strokeStyle = "#302415b0";
            g.lineWidth = Math.max(1, thickness * 0.24);
            g.beginPath();
            for (let y = 0; y < pin; y += thickness * 1.2) {
              g.moveTo(p.x - thickness * 0.45, y);
              g.lineTo(p.x + thickness * 0.45, y + thickness * 0.55);
            }
            g.stroke();
            g.restore();
            s.shadow(p.x, p.y + d * 0.63, d * 0.42, d * 0.08);
            if (power) s.glow(p.x, p.y, d * 0.8, d * 0.88, "#ffe19a", power * 0.85);
            const a = Math.sin((0.59 - light[i]) * 23) * power * 0.14;
            s.ctx.save();
            s.ctx.translate(p.x, p.y - d * 0.45);
            s.ctx.rotate(a);
            s.instrument(0, 0, d * 0.45, d, d);
            s.ctx.restore();
          });
        },
      };
    },
  );
  const sluice = trial(
    "Bring the water to the gold mark.",
    "You opened the water gates!",
    (s, complete) => {
      const targets = s.rule.targets,
        weights = [1, 2, 4],
        open = [false, false, false],
        angle = [0, 0, 0];
      let round = 0,
        water = 0,
        hold = 0;
      function pipe() {
        const im = s.sprite("wheelPipe"),
          w = Math.min(s.w() * 0.86, s.h() * 0.83);
        return { w, h: (w * im.height) / im.width, x: (s.w() - w) / 2, bottom: s.h() * 0.71 };
      }
      function wheels() {
        const p = pipe();
        return [0.22, 0.5, 0.785].map((u) => ({ x: p.x + p.w * u, y: p.bottom - p.h * 0.52 }));
      }
      const size = () => pipe().w * 0.213;
      const sum = () => weights.reduce((n, v, i) => n + (open[i] ? v : 0), 0);
      function tell() {
        s.hint("Lock " + (round + 1) + " / 3 · Target " + targets[round] + " · Valves supply " + sum());
      }
      return {
        scroll: () => "Turn the wheels. Make the water reach " + targets[Math.min(2, round)] + ".",
        begin: tell,
        finishUpdate(dt) {
          water = Math.max(0, water - dt * 7);
        },
        update(dt) {
          for (let i = 0; i < 3; i++)
            angle[i] += (Number(open[i]) * Math.PI * 0.68 - angle[i]) * Math.min(1, dt * 7);
          water += range(sum() - water, -dt * 2.8, dt * 2.8);
          hold = Math.abs(water - targets[round]) < 0.03 && sum() === targets[round] ? hold + dt : 0;
          if (hold >= 0.72) {
            hold = 0;
            s.chime(440 + round * 90);
            if (++round === 3) complete();
            else tell();
          }
        },
        tap(p) {
          const i = touched(p, wheels(), size() * 0.56);
          if (i < 0) return;
          open[i] = !open[i];
          s.tone(117, 0.24, "triangle", 0.2, 62);
          tell();
        },
        draw() {
          const gauge = s.sprite("sluiceGauge");
          const outerWidth = Math.min(s.w() * 0.73, s.h() * 0.73);
          const outerHeight = (outerWidth * gauge.height) / gauge.width;
          const left = (s.w() - outerWidth) / 2;
          const top = s.h() * 0.35 - outerHeight * 0.4;
          const x = left + outerWidth * 0.069,
            y = top + outerHeight * 0.148;
          const width = outerWidth * 0.862,
            h = outerHeight * 0.463;
          const g = s.ctx;
          g.save();
          g.beginPath();
          g.rect(x, y, width, h);
          g.clip();
          g.fillStyle = "#082029c9";
          g.fillRect(x, y, width, h);
          const surface = y + h - (water * h) / 7;
          const fill = g.createLinearGradient(0, surface, 0, y + h + 0.1);
          fill.addColorStop(0, "#9ae3dedf");
          fill.addColorStop(0.16, "#478c9ac9");
          fill.addColorStop(1, "#194353da");
          g.fillStyle = fill;
          g.beginPath();
          g.moveTo(x, y + h);
          for (let j = 0; j <= 48; j++)
            g.lineTo(
              x + (width * j) / 48,
              surface + Math.sin(j * 0.37 + s.game.time() * 2.2) * Math.min(1.6, water),
            );
          g.lineTo(x + width, y + h);
          g.fill();
          const mark = y + h - (targets[Math.min(round, 2)] / 7) * h;
          g.strokeStyle = "#ffdd8f";
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x, mark);
          g.lineTo(x + width * 0.16, mark);
          g.moveTo(x + width * 0.84, mark);
          g.lineTo(x + width, mark);
          g.stroke();
          g.restore();
          g.drawImage(gauge, left, top, outerWidth, outerHeight);
          const pipeBox = pipe();
          s.shadow(s.w() / 2, pipeBox.bottom, pipeBox.w * 0.45, pipeBox.h * 0.075);
          g.drawImage(s.sprite("wheelPipe"), pipeBox.x, pipeBox.bottom - pipeBox.h, pipeBox.w, pipeBox.h);
          wheels().forEach((p, i) => {
            const d = size();
            s.shadow(p.x, p.y + d * 0.52, d * 0.43, d * 0.09);
            if (open[i]) s.glow(p.x, p.y, d * 0.65, d * 0.65, "#78ddec", 0.74);
            s.instrument(1, p.x, p.y, d, d, angle[i]);
            s.lettering(String(weights[i]), p.x, p.y + d * 0.58, Math.max(14, d * 0.14));
          });
        },
      };
    },
  );
  const mirrors = trial("Follow the light.", "You lit both signs!", (s, done) =>
    CastleScenes["star-optics"].create(s, done),
  );
  const ice = trial(
    "Choose a solid slab in the next row.",
    "You crossed the ice!",
    (s, complete) => {
      const route = [1];
      for (let i = 1; i <= 8; i++) {
        const last = route[i - 1];
        const choices = [0, 1, 2].filter((n) => Math.abs(n - last) <= 1);
        route.push(choices[Math.floor(Math.random() * choices.length)]);
      }
      const laneY = (i) => 1.75 + i * 2.75,
        rowX = (i) => 0.5 + i * 1.12;
      let row = 0,
        lane = 1,
        dest = null,
        cracking = 0;
      function tile(r, l) {
        const p = s.base.project(rowX(r), laneY(l));
        return { ...p, width: s.w() * 0.26 * p.k, height: s.h() * 0.17 * p.k * p.k };
      }
      function tell() {
        s.hint("Step on the " + CastleScenes["chamber-rules"].signs[s.rule.goal] + " · " + row + " / 8");
      }
      return {
        begin: tell,
        update(dt) {
          if (!dest) return;
          if (s.player.path.length) return;
          if (dest.l === route[row + 1]) {
            row++;
            lane = dest.l;
            dest = null;
            s.tone(315, 0.16, "sine", 0.09, 180);
            if (row === 8) complete();
            else tell();
            return;
          }
          if (!cracking) {
            s.tone(170, 0.4, "sawtooth", 0.11, 35);
            s.rush(2050, 280, 0.45, 0.34);
            s.hint("Oops! Look for your sign.");
          }
          cracking += dt;
          s.player.z = -Math.sin(Math.PI * Math.min(1, cracking / 0.65)) * 21;
          if (cracking >= 0.65) {
            s.player.x = rowX(row);
            s.player.y = laneY(lane);
            s.player.z = 0;
            dest = null;
            cracking = 0;
            tell();
          }
        },
        tap(p) {
          if (dest || row >= 8) return;
          let nearest = null;
          for (let l = 0; l < 3; l++) {
            const t = tile(row + 1, l);
            if (Math.abs(p.x - t.x) < t.width * 0.49 && Math.abs(p.y - t.y) < Math.max(15, t.height * 0.35))
              nearest = l;
          }
          if (nearest === null || Math.abs(lane - nearest) > 1) {
            s.hint("Choose a reachable slab in the very next row.");
            return;
          }
          dest = { l: nearest };
          s.player.path = [{ x: rowX(row + 1), y: laneY(nearest) }];
        },
        draw() {
          for (let r = Math.min(8, row + 7); r >= Math.max(0, row - 1); r--)
            for (let l = 0; l < 3; l++) {
              const t = tile(r, l);
              if (t.y > s.h() * 1.16) continue;
              const bad = l !== route[r] && (l + 1) % 3 !== route[r],
                broken = dest?.l === l && r === row + 1 && cracking > 0;
              const g = s.ctx;
              if (broken) {
                const q = range(cracking / 0.65, 0, 1);
                // Split the existing ice photograph at its cracks and let the pieces tip into the water.
                const rim = [
                  [-0.5, -0.5],
                  [0.5, -0.5],
                  [0.5, 0.5],
                  [-0.5, 0.5],
                ];
                for (let n = 0; n < 4; n++) {
                  const [ax, ay] = rim[n],
                    [bx, by] = rim[(n + 1) % 4];
                  g.save();
                  g.globalAlpha = 1 - q * q;
                  g.translate(
                    t.x + (ax + bx) * t.width * q * 0.14,
                    t.y + (ay + by) * t.height * q * 0.14 + t.height * q * q * 0.45,
                  );
                  g.rotate((n % 2 ? 1 : -1) * q * 0.21);
                  g.beginPath();
                  g.moveTo(t.width * 0.04, t.height * 0.035);
                  g.lineTo(ax * t.width, ay * t.height);
                  g.lineTo(bx * t.width, by * t.height);
                  g.closePath();
                  g.clip();
                  s.instrument(4, 0, 0, t.width, t.height);
                  g.restore();
                }
              } else s.instrument(bad ? 4 : 3, t.x, t.y, t.width, t.height);
              if (!broken && !bad && r > 0) {
                const symbol = l === route[r] ? s.rule.goal : (s.rule.goal + 1 + (r % 2)) % 3;
                s.lettering(["☀", "☾", "★"][symbol], t.x, t.y, Math.max(11, t.width * 0.16), "#fff1b9");
              }
              if (r === row + 1)
                s.glow(t.x, t.y + t.height * 0.15, t.width * 0.37, t.height * 0.065, "#b6eaff", 0.32);
            }
        },
      };
    },
  );
  const forge = trial(
    "Watch the hammer. Tap the hot mark.",
    "You made a sword!",
    (s, complete) => {
      let hits = 0,
        phase = 0.8,
        strike = -1,
        good = false,
        heldSwing = 0,
        impact = -1;
      const contact = 0.23,
        stroke = 0.46;
      function forgePlate() {
        const img = s.sprite("forgeRoom"),
          factor = Math.max(s.w() / img.width, s.h() / img.height);
        const width = img.width * factor,
          height = img.height * factor;
        return { width, anvil: s.h() * 0.5 + 0.005 * height, hook: s.h() * 0.5 - 0.191 * height };
      }
      const size = () => Math.min(forgePlate().width * 0.169, s.w() * 0.53);
      const amp = () => size() * 0.93;
      const offset = () => (s.rule.goal - 1) * size() * 0.24;
      const hammerX = () => s.w() / 2 + amp() * Math.sin(phase);

      function tell() {
        s.hint("Strike the hot ingot · " + hits + " / 3");
      }
      return {
        begin: tell,
        finishUpdate(dt) {
          impact += dt;
        },
        update(dt) {
          phase += dt * (1.85 + hits * 0.32);
          if (impact >= 0) impact += dt;
          if (strike >= 0) {
            const before = strike;
            strike += dt;
            if (before < contact && strike >= contact) {
              if (good) {
                impact = 0;
                s.tone(210, 0.39, "triangle", 0.28, 55);
                s.chime(510 + hits * 135);
              } else s.rush(540, 105, 0.24, 0.18);
            }
            if (strike > stroke) {
              strike = -1;
              if (good) {
                if (++hits === 3) {
                  complete();
                  return;
                }
                tell();
              }
            }
          }
        },
        tap(p) {
          if (
            strike >= 0 ||
            Math.abs(p.x - s.w() / 2) > size() * 0.55 ||
            Math.abs(p.y - forgePlate().anvil - size() * 0.16) > Math.max(27, size() * 0.45)
          )
            return;
          good = Math.abs(hammerX() - (s.w() / 2 + offset())) < amp() * (0.26 - hits * 0.026);
          strike = 0;
          heldSwing = Math.sin(phase);
          if (!good) s.hint("Try again. Wait for the hot mark.");
        },
        draw() {
          const d = size(),
            x = s.w() / 2,
            y = forgePlate().anvil;
          // The photograph already supplies the anvil, stump and load-bearing beam.
          const blanks = s.sprite("forgeBlanks"),
            cell = blanks.width / 3;
          const slab = hits === 3 ? 2 : hits > 0 ? 1 : 0;
          const crop = [
            [0.254, 0.307, 0.367, 0.067],
            [0.181, 0.312, 0.702, 0.063],
            [0.136, 0.31, 0.768, 0.065],
          ][slab];
          s.ctx.drawImage(
            blanks,
            (slab + crop[0]) * cell,
            crop[1] * cell,
            crop[2] * cell,
            crop[3] * cell,
            x - d * 0.34,
            y - d * 0.08,
            d * 0.68,
            d * 0.08,
          );
          for (const track of [-1, 0, 1]) {
            const active = track === s.rule.goal - 1;
            s.glow(
              x + d * 0.24 * track,
              y - d * 0.035,
              d * 0.065,
              d * 0.038,
              active ? "#ffe7a0" : "#cc795a",
              active ? 0.98 : 0.3,
            );
          }
          const resume = strike < 0 ? 1 : range((strike - contact) / (stroke - contact), 0, 1);
          const a = heldSwing + (Math.sin(phase) - heldSwing) * resume;
          const drop = strike < 0 ? 0 : Math.sin((Math.PI * strike) / stroke);
          const hy = y - d * 0.57 - d * 0.18 * a * a + d * (0.23 + 0.18 * a * a) * drop,
            hx = x + amp() * a;
          const g = s.ctx;
          g.save();
          g.strokeStyle = "#67584c";
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(x, forgePlate().hook);
          g.lineTo(hx, hy - d * 0.25);
          g.stroke();
          g.restore();
          s.instrument(5, hx, hy, d * 0.68, d * 0.8, -a * 0.41);
          if (impact >= 0 && impact < 0.38) {
            const q = impact / 0.38,
              strength = 1 - q;
            s.glow(x + offset(), y - d * 0.035, d * (0.26 + q * 0.3), d * 0.2, "#ffcf80", strength);
            if (s.game.effects()) {
              g.save();
              g.globalCompositeOperation = "lighter";
              g.strokeStyle = "#ffcb73";
              g.globalAlpha = strength * strength;
              g.lineWidth = Math.max(1, d * 0.006);
              g.beginPath();
              for (let n = 0; n < 14; n++) {
                const vx = Math.cos(n * 2.4) * (0.28 + (n % 4) * 0.12);
                const vy = -0.18 - (n % 5) * 0.098;
                const px = x + vx * d * q,
                  py = y - d * 0.035 + d * (vy * q + 0.31 * q * q);
                g.moveTo(px + offset(), py);
                g.lineTo(px + offset() - vx * d * 0.045, py - (vy + 0.62 * q) * d * 0.045);
              }
              g.stroke();
              g.restore();
            }
          }
        },
      };
    },
  );
  return { bells, sluice, mirrors, ice, forge };
})();
