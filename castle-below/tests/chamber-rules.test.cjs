const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const context = vm.createContext({ CastleScenes: {} });
for (const name of ["star-optics", "chamber-rules", "eye", "performance-frames", "meridian-models"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../scenes", name + ".js"), "utf8"), context);
}
test("Every attack has a complete registered clip and returns to its neutral pose", () => {
  for (const [boss, clips] of Object.entries(context.CastleScenes["performance-frames"])) {
    const attacks = new Set(
      context.CastleScenes["chamber-rules"].variants[boss].flatMap((rule) => rule.pattern),
    );
    const neutral = clips.life[0].slice(4);
    for (const attack of attacks) {
      const frames = clips[attack];
      assert.equal(frames.length, 45, boss + " " + attack);
      assert.deepEqual(frames[0].slice(4), neutral);
      assert.deepEqual(frames.at(-1).slice(4), neutral);
      assert.ok(
        fs.existsSync(path.join(__dirname, "../assets/performance-" + boss + "-" + attack + ".webp")),
      );
    }
  }
});
const optics = context.CastleScenes["star-optics"];
for (let board = 0; board < 3; board++) {
  test("All three goals on star chart " + (board + 1) + " have a unique three-mirror solution", () => {
    const chart = optics.chart(board);
    for (let goal = 0; goal < 3; goal++) {
      const answers = optics.solutions(goal, chart);
      assert.equal(answers.length, 1);
      const result = optics.trace(answers[0], chart);
      assert.equal(result.target, goal);
      assert.equal(result.full, true);
    }
  });
}
test("Every new room and the dragon offer different playable rules", () => {
  for (const [room, rules] of Object.entries(context.CastleScenes["chamber-rules"].variants)) {
    assert.ok(rules.length >= 2, room);
    assert.equal(new Set(rules.map((r) => r.text)).size, rules.length, room);
    const parameters = rules.map(({ text, ...params }) => JSON.stringify(params));
    assert.equal(new Set(parameters).size, rules.length, room + " parameters");
    if (rules[0].pattern)
      for (const r of rules) {
        assert.deepEqual([...new Set(r.pattern)].sort(), [...new Set(rules[0].pattern)].sort());
      }
  }
});
test("The watchful eye sleeps long enough for one dash between statues", () => {
  const eye = context.CastleScenes.eye;
  for (const period of [6.6, 7.4]) {
    assert.equal(eye.lids(0, period), 1);
    const close = period - 3.5;
    assert.equal(eye.lids(close + 0.6, period), 0);
    assert.equal(eye.lids(close + 2.9, period), 0);
    assert.ok(Math.abs(eye.lids(close + 0.275, period) - 0.5) < 0.001);
    assert.ok(Math.abs(eye.lids(period - 0.275, period) - 0.5) < 0.001);
  }
  // The longest dash is between two statues at Coji's walking pace (3.4 tiles/s).
  const gaps = eye.covers.slice(1).map((c, i) => Math.hypot(c.x - eye.covers[i].x, c.y - eye.covers[i].y));
  assert.ok(Math.max(...gaps) / 3.4 < eye.shutLength * 0.6);
});

test("The beam strikes the finite pane and reflects about its actual tangent", () => {
  let edgeHit = false;
  const layout = optics.chart(0);
  for (let n = 0; n <= 80; n++) {
    const angles = layout.stops.map((list, i) => list[0] + (i === 0 ? n * 0.002 : 0));
    const ray = optics.trace([0, 0, 0], layout, angles);
    ray.contacts.forEach((id, index) => {
      const [a, b, c] = ray.path.slice(index, index + 3);
      if (!c) return;
      const m = layout.mounts[id],
        angle = angles[id];
      const offset = Math.hypot(b.x - m.x, b.y - m.y);
      if (offset > 0.005) edgeHit = true;
      const glass = context.CastleScenes["meridian-models"];
      const u = (b.x - m.x) * Math.cos(angle) + (b.y - m.y) * Math.sin(angle);
      const v = -(b.x - m.x) * Math.sin(angle) + (b.y - m.y) * Math.cos(angle);
      assert.ok(Math.abs(u) <= glass.radius * 0.945 + 1e-6);
      assert.ok(Math.abs(Math.abs(v) - (glass.silverOffset + (glass.sag * u * u) / glass.radius)) < 1e-8);
      const tangent = angle + Math.atan((Math.sign(v) * 2 * glass.sag * u) / glass.radius);
      const incoming = Math.atan2(b.y - a.y, b.x - a.x),
        outgoing = Math.atan2(c.y - b.y, c.x - b.x);
      assert.ok(Math.cos(outgoing - (2 * tangent - incoming)) > 1 - 1e-8);
    });
  }
  assert.ok(edgeHit, "a beam can catch a turning mirror away from the pin");
});

test("The light port and all three floor mounts stay registered through camera changes", () => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../scenes/meridian-room.js"), "utf8"), context);
  const room = context.CastleScenes["meridian-room"];
  for (const [width, height] of [
    [1120, 938],
    [1250, 800],
    [320, 667],
    [390, 844],
    [844, 390],
  ]) {
    for (const lane of [0.6, 4.5, 8.4]) {
      const c = room.camera(width, height, lane, 0.75);
      for (let i = 0; i < 3; i++) {
        const chart = optics.chart(i),
          port = c.platePoint(c.plate.outlet),
          light = c.project(chart.lamp, context.CastleScenes["meridian-models"].beamHeight);
        assert.ok(Math.hypot(port.x - light.x, port.y - light.y) < 1e-6);
        for (const p of [...chart.mounts, ...chart.targets]) {
          const foot = c.project(p),
            axle = c.project(p, context.CastleScenes["meridian-models"].beamHeight);
          assert.ok(axle.y < foot.y && axle.x > 21 && axle.x < width - 21 && foot.y < height);
          assert.ok(foot.size > light.size);
        }
      }
    }
  }
});

test("The three optical spindles sit on the common rack and the mirror has two physical silver faces", () => {
  const models = context.CastleScenes["meridian-models"];
  for (let i = 0; i < 3; i++) {
    const layout = optics.chart(i),
      rail = models.rail(layout);
    for (const p of layout.mounts)
      assert.ok(Math.abs(Math.hypot(p.x - rail.center.x, p.y - rail.center.y) - rail.radius) < 1e-9);
  }
  const mirror = models.mirror();
  const points = mirror.triangles
    .filter((t) => t[3] === "silver")
    .flatMap((t) => t.slice(0, 3).map((id) => mirror.vertices[id]));
  for (const p of points) {
    const h = p[2] - models.beamHeight / models.radius;
    assert.ok(
      Math.abs(Math.abs(p[1]) - models.silverOffset / models.radius - models.sag * (p[0] * p[0] + h * h)) <
        1e-8,
    );
  }
  assert.ok(points.some((p) => p[1] > 0.15) && points.some((p) => p[1] < -0.15));
});

// ---------------------------------------------------------------- reading rules
// Each craft room writes its scroll from the same parameters the puzzle checks. These tests
// play every mode many times and confirm the sentence leads to exactly one right action.
const rules = context.CastleScenes["chamber-rules"];
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const RUNS = 200;
function eachRule(room, fn) {
  for (const mode of rules.crafts[room].modes)
    for (let n = 1; n <= RUNS; n++) fn(rules.generate(room, { mode: mode.id, rnd: seeded(n * 7919 + mode.tier) }), mode);
}
const words = (text) => text.split(/[^A-Za-z0-9]+/).filter(Boolean).length;

test("Every craft mode writes short, child-sized sentences", () => {
  for (const room of Object.keys(rules.crafts))
    eachRule(room, (rule) => {
      const lines = [rule.text, ...(rule.rounds || []).map((r) => r.line).filter(Boolean)];
      for (const line of lines) {
        assert.ok(line.length > 0, room);
        for (const sentence of line.split(/[.!?]/).filter((x) => x.trim()))
          assert.ok(words(sentence) <= 13, room + ": " + sentence);
      }
    });
});

test("Bell names point at one bell, and every bell round has an answer", () => {
  eachRule("bells", (rule) => {
    const { size } = rule.layout;
    assert.equal(rule.rounds.length, 3);
    for (const round of rule.rounds) {
      assert.ok(round.answer.length > 0, rule.mode);
      if (round.melody) assert.ok(round.melody.every((b, i) => i === 0 || b !== round.melody[i - 1]));
      if (round.line) {
        // "big" and "small" are only used for the largest and smallest bell.
        for (const m of round.line.matchAll(/the (big|small) bell/g))
          assert.equal(size.filter((v) => v === (m[1] === "big" ? 0 : 2)).length, 1);
      }
    }
    if (rule.mode === "skip") for (const r of rule.rounds) assert.ok(!r.answer.includes(rule.banned) && r.melody.includes(rule.banned));
    if (rule.mode === "back") for (const r of rule.rounds) assert.deepEqual(r.answer, r.melody.slice().reverse());
  });
});

test("Each water-gate line has a reachable answer and a ban leaves exactly one way", () => {
  eachRule("sluice", (rule) => {
    const w = rule.layout.weights;
    const sets = [1, 2, 3, 4, 5, 6, 7].map((m) => [0, 1, 2].map((i) => !!(m & (1 << i))));
    const sum = (open) => open.reduce((s, o, i) => s + (o ? w[i] : 0), 0);
    assert.ok(rule.rounds.length >= 2, rule.mode);
    for (const round of rule.rounds) {
      const fits = sets.filter((o) => sum(o) === round.target && (!round.exact || o.every((v, i) => v === round.exact[i])));
      assert.ok(fits.length >= 1, rule.mode + " " + round.line);
      if (round.exact) assert.equal(fits.length, 1);
      if (round.then !== undefined) assert.ok(sets.some((o) => sum(o) === round.then) && round.then < round.target);
      if (rule.mode === "reach" || rule.mode === "not")
        assert.equal(Number(round.line.match(/reach\s(\d+)/)[1]), round.target);
      if (rule.mode === "not") {
        const banned = ["left", "middle", "right"].findIndex((s) => round.line.includes("the " + s + " wheel"));
        assert.ok(banned >= 0);
        const ways = sets.filter((o) => sum(o) === round.target && !o[banned]);
        assert.equal(ways.length, 1, round.line);
      }
    }
  });
});

test("Every ice question has three different answers and one right one", () => {
  eachRule("ice", (rule) => {
    assert.equal(rule.rows.length, rules.iceRows + 1);
    const asked = new Set();
    for (const row of rule.rows.slice(1)) {
      assert.equal(row.answers.length, 3);
      assert.equal(new Set(row.answers).size, 3, row.q);
      assert.ok(row.right >= 0 && row.right < 3, row.q);
      assert.ok(words(row.q) <= 9, row.q);
      assert.ok(!asked.has(row.q), "repeated " + row.q);
      asked.add(row.q);
    }
    if (rule.mode === "not") assert.ok(rule.rows.some((r) => r && /NOT/.test(r.q)));
  });
});

test("Every forge recipe heats before it hits, and the counts match the scroll", () => {
  const counts = { "one time": 1, "two times": 2, "three times": 3 };
  eachRule("forge", (rule) => {
    assert.equal(rule.steps[0].act, "heat");
    const said = [...rule.text.matchAll(/hit it (one time|two times|three times)/gi)].map((m) => counts[m[1]]);
    const runs = [];
    for (const step of rule.steps) {
      if (step.act === "hit") runs[runs.length - 1]++;
      if (step.act === "heat") runs.push(0);
    }
    assert.deepEqual(runs, said, rule.text);
    assert.equal(rule.steps.at(-1).act === "cool", /cool it/.test(rule.text));
    const named = rule.text.match(/the (left|right) fire/);
    const fire = rule.steps[0].fire;
    if (/Do not use/.test(rule.text)) assert.equal(fire, named[1] === "left" ? 1 : 0);
    else if (named) assert.equal(fire, named[1] === "left" ? 0 : 1);
    else assert.equal(fire, null);
  });
});

test("A new visit skips the last mode when another one is available", () => {
  for (const room of Object.keys(rules.crafts))
    for (let n = 1; n < 50; n++) {
      const first = rules.generate(room, { rnd: seeded(n) });
      const next = rules.generate(room, { rnd: seeded(n + 999), avoid: first.mode });
      assert.notEqual(next.mode, first.mode, room);
      assert.ok(rules.generate(room, { tier: 0, rnd: seeded(n) }).tier === 0);
    }
});

test("Every telescope clue points at things that exist in the lookout view", () => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../scenes/annex-games.js"), "utf8"), context);
  const art = context.CastleScenes["annex-games"].LOOKOUT_ART;
  eachRule("lookout", (rule) => {
    assert.equal(rule.rounds.length, 3);
    for (const round of rule.rounds) {
      assert.ok(round.find.length > 0);
      for (const id of round.find) assert.ok(art[id], id);
      assert.ok(round.line.length > 0);
    }
    assert.equal(new Set(rule.rounds.map((r) => r.line)).size, 3);
  });
});

test("Every grabber round asks for a different prize that is in the cabinet", () => {
  eachRule("claw", (rule) => {
    const prizes = rule.rounds.map((r) => r.prize);
    assert.equal(new Set(prizes).size, prizes.length);
    for (const p of prizes) assert.ok(rule.order.includes(p), p);
    assert.equal(new Set(rule.order).size, 6);
  });
});
