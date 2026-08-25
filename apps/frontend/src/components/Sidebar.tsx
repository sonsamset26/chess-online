import React from 'react';
import { 
  Gamepad2, 
  Puzzle, 
  GraduationCap, 
  Trophy, 
  History, 
  User, 
  Crown, 
  LogOut,
  X
} from 'lucide-react';

export type ActiveTab = 'play' | 'puzzles' | 'learn' | 'leaderboard' | 'history' | 'profile';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  user: { username: string; eloRating: number; avatarUrl?: string } | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  user,
  onOpenAuthModal,
  onLogout,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const navItems: { id: ActiveTab; label: string; icon: any; badge?: string }[] = [
    { id: 'play', label: 'Chơi cờ', icon: Gamepad2 },
    { id: 'puzzles', label: 'Giải thế cờ', icon: Puzzle, badge: 'Hot' },
    { id: 'learn', label: 'Học cờ', icon: GraduationCap },
    { id: 'leaderboard', label: 'Xếp hạng', icon: Trophy },
    { id: 'history', label: 'Lịch sử', icon: History },
  ];

  const handleTabClick = (tab: ActiveTab) => {
    onSelectTab(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Nền mờ Backdrop trên Mobile khi mở Sidebar */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 md:w-60 h-[100dvh] bg-[#262421] text-[#C3C1C0] border-r border-[#312E2B] flex flex-col justify-between p-3 shrink-0 select-none shadow-2xl md:shadow-none transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header với Logo & Nút đóng trên Mobile */}
        <div>
          <div className="flex items-center justify-between px-2 py-2 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/30 shrink-0">
                <Crown className="w-6 h-6 fill-white/20" />
              </div>
              <div>
                <h1 className="font-black text-base md:text-lg text-white tracking-wide">Chess Online</h1>
                <p className="text-[10px] md:text-[11px] text-[#8B8987] font-medium">Nền tảng cờ vua quốc tế</p>
              </div>
            </div>

            {/* Nút Đóng Sidebar trên Mobile */}
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-xl text-[#8B8987] hover:text-white hover:bg-[#312E2B] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-1.5 mt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 font-bold text-sm text-left ${
                    isActive
                      ? 'bg-[#363431] text-white shadow-md border-l-4 border-pink-500'
                      : 'hover:bg-[#2F2D2A] text-[#BAB8B6] hover:text-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-pink-400' : 'text-[#8B8987]'}`} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-pink-500/20 text-pink-300 rounded-full border border-pink-500/30">
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
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#2F2D2A]">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={user.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=chess'}
                  alt="Avatar"
                  className="w-9 h-9 rounded-lg bg-[#363431] shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-bold text-xs text-white truncate">{user.username}</p>
                  <p className="text-[11px] text-amber-400 font-mono font-bold">🏆 Elo: {user.eloRating}</p>
                </div>
              </div>

              <button
                onClick={onLogout}
                title="Đăng xuất"
                className="p-2 hover:bg-[#363431] text-[#8B8987] hover:text-rose-400 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                onOpenAuthModal();
                if (onCloseMobile) onCloseMobile();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-pink-500/30 active:scale-95 transition-all"
            >
              <User className="w-4 h-4" />
              <span>Đăng nhập / Đăng ký</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
