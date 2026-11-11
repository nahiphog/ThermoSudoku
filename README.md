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

- **Puzzle maker:** click a cell and type 1–9 to set a given. Delete clears it.
  The separate Solve & play mode is currently removed; clues remain editable.
- **Thermo / Slow Thermo:** choose strictly increasing or nondecreasing paths.
  Slow Thermo requires at least one equal consecutive pair on a thermometer
  in the completed grid. Normal Sudoku rules still apply to those cells.
- **Generate puzzle:** creates and verifies a puzzle with exactly one solution.
  By default, no thermometer cell (including bulbs) contains a given.
  Disable **No givens on thermometers** to allow those givens. This setting
  applies to generation, not manual clue editing or imported puzzles.
- **Thermometer:** click a bulb and successive neighboring cells, then Finish
  or Enter. Alternatively drag a connected path and release. Orthogonal and
  diagonal steps work. Retrace one cell to shorten a draft; Esc cancels it.
- **Erase thermo:** click any cell on the path. At overlaps, the newest path
  is removed first. Undo and redo work across edits, imports, and solves.
- **Check puzzle:** checks uniqueness using the givens and thermometers,
  independent of solving entries. **Solve puzzle** uses current entries and
  displays one solution, explicitly reporting multiple solutions or timeout.
- **Give me a hint:** applies the next logical placement and explains the
  imported techniques used. Thermometer bounds constrain all candidates first.
- JSON import/export includes givens, entries, and ordered thermometer paths.
  The current puzzle is also saved in local storage when available.

## Solver design and provenance

Actual unmodified modules from [sudokUI](https://github.com/AImenes/sudokUI)
are vendored under `src/vendor/sudokui`. See THIRD_PARTY_NOTICES.md for the
pinned commit and imported modules. Enabled techniques include full houses,
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
clues while preserving a proven unique solution. Slow generation includes an
equal step in its source solution. Mandatory thermometer-clue removal happens
before uniqueness testing; unsuccessful attempts are discarded. Generation
runs in the worker, can be canceled, and has a ten-second budget. A failure
leaves the current board unchanged.
All puzzle processing runs locally. Fonts use Google Fonts with system fallbacks.

## JSON format

Version 1 has `values` and `givens` (81 integers, 0 for empty), `variant`
(`thermo` or `slow`), `noThermoGivens` (boolean generation preference), and `thermos`
(arrays of cell indices 0–80, row-major, bulb first). Each path has 2–9 unique
neighboring cells for strict Thermo, or 2–81 for Slow Thermo. Paths may overlap.
Older files without settings default to strict Thermo and no thermometer givens
on generation. A given must match its current value.
Malformed imports are rejected before changing the board; logically impossible
puzzles can still be imported and edited.

## License

GPL-3.0-only, including the imported sudokUI code. See LICENSE.
