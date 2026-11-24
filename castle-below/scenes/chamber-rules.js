// The scroll, set dressing and success test share these per-visit parameters.
//
// Craft rooms (bells, sluice, mirrors, ice, forge) build a fresh rule on every visit.
// A rule is a play mode plus the parameters that change the answer, and its English
// sentence is written from those same parameters. Nothing in the room repeats the
// sentence: the child has to read the scroll to know what to do.
CastleScenes["chamber-rules"] = (() => {
  const signs = ["sun", "moon", "star"];
  const colors = ["red", "blue", "yellow"];
  const sides = ["left", "middle", "right"];
  const times = ["", "one time", "two times", "three times"];
  const cap = (text) => text[0].toUpperCase() + text.slice(1);

  const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];
  function shuffle(list, rnd) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  const range = (n) => Array.from({ length: n }, (_, i) => i);

  // ---------------------------------------------------------------- bells
  // Three bells hang left, middle and right. Each visit shuffles which one is big or
  // small and which metal it is cast in (gold, silver or red-painted bronze), so "left",
  // "big" and "gold" are usually different bells and the child must read the word that matters.
  const finishes = ["gold", "silver", "red"];
  function bellLayout(rnd) {
    return { size: shuffle([0, 1, 2], rnd), finish: shuffle([0, 1, 2], rnd) };
  }
  // A short phrase that names exactly one bell: "big", "red" or "left".
  function bellName(layout, bell, rnd, kinds = ["size", "color", "side"]) {
    const kind = pick(
      kinds.filter((k) => k !== "size" || layout.size[bell] !== 1),
      rnd,
    );
    if (kind === "size") return layout.size[bell] === 0 ? "big" : "small";
    if (kind === "color") return finishes[layout.finish[bell]];
    return sides[bell];
  }
  // Never the same bell twice in a row: easier to follow by ear and by eye.
  function melody(length, rnd, must) {
    const notes = [];
    for (let i = 0; i < length; i++) {
      const last = notes[i - 1];
      notes.push(last === undefined ? Math.floor(rnd() * 3) : (last + 1 + Math.floor(rnd() * 2)) % 3);
    }
    // `must` is absent, so neither neighbour can equal it.
    if (must !== undefined && !notes.includes(must)) notes[Math.floor(rnd() * length)] = must;
    return notes;
  }
  const bellModes = [
    {
      id: "echo",
      tier: 0,
      label: "Same order",
      make(rnd) {
        const rounds = [3, 4, 4].map((n) => ({ melody: melody(n, rnd) }));
        rounds.forEach((r) => (r.answer = r.melody));
        return {
          rounds,
          text: "Listen to the bells. Then ring them in the same order.",
        };
      },
    },
    {
      id: "count",
      tier: 0,
      label: "Ring it two times",
      make(rnd, layout) {
        const bells = shuffle([0, 1, 2], rnd);
        const rounds = [0, 1, 2].map((round) => {
          const a = bells[round],
            n = round === 0 ? 2 + Math.floor(rnd() * 2) : 1 + Math.floor(rnd() * 3);
          let line = "Ring the " + bellName(layout, a, rnd) + " bell " + times[n] + ".";
          const answer = Array(n).fill(a);
          if (round === 2) {
            const b = bells[0];
            line += " Then ring the " + bellName(layout, b, rnd) + " bell one time.";
            answer.push(b);
          }
          return { answer, line };
        });
        return { rounds, text: rounds[0].line, perRound: true };
      },
    },
    {
      id: "back",
      tier: 1,
      label: "Last to first",
      make(rnd) {
        const rounds = [3, 3, 4].map((n) => {
          const m = melody(n, rnd);
          return { melody: m, answer: m.slice().reverse() };
        });
        return { rounds, text: "Listen to the bells. Then ring them from last to first." };
      },
    },
    {
      id: "skip",
      tier: 1,
      label: "Do not ring one",
      make(rnd, layout) {
        const banned = Math.floor(rnd() * 3);
        const name = bellName(layout, banned, rnd, ["color", "size"]);
        const rounds = [4, 4, 5].map((n) => {
          const m = melody(n, rnd, banned);
          return { melody: m, answer: m.filter((b) => b !== banned) };
        });
        return {
          rounds,
          banned,
          text: "Listen to the bells. Ring them in the same order, but do not ring the " + name + " bell.",
        };
      },
    },
    {
      id: "ends",
      tier: 2,
      label: "First and last",
      make(rnd) {
        const rounds = [3, 4, 5].map((n) => {
          let m = melody(n, rnd);
          return { melody: m, answer: [m[0], m[m.length - 1]] };
        });
        return { rounds, text: "Listen to the bells. Ring only the first bell and the last bell." };
      },
    },
    {
      id: "howmany",
      tier: 2,
      label: "How many times?",
      make(rnd, layout) {
        const bell = Math.floor(rnd() * 3);
        const name = bellName(layout, bell, rnd);
        const rounds = [4, 5, 5].map((n, round) => {
          const want = 1 + ((round + Math.floor(rnd() * 3)) % 3);
          // Aim for `want` rings; the bell always rings at least once.
          let m;
          for (let tries = 0; tries < 200; tries++) {
            m = melody(n, rnd, bell);
            if (m.filter((b) => b === bell).length === want) break;
          }
          const count = m.filter((b) => b === bell).length;
          return { melody: m, answer: Array(count).fill(bell) };
        });
        return {
          rounds,
          text: "Listen. How many times does the " + name + " bell ring? Ring it that many times.",
        };
      },
    },
  ];

  // --------------------------------------------------------------- sluice
  // Three valve wheels left, middle, right carry a number: how much water they add.
  // The gauge is numbered; there is no target mark, so the number must come from the scroll.
  const subsets = (w) =>
    range(8)
      .filter((m) => m)
      .map((m) => ({ open: [0, 1, 2].map((i) => !!(m & (1 << i))), sum: w.reduce((s, v, i) => s + (m & (1 << i) ? v : 0), 0) }));
  function sluiceLayout(rnd, set) {
    return { weights: shuffle(set || pick([[1, 2, 4], [1, 2, 3]], rnd), rnd) };
  }
  // Wheels are named by place; how much water each gives is shown with glass cups, not numbers.
  const wheelName = (layout, i) => "the " + sides[i] + " wheel";
  const sluiceModes = [
    {
      id: "reach",
      tier: 0,
      label: "Reach a number",
      make(rnd, layout) {
        const sums = [...new Set(subsets(layout.weights).map((s) => s.sum))];
        const targets = shuffle(sums, rnd).slice(0, 3);
        const rounds = targets.map((t, i) => ({
          target: t,
          line: (i ? "Now make" : "Turn the wheels. Make") + " the water reach " + t + ".",
        }));
        return { rounds, text: rounds[0].line, perRound: true };
      },
    },
    {
      id: "open",
      tier: 0,
      label: "Open named wheels",
      make(rnd, layout) {
        const picks = shuffle(
          [[0, 2], [1], [0, 1], [1, 2], [2], [0]],
          rnd,
        ).slice(0, 3);
        const rounds = picks.map((wheels) => {
          const names = wheels.map((i) => wheelName(layout, i, rnd));
          const line =
            wheels.length === 1
              ? "Open only " + names[0] + "."
              : "Open " + names[0] + " and " + names[1] + ".";
          return {
            exact: [0, 1, 2].map((i) => wheels.includes(i)),
            target: wheels.reduce((s, i) => s + layout.weights[i], 0),
            line: cap(line),
          };
        });
        return { rounds, text: rounds[0].line, perRound: true };
      },
    },
    {
      id: "not",
      tier: 1,
      label: "Do not use a wheel",
      make(rnd, layout) {
        // The biggest wheel equals the other two together, so its number can be made two
        // ways. Banning one wheel leaves exactly one way; the second round bans the other.
        const target = Math.max(...layout.weights);
        const ways = shuffle(
          subsets(layout.weights).filter((s) => s.sum === target),
          rnd,
        );
        const rounds = ways.map((keep, i) => {
          const banned = [0, 1, 2].find((k) => ways[1 - i].open[k] && !keep.open[k]);
          return {
            target,
            exact: keep.open,
            line:
              (i ? "Make the water reach " + target + " again. This time, do not use " : "Make the water reach " + target + ". Do not use ") +
              wheelName(layout, banned, rnd) +
              ".",
          };
        });
        return { rounds, text: rounds[0].line, perRound: true };
      },
      layout: (rnd) => sluiceLayout(rnd, pick([[1, 2, 3], [1, 3, 4], [2, 3, 5]], rnd)),
    },
    {
      id: "more",
      tier: 1,
      label: "One more than",
      make(rnd, layout) {
        const sums = [...new Set(subsets(layout.weights).map((s) => s.sum))].filter((n) => n > 1);
        const rounds = shuffle(sums, rnd)
          .slice(0, 3)
          .map((t, i) => {
            const less = rnd() < 0.5 && t < 7;
            return {
              target: t,
              line: less
                ? "Make the water one less than " + (t + 1) + "."
                : "Make the water one more than " + (t - 1) + ".",
            };
          });
        return { rounds, text: rounds[0].line, perRound: true };
      },
    },
    {
      id: "down",
      tier: 2,
      label: "Up, then down",
      make(rnd, layout) {
        const sums = [...new Set(subsets(layout.weights).map((s) => s.sum))].sort((a, b) => a - b);
        const rounds = [0, 1].map(() => {
          const high = pick(sums.filter((n) => n >= 4), rnd);
          const low = pick(sums.filter((n) => n < high - 1), rnd);
          return {
            target: high,
            then: low,
            line: "Fill the water up to " + high + ". Then let it go down to " + low + ".",
          };
        });
        return { rounds, text: rounds[0].line, perRound: true };
      },
    },
  ];

  // -------------------------------------------------------------- mirrors
  const mirrorModes = [
    {
      id: "one",
      tier: 0,
      label: "One sign at a time",
      make(rnd) {
        const first = Math.floor(rnd() * 3);
        const second = (first + 1 + Math.floor(rnd() * 2)) % 3;
        const rounds = [first, second].map((goal, i) => ({
          allowed: [goal],
          line: i
            ? "Now turn the mirrors again. Shine the light on the " + signs[goal] + "."
            : "Turn the mirrors. Shine the light on the " + signs[goal] + ".",
        }));
        return { rounds, text: rounds[0].line, perRound: true, goal: first };
      },
    },
    {
      id: "comet",
      tier: 0,
      label: "Sign, then the comet",
      make(rnd) {
        const goal = Math.floor(rnd() * 3);
        const rounds = [
          { allowed: [goal], line: "Turn the mirrors. Shine the light on the " + signs[goal] + "." },
          { comet: true, line: "Now turn the big crystal. Shine its light on the comet." },
        ];
        return { rounds, text: rounds[0].line, perRound: true, goal };
      },
    },
    {
      id: "cometFirst",
      tier: 1,
      label: "Comet, then a sign",
      make(rnd) {
        const goal = Math.floor(rnd() * 3);
        return {
          rounds: [{ comet: true }, { allowed: [goal] }],
          text: "Turn the big crystal to the comet first. Then light the " + signs[goal] + ".",
          goal,
        };
      },
    },
    {
      id: "two",
      tier: 1,
      label: "This, then that",
      make(rnd) {
        const first = Math.floor(rnd() * 3);
        const second = (first + 1 + Math.floor(rnd() * 2)) % 3;
        const text =
          "Shine the light on the " + signs[first] + ". Then shine it on the " + signs[second] + ".";
        return { rounds: [{ allowed: [first] }, { allowed: [second] }], text, goal: first };
      },
    },
    {
      id: "not",
      tier: 2,
      label: "Not this one",
      make(rnd) {
        const banned = Math.floor(rnd() * 3);
        const ok = [0, 1, 2].filter((n) => n !== banned);
        const text = "Do not light the " + signs[banned] + ". Light the other two signs.";
        return { rounds: [{ allowed: ok }, { allowed: ok }], banned, text, goal: ok[0], anyOrder: true };
      },
    },
  ];

  // ------------------------------------------------------------------ ice
  // Each row of the bridge is a quick question on a frosted ice sign; the three slabs carry
  // the answers engraved in the ice. Only the right answer holds. Words are first-year
  // English; some questions ask for the one that is NOT in a group, so reading every word matters.
  const iceRows = 6;
  const groups = {
    animal: ["dog", "cat", "cow", "duck", "horse", "frog", "lion", "fish"],
    fruit: ["apple", "banana", "pear", "orange", "grapes", "lemon"],
    toy: ["ball", "doll", "kite", "teddy", "robot", "train"],
    clothes: ["hat", "shoe", "sock", "coat", "dress", "shirt"],
  };
  const groupName = { animal: "an animal", fruit: "a fruit", toy: "a toy", clothes: "something to wear" };
  const facts = [
    { q: "Which one can fly?", yes: ["bird", "bee", "plane", "owl"], no: ["fish", "cow", "car", "snake", "chair"] },
    { q: "Which one lives in the sea?", yes: ["fish", "crab", "shark", "whale"], no: ["lion", "owl", "horse", "goat"] },
    { q: "Which one is hot?", yes: ["fire", "sun", "soup"], no: ["ice", "snow", "rain"] },
    { q: "Which one is cold?", yes: ["ice", "snow"], no: ["fire", "sun", "soup"] },
    { q: "What do you see with?", yes: ["eyes"], no: ["feet", "ears", "hands", "nose"] },
    { q: "What do you hear with?", yes: ["ears"], no: ["eyes", "feet", "hands", "mouth"] },
    { q: "Which one has four legs?", yes: ["dog", "cat", "horse", "cow"], no: ["bird", "fish", "snake", "duck"] },
    { q: "What can you eat?", yes: ["cake", "bread", "apple", "egg"], no: ["shoe", "rock", "chair", "kite"] },
  ];
  const opposites = [
    ["hot", "cold"],
    ["big", "small"],
    ["up", "down"],
    ["happy", "sad"],
    ["fast", "slow"],
    ["day", "night"],
    ["old", "new"],
    ["open", "shut"],
  ];
  const numbers = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  function quizRow(kind, rnd) {
    const three = (right, wrong) => {
      const answers = shuffle([right, ...shuffle(wrong, rnd).slice(0, 2)], rnd);
      return { answers, right: answers.indexOf(right) };
    };
    const keys = Object.keys(groups);
    if (kind === "is" || kind === "not") {
      const g = pick(keys, rnd),
        others = keys.filter((k) => k !== g).flatMap((k) => groups[k]);
      if (kind === "is") return { q: "Which one is " + groupName[g] + "?", ...three(pick(groups[g], rnd), others) };
      // NOT: two from the group, one from elsewhere.
      const inGroup = shuffle(groups[g], rnd).slice(0, 2),
        odd = pick(others, rnd);
      const answers = shuffle([...inGroup, odd], rnd);
      return { q: "Which one is NOT " + groupName[g] + "?", answers, right: answers.indexOf(odd) };
    }
    if (kind === "fact") {
      const f = pick(facts, rnd);
      return { q: f.q, ...three(pick(f.yes, rnd), f.no) };
    }
    if (kind === "opposite") {
      const [a, b] = pick(opposites, rnd),
        flip = rnd() < 0.5;
      const word = flip ? b : a,
        right = flip ? a : b;
      const wrong = opposites.flat().filter((w) => w !== a && w !== b);
      return { q: "What is the opposite of " + word + "?", ...three(right, wrong) };
    }
    // Numbers: after, before, bigger, NOT bigger.
    const n = 1 + Math.floor(rnd() * 8);
    const style = pick(["after", "before", "bigger", "smaller"], rnd);
    if (style === "after" || style === "before") {
      const right = style === "after" ? n + 1 : n - 1 < 0 ? n + 1 : n - 1;
      const wrong = [n - 3, n + 3, n, n + 2, n - 2].filter((v) => v >= 0 && v < 10 && v !== right && v !== n);
      const q = "Which number comes " + (style === "after" || n - 1 < 0 ? "after " : "before ") + numbers[n] + "?";
      return { q, ...three(numbers[right], wrong.map((v) => numbers[v])) };
    }
    const base = 3 + Math.floor(rnd() * 4);
    const big = base + 1 + Math.floor(rnd() * (9 - base)),
      small = shuffle([0, 1, 2, 3, 4, 5].filter((v) => v < base), rnd).slice(0, 2);
    if (style === "bigger") {
      const answers = shuffle([numbers[big], ...small.map((v) => numbers[v])], rnd);
      return { q: "Which number is bigger than " + numbers[base] + "?", answers, right: answers.indexOf(numbers[big]) };
    }
    const lo = Math.floor(rnd() * base),
      highs = shuffle([base + 1, base + 2, base + 3].filter((v) => v < 10), rnd).slice(0, 2);
    const answers = shuffle([numbers[lo], ...highs.map((v) => numbers[v])], rnd);
    return { q: "Which number is smaller than " + numbers[base] + "?", answers, right: answers.indexOf(numbers[lo]) };
  }
  function quizBridge(kinds, rnd) {
    const rows = [null];
    const seen = new Set();
    for (let r = 1; r <= iceRows; r++) {
      let row;
      for (let tries = 0; tries < 30; tries++) {
        row = quizRow(kinds[(r - 1) % kinds.length], rnd);
        if (!seen.has(row.q)) break;
      }
      seen.add(row.q);
      rows.push(row);
    }
    return rows;
  }
  const iceModes = [
    {
      id: "kinds",
      tier: 0,
      label: "Which one is…?",
      make(rnd) {
        return { rows: quizBridge(shuffle(["is", "fact", "is", "fact", "opposite", "is"], rnd), rnd), text: "Read the question on the ice sign. Step on the ice with the right answer." };
      },
    },
    {
      id: "numbers",
      tier: 1,
      label: "Numbers and opposites",
      make(rnd) {
        return { rows: quizBridge(shuffle(["number", "opposite", "number", "fact", "number", "opposite"], rnd), rnd), text: "Read each question on the ice sign. Step on the right answer." };
      },
    },
    {
      id: "not",
      tier: 2,
      label: "Watch for NOT",
      make(rnd) {
        return {
          rows: quizBridge(shuffle(["not", "is", "not", "number", "not", "fact"], rnd), rnd),
          text: "Read every question carefully. Some ask for the one that is NOT right!",
        };
      },
    },
  ];

  // ---------------------------------------------------------------- forge
  // A smith's recipe. The bar must be heated in a fire before it can be hit; the scroll
  // says which fire, how many hits and whether to cool it in the water at the end.
  // Steps: {act: "heat", fire: 0 (left) | 1 (right) | null (either)}, {act: "hit"}, {act: "cool"}.
  const fireName = ["left", "right"];
  const hits = (n) => Array.from({ length: n }, () => ({ act: "hit" }));
  const forgeModes = [
    {
      id: "heat",
      tier: 0,
      label: "Heat, then hit",
      make(rnd) {
        const n = 2 + Math.floor(rnd() * 2);
        return {
          steps: [{ act: "heat", fire: null }, ...hits(n)],
          text: "Heat the metal in a fire. Then hit it " + times[n] + ".",
        };
      },
    },
    {
      id: "side",
      tier: 0,
      label: "Which fire",
      make(rnd) {
        const fire = Math.floor(rnd() * 2),
          n = 1 + Math.floor(rnd() * 3);
        return {
          steps: [{ act: "heat", fire }, ...hits(n)],
          text: "Put the metal in the " + fireName[fire] + " fire. Then hit it " + times[n] + ".",
        };
      },
    },
    {
      id: "cool",
      tier: 1,
      label: "Then cool it",
      make(rnd) {
        const fire = Math.floor(rnd() * 2),
          n = 2 + Math.floor(rnd() * 2);
        return {
          steps: [{ act: "heat", fire }, ...hits(n), { act: "cool" }],
          text: "Heat it in the " + fireName[fire] + " fire. Hit it " + times[n] + ". Then cool it in the water.",
        };
      },
    },
    {
      id: "not",
      tier: 1,
      label: "Not that fire",
      make(rnd) {
        const banned = Math.floor(rnd() * 2),
          n = 1 + Math.floor(rnd() * 3);
        return {
          steps: [{ act: "heat", fire: 1 - banned }, ...hits(n)],
          text: "Do not use the " + fireName[banned] + " fire. Heat the metal, then hit it " + times[n] + ".",
        };
      },
    },
    {
      id: "twice",
      tier: 2,
      label: "Heat it again",
      make(rnd) {
        const a = 1 + Math.floor(rnd() * 2),
          b = 1 + Math.floor(rnd() * 2);
        return {
          steps: [{ act: "heat", fire: null }, ...hits(a), { act: "heat", fire: null }, ...hits(b), { act: "cool" }],
          text:
            "Heat it and hit it " + times[a] + ". Heat it again and hit it " + times[b] + ". Then cool it in the water.",
        };
      },
    },
  ];

  // ------------------------------------------------------------- lookout
  // Find what the clue describes through the telescope. Clues never name the thing; they
  // say what it does or looks like. `find` lists the object ids that count.
  const lookoutClues = {
    easy: [
      { find: ["castle"], line: "A king and a queen live there, on the hill far away." },
      { find: ["bellsL", "bellsR"], line: "Many little ones hang in a row. They ring high." },
      { find: ["barrel"], line: "It is round and made of wood. Apples or rain can go in it." },
      { find: ["blanket"], line: "It keeps you warm on a cold night." },
      { find: ["ropeL", "ropeR", "ropeBig"], line: "It is long and you can tie it. Here it lies in a circle." },
      { find: ["chest"], line: "You keep treasure in it. A light sits on top of it." },
    ],
    riddle: [
      { find: ["gearL", "gearR"], line: "It has many teeth, but it never eats." },
      { find: ["spireL", "spireR"], line: "In the town, a tall thin tower looks like a sharp pencil." },
      { find: ["leafA", "leafB"], line: "It fell from a tree. Now it is dry and orange." },
      { find: ["wallLampL", "wallLampR"], line: "It gives light high up on the wall." },
    ],
    not: [
      { find: ["floorLamp"], line: "It gives light, but it is not on the wall." },
      { find: ["barrel"], line: "It is round, but it is not made of rope." },
      { find: ["castle"], line: "It is far away, but it is not a thin tower." },
    ],
  };
  const lookoutModes = [
    {
      id: "find",
      tier: 0,
      label: "Find it",
      make(rnd) {
        const rounds = shuffle(lookoutClues.easy, rnd).slice(0, 3).map((c) => ({ ...c }));
        rounds[0].line = "Look through the telescope. " + rounds[0].line;
        return { rounds, text: rounds[0].line, perRound: true };
      },
    },
    {
      id: "riddle",
      tier: 1,
      label: "Riddles",
      make(rnd) {
        const rounds = [...shuffle(lookoutClues.riddle, rnd).slice(0, 2), pick(lookoutClues.easy, rnd)].map((c) => ({ ...c }));
        return { rounds, text: rounds[0].line, perRound: true };
      },
    },
    {
      id: "not",
      tier: 2,
      label: "But not…",
      make(rnd) {
        const rounds = [...shuffle(lookoutClues.not, rnd).slice(0, 2), pick(lookoutClues.riddle, rnd)].map((c) => ({ ...c }));
        return { rounds, text: rounds[0].line, perRound: true };
      },
    },
  ];

  // ---------------------------------------------------------------- claw
  // A castle treasure grabber: the scroll says what a prize does; the child lowers the
  // hook over the right one. Prize ids: key, bell, lamp, mirror, bear, crystal.
  const prizeClues = {
    key: "Get the thing that opens a door.",
    bell: "Get the thing that rings.",
    lamp: "Get the thing that gives light at night.",
    mirror: "Get the thing you can see your face in.",
    bear: "Get the soft toy with blue ears.",
    crystal: "Get the shiny stone that glows.",
  };
  const prizeNames = { key: "key", bell: "bell", lamp: "lamp", mirror: "mirror", bear: "soft toy", crystal: "shiny stone" };
  const prizeIds = Object.keys(prizeClues);
  const clawModes = [
    {
      id: "what",
      tier: 0,
      label: "What it does",
      make(rnd) {
        const rounds = shuffle(prizeIds, rnd)
          .slice(0, 3)
          .map((id, i) => ({ prize: id, line: (i ? "Now " + prizeClues[id][0].toLowerCase() + prizeClues[id].slice(1) : prizeClues[id]) }));
        return { rounds, text: rounds[0].line, perRound: true, order: shuffle(prizeIds, rnd) };
      },
    },
    {
      id: "two",
      tier: 1,
      label: "This, then that",
      make(rnd) {
        const [a, b] = shuffle(prizeIds, rnd);
        return {
          rounds: [{ prize: a }, { prize: b }],
          text: prizeClues[a].replace(".", ",") + " then the " + prizeNames[b] + ".",
          order: shuffle(prizeIds, rnd),
        };
      },
    },
    {
      id: "not",
      tier: 2,
      label: "Not that one",
      make(rnd) {
        const [a, b, c] = shuffle(prizeIds, rnd);
        const rounds = [
          { prize: a, line: "Do not take the " + prizeNames[b] + ". " + prizeClues[a] },
          { prize: c, line: "Leave the " + prizeNames[a] + " alone. " + prizeClues[c] },
        ];
        return { rounds, text: rounds[0].line, perRound: true, order: shuffle(prizeIds, rnd) };
      },
    },
  ];

  const crafts = {
    lookout: { modes: lookoutModes, layout: () => ({}) },
    claw: { modes: clawModes, layout: () => ({}) },
    bells: { modes: bellModes, layout: bellLayout },
    sluice: { modes: sluiceModes, layout: (rnd) => sluiceLayout(rnd) },
    mirrors: { modes: mirrorModes, layout: () => ({}) },
    ice: { modes: iceModes, layout: () => ({}) },
    forge: { modes: forgeModes, layout: () => ({}) },
  };

  // Build one encounter. `tier` caps the difficulty (0 = A, 1 = B, 2 = C); `avoid` is the
  // last mode id, so two visits in a row play differently whenever another mode exists.
  // Keep a number on the same line as the word before it ("reach 5", "wheel 2").
  const glue = (text) => (typeof text === "string" ? text.replace(/ (\d+)/g, "\u00a0$1") : text);
  function generate(room, { tier = 2, avoid, mode, rnd = Math.random } = {}) {
    const craft = crafts[room];
    const pool = craft.modes.filter((m) => m.tier <= tier);
    const chosen =
      craft.modes.find((m) => m.id === mode) ||
      pick(pool.filter((m) => m.id !== avoid).length ? pool.filter((m) => m.id !== avoid) : pool, rnd);
    const layout = (chosen.layout || craft.layout)(rnd);
    const rule = { mode: chosen.id, label: chosen.label, tier: chosen.tier, layout, ...chosen.make(rnd, layout) };
    rule.text = glue(rule.text);
    rule.rounds?.forEach((r) => (r.line = glue(r.line)));
    return rule;
  }

  const variants = {
    king: [
      { pattern: ["bones", "charge", "bones", "soul"], text: "Bones come first. Tap the floor to move." },
      { pattern: ["soul", "bones", "soul", "charge"], text: "The blue wave comes first. Hold Coji to block." },
      { pattern: ["charge", "soul", "charge", "bones"], text: "The king will run at you. Step to the side." },
    ],
    witch: [
      { pattern: ["pool", "curse", "flock", "curse", "doubles", "curse"], text: "Look for green water. Step away from it." },
      {
        pattern: ["doubles", "curse", "pool", "curse", "flock", "curse"],
        text: "Look at the feet. The witch with a shadow is real.",
      },
      {
        pattern: ["curse", "flock", "curse", "pool", "curse", "doubles"],
        text: "A green ball comes first. Hold Coji to send it back.",
      },
      { pattern: ["flock", "curse", "doubles", "curse", "pool", "curse"], text: "Birds come first. Step out of their way." },
    ],
    colossus: [
      { pattern: ["hammer", "hammer", "steam"], text: "The big fist comes first. Step to the side." },
      {
        pattern: ["steam", "hammer", "steam", "hammer", "hammer"],
        text: "Steam comes first. Hold Coji to block it.",
      },
    ],
    dragon: [
      { first: "lightning", text: "Watch for sparks. Step away from them." },
      { first: "fire", text: "Fire comes first. Hold Coji to block it." },
    ],
  };
  return { variants, signs, colors, sides, crafts, generate, iceRows };
})();
