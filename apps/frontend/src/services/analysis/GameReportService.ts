import {
  CompletedMoveAnalysis,
  PlayerSummary,
  PhaseStats,
  PlayerFeatureVector,
  GameAnalysisReport,
} from './types';

export class GameReportService {
  /**
   * Tạo báo cáo phân tích toàn diện ván cờ từ danh sách nước đi đã phân tích
   */
  public static generateReport(
    moves: CompletedMoveAnalysis[],
    matchId?: string,
    analysisDurationMs: number = 0
  ): GameAnalysisReport {
    const whiteMoves = moves.filter((m) => m.color === 'w');
    const blackMoves = moves.filter((m) => m.color === 'b');

    const whiteSummary = this.calculatePlayerSummary(whiteMoves);
    const blackSummary = this.calculatePlayerSummary(blackMoves);

    const whiteFeatures = this.extractFeatureVector(whiteSummary, whiteMoves);
    const blackFeatures = this.extractFeatureVector(blackSummary, blackMoves);

    return {
      matchId,
      totalPlies: moves.length,
      moves,
      summary: {
        white: whiteSummary,
        black: blackSummary,
      },
      features: {
        white: whiteFeatures,
        black: blackFeatures,
      },
      analysisDurationMs,
    };
  }

  /**
   * Tính toán các chỉ số tóm tắt cho một người chơi (Trắng hoặc Đen)
   */
  private static calculatePlayerSummary(playerMoves: CompletedMoveAnalysis[]): PlayerSummary {
    if (playerMoves.length === 0) {
      return {
        accuracy: 100,
        avgCpl: 0,
        totalMoves: 0,
        bestCount: 0,
        excellentCount: 0,
        goodCount: 0,
        inaccuracyCount: 0,
        mistakeCount: 0,
        blunderCount: 0,
        phases: {
          opening: this.createEmptyPhaseStats(),
          middlegame: this.createEmptyPhaseStats(),
          endgame: this.createEmptyPhaseStats(),
        },
      };
    }

    let totalAccuracy = 0;
    let totalCpl = 0;

    let bestCount = 0;
    let excellentCount = 0;
    let goodCount = 0;
    let inaccuracyCount = 0;
    let mistakeCount = 0;
    let blunderCount = 0;

    const openingMoves: CompletedMoveAnalysis[] = [];
    const middlegameMoves: CompletedMoveAnalysis[] = [];
    const endgameMoves: CompletedMoveAnalysis[] = [];

    for (const m of playerMoves) {
      totalAccuracy += m.accuracy;
      totalCpl += m.cpl;

      if (m.classification === 'BEST') bestCount++;
      else if (m.classification === 'EXCELLENT') excellentCount++;
      else if (m.classification === 'GOOD') goodCount++;
      else if (m.classification === 'INACCURACY') inaccuracyCount++;
      else if (m.classification === 'MISTAKE') mistakeCount++;
      else if (m.classification === 'BLUNDER') blunderCount++;

      if (m.phase === 'OPENING') openingMoves.push(m);
      else if (m.phase === 'MIDDLEGAME') middlegameMoves.push(m);
      else if (m.phase === 'ENDGAME') endgameMoves.push(m);
    }

    const n = playerMoves.length;

    return {
      accuracy: Math.round((totalAccuracy / n) * 10) / 10,
      avgCpl: Math.round(totalCpl / n),
      totalMoves: n,
      bestCount,
      excellentCount,
      goodCount,
      inaccuracyCount,
      mistakeCount,
      blunderCount,
      phases: {
        opening: this.calculatePhaseStats(openingMoves),
        middlegame: this.calculatePhaseStats(middlegameMoves),
        endgame: this.calculatePhaseStats(endgameMoves),
      },
    };
  }

  private static calculatePhaseStats(moves: CompletedMoveAnalysis[]): PhaseStats {
    if (moves.length === 0) return this.createEmptyPhaseStats();

    let totalCpl = 0;
    let blunderCount = 0;
    let mistakeCount = 0;
    let inaccuracyCount = 0;

    for (const m of moves) {
      totalCpl += m.cpl;
      if (m.classification === 'BLUNDER') blunderCount++;
      else if (m.classification === 'MISTAKE') mistakeCount++;
      else if (m.classification === 'INACCURACY') inaccuracyCount++;
    }

    const n = moves.length;
    return {
      movesCount: n,
      avgCpl: Math.round(totalCpl / n),
      blunderCount,
      mistakeCount,
      inaccuracyCount,
      blunderRate: Math.round((blunderCount / n) * 1000) / 1000,
    };
  }

  private static createEmptyPhaseStats(): PhaseStats {
    return {
      movesCount: 0,
      avgCpl: 0,
      blunderCount: 0,
      mistakeCount: 0,
      inaccuracyCount: 0,
      blunderRate: 0,
    };
  }

  /**
   * Trích xuất Vector đặc trưng 8 chiều chuẩn mực cho mô hình K-Means (Cột trụ 3)
   */
  public static extractFeatureVector(
    summary: PlayerSummary,
    playerMoves: CompletedMoveAnalysis[]
  ): PlayerFeatureVector {
    // 1. Phân tích lỗi khi bị áp lực thời gian (Time Pressure: timeLeft < 30s)
    const timePressureMoves = playerMoves.filter((m) => m.isTimePressure);
    let timePressureBlunderRate = 0;
    if (timePressureMoves.length > 0) {
      const tpBlunders = timePressureMoves.filter((m) => m.classification === 'BLUNDER').length;
      timePressureBlunderRate = Math.round((tpBlunders / timePressureMoves.length) * 1000) / 1000;
    }

    // 2. Thời gian suy nghĩ trung bình mỗi nước đi
    const movesWithTime = playerMoves.filter((m) => m.timeSpentMs !== undefined && m.timeSpentMs > 0);
    let averageThinkingTimeMs = 0;
    if (movesWithTime.length > 0) {
      const totalTime = movesWithTime.reduce((acc, m) => acc + (m.timeSpentMs || 0), 0);
      averageThinkingTimeMs = Math.round(totalTime / movesWithTime.length);
    }

    return {
      openingCpl: summary.phases.opening.avgCpl,
      middlegameCpl: summary.phases.middlegame.avgCpl,
      endgameCpl: summary.phases.endgame.avgCpl,
      openingBlunderRate: summary.phases.opening.blunderRate,
      middlegameBlunderRate: summary.phases.middlegame.blunderRate,
      endgameBlunderRate: summary.phases.endgame.blunderRate,
      timePressureBlunderRate,
      averageThinkingTimeMs,
    };
  }
}
