/**
 * POST /api/check-cell
 *
 * Body: { grid: Cell[][], row: number, col: number, value: number }
 *
 * Validates a single cell placement and returns:
 *   - valid      — true if the placement is legal
 *   - conflicts  — coordinates of cells that conflict with this value
 *   - message    — human-readable explanation
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkCell } from '@/backend/constraintChecker';
import type { Cell } from '@/backend/types';

export async function POST(request: NextRequest) {
  let body: { grid: Cell[][]; row: number; col: number; value: number };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const { grid, row, col, value } = body ?? {};

  if (!Array.isArray(grid)) {
    return NextResponse.json({ error: '"grid" must be a 2-D array.' }, { status: 400 });
  }
  if (typeof row !== 'number' || typeof col !== 'number' || typeof value !== 'number') {
    return NextResponse.json(
      { error: '"row", "col", and "value" must all be numbers.' },
      { status: 400 }
    );
  }
  if (row < 0 || col < 0 || row >= grid.length || col >= (grid[0]?.length ?? 0)) {
    return NextResponse.json(
      { error: `Cell (${row}, ${col}) is out of grid bounds.` },
      { status: 400 }
    );
  }

  try {
    const result = checkCell(grid, row, col, value);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[POST /api/check-cell] error:', err);
    return NextResponse.json({ error: 'Cell check failed.' }, { status: 500 });
  }
}
