// Shared types for the Kakuro backend

export type CellType = 'empty' | 'clue' | 'playable';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Cell {
  type: CellType;
  row: number;
  col: number;
  value?: number;      // player's current input
  solution?: number;   // correct answer (set during generation)
  clueDown?: number;
  clueAcross?: number;
  isFixed?: boolean;   // pre-filled hint cell — cannot be changed
}

export interface KakuroGrid {
  grid: Cell[][];
  size: number;
  difficulty: Difficulty;
}

// Returned by POST /api/validate
export interface ValidationError {
  row: number;
  col: number;
  type: 'wrong_value' | 'duplicate' | 'sum_mismatch' | 'sum_exceeded';
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  isComplete: boolean;
  errors: ValidationError[];
  stats: {
    filled: number;
    total: number;
    correct: number;
    incorrect: number;
  };
}

// Returned by POST /api/check-cell
export interface CellCheckResult {
  valid: boolean;
  conflicts: { row: number; col: number }[];
  message: string;
}

// Returned by POST /api/hint
export interface HintResult {
  row: number;
  col: number;
  value: number;
  hintType: 'naked_single' | 'sum_forced' | 'only_possible_in_group' | 'general';
  message: string;
}

// Used by the puzzle parser
export interface ParsedPuzzle {
  grid: Cell[][];
  size: number;
  difficulty: Difficulty;
}
