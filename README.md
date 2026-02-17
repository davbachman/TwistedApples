# Twisted Apples

Play online: [https://davbachman.github.io/TwistedApples/](https://davbachman.github.io/TwistedApples/)

Calibration helper: [https://davbachman.github.io/TwistedApples/calibrate.html](https://davbachman.github.io/TwistedApples/calibrate.html)

Twisted Apples is an arcade-style catch/avoid game played on a 3D Mobius band.

## How to Play
- Catch apples labeled `OK`.
- Avoid mirrored poison apples.
- Missed apples continue around the Mobius band and return with opposite polarity.
- Game ends when lives reach 0.

## Controls
- Move basket: `A` / `D` or `Left` / `Right`
- Start / restart: `Enter` (or click/tap Start)
- Pause: `P`
- Mute: `M`
- Fullscreen: `F`

## Calibration Helper
Use `calibrate.html` to tune camera, world scale, and lighting, then copy the exported config patch into `src/game/config.ts`.

Useful controls in calibrator:
- Select parameter: `[` / `]` or `Left` / `Right`
- Adjust value: `Up` / `Down`, row `- / +` buttons, or canvas drag
- Fine/coarse adjustment: hold `Shift` / `Option(Alt)`
- Randomize apples: `R`
- Reset defaults: `0`
- Copy patch: `S` or **Copy Patch** button

## Notes
- The project is deployed with GitHub Pages via GitHub Actions (`.github/workflows/deploy-pages.yml`).
