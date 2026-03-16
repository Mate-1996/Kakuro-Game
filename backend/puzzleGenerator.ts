/**
 * puzzleGenerator.ts
 *
 * Generates valid Kakuro puzzles of different sizes and difficulties.
 * Extracted from the original Kakuroutils.ts and now references the
 * modular solver so generation logic and solving logic stay separate.
 *
 * Public API:
 *   generateKakuroPuzzle(size, difficulty) → KakuroGrid
 *   getTimeLimitForDifficulty(difficulty, size) → seconds
 *   getDifficultyForSize(size) → Difficulty
 */

import type { Cell, KakuroGrid, Difficulty } from './types';
import { solvePuzzle } from './solver';

// ---------------------------------------------------------------------------
// Difficulty configuration
// ---------------------------------------------------------------------------

interface DifficultySettings {
  clueFrequency: number;    // higher → fewer interior clue cells → more playable cells
  randomThreshold: number;  // probability that a candidate cell becomes a clue
  maxGroupSize: number;     // cap on consecutive playable cells in a run
  hintCount: number;        // pre-filled cells for the player
  timeLimitSeconds: number; // base countdown for competitive mode
}

function getDifficultySettings(difficulty: Difficulty): DifficultySettings {
  switch (difficulty) {
    case 'easy':
      return {
        clueFrequency: 3,
        randomThreshold: 0.35, // more clue cells → simpler layout
        maxGroupSize: 3,
        hintCount: 0,
        timeLimitSeconds: 240,
      };
    case 'medium':
      return {
        clueFrequency: 3,
        randomThreshold: 0.45,
        maxGroupSize: 5,
        hintCount: 0,
        timeLimitSeconds: 500,
      };
    case 'hard':
      return {
        clueFrequency: 4,
        randomThreshold: 0.55, // fewer clue cells → longer runs → harder
        maxGroupSize: 7,
        hintCount: 0,
        timeLimitSeconds: 700,
      };
  }
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export function getTimeLimitForDifficulty(difficulty: Difficulty, size = 8): number {
  const base = getDifficultySettings(difficulty).timeLimitSeconds;
  const mult = size <= 6 ? 0.7 : size <= 8 ? 1.0 : 1.4;
  return Math.floor(base * mult);
}

export function getDifficultyForSize(size: number): Difficulty {
  if (size <= 6) return 'easy';
  if (size <= 8) return 'medium';
  return 'hard';
}

// ---------------------------------------------------------------------------
// Internal grid-building helpers
// ---------------------------------------------------------------------------

/**
 * Prevent any horizontal or vertical run of playable cells from exceeding
 * `maxGroupSize` by converting the excess cell to a clue cell.
 */
function enforceMaxGroupSize(grid: Cell[][], size: number, maxGroupSize: number): void {
  // rows
  for (let row = 1; row < size; row++) {
    let run = 0;
    for (let col = 1; col < size; col++) {
      if (grid[row][col].type === 'playable') {
        run++;
        if (run > maxGroupSize) {
          grid[row][col].type = 'clue';
          run = 0;
        }
      } else {
        run = 0;
      }
    }
  }
  // columns
  for (let col = 1; col < size; col++) {
    let run = 0;
    for (let row = 1; row < size; row++) {
      if (grid[row][col].type === 'playable') {
        run++;
        if (run > maxGroupSize) {
          grid[row][col].type = 'clue';
          run = 0;
        }
      } else {
        run = 0;
      }
    }
  }
}

/**
 * Compute the across/down clue sums from the embedded `solution` values and
 * store them on each clue cell.
 */
function calculateClues(grid: Cell[][]): void {
  const size = grid.length;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = grid[row][col];
      if (cell.type !== 'clue') continue;

      let acrossSum = 0;
      let acrossCount = 0;
      for (let c = col + 1; c < size && grid[row][c].type === 'playable'; c++) {
        acrossSum += grid[row][c].solution ?? 0;
        acrossCount++;
      }
      if (acrossCount > 0) cell.clueAcross = acrossSum;

      let downSum = 0;
      let downCount = 0;
      for (let r = row + 1; r < size && grid[r][col].type === 'playable'; r++) {
        downSum += grid[r][col].solution ?? 0;
        downCount++;
      }
      if (downCount > 0) cell.clueDown = downSum;
    }
  }
}

/**
 * Pre-fill `hintCount` random playable cells with their solution values and
 * mark them as fixed so the player cannot erase them.
 */
function addHints(grid: Cell[][], size: number, count: number): void {
  const candidates: { row: number; col: number }[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (grid[row][col].type === 'playable' && !grid[row][col].isFixed) {
        candidates.push({ row, col });
      }
    }
  }
  // Fisher-Yates shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (const { row, col } of candidates.slice(0, count)) {
    grid[row][col].value = grid[row][col].solution;
    grid[row][col].isFixed = true;
  }
}

// ---------------------------------------------------------------------------
// Fallback: deterministic simple puzzle
// ---------------------------------------------------------------------------

function generateSimplePuzzle(size: number, difficulty: Difficulty): KakuroGrid {
  const grid: Cell[][] = [];
  for (let row = 0; row < size; row++) {
    grid[row] = [];
    for (let col = 0; col < size; col++) {
      if (row === 0 && col === 0) {
        grid[row][col] = { type: 'empty', row, col };
      } else if (row === 0 || col === 0) {
        grid[row][col] = { type: 'clue', row, col };
      } else {
        grid[row][col] = { type: 'playable', row, col };
      }
    }
  }
  // Fill with a predictable non-repeating pattern per row
  for (let row = 1; row < size; row++) {
    for (let col = 1; col < size; col++) {
      grid[row][col].solution = ((row + col - 1) % 9) + 1;
    }
  }
  calculateClues(grid);
  for (let row = 1; row < size; row++) {
    for (let col = 1; col < size; col++) {
      grid[row][col].value = undefined;
      grid[row][col].isFixed = false;
    }
  }
  const settings = getDifficultySettings(difficulty);
  if (settings.hintCount > 0) addHints(grid, size, settings.hintCount);
  return { grid, size, difficulty };
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate a randomised Kakuro puzzle.
 *
 * Steps:
 *  1. Initialise an all-empty grid.
 *  2. Stamp clue cells according to difficulty settings.
 *  3. Enforce the maximum group-size cap.
 *  4. Run backtracking solver to assign solution values.
 *  5. Derive clue sums from solution values.
 *  6. Strip solution values from player view (keep them in `solution` field).
 *  7. Optionally pre-fill hint cells.
 *
 * Falls back to generateSimplePuzzle if backtracking fails (pathological
 * layout that the solver cannot satisfy).
 */
export function generateKakuroPuzzle(size = 8, difficulty?: Difficulty): KakuroGrid {
  if (![6, 8, 10].includes(size)) size = 8;
  const diff = difficulty ?? getDifficultyForSize(size);
  const settings = getDifficultySettings(diff);

  // 1. Build empty grid
  const grid: Cell[][] = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => ({ type: 'empty' as const, row, col }))
  );

  // 2. Stamp clue / playable cells
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (row === 0 || col === 0) {
        grid[row][col].type = 'clue';
      } else if (
        (row + col) % settings.clueFrequency === 0 &&
        Math.random() > settings.randomThreshold
      ) {
        grid[row][col].type = 'clue';
      } else {
        grid[row][col].type = 'playable';
      }
    }
  }

  // 3. Cap run lengths
  enforceMaxGroupSize(grid, size, settings.maxGroupSize);

  // 4. Solve (assign solution values via backtracking)
  const solved = solvePuzzle(grid);
  if (!solved) return generateSimplePuzzle(size, diff);

  // 5. Derive clue sums
  calculateClues(grid);

  // 6. Clear player view
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = grid[row][col];
      if (cell.type === 'playable') {
        cell.value = undefined;
        cell.isFixed = false;
      }
    }
  }

  // 7. Pre-fill hints (easy mode)
  if (settings.hintCount > 0) addHints(grid, size, settings.hintCount);

  return { grid, size, difficulty: diff };
}
