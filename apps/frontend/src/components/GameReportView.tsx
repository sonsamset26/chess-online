import React, { useState, useMemo } from 'react';
import { Chess } from 'chess.js';
import { GameAnalysisReport, CompletedMoveAnalysis, MoveClassification } from '../services/analysis/types';
import { ChessBoardComponent } from './ChessBoard';

interface GameReportViewProps {
  report: GameAnalysisReport;
  onClose: () => void;
  isTournament?: boolean;
  onViewBracket?: () => void;
}

const CLASSIFICATION_COLORS: Record<MoveClassification, { bg: string; text: string; dot: string }> = {
  BEST: { bg: 'bg-emerald-950/60', text: 'text-emerald-400', dot: '#22c55e' },
  EXCELLENT: { bg: 'bg-green-950/60', text: 'text-green-400', dot: '#4ade80' },
  GOOD: { bg: 'bg-blue-950/60', text: 'text-blue-400', dot: '#60a5fa' },
  INACCURACY: { bg: 'bg-yellow-950/60', text: 'text-yellow-400', dot: '#facc15' },
  MISTAKE: { bg: 'bg-orange-950/60', text: 'text-orange-400', dot: '#fb923c' },
  BLUNDER: { bg: 'bg-red-950/60', text: 'text-red-400', dot: '#f87171' },
};

export const GameReportView: React.FC<GameReportViewProps> = ({
  report,
  onClose,
  isTournament = false,
  onViewBracket,
}) => {
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number>(
    report.moves.length > 0 ? report.moves.length - 1 : -1
  );
  const [hoveredMove, setHoveredMove] = useState<CompletedMoveAnalysis | null>(null);

  // Instance Chess độc lập để xem lại nước đi mà không ảnh hưởng tới ván chính
  const replayGame = useMemo(() => new Chess(), []);

  // Cập nhật FEN của bàn cờ xem lại
  const currentFen = useMemo(() => {
    if (selectedMoveIndex >= 0 && selectedMoveIndex < report.moves.length) {
      return report.moves[selectedMoveIndex].fenAfter;
    }
    return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }, [selectedMoveIndex, report.moves]);

  // Cập nhật state nội bộ của replayGame
  useMemo(() => {
    try {
      replayGame.load(currentFen);
    } catch {
      // ignore
    }
  }, [currentFen, replayGame]);

  // Dữ liệu đồ thị SVG
  const chartData = useMemo(() => {
    if (!report.moves || report.moves.length < 2) return null;

    const width = 640;
    const height = 150;
    const padding = { top: 15, bottom: 15, left: 30, right: 15 };
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;

    const points = report.moves.map((m, idx) => {
      // Chuẩn hóa về góc nhìn bên Trắng
      const scoreWhite = m.color === 'w' ? m.evalAfter : -m.evalAfter;
      // Clamp [-1000, 1000]
      const clamped = Math.max(-1000, Math.min(1000, scoreWhite));
      const x = padding.left + (idx / (report.moves.length - 1)) * innerW;
      // Y: +1000 ở trên (top), -1000 ở dưới (bottom)
      const y = padding.top + innerH * (1 - (clamped + 1000) / 2000);

      return {
        x,
        y,
        scoreWhite,
        clamped,
        move: m,
        idx,
      };
    });

    const zeroY = padding.top + innerH * 0.5;

    // Tạo SVG Path string
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    return {
      width,
      height,
      padding,
      points,
      zeroY,
      pathD,
    };
  }, [report.moves]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#1e1e1e] border border-neutral-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-[#252525]">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">📊</span>
            <div>
              <h2 className="text-lg font-bold text-white">Báo Cáo Phân Tích Ván Đấu</h2>
              <p className="text-xs text-neutral-400">
                Thời gian phân tích: {(report.analysisDurationMs / 1000).toFixed(1)}s • Tổng {report.totalPlies} plies
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isTournament && onViewBracket && (
              <button
                onClick={onViewBracket}
                className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition"
              >
                🏆 Xem Bracket
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-lg transition"
            >
              ✕ Đóng
            </button>
          </div>
        </div>

        {/* Nội dung chính */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tóm tắt chỉ số hai bên */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* White summary */}
            <div className="bg-[#262626] border border-neutral-700/60 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-700/40">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-white border border-neutral-400" />
                  <span className="font-bold text-neutral-200 text-sm">Quân Trắng (White)</span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-emerald-400">
                    {report.summary.white.accuracy}%
                  </span>
                  <span className="text-xs text-neutral-400 block">Độ chính xác</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-3 text-center text-xs">
                <div className="bg-neutral-800/80 p-1.5 rounded">
                  <span className="text-neutral-400 block">Avg CPL</span>
                  <span className="font-semibold text-neutral-200">{report.summary.white.avgCpl}</span>
                </div>
                <div className="bg-emerald-950/40 border border-emerald-800/40 p-1.5 rounded">
                  <span className="text-emerald-400 block">Best</span>
                  <span className="font-semibold text-emerald-300">{report.summary.white.bestCount}</span>
                </div>
                <div className="bg-orange-950/40 border border-orange-800/40 p-1.5 rounded">
                  <span className="text-orange-400 block">Mistake</span>
                  <span className="font-semibold text-orange-300">{report.summary.white.mistakeCount}</span>
                </div>
                <div className="bg-red-950/40 border border-red-800/40 p-1.5 rounded">
                  <span className="text-red-400 block">Blunder</span>
                  <span className="font-semibold text-red-300">{report.summary.white.blunderCount}</span>
                </div>
              </div>
            </div>

            {/* Black summary */}
            <div className="bg-[#262626] border border-neutral-700/60 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-700/40">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-neutral-900 border border-neutral-600" />
                  <span className="font-bold text-neutral-200 text-sm">Quân Đen (Black)</span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-emerald-400">
                    {report.summary.black.accuracy}%
                  </span>
                  <span className="text-xs text-neutral-400 block">Độ chính xác</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-3 text-center text-xs">
                <div className="bg-neutral-800/80 p-1.5 rounded">
                  <span className="text-neutral-400 block">Avg CPL</span>
                  <span className="font-semibold text-neutral-200">{report.summary.black.avgCpl}</span>
                </div>
                <div className="bg-emerald-950/40 border border-emerald-800/40 p-1.5 rounded">
                  <span className="text-emerald-400 block">Best</span>
                  <span className="font-semibold text-emerald-300">{report.summary.black.bestCount}</span>
                </div>
                <div className="bg-orange-950/40 border border-orange-800/40 p-1.5 rounded">
                  <span className="text-orange-400 block">Mistake</span>
                  <span className="font-semibold text-orange-300">{report.summary.black.mistakeCount}</span>
                </div>
                <div className="bg-red-950/40 border border-red-800/40 p-1.5 rounded">
                  <span className="text-red-400 block">Blunder</span>
                  <span className="font-semibold text-red-300">{report.summary.black.blunderCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Biểu đồ SVG thuần */}
          <div className="bg-[#262626] border border-neutral-700/60 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-neutral-200">📈 Biểu đồ Lợi thế Thế cờ (Centipawns)</h3>
              {hoveredMove && (
                <div className="text-xs text-neutral-300">
                  Nước {hoveredMove.moveNumber}{hoveredMove.color === 'w' ? '.' : '...'}{hoveredMove.san}:{' '}
                  <span className="font-bold text-amber-300">
                    {Math.abs(hoveredMove.evalAfter) >= 9000
                      ? `M${Math.round((10000 - Math.abs(hoveredMove.evalAfter)) / 10)}`
                      : `${(hoveredMove.evalAfter / 100).toFixed(1)} cp`}
                  </span>{' '}
                  • CPL: {hoveredMove.cpl} cp ({hoveredMove.classification})
                </div>
              )}
            </div>

            {chartData ? (
              <div className="w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                  className="w-full h-36 select-none"
                >
                  {/* Đường 0 (Cân bằng) */}
                  <line
                    x1={chartData.padding.left}
                    y1={chartData.zeroY}
                    x2={chartData.width - chartData.padding.right}
                    y2={chartData.zeroY}
                    stroke="#525252"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  {/* Nhãn trục */}
                  <text x="5" y="20" fill="#a3a3a3" fontSize="9">+10</text>
                  <text x="12" y={chartData.zeroY + 3} fill="#a3a3a3" fontSize="9">0</text>
                  <text x="7" y="140" fill="#a3a3a3" fontSize="9">-10</text>

                  {/* Đường đồ thị chính */}
                  <path
                    d={chartData.pathD}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Các node tròn đánh dấu Blunder/Mistake/Best */}
                  {chartData.points.map((pt) => {
                    const isSelected = pt.idx === selectedMoveIndex;
                    const isNotable = ['BLUNDER', 'MISTAKE', 'INACCURACY'].includes(pt.move.classification);

                    return (
                      <circle
                        key={pt.idx}
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 5 : isNotable ? 4 : 2}
                        fill={CLASSIFICATION_COLORS[pt.move.classification].dot}
                        stroke={isSelected ? '#ffffff' : '#1e1e1e'}
                        strokeWidth={isSelected ? 2 : 1}
                        className="cursor-pointer transition-all hover:scale-125"
                        onMouseEnter={() => setHoveredMove(pt.move)}
                        onMouseLeave={() => setHoveredMove(null)}
                        onClick={() => setSelectedMoveIndex(pt.idx)}
                      />
                    );
                  })}
                </svg>
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center text-xs text-neutral-400 italic">
                Ván đấu dưới 2 nước, không đủ dữ liệu để vẽ biểu đồ lợi thế thế cờ.
              </div>
            )}
          </div>

          {/* Bàn cờ xem lại & Danh sách nước đi */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Bàn cờ bên trái */}
            <div className="lg:col-span-5 flex flex-col items-center bg-[#262626] border border-neutral-700/60 rounded-xl p-4">
              <ChessBoardComponent
                game={replayGame}
                fen={currentFen}
                playerColor="w"
                onPieceDrop={() => false}
                disabled={true}
                muted={true}
              />
              <div className="mt-3 flex items-center space-x-2 text-xs text-neutral-400">
                <button
                  onClick={() => setSelectedMoveIndex(Math.max(-1, selectedMoveIndex - 1))}
                  disabled={selectedMoveIndex <= -1}
                  className="px-2.5 py-1 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 rounded font-bold"
                >
                  ◀ Lùi
                </button>
                <span>
                  {selectedMoveIndex >= 0 ? `Nước ${selectedMoveIndex + 1}/${report.moves.length}` : 'Ban đầu'}
                </span>
                <button
                  onClick={() => setSelectedMoveIndex(Math.min(report.moves.length - 1, selectedMoveIndex + 1))}
                  disabled={selectedMoveIndex >= report.moves.length - 1}
                  className="px-2.5 py-1 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 rounded font-bold"
                >
                  Tiến ▶
                </button>
              </div>
            </div>

            {/* Bảng danh sách nước đi bên phải */}
            <div className="lg:col-span-7 bg-[#262626] border border-neutral-700/60 rounded-xl p-4 max-h-[420px] flex flex-col">
              <h3 className="text-sm font-semibold text-neutral-200 mb-3">📋 Danh Sách Nước Đi & Đánh Giá</h3>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-2">
                {report.moves.map((m, idx) => {
                  const isSelected = idx === selectedMoveIndex;
                  const colorConfig = CLASSIFICATION_COLORS[m.classification];

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedMoveIndex(idx)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition ${
                        isSelected
                          ? 'bg-neutral-700 border border-neutral-500'
                          : 'hover:bg-neutral-800/80 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-neutral-400 w-8">
                          {m.moveNumber}{m.color === 'w' ? '.' : '...'}
                        </span>
                        <span className="font-bold text-white w-12">{m.san}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${colorConfig.bg} ${colorConfig.text}`}>
                          {m.classification}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 text-neutral-400">
                        {m.bestMoveSan && m.san !== m.bestMoveSan && (
                          <span className="text-[11px] text-emerald-400">Tối ưu: {m.bestMoveSan}</span>
                        )}
                        <span>CPL: {m.cpl}</span>
                        <span className="font-semibold text-neutral-300">
                          {Math.abs(m.evalAfter) >= 9000
                            ? `M${Math.round((10000 - Math.abs(m.evalAfter)) / 10)}`
                            : `${(m.evalAfter / 100).toFixed(1)}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
