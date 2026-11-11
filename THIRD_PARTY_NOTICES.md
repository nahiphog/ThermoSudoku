# sudokUI

The files in `src/vendor/sudokui` are copied unchanged from
[AImenes/sudokUI](https://github.com/AImenes/sudokUI), commit
`cf7ce55e09ee7ea879327f4f995f9e603d4fb17a` (reviewed November 11, 2026).
They are distributed under GNU GPL version 3; see LICENSE.

Imported modules: board, steps, ratings, text, singles, intersections,
subsets, fish, wings, and singleDigit. The application uses these actual
technique implementations through `src/solver.ts`.

Thermometer validation, propagation, search, editor, and worker integration
are new code. Upstream's ordinary-Sudoku brute-force solver is not used.
Uniqueness-based deductions are intentionally not enabled: ordinary-Sudoku
uniqueness assumptions do not carry over to thermometer constraints.
