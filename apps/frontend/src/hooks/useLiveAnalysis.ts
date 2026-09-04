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
}

export function useLiveAnalysis(options: UseLiveAnalysisOptions) {
  const { enabled, depth = 8, movetimeMs = 150 } = options;

  const [analysisByPly, setAnalysisByPly] = useState<Record<number, MoveAnalysis>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedPly, setSelectedPly] = useState<number | null>(null);

  const bridgeRef = useRef<StockfishBridge | null>(null);
  const generationRef = useRef<number>(0);
  const sessionCacheRef = useRef<Map<string, { bestMoveUci: string; bestMoveSan: string; evalBest: number }>>(new Map());

  const queueRef = useRef<LiveAnalysisJob[]>([]);
  const isProcessingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

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
      isProcessingRef.current = false;
      sessionCacheRef.current.clear();
      setAnalysisByPly({});
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
        if (currentJob.generation !== generationRef.current) continue;

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
            setAnalysisByPly((prev) => ({
              ...prev,
              [currentJob.ply]: result,
            }));
          }
        } catch (err: any) {
          if (
            err?.name !== 'AbortError' &&
            err?.message !== 'Analysis aborted' &&
            err?.message !== 'Worker terminated' &&
            currentJob.generation === generationRef.current
          ) {
            setAnalysisByPly((prev) => ({
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
            }));
          }
        } finally {
          abortControllerRef.current = null;
        }
      }
    } finally {
      isProcessingRef.current = false;
      setIsAnalyzing(false);
    }
  }, [enabled, depth, movetimeMs]);

  // Đẩy nước đi mới vào hàng đợi phân tích
  const enqueueMove = useCallback(
    (params: {
      ply: number;
      fenBefore: string;
      fenAfter: string;
      moveSan: string;
      playerColor: 'w' | 'b';
    }) => {
      if (!enabled) return;

      if (!bridgeRef.current) {
        bridgeRef.current = new StockfishBridge();
      }

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
    isProcessingRef.current = false;
    sessionCacheRef.current.clear();
    setAnalysisByPly({});
    setIsAnalyzing(false);
    setSelectedPly(null);
  }, []);

  return {
    analysisByPly,
    isAnalyzing,
    selectedPly,
    setSelectedPly,
    enqueueMove,
    resetAnalysis,
  };
}
