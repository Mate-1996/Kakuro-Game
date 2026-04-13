'use client';

import { useState } from 'react';
import KakuroGame from './Kakurogame';
import {
  generateKakuroPuzzle,
  type Difficulty,
  type KakuroGrid,
} from '@/lib/Kakuroutils';
import { Button } from '@/components/ui/button';

type QuickuroView = 'setup' | 'game';

export default function Quickuro({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<QuickuroView>('setup');
  const [gridSize, setGridSize] = useState<6 | 8 | 10>(8);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [timeLimit, setTimeLimit] = useState(300);
  const [puzzle, setPuzzle] = useState<KakuroGrid | null>(null);

  const handleStart = () => {
    const newPuzzle = generateKakuroPuzzle(gridSize, difficulty);
    setPuzzle(newPuzzle);
    setView('game');
  };

  const handleBackFromGame = () => {
    setPuzzle(null);
    setView('setup');
  };

  if (view === 'setup') {
    return (
      <div className="w-full max-w-4xl space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-lg font-medium text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
          <h1 className="text-5xl font-bold text-foreground text-violet-700">Quickuro</h1> 
        </div>

        <div className="rounded-xl border border-border bg-card p-8 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Customize Your Run</h2>
            <p className="text-muted-foreground">
              Choose your timer, board size, and difficulty, then start the puzzle.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Time Limit
              </label>
              <select
                value={timeLimit}
                onChange={(e) => setTimeLimit(parseInt(e.target.value, 10))}
                className="w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm font-medium text-foreground focus:border-ring focus:outline-none"
              >
                <option value={60}>1:00</option>
                <option value={180}>3:00</option>
                <option value={300}>5:00</option>
                <option value={600}>10:00</option>
                <option value={900}>15:00</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Grid Size
              </label>
              <select
                value={gridSize}
                onChange={(e) => setGridSize(parseInt(e.target.value, 10) as 6 | 8 | 10)}
                className="w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm font-medium text-foreground focus:border-ring focus:outline-none"
              >
                <option value={6}>6×6</option>
                <option value={8}>8×8</option>
                <option value={10}>10×10</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm font-medium text-foreground focus:border-ring focus:outline-none"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <h3 className="mb-2 font-semibold text-foreground">Quickuro Rules</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Your selected timer starts as soon as the board loads</li>
              <li>• Finish the puzzle before time runs out</li>
              <li>• Tab switching and suspiciously fast solving are monitored</li>
              <li>• This mode uses your custom settings instead of random competitive matchmaking</li>
            </ul>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={handleStart}
              size="lg"
              className="cursor-pointer bg-violet-600 px-8 py-6 text-lg font-bold text-white hover:bg-violet-700"
            >
              Start!
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'game' && puzzle) {
    return (
      <div className="w-full max-w-4xl space-y-4">
        <KakuroGame
          onBack={handleBackFromGame}
          mode="quickuro"
          initialPuzzle={puzzle}
          matchTimeLimit={timeLimit}
        />
      </div>
    );
  }

  return null;
}