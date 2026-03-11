/**
 * POST /api/solution
 *
 * Body: { puzzle: KakuroGrid }
 *
 * Returns the full solved grid.  Solution values are read from the
 * `solution` field that is embedded in every playable cell at generation
 * time.  If for some reason those are absent, the puzzle is solved on
 * the fly via backtracking.
 *
 * Response:
 *   200  { solution: Cell[][] }  — grid with `solution` field populated
 *   422  { error: string }       — no solution exists (malformed puzzle)
 */

import { NextRequest, NextResponse } from 'next/server';
import { solveFromCurrentState } from '@/backend/solver';
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
    const solution = solveFromCurrentState(body.puzzle.grid);
    if (!solution) {
      return NextResponse.json(
        { error: 'No valid solution found for the provided puzzle.' },
        { status: 422 }
      );
    }
    return NextResponse.json({ solution });
  } catch (err) {
    console.error('[POST /api/solution] error:', err);
    return NextResponse.json({ error: 'Failed to compute solution.' }, { status: 500 });
  }
}
