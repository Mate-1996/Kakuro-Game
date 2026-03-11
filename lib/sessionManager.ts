/**
 * lib/sessionManager.ts
 *
 * Client-side session management utilities:
 *   - Initialize session on login
 *   - Verify session validity
 *   - Handle inactivity logout
 *   - Refresh session activity timestamp
 *   - Clean up on logout
 */

const SESSION_VERIFY_INTERVAL = 60 * 1000; // Check every 1 minute
const INACTIVITY_WARN_THRESHOLD = 20 * 60 * 1000; // Warn 4 minutes before timeout

interface SessionState {
  userId: string;
  sessionId: string;
  expiresAt: number;
  lastActivity: number;
}

let sessionCheckInterval: NodeJS.Timeout | null = null;
let inactivityTimer: NodeJS.Timeout | null = null;

// ============================================================================
// Session lifecycle
// ============================================================================

/**
 * Initialize a new session after login.
 * Called after Firebase auth succeeds.
 */
export async function initializeSession(userId: string, userAgent?: string): Promise<boolean> {
  try {
    const response = await fetch('/api/session/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        userAgent: userAgent || navigator.userAgent,
      }),
    });

    if (!response.ok) {
      console.error('[sessionManager] Failed to initialize session:', response.statusText);
      return false;
    }

    // Start background session checks
    startSessionVerification(userId);
    setupInactivityLogout(userId);

    return true;
  } catch (err) {
    console.error('[sessionManager] Error initializing session:', err);
    return false;
  }
}

/**
 * Verify that the current session is still valid.
 * Should be called periodically or before critical operations.
 */
export async function verifySession(userId: string): Promise<boolean> {
  try {
    const response = await fetch('/api/session/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      console.warn('[sessionManager] Session verification failed:', response.statusText);
      return false;
    }

    const { valid } = await response.json();
    return valid;
  } catch (err) {
    console.error('[sessionManager] Error verifying session:', err);
    return false;
  }
}

/**
 * Refresh the session's lastActivity timestamp.
 * Call this on user interactions (clicks, typing, etc.).
 */
export async function refreshSessionActivity(userId: string): Promise<void> {
  try {
    await fetch('/api/session/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
  } catch (err) {
    console.error('[sessionManager] Error refreshing session:', err);
  }
}

/**
 * Logout: invalidate the session and clear the cookie.
 */
export async function logout(userId: string): Promise<void> {
  // Stop background checks
  stopSessionVerification();
  clearInactivityTimer();

  try {
    await fetch('/api/session/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
  } catch (err) {
    console.error('[sessionManager] Error logging out:', err);
  }
}

// ============================================================================
// Background session verification
// ============================================================================

function startSessionVerification(userId: string): void {
  if (sessionCheckInterval) clearInterval(sessionCheckInterval);

  sessionCheckInterval = setInterval(async () => {
    const isValid = await verifySession(userId);
    if (!isValid) {
      // Session expired — trigger logout
      console.warn('[sessionManager] Session expired, logging out');
      stopSessionVerification();
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
  }, SESSION_VERIFY_INTERVAL);
}

function stopSessionVerification(): void {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
  }
}

// ============================================================================
// Inactivity logout
// ============================================================================

function setupInactivityLogout(userId: string): void {
  clearInactivityTimer();

  // Warn user before timeout
  inactivityTimer = setTimeout(() => {
    console.warn('[sessionManager] Session inactivity warning');
    window.dispatchEvent(new CustomEvent('inactivity-warning'));
  }, INACTIVITY_WARN_THRESHOLD);

  // Set up activity listeners to reset the timer
  const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  const resetTimer = () => {
    refreshSessionActivity(userId);
    clearInactivityTimer();
    setupInactivityLogout(userId);
  };

  activityEvents.forEach((event) => {
    document.addEventListener(event, resetTimer, { once: true });
  });
}

function clearInactivityTimer(): void {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
}

// ============================================================================
// Event listeners
// ============================================================================

/**
 * Listen for session expiration events.
 * Example usage:
 *   window.addEventListener('session-expired', handleSessionExpired);
 *   window.addEventListener('inactivity-warning', handleInactivityWarning);
 */
export function onSessionExpired(callback: () => void): () => void {
  window.addEventListener('session-expired', callback);
  return () => window.removeEventListener('session-expired', callback);
}

export function onInactivityWarning(callback: () => void): () => void {
  window.addEventListener('inactivity-warning', callback);
  return () => window.removeEventListener('inactivity-warning', callback);
}
