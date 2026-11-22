// The scroll, set dressing and success test share these per-visit parameters.
CastleScenes["chamber-rules"] = (() => {
  const signs = ["sun", "moon", "star"];
  const variants = {
    bells: ["same", "back"].map((order) => ({
      order,
      text:
        order === "same"
          ? "Watch the bells. Tap them in the same order."
          : "Watch the bells. Tap from last to first.",
    })),
    sluice: [
      [3, 5, 6],
      [4, 2, 7],
      [6, 1, 5],
    ].map((targets) => ({ targets, text: "Turn the wheels. Make the water reach " + targets[0] + "." })),
    mirrors: signs.map((sign, goal) => ({
      goal,
      text: "Turn the mirrors. Shine the light on the " + sign + ".",
    })),
    ice: signs.map((sign, goal) => ({ goal, text: "Find the " + sign + " on the ice. Step on it." })),
    forge: ["left", "middle", "right"].map((side, goal) => ({
      goal,
      text: "Watch the hammer. Tap when it is over the " + side + " mark.",
    })),
    king: [
      { pattern: ["bones", "charge", "bones", "soul"], text: "Bones come first. Tap the floor to move." },
      { pattern: ["soul", "bones", "soul", "charge"], text: "The blue wave comes first. Hold Coji to block." },
      { pattern: ["charge", "soul", "charge", "bones"], text: "The king will run at you. Step to the side." },
    ],
    witch: [
      { pattern: ["pool", "flock", "doubles", "curse"], text: "Look for green water. Step away from it." },
      {
        pattern: ["doubles", "pool", "curse", "flock"],
        text: "Look at the feet. Tap the witch with a shadow.",
      },
      {
        pattern: ["curse", "flock", "pool", "doubles"],
        text: "A green ball comes first. Hold Coji to send it back.",
      },
      { pattern: ["flock", "curse", "doubles", "pool"], text: "Birds come first. Step out of their way." },
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
  return { variants, signs };
})();
