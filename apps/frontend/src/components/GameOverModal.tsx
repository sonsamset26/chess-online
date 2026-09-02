import React from 'react';
import { Trophy, Frown, Handshake, RotateCcw, ArrowLeft, PlusCircle, TrendingUp, TrendingDown, Eye, X, Swords, Users } from 'lucide-react';
import { PlayerColor } from '../hooks/useChessEngine';
import { EloPlayerResult } from '../hooks/useSocket';

interface GameOverModalProps {
  isOpen: boolean;
  gameStatus: string;
  playerColor: PlayerColor;
  isOnlineMatch?: boolean;
  isRated?: boolean;
  endReason?: 'CHECKMATE' | 'TIMEOUT' | 'RESIGNED' | 'ABANDONED' | 'DRAW' | string;
  customMessage?: string;
  myEloResult?: EloPlayerResult | null;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
  onCloseToReview: () => void;
  onOpenAnalysis?: () => void;
  moveHistory?: string[];
  isTournamentMatch?: boolean;
  onViewBracket?: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  gameStatus,
  playerColor,
  isOnlineMatch = false,
  isRated = false,
  endReason,
  customMessage,
  myEloResult,
  onPlayAgain,
  onBackToMenu,
  onCloseToReview,
  onOpenAnalysis,
  moveHistory = [],
  isTournamentMatch = false,
  onViewBracket,
}) => {
  if (!isOpen || gameStatus === 'IN_PROGRESS') return null;

  const isWhiteWin = gameStatus === 'WHITE_WIN';
  const isBlackWin = gameStatus === 'BLACK_WIN';
  const isDraw = gameStatus === 'DRAW';

  const isPlayerWin = (isWhiteWin && playerColor === 'w') || (isBlackWin && playerColor === 'b');
  const isPlayerLose = (isWhiteWin && playerColor === 'b') || (isBlackWin && playerColor === 'w');

  // Xác định nhãn lý do kết thúc chuẩn xác từ Backend
  let reasonBadge = 'KẾT THÚC VÁN';
  if (endReason === 'RESIGNED') {
    reasonBadge = '🏳️ ĐẦU HÀNG (RESIGNED)';
  } else if (endReason === 'TIMEOUT') {
    reasonBadge = '⏱️ HẾT THỜI GIAN (TIMEOUT)';
  } else if (endReason === 'ABANDONED') {
    reasonBadge = '⚠️ ĐỐI THỦ RỜI TRẬN (ABANDONED)';
  } else if (endReason === 'DRAW' || isDraw) {
    reasonBadge = '🤝 HÒA CỜ (STALEMATE / DRAW)';
  } else if (endReason === 'CHECKMATE') {
    reasonBadge = '👑 CHIẾU HẾT (CHECKMATE)';
  } else if (customMessage?.includes('hết giờ') || customMessage?.includes('thời gian') || customMessage?.includes('Timeout')) {
    reasonBadge = '⏱️ HẾT THỜI GIAN (TIMEOUT)';
  } else if (customMessage?.includes('đầu hàng') || customMessage?.includes('ngắt kết nối')) {
    reasonBadge = '🏳️ ĐẦU HÀNG / RỜI TRẬN';
  } else if (isDraw) {
    reasonBadge = '🤝 HÒA CỜ (STALEMATE / DRAW)';
  } else {
    reasonBadge = '👑 CHIẾU HẾT (CHECKMATE)';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-300 select-none">
      <div className="w-full max-w-sm bg-[#262421] border border-[#3A3733] rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center relative">
        
        {/* NÚT ĐÓNG X GÓC TRÊN ĐỂ XEM BÀN CỜ */}
        <button
          onClick={onCloseToReview}
          className="absolute top-4 right-4 text-[#8B8987] hover:text-white p-2 rounded-xl bg-[#1C1A17] hover:bg-[#312E2B] border border-[#3A3733] transition-colors"
          title="Đóng bảng để xem bàn cờ"
        >
          <X className="w-4 h-4" />
        </button>

        {/* BADGE LÝ DO KẾT THÚC */}
        <div className="mb-3 flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-[#1C1A17] text-pink-400 border border-pink-500/20 shadow-sm">
            {reasonBadge}
          </span>
        </div>

        {/* THÔNG BÁO CHO TỪNG BÊN */}
        {isPlayerWin && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/20 mb-3 animate-bounce">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-emerald-400 tracking-wide mb-1">
              BẠN ĐÃ CHIẾN THẮNG!
            </h2>
            <p className="text-xs text-[#A8A6A4] mb-4 leading-relaxed font-medium">
              {customMessage || 'Chúc mừng bạn đã xuất sắc đánh bại đối thủ!'}
            </p>
          </>
        )}

        {isPlayerLose && (
          <>
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-500/60 flex items-center justify-center text-rose-400 shadow-xl shadow-rose-500/20 mb-3">
              <Frown className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-rose-400 tracking-wide mb-1">
              BẠN ĐÃ THẤT BẠI!
            </h2>
            <p className="text-xs text-[#A8A6A4] mb-4 leading-relaxed font-medium">
              {customMessage || 'Ván đấu kết thúc. Hãy xem lại bàn cờ để rút kinh nghiệm cho ván tiếp theo!'}
            </p>
          </>
        )}

        {isDraw && (
          <>
            <div className="w-16 h-16 rounded-full bg-blue-500/20 border-2 border-blue-500/60 flex items-center justify-center text-blue-400 shadow-xl shadow-blue-500/20 mb-3">
              <Handshake className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-blue-400 tracking-wide mb-1">
              VÁN CỜ HÒA!
            </h2>
            <p className="text-xs text-[#A8A6A4] mb-4 leading-relaxed font-medium">
              {customMessage || 'Trận đấu kết thúc với kết quả Hòa.'}
            </p>
          </>
        )}

        {/* THẺ BIẾN ĐỘNG ELO KHI LÀ ĐẤU XẾP HẠNG RATED */}
        {isRated && myEloResult && (
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

        {/* THẺ GIAO HỮU NẾU LÀ ĐẤU BẠN BÈ (CUSTOM ROOM UNRATED) */}
        {!isRated && isOnlineMatch && (
          <div className="w-full p-2.5 mb-4 rounded-2xl bg-[#1C1A17] border border-[#312E2B] flex items-center justify-center gap-2 shadow-inner">
            <Users className="w-3.5 h-3.5 text-pink-400" />
            <span className="text-[11px] font-bold text-[#A8A6A4]">
              Đấu Bạn Bè (Giao Hữu • Không tính điểm Elo)
            </span>
          </div>
        )}

        {/* CÁC NÚT ĐIỀU KHIỂN CHÍNH */}
        <div className="w-full flex flex-col gap-2">
          {isTournamentMatch ? (
            // LUỒNG GIẢI ĐẤU (TOURNAMENT)
            isPlayerWin ? (
              <>
                {onViewBracket && (
                  <button
                    onClick={onViewBracket}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-pink-500 hover:from-rose-500 hover:to-pink-400 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-rose-500/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <Trophy className="w-4 h-4" />
                    <span>Xem Nhánh Đấu / Chờ Vòng Sau</span>
                  </button>
                )}
                <button
                  onClick={onCloseToReview}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#1C1A17] hover:bg-[#2B2926] text-pink-400 border border-pink-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Eye className="w-4 h-4" />
                  <span>Xem lại bàn cờ</span>
                </button>
              </>
            ) : (
              <>
                {onOpenAnalysis && moveHistory.length > 0 && (
                  <button
                    onClick={onOpenAnalysis}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-500 hover:from-indigo-500 hover:to-purple-400 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <span>📊</span>
                    <span>Phân Tích Ván Đấu</span>
                  </button>
                )}
                {onViewBracket && (
                  <button
                    onClick={onViewBracket}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#1C1A17] hover:bg-[#2B2926] text-rose-400 border border-rose-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Trophy className="w-4 h-4" />
                    <span>Xem Nhánh Đấu</span>
                  </button>
                )}
                <button
                  onClick={onCloseToReview}
                  className="w-full py-2 px-4 rounded-xl bg-[#312E2B] hover:bg-[#3B3835] text-[#BAB8B6] font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  <span>Xem lại bàn cờ</span>
                </button>
              </>
            )
          ) : (
            // LUỒNG CHƠI THƯỜNG (PV_AI / PVP)
            <>
              <button
                onClick={onPlayAgain}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-pink-500/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {isRated ? (
                  <>
                    <Swords className="w-4 h-4" />
                    <span>Tìm Trận Xếp Hạng Mới</span>
                  </>
                ) : isOnlineMatch ? (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>Tạo / Nhập Phòng Mới</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Chơi Ván Mới</span>
                  </>
                )}
              </button>

              {onOpenAnalysis && moveHistory.length > 0 && (
                <button
                  onClick={onOpenAnalysis}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-950/80 to-purple-950/80 hover:from-indigo-900/90 hover:to-purple-900/90 text-indigo-300 border border-indigo-500/40 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <span>📊</span>
                  <span>Phân Tích Ván Đấu</span>
                </button>
              )}

              <button
                onClick={onCloseToReview}
                className="w-full py-2.5 px-4 rounded-xl bg-[#1C1A17] hover:bg-[#2B2926] text-pink-400 border border-pink-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Eye className="w-4 h-4" />
                <span>Xem lại bàn cờ</span>
              </button>

              <button
                onClick={onBackToMenu}
                className="w-full py-2 px-4 rounded-xl bg-[#312E2B] hover:bg-[#3B3835] text-[#BAB8B6] font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Trở về Menu</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
