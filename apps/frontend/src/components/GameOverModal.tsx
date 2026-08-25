import React, { useState } from 'react';
import { Trophy, Frown, Handshake, RotateCcw, ArrowLeft, PlusCircle, TrendingUp, TrendingDown, Eye, Maximize2 } from 'lucide-react';
import { PlayerColor } from '../hooks/useChessEngine';
import { EloPlayerResult } from '../hooks/useSocket';

interface GameOverModalProps {
  gameStatus: string;
  playerColor: PlayerColor;
  isOnlineMatch?: boolean;
  customMessage?: string;
  myEloResult?: EloPlayerResult | null;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  gameStatus,
  playerColor,
  isOnlineMatch = false,
  customMessage,
  myEloResult,
  onPlayAgain,
  onBackToMenu,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (gameStatus === 'IN_PROGRESS') return null;

  const isWhiteWin = gameStatus === 'WHITE_WIN';
  const isBlackWin = gameStatus === 'BLACK_WIN';
  const isDraw = gameStatus === 'DRAW';

  const isPlayerWin = (isWhiteWin && playerColor === 'w') || (isBlackWin && playerColor === 'b');
  const isPlayerLose = (isWhiteWin && playerColor === 'b') || (isBlackWin && playerColor === 'w');

  // Xác định lý do kết thúc
  let reasonBadge = 'KẾT THÚC VÁN';
  if (customMessage?.includes('hết giờ') || customMessage?.includes('thời gian') || customMessage?.includes('Timeout')) {
    reasonBadge = '⏱️ HẾT THỜI GIAN (TIMEOUT)';
  } else if (customMessage?.includes('đầu hàng') || customMessage?.includes('ngắt kết nối')) {
    reasonBadge = '🏳️ ĐẦU HÀNG / RỜI TRẬN';
  } else if (isDraw) {
    reasonBadge = '🤝 HÒA CỜ (STALEMATE / DRAW)';
  } else {
    reasonBadge = '👑 CHIẾU HẾT (CHECKMATE)';
  }

  // NẾU NGƯỜI CHƠI ĐANG THU NHỎ MODAL ĐỂ XEM BÀN CỜ
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#262421]/95 border border-[#3A3733] backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-200 select-none">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${isPlayerWin ? 'bg-emerald-500' : isPlayerLose ? 'bg-rose-500' : 'bg-blue-500'}`} />
          <span className="text-xs font-bold text-white">
            {isPlayerWin ? 'Bạn đã Thắng' : isPlayerLose ? 'Bạn đã Thua' : 'Hòa cờ'} ({reasonBadge})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(false)}
            className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-all active:scale-95"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Mở lại Bảng Kết quả</span>
          </button>

          <button
            onClick={onPlayAgain}
            className="px-3 py-1.5 rounded-xl bg-[#312E2B] hover:bg-[#3B3835] text-[#BAB8B6] font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Ván Mới</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-300 select-none">
      <div className="w-full max-w-sm bg-[#262421] border border-[#3A3733] rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center relative">
        
        {/* Nút Xem Bàn Cờ ở góc phải */}
        <button
          onClick={() => setIsMinimized(true)}
          className="absolute top-4 right-4 text-[#8B8987] hover:text-white flex items-center gap-1 text-[11px] font-bold p-1.5 px-2 rounded-xl bg-[#1C1A17] hover:bg-[#312E2B] border border-[#3A3733] transition-colors"
          title="Thu nhỏ để xem vị trí các quân cờ trên bàn"
        >
          <Eye className="w-3.5 h-3.5 text-pink-400" />
          <span>Xem bàn cờ</span>
        </button>

        {/* BADGE LÝ DO KẾT THÚC VÁN */}
        <div className="mb-3">
          <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-[#1C1A17] text-pink-400 border border-pink-500/20 shadow-sm">
            {reasonBadge}
          </span>
        </div>

        {/* ICON & TIÊU ĐỀ KẾT QUẢ CHO TỪNG BÊN */}
        {isPlayerWin && (
          <>
            <div className="w-18 h-18 p-4 rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/20 mb-3 animate-bounce">
              <Trophy className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-black text-emerald-400 tracking-wide mb-1">
              BẠN ĐÃ CHIẾN THẮNG!
            </h2>
            <p className="text-xs text-[#A8A6A4] mb-4 leading-relaxed font-medium">
              {customMessage || 'Chúc mừng bạn đã xuất sắc đánh bại đối thủ bằng nước chiếu hết!'}
            </p>
          </>
        )}

        {isPlayerLose && (
          <>
            <div className="w-18 h-18 p-4 rounded-full bg-rose-500/20 border-2 border-rose-500/60 flex items-center justify-center text-rose-400 shadow-xl shadow-rose-500/20 mb-3">
              <Frown className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-black text-rose-400 tracking-wide mb-1">
              BẠN ĐÃ THẤT BẠI!
            </h2>
            <p className="text-xs text-[#A8A6A4] mb-4 leading-relaxed font-medium">
              {customMessage || 'Bạn đã bị chiếu hết (Checkmate). Hãy bấm nút "Xem bàn cờ" để quan sát lại thế trận cuối cùng!'}
            </p>
          </>
        )}

        {isDraw && (
          <>
            <div className="w-18 h-18 p-4 rounded-full bg-blue-500/20 border-2 border-blue-500/60 flex items-center justify-center text-blue-400 shadow-xl shadow-blue-500/20 mb-3">
              <Handshake className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-black text-blue-400 tracking-wide mb-1">
              VÁN CỜ HÒA!
            </h2>
            <p className="text-xs text-[#A8A6A4] mb-4 leading-relaxed font-medium">
              {customMessage || 'Trận đấu kết thúc với kết quả Hòa (Hết nước đi hợp lệ hoặc Không đủ quân chiếu hết).'}
            </p>
          </>
        )}

        {/* THẺ BIẾN ĐỘNG ELO */}
        {myEloResult && (
          <div className="w-full p-3 mb-4 rounded-2xl bg-[#1C1A17] border border-[#312E2B] flex items-center justify-between shadow-inner">
            <div className="text-left">
              <span className="text-[10px] text-[#8B8987] font-bold block uppercase tracking-wider">
                Điểm Elo Xếp Hạng
              </span>
              <span className="text-sm font-extrabold text-white font-mono">
                {myEloResult.oldElo} <span className="text-[#63615E]">→</span> {myEloResult.newElo}
              </span>
            </div>

            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black font-mono shadow-sm ${
              myEloResult.delta >= 0 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}>
              {myEloResult.delta >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-rose-400" />}
              <span>{myEloResult.delta >= 0 ? `+${myEloResult.delta}` : myEloResult.delta} Elo</span>
            </div>
          </div>
        )}

        {/* NÚT THAO TÁC */}
        <div className="w-full flex flex-col gap-2">
          <button
            onClick={() => setIsMinimized(true)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#1C1A17] hover:bg-[#2B2926] text-pink-400 border border-pink-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Eye className="w-4 h-4" />
            <span>Xem lại thế cờ cuối cùng trên bàn</span>
          </button>

          <button
            onClick={onPlayAgain}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-pink-500/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            {isOnlineMatch ? <PlusCircle className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
            <span>{isOnlineMatch ? 'Tạo / Nhập Phòng Mới' : 'Chơi Ván Mới'}</span>
          </button>

          <button
            onClick={onBackToMenu}
            className="w-full py-2 px-4 rounded-xl bg-[#312E2B] hover:bg-[#3B3835] text-[#BAB8B6] font-bold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Trở về Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
