Original prompt: Implement the Twisted Apples v1 plan as a web Three.js game with Möbius-band gameplay, orientation-based catch/avoid rules, retro synthesized audio, deterministic hooks, and tests.

## Progress Log
- Initialized npm project and installed runtime/dev dependencies (Three.js, TypeScript, Vite, Vitest, Playwright).
- Scaffolded initial project config, HTML shell, and base file structure for game modules and tests.
- Implemented core TypeScript modules: Möbius math, deterministic simulation, Three.js renderer, WebAudio chip-sound engine, input handling, and UI state management.
- Added deterministic automation hooks on `window`: `render_game_to_text`, `advanceTime(ms)`, and `resetGame()`, plus a debug helper namespace for integration tests.
- Added unit tests for scoring/lives/flip/difficulty and Playwright end-to-end scenarios for controls, rule outcomes, game-over/restart, and descending-approach behavior.
- Added WebGL failure resilience via automatic Canvas2D fallback renderer so startup/hooks still work in headless environments.
- Verified gameplay state capture with develop-web-game client (`output/web-game/shot-*.png`, `state-*.json`) and visually confirmed Möbius scene plus mirrored apple orientation.
- Validation complete: `npm test`, `npm run build`, and `npm run test:e2e` all passing.

## Suggested Next Improvements
- Reduce bundle size by lazy-loading Three.js modules or splitting heavy renderer code.
- Tune basket/apples visual contrast for very dark displays.

## Calibration Helper Update
- Added multi-page Vite build support with `/calibrate.html` as a dedicated static calibration tool entrypoint.
- Added `src/calibrator/types.ts` and `src/calibrator/serializer.ts` for calibration state modeling plus JSON/TypeScript patch export.
- Added browser calibration hooks: `window.exportCalibrationSettings()` and `window.exportCalibrationPatch()`.
- Added shared decal projection module `src/game/surfaceDecal.ts` and switched gameplay renderer to use it.
- Added central renderer config objects in `src/game/config.ts`: `WORLD_SCALE`, `CAMERA_SETTINGS`, and `LIGHT_SETTINGS`.
- Updated `src/game/rendering.ts` to consume new config objects and share decal projection logic.
- Implemented `src/calibrate.ts` static Möbius scene with fixed basket, seeded-random fixed apples, trackpad wheel tuning controls, keyboard shortcuts (`[`, `]`, `R`, `0`, `S`), and localStorage persistence (`twisted_apples_calibration_v1`).
- Added WebGL-unavailable fallback behavior in calibrator to keep exports/UI working in headless environments.
- Added tests:
  - Unit: `src/test/calibration-serializer.test.ts`
  - E2E: `tests/e2e/calibrate.spec.ts`
- Validation complete for calibration work: `npm run build`, `npm test`, and `npm run test:e2e` all passing.

## Suggested Next Improvements
- Add a direct "Apply to game preview" button in calibrator that opens `/` with a URL-encoded temporary override set.
- Add preset save slots (named snapshots) on top of current single localStorage profile.
- Updated simulation lane-margin logic to match new decal axis mapping (v uses decal height), keeping basket/apples constrained consistently after shared decal-orientation extraction.
- Calibrator controls updated for laptop trackpad/no-wheel workflows: per-row `- / +` buttons, ArrowUp/ArrowDown value tuning, ArrowLeft/ArrowRight parameter selection, and pointer-drag tuning on canvas.
- Applied user-selected calibration values to `src/game/config.ts` (camera position/roll and lighting intensities) and verified with a successful `npm run build`.
- Rotated on-surface decal mapping by 90° (shared `surfaceDecal` utility) to fix sideways apple/basket presentation under current game camera framing; updated simulation lane margins to stay consistent with that mapping.
- Increased apple decal size (`APPLE_DECAL_WIDTH/HEIGHT`) and boosted `OK` readability with larger text plus dark outline and brighter fill color.
- Fixed decal seam clipping by removing forced angle wrapping in shared surface-decal patch generation; decals now evaluate on continuous unwrapped `u` so apples can cross the Mobius seam without being cut.
- Removed per-frame `u` wrapping in simulation updates so apples keep continuous angular position; this eliminates horizontal teleporting at the Mobius seam while preserving wrapped-angle rule checks for catch/spawn windows.
- Fixed polarity visual mismatch across the Mobius side transition by replacing single `DoubleSide` apple decals with paired front/back meshes: front uses polarity map, back uses mirror-compensated opposite map. This keeps displayed orientation aligned with simulation polarity after missed-return flips.
- Corrected basket catch overlap on Mobius returns by mapping apple lane through strip-parity at catch (`v` sign flips each full loop) before comparing to basket lane; this prevents false misses/catches and unintended life loss from lane-mismatch on odd loops.
- Catch/miss resolution now keys off basket-line crossing (not catch-window entry), which prevents visible pass-through and inconsistent outcomes as apples pass the basket.
- Added a narrow fallback for apples injected already inside the catch window (debug/tests) so deterministic test hooks continue to resolve immediately.
