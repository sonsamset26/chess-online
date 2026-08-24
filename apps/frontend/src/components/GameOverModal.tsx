import React from 'react';
import { Trophy, Frown, Handshake, RotateCcw, ArrowLeft, PlusCircle } from 'lucide-react';
import { PlayerColor } from '../hooks/useChessEngine';

interface GameOverModalProps {
  gameStatus: string;
  playerColor: PlayerColor;
  isOnlineMatch?: boolean;
  customMessage?: string;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  gameStatus,
  playerColor,
  isOnlineMatch = false,
  customMessage,
  onPlayAgain,
  onBackToMenu,
}) => {
  if (gameStatus === 'IN_PROGRESS') return null;

  const isWhiteWin = gameStatus === 'WHITE_WIN';
  const isBlackWin = gameStatus === 'BLACK_WIN';
  const isDraw = gameStatus === 'DRAW';

  const isPlayerWin = (isWhiteWin && playerColor === 'w') || (isBlackWin && playerColor === 'b');
  const isPlayerLose = (isWhiteWin && playerColor === 'b') || (isBlackWin && playerColor === 'w');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-300 select-none">
      <div className="w-full max-w-sm bg-[#262421] border border-[#3A3733] rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center">
        {/* ICON & TIÊU ĐỀ KẾT QUẢ */}
        {isPlayerWin && (
          <>
            <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-500/60 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/20 mb-4 animate-bounce">
              <Trophy className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-amber-400 tracking-wide mb-1">
              CHIẾN THẮNG RỰC RỠ!
            </h2>
            <p className="text-xs text-[#8B8987] mb-6 leading-relaxed">
              {customMessage || 'Chúc mừng bạn đã xuất sắc đánh bại đối thủ bằng nước chiếu hết!'}
            </p>
          </>
        )}

        {isPlayerLose && (
          <>
            <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-500/60 flex items-center justify-center text-rose-400 shadow-xl shadow-rose-500/20 mb-4">
              <Frown className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-rose-400 tracking-wide mb-1">
              THẤT BẠI TIẾC NUỐI!
            </h2>
            <p className="text-xs text-[#8B8987] mb-6 leading-relaxed">
              {customMessage || 'Bạn đã bị chiếu hết. Hãy luyện tập thêm và phục thù ở ván tiếp theo!'}
            </p>
          </>
        )}

        {isDraw && (
          <>
            <div className="w-20 h-20 rounded-full bg-blue-500/20 border-2 border-blue-500/60 flex items-center justify-center text-blue-400 shadow-xl shadow-blue-500/20 mb-4">
              <Handshake className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-blue-400 tracking-wide mb-1">
              KẾT QUẢ HÒA CỜ!
            </h2>
            <p className="text-xs text-[#8B8987] mb-6 leading-relaxed">
              {customMessage || 'Trận đấu cân tài cân sức kết thúc với tỉ số Hòa (Stalemate / Repetition).'}
            </p>
          </>
        )}

        {/* NÚT ĐIỀU KHIỂN SAU TRẬN */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={onPlayAgain}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-pink-500/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            {isOnlineMatch ? <PlusCircle className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
            <span>{isOnlineMatch ? 'Tạo / Nhập Phòng Trận Mới' : 'Chơi Ván Mới'}</span>
          </button>

          <button
            onClick={onBackToMenu}
            className="w-full py-2.5 px-4 rounded-xl bg-[#312E2B] hover:bg-[#3B3835] text-[#BAB8B6] font-bold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Trở về Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
