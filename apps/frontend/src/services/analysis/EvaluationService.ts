import { Chess } from 'chess.js';

// Giá trị điểm quân cờ chuẩn theo Centipawn
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Bảng điểm vị trí chiến thuật (PST - Piece-Square Tables)
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

import { StockfishBridge } from './StockfishBridge';

export class EvaluationService {
  /**
   * Đánh giá tĩnh trạng thái bàn cờ hiện tại theo góc nhìn của bên đang tới lượt đi (Side to Move)
   * Kết quả đo bằng Centipawn (1 quân Tốt = 100 cp).
   * Giá trị dương: Bên tới lượt đi đang chiếm ưu thế.
   * Giá trị âm: Bên tới lượt đi đang bị lép vế.
   */
  public static evaluateStatic(game: Chess): number {
    if (game.isCheckmate()) {
      return -99999; // Bị chiếu hết
    }
    if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) {
      return 0;      // Hòa cờ
    }

    let totalEval = 0;
    const board = game.board();
    const turn = game.turn();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;

        const val = PIECE_VALUES[piece.type] || 0;
        let posVal = 0;
        const idx = piece.color === 'w' ? r * 8 + c : (7 - r) * 8 + c;

        if (piece.type === 'p') posVal = PAWN_TABLE[idx];
        else if (piece.type === 'n') posVal = KNIGHT_TABLE[idx];

        const score = val + posVal;
        totalEval += piece.color === turn ? score : -score;
      }
    }

    return totalEval;
  }

  /**
   * Thuật toán Negamax với cắt tỉa Alpha-Beta đánh giá thế cờ ở độ sâu `depth`
   * Luôn trả về điểm theo góc nhìn của bên đang tới lượt đi (Side to Move).
   */
  public static negamax(game: Chess, depth: number, alpha: number, beta: number): number {
    if (depth === 0 || game.isGameOver()) {
      return this.evaluateStatic(game);
    }

    let moves = game.moves({ verbose: true });
    // Sắp xếp nước đi theo độ ưu tiên ăn quân để tăng hiệu quả cắt tỉa Alpha-Beta
    moves.sort((a, b) => {
      const valA = a.captured ? (PIECE_VALUES[a.captured] || 0) * 10 - (PIECE_VALUES[a.piece] || 0) : 0;
      const valB = b.captured ? (PIECE_VALUES[b.captured] || 0) * 10 - (PIECE_VALUES[b.piece] || 0) : 0;
      return valB - valA;
    });

    let maxScore = -Infinity;

    for (const move of moves) {
      game.move(move);
      const score = -this.negamax(game, depth - 1, -beta, -alpha);
      game.undo();

      if (score > maxScore) maxScore = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break; // Cắt tỉa nhánh (Beta cutoff)
    }

    return maxScore;
  }

  /**
   * Tìm nước đi tối ưu (Best Move) và điểm đánh giá tối ưu (Eval Best)
   * tại một thế cờ cụ thể (Bản đồng bộ cho fallback)
   */
  public static findBestMoveAndEval(game: Chess, depth: number = 2): {
    bestMoveUci: string;
    bestMoveSan: string;
    evalBest: number;
  } {
    if (game.isGameOver() || game.moves().length === 0) {
      const evalBest = game.isCheckmate() ? -10000 : 0;
      return { bestMoveUci: '(none)', bestMoveSan: '(none)', evalBest };
    }

    const moves = game.moves({ verbose: true });
    if (moves.length === 0) {
      const evalBest = game.isCheckmate() ? -10000 : 0;
      return { bestMoveUci: '(none)', bestMoveSan: '(none)', evalBest };
    }

    let bestScore = -Infinity;
    let bestMove = moves[0];

    for (const move of moves) {
      game.move(move);
      const score = -this.negamax(game, depth - 1, -Infinity, Infinity);
      game.undo();

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    const bestMoveUci = `${bestMove.from}${bestMove.to}${bestMove.promotion || ''}`;
    return {
      bestMoveUci,
      bestMoveSan: bestMove.san,
      evalBest: bestScore,
    };
  }

  /**
   * Đánh giá bất đồng bộ bằng Stockfish Bridge (có tùy chọn fallback an toàn)
   */
  public static async findBestMoveAndEvalAsync(
    game: Chess,
    depthOrOptions: number | {
      depth?: number;
      movetimeMs?: number;
      bridge?: StockfishBridge | null;
      abortSignal?: AbortSignal;
      allowSyncFallback?: boolean;
    } = 10,
    legacyBridge?: StockfishBridge | null,
    legacyAbortSignal?: AbortSignal
  ): Promise<{
    bestMoveUci: string;
    bestMoveSan: string;
    evalBest: number;
  }> {
    // 1. Guard thế cờ kết thúc ván: không gửi sang Stockfish
    if (game.isGameOver() || game.moves().length === 0) {
      const evalBest = game.isCheckmate() ? -10000 : 0;
      return { bestMoveUci: '(none)', bestMoveSan: '(none)', evalBest };
    }

    const opts =
      typeof depthOrOptions === 'number'
        ? {
            depth: depthOrOptions,
            bridge: legacyBridge,
            abortSignal: legacyAbortSignal,
            allowSyncFallback: true,
          }
        : {
            depth: 10,
            allowSyncFallback: true,
            ...depthOrOptions,
          };

    const bridge = opts.bridge;
    const depth = opts.depth || 10;
    const abortSignal = opts.abortSignal;

    if (bridge && bridge.isAvailable()) {
      try {
        const fen = game.fen();
        const result = await bridge.evaluateFen(fen, {
          depth,
          movetimeMs: opts.movetimeMs,
          abortSignal,
        });

        let bestMoveSan = result.bestMoveUci;
        if (result.bestMoveUci === '(none)' || result.bestMoveUci === '0000') {
          return {
            bestMoveUci: '(none)',
            bestMoveSan: '(none)',
            evalBest: result.evalBest,
          };
        }

        let isMoved = false;
        try {
          const moveObj = game.move({
            from: result.bestMoveUci.slice(0, 2) as any,
            to: result.bestMoveUci.slice(2, 4) as any,
            promotion: (result.bestMoveUci.slice(4, 5) || undefined) as any,
          });
          if (moveObj) {
            bestMoveSan = moveObj.san;
            isMoved = true;
          }
        } catch {
          // ignore
        } finally {
          if (isMoved) {
            game.undo();
          }
        }

        return {
          bestMoveUci: result.bestMoveUci,
          bestMoveSan,
          evalBest: result.evalBest,
        };
      } catch (err: any) {
        if (err?.message === 'Analysis aborted') {
          throw err;
        }
        if (!opts.allowSyncFallback) {
          throw err;
        }
        console.warn('EvaluationService: Stockfish eval thất bại, fallback sang Negamax:', err);
      }
    }

    if (!opts.allowSyncFallback) {
      throw new Error('Stockfish evaluation failed and sync fallback is disabled');
    }

    // Fallback sang Negamax chỉ khi được phép (Game Review / Test)
    return this.findBestMoveAndEval(game, Math.min(depth, 3));
  }

  /**
   * Tính toán Centipawn Loss (CPL) chuẩn xác theo góc nhìn bên đang đi (Side to Move)
   * 
   * @param evalBest Điểm đánh giá của nước đi tối ưu (góc nhìn người đi)
   * @param evalOppAfterMove Điểm đánh giá thế cờ sau nước đi (góc nhìn của đối thủ)
   * @param isBestMovePlayed Có phải người chơi đã đi đúng nước tối ưu không
   */
  public static calculateCPL(
    evalBest: number,
    evalOppAfterMove: number,
    isBestMovePlayed: boolean = false
  ): { evalPlayed: number; cpl: number } {
    if (isBestMovePlayed) {
      return {
        evalPlayed: evalBest,
        cpl: 0,
      };
    }

    // Giá trị thế cờ mà người chơi đạt được sau nước đi
    // (nghịch đảo lại điểm từ góc nhìn của đối thủ)
    const evalPlayed = -evalOppAfterMove;

    // CPL đo mức hao hụt lợi thế so với lựa chọn tối ưu
    const rawCpl = evalBest - evalPlayed;

    // Giới hạn trong khoảng [0, 1000] để tránh méo mó thống kê khi dính đòn chiếu hết
    const cpl = Math.max(0, Math.min(1000, Math.round(rawCpl)));

    return {
      evalPlayed,
      cpl,
    };
  }
}
