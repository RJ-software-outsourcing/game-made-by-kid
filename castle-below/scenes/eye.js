CastleScenes.eye = {
  hint: "Tap ahead to walk. Tap Coji to stop.",
  assets: ["eyeBlink", "eyeRoom", "livingFlames"],
  rules: [
    { label: "Closed eye", text: "Walk when the eye is shut. Stop when it opens.", closed: true },
    { label: "Open eye", text: "Walk when the eye is open. Stop when it shuts.", closed: false },
  ],
  lids(timer, period) {
    const t = timer % period,
      shut = period * 0.44,
      open = period - 0.55;
    if (t < shut) return 0;
    if (t < shut + 0.55) return (t - shut) / 0.55;
    return t < open ? 1 : (period - t) / 0.55;
  },
};
