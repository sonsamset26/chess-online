export interface EloPlayerResult {
  oldElo: number;
  newElo: number;
  delta: number;
}

export interface EloCalculationResult {
  white: EloPlayerResult;
  black: EloPlayerResult;
}

/**
 * Tính toán độ biến thiên điểm số Elo chuẩn FIDE
 * @param whiteElo Elo hiện tại của quân Trắng
 * @param blackElo Elo hiện tại của quân Đen
 * @param result Kết quả trận đấu: 'w' (Trắng thắng), 'b' (Đen thắng), 'd' (Hòa)
 * @param kFactor Hệ số dao động K (mặc định = 32)
 */
export function calculateElo(
  whiteElo: number,
  blackElo: number,
  result: 'w' | 'b' | 'd',
  kFactor: number = 32
): EloCalculationResult {
  // 1. Tính điểm kỳ vọng thắng (Expected Score từ 0.0 đến 1.0)
  const expectedWhite = 1 / (1 + Math.pow(10, (blackElo - whiteElo) / 400));
  const expectedBlack = 1 - expectedWhite;

  // 2. Điểm số thực tế
  const actualWhite = result === 'w' ? 1 : result === 'd' ? 0.5 : 0;
  const actualBlack = 1 - actualWhite;

  // 3. Tính độ biến thiên điểm số
  const deltaWhite = Math.round(kFactor * (actualWhite - expectedWhite));
  const deltaBlack = -deltaWhite;

  // 4. Giới hạn Elo tối thiểu không âm (tối thiểu 100)
  const newWhiteElo = Math.max(100, whiteElo + deltaWhite);
  const newBlackElo = Math.max(100, blackElo + deltaBlack);

  return {
    white: {
      oldElo: whiteElo,
      newElo: newWhiteElo,
      delta: deltaWhite,
    },
    black: {
      oldElo: blackElo,
      newElo: newBlackElo,
      delta: deltaBlack,
    },
  };
}
