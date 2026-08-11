import React from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { PlayerColor } from '../hooks/useChessEngine';

interface GameControlsProps {
  onReset: () => void;
  onToggleColor: () => void;
  playerColor: PlayerColor;
  disabled: boolean;
}

export const GameControls: React.FC<GameControlsProps> = ({
  onReset,
  onToggleColor,
  playerColor,
  disabled,
}) => {
  return (
    <div className="flex gap-2 w-full">
      <button
        onClick={onReset}
        disabled={disabled}
        className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-2 px-3 rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95 text-xs disabled:opacity-50"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Ván mới</span>
      </button>

      <button
        onClick={onToggleColor}
        disabled={disabled}
        className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold py-2 px-3 rounded-xl border border-slate-700/80 transition-all active:scale-95 text-xs disabled:opacity-50"
      >
        <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
        <span>Quân: {playerColor === 'w' ? '⚪ Trắng' : '⚫ Đen'}</span>
      </button>
    </div>
  );
};
