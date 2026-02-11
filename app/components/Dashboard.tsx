'use client';

import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '../context/AuthContext';
import KakuroGame from './Kakurogame';

export default function Dashboard() {
  const { user } = useAuth();
  const [isPlaying, setIsPlaying] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (isPlaying) {
    return <KakuroGame onBack={() => setIsPlaying(false)} />;
  }

  return (
    <div className="w-full max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Kakuro
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Welcome back, {user?.email}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
        >
          Sign out
        </button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">
          Play
        </h2>
        
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <button 
            onClick={() => setIsPlaying(true)}
            className="rounded-lg bg-zinc-900 px-6 py-4 font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            New Game
          </button>
          <button className="rounded-lg border border-zinc-300 bg-white px-6 py-4 font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800" disabled>
            Continue Game
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-2xl font-bold text-zinc-900 dark:text-white">0</div>
          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Games Played</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-2xl font-bold text-zinc-900 dark:text-white">0</div>
          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Games Won</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-2xl font-bold text-zinc-900 dark:text-white">--</div>
          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Best Time</div>
        </div>
      </div>
    </div>
  );
}