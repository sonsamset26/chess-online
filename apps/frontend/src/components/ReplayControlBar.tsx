import React from 'react';
import { ChevronFirst, ChevronLeft, ChevronRight, ChevronLast, ArrowLeft, RotateCw } from 'lucide-react';
import { MatchRecord } from './HistoryView';

interface ReplayControlBarProps {
  replayMatch: MatchRecord;
  replayMoveIndex: number;
  replayOrigin: {
    source: 'tournament_detail' | 'history' | 'active_match' | 'game_over';
    tournamentIdOrCode?: string;
    preferredColor?: 'w' | 'b';
  } | null;
  onExit: () => void;
  onGoToMove: (index: number) => void;
  onFlipBoard?: () => void;
  effectiveColor?: 'w' | 'b';
}

export const ReplayControlBar: React.FC<ReplayControlBarProps> = ({
  replayMatch,
  replayMoveIndex,
  replayOrigin,
  onExit,
  onGoToMove,
  onFlipBoard,
  effectiveColor = 'w',
}) => {
  return (
    <div className="w-full max-w-[480px] mt-2 p-2.5 bg-[#16202E] rounded-2xl border border-[#2A374A] flex flex-col gap-2 shadow-xl">
      {/* Hàng trên: Thông tin xem lại & Nút thoát */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#2A374A] gap-2">
        <span className="text-xs font-bold text-white truncate flex items-center gap-1.5">
          <span>📜</span>
          <span className="truncate">{replayMatch.whiteUsername} vs {replayMatch.blackUsername}</span>
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {onFlipBoard && (
            <button
              onClick={onFlipBoard}
              className="flex items-center gap-1 px-2 py-1 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-slate-300 text-[11px] font-bold transition-all active:scale-95"
              title="Đổi góc nhìn bàn cờ (Trắng ⇄ Đen)"
            >
              <RotateCw className="w-3.5 h-3.5 text-pink-400" />
              <span>Lật cờ ({effectiveColor === 'w' ? 'Trắng' : 'Đen'})</span>
            </button>
          )}
          <button
            onClick={onExit}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-[11px] font-bold transition-all shadow active:scale-95 shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>
              {replayOrigin?.source === 'tournament_detail'
                ? 'Về Sơ đồ'
                : replayOrigin?.source === 'game_over'
                ? 'Về menu'
                : 'Về lịch sử'}
            </span>
          </button>
        </div>
      </div>

      {/* Hàng dưới: Các nút tua nước đi */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onGoToMove(0)}
            disabled={replayMoveIndex === 0}
            className="p-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] disabled:opacity-40 disabled:hover:bg-[#1E293B] text-white transition-all"
            title="Về đầu ván"
          >
            <ChevronFirst className="w-4 h-4" />
          </button>
          <button
            onClick={() => onGoToMove(replayMoveIndex - 1)}
            disabled={replayMoveIndex === 0}
            className="p-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] disabled:opacity-40 disabled:hover:bg-[#1E293B] text-white transition-all"
            title="Nước trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center">
          <span className="font-mono font-bold text-xs text-pink-400">
            Nước: {replayMoveIndex} / {replayMatch.moves.length}
          </span>
          <p className="text-[10px] text-[#94A3B8]">
            {replayMoveIndex === 0
              ? 'Thế cờ bắt đầu'
              : `Nước vừa đi: ${replayMatch.moves[replayMoveIndex - 1]}`}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onGoToMove(replayMoveIndex + 1)}
            disabled={replayMoveIndex >= replayMatch.moves.length}
            className="p-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] disabled:opacity-40 disabled:hover:bg-[#1E293B] text-white transition-all"
            title="Nước tiếp"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onGoToMove(replayMatch.moves.length)}
            disabled={replayMoveIndex >= replayMatch.moves.length}
            className="p-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] disabled:opacity-40 disabled:hover:bg-[#1E293B] text-white transition-all"
            title="Đến cuối ván"
          >
            <ChevronLast className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
