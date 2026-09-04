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
  isBacklog?: boolean;
}

export interface UseLiveAnalysisOptions {
  enabled: boolean;
  depth?: number;
  movetimeMs?: number;
}

export function useLiveAnalysis(options: UseLiveAnalysisOptions) {
  const { enabled, depth = 8, movetimeMs = 200 } = options;

  const [analysisByPly, setAnalysisByPly] = useState<Record<number, MoveAnalysis>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedPly, setSelectedPly] = useState<number | null>(null);

  const bridgeRef = useRef<StockfishBridge | null>(null);
  const generationRef = useRef<number>(0);
  const sessionCacheRef = useRef<Map<string, { bestMoveUci: string; bestMoveSan: string; evalBest: number }>>(new Map());

  const currentJobRef = useRef<LiveAnalysisJob | null>(null);
  const pendingJobRef = useRef<LiveAnalysisJob | null>(null);
  const backlogRef = useRef<LiveAnalysisJob[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Khởi tạo hoặc giải phóng StockfishBridge theo trạng thái enabled
  useEffect(() => {
    if (enabled) {
      if (!bridgeRef.current) {
        bridgeRef.current = new StockfishBridge();
      }
    } else {
      // Khi disabled (chuyển mode / replay / tournament): hủy bỏ mọi tác vụ
      generationRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      currentJobRef.current = null;
      pendingJobRef.current = null;
      backlogRef.current = [];
      sessionCacheRef.current.clear();
      setAnalysisByPly({});
      setIsAnalyzing(false);
      setSelectedPly(null);
      if (bridgeRef.current) {
        bridgeRef.current.terminate();
        bridgeRef.current = null;
      }
    }

    return () => {
      if (bridgeRef.current) {
        bridgeRef.current.terminate();
        bridgeRef.current = null;
      }
    };
  }, [enabled]);

  // Xử lý tuần tự hàng đợi Coalescing Queue: CURRENT + LATEST PENDING + OPPORTUNISTIC BACKLOG
  const processNextJob = useCallback(async () => {
    if (!enabled || !bridgeRef.current) return;

    // Lấy job: ưu tiên pending (nước mới nhất), nếu không có pending thì lấy từ backlog (nước bị STALE)
    let nextJob = pendingJobRef.current;
    if (nextJob) {
      pendingJobRef.current = null;
    } else if (backlogRef.current.length > 0) {
      nextJob = backlogRef.current.pop() || null;
      if (nextJob) {
        nextJob.isBacklog = true;
      }
    }

    if (!nextJob) {
      currentJobRef.current = null;
      setIsAnalyzing(false);
      return;
    }

    currentJobRef.current = nextJob;
    setIsAnalyzing(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await AnalysisEngine.analyzeSingleMove(
        {
          ply: nextJob.ply,
          fenBefore: nextJob.fenBefore,
          fenAfter: nextJob.fenAfter,
          moveSan: nextJob.moveSan,
          playerColor: nextJob.playerColor,
          depth,
          movetimeMs,
          abortSignal: controller.signal,
        },
        bridgeRef.current,
        sessionCacheRef.current
      );

      // Invariant B: Kiểm tra thế hệ generation chống Zombie Worker Task
      if (nextJob.generation === generationRef.current) {
        setAnalysisByPly((prev) => ({
          ...prev,
          [nextJob.ply]: result,
        }));
      }
    } catch (err: any) {
      if (
        err?.name !== 'AbortError' &&
        err?.message !== 'Analysis aborted' &&
        err?.message !== 'Worker terminated' &&
        nextJob.generation === generationRef.current
      ) {
        setAnalysisByPly((prev) => ({
          ...prev,
          [nextJob.ply]: {
            ply: nextJob.ply,
            moveNumber: Math.floor((nextJob.ply - 1) / 2) + 1,
            color: nextJob.playerColor,
            san: nextJob.moveSan,
            from: 'a1',
            to: 'a1',
            fenBefore: nextJob.fenBefore,
            fenAfter: nextJob.fenAfter,
            bestMoveSan: '',
            bestMoveUci: '',
            phase: 'OPENING',
            status: 'FAILED',
          },
        }));
      }
    } finally {
      abortControllerRef.current = null;
      currentJobRef.current = null;

      // Nếu có job mới vào pending hoặc còn job trong backlog -> tiếp tục phân tích
      if (pendingJobRef.current || backlogRef.current.length > 0) {
        processNextJob();
      } else {
        setIsAnalyzing(false);
      }
    }
  }, [enabled, depth, movetimeMs]);

  // Đẩy nước đi mới vào hàng đợi Coalescing Queue
  const enqueueMove = useCallback(
    (params: {
      ply: number;
      fenBefore: string;
      fenAfter: string;
      moveSan: string;
      playerColor: 'w' | 'b';
    }) => {
      if (!enabled) return;

      const job: LiveAnalysisJob = {
        ...params,
        generation: generationRef.current,
      };

      // 1. Đánh dấu ngay nước này là PENDING trên UI
      setAnalysisByPly((prev) => ({
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
      }));

      // 2. Quản lý Coalescing Queue:
      // Nếu worker đang rảnh -> chạy ngay
      if (!currentJobRef.current) {
        pendingJobRef.current = job;
        processNextJob();
      } else {
        // Nếu worker đang bận:
        // Nếu job hiện tại đang chạy là backlog job (nước cũ nhặt lại) -> abort ngay để nhường slot cho nước mới
        if (currentJobRef.current.isBacklog) {
          abortControllerRef.current?.abort();
        }

        // Nếu đã có 1 job đang chờ trong pending -> job đó trở thành STALE và đẩy vào backlog
        if (pendingJobRef.current) {
          const staleJob = pendingJobRef.current;
          backlogRef.current.push(staleJob);
          if (backlogRef.current.length > 10) {
            backlogRef.current.shift();
          }

          setAnalysisByPly((prev) => {
            const currentItem = prev[staleJob.ply];
            if (currentItem && currentItem.status === 'PENDING') {
              return {
                ...prev,
                [staleJob.ply]: {
                  ...currentItem,
                  status: 'STALE',
                },
              };
            }
            return prev;
          });
        }
        // Thay thế bằng job mới nhất
        pendingJobRef.current = job;
      }
    },
    [enabled, processNextJob]
  );

  // Reset toàn bộ phiên phân tích khi bắt đầu ván cờ mới
  const resetAnalysis = useCallback(() => {
    generationRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    currentJobRef.current = null;
    pendingJobRef.current = null;
    backlogRef.current = [];
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
