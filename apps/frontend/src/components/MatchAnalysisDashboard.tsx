import React, { useMemo, useState } from 'react';
import { GameAnalysisReport, CompletedMoveAnalysis, MoveClassification } from '../services/analysis/types';
import { Trophy, Award, TrendingUp, AlertTriangle, CheckCircle, Flame, BarChart2 } from 'lucide-react';

interface MatchAnalysisDashboardProps {
  report?: GameAnalysisReport | null;
  summaryData?: any;
  currentPly: number;
  onSelectPly: (ply: number) => void;
  whitePlayerName: string;
  blackPlayerName: string;
  whiteElo?: number;
  blackElo?: number;
  gameModeLabel?: string;
  endReasonLabel?: string;
  dateStr?: string;
}

const CLASSIFICATION_MAP: Record<MoveClassification, { label: string; color: string; bg: string; border: string }> = {
  BEST: { label: 'Tối ưu', color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  EXCELLENT: { label: 'Rất tốt', color: 'text-teal-400', bg: 'bg-teal-500/15', border: 'border-teal-500/30' },
  GOOD: { label: 'Nước tốt', color: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30' },
  INACCURACY: { label: 'Chưa tối ưu', color: 'text-yellow-400', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30' },
  MISTAKE: { label: 'Sai lầm', color: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
  BLUNDER: { label: 'Sai sót lớn', color: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/30' },
};

export const MatchAnalysisDashboard: React.FC<MatchAnalysisDashboardProps> = ({
  report,
  summaryData,
  currentPly,
  onSelectPly,
  whitePlayerName,
  blackPlayerName,
  whiteElo,
  blackElo,
  gameModeLabel,
  endReasonLabel,
  dateStr,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Đọc dữ liệu tổng kết (ưu tiên từ report, fallback sang summaryData)
  const whiteAcc = report?.summary?.white?.accuracy ?? summaryData?.whiteAccuracy ?? 0;
  const blackAcc = report?.summary?.black?.accuracy ?? summaryData?.blackAccuracy ?? 0;
  const whiteAvgCpl = report?.summary?.white?.avgCpl ?? summaryData?.whiteAvgCpl ?? 0;
  const blackAvgCpl = report?.summary?.black?.avgCpl ?? summaryData?.blackAvgCpl ?? 0;

  // Đếm phân loại nước đi
  const classificationCounts = useMemo(() => {
    const counts = {
      white: { BEST: 0, EXCELLENT: 0, GOOD: 0, INACCURACY: 0, MISTAKE: 0, BLUNDER: 0 },
      black: { BEST: 0, EXCELLENT: 0, GOOD: 0, INACCURACY: 0, MISTAKE: 0, BLUNDER: 0 },
    };

    if (report?.summary?.white && report?.summary?.black) {
      counts.white.BEST = report.summary.white.bestCount || 0;
      counts.white.EXCELLENT = report.summary.white.excellentCount || 0;
      counts.white.GOOD = report.summary.white.goodCount || 0;
      counts.white.INACCURACY = report.summary.white.inaccuracyCount || 0;
      counts.white.MISTAKE = report.summary.white.mistakeCount || 0;
      counts.white.BLUNDER = report.summary.white.blunderCount || 0;

      counts.black.BEST = report.summary.black.bestCount || 0;
      counts.black.EXCELLENT = report.summary.black.excellentCount || 0;
      counts.black.GOOD = report.summary.black.goodCount || 0;
      counts.black.INACCURACY = report.summary.black.inaccuracyCount || 0;
      counts.black.MISTAKE = report.summary.black.mistakeCount || 0;
      counts.black.BLUNDER = report.summary.black.blunderCount || 0;
      return counts;
    }

    if (Array.isArray(summaryData?.moveClassifications)) {
      for (const m of summaryData.moveClassifications) {
        const side = m.ply % 2 === 1 ? 'white' : 'black';
        const cls = m.classification as MoveClassification;
        if (counts[side][cls] !== undefined) {
          counts[side][cls]++;
        }
      }
    }

    return counts;
  }, [report, summaryData]);

  // Tạo tọa độ đồ thị thế trận SVG
  const chartData = useMemo(() => {
    const movesList: Array<{ ply: number; san: string; color: 'w' | 'b'; eval: number; cls?: string }> = [];

    if (report?.moves && report.moves.length > 0) {
      report.moves.forEach((m) => {
        movesList.push({
          ply: m.ply,
          san: m.san,
          color: m.color,
          eval: m.color === 'w' ? m.evalAfter : -m.evalAfter,
          cls: m.classification,
        });
      });
    } else if (Array.isArray(summaryData?.moveClassifications) && summaryData.moveClassifications.length > 0) {
      summaryData.moveClassifications.forEach((m: any) => {
        const color = m.ply % 2 === 1 ? 'w' : 'b';
        const ev = m.eval ?? 0;
        movesList.push({
          ply: m.ply,
          san: m.san,
          color,
          eval: color === 'w' ? ev : -ev,
          cls: m.classification,
        });
      });
    }

    if (movesList.length < 2) return null;

    const width = 800;
    const height = 160;
    const padding = { top: 20, bottom: 20, left: 35, right: 20 };
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;

    const points = movesList.map((m, idx) => {
      const clamped = Math.max(-1000, Math.min(1000, m.eval));
      const x = padding.left + (idx / (movesList.length - 1)) * innerW;
      const y = padding.top + innerH * (1 - (clamped + 1000) / 2000);
      return { x, y, clamped, ...m };
    });

    const zeroY = padding.top + innerH * 0.5;

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    // Vùng fill thế trận
    const areaPathWhite = `${pathD} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`;

    return { width, height, points, zeroY, pathD, areaPathWhite };
  }, [report, summaryData]);

  return (
    <div className="w-full bg-[#0B0F19] border border-[#1E293B] rounded-3xl p-4 md:p-6 shadow-2xl mt-4 space-y-6 animate-in fade-in select-none">
      {/* 1. TIÊU ĐỀ PHÂN TÍCH */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-[#243247]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-pink-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-black text-white flex items-center gap-2">
              <span>Báo Cáo Phân Tích Ván Đấu</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Stockfish Engine
              </span>
            </h3>
            <p className="text-xs text-[#94A3B8] flex items-center gap-2 mt-0.5">
              <span>{gameModeLabel || 'Trực tuyến'}</span>
              <span>•</span>
              <span>{endReasonLabel || 'Hoàn tất'}</span>
              {dateStr && (
                <>
                  <span>•</span>
                  <span>{dateStr}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Thanh trạng thái nhanh */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-xl bg-[#1E293B] border border-[#2A374A] text-xs flex items-center gap-2 font-mono">
            <span className="text-[#94A3B8]">Trắng:</span>
            <span className="text-emerald-400 font-bold">{Math.round(whiteAcc)}%</span>
            <span className="text-slate-600">|</span>
            <span className="text-[#94A3B8]">Đen:</span>
            <span className="text-purple-400 font-bold">{Math.round(blackAcc)}%</span>
          </div>
        </div>
      </div>

      {/* 2. THẺ SO SÁNH ĐỘ CHÍNH XÁC 2 BÊN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quân Trắng */}
        <div className="p-4 rounded-2xl bg-[#16202E] border border-[#2A374A] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#243247]">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-white border border-slate-300 shadow flex items-center justify-center text-[10px] font-black text-black">
                ⚪
              </div>
              <div>
                <p className="font-extrabold text-sm text-white truncate max-w-[160px]">{whitePlayerName}</p>
                <p className="text-[10px] text-[#94A3B8]">{whiteElo ? `Elo: ${whiteElo}` : 'Quân Trắng'}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black font-mono text-emerald-400">{Math.round(whiteAcc)}%</span>
              <span className="text-[10px] text-[#94A3B8] block uppercase font-bold">Chính xác</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3 text-center">
            <div className="p-2 rounded-xl bg-[#0B0F19] border border-[#1E293B]">
              <span className="text-[10px] text-[#94A3B8] block">Tổn thất TB</span>
              <span className="font-mono font-bold text-xs text-white mt-0.5 block">{whiteAvgCpl} cp</span>
            </div>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[10px] text-emerald-400 block">Nước tối ưu ★</span>
              <span className="font-mono font-bold text-xs text-emerald-300 mt-0.5 block">
                {classificationCounts.white.BEST + classificationCounts.white.EXCELLENT}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <span className="text-[10px] text-rose-400 block">Sai sót lớn ??</span>
              <span className="font-mono font-bold text-xs text-rose-300 mt-0.5 block">
                {classificationCounts.white.BLUNDER}
              </span>
            </div>
          </div>
        </div>

        {/* Quân Đen */}
        <div className="p-4 rounded-2xl bg-[#16202E] border border-[#2A374A] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#243247]">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-[#111] border border-slate-600 shadow flex items-center justify-center text-[10px] font-black text-white">
                ⚫
              </div>
              <div>
                <p className="font-extrabold text-sm text-white truncate max-w-[160px]">{blackPlayerName}</p>
                <p className="text-[10px] text-[#94A3B8]">{blackElo ? `Elo: ${blackElo}` : 'Quân Đen'}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black font-mono text-purple-400">{Math.round(blackAcc)}%</span>
              <span className="text-[10px] text-[#94A3B8] block uppercase font-bold">Chính xác</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3 text-center">
            <div className="p-2 rounded-xl bg-[#0B0F19] border border-[#1E293B]">
              <span className="text-[10px] text-[#94A3B8] block">Tổn thất TB</span>
              <span className="font-mono font-bold text-xs text-white mt-0.5 block">{blackAvgCpl} cp</span>
            </div>
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <span className="text-[10px] text-purple-400 block">Nước tối ưu ★</span>
              <span className="font-mono font-bold text-xs text-purple-300 mt-0.5 block">
                {classificationCounts.black.BEST + classificationCounts.black.EXCELLENT}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <span className="text-[10px] text-rose-400 block">Sai sót lớn ??</span>
              <span className="font-mono font-bold text-xs text-rose-300 mt-0.5 block">
                {classificationCounts.black.BLUNDER}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BIỂU ĐỒ BIẾN ĐỘNG THẾ TRẬN SVG */}
      <div className="p-4 rounded-2xl bg-[#16202E] border border-[#2A374A] space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-pink-400" />
            <h4 className="text-xs font-black text-white uppercase tracking-wider">
              Biểu Đồ Lợi Thế Thế Cờ (Centipawns)
            </h4>
          </div>
          <span className="text-[10px] text-[#94A3B8]">
            Nhấp chuột vào biểu đồ để tua nhanh đến nước cờ tương ứng
          </span>
        </div>

        {chartData ? (
          <div className="relative w-full bg-[#0B0F19] rounded-xl border border-[#243247] p-2 overflow-hidden">
            <svg
              viewBox={`0 0 ${chartData.width} ${chartData.height}`}
              className="w-full h-36 md:h-44 select-none"
            >
              <defs>
                <linearGradient id="curveGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
                </linearGradient>
              </defs>

              {/* Đường chuẩn 0.0 (Cân bằng) */}
              <line
                x1="35"
                y1={chartData.zeroY}
                x2={chartData.width - 20}
                y2={chartData.zeroY}
                stroke="#334155"
                strokeDasharray="4 4"
                strokeWidth="1.5"
              />
              <text x="5" y={chartData.zeroY + 4} fill="#94A3B8" fontSize="10" fontFamily="monospace">
                0.0
              </text>
              <text x="5" y="22" fill="#10B981" fontSize="9" fontFamily="monospace">
                +10
              </text>
              <text x="5" y={chartData.height - 10} fill="#F43F5E" fontSize="9" fontFamily="monospace">
                -10
              </text>

              {/* Đường cong thế trận */}
              <path
                d={chartData.pathD}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Các điểm nước đi trên đồ thị */}
              {chartData.points.map((pt, i) => {
                const isSelected = pt.ply === currentPly;
                const isHovered = hoveredIndex === i;
                const isBlunder = pt.cls === 'BLUNDER';
                const isMistake = pt.cls === 'MISTAKE';

                return (
                  <g key={pt.ply}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 6 : isHovered ? 5 : isBlunder ? 4 : 2.5}
                      fill={
                        isSelected
                          ? '#EC4899'
                          : isBlunder
                          ? '#F43F5E'
                          : isMistake
                          ? '#FB923C'
                          : pt.color === 'w'
                          ? '#FFFFFF'
                          : '#64748B'
                      }
                      stroke={isSelected ? '#FFFFFF' : '#1E1B18'}
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer transition-all hover:scale-150"
                      onClick={() => onSelectPly(pt.ply)}
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      <title>
                        {`Nước ${pt.ply}. ${pt.san} (${(pt.eval / 100).toFixed(1)})`}
                      </title>
                    </circle>

                    {/* Vạch highlight nước cờ đang chọn */}
                    {isSelected && (
                      <line
                        x1={pt.x}
                        y1="10"
                        x2={pt.x}
                        y2={chartData.height - 10}
                        stroke="#EC4899"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Chú thích màu sắc biểu đồ */}
            <div className="flex items-center justify-between text-[11px] text-[#94A3B8] px-2 pt-1 border-t border-[#16202E]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-white inline-block"></span>
                <span>Trên vạch: Trắng ưu thế</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EC4899] inline-block"></span>
                <span className="text-pink-400 font-bold">Nước cờ đang xem: {currentPly}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#64748B] inline-block"></span>
                <span>Dưới vạch: Đen ưu thế</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="h-28 flex items-center justify-center text-[#94A3B8] text-xs italic bg-[#0B0F19] rounded-xl border border-[#243247]">
            Đang tải dữ liệu đồ thị hoặc ván đấu quá ngắn để vẽ đồ thị...
          </div>
        )}
      </div>

      {/* 4. BẢNG PHÂN LOẠI CHI TIẾT CÁC NƯỚC ĐI */}
      <div className="p-4 rounded-2xl bg-[#16202E] border border-[#2A374A] space-y-3">
        <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
          <span>Thống Kê Phân Loại Từng Nước Cờ</span>
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#94A3B8] border-b border-[#243247] text-left">
                <th className="pb-2 font-bold">Phân Loại</th>
                <th className="pb-2 font-bold text-center">⚪ Quân Trắng</th>
                <th className="pb-2 font-bold text-center">⚫ Quân Đen</th>
                <th className="pb-2 font-bold text-right">Mức độ ảnh hưởng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#16202E]">
              {(['BEST', 'EXCELLENT', 'GOOD', 'INACCURACY', 'MISTAKE', 'BLUNDER'] as MoveClassification[]).map((cls) => {
                const conf = CLASSIFICATION_MAP[cls];
                const countW = classificationCounts.white[cls];
                const countB = classificationCounts.black[cls];

                return (
                  <tr key={cls} className="hover:bg-[#1E293B]/40 transition-colors">
                    <td className="py-2.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-xs border ${conf.bg} ${conf.color} ${conf.border}`}>
                        {conf.label}
                      </span>
                    </td>
                    <td className="py-2.5 text-center font-mono font-bold text-white">
                      {countW}
                    </td>
                    <td className="py-2.5 text-center font-mono font-bold text-white">
                      {countB}
                    </td>
                    <td className="py-2.5 text-right text-[11px] text-[#94A3B8]">
                      {cls === 'BEST' && 'Nước đi hoàn hảo của Engine'}
                      {cls === 'EXCELLENT' && 'Nước đi xuất sắc duy trì ưu thế'}
                      {cls === 'GOOD' && 'Nước đi vững chắc'}
                      {cls === 'INACCURACY' && 'Đánh mất một phần lợi thế'}
                      {cls === 'MISTAKE' && 'Gây bất lợi cho thế cờ'}
                      {cls === 'BLUNDER' && 'Đảo chiều thế trận nghiêm trọng'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
