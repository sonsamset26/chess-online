import React from 'react';
import { MoveAnalysis } from '../services/analysis/types';

interface MoveItemProps {
  ply: number;
  san: string;
  color: 'w' | 'b';
  analysis?: MoveAnalysis;
  isSelected?: boolean;
  onClick?: (ply: number) => void;
}

export const MoveItem: React.FC<MoveItemProps> = ({
  ply,
  san,
  color,
  analysis,
  isSelected = false,
  onClick,
}) => {
  const status = analysis?.status;
  const classification = analysis?.classification;

  // Cấu hình Badge huy hiệu phân loại nước đi với kích thước cố định w-4 h-4 chống CLS
  const renderBadge = () => {
    if (!status) return null;

    if (status === 'PENDING') {
      return (
        <span
          className="w-4 h-4 shrink-0 flex items-center justify-center text-[10px] text-slate-400 animate-pulse font-mono select-none"
          title="Đang phân tích..."
        >
          …
        </span>
      );
    }

    if (status === 'STALE') {
      return null;
    }

    if (status === 'FAILED') {
      return (
        <span
          className="w-4 h-4 shrink-0 flex items-center justify-center text-[10px] text-slate-600 font-mono select-none"
          title="Không thể phân tích"
        >
          —
        </span>
      );
    }

    if (status === 'ANALYZED' && classification) {
      switch (classification) {
        case 'BEST':
          return (
            <span
              className="w-4 h-4 shrink-0 flex items-center justify-center text-[9px] font-black rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 select-none"
              title="Nước đi tối ưu"
            >
              ★
            </span>
          );
        case 'EXCELLENT':
          return (
            <span
              className="w-4 h-4 shrink-0 flex items-center justify-center text-[9px] font-black rounded bg-teal-500/20 text-teal-400 border border-teal-500/30 select-none"
              title="Rất tốt"
            >
              ★
            </span>
          );
        case 'GOOD':
          return (
            <span
              className="w-4 h-4 shrink-0 flex items-center justify-center text-[9px] font-black rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 select-none"
              title="Tốt"
            >
              ✓
            </span>
          );
        case 'INACCURACY':
          return (
            <span
              className="w-4 h-4 shrink-0 flex items-center justify-center text-[9px] font-bold rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 select-none"
              title="Chưa tối ưu"
            >
              ?!
            </span>
          );
        case 'MISTAKE':
          return (
            <span
              className="w-4 h-4 shrink-0 flex items-center justify-center text-[9px] font-bold rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 select-none"
              title="Sai lầm"
            >
              ?
            </span>
          );
        case 'BLUNDER':
          return (
            <span
              className="w-4 h-4 shrink-0 flex items-center justify-center text-[9px] font-black rounded bg-red-500/25 text-red-400 border border-red-500/40 select-none"
              title="Sai sót lớn"
            >
              ??
            </span>
          );
        default:
          return null;
      }
    }

    return null;
  };

  return (
    <button
      type="button"
      onClick={() => onClick?.(ply)}
      className={`h-7 px-2 rounded-lg border text-left font-mono text-[11px] flex items-center justify-between gap-1 transition-all select-none cursor-pointer ${
        isSelected
          ? 'bg-pink-500/20 border-pink-500/60 shadow-sm shadow-pink-500/20 text-pink-200'
          : 'bg-slate-800/40 border-slate-800/80 hover:bg-slate-800/70 hover:border-slate-700 text-slate-300'
      }`}
    >
      <span
        className={`font-semibold truncate ${
          color === 'w' ? 'text-emerald-300' : 'text-purple-300'
        } ${isSelected ? '!text-white' : ''}`}
      >
        {san}
      </span>
      <div className="w-4 h-4 shrink-0 flex items-center justify-center">
        {renderBadge()}
      </div>
    </button>
  );
};
