import { Chess, Square } from 'chess.js';

// Global Engine State
let game = new Chess();
let skillLevel = 1; // 1: Easy, 2: Medium, 3: Hard

// Piece Evaluation Values
const PIECE_VALUES: Record<string, number> = {
  p: 10,
  n: 30,
  b: 30,
  r: 50,
  q: 90,
  k: 900,
};

// Piece Square Tables for Positional Evaluation
const PAWN_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

// Evaluate Board Position
function evaluateBoard(board: Chess): number {
  let totalEvaluation = 0;
  const currentBoard = board.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = currentBoard[r][c];
      if (piece) {
        const val = PIECE_VALUES[piece.type] || 0;
        let positionalVal = 0;

        if (piece.type === 'p') {
          positionalVal = piece.color === 'w' ? PAWN_TABLE[r * 8 + c] : PAWN_TABLE[(7 - r) * 8 + c];
        } else if (piece.type === 'n') {
          positionalVal = KNIGHT_TABLE[r * 8 + c];
        }

        const score = val + positionalVal;
        totalEvaluation += piece.color === 'w' ? score : -score;
      }
    }
  }

  return board.turn() === 'w' ? totalEvaluation : -totalEvaluation;
}

// Minimax Algorithm with Alpha-Beta Pruning
function minimax(
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): number {
  if (depth === 0 || game.isGameOver()) {
    return evaluateBoard(game);
  }

  const moves = game.moves({ verbose: true });

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      const evaluation = minimax(depth - 1, alpha, beta, false);
      game.undo();
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move);
      const evaluation = minimax(depth - 1, alpha, beta, true);
      game.undo();
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

// Find Best Move
function findBestMove(maxDepth: number): string {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return '';

  // Easy mode: 50% chance random move
  if (skillLevel === 1 && Math.random() < 0.5) {
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    return `${randomMove.from}${randomMove.to}${randomMove.promotion || ''}`;
  }

  let bestMove = moves[0];
  let bestValue = -Infinity;

  for (const move of moves) {
    game.move(move);
    const value = minimax(maxDepth - 1, -Infinity, Infinity, false);
    game.undo();

    if (value > bestValue) {
      bestValue = value;
      bestMove = move;
    }
  }

  return `${bestMove.from}${bestMove.to}${bestMove.promotion || ''}`;
}

// UCI Message Protocol Handler
self.onmessage = (e: MessageEvent) => {
  const message = e.data;

  if (message === 'uci') {
    self.postMessage('id name Stockfish WASM Worker');
    self.postMessage('uciok');
  } else if (message === 'isready') {
    self.postMessage('readyok');
  } else if (message.startsWith('setoption name Skill Level value')) {
    const level = parseInt(message.split(' ').pop() || '1');
    skillLevel = level;
  } else if (message.startsWith('position fen')) {
    const fen = message.replace('position fen ', '');
    game = new Chess(fen);
  } else if (message.startsWith('go')) {
    const depthMap: Record<number, number> = { 1: 2, 2: 3, 3: 4 };
    const depth = depthMap[skillLevel] || 3;
    const bestMove = findBestMove(depth);
    self.postMessage(`bestmove ${bestMove}`);
  }
};
