import React from 'react';
import { LogOut, AlertTriangle, X } from 'lucide-react';

interface LogoutModalProps {
  isOpen: boolean;
  isInGame: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({
  isOpen,
  isInGame,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-sm bg-[#16202E] border border-[#334155] rounded-3xl p-6 shadow-2xl relative flex flex-col items-center text-center">
        {/* Nút đóng góc phải */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-[#94A3B8] hover:text-white p-1 rounded-lg hover:bg-[#2A374A] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Biểu tượng cảnh báo hoặc đăng xuất */}
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg ${
          isInGame
            ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400 shadow-rose-500/10'
            : 'bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-amber-500/10'
        }`}>
          {isInGame ? (
            <AlertTriangle className="w-7 h-7 animate-pulse" />
          ) : (
            <LogOut className="w-7 h-7" />
          )}
        </div>

        {/* Tiêu đề */}
        <h3 className="text-base md:text-lg font-black text-white mb-2">
          {isInGame ? 'Đang trong ván đấu' : 'Xác nhận đăng xuất'}
        </h3>

        {/* Nội dung cảnh báo */}
        <p className="text-xs md:text-sm text-[#CBD5E1] mb-6 leading-relaxed">
          {isInGame
            ? 'Bạn đang trong ván đấu trực tuyến. Nếu đăng xuất lúc này, bạn sẽ bị xử thua trận và trừ điểm. Bạn có chắc muốn rời đi?'
            : 'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản không?'}
        </p>

        {/* Cụm nút hành động */}
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-[#2A374A] hover:bg-[#334155] text-white font-bold text-xs md:text-sm transition-all active:scale-95"
          >
            Ở lại
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl font-bold text-xs md:text-sm text-white transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 ${
              isInGame
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
            }`}
          >
            <LogOut className="w-4 h-4" />
            <span>{isInGame ? 'Xử thua & Thoát' : 'Đăng xuất'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
