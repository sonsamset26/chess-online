import React, { useEffect, useState } from 'react';
import { Clock, Shield, Target, X, Zap } from 'lucide-react';

interface MatchmakingModalProps {
  isOpen: boolean;
  onCancel: () => void;
  userElo?: number;
  timeControlLabel?: string;
}

export const MatchmakingModal: React.FC<MatchmakingModalProps> = ({
  isOpen,
  onCancel,
  userElo = 1200,
  timeControlLabel = '10+0 Rapid',
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setElapsedSeconds(0);
      return;
    }

    const startTimestamp = Date.now();
    setElapsedSeconds(0);

    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - startTimestamp) / 1000);
      setElapsedSeconds(seconds);
    }, 500);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  // Tính khung delta theo Policy 0-5s: ±50, 5-15s: ±100, 15-30s: ±200, >30s: ±400
  let currentDelta = 50;
  if (elapsedSeconds > 30) {
    currentDelta = 400;
  } else if (elapsedSeconds > 15) {
    currentDelta = 200;
  } else if (elapsedSeconds > 5) {
    currentDelta = 100;
  }

  const minElo = Math.max(100, userElo - currentDelta);
  const maxElo = userElo + currentDelta;

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

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

        {/* Thời gian tìm kiếm */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-amber-400 font-mono font-bold mb-4">
          <Clock className="w-3.5 h-3.5" />
          <span>{formattedTime}</span>
          <span className="text-[#8B8987] mx-1">•</span>
          <span className="text-[#A7A4A1] font-sans">{timeControlLabel}</span>
        </div>

        {/* Khung Elo quét trực quan */}
        <div className="p-3 rounded-xl bg-[#1C1A17] border border-[#312E2B] mb-5 text-left text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[#8B8987] flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-blue-400" /> Điểm Elo của bạn:
            </span>
            <span className="font-bold text-white font-mono">{userElo}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#2A2825] pt-2">
            <span className="text-[#8B8987] flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-amber-400" /> Khung tìm kiếm:
            </span>
            <span className="font-bold text-amber-400 font-mono">
              [{minElo} - {maxElo}] <span className="text-[10px] text-emerald-400 font-normal">±{currentDelta}</span>
            </span>
          </div>
        </div>

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
