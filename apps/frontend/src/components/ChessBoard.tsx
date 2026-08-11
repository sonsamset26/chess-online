import React, { useState, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Square } from 'chess.js';
import { PlayerColor } from '../hooks/useChessEngine';

interface ChessBoardComponentProps {
  fen: string;
  playerColor: PlayerColor;
  onPieceDrop: (sourceSquare: Square, targetSquare: Square) => boolean;
  disabled: boolean;
}

export const ChessBoardComponent: React.FC<ChessBoardComponentProps> = ({
  fen,
  playerColor,
  onPieceDrop,
  disabled,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState<number>(360);

  // Tự động tính toán kích thước bàn cờ vừa khít màn hình
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        // Tính toán chiều cao tối đa khả dụng
        const maxAvailableHeight = window.innerHeight - 170;
        const calculatedSize = Math.min(containerWidth, maxAvailableHeight, 420);
        setBoardWidth(Math.max(260, calculatedSize));
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePieceDrop = (sourceSquare: Square, targetSquare: Square) => {
    if (disabled) return false;
    return onPieceDrop(sourceSquare, targetSquare);
  };

  return (
    <div
      ref={containerRef}
      className="w-full flex items-center justify-center p-1 my-auto"
    >
      <div
        style={{ width: `${boardWidth}px`, height: `${boardWidth}px` }}
        className="rounded-2xl overflow-hidden board-shadow border-4 border-slate-800/90 bg-slate-900 flex items-center justify-center shrink-0 transition-all duration-300"
      >
        <Chessboard
          position={fen}
          boardWidth={boardWidth - 8}
          onPieceDrop={handlePieceDrop}
          boardOrientation={playerColor === 'w' ? 'white' : 'black'}
          customBoardStyle={{
            borderRadius: '12px',
          }}
          customDarkSquareStyle={{ backgroundColor: '#B58863' }}
          customLightSquareStyle={{ backgroundColor: '#F0D9B5' }}
          arePiecesDraggable={!disabled}
        />
      </div>
    </div>
  );
};
