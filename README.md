# Thermo Sudoku studio

A responsive TypeScript / Vite website for authoring and solving Thermo Sudoku.

Published at https://nahiphog.github.io/ThermoSudoku/.
Pushes to `main` run the tests and production build, then deploy `dist` using
the GitHub Pages workflow in `.github/workflows/pages.yml`. Pages uses GitHub
Actions as its publishing source. Vite emits relative asset URLs so scripts,
styles, and the solver worker load under the repository subpath.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` type-checks the application
and produces a static website in `dist`. `npm test` runs the solver tests.
`npm run test:e2e` runs browser tests (requires Playwright Chromium).

## Using the studio

- **Puzzle maker:** manual digit entry, erasing digits, and pencil/Snyder marks
  are currently disabled. Select cells to inspect them or use arrow keys to move.
  The toolkit, candidate display, hint control, and separate Solve & play mode
  are currently removed. Generation options and the Generate button sit above
  the grid on desktop and mobile.
- **Thermo / Slow Thermo:** choose strictly increasing or nondecreasing paths.
  Slow Thermo requires at least one equal consecutive pair on a thermometer
  in the completed grid. Normal Sudoku rules still apply to those cells.
- **Generate puzzle:** creates and verifies a puzzle with exactly one solution.
  By default, no thermometer cell (including bulbs) contains a given.
  Disable **No givens on thermometers** to allow those givens. This setting
  applies to generation, not imported puzzles.
- **Rotationally symmetric givens / thermometers:** independent generation
  settings, both enabled by default. Clue *positions* are symmetric under a
  180° rotation, not their values. Every thermometer has a rotated counterpart
  with the bulb in the corresponding position and the same path direction.
- **No overlapping or branching thermometers:** enabled by default. Prevents
  shared cells, shared bulbs, branching and diagonal crossings, including
  self-crossings. Turning it off allows overlaps; it does not require them.
- All generated thermometers have at least three cells including the bulb.
  `MIN_THERMO_LENGTH` in `src/puzzle.ts` controls this generation minimum.
- **Check puzzle:** checks uniqueness using the original givens and paths.
- **Reveal / hide solution:** below the grid, reveals only a verified unique
  solution. Hiding restores exactly the original puzzle. The solution is held
  separately; reveal does not modify givens, exported JSON, or saved data.
- **Copy grid as an image:** copies a 904×904 PNG of the visible grid, including
  thermometers and visible digits, without selection highlights. If clipboard
  images are unavailable or access is denied, downloads the same PNG instead.
- JSON import/export includes givens, entries, and ordered thermometer paths.
  The current puzzle is also saved in local storage when available.

## Solver design and provenance

Actual unmodified modules from [sudokUI](https://github.com/AImenes/sudokUI)
are vendored under `src/vendor/sudokui`. See THIRD_PARTY_NOTICES.md for the
pinned commit and imported modules. The retained hint engine includes full houses,
naked/hidden singles, locked candidates, naked/hidden subsets (2–4), basic,
finned and sashimi fish (2–4), XY/XYZ/W wings, skyscrapers, two-string kites,
and empty rectangles. This is a curated subset, not its entire catalogue.

`src/solver.ts` adds directed inequality arc consistency, including overlapping
thermometers, and a minimum-candidate search that validates the thermo
constraints at every node. Search counts up to two solutions, runs in a
dedicated worker, and stops after five seconds. A timed-out search never
claims uniqueness or impossibility. Cancel terminates the worker. Standard
Sudoku uniqueness techniques are not enabled for the variant.

The generator randomizes a completed Sudoku, builds valid paths, and removes
clues while preserving a proven unique solution. Symmetric thermometers are
selected as rotated pairs, including their bulb orientation. When clue symmetry
is enabled, both forced thermometer-cell exclusions and optional clue removals
operate on rotational pairs. Slow generation includes an
equal step in its source solution. Mandatory thermometer-clue removal happens
before uniqueness testing; unsuccessful attempts are discarded. Generation
runs in the worker, can be canceled, and has a ten-second budget. A failure
leaves the current board unchanged.
All puzzle processing runs locally. Fonts use Google Fonts with system fallbacks.

## JSON format

Version 1 has `values` and `givens` (81 integers, 0 for empty), `variant`
(`thermo` or `slow`), generation preferences (`noThermoGivens`, `symmetricGivens`,
`symmetricThermos`, `noOverlap`, all booleans defaulting to true), and `thermos`
(arrays of cell indices 0–80, row-major, bulb first). Each path has 2–9 unique
neighboring cells for strict Thermo, or 2–81 for Slow Thermo. Paths may overlap.
Legacy two-cell paths remain readable in imported files; generation uses the
three-cell minimum. Generation settings do not rewrite imported puzzles.
Older files without settings default to strict Thermo and all generation options
enabled. A given must match its current value.
Malformed imports are rejected before changing the board; logically impossible
puzzles can still be imported and checked.

## License

GPL-3.0-only, including the imported sudokUI code. See LICENSE.
