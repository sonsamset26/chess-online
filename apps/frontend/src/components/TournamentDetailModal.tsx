import React, { useEffect, useState } from 'react';
import { X, Crown, Trophy, Calendar, Users, Loader2, AlertCircle } from 'lucide-react';
import { TournamentBracketView, TournamentDataProps } from './TournamentBracketView';

interface TournamentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentIdOrCode: string | null;
  currentUserId?: string;
  token?: string;
  onSelectReplayMatch: (matchRecord: any) => void;
  onAnalyzeMatch: (moves: string[]) => void;
}

export const TournamentDetailModal: React.FC<TournamentDetailModalProps> = ({
  isOpen,
  onClose,
  tournamentIdOrCode,
  token,
  onSelectReplayMatch,
  onAnalyzeMatch,
}) => {
  const [tournament, setTournament] = useState<TournamentDataProps | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  useEffect(() => {
    if (!isOpen || !tournamentIdOrCode) {
      setTournament(null);
      setError(null);
      setMatchError(null);
      return;
    }

    const fetchDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        setMatchError(null);
        const res = await fetch(`${API_URL}/api/v1/tournaments/${tournamentIdOrCode}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setTournament(data.data);
        } else {
          setError(data.message || 'Không thể tải thông tin giải đấu');
        }
      } catch (err: any) {
        setError(err?.message || 'Lỗi kết nối máy chủ');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [isOpen, tournamentIdOrCode, API_URL]);

  const handleFetchMatch = async (matchId: string): Promise<any | null> => {
    try {
      setLoadingMatchId(matchId);
      setMatchError(null);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_URL}/api/v1/matches/${matchId}`, { headers });
      const data = await res.json();

      if (res.ok && data.success) {
        return data.data;
      } else {
        setMatchError(data.message || 'Không thể tải thông tin ván cờ');
        return null;
      }
    } catch (err: any) {
      setMatchError(err?.message || 'Lỗi kết nối khi tải ván cờ');
      return null;
    } finally {
      setLoadingMatchId(null);
    }
  };

  const handleSelectMatchReplay = async (matchId: string) => {
    const matchRecord = await handleFetchMatch(matchId);
    if (matchRecord) {
      onSelectReplayMatch(matchRecord);
    }
  };

  const handleAnalyzeMatch = async (matchId: string) => {
    const matchRecord = await handleFetchMatch(matchId);
    if (matchRecord && matchRecord.moves && matchRecord.moves.length > 0) {
      onAnalyzeMatch(matchRecord.moves);
    } else {
      setMatchError('Ván cờ không có nước đi để phân tích');
    }
  };

  if (!isOpen) return null;

  const championPlayer = tournament?.players?.find(
    (p) => p.userId === tournament?.championId || p.username === tournament?.championId
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#16202E] border border-[#334155] rounded-3xl shadow-2xl overflow-hidden transition-all duration-300">
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between p-4 px-5 border-b border-[#2A374A] bg-[#1F1E1B] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white tracking-wide flex items-center gap-2">
                <span>Giải Đấu #{tournament?.code || tournamentIdOrCode}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  tournament?.status === 'IN_PROGRESS'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {tournament?.status === 'IN_PROGRESS' ? '⚔️ Đang Diễn Ra' : 'Đã Hoàn Thành'}
                </span>
              </h3>
              <div className="flex items-center gap-3 text-[11px] text-[#94A3B8] font-medium mt-0.5">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-amber-400" />
                  <span>Quy mô: {tournament?.size || 4} kỳ thủ</span>
                </span>
                {tournament && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[#63615E]" />
                    <span>
                      {(tournament as any).createdAt
                        ? new Date((tournament as any).createdAt).toLocaleDateString('vi-VN')
                        : ''}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-xl text-[#94A3B8] hover:text-white hover:bg-[#2A374A] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY MODAL (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-[#94A3B8]">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <span className="text-xs font-bold">Đang tải sơ đồ giải đấu...</span>
            </div>
          ) : error ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-rose-400">
              <AlertCircle className="w-8 h-8" />
              <span className="text-xs font-bold">{error}</span>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#0F172A] text-[#CBD5E1] border border-[#3A3835] text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          ) : tournament ? (
            <>
              {/* BANNER BÁO LỖI THAO TÁC TRẬN ĐẤU */}
              {matchError && (
                <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-between text-xs text-rose-300 shrink-0">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{matchError}</span>
                  </div>
                  <button
                    onClick={() => setMatchError(null)}
                    className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* BANNER QUÁN QUÂN */}
              {tournament.championId && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/50 text-center flex items-center justify-center gap-2.5 shadow-md shadow-amber-500/10 shrink-0">
                  <Crown className="w-6 h-6 text-amber-400 shrink-0 animate-bounce" />
                  <span className="text-sm font-black text-amber-300 uppercase tracking-wider">
                    🏆 QUÁN QUÂN: {championPlayer?.username || tournament.championId}
                  </span>
                </div>
              )}

              {/* SƠ ĐỒ NHÁNH ĐẤU BRACKET */}
              <TournamentBracketView
                tournament={tournament}
                isLive={false}
                loadingMatchId={loadingMatchId}
                onSelectMatchReplay={handleSelectMatchReplay}
                onAnalyzeMatch={handleAnalyzeMatch}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
