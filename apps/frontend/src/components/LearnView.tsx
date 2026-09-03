import React, { useState, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import { LESSONS_DATA, LessonData, LessonStep } from '../data/lessons';
import { ChessBoardComponent } from './ChessBoard';
import { PlayerCard } from './PlayerCard';
import { sounds } from '../utils/soundEffects';
import { GraduationCap, Lightbulb, RotateCcw, ArrowRight, CheckCircle2, XCircle, BookOpen, Award } from 'lucide-react';

export const LearnView: React.FC = () => {
  const [lessonIndex, setLessonIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  const lesson: LessonData = LESSONS_DATA[lessonIndex] || LESSONS_DATA[0];
  const currentStep: LessonStep = lesson.steps[stepIndex] || lesson.steps[0];

  const [game, setGame] = useState(() => new Chess(currentStep.initialFen));
  const [fen, setFen] = useState(currentStep.initialFen);
  const [status, setStatus] = useState<'IDLE' | 'STEP_DONE' | 'FAILED'>('IDLE');
  const [showHint, setShowHint] = useState(false);

  // Khi chuyển Bài học hoặc chuyển Bước mới
  useEffect(() => {
    if (currentStep && currentStep.initialFen) {
      const newG = new Chess(currentStep.initialFen);
      setGame(newG);
      setFen(currentStep.initialFen);
      setStatus('IDLE');
      setShowHint(false);
    }
  }, [lessonIndex, stepIndex, currentStep]);

  // Xử lý khi người học thực hiện nước đi trên bàn cờ
  const handlePieceDrop = (from: Square, to: Square): boolean => {
    if (status === 'STEP_DONE') return false;

    const expected = currentStep.targetMove;
    const isCorrect = from === expected.from && to === expected.to;

    if (isCorrect) {
      try {
        const move = game.move({ from, to, promotion: expected.promotion || 'q' });
        if (move) {
          setFen(game.fen());
          setStatus('STEP_DONE');
          sounds.playGameEndWin();
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

  // Làm lại bước này
  const handleRetryStep = () => {
    const resetG = new Chess(currentStep.initialFen);
    setGame(resetG);
    setFen(currentStep.initialFen);
    setStatus('IDLE');
    setShowHint(false);
  };

  // Chuyển sang bước tiếp theo hoặc bài học tiếp theo
  const handleNextStep = () => {
    if (stepIndex < lesson.steps.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      // Đã xong toàn bộ bài học -> Sang bài mới
      if (lessonIndex < LESSONS_DATA.length - 1) {
        setLessonIndex((prev) => prev + 1);
        setStepIndex(0);
      } else {
        setLessonIndex(0);
        setStepIndex(0);
      }
    }
  };

  const isLastStepOfLesson = stepIndex === lesson.steps.length - 1;

  return (
    <div className="w-full h-full max-w-7xl mx-auto flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 items-center justify-center select-none">
      
      {/* CỘT TRÁI (8/12 Cols): Bàn cờ Học tương tác chuẩn mực */}
      <div className="lg:col-span-8 flex flex-col items-center justify-between h-full py-1">
        {/* Card ĐỐI THỦ / TÌNH HUỐNG */}
        <PlayerCard
          isAi={true}
          name={`Bài giảng: ${lesson.title}`}
          subText={lesson.chapter}
          color={currentStep.playerColor === 'w' ? 'b' : 'w'}
          gameStatus="IN_PROGRESS"
        />

        {/* Bàn cờ Cờ vua */}
        <ChessBoardComponent
          game={game}
          fen={fen}
          playerColor={currentStep.playerColor}
          onPieceDrop={handlePieceDrop}
          disabled={status === 'STEP_DONE'}
        />

        {/* Card HỌC VIÊN */}
        <PlayerCard
          isAi={false}
          name="Học viên (Bạn)"
          subText={`Thực hành: Bước ${stepIndex + 1} / ${lesson.steps.length}`}
          color={currentStep.playerColor}
          gameStatus="IN_PROGRESS"
        />
      </div>

      {/* CỘT PHẢI (4/12 Cols): Giáo trình Bài giảng & Điều khiển */}
      <div className="lg:col-span-4 flex flex-col gap-3 h-full max-h-[calc(100vh-40px)] justify-between">
        <div className="flex flex-col gap-3 h-full justify-between">
          
          {/* Top Bar: Chọn Bài Học & Tiến độ */}
          <div className="p-3 bg-[#16202E] rounded-2xl border border-[#2A374A] flex items-center justify-between shadow-lg shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-black text-pink-400 uppercase tracking-wider block">
                  {lesson.chapter}
                </span>
                <span className="text-xs font-extrabold text-white">
                  {lesson.title}
                </span>
              </div>
            </div>

            <span className="text-[10px] font-mono font-bold bg-pink-500/10 text-pink-300 px-2 py-0.5 rounded-full border border-pink-500/20">
              Bước {stepIndex + 1}/{lesson.steps.length}
            </span>
          </div>

          {/* Khung Nội Dung Hướng Dẫn & Giải Thích Sư Phạm */}
          <div className="p-4 bg-[#16202E] rounded-2xl border border-[#2A374A] flex flex-col gap-3 shadow-xl shrink-0">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-pink-400 mb-1">
                <BookOpen className="w-4 h-4" />
                <span>Nhiệm vụ: {currentStep.title}</span>
              </div>
              <p className="text-xs text-white leading-relaxed font-semibold">
                {currentStep.instruction}
              </p>
            </div>

            {/* Trạng thái Hoàn thành bước */}
            <div>
              {status === 'IDLE' && (
                <div className="p-3 rounded-xl bg-[#0F172A] border border-[#2A374A] text-center text-xs font-semibold text-slate-300">
                  Hãy thực hiện nước cờ theo chỉ dẫn trên bàn cờ bên trái.
                </div>
              )}

              {status === 'STEP_DONE' && (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex flex-col gap-1.5 shadow-lg animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 font-extrabold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>CHÍNH XÁC TUYỆT VỜI!</span>
                  </div>
                  <p className="text-[11px] text-emerald-200 leading-relaxed font-medium">
                    {currentStep.explanation}
                  </p>
                </div>
              )}

              {status === 'FAILED' && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-center text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg">
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>NƯỚC ĐI CHƯA ĐÚNG! Hãy thử kéo lại theo hướng dẫn.</span>
                </div>
              )}
            </div>

            {/* Gợi Ý Nối Tiếp */}
            {showHint && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
                <span><strong>Gợi ý:</strong> {currentStep.hint}</span>
              </div>
            )}
          </div>

          {/* Menu Danh Sách Các Bài Học Nhập Môn */}
          <div className="p-3 bg-[#16202E] rounded-2xl border border-[#2A374A] flex flex-col gap-1.5 shadow-xl max-h-36 overflow-y-auto custom-scrollbar">
            <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider px-1">Danh mục bài học:</span>
            <div className="grid grid-cols-2 gap-1.5">
              {LESSONS_DATA.map((l, idx) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setLessonIndex(idx);
                    setStepIndex(0);
                  }}
                  className={`py-1.5 px-2.5 rounded-lg text-left text-xs font-bold truncate transition-all ${
                    idx === lessonIndex
                      ? 'bg-pink-600 text-white shadow-md'
                      : 'bg-[#1E293B] text-[#CBD5E1] hover:bg-[#2A374A] hover:text-white'
                  }`}
                >
                  {l.title}
                </button>
              ))}
            </div>
          </div>

          {/* Bảng Điều Khiển Nút Thao Tác (Gợi ý, Làm lại, Tiếp tục) */}
          <div className="p-4 bg-[#16202E] rounded-2xl border border-[#2A374A] flex flex-col gap-2.5 shadow-xl shrink-0">
            {status === 'STEP_DONE' ? (
              <button
                onClick={handleNextStep}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all animate-pulse"
              >
                <span>{isLastStepOfLesson ? 'Hoàn Thành & Sang Bài Mới' : 'Bước Tiếp Theo'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowHint(!showHint)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <span>{showHint ? 'Ẩn gợi ý' : 'Gợi ý'}</span>
                </button>

                <button
                  onClick={handleRetryStep}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#2A374A] hover:bg-[#3B3835] text-[#CBD5E1] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Làm lại</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
