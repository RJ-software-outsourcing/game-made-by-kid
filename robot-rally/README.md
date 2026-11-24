# Bolt Cup · Robot Rally

An English, touch-first 3D robot-building game. Name a combat robot, choose a chassis and buy equipment within the round budget. The two bots drive and use their tools automatically.

## Play

Open the game from the repository’s game picker. To serve just the game on your computer, run the command below from the repository root and open [the garage](http://127.0.0.1:8135/).

```sh
python3 -m http.server 8135 --bind 127.0.0.1 --directory robot-rally
```

For an iPad on the same Wi-Fi, bind to the computer’s Wi-Fi address and open that address and port in Safari. Adding the game to the Home Screen gives it its own app window. Offline installation uses a service worker on HTTPS or localhost. The game ships its own models, textures, robot sounds and rendering library.

## In the garage

- **Body** offers six free chassis. Knuckle has exposed twin piston arms and a split breastplate. Rivet carries an offset cab and a single heavy press arm. Strider has a wide triangular frame, Rover a low steel wedge, Rotor an armored bearing ring, and Comet a sprung nose wheel and tail fins. All six accept the same 24 parts, with different shapes and attachment points on each body.
- **Paint** changes the main enamel and companion panels, including Ferrari Red. The body gallery shows your installed equipment and colors on each chassis.
- **Parts** opens six shelves with four choices each. The brain includes its movement strategy. You can also touch a visible part on your 3D robot to open its shelf. Drag to turn the robot and pinch to zoom.
- Each part shows its price, a short English description and the exact stat change from the part fitted now. Tap the speaker to hear the same comparison. When the slot is empty, the number shows what you gain from the bare chassis. The radar lights up the stat you are changing. A new robot starts with six empty slots. Sell an item beside the model for its full price to free its slot, then buy a new part with the coins shown. Tap the robot’s name to change it.
- **Test drive** compares your fitted part with a proposed one against the same rival. Select an installed part and use **Test without** to try its empty slot before selling. Each eight-second run measures what that part does. The brain test shows the turns your bot took. The motor test measures distance, the lens test counts hits and misses, and the battery test shows refills and charge left. When a single change falls short, the rematch coach can offer **Test both changes** to try two parts working together for free. **See rival** overlays the two robots’ stats.
- **Battle** shows the connected 16-robot bracket, the current round and your next rival. **Scout rival** shows its actual parts. Start the bout when your bot is ready.

## In the ring

Rush can intercept a moving rival and dash into close range. Orbit circles the shield. Anchor blocks and pushes back. Zigzag changes direction, dodges and uses a two-hit combination. A Bubble Popper can shoot on the move and skate away from a close-range tool. The Bash Pad extends on impact, the Spin Brush sweeps, and the Pulse Bell sends a wave across the floor. A bubble pushes along its flight path, and a wave pushes away from where it rang. In a weapon test drive, **Paths** draws gold dashes at the range where the fitted tool can start an attack. The result card counts the seconds the rival spent within that range and angle.

The nameplates show health above a gold battery bar. During a refill, a white tick marks the charge needed to use the fitted tool again. Daniel calls who dodged, flanked or landed a counter. Samantha can explain a lead by pointing to damage the shell absorbed or a hit the faster wheels dodged. The ringside log records hits, misses, dodges and refills. An interrupted match restores the last three entries when you return. After a loss the coach names a move the rival actually made and tests affordable changes against the same rival. Tap the speaker to hear the result on a device with English speech. You can test the suggested parts before making a trade. Winners celebrate amid three volleys of rail fireworks while the other robot falls to the floor. Sound and commentary have independent controls under **How to play → Options**.

The ringside camera slowly circles and rises when one bot would hide the other. Drag to take control. Use the camera button to switch viewpoints, or tap either score to see through that robot’s lens. **Paths** shows the routes both robots really took. Double arrows mark a dash and bent arrows mark a sideways dodge. **Key move** replays one exchange at half speed.

Matches run at 30 fixed simulation steps per second. At 36 seconds, the higher remaining health percentage wins. A loss or draw keeps the same opponent and budget. The four budget caps are **124, 161, 190 and 205 coins** for both teams. In a new final, Goldcap spends all 205, and the most expensive six parts cost 227. Tournaments started with the original 235-coin final keep that budget. Win four rounds to unlock the podium and a downloadable champion portrait. A saved tournament or interrupted match can be resumed on the same device and origin.

## Performance and checks

**How to play → Options → Run device check** measures five camera views on the current device. Each view watches the same piece of a bout. Results include FPS, 95th-percentile frame time and render scale. Save the CSV for draw calls and triangle counts. Add `?perf` to the game address for a live rendering readout.

```sh
node --test robot-rally/tests/*.mjs
node robot-rally/tools/check-balance.mjs
node robot-rally/tools/update-offline.mjs
node robot-rally/tools/update-offline.mjs --check
```

The balance check plays all 15,625 combinations of fitted and empty slots against the fixed opponents wherever the build is affordable. The offline release contains the current game’s imported modules and referenced artwork. Use `?offline` to enable the service worker during localhost testing.
