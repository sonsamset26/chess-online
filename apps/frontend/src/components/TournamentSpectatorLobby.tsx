import React from 'react';
import { Trophy, Crown, ArrowLeft, Swords, Clock, CheckCircle2, ShieldAlert } from 'lucide-react';
import { TournamentData } from './TournamentModal';

interface TournamentSpectatorLobbyProps {
  tournament: TournamentData | null;
  currentUserId?: string | null;
  currentUsername?: string | null;
  onOpenBracket: () => void;
  onExitTournament: () => void;
}

export const TournamentSpectatorLobby: React.FC<TournamentSpectatorLobbyProps> = ({
  tournament,
  currentUserId,
  currentUsername,
  onOpenBracket,
  onExitTournament,
}) => {
  if (!tournament) {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-[#16202E] border border-[#334155] rounded-3xl text-center flex flex-col items-center gap-4 shadow-2xl">
        <Trophy className="w-10 h-10 text-amber-400" />
        <h3 className="text-base font-bold text-white">Không tìm thấy thông tin giải đấu</h3>
        <button
          onClick={onExitTournament}
          className="px-4 py-2 rounded-xl bg-[#2A374A] hover:bg-[#3B3835] text-slate-200 text-xs font-bold transition-all"
        >
          Trở về Menu Chính
        </button>
      </div>
    );
  }

  const getPlayerName = (uid: string | null) => {
    if (!uid) return 'Chờ đối thủ...';
    const p = tournament.players?.find((item) => item.userId === uid || item.username === uid);
    return p?.username || uid;
  };

  const isCurrentUser = (uid: string | null) => {
    if (!uid) return false;
    return (
      uid === currentUserId ||
      uid === currentUsername ||
      Boolean(
        tournament.players?.some(
          (p) =>
            (p.userId === uid || p.username === uid) &&
            (p.userId === currentUserId || p.username === currentUsername)
        )
      )
    );
  };

  // Xác định Quán quân nếu giải đã xong
  const championPlayer = tournament.championId
    ? tournament.players?.find((p) => p.userId === tournament.championId || p.username === tournament.championId)
    : null;
  const championName = championPlayer?.username || tournament.championId;
  const isUserChampion = Boolean(tournament.championId && isCurrentUser(tournament.championId));

  // Xác định trạng thái của người chơi trong giải đấu
  const isParticipant = Boolean(
    tournament.players?.some((p) => isCurrentUser(p.userId) || isCurrentUser(p.username))
  );
  const currentRoundNumber = tournament.rounds?.length || 1;
  const latestRound = tournament.rounds?.find((r) => r.roundNumber === currentRoundNumber);

  // Tìm trận đấu của người chơi ở vòng hiện tại
  const userMatchInLatestRound = latestRound?.matches?.find(
    (m) => isCurrentUser(m.player1) || isCurrentUser(m.player2)
  );

  let userStatus: 'ELIMINATED' | 'ADVANCING' | 'CHAMPION' | 'SPECTATING' = 'SPECTATING';

  if (tournament.status === 'FINISHED') {
    userStatus = isUserChampion ? 'CHAMPION' : 'ELIMINATED';
  } else if (isParticipant) {
    if (userMatchInLatestRound) {
      if (userMatchInLatestRound.status === 'DONE') {
        const isWinner = isCurrentUser(userMatchInLatestRound.winnerId);
        userStatus = isWinner ? 'ADVANCING' : 'ELIMINATED';
      } else {
        userStatus = 'ADVANCING';
      }
    } else {
      // Không có trận ở vòng này -> đã bị loại ở vòng trước
      userStatus = 'ELIMINATED';
    }
  }

  // Tên vòng đấu hiện tại
  const roundName =
    tournament.size === 8
      ? currentRoundNumber === 1
        ? 'Tứ kết'
        : currentRoundNumber === 2
        ? 'Bán kết'
        : 'Chung kết'
      : currentRoundNumber === 1
      ? 'Bán kết'
      : 'Chung kết';

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center p-3 sm:p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="w-full bg-[#16202E] border border-[#334155] rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col items-center gap-5 text-center relative overflow-hidden">
        {/* Glow background */}
        <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-amber-500/10 to-transparent pointer-events-none" />

        {/* Header Giải Đấu */}
        <div className="flex flex-col items-center gap-2 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Trophy className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-black text-white tracking-wide uppercase">
            Giải Đấu Cờ Vua
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="px-2.5 py-0.5 rounded-full bg-[#0F172A] border border-amber-500/30 text-amber-400 font-mono font-bold">
              #{tournament.code}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#0F172A] border border-[#334155] text-[#CBD5E1] font-medium">
              {tournament.size} người • Loại trực tiếp
            </span>
          </div>
        </div>

        {/* Khối Thông Báo Vị Thế Của Người Chơi */}
        <div className="w-full p-4 rounded-2xl bg-[#0F172A] border border-[#2A374A] flex flex-col gap-2.5 text-left relative z-10">
          {tournament.status === 'FINISHED' ? (
            <div className="flex flex-col items-center text-center gap-1.5 py-1">
              <Crown className="w-7 h-7 text-amber-400 animate-bounce" />
              <span className="text-base font-black text-amber-300">
                🏆 Nhà vô địch: {championName}
              </span>
              <p className="text-xs text-[#94A3B8]">
                Giải đấu đã kết thúc. Bạn có thể mở sơ đồ để xem toàn bộ kết quả các vòng.
              </p>
            </div>
          ) : userStatus === 'ELIMINATED' ? (
            <>
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>Đã dừng bước</span>
                </span>
                <span className="text-[11px] text-[#94A3B8] font-mono">
                  {roundName} đang diễn ra
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Bạn đã dừng bước tại giải đấu này. Bạn có thể tiếp tục mở sơ đồ nhánh đấu để theo dõi diễn biến các cặp đấu còn lại, hoặc quay về menu chính.
              </p>
            </>
          ) : userStatus === 'ADVANCING' ? (
            <>
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Giành quyền đi tiếp</span>
                </span>
                <span className="text-[11px] text-amber-400 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Chờ vòng sau</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Chúc mừng bạn đã giành chiến thắng! Vòng đấu tiếp theo sẽ tự động bắt đầu sau khi các trận đấu cùng vòng kết thúc.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-bold flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-sky-400" />
                  <span>Chế độ khán giả</span>
                </span>
                <span className="text-[11px] text-[#94A3B8] font-mono">
                  {roundName}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Bạn đang theo dõi giải đấu với tư cách khán giả. Hãy mở sơ đồ để xem các trận đấu đang diễn ra.
              </p>
            </>
          )}

          {/* Hiển thị các cặp đấu ở vòng hiện tại nếu đang diễn ra */}
          {tournament.status === 'IN_PROGRESS' && latestRound?.matches && latestRound.matches.length > 0 && (
            <div className="mt-1 pt-2.5 border-t border-[#1E293B] flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider flex items-center gap-1">
                <span>Cặp đấu {roundName}:</span>
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {latestRound.matches.map((m, idx) => {
                  const p1 = getPlayerName(m.player1);
                  const p2 = getPlayerName(m.player2);
                  const isDone = m.status === 'DONE';
                  const isPlaying = m.status === 'PLAYING';

                  return (
                    <div
                      key={`ongoing-${idx}`}
                      className="px-3 py-1.5 rounded-xl bg-[#16202E] border border-[#2A374A] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-semibold text-slate-200 truncate">
                          {p1} vs {p2}
                        </span>
                      </div>
                      <span className="shrink-0 text-[11px] font-mono font-bold">
                        {isDone ? (
                          <span className="text-emerald-400">Đã xong ✓</span>
                        ) : isPlaying ? (
                          <span className="text-amber-400 animate-pulse">Đang đấu ⚔️</span>
                        ) : (
                          <span className="text-[#94A3B8]">Chờ vào trận</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Nút Hành Động */}
        <div className="w-full flex flex-col gap-2.5 relative z-10 pt-1">
          <button
            onClick={onOpenBracket}
            className="w-full py-3 px-5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 transition-all active:scale-98"
          >
            <Trophy className="w-4 h-4" />
            <span>Mở Sơ Đồ Giải Đấu</span>
          </button>

          <button
            onClick={onExitTournament}
            className="w-full py-2.5 px-4 rounded-2xl bg-[#1E293B] hover:bg-[#2A374A] text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 border border-[#334155] transition-all active:scale-98"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Rời Giải Về Menu Chính</span>
          </button>
        </div>
      </div>
    </div>
  );
};
