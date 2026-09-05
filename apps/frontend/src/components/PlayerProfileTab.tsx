import React, { useState, useEffect } from 'react';
import { 
  Crown, 
  BrainCircuit, 
  Sparkles, 
  RotateCcw, 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  Lightbulb, 
  Puzzle, 
  Clock, 
  ShieldCheck, 
  ChevronRight,
  Info,
  CheckCircle2
} from 'lucide-react';
import { getApiUrl } from '../utils/apiUrl';

interface FeatureVector {
  openingCpl: number;
  middlegameCpl: number;
  endgameCpl: number;
  openingBlunderRate: number;
  middlegameBlunderRate: number;
  endgameBlunderRate: number;
  timePressureBlunderRate: number;
  averageThinkingTimeMs: number;
}

interface WeaknessAnalysis {
  weakestPhase: 'OPENING' | 'MIDDLEGAME' | 'ENDGAME';
  weaknessScore: number;
  phaseScores: {
    opening: number;
    middlegame: number;
    endgame: number;
    timeManagement: number;
  };
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

interface PlayerProfileData {
  userId: string;
  username: string;
  gamesAnalyzed: number;
  movesAnalyzed: number;
  featureVector: FeatureVector;
  reliabilityStatus: 'INSUFFICIENT_DATA' | 'PRELIMINARY' | 'USABLE' | 'STABLE';
  clusterId?: number;
  clusterLabel?: string;
  similarityScore?: number;
  weakestPhase?: 'OPENING' | 'MIDDLEGAME' | 'ENDGAME';
  weaknessScore?: number;
  weaknessAnalysis?: WeaknessAnalysis;
  updatedAt?: string;
}

interface RecommendedPuzzle {
  puzzleId: string;
  title: string;
  description: string;
  difficulty: string;
  rating: number;
  fen: string;
  turn: 'w' | 'b';
  hint: string;
  matchReason: string;
}

interface PlayerProfileTabProps {
  user: { username: string; eloRating: number; avatarUrl?: string } | null;
  onOpenAuthModal: () => void;
  onSelectTab?: (tab: any) => void;
}

export const PlayerProfileTab: React.FC<PlayerProfileTabProps> = ({
  user,
  onOpenAuthModal,
  onSelectTab,
}) => {
  const [profile, setProfile] = useState<PlayerProfileData | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendedPuzzle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRecomputing, setIsRecomputing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfileData = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let token = typeof window !== 'undefined' ? localStorage.getItem('chess_token') : null;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const apiUrl = getApiUrl();

      // 1. Lấy dữ liệu hồ sơ ML
      let profileRes = await fetch(`${apiUrl}/api/v1/ml/profile/me`, { headers });

      // Silent refresh token nếu accessToken hết hạn (401)
      if (profileRes.status === 401) {
        try {
          const refreshRes = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
          });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData.success && refreshData.data?.accessToken) {
              token = refreshData.data.accessToken;
              if (typeof window !== 'undefined') {
                localStorage.setItem('chess_token', token as string);
              }
              headers['Authorization'] = `Bearer ${token}`;
              profileRes = await fetch(`${apiUrl}/api/v1/ml/profile/me`, { headers });
            }
          }
        } catch (refreshErr) {
          console.warn('Làm mới phiên đăng nhập thất bại:', refreshErr);
        }
      }

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData.data) {
          setProfile(profileData.data);
        }
      }

      // 2. Lấy danh sách câu đố được gợi ý
      const recRes = await fetch(`${apiUrl}/api/v1/ml/recommendations/puzzles?limit=4`, { headers });
      if (recRes.ok) {
        const recData = await recRes.json();
        if (recData.data?.puzzles) {
          setRecommendations(recData.data.puzzles);
        }
      }
    } catch (err: any) {
      console.warn('Lỗi kết nối API ML:', err);
      setError('Không thể kết nối đến máy chủ phân tích ML');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [user]);

  const handleRecompute = async () => {
    if (isRecomputing) return;
    setIsRecomputing(true);
    try {
      let token = typeof window !== 'undefined' ? localStorage.getItem('chess_token') : null;
      const apiUrl = getApiUrl();
      let res = await fetch(`${apiUrl}/api/v1/ml/profile/recompute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        try {
          const refreshRes = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
          });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData.success && refreshData.data?.accessToken) {
              token = refreshData.data.accessToken;
              if (typeof window !== 'undefined') {
                localStorage.setItem('chess_token', token as string);
              }
              res = await fetch(`${apiUrl}/api/v1/ml/profile/recompute`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
              });
            }
          }
        } catch (refreshErr) {
          console.warn('Làm mới phiên đăng nhập thất bại:', refreshErr);
        }
      }

      if (res.ok) {
        await fetchProfileData();
      }
    } catch (err) {
      console.warn('Lỗi tính toán lại hồ sơ:', err);
    } finally {
      setIsRecomputing(false);
    }
  };

  // Trạng thái chưa đăng nhập
  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-[#16202E] border border-[#2A374A] flex items-center justify-center text-pink-400 mb-6 shadow-xl shadow-pink-500/10">
          <BrainCircuit className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Hồ Sơ Kỳ Thủ</h2>
        <p className="text-sm text-[#94A3B8] max-w-md mb-6 leading-relaxed">
          Đăng nhập để hệ thống trí tuệ nhân tạo phân tích lịch sử thi đấu, nhận diện phong cách cờ vua độc bản và chỉ dẫn bài tập cải thiện điểm yếu riêng của bạn.
        </p>
        <button
          onClick={onOpenAuthModal}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-bold text-sm shadow-lg shadow-pink-500/25 active:scale-95 transition-all"
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  // Trạng thái đang tải
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-12 h-12 rounded-full border-4 border-pink-500/20 border-t-pink-500 animate-spin mb-4" />
        <p className="text-sm text-[#94A3B8] font-medium">Đang nạp hồ sơ phong cách thi đấu...</p>
      </div>
    );
  }

  const reliabilityMap = {
    INSUFFICIENT_DATA: { label: 'Chưa đủ ván', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    PRELIMINARY: { label: 'Dữ liệu sơ bộ', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    USABLE: { label: 'Độ tin cậy tốt', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
    STABLE: { label: 'Độ tin cậy cao', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  };

  const currentReliability = reliabilityMap[profile?.reliabilityStatus || 'INSUFFICIENT_DATA'];

  // Tính toán tọa độ Radar Chart SVG (8 chiều)
  const renderRadarChart = () => {
    const size = 260;
    const center = size / 2;
    const radius = 95;
    const axes = [
      { label: 'Khai trận', score: profile?.weaknessAnalysis?.phaseScores?.opening || 50, description: 'Độ chính xác và khả năng triển khai thế trận đầu ván' },
      { label: 'Tính toán', score: profile?.weaknessAnalysis?.phaseScores?.middlegame || 50, description: 'Khả năng tính toán các đòn phối hợp ở giữa trận' },
      { label: 'Dứt điểm', score: profile?.weaknessAnalysis?.phaseScores?.endgame || 50, description: 'Kỹ thuật xử lý và chuyển hóa lợi thế ở cuối trận' },
      { label: 'Bảo toàn', score: Math.max(20, Math.min(100, Math.round(100 - (profile?.featureVector?.endgameBlunderRate || 0) * 350))), description: 'Khả năng giữ vững lợi thế và tránh sai lầm ở cuối trận' },
      { label: 'Vững thế', score: Math.max(20, Math.min(100, Math.round(100 - (profile?.featureVector?.middlegameBlunderRate || 0) * 350))), description: 'Duy trì thế trận chặt chẽ và hạn chế sai lầm ở giữa trận' },
      { label: 'Cẩn trọng', score: Math.max(20, Math.min(100, Math.round(100 - (profile?.featureVector?.openingBlunderRate || 0) * 400))), description: 'Hạn chế sai sót và tránh cạm bẫy ở đầu trận' },
      { label: 'Bản lĩnh', score: Math.max(20, Math.min(100, Math.round(100 - (profile?.featureVector?.timePressureBlunderRate || 0) * 300))), description: 'Giữ được sự điềm tĩnh và chính xác khi cạn thời gian' },
      { label: 'Linh hoạt', score: profile?.weaknessAnalysis?.phaseScores?.timeManagement || 50, description: 'Tốc độ tư duy và điều phối thời gian hợp lý' },
    ];

    const numAxes = axes.length;
    const points: string[] = [];
    const webCircles = [0.25, 0.5, 0.75, 1.0];

    axes.forEach((axis, i) => {
      const angle = (Math.PI * 2 * i) / numAxes - Math.PI / 2;
      const normalizedScore = (axis.score / 100) * radius;
      const x = center + normalizedScore * Math.cos(angle);
      const y = center + normalizedScore * Math.sin(angle);
      points.push(`${x},${y}`);
    });

    const polygonPoints = points.join(' ');

    return (
      <div className="relative flex flex-col items-center justify-center p-4">
        <svg width={size} height={size} className="overflow-visible">
          {/* Lưới mạng nhện đồng tâm */}
          {webCircles.map((factor, idx) => (
            <circle
              key={idx}
              cx={center}
              cy={center}
              r={radius * factor}
              fill="none"
              stroke="#2A374A"
              strokeDasharray={idx < 3 ? '2 2' : undefined}
              strokeWidth="1"
            />
          ))}

          {/* Các nan hoa trục */}
          {axes.map((_, i) => {
            const angle = (Math.PI * 2 * i) / numAxes - Math.PI / 2;
            const x = center + radius * Math.cos(angle);
            const y = center + radius * Math.sin(angle);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="#2A374A"
                strokeWidth="1"
              />
            );
          })}

          {/* Đa giác diện tích biểu thị năng lực */}
          <polygon
            points={polygonPoints}
            fill="url(#radarGradient)"
            fillOpacity="0.45"
            stroke="#EC4899"
            strokeWidth="2.5"
          />

          {/* Điểm nút */}
          {axes.map((axis, i) => {
            const angle = (Math.PI * 2 * i) / numAxes - Math.PI / 2;
            const normalizedScore = (axis.score / 100) * radius;
            const x = center + normalizedScore * Math.cos(angle);
            const y = center + normalizedScore * Math.sin(angle);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="3.5"
                fill="#F43F5E"
                stroke="#0F172A"
                strokeWidth="1.5"
                className="cursor-pointer hover:r-5 transition-all"
              >
                <title>{`${axis.label}: ${axis.score}/100 — ${axis.description}`}</title>
              </circle>
            );
          })}

          {/* Nhãn văn bản xung quanh */}
          {axes.map((axis, i) => {
            const angle = (Math.PI * 2 * i) / numAxes - Math.PI / 2;
            const labelRadius = radius + 22;
            const x = center + labelRadius * Math.cos(angle);
            const y = center + labelRadius * Math.sin(angle);
            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#94A3B8"
                fontSize="9.5"
                fontWeight="bold"
                className="cursor-pointer hover:fill-pink-400 transition-colors select-none"
              >
                <title>{`${axis.label}: ${axis.score}/100 — ${axis.description}`}</title>
                {axis.label}
              </text>
            );
          })}

          {/* Gradient */}
          <defs>
            <linearGradient id="radarGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#EC4899" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* 1. Header: Thẻ hồ sơ phong cách */}
      <div className="rounded-2xl bg-[#16202E] border border-[#2A374A] p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.username)}`}
                alt="Avatar"
                className="w-16 h-16 rounded-2xl bg-[#0F172A] border-2 border-pink-500/30 object-cover shadow-md"
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-pink-500 flex items-center justify-center text-white shadow-sm">
                <Crown className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-black text-white">{user.username}</h1>
                <span className="px-2 py-0.5 rounded-md bg-[#0F172A] text-amber-400 text-xs font-mono font-bold border border-[#2A374A]">
                  Elo: {user.eloRating}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-pink-500/15 text-pink-400 text-xs font-bold border border-pink-500/30 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {profile?.clusterLabel || 'Phòng thủ'}
                </span>
                <span 
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 ${currentReliability.color}`}
                  title={`${currentReliability.label} — Dữ liệu phân tích từ ${profile?.gamesAnalyzed || 0} ván gần nhất`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  {profile?.gamesAnalyzed && profile.gamesAnalyzed > 0
                    ? `Dựa trên ${profile.gamesAnalyzed} ván gần nhất`
                    : 'Chưa có dữ liệu ván đấu'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleRecompute}
            disabled={isRecomputing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#2A374A] text-white text-xs font-bold border border-[#334155] active:scale-95 transition-all self-start md:self-auto"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRecomputing ? 'animate-spin text-pink-400' : ''}`} />
            <span>{isRecomputing ? 'Đang phân tích...' : 'Cập nhật lại hồ sơ'}</span>
          </button>
        </div>
      </div>

      {/* 2. Hàng 2: Biểu đồ Radar và Thống kê 3 giai đoạn */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Radar Chart */}
        <div className="lg:col-span-6 rounded-2xl bg-[#16202E] border border-[#2A374A] p-6 shadow-xl flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-pink-400" />
              Biểu Đồ Năng Lực Toàn Diện
            </h3>
            <span className="text-[11px] text-[#64748B]">Thang điểm 0 - 100</span>
          </div>
          {renderRadarChart()}
        </div>

        {/* Thống kê chi tiết từng giai đoạn */}
        <div className="lg:col-span-6 rounded-2xl bg-[#16202E] border border-[#2A374A] p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-pink-400" />
              Phong Độ Qua 3 Giai Đoạn
            </h3>

            <div className="space-y-4">
              {/* Đầu trận */}
              <div className="p-3.5 rounded-xl bg-[#0F172A] border border-[#2A374A]">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-white">Đầu trận</span>
                  <span className="text-pink-400 font-mono font-bold">
                    {profile?.weaknessAnalysis?.phaseScores?.opening !== undefined
                      ? `${profile.weaknessAnalysis.phaseScores.opening} / 100`
                      : '-- / 100'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
                  <span>
                    Mất điểm TB:{' '}
                    {profile?.featureVector?.openingCpl && profile.featureVector.openingCpl > 0
                      ? `${profile.featureVector.openingCpl} cpl`
                      : 'Đang chờ phân tích'}
                  </span>
                  <span>
                    Tỉ lệ sai lầm:{' '}
                    {profile?.featureVector?.openingBlunderRate !== undefined
                      ? `${(profile.featureVector.openingBlunderRate * 100).toFixed(1)}%`
                      : '--%'}
                  </span>
                </div>
              </div>

              {/* Giữa trận */}
              <div className="p-3.5 rounded-xl bg-[#0F172A] border border-[#2A374A]">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-white">Giữa trận</span>
                  <span className="text-pink-400 font-mono font-bold">
                    {profile?.weaknessAnalysis?.phaseScores?.middlegame !== undefined
                      ? `${profile.weaknessAnalysis.phaseScores.middlegame} / 100`
                      : '-- / 100'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
                  <span>
                    Mất điểm TB:{' '}
                    {profile?.featureVector?.middlegameCpl && profile.featureVector.middlegameCpl > 0
                      ? `${profile.featureVector.middlegameCpl} cpl`
                      : 'Đang chờ phân tích'}
                  </span>
                  <span>
                    Tỉ lệ sai lầm:{' '}
                    {profile?.featureVector?.middlegameBlunderRate !== undefined
                      ? `${(profile.featureVector.middlegameBlunderRate * 100).toFixed(1)}%`
                      : '--%'}
                  </span>
                </div>
              </div>

              {/* Cuối trận */}
              <div className="p-3.5 rounded-xl bg-[#0F172A] border border-[#2A374A]">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-white">Cuối trận</span>
                  <span className="text-pink-400 font-mono font-bold">
                    {profile?.weaknessAnalysis?.phaseScores?.endgame !== undefined
                      ? `${profile.weaknessAnalysis.phaseScores.endgame} / 100`
                      : '-- / 100'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
                  <span>
                    Mất điểm TB:{' '}
                    {profile?.featureVector?.endgameCpl && profile.featureVector.endgameCpl > 0
                      ? `${profile.featureVector.endgameCpl} cpl`
                      : 'Đang chờ phân tích'}
                  </span>
                  <span>
                    Tỉ lệ sai lầm:{' '}
                    {profile?.featureVector?.endgameBlunderRate !== undefined
                      ? `${(profile.featureVector.endgameBlunderRate * 100).toFixed(1)}%`
                      : '--%'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#2A374A] flex items-center justify-between text-xs text-[#94A3B8]">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-pink-400" />
              <span>Thời gian suy nghĩ TB:</span>
            </div>
            <span className="font-mono font-bold text-white">
              {profile?.featureVector?.averageThinkingTimeMs && profile.featureVector.averageThinkingTimeMs > 0
                ? `${(profile.featureVector.averageThinkingTimeMs / 1000).toFixed(1)}s / nước`
                : '-- s / nước'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Chẩn đoán Điểm yếu & Lời khuyên */}
      <div className="rounded-2xl bg-[#16202E] border border-[#2A374A] p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          Phân Tích Điểm Yếu & Lời Khuyên
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Điểm mạnh */}
          <div className="p-4 rounded-xl bg-[#0F172A] border border-emerald-500/20">
            <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-2.5">
              <CheckCircle2 className="w-4 h-4" />
              Điểm mạnh nổi bật
            </h4>
            <ul className="space-y-2 text-xs text-[#CBD5E1]">
              {(profile?.weaknessAnalysis?.strengths || ['Khai cuộc tự tin và chủ động']).map((s, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Điểm cần lưu ý */}
          <div className="p-4 rounded-xl bg-[#0F172A] border border-rose-500/20">
            <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5 mb-2.5">
              <AlertTriangle className="w-4 h-4" />
              Khâu cần cải thiện
            </h4>
            <ul className="space-y-2 text-xs text-[#CBD5E1]">
              {(profile?.weaknessAnalysis?.weaknesses || ['Thường để mất ưu thế ở cuối trận']).map((w, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Lời khuyên */}
        <div className="p-4 rounded-xl bg-pink-500/10 border border-pink-500/20 text-xs text-pink-200 flex items-start gap-3">
          <Info className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold mb-1">Gợi ý rèn luyện:</p>
            <p className="leading-relaxed text-pink-100/90">
              {profile?.weaknessAnalysis?.summary || 'Tập trung rèn luyện thêm kỹ thuật cuối trận và kiểm soát thời gian thi đấu sẽ giúp thế cờ của bạn chắc chắn hơn.'}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Bài tập & Thế cờ gợi ý cá nhân hóa */}
      <div className="rounded-2xl bg-[#16202E] border border-[#2A374A] p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Puzzle className="w-4 h-4 text-pink-400" />
            Bài Tập Đề Xuất Cho Bạn
          </h3>
          <span className="text-xs text-[#94A3B8]">Dựa trên điểm yếu & Elo {user.eloRating}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {recommendations.length > 0 ? (
            recommendations.map((p) => (
              <div
                key={p.puzzleId}
                className="p-4 rounded-xl bg-[#0F172A] border border-[#2A374A] hover:border-pink-500/40 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white group-hover:text-pink-400 transition-colors">
                      {p.title}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-pink-500/20 text-pink-400 text-[10px] font-mono font-bold">
                      Elo {p.rating}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#94A3B8] line-clamp-2 mb-3 leading-relaxed">
                    {p.description}
                  </p>
                  <p className="text-[10px] text-[#64748B] italic">
                    💡 {p.matchReason}
                  </p>
                </div>

                <button
                  onClick={() => onSelectTab && onSelectTab('puzzles')}
                  className="mt-4 w-full py-2 px-3 rounded-lg bg-[#1E293B] hover:bg-pink-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Luyện tập thế cờ này</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          ) : (
            <div className="col-span-2 text-center py-6 text-xs text-[#94A3B8]">
              Đang tải bài tập phù hợp...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
