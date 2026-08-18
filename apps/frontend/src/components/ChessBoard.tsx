import React, { useState, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import { PlayerColor } from '../hooks/useChessEngine';

interface ChessBoardComponentProps {
  game: Chess;
  fen: string;
  playerColor: PlayerColor;
  onPieceDrop: (sourceSquare: Square, targetSquare: Square) => boolean;
  disabled: boolean;
}

export const ChessBoardComponent: React.FC<ChessBoardComponentProps> = ({
  game,
  fen,
  playerColor,
  onPieceDrop,
  disabled,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState<number>(480);

  // States lưu vết ô đang chọn và nước đi cuối cùng
  const [moveFrom, setMoveFrom] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [customSquareStyles, setCustomSquareStyles] = useState<Record<string, React.CSSProperties>>({});

  // Reset highlight khi reset bàn cờ
  useEffect(() => {
    setMoveFrom(null);
    const history = game.history({ verbose: true });
    if (history.length > 0) {
      const last = history[history.length - 1];
      setLastMove({ from: last.from, to: last.to });
    } else {
      setLastMove(null);
    }
  }, [fen, game]);

  // Cập nhật các ô Highlight (Xanh lục cho nước đi, Đỏ cho ăn quân, Xanh dương cho nước đi vừa thực hiện)
  useEffect(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // 1. Highlight Nước đi vừa thực hiện (Last Move - Màu Xanh Dương)
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: 'rgba(59, 130, 246, 0.45)' };
      styles[lastMove.to] = { backgroundColor: 'rgba(59, 130, 246, 0.55)' };
    }

    // 2. Highlight khi người chơi chọn một quân cờ
    if (moveFrom) {
      // Highlight chính ô quân cờ đang chọn (Màu Vàng nhẹ)
      styles[moveFrom] = { backgroundColor: 'rgba(234, 179, 8, 0.45)' };

      // Lấy danh sách các nước đi hợp lệ từ ô đang chọn
      const moves = game.moves({ square: moveFrom, verbose: true });
      moves.forEach((move) => {
        const isCapture = !!move.captured;

        if (isCapture) {
          // Ô có quân địch có thể ăn (Màu Đỏ)
          styles[move.to] = {
            backgroundColor: 'rgba(239, 68, 68, 0.65)',
            borderRadius: '50%',
            boxShadow: 'inset 0 0 0 4px rgba(185, 28, 28, 0.9)',
          };
        } else {
          // Ô trống có thể di chuyển tới (Màu Xanh Lục - Chấm tròn)
          styles[move.to] = {
            background: 'radial-gradient(circle, rgba(34, 197, 94, 0.75) 26%, transparent 27%)',
            borderRadius: '50%',
          };
        }
      });
    }

    setCustomSquareStyles(styles);
  }, [moveFrom, lastMove, fen, game]);

  // Co giãn bàn cờ tự động
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const maxAvailableHeight = window.innerHeight - 150;
        const calculatedSize = Math.min(containerWidth, maxAvailableHeight, 520);
        setBoardWidth(Math.max(280, calculatedSize));
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Xử lý Click vào ô cờ
  const onSquareClick = (square: Square) => {
    if (disabled) return;

    // Nếu đã chọn 1 quân cờ trước đó và click vào ô hợp lệ -> Thực hiện nước đi
    if (moveFrom) {
      const moves = game.moves({ square: moveFrom, verbose: true });
      const foundMove = moves.find((m) => m.to === square);

      if (foundMove) {
        const success = onPieceDrop(moveFrom, square);
        if (success) {
          setLastMove({ from: moveFrom, to: square });
          setMoveFrom(null);
          return;
        }
      }
    }

    // Chọn quân cờ cùng màu với người chơi
    const piece = game.get(square);
    if (piece && piece.color === playerColor) {
      setMoveFrom(square);
    } else {
      setMoveFrom(null);
    }
  };

  // Xử lý Kéo thả quân cờ
  const handlePieceDrop = (sourceSquare: Square, targetSquare: Square) => {
    if (disabled) return false;
    const success = onPieceDrop(sourceSquare, targetSquare);
    if (success) {
      setLastMove({ from: sourceSquare, to: targetSquare });
      setMoveFrom(null);
    }
    return success;
  };

  return (
    <div
      ref={containerRef}
      className="w-full flex items-center justify-center p-0.5 my-auto"
    >
      <div
        style={{ width: `${boardWidth}px`, height: `${boardWidth}px` }}
        className="rounded-lg overflow-hidden shadow-2xl border-[3px] border-[#21201D] bg-[#262421] flex items-center justify-center shrink-0 transition-all duration-200"
      >
        <Chessboard
          position={fen}
          boardWidth={boardWidth - 6}
          onPieceDrop={handlePieceDrop}
          onSquareClick={onSquareClick}
          customSquareStyles={customSquareStyles}
          boardOrientation={playerColor === 'w' ? 'white' : 'black'}
          customBoardStyle={{
            borderRadius: '4px',
          }}
          customDarkSquareStyle={{ backgroundColor: '#769656' }}
          customLightSquareStyle={{ backgroundColor: '#EEEED2' }}
          arePiecesDraggable={!disabled}
        />
      </div>
    </div>
  );
};
