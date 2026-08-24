'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar, ActiveTab } from '../components/Sidebar';
import { PlayMenu, GameModeSelection } from '../components/PlayMenu';
import { AuthModal } from '../components/AuthModal';
import { MatchmakingModal } from '../components/MatchmakingModal';
import { FriendRoomModal } from '../components/FriendRoomModal';
import { GameOverModal } from '../components/GameOverModal';
import { LeaveRoomModal } from '../components/LeaveRoomModal';
import { ResignModal } from '../components/ResignModal';
import { PromotionPiece } from '../components/PromotionModal';
import { PuzzleView } from '../components/PuzzleView';
import { LearnView } from '../components/LearnView';
import { ChessBoardComponent } from '../components/ChessBoard';
import { PlayerCard } from '../components/PlayerCard';
import { DifficultySelector } from '../components/DifficultySelector';
import { GameControls } from '../components/GameControls';
import { MoveHistory } from '../components/MoveHistory';
import { useChessEngine } from '../hooks/useChessEngine';
import { useSocket, EloPlayerResult } from '../hooks/useSocket';
import { sounds } from '../utils/soundEffects';
import { Chess, Square } from 'chess.js';
import { Cpu, ArrowLeft, Flag, Trophy } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('play');
  const [activeMode, setActiveMode] = useState<GameModeSelection | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isResignModalOpen, setIsResignModalOpen] = useState(false);
  const [isFriendModalOpen, setIsFriendModalOpen] = useState(false);
  const [user, setUser] = useState<{ username: string; eloRating: number; token: string } | null>(null);
  const [customGameOverMsg, setCustomGameOverMsg] = useState<string | undefined>(undefined);
  const [localGameOverStatus, setLocalGameOverStatus] = useState<string | null>(null);
  const [currentMatchEloResult, setCurrentMatchEloResult] = useState<EloPlayerResult | null>(null);

  const prevStatusRef = useRef<string>('IN_PROGRESS');

  // Hook WebSocket Socket.io Realtime
  const {
    isConnected,
    isSearchingQueue,
    createdRoomCode,
    friendRoomError,
    activeMatch,
    latestMove,
    resignationEvent,
    joinQueue,
    leaveQueue,
    createFriendRoom,
    joinFriendRoom,
    cancelFriendRoom,
    resignMatch,
    sendMove,
    clearActiveMatch,
  } = useSocket();

  // Hook quản lý Bàn cờ & Engine
  const {
    game,
    fen,
    playerColor,
    difficulty,
    isAiThinking,
    gameStatus: engineStatus,
    moveHistory,
    setDifficulty,
    setPlayerColor,
    setBoardFen,
    makePlayerMove,
    resetGame,
    togglePlayerColor,
  } = useChessEngine();

  const currentStatus = localGameOverStatus || engineStatus;

  // 1. Tự động chuyển mode và gán màu cờ theo chỉ định của Server khi ghép trận / bạn bè thành công
  useEffect(() => {
    if (activeMatch) {
      setIsFriendModalOpen(false);
      setActiveMode('online');
      setLocalGameOverStatus(null);
      setCustomGameOverMsg(undefined);
      setCurrentMatchEloResult(null);

      const myColor = activeMatch.yourColor || 'w';
      setPlayerColor(myColor);
      setBoardFen(activeMatch.fen, []);
      sounds.playGameStart();
    }
  }, [activeMatch]);

  // 2. LẮNG NGHE SỰ KIỆN ĐỐI THỦ ĐẦU HÀNG HOẶC F5 / THOÁT WEB
  useEffect(() => {
    if (resignationEvent) {
      const winningStatus = resignationEvent.winnerColor === 'w' ? 'WHITE_WIN' : 'BLACK_WIN';
      setLocalGameOverStatus(winningStatus);
      setCustomGameOverMsg(resignationEvent.message);

      // Cập nhật kết quả Elo
      if (resignationEvent.eloResult) {
        const myElo = playerColor === 'w' ? resignationEvent.eloResult.white : resignationEvent.eloResult.black;
        setCurrentMatchEloResult(myElo);

        // Cập nhật State User để Sidebar tự động nhảy số Elo
        setUser((prev) => (prev ? { ...prev, eloRating: myElo.newElo } : prev));
      }

      if (resignationEvent.winnerColor === playerColor) {
        sounds.playGameEndWin();
      } else {
        sounds.playGameEndLose();
      }
    }
  }, [resignationEvent, playerColor]);

  // 3. Phát âm thanh KẾT THÚC TRẬN & Bắt Elo khi Chiếu Hết qua latestMove
  useEffect(() => {
    if (latestMove && latestMove.isGameOver && latestMove.eloResult) {
      const myElo = playerColor === 'w' ? latestMove.eloResult.white : latestMove.eloResult.black;
      setCurrentMatchEloResult(myElo);
      setUser((prev) => (prev ? { ...prev, eloRating: myElo.newElo } : prev));
    }
  }, [latestMove, playerColor]);

  // Phát âm thanh khi kết thúc ván đấu
  useEffect(() => {
    if (prevStatusRef.current === 'IN_PROGRESS' && currentStatus !== 'IN_PROGRESS' && !resignationEvent) {
      const isWhiteWin = currentStatus === 'WHITE_WIN';
      const isBlackWin = currentStatus === 'BLACK_WIN';
      const isPlayerWin = (isWhiteWin && playerColor === 'w') || (isBlackWin && playerColor === 'b');
      const isPlayerLose = (isWhiteWin && playerColor === 'b') || (isBlackWin && playerColor === 'w');

      if (isPlayerWin) {
        sounds.playGameEndWin();
      } else if (isPlayerLose) {
        sounds.playGameEndLose();
      } else {
        sounds.playGameEndDraw();
      }
    }
    prevStatusRef.current = currentStatus;
  }, [currentStatus, playerColor, resignationEvent]);

  // 4. Đồng bộ nước đi mới từ WebSocket Realtime
  useEffect(() => {
    if (latestMove && activeMode === 'online') {
      setBoardFen(latestMove.fen, latestMove.history);
    }
  }, [latestMove, activeMode]);

  // Xử lý chọn Chế độ chơi từ PlayMenu
  const handleSelectMode = (mode: GameModeSelection) => {
    setLocalGameOverStatus(null);
    setCustomGameOverMsg(undefined);
    setCurrentMatchEloResult(null);

    if (mode === 'online') {
      joinQueue({
        userId: user ? user.username : `guest_${Math.floor(Math.random() * 1000)}`,
        username: user ? user.username : 'Người chơi (Guest)',
        eloRating: user ? user.eloRating : 1200,
      });
      return;
    }

    if (mode === 'friend') {
      setIsFriendModalOpen(true);
      return;
    }

    clearActiveMatch();
    setActiveMode(mode);
    resetGame();
    sounds.playGameStart();
  };

  // Tạo phòng bạn bè
  const handleCreateFriendRoom = () => {
    createFriendRoom({
      userId: user ? user.username : `guest_host_${Math.floor(Math.random() * 1000)}`,
      username: user ? user.username : 'Chủ phòng (Guest)',
      eloRating: user ? user.eloRating : 1200,
    });
  };

  // Nhập mã phòng tham gia
  const handleJoinFriendRoom = (code: string) => {
    joinFriendRoom(code, {
      userId: user ? user.username : `guest_join_${Math.floor(Math.random() * 1000)}`,
      username: user ? user.username : 'Khách (Guest)',
      eloRating: user ? user.eloRating : 1200,
    });
  };

  // Xác nhận Rời phòng đấu
  const handleConfirmLeaveRoom = () => {
    if (activeMatch) {
      resignMatch(activeMatch.roomId);
    }
    setIsLeaveModalOpen(false);
    setActiveMode(null);
    clearActiveMatch();
    resetGame();
    setLocalGameOverStatus(null);
    setCustomGameOverMsg(undefined);
    setCurrentMatchEloResult(null);
  };

  // Xác nhận Đầu hàng
  const handleConfirmResign = () => {
    setIsResignModalOpen(false);

    if (activeMatch) {
      resignMatch(activeMatch.roomId);
    } else {
      const losingStatus = playerColor === 'w' ? 'BLACK_WIN' : 'WHITE_WIN';
      setLocalGameOverStatus(losingStatus);
      setCustomGameOverMsg('Bạn đã đầu hàng. Trận thắng thuộc về Stockfish Engine!');
      sounds.playGameEndLose();
    }
  };

  // Xử lý nút Chơi Ván Mới / Tạo Phòng Mới
  const handlePlayAgain = () => {
    setLocalGameOverStatus(null);
    setCustomGameOverMsg(undefined);
    setCurrentMatchEloResult(null);

    if (activeMatch) {
      clearActiveMatch();
      setActiveMode(null);
      resetGame();
      setIsFriendModalOpen(true);
    } else {
      resetGame();
    }
  };

  // Xử lý thả quân cờ
  const handlePieceDrop = (from: Square, to: Square, promotion: PromotionPiece = 'q'): boolean => {
    if (activeMode === 'online' && activeMatch) {
      const isMyTurn = game.turn() === playerColor;
      if (!isMyTurn || game.isGameOver() || currentStatus !== 'IN_PROGRESS') return false;

      try {
        const testGame = new Chess(game.fen());
        const move = testGame.move({ from, to, promotion });
        if (move) {
          sendMove(activeMatch.roomId, from, to, promotion);
          return true;
        }
      } catch (err) {
        return false;
      }
      return false;
    }

    return makePlayerMove(from, to, promotion);
  };

  const handleLogout = () => {
    localStorage.removeItem('chess_token');
    setUser(null);
  };

  // Xác định Thông tin Đối thủ & Người chơi
  const isUserWhite = activeMatch ? activeMatch.yourColor === 'w' : playerColor === 'w';
  const opponentInfo = activeMatch
    ? isUserWhite
      ? activeMatch.blackPlayer
      : activeMatch.whitePlayer
    : null;
  const myInfo = activeMatch
    ? isUserWhite
      ? activeMatch.whitePlayer
      : activeMatch.blackPlayer
    : null;

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#161512] text-[#C3C1C0] flex select-none">
      {/* Sidebar Trái */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        onOpenAuthModal={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main View Area */}
      <main className="flex-1 h-full overflow-hidden flex flex-col p-2.5 md:p-4 bg-radial-glow">
        {activeTab === 'play' && (
          <div className="w-full max-w-7xl mx-auto flex-1 min-h-0 flex items-center justify-center">
            
            {/* MÀN HÌNH CHỌN CHẾ ĐỘ CHƠI BAN ĐẦU */}
            {!activeMode && !activeMatch ? (
              <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center p-4">
                <PlayMenu onSelectMode={handleSelectMode} />
              </div>
            ) : (
              /* MÀN HÌNH BÀN CỜ THI ĐẤU (Khi đã chọn Mode) */
              <div className="w-full h-full grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 items-center justify-center">
                
                {/* Left Column (8/12 Cols): Bàn cờ & Player Cards */}
                <div className="lg:col-span-8 flex flex-col items-center justify-between h-full py-1">
                  
                  {/* Card ĐỐI THỦ */}
                  <PlayerCard
                    isAi={activeMode === 'bots' || (!activeMode && !activeMatch)}
                    name={
                      activeMatch
                        ? opponentInfo?.username || 'Đối thủ Online'
                        : activeMode === 'friend'
                        ? 'Bạn bè (Player 2)'
                        : 'Stockfish Engine'
                    }
                    subText={
                      activeMatch
                        ? `Elo: ${opponentInfo?.eloRating || 1200} • ${playerColor === 'w' ? 'Quân Đen' : 'Quân Trắng'}`
                        : activeMode === 'bots'
                        ? difficulty === 1
                          ? 'Mức: Dễ (~800 Elo)'
                          : difficulty === 2
                          ? 'Mức: Trung bình (~1300 Elo)'
                          : 'Mức: Khó (~2000 Elo)'
                        : 'Phòng thi đấu'
                    }
                    color={playerColor === 'w' ? 'b' : 'w'}
                    isThinking={activeMode === 'online' ? game.turn() !== playerColor : isAiThinking}
                    gameStatus={currentStatus}
                  />

                  {/* Bàn cờ Cờ vua */}
                  <ChessBoardComponent
                    game={game}
                    fen={fen}
                    playerColor={playerColor}
                    onPieceDrop={handlePieceDrop}
                    disabled={activeMode === 'online' ? game.turn() !== playerColor || currentStatus !== 'IN_PROGRESS' : isAiThinking}
                  />

                  {/* Card BẢN THÂN */}
                  <PlayerCard
                    isAi={false}
                    name={
                      activeMatch
                        ? myInfo?.username || 'Bạn'
                        : user
                        ? user.username
                        : 'Người chơi (Guest)'
                    }
                    subText={
                      activeMatch
                        ? `Elo: ${user?.eloRating || myInfo?.eloRating || 1200} • ${playerColor === 'w' ? 'Cầm quân Trắng' : 'Cầm quân Đen'}`
                        : playerColor === 'w'
                        ? 'Cầm quân Trắng'
                        : 'Cầm quân Đen'
                    }
                    color={playerColor}
                    gameStatus={currentStatus}
                  />
                </div>

                {/* Right Column (4/12 Cols): Bảng điều khiển & Lịch sử */}
                <div className="lg:col-span-4 flex flex-col gap-3 h-full max-h-[calc(100vh-40px)] justify-between">
                  <div className="flex flex-col gap-3 h-full justify-between">
                    
                    {/* Top Bar: Nút Rời Phòng & Nút Đầu Hàng */}
                    <div className="p-3 bg-[#262421] rounded-2xl border border-[#312E2B] flex items-center justify-between shadow-lg shrink-0 gap-2">
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
                      </div>

                      <span className="text-[11px] font-black text-pink-400 uppercase tracking-wider hidden sm:inline">
                        {activeMatch ? '⚔️ Đấu PvP Realtime' : activeMode === 'bots' ? '🤖 Đánh với Máy' : '👥 Đấu Bạn bè'}
                      </span>
                    </div>

                    {/* Controls Box */}
                    <div className="p-4 bg-[#262421] rounded-2xl border border-[#312E2B] flex flex-col gap-3.5 shadow-xl shrink-0">
                      <div className="flex items-center justify-between border-b border-[#312E2B] pb-2">
                        <h2 className="font-bold text-xs text-white flex items-center gap-1.5">
                          <Cpu className="w-4 h-4 text-pink-400" />
                          Cấu hình Trận đấu
                        </h2>
                        <span className="text-[10px] text-pink-400 font-semibold bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                          {activeMatch ? 'Ghép trận Realtime' : 'Local Game'}
                        </span>
                      </div>

                      {activeMode === 'bots' && (
                        <DifficultySelector
                          difficulty={difficulty}
                          onSelect={setDifficulty}
                          disabled={isAiThinking}
                        />
                      )}

                      {!activeMatch && (
                        <GameControls
                          onReset={() => {
                            setLocalGameOverStatus(null);
                            setCustomGameOverMsg(undefined);
                            setCurrentMatchEloResult(null);
                            resetGame();
                          }}
                          onToggleColor={() => {
                            setLocalGameOverStatus(null);
                            setCustomGameOverMsg(undefined);
                            setCurrentMatchEloResult(null);
                            togglePlayerColor();
                          }}
                          playerColor={playerColor}
                          disabled={isAiThinking}
                        />
                      )}
                    </div>

                    {/* Move History */}
                    <MoveHistory moveHistory={moveHistory} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div className="w-full max-w-4xl mx-auto h-full overflow-hidden flex flex-col p-4">
            <div className="bg-[#262421] rounded-2xl border border-[#312E2B] p-6 flex flex-col h-full shadow-2xl">
              <div className="flex items-center gap-3 border-b border-[#312E2B] pb-4 mb-4">
                <Trophy className="w-7 h-7 text-amber-400" />
                <div>
                  <h2 className="text-lg font-black text-white">Bảng Xếp Hạng Elo Quốc Tế</h2>
                  <p className="text-xs text-[#8B8987]">Top cao thủ có điểm Elo cao nhất hệ thống</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <div className="flex flex-col gap-2">
                  {[
                    { rank: 1, name: 'Magnus Carlsen', elo: 2882, wins: 450, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=magnus' },
                    { rank: 2, name: 'Hikaru Nakamura', elo: 2875, wins: 412, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=hikaru' },
                    { rank: 3, name: 'Phan Hồng Sơn', elo: user?.eloRating || 1200, wins: 12, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=sonsamset' },
                  ].map((player) => (
                    <div key={player.rank} className="flex items-center justify-between p-3.5 rounded-xl bg-[#2F2D2A] border border-[#3A3733]">
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                          player.rank === 1 ? 'bg-amber-500 text-slate-950' : player.rank === 2 ? 'bg-slate-300 text-slate-950' : 'bg-pink-600 text-white'
                        }`}>
                          #{player.rank}
                        </span>
                        <img src={player.avatar} alt="Avatar" className="w-9 h-9 rounded-lg bg-[#363431]" />
                        <div>
                          <p className="font-bold text-sm text-[#FFFFFF]">{player.name}</p>
                          <p className="text-[11px] text-[#8B8987]">Thắng: {player.wins} trận</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-black text-base text-amber-400 font-mono">🏆 {player.elo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB GIẢI THẾ CỜ (CHESS PUZZLES) */}
        {activeTab === 'puzzles' && (
          <PuzzleView />
        )}

        {/* TAB HỌC CỜ (CHESS LESSONS) */}
        {activeTab === 'learn' && (
          <LearnView />
        )}
      </main>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccessLogin={(userData) => setUser(userData)}
      />

      <MatchmakingModal
        isOpen={isSearchingQueue}
        onCancel={leaveQueue}
      />

      <FriendRoomModal
        isOpen={isFriendModalOpen}
        onClose={() => setIsFriendModalOpen(false)}
        createdRoomCode={createdRoomCode}
        friendRoomError={friendRoomError}
        onCreateRoom={handleCreateFriendRoom}
        onJoinRoom={handleJoinFriendRoom}
        onCancelRoom={cancelFriendRoom}
      />

      {/* POPUP KẾT QUẢ KHI KẾT THÚC TRẬN ĐẤU (KÈM BIẾN ĐỘNG ELO) */}
      <GameOverModal
        gameStatus={currentStatus}
        playerColor={playerColor}
        isOnlineMatch={!!activeMatch}
        customMessage={customGameOverMsg}
        myEloResult={currentMatchEloResult}
        onPlayAgain={handlePlayAgain}
        onBackToMenu={() => {
          setLocalGameOverStatus(null);
          setCustomGameOverMsg(undefined);
          setCurrentMatchEloResult(null);
          setActiveMode(null);
          clearActiveMatch();
          resetGame();
        }}
      />

      {/* POPUP XÁC NHẬN RỜI PHÒNG ĐẤU */}
      <LeaveRoomModal
        isOpen={isLeaveModalOpen}
        onConfirm={handleConfirmLeaveRoom}
        onCancel={() => setIsLeaveModalOpen(false)}
      />

      {/* POPUP XÁC NHẬN ĐẦU HÀNG */}
      <ResignModal
        isOpen={isResignModalOpen}
        onConfirm={handleConfirmResign}
        onCancel={() => setIsResignModalOpen(false)}
      />
    </div>
  );
}
