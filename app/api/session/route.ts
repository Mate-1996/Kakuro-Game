/**
 * app/api/session/route.ts
 *
 * Session management via HTTP-only cookies and Redis backend.
 *
 * Features:
 *   POST /api/session/login    — Create session + set HTTP-only cookie
 *   GET /api/session/verify    — Check if session is valid
 *   POST /api/session/logout   — Invalidate session
 *   POST /api/session/refresh  — Update lastActivity timestamp
 *
 * Redis schema:
 *   session:{userId}:{sessionId}
 *     - token              (JWT or session ID)
 *     - lastActivity       (timestamp in ms)
 *     - expiresAt          (timestamp in ms)
 *     - userAgent          (for security)
 *
 *   cache:config:difficulty_settings
 *     - JSON with easy/medium/hard settings
 *
 *   cache:config:puzzle_templates
 *     - Array of puzzle generation templates
 *
 *   cache:config:game_config
 *     - Game-wide settings (time limits, scoring rules, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';

// ============================================================================
// Redis-like storage (can be replaced with actual Redis client)
// ============================================================================

// For demo purposes, we'll use an in-memory store + cookie validation.
// In production, use ioredis or redis package:
// import Redis from 'ioredis';
// const redis = new Redis(process.env.REDIS_URL);

const SESSION_TTL_MAX = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const INACTIVITY_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours in ms

interface SessionData {
  userId: string;
  sessionId: string;
  token: string;
  lastActivity: number;
  expiresAt: number;
  userAgent: string;
}

// In-memory session store (replace with Redis in production)
const sessionStore = new Map<string, SessionData>();

// ============================================================================
// Utility functions
// ============================================================================

function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

function generateToken(userId: string, sessionId: string): string {
  // Simple token generation (in production, use JWT)
  const data = `${userId}:${sessionId}:${Date.now()}`;
  return createHash('sha256').update(data).digest('hex');
}

function getSessionKey(userId: string, sessionId: string): string {
  return `session:${userId}:${sessionId}`;
}

async function setSessionInRedis(session: SessionData): Promise<void> {
  // Replace with: await redis.setex(getSessionKey(...), TTL, JSON.stringify(session));
  const key = getSessionKey(session.userId, session.sessionId);
  sessionStore.set(key, session);

  // Set expiry (in production, Redis handles this automatically)
  setTimeout(() => {
    sessionStore.delete(key);
  }, SESSION_TTL_MAX);
}

async function getSessionFromRedis(userId: string, sessionId: string): Promise<SessionData | null> {
  const key = getSessionKey(userId, sessionId);
  const data = sessionStore.get(key);
  // Replace with: return await redis.get(key) ? JSON.parse(...) : null;
  return data || null;
}

async function deleteSessionFromRedis(userId: string, sessionId: string): Promise<void> {
  const key = getSessionKey(userId, sessionId);
  sessionStore.delete(key);
  // Replace with: await redis.del(key);
}

// ============================================================================
// Session routes
// ============================================================================

/**
 * POST /api/session/login
 * Create a new session and set HTTP-only cookie.
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);

  if (url.pathname === '/api/session/login') {
    const { userId, userAgent } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const sessionId = generateSessionId();
    const token = generateToken(userId, sessionId);
    const now = Date.now();

    const session: SessionData = {
      userId,
      sessionId,
      token,
      lastActivity: now,
      expiresAt: now + SESSION_TTL_MAX,
      userAgent: userAgent || 'unknown',
    };

    await setSessionInRedis(session);

    const response = NextResponse.json({ success: true, sessionId });

    // Set HTTP-only secure cookie
    response.cookies.set('kakuro_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_TTL_MAX / 1000, // convert to seconds
      path: '/',
    });

    return response;
  }

  if (url.pathname === '/api/session/verify') {
    const sessionId = request.cookies.get('kakuro_session')?.value;

    if (!sessionId) {
      return NextResponse.json({ valid: false, error: 'No session cookie' }, { status: 401 });
    }

    // In production, get userId from JWT or session claim
    // For now, extract from request header or body
    const { userId } = await request.json().catch(() => ({}));

    if (!userId) {
      return NextResponse.json({ valid: false, error: 'userId required' }, { status: 400 });
    }

    const session = await getSessionFromRedis(userId, sessionId);

    if (!session) {
      return NextResponse.json({ valid: false, error: 'Session not found' }, { status: 401 });
    }

    // Check inactivity timeout
    const now = Date.now();
    const timeSinceActivity = now - session.lastActivity;

    if (timeSinceActivity > INACTIVITY_TIMEOUT) {
      await deleteSessionFromRedis(userId, sessionId);
      return NextResponse.json(
        { valid: false, error: 'Session expired due to inactivity' },
        { status: 401 }
      );
    }

    // Check expiration
    if (now > session.expiresAt) {
      await deleteSessionFromRedis(userId, sessionId);
      return NextResponse.json({ valid: false, error: 'Session expired' }, { status: 401 });
    }

    return NextResponse.json({
      valid: true,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      inactivityTimeout: INACTIVITY_TIMEOUT,
    });
  }

  if (url.pathname === '/api/session/refresh') {
    const sessionId = request.cookies.get('kakuro_session')?.value;
    const { userId } = await request.json();

    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: 'Session cookie and userId required' },
        { status: 400 }
      );
    }

    const session = await getSessionFromRedis(userId, sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 });
    }

    // Update lastActivity
    session.lastActivity = Date.now();
    await setSessionInRedis(session);

    return NextResponse.json({ success: true, lastActivity: session.lastActivity });
  }

  if (url.pathname === '/api/session/logout') {
    const sessionId = request.cookies.get('kakuro_session')?.value;
    const { userId } = await request.json();

    if (sessionId && userId) {
      await deleteSessionFromRedis(userId, sessionId);
    }

    const response = NextResponse.json({ success: true });
    // Clear the cookie
    response.cookies.set('kakuro_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });

    return response;
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
