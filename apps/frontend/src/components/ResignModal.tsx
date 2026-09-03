import React from 'react';
import { Flag, AlertTriangle } from 'lucide-react';

interface ResignModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ResignModal: React.FC<ResignModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-sm bg-[#16202E] border border-[#334155] rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
          <Flag className="w-7 h-7" />
        </div>

        <h3 className="text-lg font-black text-white mb-1.5">
          Xác nhận Đầu hàng?
        </h3>
        <p className="text-xs text-[#94A3B8] mb-6 leading-relaxed">
          Bạn có chắc chắn muốn giơ cờ trắng đầu hàng? Trận thắng sẽ ngay lập tức thuộc về đối thủ của bạn.
        </p>

        <div className="w-full flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#2A374A] hover:bg-[#3B3835] text-[#CBD5E1] font-bold text-xs transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-extrabold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Flag className="w-4 h-4" />
            <span>Đầu hàng</span>
          </button>
        </div>
      </div>
    </div>
  );
};
