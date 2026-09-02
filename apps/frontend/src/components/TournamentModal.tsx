import React, { useState, useEffect } from 'react';
import { X, Trophy, Users, PlusCircle, LogIn, Copy, Check, Swords, Shield, Crown, Play } from 'lucide-react';

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
    if (externalTournament) {
      setTournament(externalTournament);
    }
  }, [externalTournament]);

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

    const handleRoundCountdown = (data: { nextRound: number; countdownSeconds: number }) => {
      setCountdown(data.countdownSeconds);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    };

    const handleTournamentError = (data: { message: string }) => {
      setErrorMessage(data.message);
      setLoading(false);
    };

    socket.on('tournament_updated', handleTournamentUpdated);
    socket.on('tournament_started', handleTournamentStarted);
    socket.on('round_countdown', handleRoundCountdown);
    socket.on('tournament_error', handleTournamentError);

    return () => {
      socket.off('tournament_updated', handleTournamentUpdated);
      socket.off('tournament_started', handleTournamentStarted);
      socket.off('round_countdown', handleRoundCountdown);
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
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
    socket.emit('join_tournament', {
      code: cleanCode,
      userId: currentUserId,
      username: currentUsername || 'Player',
      eloRating: currentUserElo,
    });
  };

  // Bắt đầu giải đấu (chỉ Host)
  const handleStartTournament = () => {
    if (!socket || !tournament || !currentUserId) return;
    setLoading(true);
    socket.emit('start_tournament', {
      code: tournament.code,
      userId: currentUserId,
    });
  };

  const isHost = tournament?.hostUserId === currentUserId;
  const canStart = isHost && tournament?.status === 'WAITING' && (tournament?.players.length || 0) >= 2;

  // Lấy tên người chơi theo userId
  const getPlayerName = (uid: string | null) => {
    if (!uid) return 'Chờ đối thủ...';
    const p = tournament?.players.find((item) => item.userId === uid);
    return p?.username || uid;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-2xl bg-[#262421] border border-[#3A3733] rounded-3xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Nút Đóng */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8B8987] hover:text-white p-1.5 rounded-xl bg-[#1C1A17] hover:bg-[#312E2B] border border-[#3A3733] transition-colors"
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
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1C1A17] border border-amber-500/30 text-amber-400 font-mono">
                  {tournament.size} Người • Loại trực tiếp
                </span>
              )}
            </h2>
            <p className="text-xs text-[#8B8987] font-medium">
              Thi đấu loại trực tiếp, cạnh tranh danh hiệu Quán quân!
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
                <div className="p-4 rounded-2xl bg-[#1C1A17] border border-[#312E2B] flex flex-col gap-3">
                  <span className="text-xs font-bold text-[#BAB8B6] uppercase tracking-wider">
                    Quy mô giải đấu:
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSelectedSize(4)}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1 font-bold text-xs transition-all ${
                        selectedSize === 4
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-[#262421] border-[#3A3733] text-[#8B8987] hover:text-white'
                      }`}
                    >
                      <span className="text-base font-black">4 Người</span>
                      <span className="text-[10px] text-[#A8A6A4]">Bán kết & Chung kết (2 vòng)</span>
                    </button>
                    <button
                      onClick={() => setSelectedSize(8)}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1 font-bold text-xs transition-all ${
                        selectedSize === 8
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-[#262421] border-[#3A3733] text-[#8B8987] hover:text-white'
                      }`}
                    >
                      <span className="text-base font-black">8 Người</span>
                      <span className="text-[10px] text-[#A8A6A4]">Tứ kết, Bán kết, Chung kết (3 vòng)</span>
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

                <div className="p-4 rounded-2xl bg-[#1C1A17] border border-[#312E2B] flex items-center justify-between">
                  <div className="text-left">
                    <h4 className="text-sm font-bold text-white">Bạn đã có mã phòng giải?</h4>
                    <p className="text-xs text-[#8B8987]">Nhập mã mời 6 ký tự để vào thi đấu</p>
                  </div>
                  <button
                    onClick={() => {
                      setView('join');
                      setErrorMessage(null);
                    }}
                    className="py-2.5 px-4 rounded-xl bg-[#262421] hover:bg-[#312E2B] text-amber-400 border border-amber-500/30 font-bold text-xs flex items-center gap-2 transition-all active:scale-95"
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
                  <p className="text-xs text-[#8B8987]">Nhận mã từ người tạo phòng và nhập vào ô dưới</p>
                </div>

                <div className="flex justify-center">
                  <input
                    type="text"
                    maxLength={6}
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="MÃ 6 KÝ TỰ"
                    className="w-64 bg-[#1C1A17] border-2 border-amber-500/40 focus:border-amber-400 text-center font-mono text-2xl font-black tracking-widest text-amber-300 py-3 rounded-2xl uppercase outline-none shadow-inner"
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
                    className="flex-1 py-2.5 rounded-xl bg-[#312E2B] hover:bg-[#3B3835] text-[#BAB8B6] font-bold text-xs transition-colors"
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
              <div className="p-3.5 rounded-2xl bg-[#1C1A17] border border-[#312E2B] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#8B8987] block uppercase tracking-wider">
                    MÃ PHÒNG THI ĐẤU
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xl font-black text-amber-300 tracking-wider">
                      {tournament.code}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="p-1 rounded-lg bg-[#262421] hover:bg-[#312E2B] text-[#A8A6A4] hover:text-white transition-colors"
                      title="Sao chép mã"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-[#8B8987] block uppercase tracking-wider">
                    KỲ THỦ THAM GIA
                  </span>
                  <span className="text-sm font-bold text-white">
                    {tournament.players.length} / {tournament.size} người
                  </span>
                </div>
              </div>

              {/* BANNER ĐẾM NGƯỢC NGHỈ GIỮA 2 VÒNG */}
              {countdown !== null && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-center animate-pulse">
                  <span className="text-sm font-black text-amber-300">
                    ⏱️ Vòng tiếp theo sẽ bắt đầu sau {countdown} giây...
                  </span>
                </div>
              )}

              {/* BANNER NHÀ VÔ ĐỊCH */}
              {tournament.status === 'FINISHED' && tournament.championId && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/50 text-center flex flex-col items-center gap-1 shadow-lg shadow-amber-500/10">
                  <Crown className="w-8 h-8 text-amber-400 animate-bounce" />
                  <span className="text-lg font-black text-amber-300 uppercase tracking-wide">
                    🏆 QUÁN QUÂN GIẢI ĐẤU: {getPlayerName(tournament.championId)}
                  </span>
                  <span className="text-xs text-[#BAB8B6]">Chúc mừng bạn đã xuất sắc chiến thắng toàn bộ các vòng đấu!</span>
                </div>
              )}

              {/* GIAI ĐOẠN 1: SẢNH CHỜ (WAITING ROOM) */}
              {tournament.status === 'WAITING' ? (
                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-[#BAB8B6] uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Danh sách kỳ thủ đã tham gia</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {tournament.players.map((p, idx) => (
                      <div
                        key={p.userId || idx}
                        className="p-3 rounded-xl bg-[#1C1A17] border border-[#312E2B] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-[#262421] text-xs font-mono font-bold flex items-center justify-center text-[#8B8987]">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-white block">
                              {p.username} {p.userId === tournament.hostUserId && '👑'}
                            </span>
                            <span className="text-[10px] text-[#8B8987] font-mono">Elo: {p.eloRating}</span>
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
                      <span>{loading ? 'Đang khởi tạo...' : 'Bắt đầu giải đấu ngay'}</span>
                    </button>
                  )}
                  {!isHost && (
                    <p className="text-center text-xs text-[#8B8987] font-medium mt-2">
                      Đang đợi chủ phòng bắt đầu giải đấu...
                    </p>
                  )}
                </div>
              ) : (
                // GIAI ĐOẠN 2: SƠ ĐỒ NHÁNH ĐẤU (BRACKET TREE)
                <div className="flex flex-col gap-4">
                  <h4 className="text-xs font-bold text-[#BAB8B6] uppercase tracking-wider flex items-center gap-1.5">
                    <Swords className="w-3.5 h-3.5 text-amber-400" />
                    <span>Sơ đồ thi đấu (Bracket)</span>
                  </h4>

                  <div className="flex flex-col gap-4">
                    {tournament.rounds.map((round) => (
                      <div key={round.roundNumber} className="flex flex-col gap-2">
                        <span className="text-[11px] font-extrabold text-amber-400 font-mono uppercase">
                          Vòng {round.roundNumber}{' '}
                          {round.roundNumber === tournament.rounds.length && tournament.status === 'FINISHED'
                            ? '(Chung kết)'
                            : round.matches.length === 1
                            ? '(Chung kết)'
                            : `(${round.matches.length} Trận)`}
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {round.matches.map((m, mIdx) => {
                            const isBye = m.player1 && !m.player2;
                            const isP1Winner = m.winnerId === m.player1;
                            const isP2Winner = m.winnerId === m.player2;

                            return (
                              <div
                                key={mIdx}
                                className={`p-3 rounded-2xl border flex flex-col gap-2 transition-all ${
                                  m.status === 'PLAYING'
                                    ? 'bg-amber-950/20 border-amber-500/50 shadow-md shadow-amber-500/10'
                                    : 'bg-[#1C1A17] border-[#312E2B]'
                                }`}
                              >
                                <div className="flex items-center justify-between text-[10px] text-[#8B8987] font-bold">
                                  <span>Trận #{mIdx + 1}</span>
                                  {isBye ? (
                                    <span className="text-blue-400">Miễn đấu (Bye)</span>
                                  ) : m.status === 'DONE' ? (
                                    <span className="text-emerald-400">Đã xong</span>
                                  ) : m.status === 'PLAYING' ? (
                                    <span className="text-amber-400 animate-pulse">Đang thi đấu...</span>
                                  ) : (
                                    <span className="text-[#8B8987]">Chờ đấu</span>
                                  )}
                                </div>

                                <div className="flex flex-col gap-1 text-xs">
                                  {/* Player 1 */}
                                  <div
                                    className={`p-1.5 px-2.5 rounded-lg flex items-center justify-between font-bold ${
                                      isP1Winner
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                        : 'bg-[#262421] text-[#BAB8B6]'
                                    }`}
                                  >
                                    <span>{getPlayerName(m.player1)}</span>
                                    {isP1Winner && <Crown className="w-3.5 h-3.5 text-emerald-400" />}
                                  </div>

                                  {/* Player 2 */}
                                  <div
                                    className={`p-1.5 px-2.5 rounded-lg flex items-center justify-between font-bold ${
                                      isBye
                                        ? 'bg-transparent text-[#63615E] italic text-[11px]'
                                        : isP2Winner
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                        : 'bg-[#262421] text-[#BAB8B6]'
                                    }`}
                                  >
                                    <span>{isBye ? '(Không có đối thủ)' : getPlayerName(m.player2)}</span>
                                    {isP2Winner && <Crown className="w-3.5 h-3.5 text-emerald-400" />}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
