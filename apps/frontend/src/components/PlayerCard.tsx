import React from 'react';
import { Bot, User, Brain, AlertCircle, CheckCircle2, Flag } from 'lucide-react';
import { PlayerColor } from '../hooks/useChessEngine';

interface PlayerCardProps {
  isAi?: boolean;
  name: string;
  subText: string;
  color: PlayerColor;
  isThinking?: boolean;
  gameStatus?: string;
  capturedPieces?: string[];
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  isAi = false,
  name,
  subText,
  color,
  isThinking = false,
  gameStatus,
  capturedPieces = [],
}) => {
  const isWinner =
    (gameStatus === 'WHITE_WIN' && color === 'w') ||
    (gameStatus === 'BLACK_WIN' && color === 'b');
  const isLoser =
    (gameStatus === 'WHITE_WIN' && color === 'b') ||
    (gameStatus === 'BLACK_WIN' && color === 'w');
  const isDraw = gameStatus === 'DRAW';

  return (
    <div className={`w-full max-w-[500px] flex items-center justify-between px-3.5 py-2 rounded-xl border transition-all duration-300 ${
      isThinking
        ? 'bg-purple-950/40 border-purple-500/40 shadow-lg shadow-purple-500/10'
        : 'bg-slate-900/80 border-slate-800'
    }`}>
      {/* User Info */}
      <div className="flex items-center gap-2.5">
        <div className={`relative p-2 rounded-xl border ${
          isAi
            ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
            : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
        }`}>
          {isAi ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
          <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 flex items-center justify-center text-[8px] font-bold ${
            color === 'w' ? 'bg-slate-100 text-slate-950' : 'bg-slate-900 text-slate-100'
          }`}>
            {color === 'w' ? 'W' : 'B'}
          </span>
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-xs text-slate-200">{name}</h3>
            {isAi && (
              <span className="px-1.5 py-0.2 text-[9px] font-semibold bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">
                Stockfish
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400">{subText}</p>
        </div>
      </div>

      {/* Dynamic Status / Action Banner */}
      <div className="flex items-center gap-2">
        {isThinking && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/20 text-purple-300 text-[10px] font-semibold rounded-full border border-purple-500/30 animate-pulse">
            <Brain className="w-3 h-3 animate-spin text-purple-400" />
            <span>Đang nghĩ...</span>
          </div>
        )}

        {isWinner && (
          <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-lg border border-emerald-500/30 shadow-md shadow-emerald-500/10">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>CHIẾN THẮNG!</span>
          </div>
        )}

        {isLoser && (
          <div className="flex items-center gap-1 px-2.5 py-1 bg-rose-500/20 text-rose-300 text-[10px] font-bold rounded-lg border border-rose-500/30">
            <Flag className="w-3.5 h-3.5 text-rose-400" />
            <span>THẤT BẠI</span>
          </div>
        )}

        {isDraw && (
          <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded-lg border border-amber-500/30">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>HÒA CỜ</span>
          </div>
        )}
      </div>
    </div>
  );
};
