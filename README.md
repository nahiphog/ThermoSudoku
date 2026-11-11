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
- **Generate puzzle:** follows the six-stage layout-first process below.
  No thermometer cell (including bulbs) contains a given; clue positions are
  rotationally symmetric and digging runs to completion without a clue target.
- **Logical techniques only (no Brute force):** enabled by default; uncheck to disable. After
  complete uniqueness-based digging, the generator attempts a walkthrough using
  only supported logical techniques and thermometer deductions. If it stalls,
  generation restarts with a new layout. Accepted
  puzzles have zero Brute force uses and a complete logical walkthrough. This
  filter can take longer; it never silently returns an unrestricted
  puzzle. Construction and independent uniqueness verification may still use
  backtracking internally. The preference persists locally and in JSON exports.
- **Rotationally symmetric thermometers:** an optional layout setting, enabled
  by default. Every thermometer has a rotated counterpart with the bulb in the
  corresponding position and the same path direction. Digit values need not
  be symmetric. Clue-position symmetry is mandatory in the prescribed workflow.
- **No overlapping or branching thermometers:** mandatory for now. Prevents
  shared cells, shared bulbs, branching and diagonal crossings, including
  self-crossings. Legacy exclusion/overlap/clue-symmetry toggles no longer override
  the new generation workflow; imported puzzles remain readable.
- Select exactly 1–30 thermometers and a minimum length of 2–11 cells, including
  the bulb (defaults: 6 thermometers, minimum 3 cells). Strict Thermo permits
  at most 9 cells. Rotational symmetry requires an even count; non-overlapping
  paths must fit within 81 cells. Invalid combinations are explained before
  generation. Difficult selections may take longer; use Cancel to stop the search.
- Use the **Import grid** page to check uniqueness with the original givens and paths.
- **Reveal / hide solution:** below the grid, reveals only a verified unique
  solution. Hiding restores exactly the original puzzle. The solution is held
  separately; reveal does not modify givens, exported JSON, or saved data.
- **Copy grid as an image:** copies a 904×904 PNG of the visible grid, including
  thermometers and visible digits, without selection highlights. If clipboard
  images are unavailable or access is denied, downloads the same PNG instead.
- JSON import/export includes givens, entries, and ordered thermometer paths.
  The current puzzle is also saved in local storage when available.
- **Copy puzzle string:** copies `TS1|T|<81 digits>|<paths>` (`S` for Slow Thermo).
  Clues are row-major, with 0 for blanks. Each path concatenates two-digit
  row/column coordinates (11–99), bulb first; semicolons separate paths.
  For example, `112233` represents r1c1 → r2c2 → r3c3. Paste the entire string
  into Import to restore a puzzle. It never includes the solution or generation
  preferences. The version prefix allows future format changes. If clipboard
  access is unavailable, a selectable text dialog provides a manual fallback.
- **Generation report:** shows six attributes above the grid: givens, thermometer count,
  distinct occupied thermometer cells, elapsed time including retries and analysis,
  numeric difficulty rating, and hardest technique used. Attempts and digging counts
  appear in the report. Reports and walkthroughs belong to the current generation
  session; exported puzzle JSON remains independent of solution data.
- **Solution walkthrough:** displays directly in the maker's existing grid with
  controls underneath, without a popup. Previous/Next, first/last, and a slider replay the
  actual solve. Candidate eliminations and placements are highlighted. Failed
  backtracking trials, contradictions, and restored positions are included.
  Choose Return to puzzle to restore the original clues. Image copying is disabled
  in walkthrough mode. A visible technique tally lists each technique and its total
  uses across the entire solve, including failed trials; rollbacks are also reported.
  Imported puzzle walkthroughs show the same tallies.

## Import grid page

Open **Import grid** in the page navigation (`#import-grid`). Paste a TS1 token
on its own or inside a message, puzzle JSON, or 81 digits with 0/dot blanks.
Plain digits represent a Sudoku without thermometers. This page checks the
import independently without replacing the maker's puzzle.

The check runs in a cancelable worker. A unique puzzle displays its completed
grid beside an interactive walkthrough. For multiple solutions, two valid
completions appear side by side, with every differing cell highlighted in amber
and outlined. Contradictory puzzles report no solution. A time limit is reported
as inconclusive, never as proof of uniqueness. A separate walkthrough timeout
preserves the verified solution and reports the unavailable analysis.

## Solver design and provenance

Actual unmodified modules from [sudokUI](https://github.com/AImenes/sudokUI)
are vendored under `src/vendor/sudokui`. See THIRD_PARTY_NOTICES.md for the
pinned commit and imported modules. The logical solver includes full houses,
naked/hidden singles, locked candidates, naked/hidden subsets (2–4), basic,
finned and sashimi fish (2–4), XY/XYZ/W wings, skyscrapers, two-string kites,
and empty rectangles. This is a curated subset, not its entire catalogue.

`src/solver.ts` adds directed inequality arc consistency, including overlapping
thermometers, and a minimum-candidate search that validates the thermo
constraints at every node. It tries every supported logical finder before
branching with backtracking. Search counts up to two solutions, runs in a
dedicated worker, and normally stops after five seconds (generation supplies
an unlimited budget instead). A timed-out search never
claims uniqueness or impossibility. Cancel terminates the worker. Standard
Sudoku uniqueness techniques are not enabled for the variant.

### Six-stage generation

1. Draw the selected number of disjoint thermometer paths, respecting the selected minimum length, without consulting any digits.
2. Randomized candidate-based backtracking fills only thermometer cells. Slow
   Thermo assignments must include an equal consecutive pair. Failure restarts
   with a new layout.
3. Keep the thermometer digits fixed and randomly fill the other cells. Failure
   restarts with a new layout, rather than changing the fixed thermo assignment.
4. Empty every thermometer cell (and rotational counterparts if the paths are
   asymmetric). Prove uniqueness with logical deductions and backtracking;
   multiple solutions cause a fresh layout attempt.
5. Shuffle and test every remaining rotational clue orbit, removing it only
   after proving uniqueness. The center is a singleton orbit. No clue-count
   floor applies. A failed removal never needs retesting: removing other givens
   cannot shrink the set of solutions. The result is minimal with respect to
   these pair removals, not necessarily globally minimum in clue count.
6. Record statistics, calculate a difficulty estimate, and produce a complete
   solution replay. Display only the completed result.

Generation has no overall time limit. Generate puzzle becomes Cancel while the
worker runs, and a live elapsed timer updates every tenth of a second. Cancel
terminates the worker and retains the current puzzle; the timer freezes until
the next generation starts. The final generation statistic uses the same elapsed
clock. Individual filling attempts still restart when unproductive; these local
retry budgets do not end generation. Uniqueness checking, digging, and walkthrough
analysis receive no time limit. Explicit finite budgets remain available to tests
and library callers; a timed-out check never counts as proof.

### Difficulty estimate

`src/walkthrough.ts` sums imported sudokUI technique weights, adds 5 for each
thermometer reduction round and 10,000 for each Brute force use, including
failed trials. The highest technique level is promoted using the imported
total-score thresholds. Any trial makes the level Extreme. The UI exposes the
score, level, hardest technique, technique counts, trial count, and rollbacks.
This is an engine-dependent estimate, not an official HoDoKu rating or a
calibrated measure of human difficulty.
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
