/**
 * hintSystem.ts
 *
 * Provides incremental hints for the player without revealing more than
 * necessary.  Three strategies are tried in order of "cheapness":
 *
 *  1. Naked single      — only one digit (1-9) can legally go in this cell
 *                         given current row/col duplicates and sum constraints.
 *
 *  2. Sum-forced single — only one cell remains empty in a run, so its value
 *                         is determined by the target clue sum.
 *
 *  3. Only-possible     — for every candidate value in a run, only one cell
 *                         can actually hold it without conflicting with other
 *                         run constraints.  (Hidden-single logic.)
 *
 *  4. General fallback  — reveal the solution of the first unfilled cell.
 *
 * All strategies skip fixed (pre-filled) cells and cells the player has
 * already filled correctly.
 */

import type { Cell, KakuroGrid, HintResult } from './types';
import { getRowGroup, getColGroup, getRowClueCell, getColClueCell } from './constraintChecker';

// ---------------------------------------------------------------------------
// Candidate computation
// ---------------------------------------------------------------------------

/**
 * Returns the set of digits (1–9) that can legally be placed at (row, col)
 * given:
 *  - digits already present in the same row run
 *  - digits already present in the same col run
 *  - whether a candidate would exceed the remaining capacity of either sum
 */
function getCandidates(grid: Cell[][], row: number, col: number): Set<number> {
  const possible = new Set<number>([1, 2, 3, 4, 5, 6, 7, 8, 9]);

  const rowGroup = getRowGroup(grid, row, col);
  const colGroup = getColGroup(grid, row, col);

  // Remove values already used in row run
  for (const cell of rowGroup) {
    if (cell.row === row && cell.col === col) continue;
    if (cell.value !== undefined) possible.delete(cell.value);
  }

  // Remove values already used in col run
  for (const cell of colGroup) {
    if (cell.row === row && cell.col === col) continue;
    if (cell.value !== undefined) possible.delete(cell.value);
  }

  // Prune values that would overshoot the across sum
  const rowClue = getRowClueCell(grid, row, col);
  if (rowClue?.clueAcross !== undefined) {
    const filledSum = rowGroup
      .filter((c) => !(c.row === row && c.col === col))
      .reduce((s, c) => s + (c.value ?? 0), 0);
    const emptyCount = rowGroup.filter(
      (c) => !(c.row === row && c.col === col) && c.value === undefined
    ).length;
    const remaining = rowClue.clueAcross - filledSum;
    possible.forEach((v) => {
      // Value alone already exceeds what is left
      if (v > remaining) possible.delete(v);
      // Value is so small that even with 9s in every other empty cell the sum
      // can never reach the target
      if (v + emptyCount * 9 < remaining) possible.delete(v);
    });
  }

  // Prune values that would overshoot the down sum
  const colClue = getColClueCell(grid, row, col);
  if (colClue?.clueDown !== undefined) {
    const filledSum = colGroup
      .filter((c) => !(c.row === row && c.col === col))
      .reduce((s, c) => s + (c.value ?? 0), 0);
    const emptyCount = colGroup.filter(
      (c) => !(c.row === row && c.col === col) && c.value === undefined
    ).length;
    const remaining = colClue.clueDown - filledSum;
    possible.forEach((v) => {
      if (v > remaining) possible.delete(v);
      if (v + emptyCount * 9 < remaining) possible.delete(v);
    });
  }

  return possible;
}

// ---------------------------------------------------------------------------
// Strategy helpers
// ---------------------------------------------------------------------------

/** Strategy 1: naked single — exactly one candidate digit for this cell. */
function findNakedSingle(grid: Cell[][], size: number): HintResult | null {
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = grid[row][col];
      if (cell.type !== 'playable' || cell.value !== undefined || cell.isFixed) continue;

      const candidates = getCandidates(grid, row, col);
      if (candidates.size === 1) {
        const value = cell.solution ?? [...candidates][0];
        return {
          row,
          col,
          value,
          hintType: 'naked_single',
          message: `Only one digit can go in row ${row + 1}, column ${col + 1} — try ${value}.`,
        };
      }
    }
  }
  return null;
}

/**
 * Strategy 2: sum-forced single — exactly one empty cell remains in a run,
 * so its value is fully determined by the clue sum.
 */
function findSumForcedSingle(grid: Cell[][], size: number): HintResult | null {
  // Check row runs
  const checkedRows = new Set<string>();
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = grid[row][col];
      if (cell.type !== 'playable') continue;
      const group = getRowGroup(grid, row, col);
      const key = `r${row}_${group[0].col}`;
      if (checkedRows.has(key)) continue;
      checkedRows.add(key);

      const empty = group.filter((c) => c.value === undefined && !c.isFixed);
      if (empty.length !== 1) continue;

      const clue = getRowClueCell(grid, row, group[0].col);
      if (clue?.clueAcross === undefined) continue;

      const filledSum = group.reduce((s, c) => s + (c.value ?? 0), 0);
      const needed = clue.clueAcross - filledSum;
      if (needed < 1 || needed > 9) continue;

      const target = empty[0];
      return {
        row: target.row,
        col: target.col,
        value: target.solution ?? needed,
        hintType: 'sum_forced',
        message: `Only one cell is unfilled in that row group — it must be ${needed}.`,
      };
    }
  }

  // Check col runs
  const checkedCols = new Set<string>();
  for (let col = 0; col < size; col++) {
    for (let row = 0; row < size; row++) {
      const cell = grid[row][col];
      if (cell.type !== 'playable') continue;
      const group = getColGroup(grid, row, col);
      const key = `c${col}_${group[0].row}`;
      if (checkedCols.has(key)) continue;
      checkedCols.add(key);

      const empty = group.filter((c) => c.value === undefined && !c.isFixed);
      if (empty.length !== 1) continue;

      const clue = getColClueCell(grid, group[0].row, col);
      if (clue?.clueDown === undefined) continue;

      const filledSum = group.reduce((s, c) => s + (c.value ?? 0), 0);
      const needed = clue.clueDown - filledSum;
      if (needed < 1 || needed > 9) continue;

      const target = empty[0];
      return {
        row: target.row,
        col: target.col,
        value: target.solution ?? needed,
        hintType: 'sum_forced',
        message: `Only one cell is unfilled in that column group — it must be ${needed}.`,
      };
    }
  }

  return null;
}

/**
 * Strategy 3: only-possible-in-group (hidden single).
 * For each run, if a candidate digit can only appear in one specific cell
 * within that run, that cell must hold that digit.
 */
function findOnlyPossibleInGroup(grid: Cell[][], size: number): HintResult | null {
  // Row runs
  const checkedRows = new Set<string>();
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = grid[row][col];
      if (cell.type !== 'playable') continue;
      const group = getRowGroup(grid, row, col);
      const key = `r${row}_${group[0].col}`;
      if (checkedRows.has(key)) continue;
      checkedRows.add(key);

      const emptyCells = group.filter((c) => c.value === undefined && !c.isFixed);
      if (emptyCells.length < 2) continue;

      // Build candidate sets for each empty cell
      const cellCandidates = emptyCells.map((c) => ({
        cell: c,
        candidates: getCandidates(grid, c.row, c.col),
      }));

      // For each digit, count how many empty cells can hold it
      for (let digit = 1; digit <= 9; digit++) {
        const holders = cellCandidates.filter((cc) => cc.candidates.has(digit));
        if (holders.length === 1) {
          const target = holders[0].cell;
          return {
            row: target.row,
            col: target.col,
            value: target.solution ?? digit,
            hintType: 'only_possible_in_group',
            message: `In that row group, only row ${target.row + 1}, column ${target.col + 1} can hold ${digit}.`,
          };
        }
      }
    }
  }

  // Col runs
  const checkedCols = new Set<string>();
  for (let col = 0; col < size; col++) {
    for (let row = 0; row < size; row++) {
      const cell = grid[row][col];
      if (cell.type !== 'playable') continue;
      const group = getColGroup(grid, row, col);
      const key = `c${col}_${group[0].row}`;
      if (checkedCols.has(key)) continue;
      checkedCols.add(key);

      const emptyCells = group.filter((c) => c.value === undefined && !c.isFixed);
      if (emptyCells.length < 2) continue;

      const cellCandidates = emptyCells.map((c) => ({
        cell: c,
        candidates: getCandidates(grid, c.row, c.col),
      }));

      for (let digit = 1; digit <= 9; digit++) {
        const holders = cellCandidates.filter((cc) => cc.candidates.has(digit));
        if (holders.length === 1) {
          const target = holders[0].cell;
          return {
            row: target.row,
            col: target.col,
            value: target.solution ?? digit,
            hintType: 'only_possible_in_group',
            message: `In that column group, only row ${target.row + 1}, column ${target.col + 1} can hold ${digit}.`,
          };
        }
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public entry point  (POST /api/hint)
// ---------------------------------------------------------------------------

/**
 * Returns the cheapest available hint for the current puzzle state,
 * or null if the puzzle is already complete.
 */
export function getHint(puzzle: KakuroGrid): HintResult | null {
  const { grid, size } = puzzle;

  // Strategy 1 — cheapest
  const naked = findNakedSingle(grid, size);
  if (naked) return naked;

  // Strategy 2
  const sumForced = findSumForcedSingle(grid, size);
  if (sumForced) return sumForced;

  // Strategy 3
  const hidden = findOnlyPossibleInGroup(grid, size);
  if (hidden) return hidden;

  // Strategy 4 — brute fallback: reveal first unfilled cell with known solution
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = grid[row][col];
      if (
        cell.type === 'playable' &&
        cell.value === undefined &&
        !cell.isFixed &&
        cell.solution !== undefined
      ) {
        return {
          row,
          col,
          value: cell.solution,
          hintType: 'general',
          message: `Try placing ${cell.solution} at row ${row + 1}, column ${col + 1}.`,
        };
      }
    }
  }

  return null; // puzzle is complete or unsolvable
}
