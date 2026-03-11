/**
 * solver.ts
 *
 * Two responsibilities:
 *
 * 1. GENERATION-TIME solver  (solvePuzzle)
 *    Fills the `solution` field of every playable cell using a backtracking
 *    constraint-satisfaction algorithm.  Called by puzzleGenerator.ts.
 *
 * 2. UNIQUENESS checker  (countSolutions / hasUniqueSolution)
 *    Counts the number of distinct solutions up to a given maximum (default 2).
 *    A valid Kakuro puzzle must have exactly one solution.
 *
 * 3. REVEAL helper  (solveFromCurrentState)
 *    Returns a copy of the grid with every playable cell's `solution` field
 *    populated — either from the embedded solution or by re-solving.
 *    Used by POST /api/solution.
 */

import type { Cell } from './types';

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function cloneGrid(grid: Cell[][]): Cell[][] {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

/**
 * Numbers already placed in the same horizontal run to the left of `col`
 * (stops at the first non-playable cell).  Reads from `solution` field
 * because this is used during puzzle generation.
 */
function usedInRowLeft(grid: Cell[][], row: number, col: number): Set<number> {
  const used = new Set<number>();
  for (let c = col - 1; c >= 0; c--) {
    const cell = grid[row][c];
    if (cell.type !== 'playable') break;
    if (cell.solution !== undefined) used.add(cell.solution);
  }
  return used;
}

/**
 * Numbers already placed in the same vertical run above `row`.
 */
function usedInColAbove(grid: Cell[][], row: number, col: number): Set<number> {
  const used = new Set<number>();
  for (let r = row - 1; r >= 0; r--) {
    const cell = grid[r][col];
    if (cell.type !== 'playable') break;
    if (cell.solution !== undefined) used.add(cell.solution);
  }
  return used;
}

// ---------------------------------------------------------------------------
// Generation-time backtracking solver (fills `solution` fields)
// ---------------------------------------------------------------------------

function backtrack(grid: Cell[][], cells: Cell[], index: number): boolean {
  if (index === cells.length) return true;

  const cell = cells[index];
  const used = new Set([
    ...usedInRowLeft(grid, cell.row, cell.col),
    ...usedInColAbove(grid, cell.row, cell.col),
  ]);

  // Shuffle candidate order for variety across different puzzle runs
  const candidates = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => !used.has(n));
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  for (const num of candidates) {
    cell.solution = num;
    if (backtrack(grid, cells, index + 1)) return true;
    cell.solution = undefined;
  }

  return false;
}

/**
 * Fill every playable cell's `solution` field in-place.
 * Returns true if a solution was found, false if the grid layout is
 * unsolvable (caller should fall back to a simpler layout).
 */
export function solvePuzzle(grid: Cell[][]): boolean {
  const playable = grid.flat().filter((c) => c.type === 'playable');
  return backtrack(grid, playable, 0);
}

// ---------------------------------------------------------------------------
// Uniqueness checker
// ---------------------------------------------------------------------------

/**
 * Count how many distinct solutions exist for the given grid structure.
 * Stops as soon as `maxCount` solutions have been found (default 2) to keep
 * the check fast — callers typically only need to know "zero", "one", or
 * "more than one".
 */
export function countSolutions(grid: Cell[][], maxCount = 2): number {
  const work = cloneGrid(grid);
  // Clear all solution fields so we're solving from scratch
  for (const row of work) {
    for (const cell of row) {
      if (cell.type === 'playable') cell.solution = undefined;
    }
  }

  const cells = work.flat().filter((c) => c.type === 'playable');
  let count = 0;

  function bt(index: number): void {
    if (count >= maxCount) return;
    if (index === cells.length) {
      count++;
      return;
    }

    const cell = cells[index];
    const used = new Set([
      ...usedInRowLeft(work, cell.row, cell.col),
      ...usedInColAbove(work, cell.row, cell.col),
    ]);

    for (let num = 1; num <= 9; num++) {
      if (!used.has(num)) {
        work[cell.row][cell.col].solution = num;
        bt(index + 1);
        if (count >= maxCount) return;
        work[cell.row][cell.col].solution = undefined;
      }
    }
  }

  bt(0);
  return count;
}

/** True only if the grid layout has exactly one valid solution. */
export function hasUniqueSolution(grid: Cell[][]): boolean {
  return countSolutions(grid) === 1;
}

// ---------------------------------------------------------------------------
// Reveal helper  (POST /api/solution)
// ---------------------------------------------------------------------------

/**
 * Return a full copy of the grid with every playable cell's `solution`
 * populated.  If solution values are already embedded (normal case after
 * generation), those are used directly.  Otherwise the puzzle is solved from
 * scratch via backtracking.
 *
 * Returns null when the layout has no solution.
 */
export function solveFromCurrentState(puzzleGrid: Cell[][]): Cell[][] | null {
  const playable = puzzleGrid.flat().filter((c) => c.type === 'playable');
  const solutionsEmbedded = playable.every((c) => c.solution !== undefined);

  if (solutionsEmbedded) {
    return cloneGrid(puzzleGrid);
  }

  const grid = cloneGrid(puzzleGrid);
  const success = solvePuzzle(grid);
  return success ? grid : null;
}
