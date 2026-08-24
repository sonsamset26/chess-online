import React from 'react';
import { Loader2, X, Zap } from 'lucide-react';

interface MatchmakingModalProps {
  isOpen: boolean;
  onCancel: () => void;
}

export const MatchmakingModal: React.FC<MatchmakingModalProps> = ({
  isOpen,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-sm bg-[#262421] border border-[#3A3733] rounded-2xl p-6 shadow-2xl relative text-center">
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-3.5 right-3.5 text-[#8B8987] hover:text-white p-1 rounded-lg hover:bg-[#312E2B] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Animated Searching Radar Ring */}
        <div className="relative w-20 h-20 mx-auto mb-4 flex items-center justify-center">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400/30 opacity-75" />
          <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20">
            <Zap className="w-8 h-8 animate-pulse" />
          </div>
        </div>

        <h3 className="text-lg font-black text-white mb-1">
          Đang tìm đối thủ...
        </h3>
        <p className="text-xs text-[#8B8987] mb-6">
          Hệ thống đang quét tìm đối thủ có cùng điểm Elo tương đồng.
        </p>

        <button
          onClick={onCancel}
          className="w-full py-2.5 rounded-xl bg-[#363431] hover:bg-[#403D39] text-white font-bold text-xs transition-colors"
        >
          Hủy tìm kiếm
        </button>
      </div>
    </div>
  );
};
