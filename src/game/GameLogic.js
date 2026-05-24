/**
 * src/game/GameLogic.js
 * Pure game logic: board state, win detection (5-in-a-row), move validation.
 * No Socket.IO / Express dependencies — easy to unit-test.
 */

const BOARD_SIZE = 15;
const WIN_LENGTH = 5;
const EMPTY = '';
const PLAYER_X = 'X';
const PLAYER_O = 'O';

/**
 * Create an empty BOARD_SIZE × BOARD_SIZE board.
 * @returns {string[][]}
 */
function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
}

/**
 * Check if a move is valid on the given board.
 * @param {string[][]} board
 * @param {number} row
 * @param {number} col
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateMove(board, row, col) {
  if (
    typeof row !== 'number' ||
    typeof col !== 'number' ||
    !Number.isInteger(row) ||
    !Number.isInteger(col)
  ) {
    return { valid: false, reason: 'Invalid coordinates' };
  }
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return { valid: false, reason: 'Move out of bounds' };
  }
  if (board[row][col] !== EMPTY) {
    return { valid: false, reason: 'Cell already occupied' };
  }
  return { valid: true };
}

/**
 * Apply a move to the board (mutates a copy).
 * @param {string[][]} board
 * @param {number} row
 * @param {number} col
 * @param {string} mark - 'X' or 'O'
 * @returns {string[][]} new board
 */
function applyMove(board, row, col, mark) {
  const next = board.map(r => [...r]);
  next[row][col] = mark;
  return next;
}

/**
 * Check for a winner after placing at (lastRow, lastCol).
 * Returns { winner: 'X'|'O'|null, line: [{row,col}]|null }
 */
function checkWinner(board, lastRow, lastCol) {
  const mark = board[lastRow][lastCol];
  if (!mark) return { winner: null, line: null };

  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal ↘
    [1, -1],  // diagonal ↙
  ];

  for (const [dr, dc] of directions) {
    const line = [{ row: lastRow, col: lastCol }];

    // Forward
    for (let step = 1; step < WIN_LENGTH; step++) {
      const r = lastRow + dr * step;
      const c = lastCol + dc * step;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      if (board[r][c] !== mark) break;
      line.push({ row: r, col: c });
    }
    // Backward
    for (let step = 1; step < WIN_LENGTH; step++) {
      const r = lastRow - dr * step;
      const c = lastCol - dc * step;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      if (board[r][c] !== mark) break;
      line.unshift({ row: r, col: c });
    }

    if (line.length >= WIN_LENGTH) {
      // Trim to exactly the winning 5
      return { winner: mark, line: line.slice(0, WIN_LENGTH) };
    }
  }
  return { winner: null, line: null };
}

/**
 * Check if the board is full (tie).
 * @param {string[][]} board
 * @returns {boolean}
 */
function isBoardFull(board) {
  return board.every(row => row.every(cell => cell !== EMPTY));
}

module.exports = {
  BOARD_SIZE,
  WIN_LENGTH,
  EMPTY,
  PLAYER_X,
  PLAYER_O,
  createBoard,
  validateMove,
  applyMove,
  checkWinner,
  isBoardFull,
};
