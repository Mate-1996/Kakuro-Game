'use client';

import { useState, useEffect } from 'react';
import {
  generateKakuroPuzzle,
  isValidMove,
  isPuzzleComplete,
  getRowGroup,
  getColGroup,
  type Cell,
  type KakuroGrid,
} from '@/lib/Kakuroutils';

interface KakuroGameProps {
  onBack: () => void;
}

export default function KakuroGame({ onBack }: KakuroGameProps) {
  const [puzzle, setPuzzle] = useState<KakuroGrid | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [gridSize, setGridSize] = useState<6 | 8 | 10 | 12>(8);
  const [showingErrors, setShowingErrors] = useState(false);
  const [showingSolution, setShowingSolution] = useState(false);

  // timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && !isComplete) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, isComplete]);

  // start new game
  const startNewGame = (size: number = gridSize) => {
    const newPuzzle = generateKakuroPuzzle(size);
    setPuzzle(newPuzzle);
    setSelectedCell(null);
    setIsComplete(false);
    setTimer(0);
    setIsRunning(true);
    setShowingErrors(false);
    setShowingSolution(false);
  };

  // initialize the puzzle
  useEffect(() => {
    startNewGame(gridSize);
  }, []);

  // check puzzle for errors
  const handleCheck = () => {
    if (!puzzle) return;
    
    setShowingErrors(true);
    setShowingSolution(false);
    
    // count all the correct and incorrect cells
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
    
    // force re-render by creating new grid reference
    const newGrid = puzzle.grid.map((r) =>
      r.map((c) => ({ ...c }))
    );
    setPuzzle({ ...puzzle, grid: newGrid });
    
    // show results
    setTimeout(() => {
      if (incorrect === 0 && correct > 0) {
        alert(`All ${correct} filled cells are correct`);
      } else if (incorrect > 0) {
        alert(`You have ${correct} correct cells and ${incorrect} incorrect cells`);
      } else {
        alert('Fill in some cells first');
      }
    }, 100);
  };

  // reveal solution
  const handleReveal = () => {
    if (!puzzle) return;
    
    const confirmed = confirm('Are you sure you want to reveal the solution? This will end the current game.');
    if (!confirmed) return;
    
    const newGrid = puzzle.grid.map((r) =>
      r.map((c) => ({ ...c }))
    );
    
    // filling the playable cells with the solution
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
  };

  const handleCellClick = (row: number, col: number) => {
    if (!puzzle) return;
    const cell = puzzle.grid[row][col];
    if (cell.type === 'playable') {
      setSelectedCell({ row, col });
    }
  };

  const handleNumberInput = (num: number) => {
    if (!puzzle || !selectedCell) return;
    
    const { row, col } = selectedCell;
    const cell = puzzle.grid[row][col];
    
    if (cell.type !== 'playable' || cell.isFixed) return;

    // validation of the move
    if (num === 0 || isValidMove(puzzle.grid, row, col, num)) {
      const newGrid = puzzle.grid.map((r) =>
        r.map((c) => ({ ...c }))
      );
      
      newGrid[row][col].value = num === 0 ? undefined : num;
      
      setPuzzle({ ...puzzle, grid: newGrid });
      
      // check if the puzzle is complete
      if (isPuzzleComplete(newGrid)) {
        setIsComplete(true);
        setIsRunning(false);
      }
    }
  };

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
  }, [selectedCell, puzzle]);


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };


  const isCellError = (cell: Cell) => {
    if (cell.type !== 'playable' || !cell.value || cell.isFixed) return false;
    if (showingErrors) {
      return cell.value !== cell.solution;
    }
    return false;
  };

  // check if cell is correct 
  const isCellCorrect = (cell: Cell) => {
    if (cell.type !== 'playable' || !cell.value || cell.isFixed) return false;
    if (showingErrors) {
      return cell.value === cell.solution;
    }
    return false;
  };

  // get cell highlight class
  const getCellHighlight = (cell: Cell) => {
    if (!selectedCell) return '';
    
    const rowGroup = getRowGroup(puzzle!.grid, selectedCell.row, selectedCell.col);
    const colGroup = getColGroup(puzzle!.grid, selectedCell.row, selectedCell.col);
    
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-lg font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            ← Back
          </button>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white sm:hidden">
            {formatTime(timer)}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 rounded-lg border-2 border-zinc-300 bg-white px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900">
            <label className="text-base font-semibold text-zinc-700 dark:text-zinc-300">
              Grid Size:
            </label>
            <select
              value={gridSize}
              onChange={(e) => {
                const newSize = parseInt(e.target.value) as 6 | 8 | 10;
                setGridSize(newSize);
              }}
              className="rounded-md border-2 border-zinc-400 bg-white px-3 py-1.5 text-base font-bold text-zinc-900 focus:border-zinc-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:focus:border-zinc-400"
            >
              <option value={6}>6 × 6</option>
              <option value={8}>8 × 8</option>
              <option value={10}>10 × 10</option>
            </select>
          </div>
          <div className="hidden text-3xl font-bold text-zinc-900 dark:text-white sm:block">
            {formatTime(timer)}
          </div>
        </div>
      </div>

      {/* Game Complete Modal */}
      {isComplete && (
        <div className="rounded-lg border-2 border-green-500 bg-green-50 p-6 text-center dark:bg-green-900/20">
          <h2 className="text-3xl font-bold text-green-900 dark:text-green-100">
             Congratulations
          </h2>
          <p className="mt-2 text-green-700 dark:text-green-300">
            You completed the puzzle in {formatTime(timer)}!
          </p>
          <button
            onClick={() => startNewGame(gridSize)}
            className="mt-4 rounded-lg bg-green-600 px-6 py-2 font-semibold text-white hover:bg-green-700"
          >
            New Game
          </button>
        </div>
      )}

      {/* Game Board */}
      <div className="overflow-x-auto rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
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
                  {/* Clue cell */}
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

                  {/* Playable cell */}
                  {cell.type === 'playable' && (
                    <div className={`flex h-full w-full items-center justify-center text-2xl font-bold ${
                      cell.isFixed ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-white'
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
        {[2, 4].map((num) => (
          <button
            key={num}
            onClick={() => handleNumberInput(num)}
            disabled={!selectedCell}
            className="aspect-square rounded-lg border-2 border-zinc-300 bg-white text-2xl font-bold text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
          >
            {num}
          </button>
        ))}
        <button
          onClick={() => handleNumberInput(0)}
          disabled={!selectedCell}
          className="aspect-square rounded-lg border-2 border-zinc-300 bg-white text-lg font-bold text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
        >
          Clear
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => startNewGame(gridSize)}
          className="rounded-lg border-2 border-zinc-900 bg-zinc-900 px-6 py-2 font-semibold text-white hover:bg-zinc-800 dark:border-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
        >
          New Grid
        </button>
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
      </div>
    </div>
  );
}