import { PlayerFeatureVector } from '../../match/match.model';

export interface PhaseScores {
  opening: number;       // 0-100 (càng cao càng tốt)
  middlegame: number;    // 0-100
  endgame: number;       // 0-100
  timeManagement: number;// 0-100
}

export interface WeaknessAnalysisResult {
  weakestPhase: 'OPENING' | 'MIDDLEGAME' | 'ENDGAME';
  weaknessScore: number; // 0-100 (độ nghiêm trọng của điểm yếu)
  phaseScores: PhaseScores;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export class WeaknessAnalyzer {
  /**
   * Quy đổi điểm CPL sang thang điểm hiệu năng 0-100 (CPL <= 15 -> 96 điểm, CPL >= 100 -> 15 điểm)
   */
  private static cplToScore(cpl: number): number {
    if (cpl <= 0) return 60; // Baseline mặc định khi chưa có dữ liệu CPL
    if (cpl <= 15) return 96;
    if (cpl >= 100) return 15;
    return Math.max(15, Math.min(96, Math.round(100 - ((cpl - 15) / 85) * 85)));
  }

  /**
   * Phân tích sâu điểm mạnh và điểm yếu qua các giai đoạn ván cờ
   */
  public static analyzeWeakness(features: PlayerFeatureVector): WeaknessAnalysisResult {
    const opCpl = features.openingCpl || 0;
    const midCpl = features.middlegameCpl || 0;
    const endCpl = features.endgameCpl || 0;
    const opBlunder = features.openingBlunderRate || 0;
    const midBlunder = features.middlegameBlunderRate || 0;
    const endBlunder = features.endgameBlunderRate || 0;
    const timePressureBlunder = features.timePressureBlunderRate || 0;
    const thinkingTime = features.averageThinkingTimeMs || 0;
    const isUnanalyzed = opCpl === 0 && midCpl === 0 && endCpl === 0;

    const opScore = isUnanalyzed ? 65 : this.cplToScore(opCpl);
    const midScore = isUnanalyzed ? 60 : this.cplToScore(midCpl);
    const endScore = isUnanalyzed ? 55 : this.cplToScore(endCpl);

    // Điểm quản lý thời gian: dựa trên timePressureBlunder và thinkingTime
    let timeScore = 80;
    if (timePressureBlunder > 0.25) timeScore -= 40;
    else if (timePressureBlunder > 0.15) timeScore -= 20;
    if (thinkingTime < 2500 && thinkingTime > 0) timeScore -= 15; // Chơi quá vội
    timeScore = Math.max(15, Math.min(100, timeScore));

    const phaseScores: PhaseScores = {
      opening: opScore,
      middlegame: midScore,
      endgame: endScore,
      timeManagement: timeScore,
    };

    // Tìm giai đoạn có CPL cao nhất và blunder rate cao nhất
    const phaseLosses = [
      { phase: 'OPENING' as const, penalty: opCpl * 0.7 + opBlunder * 200 },
      { phase: 'MIDDLEGAME' as const, penalty: midCpl * 0.8 + midBlunder * 220 },
      { phase: 'ENDGAME' as const, penalty: endCpl * 0.9 + endBlunder * 250 },
    ];

    phaseLosses.sort((a, b) => b.penalty - a.penalty);
    const worst = phaseLosses[0];

    const weakestPhase = worst.phase;
    const weaknessScore = Math.min(95, Math.max(20, Math.round(worst.penalty * 0.8)));

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];

    // Đánh giá thế mạnh
    if (opScore >= 75) strengths.push('Phát triển quân đầu trận bài bản và kiểm soát tốt các ô trung tâm');
    if (midScore >= 70) strengths.push('Khả năng tính toán các đòn phối hợp ở giữa trận tốt');
    if (endScore >= 70) strengths.push('Kỹ thuật xử lý cuối trận kiên nhẫn và chính xác');
    if (timeScore >= 75) strengths.push('Phân bổ thời gian hợp lý, giữ được bình tĩnh khi đồng hồ cạn giờ');

    if (strengths.length === 0) {
      strengths.push('Đang tích lũy thêm ván đấu để phân tích phong cách rõ hơn');
    }

    // Đánh giá điểm yếu & Lời khuyên
    if (weakestPhase === 'OPENING') {
      weaknesses.push(`Độ chính xác ở giai đoạn đầu trận chưa cao (${opCpl.toFixed(1)} cpl)`);
      recommendations.push('Ôn tập lại 2-3 thế cờ mở màn quen thuộc cho cả Trắng và Đen');
      recommendations.push('Ưu tiên kiểm soát trung tâm và nhập thành an toàn trước khi dâng quân tấn công');
    } else if (weakestPhase === 'MIDDLEGAME') {
      weaknesses.push(`Giai đoạn giữa trận thường để mất ưu thế (${midCpl.toFixed(1)} cpl, tỉ lệ sai lầm ${(midBlunder * 100).toFixed(1)}%)`);
      recommendations.push('Luyện tập các bài tập chiến thuật (đòn ghim, đòn đôi, tấn công mở)');
      recommendations.push('Chú ý quan sát các ô yếu và quân cờ không được bảo vệ của đối thủ');
    } else {
      weaknesses.push(`Khả năng chuyển hóa ưu thế ở cuối trận còn hạn chế (${endCpl.toFixed(1)} cpl, tỉ lệ sai lầm ${(endBlunder * 100).toFixed(1)}%)`);
      recommendations.push('Luyện tập các hình cờ cuối trận căn bản: Vua - Xe, Vua - Tốt');
      recommendations.push('Tích cực đưa Vua vào trung tâm khi bàn cờ đã vơi bớt quân nặng');
    }

    if (timePressureBlunder > 0.2) {
      weaknesses.push(`Tỉ lệ sai sót khi thời gian dưới 30 giây lên tới ${(timePressureBlunder * 100).toFixed(0)}%`);
      recommendations.push('Cải thiện thói quen bấm giờ và tránh tiêu tốn quá nhiều thời gian cho các nước cờ hiển nhiên');
    }

    const phaseNames = {
      OPENING: 'Đầu trận',
      MIDDLEGAME: 'Giữa trận',
      ENDGAME: 'Cuối trận',
    };

    const summary = isUnanalyzed
      ? 'Hệ thống đang chờ dữ liệu phân tích ván cờ từ Stockfish. Hãy mở xem lại các ván đấu để nạp chỉ số chi tiết.'
      : `Bạn hay để mất ưu thế nhất ở giai đoạn ${phaseNames[weakestPhase]}. Tập trung rèn luyện khâu này sẽ giúp thế cờ của bạn chắc chắn hơn.`;

    return {
      weakestPhase,
      weaknessScore,
      phaseScores,
      summary,
      strengths,
      weaknesses,
      recommendations,
    };
  }
}
