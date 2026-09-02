/**
 * StockfishBridge - Quản lý giao tiếp UCI với Stockfish Worker
 */

export interface StockfishEvalResult {
  bestMoveUci: string;
  evalBest: number; // Centipawn (hoặc mapped mate score) theo góc nhìn bên đang đi
}

export interface EvaluateFenOptions {
  depth?: number;
  movetimeMs?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

export class StockfishBridge {
  private worker: Worker | null = null;
  private isReady: boolean = false;
  private readyPromise: Promise<void> | null = null;
  private activeQueue: Promise<any> = Promise.resolve();

  constructor() {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        // Tải trực tiếp từ public/stockfish/stockfish.js để tránh lỗi bundler Next.js 14
        this.worker = new Worker('/stockfish/stockfish.js');
        this.readyPromise = this.initEngine();
      } catch (err) {
        console.warn('StockfishBridge: Không thể tạo Web Worker Stockfish:', err);
        this.worker = null;
      }
    }
  }

  public isAvailable(): boolean {
    return this.worker !== null;
  }

  private initEngine(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.worker) {
        resolve();
        return;
      }

      const handler = (e: MessageEvent) => {
        const line = typeof e.data === 'string' ? e.data : '';
        if (line.includes('uciok') || line.includes('readyok')) {
          this.isReady = true;
          this.worker?.removeEventListener('message', handler);
          resolve();
        }
      };

      this.worker.addEventListener('message', handler);
      this.worker.postMessage('uci');
      this.worker.postMessage('isready');

      // Timeout dự phòng 3 giây
      setTimeout(() => {
        this.isReady = true;
        this.worker?.removeEventListener('message', handler);
        resolve();
      }, 3000);
    });
  }

  /**
   * Đánh giá 1 thế cờ FEN bằng Stockfish với hàng đợi tuần tự (Mutex Queue)
   * Tương thích cả cú pháp cũ (fen, depth, abortSignal) và cú pháp mới (fen, options)
   */
  public async evaluateFen(
    fen: string,
    optionsOrDepth: number | EvaluateFenOptions = 10,
    legacyAbortSignal?: AbortSignal
  ): Promise<StockfishEvalResult> {
    const opts: EvaluateFenOptions =
      typeof optionsOrDepth === 'number'
        ? { depth: optionsOrDepth, abortSignal: legacyAbortSignal }
        : optionsOrDepth;

    return new Promise<StockfishEvalResult>((resolve, reject) => {
      this.activeQueue = this.activeQueue
        .catch(() => {})
        .then(() => this.executeEvaluateFen(fen, opts))
        .then(resolve, reject);
    });
  }

  /**
   * Thực thi đánh giá đơn lẻ bên trong hàng đợi tuần tự
   */
  private async executeEvaluateFen(
    fen: string,
    opts: EvaluateFenOptions
  ): Promise<StockfishEvalResult> {
    if (!this.worker) {
      throw new Error('Stockfish Worker không khả dụng');
    }

    if (this.readyPromise) {
      await this.readyPromise;
    }

    const { depth = 10, movetimeMs, timeoutMs = 5000, abortSignal } = opts;

    if (abortSignal?.aborted) {
      throw new Error('Analysis aborted');
    }

    const worker = this.worker;

    return new Promise<StockfishEvalResult>((resolve, reject) => {
      let currentCp = 0;
      let currentMate: number | null = null;
      let bestMoveUci = '';
      let isCompleted = false;

      const cleanup = () => {
        if (isCompleted) return;
        isCompleted = true;
        clearTimeout(safetyTimer);
        worker.removeEventListener('message', messageHandler);
        if (abortSignal) {
          abortSignal.removeEventListener('abort', onAbort);
        }
      };

      const safetyTimer = setTimeout(() => {
        cleanup();
        try {
          worker.postMessage('stop');
        } catch (e) {
          // ignore
        }
        reject(new Error('Evaluation timeout'));
      }, timeoutMs);

      const onAbort = () => {
        cleanup();
        try {
          worker.postMessage('stop');
        } catch (e) {
          // ignore
        }
        reject(new Error('Analysis aborted'));
      };

      const messageHandler = (e: MessageEvent) => {
        const line = typeof e.data === 'string' ? e.data : '';

        // Bắt điểm mate: info ... score mate (-?\d+)
        const mateMatch = line.match(/score mate (-?\d+)/);
        if (mateMatch) {
          currentMate = parseInt(mateMatch[1], 10);
        } else {
          // Bắt điểm centipawn chính xác (bỏ qua upperbound / lowerbound tạm thời)
          const cpMatch = line.match(/score cp (-?\d+)/);
          if (cpMatch && !line.includes('upperbound') && !line.includes('lowerbound')) {
            currentCp = parseInt(cpMatch[1], 10);
            currentMate = null;
          }
        }

        // Bắt bestmove: hỗ trợ cả bestmove thường và bestmove (none) / 0000 khi hết ván
        const bestMoveMatch = line.match(/^bestmove\s+(\(none\)|0000|[a-h][1-8][a-h][1-8][qrbn]?)/m);
        if (bestMoveMatch) {
          const rawMove = bestMoveMatch[1];
          cleanup();

          if (rawMove === '(none)' || rawMove === '0000') {
            bestMoveUci = '(none)';
            let evalBest = currentCp;
            if (currentMate !== null) {
              evalBest = Math.sign(currentMate) * (10000 - Math.min(Math.abs(currentMate), 50) * 10);
            }
            resolve({
              bestMoveUci,
              evalBest,
            });
            return;
          }

          bestMoveUci = rawMove;
          let evalBest = currentCp;
          if (currentMate !== null) {
            evalBest = Math.sign(currentMate) * (10000 - Math.min(Math.abs(currentMate), 50) * 10);
          }

          resolve({
            bestMoveUci,
            evalBest,
          });
        }
      };

      if (abortSignal) {
        abortSignal.addEventListener('abort', onAbort);
      }

      worker.addEventListener('message', messageHandler);
      worker.postMessage(`position fen ${fen}`);
      if (movetimeMs && movetimeMs > 0) {
        worker.postMessage(`go depth ${depth} movetime ${movetimeMs}`);
      } else {
        worker.postMessage(`go depth ${depth}`);
      }
    });
  }

  /**
   * Dọn dẹp và giải phóng tài nguyên Worker
   */
  public terminate(): void {
    if (this.worker) {
      try {
        this.worker.postMessage('quit');
        this.worker.terminate();
      } catch (e) {
        // ignore
      }
      this.worker = null;
      this.isReady = false;
    }
  }
}
