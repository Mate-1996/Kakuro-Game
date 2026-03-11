/**
 * lib/storage.ts
 *
 * Client-side localStorage management for game state, preferences, and puzzle progress.
 * All stored data is namespaced with a "kakuro_" prefix.
 *
 * Stored data types:
 *   - Puzzle progress:   current cell values, pencil marks/candidates
 *   - Puzzle metadata:   puzzle ID, difficulty, size, generated timestamp
 *   - Game state:        timer, mode, completion status
 *   - Settings:          sound, theme, error highlighting, show combinations
 *   - Theme:             dark/light mode preference
 */

// ============================================================================
// Types
// ============================================================================

export interface PencilMarks {
  [row: number]: {
    [col: number]: Set<number>;
  };
}

export interface SavedPuzzleProgress {
  puzzleId: string;
  size: number;
  difficulty: 'easy' | 'medium' | 'hard';
  gridValues: (number | undefined)[][];
  pencilMarks: Record<string, number[]>; // serialized Set<number>
  startedAt: number;
  elapsedSeconds: number;
  lastSavedAt: number;
}

export interface GameSettings {
  soundEnabled: boolean;
  errorHighlighting: boolean;
  showSumCombinations: boolean;
  theme: 'light' | 'dark';
}

export const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  errorHighlighting: true,
  showSumCombinations: false,
  theme: 'light',
};

// ============================================================================
// Storage keys
// ============================================================================

const STORAGE_PREFIX = 'kakuro_';

const KEYS = {
  PUZZLE_PROGRESS: (puzzleId: string) => `${STORAGE_PREFIX}puzzle_${puzzleId}`,
  CURRENT_PUZZLE: `${STORAGE_PREFIX}current_puzzle_id`,
  SETTINGS: `${STORAGE_PREFIX}settings`,
  THEME: `${STORAGE_PREFIX}theme`,
  TIMER: (puzzleId: string) => `${STORAGE_PREFIX}timer_${puzzleId}`,
};

// ============================================================================
// Puzzle Progress Storage
// ============================================================================

/**
 * Save the current puzzle progress (grid state, pencil marks, timer).
 */
export function savePuzzleProgress(
  puzzleId: string,
  gridValues: (number | undefined)[][],
  pencilMarks: PencilMarks,
  difficulty: 'easy' | 'medium' | 'hard',
  size: number,
  elapsedSeconds: number,
  startedAt: number
): void {
  // Serialize pencil marks (convert Set<number> to array for JSON)
  const serializedMarks: Record<string, number[]> = {};
  for (const rowKey in pencilMarks) {
    const row = pencilMarks[parseInt(rowKey, 10)];
    for (const colKey in row) {
      const col = cellKey(parseInt(rowKey, 10), parseInt(colKey, 10));
      serializedMarks[col] = Array.from(row[parseInt(colKey, 10)]);
    }
  }

  const progress: SavedPuzzleProgress = {
    puzzleId,
    size,
    difficulty,
    gridValues,
    pencilMarks: serializedMarks,
    startedAt,
    elapsedSeconds,
    lastSavedAt: Date.now(),
  };

  try {
    localStorage.setItem(KEYS.PUZZLE_PROGRESS(puzzleId), JSON.stringify(progress));
    localStorage.setItem(KEYS.CURRENT_PUZZLE, puzzleId);
  } catch (err) {
    console.error('[storage] Failed to save puzzle progress:', err);
  }
}

/**
 * Load saved puzzle progress for a specific puzzle ID.
 */
export function loadPuzzleProgress(puzzleId: string): SavedPuzzleProgress | null {
  try {
    const raw = localStorage.getItem(KEYS.PUZZLE_PROGRESS(puzzleId));
    if (!raw) return null;
    return JSON.parse(raw) as SavedPuzzleProgress;
  } catch (err) {
    console.error('[storage] Failed to load puzzle progress:', err);
    return null;
  }
}

/**
 * Load the most recently played puzzle ID.
 */
export function loadCurrentPuzzleId(): string | null {
  try {
    return localStorage.getItem(KEYS.CURRENT_PUZZLE);
  } catch {
    return null;
  }
}

/**
 * Clear progress for a specific puzzle (when starting fresh).
 */
export function clearPuzzleProgress(puzzleId: string): void {
  try {
    localStorage.removeItem(KEYS.PUZZLE_PROGRESS(puzzleId));
  } catch (err) {
    console.error('[storage] Failed to clear puzzle progress:', err);
  }
}

/**
 * Clear all puzzle progress data.
 */
export function clearAllPuzzleProgress(): void {
  try {
    const keys = Object.keys(localStorage);
    keys
      .filter((k) => k.startsWith(`${STORAGE_PREFIX}puzzle_`))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(KEYS.CURRENT_PUZZLE);
  } catch (err) {
    console.error('[storage] Failed to clear all puzzle progress:', err);
  }
}

// ============================================================================
// Settings Storage
// ============================================================================

/**
 * Load user settings or return defaults.
 */
export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save user settings.
 */
export function saveSettings(settings: Partial<GameSettings>): void {
  try {
    const current = loadSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));
  } catch (err) {
    console.error('[storage] Failed to save settings:', err);
  }
}

// ============================================================================
// Theme Storage
// ============================================================================

/**
 * Load the user's theme preference (light/dark).
 */
export function loadTheme(): 'light' | 'dark' {
  try {
    const theme = localStorage.getItem(KEYS.THEME);
    if (theme === 'dark' || theme === 'light') return theme;
    // Fallback to system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  } catch {
    return 'light';
  }
}

/**
 * Save the user's theme preference.
 */
export function saveTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(KEYS.THEME, theme);
    // Apply it globally
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  } catch (err) {
    console.error('[storage] Failed to save theme:', err);
  }
}

// ============================================================================
// Helper: Convert pencil marks back from storage format
// ============================================================================

export function deserializePencilMarks(serialized: Record<string, number[]>): PencilMarks {
  const result: PencilMarks = {};
  for (const cellStr in serialized) {
    const [row, col] = cellStr.split('_').map(Number);
    if (!result[row]) result[row] = {};
    result[row][col] = new Set(serialized[cellStr]);
  }
  return result;
}

// ============================================================================
// Helper: Format cell key for storing pencil marks
// ============================================================================

function cellKey(row: number, col: number): string {
  return `${row}_${col}`;
}
