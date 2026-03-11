/**
 * constraintChecker.ts
 *
 * All Kakuro rule validation lives here:
 *   - isValidMove   : can the player place a digit at (row, col)?
 *   - checkCell     : detailed single-cell check with conflict coordinates
 *   - validateGrid  : full-grid validation (duplicates + sums + wrong values)
 *   - isPuzzleComplete : true only when every playable cell equals its solution
 *
 * Group helpers (getRowGroup / getColGroup) are also exported so other modules
 * and the frontend can reuse them without duplicating the traversal logic.
 */

import type { Cell, KakuroGrid, ValidationError, ValidationResult, CellCheckResult } from './types';

// ---------------------------------------------------------------------------
// Group traversal helpers
// ---------------------------------------------------------------------------

/** All playable cells in the same horizontal run as (row, col). */
export function getRowGroup(grid: Cell[][], row: number, col: number): Cell[] {
  const size = grid[row].length;
  let start = col;
  for (let c = col - 1; c >= 0; c--) {
    if (grid[row][c].type !== 'playable') break;
    start = c;
  }
  const cells: Cell[] = [];
  for (let c = start; c < size && grid[row][c].type === 'playable'; c++) {
    cells.push(grid[row][c]);
  }
  return cells;
}

/** All playable cells in the same vertical run as (row, col). */
export function getColGroup(grid: Cell[][], row: number, col: number): Cell[] {
  const size = grid.length;
  let start = row;
  for (let r = row - 1; r >= 0; r--) {
    if (grid[r][col].type !== 'playable') break;
    start = r;
  }
  const cells: Cell[] = [];
  for (let r = start; r < size && grid[r][col].type === 'playable'; r++) {
    cells.push(grid[r][col]);
  }
  return cells;
}

/** The clue/empty cell that owns the across-sum for the run containing (row, col). */
export function getRowClueCell(grid: Cell[][], row: number, col: number): Cell | null {
  for (let c = col - 1; c >= 0; c--) {
    if (grid[row][c].type !== 'playable') return grid[row][c];
  }
  return null;
}

/** The clue/empty cell that owns the down-sum for the run containing (row, col). */
export function getColClueCell(grid: Cell[][], row: number, col: number): Cell | null {
  for (let r = row - 1; r >= 0; r--) {
    if (grid[r][col].type !== 'playable') return grid[r][col];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Single-move validation (used during active gameplay)
// ---------------------------------------------------------------------------

/**
 * Returns true if placing `value` at (row, col) does not immediately
 * duplicate an existing value in the same row or column group.
 * Does NOT verify sum constraints — that is intentionally deferred.
 */
export function isValidMove(
  grid: Cell[][],
  row: number,
  col: number,
  value: number
): boolean {
  if (value < 1 || value > 9) return false;

  for (const cell of getRowGroup(grid, row, col)) {
    if (cell.row === row && cell.col === col) continue;
    if (cell.value === value) return false;
  }

  for (const cell of getColGroup(grid, row, col)) {
    if (cell.row === row && cell.col === col) continue;
    if (cell.value === value) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Detailed single-cell check (POST /api/check-cell)
// ---------------------------------------------------------------------------

/**
 * Returns a CellCheckResult describing whether `value` is a valid placement
 * at (row, col), including the coordinates of any conflicting cells and, when
 * the group is fully filled, whether the sum matches the clue.
 */
export function checkCell(
  grid: Cell[][],
  row: number,
  col: number,
  value: number
): CellCheckResult {
  if (value < 1 || value > 9) {
    return {
      valid: false,
      conflicts: [],
      message: 'Value must be between 1 and 9.',
    };
  }

  const conflicts: { row: number; col: number }[] = [];

  // --- row-group duplicate check ---
  const rowGroup = getRowGroup(grid, row, col);
  for (const cell of rowGroup) {
    if (cell.row === row && cell.col === col) continue;
    if (cell.value === value) conflicts.push({ row: cell.row, col: cell.col });
  }

  // --- row-group sum check (only when the group would be fully filled) ---
  const rowClue = getRowClueCell(grid, row, col);
  if (rowClue?.clueAcross !== undefined) {
    const hypothetical = rowGroup.map((c) =>
      c.row === row && c.col === col ? { ...c, value } : c
    );
    const allFilled = hypothetical.every((c) => c.value !== undefined);
    if (allFilled) {
      const sum = hypothetical.reduce((s, c) => s + (c.value ?? 0), 0);
      if (sum !== rowClue.clueAcross) {
        return {
          valid: false,
          conflicts,
          message: `Row group sum would be ${sum}, but the clue requires ${rowClue.clueAcross}.`,
        };
      }
    }
  }

  // --- col-group duplicate check ---
  const colGroup = getColGroup(grid, row, col);
  for (const cell of colGroup) {
    if (cell.row === row && cell.col === col) continue;
    if (cell.value === value) conflicts.push({ row: cell.row, col: cell.col });
  }

  // --- col-group sum check ---
  const colClue = getColClueCell(grid, row, col);
  if (colClue?.clueDown !== undefined) {
    const hypothetical = colGroup.map((c) =>
      c.row === row && c.col === col ? { ...c, value } : c
    );
    const allFilled = hypothetical.every((c) => c.value !== undefined);
    if (allFilled) {
      const sum = hypothetical.reduce((s, c) => s + (c.value ?? 0), 0);
      if (sum !== colClue.clueDown) {
        return {
          valid: false,
          conflicts,
          message: `Column group sum would be ${sum}, but the clue requires ${colClue.clueDown}.`,
        };
      }
    }
  }

  if (conflicts.length > 0) {
    return {
      valid: false,
      conflicts,
      message: `Duplicate value ${value} found in group.`,
    };
  }

  return { valid: true, conflicts: [], message: 'Valid placement.' };
}

// ---------------------------------------------------------------------------
// Full-grid validation (POST /api/validate)
// ---------------------------------------------------------------------------

/**
 * Validate the entire grid.
 *
 * Checks:
 *  1. Numbers in each row/column block do not repeat.
 *  2. Completed groups whose sum does not equal the clue.
 *  3. Cells whose value differs from the embedded solution (if available).
 *
 * The puzzle is considered complete only when ALL playable cells are filled
 * and there are zero errors.
 */
export function validateGrid(puzzle: KakuroGrid): ValidationResult {
  const { grid, size } = puzzle;
  const errors: ValidationError[] = [];
  let filled = 0;
  let total = 0;
  let correct = 0;
  let incorrect = 0;

  // ---- per-cell wrong-value check ----------------------------------------
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = grid[row][col];
      if (cell.type !== 'playable') continue;
      total++;
      if (cell.value === undefined) continue;
      filled++;
      if (cell.solution !== undefined) {
        if (cell.value === cell.solution) {
          correct++;
        } else {
          incorrect++;
          errors.push({
            row,
            col,
            type: 'wrong_value',
            message: `Wrong value ${cell.value} at (${row},${col}).`,
          });
        }
      }
    }
  }

  // ---- row-group checks ---------------------------------------------------
  const checkedRowGroups = new Set<string>();
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = grid[row][col];
      if (cell.type !== 'playable') continue;

      const rowGroup = getRowGroup(grid, row, col);
      const groupKey = `r${row}_${rowGroup[0].col}`;
      if (checkedRowGroups.has(groupKey)) continue;
      checkedRowGroups.add(groupKey);

      // duplicate check
      const seen = new Set<number>();
      for (const c of rowGroup) {
        if (c.value === undefined) continue;
        if (seen.has(c.value)) {
          // flag all cells in the group carrying this duplicate value
          rowGroup
            .filter((x) => x.value === c.value)
            .forEach((x) =>
              errors.push({
                row: x.row,
                col: x.col,
                type: 'duplicate',
                message: `Duplicate value ${c.value} in row group at row ${row}.`,
              })
            );
        }
        seen.add(c.value);
      }

      // sum check (only for fully-filled groups)
      const clueCell = getRowClueCell(grid, row, rowGroup[0].col);
      if (clueCell?.clueAcross !== undefined && rowGroup.every((c) => c.value !== undefined)) {
        const sum = rowGroup.reduce((s, c) => s + (c.value ?? 0), 0);
        if (sum !== clueCell.clueAcross) {
          rowGroup.forEach((c) =>
            errors.push({
              row: c.row,
              col: c.col,
              type: 'sum_mismatch',
              message: `Row group sum is ${sum}, clue requires ${clueCell.clueAcross}.`,
            })
          );
        }
      }
    }
  }

  // ---- col-group checks ---------------------------------------------------
  const checkedColGroups = new Set<string>();
  for (let col = 0; col < size; col++) {
    for (let row = 0; row < size; row++) {
      const cell = grid[row][col];
      if (cell.type !== 'playable') continue;

      const colGroup = getColGroup(grid, row, col);
      const groupKey = `c${col}_${colGroup[0].row}`;
      if (checkedColGroups.has(groupKey)) continue;
      checkedColGroups.add(groupKey);

      const seen = new Set<number>();
      for (const c of colGroup) {
        if (c.value === undefined) continue;
        if (seen.has(c.value)) {
          colGroup
            .filter((x) => x.value === c.value)
            .forEach((x) =>
              errors.push({
                row: x.row,
                col: x.col,
                type: 'duplicate',
                message: `Duplicate value ${c.value} in column group at col ${col}.`,
              })
            );
        }
        seen.add(c.value);
      }

      const clueCell = getColClueCell(grid, colGroup[0].row, col);
      if (clueCell?.clueDown !== undefined && colGroup.every((c) => c.value !== undefined)) {
        const sum = colGroup.reduce((s, c) => s + (c.value ?? 0), 0);
        if (sum !== clueCell.clueDown) {
          colGroup.forEach((c) =>
            errors.push({
              row: c.row,
              col: c.col,
              type: 'sum_mismatch',
              message: `Column group sum is ${sum}, clue requires ${clueCell.clueDown}.`,
            })
          );
        }
      }
    }
  }

  const isComplete = total > 0 && filled === total && errors.length === 0;

  return {
    isValid: errors.length === 0,
    isComplete,
    errors,
    stats: { filled, total, correct, incorrect },
  };
}

// ---------------------------------------------------------------------------
// Completion check (lightweight — used inside gameplay loop)
// ---------------------------------------------------------------------------

/**
 * Returns true only when every playable cell contains its correct solution
 * value. Faster than validateGrid for the in-game completion check.
 */
export function isPuzzleComplete(grid: Cell[][]): boolean {
  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === 'playable' && cell.value !== cell.solution) return false;
    }
  }
  return true;
}
