import React, { useState, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import { PUZZLES_DATA, PuzzleData } from '../data/puzzles';
import { ChessBoardComponent } from './ChessBoard';
import { PlayerCard } from './PlayerCard';
import { sounds } from '../utils/soundEffects';
import { Puzzle, Lightbulb, RotateCcw, ArrowRight, CheckCircle2, XCircle, Trophy } from 'lucide-react';

export const PuzzleView: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const puzzle: PuzzleData = PUZZLES_DATA[currentIndex];

  const [game, setGame] = useState(() => new Chess(puzzle.fen));
  const [fen, setFen] = useState(puzzle.fen);
  const [status, setStatus] = useState<'IDLE' | 'SOLVED' | 'FAILED'>('IDLE');
  const [showHint, setShowHint] = useState(false);
  const [moveStep, setMoveStep] = useState(0);

  // Khi chuyển bài tập mới
  useEffect(() => {
    const newGame = new Chess(puzzle.fen);
    setGame(newGame);
    setFen(puzzle.fen);
    setStatus('IDLE');
    setShowHint(false);
    setMoveStep(0);
  }, [currentIndex, puzzle]);

  // Xử lý khi người chơi thả quân cờ giải đố
  const handlePieceDrop = (from: Square, to: Square): boolean => {
    if (status !== 'IDLE') return false;

    const expectedMove = puzzle.solution[moveStep];
    const isCorrect = from === expectedMove.from && to === expectedMove.to;

    if (isCorrect) {
      try {
        const move = game.move({ from, to, promotion: expectedMove.promotion || 'q' });
        if (move) {
          const newFen = game.fen();
          setFen(newFen);

          const nextStep = moveStep + 1;
          setMoveStep(nextStep);

          if (nextStep >= puzzle.solution.length) {
            setStatus('SOLVED');
            sounds.playGameEndWin();
          } else {
            sounds.playMove();
          }
          return true;
        }
      } catch (err) {
        return false;
      }
    } else {
      setStatus('FAILED');
      sounds.playInvalid();
      return false;
    }

    return false;
  };

  // Reset bài tập hiện tại
  const handleRetry = () => {
    const resetG = new Chess(puzzle.fen);
    setGame(resetG);
    setFen(puzzle.fen);
    setStatus('IDLE');
    setShowHint(false);
    setMoveStep(0);
  };

  // Sang bài tiếp theo
  const handleNextPuzzle = () => {
    if (currentIndex < PUZZLES_DATA.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  return (
    <div className="w-full h-full max-w-7xl mx-auto flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 items-center justify-center select-none">
      
      {/* CỘT TRÁI (8/12 Cols): Bàn cờ & Player Cards Chuẩn Giao diện */}
      <div className="lg:col-span-8 flex flex-col items-center justify-between h-full py-1">
        {/* Card ĐỐI THỦ (Phía trên bàn cờ) */}
        <PlayerCard
          isAi={true}
          name={puzzle.turn === 'w' ? 'Quân Đen (Đối thủ)' : 'Quân Trắng (Đối thủ)'}
          subText={`Thế cờ Puzzle #${currentIndex + 1}`}
          color={puzzle.turn === 'w' ? 'b' : 'w'}
          gameStatus="IN_PROGRESS"
        />

        {/* Bàn cờ Cờ vua (Bằng kích thước mượt mà chuẩn) */}
        <ChessBoardComponent
          game={game}
          fen={fen}
          playerColor={puzzle.turn}
          onPieceDrop={handlePieceDrop}
          disabled={status !== 'IDLE'}
        />

        {/* Card NGUYÊN THỂ BẢN THÂN (Phía dưới bàn cờ) */}
        <PlayerCard
          isAi={false}
          name={puzzle.turn === 'w' ? 'Bạn (Cầm quân Trắng)' : 'Bạn (Cầm quân Đen)'}
          subText={`Lượt tìm nước cờ giải đố`}
          color={puzzle.turn}
          gameStatus="IN_PROGRESS"
        />
      </div>

      {/* CỘT PHẢI (4/12 Cols): Bảng Điều Khiển & Thông Tin Bài Tập */}
      <div className="lg:col-span-4 flex flex-col gap-3 h-full max-h-[calc(100vh-40px)] justify-between">
        <div className="flex flex-col gap-3 h-full justify-between">
          
          {/* Top Bar: Thẻ Tiêu đề & Cấp độ */}
          <div className="p-3 bg-[#262421] rounded-2xl border border-[#312E2B] flex items-center justify-between shadow-lg shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-pink-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
                <Puzzle className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-black text-pink-400 uppercase tracking-wider block">
                  Bài tập #{currentIndex + 1} / {PUZZLES_DATA.length}
                </span>
                <span className="text-xs font-extrabold text-white">
                  {puzzle.title}
                </span>
              </div>
            </div>

            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              puzzle.difficulty === 'Dễ' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
              puzzle.difficulty === 'Trung bình' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
              'bg-rose-500/15 text-rose-300 border border-rose-500/30'
            }`}>
              🧩 {puzzle.rating} Elo
            </span>
          </div>

          {/* Khung Thông Tin & Mô Tả Bài Tập */}
          <div className="p-4 bg-[#262421] rounded-2xl border border-[#312E2B] flex flex-col gap-3 shadow-xl shrink-0">
            <div className="border-b border-[#312E2B] pb-2">
              <h3 className="font-bold text-xs text-white mb-1">Mô tả nhiệm vụ:</h3>
              <p className="text-xs text-[#8B8987] leading-relaxed">{puzzle.description}</p>
            </div>

            {/* Trạng thái Giải Đố */}
            <div className="mt-1">
              {status === 'IDLE' && (
                <div className="p-3 rounded-xl bg-[#1C1A17] border border-[#312E2B] text-center text-xs font-semibold text-slate-300">
                  Lượt đi của quân <strong className={puzzle.turn === 'w' ? 'text-amber-300' : 'text-pink-400'}>{puzzle.turn === 'w' ? 'Trắng' : 'Đen'}</strong>. Hãy tìm nước cờ giải đố!
                </div>
              )}

              {status === 'SOLVED' && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-center text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg animate-bounce">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>CHÍNH XÁC 100%! Bạn đã giải thành công thế cờ này! 🎉</span>
                </div>
              )}

              {status === 'FAILED' && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-center text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg">
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>NƯỚC ĐI SAI! Hãy bấm "Thử lại" để giải lại.</span>
                </div>
              )}
            </div>

            {/* Gợi Ý Nối Tiếp */}
            {showHint && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
                <span><strong>Gợi ý:</strong> {puzzle.hint}</span>
              </div>
            )}
          </div>

          {/* Bảng Điều Khiển Nút Thao Tác (Gợi ý, Thử lại, Bài tiếp) */}
          <div className="p-4 bg-[#262421] rounded-2xl border border-[#312E2B] flex flex-col gap-2.5 shadow-xl shrink-0">
            <button
              onClick={handleNextPuzzle}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-pink-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <span>Bài Tiếp Theo</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => setShowHint(!showHint)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <span>{showHint ? 'Ẩn gợi ý' : 'Gợi ý'}</span>
              </button>

              <button
                onClick={handleRetry}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#312E2B] hover:bg-[#3B3835] text-[#BAB8B6] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Thử lại</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
