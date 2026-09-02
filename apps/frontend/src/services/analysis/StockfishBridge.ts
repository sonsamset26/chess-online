/**
 * StockfishBridge - Quản lý giao tiếp UCI với Stockfish Worker
 */

export interface StockfishEvalResult {
  bestMoveUci: string;
  evalBest: number; // Centipawn (hoặc mapped mate score) theo góc nhìn bên đang đi
}

export class StockfishBridge {
  private worker: Worker | null = null;
  private isReady: boolean = false;
  private readyPromise: Promise<void> | null = null;

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
   * Đánh giá 1 thế cờ FEN ở độ sâu depth bằng Stockfish
   */
  public async evaluateFen(
    fen: string,
    depth: number = 10,
    abortSignal?: AbortSignal
  ): Promise<StockfishEvalResult> {
    if (!this.worker) {
      throw new Error('Stockfish Worker không khả dụng');
    }

    if (this.readyPromise) {
      await this.readyPromise;
    }

    if (abortSignal?.aborted) {
      throw new Error('Analysis aborted');
    }

    const worker = this.worker;

    return new Promise<StockfishEvalResult>((resolve, reject) => {
      let currentCp = 0;
      let currentMate: number | null = null;
      let bestMoveUci = '';

      const onAbort = () => {
        cleanup();
        worker.postMessage('stop');
        reject(new Error('Analysis aborted'));
      };

      const messageHandler = (e: MessageEvent) => {
        const line = typeof e.data === 'string' ? e.data : '';

        // Bắt điểm mate: info ... score mate (-?\d+)
        const mateMatch = line.match(/score mate (-?\d+)/);
        if (mateMatch) {
          currentMate = parseInt(mateMatch[1], 10);
        } else {
          // Bắt điểm centipawn: info ... score cp (-?\d+)
          const cpMatch = line.match(/score cp (-?\d+)/);
          if (cpMatch) {
            currentCp = parseInt(cpMatch[1], 10);
            currentMate = null;
          }
        }

        // Bắt bestmove: bestmove <move>
        const bestMoveMatch = line.match(/^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
        if (bestMoveMatch) {
          bestMoveUci = bestMoveMatch[1];
          cleanup();

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

      const cleanup = () => {
        worker.removeEventListener('message', messageHandler);
        if (abortSignal) {
          abortSignal.removeEventListener('abort', onAbort);
        }
      };

      if (abortSignal) {
        abortSignal.addEventListener('abort', onAbort);
      }

      worker.addEventListener('message', messageHandler);
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${depth}`);
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
