import React, { useState, useEffect } from 'react';
import { Crown, Trophy, Eye, BarChart2, Loader2, Zap, GitBranch, ListFilter, User } from 'lucide-react';

export interface TournamentPlayer {
  userId: string;
  username: string;
  eloRating?: number;
}

export interface TournamentMatchData {
  matchId: string | null;
  armageddonMatchId?: string | null;
  player1: string | null;
  player2: string | null;
  winnerId: string | null;
  status: 'PENDING' | 'PLAYING' | 'DONE';
}

export interface TournamentRoundData {
  roundNumber: number;
  matches: TournamentMatchData[];
}

export interface TournamentDataProps {
  tournamentId: string;
  code: string;
  size: number;
  status: 'WAITING' | 'IN_PROGRESS' | 'FINISHED';
  players: TournamentPlayer[];
  rounds: TournamentRoundData[];
  championId: string | null;
  roundBreakUntil?: string | Date | null;
}

export interface TournamentBracketViewProps {
  tournament: TournamentDataProps;
  isLive?: boolean;
  countdown?: number | null;
  currentUserId?: string;
  loadingMatchId?: string | null;
  onSelectMatchReplay?: (matchId: string) => void;
  onAnalyzeMatch?: (matchId: string) => void;
}

interface ProjectedMatch {
  roundNumber: number;
  matchIndex: number;
  matchId: string | null;
  armageddonMatchId?: string | null;
  player1: string | null;
  player2: string | null;
  winnerId: string | null;
  status: 'PENDING' | 'PLAYING' | 'DONE';
  source1Text: string;
  source2Text: string;
  isBye?: boolean;
}

interface ProjectedRound {
  roundNumber: number;
  name: string;
  shortName: string;
  matches: ProjectedMatch[];
}

export const TournamentBracketView: React.FC<TournamentBracketViewProps> = ({
  tournament,
  isLive = false,
  countdown,
  currentUserId,
  loadingMatchId,
  onSelectMatchReplay,
  onAnalyzeMatch,
}) => {
  // Chế độ xem: 'tree' (Sơ đồ cây phân nhánh có đường nối) hoặc 'list' (Danh sách vòng)
  // U-02 Fix: Mặc định chế độ 'list' trên màn hình hẹp (<640px) để chống vỡ khung / tràn ngang
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setViewMode('list');
    }
  }, []);

  const size = tournament.size || 4;
  const totalRounds = size === 8 ? 3 : 2;

  // Lấy tên hiển thị của kỳ thủ
  const getPlayerName = (userIdOrName: string | null, fallback: string = 'Chờ xác định') => {
    if (!userIdOrName) return fallback;
    const p = tournament.players.find(
      (player) => player.userId === userIdOrName || player.username === userIdOrName
    );
    return p ? p.username : userIdOrName;
  };

  // Kiểm tra kỳ thủ có phải là người dùng hiện tại không
  const isCurrentUser = (userIdOrName: string | null) => {
    if (!currentUserId || !userIdOrName) return false;
    const p = tournament.players.find(
      (player) => player.userId === userIdOrName || player.username === userIdOrName
    );
    return userIdOrName === currentUserId || (p && (p.userId === currentUserId || p.username === currentUserId));
  };

  // Xây dựng toàn bộ cây giải đấu (Full Projected Bracket Tree)
  const projectedRounds: ProjectedRound[] = [];

  for (let r = 1; r <= totalRounds; r++) {
    const roundMatchesCount = size / Math.pow(2, r);
    const existingRound = tournament.rounds?.find((item) => item.roundNumber === r);

    const roundName = size === 8
      ? (r === 1 ? 'Tứ kết' : r === 2 ? 'Bán kết' : 'Chung kết 🏆')
      : (r === 1 ? 'Bán kết' : 'Chung kết 🏆');

    const shortName = size === 8
      ? (r === 1 ? 'TK' : r === 2 ? 'BK' : 'CK')
      : (r === 1 ? 'BK' : 'CK');

    const prevRoundName = size === 8
      ? (r === 2 ? 'Tứ kết' : 'Bán kết')
      : 'Bán kết';

    const matches: ProjectedMatch[] = [];

    for (let m = 0; m < roundMatchesCount; m++) {
      const existingMatch = existingRound?.matches?.[m];

      // Tìm thông tin người thắng từ 2 trận nhánh trước đó nếu vòng này chưa diễn ra
      const prevRound = projectedRounds[r - 2];
      const parentMatch1 = prevRound?.matches?.[2 * m];
      const parentMatch2 = prevRound?.matches?.[2 * m + 1];

      const p1 = existingMatch?.player1 ?? parentMatch1?.winnerId ?? null;
      const p2 = existingMatch?.player2 ?? parentMatch2?.winnerId ?? null;
      const winner = existingMatch?.winnerId ?? (p1 && !p2 && existingMatch?.status === 'DONE' ? p1 : null);

      const isBye = existingMatch ? Boolean(existingMatch.player1 && !existingMatch.player2) : false;
      const status = existingMatch?.status ?? (p1 && p2 ? 'PENDING' : 'PENDING');

      matches.push({
        roundNumber: r,
        matchIndex: m,
        matchId: existingMatch?.matchId ?? null,
        armageddonMatchId: existingMatch?.armageddonMatchId ?? null,
        player1: p1,
        player2: p2,
        winnerId: winner,
        status: isBye ? 'DONE' : status,
        source1Text: `Thắng ${prevRoundName} #${2 * m + 1}`,
        source2Text: `Thắng ${prevRoundName} #${2 * m + 2}`,
        isBye,
      });
    }

    projectedRounds.push({
      roundNumber: r,
      name: roundName,
      shortName,
      matches,
    });
  }

  // Thông tin Quán quân
  const championId = tournament.championId || projectedRounds[totalRounds - 1]?.matches?.[0]?.winnerId || null;
  const championName = championId ? getPlayerName(championId) : null;
  const isChampionCurrentUser = isCurrentUser(championId);

  // Render 1 thẻ ván đấu (Match Card) dùng chung cho cả 2 view
  const renderMatchCard = (m: ProjectedMatch, isCompact: boolean = false) => {
    const isP1Winner = m.winnerId && m.winnerId === m.player1;
    const isP2Winner = m.winnerId && m.winnerId === m.player2;
    const hasArmageddon = Boolean(m.armageddonMatchId);
    const hasUser = isCurrentUser(m.player1) || isCurrentUser(m.player2);

    return (
      <div
        key={`match-${m.roundNumber}-${m.matchIndex}`}
        className={`rounded-2xl border transition-all select-none ${
          isCompact ? 'w-56 sm:w-60 p-2.5' : 'p-3'
        } ${
          m.status === 'PLAYING'
            ? 'bg-amber-950/30 border-amber-500 shadow-lg shadow-amber-500/15'
            : hasUser
            ? 'bg-[#16202E] border-amber-500/60 shadow-md shadow-amber-500/5'
            : 'bg-[#0F172A] border-[#2A374A] hover:border-[#423E3A]'
        }`}
      >
        {/* Tiêu đề trận & Trạng thái */}
        <div className="flex items-center justify-between text-[10px] text-[#94A3B8] font-bold mb-1.5 pb-1 border-b border-[#1E293B]">
          <span className="flex items-center gap-1">
            <span>Trận #{m.matchIndex + 1}</span>
            {hasUser && (
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] border border-amber-500/40 font-mono">
                BẠN
              </span>
            )}
          </span>

          {m.isBye ? (
            <span className="text-blue-400">Miễn đấu (Bye)</span>
          ) : m.status === 'DONE' ? (
            <span className="text-emerald-400">Đã xong</span>
          ) : m.status === 'PLAYING' ? (
            <span className="text-amber-400 font-extrabold animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              Đang đấu
            </span>
          ) : m.player1 && m.player2 ? (
            <span className="text-sky-400">Sắp diễn ra</span>
          ) : (
            <span className="text-[#6B6966]">Chờ đối thủ</span>
          )}
        </div>

        {/* Danh sách 2 đấu thủ */}
        <div className="flex flex-col gap-1 text-xs">
          {/* Player 1 */}
          <div
            className={`p-1.5 px-2 rounded-xl flex items-center justify-between font-bold transition-colors ${
              isP1Winner
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : m.winnerId && !isP1Winner
                ? 'bg-[#1E293B] text-[#73716E] line-through decoration-[#555]'
                : m.player1
                ? 'bg-[#16202E] text-[#E8E6E3]'
                : 'bg-[#1E293B] text-[#63615E] italic text-[11px]'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              {m.player1 ? (
                <User className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
              ) : (
                <div className="w-3.5 h-3.5 rounded border border-dashed border-[#555] shrink-0" />
              )}
              <span className="truncate">{getPlayerName(m.player1, m.source1Text)}</span>
              {isCurrentUser(m.player1) && (
                <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-mono shrink-0">
                  Tôi
                </span>
              )}
            </div>
            {isP1Winner && <Crown className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />}
          </div>

          {/* Player 2 */}
          <div
            className={`p-1.5 px-2 rounded-xl flex items-center justify-between font-bold transition-colors ${
              m.isBye
                ? 'bg-transparent text-[#53514E] italic text-[11px]'
                : isP2Winner
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : m.winnerId && !isP2Winner
                ? 'bg-[#1E293B] text-[#73716E] line-through decoration-[#555]'
                : m.player2
                ? 'bg-[#16202E] text-[#E8E6E3]'
                : 'bg-[#1E293B] text-[#63615E] italic text-[11px]'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              {m.player2 ? (
                <User className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
              ) : (
                <div className="w-3.5 h-3.5 rounded border border-dashed border-[#555] shrink-0" />
              )}
              <span className="truncate">
                {m.isBye ? '(Không có đối thủ)' : getPlayerName(m.player2, m.source2Text)}
              </span>
              {isCurrentUser(m.player2) && (
                <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-mono shrink-0">
                  Tôi
                </span>
              )}
            </div>
            {isP2Winner && <Crown className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />}
          </div>
        </div>

        {/* Nút Xem lại / Phân tích khi xem lịch sử */}
        {!isLive && m.status === 'DONE' && (m.matchId || m.armageddonMatchId) && (
          <div className="mt-2 pt-2 border-t border-[#1E293B] flex flex-col gap-1.5">
            {m.matchId && (
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <span className="text-[#94A3B8] font-semibold">
                  {hasArmageddon ? 'Ván chính:' : 'Ván cờ:'}
                </span>
                <div className="flex items-center gap-1.5">
                  {onSelectMatchReplay && (
                    <button
                      onClick={() => onSelectMatchReplay(m.matchId!)}
                      disabled={loadingMatchId === m.matchId}
                      className="px-2 py-1 rounded-lg bg-[#2A2825] hover:bg-[#2A374A] text-[#E8E6E3] font-bold text-[10px] flex items-center gap-1 border border-[#3A3835] transition-all active:scale-95 disabled:opacity-50"
                      title="Xem lại ván đấu"
                    >
                      {loadingMatchId === m.matchId ? (
                        <Loader2 className="w-3 h-3 animate-spin text-pink-400" />
                      ) : (
                        <Eye className="w-3 h-3 text-pink-400" />
                      )}
                      <span>Xem</span>
                    </button>
                  )}
                  {onAnalyzeMatch && (
                    <button
                      onClick={() => onAnalyzeMatch(m.matchId!)}
                      disabled={loadingMatchId === m.matchId}
                      className="px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-bold text-[10px] flex items-center gap-1 border border-indigo-500/30 transition-all active:scale-95 disabled:opacity-50"
                      title="Phân tích Stockfish"
                    >
                      <BarChart2 className="w-3 h-3 text-indigo-400" />
                      <span>Phân tích</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {hasArmageddon && m.armageddonMatchId && (
              <div className="flex items-center justify-between gap-1 text-[11px] bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
                <span className="text-amber-300 font-bold flex items-center gap-1 text-[10px]">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Armageddon:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {onSelectMatchReplay && (
                    <button
                      onClick={() => onSelectMatchReplay(m.armageddonMatchId!)}
                      disabled={loadingMatchId === m.armageddonMatchId}
                      className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold text-[10px] flex items-center gap-1 border border-amber-500/40 transition-all active:scale-95 disabled:opacity-50"
                      title="Xem lại ván Armageddon"
                    >
                      {loadingMatchId === m.armageddonMatchId ? (
                        <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                      ) : (
                        <Eye className="w-3 h-3 text-amber-400" />
                      )}
                      <span>Xem</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* THANH ĐIỀU HƯỚNG VIEW & BANNER ĐẾM NGƯỢC */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Toggle Chế độ xem */}
        <div className="flex items-center gap-1 p-1 bg-[#1A1816] rounded-xl border border-[#2A374A] self-start">
          <button
            onClick={() => setViewMode('tree')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              viewMode === 'tree'
                ? 'bg-amber-600 text-white shadow'
                : 'text-[#94A3B8] hover:text-[#E8E6E3]'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Sơ đồ Phân nhánh</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              viewMode === 'list'
                ? 'bg-amber-600 text-white shadow'
                : 'text-[#94A3B8] hover:text-[#E8E6E3]'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>Danh sách Vòng</span>
          </button>
        </div>

        {/* Banner đếm ngược thời gian (Live mode) */}
        {isLive && typeof countdown === 'number' && countdown > 0 && (
          <div className="py-2 px-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between sm:justify-end gap-3 shadow-lg shadow-amber-500/10 animate-pulse">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <span>⚔️ Vào trận sau:</span>
            </div>
            <div className="font-mono font-black text-xs sm:text-sm bg-black/60 px-2.5 py-0.5 rounded-lg border border-amber-500/40 text-amber-300 shadow-inner">
              <span>00:{countdown < 10 ? `0${countdown}` : countdown}</span>
            </div>
          </div>
        )}
      </div>

      {/* VIEW 1: SƠ ĐỒ CÂY PHÂN NHÁNH ĐẤU (TREE BRACKET WITH CONNECTORS) */}
      {viewMode === 'tree' && (
        <div className="w-full flex flex-col">
          <div className="sm:hidden flex items-center justify-end gap-1 text-[11px] text-[#94A3B8] pb-1 px-1">
            <span>Vuốt ngang để xem toàn bộ nhánh đấu</span>
            <span>→</span>
          </div>
          <div className="w-full overflow-x-auto custom-scrollbar pb-4 pt-1">
            <div className="min-w-fit flex items-stretch gap-0 px-2">
            {projectedRounds.map((round, rIdx) => {
              const nextRound = projectedRounds[rIdx + 1];
              const isLastRound = rIdx === projectedRounds.length - 1;

              return (
                <React.Fragment key={`round-col-${round.roundNumber}`}>
                  {/* CỘT CÁC VÁN ĐẤU CỦA VÒNG */}
                  <div className="flex flex-col gap-2 min-w-[220px] sm:min-w-[240px]">
                    {/* Header Cột */}
                    <div className="text-center pb-2 border-b border-[#2A374A]">
                      <span className="text-[11px] font-extrabold text-amber-400 font-mono uppercase tracking-wider block">
                        VÒNG {round.roundNumber}
                      </span>
                      <span className="text-xs font-bold text-[#E8E6E3]">
                        {round.name}
                      </span>
                    </div>

                    {/* Danh sách các thẻ trận đấu, canh đều từ trên xuống */}
                    <div className="flex-1 flex flex-col justify-around gap-4 py-2 min-h-[300px]">
                      {round.matches.map((m) => renderMatchCard(m, true))}
                    </div>
                  </div>

                  {/* CỘT ĐƯỜNG NỐI (CONNECTOR FORKS) SANG VÒNG KẾ TIẾP */}
                  {nextRound && (
                    <div className="w-8 sm:w-12 flex flex-col justify-around py-2 min-h-[300px] shrink-0">
                      {nextRound.matches.map((_, nextMatchIdx) => {
                        const topMatch = round.matches[2 * nextMatchIdx];
                        const bottomMatch = round.matches[2 * nextMatchIdx + 1];

                        const isTopDone = topMatch?.status === 'DONE' && Boolean(topMatch?.winnerId);
                        const isBottomDone = bottomMatch?.status === 'DONE' && Boolean(bottomMatch?.winnerId);

                        const isTopUser = isCurrentUser(topMatch?.player1) || isCurrentUser(topMatch?.player2);
                        const isBottomUser = isCurrentUser(bottomMatch?.player1) || isCurrentUser(bottomMatch?.player2);

                        const topColor = isTopDone
                          ? '#10B981'
                          : isTopUser
                          ? '#F59E0B'
                          : '#787571';

                        const bottomColor = isBottomDone
                          ? '#10B981'
                          : isBottomUser
                          ? '#F59E0B'
                          : '#787571';

                        return (
                          <div
                            key={`connector-${rIdx}-${nextMatchIdx}`}
                            className="h-full flex items-center justify-center relative"
                          >
                            <svg
                              className="w-full h-full select-none"
                              viewBox="0 0 48 100"
                              preserveAspectRatio="none"
                            >
                              {/* Nhánh từ trận trên đi ra và rẽ xuống điểm giữa */}
                              <path
                                d="M 0,25 H 24 V 50 H 48"
                                fill="none"
                                stroke={topColor}
                                strokeWidth={isTopDone || isTopUser ? '2.5' : '1.5'}
                                strokeDasharray={(!isTopDone && !isTopUser) ? '4 3' : undefined}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              {/* Nhánh từ trận dưới đi ra và rẽ lên điểm giữa */}
                              <path
                                d="M 0,75 H 24 V 50"
                                fill="none"
                                stroke={bottomColor}
                                strokeWidth={isBottomDone || isBottomUser ? '2.5' : '1.5'}
                                strokeDasharray={(!isBottomDone && !isBottomUser) ? '4 3' : undefined}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* CỘT ĐƯỜNG NỐI CUỐI CÙNG TỚI CÚP QUÁN QUÂN */}
                  {isLastRound && (
                    <>
                      <div className="w-8 sm:w-12 flex flex-col justify-center py-2 min-h-[300px] shrink-0">
                        <svg
                          className="w-full h-20 select-none"
                          viewBox="0 0 48 100"
                          preserveAspectRatio="none"
                        >
                          <path
                            d="M 0,50 H 48"
                            fill="none"
                            stroke={championId ? '#F59E0B' : '#787571'}
                            strokeWidth={championId ? '3' : '1.5'}
                            strokeDasharray={!championId ? '4 3' : undefined}
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>

                      {/* KHỐI VINH DANH QUÁN QUÂN */}
                      <div className="flex flex-col justify-center min-w-[190px] sm:min-w-[210px] py-2">
                        <div
                          className={`p-4 rounded-3xl border flex flex-col items-center text-center relative overflow-hidden transition-all ${
                            championId
                              ? 'bg-gradient-to-b from-amber-500/20 via-[#16202E] to-[#0F172A] border-amber-500 shadow-xl shadow-amber-500/20'
                              : 'bg-[#0F172A] border-[#2A374A]'
                          }`}
                        >
                          <div
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-lg ${
                              championId
                                ? 'bg-gradient-to-tr from-amber-500 to-orange-400 text-black shadow-amber-500/30'
                                : 'bg-[#16202E] text-[#63615E] border border-[#334155]'
                            }`}
                          >
                            <Trophy className="w-7 h-7" />
                          </div>

                          <span className="text-[10px] font-extrabold text-amber-400 font-mono uppercase tracking-widest mb-1">
                            🏆 NHÀ VÔ ĐỊCH
                          </span>

                          <h4 className="text-sm font-black text-white truncate max-w-[170px] mb-1">
                            {championName || 'Đang xác định...'}
                          </h4>

                          {isChampionCurrentUser && (
                            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40">
                              🎉 BẠN VÔ ĐỊCH
                            </span>
                          )}

                          {!championId && (
                            <span className="text-[10px] text-[#94A3B8] italic">
                              Cạnh tranh danh hiệu
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {/* VIEW 2: DANH SÁCH VÒNG DẠNG STACK (COMPACT LIST VIEW) */}
      {viewMode === 'list' && (
        <div className="flex flex-col gap-4">
          {projectedRounds.map((round) => (
            <div key={`list-round-${round.roundNumber}`} className="flex flex-col gap-2">
              <span className="text-[11px] font-extrabold text-amber-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
                <span>VÒNG {round.roundNumber}</span>
                <span className="text-[#94A3B8]">• {round.name}</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {round.matches.map((m) => renderMatchCard(m, false))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
