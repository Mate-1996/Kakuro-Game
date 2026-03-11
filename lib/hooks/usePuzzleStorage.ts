/**
 * lib/hooks/usePuzzleStorage.ts
 *
 * React hook for managing puzzle progress in localStorage.
 * Handles:
 *   - Saving puzzle state (grid, pencil marks, timer)
 *   - Loading puzzle progress
 *   - Theme persistence
 *   - Settings persistence
 *
 * Usage:
 *   const { savePuzzle, loadPuzzle, saveSettings, loadSettings } = usePuzzleStorage();
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import * as storage from '@/lib/storage';
import type { SavedPuzzleProgress, GameSettings, PencilMarks } from '@/lib/storage';

export function usePuzzleStorage() {
  const [settings, setSettings] = useState<GameSettings>(storage.DEFAULT_SETTINGS);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Load settings and theme on mount
  useEffect(() => {
    const loadedSettings = storage.loadSettings();
    const loadedTheme = storage.loadTheme();
    setSettings(loadedSettings);
    setTheme(loadedTheme);
  }, []);

  // Puzzle progress helpers
  const savePuzzleProgress = useCallback(
    (
      puzzleId: string,
      gridValues: (number | undefined)[][],
      pencilMarks: PencilMarks,
      difficulty: 'easy' | 'medium' | 'hard',
      size: number,
      elapsedSeconds: number,
      startedAt: number
    ) => {
      storage.savePuzzleProgress(
        puzzleId,
        gridValues,
        pencilMarks,
        difficulty,
        size,
        elapsedSeconds,
        startedAt
      );
    },
    []
  );

  const loadPuzzleProgress = useCallback((puzzleId: string): SavedPuzzleProgress | null => {
    return storage.loadPuzzleProgress(puzzleId);
  }, []);

  const getCurrentPuzzleId = useCallback((): string | null => {
    return storage.loadCurrentPuzzleId();
  }, []);

  const clearProgress = useCallback((puzzleId: string) => {
    storage.clearPuzzleProgress(puzzleId);
  }, []);

  const clearAllProgress = useCallback(() => {
    storage.clearAllPuzzleProgress();
  }, []);

  // Settings helpers
  const updateSettings = useCallback((newSettings: Partial<GameSettings>) => {
    const updated = { ...settings, ...newSettings };
    storage.saveSettings(updated);
    setSettings(updated);
  }, [settings]);

  // Theme helpers
  const updateTheme = useCallback((newTheme: 'light' | 'dark') => {
    storage.saveTheme(newTheme);
    setTheme(newTheme);
  }, []);

  return {
    // Puzzle progress
    savePuzzleProgress,
    loadPuzzleProgress,
    getCurrentPuzzleId,
    clearProgress,
    clearAllProgress,
    // Settings
    settings,
    updateSettings,
    // Theme
    theme,
    updateTheme,
  };
}
