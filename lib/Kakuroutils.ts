/**
 * Kakuroutils.ts – compatibility shim
 *
 * All game logic has been moved into the /backend modules so each concern
 * is maintained independently.  This file re-exports everything that the
 * frontend currently imports so no component needs to change.
 *
 * Backend modules:
 *   backend/types.ts             — shared TypeScript types
 *   backend/puzzleGenerator.ts   — puzzle generation + difficulty helpers
 *   backend/constraintChecker.ts — move validation + full-grid validation
 *   backend/solver.ts            — backtracking solver + uniqueness checker
 *   backend/hintSystem.ts        — incremental hint engine
 *   backend/puzzleParser.ts      — JSON / .KAK file parser
 *
 * API routes (Next.js App Router):
 *   GET  /api/puzzle      — generate a new puzzle
 *   POST /api/validate    — validate the full grid
 *   POST /api/check-cell  — validate a single cell placement
 *   POST /api/solution    — retrieve the full solution
 *   POST /api/hint        — get the next logical hint
 */

// Types
export type { CellType, Difficulty, Cell, KakuroGrid } from '@/backend/types';

// Generation helpers
export {
  generateKakuroPuzzle,
  getTimeLimitForDifficulty,
  getDifficultyForSize,
} from '@/backend/puzzleGenerator';

// Constraint / validation helpers (used directly in the game component)
export {
  isValidMove,
  isPuzzleComplete,
  getRowGroup,
  getColGroup,
} from '@/backend/constraintChecker';
