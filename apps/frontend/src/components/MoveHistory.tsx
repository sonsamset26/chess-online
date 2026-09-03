import React from 'react';
import { ScrollText, History, Info, Sparkles } from 'lucide-react';
import { MoveAnalysis } from '../services/analysis/types';
import { MoveItem } from './MoveItem';

interface MoveHistoryProps {
  moveHistory: string[];
  analysisByPly?: Record<number, MoveAnalysis>;
  selectedPly?: number | null;
  onSelectPly?: (ply: number | null) => void;
  showLiveAnalysis?: boolean;
}

export const MoveHistory: React.FC<MoveHistoryProps> = ({
  moveHistory,
  analysisByPly = {},
  selectedPly = null,
  onSelectPly,
  showLiveAnalysis = false,
}) => {
  const movePairs = Array.from({ length: Math.ceil(moveHistory.length / 2) });
  const selectedAnalysis = selectedPly ? analysisByPly[selectedPly] : null;
  const listEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [moveHistory.length]);

  return (
    <div className="p-3 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 flex flex-col flex-1 min-h-0 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 shrink-0">
        <h2 className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
          <ScrollText className="w-4 h-4 text-emerald-400" />
          Lịch sử nước đi
        </h2>
        <span className="px-2 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-400 rounded-md border border-slate-700">
          {moveHistory.length} nước
        </span>
      </div>

      {/* Danh sách nước đi 3 cột cân xứng */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1 custom-scrollbar text-xs my-2">
        {moveHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center my-auto py-6 text-slate-500 gap-1.5">
            <History className="w-6 h-6 stroke-[1.5] opacity-50" />
            <p className="italic text-[11px]">Chưa có nước đi nào...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {movePairs.map((_, index) => {
              const whitePly = index * 2 + 1;
              const blackPly = index * 2 + 2;
              const whiteSan = moveHistory[whitePly - 1];
              const blackSan = moveHistory[blackPly - 1];

              return (
                <div
                  key={index}
                  className="grid grid-cols-[28px_1fr_1fr] items-center gap-1.5 py-0.5"
                >
                  <span className="text-[10px] font-mono text-slate-500 font-semibold text-center select-none">
                    {index + 1}.
                  </span>
                  <MoveItem
                    ply={whitePly}
                    san={whiteSan}
                    color="w"
                    analysis={analysisByPly[whitePly]}
                    isSelected={selectedPly === whitePly}
                    onClick={(p) => onSelectPly?.(selectedPly === p ? null : p)}
                  />
                  {blackSan ? (
                    <MoveItem
                      ply={blackPly}
                      san={blackSan}
                      color="b"
                      analysis={analysisByPly[blackPly]}
                      isSelected={selectedPly === blackPly}
                      onClick={(p) => onSelectPly?.(selectedPly === p ? null : p)}
                    />
                  ) : (
                    <div className="h-7 rounded-lg bg-slate-800/20 border border-dashed border-slate-800/40" />
                  )}
                </div>
              );
            })}
            <div ref={listEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Inspection Panel: Chỉ hiển thị khi Live Analysis được bật (PvAI hoặc Đấu Bạn Bè) */}
      {showLiveAnalysis && (
        <div className="h-[76px] shrink-0 border-t border-slate-800/80 pt-2 px-2 flex flex-col justify-center bg-slate-950/40 rounded-xl">
          {selectedAnalysis ? (
            <div className="flex flex-col gap-1 text-[11px] font-mono">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-200">
                    {selectedAnalysis.san}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                      selectedAnalysis.classification === 'BEST'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : selectedAnalysis.classification === 'EXCELLENT'
                        ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                        : selectedAnalysis.classification === 'GOOD'
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        : selectedAnalysis.classification === 'INACCURACY'
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : selectedAnalysis.classification === 'MISTAKE'
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {selectedAnalysis.classification}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {selectedAnalysis.cpl !== undefined && (
                    <span>CPL: <strong className="text-slate-200">{selectedAnalysis.cpl}</strong></span>
                  )}
                  {selectedAnalysis.evalAfter !== undefined && (
                    <span className="ml-2">
                      Thế cờ:{' '}
                      <strong className="text-slate-200">
                        {Math.abs(selectedAnalysis.evalAfter) >= 9000
                          ? 'M0'
                          : `${(selectedAnalysis.evalAfter / 100).toFixed(1)}`}
                      </strong>
                    </span>
                  )}
                </div>
              </div>

              {selectedAnalysis.bestMoveSan && selectedAnalysis.classification !== 'BEST' ? (
                <div className="flex items-center gap-1 text-[10px] text-emerald-400/90 truncate">
                  <Sparkles className="w-3 h-3 shrink-0" />
                  <span>Gợi ý tối ưu: <strong className="font-bold">{selectedAnalysis.bestMoveSan}</strong></span>
                </div>
              ) : (
                <div className="text-[10px] text-slate-500 truncate">
                  {selectedAnalysis.status === 'PENDING'
                    ? 'Đang phân tích nước đi này...'
                    : selectedAnalysis.status === 'FAILED'
                    ? 'Không thể phân tích nước đi'
                    : 'Nước đi chính xác hàng đầu'}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 italic select-none">
              <Info className="w-3.5 h-3.5 opacity-60" />
              <span>Chạm vào nước đi để xem phân tích & gợi ý</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

