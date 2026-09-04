import { Chess, Square } from 'chess.js';
import {
  MoveAnalysis,
  CompletedMoveAnalysis,
  GamePhase,
  MoveClassificationConfig,
  DEFAULT_CLASSIFICATION_CONFIG,
  GameAnalysisReport,
  AnalyzeSingleMoveInput,
} from './types';
import { EvaluationService } from './EvaluationService';
import { MoveClassificationService } from './MoveClassificationService';
import { GameReportService } from './GameReportService';
import { StockfishBridge } from './StockfishBridge';

/**
 * Trích xuất 4 trường đầu tiên của FEN (Piece placement, side to move, castling, en-passant)
 * Dùng làm Position Key bất biến cho việc lưu đệm (Memoization) mà không bị lệch do bộ đếm số nước
 */
export function getPositionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

/**
 * Chuẩn hóa nước đi về dạng Canonical UCI chữ thường (ví dụ: e7e8q)
 */
export function toCanonicalUci(from: string, to: string, promotion?: string): string {
  let promo = '';
  if (promotion) {
    const cleaned = promotion.replace('=', '').trim().toLowerCase();
    promo = cleaned.charAt(0);
  }
  return `${from.toLowerCase()}${to.toLowerCase()}${promo}`;
}

// Bảng tra cứu các nước đi khai cuộc lý thuyết chuẩn quốc tế (Opening Book)
const MASTER_OPENING_PLY_1 = new Set(['e4', 'd4', 'Nf3', 'c4', 'g3', 'b3', 'f4', 'Nc3', 'e3', 'd3']);
const MASTER_OPENING_PLY_2 = new Set(['e5', 'c5', 'e6', 'c6', 'd5', 'd6', 'Nf6', 'Nc6', 'g6', 'b6', 'f5']);
const MASTER_DEVELOPMENT_MOVES = new Set([
  'e4', 'd4', 'c4', 'e5', 'd5', 'c5', 'c3', 'c6', 'e3', 'e6', 'd3', 'd6', 'g3', 'g6', 'b3', 'b6', 'a3', 'a6', 'h3', 'h6',
  'Nf3', 'Nc3', 'Nbd2', 'Nge2', 'Nf6', 'Nc6', 'Nbd7', 'Nge7', 'Nh6', 'Nh3',
  'Bc4', 'Bb5', 'Be2', 'Bd3', 'Bg5', 'Bf4', 'Be3', 'Bg2', 'Bb2',
  'Bc5', 'Bb4', 'Be7', 'Bd6', 'Bg4', 'Bf5', 'Be6', 'Bg7', 'Bb7',
  'O-O'
]);

export function isStandardOpeningMove(ply: number, san: string): boolean {
  const cleanSan = san.replace(/[+#!?]/g, '');
  if (ply === 1) return MASTER_OPENING_PLY_1.has(cleanSan);
  if (ply === 2) return MASTER_OPENING_PLY_2.has(cleanSan);
  if (ply <= 8) return MASTER_DEVELOPMENT_MOVES.has(cleanSan);
  return false;
}

export interface MoveTelemetryInput {
  timeSpentMs?: number;
  timeLeftMs?: number;
}

export interface AnalyzeGameOptions {
  telemetries?: MoveTelemetryInput[];
  matchId?: string;
  depth?: number;
  movetimeMs?: number;
  config?: MoveClassificationConfig;
  onProgress?: (percent: number, statusText?: string) => void;
  onMoveAnalyzed?: (analyzedMove: CompletedMoveAnalysis, allMoves: CompletedMoveAnalysis[]) => void;
  abortSignal?: AbortSignal;
}

export class AnalysisEngine {
  /**
   * Phân tích một nước cờ đơn lẻ phục vụ Live Coach (thời gian thực)
   * Sử dụng các snapshot bất biến fenBefore, fenAfter, moveSan
   */
  public static async analyzeSingleMove(
    input: AnalyzeSingleMoveInput,
    bridge?: StockfishBridge | null,
    sessionCache?: Map<string, { bestMoveUci: string; bestMoveSan: string; evalBest: number }>
  ): Promise<MoveAnalysis> {
    const {
      ply,
      fenBefore,
      fenAfter,
      moveSan,
      playerColor,
      depth = 8,
      movetimeMs = 200,
      abortSignal,
    } = input;

    const moveNumber = Math.floor((ply - 1) / 2) + 1;
    let phase: GamePhase = 'OPENING';
    if (moveNumber > 30) {
      phase = 'ENDGAME';
    } else if (moveNumber > 10) {
      phase = 'MIDDLEGAME';
    }

    let from: Square = 'a1' as Square;
    let to: Square = 'a1' as Square;

    try {
      const gameBefore = new Chess(fenBefore);
      let moveObj: any = null;
      try {
        const testGame = new Chess(fenBefore);
        moveObj = testGame.move(moveSan);
      } catch {
        // fallback
      }

      if (moveObj) {
        from = moveObj.from;
        to = moveObj.to;
      }
      const promotion = moveObj?.promotion || undefined;

      // 1. Guard nước cờ Chiếu Hết (Checkmate): Nước chiếu hết luôn là BEST (cpl = 0, evalAfter = 10000)
      let gameAfter: Chess;
      try {
        gameAfter = new Chess(fenAfter);
      } catch {
        gameAfter = new Chess();
      }

      const isCheckmateMove = moveSan.includes('#') || gameAfter.isCheckmate();

      if (isCheckmateMove) {
        return {
          ply,
          moveNumber,
          color: playerColor,
          san: moveSan,
          from,
          to,
          fenBefore,
          fenAfter,
          bestMoveSan: moveSan,
          bestMoveUci: toCanonicalUci(from, to, promotion),
          evalBefore: 9990,
          evalAfter: 10000,
          cpl: 0,
          classification: 'BEST',
          accuracy: 100,
          phase,
          status: 'ANALYZED',
        };
      }
      // 2. Tìm nước tối ưu tại fenBefore với PositionKey Cache
      const cacheKeyBefore = getPositionKey(fenBefore);
      let bestMoveResult = sessionCache?.get(cacheKeyBefore);
      if (!bestMoveResult) {
        bestMoveResult = await EvaluationService.findBestMoveAndEvalAsync(
          gameBefore,
          {
            depth,
            movetimeMs,
            bridge,
            abortSignal,
            allowSyncFallback: false,
          }
        );
        sessionCache?.set(cacheKeyBefore, bestMoveResult);
      }

      // 3. So sánh chuẩn Canonical UCI
      const playedCanonical = toCanonicalUci(from, to, promotion);
      const engineCanonical = (bestMoveResult.bestMoveUci || '').trim().toLowerCase();
      const isBestMovePlayed =
        playedCanonical === engineCanonical || moveSan === bestMoveResult.bestMoveSan;

      // 4. Đánh giá thế cờ sau nước đi (từ góc nhìn đối thủ)
      let evalOppAfterMove = 0;
      if (!isBestMovePlayed) {
        if (gameAfter.isDraw() || gameAfter.isStalemate()) {
          evalOppAfterMove = 0;
        } else {
          const cacheKeyAfter = getPositionKey(fenAfter);
          let oppResult = sessionCache?.get(cacheKeyAfter);
          if (!oppResult) {
            oppResult = await EvaluationService.findBestMoveAndEvalAsync(
              gameAfter,
              {
                depth,
                movetimeMs,
                bridge,
                abortSignal,
                allowSyncFallback: false,
              }
            );
            sessionCache?.set(cacheKeyAfter, oppResult);
          }
          evalOppAfterMove = oppResult.evalBest;
        }
      }

      // 5. Tính toán CPL chuẩn hóa
      let { evalPlayed, cpl } = EvaluationService.calculateCPL(
        bestMoveResult.evalBest,
        evalOppAfterMove,
        isBestMovePlayed
      );

      // 6. Master Opening Guard: Các nước khai cuộc lý thuyết chuẩn không bị gán nhãn Mistake do nông độ sâu engine
      if (ply <= 8 && isStandardOpeningMove(ply, moveSan) && evalOppAfterMove <= 130) {
        cpl = Math.min(cpl, 5);
      }

      const classification = MoveClassificationService.classify(cpl);
      const accuracy = MoveClassificationService.calculateMoveAccuracy(cpl);

      return {
        ply,
        moveNumber,
        color: playerColor,
        san: moveSan,
        from,
        to,
        fenBefore,
        fenAfter,
        bestMoveSan: bestMoveResult.bestMoveSan,
        bestMoveUci: bestMoveResult.bestMoveUci,
        evalBefore: bestMoveResult.evalBest,
        evalAfter: evalPlayed,
        cpl,
        classification,
        accuracy,
        phase,
        status: 'ANALYZED',
      };
    } catch (err: any) {
      if (err?.message === 'Analysis aborted') {
        throw err;
      }
      return {
        ply,
        moveNumber,
        color: playerColor,
        san: moveSan,
        from,
        to,
        fenBefore,
        fenAfter,
        bestMoveSan: '',
        bestMoveUci: '',
        phase,
        status: 'FAILED',
      };
    }
  }

  /**
   * Phân tích bất đồng bộ toàn bộ ván cờ với Stockfish Engine, FEN Memoization và AbortSignal (Game Review)
   */
  public static async analyzeGame(
    moveHistory: string[],
    options: AnalyzeGameOptions = {}
  ): Promise<GameAnalysisReport> {
    const {
      telemetries = [],
      matchId,
      depth = 8,
      movetimeMs = 150,
      config = DEFAULT_CLASSIFICATION_CONFIG,
      onProgress,
      onMoveAnalyzed,
      abortSignal,
    } = options;

    const startTime = Date.now();
    const game = new Chess();
    const analyzedMoves: CompletedMoveAnalysis[] = [];
    const totalPlies = moveHistory.length;

    // Khởi tạo 1 session bridge cho toàn bộ ván đấu
    const bridge = new StockfishBridge();
    const fenCache = new Map<string, { bestMoveUci: string; bestMoveSan: string; evalBest: number }>();

    try {
      if (onProgress) {
        onProgress(0, 'Đang chuẩn bị động cơ phân tích...');
      }

      for (let i = 0; i < moveHistory.length; i++) {
        if (abortSignal?.aborted) {
          throw new Error('Analysis aborted');
        }

        const san = moveHistory[i];
        const ply = i + 1;
        const moveNumber = Math.floor(i / 2) + 1;
        const color: 'w' | 'b' = i % 2 === 0 ? 'w' : 'b';

        const fenBefore = game.fen();

        // 1. Tìm nước tối ưu tại fenBefore (có Memoization theo PositionKey)
        const posKeyBefore = getPositionKey(fenBefore);
        let bestMoveResult = fenCache.get(posKeyBefore);
        if (!bestMoveResult) {
          bestMoveResult = await EvaluationService.findBestMoveAndEvalAsync(game, {
            depth,
            movetimeMs,
            bridge,
            abortSignal,
            allowSyncFallback: true,
          });
          fenCache.set(posKeyBefore, bestMoveResult);
        }

        // 2. Thực hiện nước cờ của người chơi
        let moveObj: any = null;
        try {
          moveObj = game.move(san);
        } catch (err) {
          console.error(`AnalysisEngine: Nước đi không hợp lệ tại ply ${ply}: ${san}`);
          break;
        }

        if (!moveObj) break;

        const fenAfter = game.fen();
        const from: Square = moveObj.from;
        const to: Square = moveObj.to;
        const playedUci = toCanonicalUci(from, to, moveObj.promotion);
        const engineUci = (bestMoveResult.bestMoveUci || '').trim().toLowerCase();

        const isCheckmateMove = game.isCheckmate() || san.includes('#');
        const isDrawMove = game.isDraw() || game.isStalemate();
        let evalPlayed = 0;
        let cpl = 0;
        let classification: any = 'BEST';
        let accuracy = 100;

        if (isCheckmateMove) {
          evalPlayed = 10000;
          cpl = 0;
          classification = 'BEST';
          accuracy = 100;
        } else if (isDrawMove && Math.abs(bestMoveResult.evalBest) <= 150) {
          evalPlayed = 0;
          cpl = 0;
          classification = 'EXCELLENT';
          accuracy = 100;
        } else {
          const isBestMovePlayed = playedUci === engineUci || san === bestMoveResult.bestMoveSan;

          // 3. Đánh giá thế cờ sau nước đi (từ góc nhìn của đối thủ)
          let evalOppAfterMove = 0;
          if (!isBestMovePlayed) {
            const posKeyAfter = getPositionKey(fenAfter);
            let oppResult = fenCache.get(posKeyAfter);
            if (!oppResult) {
              oppResult = await EvaluationService.findBestMoveAndEvalAsync(game, {
                depth,
                movetimeMs,
                bridge,
                abortSignal,
                allowSyncFallback: true,
              });
              fenCache.set(posKeyAfter, oppResult);
            }
            evalOppAfterMove = oppResult.evalBest;
          }

          // 4. Tính toán CPL chuẩn hóa
          const cplResult = EvaluationService.calculateCPL(
            bestMoveResult.evalBest,
            evalOppAfterMove,
            isBestMovePlayed
          );
          evalPlayed = cplResult.evalPlayed;
          cpl = cplResult.cpl;

          // 5. Phân loại chất lượng nước đi và tính độ chính xác
          classification = MoveClassificationService.classify(cpl, config);
          accuracy = MoveClassificationService.calculateMoveAccuracy(cpl);
        }

        // 6. Xác định giai đoạn ván cờ
        let phase: GamePhase = 'OPENING';
        if (moveNumber > 30) {
          phase = 'ENDGAME';
        } else if (moveNumber > 10) {
          phase = 'MIDDLEGAME';
        }

        // 7. Gán dữ liệu telemetry thời gian (nếu có)
        const telemetry = telemetries[i];
        const timeSpentMs = telemetry?.timeSpentMs;
        const isTimePressure = telemetry?.timeLeftMs !== undefined ? telemetry.timeLeftMs < 30000 : false;

        const moveAnalysis: CompletedMoveAnalysis = {
          ply,
          moveNumber,
          color,
          san,
          from,
          to,
          fenBefore,
          fenAfter,
          bestMoveSan: bestMoveResult.bestMoveSan,
          bestMoveUci: bestMoveResult.bestMoveUci,
          evalBefore: bestMoveResult.evalBest,
          evalAfter: evalPlayed,
          cpl,
          classification,
          accuracy,
          phase,
          timeSpentMs,
          isTimePressure,
        };

        analyzedMoves.push(moveAnalysis);
        onMoveAnalyzed?.(moveAnalysis, analyzedMoves);

        if (onProgress) {
          const percent = Math.round(((i + 1) / totalPlies) * 100);
          onProgress(percent, `Đang phân tích nước ${i + 1}/${totalPlies}...`);
        }
      }
    } finally {
      // Đảm bảo giải phóng Web Worker sau khi phân tích xong hoặc khi bị hủy
      bridge.terminate();
    }

    const durationMs = Date.now() - startTime;
    return GameReportService.generateReport(analyzedMoves, matchId, durationMs);
  }

  /**
   * Phiên bản đồng bộ sử dụng thuật toán Negamax nội bộ (phục vụ Unit Test hoặc SSR)
   */
  public static analyzeGameSync(
    moveHistory: string[],
    telemetries: MoveTelemetryInput[] = [],
    matchId?: string,
    depth: number = 2,
    config: MoveClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG
  ): GameAnalysisReport {
    const startTime = Date.now();
    const game = new Chess();
    const analyzedMoves: CompletedMoveAnalysis[] = [];

    for (let i = 0; i < moveHistory.length; i++) {
      const san = moveHistory[i];
      const ply = i + 1;
      const moveNumber = Math.floor(i / 2) + 1;
      const color: 'w' | 'b' = i % 2 === 0 ? 'w' : 'b';

      const fenBefore = game.fen();
      const bestMoveResult = EvaluationService.findBestMoveAndEval(game, depth);

      let moveObj: any = null;
      try {
        moveObj = game.move(san);
      } catch (err) {
        break;
      }
      if (!moveObj) break;

      const fenAfter = game.fen();
      const from: Square = moveObj.from;
      const to: Square = moveObj.to;
      const playedUci = `${from}${to}${moveObj.promotion || ''}`;
      const isBestMovePlayed = playedUci === bestMoveResult.bestMoveUci || san === bestMoveResult.bestMoveSan;

      let evalOppAfterMove = 0;
      if (!isBestMovePlayed) {
        evalOppAfterMove = EvaluationService.negamax(game, depth - 1, -Infinity, Infinity);
      }

      const { evalPlayed, cpl } = EvaluationService.calculateCPL(
        bestMoveResult.evalBest,
        evalOppAfterMove,
        isBestMovePlayed
      );

      const classification = MoveClassificationService.classify(cpl, config);
      const accuracy = MoveClassificationService.calculateMoveAccuracy(cpl);

      let phase: GamePhase = 'OPENING';
      if (moveNumber > 30) phase = 'ENDGAME';
      else if (moveNumber > 10) phase = 'MIDDLEGAME';

      const telemetry = telemetries[i];

      analyzedMoves.push({
        ply,
        moveNumber,
        color,
        san,
        from,
        to,
        fenBefore,
        fenAfter,
        bestMoveSan: bestMoveResult.bestMoveSan,
        bestMoveUci: bestMoveResult.bestMoveUci,
        evalBefore: bestMoveResult.evalBest,
        evalAfter: evalPlayed,
        cpl,
        classification,
        accuracy,
        phase,
        timeSpentMs: telemetry?.timeSpentMs,
        isTimePressure: telemetry?.timeLeftMs !== undefined ? telemetry.timeLeftMs < 30000 : false,
      });
    }

    const durationMs = Date.now() - startTime;
    return GameReportService.generateReport(analyzedMoves, matchId, durationMs);
  }
}
