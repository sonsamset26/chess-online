import { Square } from 'chess.js';

export type MoveClassification = 
  | 'BEST'
  | 'EXCELLENT'
  | 'GOOD'
  | 'INACCURACY'
  | 'MISTAKE'
  | 'BLUNDER';

export type GamePhase = 'OPENING' | 'MIDDLEGAME' | 'ENDGAME';

export interface MoveClassificationConfig {
  excellentMax: number;   // default: 20
  goodMax: number;        // default: 50
  inaccuracyMax: number;  // default: 100
  mistakeMax: number;     // default: 200
}

export const DEFAULT_CLASSIFICATION_CONFIG: MoveClassificationConfig = {
  excellentMax: 20,
  goodMax: 50,
  inaccuracyMax: 100,
  mistakeMax: 200,
};

export interface MoveAnalysis {
  ply: number;                   // Số thứ tự nước đi (1, 2, 3...)
  moveNumber: number;            // Số thứ tự ván (1, 1, 2, 2...)
  color: 'w' | 'b';              // Bên đi
  san: string;                   // Ký hiệu nước đi (ví dụ: e4, Nf3, Qh5#)
  from: Square;
  to: Square;
  fenBefore: string;
  fenAfter: string;
  bestMoveSan: string;           // Nước tối ưu do Engine gợi ý
  bestMoveUci: string;           // Nước tối ưu dạng uci (ví dụ: g1f3)
  evalBefore: number;            // Đánh giá thế cờ theo góc nhìn người đi (centipawn)
  evalAfter: number;             // Đánh giá sau khi đi theo góc nhìn người đi (centipawn)
  cpl: number;                   // Centipawn Loss (độ hao hụt thế cờ: max(0, evalBefore - evalAfter))
  classification: MoveClassification;
  accuracy: number;              // Độ chính xác nước đi (0 - 100%)
  phase: GamePhase;              // Giai đoạn: Khai cuộc / Trung cuộc / Tàn cuộc
  timeSpentMs?: number;          // Thời gian suy nghĩ của nước đi (nếu có)
  isTimePressure?: boolean;      // Đi khi thời gian còn dưới 30s
}

export interface PhaseStats {
  movesCount: number;
  avgCpl: number;
  blunderCount: number;
  mistakeCount: number;
  inaccuracyCount: number;
  blunderRate: number;           // blunderCount / movesCount
}

export interface PlayerSummary {
  accuracy: number;              // Độ chính xác tổng thể (0 - 100%)
  avgCpl: number;                // Tổn thất thế cờ trung bình
  totalMoves: number;
  bestCount: number;
  excellentCount: number;
  goodCount: number;
  inaccuracyCount: number;
  mistakeCount: number;
  blunderCount: number;
  phases: {
    opening: PhaseStats;
    middlegame: PhaseStats;
    endgame: PhaseStats;
  };
}

/**
 * Feature Vector chuẩn mực gồm 8 chiều dữ liệu
 * phục vụ trực tiếp mô hình K-Means Clustering ở Cột trụ 3
 */
export interface PlayerFeatureVector {
  openingCpl: number;
  middlegameCpl: number;
  endgameCpl: number;
  openingBlunderRate: number;
  middlegameBlunderRate: number;
  endgameBlunderRate: number;
  timePressureBlunderRate: number;
  averageThinkingTimeMs: number;
}

export interface GameAnalysisReport {
  matchId?: string;
  totalPlies: number;
  moves: MoveAnalysis[];
  summary: {
    white: PlayerSummary;
    black: PlayerSummary;
  };
  features: {
    white: PlayerFeatureVector;
    black: PlayerFeatureVector;
  };
  analysisDurationMs: number;
}
