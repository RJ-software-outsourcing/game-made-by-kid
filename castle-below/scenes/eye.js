// The Watchful Eye: stone statues stand down the hall. Coji hides behind one, dashes to the
// next while the eye is shut, and must be hidden again before it opens.
CastleScenes.eye = {
  hint: "Tap ahead to run to the next statue.",
  assets: ["eyeBlink", "eyeRoom", "livingFlames", "pointingStatue"],
  rules: [
    { label: "Run while it sleeps", text: "Hide behind the statues. Run only when the eye is shut.", closed: true },
    { label: "Stop before it wakes", text: "When the eye closes, run to the next statue. Be hidden before it opens!", closed: true },
  ],
  // Hiding places: statue depth and lane, zigzagging down the hall.
  covers: [
    { x: 1.4, y: 1.3 },
    { x: 4.3, y: 3.8 },
    { x: 7.1, y: 1.2 },
  ],
  end: 9.6,
  // 0 = shut, 1 = open. The eye watches for most of the cycle and sleeps for a short dash.
  // Cycle: open, closing (0.55 s), shut (~2.4 s), opening (0.55 s).
  shutLength: 2.4,
  lids(timer, period) {
    const t = timer % period,
      close = period - 0.55 - 2.4 - 0.55;
    if (t < close) return 1;
    if (t < close + 0.55) return 1 - (t - close) / 0.55;
    if (t < close + 0.55 + 2.4) return 0;
    return (t - close - 2.95) / 0.55;
  },
};
