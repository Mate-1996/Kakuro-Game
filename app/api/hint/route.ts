/**
 * POST /api/hint
 *
 * Body: { puzzle: KakuroGrid }
 *
 * Returns the next logical hint, preferring cheap deductions over
 * brute-force reveals:
 *   1. Naked single  (only one digit can go here)
 *   2. Sum-forced    (last empty cell in a run)
 *   3. Hidden single (only one cell in a run can hold a digit)
 *   4. General       (fallback: reveal first unfilled cell's solution)
 *
 * Response:
 *   200  HintResult  — { row, col, value, hintType, message }
 *   200  { message } — puzzle is already complete, no hint needed
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHint } from '@/backend/hintSystem';
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
    const hint = getHint(body.puzzle);
    if (!hint) {
      return NextResponse.json(
        { message: 'No hints available — the puzzle may already be complete!' },
        { status: 200 }
      );
    }
    return NextResponse.json(hint);
  } catch (err) {
    console.error('[POST /api/hint] error:', err);
    return NextResponse.json({ error: 'Failed to compute hint.' }, { status: 500 });
  }
}
