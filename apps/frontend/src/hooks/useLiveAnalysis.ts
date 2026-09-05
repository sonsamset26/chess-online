'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { StockfishBridge } from '../services/analysis/StockfishBridge';
import { AnalysisEngine } from '../services/analysis/AnalysisEngine';
import { MoveAnalysis } from '../services/analysis/types';

export interface LiveAnalysisJob {
  ply: number;
  fenBefore: string;
  fenAfter: string;
  moveSan: string;
  playerColor: 'w' | 'b';
  generation: number;
}

export interface UseLiveAnalysisOptions {
  enabled: boolean;
  depth?: number;
  movetimeMs?: number;
  onMoveAnalyzed?: (ply: number, analysis: MoveAnalysis) => void;
}

export function useLiveAnalysis(options: UseLiveAnalysisOptions) {
  const { enabled, depth = 8, movetimeMs = 150, onMoveAnalyzed } = options;

  const [analysisByPly, setAnalysisByPly] = useState<Record<number, MoveAnalysis>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedPly, setSelectedPly] = useState<number | null>(null);

  const bridgeRef = useRef<StockfishBridge | null>(null);
  const generationRef = useRef<number>(0);
  const sessionCacheRef = useRef<Map<string, { bestMoveUci: string; bestMoveSan: string; evalBest: number }>>(new Map());

  const queueRef = useRef<LiveAnalysisJob[]>([]);
  const isProcessingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inFlightPliesRef = useRef<Set<number>>(new Set());

  const onMoveAnalyzedRef = useRef(onMoveAnalyzed);
  useEffect(() => {
    onMoveAnalyzedRef.current = onMoveAnalyzed;
  }, [onMoveAnalyzed]);

  // Khởi tạo và warmup Stockfish Worker sớm ngay khi mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !bridgeRef.current) {
      bridgeRef.current = new StockfishBridge();
    }
    return () => {
      if (bridgeRef.current) {
        bridgeRef.current.terminate();
        bridgeRef.current = null;
      }
    };
  }, []);

  // Quản lý trạng thái phân tích khi enabled thay đổi
  useEffect(() => {
    if (enabled) {
      if (!bridgeRef.current) {
        bridgeRef.current = new StockfishBridge();
      }
      if (queueRef.current.length > 0 && !isProcessingRef.current) {
        processQueue();
      }
    } else {
      // Khi disabled (chuyển mode / replay / tournament): hủy bỏ các tác vụ đang chờ
      generationRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      queueRef.current = [];
      inFlightPliesRef.current.clear();
      isProcessingRef.current = false;
      sessionCacheRef.current.clear();
      // Không xóa analysisByPly ở đây để giữ lại dữ liệu phân tích từng nước khi trận đấu kết thúc hoặc chuyển sang Xem lại (Replay)
      setIsAnalyzing(false);
      setSelectedPly(null);
    }
  }, [enabled]);

  // Vòng lặp xử lý tuần tự toàn bộ hàng đợi phân tích (Đảm bảo 100% nước đi đều được đánh giá)
  const processQueue = useCallback(async () => {
    if (!enabled || !bridgeRef.current || isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsAnalyzing(true);

    try {
      while (queueRef.current.length > 0 && enabled) {
        const currentJob = queueRef.current.shift();
        if (!currentJob) break;

        // Bỏ qua nếu job thuộc thế hệ ván cờ cũ (do game reset)
        if (currentJob.generation !== generationRef.current) {
          inFlightPliesRef.current.delete(currentJob.ply);
          continue;
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          const result = await AnalysisEngine.analyzeSingleMove(
            {
              ply: currentJob.ply,
              fenBefore: currentJob.fenBefore,
              fenAfter: currentJob.fenAfter,
              moveSan: currentJob.moveSan,
              playerColor: currentJob.playerColor,
              depth,
              movetimeMs,
              abortSignal: controller.signal,
            },
            bridgeRef.current,
            sessionCacheRef.current
          );

          if (currentJob.generation === generationRef.current) {
            let shouldEmit = true;
            setAnalysisByPly((prev) => {
              if (prev[currentJob.ply]?.status === 'ANALYZED' && (prev[currentJob.ply] as any)?.isSynced) {
                shouldEmit = false;
                return prev;
              }
              return {
                ...prev,
                [currentJob.ply]: result,
              };
            });
            if (shouldEmit) {
              onMoveAnalyzedRef.current?.(currentJob.ply, result);
            }
          }
        } catch (err: any) {
          if (
            err?.name !== 'AbortError' &&
            err?.message !== 'Analysis aborted' &&
            err?.message !== 'Worker terminated' &&
            currentJob.generation === generationRef.current
          ) {
            setAnalysisByPly((prev) => {
              if (prev[currentJob.ply]?.status === 'ANALYZED') return prev;
              return {
                ...prev,
                [currentJob.ply]: {
                  ply: currentJob.ply,
                  moveNumber: Math.floor((currentJob.ply - 1) / 2) + 1,
                  color: currentJob.playerColor,
                  san: currentJob.moveSan,
                  from: 'a1',
                  to: 'a1',
                  fenBefore: currentJob.fenBefore,
                  fenAfter: currentJob.fenAfter,
                  bestMoveSan: '',
                  bestMoveUci: '',
                  phase: 'OPENING',
                  status: 'FAILED',
                },
              };
            });
          }
        } finally {
          inFlightPliesRef.current.delete(currentJob.ply);
          abortControllerRef.current = null;
        }
      }
    } finally {
      isProcessingRef.current = false;
      setIsAnalyzing(false);
    }
  }, [enabled, depth, movetimeMs]);

  // Đẩy nước đi mới vào hàng đợi phân tích (Chống enqueue trùng lặp triệt để)
  const enqueueMove = useCallback(
    (params: {
      ply: number;
      fenBefore: string;
      fenAfter: string;
      moveSan: string;
      playerColor: 'w' | 'b';
    }) => {
      if (!enabled) return;

      // Không phân tích nếu nước này đang được phân tích hoặc đã có trong hàng đợi
      if (inFlightPliesRef.current.has(params.ply)) return;

      if (!bridgeRef.current) {
        bridgeRef.current = new StockfishBridge();
      }

      inFlightPliesRef.current.add(params.ply);

      const job: LiveAnalysisJob = {
        ...params,
        generation: generationRef.current,
      };

      // 1. Đánh dấu ngay nước này là PENDING trên UI nếu chưa có phân tích
      setAnalysisByPly((prev) => {
        if (prev[job.ply]?.status === 'ANALYZED') return prev;
        return {
          ...prev,
          [job.ply]: {
            ply: job.ply,
            moveNumber: Math.floor((job.ply - 1) / 2) + 1,
            color: job.playerColor,
            san: job.moveSan,
            from: 'a1',
            to: 'a1',
            fenBefore: job.fenBefore,
            fenAfter: job.fenAfter,
            bestMoveSan: '',
            bestMoveUci: '',
            phase: 'OPENING',
            status: 'PENDING',
          },
        };
      });

      // 2. Đưa vào hàng đợi nếu chưa có trong queue
      const alreadyInQueue = queueRef.current.some((q) => q.ply === job.ply && q.generation === job.generation);
      if (!alreadyInQueue) {
        queueRef.current.push(job);
      }

      // 3. Kích hoạt xử lý queue
      if (!isProcessingRef.current) {
        processQueue();
      }
    },
    [enabled, processQueue]
  );

  // Reset toàn bộ phiên phân tích khi bắt đầu ván cờ mới
  const resetAnalysis = useCallback(() => {
    generationRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    queueRef.current = [];
    inFlightPliesRef.current.clear();
    isProcessingRef.current = false;
    sessionCacheRef.current.clear();
    setAnalysisByPly({});
    setIsAnalyzing(false);
    setSelectedPly(null);
  }, []);

  // Nhận bản phân tích chuẩn từ đối thủ qua WebSocket
  const syncRemoteAnalysis = useCallback((ply: number, analysis: MoveAnalysis) => {
    inFlightPliesRef.current.delete(ply);
    queueRef.current = queueRef.current.filter((q) => !(q.ply === ply && q.generation === generationRef.current));
    const taggedAnalysis = { ...analysis, isSynced: true };
    setAnalysisByPly((prev) => ({
      ...prev,
      [ply]: taggedAnalysis,
    }));
  }, []);

  // Khôi phục tất cả các nước đã phân tích khi F5 / Reconnect
  const syncAllRemoteAnalyses = useCallback((analyses: Record<number, MoveAnalysis>) => {
    if (!analyses || Object.keys(analyses).length === 0) return;
    const plies = Object.keys(analyses).map(Number);
    plies.forEach((p) => inFlightPliesRef.current.delete(p));
    queueRef.current = queueRef.current.filter((q) => !(plies.includes(q.ply) && q.generation === generationRef.current));

    const tagged: Record<number, MoveAnalysis> = {};
    for (const [k, v] of Object.entries(analyses)) {
      tagged[Number(k)] = { ...v, isSynced: true };
    }
    setAnalysisByPly((prev) => ({
      ...prev,
      ...tagged,
    }));
  }, []);

  return {
    analysisByPly,
    isAnalyzing,
    selectedPly,
    setSelectedPly,
    enqueueMove,
    resetAnalysis,
    syncRemoteAnalysis,
    syncAllRemoteAnalyses,
  };
}
