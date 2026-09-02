import React, { useState, useEffect } from 'react';
import { History, Swords, Calendar, Eye, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

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

interface HistoryViewProps {
  currentUser: { username: string; eloRating: number; token?: string } | null;
  onSelectReplay: (match: MatchRecord) => void;
  onOpenAnalysis?: (match: MatchRecord) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ currentUser, onSelectReplay, onOpenAnalysis }) => {
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

  useEffect(() => {
    fetchHistory(page);
  }, [currentUser?.username, page]);

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
                  Danh sách các ván cờ của kỳ thủ <span className="text-pink-400 font-bold">{currentUser.username}</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => fetchHistory(page)}
              disabled={loading}
              className="p-2 rounded-xl bg-[#2F2D2A] hover:bg-[#3A3733] border border-[#3A3733] text-[#8B8987] hover:text-white transition-colors"
              title="Làm mới danh sách"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-pink-400' : ''}`} />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(100vh-260px)] custom-scrollbar pr-1 md:pr-2">
            {loading ? (
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
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  // Format thể thức thời gian (ví dụ: 10+0, 5+3)
                  const timeControlLabel = m.timeControl
                    ? `${Math.round(m.timeControl.initialSeconds / 60)}+${m.timeControl.incrementSeconds}`
                    : '10+0';

                  // Xác định lý do thắng / thua chi tiết theo góc nhìn người chơi
                  let endReasonLabel = '';
                  if (m.winnerColor === 'draw') {
                    endReasonLabel = 'Hòa cờ';
                  } else if (isWin) {
                    if (m.endReason === 'CHECKMATE') endReasonLabel = 'Thắng bằng Chiếu hết';
                    else if (m.endReason === 'RESIGNED') endReasonLabel = 'Thắng do đối thủ đầu hàng';
                    else if (m.endReason === 'TIMEOUT') endReasonLabel = 'Thắng do đối thủ hết giờ';
                    else if (m.endReason === 'ABANDONED') endReasonLabel = 'Thắng do đối thủ rời trận';
                    else endReasonLabel = 'Thắng trận';
                  } else if (isLose) {
                    if (m.endReason === 'CHECKMATE') endReasonLabel = 'Thua do bạn bị chiếu hết';
                    else if (m.endReason === 'RESIGNED') endReasonLabel = 'Thua do bạn đầu hàng';
                    else if (m.endReason === 'TIMEOUT') endReasonLabel = 'Thua do bạn hết thời gian';
                    else if (m.endReason === 'ABANDONED') endReasonLabel = 'Thua do bạn rời trận';
                    else endReasonLabel = 'Thất bại';
                  }

                  return (
                    <div
                      key={m._id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-[#2F2D2A] border border-[#3A3733] hover:border-pink-500/40 transition-all duration-200"
                    >
                      {/* Thông tin đối thủ và kết quả */}
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Huy hiệu Kết quả */}
                        <span
                          className={`w-12 py-1 rounded-lg flex items-center justify-center font-black text-xs shrink-0 border ${
                            isWin
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : isLose
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {isWin ? 'THẮNG' : isLose ? 'THUA' : 'HÒA'}
                        </span>

                        {/* Thông tin đối thủ */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs md:text-sm text-white truncate max-w-[150px] md:max-w-[200px]">
                              vs {oppName}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-black border ${
                                myColor === 'w'
                                  ? 'bg-slate-100 text-slate-900 border-slate-300'
                                  : 'bg-slate-900 text-slate-100 border-slate-700'
                              }`}
                            >
                              {myColor === 'w' ? 'Quân Trắng' : 'Quân Đen'}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#1C1A17] text-[#8B8987] border border-[#312E2B]">
                              {m.isRated ? 'Xếp Hạng (Rated)' : 'Bạn Bè (Unrated)'}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#1C1A17] text-amber-400 border border-[#312E2B]">
                              ⏱️ {timeControlLabel}
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
            )}
          </div>
        </div>

        {/* Thanh phân trang Pagination */}
        {!loading && matches.length > 0 && totalPages > 1 && (
          <div className="pt-3 mt-2 border-t border-[#312E2B] flex items-center justify-between text-xs text-[#8B8987] shrink-0">
            <span>Tổng số {totalMatches} ván đấu</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
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
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-lg bg-[#2F2D2A] hover:bg-[#3A3733] border border-[#3A3733] text-white disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1"
              >
                <span>Trang sau</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
