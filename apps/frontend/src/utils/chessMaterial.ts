// Tiện ích tính toán quân cờ bị ăn và điểm chênh lệch chất

export interface MaterialDetails {
  whiteCaptured: string[];
  blackCaptured: string[];
  whiteAdvantage: number;
  blackAdvantage: number;
}

const PIECE_SCORES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
};

export function calculateMaterialDetails(fenStr?: string): MaterialDetails {
  const defaultResult: MaterialDetails = {
    whiteCaptured: [],
    blackCaptured: [],
    whiteAdvantage: 0,
    blackAdvantage: 0,
  };

  if (!fenStr) return defaultResult;

  const boardPart = fenStr.split(' ')[0];
  if (!boardPart) return defaultResult;

  const currentCounts: Record<string, number> = {};
  for (const char of boardPart) {
    if (/[a-zA-Z]/.test(char)) {
      currentCounts[char] = (currentCounts[char] || 0) + 1;
    }
  }

  const initialWhite: Record<string, number> = { P: 8, N: 2, B: 2, R: 2, Q: 1 };
  const initialBlack: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };

  // Quân Trắng bị ăn (tức là quân do bên Đen ăn được)
  const whiteLost: string[] = [];
  for (const [piece, count] of Object.entries(initialWhite)) {
    const alive = currentCounts[piece] || 0;
    const eaten = Math.max(0, count - alive);
    for (let i = 0; i < eaten; i++) whiteLost.push(piece);
  }

  // Quân Đen bị ăn (tức là quân do bên Trắng ăn được)
  const blackLost: string[] = [];
  for (const [piece, count] of Object.entries(initialBlack)) {
    const alive = currentCounts[piece] || 0;
    const eaten = Math.max(0, count - alive);
    for (let i = 0; i < eaten; i++) blackLost.push(piece);
  }

  // Tính tổng điểm chất còn lại của mỗi bên trên bàn cờ
  let whiteScore = 0;
  let blackScore = 0;
  for (const [piece, count] of Object.entries(currentCounts)) {
    const lower = piece.toLowerCase();
    const val = PIECE_SCORES[lower] || 0;
    if (piece === piece.toUpperCase()) {
      whiteScore += val * count;
    } else {
      blackScore += val * count;
    }
  }

  const whiteAdvantage = Math.max(0, whiteScore - blackScore);
  const blackAdvantage = Math.max(0, blackScore - whiteScore);

  const sortOrder: Record<string, number> = { p: 1, n: 2, b: 3, r: 4, q: 5, P: 1, N: 2, B: 3, R: 4, Q: 5 };
  blackLost.sort((a, b) => (sortOrder[a] || 0) - (sortOrder[b] || 0));
  whiteLost.sort((a, b) => (sortOrder[a] || 0) - (sortOrder[b] || 0));

  return {
    whiteCaptured: blackLost, // Quân Trắng ăn được = quân Đen bị mất
    blackCaptured: whiteLost, // Quân Đen ăn được = quân Trắng bị mất
    whiteAdvantage,
    blackAdvantage,
  };
}
