import {
  MoveClassification,
  MoveClassificationConfig,
  DEFAULT_CLASSIFICATION_CONFIG,
} from './types';

export class MoveClassificationService {
  /**
   * Phân loại chất lượng nước đi dựa trên tổn thất Centipawn Loss (CPL)
   * và bảng cấu hình ngưỡng linh hoạt (Configurable Thresholds).
   */
  public static classify(
    cpl: number,
    config: MoveClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG
  ): MoveClassification {
    if (cpl <= 0) {
      return 'BEST';
    }
    if (cpl <= config.excellentMax) {
      return 'EXCELLENT';
    }
    if (cpl <= config.goodMax) {
      return 'GOOD';
    }
    if (cpl <= config.inaccuracyMax) {
      return 'INACCURACY';
    }
    if (cpl <= config.mistakeMax) {
      return 'MISTAKE';
    }
    return 'BLUNDER';
  }

  /**
   * Chuyển đổi Centipawn Loss sang Độ chính xác nước đi (Move Accuracy: 0 - 100%)
   * theo mô hình hàm suy giảm mũ (Exponential Decay):
   * 
   *   Accuracy = 100 * exp(-0.005 * CPL)
   * 
   * Tính chất:
   * - CPL = 0   => 100.0% (Nước tối ưu)
   * - CPL = 20  => 90.5%  (Nước rất tốt)
   * - CPL = 50  => 77.9%  (Nước tốt)
   * - CPL = 100 => 60.6%  (Nước thiếu chính xác)
   * - CPL = 200 => 36.8%  (Sai lầm)
   * - CPL >= 400 => < 13% (Sai lầm nghiêm trọng)
   */
  public static calculateMoveAccuracy(cpl: number): number {
    const accuracy = 100 * Math.exp(-0.005 * Math.max(0, cpl));
    return Math.round(accuracy * 10) / 10;
  }
}
