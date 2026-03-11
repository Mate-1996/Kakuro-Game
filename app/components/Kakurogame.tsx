'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  generateKakuroPuzzle,
  isValidMove,
  isPuzzleComplete,
  getRowGroup,
  getColGroup,
  getTimeLimitForDifficulty,
  type Cell,
  type KakuroGrid,
  type Difficulty,
} from '@/lib/Kakuroutils';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

interface KakuroGameProps {
  onBack: () => void;
  mode?: 'normal' | 'competitive';
  initialPuzzle?: KakuroGrid;
  matchTimeLimit?: number;
  onCompetitiveComplete?: (timeRemaining: number) => void;
  onCompetitiveTimeUp?: () => void;
  onCheckUsed?: () => void;
  hideControls?: boolean;
}

const CACHE_KEY = 'kakuro_game_state';

function saveGameState(state: {
  puzzle: KakuroGrid;
  timer: number;
  gridSize: number;
  difficulty: Difficulty;
  mode: string;
  isComplete: boolean;
}) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {}
}

function loadGameState() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function clearGameState() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {}
}

export default function KakuroGame({
  onBack,
  mode = 'normal',
  initialPuzzle,
  matchTimeLimit,
  onCompetitiveComplete,
  onCompetitiveTimeUp,
  onCheckUsed,
  hideControls = false,
}: KakuroGameProps) {
  const { updateGameStats } = useAuth();
  const [puzzle, setPuzzle] = useState<KakuroGrid | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [gridSize, setGridSize] = useState<6 | 8 | 10>(8);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [showingErrors, setShowingErrors] = useState(false);
  const [showingSolution, setShowingSolution] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const hasUsedCheck = useRef(false);

  // Anti-cheat: track suspicious behaviour
  const moveTimestamps = useRef<number[]>([]);
  const tabSwitchCount = useRef(0);
  const [cheatingDetected, setCheatingDetected] = useState(false);

  // Anti-cheat: detect rapid solving (more than 5 correct moves in 3 seconds)
  const checkRapidSolving = useCallback(() => {
    const now = Date.now();
    moveTimestamps.current.push(now);
    // Keep last 10 timestamps
    if (moveTimestamps.current.length > 10) {
      moveTimestamps.current = moveTimestamps.current.slice(-10);
    }
    // Check if 5+ moves happened within 3 seconds
    if (moveTimestamps.current.length >= 5) {
      const recentFive = moveTimestamps.current.slice(-5);
      const timeDiff = recentFive[recentFive.length - 1] - recentFive[0];
      if (timeDiff < 3000) {
        setCheatingDetected(true);
        toast.error('Suspicious activity detected! Moves are too fast.');
        return true;
      }
    }
    return false;
  }, []);

  // Anti-cheat: detect tab/window switching
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && isRunning && mode === 'competitive') {
        tabSwitchCount.current++;
        if (tabSwitchCount.current >= 3) {
          setCheatingDetected(true);
          toast.error('Multiple tab switches detected during competitive mode!');
        } else {
          toast.warning(`Tab switch detected (${tabSwitchCount.current}/3 allowed)`);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isRunning, mode]);

  // Anti-cheat: detect paste events on the game area
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isRunning) {
        e.preventDefault();
        toast.error('Paste is not allowed during gameplay!');
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [isRunning]);

  // Timer effect (count up for normal, count down for competitive)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && !isComplete && !timeUp) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (mode === 'competitive') {
            const newVal = prev - 1;
            if (newVal <= 0) {
              setTimeUp(true);
              setIsRunning(false);
              if (onCompetitiveTimeUp) onCompetitiveTimeUp();
              return 0;
            }
            return newVal;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, isComplete, timeUp, mode, onCompetitiveTimeUp]);

  // Save state periodically
  useEffect(() => {
    if (puzzle && isRunning) {
      saveGameState({
        puzzle,
        timer,
        gridSize,
        difficulty,
        mode,
        isComplete,
      });
    }
  }, [puzzle, timer, gridSize, difficulty, mode, isComplete, isRunning]);

  // Start new game
  const startNewGame = useCallback((size: number = gridSize, diff: Difficulty = difficulty) => {
    const newPuzzle = generateKakuroPuzzle(size, diff);
    setPuzzle(newPuzzle);
    setSelectedCell(null);
    setIsComplete(false);
    setShowingErrors(false);
    setShowingSolution(false);
    setTimeUp(false);
    setCheatingDetected(false);
    hasUsedCheck.current = false;
    moveTimestamps.current = [];
    tabSwitchCount.current = 0;

    if (mode === 'competitive') {
      setTimer(matchTimeLimit || getTimeLimitForDifficulty(diff, size));
    } else {
      setTimer(0);
    }
    setIsRunning(true);
    setDifficulty(diff);
    setGridSize(size as 6 | 8 | 10);
    clearGameState();
  }, [gridSize, difficulty, mode, matchTimeLimit]);

  // Initialize: use initialPuzzle for competitive matches, or restore/start new
  useEffect(() => {
    if (initialPuzzle) {
      setPuzzle(initialPuzzle);
      setGridSize(initialPuzzle.size as 6 | 8 | 10);
      setDifficulty(initialPuzzle.difficulty);
      setTimer(matchTimeLimit || getTimeLimitForDifficulty(initialPuzzle.difficulty, initialPuzzle.size));
      setIsRunning(true);
      return;
    }

    const cached = loadGameState();
    if (cached && cached.mode === mode && !cached.isComplete) {
      try {
        setPuzzle(cached.puzzle);
        setTimer(cached.timer);
        setGridSize(cached.gridSize as 6 | 8 | 10);
        setDifficulty(cached.difficulty);
        setIsComplete(cached.isComplete);
        setIsRunning(true);
        return;
      } catch {
        // fallthrough to new game
      }
    }
    startNewGame(gridSize, difficulty);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Check puzzle for errors
  const handleCheck = () => {
    if (!puzzle) return;
    
    setShowingErrors(true);
    setShowingSolution(false);
    hasUsedCheck.current = true;
    if (onCheckUsed) onCheckUsed();
    
    let correct = 0;
    let incorrect = 0;
    
    for (const row of puzzle.grid) {
      for (const cell of row) {
        if (cell.type === 'playable' && !cell.isFixed && cell.value !== undefined) {
          if (cell.value === cell.solution) {
            correct++;
          } else {
            incorrect++;
          }
        }
      }
    }
    
    const newGrid = puzzle.grid.map((r) => r.map((c) => ({ ...c })));
    setPuzzle({ ...puzzle, grid: newGrid });
    
    setTimeout(() => {
      if (incorrect === 0 && correct > 0) {
        toast.success(`All ${correct} filled cells are correct!`);
      } else if (incorrect > 0) {
        toast.error(`${incorrect} incorrect cell${incorrect > 1 ? 's' : ''} found. ${correct} correct.`);
      } else {
        toast.info('Fill in some cells first!');
      }
    }, 100);
  };

  // Reveal solution
  const handleReveal = () => {
    if (!puzzle) return;
    
    const confirmed = confirm('Are you sure you want to reveal the solution? This will end the current game.');
    if (!confirmed) return;
    
    const newGrid = puzzle.grid.map((r) => r.map((c) => ({ ...c })));
    
    for (let row = 0; row < puzzle.size; row++) {
      for (let col = 0; col < puzzle.size; col++) {
        const cell = newGrid[row][col];
        if (cell.type === 'playable') {
          cell.value = cell.solution;
        }
      }
    }
    
    setPuzzle({ ...puzzle, grid: newGrid });
    setShowingSolution(true);
    setShowingErrors(false);
    setIsRunning(false);
    clearGameState();
  };

  const handleCellClick = (row: number, col: number) => {
    if (!puzzle || cheatingDetected || timeUp) return;
    const cell = puzzle.grid[row][col];
    if (cell.type === 'playable') {
      setSelectedCell({ row, col });
    }
  };

  const handleNumberInput = useCallback((num: number) => {
    if (!puzzle || !selectedCell || cheatingDetected || timeUp) return;
    
    const { row, col } = selectedCell;
    const cell = puzzle.grid[row][col];
    
    if (cell.type !== 'playable' || cell.isFixed) return;

    // Anti-cheat check
    if (mode === 'competitive' && checkRapidSolving()) return;

    if (num === 0 || isValidMove(puzzle.grid, row, col, num)) {
      const newGrid = puzzle.grid.map((r) => r.map((c) => ({ ...c })));
      
      newGrid[row][col].value = num === 0 ? undefined : num;
      
      setPuzzle({ ...puzzle, grid: newGrid });
      
      if (isPuzzleComplete(newGrid)) {
        setIsComplete(true);
        setIsRunning(false);
        clearGameState();
        if (mode === 'competitive') {
          if (onCompetitiveComplete) {
            onCompetitiveComplete(timer);
          }
          toast.success(`Puzzle solved with ${formatTime(timer)} remaining!`);
        } else {
          // Update stats for normal mode
          updateGameStats({
            won: true,
            time: timer,
            difficulty,
            gridSize,
            isCompetitive: false,
            isPerfect: !hasUsedCheck.current,
          }).then((newAchievements) => {
            if (newAchievements && newAchievements.length > 0) {
              newAchievements.forEach(a => {
                toast.success(`Achievement unlocked: ${a}!`, { duration: 5000 });
              });
            }
          });
          toast.success('Congratulations! Puzzle complete!');
        }
      }
    }
  }, [puzzle, selectedCell, cheatingDetected, timeUp, mode, checkRapidSolving]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!selectedCell) return;
      
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        handleNumberInput(num);
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        handleNumberInput(0);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleNumberInput, selectedCell]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isCellError = (cell: Cell) => {
    if (cell.type !== 'playable' || !cell.value || cell.isFixed) return false;
    if (showingErrors) return cell.value !== cell.solution;
    return false;
  };

  const isCellCorrect = (cell: Cell) => {
    if (cell.type !== 'playable' || !cell.value || cell.isFixed) return false;
    if (showingErrors) return cell.value === cell.solution;
    return false;
  };

  const getCellHighlight = (cell: Cell) => {
    if (!selectedCell || !puzzle) return '';
    
    const rowGroup = getRowGroup(puzzle.grid, selectedCell.row, selectedCell.col);
    const colGroup = getColGroup(puzzle.grid, selectedCell.row, selectedCell.col);
    
    const isInGroup = rowGroup.some(c => c.row === cell.row && c.col === cell.col) ||
                      colGroup.some(c => c.row === cell.row && c.col === cell.col);
    
    if (cell.row === selectedCell.row && cell.col === selectedCell.col) {
      return 'ring-2 ring-blue-500 bg-blue-100 dark:bg-blue-900/30';
    } else if (isInGroup) {
      return 'bg-blue-50 dark:bg-blue-900/10';
    }
    return '';
  };

  if (!puzzle) {
    return (
      <div className="flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { clearGameState(); onBack(); }}
            className="text-lg font-medium text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
          {mode === 'competitive' && (
            <span className="rounded-md bg-orange-100 px-2 py-1 text-sm font-semibold text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
              COMPETITIVE
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {/* Grid size + difficulty selectors (independent) */}
          {!hideControls && !initialPuzzle && (
            <div className="flex items-center gap-2 rounded-lg border-2 border-border bg-card px-3 py-2">
              <select
                value={gridSize}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value) as 6 | 8 | 10;
                  setGridSize(newSize);
                  startNewGame(newSize, difficulty);
                }}
                className="rounded-md border-2 border-input bg-background px-2 py-1 text-sm font-bold text-foreground focus:border-ring focus:outline-none"
              >
                <option value={6}>6×6</option>
                <option value={8}>8×8</option>
                <option value={10}>10×10</option>
              </select>
              <select
                value={difficulty}
                onChange={(e) => {
                  const newDiff = e.target.value as Difficulty;
                  setDifficulty(newDiff);
                  startNewGame(gridSize, newDiff);
                }}
                className="rounded-md border-2 border-input bg-background px-2 py-1 text-sm font-bold text-foreground focus:border-ring focus:outline-none"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          )}
          {/* Show match info for competitive with initial puzzle */}
          {initialPuzzle && (
            <div className="flex items-center gap-2 rounded-lg border-2 border-orange-500/50 bg-orange-50 px-3 py-2 dark:bg-orange-900/10">
              <span className="text-sm font-bold capitalize text-foreground">{difficulty}</span>
              <span className="text-sm text-muted-foreground">{gridSize}×{gridSize}</span>
            </div>
          )}
          <div className={`text-3xl font-bold ${
            mode === 'competitive' && timer <= 30 ? 'text-red-500 animate-pulse' : 'text-foreground'
          }`}>
            {formatTime(timer)}
          </div>
        </div>
      </div>

      {/* Cheating detected */}
      {cheatingDetected && (
        <div className="rounded-lg border-2 border-red-500 bg-red-50 p-6 text-center dark:bg-red-900/20">
          <h2 className="text-2xl font-bold text-red-900 dark:text-red-100">
            Suspicious Activity Detected
          </h2>
          <p className="mt-2 text-red-700 dark:text-red-300">
            This game session has been flagged. Your inputs are disabled.
          </p>
          <button
            onClick={() => startNewGame(gridSize, difficulty)}
            className="mt-4 rounded-lg bg-red-600 px-6 py-2 font-semibold text-white hover:bg-red-700"
          >
            Start Fresh
          </button>
        </div>
      )}

      {/* Time Up Modal (Competitive) */}
      {timeUp && (
        <div className="rounded-lg border-2 border-red-500 bg-red-50 p-6 text-center dark:bg-red-900/20">
          <h2 className="text-3xl font-bold text-red-900 dark:text-red-100">
            Time&apos;s Up!
          </h2>
          <p className="mt-2 text-red-700 dark:text-red-300">
            You ran out of time. Better luck next time!
          </p>
          <button
            onClick={() => startNewGame(gridSize, difficulty)}
            className="mt-4 rounded-lg bg-red-600 px-6 py-2 font-semibold text-white hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Game Complete Modal */}
      {isComplete && (
        <div className="rounded-lg border-2 border-green-500 bg-green-50 p-6 text-center dark:bg-green-900/20">
          <h2 className="text-3xl font-bold text-green-900 dark:text-green-100">
            Congratulations!
          </h2>
          <p className="mt-2 text-green-700 dark:text-green-300">
            {mode === 'competitive'
              ? `You completed the ${difficulty} puzzle with ${formatTime(timer)} remaining!`
              : `You completed the puzzle in ${formatTime(timer)}!`}
          </p>
          <button
            onClick={() => startNewGame(gridSize, difficulty)}
            className="mt-4 rounded-lg bg-green-600 px-6 py-2 font-semibold text-white hover:bg-green-700"
          >
            New Game
          </button>
        </div>
      )}

      {/* Game Board */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card p-4">
        <div className="inline-block min-w-full">
          <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 1fr))` }}>
            {puzzle.grid.map((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  className={`
                    relative aspect-square border border-zinc-400 dark:border-zinc-600
                    ${cell.type === 'empty' ? 'bg-zinc-800 dark:bg-zinc-950' : ''}
                    ${cell.type === 'clue' ? 'bg-zinc-800 dark:bg-zinc-950' : ''}
                    ${cell.type === 'playable' ? 'bg-white dark:bg-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700' : ''}
                    ${cell.isFixed ? 'bg-zinc-100 dark:bg-zinc-700' : ''}
                    ${getCellHighlight(cell)}
                    ${isCellError(cell) ? 'bg-red-100 dark:bg-red-900/30' : ''}
                    ${isCellCorrect(cell) ? 'bg-green-100 dark:bg-green-900/30' : ''}
                    ${showingSolution && cell.type === 'playable' ? 'bg-blue-100 dark:bg-blue-900/30' : ''}
                  `}
                  style={{ minWidth: '48px', minHeight: '48px' }}
                >
                  {cell.type === 'clue' && (
                    <>
                      <div className="absolute left-0 top-0 h-full w-full">
                        <svg viewBox="0 0 100 100" className="h-full w-full">
                          <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="3" className="text-zinc-500 dark:text-zinc-400" />
                        </svg>
                      </div>
                      {cell.clueDown && (
                        <div 
                          className="absolute font-bold text-red-400 dark:text-red-300" 
                          style={{ 
                            fontSize: puzzle.size <= 6 ? '1.5rem' : puzzle.size <= 8 ? '1.2rem' : puzzle.size <= 10 ? '1rem' : '0.9rem',
                            left: '20%',
                            top: '50%',
                            textShadow: '1px 1px 2px rgba(0,0,0,0.9)'
                          }}
                        >
                          {cell.clueDown}
                        </div>
                      )}
                      {cell.clueAcross && (
                        <div 
                          className="absolute font-bold text-blue-400 dark:text-blue-300" 
                          style={{ 
                            fontSize: puzzle.size <= 6 ? '1.5rem' : puzzle.size <= 8 ? '1.2rem' : puzzle.size <= 10 ? '1rem' : '0.9rem',
                            right: '20%',
                            bottom: '50%',
                            textShadow: '1px 1px 2px rgba(0,0,0,0.9)'
                          }}
                        >
                          {cell.clueAcross}
                        </div>
                      )}
                    </>
                  )}

                  {cell.type === 'playable' && (
                    <div className={`flex h-full w-full items-center justify-center text-2xl font-bold ${
                      cell.isFixed ? 'text-zinc-500 dark:text-zinc-400' : 'text-foreground'
                    }`}>
                      {cell.value || ''}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Number Pad */}
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handleNumberInput(num)}
            disabled={!selectedCell || cheatingDetected || timeUp}
            className="aspect-square rounded-lg border-2 border-border bg-card text-2xl font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {num}
          </button>
        ))}
        <button
          onClick={() => handleNumberInput(0)}
          disabled={!selectedCell || cheatingDetected || timeUp}
          className="aspect-square rounded-lg border-2 border-border bg-card text-lg font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Clear
        </button>
      </div>

      {/* Controls */}
      {!hideControls && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => startNewGame(gridSize, difficulty)}
            className="rounded-lg border-2 border-primary bg-primary px-6 py-2 font-semibold text-primary-foreground hover:bg-primary/90"
          >
            New Grid
          </button>
          {mode === 'normal' && (
            <>
              <button
                onClick={handleCheck}
                disabled={showingSolution}
                className="rounded-lg border-2 border-blue-500 bg-blue-500 px-6 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Check
              </button>
              <button
                onClick={handleReveal}
                disabled={showingSolution}
                className="rounded-lg border-2 border-orange-500 bg-orange-500 px-6 py-2 font-semibold text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reveal
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}