import { GameAnalysisReport, MoveAnalysis, PlayerFeatureVector } from './types';

const CACHE_PREFIX = 'chess_analysis_';
const LRU_KEY = 'chess_analysis_lru_keys';
const MAX_CACHED_GAMES = 50;

export interface AnalysisSummaryPayload {
  whiteAccuracy: number;
  blackAccuracy: number;
  whiteAvgCpl: number;
  blackAvgCpl: number;
  featureVersion?: string;
  whiteFeatures?: PlayerFeatureVector;
  blackFeatures?: PlayerFeatureVector;
  moveClassifications: Array<{
    ply: number;
    san: string;
    classification: string;
    eval?: number;
    bestMoveSan?: string;
  }>;
}

export class AnalysisCacheService {
  /**
   * Tạo khóa băm ổn định từ mảng nước đi
   */
  public static getMovesKey(moves?: string[]): string | null {
    if (!moves || moves.length === 0) return null;
    return `moves_${moves.length}_${moves.join('_')}`;
  }

  /**
   * Lấy báo cáo phân tích từ bộ nhớ đệm LocalStorage (tìm kép theo matchId và chuỗi nước đi)
   */
  public static getCache(matchIdOrKey?: string | null, moves?: string[]): GameAnalysisReport | null {
    if (typeof window === 'undefined') return null;

    // 1. Thử tìm theo matchIdOrKey
    if (matchIdOrKey) {
      try {
        const raw = localStorage.getItem(`${CACHE_PREFIX}${matchIdOrKey}`);
        if (raw) return JSON.parse(raw) as GameAnalysisReport;
      } catch (err) {
        console.warn('Lỗi đọc cache theo matchId:', err);
      }
    }

    // 2. Thử tìm theo chuỗi nước đi
    const movesKey = this.getMovesKey(moves);
    if (movesKey) {
      try {
        const raw = localStorage.getItem(`${CACHE_PREFIX}${movesKey}`);
        if (raw) return JSON.parse(raw) as GameAnalysisReport;
      } catch (err) {
        console.warn('Lỗi đọc cache theo movesKey:', err);
      }
    }

    return null;
  }

  /**
   * Trích xuất phân tích hợp lệ: ưu tiên từ object nếu đã COMPLETED hoặc có dữ liệu, sau đó tìm trong Cache
   */
  public static getValidAnalysis(
    analysis?: any,
    matchIdOrKey?: string | null,
    moves?: string[]
  ): GameAnalysisReport | any | null {
    if (
      analysis &&
      (analysis.status === 'COMPLETED' ||
        Array.isArray(analysis.moves) ||
        Array.isArray(analysis.moveClassifications))
    ) {
      return analysis;
    }
    return this.getCache(matchIdOrKey, moves);
  }

  /**
   * Lưu báo cáo phân tích vào LocalStorage (lưu kép theo cả matchId và movesKey)
   */
  public static saveCache(matchIdOrKey?: string | null, report?: GameAnalysisReport | null, moves?: string[]): void {
    if (typeof window === 'undefined' || !report) return;

    const keysToSave: string[] = [];
    if (matchIdOrKey) keysToSave.push(matchIdOrKey);

    const movesKey = this.getMovesKey(moves || report.moves?.map((m) => m.san));
    if (movesKey && !keysToSave.includes(movesKey)) {
      keysToSave.push(movesKey);
    }

    try {
      const serialized = JSON.stringify(report);
      let lruKeys: string[] = [];
      try {
        const rawLru = localStorage.getItem(LRU_KEY);
        if (rawLru) lruKeys = JSON.parse(rawLru);
      } catch {}

      for (const k of keysToSave) {
        localStorage.setItem(`${CACHE_PREFIX}${k}`, serialized);
        lruKeys = [k, ...lruKeys.filter((item) => item !== k)];
      }

      while (lruKeys.length > MAX_CACHED_GAMES * 2) {
        const oldestKey = lruKeys.pop();
        if (oldestKey) {
          localStorage.removeItem(`${CACHE_PREFIX}${oldestKey}`);
        }
      }

      localStorage.setItem(LRU_KEY, JSON.stringify(lruKeys));
    } catch (err) {
      console.warn('Không thể lưu cache phân tích vào LocalStorage:', err);
    }
  }

  /**
   * Đồng bộ dữ liệu phân tích tóm tắt siêu nhẹ lên máy chủ MongoDB
   */
  public static async syncToBackend(
    matchId: string,
    report: GameAnalysisReport,
    token?: string
  ): Promise<boolean> {
    if (!matchId || !report) return false;

    const payload: AnalysisSummaryPayload = {
      whiteAccuracy: report.summary?.white?.accuracy ?? 0,
      blackAccuracy: report.summary?.black?.accuracy ?? 0,
      whiteAvgCpl: report.summary?.white?.avgCpl ?? 0,
      blackAvgCpl: report.summary?.black?.avgCpl ?? 0,
      featureVersion: 'feature-v1',
      whiteFeatures: report.features?.white,
      blackFeatures: report.features?.black,
      moveClassifications: (report.moves || []).map((m) => ({
        ply: m.ply,
        san: m.san,
        classification: m.classification || 'GOOD',
        eval: m.evalAfter,
        bestMoveSan: m.bestMoveSan,
      })),
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`http://localhost:5000/api/v1/matches/${matchId}/analysis`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      return res.ok;
    } catch (err) {
      console.warn('Lỗi đồng bộ phân tích lên máy chủ:', err);
      return false;
    }
  }

  /**
   * Chuyển đổi dữ liệu phân tích thành Map theo ply để MoveHistory và PlayTab render tức thì
   */
  public static convertToAnalysisByPly(
    reportOrSummary: GameAnalysisReport | any
  ): Record<number, MoveAnalysis> {
    const result: Record<number, MoveAnalysis> = {};
    if (!reportOrSummary) return result;

    if (Array.isArray(reportOrSummary.moves)) {
      for (const m of reportOrSummary.moves) {
        result[m.ply] = {
          ...m,
          status: m.status || 'ANALYZED',
        };
      }
      return result;
    }

    const classifications =
      reportOrSummary.moveClassifications ||
      reportOrSummary.summary?.moveClassifications;

    if (Array.isArray(classifications)) {
      for (const mc of classifications) {
        result[mc.ply] = {
          ply: mc.ply,
          moveNumber: Math.floor((mc.ply - 1) / 2) + 1,
          color: mc.ply % 2 === 1 ? 'w' : 'b',
          san: mc.san,
          from: '' as any,
          to: '' as any,
          fenBefore: '',
          fenAfter: '',
          bestMoveSan: mc.bestMoveSan || '',
          bestMoveUci: '',
          evalAfter: mc.eval,
          classification: mc.classification as any,
          phase: 'MIDDLEGAME',
          status: 'ANALYZED',
        };
      }
      return result;
    }

    return result;
  }
}
