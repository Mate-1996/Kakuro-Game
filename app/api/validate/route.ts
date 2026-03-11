/**
 * POST /api/validate
 *
 * Body: { puzzle: KakuroGrid }
 *
 * Runs a full-grid validation and returns:
 *   - isValid      — no rule violations at all
 *   - isComplete   — all cells filled AND isValid
 *   - errors       — array of ValidationError objects
 *   - stats        — { filled, total, correct, incorrect }
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateGrid } from '@/backend/constraintChecker';
import type { KakuroGrid } from '@/backend/types';

export async function POST(request: NextRequest) {
  let body: { puzzle: KakuroGrid };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (!body?.puzzle?.grid || typeof body.puzzle.size !== 'number') {
    return NextResponse.json(
      { error: 'Missing or malformed "puzzle" in request body.' },
      { status: 400 }
    );
  }

  try {
    const result = validateGrid(body.puzzle);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[POST /api/validate] error:', err);
    return NextResponse.json({ error: 'Validation failed.' }, { status: 500 });
  }
}
