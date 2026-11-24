# Castle Below: rules for every change

These rules apply to every agent and every change in `castle-below/`. The full technical guide is
[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md); the reading-rule bank is [TRIAL_RULES.md](TRIAL_RULES.md).

## Art direction: photorealistic, always

- Every scene, character, prop, boss, effect target and UI object that lives in the world must look
  **photorealistic**: real materials (stone, brass, iron, wood, glass, ice, cloth) with believable
  texture, wear, shading and reflections at game size.
- **Never ship flat or cartoon placeholders**: no emoji, no plain geometric Canvas shapes standing in
  for objects, no solid-colour blobs, no text labels painted where a real object should be. Canvas
  drawing is for light, air, water motion, glow, particles and perspective work on photographic art.
- Prefer existing photographic assets in `assets/`; crop from the room's own plate when the object is
  already in the photograph (a chain, a bucket, a lamp). New art must match the plate's camera angle,
  light direction and colour, sit on the ground with a contact shadow, and be lit by the room.
- Interactive objects must be **part of the scene**: they stand where the photograph has room for them,
  share its perspective, and show their state the way a real object would (a valve's position
  indicator, water flowing or not, metal glowing hot), not with floating badges.
- Anything placed on the plate is positioned in **plate coordinates** measured on the source image,
  so it stays registered in landscape, portrait and on every screen size.
- The camera never slides or zooms the background during play. Depth comes from light, fog,
  perspective-correct props and characters scaling with distance.
- Light and air must visibly move: shafts that breathe and carry dust, fog that drifts, fire that
  flickers. Use `scenes/atmos-fx.js`. On pale scenes use `source-over` fog; `screen` vanishes there.

## Gameplay: reading first

- Players are six years old. The scroll (English, short sentences, ≤13 words each) is the only place
  that says what to do. Nothing in the room may give the answer away (no highlighted correct choice,
  no hint bar that repeats the rule). Hints report progress only.
- Every level has several play modes; parameters that change the answer come from
  `scenes/chamber-rules.js` and the sentence is written from the same parameters. Add a test in
  `tests/chamber-rules.test.cjs` proving each generated rule has exactly one correct action.
- Controls must be obvious without words: interactive things react to a touch, Coji walks to what he
  works with, and failure is gentle (no lost progress beyond the current step).

## Performance budget

- Target an iPad at 60 Hz. Cache anything static into an offscreen canvas; never rebuild gradients,
  filters or sliced drawings every frame. Keep large sprite sheets few and decode them before play.
- Verify every visual change in the browser at 1180×820 and 375×812, with effects on and off.
