import { useState, useRef, useCallback } from 'react';
import { GameAnalysisReport } from '../services/analysis/types';
import { AnalysisEngine } from '../services/analysis/AnalysisEngine';
import { AnalysisCacheService } from '../services/analysis/AnalysisCacheService';
import { EloPlayerResult } from './useSocket';

export function useGameOverFlow(onAnalysisComplete?: () => void) {
  const [tournamentChampionId, setTournamentChampionId] = useState<string | null>(null);
  const [analysisReport, setAnalysisReport] = useState<GameAnalysisReport | null>(null);
  const [isReviewAnalyzing, setIsReviewAnalyzing] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [analysisStatusText, setAnalysisStatusText] = useState<string>('');
  const [customGameOverMsg, setCustomGameOverMsg] = useState<string | undefined>(undefined);
  const [currentEndReason, setCurrentEndReason] = useState<string | undefined>(undefined);
  const [localGameOverStatus, setLocalGameOverStatus] = useState<string | null>(null);
  const [currentMatchEloResult, setCurrentMatchEloResult] = useState<EloPlayerResult | null>(null);
  const [analysisOriginTournamentId, setAnalysisOriginTournamentId] = useState<string | null>(null);

  const analysisAbortControllerRef = useRef<AbortController | null>(null);
  const autoAnalysisAbortRef = useRef<AbortController | null>(null);

  // Tự động kích hoạt phân tích ngầm ngay sau khi ván cờ kết thúc (100% ngầm, KHÔNG bật modal)
  const triggerAutoAnalysis = useCallback(
    async (matchIdOrKey: string, moves: string[], token?: string) => {
      if (!moves || moves.length < 2) return;

      // 1. Kiểm tra nếu đã có trong LocalStorage Cache
      const cached = AnalysisCacheService.getCache(matchIdOrKey, moves);
      if (cached) {
        return;
      }

      // Hủy tiến trình phân tích tự động cũ nếu có
      autoAnalysisAbortRef.current?.abort();
      const controller = new AbortController();
      autoAnalysisAbortRef.current = controller;

      try {
        const report = await AnalysisEngine.analyzeGame(moves, {
          depth: 8, // Depth 8 rất nhanh (2-3s) và độ chính xác phân loại cao
          abortSignal: controller.signal,
        });

        // 2. Lưu vào LocalStorage LRU Cache bền vững (kép theo matchId và chuỗi nước đi)
        AnalysisCacheService.saveCache(matchIdOrKey, report, moves);

        // 3. Đồng bộ dữ liệu tóm tắt siêu nhẹ lên máy chủ MongoDB
        if (matchIdOrKey && !matchIdOrKey.startsWith('game_') && !matchIdOrKey.startsWith('local_')) {
          AnalysisCacheService.syncToBackend(matchIdOrKey, report, token);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.warn('Lỗi tự động phân tích ván cờ ngầm:', err);
        }
      } finally {
        if (autoAnalysisAbortRef.current === controller) {
          autoAnalysisAbortRef.current = null;
        }
      }
    },
    []
  );

  // Khởi chạy phân tích ván đấu với Stockfish Engine (có kiểm tra cache tức thì 0ms)
  const handleStartAnalysis = useCallback(
    async (moves: string[], matchIdOrKey?: string, token?: string) => {
      if (!moves || moves.length === 0) return;

      const cached = AnalysisCacheService.getCache(matchIdOrKey, moves);
      if (cached) {
        setAnalysisReport(cached);
        if (onAnalysisComplete) onAnalysisComplete();
        return;
      }

      try {
        setIsReviewAnalyzing(true);
        setAnalysisProgress(0);
        setAnalysisStatusText('Đang nạp AI Engine Stockfish...');
        const controller = new AbortController();
        analysisAbortControllerRef.current = controller;

        const report = await AnalysisEngine.analyzeGame(moves, {
          abortSignal: controller.signal,
          onProgress: (percent, statusText) => {
            setAnalysisProgress(percent);
            if (statusText) setAnalysisStatusText(statusText);
          },
        });

        AnalysisCacheService.saveCache(matchIdOrKey, report, moves);
        if (matchIdOrKey && !matchIdOrKey.startsWith('game_') && !matchIdOrKey.startsWith('local_')) {
          AnalysisCacheService.syncToBackend(matchIdOrKey, report, token);
        }

        setAnalysisReport(report);
        if (onAnalysisComplete) onAnalysisComplete();
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('Lỗi phân tích ván đấu:', err);
        }
      } finally {
        setIsReviewAnalyzing(false);
        analysisAbortControllerRef.current = null;
      }
    },
    [onAnalysisComplete]
  );

  // Hủy tiến trình phân tích
  const handleAbortAnalysis = useCallback(() => {
    analysisAbortControllerRef.current?.abort();
    setIsReviewAnalyzing(false);
  }, []);

  // Đặt lại các biến trạng thái kết thúc trận
  const resetGameOverState = useCallback(() => {
    setLocalGameOverStatus(null);
    setCustomGameOverMsg(undefined);
    setCurrentEndReason(undefined);
    setCurrentMatchEloResult(null);
  }, []);

  return {
    tournamentChampionId,
    setTournamentChampionId,
    analysisReport,
    setAnalysisReport,
    isReviewAnalyzing,
    setIsReviewAnalyzing,
    analysisProgress,
    setAnalysisProgress,
    analysisStatusText,
    setAnalysisStatusText,
    customGameOverMsg,
    setCustomGameOverMsg,
    currentEndReason,
    setCurrentEndReason,
    localGameOverStatus,
    setLocalGameOverStatus,
    currentMatchEloResult,
    setCurrentMatchEloResult,
    analysisOriginTournamentId,
    setAnalysisOriginTournamentId,
    handleStartAnalysis,
    handleAbortAnalysis,
    triggerAutoAnalysis,
    resetGameOverState,
  };
}
