import React from 'react';
import { Bot, User, Brain, AlertCircle, CheckCircle2, Flag, Clock } from 'lucide-react';
import { PlayerColor } from '../hooks/useChessEngine';

interface PlayerCardProps {
  isAi?: boolean;
  name: string;
  subText: string;
  color: PlayerColor;
  isThinking?: boolean;
  gameStatus?: string;
  capturedPieces?: string[];
  timeLeftMs?: number;
  isClockActive?: boolean;
}

const formatClock = (ms?: number): string => {
  if (ms === undefined || ms === null) return '--:--';
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (ms < 10000) {
    const tenths = Math.floor((ms % 1000) / 100);
    return `0:0${seconds}.${tenths}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const PlayerCard: React.FC<PlayerCardProps> = ({
  isAi = false,
  name,
  subText,
  color,
  isThinking = false,
  gameStatus,
  capturedPieces = [],
  timeLeftMs,
  isClockActive = false,
}) => {
  const isWinner =
    (gameStatus === 'WHITE_WIN' && color === 'w') ||
    (gameStatus === 'BLACK_WIN' && color === 'b');
  const isLoser =
    (gameStatus === 'WHITE_WIN' && color === 'b') ||
    (gameStatus === 'BLACK_WIN' && color === 'w');
  const isDraw = gameStatus === 'DRAW';

  return (
    <div className={`w-full max-w-[500px] flex items-center justify-between px-3 py-1.5 md:py-2 rounded-xl border transition-all duration-300 ${
      isThinking
        ? 'bg-pink-950/30 border-pink-500/40 shadow-md shadow-pink-500/10'
        : 'bg-[#262421] border-[#312E2B]'
    }`}>
      {/* User Info */}
      <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
        <div className={`relative p-1.5 md:p-2 rounded-xl border shrink-0 ${
          isAi
            ? 'bg-pink-500/10 border-pink-500/30 text-pink-400'
            : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
        }`}>
          {isAi ? <Bot className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <User className="w-3.5 h-3.5 md:w-4 md:h-4" />}
          <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#161512] flex items-center justify-center text-[7px] md:text-[8px] font-black ${
            color === 'w' ? 'bg-slate-100 text-slate-950' : 'bg-slate-900 text-slate-100'
          }`}>
            {color === 'w' ? 'W' : 'B'}
          </span>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-xs text-white truncate max-w-[140px] md:max-w-[200px]">{name}</h3>
            {isAi && (
              <span className="px-1.5 py-0.2 text-[8px] md:text-[9px] font-bold bg-pink-500/20 text-pink-300 rounded border border-pink-500/30 hidden sm:inline">
                Stockfish
              </span>
            )}
          </div>
          <p className="text-[9px] md:text-[10px] text-[#8B8987] truncate">{subText}</p>
        </div>
      </div>

      {/* Clock & Dynamic Status */}
      <div className="flex items-center gap-1.5 md:gap-2.5 shrink-0">
        {timeLeftMs !== undefined && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-xl font-mono font-black text-xs md:text-sm tracking-wider border transition-all duration-300 ${
            timeLeftMs < 30000 && isClockActive
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 shadow-lg shadow-rose-500/20 animate-pulse'
              : isClockActive
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10'
              : 'bg-[#1A1816] text-[#A6A4A0] border-[#312E2B]'
          }`}>
            <Clock className={`w-3.5 h-3.5 shrink-0 ${isClockActive ? 'text-amber-400' : 'text-[#73716E]'}`} />
            <span>{formatClock(timeLeftMs)}</span>
          </div>
        )}

        {isThinking && (
          <div className="flex items-center gap-1 px-2 py-0.5 md:px-2.5 md:py-1 bg-pink-500/20 text-pink-300 text-[9px] md:text-[10px] font-bold rounded-full border border-pink-500/30 animate-pulse">
            <Brain className="w-3 h-3 animate-spin text-pink-400" />
            <span>Đang nghĩ...</span>
          </div>
        )}

        {isWinner && (
          <div className="flex items-center gap-1 px-2 py-0.5 md:px-2.5 md:py-1 bg-emerald-500/20 text-emerald-300 text-[9px] md:text-[10px] font-extrabold rounded-lg border border-emerald-500/30 shadow-md">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>THẮNG</span>
          </div>
        )}

        {isLoser && (
          <div className="flex items-center gap-1 px-2 py-0.5 md:px-2.5 md:py-1 bg-rose-500/20 text-rose-300 text-[9px] md:text-[10px] font-extrabold rounded-lg border border-rose-500/30">
            <Flag className="w-3 h-3 text-rose-400" />
            <span>THUA</span>
          </div>
        )}

        {isDraw && (
          <div className="flex items-center gap-1 px-2 py-0.5 md:px-2.5 md:py-1 bg-amber-500/20 text-amber-300 text-[9px] md:text-[10px] font-extrabold rounded-lg border border-amber-500/30">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            <span>HÒA</span>
          </div>
        )}
      </div>
    </div>
  );
};
