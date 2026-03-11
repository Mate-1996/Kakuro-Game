/**
 * GET /api/puzzle
 *
 * Query parameters:
 *   size        — 6 | 8 | 10          (default: 8)
 *   difficulty  — easy | medium | hard (default: derived from size)
 *
 * Response: KakuroGrid JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateKakuroPuzzle, getDifficultyForSize } from '@/backend/puzzleGenerator';
import type { Difficulty } from '@/backend/types';

const VALID_SIZES = [6, 8, 10] as const;
const VALID_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const sizeParam = searchParams.get('size');
  const diffParam = searchParams.get('difficulty') as Difficulty | null;

  const size = sizeParam ? parseInt(sizeParam, 10) : 8;
  if (!VALID_SIZES.includes(size as (typeof VALID_SIZES)[number])) {
    return NextResponse.json(
      { error: 'Invalid size. Accepted values: 6, 8, 10.' },
      { status: 400 }
    );
  }

  const difficulty: Difficulty =
    diffParam && VALID_DIFFICULTIES.includes(diffParam)
      ? diffParam
      : getDifficultyForSize(size);

  try {
    const puzzle = generateKakuroPuzzle(size, difficulty);
    return NextResponse.json(puzzle);
  } catch (err) {
    console.error('[GET /api/puzzle] generation error:', err);
    return NextResponse.json({ error: 'Failed to generate puzzle.' }, { status: 500 });
  }
}
