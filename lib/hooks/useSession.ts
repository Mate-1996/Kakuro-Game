/**
 * lib/hooks/useSession.ts
 *
 * React hook for session management.
 * Handles:
 *   - Session initialization on component mount
 *   - Periodic verification
 *   - Inactivity warnings
 *   - Session expiration handling
 *
 * Usage:
 *   const { isSessionValid, logout } = useSession(userId);
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  initializeSession,
  verifySession,
  logout as logoutSession,
  onSessionExpired,
  onInactivityWarning,
} from '@/lib/sessionManager';
import { toast } from 'sonner';

interface UseSessionOptions {
  onExpired?: () => void;
  onWarning?: () => void;
}

export function useSession(userId: string | null, options: UseSessionOptions = {}) {
  const [isSessionValid, setIsSessionValid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);

  // Initialize session on first mount
  useEffect(() => {
    if (!userId || hasInitialized.current) return;
    hasInitialized.current = true;

    const initSession = async () => {
      setIsLoading(true);
      const success = await initializeSession(userId);
      setIsSessionValid(success);
      setIsLoading(false);
    };

    initSession();
  }, [userId]);

  // Set up event listeners for session events
  useEffect(() => {
    const unsubscribeExpired = onSessionExpired(() => {
      setIsSessionValid(false);
      toast.error('Your session has expired. Please log in again.');
      options.onExpired?.();
    });

    const unsubscribeWarning = onInactivityWarning(() => {
      toast.warning('You will be logged out in 4 minutes due to inactivity.', {
        duration: 10000,
      });
      options.onWarning?.();
    });

    return () => {
      unsubscribeExpired();
      unsubscribeWarning();
    };
  }, [options]);

  const logout = useCallback(async () => {
    if (!userId) return;
    await logoutSession(userId);
    setIsSessionValid(false);
  }, [userId]);

  const verifyCurrentSession = useCallback(async () => {
    if (!userId) return false;
    const valid = await verifySession(userId);
    setIsSessionValid(valid);
    return valid;
  }, [userId]);

  return {
    isSessionValid,
    isLoading,
    logout,
    verifySession: verifyCurrentSession,
  };
}
