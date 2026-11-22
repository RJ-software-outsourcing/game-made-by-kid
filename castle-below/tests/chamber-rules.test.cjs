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
test("The watchful eye gives both stop rules a full blink of reaction time", () => {
  const eye = context.CastleScenes.eye;
  for (const period of [4.9, 5.75]) {
    assert.equal(eye.lids(0, period), 0);
    assert.equal(eye.lids(period * 0.44 + 0.56, period), 1);
    assert.ok(Math.abs(eye.lids(period - 0.275, period) - 0.5) < 0.001);
    assert.ok(Math.abs(eye.lids(period * 0.44 + 0.275, period) - 0.5) < 0.001);
  }
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
