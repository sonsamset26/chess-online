import React from 'react';
import { Trophy } from 'lucide-react';
interface CurrentUser {
  id?: string;
  username: string;
  eloRating?: number;
}

interface LeaderboardPlayer {
  username: string;
  eloRating?: number;
  wins?: number;
  avatarUrl?: string;
}

interface LeaderboardViewProps {
  user: CurrentUser | null;
  realLeaderboard: LeaderboardPlayer[];
  isLoading: boolean;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  user,
  realLeaderboard,
  isLoading,
}) => {
  const displayPlayers = realLeaderboard.length > 0
    ? realLeaderboard.map((player, idx) => ({
        rank: idx + 1,
        name: player.username,
        elo: player.eloRating || 1200,
        wins: player.wins || 0,
        avatar: player.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(player.username)}`,
      }))
    : [
        { rank: 1, name: 'Magnus Carlsen', elo: 2882, wins: 450, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=magnus' },
        { rank: 2, name: 'Hikaru Nakamura', elo: 2875, wins: 412, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=hikaru' },
        { rank: 3, name: user?.username || 'Kỳ thủ', elo: user?.eloRating || 1200, wins: 12, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=player' },
      ];

  return (
    <div className="w-full max-w-4xl mx-auto h-full overflow-hidden flex flex-col p-2 md:p-4">
      <div className="bg-[#16202E] rounded-2xl border border-[#2A374A] p-4 md:p-6 flex flex-col h-full shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[#2A374A] pb-3 md:pb-4 mb-3 md:mb-4">
          <Trophy className="w-6 h-6 md:w-7 md:h-7 text-amber-400" />
          <div>
            <h2 className="text-base md:text-lg font-black text-white">Bảng Xếp Hạng Kỳ Thủ</h2>
            <p className="text-[11px] md:text-xs text-[#94A3B8]">
              Danh sách những người chơi có điểm xếp hạng cao nhất
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 md:pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-[#94A3B8] text-xs">
              Đang tải danh sách xếp hạng...
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {displayPlayers.map((player) => (
                <div
                  key={player.rank}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#1E293B] border border-[#334155]"
                >
                  <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
                    <span
                      className={`w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center font-black text-[10px] md:text-xs shrink-0 ${
                        player.rank === 1
                          ? 'bg-amber-500 text-slate-950'
                          : player.rank === 2
                          ? 'bg-slate-300 text-slate-950'
                          : 'bg-pink-600 text-white'
                      }`}
                    >
                      #{player.rank}
                    </span>
                    <img
                      src={player.avatar}
                      alt="Avatar"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(player.name)}`;
                      }}
                      className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-[#243247] shrink-0 object-cover"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-xs md:text-sm text-[#FFFFFF] truncate">{player.name}</p>
                      <p className="text-[10px] md:text-[11px] text-[#94A3B8]">Thắng: {player.wins} trận</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-black text-sm md:text-base text-amber-400 font-mono">🏆 {player.elo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
