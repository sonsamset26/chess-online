import React, { useState } from 'react';
import { X, Users, PlusCircle, LogIn, Copy, Check, Loader2, AlertCircle } from 'lucide-react';

interface FriendRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  createdRoomCode: string | null;
  friendRoomError: string | null;
  onCreateRoom: () => void;
  onJoinRoom: (roomCode: string) => void;
  onCancelRoom: () => void;
}

export const FriendRoomModal: React.FC<FriendRoomModalProps> = ({
  isOpen,
  onClose,
  createdRoomCode,
  friendRoomError,
  onCreateRoom,
  onJoinRoom,
  onCancelRoom,
}) => {
  const [view, setView] = useState<'menu' | 'join'>('menu');
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (createdRoomCode) {
      navigator.clipboard.writeText(createdRoomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim().length === 6) {
      onJoinRoom(inputCode.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-md bg-[#262421] border border-[#3A3733] rounded-3xl p-6 shadow-2xl relative">
        {/* Nút Đóng */}
        <button
          onClick={() => {
            onCancelRoom();
            onClose();
            setView('menu');
            setInputCode('');
          }}
          className="absolute top-4 right-4 text-[#8B8987] hover:text-white p-1 rounded-lg hover:bg-[#312E2B] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/30 mx-auto mb-3">
            <Users className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold text-white">Thách Đấu Bạn Bè</h2>
          <p className="text-xs text-[#8B8987] mt-1">Tạo phòng riêng hoặc nhập mã phòng để thi đấu 1v1</p>
        </div>

        {/* Thông báo Lỗi nếu có */}
        {friendRoomError && (
          <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{friendRoomError}</span>
          </div>
        )}

        {/* MÀN HÌNH 1: HIỂN THỊ MÃ PHÒNG ĐÃ TẠO VÀ ĐANG CHỜ BẠN BÈ */}
        {createdRoomCode ? (
          <div className="flex flex-col items-center text-center py-2">
            <span className="text-xs font-bold text-[#8B8987] uppercase tracking-wider mb-2">Mã Phòng Đấu Của Bạn</span>
            
            {/* Mã phòng 6 chữ số to rực rỡ */}
            <div className="flex items-center gap-3 bg-[#1C1A17] border border-[#3A3733] rounded-2xl px-6 py-3.5 mb-4 shadow-inner">
              <span className="font-mono text-3xl font-black text-pink-400 tracking-widest">{createdRoomCode}</span>
              <button
                onClick={handleCopyCode}
                className="p-2 rounded-xl bg-[#2B2926] hover:bg-[#363431] text-[#BAB8B6] hover:text-white transition-colors"
                title="Sao chép Mã phòng"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>

            {copied && <span className="text-[11px] text-emerald-400 font-semibold mb-3">✓ Đã sao chép mã phòng!</span>}

            <div className="flex items-center gap-2 text-xs text-slate-300 bg-pink-500/10 border border-pink-500/20 px-4 py-2 rounded-full mb-6">
              <Loader2 className="w-4 h-4 text-pink-400 animate-spin" />
              <span>Đang chờ bạn bè nhập mã phòng để vào đấu...</span>
            </div>

            <button
              onClick={onCancelRoom}
              className="w-full py-2.5 px-4 rounded-xl bg-[#312E2B] hover:bg-[#3B3835] text-rose-400 font-bold text-xs transition-colors"
            >
              Hủy phòng đấu
            </button>
          </div>
        ) : view === 'menu' ? (
          /* MÀN HÌNH 2: CHỌN TẠO PHÒNG HOẶC NHẬP MÃ PHÒNG */
          <div className="flex flex-col gap-3">
            <button
              onClick={onCreateRoom}
              className="w-full p-4 rounded-2xl bg-[#2B2926] hover:bg-[#363431] border border-[#3A3733] hover:border-pink-500/50 flex items-center justify-between group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-600/15 border border-pink-500/30 flex items-center justify-center text-pink-400">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-sm text-white group-hover:text-pink-400 transition-colors">Tạo phòng đấu mới</h4>
                  <p className="text-[11px] text-[#8B8987]">Tạo mã phòng 6 chữ số để gửi cho bạn bè</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setView('join')}
              className="w-full p-4 rounded-2xl bg-[#2B2926] hover:bg-[#363431] border border-[#3A3733] hover:border-emerald-500/50 flex items-center justify-between group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <LogIn className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">Nhập mã phòng có sẵn</h4>
                  <p className="text-[11px] text-[#8B8987]">Nhập mã phòng bạn bè đã gửi để tham gia</p>
                </div>
              </div>
            </button>
          </div>
        ) : (
          /* MÀN HÌNH 3: KHUNG NHẬP MÃ PHÒNG VÀO THAM GIA */
          <form onSubmit={handleJoinSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-[#C3C1C0] mb-2 block text-center">
                Nhập mã phòng 6 chữ số:
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Ví dụ: 849201"
                className="w-full py-3 px-4 rounded-xl bg-[#1C1A17] border border-[#3A3733] text-white text-center font-mono text-2xl font-black tracking-widest focus:outline-none focus:border-pink-500 transition-colors"
              />
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setView('menu')}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#312E2B] hover:bg-[#3B3835] text-[#BAB8B6] font-bold text-xs transition-colors"
              >
                Quay lại
              </button>
              <button
                type="submit"
                disabled={inputCode.length !== 6}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-pink-500/20 active:scale-95 transition-all disabled:opacity-40"
              >
                Vào phòng đấu
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
