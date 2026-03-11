/**
 * puzzleParser.ts
 *
 * Reads puzzle definitions from two formats:
 *   1. JSON  — a structured object with size, difficulty, and a flat
 *              array of cell descriptors.
 *   2. .KAK  — a simple text format:
 *              Line 1  : grid size (integer)
 *              Lines 2…size+1 : space-separated cell tokens per row
 *                  E          → empty (black corner)
 *                  P          → playable
 *                  C:a:d      → clue cell (a = across sum, d = down sum, 0 = none)
 *              Optional last line: difficulty keyword (easy | medium | hard)
 *
 * Also exports serializeToKAK to dump a KakuroGrid back to .KAK text.
 */

import type { Cell, KakuroGrid, Difficulty, ParsedPuzzle } from './types';

// ---------------------------------------------------------------------------
// JSON parser
// ---------------------------------------------------------------------------

/**
 * Parse a JSON string that matches:
 * {
 *   "size": 8,
 *   "difficulty": "medium",
 *   "cells": [
 *     { "type": "empty",    "row": 0, "col": 0 },
 *     { "type": "clue",     "row": 0, "col": 1, "clueDown": 12 },
 *     { "type": "playable", "row": 1, "col": 1 }
 *   ]
 * }
 */
export function parseJSON(input: string): ParsedPuzzle {
  let data: { size: number; difficulty: Difficulty; cells: Cell[] };

  try {
    data = JSON.parse(input);
  } catch {
    throw new Error('Puzzle JSON is not valid JSON.');
  }

  const { size, difficulty, cells } = data;

  if (typeof size !== 'number' || size < 3 || size > 20) {
    throw new Error(`Invalid puzzle JSON: "size" must be a number between 3 and 20 (got ${size}).`);
  }
  if (!Array.isArray(cells)) {
    throw new Error('Invalid puzzle JSON: "cells" must be an array.');
  }

  // Build an all-empty grid and overwrite cells from the definition
  const grid: Cell[][] = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => ({ type: 'empty' as const, row, col }))
  );

  for (const cell of cells) {
    const { row, col } = cell;
    if (row >= 0 && row < size && col >= 0 && col < size) {
      grid[row][col] = { ...cell };
    }
  }

  const validDifficulties: Difficulty[] = ['easy', 'medium', 'hard'];
  return {
    grid,
    size,
    difficulty: validDifficulties.includes(difficulty) ? difficulty : 'medium',
  };
}

// ---------------------------------------------------------------------------
// .KAK parser
// ---------------------------------------------------------------------------

/**
 * Parse a .KAK text puzzle.
 *
 * Example (3×3):
 *   3
 *   E C:0:4 C:0:7
 *   C:3:0 P P
 *   C:4:0 P P
 *   medium
 */
export function parseKAK(input: string): ParsedPuzzle {
  const lines = input
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error('Invalid .KAK file: too few lines.');
  }

  const size = parseInt(lines[0], 10);
  if (isNaN(size) || size < 3 || size > 20) {
    throw new Error(`Invalid .KAK file: first line must be the grid size (3–20), got "${lines[0]}".`);
  }
  if (lines.length < size + 1) {
    throw new Error(
      `Invalid .KAK file: expected ${size} data rows but only found ${lines.length - 1}.`
    );
  }

  const grid: Cell[][] = [];

  for (let row = 0; row < size; row++) {
    const tokens = lines[row + 1].split(/\s+/);
    if (tokens.length !== size) {
      throw new Error(
        `Invalid .KAK file: row ${row} has ${tokens.length} token(s), expected ${size}.`
      );
    }

    grid[row] = [];
    for (let col = 0; col < size; col++) {
      const token = tokens[col];

      if (token === 'E') {
        grid[row][col] = { type: 'empty', row, col };
      } else if (token === 'P') {
        grid[row][col] = { type: 'playable', row, col };
      } else if (token.startsWith('C:')) {
        const parts = token.split(':');
        if (parts.length !== 3) {
          throw new Error(
            `Invalid cell token "${token}" at row ${row}, col ${col}. Expected format: C:acrossSum:downSum`
          );
        }
        const clueAcross = parseInt(parts[1], 10);
        const clueDown = parseInt(parts[2], 10);
        grid[row][col] = {
          type: 'clue',
          row,
          col,
          ...(clueAcross > 0 && { clueAcross }),
          ...(clueDown > 0 && { clueDown }),
        };
      } else {
        throw new Error(
          `Unknown cell token "${token}" at row ${row}, col ${col}. Valid tokens: E, P, C:a:d`
        );
      }
    }
  }

  // Optional difficulty metadata line
  let difficulty: Difficulty = 'medium';
  if (lines.length > size + 1) {
    const meta = lines[size + 1].toLowerCase() as Difficulty;
    if (['easy', 'medium', 'hard'].includes(meta)) difficulty = meta;
  }

  return { grid, size, difficulty };
}

// ---------------------------------------------------------------------------
// Serialiser
// ---------------------------------------------------------------------------

/** Convert a KakuroGrid back to .KAK text so puzzles can be saved to disk. */
export function serializeToKAK(puzzle: KakuroGrid): string {
  const lines: string[] = [String(puzzle.size)];

  for (const row of puzzle.grid) {
    const tokens = row.map((cell) => {
      if (cell.type === 'empty') return 'E';
      if (cell.type === 'playable') return 'P';
      const a = cell.clueAcross ?? 0;
      const d = cell.clueDown ?? 0;
      return `C:${a}:${d}`;
    });
    lines.push(tokens.join(' '));
  }

  lines.push(puzzle.difficulty);
  return lines.join('\n');
}
