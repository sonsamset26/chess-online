import { useState, useEffect, useRef, useCallback } from 'react';
import { Chess, Square } from 'chess.js';

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
        if (bestMove && bestMove !== '(none)' && bestMove.length >= 4) {
          makeAiMove(bestMove);
        }
        // Luôn giải phóng trạng thái isAiThinking khi nhận kết quả từ Worker
        if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
        setIsAiThinking(false);
      }
    };

    return () => {
      workerRef.current?.terminate();
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
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

  // Nước đi của AI với SafeguardTimeout chống kẹt
  const triggerAiMove = useCallback(
    (currentFen: string) => {
      if (workerRef.current) {
        setIsAiThinking(true);
        workerRef.current.postMessage(`position fen ${currentFen}`);
        workerRef.current.postMessage('go');

        // Safeguard Timeout: Tự động hủy trạng thái thinking sau 2000ms nếu worker không phản hồi
        if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = setTimeout(() => {
          setIsAiThinking(false);
        }, 2000);
      }
    },
    []
  );

  // Thực hiện nước đi của AI
  const makeAiMove = (moveStr: string) => {
    try {
      const from = moveStr.substring(0, 2) as Square;
      const to = moveStr.substring(2, 4) as Square;
      const promotion = moveStr.length === 5 ? moveStr[4] : undefined;

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
  const setBoardFen = (newFen: string, history?: string[]) => {
    try {
      gameRef.current.load(newFen);
      setFen(newFen);
      if (history) setMoveHistory(history);
      updateGameStatus(gameRef.current);
    } catch (err) {
      console.error('Invalid FEN:', err);
    }
  };

  // Thực hiện nước đi của Người chơi (Mode đánh với Bot)
  const makePlayerMove = (from: Square, to: Square): boolean => {
    if (isAiThinking || gameRef.current.isGameOver()) return false;
    if (gameRef.current.turn() !== playerColor) return false;

    try {
      const move = gameRef.current.move({ from, to, promotion: 'q' });

      if (move) {
        const newFen = gameRef.current.fen();
        setFen(newFen);
        setMoveHistory(gameRef.current.history());
        updateGameStatus(gameRef.current);

        // Kích hoạt Bot trả đũa mượt mà sau 150ms
        if (
          !gameRef.current.isGameOver() &&
          gameRef.current.turn() !== playerColor
        ) {
          setTimeout(() => triggerAiMove(newFen), 150);
        }
        return true;
      }
    } catch (err) {
      return false;
    }
    return false;
  };

  // Reset Game
  const resetGame = () => {
    if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    gameRef.current.reset();
    setFen(gameRef.current.fen());
    setMoveHistory([]);
    setGameStatus('IN_PROGRESS');
    setIsAiThinking(false);

    if (playerColor === 'b') {
      setTimeout(() => triggerAiMove(gameRef.current.fen()), 150);
    }
  };

  // Đổi bên (Trắng/Đen)
  const togglePlayerColor = () => {
    if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    const newColor = playerColor === 'w' ? 'b' : 'w';
    setPlayerColor(newColor);

    gameRef.current.reset();
    setFen(gameRef.current.fen());
    setMoveHistory([]);
    setGameStatus('IN_PROGRESS');
    setIsAiThinking(false);

    if (newColor === 'b') {
      setTimeout(() => triggerAiMove(gameRef.current.fen()), 150);
    }
  };

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
