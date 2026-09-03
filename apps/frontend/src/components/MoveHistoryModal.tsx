import React from 'react';
import { X, History, ScrollText, Info, Sparkles } from 'lucide-react';
import { MoveAnalysis } from '../services/analysis/types';
import { MoveItem } from './MoveItem';

interface MoveHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  moveHistory: string[];
  analysisByPly?: Record<number, MoveAnalysis>;
  selectedPly?: number | null;
  onSelectPly?: (ply: number | null) => void;
  showLiveAnalysis?: boolean;
}

export const MoveHistoryModal: React.FC<MoveHistoryModalProps> = ({
  isOpen,
  onClose,
  moveHistory,
  analysisByPly = {},
  selectedPly = null,
  onSelectPly,
  showLiveAnalysis = false,
}) => {
  if (!isOpen) return null;

  const movePairs = Array.from({ length: Math.ceil(moveHistory.length / 2) });
  const selectedAnalysis = selectedPly ? analysisByPly[selectedPly] : null;
  const listEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isOpen, moveHistory.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-sm bg-[#16202E] border border-[#334155] rounded-3xl p-5 shadow-2xl relative flex flex-col max-h-[85vh]">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-[#2A374A] pb-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-pink-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
              <ScrollText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Lịch Sử Nước Đi</h3>
              <p className="text-[10px] text-[#94A3B8]">Tổng cộng {moveHistory.length} nước đã đi</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-white p-1.5 rounded-xl hover:bg-[#2A374A] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Danh sách nước đi (Cuộn mượt mà với 3 cột chuẩn) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 my-1">
          {moveHistory.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center text-[#63615E] text-xs">
              <History className="w-8 h-8 mb-2 opacity-30" />
              <span>Chưa có nước đi nào</span>
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
                    <span className="text-[10px] font-mono text-[#94A3B8] font-semibold text-center select-none">
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
                      <div className="h-7 rounded-lg bg-[#1E293B]/40 border border-dashed border-[#334155]/50" />
                    )}
                  </div>
                );
              })}
              <div ref={listEndRef} />
            </div>
          )}
        </div>

        {/* Mobile Inspection Panel: Chỉ hiển thị khi bật Live Analysis và có nước được chọn */}
        {showLiveAnalysis && selectedAnalysis && (
          <div className="mt-2 p-2.5 bg-[#1E1C1A] border border-[#334155] rounded-2xl flex flex-col gap-1 text-[11px] font-mono animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-xs">
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
              <div className="text-[10px] text-[#94A3B8]">
                {selectedAnalysis.cpl !== undefined && (
                  <span>CPL: <strong className="text-white">{selectedAnalysis.cpl}</strong></span>
                )}
                {selectedAnalysis.evalAfter !== undefined && (
                  <span className="ml-2">
                    Thế cờ:{' '}
                    <strong className="text-white">
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
              <div className="text-[10px] text-[#94A3B8] truncate">
                {selectedAnalysis.status === 'PENDING'
                  ? 'Đang phân tích nước đi này...'
                  : selectedAnalysis.status === 'FAILED'
                  ? 'Không thể phân tích nước đi'
                  : 'Nước đi chính xác hàng đầu'}
              </div>
            )}
          </div>
        )}

        {/* Footer Button */}
        <div className="mt-3 pt-3 border-t border-[#2A374A]">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-[#2A374A] hover:bg-[#3B3835] text-[#CBD5E1] font-bold text-xs transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
