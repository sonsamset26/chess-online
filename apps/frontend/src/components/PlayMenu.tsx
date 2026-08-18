import React from 'react';
import { 
  Zap, 
  Bot, 
  GraduationCap, 
  Users, 
  Trophy, 
  Puzzle,
  ChevronRight
} from 'lucide-react';

export type GameModeSelection = 'online' | 'bots' | 'friend' | 'puzzles' | 'tournament';

interface PlayMenuProps {
  onSelectMode: (mode: GameModeSelection) => void;
}

export const PlayMenu: React.FC<PlayMenuProps> = ({ onSelectMode }) => {
  const menuOptions: {
    id: GameModeSelection;
    title: string;
    description: string;
    icon: any;
    iconBg: string;
    iconColor: string;
    badge?: string;
  }[] = [
    {
      id: 'online',
      title: 'Đấu Trực tuyến (Play Online)',
      description: 'Đánh với người chơi có cùng trình độ Elo',
      icon: Zap,
      iconBg: 'bg-amber-500/20 border-amber-500/30',
      iconColor: 'text-amber-400',
      badge: 'Hot',
    },
    {
      id: 'bots',
      title: 'Đánh với Máy (Play Bots)',
      description: 'Thách thức AI Stockfish từ Dễ đến Master',
      icon: Bot,
      iconBg: 'bg-blue-500/20 border-blue-500/30',
      iconColor: 'text-blue-400',
    },
    {
      id: 'friend',
      title: 'Đấu với Bạn bè (Play a Friend)',
      description: 'Tạo phòng private và gửi link mời bạn bè',
      icon: Users,
      iconBg: 'bg-purple-500/20 border-purple-500/30',
      iconColor: 'text-purple-400',
    },
    {
      id: 'puzzles',
      title: 'Giải cờ thế (Chess Puzzles)',
      description: 'Rèn luyện tư duy chiến thuật qua các bài cờ khó',
      icon: Puzzle,
      iconBg: 'bg-emerald-500/20 border-emerald-500/30',
      iconColor: 'text-emerald-400',
    },
    {
      id: 'tournament',
      title: 'Giải đấu (Tournaments)',
      description: 'Tham gia giải đấu loại trực tiếp 4-8+ người chơi',
      icon: Trophy,
      iconBg: 'bg-rose-500/20 border-rose-500/30',
      iconColor: 'text-rose-400',
      badge: 'Phase 2',
    },
  ];

  return (
    <div className="w-full h-full bg-[#262421] rounded-2xl border border-[#312E2B] p-4 flex flex-col justify-between shadow-2xl overflow-y-auto custom-scrollbar select-none">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between border-b border-[#312E2B] pb-3 mb-3">
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <span className="text-xl">♟️</span> Chọn Chế độ chơi
          </h2>
          <span className="text-xs text-[#8B8987] font-medium">Chess.com Style</span>
        </div>

        {/* Menu Cards List - Khớp 100% giao diện ảnh chụp */}
        <div className="flex flex-col gap-2.5">
          {menuOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                onClick={() => onSelectMode(option.id)}
                className="w-full flex items-center justify-between p-3.5 rounded-xl bg-[#2F2D2A] hover:bg-[#383531] border border-[#3A3733] hover:border-emerald-500/50 transition-all duration-200 group text-left shadow-md"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`p-2.5 rounded-xl border ${option.iconBg} ${option.iconColor} shrink-0 group-hover:scale-105 transition-transform`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors truncate">
                        {option.title}
                      </h3>
                      {option.badge && (
                        <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                          {option.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#989693] truncate mt-0.5">
                      {option.description}
                    </p>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-[#63615E] group-hover:text-white group-hover:translate-x-1 transition-all shrink-0 ml-2" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-3 border-t border-[#312E2B] text-center">
        <p className="text-[11px] text-[#787673]">
          Mọi nước đi trực tuyến đều được xác thực phía Server (Anti-cheat)
        </p>
      </div>
    </div>
  );
};
