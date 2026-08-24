import React from 'react';
import { PlayerColor } from '../hooks/useChessEngine';
import { Crown } from 'lucide-react';

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

interface PromotionModalProps {
  isOpen: boolean;
  playerColor: PlayerColor;
  onSelectPiece: (piece: PromotionPiece) => void;
  onCancel: () => void;
}

export const PromotionModal: React.FC<PromotionModalProps> = ({
  isOpen,
  playerColor,
  onSelectPiece,
  onCancel,
}) => {
  if (!isOpen) return null;

  const isWhite = playerColor === 'w';

  const pieces: {
    type: PromotionPiece;
    name: string;
    symbol: string;
    sub: string;
    colorStyle: string;
    hoverStyle: string;
  }[] = [
    {
      type: 'q',
      name: 'Hậu (Queen)',
      symbol: isWhite ? '♕' : '♛',
      sub: 'Mạnh nhất',
      colorStyle: 'bg-pink-600/20 border-pink-500/50 text-pink-400',
      hoverStyle: 'hover:bg-pink-600/30 hover:border-pink-400 hover:scale-105',
    },
    {
      type: 'r',
      name: 'Xe (Rook)',
      symbol: isWhite ? '♖' : '♜',
      sub: 'Kiểm soát cột',
      colorStyle: 'bg-blue-600/20 border-blue-500/50 text-blue-400',
      hoverStyle: 'hover:bg-blue-600/30 hover:border-blue-400 hover:scale-105',
    },
    {
      type: 'b',
      name: 'Tượng (Bishop)',
      symbol: isWhite ? '♗' : '♝',
      sub: 'Đường chéo',
      colorStyle: 'bg-amber-600/20 border-amber-500/50 text-amber-400',
      hoverStyle: 'hover:bg-amber-600/30 hover:border-amber-400 hover:scale-105',
    },
    {
      type: 'n',
      name: 'Mã (Knight)',
      symbol: isWhite ? '♘' : '♞',
      sub: 'Đột phá',
      colorStyle: 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400',
      hoverStyle: 'hover:bg-emerald-600/30 hover:border-emerald-400 hover:scale-105',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-md bg-[#262421] border border-[#3A3733] rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center">
        {/* Icon & Tiêu đề */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center text-white mb-3 shadow-lg shadow-pink-500/30">
          <Crown className="w-8 h-8" />
        </div>

        <h3 className="text-xl font-black text-white mb-1">
          Phong Cấp Cho Tốt (Pawn Promotion)
        </h3>
        <p className="text-xs text-[#8B8987] mb-6">
          Quân Tốt đã tiến đến hàng cuối! Hãy chọn 1 trong 4 quân cờ để phong cấp:
        </p>

        {/* 4 Quân Cờ Lựa Chọn */}
        <div className="grid grid-cols-2 gap-3 w-full mb-5">
          {pieces.map((piece) => (
            <button
              key={piece.type}
              onClick={() => onSelectPiece(piece.type)}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 shadow-md ${piece.colorStyle} ${piece.hoverStyle} active:scale-95`}
            >
              <span className="text-5xl mb-1 filter drop-shadow">{piece.symbol}</span>
              <span className="font-extrabold text-sm text-white">{piece.name}</span>
              <span className="text-[10px] text-[#8B8987] mt-0.5">{piece.sub}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="w-full py-2.5 px-4 rounded-xl bg-[#312E2B] hover:bg-[#3B3835] text-[#BAB8B6] font-bold text-xs transition-colors"
        >
          Hủy bỏ
        </button>
      </div>
    </div>
  );
};
