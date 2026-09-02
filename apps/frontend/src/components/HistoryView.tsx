import React, { useState, useEffect } from 'react';
import { History, Swords, Calendar, Eye, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, Trophy, Crown, BarChart2 } from 'lucide-react';

export interface MatchRecord {
  _id: string;
  whiteUserId: string;
  blackUserId: string;
  whiteUsername: string;
  blackUsername: string;
  gameMode: 'PV_AI' | 'PVP_RATED' | 'PVP_CUSTOM' | 'TOURNAMENT';
  winnerColor: 'w' | 'b' | 'draw';
  endReason: 'CHECKMATE' | 'TIMEOUT' | 'RESIGNED' | 'ABANDONED' | 'DRAW';
  isRated: boolean;
  whiteEloDelta?: number;
  blackEloDelta?: number;
  whiteOldElo?: number;
  blackOldElo?: number;
  moves: string[];
  pgn: string;
  finalFen: string;
  movesCount: number;
  timeControl?: {
    initialSeconds: number;
    incrementSeconds: number;
  };
  startedAt: string;
  endedAt?: string;
  createdAt: string;
}

export interface TournamentRecord {
  tournamentId: string;
  code: string;
  size: number;
  status: string;
  createdAt: string;
  championId: string | null;
  championName: string;
  myResult: {
    placement: number | null;
    roundReached: number;
    roundName: string;
    isChampion: boolean;
    wins: number;
    losses: number;
  };
  playersCount: number;
}

interface HistoryViewProps {
  currentUser: { id?: string; username: string; eloRating: number; token?: string } | null;
  onSelectReplay: (match: MatchRecord) => void;
  onOpenAnalysis?: (match: MatchRecord) => void;
  onOpenTournamentDetail?: (tournamentIdOrCode: string) => void;
  onOpenTournamentModal?: () => void;
  initialSubTab?: 'matches' | 'tournaments';
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  currentUser,
  onSelectReplay,
  onOpenAnalysis,
  onOpenTournamentDetail,
  onOpenTournamentModal,
  initialSubTab = 'matches',
}) => {
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Trạng thái phân trang
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMatches, setTotalMatches] = useState(0);

  const fetchHistory = async (targetPage: number = page) => {
    if (!currentUser?.username) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let token = currentUser.token || (typeof window !== 'undefined' ? localStorage.getItem('chess_token') : null);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

      if (!token) {
        setMatches([]);
        setError('Vui lòng đăng nhập để xem lịch sử ván đấu cá nhân.');
        setLoading(false);
        return;
      }

      // 1. Gọi trực tiếp API bảo mật /matches/me qua JWT
      let res = await fetch(`${apiUrl}/api/v1/matches/me?page=${targetPage}&limit=10`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // 2. Nếu accessToken hết hạn (401), tự động thực hiện Silent Refresh Token
      if (res.status === 401) {
        try {
          const refreshRes = await fetch(`${apiUrl}/api/v1/auth/refresh-token`, {
            method: 'POST',
            credentials: 'include', // Gửi httpOnly cookie refreshToken
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData.success && refreshData.data?.accessToken) {
              token = refreshData.data.accessToken;
              if (typeof window !== 'undefined') {
                localStorage.setItem('chess_token', token as string);
              }
              // Thử lại request lấy lịch sử với token mới
              res = await fetch(`${apiUrl}/api/v1/matches/me?page=${targetPage}&limit=10`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
            }
          }
        } catch (refreshErr) {
          console.warn('Làm mới phiên đăng nhập thất bại:', refreshErr);
        }
      }

      if (res.status === 401) {
        setMatches([]);
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại tài khoản.');
        return;
      }

      const data = await res.json();

      if (data && data.success && data.data) {
        if (Array.isArray(data.data)) {
          setMatches(data.data);
          setTotalPages(1);
          setTotalMatches(data.data.length);
        } else if (data.data.matches && Array.isArray(data.data.matches)) {
          setMatches(data.data.matches);
          if (data.data.pagination) {
            setTotalPages(data.data.pagination.totalPages || 1);
            setTotalMatches(data.data.pagination.total || 0);
          }
        }
      } else {
        setMatches([]);
        if (data?.message) {
          setError(data.message);
        }
      }
    } catch (err: any) {
      console.error('Lỗi tải lịch sử trận đấu:', err);
      setError('Không thể kết nối máy chủ để tải lịch sử thi đấu.');
    } finally {
      setLoading(false);
    }
  };

  const [activeSubTab, setActiveSubTab] = useState<'matches' | 'tournaments'>(initialSubTab);

  // Trạng thái Lịch sử giải đấu
  const [tournaments, setTournaments] = useState<TournamentRecord[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);
  const [tournamentsError, setTournamentsError] = useState<string | null>(null);
  const [tournamentsPage, setTournamentsPage] = useState(1);
  const [tournamentsTotalPages, setTournamentsTotalPages] = useState(1);
  const [tournamentsTotal, setTournamentsTotal] = useState(0);
  const [tournamentsFetched, setTournamentsFetched] = useState(false);

  const fetchTournaments = async (targetPage: number = tournamentsPage) => {
    if (!currentUser?.username) return;
    try {
      setTournamentsLoading(true);
      setTournamentsError(null);

      const token = currentUser.token || (typeof window !== 'undefined' ? localStorage.getItem('chess_token') : null);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

      if (!token) {
        setTournamentsError('Vui lòng đăng nhập để xem lịch sử giải đấu.');
        setTournamentsLoading(false);
        return;
      }

      const res = await fetch(`${apiUrl}/api/v1/tournaments/me?page=${targetPage}&limit=10`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setTournaments(data.data.tournaments || []);
        if (data.data.pagination) {
          setTournamentsPage(data.data.pagination.page);
          setTournamentsTotalPages(data.data.pagination.totalPages);
          setTournamentsTotal(data.data.pagination.total);
        }
        setTournamentsFetched(true);
      } else {
        setTournamentsError(data.message || 'Không thể tải lịch sử giải đấu');
      }
    } catch (err: any) {
      setTournamentsError(err?.message || 'Lỗi kết nối khi tải lịch sử giải đấu');
    } finally {
      setTournamentsLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'matches') {
      fetchHistory(page);
    } else {
      fetchTournaments(tournamentsPage);
    }
  }, [currentUser?.username, page, tournamentsPage, activeSubTab]);

  if (!currentUser) {
    return (
      <div className="w-full max-w-4xl mx-auto h-full flex items-center justify-center p-4">
        <div className="bg-[#262421] rounded-2xl border border-[#312E2B] p-8 text-center max-w-md shadow-2xl">
          <History className="w-12 h-12 text-[#8B8987] mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-2">Vui lòng đăng nhập</h3>
          <p className="text-xs text-[#8B8987]">
            Bạn cần đăng nhập tài khoản để lưu trữ và xem lại toàn bộ lịch sử các ván đấu đã tham gia.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto h-full overflow-hidden flex flex-col p-2 md:p-4">
      <div className="bg-[#262421] rounded-2xl border border-[#312E2B] p-4 md:p-6 flex flex-col h-full shadow-2xl justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#312E2B] pb-3 md:pb-4 mb-3 md:mb-4">
            <div className="flex items-center gap-3">
              <History className="w-6 h-6 md:w-7 md:h-7 text-pink-500" />
              <div>
                <h2 className="text-base md:text-lg font-black text-white">Lịch Sử Thi Đấu</h2>
                <p className="text-[11px] md:text-xs text-[#8B8987]">
                  Danh sách các ván cờ và giải đấu của kỳ thủ <span className="text-pink-400 font-bold">{currentUser.username}</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (activeSubTab === 'matches') {
                  fetchHistory(page);
                } else {
                  fetchTournaments(tournamentsPage);
                }
              }}
              disabled={activeSubTab === 'matches' ? loading : tournamentsLoading}
              className="p-2 rounded-xl bg-[#2F2D2A] hover:bg-[#3A3733] border border-[#3A3733] text-[#8B8987] hover:text-white transition-colors"
              title="Làm mới danh sách"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  (activeSubTab === 'matches' ? loading : tournamentsLoading)
                    ? 'animate-spin text-pink-400'
                    : ''
                }`}
              />
            </button>
          </div>

          {/* TAB ĐIỀU HƯỚNG: VÁN ĐẤU CÁ NHÂN vs GIẢI ĐẤU */}
          <div className="flex items-center gap-2 mb-3 md:mb-4 bg-[#1C1A17] p-1 rounded-xl border border-[#312E2B] w-fit">
            <button
              onClick={() => setActiveSubTab('matches')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'matches'
                  ? 'bg-pink-600 text-white shadow-md'
                  : 'text-[#8B8987] hover:text-white hover:bg-[#2A2825]'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Ván Đấu Cá Nhân</span>
            </button>
            <button
              onClick={() => setActiveSubTab('tournaments')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'tournaments'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-[#8B8987] hover:text-white hover:bg-[#2A2825]'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Giải Đấu Đã Tham Gia</span>
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(100vh-260px)] custom-scrollbar pr-1 md:pr-2">
            {activeSubTab === 'matches' ? (
              // TAB 1: VÁN ĐẤU CÁ NHÂN
              loading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-[#8B8987]">
                  <RefreshCw className="w-6 h-6 animate-spin text-pink-500" />
                  <span className="text-xs">Đang tải lịch sử ván cờ từ máy chủ...</span>
                </div>
              ) : error ? (
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{error}</span>
                  </div>
                  <button
                    onClick={() => fetchHistory(page)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-bold text-xs transition-colors shrink-0"
                  >
                    Thử lại
                  </button>
                </div>
              ) : matches.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-56 text-center text-[#8B8987] gap-3">
                  <div className="p-4 rounded-full bg-[#1C1A17] border border-[#312E2B]">
                    <Swords className="w-8 h-8 text-[#73716E]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Chưa có ván đấu nào được ghi nhận</p>
                    <p className="text-xs text-[#8B8987] mt-1">
                      Hãy tham gia thi đấu Đấu Xếp Hạng (Rated) hoặc Đấu Bạn Bè để bắt đầu ghi lại lịch sử!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {matches.map((m) => {
                    const isWhite = m.whiteUsername === currentUser.username;
                    const myColor = isWhite ? 'w' : 'b';
                    const oppName = isWhite ? m.blackUsername : m.whiteUsername;

                    const isWin = m.winnerColor === myColor;
                    const isLose = m.winnerColor !== 'draw' && m.winnerColor !== myColor;

                    const eloDelta = isWhite ? m.whiteEloDelta : m.blackEloDelta;

                    // Format thời gian
                    const dateStr = new Date(m.createdAt).toLocaleString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    });

                    // Format Game Mode
                    const gameModeLabel =
                      m.gameMode === 'PV_AI'
                        ? 'Đấu với Bot AI'
                        : m.gameMode === 'PVP_RATED'
                        ? 'Đấu Xếp Hạng'
                        : m.gameMode === 'TOURNAMENT'
                        ? 'Đấu Giải Đấu'
                        : 'Đấu Bạn Bè';

                    // Format End Reason
                    const endReasonLabel =
                      m.endReason === 'CHECKMATE'
                        ? 'Chiếu hết'
                        : m.endReason === 'TIMEOUT'
                        ? 'Hết giờ'
                        : m.endReason === 'RESIGNED'
                        ? 'Đầu hàng'
                        : m.endReason === 'ABANDONED'
                        ? 'Rời trận'
                        : 'Hòa cờ';

                    return (
                      <div
                        key={m._id}
                        className={`p-3 md:p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 shadow-md ${
                          isWin
                            ? 'bg-[#1D241C] border-emerald-500/30 hover:border-emerald-500/60'
                            : isLose
                            ? 'bg-[#241C1D] border-rose-500/30 hover:border-rose-500/60'
                            : 'bg-[#1F1E1B] border-[#312E2B] hover:border-[#4A4742]'
                        }`}
                      >
                        {/* Cột trái: Kết quả & Đối thủ */}
                        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                          {/* Badge Thắng/Thua */}
                          <div
                            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center font-black text-xs md:text-sm shrink-0 uppercase tracking-wider ${
                              isWin
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : isLose
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            }`}
                          >
                            {isWin ? 'Thắng' : isLose ? 'Thua' : 'Hòa'}
                          </div>

                          {/* Thông tin ván cờ */}
                          <div className="overflow-hidden">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-sm md:text-base text-white truncate max-w-[140px] md:max-w-[200px]">
                                vs {oppName}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  m.isRated
                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                    : 'bg-[#2F2D2A] text-[#8B8987] border-[#3A3733]'
                                }`}
                              >
                                {gameModeLabel}
                              </span>
                            </div>

                            <p className="text-[10px] md:text-[11px] text-[#8B8987] flex items-center gap-2 mt-0.5">
                              <span>{endReasonLabel} ({m.movesCount} nước)</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-[#73716E]" />
                                {dateStr}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Biến động Elo và nút xem lại */}
                        <div className="flex items-center gap-3 shrink-0">
                          {m.isRated && eloDelta !== undefined && (
                            <div className="text-right hidden sm:block">
                              <p
                                className={`font-mono font-black text-xs md:text-sm ${
                                  eloDelta > 0
                                    ? 'text-emerald-400'
                                    : eloDelta < 0
                                    ? 'text-rose-400'
                                    : 'text-amber-400'
                                }`}
                              >
                                {eloDelta > 0 ? `+${eloDelta}` : eloDelta} Elo
                              </p>
                            </div>
                          )}

                          <button
                            onClick={() => onSelectReplay(m)}
                            className="px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-xl bg-[#1C1A17] hover:bg-pink-600 hover:text-white border border-[#3A3733] text-[#C3C0B8] font-bold text-xs flex items-center gap-1.5 shadow transition-all active:scale-95"
                            title="Xem lại ván cờ trên bàn"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Xem lại</span>
                          </button>

                          {onOpenAnalysis && m.moves && m.moves.length > 0 && (
                            <button
                              onClick={() => onOpenAnalysis(m)}
                              className="px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 text-indigo-300 font-bold text-xs flex items-center gap-1.5 shadow transition-all active:scale-95"
                              title="Phân tích ván cờ với AI Engine"
                            >
                              <span>📊</span>
                              <span className="hidden sm:inline">Phân tích</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              // TAB 2: GIẢI ĐẤU ĐÃ THAM GIA
              tournamentsLoading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-[#8B8987]">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                  <span className="text-xs">Đang tải danh sách giải đấu...</span>
                </div>
              ) : tournamentsError ? (
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{tournamentsError}</span>
                  </div>
                  <button
                    onClick={() => fetchTournaments(tournamentsPage)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-bold text-xs transition-colors shrink-0"
                  >
                    Thử lại
                  </button>
                </div>
              ) : tournaments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-56 text-center text-[#8B8987] gap-3">
                  <div className="p-4 rounded-full bg-[#1C1A17] border border-[#312E2B]">
                    <Trophy className="w-8 h-8 text-amber-500/40" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Chưa tham gia giải đấu nào</p>
                    <p className="text-xs text-[#8B8987] mt-1 mb-3">
                      Hãy tạo hoặc nhập mã tham gia Giải đấu loại trực tiếp để tranh cúp Quán quân!
                    </p>
                    {onOpenTournamentModal && (
                      <button
                        onClick={onOpenTournamentModal}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs shadow-lg shadow-amber-900/30 transition-all flex items-center gap-1.5 mx-auto"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        <span>🏆 Tham Gia Giải Đấu Ngay</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {tournaments.map((t) => {
                    const dateStr = new Date(t.createdAt).toLocaleString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    });

                    const res = t.myResult;

                    return (
                      <div
                        key={t.tournamentId}
                        className="p-3 md:p-4 rounded-2xl bg-[#1C1A17] border border-[#312E2B] hover:border-amber-500/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md"
                      >
                        {/* Cột trái: Tên giải & Badge thành tích */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                            <Trophy className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-white">
                                Giải Đấu #{t.code}
                              </span>
                              {t.status === 'IN_PROGRESS' ? (
                                res.losses > 0 ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                    DỪNG BƯỚC ({res.roundName || 'Vòng bảng'})
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 animate-pulse">
                                    <span>⚔️</span>
                                    <span>ĐANG THI ĐẤU</span>
                                  </span>
                                )
                              ) : res.isChampion ? (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                  <Crown className="w-3 h-3 text-amber-400" />
                                  <span>VÔ ĐỊCH 🥇</span>
                                </span>
                              ) : res.placement === 2 ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-400/20 text-slate-300 border border-slate-400/40">
                                  Á QUÂN 🥈
                                </span>
                              ) : res.placement === 3 ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-700/20 text-amber-500 border border-amber-700/40">
                                  BÁN KẾT 🥉
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#2F2D2A] text-[#8B8987]">
                                  {res.roundName || 'Vòng bảng'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-[#8B8987] font-medium mt-1">
                              <span>Quy mô: {t.size} kỳ thủ</span>
                              <span>•</span>
                              <span>Thắng {res.wins} / Thua {res.losses}</span>
                              <span>•</span>
                              <span className="text-[#63615E]">{dateStr}</span>
                            </div>
                          </div>
                        </div>

                        {/* Cột phải: Nút mở sơ đồ giải */}
                        <button
                          onClick={() => onOpenTournamentDetail && onOpenTournamentDetail(t.tournamentId || t.code)}
                          className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-400" />
                          <span>Xem Nhánh Đấu</span>
                          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>

        {/* Thanh phân trang Pagination */}
        {activeSubTab === 'matches' ? (
          matches.length > 0 && (
            <div className="pt-3 mt-2 border-t border-[#312E2B] flex items-center justify-between text-xs text-[#8B8987] shrink-0">
              <span>Tổng số {totalMatches} ván đấu</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    disabled={loading || page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg bg-[#2F2D2A] hover:bg-[#3A3733] border border-[#3A3733] text-white disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Trang trước</span>
                  </button>
                  <span className="font-mono font-bold text-white px-1">
                    {page} / {totalPages}
                  </span>
                  <button
                    disabled={loading || page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 rounded-lg bg-[#2F2D2A] hover:bg-[#3A3733] border border-[#3A3733] text-white disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1"
                  >
                    <span>Trang sau</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )
        ) : (
          tournaments.length > 0 && (
            <div className="pt-3 mt-2 border-t border-[#312E2B] flex items-center justify-between text-xs text-[#8B8987] shrink-0">
              <span>Tổng số {tournamentsTotal} giải đấu</span>
              {tournamentsTotalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    disabled={tournamentsLoading || tournamentsPage <= 1}
                    onClick={() => setTournamentsPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg bg-[#2F2D2A] hover:bg-[#3A3733] border border-[#3A3733] text-white disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Trang trước</span>
                  </button>
                  <span className="font-mono font-bold text-white px-1">
                    {tournamentsPage} / {tournamentsTotalPages}
                  </span>
                  <button
                    disabled={tournamentsLoading || tournamentsPage >= tournamentsTotalPages}
                    onClick={() => setTournamentsPage((p) => Math.min(tournamentsTotalPages, p + 1))}
                    className="px-2.5 py-1 rounded-lg bg-[#2F2D2A] hover:bg-[#3A3733] border border-[#3A3733] text-white disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1"
                  >
                    <span>Trang sau</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
};
