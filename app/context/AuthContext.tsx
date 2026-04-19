'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface UserProfile {
  username: string;
  displayUsername: string;
  email: string;
  createdAt: number;
}

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  perfectGames: number;
  achievements: string[];
  bestTime: number | null;

  competitiveWins: number;
  competitiveLosses: number;
  competitiveStreak: number;
  bestCompStreak: number;

  quickuroWins: number; 
  quickuroLosses: number;
  quickuroBestTime: number | null;
  quickuroBestStreak: number;
  quickuroCurrentStreak: number;

  easyCompleted: number;
  mediumCompleted: number;
  hardCompleted: number;
  size6Completed: number;
  size8Completed: number;
  size10Completed: number;
}

export const defaultStats: UserStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  perfectGames: 0,
  achievements: [],
  bestTime: null,
  
  competitiveWins: 0,
  competitiveLosses: 0,
  competitiveStreak: 0,
  bestCompStreak: 0,

  quickuroWins: 0,
  quickuroLosses: 0,
  quickuroBestTime: null,
  quickuroBestStreak: 0,
  quickuroCurrentStreak: 0,

  
  easyCompleted: 0,
  mediumCompleted: 0,
  hardCompleted: 0,
  size6Completed: 0,
  size8Completed: 0,
  size10Completed: 0,
  
};

export interface GameResult {
  won: boolean;
  time: number;
  difficulty: 'easy' | 'medium' | 'hard';
  gridSize: number;
  gameMode: 'normal' | 'competitive' | 'quickuro';
  isPerfect: boolean;
}

const ACHIEVEMENTS = [
  { id: 'first_win', check: (s: UserStats) => s.gamesWon >= 1 },
  { id: 'speed_demon', check: (_s: UserStats, r?: GameResult) => r ? r.won && r.time <= 120 : false },
  { id: 'easy_5', check: (s: UserStats) => s.easyCompleted >= 5 },
  { id: 'medium_5', check: (s: UserStats) => s.mediumCompleted >= 5 },
  { id: 'hard_5', check: (s: UserStats) => s.hardCompleted >= 5 },
  { id: 'grid6_master', check: (s: UserStats) => s.size6Completed >= 10 },
  { id: 'grid8_master', check: (s: UserStats) => s.size8Completed >= 10 },
  { id: 'grid10_master', check: (s: UserStats) => s.size10Completed >= 10 },
  { id: 'first_comp_win', check: (s: UserStats) => s.competitiveWins >= 1 },
  { id: 'comp_streak_5', check: (s: UserStats) => s.bestCompStreak >= 5 },
  { id: 'perfectionist', check: (s: UserStats) => s.perfectGames >= 1 },
  { id: 'marathon', check: (s: UserStats) => s.gamesPlayed >= 50 },
  { id: 'century', check: (s: UserStats) => s.gamesPlayed >= 100 },
  { id: 'first_quickuro_win', check: (s: UserStats) => s.quickuroWins >= 1 },
  { id: 'quickuro_streak_5', check: (s: UserStats) => s.quickuroBestStreak >= 5 },
];

function checkAchievements(stats: UserStats, result?: GameResult): string[] {
  const earned = [...stats.achievements];
  for (const ach of ACHIEVEMENTS) {
    if (!earned.includes(ach.id) && ach.check(stats, result)) {
      earned.push(ach.id);
    }
  }
  return earned;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  userStats: UserStats;
  loading: boolean;
  isGuest: boolean;
  setIsGuest: (v: boolean) => void;
  refreshProfile: () => Promise<void>;
  updateGameStats: (result: GameResult) => Promise<string[]>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  userStats: defaultStats,
  loading: true,
  isGuest: false,
  setIsGuest: () => {},
  refreshProfile: async () => {},
  updateGameStats: async () => [],
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userStats, setUserStats] = useState<UserStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const fetchProfile = async (uid: string) => {
    try {
      const snap = await Promise.race([
        getDoc(doc(db, 'users', uid)),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Firestore timeout')), 5000)
        ),
      ]);
      if (snap && snap.exists()) {
        setUserProfile(snap.data() as UserProfile);
      }
    } catch (err) {
      console.warn('Could not fetch profile (offline or Firestore not enabled):', err);
    }
  };

  const fetchStats = async (uid: string) => {
    try {
      const snap = await Promise.race([
        getDoc(doc(db, 'userStats', uid)),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Firestore timeout')), 5000)
        ),
      ]);
      if (snap && snap.exists()) {
        setUserStats({ ...defaultStats, ...(snap.data() as UserStats) });
      } else {
        await setDoc(doc(db, 'userStats', uid), defaultStats);
        setUserStats(defaultStats);
      }
    } catch (err) {
      console.warn('Could not fetch stats:', err);
    }
  };

  const updateGameStats = useCallback(async (result: GameResult): Promise<string[]> => {
  const newStats = { ...userStats };
  newStats.gamesPlayed += 1;

  if (result.won) {
    newStats.gamesWon += 1;

    if (result.difficulty === 'easy') newStats.easyCompleted += 1;
    if (result.difficulty === 'medium') newStats.mediumCompleted += 1;
    if (result.difficulty === 'hard') newStats.hardCompleted += 1;

    if (result.gridSize === 6) newStats.size6Completed += 1;
    if (result.gridSize === 8) newStats.size8Completed += 1;
    if (result.gridSize === 10) newStats.size10Completed += 1;

    if (result.gameMode === 'competitive') {
      newStats.competitiveWins += 1;
      newStats.competitiveStreak += 1;

      if (newStats.competitiveStreak > newStats.bestCompStreak) {
        newStats.bestCompStreak = newStats.competitiveStreak;
      }
    } else if (result.gameMode === 'quickuro') {
      newStats.quickuroWins += 1;
      newStats.quickuroCurrentStreak += 1;

      if (newStats.quickuroCurrentStreak > newStats.quickuroBestStreak) {
        newStats.quickuroBestStreak = newStats.quickuroCurrentStreak;
      }

      if (
        newStats.quickuroBestTime === null ||
        result.time < newStats.quickuroBestTime
      ) {
        newStats.quickuroBestTime = result.time;
      }
    }

    if (newStats.bestTime === null || result.time < newStats.bestTime) {
      newStats.bestTime = result.time;
    }

    if (result.isPerfect) {
      newStats.perfectGames += 1;
    }
  } else {
    if (result.gameMode === 'competitive') {
      newStats.competitiveLosses += 1;
      newStats.competitiveStreak = 0;
    } else if (result.gameMode === 'quickuro') {
      newStats.quickuroLosses += 1;
      newStats.quickuroCurrentStreak = 0;
    }
  }

  const oldAchievements = [...newStats.achievements];
  newStats.achievements = checkAchievements(newStats, result);
  const newlyEarned = newStats.achievements.filter(a => !oldAchievements.includes(a));

  setUserStats(newStats);

  if (user) {
    try {
      await setDoc(doc(db, 'userStats', user.uid), newStats);
    } catch (err) {
      console.warn('Could not save stats:', err);
    }
  }

  return newlyEarned;
}, [user, userStats]);

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await Promise.all([
          fetchProfile(firebaseUser.uid),
          fetchStats(firebaseUser.uid),
        ]);
        setIsGuest(false);
      } else {
        setUserProfile(null);
        setUserStats(defaultStats);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{
      user, userProfile, userStats, loading, isGuest, setIsGuest, refreshProfile, updateGameStats
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);