import React from 'react';
import { X, History, ScrollText } from 'lucide-react';

interface MoveHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  moveHistory: string[];
}

export const MoveHistoryModal: React.FC<MoveHistoryModalProps> = ({
  isOpen,
  onClose,
  moveHistory,
}) => {
  if (!isOpen) return null;

  // Nhóm các nước đi thành cặp (Trắng / Đen)
  const pairedMoves: { white: string; black?: string }[] = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    pairedMoves.push({
      white: moveHistory[i],
      black: moveHistory[i + 1],
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-sm bg-[#262421] border border-[#3A3733] rounded-3xl p-5 shadow-2xl relative flex flex-col max-h-[80vh]">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-[#312E2B] pb-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-pink-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
              <ScrollText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Lịch Sử Nước Đi</h3>
              <p className="text-[10px] text-[#8B8987]">Tổng cộng {moveHistory.length} nước đã đi</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#8B8987] hover:text-white p-1.5 rounded-xl hover:bg-[#312E2B] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Danh sách nước đi (Cuộn mượt mà) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 my-1">
          {pairedMoves.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center text-[#63615E] text-xs">
              <History className="w-8 h-8 mb-2 opacity-30" />
              <span>Chưa có nước đi nào</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {pairedMoves.map((pair, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-xl bg-[#2F2D2A] text-xs font-mono border border-[#3A3733]/50"
                >
                  <span className="w-8 text-[#8B8987] font-bold text-[11px]">
                    {idx + 1}.
                  </span>
                  <span className="flex-1 text-white font-bold text-center bg-[#24221F] py-1 px-2 rounded-lg mx-1">
                    {pair.white}
                  </span>
                  <span className="flex-1 text-pink-300 font-bold text-center bg-[#24221F] py-1 px-2 rounded-lg mx-1">
                    {pair.black || '...'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Button */}
        <div className="mt-3 pt-3 border-t border-[#312E2B]">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-[#312E2B] hover:bg-[#3B3835] text-[#BAB8B6] font-bold text-xs transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
