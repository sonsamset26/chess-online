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

export interface MoveTelemetryInput {
  timeSpentMs?: number;
  timeLeftMs?: number;
}

export class AnalysisEngine {
  /**
   * Phân tích toàn bộ ván cờ từ danh sách nước đi (SAN history hoặc PGN)
   * 
   * @param moveHistory Danh sách các nước đi dạng SAN (ví dụ: ["e4", "e5", "Nf3", "Nc6", ...])
   * @param telemetries Mảng dữ liệu thời gian của từng nước đi (tùy chọn)
   * @param matchId Mã ván đấu (tùy chọn)
   * @param depth Độ sâu tìm kiếm của Engine (mặc định: 2 cho phân tích nhanh < 2 giây)
   * @param config Bảng ngưỡng phân loại có thể cấu hình
   */
  public static analyzeGame(
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

      // 1. Tìm nước đi tối ưu và điểm đánh giá tại thế cờ trước khi người chơi đi
      const bestMoveResult = EvaluationService.findBestMoveAndEval(game, depth);

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
        evalOppAfterMove = EvaluationService.negamax(game, depth - 1, -Infinity, Infinity);
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
    }

    const durationMs = Date.now() - startTime;
    return GameReportService.generateReport(analyzedMoves, matchId, durationMs);
  }
}
