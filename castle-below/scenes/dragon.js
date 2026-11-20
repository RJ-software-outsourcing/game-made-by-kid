CastleScenes.dragon = {
  hint: "Tap the floor to move. Tap the dragon to cast. Hold Coji to shield.",
  assets: [
    "dragonPoses",
    "stormThrone",
    "stormBolt",
    "dragonBreath",
    "dragonSweep",
    "dragonFall",
    "dragonFallEmbers",
    "dragonCorona",
    "moltenSweep",
    "moltenGlow",
    "dragonSummon",
    "stormWind",
    "stormWebs",
    "livingFlames",
    "thunderImpact",
    "emberSconce",
    "cojiCast",
    "cojiCastUpper",
    "cojiGuard",
  ],
  create(game, sprite, sound, finish, retry) {
    const { canvas, ctx, player } = game;
    const poses = sprite("dragonPoses"),
      sweep = sprite("dragonSweep"),
      corona = sprite("dragonCorona"),
      summon = sprite("dragonSummon");
    const fire = sprite("dragonBreath"),
      bolt = sprite("stormBolt"),
      impact = sprite("thunderImpact");
    const weather = CastleScenes["dragon-weather"](game, sprite, bloom);
    const fall = CastleScenes["dragon-fall"](sprite);
    const magma = CastleScenes["dragon-magma"](sprite, project);
    const poseLayer = document.createElement("canvas");
    poseLayer.height = poses.width / 6;
    poseLayer.width = poseLayer.height * 2;
    const poseContext = poseLayer.getContext("2d");
    // Fade the outermost wisps to zero at the texture boundary as the plume billows.
    const plume = document.createElement("canvas");
    plume.width = fire.width;
    plume.height = fire.height;
    const plumeContext = plume.getContext("2d");
    plumeContext.drawImage(fire, 0, 0);
    plumeContext.globalCompositeOperation = "destination-in";
    const tail = plumeContext.createLinearGradient(0, 0, plume.width, 0);
    tail.addColorStop(0, "white");
    tail.addColorStop(0.79, "white");
    tail.addColorStop(1, "transparent");
    plumeContext.fillStyle = tail;
    plumeContext.fillRect(0, 0, plume.width, plume.height);
    for (let i = 0; i < 4; i++) {
      const h = plume.height / 4,
        y = i * h;
      const edge = plumeContext.createLinearGradient(0, y, 0, y + h);
      edge.addColorStop(0, "transparent");
      edge.addColorStop(0.14, "white");
      edge.addColorStop(0.86, "white");
      edge.addColorStop(1, "transparent");
      plumeContext.save();
      plumeContext.beginPath();
      plumeContext.rect(0, y, plume.width, h);
      plumeContext.clip();
      plumeContext.fillStyle = edge;
      plumeContext.fillRect(0, y, plume.width, h);
      plumeContext.restore();
    }
    const dragon = { type: "dragon", x: 7.5, y: 4.5, alive: true, hp: 1, maxHp: 1, hurt: 0 };
    const seen = new Set();
    let phase = "rest",
      attack = "",
      age = 0,
      duration = 2.6;
    let mark,
      damaged = false,
      blocked = false,
      finished = false;
    let outcomeStart = 0,
      initialDarkness = 0;
    let impactEvent = null;
    let sweepFromLeft = false;
    let summonStart = -Infinity,
      summonWarning = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const progress = () => clamp(age / duration, 0, 1);
    const bodySize = () => Math.min(canvas._w * 0.62, canvas._h * 0.48);
    const heroSize = () => Math.min(canvas._w * 0.28, canvas._h * 0.195);
    const terminal = () => phase === "fallen" || phase === "victory";
    const radius = 1.35;
    const spread = () => Math.min(2, (canvas._w * 0.97) / bodySize());

    // X runs away from the camera. Y runs left to right across the nine-wide apron.
    // Keep ground circles foreshortened on tall screens while framing the distant dais.
    const apronSpan = () => Math.min(canvas._h * 0.449, canvas._w * 0.29);
    function project(x, y, z = 0) {
      const k = 6 / (6 + x - 0.5);
      const depth = clamp((x - 1) / (dragon.x - 1), 0, 1);
      const lift = heroSize() * 0.66 * (1 - depth) + bodySize() * 0.49 * depth;
      const apron = apronSpan();
      const beyond = clamp((x - 3) / (dragon.x - 3), 0, 1);
      const span = apron + (0.449 * canvas._h - apron) * beyond * beyond;
      return {
        x: canvas._w * (0.5 + (y - 4.5) * 0.1 * k),
        y: canvas._h * 0.838 - span * (1 - k) - (z / 82) * lift,
      };
    }
    function ground(pos) {
      if (pos.y < canvas._h * 0.62) return null;
      const k = clamp(1 + (pos.y - canvas._h * 0.838) / apronSpan(), 6 / 7, 1);
      const x = 0.5 + 6 * (1 / k - 1);
      return { x, y: clamp(4.5 + ((pos.x / canvas._w - 0.5) * (6 + x - 0.5)) / 0.6, 0.5, 8.5) };
    }
    function hitHero(pos) {
      const p = project(player.x, player.y),
        h = heroSize();
      return (
        Math.hypot(
          (pos.x - p.x) / Math.max(23, h * 0.34),
          (pos.y - p.y + h * 0.47) / Math.max(24, h * 0.52),
        ) <= 1
      );
    }
    function hitDragon(pos) {
      const p = project(dragon.x, dragon.y),
        size = bodySize();
      const width = phase === "strike" && attack === "fire" ? size * spread() : size;
      return Math.hypot((pos.x - p.x) / (width * 0.5), (pos.y - p.y + size * 0.49) / (size * 0.53)) <= 1;
    }
    function enter(phaseName, seconds) {
      phase = phaseName;
      age = 0;
      duration = seconds;
    }
    function startAttack() {
      attack = attack === "lightning" ? "fire" : "lightning";
      if (attack === "fire") sweepFromLeft = !sweepFromLeft;
      magma.contact(null, game.time());
      mark = { x: player.x, y: player.y };
      damaged = blocked = false;
      enter("warning", (attack === "fire" ? 1.8 : 1.25) + (seen.has(attack) ? 0 : 0.45));
      if (attack === "lightning") {
        summonStart = game.time();
        summonWarning = duration;
      }
      seen.add(attack);
      game.roomHint.textContent = {
        lightning: "Move away from the rising sparks!",
        fire: "Hold Coji to shield against the flames!",
      }[attack];
    }
    // The single baked shot starts and ends at the idle pose. Frames 20–68 are
    // the actual sweep. Both directions use the same feet, tail and contact points.
    const fireBase = 100,
      leftFrame = 20,
      rightFrame = 68,
      lastFrame = 85;
    function fireFrame() {
      let first, last, position;
      if (phase === "warning") {
        first = sweepFromLeft ? 0 : lastFrame;
        last = sweepFromLeft ? leftFrame : rightFrame;
        position = progress();
      } else if (phase === "strike") {
        first = sweepFromLeft ? leftFrame : rightFrame;
        last = sweepFromLeft ? rightFrame : leftFrame;
        position = progress();
      } else {
        first = sweepFromLeft ? rightFrame : leftFrame;
        last = sweepFromLeft ? lastFrame : 0;
        position = clamp(age / 0.7, 0, 1);
      }
      return Math.round(first + (last - first) * position);
    }
    const tracks = {
      breathe: [0, 1, 0],
      summon: [26, 27, 28, 29, 30, 31],
      settle: [31, 30, 29, 28, 27, 26, 0],
    };
    function sample(track, fraction) {
      const f = clamp(fraction, 0, 1) * (track.length - 1);
      const i = Math.floor(f),
        t = f - i;
      return { from: track[i], to: track[Math.min(i + 1, track.length - 1)], mix: t * t * (3 - 2 * t) };
    }
    function animation() {
      if (phase === "victory") return sample([outcomeStart, 15, 16, 17], age / 0.95);
      if (attack === "fire" && (phase !== "rest" || age < 0.7)) {
        const id = fireBase + fireFrame();
        return { from: id, to: id, mix: 0 };
      }
      if (phase === "warning") return sample(tracks.summon, progress());
      if (phase === "strike") return { from: 31, to: 31, mix: 0 };
      if (attack === "lightning" && age < 0.7) return sample(tracks.settle, age / 0.7);
      if (dragon.hurt > 0) return sample([0, 8, 0], 1 - dragon.hurt / 0.28);
      return sample(tracks.breathe, (age % 2.4) / 2.4);
    }
    function spriteBox() {
      const p = project(dragon.x, dragon.y),
        w = bodySize();
      const h = w * (1 + (phase === "rest" || phase === "victory" ? 0.009 * Math.sin(age * 3.6) : 0));
      return { left: p.x - w / 2, top: p.y - h * 0.94, w, h };
    }
    // Registered jaw centers on the authored keyframes of the baked sweep.
    const jawKeys = [
      [20, 0.303, 0.274],
      [25, 0.334, 0.2894],
      [29, 0.3699, 0.3011],
      [34, 0.4117, 0.3123],
      [43, 0.4945, 0.321],
      [47, 0.5134, 0.3201],
      [52, 0.56, 0.3131],
      [55, 0.5805, 0.3063],
      [63, 0.6613, 0.2878],
      [68, 0.701, 0.274],
    ];
    function jawCenter(frame) {
      const i = jawKeys.findIndex((k) => k[0] >= frame);
      const b = jawKeys[i],
        a = jawKeys[Math.max(0, i - 1)];
      const u = (frame - a[0]) / Math.max(1, b[0] - a[0]);
      return { x: a[1] + (b[1] - a[1]) * u, y: a[2] + (b[2] - a[2]) * u };
    }
    function wingOffset(u) {
      const center = clamp(u, 0.25, 0.75);
      return 2 * (center - 0.5) + (u - center) * (spread() - 1) * 2;
    }
    function beam() {
      const b = spriteBox(),
        jaw = jawCenter(fireFrame());
      const start = { x: b.left + b.w * (0.5 + wingOffset(jaw.x)), y: b.top + b.h * jaw.y };
      const aim = project(1, -3.5 + 16 * (sweepFromLeft ? progress() : 1 - progress()));
      const slope = (aim.x - start.x) / (aim.y - heroSize() * 0.4 - start.y);
      const groundY = project(0.25, 4.5).y;
      const dx = slope * (groundY - start.y),
        dy = groundY - start.y;
      const length = Math.hypot(dx, dy);
      const landing = 4.5 + (((start.x + dx) / canvas._w - 0.5) * (0.25 + 5.5)) / 0.6;
      return {
        start,
        angle: Math.atan2(dy, dx),
        length,
        width: Math.min(canvas._h * 0.23, length * 0.31),
        landing,
      };
    }
    function shieldContact(b) {
      if (!player.guard) return b.length;
      const p = project(player.x, player.y),
        size = heroSize();
      const dx = p.x - b.start.x,
        dy = p.y - size * 0.47 - b.start.y;
      const along = dx * Math.cos(b.angle) + dy * Math.sin(b.angle);
      const across = dy * Math.cos(b.angle) - dx * Math.sin(b.angle),
        radius = size * 0.63;
      if (Math.abs(across) >= radius || along <= 0 || along >= b.length) return b.length;
      return Math.max(0, along - Math.sqrt(radius * radius - across * across));
    }
    function inFlame(b) {
      const { start, angle, length, width } = b,
        p = project(player.x, player.y);
      const dx = p.x - start.x,
        dy = p.y - heroSize() * 0.4 - start.y;
      const along = dx * Math.cos(angle) + dy * Math.sin(angle);
      const across = dy * Math.cos(angle) - dx * Math.sin(angle);
      return (
        along > 0 && along <= length && Math.abs(across) < width * (along / length) * 0.37 + heroSize() * 0.12
      );
    }
    function update(dt) {
      if (finished) return;
      age += dt;
      if (!player.moving) player.facing = 4;
      dragon.hurt = Math.max(0, dragon.hurt - dt);
      if (impactEvent && game.time() - impactEvent.time > 0.95) impactEvent = null;
      if (terminal()) {
        if (phase === "fallen" && age - dt < fall.groundAt && age >= fall.groundAt) playSound("landing");
        if (age >= duration) {
          finished = true;
          if (phase === "fallen") finish();
          else retry();
        }
        return;
      }
      if (phase === "rest" && age >= duration) startAttack();
      else if (phase === "warning" && age >= duration) {
        enter("strike", attack === "fire" ? 2.05 : 0.62);
        playSound(attack);
        if (attack === "lightning") {
          impactEvent = { ...mark, time: game.time() };
          if (Math.hypot(player.x - mark.x, player.y - mark.y) <= radius) game.damagePlayer(false);
        }
      } else if (phase === "strike") {
        if (attack === "fire") {
          const jet = beam();
          magma.contact(shieldContact(jet) < jet.length ? null : jet.landing, game.time());
          if (!damaged && inFlame(jet)) {
            if (!player.guard || !blocked) game.damagePlayer();
            blocked = player.guard;
            damaged = !player.guard;
          }
        }
        if (!terminal() && age >= duration) {
          enter("rest", dragon.hp > dragon.maxHp * 0.35 ? 3.1 : 2.2);
          game.roomHint.textContent = "The dragon is catching its breath. Cast now!";
        }
      }
    }
    function endBattle(playerWon) {
      if (terminal()) return;
      const current = animation();
      outcomeStart = current.mix < 0.5 ? current.from : current.to;
      initialDarkness = blackout();
      game.stop();
      enter(playerWon ? "fallen" : "victory", playerWon ? fall.endAt : 2.05);
      quiet();
      playSound(playerWon ? "lastRoar" : "rumble");
      game.roomHint.textContent = playerWon ? "" : "The dragon roars in victory!";
    }

    let noise, roar;
    const voices = new Set();
    function playSound(kind) {
      const ac = sound();
      if (!ac || ac.state !== "running") return;
      if (!noise) {
        noise = ac.createBuffer(1, Math.ceil(ac.sampleRate * 2.7), ac.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      function burst(delay, seconds, high, low, gain) {
        const source = ac.createBufferSource(),
          filter = ac.createBiquadFilter(),
          volume = ac.createGain();
        const t = ac.currentTime + delay;
        source.buffer = noise;
        filter.type = "lowpass";
        filter.Q.value = 0.65;
        filter.frequency.setValueAtTime(high, t);
        filter.frequency.exponentialRampToValueAtTime(low, t + seconds);
        volume.gain.setValueAtTime(0.001, t);
        volume.gain.exponentialRampToValueAtTime(gain, t + 0.014);
        volume.gain.exponentialRampToValueAtTime(0.001, t + seconds);
        source.connect(filter).connect(volume).connect(ac.destination);
        voices.add(source);
        source.onended = () => {
          voices.delete(source);
          source.disconnect();
          filter.disconnect();
          volume.disconnect();
        };
        source.start(t);
        source.stop(t + seconds + 0.01);
      }
      if (kind === "lightning") {
        burst(0, 0.19, 11000, 920, 0.64);
        burst(0.045, 0.62, 2000, 180, 0.64);
        burst(0.12, 1.75, 470, 55, 0.9);
        burst(0.43, 1.75, 310, 50, 0.55);
      } else if (kind === "fire") {
        burst(0, 2.05, 3500, 280, 0.48);
        burst(0.55, 1.45, 1200, 340, 0.3);
      } else if (kind === "lastRoar") {
        const source = ac.createBufferSource();
        roar ??= CastleScenes["dragon-roar"](ac);
        source.buffer = roar;
        source.connect(ac.destination);
        voices.add(source);
        source.onended = () => {
          voices.delete(source);
          source.disconnect();
        };
        source.start();
        burst(0.24, 1.55, 350, 48, 0.46);
        burst(1.36, 0.38, 2400, 330, 0.22);
        burst(2.13, 1.14, 420, 66, 0.39);
      } else if (kind === "landing") {
        burst(0, 0.26, 1700, 150, 0.53);
        burst(0.025, 1.74, 280, 42, 0.92);
        burst(0.18, 0.76, 900, 120, 0.31);
      } else burst(0.02, 1.15, 630, 65, 0.78);
    }
    function quiet() {
      for (const source of voices) source.stop();
    }

    function bloom(x, y, rx, ry, inner, outer) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(rx, ry);
      const light = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      light.addColorStop(0, inner);
      light.addColorStop(0.4, outer);
      light.addColorStop(1, "transparent");
      ctx.fillStyle = light;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
    // Keep the torso at its true scale on narrow phones; compress only the outer wings.
    function paintFireCel(g, image, frame, b, glow = false) {
      const sw = image.width / 7,
        sh = image.height / 13;
      const sx = (frame % 7) * sw,
        sy = Math.floor(frame / 7) * sh;
      const marginX = glow ? 20 / 176 : 0,
        marginY = glow ? 16 / 88 : 0;
      const top = b.top - marginY * b.h,
        height = b.h * (1 + 2 * marginY);
      const cuts = spread() >= 1.999 ? [-marginX, 1 + marginX] : [-marginX, 0.25, 0.75, 1 + marginX];
      for (let i = 1; i < cuts.length; i++) {
        const u = cuts[i - 1],
          v = cuts[i],
          start = b.left + b.w * (0.5 + wingOffset(u));
        g.drawImage(
          image,
          sx + (sw * (u + marginX)) / (1 + 2 * marginX),
          sy,
          (sw * (v - u)) / (1 + 2 * marginX),
          sh,
          start,
          top,
          b.w * (wingOffset(v) - wingOffset(u)),
          height,
        );
      }
    }
    function paintPose(g, id, b) {
      if (id >= fireBase) {
        paintFireCel(g, sweep, id - fireBase, b);
        return;
      }
      const isSummon = id >= 26;
      const sheet = isSummon ? summon : poses,
        cols = isSummon ? 3 : 6;
      const cell = isSummon ? id - 26 : id,
        size = sheet.width / cols;
      g.drawImage(
        sheet,
        (cell % cols) * size,
        Math.floor(cell / cols) * size,
        size,
        size,
        b.left,
        b.top + (isSummon ? 0.035 * b.h : 0),
        b.w,
        b.h,
      );
    }
    function fireHeat() {
      if (attack !== "fire") return 0;
      if (phase === "warning") return progress() ** 1.6;
      if (phase === "strike") return 1;
      return phase === "rest" ? Math.max(0, 1 - age / 0.7) : 0;
    }
    function drawDragon() {
      const b = spriteBox();
      bloom(b.left + b.w * 0.5, b.top + b.h * 0.934, b.w * 0.5, b.h * 0.054, "#100c11d9", "#12101baa");
      if (phase === "fallen") {
        fall.draw(ctx, b, age, () => paintPose(ctx, outcomeStart, b));
        drawLandingDust(b);
        return;
      }
      const heat = fireHeat(),
        frame = animation();
      if (heat > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = heat * (0.84 + 0.12 * Math.sin(game.time() * 8));
        bloom(
          b.left + b.w * 0.5,
          b.top + b.h * 0.53,
          b.w * spread() * 0.66,
          b.h * 0.69,
          "#ff9f39e0",
          "#ff491b8a",
        );
        bloom(b.left + b.w * 0.5, b.top + b.h * 0.96, b.w * 0.8, b.h * 0.11, "#ffb748a6", "#eb4d204a");
        ctx.restore();
      }
      if (frame.mix === 0 || frame.from === frame.to) {
        paintPose(ctx, frame.from, b);
      } else {
        const size = poseLayer.height,
          box = { left: size / 2, top: 0, w: size, h: size };
        poseContext.clearRect(0, 0, poseLayer.width, size);
        poseContext.globalCompositeOperation = "lighter";
        poseContext.globalAlpha = 1 - frame.mix;
        paintPose(poseContext, frame.from, box);
        poseContext.globalAlpha = frame.mix;
        paintPose(poseContext, frame.to, box);
        ctx.drawImage(poseLayer, b.left - b.w * 0.5, b.top, b.w * 2, b.h);
      }
      if (heat > 0 && frame.from >= fireBase) {
        const t = game.time();
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = heat * (0.54 + 0.065 * Math.sin(t * 9.1));
        paintFireCel(ctx, corona, frame.from - fireBase, b, true);
        bloom(b.left + b.w * 0.5, b.top + b.h * 0.51, b.w * 0.32, b.h * 0.48, "#ffb9508a", "#ff681c46");
        // Backlit cinders rise from the shoulder ridges and across both membranes.
        if (game.effects())
          for (let i = 0; i < 50; i++) {
            const travel = (t * (0.51 + (i % 4) * 0.09) + i * 0.618) % 1,
              side = i % 2 ? -1 : 1;
            const wing = (i % 13) / 13,
              spreadHeat = 0.56 + 0.44 * heat;
            const x =
              b.left +
              b.w * (0.5 + side * wing * spread() * 0.48 * spreadHeat) +
              b.w * travel * 0.035 * Math.sin(i * 42 + t);
            const y = b.top + b.h * (0.61 - 0.21 * wing + 0.08 * Math.sin(i * 9) - travel * 0.64);
            ctx.globalAlpha = heat * Math.sin(Math.PI * travel) * 0.8;
            ctx.fillStyle = i % 3 ? "#ffad45" : "#fff0b3";
            ctx.fillRect(x, y, 1 + wing, 1.8 + 2.8 * travel);
          }
        ctx.restore();
      }
    }
    function drawLandingDust(b) {
      const t = age - fall.groundAt;
      if (t < 0 || t > 1.5) return;
      ctx.save();
      ctx.globalAlpha = clamp(1 - t / 1.5, 0, 1);
      for (let i = 0; i < 16; i++) {
        const a = i * 2.399,
          r = b.w * (0.1 + 0.22 * t);
        bloom(
          b.left + b.w * 0.5 + Math.cos(a) * r,
          b.top + b.h * 0.94 - Math.abs(Math.sin(a)) * b.h * t * 0.11,
          b.w * (0.03 + 0.06 * t),
          b.h * (0.02 + 0.035 * t),
          "#b09a7a68",
          "#81796c30",
        );
      }
      ctx.restore();
    }
    function drawCharge() {
      const p = project(mark.x, mark.y),
        t = game.time(),
        power = progress();
      const rx = project(mark.x, mark.y + radius).x - p.x,
        ry = p.y - project(mark.x + radius, mark.y).y;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.48 + 0.5 * power;
      bloom(p.x, p.y, rx * 1.21, ry * 1.5, "#cbe0ffe8", "#777aff93");
      // Disconnected leaders creep through the surface toward the future strike point.
      for (let i = 0; i < 7; i++) {
        const a = i * 2.399 + 0.22 * Math.sin(t * 1.2 + i),
          reach = 0.45 + 0.49 * Math.abs(Math.sin(i * 1.84));
        ctx.beginPath();
        for (let j = 0; j <= 9; j++) {
          const u = j / 9,
            offset = Math.sin(j * 23 + i * 13 + Math.floor(t * 9)) * 0.065 * u;
          const x = p.x + rx * (Math.cos(a) * u * reach + Math.sin(a) * offset);
          const y = p.y + ry * (Math.sin(a) * u * reach - Math.cos(a) * offset);
          if (j) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.strokeStyle = i % 3 ? "#a5b6edbb" : "#d5eaffe8";
        ctx.lineWidth = 1 + power * 0.65;
        ctx.stroke();
      }
      const count = game.effects() ? 34 : 11;
      for (let i = 0; i < count; i++) {
        const lift = (t * (0.52 + (i % 5) * 0.1) + i * 0.619) % 1,
          a = i * 2.399,
          r = (0.16 + 0.8 * Math.abs(Math.sin(i * 55))) * (1 - lift * 0.42);
        const x = p.x + Math.cos(a) * rx * r,
          y = p.y + Math.sin(a) * ry * r - lift * ry * (0.9 + power);
        ctx.fillStyle = "rgba(212,232,255," + Math.sin(lift * Math.PI) + ")";
        ctx.fillRect(x, y, 1.3, 2 + lift * power * 4);
      }
      ctx.restore();
    }
    function drawImpact() {
      if (!impactEvent) return;
      const age = game.time() - impactEvent.time,
        p = project(impactEvent.x, impactEvent.y);
      const width = Math.min(canvas._w * 0.72, canvas._h * 0.5),
        h = (p.y + 20) / 0.974;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = Math.max(0, 1 - age / 0.48) ** 1.4;
      ctx.drawImage(bolt, p.x - h * 0.355, p.y - h * 0.974, h * 0.71, h);
      bloom(p.x, p.y, width * 0.62, width * 0.22, "#ffffff", "#aacbffb0");
      ctx.restore();
      const frames = sample([0, 1, 2, 3], age / 0.78);
      ctx.save();
      const remaining = clamp((0.95 - age) / 0.28, 0, 1);
      const sh = impact.height / 2,
        sw = impact.width / 2,
        height = (width * sh) / sw;
      for (const [id, alpha] of [
        [frames.from, 1 - frames.mix],
        [frames.to, frames.mix],
      ]) {
        if (!alpha) continue;
        ctx.globalAlpha = remaining * alpha;
        ctx.drawImage(
          impact,
          (id % 2) * sw,
          Math.floor(id / 2) * sh,
          sw,
          sh,
          p.x - width / 2,
          p.y - height * 0.96,
          width,
          height,
        );
      }
      ctx.restore();
    }
    function drawImpactDebris() {
      if (!impactEvent || !game.effects()) return;
      const age = game.time() - impactEvent.time,
        p = project(impactEvent.x, impactEvent.y);
      const size = Math.min(canvas._w * 0.58, canvas._h * 0.39);
      ctx.save();
      for (let i = 0; i < 30; i++) {
        const a = i * 2.399,
          speed = 0.38 + 0.54 * Math.abs(Math.sin(i * 39));
        const dx = Math.cos(a) * speed,
          dy = Math.sin(a) * 0.22 - speed * 0.64;
        const x = p.x + size * dx * age,
          y = p.y + size * (dy * age + age * age * 0.64);
        if (y > p.y + size * 0.09) continue;
        ctx.globalAlpha = Math.max(0, 1 - age / 0.82);
        ctx.strokeStyle = i % 4 ? "#d2e6ff" : "#505467";
        ctx.lineWidth = i % 4 ? 1.4 : 2.7;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - size * dx * 0.029, y - size * (dy + age * 1.28) * 0.029);
        ctx.stroke();
      }
      ctx.restore();
    }
    function drawFire() {
      const b = beam(),
        frame = Math.floor(age * 18) % 4,
        h = plume.height / 4;
      const length = shieldContact(b);
      const intercepted = length < b.length;
      ctx.save();
      ctx.globalAlpha = Math.min(1, age * 14, (duration - age) * 10);
      ctx.translate(b.start.x, b.start.y);
      ctx.rotate(b.angle);
      const sourceWidth = (plume.width * length) / b.length;
      ctx.drawImage(plume, 0, frame * h, sourceWidth, h, 0, -b.width * 0.5, length, b.width);
      if (intercepted) {
        bloom(length, 0, b.width * 0.3, b.width * 0.25, "#fff9d9", "#ffb35fba");
        if (game.effects()) {
          for (let i = 0; i < 14; i++) {
            const t = (age * 2 + i * 0.618) % 1;
            const side = i % 2 ? 1 : -1;
            ctx.fillStyle = "rgba(255,221,164," + (1 - t) + ")";
            ctx.fillRect(length - t * t * 28, side * t * b.width * 0.48, 2, 2 + t * 2);
          }
        }
      }
      ctx.globalCompositeOperation = "screen";
      bloom(0, 0, b.width * 0.21, b.width * 0.21, "#ffffdc", "#ff9339a0");
      ctx.restore();
    }
    function blackout() {
      if (phase === "fallen") return fall.darkness(age, initialDarkness);
      const elapsed = game.time() - summonStart;
      return clamp(elapsed / 0.1, 0, 1) * clamp(1 - (elapsed - summonWarning - 0.09) / 0.63, 0, 1);
    }
    function shadeForeground() {
      const darkness = blackout();
      if (!darkness) return;
      ctx.fillStyle = "rgba(4,7,22," + 0.37 * darkness + ")";
      ctx.fillRect(-10, -10, canvas._w + 20, canvas._h + 20);
    }
    function cameraOffset() {
      if (!game.effects() || reducedMotion.matches) return { x: 0, y: 0 };
      const t = game.time();
      const rumble = phase === "warning" && attack === "lightning" ? progress() ** 2 * 1.8 : 0;
      const kick = impactEvent ? 7 * Math.exp(-(t - impactEvent.time) * 8) : 0;
      const contactAge = age - fall.groundAt;
      const landing = phase === "fallen" && contactAge >= 0 ? 5 * Math.exp(-contactAge * 6.5) : 0;
      const power = (rumble + kick + landing) * Math.min(1, canvas._w / 650);
      return { x: power * Math.sin(t * 71), y: power * Math.cos(t * 57) * 0.78 };
    }
    function draw() {
      const falling = phase === "fallen";
      weather.draw(blackout(), falling ? age : game.time() - summonStart, falling);
      drawDragon();
      magma.draw(ctx, canvas, game.time());
      if (phase === "warning" && attack === "lightning") drawCharge();
      if (phase === "strike" && attack === "fire") drawFire();
      drawImpact();
    }
    return {
      dragon,
      ground,
      project,
      hitHero,
      hitDragon,
      heroSize,
      draw,
      drawImpactDebris,
      shadeForeground,
      cameraOffset,
      update,
      endBattle,
      quiet,
      terminal,
      vulnerable: () => phase === "rest",
    };
  },
};
