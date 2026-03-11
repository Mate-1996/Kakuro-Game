'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  or,
} from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface FriendRequest {
  id: string;
  fromUid: string;
  fromUsername: string;
  toUid: string;
  toUsername: string;
  status: 'pending' | 'accepted';
  createdAt: number;
}

export default function FriendsList({ compact = false }: { compact?: boolean }) {
  const { user, userProfile } = useAuth();
  const [friends, setFriends] = useState<FriendRequest[]>([]);
  const [pendingSent, setPendingSent] = useState<FriendRequest[]>([]);
  const [pendingReceived, setPendingReceived] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [addFriendUsername, setAddFriendUsername] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Listen for friend requests in real-time
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

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allRequests: FriendRequest[] = [];
      snapshot.forEach((doc) => {
        allRequests.push({ id: doc.id, ...doc.data() } as FriendRequest);
      });

      setFriends(allRequests.filter((r) => r.status === 'accepted'));
      setPendingSent(
        allRequests.filter((r) => r.status === 'pending' && r.fromUid === user.uid)
      );
      setPendingReceived(
        allRequests.filter((r) => r.status === 'pending' && r.toUid === user.uid)
      );
    }, (error) => {
      console.error('Error listening to friend requests:', error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSendFriendRequest = async () => {
    if (!user) {
      toast.error('You must be logged in to add friends.');
      return;
    }

    if (!userProfile) {
      toast.error('Your profile has not loaded yet. Please wait a moment or try re-logging in.');
      return;
    }

    if (!addFriendUsername.trim()) {
      toast.error('Please enter a username.');
      return;
    }

    const username = addFriendUsername.trim().toLowerCase();

    if (username === userProfile.username) {
      toast.error("You can't add yourself as a friend!");
      return;
    }

    setLoading(true);
    try {
      // Find the user by username
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username));
      const snap = await getDocs(q);

      if (snap.empty) {
        toast.error("User doesn't exist in the system, try again!");
        setLoading(false);
        return;
      }

      const targetUser = snap.docs[0];
      const targetUid = targetUser.id;
      const targetData = targetUser.data();

      // Check if a request already exists
      const requestsRef = collection(db, 'friendRequests');
      const existingQuery1 = query(
        requestsRef,
        where('fromUid', '==', user.uid),
        where('toUid', '==', targetUid)
      );
      const existingQuery2 = query(
        requestsRef,
        where('fromUid', '==', targetUid),
        where('toUid', '==', user.uid)
      );

      const [snap1, snap2] = await Promise.all([
        getDocs(existingQuery1),
        getDocs(existingQuery2),
      ]);

      if (!snap1.empty || !snap2.empty) {
        toast.error('A friend request already exists with this user!');
        setLoading(false);
        return;
      }

      // Send friend request
      await addDoc(collection(db, 'friendRequests'), {
        fromUid: user.uid,
        fromUsername: userProfile.username,
        toUid: targetUid,
        toUsername: targetData.username,
        status: 'pending',
        createdAt: Date.now(),
      });

      toast.success(`Friend request sent to ${targetData.displayUsername || targetData.username}!`);
      setAddFriendUsername('');
      setAddDialogOpen(false);
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast.error('Failed to send friend request. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'friendRequests', requestId), {
        status: 'accepted',
      });
      toast.success('Friend request accepted!');
    } catch (error) {
      console.error('Error accepting request:', error);
      toast.error('Failed to accept request');
    }
  };

  const handleRemoveRequest = async (requestId: string) => {
    try {
      await deleteDoc(doc(db, 'friendRequests', requestId));
      toast.success('Removed!');
    } catch (error) {
      console.error('Error removing request:', error);
      toast.error('Failed to remove');
    }
  };

  const getFriendUsername = (request: FriendRequest): string => {
    if (!user) return '';
    return request.fromUid === user.uid ? request.toUsername : request.fromUsername;
  };

  const filteredFriends = friends.filter((f) =>
    getFriendUsername(f).toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Compact sidebar view
  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {friends.length} friend{friends.length !== 1 ? 's' : ''}
          </span>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger
              render={<button className="text-xs font-medium text-primary hover:underline cursor-pointer" />}
            >
              + Add
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Friend</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Enter username to send a friend request
                  </label>
                  <Input
                    placeholder="Username"
                    value={addFriendUsername}
                    onChange={(e) => setAddFriendUsername(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendFriendRequest();
                    }}
                  />
                </div>
                <Button
                  onClick={handleSendFriendRequest}
                  disabled={loading || !addFriendUsername.trim()}
                  className="w-full cursor-pointer"
                >
                  {loading ? 'Sending...' : 'Send Friend Request'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Incoming requests */}
        {pendingReceived.map((req) => (
          <div key={req.id} className="flex items-center justify-between rounded-lg border border-yellow-500/30 bg-yellow-50 p-2 dark:bg-yellow-900/10">
            <span className="text-xs font-medium truncate">{req.fromUsername}</span>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => handleAcceptRequest(req.id)} className="rounded bg-green-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-green-700">
                Accept
              </button>
              <button onClick={() => handleRemoveRequest(req.id)} className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-red-700">
                ✕
              </button>
            </div>
          </div>
        ))}

        {/* Friend list */}
        <ScrollArea className="max-h-[200px]">
          {filteredFriends.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              {friends.length === 0 ? 'No friends yet' : 'No matches'}
            </p>
          ) : (
            filteredFriends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-2 mb-1.5"
              >
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                    {getFriendUsername(friend)[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs font-medium">{getFriendUsername(friend)}</span>
                </div>
                <button
                  onClick={() => handleRemoveRequest(friend.id)}
                  className="text-[10px] text-muted-foreground hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </ScrollArea>

        {/* Pending sent */}
        {pendingSent.length > 0 && (
          <div className="pt-1 border-t border-border">
            <span className="text-[10px] text-muted-foreground">Pending ({pendingSent.length})</span>
            {pendingSent.map((req) => (
              <div key={req.id} className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">{req.toUsername}</span>
                <button onClick={() => handleRemoveRequest(req.id)} className="text-[10px] text-muted-foreground hover:text-red-500">Cancel</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full view (for mobile fallback)
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-foreground">Friends</h2>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger
            render={<Button size="sm" className="cursor-pointer" />}
          >
            + Add Friend
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Friend</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Enter username to send a friend request
                </label>
                <Input
                  placeholder="Username"
                  value={addFriendUsername}
                  onChange={(e) => setAddFriendUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendFriendRequest();
                  }}
                />
              </div>
              <Button
                onClick={handleSendFriendRequest}
                disabled={loading || !addFriendUsername.trim()}
                className="w-full cursor-pointer"
              >
                {loading ? 'Sending...' : 'Send Friend Request'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Input
        placeholder="Search friends..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="mb-4"
      />

      <ScrollArea className="h-[300px] pr-2">
        {pendingReceived.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              Incoming Requests
            </h3>
            {pendingReceived.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-3 mb-2"
              >
                <span className="font-medium text-foreground">{req.fromUsername}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAcceptRequest(req.id)}
                    className="cursor-pointer"
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleRemoveRequest(req.id)}
                    className="cursor-pointer"
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {pendingSent.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              Sent Requests
            </h3>
            {pendingSent.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-3 mb-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{req.toUsername}</span>
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                    Pending
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRemoveRequest(req.id)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            ))}
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">
            My Friends ({filteredFriends.length})
          </h3>
          {filteredFriends.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {friends.length === 0
                ? 'No friends yet. Add some!'
                : 'No friends match your search.'}
            </p>
          ) : (
            filteredFriends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-3 mb-2"
              >
                <span className="font-medium text-foreground">
                  {getFriendUsername(friend)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRemoveRequest(friend.id)}
                  className="cursor-pointer text-red-500 hover:text-red-700"
                >
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
