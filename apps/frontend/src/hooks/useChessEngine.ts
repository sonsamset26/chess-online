import { useState, useEffect, useRef, useCallback } from 'react';
import { Chess, Square } from 'chess.js';
import { PromotionPiece } from '../components/PromotionModal';

export type DifficultyLevel = 1 | 2 | 3;
export type PlayerColor = 'w' | 'b';

export function useChessEngine() {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [playerColor, setPlayerColor] = useState<PlayerColor>('w');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(2);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [gameStatus, setGameStatus] = useState<string>('IN_PROGRESS');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const aiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingBotMoveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const aiThinkingStartTimeRef = useRef<number>(0);
  const generationRef = useRef<number>(0);

  // Khởi tạo Web Worker Engine
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/stockfish.worker.ts', import.meta.url)
    );

    workerRef.current.postMessage('uci');
    workerRef.current.postMessage('isready');

    workerRef.current.onmessage = (event: MessageEvent) => {
      const message = event.data;
      if (typeof message === 'string' && message.startsWith('bestmove')) {
        const bestMove = message.split(' ')[1];
        if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);

        if (bestMove && bestMove !== '(none)' && bestMove.length >= 4) {
          const engineElapsedTime = Date.now() - aiThinkingStartTimeRef.current;
          const MIN_BOT_RESPONSE_MS = 400;
          const additionalDelay = Math.max(0, MIN_BOT_RESPONSE_MS - engineElapsedTime);
          const currentGen = generationRef.current;

          if (pendingBotMoveTimerRef.current) clearTimeout(pendingBotMoveTimerRef.current);

          pendingBotMoveTimerRef.current = setTimeout(() => {
            // Race condition guard: Đảm bảo ván cờ không bị reset hoặc chuyển ván mới
            if (currentGen !== generationRef.current) return;
            if (gameRef.current.isGameOver()) {
              setIsAiThinking(false);
              return;
            }

            makeAiMove(bestMove);
            setIsAiThinking(false);
          }, additionalDelay);
        } else {
          setIsAiThinking(false);
        }
      }
    };

    return () => {
      generationRef.current++;
      if (pendingBotMoveTimerRef.current) clearTimeout(pendingBotMoveTimerRef.current);
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
      workerRef.current?.terminate();
    };
  }, []);

  // Cập nhật cấp độ AI Stockfish
  useEffect(() => {
    if (workerRef.current) {
      const skillLevel = difficulty === 1 ? 6 : difficulty === 2 ? 16 : 20;
      workerRef.current.postMessage(
        `setoption name Skill Level value ${skillLevel}`
      );
    }
  }, [difficulty]);

  // Cập nhật trạng thái game sau mỗi nước đi
  const updateGameStatus = (g: Chess) => {
    if (g.isCheckmate()) {
      setGameStatus(g.turn() === 'w' ? 'BLACK_WIN' : 'WHITE_WIN');
    } else if (g.isDraw() || g.isStalemate() || g.isThreefoldRepetition()) {
      setGameStatus('DRAW');
    } else {
      setGameStatus('IN_PROGRESS');
    }
  };

  // Nước đi của AI với SafeguardTimeout
  const triggerAiMove = useCallback(
    (currentFen: string) => {
      if (workerRef.current) {
        setIsAiThinking(true);
        aiThinkingStartTimeRef.current = Date.now();
        workerRef.current.postMessage(`position fen ${currentFen}`);
        workerRef.current.postMessage('go');

        if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = setTimeout(() => {
          setIsAiThinking(false);
        }, 5000);
      }
    },
    []
  );

  // Thực hiện nước đi của AI
  const makeAiMove = (moveStr: string) => {
    try {
      const from = moveStr.substring(0, 2) as Square;
      const to = moveStr.substring(2, 4) as Square;
      const promotion = moveStr.length === 5 ? (moveStr[4] as PromotionPiece) : undefined;

      const move = gameRef.current.move({ from, to, promotion });
      if (move) {
        setFen(gameRef.current.fen());
        setMoveHistory(gameRef.current.history());
        updateGameStatus(gameRef.current);
      }
    } catch (err) {
      console.error('AI Move Error:', err);
    }
  };

  // Nạp FEN từ CSDL hoặc WebSocket Realtime
  const setBoardFen = useCallback((newFen: string, history?: string[]) => {
    try {
      generationRef.current++;
      workerRef.current?.postMessage('stop');
      if (pendingBotMoveTimerRef.current) {
        clearTimeout(pendingBotMoveTimerRef.current);
        pendingBotMoveTimerRef.current = null;
      }
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
      setIsAiThinking(false);

      if (history && history.length > 0) {
        // Tái tạo lại lịch sử nước đi đầy đủ để chess.js giữ nguyên history verbose (phục vụ phát âm thanh và highlight)
        gameRef.current.reset();
        for (const san of history) {
          try {
            gameRef.current.move(san);
          } catch {
            break;
          }
        }
        if (gameRef.current.fen() !== newFen) {
          gameRef.current.load(newFen);
        }
      } else {
        gameRef.current.load(newFen);
      }

      setFen(newFen);
      if (history) setMoveHistory(history);
      updateGameStatus(gameRef.current);
    } catch (err) {
      console.error('Invalid FEN:', err);
    }
  }, []);

  // Khôi phục thế cờ từ localStorage khi khởi tạo trên Client (giải quyết F5 khi đấu với Máy)
  const isBotGameRestoredRef = useRef(false);
  useEffect(() => {
    if (isBotGameRestoredRef.current || typeof window === 'undefined') return;
    isBotGameRestoredRef.current = true;

    try {
      const savedMode = localStorage.getItem('chess_active_mode');
      const savedMatch = localStorage.getItem('chess_active_online_match');
      if (savedMode === 'bots' && !savedMatch) {
        const savedBotGame = localStorage.getItem('chess_bot_game');
        if (savedBotGame) {
          const { fen: savedFen, moveHistory: savedHistory, playerColor: savedColor, difficulty: savedDiff } = JSON.parse(savedBotGame);
          if (savedColor) setPlayerColor(savedColor);
          if (savedDiff) setDifficulty(savedDiff);
          if (savedFen) {
            setBoardFen(savedFen, savedHistory || []);

            // Nếu đến lượt Bot đi cờ, kích hoạt Bot tiếp tục tính toán
            try {
              const testGame = new Chess(savedFen);
              if (!testGame.isGameOver() && testGame.turn() !== (savedColor || 'w')) {
                setTimeout(() => triggerAiMove(savedFen), 400);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error('Lỗi khôi phục bot game trong useChessEngine:', err);
    }
  }, [setBoardFen, triggerAiMove]);

  // Tự động lưu thế cờ Bot vào localStorage mỗi khi có nước đi mới (chỉ chạy SAU khi đã hoàn tất restore)
  useEffect(() => {
    if (!isBotGameRestoredRef.current || typeof window === 'undefined') return;

    try {
      const savedMode = localStorage.getItem('chess_active_mode');
      const savedMatch = localStorage.getItem('chess_active_online_match');
      if (savedMode === 'bots' && !savedMatch) {
        if (moveHistory.length > 0 || fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' || playerColor === 'b') {
          localStorage.setItem(
            'chess_bot_game',
            JSON.stringify({
              fen,
              moveHistory,
              playerColor,
              difficulty,
            })
          );
        }
      }
    } catch (e) {
      console.error('Failed to auto-save bot game:', e);
    }
  }, [fen, moveHistory, playerColor, difficulty]);

  // Thực hiện nước đi của Người chơi (Hỗ trợ chọn quân Phong cấp)
  const makePlayerMove = useCallback((from: Square, to: Square, promotion: PromotionPiece = 'q'): boolean => {
    if (isAiThinking || gameRef.current.isGameOver()) return false;
    if (gameRef.current.turn() !== playerColor) return false;

    try {
      const move = gameRef.current.move({ from, to, promotion });

      if (move) {
        const newFen = gameRef.current.fen();
        setFen(newFen);
        setMoveHistory(gameRef.current.history());
        updateGameStatus(gameRef.current);

        if (
          !gameRef.current.isGameOver() &&
          gameRef.current.turn() !== playerColor
        ) {
          triggerAiMove(newFen);
        }
        return true;
      }
    } catch (err) {
      return false;
    }
    return false;
  }, [isAiThinking, playerColor, triggerAiMove]);

  // Reset Game
  const resetGame = useCallback((options?: { autoTriggerAi?: boolean }) => {
    generationRef.current++;
    workerRef.current?.postMessage('stop');
    if (pendingBotMoveTimerRef.current) {
      clearTimeout(pendingBotMoveTimerRef.current);
      pendingBotMoveTimerRef.current = null;
    }
    if (aiTimeoutRef.current) {
      clearTimeout(aiTimeoutRef.current);
      aiTimeoutRef.current = null;
    }
    gameRef.current.reset();
    setFen(gameRef.current.fen());
    setMoveHistory([]);
    setGameStatus('IN_PROGRESS');
    setIsAiThinking(false);

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('chess_bot_game');
      } catch {}
    }

    if (options?.autoTriggerAi && playerColor === 'b') {
      triggerAiMove(gameRef.current.fen());
    }
  }, [playerColor, triggerAiMove]);

  // Đổi bên (Trắng/Đen)
  const togglePlayerColor = useCallback(() => {
    generationRef.current++;
    workerRef.current?.postMessage('stop');
    if (pendingBotMoveTimerRef.current) {
      clearTimeout(pendingBotMoveTimerRef.current);
      pendingBotMoveTimerRef.current = null;
    }
    if (aiTimeoutRef.current) {
      clearTimeout(aiTimeoutRef.current);
      aiTimeoutRef.current = null;
    }
    const newColor = playerColor === 'w' ? 'b' : 'w';
    setPlayerColor(newColor);

    gameRef.current.reset();
    setFen(gameRef.current.fen());
    setMoveHistory([]);
    setGameStatus('IN_PROGRESS');
    setIsAiThinking(false);

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('chess_bot_game');
      } catch {}
    }

    if (newColor === 'b') {
      triggerAiMove(gameRef.current.fen());
    }
  }, [playerColor, triggerAiMove]);

  return {
    game: gameRef.current,
    fen,
    playerColor,
    difficulty,
    isAiThinking,
    gameStatus,
    moveHistory,
    setDifficulty,
    setPlayerColor,
    setBoardFen,
    makePlayerMove,
    resetGame,
    togglePlayerColor,
  };
}
