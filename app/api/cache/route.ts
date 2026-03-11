/**
 * app/api/cache/route.ts
 *
 * Cache management for static data:
 *   - Difficulty settings
 *   - Puzzle templates
 *   - Game configuration
 *
 * Routes:
 *   GET /api/cache/difficulty-settings
 *   GET /api/cache/puzzle-templates
 *   GET /api/cache/game-config
 *   POST /api/cache/invalidate (admin only)
 *
 * Redis keys:
 *   cache:config:difficulty_settings
 *   cache:config:puzzle_templates
 *   cache:config:game_config
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Difficulty } from '@/backend/types';

// ============================================================================
// Types
// ============================================================================

interface DifficultyConfig {
  difficulty: Difficulty;
  clueFrequency: number;
  randomThreshold: number;
  maxGroupSize: number;
  hintCount: number;
  timeLimitSeconds: number;
}

interface GameConfig {
  minGridSize: number;
  maxGridSize: number;
  cellAnimationDuration: number;
  checkCountLimit: number;
  maxHintsPerSession: number;
}

// ============================================================================
// Static cache data (would be in Redis in production)
// ============================================================================

const DIFFICULTY_SETTINGS: DifficultyConfig[] = [
  {
    difficulty: 'easy',
    clueFrequency: 3,
    randomThreshold: 0.35,
    maxGroupSize: 3,
    hintCount: 0,
    timeLimitSeconds: 120,
  },
  {
    difficulty: 'medium',
    clueFrequency: 3,
    randomThreshold: 0.45,
    maxGroupSize: 5,
    hintCount: 0,
    timeLimitSeconds: 300,
  },
  {
    difficulty: 'hard',
    clueFrequency: 4,
    randomThreshold: 0.55,
    maxGroupSize: 7,
    hintCount: 0,
    timeLimitSeconds: 600,
  },
];

const GAME_CONFIG: GameConfig = {
  minGridSize: 6,
  maxGridSize: 10,
  cellAnimationDuration: 150,
  checkCountLimit: 3,
  maxHintsPerSession: 5,
};

const PUZZLE_TEMPLATES = [
  {
    id: 'template_balanced',
    name: 'Balanced Grid',
    description: 'Even mix of across and down clues',
    suitableSizes: [6, 8, 10],
  },
  {
    id: 'template_clue_heavy',
    name: 'Clue Dense',
    description: 'More clue cells, shorter runs',
    suitableSizes: [6, 8],
  },
  {
    id: 'template_open',
    name: 'Open Grid',
    description: 'Fewer clues, longer runs',
    suitableSizes: [8, 10],
  },
];

// In-memory cache layer (replace with Redis in production)
interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const cacheStore = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(namespace: string): string {
  return `cache:config:${namespace}`;
}

function getFromCache(key: string): unknown | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }
  return entry.data;
}

function setInCache(key: string, data: unknown): void {
  cacheStore.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL,
  });
}

// ============================================================================
// Route handlers
// ============================================================================

function getDifficultySettings() {
  const cacheKey = getCacheKey('difficulty_settings');
  let cached = getFromCache(cacheKey);

  if (!cached) {
    cached = DIFFICULTY_SETTINGS;
    setInCache(cacheKey, cached);
  }

  return cached;
}

function getPuzzleTemplates() {
  const cacheKey = getCacheKey('puzzle_templates');
  let cached = getFromCache(cacheKey);

  if (!cached) {
    cached = PUZZLE_TEMPLATES;
    setInCache(cacheKey, cached);
  }

  return cached;
}

function getGameConfig() {
  const cacheKey = getCacheKey('game_config');
  let cached = getFromCache(cacheKey);

  if (!cached) {
    cached = GAME_CONFIG;
    setInCache(cacheKey, cached);
  }

  return cached;
}

// ============================================================================
// Request handler
// ============================================================================

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  if (url.pathname === '/api/cache/difficulty-settings') {
    return NextResponse.json({ data: getDifficultySettings() });
  }

  if (url.pathname === '/api/cache/puzzle-templates') {
    return NextResponse.json({ data: getPuzzleTemplates() });
  }

  if (url.pathname === '/api/cache/game-config') {
    return NextResponse.json({ data: getGameConfig() });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);

  if (url.pathname === '/api/cache/invalidate') {
    // In production, verify admin token here
    try {
      cacheStore.clear();
      return NextResponse.json({ success: true, message: 'All caches invalidated' });
    } catch (err) {
      return NextResponse.json({ error: 'Failed to invalidate cache' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
