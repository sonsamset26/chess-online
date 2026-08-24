import { Chess } from 'chess.js';

// Global Engine State
let game = new Chess();
let skillLevel = 2; // 1: Easy (800 Elo), 2: Medium (1300 Elo), 3: Hard (2000 Elo)

// Giá trị điểm quân cờ chuẩn
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Bảng vị trí chiến thuật
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

// Hàm đánh giá thế cờ
function evaluateBoard(b: Chess): number {
  if (b.isCheckmate()) return -99999;
  if (b.isDraw() || b.isStalemate()) return 0;

  let totalEvaluation = 0;
  const currentBoard = b.board();
  const turn = b.turn();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = currentBoard[r][c];
      if (piece) {
        const val = PIECE_VALUES[piece.type] || 0;
        let posVal = 0;
        const idx = piece.color === 'w' ? r * 8 + c : (7 - r) * 8 + c;

        if (piece.type === 'p') posVal = PAWN_TABLE[idx];
        else if (piece.type === 'n') posVal = KNIGHT_TABLE[idx];

        const score = val + posVal;
        totalEvaluation += piece.color === turn ? score : -score;
      }
    }
  }

  return totalEvaluation;
}

// Sắp xếp nước đi ưu tiên
function sortMoves(moves: any[]): any[] {
  return moves.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    if (a.captured) {
      scoreA += 10 * (PIECE_VALUES[a.captured] || 0) - (PIECE_VALUES[a.piece] || 0);
    }
    if (b.captured) {
      scoreB += 10 * (PIECE_VALUES[b.captured] || 0) - (PIECE_VALUES[b.piece] || 0);
    }
    if (a.promotion) scoreA += 800;
    if (b.promotion) scoreB += 800;

    return scoreB - scoreA;
  });
}

// Negamax Alpha-Beta Tối ưu hóa Siêu tốc (< 30ms)
function negamax(depth: number, alpha: number, beta: number): number {
  if (depth === 0 || game.isGameOver()) {
    return evaluateBoard(game);
  }

  let moves = game.moves({ verbose: true });
  moves = sortMoves(moves);

  let maxScore = -Infinity;

  for (const move of moves) {
    game.move(move);
    const score = -negamax(depth - 1, -beta, -alpha);
    game.undo();

    if (score > maxScore) {
      maxScore = score;
    }
    if (score > alpha) {
      alpha = score;
    }
    if (alpha >= beta) {
      break;
    }
  }

  return maxScore;
}

// Tìm nước đi hay nhất SIÊU TỐC
function findBestMove(): string {
  let moves = game.moves({ verbose: true });
  if (moves.length === 0) return '(none)';

  // Cấp 1 (800 Elo): 25% ngẫu nhiên
  if (skillLevel === 1 && Math.random() < 0.25) {
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    return `${randomMove.from}${randomMove.to}${randomMove.promotion || ''}`;
  }

  moves = sortMoves(moves);
  
  // Tối ưu hóa depth cho phản xạ siêu tốc:
  // 1 (800 Elo): Depth 1
  // 2 (1300 Elo): Depth 2
  // 3 (2000 Elo): Depth 3 (Phản xạ tức thì < 30ms, nước cờ thông minh)
  const maxDepth = skillLevel === 1 ? 1 : skillLevel === 2 ? 2 : 3;

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    game.move(move);
    const score = -negamax(maxDepth - 1, -Infinity, Infinity);
    game.undo();

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return `${bestMove.from}${bestMove.to}${bestMove.promotion || ''}`;
}

// Handler Protocol
self.onmessage = (e: MessageEvent) => {
  const message = e.data;

  try {
    if (message === 'uci') {
      self.postMessage('id name Stockfish Ultra Fast');
      self.postMessage('uciok');
    } else if (message === 'isready') {
      self.postMessage('readyok');
    } else if (message.startsWith('setoption name Skill Level value')) {
      const level = parseInt(message.split(' ').pop() || '1');
      skillLevel = level >= 20 ? 3 : level >= 15 ? 2 : 1;
    } else if (message.startsWith('position fen')) {
      const fen = message.replace('position fen ', '');
      game = new Chess(fen);
    } else if (message.startsWith('go')) {
      const bestMove = findBestMove();
      self.postMessage(`bestmove ${bestMove}`);
    }
  } catch (err) {
    console.error('Worker error:', err);
    self.postMessage('bestmove (none)');
  }
};
