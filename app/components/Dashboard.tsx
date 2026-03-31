'use client';

import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '../context/AuthContext';
import KakuroGame from './Kakurogame';
import CompetitiveMode from './CompetitiveMode';
import Quickuro from './Quickuro';
import FriendsList from './FriendsList';
import Achievements from './Achievements';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

type DashboardView = 'home' | 'normal' | 'competitive' | 'friends' | 'quickuro';
type SidebarSection = 'stats' | 'achievements' | 'friends';

export default function Dashboard() {
  const { user, userProfile, userStats, isGuest, setIsGuest } = useAuth();
  const [view, setView] = useState<DashboardView>('home');
  const [expandedSections, setExpandedSections] = useState<Record<SidebarSection, boolean>>({
    stats: true,
    achievements: true,
    friends: true,
  });

  const handleSignOut = async () => {
    try {
      if (isGuest) {
        setIsGuest(false);
      } else {
        await signOut(auth);
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleSection = (section: SidebarSection) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (view === 'normal') {
    return <KakuroGame onBack={() => setView('home')} mode="normal" />;
  }

  if (view === 'competitive') {
    return <CompetitiveMode onBack={() => setView('home')} />;
  }

  if (view === 'quickuro') {
    return <Quickuro onBack={() => setView('home')} />;
  }

  const displayName = isGuest
    ? 'Guest'
    : userProfile?.displayUsername || userProfile?.username || user?.displayName || user?.email;

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex w-full max-w-7xl gap-6">
      {/* LEFT SIDEBAR */}
      <aside className="hidden w-72 shrink-0 space-y-4 lg:block">
        {/* Profile Card */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
              {displayName?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-foreground">{displayName}</h2>
              <p className="text-xs text-muted-foreground">{isGuest ? 'Guest Player' : 'Member'}</p>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="rounded-xl border border-border bg-card">
          <button
            onClick={() => toggleSection('stats')}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M3 3v18h18"/>
                <path d="m19 9-5 5-4-4-3 3"/>
              </svg>
              <span className="text-sm font-semibold text-foreground">Stats</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-muted-foreground transition-transform ${expandedSections.stats ? 'rotate-180' : ''}`}>
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
          {expandedSections.stats && (
            <div className="border-t border-border px-4 pb-4 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-xl font-bold text-foreground">{userStats.gamesPlayed}</div>
                  <div className="text-[10px] font-medium text-muted-foreground">Played</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-xl font-bold text-foreground">{userStats.gamesWon}</div>
                  <div className="text-[10px] font-medium text-muted-foreground">Won</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-xl font-bold text-foreground">{formatTime(userStats.bestTime)}</div>
                  <div className="text-[10px] font-medium text-muted-foreground">Best Time</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-xl font-bold text-foreground">{userStats.competitiveWins}</div>
                  <div className="text-[10px] font-medium text-muted-foreground">Comp Wins</div>
                </div>
              </div>
              {/* Difficulty breakdown */}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Easy</span>
                  <span className="font-medium text-foreground">{userStats.easyCompleted}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Medium</span>
                  <span className="font-medium text-foreground">{userStats.mediumCompleted}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Hard</span>
                  <span className="font-medium text-foreground">{userStats.hardCompleted}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Achievements Section */}
        <div className="rounded-xl border border-border bg-card">
          <button
            onClick={() => toggleSection('achievements')}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🏆</span>
              <span className="text-sm font-semibold text-foreground">Achievements</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-muted-foreground transition-transform ${expandedSections.achievements ? 'rotate-180' : ''}`}>
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
          {expandedSections.achievements && (
            <div className="border-t border-border px-4 pb-4 pt-3">
              <Achievements compact />
            </div>
          )}
        </div>

        {/* Friends Section */}
        {!isGuest && user && (
          <div className="rounded-xl border border-border bg-card">
            <button
              onClick={() => toggleSection('friends')}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span className="text-sm font-semibold text-foreground">Friends</span>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-muted-foreground transition-transform ${expandedSections.friends ? 'rotate-180' : ''}`}>
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>
            {expandedSections.friends && (
              <div className="border-t border-border px-4 pb-4 pt-3">
                <FriendsList compact />
              </div>
            )}
          </div>
        )}
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 space-y-6 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Kakuro</h1>
            <p className="mt-1 text-sm text-muted-foreground">Welcome back, {displayName}</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              {isGuest ? 'Back to Home' : 'Sign out'}
            </button>
          </div>
        </div>

        {/* Play Section */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Normal Mode Card */}
          <button
            onClick={() => setView('normal')}
            className="group rounded-xl border-2 border-border bg-card p-8 text-left transition-all hover:border-primary hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-3xl transition-transform group-hover:scale-110">
                🎮
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Normal Mode</h3>
                <p className="text-sm text-muted-foreground">Practice at your own pace</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Choose any grid size and difficulty. No time pressure — learn and improve your skills.
            </p>
          </button>

          {/* Competitive Mode Card */}
          {isGuest ? (
            <div className="relative rounded-xl border-2 border-border bg-card p-8 opacity-60">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-500/10 text-3xl">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-muted-foreground">Competitive Mode</h3>
                  <p className="text-sm text-muted-foreground">Sign in to unlock</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Match against other players in real-time. Random difficulty and grid size.
              </p>
            </div>
          ) : (
            <button
              onClick={() => setView('competitive')}
              className="group rounded-xl border-2 border-orange-500/50 bg-card p-8 text-left transition-all hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-500/10 text-3xl transition-transform group-hover:scale-110">
                  ⚔️
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">Competitive Mode</h3>
                  <p className="text-sm text-orange-600 dark:text-orange-400">Challenge other players!</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Match against others or challenge friends. Random difficulty & grid — first to finish wins!
              </p>
            </button>
          )}

          {/* Normal Mode Card */}
          <button
            onClick={() => setView('quickuro')}
            className="group rounded-xl border-2 border-violet-800 bg-card p-8 text-left transition-all hover:border-violet-700 hover:shadow-xl hover:shadow-violet-600/50"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-3xl transition-transform group-hover:scale-110">
                ⚡
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Quickuro™️</h3>
                <p className="text-sm text-muted-foreground text-violet-500">Play against a set time.</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Choose your own grid size, difficulty, and time. Race against time!
            </p>
          </button>
        </div>

        {/* Mobile-only sections (shown below on small screens) */}
        <div className="space-y-4 lg:hidden">
          {/* Mobile Stats */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">Stats</h2>
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-xl font-bold text-foreground">{userStats.gamesPlayed}</div>
                <div className="text-[10px] text-muted-foreground">Played</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-xl font-bold text-foreground">{userStats.gamesWon}</div>
                <div className="text-[10px] text-muted-foreground">Won</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-xl font-bold text-foreground">{formatTime(userStats.bestTime)}</div>
                <div className="text-[10px] text-muted-foreground">Best</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-xl font-bold text-foreground">{userStats.competitiveWins}</div>
                <div className="text-[10px] text-muted-foreground">Comp</div>
              </div>
            </div>
          </div>

          {/* Mobile Achievements */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">Achievements</h2>
            <Achievements compact />
          </div>

          {/* Mobile Friends */}
          {!isGuest && user && (
            <FriendsList compact />
          )}
        </div>

        {/* Guest upsell */}
        {isGuest && (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <h3 className="text-lg font-semibold text-foreground">Want more features?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create an account to unlock competitive mode, friend lists, and track your stats.
            </p>
            <Button className="mt-4 cursor-pointer" onClick={() => setIsGuest(false)}>
              Create Account
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}