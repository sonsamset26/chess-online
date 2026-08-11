import React from 'react';
import { ScrollText, History } from 'lucide-react';

interface MoveHistoryProps {
  moveHistory: string[];
}

export const MoveHistory: React.FC<MoveHistoryProps> = ({ moveHistory }) => {
  const movePairs = Array.from({ length: Math.ceil(moveHistory.length / 2) });

  return (
    <div className="p-3.5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 flex flex-col flex-1 min-h-0 shadow-lg overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 shrink-0">
        <h2 className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
          <ScrollText className="w-4 h-4 text-emerald-400" />
          Lịch sử nước đi
        </h2>
        <span className="px-2 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-400 rounded-md border border-slate-700">
          {moveHistory.length} nước
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1 custom-scrollbar text-xs mt-2">
        {moveHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center my-auto py-6 text-slate-500 gap-1.5">
            <History className="w-6 h-6 stroke-[1.5] opacity-50" />
            <p className="italic text-[11px]">Chưa có nước đi nào...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {movePairs.map((_, index) => (
              <React.Fragment key={index}>
                {/* White move */}
                <div className="px-2.5 py-1 bg-slate-800/40 rounded-lg border border-slate-800/80 text-slate-300 flex justify-between font-mono text-[11px] items-center">
                  <span className="text-slate-500 text-[10px]">{index + 1}.</span>
                  <span className="font-semibold text-emerald-300">{moveHistory[index * 2]}</span>
                </div>
                {/* Black move */}
                <div className="px-2.5 py-1 bg-slate-800/40 rounded-lg border border-slate-800/80 text-slate-300 font-mono text-[11px] flex items-center">
                  <span className="font-semibold text-purple-300">{moveHistory[index * 2 + 1] || ''}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
