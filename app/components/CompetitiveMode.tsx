'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, addDoc, deleteDoc, doc,
  updateDoc, onSnapshot, getDoc, limit, or, orderBy,
} from 'firebase/firestore';
import {
  generateKakuroPuzzle, getTimeLimitForDifficulty,
  type Difficulty, type KakuroGrid,
} from '@/lib/Kakuroutils';
import KakuroGame from './Kakurogame';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface MatchData {
  id: string;
  player1Uid: string;
  player1Username: string;
  player2Uid: string;
  player2Username: string;
  gridSize: number;
  difficulty: Difficulty;
  puzzleData: string;
  player1Finished: boolean;
  player2Finished: boolean;
  player1Time: number | null;
  player2Time: number | null;
  winner: string | null;
  status: MatchStatus;
  timeLimit: number;
  createdAt: number;
}

enum MatchStatus {
  active = 'active',
  completed = 'completed',
}

enum InviteStatus {
  pending = 'pending',
  accepted = 'accepted',
  declined = 'declined'
}

interface MatchInvite {
  id: string;
  fromUid: string;
  fromUsername: string;
  toUid: string;
  toUsername: string;
  status: InviteStatus;
  matchId?: string;
  createdAt: number;
}

interface FriendEntry {
  id: string;
  uid: string;
  username: string;
}

type CompView = 'lobby' | 'searching' | 'match' | 'result';

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function createMatchPuzzle(): { puzzle: KakuroGrid; difficulty: Difficulty; gridSize: number; timeLimit: number } {
  const difficulty = randomChoice<Difficulty>(['easy', 'medium', 'hard']);
  const gridSize = randomChoice([6, 8, 10]) as 6 | 8 | 10;
  const puzzle = generateKakuroPuzzle(gridSize, difficulty);
  const timeLimit = getTimeLimitForDifficulty(difficulty, gridSize);

  return { puzzle, difficulty, gridSize, timeLimit };
}

export default function CompetitiveMode({ onBack }: { onBack: () => void }) {
  const { user, userProfile, updateGameStats } = useAuth();
  const [view, setView] = useState<CompView>('lobby');
  const [currentMatch, setCurrentMatch] = useState<MatchData | null>(null);
  const [matchPuzzle, setMatchPuzzle] = useState<KakuroGrid | null>(null);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [pendingInvites, setPendingInvites] = useState<MatchInvite[]>([]);
  const [searchingText, setSearchingText] = useState('Finding opponent...');

  const [matchResult, setMatchResult] = useState<{
    won: boolean;
    opponentName: string;
    myTime: number | null;
    opponentTime: number | null;
    difficulty: Difficulty;
    gridSize: number;
  } | null>(null);
     
  const queueDocRef = useRef<string | null>(null);
  const matchUnsubRef = useRef<(() => void) | null>(null);
  const gameStartTimeRef = useRef<number>(0);
  const hasUsedCheckRef = useRef(false);

  // Load friends list
  useEffect(() => {
    if (!user) return;
    const requestsRef = collection(db, 'friendRequests');
    const q = query(
      requestsRef,
      or(
        where('fromUid', '==', user.uid),
        where('toUid', '==', user.uid)
      )
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const friendList: FriendEntry[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.status === 'accepted') {
          if (data.fromUid === user.uid) {
            friendList.push({ id: d.id, uid: data.toUid, username: data.toUsername });
          } else {
            friendList.push({ id: d.id, uid: data.fromUid, username: data.fromUsername });
          }
        }
      });
      setFriends(friendList);
    });
    return () => unsub();
  }, [user]);

  // Listen for incoming match invites
  useEffect(() => {
    if (!user) return;
    const invitesRef = collection(db, 'matchInvites');
    const q = query(invitesRef, where('toUid', '==', user.uid), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, (snapshot) => {
      const invites: MatchInvite[] = [];
      snapshot.forEach((d) => {
        invites.push({ id: d.id, ...d.data() } as MatchInvite);
      });
      setPendingInvites(invites);
    });
    return () => unsub();
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (queueDocRef.current) {
        deleteDoc(doc(db, 'matchQueue', queueDocRef.current)).catch(() => {});
      }
      if (matchUnsubRef.current) {
        matchUnsubRef.current();
      }
    };
  }, []);

  const listenToMatch = useCallback((matchId: string) => {
    if (matchUnsubRef.current) matchUnsubRef.current();

    const unsub = onSnapshot(doc(db, 'matches', matchId), (snap) => {
      if (!snap.exists() || !user) return;
      const data = { id: snap.id, ...snap.data() } as MatchData;
      setCurrentMatch(data);

      // Check if match is completed
      if (data.status === 'completed' && data.winner) {
        const isPlayer1 = data.player1Uid === user.uid;
        const won = data.winner === user.uid;
        const opponentName = isPlayer1 ? data.player2Username : data.player1Username;
        setMatchResult({
          won,
          opponentName,
          myTime: isPlayer1 ? data.player1Time : data.player2Time,
          opponentTime: isPlayer1 ? data.player2Time : data.player1Time,
          difficulty: data.difficulty,
          gridSize: data.gridSize,
        });
        setView('result');
        return;
      }

      // Check if opponent finished
      if (data.player1Finished || data.player2Finished) {
        const isPlayer1 = data.player1Uid === user.uid;
        const opponentFinished = isPlayer1 ? data.player2Finished : data.player1Finished;
        if (opponentFinished) {
          toast.info('Your opponent has finished! Hurry up!');
        }
      }
    });

    matchUnsubRef.current = unsub;
  }, [user]);

  const handleFindMatch = async () => {
    if (!user || !userProfile) return;

    setView('searching');
    setSearchingText('Finding opponent...');

    try {
      // Check if anyone is waiting in the queue (within the last 2 minutes)
      const now = Date.now();
      const STALE_TIMEOUT = 2 * 60 * 1000; // 2 minutes
      const queueRef = collection(db, 'matchQueue');
      const q = query(queueRef, where('createdAt', '>=', now - STALE_TIMEOUT), orderBy('createdAt'), limit(10));
      const snapshot = await getDocs(q);

      let opponent = null;
      let opData = null;

      for (const d of snapshot.docs) {
        if (d.data().uid !== user.uid) {
          opponent = d;
          opData = d.data();
          break;
        }
      }

      if (opponent && opData) {
        // Found an opponent - create the match

        setSearchingText(`Matched with ${opData.username}!`);

        const { puzzle, difficulty, gridSize, timeLimit } = createMatchPuzzle();

        const matchDoc = await addDoc(collection(db, 'matches'), {
          player1Uid: opData.uid,
          player1Username: opData.username,
          player2Uid: user.uid,
          player2Username: userProfile.displayUsername || userProfile.username,
          gridSize,
          difficulty,
          puzzleData: JSON.stringify(puzzle),
          player1Finished: false,
          player2Finished: false,
          player1Time: null,
          player2Time: null,
          winner: null,
          status: 'active',
          timeLimit,
          createdAt: Date.now(),
        });

        // Delete opponent from queue
        await deleteDoc(doc(db, 'matchQueue', opponent.id));

        // Load the match
        setMatchPuzzle(puzzle);
        gameStartTimeRef.current = Date.now();
        hasUsedCheckRef.current = false;
        listenToMatch(matchDoc.id);

        toast.success(`Match found! ${difficulty} ${gridSize}×${gridSize}`);

        setTimeout(() => setView('match'), 1500);
      } else {
        // No one waiting - add ourselves to queue
        setSearchingText('Waiting for an opponent...');
        const queueJoinTime = Date.now();
        const queueDoc = await addDoc(collection(db, 'matchQueue'), {
          uid: user.uid,
          username: userProfile.displayUsername || userProfile.username,
          createdAt: queueJoinTime,
        });
        queueDocRef.current = queueDoc.id;

        // Listen for a match being created with us
        const matchesRef = collection(db, 'matches');
        const matchQuery = query(
          matchesRef,
          where('player1Uid', '==', user.uid),
          where('status', '==', 'active'),
          orderBy('createdAt', 'desc'),
          limit(5)
        );

        const matchUnsub = onSnapshot(matchQuery, (snap) => {
          if (!snap.empty) {
            // Find a newly created match that started AFTER we joined the queue
            // This prevents us from accidentally joining an old match
            const validDoc = snap.docs.find(d => {
              const data = d.data();
              return data.createdAt && data.createdAt >= queueJoinTime;
            });

            if (validDoc) {
              const matchData = { id: validDoc.id, ...validDoc.data() } as MatchData;
              const puzzle = JSON.parse(matchData.puzzleData) as KakuroGrid;
              setMatchPuzzle(puzzle);
              setCurrentMatch(matchData);
              gameStartTimeRef.current = Date.now(); 
              hasUsedCheckRef.current = false;

              // Remove ourselves from queue
              if (queueDocRef.current) {
                deleteDoc(doc(db, 'matchQueue', queueDocRef.current)).catch(() => {});
                queueDocRef.current = null;
              }

              listenToMatch(matchData.id);
              toast.success(`Match found! ${matchData.difficulty} ${matchData.gridSize}×${matchData.gridSize}`);
              matchUnsub();
              setTimeout(() => setView('match'), 1500);
            }
          }
        });

        matchUnsubRef.current = matchUnsub;
      }
    } catch (error) {
      console.error('Error finding match:', error);
      toast.error('Failed to find match. Please try again.');
      setView('lobby');
    }
  };

  const handleCancelSearch = async () => {
    if (queueDocRef.current) {
      await deleteDoc(doc(db, 'matchQueue', queueDocRef.current)).catch(() => {});
      queueDocRef.current = null;
    }
    if (matchUnsubRef.current) {
      matchUnsubRef.current();
      matchUnsubRef.current = null;
    }
    setView('lobby');
  };

  const handleChallengeFriend = async (friendUid: string, friendUsername: string) => {
    if (!user || !userProfile) return;

    try {
      await addDoc(collection(db, 'matchInvites'), {
        fromUid: user.uid,
        fromUsername: userProfile.displayUsername || userProfile.username,
        toUid: friendUid,
        toUsername: friendUsername,
        status: 'pending',
        createdAt: Date.now(),
      });
      toast.success(`Challenge sent to ${friendUsername}!`);
    } catch (error) {
      console.error('Error sending challenge:', error);
      toast.error('Failed to send challenge');
    }
  };

  const handleAcceptInvite = async (invite: MatchInvite) => {
    if (!user || !userProfile) return;

    try {
      const { puzzle, difficulty, gridSize, timeLimit } = createMatchPuzzle();

      const matchDoc = await addDoc(collection(db, 'matches'), {
        player1Uid: invite.fromUid,
        player1Username: invite.fromUsername,
        player2Uid: user.uid,
        player2Username: userProfile.displayUsername || userProfile.username,
        gridSize,
        difficulty,
        puzzleData: JSON.stringify(puzzle),
        player1Finished: false,
        player2Finished: false,
        player1Time: null,
        player2Time: null,
        winner: null,
        status: 'active',
        timeLimit,
        createdAt: Date.now(),
      });

      // Update invite with matchId
      await updateDoc(doc(db, 'matchInvites', invite.id), {
        status: 'accepted',
        matchId: matchDoc.id,
      });

      setMatchPuzzle(puzzle);
      gameStartTimeRef.current = Date.now();
      hasUsedCheckRef.current = false;
      listenToMatch(matchDoc.id);

      toast.success(`Match started! ${difficulty} ${gridSize}×${gridSize}`);
      setTimeout(() => setView('match'), 500);
    } catch (error) {
      console.error('Error accepting invite:', error);
      toast.error('Failed to start match');
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      await deleteDoc(doc(db, 'matchInvites', inviteId));
    } catch (error) {
      console.error('Error declining invite:', error);
    }
  };

  const handleGameComplete = async (timeRemaining: number) => {
    if (!currentMatch || !user) return;

    const isPlayer1 = currentMatch.player1Uid === user.uid;
    const timeTaken = Math.floor((Date.now() - gameStartTimeRef.current) / 1000);

    try {
      const updates: Record<string, unknown> = {};

      if (isPlayer1) {
        updates.player1Finished = true;
        updates.player1Time = timeTaken;
      } else {
        updates.player2Finished = true;
        updates.player2Time = timeTaken;
      }

      // Check if opponent already finished
      const opponentFinished = isPlayer1
        ? currentMatch.player2Finished
        : currentMatch.player1Finished;

      if (!opponentFinished) {
        // We finished first - we win!
        updates.winner = user.uid;
        updates.status = 'completed';
      } else {
        // Opponent already finished - they won
        updates.status = 'completed';
        const opponentUid = isPlayer1 ? currentMatch.player2Uid : currentMatch.player1Uid;
        updates.winner = opponentUid;
      }

      await updateDoc(doc(db, 'matches', currentMatch.id), updates);

      // Update game stats
      const won = updates.winner === user.uid;
      await updateGameStats({
        won,
        time: timeTaken,
        difficulty: currentMatch.difficulty,
        gridSize: currentMatch.gridSize,
        isCompetitive: true,
        isPerfect: !hasUsedCheckRef.current,
      });
    } catch (error) {
      console.error('Error completing match:', error);
      toast.error('Failed to submit result');
    }
  };

  const handleTimeUp = async () => {
    if (!currentMatch || !user) return;

    const isPlayer1 = currentMatch.player1Uid === user.uid;

    try {
      const updates: Record<string, unknown> = {};

      if (isPlayer1) {
        updates.player1Finished = true;
        updates.player1Time = null;
      } else {
        updates.player2Finished = true;
        updates.player2Time = null;
      }

      // Check if opponent already finished
      const opponentFinished = isPlayer1
        ? currentMatch.player2Finished
        : currentMatch.player1Finished;

      if (opponentFinished) {
        const opponentUid = isPlayer1 ? currentMatch.player2Uid : currentMatch.player1Uid;
        updates.winner = opponentUid;
        updates.status = 'completed';
      }

      await updateDoc(doc(db, 'matches', currentMatch.id), updates);

      await updateGameStats({
        won: false,
        time: 0,
        difficulty: currentMatch.difficulty,
        gridSize: currentMatch.gridSize,
        isCompetitive: true,
        isPerfect: false,
      });
    } catch (error) {
      console.error('Error handling time up:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // LOBBY VIEW
  if (view === 'lobby') {
    const opponentName = currentMatch
      ? (currentMatch.player1Uid === user?.uid ? currentMatch.player2Username : currentMatch.player1Username)
      : '';

    return (
      <div className="w-full max-w-4xl space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-lg font-medium text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-foreground">Competitive Mode</h1>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Find a Match</h2>
            <p className="mt-2 text-muted-foreground">
              The system will randomly pick a difficulty and grid size. First to complete wins!
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 max-w-lg mx-auto mr-7">
            <Button
              size="lg"
              onClick={handleFindMatch}
              className="cursor-pointer h-12 text-lg bg-orange-500 hover:bg-orange-600 text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
              Find Match
            </Button>

            {friends.length > 0 && (
              <div className="text-left">
                <p className="text-sm font-medium text-muted-foreground mb-2">Or challenge a friend:</p>
                <ScrollArea className="h-30 w-full rounded-md border">
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-background p-2 mb-2"
                    >
                      <span className="text-sm font-medium">{friend.username}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleChallengeFriend(friend.uid, friend.username)}
                        className="cursor-pointer text-xs"
                      >
                        Challenge
                      </Button>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}
          </div>
        </div>

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <div className="rounded-xl border-2 border-orange-500/50 bg-orange-50 p-6 dark:bg-orange-900/10">
            <h3 className="text-lg font-semibold text-foreground mb-3">
              Incoming Challenges
            </h3>
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-3 mb-2"
              >
                <div>
                  <span className="font-medium text-foreground">{invite.fromUsername}</span>
                  <span className="text-sm text-muted-foreground ml-2">wants to battle!</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAcceptInvite(invite)}
                    className="cursor-pointer bg-green-600 hover:bg-green-700 text-white"
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeclineInvite(invite.id)}
                    className="cursor-pointer"
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-2">How Competitive Works</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Find a random opponent or challenge a friend</li>
            <li>• The system randomly picks difficulty (Easy / Medium / Hard) and grid size (6×6, 8×8, 10×10)</li>
            <li>• Both players solve the same puzzle simultaneously</li>
            <li>• First player to complete the puzzle wins!</li>
            <li>• A timer runs — if it expires, you lose</li>
          </ul>
        </div>
      </div>
    );
  }

  // SEARCHING VIEW
  if (view === 'searching') {
    return (
      <div className="w-full max-w-4xl">
        <div className="rounded-xl border border-border bg-card p-12 text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-muted border-t-orange-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{searchingText}</h2>
            <p className="mt-2 text-muted-foreground">
              Please wait while we find you an opponent...
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleCancelSearch}
            className="cursor-pointer"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // MATCH VIEW
  if (view === 'match' && matchPuzzle && currentMatch) {
    const isPlayer1 = currentMatch.player1Uid === user?.uid;
    const opponentName = isPlayer1 ? currentMatch.player2Username : currentMatch.player1Username;

    return (
      <div className="w-full max-w-4xl space-y-4">
        {/* Match Info Bar */}
        <div className="flex items-center justify-between rounded-lg border-2 border-orange-500/50 bg-orange-50 px-4 py-2 dark:bg-orange-900/10">
          <div className="flex items-center gap-2">
            <span className="rounded bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">VS</span>
            <span className="font-semibold text-foreground">{opponentName}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium capitalize">{currentMatch.difficulty}</span>
            <span>{currentMatch.gridSize}×{currentMatch.gridSize}</span>
          </div>
        </div>

        <KakuroGame
          onBack={() => {
            if (matchUnsubRef.current) matchUnsubRef.current();
            onBack();
          }}
          mode="competitive"
          initialPuzzle={matchPuzzle}
          matchTimeLimit={currentMatch.timeLimit}
          onCompetitiveComplete={handleGameComplete}
          onCompetitiveTimeUp={handleTimeUp}
          onCheckUsed={() => { hasUsedCheckRef.current = true; }}
          hideControls
        />
      </div>
    );
  }

  // RESULT VIEW
  if (view === 'result' && matchResult) {
    return (
      <div className="w-full max-w-4xl">
        <div className={`rounded-xl border-2 p-12 text-center space-y-6 ${
          matchResult.won
            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
            : 'border-red-500 bg-red-50 dark:bg-red-900/20'
        }`}>
          <div className="text-6xl">
            {matchResult.won ? '🏆' : '😢'}
          </div>
          <h2 className={`text-3xl font-bold ${
            matchResult.won
              ? 'text-green-900 dark:text-green-100'
              : 'text-red-900 dark:text-red-100'
          }`}>
            {matchResult.won ? 'You Win!' : 'You Lost'}
          </h2>
          <p className="text-muted-foreground">
            vs <span className="font-semibold">{matchResult.opponentName}</span>
            {' • '}
            <span className="capitalize">{matchResult.difficulty}</span>
            {' • '}
            {matchResult.gridSize}×{matchResult.gridSize}
          </p>
          {matchResult.myTime && (
            <p className="text-lg font-medium text-foreground">
              Your time: {formatTime(matchResult.myTime)}
            </p>
          )}
          <div className="flex justify-center gap-4">
            <Button
              onClick={() => {
                setCurrentMatch(null);
                setMatchPuzzle(null);
                setMatchResult(null);
                setView('lobby');
              }}
              className="cursor-pointer bg-orange-500 hover:bg-orange-600 text-white"
            >
              Play Again
            </Button>
            <Button variant="outline" onClick={onBack} className="cursor-pointer">
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
