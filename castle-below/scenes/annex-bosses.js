CastleScenes["annex-bosses"] = (() => {
  const signs = {
    bones: "Bone shards are rising underfoot. Move away!",
    soul: "The crown sings. Hold Coji to shield the soul wave!",
    charge: "The king leans forward. Step out of his path!",
    pool: "Black water is bubbling. Leave the pool!",
    flock: "Feathers mark the flock's path. Step aside!",
    curse: "The staff gathers green light. Shield to send the curse back!",
    doubles: "Find the witch whose feet cast a dark shadow.",
    hammer: "The raised fist marks the impact. Move sideways!",
    steam: "Both vents glow. Hold Coji to shield the steam!",
  };
  const profiles = {
    king: {
      hp: 18,
      color: "#96dbff",
      note: 123,
      hint: "Dodge the bones. Shield the soul wave. Cast when the crown dims.",
      result: "You beat the king!",
    },
    witch: {
      hp: 16,
      color: "#a2f282",
      note: 173,
      hint: "Watch her shadow. Shield the green curse to reflect it.",
      result: "You found the real witch!",
    },
    colossus: {
      hp: 14,
      color: "#ffac54",
      note: 71,
      hint: "Dodge the hammer. Shield the steam. Shoot the open furnace core.",
      result: "You beat the iron giant!",
    },
  };
  function create(s, finish, retry) {
    const { game, player, level, ctx, clamp } = s,
      kind = level.id,
      profile = profiles[kind];
    const rites = CastleScenes["annex-rites"](s);
    const clips = CastleScenes["performance-frames"][kind];
    const effects = s.sprite("annexEffects");
    const boss = {
      type: "boss",
      name: level.name,
      x: 7.5,
      y: 4.5,
      hp: profile.hp,
      maxHp: profile.hp,
      alive: true,
      hurt: 0,
    };
    let phase = "arrival",
      age = 0,
      duration = 1.35,
      move = "",
      turn = 0,
      marks = [],
      struck = new Set(),
      reflected = null;
    let trueSlot = 1,
      echoes = [],
      interrupted,
      lastBounds = null,
      impactAt = -10,
      ending = false,
      armorFlash = 0,
      steamBlocked = false;
    const progress = () => clamp(age / duration);
    const tier = () => (boss.hp / boss.maxHp > 0.7 ? 0 : boss.hp / boss.maxHp > 0.35 ? 1 : 2);
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const terminal = () => phase === "fallen" || phase === "victory";
    const illusion = () => move === "doubles" && (phase === "warning" || phase === "strike");
    const open = () => phase === "rest";
    const lanes = [1.3, 4.5, 7.7];
    const markX = (lane) => s.base.project(0.5, lane).x;
    function enter(next, len) {
      phase = next;
      age = 0;
      duration = len;
    }
    function clearEchoes() {
      for (const figure of echoes) if (figure !== boss) figure.alive = false;
      echoes = [];
    }
    function makeEcho(lane) {
      return {
        x: boss.x,
        y: lane,
        alive: true,
        onOrbImpact() {
          this.alive = false;
          s.rush(1850, 420, 0.38, 0.3);
          s.hint("An echo. Look for the dark shadow.");
        },
      };
    }
    function startMove() {
      move = s.rule.pattern[turn++ % s.rule.pattern.length];
      struck = new Set();
      steamBlocked = false;
      reflected = null;
      clearEchoes();
      const targeted = clamp(player.y, 0.55, 8.45);
      marks = [targeted];
      if (move === "hammer" && tier() > 0) marks.push(targeted > 4.5 ? targeted - 2.7 : targeted + 2.7);
      if (move === "doubles") {
        trueSlot = Math.floor(Math.random() * 3);
        boss.y = 4.5;
        echoes = lanes.map((lane, i) => (i === trueSlot ? boss : makeEcho(4.5)));
      } else boss.y = 4.5;
      enter("warning", move === "doubles" ? 1.0 : 1.95 - tier() * 0.17);
      s.hint(signs[move]);
      rites.sound(move);
    }
    const boneMoves = ["bones", "hammer", "charge", "pool", "flock"];
    function hurtBoss(amount) {
      boss.hp = Math.max(0, boss.hp - amount);
      boss.hurt = 0.28;
      game.updateHud();
      if (boss.hp === 0) {
        boss.alive = false;
        endBattle(true);
      }
    }
    function trigger(index, blockable, near = true) {
      if (struck.has(index) || !near) return;
      struck.add(index);
      game.damagePlayer(blockable);
      if (blockable && player.guard && move === "curse") {
        reflected = { x: player.x, y: player.y };
        s.chime(632);
      }
    }
    function impactBeat(i = 0) {
      if (i > 0) return 0.76;
      return move === "flock" || move === "charge" ? 0.61 : 0.28;
    }
    function lunge(q, beat) {
      const travel = q <= beat ? q / beat : (1 - q) / (1 - beat);
      return travel * travel * (3 - 2 * travel);
    }
    function strike(dt) {
      const q = progress(),
        before = (age - dt) / duration;
      if (move === "steam") {
        const field = rites.steamField(q, box());
        if (field.touching && player.guard && !steamBlocked) {
          steamBlocked = true;
          game.damagePlayer(true);
          s.rush(3200, 680, 0.44, 0.48);
        }
        // A block protects only while held. An earlier block never consumes the damage event.
        if (field.exposed && !player.guard) trigger(0, false);
        if (before < 0.69 && q >= 0.69) impactAt = game.time();
        return;
      }
      if (move === "pool") {
        if (q > 0.13 && q < 0.89) trigger(0, false, Math.abs(player.y - marks[0]) < 1.2);
        return;
      }
      if (move === "doubles") return;
      if (move === "curse" && reflected && q >= 1) {
        hurtBoss(3);
        return;
      }
      if (move === "charge") {
        const travel = lunge(q, impactBeat());
        boss.x = 7.5 - 6.84 * travel;
        boss.y = 4.5 + (marks[0] - 4.5) * travel;
      }
      if (boneMoves.includes(move)) {
        marks.forEach((pos, i) => {
          const beat = impactBeat(i);
          if (before < beat && q >= beat) {
            impactAt = game.time();
            s.rush(move === "flock" ? 1950 : 480, 75, 0.64, 0.58);
            trigger(i, false, Math.abs(player.y - pos) < (move === "charge" ? 1.25 : 1.05));
          }
        });
      } else if (before < 0.7 && q >= 0.7) {
        trigger(0, true);
        impactAt = game.time();
      }
    }
    const sample = (clip, from, to, t) => ({ clip, index: Math.round(from + (to - from) * clamp(t)) });
    function frame() {
      const q = progress();
      if (terminal()) {
        if (age < 0.37 && interrupted) {
          const last = interrupted.clip === "life" ? 12 : clips[interrupted.clip].length - 1;
          const to = interrupted.index < last / 2 ? 0 : last;
          return sample(interrupted.clip, interrupted.index, to, age / 0.37);
        }
        if (phase === "victory") return sample("victory", 0, 12, (age - 0.37) / 1.0);
        return sample("life", 12, 47, (age - 0.37) / 1.95);
      }
      if (phase === "arrival") return sample("life", 0, 12, q);
      if (phase === "warning") return sample(move, 0, 19, q / 0.94);
      if (phase === "strike") {
        const hit = boneMoves.includes(move) ? impactBeat() : move === "doubles" ? 0.27 : 0.57;
        if (move === "hammer" && marks.length === 2 && q > hit && q < impactBeat(1)) {
          return q < 0.54
            ? sample(move, 29, 19, (q - hit) / (0.54 - hit))
            : sample(move, 19, 29, (q - 0.54) / (impactBeat(1) - 0.54));
        }
        if (q <= hit) return sample(move, 19, 29, q / hit);
        const finalHit = move === "hammer" && marks.length === 2 ? impactBeat(1) : hit;
        return sample(move, 29, 35, (q - finalHit) / (1 - finalHit));
      }
      if (age < 0.74) return sample(move, 35, 44, age / 0.74);
      const rest = duration - 0.74;
      const breaths = ((age - 0.74) / rest) * Math.max(1, Math.round(rest));
      return sample("life", 0, 12, breaths % 1);
    }
    function endBattle(won) {
      if (terminal()) return;
      interrupted = frame();
      lastBounds = box();
      game.stop();
      s.base.quiet();
      clearEchoes();
      enter(won ? "fallen" : "victory", won ? rites.endTime : 2.05);
      s.hint(won ? "" : level.title + " wins this round.");
      if (won) rites.endingSound();
      else s.chime(profile.note * 1.5);
      if (won) {
        s.tone(profile.note * 0.7, 2.25, "triangle", 0.23, 36, 0.23);
        s.rush(810, 83, 1.65, 0.35);
      }
    }
    function separation() {
      if (!illusion()) return 0;
      const t = phase === "warning" ? clamp((progress() - 0.18) / 0.62) : clamp((1 - progress()) / 0.13);
      return t * t * (3 - 2 * t);
    }
    function update(dt) {
      age += dt;
      if (kind === "witch") rites.updateWater(dt, phase, age, move);
      boss.hurt = Math.max(0, boss.hurt - dt);
      armorFlash = Math.max(0, armorFlash - dt);
      if (!player.moving) player.facing = 4;
      if (terminal()) {
        if (phase === "fallen" && age - dt < 2.32 && age >= 2.32) {
          impactAt = game.time();
          s.rush(930, 60, 1.05, 0.64);
          s.tone(77, 0.7, "sine", 0.34, 32);
        }
        if (!ending && age >= duration) {
          ending = true;
          if (phase === "fallen") finish();
          else retry();
        }
        return;
      }
      if (illusion()) {
        const split = separation();
        echoes.forEach((figure, i) => {
          figure.y = 4.5 + (lanes[i] - 4.5) * split;
        });
      }
      if (phase === "strike") strike(dt);
      if (terminal() || age < duration) return;
      if (phase === "arrival" || phase === "rest") startMove();
      else if (phase === "warning") {
        enter("strike", move === "doubles" ? 3.35 : move === "pool" ? 2.1 : marks.length > 1 ? 1.55 : 1.24);
        if (move !== "doubles")
          s.rush(move === "steam" ? 3500 : 1150, move === "curse" ? 960 : 135, duration, 0.46);
      } else {
        enter("rest", 2.65 - tier() * 0.23);
        boss.y = 4.5;
        clearEchoes();
        s.hint(
          kind === "colossus"
            ? "The furnace shutters are open. Cast at its heart!"
            : kind === "king"
              ? "The crown is dim. Cast now!"
              : "The witch is exposed. Cast now!",
        );
      }
    }
    function box(lane = boss.y) {
      const p = s.base.project(boss.x, lane),
        split = separation();
      const rush = move === "charge" && phase === "strike" ? lunge(progress(), impactBeat()) : 0;
      const height =
        Math.min(s.h() * 0.51, s.w() * (0.73 - 0.3 * split)) * (1 - 0.21 * split) * (1 + 0.22 * rush);
      const { x, y } = p;
      if (terminal() && age < 0.47) {
        const t = clamp(age / 0.47);
        return {
          x: lastBounds.x + (x - lastBounds.x) * t,
          y: lastBounds.y + (y - lastBounds.y) * t,
          height: lastBounds.height + (height - lastBounds.height) * t,
        };
      }
      return { x, y, height };
    }
    function hits(pos, b) {
      return (
        Math.abs(pos.x - b.x) <= b.height * 0.44 && pos.y >= b.y - b.height && pos.y <= b.y + b.height * 0.03
      );
    }
    function interact(pos, shoot) {
      if (!illusion() || separation() < 0.3) return false;
      const slots = echoes
        .map((figure, i) => ({ i, b: box(figure.y) }))
        .filter(({ i, b }) => echoes[i].alive && hits(pos, b))
        .sort((a, b) => Math.abs(a.b.x - pos.x) - Math.abs(b.b.x - pos.x));
      if (!slots.length || slots[0].i === trueSlot) return false;
      shoot(echoes[slots[0].i], pos);
      return true;
    }
    function fx(id, x, y, w, h, alpha = 1, angle = 0) {
      ctx.save();
      ctx.globalAlpha = clamp(alpha);
      s.cel(effects, id, 3, 2, x, y, w, h, angle);
      ctx.restore();
    }
    function drawPose(pose, b) {
      const [sx, sy, w, h, left, top, width = w, height = h] = clips[pose.clip][pose.index];
      const scale = b.height / 704;
      ctx.drawImage(
        s.sprite("performance-" + kind + "-" + pose.clip),
        sx,
        sy,
        w,
        h,
        b.x - b.height * 0.5 + left * scale,
        b.y - b.height * 0.96 + top * scale,
        width * scale,
        height * scale,
      );
    }
    function drawBody(lane, real) {
      const b = box(lane),
        d = b.height;
      if (real) s.shadow(b.x, b.y, d * 0.4, d * 0.078, 0.93);
      if (phase === "arrival")
        s.glow(b.x, b.y - d * 0.46, d * 0.68, d * 0.68, profile.color, 0.56 * (1 - progress()));
      ctx.save();
      ctx.globalAlpha = real ? 1 : separation();
      const f = frame();
      drawPose(f, b);
      if (kind === "colossus" && phase === "fallen" && age > 2.32) {
        ctx.globalAlpha = clamp((age - 2.32) / (rites.endTime - 2.87));
        ctx.drawImage(s.sprite("coldShell"), b.x - d * 0.5, b.y - d * 0.96, d, d);
        ctx.globalAlpha = 1;
      }
      if (real && boss.hurt > 0 && !terminal()) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = (boss.hurt / 0.28) * 0.36;
        drawPose(f, b);
      }
      ctx.restore();
      const power =
        phase === "warning"
          ? 0.12 + 0.6 * progress()
          : phase === "strike"
            ? 0.34
            : open() && kind === "colossus"
              ? 0.76
              : 0;
      if (power) {
        const pulse = power * (0.9 + 0.1 * Math.sin(game.time() * 8));
        if (open() && kind === "colossus") s.glow(b.x, b.y - d * 0.57, d * 0.2, d * 0.2, "#ffae50", pulse);
        else if (move === "soul") s.glow(b.x, b.y - d * 0.89, d * 0.145, d * 0.14, "#bcf4ff", pulse);
        else if (move === "curse") s.glow(b.x, b.y - d * 0.55, d * 0.135, d * 0.15, "#b3ff77", pulse);
        else if (move === "pool")
          s.glow(b.x + d * 0.065, b.y - d * 0.08, d * 0.23, d * 0.057, "#a2d161", pulse);
        else if (move === "hammer")
          s.glow(b.x - d * 0.17, b.y - d * 0.84, d * 0.1, d * 0.085, "#ffb366", pulse);
      }
      if (armorFlash > 0 && real) {
        const strength = armorFlash / 0.36;
        s.glow(b.x, b.y - d * 0.53, d * 0.21, d * 0.12, "#e6f2fc", strength);
        s.lettering("Armored", b.x, b.y - d * 0.64, Math.max(13, d * 0.055));
      }
      if (phase !== "fallen") return;
      const fall = clamp(age / 2.6);
      s.glow(b.x, b.y - d * 0.2, d * 0.64, d * 0.3, profile.color, 0.43 * Math.sin(Math.PI * fall));
      if (!game.effects()) return;
      if (kind === "king") {
        // His last breath rises out of the crown as the king sinks to his knees.
        const wisp = clamp((age - 0.42) / 2.23);
        fx(
          1,
          b.x,
          b.y - d * (0.55 + 0.47 * wisp),
          d * (0.21 + 0.58 * wisp),
          d * 0.24,
          Math.sin(Math.PI * wisp) * 0.73,
        );
      } else if (kind === "witch") {
        const flock = clamp((age - 0.45) / 4.8);
        for (let j = 0; j < 5; j++) {
          bird(
            b.x + d * (0.72 * flock + (j - 2) * 0.09),
            b.y - d * (0.43 + 0.78 * flock + 0.07 * Math.sin(flock * 5 + j)),
            d * (0.21 - 0.12 * flock),
            j,
            Math.sin(Math.PI * flock) * 0.96,
          );
        }
      } else {
        const dust = clamp((age - 2.25) / 1.24);
        groundCel(impacts, dust < 0.32 ? 7 : 8, 3, b.x, b.y, d * 0.81, Math.sin(Math.PI * dust) * 0.92);
      }
    }
    // Floor plates have the same registered ground line in every exposure.
    function groundCel(sheet, index, rows, x, floor, size, opacity = 1) {
      ctx.save();
      ctx.globalAlpha *= clamp(opacity);
      s.cel(sheet, index, 3, rows, x, floor - size * 0.37, size, size);
      ctx.restore();
    }
    const impacts = s.sprite("royalImpacts"),
      air = s.sprite("royalAir");
    function bird(x, y, size, i, alpha, angle = 0) {
      ctx.save();
      ctx.globalAlpha *= clamp(alpha);
      s.cel(air, Math.sin(game.time() * 15 + i * 2.17) > 0 ? 3 : 4, 3, 2, x, y, size, size, angle);
      ctx.restore();
    }
    function debris(x, y, size, time) {
      if (time <= 0 || time >= 1 || !game.effects() || reducedMotion.matches) return;
      for (let i = 0; i < 6; i++) {
        const p = clamp(time * (1 + (i % 3) * 0.13));
        const dx = (i % 2 ? 1 : -1) * size * (0.19 + (i % 3) * 0.16) * p;
        const dy = size * (p * p - p) * (1.1 + (i % 3) * 0.45);
        const chipSize = size * (0.052 + 0.009 * (i % 3));
        ctx.save();
        ctx.globalAlpha = 1 - p * p;
        s.cel(air, 5, 3, 2, x + dx, y + dy, chipSize, chipSize, p * (i - 2) * 2.7);
        ctx.restore();
      }
    }
    function drawAttack() {
      if (phase === "rest" && age < 0.85 && move === "bones") {
        groundCel(
          s.sprite("boneBreach"),
          5,
          2,
          markX(marks[0]),
          s.base.project(0.5, 4.5).y,
          Math.min(s.w() * 0.27, s.h() * 0.31),
          1 - age / 0.85,
        );
      }
      if (phase !== "warning" && phase !== "strike") return;
      const warning = phase === "warning",
        q = progress(),
        p = s.base.project(player.x, player.y),
        floor = s.base.project(0.5, 4.5).y;
      const w = s.w(),
        h = s.h(),
        b = box(),
        width = w * 0.215;
      if (move === "doubles") return;
      if (boneMoves.includes(move)) {
        marks.forEach((lane, i) => {
          const x = markX(lane),
            beat = impactBeat(i);
          const footprint = Math.min(w * 0.27, h * 0.31);
          if (move === "bones") {
            const exposure = warning
              ? q < 0.72
                ? 0
                : 1
              : q < 0.12
                ? 1
                : q < beat
                  ? 2
                  : q < 0.58
                    ? 3
                    : q < 0.81
                      ? 4
                      : 5;
            groundCel(s.sprite("boneBreach"), exposure, 2, x, floor, footprint, warning ? 0.45 + 0.55 * q : 1);
            if (!warning) debris(x, floor, footprint, clamp((q - beat) / 0.65));
            return;
          }
          if (move === "pool") {
            const poolSize = Math.min(w * 0.32, h * 0.38);
            const frame = warning ? 0 : q < 0.13 || q > 0.83 ? 2 : Math.floor(age * 4) % 3 === 0 ? 2 : 1;
            groundCel(impacts, frame, 3, x, floor, poolSize, warning ? 0.38 + 0.62 * q : 1);
            return;
          }
          if (warning) {
            s.glow(x, floor, width * 0.66, h * 0.036, profile.color, 0.33 + 0.46 * q);
            if (move === "flock") {
              for (let j = 0; j < 3; j++)
                bird(
                  x + (j - 1) * footprint * 0.16,
                  floor - footprint * (0.42 + 0.09 * Math.sin(age * 4 + j)),
                  footprint * 0.27,
                  j,
                  0.5 + 0.45 * q,
                );
            } else groundCel(impacts, 6, 3, x, floor, footprint, 0.27 + 0.35 * q);
          } else {
            if (move === "flock") {
              const flight = q / beat,
                endY = floor - s.base.heroSize() * 0.48;
              const flyX = b.x + (x - b.x) * flight,
                flyY = b.y - h * 0.25 + (endY - b.y + h * 0.25) * flight;
              for (let j = 0; j < 7; j++) {
                const side = (j - 3) * footprint * 0.12,
                  arc = Math.sin(flight * Math.PI);
                bird(
                  flyX + side * (0.2 + flight),
                  flyY - arc * h * 0.115 + Math.abs(side) * 0.3,
                  footprint * (0.18 + 0.26 * flight),
                  j,
                  clamp((1 - q) / 0.18),
                  -0.22 * arc,
                );
              }
            }
            if (move === "hammer" || move === "charge") {
              const shock = clamp((q - beat) / (1 - beat));
              if (q < beat) {
                s.glow(x, floor, width * 0.58, h * 0.032, profile.color, 0.76);
              } else {
                s.glow(x, floor, width * (0.22 + shock), h * 0.07, "#fff2cd", Math.exp(-shock * 8));
              }
              if (q >= beat) {
                groundCel(
                  impacts,
                  shock < 0.12 ? 6 : shock < 0.58 ? 7 : 8,
                  3,
                  x,
                  floor,
                  footprint * 1.27,
                  clamp((1 - shock) / 0.32),
                );
                debris(x, floor, footprint, shock);
              }
              if (move === "hammer")
                s.glow(x, floor, width * (0.22 + shock), h * 0.08, "#ffb66c", Math.sin(Math.PI * shock));
            }
          }
        });
        return;
      }
      if (move === "steam") {
        for (const side of [-1, 1]) {
          const x = b.x + side * b.height * 0.19,
            y = b.y - b.height * 0.59;
          if (warning) s.glow(x, y, b.height * 0.092, b.height * 0.077, "#ffe4ac", 0.25 + 0.72 * q);
          else if (s.game.effects()) {
            const cloud = s.sprite("ventCloud");
            const size = b.height * (0.1 + 0.23 * q);
            ctx.save();
            ctx.globalAlpha = Math.sin(Math.PI * q) * 0.86;
            ctx.drawImage(
              cloud,
              x - size / 2 + side * b.height * 0.1 * q,
              y - size * 0.21,
              size,
              (size * cloud.height) / cloud.width,
            );
            ctx.restore();
          }
        }
      }
      if (warning) return;
      if (move === "curse") {
        const end = reflected ? s.base.project(reflected.x, reflected.y) : p;
        const t = reflected ? clamp(1 - (q - 0.7) / 0.3) : clamp(q / 0.7);
        const startY = b.y - b.height * 0.55;
        const dx = end.x - b.x,
          dy = end.y - s.base.heroSize() * 0.45 - startY;
        const size = Math.min(w * 0.21, h * 0.21);
        // The luminous nose is at (0.16, 0.80) on the original square plate.
        ctx.save();
        ctx.translate(b.x + dx * t, startY + dy * t);
        ctx.rotate(Math.atan2(dy, dx) - Math.atan2(0.5, -0.61) + (reflected ? Math.PI : 0));
        fx(
          4,
          size * 0.34,
          -size * 0.3,
          size,
          size,
          reflected || q <= 0.7 ? 0.98 : 0.98 * clamp(1 - (q - 0.7) / 0.09),
        );
        ctx.restore();
      } else if (move === "soul") {
        const y = b.y + ((floor - b.y) * q) / 0.7;
        const size = Math.min(w * 0.63, h * 0.64) * (0.67 + q * 0.55);
        const extent = w * (0.05 + 0.37 * q);
        for (const side of [-1, 0, 1]) {
          groundCel(
            impacts,
            3 + Math.min(2, Math.floor(3 * q)),
            3,
            w * 0.5 + side * extent,
            y,
            size,
            Math.sin(Math.PI * q) * (side ? 0.76 : 0.98),
          );
        }
      }
    }
    return {
      ...s.base,
      boss,
      terminal,
      update,
      endBattle,
      interact,
      orbDamage() {
        if (kind !== "colossus") return open() || illusion() ? 2 : 1;
        if (open()) return 3;
        armorFlash = 0.36;
        s.chime(189);
        return 0;
      },
      hitDragon: (pos) => hits(pos, box()),
      cameraOffset: () => {
        const t = game.time() - impactAt;
        const power = game.effects() && !reducedMotion.matches ? 3 * Math.exp(-t * 9) : 0;
        return { x: Math.sin(t * 65) * power, y: Math.sin(t * 51) * power };
      },
      shadeForeground() {
        if (phase === "strike" && move === "steam") rites.steam(progress(), box());
        if (phase === "warning") rites.cue(move, progress());
      },
      draw() {
        rites.room(phase, move, progress(), age, box(), marks[0]);
        if (illusion()) {
          echoes.forEach((figure, i) => {
            if (figure.alive) drawBody(figure.y, i === trueSlot);
          });
        } else drawBody(boss.y, true);
        drawAttack();
      },
    };
  }
  return Object.fromEntries(
    Object.entries(profiles).map(([id, p]) => [id, { hint: p.hint, result: p.result, create }]),
  );
})();
