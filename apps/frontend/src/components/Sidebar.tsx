import React from 'react';
import { 
  Gamepad2, 
  Puzzle, 
  GraduationCap, 
  Trophy, 
  History, 
  User, 
  Crown, 
  LogOut
} from 'lucide-react';

export type ActiveTab = 'play' | 'puzzles' | 'learn' | 'leaderboard' | 'history' | 'profile';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  user: { username: string; eloRating: number; avatarUrl?: string } | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  user,
  onOpenAuthModal,
  onLogout,
}) => {
  const navItems: { id: ActiveTab; label: string; icon: any; badge?: string }[] = [
    { id: 'play', label: 'Chơi cờ', icon: Gamepad2 },
    { id: 'puzzles', label: 'Giải thế cờ', icon: Puzzle, badge: 'Hot' },
    { id: 'learn', label: 'Học cờ', icon: GraduationCap },
    { id: 'leaderboard', label: 'Xếp hạng', icon: Trophy },
    { id: 'history', label: 'Lịch sử', icon: History },
  ];

  return (
    <aside className="w-16 md:w-60 h-screen bg-[#262421] text-[#C3C1C0] border-r border-[#312E2B] flex flex-col justify-between p-2 md:p-3 shrink-0 select-none z-30">
      {/* Brand Header với Logo Quân Vua & Nền Hồng */}
      <div>
        <div className="flex items-center gap-3 px-2 py-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/30 shrink-0">
            <Crown className="w-6 h-6 fill-white/20" />
          </div>
          <div className="hidden md:block">
            <h1 className="font-black text-lg text-white tracking-wide">Chess Online</h1>
            <p className="text-[11px] text-[#8B8987] font-medium">Nền tảng cờ vua chuẩn quốc tế</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 font-bold text-sm text-left ${
                  isActive
                    ? 'bg-[#363431] text-white shadow-md border-l-4 border-pink-500'
                    : 'hover:bg-[#2F2D2A] text-[#BAB8B6] hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-pink-400' : 'text-[#8B8987]'}`} />
                <span className="hidden md:inline flex-1">{item.label}</span>
                {item.badge && (
                  <span className="hidden md:inline px-2 py-0.5 text-[10px] font-extrabold bg-pink-500/20 text-pink-300 rounded-full border border-pink-500/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Footer / Auth Section */}
      <div className="border-t border-[#312E2B] pt-3 mt-auto">
        {user ? (
          <div className="flex items-center justify-between p-2 rounded-xl bg-[#2F2D2A]">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={user.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=chess'}
                alt="Avatar"
                className="w-8 h-8 rounded-lg bg-[#363431] shrink-0"
              />
              <div className="hidden md:block min-w-0">
                <p className="font-bold text-xs text-white truncate">{user.username}</p>
                <p className="text-[10px] text-amber-400 font-mono">🏆 Elo: {user.eloRating}</p>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Đăng xuất"
              className="p-1.5 hover:bg-[#363431] text-[#8B8987] hover:text-rose-400 rounded-lg transition-colors hidden md:block"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuthModal}
            className="w-full flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-pink-500/30 active:scale-95 transition-all"
          >
            <User className="w-4 h-4" />
            <span className="hidden md:inline">Đăng nhập / Đăng ký</span>
          </button>
        )}
      </div>
    </aside>
  );
};
