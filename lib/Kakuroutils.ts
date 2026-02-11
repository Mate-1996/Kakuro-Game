export type CellType = 'empty' | 'clue' | 'playable';

export interface Cell {
  type: CellType;
  row: number;
  col: number;
  value?: number;
  solution?: number; 
  clueDown?: number; 
  clueAcross?: number;
  isFixed?: boolean;
}

export interface KakuroGrid {
  grid: Cell[][];
  size: number;
}

// create a valid Kakuro puzzle
export function generateKakuroPuzzle(size: number = 8): KakuroGrid {
  // makes sure that the size is valid
  if (![6, 8, 10].includes(size)) {
    size = 6;
  }
  
  const grid: Cell[][] = [];
  
  // creates the grid along with empty cells
  for (let row = 0; row < size; row++) {
    grid[row] = [];
    for (let col = 0; col < size; col++) {
      grid[row][col] = {
        type: 'empty',
        row,
        col,
      };
    }
  }

  // creatse a pattern of clue cells and playable cells
  const clueFrequency = size <= 8 ? 3 : 4; // based on the grid size, adjusts the frequency of the clues/blackcells
  
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      // the border has more clues in the cells
      if (row === 0 || col === 0) {
        grid[row][col].type = 'clue';
      } else if ((row + col) % clueFrequency === 0 && Math.random() > 0.45) {
        // randomly fills the grid with clues/blackcells
        grid[row][col].type = 'clue';
      } else {
        grid[row][col].type = 'playable';
      }
    }
  }

  // filling the grid with a valid solution using backtracking
  const solution = solvePuzzle(grid);
  if (!solution) {
    // if the solving failes, create a simpler pattern
    return generateSimplePuzzle(size);
  }

  // calculates the clues/blackcells value based on the solution
  calculateClues(grid);

  // clears all user values
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = grid[row][col];
      if (cell.type === 'playable') {
        cell.value = undefined;
        cell.isFixed = false;
      }
    }
  }

  return { grid, size };
}


// simple puzzle generation
function generateSimplePuzzle(size: number): KakuroGrid {
  const grid: Cell[][] = [];
  
  // creating a simple pattern
  for (let row = 0; row < size; row++) {
    grid[row] = [];
    for (let col = 0; col < size; col++) {
      if (row === 0 && col === 0) {
        grid[row][col] = { type: 'empty', row, col };
      } else if (row === 0 || col === 0) {
        grid[row][col] = { type: 'clue', row, col };
      } else {
        grid[row][col] = { type: 'playable', row, col };
      }
    }
  }

  // fill it with valid numbers
  for (let row = 1; row < size; row++) {
    for (let col = 1; col < size; col++) {
      grid[row][col].solution = ((row + col - 1) % 9) + 1;
    }
  }

  calculateClues(grid);

//clear
  for (let row = 1; row < size; row++) {
    for (let col = 1; col < size; col++) {
      const cell = grid[row][col];
      cell.value = undefined;
      cell.isFixed = false;
    }
  }

  return { grid, size };
}

// solve the puzzle using backtracking
function solvePuzzle(grid: Cell[][]): boolean {
  const playableCells = grid.flat().filter(cell => cell.type === 'playable');
  return backtrack(grid, playableCells, 0);
}

function backtrack(grid: Cell[][], cells: Cell[], index: number): boolean {
  if (index === cells.length) {
    return true;
  }

  const cell = cells[index];
  const usedInRow = getUsedNumbersInRow(grid, cell.row, cell.col);
  const usedInCol = getUsedNumbersInColumn(grid, cell.row, cell.col);
  const used = new Set([...usedInRow, ...usedInCol]);

  for (let num = 1; num <= 9; num++) {
    if (!used.has(num)) {
      cell.solution = num;
      if (backtrack(grid, cells, index + 1)) {
        return true;
      }
      cell.solution = undefined;
    }
  }

  return false;
}

function getUsedNumbersInRow(grid: Cell[][], row: number, beforeCol: number): Set<number> {
  const used = new Set<number>();
  for (let col = beforeCol - 1; col >= 0; col--) {
    const cell = grid[row][col];
    if (cell.type === 'clue' || cell.type === 'empty') break;
    if (cell.solution !== undefined) {
      used.add(cell.solution);
    }
  }
  return used;
}

function getUsedNumbersInColumn(grid: Cell[][], beforeRow: number, col: number): Set<number> {
  const used = new Set<number>();
  for (let row = beforeRow - 1; row >= 0; row--) {
    const cell = grid[row][col];
    if (cell.type === 'clue' || cell.type === 'empty') break;
    if (cell.solution !== undefined) {
      used.add(cell.solution);
    }
  }
  return used;
}

// calculate clues for all clue cells/blackcells
function calculateClues(grid: Cell[][]) {
  const size = grid.length;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = grid[row][col];
      if (cell.type === 'clue') {
        // calculate the accross clue/blackcell
        let acrossSum = 0;
        let acrossCount = 0;
        for (let c = col + 1; c < size && grid[row][c].type === 'playable'; c++) {
          acrossSum += grid[row][c].solution || 0;
          acrossCount++;
        }
        if (acrossCount > 0) {
          cell.clueAcross = acrossSum;
        }

        // calculate down clue/blackcell
        let downSum = 0;
        let downCount = 0;
        for (let r = row + 1; r < size && grid[r][col].type === 'playable'; r++) {
          downSum += grid[r][col].solution || 0;
          downCount++;
        }
        if (downCount > 0) {
          cell.clueDown = downSum;
        }
      }
    }
  }
}

// check if the current state is valid
export function isValidMove(grid: Cell[][], row: number, col: number, value: number): boolean {
  // checking row for duplicates
  for (let c = col - 1; c >= 0; c--) {
    const cell = grid[row][c];
    if (cell.type === 'clue' || cell.type === 'empty') break;
    if (cell.value === value) return false;
  }
  for (let c = col + 1; c < grid.length; c++) {
    const cell = grid[row][c];
    if (cell.type === 'clue' || cell.type === 'empty') break;
    if (cell.value === value) return false;
  }

  // check the column for duplicates
  for (let r = row - 1; r >= 0; r--) {
    const cell = grid[r][col];
    if (cell.type === 'clue' || cell.type === 'empty') break;
    if (cell.value === value) return false;
  }
  for (let r = row + 1; r < grid.length; r++) {
    const cell = grid[r][col];
    if (cell.type === 'clue' || cell.type === 'empty') break;
    if (cell.value === value) return false;
  }

  return true;
}

export function isPuzzleComplete(grid: Cell[][]): boolean {
  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === 'playable' && cell.value !== cell.solution) {
        return false;
      }
    }
  }
  return true;
}

// get cells in the same row group
export function getRowGroup(grid: Cell[][], row: number, col: number): Cell[] {
  const cells: Cell[] = [];
  
  // Go left to find the start
  let startCol = col;
  for (let c = col - 1; c >= 0; c--) {
    if (grid[row][c].type !== 'playable') break;
    startCol = c;
  }
  
  // collect all cells in the group
  for (let c = startCol; c < grid.length && grid[row][c].type === 'playable'; c++) {
    cells.push(grid[row][c]);
  }
  
  return cells;
}

// get cells in the same column group
export function getColGroup(grid: Cell[][], row: number, col: number): Cell[] {
  const cells: Cell[] = [];
  
  // go up to find the start
  let startRow = row;
  for (let r = row - 1; r >= 0; r--) {
    if (grid[r][col].type !== 'playable') break;
    startRow = r;
  }
  
  // vollect all cells in the group
  for (let r = startRow; r < grid.length && grid[r][col].type === 'playable'; r++) {
    cells.push(grid[r][col]);
  }
  
  return cells;
}