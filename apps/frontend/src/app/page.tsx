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
import { MoveHistoryModal } from '../components/MoveHistoryModal';
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
import { Cpu, ArrowLeft, Flag, Trophy, Menu, Crown, ScrollText, RotateCcw, AlertTriangle } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('play');
  const [activeMode, setActiveMode] = useState<GameModeSelection | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isResignModalOpen, setIsResignModalOpen] = useState(false);
  const [isFriendModalOpen, setIsFriendModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMoveHistoryModalOpen, setIsMoveHistoryModalOpen] = useState(false);
  const [isGameOverModalOpen, setIsGameOverModalOpen] = useState(true);

  const [user, setUser] = useState<{ username: string; eloRating: number; token: string } | null>(null);
  const [customGameOverMsg, setCustomGameOverMsg] = useState<string | undefined>(undefined);
  const [localGameOverStatus, setLocalGameOverStatus] = useState<string | null>(null);
  const [currentMatchEloResult, setCurrentMatchEloResult] = useState<EloPlayerResult | null>(null);

  const prevStatusRef = useRef<string>('IN_PROGRESS');

  // Khôi phục trạng thái Đăng nhập từ LocalStorage khi F5 / mở lại trình duyệt
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('chess_user');
      const token = localStorage.getItem('chess_token');
      if (savedUser && token) {
        setUser(JSON.parse(savedUser));
      }
    } catch (err) {
      console.error('Error reading saved user from localStorage:', err);
    }
  }, []);

  // Hook WebSocket Socket.io Realtime
  const {
    isConnected,
    isSearchingQueue,
    createdRoomCode,
    friendRoomError,
    activeMatch,
    latestMove,
    resignationEvent,
    disconnectedOpponent,
    joinQueue,
    leaveQueue,
    createFriendRoom,
    joinFriendRoom,
    cancelFriendRoom,
    reconnectMatch,
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

  // 1. Tự động kiểm tra và kết nối lại ván đấu (Reconnect Grace Period khi F5)
  useEffect(() => {
    if (isConnected && !activeMatch) {
      try {
        const savedMatchStr = localStorage.getItem('chess_active_online_match');
        if (savedMatchStr) {
          const saved = JSON.parse(savedMatchStr);
          if (saved?.roomId && saved?.userId) {
            console.log('🔄 [Auto Reconnect] Đang gửi yêu cầu kết nối lại:', saved);
            reconnectMatch(saved.roomId, saved.userId);
          }
        }
      } catch (err) {
        console.error('Error attempting match reconnect:', err);
      }
    }
  }, [isConnected, activeMatch]);

  // 2. Tự động chuyển mode và gán màu cờ theo chỉ định của Server khi ghép trận / bạn bè / reconnect thành công
  useEffect(() => {
    if (activeMatch) {
      setIsFriendModalOpen(false);
      setActiveMode('online');
      setLocalGameOverStatus(null);
      setCustomGameOverMsg(undefined);
      setCurrentMatchEloResult(null);
      setIsGameOverModalOpen(true);

      const myColor = activeMatch.yourColor || 'w';
      setPlayerColor(myColor);
      setBoardFen(activeMatch.fen, activeMatch.history || []);
      sounds.playGameStart();

      // Lưu thông tin trận đấu vào LocalStorage để hỗ trợ F5 Reconnect
      try {
        const myUserId = user?.username || (myColor === 'w' ? activeMatch.whitePlayer.userId : activeMatch.blackPlayer.userId);
        localStorage.setItem(
          'chess_active_online_match',
          JSON.stringify({
            roomId: activeMatch.roomId,
            userId: myUserId,
          })
        );
      } catch (err) {
        console.error('Error saving active online match to localStorage:', err);
      }
    }
  }, [activeMatch, user]);

  // 3. LẮNG NGHE SỰ KIỆN ĐỐI THỦ ĐẦU HÀNG, F5 HOẶC HẾT GIỜ (TIMEOUT)
  useEffect(() => {
    if (resignationEvent) {
      localStorage.removeItem('chess_active_online_match');
      const winningStatus = resignationEvent.winnerColor === 'w' ? 'WHITE_WIN' : 'BLACK_WIN';
      setLocalGameOverStatus(winningStatus);
      setIsGameOverModalOpen(true);

      const isMeWin = resignationEvent.winnerColor === playerColor;
      let msg = resignationEvent.message;

      if (resignationEvent.reason === 'TIMEOUT') {
        msg = isMeWin
          ? `Đối thủ (${resignationEvent.loserName}) đã hết thời gian thi đấu. Bạn đã Chiến Thắng!`
          : `Bạn (${resignationEvent.loserName}) đã hết thời gian thi đấu (Lost on Time)!`;
      } else if (resignationEvent.reason === 'DISCONNECT') {
        msg = isMeWin
          ? `Đối thủ (${resignationEvent.loserName}) đã rời trận (quá 45s không kết nối lại). Bạn Thắng!`
          : `Bạn đã bị mất kết nối khỏi ván đấu.`;
      } else if (resignationEvent.reason === 'RESIGNATION') {
        msg = isMeWin
          ? `Đối thủ (${resignationEvent.loserName}) đã đầu hàng. Bạn đã Chiến Thắng!`
          : `Bạn đã đầu hàng ván đấu.`;
      }
      setCustomGameOverMsg(msg);

      // Cập nhật kết quả Elo
      if (resignationEvent.eloResult) {
        const myElo = playerColor === 'w' ? resignationEvent.eloResult.white : resignationEvent.eloResult.black;
        setCurrentMatchEloResult(myElo);

        // Cập nhật State User và LocalStorage để tự động nhảy số Elo
        setUser((prev) => {
          if (!prev) return null;
          const updated = { ...prev, eloRating: myElo.newElo };
          localStorage.setItem('chess_user', JSON.stringify(updated));
          return updated;
        });
      } else {
        setCurrentMatchEloResult(null);
      }

      if (resignationEvent.winnerColor === playerColor) {
        sounds.playGameEndWin();
      } else {
        sounds.playGameEndLose();
      }
    }
  }, [resignationEvent, playerColor]);

  // 4. Phát âm thanh KẾT THÚC TRẬN & Bắt Elo khi Chiếu Hết qua latestMove
  useEffect(() => {
    if (latestMove && latestMove.isGameOver) {
      localStorage.removeItem('chess_active_online_match');
      if (latestMove.eloResult) {
        const myElo = playerColor === 'w' ? latestMove.eloResult.white : latestMove.eloResult.black;
        setCurrentMatchEloResult(myElo);
        setUser((prev) => {
          if (!prev) return null;
          const updated = { ...prev, eloRating: myElo.newElo };
          localStorage.setItem('chess_user', JSON.stringify(updated));
          return updated;
        });
      }
    }
  }, [latestMove, playerColor]);

  // Phát âm thanh khi kết thúc ván đấu
  useEffect(() => {
    if (prevStatusRef.current === 'IN_PROGRESS' && currentStatus !== 'IN_PROGRESS' && !resignationEvent) {
      localStorage.removeItem('chess_active_online_match');
      setIsGameOverModalOpen(true);
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

  // 5. Đồng bộ nước đi mới từ WebSocket Realtime & Cập nhật thế cờ chiếu hết
  useEffect(() => {
    if (latestMove && activeMode === 'online') {
      setBoardFen(latestMove.fen, latestMove.history);

      if (latestMove.isGameOver) {
        localStorage.removeItem('chess_active_online_match');
        setIsGameOverModalOpen(true);
        if (latestMove.isCheckmate) {
          const winningStatus = latestMove.winnerColor === 'w' ? 'WHITE_WIN' : 'BLACK_WIN';
          setLocalGameOverStatus(winningStatus);
          const isMeWin = latestMove.winnerColor === playerColor;
          setCustomGameOverMsg(
            isMeWin
              ? 'Chiến thắng vang dội! Bạn đã xuất sắc chiếu hết Vua của đối thủ.'
              : 'Bạn đã bị đối thủ chiếu hết (Checkmate)! Bấm nút "Xem lại bàn cờ" để quan sát thế trận.'
          );
        } else if (latestMove.isDraw) {
          setLocalGameOverStatus('DRAW');
          setCustomGameOverMsg('Ván cờ kết thúc với tỷ số Hòa (Hết nước đi hợp lệ - Stalemate hoặc Không đủ quân).');
        }
      }
    }
  }, [latestMove, activeMode, playerColor]);

  // Xử lý chọn Chế độ chơi từ PlayMenu (RÀNG BUỘC ĐĂNG NHẬP CHO ĐẤU TRỰC TUYẾN)
  const handleSelectMode = (mode: GameModeSelection) => {
    setLocalGameOverStatus(null);
    setCustomGameOverMsg(undefined);
    setCurrentMatchEloResult(null);
    setIsGameOverModalOpen(true);

    // RÀNG BUỘC: Đấu trực tuyến (Rated PvP) bắt buộc phải Đăng nhập tài khoản
    if (mode === 'online') {
      if (!user) {
        setIsAuthOpen(true);
        return;
      }

      joinQueue({
        userId: user.username,
        username: user.username,
        eloRating: user.eloRating || 1200,
      });
      return;
    }

    if (mode === 'friend') {
      setIsFriendModalOpen(true);
      return;
    }

    clearActiveMatch();
    localStorage.removeItem('chess_active_online_match');
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
    localStorage.removeItem('chess_active_online_match');
    setIsLeaveModalOpen(false);
    setActiveMode(null);
    clearActiveMatch();
    resetGame();
    setLocalGameOverStatus(null);
    setCustomGameOverMsg(undefined);
    setCurrentMatchEloResult(null);
    setIsGameOverModalOpen(true);
  };

  // Xác nhận Đầu hàng
  const handleConfirmResign = () => {
    setIsResignModalOpen(false);
    localStorage.removeItem('chess_active_online_match');

    if (activeMatch) {
      resignMatch(activeMatch.roomId);
    } else {
      const losingStatus = playerColor === 'w' ? 'BLACK_WIN' : 'WHITE_WIN';
      setLocalGameOverStatus(losingStatus);
      setCustomGameOverMsg('Bạn đã đầu hàng. Trận thắng thuộc về Stockfish Engine!');
      setIsGameOverModalOpen(true);
      sounds.playGameEndLose();
    }
  };

  // Xử lý nút Chơi Ván Mới / Tạo Phòng Mới
  const handlePlayAgain = () => {
    setLocalGameOverStatus(null);
    setCustomGameOverMsg(undefined);
    setCurrentMatchEloResult(null);
    setIsGameOverModalOpen(true);

    const wasRated = activeMatch?.isRated;
    localStorage.removeItem('chess_active_online_match');
    clearActiveMatch();
    resetGame();

    if (wasRated) {
      if (user) {
        joinQueue({
          userId: user.username,
          username: user.username,
          eloRating: user.eloRating || 1200,
        });
      }
    } else {
      setActiveMode(null);
      setIsFriendModalOpen(true);
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
          setBoardFen(testGame.fen(), testGame.history());
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
    localStorage.removeItem('chess_user');
    localStorage.removeItem('chess_active_online_match');
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
    <div className="h-[100dvh] w-screen overflow-hidden bg-[#161512] text-[#C3C1C0] flex select-none">
      {/* Sidebar (Desktop cố định bên trái, Mobile trượt Drawer khi mở nút 3 gạch) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        onOpenAuthModal={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main View Area */}
      <main className="flex-1 h-full overflow-y-auto md:overflow-hidden flex flex-col p-1.5 sm:p-2 md:p-4 bg-radial-glow">
        
        {/* TOP HEADER BAR CHO MOBILE (< md) */}
        <header className="md:hidden flex items-center justify-between p-2 sm:p-2.5 bg-[#262421] rounded-2xl border border-[#312E2B] mb-1.5 shadow-lg shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 rounded-xl bg-[#2F2D2A] text-white hover:bg-[#383531] border border-[#3A3733] transition-colors active:scale-95"
              title="Menu Điều Hướng"
            >
              <Menu className="w-5 h-5 text-pink-400" />
            </button>
            <div className="flex items-center gap-1.5 font-black text-sm text-white">
              <Crown className="w-4 h-4 text-pink-500 fill-pink-500/20" />
              <span>Chess Online</span>
            </div>
          </div>

          {/* Cụm nút thao tác trên Mobile khi đang trong ván đấu */}
          {(activeMode || activeMatch) && activeTab === 'play' ? (
            <div className="flex items-center gap-1.5">
              {/* Nút xem Lịch sử nước đi */}
              <button
                onClick={() => setIsMoveHistoryModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/30 text-xs font-bold transition-all active:scale-95"
                title="Xem Lịch sử nước đi"
              >
                <ScrollText className="w-3.5 h-3.5" />
                <span className="font-mono text-[11px]">({moveHistory.length})</span>
              </button>

              {/* Nút Đầu hàng */}
              <button
                onClick={() => setIsResignModalOpen(true)}
                className="p-1.5 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all active:scale-95"
                title="Đầu hàng"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>

              {/* Nút Rời phòng */}
              <button
                onClick={() => setIsLeaveModalOpen(true)}
                className="p-1.5 px-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all active:scale-95"
                title="Rời phòng"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="text-[11px] text-pink-400 font-bold bg-pink-500/10 px-2.5 py-1 rounded-full border border-pink-500/20">
              v1.2 Mobile
            </div>
          )}
        </header>

        {/* TAB CHƠI CỜ (PLAY) */}
        {activeTab === 'play' && (
          <div className="w-full max-w-7xl mx-auto flex-1 min-h-0 flex items-center justify-center">
            
            {/* MÀN HÌNH CHỌN CHẾ ĐỘ CHƠI BAN ĐẦU */}
            {!activeMode && !activeMatch ? (
              <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center p-2 md:p-4">
                <PlayMenu onSelectMode={handleSelectMode} />
              </div>
            ) : (
              /* MÀN HÌNH BÀN CỜ THI ĐẤU */
              <div className="w-full h-full grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 items-center justify-center">
                
                {/* Left Column (Desktop 7-8/12 Cols, Mobile 100%): Bàn cờ & Player Cards */}
                <div className="md:col-span-7 lg:col-span-8 flex flex-col items-center justify-between h-full py-0.5 md:py-1">
                  
                  {/* BANNER THÔNG BÁO ĐỐI THỦ MẤT KẾT NỐI (RECONNECT GRACE PERIOD) */}
                  {disconnectedOpponent && (
                    <div className="w-full max-w-[480px] mb-1 p-2.5 bg-amber-500/15 border border-amber-500/40 rounded-2xl flex items-center justify-between text-amber-300 text-xs font-bold shadow-lg animate-pulse shrink-0">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Đối thủ ({disconnectedOpponent.disconnectedPlayer}) tạm mất kết nối. Đang chờ 45s...</span>
                      </span>
                    </div>
                  )}

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
                        ? activeMatch.isRated
                          ? `Elo: ${opponentInfo?.eloRating || 1200} • ${playerColor === 'w' ? 'Quân Đen' : 'Quân Trắng'}`
                          : `Phòng Bạn Bè • ${playerColor === 'w' ? 'Quân Đen' : 'Quân Trắng'}`
                        : activeMode === 'bots'
                        ? difficulty === 1
                          ? 'Dễ (~800 Elo)'
                          : difficulty === 2
                          ? 'Trung bình (~1300 Elo)'
                          : 'Khó (~2000 Elo)'
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
                        ? activeMatch.isRated
                          ? `Elo: ${user?.eloRating || myInfo?.eloRating || 1200} • ${playerColor === 'w' ? 'Cầm quân Trắng' : 'Cầm quân Đen'}`
                          : `Phòng Bạn Bè • ${playerColor === 'w' ? 'Cầm quân Trắng' : 'Cầm quân Đen'}`
                        : playerColor === 'w'
                        ? 'Cầm quân Trắng'
                        : 'Cầm quân Đen'
                    }
                    color={playerColor}
                    gameStatus={currentStatus}
                  />

                  {/* THANH ĐIỀU HƯỚNG NHANH KHI ĐÓNG MODAL XEM BÀN CỜ */}
                  {!isGameOverModalOpen && currentStatus !== 'IN_PROGRESS' && (
                    <div className="w-full max-w-[480px] mt-1.5 p-2 bg-[#262421]/95 border border-[#3A3733] rounded-2xl shadow-xl flex items-center justify-between gap-2 animate-in slide-in-from-bottom-2 duration-200 shrink-0">
                      <span className="text-xs font-bold text-pink-400 pl-2 truncate">
                        🏁 Ván đấu đã kết thúc
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={handlePlayAgain}
                          className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center gap-1 shadow transition-all active:scale-95"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Ván Mới</span>
                        </button>
                        <button
                          onClick={() => {
                            setLocalGameOverStatus(null);
                            setCustomGameOverMsg(undefined);
                            setCurrentMatchEloResult(null);
                            setActiveMode(null);
                            clearActiveMatch();
                            resetGame();
                            setIsGameOverModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-[#312E2B] hover:bg-[#3B3835] text-[#BAB8B6] font-bold text-xs flex items-center gap-1 transition-colors"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Menu</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* BẢNG CẤU HÌNH NHỎ GỌN TRÊN MOBILE (< md) */}
                  <div className="md:hidden w-full max-w-[500px] mt-1.5 p-2 bg-[#262421] rounded-2xl border border-[#312E2B] shadow-xl flex flex-col gap-1.5 shrink-0">
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
                              setLocalGameOverStatus(null);
                              setCustomGameOverMsg(undefined);
                              setCurrentMatchEloResult(null);
                              setIsGameOverModalOpen(true);
                              resetGame();
                            }}
                            onToggleColor={() => {
                              setLocalGameOverStatus(null);
                              setCustomGameOverMsg(undefined);
                              setCurrentMatchEloResult(null);
                              setIsGameOverModalOpen(true);
                              togglePlayerColor();
                            }}
                            playerColor={playerColor}
                            disabled={isAiThinking}
                          />
                        )}
                      </div>
                    )}

                    {activeMatch && (
                      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1C1A17] rounded-xl text-xs">
                        <span className="text-pink-400 font-bold">
                          {activeMatch.isRated ? '⚔️ Đấu Xếp Hạng Online' : '👥 Đấu Bạn Bè (Custom Room)'}
                        </span>
                        <span className="text-amber-400 font-mono font-bold">
                          {activeMatch.isRated ? `Elo: ${user?.eloRating || myInfo?.eloRating || 1200}` : 'Giao hữu'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column (Desktop 4-5/12 Cols, Ẩn trên Mobile) */}
                <div className="hidden md:flex md:col-span-5 lg:col-span-4 flex-col gap-3 h-full max-h-[calc(100vh-40px)] justify-between">
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
                        {activeMatch
                          ? activeMatch.isRated
                            ? '⚔️ ĐẤU XẾP HẠNG ONLINE (RATED)'
                            : '👥 ĐẤU BẠN BÈ (CUSTOM ROOM)'
                          : activeMode === 'bots'
                          ? '🤖 ĐÁNH VỚI MÁY'
                          : '👥 ĐẤU BẠN BÈ'}
                      </span>
                    </div>

                    {/* Controls Box Desktop */}
                    <div className="p-4 bg-[#262421] rounded-2xl border border-[#312E2B] flex flex-col gap-3.5 shadow-xl shrink-0">
                      <div className="flex items-center justify-between border-b border-[#312E2B] pb-2">
                        <h2 className="font-bold text-xs text-white flex items-center gap-1.5">
                          <Cpu className="w-4 h-4 text-pink-400" />
                          Cấu hình Trận đấu
                        </h2>
                        <span className="text-[10px] text-pink-400 font-semibold bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                          {activeMatch
                            ? activeMatch.isRated
                              ? 'Ghép trận Xếp hạng'
                              : 'Phòng Giao Hữu (Unrated)'
                            : 'Local Game'}
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
                            setIsGameOverModalOpen(true);
                            resetGame();
                          }}
                          onToggleColor={() => {
                            setLocalGameOverStatus(null);
                            setCustomGameOverMsg(undefined);
                            setCurrentMatchEloResult(null);
                            setIsGameOverModalOpen(true);
                            togglePlayerColor();
                          }}
                          playerColor={playerColor}
                          disabled={isAiThinking}
                        />
                      )}
                    </div>

                    {/* Move History Desktop */}
                    <MoveHistory moveHistory={moveHistory} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div className="w-full max-w-4xl mx-auto h-full overflow-hidden flex flex-col p-2 md:p-4">
            <div className="bg-[#262421] rounded-2xl border border-[#312E2B] p-4 md:p-6 flex flex-col h-full shadow-2xl">
              <div className="flex items-center gap-3 border-b border-[#312E2B] pb-3 md:pb-4 mb-3 md:mb-4">
                <Trophy className="w-6 h-6 md:w-7 md:h-7 text-amber-400" />
                <div>
                  <h2 className="text-base md:text-lg font-black text-white">Bảng Xếp Hạng Elo Quốc Tế</h2>
                  <p className="text-[11px] md:text-xs text-[#8B8987]">Top cao thủ có điểm Elo cao nhất hệ thống</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 md:pr-2">
                <div className="flex flex-col gap-2">
                  {[
                    { rank: 1, name: 'Magnus Carlsen', elo: 2882, wins: 450, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=magnus' },
                    { rank: 2, name: 'Hikaru Nakamura', elo: 2875, wins: 412, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=hikaru' },
                    { rank: 3, name: 'Phan Hồng Sơn', elo: user?.eloRating || 1200, wins: 12, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=sonsamset' },
                  ].map((player) => (
                    <div key={player.rank} className="flex items-center justify-between p-3 rounded-xl bg-[#2F2D2A] border border-[#3A3733]">
                      <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
                        <span className={`w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center font-black text-[10px] md:text-xs shrink-0 ${
                          player.rank === 1 ? 'bg-amber-500 text-slate-950' : player.rank === 2 ? 'bg-slate-300 text-slate-950' : 'bg-pink-600 text-white'
                        }`}>
                          #{player.rank}
                        </span>
                        <img src={player.avatar} alt="Avatar" className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-[#363431] shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-xs md:text-sm text-[#FFFFFF] truncate">{player.name}</p>
                          <p className="text-[10px] md:text-[11px] text-[#8B8987]">Thắng: {player.wins} trận</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-black text-sm md:text-base text-amber-400 font-mono">🏆 {player.elo}</p>
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

      {/* POPUP LỊCH SỬ NƯỚC ĐI TRÊN MOBILE */}
      <MoveHistoryModal
        isOpen={isMoveHistoryModalOpen}
        onClose={() => setIsMoveHistoryModalOpen(false)}
        moveHistory={moveHistory}
      />

      {/* POPUP KẾT QUẢ KHI KẾT THÚC TRẬN ĐẤU */}
      <GameOverModal
        isOpen={isGameOverModalOpen}
        gameStatus={currentStatus}
        playerColor={playerColor}
        isOnlineMatch={!!activeMatch}
        isRated={activeMatch?.isRated ?? false}
        customMessage={customGameOverMsg}
        myEloResult={currentMatchEloResult}
        onPlayAgain={handlePlayAgain}
        onCloseToReview={() => setIsGameOverModalOpen(false)}
        onBackToMenu={() => {
          setLocalGameOverStatus(null);
          setCustomGameOverMsg(undefined);
          setCurrentMatchEloResult(null);
          setActiveMode(null);
          clearActiveMatch();
          resetGame();
          setIsGameOverModalOpen(true);
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
