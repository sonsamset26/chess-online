import React, { useState, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import { PlayerColor } from '../hooks/useChessEngine';
import { sounds } from '../utils/soundEffects';

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

  // Âm thanh và Lịch sử nước đi khi FEN thay đổi
  useEffect(() => {
    setMoveFrom(null);
    const history = game.history({ verbose: true });
    if (history.length > 0) {
      const last = history[history.length - 1];
      setLastMove({ from: last.from, to: last.to });

      // Phát Âm thanh tương ứng nước đi
      if (game.inCheck()) {
        sounds.playCheck(); // Âm thanh Chiếu Tướng dồn dập
      } else if (last.captured) {
        sounds.playCapture(); // Âm thanh Ăn quân
      } else {
        sounds.playMove(); // Âm thanh Nước đi thường
      }
    } else {
      setLastMove(null);
    }
  }, [fen, game]);

  // Cập nhật các ô Highlight (Xanh lục/Hồng cho nước đi, Đỏ cho ăn quân, Vàng Đỏ Chiếu Tướng dưới chân Quân Vua)
  useEffect(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // 1. Highlight Nước đi vừa thực hiện (Last Move - Màu Xanh Dương)
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: 'rgba(59, 130, 246, 0.45)' };
      styles[lastMove.to] = { backgroundColor: 'rgba(59, 130, 246, 0.55)' };
    }

    // 2. HIGHLIGHT CẢNH BÁO CHIẾU TƯỚNG DƯỚI CHÂN QUÂN VUA
    if (game.inCheck()) {
      const board = game.board();
      const currentTurnColor = game.turn();
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (piece && piece.type === 'k' && piece.color === currentTurnColor) {
            const kingSquare = (files[c] + ranks[r]) as Square;
            styles[kingSquare] = {
              background: 'radial-gradient(circle, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.75) 50%, rgba(245, 158, 11, 0.6) 100%)',
              boxShadow: 'inset 0 0 15px 4px rgba(239, 68, 68, 0.9), 0 0 25px 8px rgba(245, 158, 11, 0.95)',
              borderRadius: '16%',
              border: '2px solid rgba(245, 158, 11, 0.9)',
            };
          }
        }
      }
    }

    // 3. Highlight khi người chơi chọn một quân cờ
    if (moveFrom) {
      styles[moveFrom] = { backgroundColor: 'rgba(234, 179, 8, 0.45)' };

      const moves = game.moves({ square: moveFrom, verbose: true });
      moves.forEach((move) => {
        const isCapture = !!move.captured;

        if (isCapture) {
          styles[move.to] = {
            backgroundColor: 'rgba(239, 68, 68, 0.65)',
            borderRadius: '50%',
            boxShadow: 'inset 0 0 0 4px rgba(185, 28, 28, 0.9)',
          };
        } else {
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
      } else {
        // Phát âm thanh khi chọn ô mà quân cờ không thể đi tới
        const pieceAtTarget = game.get(square);
        if (!pieceAtTarget || pieceAtTarget.color !== playerColor) {
          sounds.playInvalid();
        }
      }
    }

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
    } else {
      // Phát âm thanh từ chối khi kéo thả vào ô sai luật
      sounds.playInvalid();
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
          customDarkSquareStyle={{ backgroundColor: '#D87093' }}
          customLightSquareStyle={{ backgroundColor: '#FFF0F5' }}
          arePiecesDraggable={!disabled}
        />
      </div>
    </div>
  );
};
