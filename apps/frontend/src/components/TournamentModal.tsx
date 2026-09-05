import React, { useState, useEffect, useRef } from 'react';
import { X, Trophy, Users, PlusCircle, LogIn, Copy, Check, Swords, Shield, Crown, Play, Trash2, LogOut } from 'lucide-react';
import { TournamentBracketView } from './TournamentBracketView';
import { getApiUrl } from '../utils/apiUrl';

export interface TournamentPlayer {
  userId: string;
  username: string;
  eloRating: number;
}

export interface TournamentMatch {
  matchId: string | null;
  armageddonMatchId?: string | null;
  player1: string | null;
  player2: string | null;
  winnerId: string | null;
  status: 'PENDING' | 'PLAYING' | 'DONE';
}

export interface TournamentRound {
  roundNumber: number;
  matches: TournamentMatch[];
}

export interface TournamentData {
  tournamentId: string;
  code: string;
  hostUserId: string;
  hostUsername: string;
  size: 4 | 8;
  status: 'WAITING' | 'IN_PROGRESS' | 'FINISHED';
  players: TournamentPlayer[];
  rounds: TournamentRound[];
  championId: string | null;
}

interface TournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  currentUsername?: string;
  currentUserElo?: number;
  socket: any;
  tournamentData?: TournamentData | null;
  onTournamentUpdated?: (tournament: TournamentData) => void;
}

export const TournamentModal: React.FC<TournamentModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  currentUsername,
  currentUserElo = 1200,
  socket,
  tournamentData: externalTournament,
  onTournamentUpdated,
}) => {
  const [tournament, setTournament] = useState<TournamentData | null>(externalTournament || null);
  const [view, setView] = useState<'menu' | 'join'>('menu');
  const [selectedSize, setSelectedSize] = useState<4 | 8>(4);
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    setTournament(externalTournament || null);
    if (!externalTournament) {
      setView('menu');
      setInputCode('');
      setErrorMessage(null);
    }
  }, [externalTournament]);

  // ADV-01: Đồng bộ mã giải đấu đang tham gia vào localStorage để hỗ trợ F5 Reconnect
  useEffect(() => {
    if (tournament?.tournamentId) {
      if (tournament.status === 'IN_PROGRESS' || tournament.status === 'WAITING') {
        localStorage.setItem('chess_active_tournament_id', tournament.tournamentId);
      } else if (tournament.status === 'FINISHED') {
        localStorage.removeItem('chess_active_tournament_id');
      }
    }
  }, [tournament]);

  // Khôi phục giải đấu đang tham gia khi mở Modal hoặc sau khi F5
  const isTournamentRestoredRef = useRef(false);
  useEffect(() => {
    if (!tournament && isOpen && !isTournamentRestoredRef.current && typeof window !== 'undefined') {
      const savedTournamentId = localStorage.getItem('chess_active_tournament_id');
      if (savedTournamentId) {
        isTournamentRestoredRef.current = true;
        setLoading(true);
        const apiUrl = getApiUrl();
        fetch(`${apiUrl}/api/v1/tournaments/${savedTournamentId}`)
          .then((res) => res.json())
          .then((json) => {
            if (json.success && json.data) {
              const loadedTournament = json.data as TournamentData;
              setTournament(loadedTournament);
              if (onTournamentUpdated) onTournamentUpdated(loadedTournament);
              if (socket && currentUserId) {
                const token = localStorage.getItem('chess_token');
                socket.emit('join_tournament', {
                  code: loadedTournament.code,
                  token: token || undefined,
                  userId: currentUserId,
                  username: currentUsername || 'Player',
                  eloRating: currentUserElo,
                });
              }
            } else {
              localStorage.removeItem('chess_active_tournament_id');
            }
          })
          .catch((err) => {
            console.error('Error restoring tournament:', err);
            localStorage.removeItem('chess_active_tournament_id');
          })
          .finally(() => setLoading(false));
      }
    }
  }, [isOpen, tournament, socket, currentUserId, currentUsername, currentUserElo, onTournamentUpdated]);

  // Lắng nghe các sự kiện socket của giải đấu
  useEffect(() => {
    if (!socket) return;

    const handleTournamentUpdated = (data: { tournament: TournamentData }) => {
      setTournament(data.tournament);
      if (onTournamentUpdated) onTournamentUpdated(data.tournament);
    };

    const handleTournamentStarted = (data: { tournament: TournamentData }) => {
      setTournament(data.tournament);
      if (onTournamentUpdated) onTournamentUpdated(data.tournament);
    };

    const handleRoundCountdown = (data: { nextRound: number; countdownSeconds: number; targetTimestamp?: number; serverTimestamp?: number }) => {
      const offset = data.serverTimestamp ? data.serverTimestamp - Date.now() : 0;
      const target = data.targetTimestamp || (Date.now() + (data.countdownSeconds || 30) * 1000);

      const updateRemaining = () => {
        const remaining = Math.max(0, Math.ceil((target - (Date.now() + offset)) / 1000));
        setCountdown(remaining > 0 ? remaining : null);
        return remaining;
      };

      updateRemaining();
      const interval = setInterval(() => {
        const remaining = updateRemaining();
        if (remaining <= 0) {
          clearInterval(interval);
        }
      }, 500);
    };

    const handleTournamentError = (data: { message: string }) => {
      setErrorMessage(data.message);
      setLoading(false);
    };

    const handleTournamentFinished = (data: { tournament: TournamentData; championId: string }) => {
      setTournament(data.tournament);
      setCountdown(null);
      if (onTournamentUpdated) onTournamentUpdated(data.tournament);
    };

    const handleTournamentCancelled = (data: { message?: string }) => {
      setErrorMessage(data?.message || 'Giải đấu đã bị hủy bởi chủ phòng.');
      setLoading(false);
      setTournament(null);
      localStorage.removeItem('chess_active_tournament_id');
      setTimeout(() => {
        setErrorMessage(null);
      }, 4000);
    };

    socket.on('tournament_updated', handleTournamentUpdated);
    socket.on('tournament_started', handleTournamentStarted);
    socket.on('round_countdown', handleRoundCountdown);
    socket.on('tournament_finished', handleTournamentFinished);
    socket.on('tournament_cancelled', handleTournamentCancelled);
    socket.on('tournament_error', handleTournamentError);

    return () => {
      socket.off('tournament_updated', handleTournamentUpdated);
      socket.off('tournament_started', handleTournamentStarted);
      socket.off('round_countdown', handleRoundCountdown);
      socket.off('tournament_finished', handleTournamentFinished);
      socket.off('tournament_cancelled', handleTournamentCancelled);
      socket.off('tournament_error', handleTournamentError);
    };
  }, [socket, onTournamentUpdated]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (tournament?.code) {
      navigator.clipboard.writeText(tournament.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Tạo giải đấu mới qua REST API
  const handleCreateTournament = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const apiUrl = getApiUrl();
      const token = typeof window !== 'undefined' ? localStorage.getItem('chess_token') : null;

      const res = await fetch(`${apiUrl}/api/v1/tournaments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ size: selectedSize }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Không thể tạo giải đấu');
      }

      const createdTournament = json.data as TournamentData;
      setTournament(createdTournament);

      // Join socket room giải đấu
      if (socket && currentUserId) {
        socket.emit('join_tournament', {
          code: createdTournament.code,
          token: token || undefined,
          userId: currentUserId,
          username: currentUsername || 'Host',
          eloRating: currentUserElo,
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi tạo giải đấu');
    } finally {
      setLoading(false);
    }
  };

  // Tham gia giải đấu bằng mã code
  const handleJoinTournament = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = inputCode.trim().toUpperCase();
    if (cleanCode.length !== 6) return;

    if (!socket || !currentUserId) {
      setErrorMessage('Vui lòng đăng nhập để tham gia giải');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    const token = typeof window !== 'undefined' ? localStorage.getItem('chess_token') : null;
    socket.emit('join_tournament', {
      code: cleanCode,
      token: token || undefined,
      userId: currentUserId,
      username: currentUsername || 'Player',
      eloRating: currentUserElo,
    });
  };

  // Bắt đầu giải đấu (chỉ Host)
  const handleStartTournament = () => {
    if (!socket || !tournament || !currentUserId) return;
    setLoading(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('chess_token') : null;
    socket.emit('start_tournament', {
      code: tournament.code,
      token: token || undefined,
    });
  };

  // Hủy giải đấu (chỉ Host khi đang ở sảnh chờ)
  const handleCancelTournament = () => {
    if (!socket || !tournament || !tournament.code) return;
    setLoading(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('chess_token') : null;
    socket.emit('cancel_tournament', {
      code: tournament.code,
      token: token || undefined,
    });
    setTournament(null);
    localStorage.removeItem('chess_active_tournament_id');
    setLoading(false);
  };

  // Rời khỏi phòng giải đấu (khi đang ở sảnh chờ)
  const handleLeaveTournament = () => {
    if (!socket || !tournament || !tournament.code) return;
    setLoading(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('chess_token') : null;
    socket.emit('leave_tournament', {
      code: tournament.code,
      token: token || undefined,
    });
    setTournament(null);
    localStorage.removeItem('chess_active_tournament_id');
    setLoading(false);
  };

  const hostPlayer = tournament?.players.find((p) => p.userId === tournament.hostUserId);
  const isHost =
    tournament?.hostUserId === currentUserId ||
    tournament?.hostUsername === currentUsername ||
    (!!currentUsername && hostPlayer?.username === currentUsername) ||
    (!!currentUserId && hostPlayer?.userId === currentUserId);
  const canStart = isHost && tournament?.status === 'WAITING' && (tournament?.players.length || 0) === (tournament?.size || 4);

  // Lấy tên người chơi theo userId
  const getPlayerName = (uid: string | null) => {
    if (!uid) return 'Chờ đối thủ...';
    const p = tournament?.players.find((item) => item.userId === uid);
    return p?.username || uid;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className={`w-full ${tournament?.status === 'IN_PROGRESS' || tournament?.status === 'FINISHED' ? 'max-w-5xl' : 'max-w-2xl'} bg-[#16202E] border border-[#334155] rounded-3xl p-4 sm:p-6 shadow-2xl relative max-h-[92vh] flex flex-col transition-all duration-300`}>
        {/* Nút Đóng */}
        <button
          onClick={() => {
            if (tournament?.status === 'WAITING') {
              if (isHost) {
                handleCancelTournament();
              } else {
                handleLeaveTournament();
              }
            }
            onClose();
          }}
          className="absolute top-4 right-4 text-[#94A3B8] hover:text-white p-1.5 rounded-xl bg-[#0F172A] hover:bg-[#2A374A] border border-[#334155] transition-colors"
          title="Đóng bảng giải đấu"
        >
          <X className="w-5 h-5" />
        </button>

        {/* HEADER */}
        <div className="flex items-center gap-3 mb-5 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-wide flex items-center gap-2">
              GIẢI ĐẤU CỜ VUA
              {tournament && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#0F172A] border border-amber-500/30 text-amber-400 font-mono">
                  {tournament.size} người • Loại trực tiếp
                </span>
              )}
            </h2>
            <p className="text-xs text-[#94A3B8] font-medium">
              Thể thức loại trực tiếp. Kỳ thủ thắng trận tiến vào vòng kế tiếp.
            </p>
          </div>
        </div>

        {/* THÔNG BÁO LỖI NẾU CÓ */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold text-center">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* NỘI DUNG CHÍNH THEO TRẠNG THÁI */}
        <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
          {!tournament ? (
            // MÀN HÌNH CHỌN TẠO HOẶC NHẬP PHÒNG
            view === 'menu' ? (
              <div className="flex flex-col gap-4 py-2">
                <div className="p-4 rounded-2xl bg-[#0F172A] border border-[#2A374A] flex flex-col gap-3">
                  <span className="text-xs font-bold text-[#CBD5E1] uppercase tracking-wider">
                    Quy mô giải đấu:
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSelectedSize(4)}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1 font-bold text-xs transition-all ${
                        selectedSize === 4
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-[#16202E] border-[#334155] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      <span className="text-base font-black">4 Người</span>
                      <span className="text-[10px] text-[#94A3B8]">Bán kết & Chung kết (2 vòng)</span>
                    </button>
                    <button
                      onClick={() => setSelectedSize(8)}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1 font-bold text-xs transition-all ${
                        selectedSize === 8
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-[#16202E] border-[#334155] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      <span className="text-base font-black">8 Người</span>
                      <span className="text-[10px] text-[#94A3B8]">Tứ kết, Bán kết, Chung kết (3 vòng)</span>
                    </button>
                  </div>

                  <button
                    disabled={loading}
                    onClick={handleCreateTournament}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{loading ? 'Đang tạo phòng...' : 'Tạo Phòng Giải Đấu'}</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-[#0F172A] border border-[#2A374A] flex items-center justify-between">
                  <div className="text-left">
                    <h4 className="text-sm font-bold text-white">Bạn đã có mã phòng giải?</h4>
                    <p className="text-xs text-[#94A3B8]">Nhập mã mời 6 ký tự để vào thi đấu</p>
                  </div>
                  <button
                    onClick={() => {
                      setView('join');
                      setErrorMessage(null);
                    }}
                    className="py-2.5 px-4 rounded-xl bg-[#16202E] hover:bg-[#2A374A] text-amber-400 border border-amber-500/30 font-bold text-xs flex items-center gap-2 transition-all active:scale-95"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Nhập mã</span>
                  </button>
                </div>
              </div>
            ) : (
              // FORM NHẬP MÃ PHÒNG
              <form onSubmit={handleJoinTournament} className="flex flex-col gap-4 py-4">
                <div className="text-center mb-2">
                  <h3 className="text-base font-bold text-white mb-1">Nhập mã giải đấu</h3>
                  <p className="text-xs text-[#94A3B8]">Nhận mã từ người tạo phòng và nhập vào ô dưới</p>
                </div>

                <div className="flex justify-center">
                  <input
                    type="text"
                    maxLength={6}
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="MÃ 6 KÝ TỰ"
                    className="w-64 bg-[#0F172A] border-2 border-amber-500/40 focus:border-amber-400 text-center font-mono text-2xl font-black tracking-widest text-amber-300 py-3 rounded-2xl uppercase outline-none shadow-inner"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setView('menu');
                      setInputCode('');
                      setErrorMessage(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-[#2A374A] hover:bg-[#3B3835] text-[#CBD5E1] font-bold text-xs transition-colors"
                  >
                    Quay lại
                  </button>
                  <button
                    type="submit"
                    disabled={inputCode.trim().length !== 6 || loading}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 text-white font-extrabold text-xs uppercase tracking-wider disabled:opacity-50 transition-all shadow"
                  >
                    {loading ? 'Đang vào...' : 'Vào giải đấu'}
                  </button>
                </div>
              </form>
            )
          ) : (
            // MÀN HÌNH GIẢI ĐẤU (LOBBY / BRACKET)
            <div className="flex flex-col gap-4">
              {/* THẺ MÃ PHÒNG VÀ TRẠNG THÁI */}
              <div className="p-3.5 rounded-2xl bg-[#0F172A] border border-[#2A374A] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#94A3B8] block uppercase tracking-wider">
                    MÃ PHÒNG THI ĐẤU
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xl font-black text-amber-300 tracking-wider">
                      {tournament.code}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="p-1 rounded-lg bg-[#16202E] hover:bg-[#2A374A] text-[#94A3B8] hover:text-white transition-colors"
                      title="Sao chép mã"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-[#94A3B8] block uppercase tracking-wider">
                    KỲ THỦ THAM GIA
                  </span>
                  <span className="text-sm font-bold text-white">
                    {tournament.players.length} / {tournament.size} người
                  </span>
                </div>
              </div>

              {/* BANNER NHÀ VÔ ĐỊCH */}
              {tournament.status === 'FINISHED' && tournament.championId && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/50 text-center flex flex-col items-center gap-1 shadow-lg shadow-amber-500/10">
                  <Crown className="w-8 h-8 text-amber-400 animate-bounce" />
                  <span className="text-lg font-black text-amber-300 tracking-wide">
                    🏆 Nhà vô địch: {getPlayerName(tournament.championId)}
                  </span>
                </div>
              )}

              {/* GIAI ĐOẠN 1: SẢNH CHỜ (WAITING ROOM) */}
              {tournament.status === 'WAITING' ? (
                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-[#CBD5E1] uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Danh sách kỳ thủ đã tham gia</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {tournament.players.map((p, idx) => (
                      <div
                        key={p.userId || idx}
                        className="p-3 rounded-xl bg-[#0F172A] border border-[#2A374A] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-[#16202E] text-xs font-mono font-bold flex items-center justify-center text-[#94A3B8]">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-white block">
                              {p.username} {p.userId === tournament.hostUserId && '👑'}
                            </span>
                            <span className="text-[10px] text-[#94A3B8] font-mono">Elo: {p.eloRating}</span>
                          </div>
                        </div>
                        {p.userId === tournament.hostUserId && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Chủ phòng
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {isHost && (
                    <button
                      disabled={!canStart || loading}
                      onClick={handleStartTournament}
                      className="w-full mt-3 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-95"
                    >
                      <Play className="w-4 h-4" />
                      <span>
                        {loading
                          ? 'Đang khởi tạo...'
                          : canStart
                          ? 'Bắt đầu giải đấu ngay'
                          : `Cần đủ ${tournament.size} người (${tournament.players.length}/${tournament.size})`}
                      </span>
                    </button>
                  )}
                  {isHost && (
                    <button
                      onClick={handleCancelTournament}
                      disabled={loading}
                      className="w-full mt-2 py-2.5 px-4 rounded-xl bg-[#2A374A] hover:bg-[#3B3835] text-rose-400 hover:text-rose-300 font-bold text-xs flex items-center justify-center gap-2 border border-rose-500/20 hover:border-rose-500/40 transition-colors active:scale-95 disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hủy giải đấu
                    </button>
                  )}
                  {!isHost && (
                    <div className="mt-2 flex flex-col gap-2">
                      <p className="text-center text-xs text-[#94A3B8] font-medium">
                        Đang đợi chủ phòng bắt đầu giải đấu...
                      </p>
                      <button
                        onClick={handleLeaveTournament}
                        disabled={loading}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#2A374A] hover:bg-[#3B3835] text-[#CBD5E1] hover:text-white font-bold text-xs flex items-center justify-center gap-2 border border-[#334155] hover:border-[#555250] transition-colors active:scale-95 disabled:opacity-40"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Rời phòng chờ
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <h4 className="text-xs font-bold text-[#CBD5E1] uppercase tracking-wider flex items-center gap-1.5">
                    <Swords className="w-3.5 h-3.5 text-amber-400" />
                    <span>Sơ đồ thi đấu</span>
                  </h4>

                  <TournamentBracketView
                    tournament={tournament}
                    isLive={true}
                    countdown={countdown}
                    currentUserId={currentUserId}
                  />

                  {/* NÚT TẠO HOẶC THAM GIA GIẢI ĐẤU MỚI KHI GIẢI ĐÃ KẾT THÚC */}
                  {tournament.status === 'FINISHED' && (
                    <button
                      onClick={() => {
                        setTournament(null);
                        setView('menu');
                        if (onTournamentUpdated) onTournamentUpdated(null as any);
                      }}
                      className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Tạo hoặc Tham gia Giải đấu mới</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
