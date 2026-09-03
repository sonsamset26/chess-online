import React, { useState, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import { PlayerColor } from '../hooks/useChessEngine';
import { sounds } from '../utils/soundEffects';
import { PromotionModal, PromotionPiece } from './PromotionModal';

interface ChessBoardComponentProps {
  game: Chess;
  fen: string;
  playerColor: PlayerColor;
  onPieceDrop: (sourceSquare: Square, targetSquare: Square, promotion?: PromotionPiece) => boolean;
  disabled: boolean;
  muted?: boolean;
}

export const ChessBoardComponent: React.FC<ChessBoardComponentProps> = ({
  game,
  fen,
  playerColor,
  onPieceDrop,
  disabled,
  muted = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState<number>(340);

  // States lưu vết ô đang chọn và nước đi cuối cùng
  const [moveFrom, setMoveFrom] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [customSquareStyles, setCustomSquareStyles] = useState<Record<string, React.CSSProperties>>({});

  // State chờ Phong Tốt (Pending Pawn Promotion)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);

  // Âm thanh và Lịch sử nước đi khi FEN thay đổi
  useEffect(() => {
    setMoveFrom(null);
    const history = game.history({ verbose: true });
    if (history.length > 0) {
      const last = history[history.length - 1];
      setLastMove({ from: last.from, to: last.to });

      // Phát Âm thanh tương ứng nước đi nếu không bị tắt tiếng
      if (!muted) {
        if (game.inCheck()) {
          sounds.playCheck();
        } else if (last.captured) {
          sounds.playCapture();
        } else {
          sounds.playMove();
        }
      }
    } else {
      setLastMove(null);
    }
  }, [fen, game, muted]);

  // Cập nhật các ô Highlight
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

  // Tính toán kích thước bàn cờ chuẩn mực Responsive 100% (Mobile 360-412px, Tablet 768px, Desktop >1024px)
  useEffect(() => {
    const updateSize = () => {
      if (typeof window !== 'undefined') {
        const isMobile = window.innerWidth < 768;
        const availableWidth = window.innerWidth - (isMobile ? 20 : 48);
        const availableHeight = window.innerHeight - (isMobile ? 220 : 160);
        const calculated = Math.min(availableWidth, availableHeight, 480);
        setBoardWidth(Math.max(260, Math.floor(calculated)));
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    window.addEventListener('orientationchange', updateSize);
    return () => {
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
    };
  }, []);

  // Kiểm tra nước đi có phải là Phong Cấp Cho Tốt hay không
  const checkIsPromotion = (from: Square, to: Square): boolean => {
    const piece = game.get(from);
    if (!piece || piece.type !== 'p' || piece.color !== playerColor) return false;
    const isTargetPromotionRank = (playerColor === 'w' && to[1] === '8') || (playerColor === 'b' && to[1] === '1');
    if (!isTargetPromotionRank) return false;

    // Kiểm tra tính hợp lệ của nước đi
    const testGame = new Chess(game.fen());
    try {
      const valid = testGame.move({ from, to, promotion: 'q' });
      return !!valid;
    } catch {
      return false;
    }
  };

  // Xử lý Click vào ô cờ
  const onSquareClick = (square: Square) => {
    if (disabled || pendingPromotion) return;

    if (moveFrom) {
      // 1. Kiểm tra nếu là Nước Phong Cấp -> Bật Modal chọn quân
      if (checkIsPromotion(moveFrom, square)) {
        setPendingPromotion({ from: moveFrom, to: square });
        setMoveFrom(null);
        return;
      }

      // 2. Nước đi thường
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
    if (disabled || pendingPromotion) return false;

    // 1. Kiểm tra nếu là Nước Phong Cấp -> Mở Modal chọn quân
    if (checkIsPromotion(sourceSquare, targetSquare)) {
      setPendingPromotion({ from: sourceSquare, to: targetSquare });
      return false;
    }

    // 2. Nước đi thường
    const success = onPieceDrop(sourceSquare, targetSquare);
    if (success) {
      setLastMove({ from: sourceSquare, to: targetSquare });
      setMoveFrom(null);
    } else {
      sounds.playInvalid();
    }
    return success;
  };

  // Xử lý khi người chơi chọn xong 1 trong 4 quân phong cấp (Hậu, Xe, Tượng, Mã)
  const handlePromotionSelect = (piece: PromotionPiece) => {
    if (pendingPromotion) {
      const { from, to } = pendingPromotion;
      const success = onPieceDrop(from, to, piece);
      if (success) {
        setLastMove({ from, to });
      }
      setPendingPromotion(null);
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full flex items-center justify-center p-0.5 my-auto relative select-none touch-none"
      style={{ touchAction: 'none' }}
    >
      <div
        style={{ width: `${boardWidth}px`, height: `${boardWidth}px` }}
        className="rounded-xl overflow-hidden shadow-2xl border-[3px] border-[#1E293B] bg-[#16202E] flex items-center justify-center shrink-0 transition-all duration-200"
      >
        <Chessboard
          position={fen}
          boardWidth={boardWidth - 6}
          onPieceDrop={handlePieceDrop}
          onSquareClick={onSquareClick}
          customSquareStyles={customSquareStyles}
          boardOrientation={playerColor === 'w' ? 'white' : 'black'}
          customBoardStyle={{
            borderRadius: '6px',
          }}
          customDarkSquareStyle={{ backgroundColor: '#D87093' }}
          customLightSquareStyle={{ backgroundColor: '#FFF0F5' }}
          arePiecesDraggable={!disabled && !pendingPromotion}
          animationDuration={250}
        />
      </div>

      {/* POPUP CHỌN QUÂN PHONG CẤP (HẬU, XE, TƯỢNG, MÃ) */}
      <PromotionModal
        isOpen={!!pendingPromotion}
        playerColor={playerColor}
        onSelectPiece={handlePromotionSelect}
        onCancel={() => setPendingPromotion(null)}
      />
    </div>
  );
};
