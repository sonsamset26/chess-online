import { Chess, Square } from 'chess.js';
import {
  MoveAnalysis,
  GamePhase,
  MoveClassificationConfig,
  DEFAULT_CLASSIFICATION_CONFIG,
  GameAnalysisReport,
} from './types';
import { EvaluationService } from './EvaluationService';
import { MoveClassificationService } from './MoveClassificationService';
import { GameReportService } from './GameReportService';
import { StockfishBridge } from './StockfishBridge';

export interface MoveTelemetryInput {
  timeSpentMs?: number;
  timeLeftMs?: number;
}

export interface AnalyzeGameOptions {
  telemetries?: MoveTelemetryInput[];
  matchId?: string;
  depth?: number;
  config?: MoveClassificationConfig;
  onProgress?: (percent: number, statusText?: string) => void;
  abortSignal?: AbortSignal;
}

export class AnalysisEngine {
  /**
   * Phân tích bất đồng bộ toàn bộ ván cờ với Stockfish Engine, FEN Memoization và AbortSignal
   */
  public static async analyzeGame(
    moveHistory: string[],
    options: AnalyzeGameOptions = {}
  ): Promise<GameAnalysisReport> {
    const {
      telemetries = [],
      matchId,
      depth = 10,
      config = DEFAULT_CLASSIFICATION_CONFIG,
      onProgress,
      abortSignal,
    } = options;

    const startTime = Date.now();
    const game = new Chess();
    const analyzedMoves: MoveAnalysis[] = [];
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

        // 1. Tìm nước tối ưu tại fenBefore (có Memoization)
        let bestMoveResult = fenCache.get(fenBefore);
        if (!bestMoveResult) {
          bestMoveResult = await EvaluationService.findBestMoveAndEvalAsync(game, depth, bridge, abortSignal);
          fenCache.set(fenBefore, bestMoveResult);
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
        const playedUci = `${from}${to}${moveObj.promotion || ''}`;

        const isBestMovePlayed = playedUci === bestMoveResult.bestMoveUci || san === bestMoveResult.bestMoveSan;

        // 3. Đánh giá thế cờ sau nước đi (từ góc nhìn của đối thủ)
        let evalOppAfterMove = 0;
        if (!isBestMovePlayed) {
          let oppResult = fenCache.get(fenAfter);
          if (!oppResult) {
            oppResult = await EvaluationService.findBestMoveAndEvalAsync(game, depth, bridge, abortSignal);
            fenCache.set(fenAfter, oppResult);
          }
          evalOppAfterMove = oppResult.evalBest;
        }

        // 4. Tính toán CPL chuẩn hóa
        const { evalPlayed, cpl } = EvaluationService.calculateCPL(
          bestMoveResult.evalBest,
          evalOppAfterMove,
          isBestMovePlayed
        );

        // 5. Phân loại chất lượng nước đi và tính độ chính xác
        const classification = MoveClassificationService.classify(cpl, config);
        const accuracy = MoveClassificationService.calculateMoveAccuracy(cpl);

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
          timeSpentMs,
          isTimePressure,
        });

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
    const analyzedMoves: MoveAnalysis[] = [];

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
