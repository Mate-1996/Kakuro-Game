'use client';

import { useAuth, type UserStats } from '../context/AuthContext';

interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: 'first_win', name: 'First Victory', description: 'Complete your first puzzle', icon: '🏆' },
  { id: 'speed_demon', name: 'Speed Demon', description: 'Complete a puzzle in under 2 minutes', icon: '⚡' },
  { id: 'easy_5', name: 'Easy Going', description: 'Complete 5 easy puzzles', icon: '🌱' },
  { id: 'medium_5', name: 'Getting Serious', description: 'Complete 5 medium puzzles', icon: '🔥' },
  { id: 'hard_5', name: 'Hardcore', description: 'Complete 5 hard puzzles', icon: '💎' },
  { id: 'grid6_master', name: 'Small Board Master', description: 'Complete 10 puzzles on 6×6', icon: '📐' },
  { id: 'grid8_master', name: 'Standard Master', description: 'Complete 10 puzzles on 8×8', icon: '📏' },
  { id: 'grid10_master', name: 'Grand Master', description: 'Complete 10 puzzles on 10×10', icon: '🏅' },
  { id: 'first_comp_win', name: 'Competitor', description: 'Win your first competitive match', icon: '⚔️' },
  { id: 'comp_streak_5', name: 'On Fire', description: 'Win 5 competitive matches in a row', icon: '🔥' },
  { id: 'perfectionist', name: 'Perfectionist', description: 'Complete a puzzle without using Check', icon: '✨' },
  { id: 'marathon', name: 'Marathon Runner', description: 'Play 50 games', icon: '🏃' },
  { id: 'century', name: 'Century', description: 'Play 100 games', icon: '💯' },
  { id: 'first_quickuro_win', name: 'Need for Speed', description: 'Win your first game of Quickuro', icon: '🏁' },
  { id: 'quickuro_streak_5', name: 'Charles Leclerc', description: 'Win 5 quickuro games in a row', icon: '🏎️' },
];

function getProgress(id: string, stats: UserStats): { current: number; target: number } {
  switch (id) {
    case 'first_win': return { current: Math.min(stats.gamesWon, 1), target: 1 };
    case 'speed_demon': return { current: stats.achievements.includes('speed_demon') ? 1 : 0, target: 1 };
    case 'easy_5': return { current: Math.min(stats.easyCompleted, 5), target: 5 };
    case 'medium_5': return { current: Math.min(stats.mediumCompleted, 5), target: 5 };
    case 'hard_5': return { current: Math.min(stats.hardCompleted, 5), target: 5 };
    case 'grid6_master': return { current: Math.min(stats.size6Completed, 10), target: 10 };
    case 'grid8_master': return { current: Math.min(stats.size8Completed, 10), target: 10 };
    case 'grid10_master': return { current: Math.min(stats.size10Completed, 10), target: 10 };
    case 'first_comp_win': return { current: Math.min(stats.competitiveWins, 1), target: 1 };
    case 'comp_streak_5': return { current: Math.min(stats.bestCompStreak, 5), target: 5 };
    case 'perfectionist': return { current: Math.min(stats.perfectGames, 1), target: 1 };
    case 'marathon': return { current: Math.min(stats.gamesPlayed, 50), target: 50 };
    case 'century': return { current: Math.min(stats.gamesPlayed, 100), target: 100 };
    default: return { current: 0, target: 1 };
  }
}

export default function Achievements({ compact = false }: { compact?: boolean }) {
  const { userStats } = useAuth();
  const earned = userStats.achievements || [];
  const earnedCount = earned.length;

  if (compact) {
    // Compact view for sidebar
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-muted-foreground">
            {earnedCount}/{ACHIEVEMENT_DEFS.length} Unlocked
          </span>
        </div>

        {/* Show earned achievements first */}
        <div className="grid grid-cols-4 gap-2">
          {ACHIEVEMENT_DEFS.map((ach) => {
            const isEarned = earned.includes(ach.id);
            return (
              <div
                key={ach.id}
                title={`${ach.name}: ${ach.description}${isEarned ? ' ✓' : ''}`}
                className={`flex items-center justify-center rounded-lg border p-2 text-lg transition-all ${
                  isEarned
                    ? 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-900/20'
                    : 'border-border bg-muted/30 opacity-40 grayscale'
                }`}
              >
                {ach.icon}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Achievements</h3>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          {earnedCount}/{ACHIEVEMENT_DEFS.length}
        </span>
      </div>

      <div className="grid gap-3">
        {ACHIEVEMENT_DEFS.map((ach) => {
          const isEarned = earned.includes(ach.id);
          const progress = getProgress(ach.id, userStats);
          const pct = Math.round((progress.current / progress.target) * 100);

          return (
            <div
              key={ach.id}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
                isEarned
                  ? 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-900/20'
                  : 'border-border bg-card opacity-70'
              }`}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl ${
                isEarned ? 'bg-yellow-100 dark:bg-yellow-900/40' : 'bg-muted grayscale'
              }`}>
                {ach.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${isEarned ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {ach.name}
                  </span>
                  {isEarned && (
                    <span className="text-xs text-yellow-600 dark:text-yellow-400">✓ Earned</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{ach.description}</p>
                {!isEarned && (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary/50 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {progress.current}/{progress.target}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
