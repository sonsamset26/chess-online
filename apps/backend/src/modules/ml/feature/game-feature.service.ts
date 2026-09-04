import { IMatch, PlayerFeatureVector } from '../../match/match.model';

export class GameFeatureService {
  /**
   * Trích xuất vector đặc trưng 8 chiều của một kỳ thủ từ ván cờ cụ thể
   */
  public static extractPlayerFeaturesFromMatch(
    match: IMatch,
    userIdOrUsername: string
  ): PlayerFeatureVector | null {
    const isWhite = match.whiteUserId === userIdOrUsername || match.whiteUsername === userIdOrUsername;
    const isBlack = match.blackUserId === userIdOrUsername || match.blackUsername === userIdOrUsername;

    if (!isWhite && !isBlack) {
      return null;
    }

    // 1. Tận dụng dữ liệu phân tích dẫn xuất (Derived Cache) nếu đã có
    if (isWhite && match.analysis?.whiteFeatures) {
      return match.analysis.whiteFeatures;
    }
    if (isBlack && match.analysis?.blackFeatures) {
      return match.analysis.blackFeatures;
    }

    // 2. Tính toán từ dữ liệu viễn trắc máy chủ gốc (Authoritative Raw Telemetry)
    const color = isWhite ? 'w' : 'b';
    const playerTelemetry = (match.moveTelemetry || []).filter((t) => t.color === color);

    let averageThinkingTimeMs = 0;
    let timePressureBlunderRate = 0;

    if (playerTelemetry.length > 0) {
      const totalTime = playerTelemetry.reduce((sum, t) => sum + (t.timeSpentMs || 0), 0);
      averageThinkingTimeMs = Math.round(totalTime / playerTelemetry.length);

      // Định nghĩa áp lực thời gian: còn dưới 30 giây (30000ms)
      const timePressureMoves = playerTelemetry.filter((t) => t.timeLeftMs < 30000);
      if (timePressureMoves.length > 0) {
        timePressureBlunderRate = 0;
      }
    }

    const avgCpl = isWhite ? (match.analysis?.whiteAvgCpl || 0) : (match.analysis?.blackAvgCpl || 0);

    return {
      openingCpl: avgCpl,
      middlegameCpl: avgCpl,
      endgameCpl: avgCpl,
      openingBlunderRate: 0,
      middlegameBlunderRate: 0,
      endgameBlunderRate: 0,
      timePressureBlunderRate,
      averageThinkingTimeMs,
    };
  }
}
