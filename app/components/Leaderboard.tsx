'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';

interface UserProfile {
  username: string;
  displayUsername: string;
  email: string;
  createdAt: number;
}

interface UserStats {
  competitiveWins: number;
  competitiveLosses: number;
  bestCompStreak: number;
  quickuroWins: number;
  quickuroLosses: number;
  quickuroBestStreak: number;
  quickuroBestTime: number | null;
}

interface LeaderboardEntry {
  uid: string;
  displayUsername: string;
  competitiveWins: number;
  competitiveLosses: number;
  bestCompStreak: number;
  quickuroWins: number;
  quickuroLosses: number;
  quickuroBestStreak: number;
  quickuroBestTime: number | null;
}

type LeaderboardTab = 'competitive' | 'quickuro';

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<LeaderboardTab>('competitive');

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const [usersSnap, statsSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'userStats')),
        ]);

        const userMap = new Map<string, UserProfile>();

        usersSnap.forEach((docSnap) => {
          userMap.set(docSnap.id, docSnap.data() as UserProfile);
        });

        const merged: LeaderboardEntry[] = [];

        statsSnap.forEach((docSnap) => {
          const stats = docSnap.data() as Partial<UserStats>;
          const profile = userMap.get(docSnap.id);

          merged.push({
            uid: docSnap.id,
            displayUsername:
              profile?.displayUsername?.trim() ||
              profile?.username ||
              'Unknown User',
            competitiveWins: stats.competitiveWins ?? 0,
            competitiveLosses: stats.competitiveLosses ?? 0,
            bestCompStreak: stats.bestCompStreak ?? 0,
            quickuroWins: stats.quickuroWins ?? 0,
            quickuroLosses: stats.quickuroLosses ?? 0,
            quickuroBestStreak: stats.quickuroBestStreak ?? 0,
            quickuroBestTime: stats.quickuroBestTime ?? null,
          });
        });

        setEntries(merged);
      } catch (error) {
        console.error('Failed to load leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, []);

  const competitiveEntries = useMemo(() => {
    return [...entries]
      .filter((entry) => entry.competitiveWins > 0 || entry.competitiveLosses > 0)
      .sort((a, b) => {
        if (b.competitiveWins !== a.competitiveWins) {
          return b.competitiveWins - a.competitiveWins;
        }
        if (b.bestCompStreak !== a.bestCompStreak) {
          return b.bestCompStreak - a.bestCompStreak;
        }
        return a.competitiveLosses - b.competitiveLosses;
      })
      .slice(0, 5);
  }, [entries]);

  const quickuroEntries = useMemo(() => {
    return [...entries]
      .filter((entry) => entry.quickuroWins > 0 || entry.quickuroLosses > 0)
      .sort((a, b) => {
        if (b.quickuroWins !== a.quickuroWins) {
          return b.quickuroWins - a.quickuroWins;
        }
        if (b.quickuroBestStreak !== a.quickuroBestStreak) {
          return b.quickuroBestStreak - a.quickuroBestStreak;
        }
        if (a.quickuroBestTime === null && b.quickuroBestTime === null) return 0;
        if (a.quickuroBestTime === null) return 1;
        if (b.quickuroBestTime === null) return -1;
        return a.quickuroBestTime - b.quickuroBestTime;
      })
      .slice(0, 5);
  }, [entries]);

  const activeEntries =
    tab === 'competitive' ? competitiveEntries : quickuroEntries;

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRankDisplay = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={tab === 'competitive' ? 'default' : 'outline'}
          onClick={() => setTab('competitive')}
          className={
            tab === 'competitive'
              ? 'bg-orange-500 text-white hover:bg-orange-600'
              : 'text-xs'
          }
        >
          Comp
        </Button>

        <Button
          type="button"
          size="sm"
          variant={tab === 'quickuro' ? 'default' : 'outline'}
          onClick={() => setTab('quickuro')}
          className={
            tab === 'quickuro'
              ? 'bg-violet-600 text-white hover:bg-violet-700'
              : 'text-xs'
          }
        >
          Quickuro
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-foreground" />
        </div>
      ) : activeEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No leaderboard data yet.</p>
      ) : (
        <div className="space-y-2">
          {activeEntries.map((entry, index) => (
            <div
              key={entry.uid}
              className="rounded-lg border border-border bg-muted/40 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {getRankDisplay(index)}
                    </span>
                    <p className="truncate text-sm font-semibold text-foreground">
                      {entry.displayUsername}
                    </p>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>
                      W: <span className="font-medium text-foreground">
                        {tab === 'competitive' ? entry.competitiveWins : entry.quickuroWins}
                      </span>
                    </span>
                    <span>
                      L: <span className="font-medium text-foreground">
                        {tab === 'competitive' ? entry.competitiveLosses : entry.quickuroLosses}
                      </span>
                    </span>
                    <span>
                      Streak: <span className="font-medium text-foreground">
                        {tab === 'competitive'
                          ? entry.bestCompStreak
                          : entry.quickuroBestStreak}
                      </span>
                    </span>
                  </div>
                </div>

                {tab === 'quickuro' && (
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Best
                    </div>
                    <div className="text-sm font-bold text-foreground">
                      {formatTime(entry.quickuroBestTime)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}