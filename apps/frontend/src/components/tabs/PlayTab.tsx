import React, { useState, useEffect, useMemo } from 'react';
import { Chess, Square } from 'chess.js';
import {
  AlertTriangle,
  Trophy,
  RotateCcw,
  RotateCw,
  ArrowLeft,
  Cpu,
  Flag,
  Volume2,
  VolumeX,
  ChevronFirst,
  ChevronLeft,
  ChevronRight,
  ChevronLast,
} from 'lucide-react';
import { PlayMenu, GameModeSelection } from '../PlayMenu';
import { PlayerCard } from '../PlayerCard';
import { ChessBoardComponent } from '../ChessBoard';
import { ReplayControlBar } from '../ReplayControlBar';
import { DifficultySelector } from '../DifficultySelector';
import { GameControls } from '../GameControls';
import { MoveHistory } from '../MoveHistory';
import { PromotionPiece } from '../PromotionModal';
import { MatchRecord } from '../HistoryView';
import { MatchAnalysisDashboard } from '../MatchAnalysisDashboard';
import { ActiveMatch } from '../../hooks/useSocket';
import { DifficultyLevel } from '../../hooks/useChessEngine';

export interface PlayTabProps {
  activeMode: GameModeSelection | null;
  activeMatch: ActiveMatch | null;
  replayMatch: MatchRecord | null;
  replayMoveIndex: number;
  replayOrigin: {
    source: 'history' | 'tournament_detail' | 'game_over';
    tournamentIdOrCode?: string;
    preferredColor?: 'w' | 'b';
  } | null;
  disconnectedOpponent: { disconnectedPlayer: string; gracePeriodSeconds: number } | null;
  reconnectCountdown: number;
  opponentInfo: any;
  myInfo: any;
  user: any;
  game: Chess;
  fen: string;
  playerColor: 'w' | 'b';
  materialDetails: {
    whiteCaptured: any[];
    blackCaptured: any[];
    whiteAdvantage: number;
    blackAdvantage: number;
  };
  currentStatus: string;
  currentTurn: 'w' | 'b';
  whiteDisplayTimeMs: number;
  blackDisplayTimeMs: number;
  difficulty: DifficultyLevel;
  isAiThinking: boolean;
  isMuted: boolean;
  moveHistory: string[];
  analysisByPly?: any;
  selectedPly: number | null;
  isLiveAnalysisEnabled: boolean;
  isGameOverModalOpen: boolean;
  onSelectMode: (mode: GameModeSelection) => void;
  handlePieceDrop: (from: Square, to: Square, promotion?: PromotionPiece) => boolean;
  handleExitReplay: () => void;
  goToReplayMove: (index: number) => void;
  handlePlayAgain: () => void;
  handleBackToMenu: () => void;
  setDifficulty: (level: DifficultyLevel) => void;
  resetGame: (options?: { autoTriggerAi?: boolean }) => void;
  togglePlayerColor: () => void;
  toggleMute: () => void;
  setIsGameOverModalOpen: (open: boolean) => void;
  setIsTournamentModalOpen: (open: boolean) => void;
  setIsFriendModalOpen: (open: boolean) => void;
  setIsLeaveModalOpen: (open: boolean) => void;
  setIsResignModalOpen: (open: boolean) => void;
  setSelectedPly: (ply: number | null) => void;
  replayAnalysisByPly?: Record<number, any>;
  analysisReport?: any;
  onOpenAnalysisReport?: () => void;
}

export const PlayTab: React.FC<PlayTabProps> = ({
  activeMode,
  activeMatch,
  replayMatch,
  replayMoveIndex,
  replayOrigin,
  disconnectedOpponent,
  reconnectCountdown,
  opponentInfo,
  myInfo,
  user,
  game,
  fen,
  playerColor,
  materialDetails,
  currentStatus,
  currentTurn,
  whiteDisplayTimeMs,
  blackDisplayTimeMs,
  difficulty,
  isAiThinking,
  isMuted,
  moveHistory,
  analysisByPly,
  selectedPly,
  isLiveAnalysisEnabled,
  isGameOverModalOpen,
  onSelectMode,
  handlePieceDrop,
  handleExitReplay,
  goToReplayMove,
  handlePlayAgain,
  handleBackToMenu,
  setDifficulty,
  resetGame,
  togglePlayerColor,
  toggleMute,
  setIsGameOverModalOpen,
  setIsTournamentModalOpen,
  setIsFriendModalOpen,
  setIsLeaveModalOpen,
  setIsResignModalOpen,
  setSelectedPly,
  replayAnalysisByPly,
  analysisReport,
  onOpenAnalysisReport,
}) => {
  // Trạng thái lật bàn cờ khi xem lại ván đấu (cho phép người dùng đổi góc nhìn Trắng/Đen)
  const [flippedReplay, setFlippedReplay] = useState<boolean | null>(null);

  useEffect(() => {
    setFlippedReplay(null);
  }, [replayMatch?._id]);

  // Xác định góc nhìn mặc định khi xem lại
  const defaultReplayPerspective: 'w' | 'b' = useMemo(() => {
    if (!replayMatch) return playerColor;

    // 1. Ưu tiên góc nhìn được truyền từ nguồn mở xem lại
    if (replayOrigin?.preferredColor) {
      return replayOrigin.preferredColor;
    }

    // 2. Nếu vừa kết thúc ván đấu trên màn hình
    if (replayOrigin?.source === 'game_over') {
      return playerColor;
    }

    // 3. So khớp theo ID hoặc username của người dùng đang đăng nhập
    const myId = user?.userId || (user as any)?._id || (user as any)?.id;
    const myUsername = user?.username;

    if (
      (myId && replayMatch.blackUserId === myId) ||
      (myUsername && replayMatch.blackUsername === myUsername) ||
      replayMatch.blackUsername === 'Bạn'
    ) {
      return 'b';
    }

    if (
      (myId && replayMatch.whiteUserId === myId) ||
      (myUsername && replayMatch.whiteUsername === myUsername) ||
      replayMatch.whiteUsername === 'Bạn'
    ) {
      return 'w';
    }

    // Mặc định góc nhìn quân Trắng
    return 'w';
  }, [replayMatch, replayOrigin, playerColor, user]);

  // Góc nhìn thực tế hiển thị trên bàn cờ khi Replay
  const effectiveReplayColor: 'w' | 'b' = useMemo(() => {
    if (!replayMatch) return playerColor;
    if (flippedReplay !== null) {
      return flippedReplay ? (defaultReplayPerspective === 'w' ? 'b' : 'w') : defaultReplayPerspective;
    }
    return defaultReplayPerspective;
  }, [replayMatch, playerColor, defaultReplayPerspective, flippedReplay]);

  const handleToggleReplayFlip = () => {
    setFlippedReplay((prev) => (prev === null ? true : !prev));
  };

  // Điều hướng xem lại ván cờ bằng phím mũi tên Trái / Phải / Home / End
  useEffect(() => {
    if (!replayMatch) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToReplayMove(replayMoveIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToReplayMove(replayMoveIndex + 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToReplayMove(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToReplayMove(replayMatch.moves.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [replayMatch, replayMoveIndex, goToReplayMove]);

  return (
    <div className={`w-full max-w-7xl mx-auto flex-1 min-h-0 flex ${replayMatch ? 'flex-col items-center' : 'items-center justify-center'}`}>
      {/* MÀN HÌNH CHỌN CHẾ ĐỘ CHƠI BAN ĐẦU */}
      {!activeMode && !activeMatch && !replayMatch ? (
        <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center p-2 md:p-4">
          <PlayMenu onSelectMode={onSelectMode} />
        </div>
      ) : (
        /* MÀN HÌNH BÀN CỜ THI ĐẤU & XEM LẠI */
        <div className={`w-full grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 ${replayMatch ? 'items-start' : 'h-full items-center'} justify-center`}>
          {/* Left Column (Desktop 7-8/12 Cols, Mobile 100%): Bàn cờ & Player Cards */}
          <div className="md:col-span-7 lg:col-span-8 flex flex-col items-center justify-between h-full py-0.5 md:py-1">
            {/* BANNER THÔNG BÁO ĐỐI THỦ MẤT KẾT NỐI */}
            {disconnectedOpponent && (
              <div className="w-full max-w-[480px] mb-1 p-2.5 bg-amber-500/15 border border-amber-500/40 rounded-2xl flex items-center justify-between text-amber-300 text-xs font-bold shadow-lg animate-pulse shrink-0">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Đối thủ {disconnectedOpponent.disconnectedPlayer} tạm mất kết nối. Đang chờ:</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-xl bg-amber-500/30 text-amber-200 font-mono font-black text-xs border border-amber-500/50 shadow-inner">
                  {reconnectCountdown}s
                </span>
              </div>
            )}

            {/* Card ĐỐI THỦ / QUÂN TRÊN BÀN CỜ */}
            <PlayerCard
              isAi={!replayMatch && activeMode === 'bots'}
              name={
                replayMatch
                  ? (effectiveReplayColor === 'w' ? replayMatch.blackUsername : replayMatch.whiteUsername)
                  : activeMatch
                  ? opponentInfo?.username || 'Đối thủ Online'
                  : activeMode === 'friend'
                  ? 'Bạn bè (Player 2)'
                  : 'Stockfish Engine'
              }
              subText={
                replayMatch
                  ? effectiveReplayColor === 'w'
                    ? `${replayMatch.blackOldElo ? `Elo: ${replayMatch.blackOldElo} • ` : ''}Quân Đen`
                    : `${replayMatch.whiteOldElo ? `Elo: ${replayMatch.whiteOldElo} • ` : ''}Quân Trắng`
                  : activeMatch
                  ? activeMatch.isRated
                    ? `Elo: ${opponentInfo?.eloRating || 1200} • ${playerColor === 'w' ? 'Quân Đen' : 'Quân Trắng'}`
                    : `Phòng Bạn Bè • ${playerColor === 'w' ? 'Quân Đen' : 'Quân Trắng'}`
                  : activeMode === 'friend'
                  ? 'Đang chờ bạn bè tham gia phòng...'
                  : activeMode === 'bots'
                  ? difficulty === 1
                    ? 'Dễ (~800 Elo)'
                    : difficulty === 2
                    ? 'Trung bình (~1300 Elo)'
                    : 'Khó (~2000 Elo)'
                  : 'Phòng thi đấu'
              }
              color={replayMatch ? (effectiveReplayColor === 'w' ? 'b' : 'w') : (playerColor === 'w' ? 'b' : 'w')}
              capturedPieces={
                replayMatch
                  ? (effectiveReplayColor === 'w' ? materialDetails.blackCaptured : materialDetails.whiteCaptured)
                  : (playerColor === 'w' ? materialDetails.blackCaptured : materialDetails.whiteCaptured)
              }
              materialAdvantage={
                replayMatch
                  ? (effectiveReplayColor === 'w' ? materialDetails.blackAdvantage : materialDetails.whiteAdvantage)
                  : (playerColor === 'w' ? materialDetails.blackAdvantage : materialDetails.whiteAdvantage)
              }
              isThinking={false}
              gameStatus={replayMatch ? 'GAME_OVER' : currentStatus}
              timeLeftMs={playerColor === 'w' ? blackDisplayTimeMs : whiteDisplayTimeMs}
              isClockActive={!replayMatch && currentStatus === 'IN_PROGRESS' && currentTurn === (playerColor === 'w' ? 'b' : 'w')}
            />

            {/* Bàn cờ Cờ vua */}
            <ChessBoardComponent
              game={game}
              fen={fen}
              playerColor={replayMatch ? effectiveReplayColor : playerColor}
              onPieceDrop={handlePieceDrop}
              muted={isMuted}
              disabled={
                replayMatch !== null ||
                (activeMode === 'friend' && !activeMatch) ||
                (activeMatch
                  ? game.turn() !== playerColor || currentStatus !== 'IN_PROGRESS'
                  : isAiThinking || currentStatus !== 'IN_PROGRESS')
              }
            />

            {/* Card BẢN THÂN / QUÂN DƯỚI ĐÁY BÀN CỜ */}
            <PlayerCard
              isAi={false}
              name={
                replayMatch
                  ? (effectiveReplayColor === 'w' ? replayMatch.whiteUsername : replayMatch.blackUsername)
                  : activeMatch
                  ? myInfo?.username || 'Bạn'
                  : user
                  ? user.username
                  : 'Khách'
              }
              subText={
                replayMatch
                  ? effectiveReplayColor === 'w'
                    ? `${replayMatch.whiteOldElo ? `Elo: ${replayMatch.whiteOldElo} • ` : ''}Quân Trắng`
                    : `${replayMatch.blackOldElo ? `Elo: ${replayMatch.blackOldElo} • ` : ''}Quân Đen`
                  : activeMatch
                  ? activeMatch.isRated
                    ? `Elo: ${user?.eloRating || myInfo?.eloRating || 1200} • ${playerColor === 'w' ? 'Cầm quân Trắng' : 'Cầm quân Đen'}`
                    : `Phòng Bạn Bè • ${playerColor === 'w' ? 'Cầm quân Trắng' : 'Cầm quân Đen'}`
                  : activeMode === 'friend'
                  ? `Phòng Bạn Bè • ${playerColor === 'w' ? 'Cầm quân Trắng' : 'Cầm quân Đen'}`
                  : playerColor === 'w'
                  ? 'Cầm quân Trắng'
                  : 'Cầm quân Đen'
              }
              color={replayMatch ? effectiveReplayColor : playerColor}
              capturedPieces={
                replayMatch
                  ? (effectiveReplayColor === 'w' ? materialDetails.whiteCaptured : materialDetails.blackCaptured)
                  : (playerColor === 'w' ? materialDetails.whiteCaptured : materialDetails.blackCaptured)
              }
              materialAdvantage={
                replayMatch
                  ? (effectiveReplayColor === 'w' ? materialDetails.whiteAdvantage : materialDetails.blackAdvantage)
                  : (playerColor === 'w' ? materialDetails.whiteAdvantage : materialDetails.blackAdvantage)
              }
              gameStatus={replayMatch ? 'GAME_OVER' : currentStatus}
              timeLeftMs={playerColor === 'w' ? whiteDisplayTimeMs : blackDisplayTimeMs}
              isClockActive={!replayMatch && currentStatus === 'IN_PROGRESS' && currentTurn === playerColor}
            />

            {/* NÚT MỞ LẠI POPUP KẾT QUẢ VÁN CỜ KHI ĐÃ ĐÓNG XEM BÀN CỜ */}
            {!replayMatch && (currentStatus === 'WHITE_WIN' || currentStatus === 'BLACK_WIN' || currentStatus === 'DRAW') && (
              <div className="w-full max-w-[500px] mt-2 flex items-center justify-between p-2.5 bg-[#16202E] rounded-2xl border border-[#2A374A] shadow-xl">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                  <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Ván cờ đã kết thúc</span>
                </div>
                <button
                  onClick={() => setIsGameOverModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Xem Chi Tiết Kết Quả</span>
                </button>
              </div>
            )}

            {/* THANH ĐIỀU KHIỂN XEM LẠI NƯỚC ĐI CHO MOBILE (< md) */}
            {replayMatch && (
              <div className="md:hidden w-full max-w-[480px]">
                <ReplayControlBar
                  replayMatch={replayMatch}
                  replayMoveIndex={replayMoveIndex}
                  replayOrigin={replayOrigin}
                  onExit={handleExitReplay}
                  onGoToMove={goToReplayMove}
                  onFlipBoard={handleToggleReplayFlip}
                  effectiveColor={effectiveReplayColor}
                />
              </div>
            )}

            {/* LỊCH SỬ NƯỚC ĐI VÀ ĐÁNH GIÁ PHÂN TÍCH CHO MOBILE (< md) */}
            {replayMatch && (
              <div className="md:hidden w-full max-w-[480px] mt-2 flex flex-col gap-2">
                <div className="h-[280px] w-full flex flex-col">
                  <MoveHistory
                    moveHistory={replayMatch.moves}
                    analysisByPly={replayAnalysisByPly}
                    selectedPly={replayMoveIndex}
                    onSelectPly={(ply) => {
                      if (ply !== null) goToReplayMove(ply);
                    }}
                    showLiveAnalysis={true}
                  />
                </div>
              </div>
            )}

            {/* THANH ĐIỀU HƯỚNG NHANH KHI ĐÓNG MODAL XEM BÀN CỜ */}
            {!replayMatch && !isGameOverModalOpen && currentStatus !== 'IN_PROGRESS' && currentStatus !== 'IDLE' && (
              <div className="w-full max-w-[480px] mt-1.5 p-2 bg-[#16202E]/95 border border-[#334155] rounded-2xl shadow-xl flex items-center justify-between gap-2 animate-in slide-in-from-bottom-2 duration-200 shrink-0">
                <span className="text-xs font-bold text-pink-400 pl-2 truncate">
                  🏁 Ván đấu đã kết thúc
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {activeMode === 'tournament' ? (
                    <button
                      onClick={() => setIsTournamentModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1 shadow transition-all active:scale-95"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      <span>Xem Bảng Đấu</span>
                    </button>
                  ) : (
                    <button
                      onClick={handlePlayAgain}
                      className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center gap-1 shadow transition-all active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Ván Mới</span>
                    </button>
                  )}
                  <button
                    onClick={handleBackToMenu}
                    className="px-2.5 py-1.5 rounded-xl bg-[#2A374A] hover:bg-[#3B3835] text-[#CBD5E1] font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Menu</span>
                  </button>
                </div>
              </div>
            )}

            {/* BẢNG CẤU HÌNH NHỎ GỌN TRÊN MOBILE (< md) */}
            {!replayMatch && (
              <div className="md:hidden w-full max-w-[500px] mt-1.5 p-2 bg-[#16202E] rounded-2xl border border-[#2A374A] shadow-xl flex flex-col gap-1.5 shrink-0">
                {activeMode === 'bots' && (
                  <div className="flex flex-col gap-1.5">
                    <DifficultySelector
                      difficulty={difficulty}
                      onSelect={setDifficulty}
                      disabled={isAiThinking}
                    />
                    {!activeMatch && (
                      <GameControls
                        onReset={() => {
                          handleBackToMenu();
                          setIsGameOverModalOpen(false);
                          resetGame({ autoTriggerAi: true });
                        }}
                        onToggleColor={() => {
                          handleBackToMenu();
                          setIsGameOverModalOpen(false);
                          togglePlayerColor();
                        }}
                        playerColor={playerColor}
                        disabled={isAiThinking}
                      />
                    )}
                  </div>
                )}

                {activeMode === 'friend' && !activeMatch && (
                  <button
                    onClick={() => setIsFriendModalOpen(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                  >
                    Mở Bảng Phòng Bạn Bè
                  </button>
                )}

                {activeMatch && (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[#0F172A] rounded-xl text-xs">
                    <span className="text-pink-400 font-bold">
                      {activeMatch.isRated ? '⚔️ Đấu xếp hạng' : '👥 Đấu với bạn'}
                    </span>
                    <span className="text-amber-400 font-mono font-bold">
                      {activeMatch.isRated ? `Elo: ${user?.eloRating || myInfo?.eloRating || 1200}` : 'Giao hữu'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column (Desktop 4-5/12 Cols, Ẩn trên Mobile) */}
          <div className="hidden md:flex md:col-span-5 lg:col-span-4 flex-col gap-3 h-full max-h-[calc(100vh-40px)] justify-between">
            <div className="flex flex-col gap-3 h-full justify-between">
              {/* Top Bar: Nút Rời Phòng / Thoát Xem lại */}
              <div className="p-3 bg-[#16202E] rounded-2xl border border-[#2A374A] flex items-center justify-between shadow-lg shrink-0 gap-2">
                {replayMatch ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExitReplay}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold transition-all shadow"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>
                        {replayOrigin?.source === 'tournament_detail'
                          ? 'Quay lại Sơ đồ Giải'
                          : replayOrigin?.source === 'game_over'
                          ? 'Trở về menu'
                          : 'Quay lại Lịch sử'}
                      </span>
                    </button>
                    <button
                      onClick={handleToggleReplayFlip}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#1E293B] hover:bg-[#2A374A] text-slate-300 border border-[#334155] text-xs font-bold transition-all active:scale-95"
                      title="Đổi góc nhìn bàn cờ (Trắng ⇄ Đen)"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-pink-400" />
                      <span>Lật cờ ({effectiveReplayColor === 'w' ? 'Quân Trắng' : 'Quân Đen'})</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsLeaveModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Rời phòng</span>
                    </button>

                    <button
                      onClick={() => setIsResignModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all"
                    >
                      <Flag className="w-4 h-4" />
                      <span>Đầu hàng</span>
                    </button>

                    <button
                      onClick={toggleMute}
                      className="p-1.5 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-all active:scale-95"
                      title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                    </button>
                  </div>
                )}

                <span className="text-[11px] font-black text-pink-400 uppercase tracking-wider hidden sm:inline">
                  {replayMatch
                    ? `📜 Xem lại: ${replayMatch.whiteUsername} vs ${replayMatch.blackUsername}`
                    : activeMatch
                    ? activeMatch.isRated
                      ? '⚔️ Đấu xếp hạng'
                      : '👥 Đấu với bạn'
                    : activeMode === 'bots'
                    ? '🤖 Đấu với máy'
                    : activeMode === 'friend'
                    ? '👥 Đấu với bạn'
                    : activeMode === 'tournament'
                    ? '🏆 Giải đấu'
                    : '⚔️ Đấu trực tuyến'}
                </span>
              </div>

              {/* Controls / Info Box Desktop */}
              <div className="p-4 bg-[#16202E] rounded-2xl border border-[#2A374A] flex flex-col gap-3.5 shadow-xl shrink-0">
                <div className="flex items-center justify-between border-b border-[#2A374A] pb-2">
                  <h2 className="font-bold text-xs text-white flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-pink-400" />
                    {replayMatch ? 'Thông tin ván đấu' : 'Cấu hình trận đấu'}
                  </h2>
                  <span className="text-[10px] text-pink-400 font-semibold bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                    {replayMatch
                      ? replayMatch.gameMode === 'TOURNAMENT'
                        ? '🏆 Ván đấu giải'
                        : replayMatch.isRated
                        ? '⚔️ Đấu xếp hạng'
                        : '👥 Đấu với bạn'
                      : activeMatch
                      ? activeMatch.isRated
                        ? 'Đấu xếp hạng'
                        : 'Phòng bạn bè'
                      : activeMode === 'friend'
                      ? 'Phòng bạn bè'
                      : activeMode === 'bots'
                      ? 'Đấu với máy'
                      : 'Trực tuyến'}
                  </span>
                </div>

                {replayMatch ? (
                  <div className="flex flex-col gap-2 text-xs">
                    {/* HÀNG NÚT TUA TIẾN NƯỚC CỜ */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-[#0F172A] border border-[#2A374A]">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => goToReplayMove(0)}
                          disabled={replayMoveIndex === 0}
                          className="p-1.5 rounded-lg bg-[#1E293B] hover:bg-[#2A374A] disabled:opacity-30 text-white border border-[#334155] transition-colors"
                          title="Về đầu ván (Home)"
                        >
                          <ChevronFirst className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => goToReplayMove(replayMoveIndex - 1)}
                          disabled={replayMoveIndex === 0}
                          className="p-1.5 rounded-lg bg-[#1E293B] hover:bg-[#2A374A] disabled:opacity-30 text-white border border-[#334155] transition-colors"
                          title="Nước trước (←)"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-center">
                        <span className="font-mono font-black text-xs text-pink-400">
                          Nước: {replayMoveIndex} / {replayMatch.moves.length}
                        </span>
                        <p className="text-[10px] text-[#94A3B8] truncate max-w-[130px]">
                          {replayMoveIndex === 0
                            ? 'Thế cờ ban đầu'
                            : `Vừa đi: ${replayMatch.moves[replayMoveIndex - 1]}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => goToReplayMove(replayMoveIndex + 1)}
                          disabled={replayMoveIndex >= replayMatch.moves.length}
                          className="p-1.5 rounded-lg bg-[#1E293B] hover:bg-[#2A374A] disabled:opacity-30 text-white border border-[#334155] transition-colors"
                          title="Nước tiếp (→)"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => goToReplayMove(replayMatch.moves.length)}
                          disabled={replayMoveIndex >= replayMatch.moves.length}
                          className="p-1.5 rounded-lg bg-[#1E293B] hover:bg-[#2A374A] disabled:opacity-30 text-white border border-[#334155] transition-colors"
                          title="Đến cuối ván (End)"
                        >
                          <ChevronLast className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : activeMode === 'bots' ? (
                  <>
                    <DifficultySelector
                      difficulty={difficulty}
                      onSelect={setDifficulty}
                      disabled={isAiThinking}
                    />

                    {!activeMatch && (
                      <GameControls
                        onReset={() => {
                          handleBackToMenu();
                          setIsGameOverModalOpen(false);
                          resetGame({ autoTriggerAi: true });
                        }}
                        onToggleColor={() => {
                          handleBackToMenu();
                          setIsGameOverModalOpen(false);
                          togglePlayerColor();
                        }}
                        playerColor={playerColor}
                        disabled={isAiThinking}
                      />
                    )}
                  </>
                ) : activeMode === 'friend' && !activeMatch ? (
                  <div className="flex flex-col gap-2 p-3 bg-[#0F172A] rounded-2xl border border-[#2A374A] text-center shadow-md">
                    <span className="text-xs font-bold text-pink-400">👥 Phòng Đấu Bạn Bè</span>
                    <span className="text-[11px] text-[#94A3B8]">Nhấn nút bên dưới để tạo mã phòng hoặc nhập mã tham gia.</span>
                    <button
                      onClick={() => setIsFriendModalOpen(true)}
                      className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all active:scale-95"
                    >
                      Mở Bảng Phòng Bạn Bè
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Move History Desktop - MỞ RỘNG TO RÕ DỄ QUAN SÁT */}
              <div className={`w-full flex flex-col ${replayMatch ? 'h-[440px] md:h-[480px]' : 'flex-1 min-h-0'}`}>
                <MoveHistory
                  moveHistory={replayMatch ? replayMatch.moves : moveHistory}
                  analysisByPly={replayMatch ? replayAnalysisByPly : (isLiveAnalysisEnabled ? analysisByPly : undefined)}
                  selectedPly={replayMatch ? replayMoveIndex : selectedPly}
                  onSelectPly={replayMatch ? (ply) => { if (ply !== null) goToReplayMove(ply); } : setSelectedPly}
                  showLiveAnalysis={Boolean(replayMatch) || isLiveAnalysisEnabled}
                />
              </div>
            </div>
          </div>

          {/* BẢNG PHÂN TÍCH VÁN ĐẤU LIỀN MẠCH BÊN DƯỚI BÀN CỜ KHI CUỘN XUỐNG */}
          {replayMatch && (
            <div className="col-span-1 md:col-span-12 w-full mt-4 pb-8">
              <MatchAnalysisDashboard
                report={analysisReport}
                summaryData={replayMatch.analysis}
                currentPly={replayMoveIndex}
                onSelectPly={goToReplayMove}
                whitePlayerName={replayMatch.whiteUsername}
                blackPlayerName={replayMatch.blackUsername}
                whiteElo={replayMatch.whiteOldElo}
                blackElo={replayMatch.blackOldElo}
                gameModeLabel={
                  replayMatch.gameMode === 'TOURNAMENT'
                    ? 'Giải đấu'
                    : replayMatch.isRated
                    ? 'Đấu xếp hạng'
                    : 'Đấu bạn bè'
                }
                endReasonLabel={
                  replayMatch.endReason === 'CHECKMATE'
                    ? 'Chiếu hết'
                    : replayMatch.endReason === 'RESIGNED'
                    ? 'Đầu hàng'
                    : replayMatch.endReason === 'TIMEOUT'
                    ? 'Hết giờ'
                    : replayMatch.endReason === 'ABANDONED'
                    ? 'Rời trận'
                    : 'Hòa cờ'
                }
                dateStr={
                  replayMatch.createdAt
                    ? new Date(replayMatch.createdAt).toLocaleDateString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })
                    : undefined
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
