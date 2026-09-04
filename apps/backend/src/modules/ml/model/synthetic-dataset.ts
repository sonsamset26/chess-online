import { PlayerFeatureVector } from '../../match/match.model';

/**
 * 8 chiều đặc trưng:
 * [0]: openingCpl
 * [1]: middlegameCpl
 * [2]: endgameCpl
 * [3]: openingBlunderRate
 * [4]: middlegameBlunderRate
 * [5]: endgameBlunderRate
 * [6]: timePressureBlunderRate
 * [7]: averageThinkingTimeMs
 */

export const CLUSTER_STYLE_NAMES: Record<number, string> = {
  0: 'Tiến công',
  1: 'Toàn diện',
  2: 'Đột biến',
  3: 'Phòng thủ',
};

export const CLUSTER_STYLE_DESCRIPTIONS: Record<number, string> = {
  0: 'Thích thế trận cởi mở, ra đòn nhanh và chủ động tạo sức ép tấn công từ sớm.',
  1: 'Lối chơi toàn diện, tính toán kỹ lưỡng và duy trì thế trận cân bằng, ít sai sót.',
  2: 'Lối chơi biến hóa, giàu cảm xúc và nhạy cảm trước áp lực đồng hồ thi đấu.',
  3: 'Lối chơi chặt chẽ, nhập cuộc cẩn trọng và ưu tiên cấu trúc phòng thủ an toàn.',
};

/**
 * Tạo tập dữ liệu Bootstrap (120 mẫu) mô phỏng 4 phong cách cờ vua điển hình
 * giúp hệ thống có thể khởi động lạnh (Cold-start) ngay lập tức
 */
export function generateBootstrapProfiles(): number[][] {
  const dataset: number[][] = [];

  function addJitter(val: number, jitter: number, min = 0): number {
    return Math.max(min, val + (Math.random() * 2 - 1) * jitter);
  }

  // Cụm 0: Tấn công Tốc độ (Thinking time thấp ~3s, CPL trung bình, time pressure blunder cao)
  for (let i = 0; i < 30; i++) {
    dataset.push([
      addJitter(25, 6, 5),     // openingCpl
      addJitter(45, 10, 15),   // middlegameCpl
      addJitter(55, 12, 20),   // endgameCpl
      addJitter(0.04, 0.02, 0),// openingBlunderRate
      addJitter(0.12, 0.04, 0),// middlegameBlunderRate
      addJitter(0.18, 0.05, 0),// endgameBlunderRate
      addJitter(0.24, 0.06, 0),// timePressureBlunderRate
      addJitter(3200, 600, 1000), // averageThinkingTimeMs (nhanh)
    ]);
  }

  // Cụm 1: Chiến lược Vững vàng (Thinking time cao ~12s, CPL thấp ~15-25, blunder rất thấp)
  for (let i = 0; i < 30; i++) {
    dataset.push([
      addJitter(15, 4, 3),     // openingCpl (vững)
      addJitter(22, 5, 8),     // middlegameCpl (vững)
      addJitter(20, 5, 5),     // endgameCpl (vững)
      addJitter(0.02, 0.01, 0),// openingBlunderRate
      addJitter(0.04, 0.02, 0),// middlegameBlunderRate
      addJitter(0.03, 0.01, 0),// endgameBlunderRate
      addJitter(0.06, 0.03, 0),// timePressureBlunderRate
      addJitter(11500, 1800, 5000), // averageThinkingTimeMs (kỹ lưỡng)
    ]);
  }

  // Cụm 2: Bất ổn Áp lực Thời gian / Yếu tàn cuộc (Endgame CPL cao ~80, timePressureBlunderRate cực cao)
  for (let i = 0; i < 30; i++) {
    dataset.push([
      addJitter(28, 7, 10),    // openingCpl
      addJitter(42, 9, 15),    // middlegameCpl
      addJitter(85, 15, 40),   // endgameCpl (đuối sức)
      addJitter(0.03, 0.02, 0),// openingBlunderRate
      addJitter(0.09, 0.03, 0),// middlegameBlunderRate
      addJitter(0.26, 0.06, 0),// endgameBlunderRate (rất cao)
      addJitter(0.32, 0.07, 0),// timePressureBlunderRate (áp lực nặng)
      addJitter(6500, 1200, 2000), // averageThinkingTimeMs
    ]);
  }

  // Cụm 3: Thận trọng Khai cuộc / Tranh chấp Trung cuộc (Opening CPL rất thấp ~12, Middlegame CPL cao ~65)
  for (let i = 0; i < 30; i++) {
    dataset.push([
      addJitter(12, 3, 2),     // openingCpl (rất thuộc lý thuyết)
      addJitter(68, 14, 30),   // middlegameCpl (bối rối ở trung cuộc)
      addJitter(35, 8, 10),    // endgameCpl
      addJitter(0.01, 0.01, 0),// openingBlunderRate
      addJitter(0.19, 0.05, 0),// middlegameBlunderRate
      addJitter(0.08, 0.03, 0),// endgameBlunderRate
      addJitter(0.14, 0.04, 0),// timePressureBlunderRate
      addJitter(8000, 1400, 3000), // averageThinkingTimeMs
    ]);
  }

  return dataset;
}

export function vectorToArray(vec: PlayerFeatureVector): number[] {
  return [
    vec.openingCpl || 0,
    vec.middlegameCpl || 0,
    vec.endgameCpl || 0,
    vec.openingBlunderRate || 0,
    vec.middlegameBlunderRate || 0,
    vec.endgameBlunderRate || 0,
    vec.timePressureBlunderRate || 0,
    vec.averageThinkingTimeMs || 0,
  ];
}
