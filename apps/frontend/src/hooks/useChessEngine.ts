import { useState, useEffect, useRef, useCallback } from 'react';
import { Chess, Square } from 'chess.js';

export type DifficultyLevel = 1 | 2 | 3;
export type PlayerColor = 'w' | 'b';

export function useChessEngine() {
  // Dùng useRef để giữ nguyên 1 instance Chess duy nhất (không bị mất lịch sử nước đi)
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [playerColor, setPlayerColor] = useState<PlayerColor>('w');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(2);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [gameStatus, setGameStatus] = useState<string>('IN_PROGRESS');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const workerRef = useRef<Worker | null>(null);

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
        if (bestMove && bestMove !== '(none)') {
          makeAiMove(bestMove);
        }
        setIsAiThinking(false);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Cập nhật cấp độ AI
  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.postMessage(
        `setoption name Skill Level value ${difficulty}`
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

  // Nước đi của AI
  const triggerAiMove = useCallback(
    (currentFen: string) => {
      if (workerRef.current && !isAiThinking) {
        setIsAiThinking(true);
        workerRef.current.postMessage(`position fen ${currentFen}`);
        workerRef.current.postMessage('go depth 4');
      }
    },
    [isAiThinking]
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
        setMoveHistory(gameRef.current.history()); // Lưu tích lũy toàn bộ mảng nước đi
        updateGameStatus(gameRef.current);
      }
    } catch (err) {
      console.error('AI Move Error:', err);
    }
  };

  // Thực hiện nước đi của Người chơi
  const makePlayerMove = (from: Square, to: Square): boolean => {
    if (isAiThinking || gameRef.current.isGameOver()) return false;

    // Kiểm tra đúng lượt chơi của Người
    if (gameRef.current.turn() !== playerColor) return false;

    try {
      const move = gameRef.current.move({ from, to, promotion: 'q' });

      if (move) {
        const newFen = gameRef.current.fen();
        setFen(newFen);
        setMoveHistory(gameRef.current.history()); // Tích lũy toàn bộ nước đi
        updateGameStatus(gameRef.current);

        // Nếu game chưa kết thúc và đến lượt AI -> Gọi AI tính toán
        if (
          !gameRef.current.isGameOver() &&
          gameRef.current.turn() !== playerColor
        ) {
          setTimeout(() => triggerAiMove(newFen), 200);
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
    gameRef.current.reset();
    setFen(gameRef.current.fen());
    setMoveHistory([]);
    setGameStatus('IN_PROGRESS');
    setIsAiThinking(false);

    if (playerColor === 'b') {
      setTimeout(() => triggerAiMove(gameRef.current.fen()), 200);
    }
  };

  // Đổi bên (Trắng/Đen)
  const togglePlayerColor = () => {
    const newColor = playerColor === 'w' ? 'b' : 'w';
    setPlayerColor(newColor);

    gameRef.current.reset();
    setFen(gameRef.current.fen());
    setMoveHistory([]);
    setGameStatus('IN_PROGRESS');
    setIsAiThinking(false);

    if (newColor === 'b') {
      setTimeout(() => triggerAiMove(gameRef.current.fen()), 200);
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
    makePlayerMove,
    resetGame,
    togglePlayerColor,
  };
}
