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
import { HistoryView, MatchRecord } from '../components/HistoryView';
import { TournamentModal, TournamentData } from '../components/TournamentModal';
import { GameReportView } from '../components/GameReportView';
import { AnalysisEngine } from '../services/analysis/AnalysisEngine';
import { GameAnalysisReport } from '../services/analysis/types';
import { ChessBoardComponent } from '../components/ChessBoard';
import { PlayerCard } from '../components/PlayerCard';
import { DifficultySelector } from '../components/DifficultySelector';
import { GameControls } from '../components/GameControls';
import { MoveHistory } from '../components/MoveHistory';
import { useChessEngine } from '../hooks/useChessEngine';
import { useSocket, EloPlayerResult } from '../hooks/useSocket';
import { useLiveAnalysis } from '../hooks/useLiveAnalysis';
import { sounds } from '../utils/soundEffects';
import { Chess, Square } from 'chess.js';
import { Cpu, ArrowLeft, Flag, Trophy, Menu, Crown, ScrollText, RotateCcw, AlertTriangle, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('play');
  const [activeMode, setActiveMode] = useState<GameModeSelection | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isResignModalOpen, setIsResignModalOpen] = useState(false);
  const [isFriendModalOpen, setIsFriendModalOpen] = useState(false);
  const [isTournamentModalOpen, setIsTournamentModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMoveHistoryModalOpen, setIsMoveHistoryModalOpen] = useState(false);
  const [isGameOverModalOpen, setIsGameOverModalOpen] = useState(false);

  // Trạng thái Giải đấu & Phân tích trận đấu
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(null);
  const [tournamentChampionId, setTournamentChampionId] = useState<string | null>(null);
  const [analysisReport, setAnalysisReport] = useState<GameAnalysisReport | null>(null);
  const [isReviewAnalyzing, setIsReviewAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatusText, setAnalysisStatusText] = useState('');
  const analysisAbortControllerRef = useRef<AbortController | null>(null);

  const [user, setUser] = useState<{ id?: string; username: string; eloRating: number; token: string } | null>(null);
  const [customGameOverMsg, setCustomGameOverMsg] = useState<string | undefined>(undefined);
  const [currentEndReason, setCurrentEndReason] = useState<string | undefined>(undefined);
  const [localGameOverStatus, setLocalGameOverStatus] = useState<string | null>(null);
  const [currentMatchEloResult, setCurrentMatchEloResult] = useState<EloPlayerResult | null>(null);
  const [reconnectCountdown, setReconnectCountdown] = useState<number>(45);

  // Bảng xếp hạng thật từ MongoDB
  const [realLeaderboard, setRealLeaderboard] = useState<any[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);

  const prevStatusRef = useRef<string>('IN_PROGRESS');

  // Tải Bảng xếp hạng thật từ Backend MongoDB Atlas
  useEffect(() => {
    if (activeTab === 'leaderboard') {
      setIsLeaderboardLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      fetch(`${apiUrl}/api/v1/users/leaderboard?limit=20`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            setRealLeaderboard(data.data);
          }
        })
        .catch((err) => console.error('Lỗi tải leaderboard:', err))
        .finally(() => setIsLeaderboardLoading(false));
    }
  }, [activeTab]);

  // Khôi phục trạng thái Đăng nhập từ LocalStorage khi F5 / mở lại trình duyệt
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('chess_user');
      const token = localStorage.getItem('chess_token');
      if (savedUser && token) {
        setUser({ ...JSON.parse(savedUser), token });
      }
    } catch (err) {
      console.error('Error reading saved user from localStorage:', err);
    }
  }, []);

  // Hook WebSocket Socket.io Realtime
  const {
    socket,
    isConnected,
    isSearchingQueue,
    createdRoomCode,
    friendRoomError,
    activeMatch,
    latestMove,
    currentClock,
    resignationEvent,
    disconnectedOpponent,
    forceLogoutMessage,
    clearForceLogoutMessage,
    registerUser,
    unregisterUser,
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

  const currentStatus = !activeMode ? 'IDLE' : (localGameOverStatus || engineStatus);

  // Trạng thái Xem lại Ván đấu (Replay Mode)
  const [replayMatch, setReplayMatch] = useState<MatchRecord | null>(null);
  const [replayMoveIndex, setReplayMoveIndex] = useState<number>(0);

  const goToReplayMove = (targetIndex: number) => {
    if (!replayMatch) return;
    const clampedIndex = Math.max(0, Math.min(targetIndex, replayMatch.moves.length));
    setReplayMoveIndex(clampedIndex);

    const tempGame = new Chess();
    for (let i = 0; i < clampedIndex; i++) {
      try {
        tempGame.move(replayMatch.moves[i]);
      } catch (err) {
        break;
      }
    }
    setBoardFen(tempGame.fen(), replayMatch.moves.slice(0, clampedIndex));
  };

  const currentActiveRoomIdRef = useRef<string | null>(null);

  // ---------------------------------------------------------------------------
  // LIVE MOVE ANALYSIS (LIVE COACH TRONG TRẬN)
  // Kích hoạt ở chế độ PvAI (Đấu với Bot) và Đấu Bạn Bè (Friend Custom Room, unrated)
  // TẮT HOÀN TOÀN ở Đấu Xếp Hạng (Ranked PvP), Đấu Giải (Tournament) và Xem lại ván (Replay)
  // ---------------------------------------------------------------------------
  const isLiveAnalysisEnabled =
    activeTab === 'play' &&
    replayMatch === null &&
    (activeMode === 'bots' || (activeMatch !== null && activeMatch.isRated === false && !activeMatch.isTournament));

  const {
    analysisByPly,
    selectedPly,
    setSelectedPly,
    enqueueMove,
    resetAnalysis,
  } = useLiveAnalysis({
    enabled: isLiveAnalysisEnabled,
  });

  const processedPlyRef = useRef<number>(0);

  useEffect(() => {
    if (!isLiveAnalysisEnabled) {
      processedPlyRef.current = 0;
      return;
    }

    const currentPlies = moveHistory.length;

    // Ván cờ bị reset hoặc undo
    if (currentPlies < processedPlyRef.current) {
      processedPlyRef.current = currentPlies;
      resetAnalysis();
      return;
    }

    // Khi có đúng 1 nước mới được thêm vào
    if (currentPlies === processedPlyRef.current + 1) {
      const ply = currentPlies;
      const san = moveHistory[currentPlies - 1];
      const moveColor: 'w' | 'b' = ply % 2 === 1 ? 'w' : 'b';

      const fenAfter = game.fen();
      const clone = new Chess();
      for (let i = 0; i < currentPlies - 1; i++) {
        try {
          clone.move(moveHistory[i]);
        } catch {
          break;
        }
      }
      const fenBefore = clone.fen();

      enqueueMove({
        ply,
        fenBefore,
        fenAfter,
        moveSan: san,
        playerColor: moveColor,
      });

      processedPlyRef.current = currentPlies;
    }
  }, [moveHistory, isLiveAnalysisEnabled, game, enqueueMove, resetAnalysis]);

  // ---------------------------------------------------------------------------
  // ĐỒNG HỒ THI ĐẤU THỜI GIAN THỰC (REALTIME IN-GAME CHESS CLOCK)
  // ---------------------------------------------------------------------------
  const isBotGame = activeMode === 'bots';
  const currentTurn = (fen ? fen.split(' ')[1] : 'w') as 'w' | 'b';

  const [whiteDisplayTimeMs, setWhiteDisplayTimeMs] = useState<number>(600000);
  const [blackDisplayTimeMs, setBlackDisplayTimeMs] = useState<number>(600000);

  const clockBaselineRef = useRef<{
    whiteBaseMs: number;
    blackBaseMs: number;
    activeColor: 'w' | 'b';
    turnStartedAt: number;
  }>({
    whiteBaseMs: 600000,
    blackBaseMs: 600000,
    activeColor: 'w',
    turnStartedAt: Date.now(),
  });

  const prevTurnRef = useRef<'w' | 'b'>('w');

  // A. Đồng bộ mốc đồng hồ từ Server (Online PvP Matchmaking & Custom Room)
  useEffect(() => {
    if (!currentClock) return;
    clockBaselineRef.current = {
      whiteBaseMs: currentClock.whiteTimeMs,
      blackBaseMs: currentClock.blackTimeMs,
      activeColor: currentClock.activeColor,
      turnStartedAt: currentClock.turnStartedAt || Date.now(),
    };
    setWhiteDisplayTimeMs(currentClock.whiteTimeMs);
    setBlackDisplayTimeMs(currentClock.blackTimeMs);
  }, [currentClock]);

  // B. Khởi tạo & Đồng bộ lượt đồng hồ trong chế độ Đấu với Máy (PvAI) phản ứng theo FEN
  useEffect(() => {
    if (isBotGame && currentStatus === 'IN_PROGRESS') {
      if (currentTurn !== prevTurnRef.current) {
        const now = Date.now();
        const elapsed = Math.max(0, now - clockBaselineRef.current.turnStartedAt);
        if (prevTurnRef.current === 'w') {
          clockBaselineRef.current.whiteBaseMs = Math.max(0, clockBaselineRef.current.whiteBaseMs - elapsed);
          setWhiteDisplayTimeMs(clockBaselineRef.current.whiteBaseMs);
        } else {
          clockBaselineRef.current.blackBaseMs = Math.max(0, clockBaselineRef.current.blackBaseMs - elapsed);
          setBlackDisplayTimeMs(clockBaselineRef.current.blackBaseMs);
        }
        clockBaselineRef.current.turnStartedAt = now;
        clockBaselineRef.current.activeColor = currentTurn;
        prevTurnRef.current = currentTurn;
      }
    }
  }, [fen, isBotGame, currentStatus, currentTurn]);

  // C. Reset đồng hồ khi bắt đầu ván mới hoặc đổi chế độ
  useEffect(() => {
    if (moveHistory.length === 0 && isBotGame && activeTab === 'play') {
      const startTurn = (fen ? fen.split(' ')[1] : 'w') as 'w' | 'b';
      clockBaselineRef.current = {
        whiteBaseMs: 600000,
        blackBaseMs: 600000,
        activeColor: startTurn,
        turnStartedAt: Date.now(),
      };
      setWhiteDisplayTimeMs(600000);
      setBlackDisplayTimeMs(600000);
      prevTurnRef.current = startTurn;
    }
  }, [moveHistory.length, isBotGame, fen, activeTab]);

  // D. Vòng lặp đếm lùi thời gian thực mỗi 100ms
  useEffect(() => {
    if (currentStatus !== 'IN_PROGRESS') return;
    if (activeTab !== 'play' || !activeMode) return;
    if (!activeMatch && !isBotGame) return;

    const interval = setInterval(() => {
      const { whiteBaseMs, blackBaseMs, activeColor, turnStartedAt } = clockBaselineRef.current;
      const elapsed = Math.max(0, Date.now() - turnStartedAt);

      if (activeColor === 'w') {
        const remaining = Math.max(0, whiteBaseMs - elapsed);
        setWhiteDisplayTimeMs(remaining);
        if (remaining <= 0 && isBotGame) {
          clearInterval(interval);
          setLocalGameOverStatus('BLACK_WIN');
          setCurrentEndReason('TIMEOUT');
          setCustomGameOverMsg('Hết thời gian! Bên Trắng đã thua do hết giờ thi đấu.');
          setIsGameOverModalOpen(true);
        }
      } else {
        const remaining = Math.max(0, blackBaseMs - elapsed);
        setBlackDisplayTimeMs(remaining);
        if (remaining <= 0 && isBotGame) {
          clearInterval(interval);
          setLocalGameOverStatus('WHITE_WIN');
          setCurrentEndReason('TIMEOUT');
          setCustomGameOverMsg('Hết thời gian! Bên Đen đã thua do hết giờ thi đấu.');
          setIsGameOverModalOpen(true);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [currentStatus, activeTab, activeMode, activeMatch, isBotGame]);

  // 1. Đếm lùi thời gian Grace Period 45s khi đối thủ mất kết nối
  useEffect(() => {
    if (!disconnectedOpponent) {
      setReconnectCountdown(45);
      return;
    }

    setReconnectCountdown(disconnectedOpponent.gracePeriodSeconds || 45);
    const interval = setInterval(() => {
      setReconnectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [disconnectedOpponent]);

  // 1b. Tự động đăng ký phiên Socket bảo mật bằng JWT khi có User đăng nhập
  useEffect(() => {
    if (isConnected && user) {
      const token = localStorage.getItem('chess_token');
      if (token) {
        registerUser(token, user.id);
      }
    }
  }, [isConnected, user]);

  // 1c. Xử lý khi bị ngắt phiên do đăng nhập ở thiết bị/trình duyệt khác (Single Session)
  useEffect(() => {
    if (forceLogoutMessage) {
      // Dọn dẹp toàn bộ dữ liệu xác thực
      localStorage.removeItem('chess_token');
      localStorage.removeItem('chess_user');
      localStorage.removeItem('chess_active_online_match');

      // Dọn dẹp trạng thái ván cờ và đưa về Menu
      clearActiveMatch();
      setActiveMode(null);
      resetGame();
      setLocalGameOverStatus(null);
      setCustomGameOverMsg(undefined);
      setCurrentEndReason(undefined);
      setCurrentMatchEloResult(null);
      setIsGameOverModalOpen(false);
      setUser(null);
    }
  }, [forceLogoutMessage]);

  // 2. Tự động kiểm tra và kết nối lại ván đấu (Reconnect Grace Period khi F5)
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

  // Lắng nghe sự kiện Giải đấu kết thúc và công bố Nhà vô địch
  useEffect(() => {
    if (!socket) return;
    const handleTournamentFinished = (data: { tournament: any; championId: string }) => {
      console.log('🏆 [Tournament Finished Client]:', data);
      if (data.tournament) setTournamentData(data.tournament);
      if (data.championId) setTournamentChampionId(data.championId);
    };
    socket.on('tournament_finished', handleTournamentFinished);
    return () => {
      socket.off('tournament_finished', handleTournamentFinished);
    };
  }, [socket]);

  // 3. Tự động chuyển mode và gán màu cờ theo chỉ định của Server khi bắt đầu phòng mới
  useEffect(() => {
    if (activeMatch && activeMatch.roomId !== currentActiveRoomIdRef.current) {
      currentActiveRoomIdRef.current = activeMatch.roomId;
      setIsFriendModalOpen(false);
      setIsTournamentModalOpen(false);
      if (activeMatch.isTournament) {
        setActiveMode('tournament');
      } else if (activeMode !== 'tournament') {
        setActiveMode('online');
      }
      setLocalGameOverStatus(null);
      setCustomGameOverMsg(undefined);
      setCurrentMatchEloResult(null);
      setIsGameOverModalOpen(false);

      const myColor = activeMatch.yourColor || 'w';
      setPlayerColor(myColor);
      setBoardFen(activeMatch.fen, activeMatch.history || []);
      sounds.playGameStart();

      // Lưu thông tin trận đấu vào LocalStorage để hỗ trợ F5 Reconnect
      try {
        const myUserId = (myColor === 'w' ? activeMatch.whitePlayer.userId : activeMatch.blackPlayer.userId);
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
    } else if (!activeMatch) {
      currentActiveRoomIdRef.current = null;
    }
  }, [activeMatch]);

  // 3. LẮNG NGHE SỰ KIỆN ĐỐI THỦ ĐẦU HÀNG, F5 HOẶC HẾT GIỜ (TIMEOUT)
  useEffect(() => {
    if (resignationEvent) {
      localStorage.removeItem('chess_active_online_match');
      const winningStatus = resignationEvent.winnerColor === 'w' ? 'WHITE_WIN' : 'BLACK_WIN';
      setLocalGameOverStatus(winningStatus);
      const mappedReason = resignationEvent.reason === 'TIMEOUT' ? 'TIMEOUT' : resignationEvent.reason === 'DISCONNECT' ? 'ABANDONED' : 'RESIGNED';
      setCurrentEndReason(mappedReason);
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

  // 4. Phát âm thanh khi kết thúc ván đấu
  useEffect(() => {
    const isEndStatus = currentStatus === 'WHITE_WIN' || currentStatus === 'BLACK_WIN' || currentStatus === 'DRAW';
    if (prevStatusRef.current === 'IN_PROGRESS' && isEndStatus && !resignationEvent && !replayMatch) {
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
  }, [currentStatus, playerColor, resignationEvent, replayMatch]);

  // 5. Đồng bộ nước đi mới từ WebSocket Realtime & Cập nhật kết thúc trận (Checkmate / Draw)
  useEffect(() => {
    if (latestMove && (activeMode === 'online' || activeMode === 'tournament')) {
      setBoardFen(latestMove.fen, latestMove.history);

      if (latestMove.isGameOver) {
        localStorage.removeItem('chess_active_online_match');
        setIsGameOverModalOpen(true);
        if (latestMove.isCheckmate) {
          setCurrentEndReason('CHECKMATE');
          const winningStatus = latestMove.winnerColor === 'w' ? 'WHITE_WIN' : 'BLACK_WIN';
          setLocalGameOverStatus(winningStatus);
          const isMeWin = latestMove.winnerColor === playerColor;
          setCustomGameOverMsg(
            isMeWin
              ? 'Chiến thắng vang dội! Bạn đã xuất sắc chiếu hết Vua của đối thủ.'
              : 'Bạn đã bị đối thủ chiếu hết (Checkmate)! Bấm nút "Xem lại bàn cờ" để quan sát thế trận.'
          );
        } else if (latestMove.isDraw) {
          setCurrentEndReason('DRAW');
          setLocalGameOverStatus('DRAW');
          setCustomGameOverMsg('Ván cờ kết thúc với tỷ số Hòa (Hết nước đi hợp lệ - Stalemate hoặc Không đủ quân).');
        }

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
    }
  }, [latestMove, activeMode, playerColor]);

  // Xử lý chọn Chế độ chơi từ PlayMenu (RÀNG BUỘC ĐĂNG NHẬP CHO ĐẤU TRỰC TUYẾN)
  const handleSelectMode = (mode: GameModeSelection) => {
    setLocalGameOverStatus(null);
    setCustomGameOverMsg(undefined);
    setCurrentMatchEloResult(null);
    setIsGameOverModalOpen(false);

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

    if (mode === 'tournament') {
      if (!user) {
        setIsAuthOpen(true);
        return;
      }
      // Nếu giải đấu trước đó đã kết thúc, xóa trạng thái cũ để mở màn hình Tạo/Tham gia giải mới
      if (tournamentData?.status === 'FINISHED') {
        setTournamentData(null);
        setTournamentChampionId(null);
      }
      setIsTournamentModalOpen(true);
      return;
    }

    clearActiveMatch();
    localStorage.removeItem('chess_active_online_match');
    setActiveMode(mode);
    resetGame();
    sounds.playGameStart();
  };

  // Khởi chạy phân tích ván đấu với Stockfish AI Engine (Async + Progress)
  const handleStartAnalysis = async (moves: string[]) => {
    if (!moves || moves.length === 0) return;
    try {
      setIsReviewAnalyzing(true);
      setAnalysisProgress(0);
      setAnalysisStatusText('Đang nạp AI Engine Stockfish...');
      const controller = new AbortController();
      analysisAbortControllerRef.current = controller;

      const report = await AnalysisEngine.analyzeGame(moves, {
        abortSignal: controller.signal,
        onProgress: (percent, statusText) => {
          setAnalysisProgress(percent);
          if (statusText) setAnalysisStatusText(statusText);
        },
      });

      setAnalysisReport(report);
      setIsGameOverModalOpen(false);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Lỗi phân tích ván đấu:', err);
      }
    } finally {
      setIsReviewAnalyzing(false);
      analysisAbortControllerRef.current = null;
    }
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
    setIsGameOverModalOpen(false);
    if (tournamentData?.status === 'FINISHED') {
      setTournamentData(null);
      setTournamentChampionId(null);
    }
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
      setCurrentEndReason('RESIGNED');
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
    if ((activeMode === 'online' || activeMode === 'tournament') && activeMatch) {
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
    // 1. Nếu đang trong ván đấu trực tuyến (PvP hoặc Tournament) và trận đang diễn ra -> Xử lý đầu hàng
    if (activeMatch && (activeMode === 'online' || activeMode === 'tournament') && currentStatus === 'IN_PROGRESS') {
      resignMatch(activeMatch.roomId);
    }

    // 2. Nếu đang tìm trận xếp hạng -> Rời hàng chờ
    if (isSearchingQueue) {
      leaveQueue();
    }

    // 3. Nếu đang tạo phòng bạn bè chờ khách -> Hủy phòng bạn bè
    if (createdRoomCode) {
      cancelFriendRoom();
    }

    // 4. Báo Server hủy đăng ký socket của user này
    unregisterUser();

    // 5. Dọn dẹp toàn bộ dữ liệu lưu trữ
    localStorage.removeItem('chess_token');
    localStorage.removeItem('chess_user');
    localStorage.removeItem('chess_active_online_match');

    // 6. Dọn dẹp trạng thái ván cờ và đưa về Menu chính
    clearActiveMatch();
    setActiveMode(null);
    resetGame();
    setLocalGameOverStatus(null);
    setCustomGameOverMsg(undefined);
    setCurrentEndReason(undefined);
    setCurrentMatchEloResult(null);
    setIsGameOverModalOpen(false);
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

  // Xác định người chơi hiện tại có phải Quán quân Giải đấu (Tournament Champion)
  const isTournamentChampion =
    (activeMode === 'tournament' || !!activeMatch?.isTournament) &&
    (tournamentChampionId !== null || tournamentData?.status === 'FINISHED') &&
    (tournamentChampionId === user?.id ||
      tournamentChampionId === user?.username ||
      tournamentData?.championId === user?.id ||
      tournamentData?.championId === user?.username ||
      (!!user?.username &&
        tournamentData?.players?.find((p) => p.userId === (tournamentChampionId || tournamentData?.championId))?.username === user?.username));

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
            {!activeMode && !activeMatch && !replayMatch ? (
              <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center p-2 md:p-4">
                <PlayMenu onSelectMode={handleSelectMode} />
              </div>
            ) : (
              /* MÀN HÌNH BÀN CỜ THI ĐẤU & XEM LẠI */
              <div className="w-full h-full grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 items-center justify-center">
                
                {/* Left Column (Desktop 7-8/12 Cols, Mobile 100%): Bàn cờ & Player Cards */}
                <div className="md:col-span-7 lg:col-span-8 flex flex-col items-center justify-between h-full py-0.5 md:py-1">
                  
                  {/* BANNER THÔNG BÁO ĐỐI THỦ MẤT KẾT NỐI (RECONNECT GRACE PERIOD) */}
                  {disconnectedOpponent && (
                    <div className="w-full max-w-[480px] mb-1 p-2.5 bg-amber-500/15 border border-amber-500/40 rounded-2xl flex items-center justify-between text-amber-300 text-xs font-bold shadow-lg animate-pulse shrink-0">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Đối thủ ({disconnectedOpponent.disconnectedPlayer}) tạm mất kết nối. Đang chờ:</span>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-xl bg-amber-500/30 text-amber-200 font-mono font-black text-xs border border-amber-500/50 shadow-inner">
                        {reconnectCountdown}s
                      </span>
                    </div>
                  )}

                  {/* Card ĐỐI THỦ / QUÂN ĐEN */}
                  <PlayerCard
                    isAi={!replayMatch && (activeMode === 'bots' || (!activeMode && !activeMatch))}
                    name={
                      replayMatch
                        ? replayMatch.blackUsername
                        : activeMatch
                        ? opponentInfo?.username || 'Đối thủ Online'
                        : activeMode === 'friend'
                        ? 'Bạn bè (Player 2)'
                        : 'Stockfish Engine'
                    }
                    subText={
                      replayMatch
                        ? `${replayMatch.isRated && replayMatch.blackOldElo ? `Elo: ${replayMatch.blackOldElo} • ` : ''}Quân Đen`
                        : activeMatch
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
                    color={replayMatch ? 'b' : (playerColor === 'w' ? 'b' : 'w')}
                    isThinking={false}
                    gameStatus={replayMatch ? 'GAME_OVER' : currentStatus}
                    timeLeftMs={playerColor === 'w' ? blackDisplayTimeMs : whiteDisplayTimeMs}
                    isClockActive={!replayMatch && currentStatus === 'IN_PROGRESS' && currentTurn === (playerColor === 'w' ? 'b' : 'w')}
                  />

                  {/* Bàn cờ Cờ vua */}
                  <ChessBoardComponent
                    game={game}
                    fen={fen}
                    playerColor={replayMatch ? 'w' : playerColor}
                    onPieceDrop={handlePieceDrop}
                    disabled={replayMatch !== null || ((activeMode === 'online' || activeMode === 'tournament') ? game.turn() !== playerColor || currentStatus !== 'IN_PROGRESS' : isAiThinking)}
                  />

                  {/* Card BẢN THÂN / QUÂN TRẮNG */}
                  <PlayerCard
                    isAi={false}
                    name={
                      replayMatch
                        ? replayMatch.whiteUsername
                        : activeMatch
                        ? myInfo?.username || 'Bạn'
                        : user
                        ? user.username
                        : 'Người chơi (Guest)'
                    }
                    subText={
                      replayMatch
                        ? `${replayMatch.isRated && replayMatch.whiteOldElo ? `Elo: ${replayMatch.whiteOldElo} • ` : ''}Quân Trắng`
                        : activeMatch
                        ? activeMatch.isRated
                          ? `Elo: ${user?.eloRating || myInfo?.eloRating || 1200} • ${playerColor === 'w' ? 'Cầm quân Trắng' : 'Cầm quân Đen'}`
                          : `Phòng Bạn Bè • ${playerColor === 'w' ? 'Cầm quân Trắng' : 'Cầm quân Đen'}`
                        : playerColor === 'w'
                        ? 'Cầm quân Trắng'
                        : 'Cầm quân Đen'
                    }
                    color={replayMatch ? 'w' : playerColor}
                    gameStatus={replayMatch ? 'GAME_OVER' : currentStatus}
                    timeLeftMs={playerColor === 'w' ? whiteDisplayTimeMs : blackDisplayTimeMs}
                    isClockActive={!replayMatch && currentStatus === 'IN_PROGRESS' && currentTurn === playerColor}
                  />

                  {/* THANH ĐIỀU KHIỂN XEM LẠI NƯỚC ĐI (REPLAY CONTROLS) */}
                  {replayMatch && (
                    <div className="w-full max-w-[480px] mt-2 p-2.5 bg-[#262421] rounded-2xl border border-[#312E2B] flex items-center justify-between shadow-xl">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => goToReplayMove(0)}
                          disabled={replayMoveIndex === 0}
                          className="p-2 rounded-xl bg-[#2F2D2A] hover:bg-[#3A3733] disabled:opacity-40 disabled:hover:bg-[#2F2D2A] text-white transition-all"
                          title="Về đầu ván"
                        >
                          <ChevronFirst className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => goToReplayMove(replayMoveIndex - 1)}
                          disabled={replayMoveIndex === 0}
                          className="p-2 rounded-xl bg-[#2F2D2A] hover:bg-[#3A3733] disabled:opacity-40 disabled:hover:bg-[#2F2D2A] text-white transition-all"
                          title="Nước trước"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-center">
                        <span className="font-mono font-bold text-xs text-pink-400">
                          Nước: {replayMoveIndex} / {replayMatch.moves.length}
                        </span>
                        <p className="text-[10px] text-[#8B8987]">
                          {replayMoveIndex === 0
                            ? 'Thế cờ bắt đầu'
                            : `Nước vừa đi: ${replayMatch.moves[replayMoveIndex - 1]}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => goToReplayMove(replayMoveIndex + 1)}
                          disabled={replayMoveIndex >= replayMatch.moves.length}
                          className="p-2 rounded-xl bg-[#2F2D2A] hover:bg-[#3A3733] disabled:opacity-40 disabled:hover:bg-[#2F2D2A] text-white transition-all"
                          title="Nước tiếp"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => goToReplayMove(replayMatch.moves.length)}
                          disabled={replayMoveIndex >= replayMatch.moves.length}
                          className="p-2 rounded-xl bg-[#2F2D2A] hover:bg-[#3A3733] disabled:opacity-40 disabled:hover:bg-[#2F2D2A] text-white transition-all"
                          title="Đến cuối ván"
                        >
                          <ChevronLast className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* THANH ĐIỀU HƯỚNG NHANH KHI ĐÓNG MODAL XEM BÀN CỜ */}
                  {!replayMatch && !isGameOverModalOpen && currentStatus !== 'IN_PROGRESS' && currentStatus !== 'IDLE' && (
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
                  {!replayMatch && (
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
                  )}
                </div>

                {/* Right Column (Desktop 4-5/12 Cols, Ẩn trên Mobile) */}
                <div className="hidden md:flex md:col-span-5 lg:col-span-4 flex-col gap-3 h-full max-h-[calc(100vh-40px)] justify-between">
                  <div className="flex flex-col gap-3 h-full justify-between">
                    
                    {/* Top Bar: Nút Rời Phòng / Thoát Xem lại */}
                    <div className="p-3 bg-[#262421] rounded-2xl border border-[#312E2B] flex items-center justify-between shadow-lg shrink-0 gap-2">
                      {replayMatch ? (
                        <button
                          onClick={() => {
                            setReplayMatch(null);
                            setActiveTab('history');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold transition-all shadow"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          <span>Quay lại Lịch sử</span>
                        </button>
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
                        </div>
                      )}

                      <span className="text-[11px] font-black text-pink-400 uppercase tracking-wider hidden sm:inline">
                        {replayMatch
                          ? `📜 XEM LẠI: ${replayMatch.whiteUsername} vs ${replayMatch.blackUsername}`
                          : activeMatch
                          ? activeMatch.isRated
                            ? '⚔️ ĐẤU XẾP HẠNG ONLINE (RATED)'
                            : '👥 ĐẤU BẠN BÈ (CUSTOM ROOM)'
                          : activeMode === 'bots'
                          ? '🤖 ĐÁNH VỚI MÁY'
                          : '👥 ĐẤU BẠN BÈ'}
                      </span>
                    </div>

                    {/* Controls / Info Box Desktop */}
                    <div className="p-4 bg-[#262421] rounded-2xl border border-[#312E2B] flex flex-col gap-3.5 shadow-xl shrink-0">
                      <div className="flex items-center justify-between border-b border-[#312E2B] pb-2">
                        <h2 className="font-bold text-xs text-white flex items-center gap-1.5">
                          <Cpu className="w-4 h-4 text-pink-400" />
                          {replayMatch ? 'Thông tin Ván đấu' : 'Cấu hình Trận đấu'}
                        </h2>
                        <span className="text-[10px] text-pink-400 font-semibold bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                          {replayMatch
                            ? replayMatch.isRated
                              ? '⚔️ Đấu Xếp Hạng (Rated)'
                              : '👥 Đấu Bạn Bè (Unrated)'
                            : activeMatch
                            ? activeMatch.isRated
                              ? 'Ghép trận Xếp hạng'
                              : 'Phòng Giao Hữu (Unrated)'
                            : 'Đấu với Máy (PvAI)'}
                        </span>
                      </div>

                      {replayMatch ? (
                        <div className="flex flex-col gap-2 text-xs">
                          {/* Bên Thắng & Bên Thua */}
                          <div className="flex items-center justify-between p-2 rounded-xl bg-[#1C1A17] border border-[#312E2B]">
                            <span className="text-[#8B8987]">Bên Thắng cuộc:</span>
                            <span className="font-bold text-emerald-400">
                              {replayMatch.winnerColor === 'w'
                                ? `⚪ ${replayMatch.whiteUsername}`
                                : replayMatch.winnerColor === 'b'
                                ? `⚫ ${replayMatch.blackUsername}`
                                : '🤝 Hòa cờ'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-xl bg-[#1C1A17] border border-[#312E2B]">
                            <span className="text-[#8B8987]">Bên Thất bại:</span>
                            <span className="font-bold text-rose-400">
                              {replayMatch.winnerColor === 'w'
                                ? `⚫ ${replayMatch.blackUsername}`
                                : replayMatch.winnerColor === 'b'
                                ? `⚪ ${replayMatch.whiteUsername}`
                                : 'Không có'}
                            </span>
                          </div>

                          {/* Chi tiết lý do Thắng / Thua */}
                          <div className="flex items-center justify-between p-2 rounded-xl bg-[#1C1A17] border border-[#312E2B]">
                            <span className="text-[#8B8987]">Lý do thắng/thua:</span>
                            <span className="font-bold text-amber-400">
                              {replayMatch.winnerColor === 'draw'
                                ? 'Hòa cờ (Stalemate / Insufficient)'
                                : replayMatch.endReason === 'CHECKMATE'
                                ? 'Chiếu hết Vua (Checkmate)'
                                : replayMatch.endReason === 'RESIGNED'
                                ? `${replayMatch.winnerColor === 'w' ? replayMatch.blackUsername : replayMatch.whiteUsername} Đầu hàng`
                                : replayMatch.endReason === 'TIMEOUT'
                                ? `${replayMatch.winnerColor === 'w' ? replayMatch.blackUsername : replayMatch.whiteUsername} Hết thời gian`
                                : replayMatch.endReason === 'ABANDONED'
                                ? `${replayMatch.winnerColor === 'w' ? replayMatch.blackUsername : replayMatch.whiteUsername} Rời trận (>45s)`
                                : 'Kết thúc ván cờ'}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="p-2 rounded-xl bg-[#1C1A17] border border-[#312E2B] text-center">
                              <p className="text-[10px] text-[#8B8987]">Nước đi</p>
                              <p className="font-mono font-bold text-white mt-0.5">{replayMatch.movesCount}</p>
                            </div>
                            <div className="p-2 rounded-xl bg-[#1C1A17] border border-[#312E2B] text-center">
                              <p className="text-[10px] text-[#8B8987]">Thời gian</p>
                              <p className="font-mono font-bold text-amber-400 mt-0.5">
                                {replayMatch.timeControl
                                  ? `${Math.round(replayMatch.timeControl.initialSeconds / 60)}+${replayMatch.timeControl.incrementSeconds}`
                                  : '10+0'}
                              </p>
                            </div>
                            <div className="p-2 rounded-xl bg-[#1C1A17] border border-[#312E2B] text-center">
                              <p className="text-[10px] text-[#8B8987]">Biến động Elo</p>
                              <p className="font-mono font-bold text-emerald-400 mt-0.5">
                                {replayMatch.isRated && replayMatch.whiteEloDelta !== undefined
                                  ? `±${Math.abs(replayMatch.whiteEloDelta)}`
                                  : 'Giao hữu'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>

                    {/* Move History Desktop */}
                    <MoveHistory
                      moveHistory={replayMatch ? replayMatch.moves.slice(0, replayMoveIndex) : moveHistory}
                      analysisByPly={replayMatch || !isLiveAnalysisEnabled ? undefined : analysisByPly}
                      selectedPly={replayMatch || !isLiveAnalysisEnabled ? null : selectedPly}
                      onSelectPly={setSelectedPly}
                      showLiveAnalysis={isLiveAnalysisEnabled}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB LEADERBOARD (BẢNG XẾP HẠNG THỰC TẾ TỪ MONGODB) */}
        {activeTab === 'leaderboard' && (
          <div className="w-full max-w-4xl mx-auto h-full overflow-hidden flex flex-col p-2 md:p-4">
            <div className="bg-[#262421] rounded-2xl border border-[#312E2B] p-4 md:p-6 flex flex-col h-full shadow-2xl">
              <div className="flex items-center gap-3 border-b border-[#312E2B] pb-3 md:pb-4 mb-3 md:mb-4">
                <Trophy className="w-6 h-6 md:w-7 md:h-7 text-amber-400" />
                <div>
                  <h2 className="text-base md:text-lg font-black text-white">Bảng Xếp Hạng Elo Quốc Tế</h2>
                  <p className="text-[11px] md:text-xs text-[#8B8987]">
                    Top cao thủ có điểm Elo cao nhất hệ thống Chess Online
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 md:pr-2">
                {isLeaderboardLoading ? (
                  <div className="flex items-center justify-center h-48 text-[#8B8987] text-xs">
                    Đang tải bảng xếp hạng từ máy chủ...
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(realLeaderboard.length > 0
                      ? realLeaderboard.map((player, idx) => ({
                          rank: idx + 1,
                          name: player.username,
                          elo: player.eloRating || 1200,
                          wins: player.wins || 0,
                          avatar: player.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${player.username}`,
                        }))
                      : [
                          { rank: 1, name: 'Magnus Carlsen', elo: 2882, wins: 450, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=magnus' },
                          { rank: 2, name: 'Hikaru Nakamura', elo: 2875, wins: 412, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=hikaru' },
                          { rank: 3, name: user?.username || 'Phan Hồng Sơn', elo: user?.eloRating || 1200, wins: 12, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=sonsamset' },
                        ]
                    ).map((player) => (
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
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB LỊCH SỬ ĐẤU (MATCH HISTORY TỪ MONGODB) */}
        {activeTab === 'history' && (
          <HistoryView
            currentUser={user}
            onSelectReplay={(matchRecord: MatchRecord) => {
              setReplayMatch(matchRecord);
              setActiveTab('play');
              setActiveMode(null);
              clearActiveMatch();
              setReplayMoveIndex(matchRecord.moves.length);
              setBoardFen(matchRecord.finalFen, matchRecord.moves);
              setLocalGameOverStatus(
                matchRecord.winnerColor === 'w'
                  ? 'WHITE_WIN'
                  : matchRecord.winnerColor === 'b'
                  ? 'BLACK_WIN'
                  : 'DRAW'
              );
              setCurrentEndReason(matchRecord.endReason);
              setCustomGameOverMsg(
                `Đang xem lại ván cờ: ${matchRecord.whiteUsername} vs ${matchRecord.blackUsername} (${matchRecord.movesCount} nước)`
              );
              setIsGameOverModalOpen(false);
            }}
            onOpenAnalysis={(matchRecord: MatchRecord) => handleStartAnalysis(matchRecord.moves)}
          />
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
        userElo={user?.eloRating || 1200}
        timeControlLabel="10+0 Rapid"
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

      {/* POPUP GIẢI ĐẤU (TOURNAMENT MODAL & BRACKET) */}
      <TournamentModal
        isOpen={isTournamentModalOpen}
        onClose={() => {
          setIsTournamentModalOpen(false);
          if (!activeMatch) {
            setActiveMode(null);
          }
          if (tournamentData?.status === 'FINISHED') {
            setTournamentData(null);
            setTournamentChampionId(null);
          }
        }}
        currentUserId={user?.id || user?.username}
        currentUsername={user?.username}
        currentUserElo={user?.eloRating}
        socket={socket}
        tournamentData={tournamentData}
        onTournamentUpdated={(t) => setTournamentData(t)}
      />

      {/* POPUP LỊCH SỬ NƯỚC ĐI TRÊN MOBILE */}
      <MoveHistoryModal
        isOpen={isMoveHistoryModalOpen}
        onClose={() => setIsMoveHistoryModalOpen(false)}
        moveHistory={moveHistory}
        analysisByPly={replayMatch || !isLiveAnalysisEnabled ? undefined : analysisByPly}
        selectedPly={replayMatch || !isLiveAnalysisEnabled ? null : selectedPly}
        onSelectPly={setSelectedPly}
        showLiveAnalysis={isLiveAnalysisEnabled}
      />

      {/* POPUP KẾT QUẢ KHI KẾT THÚC TRẬN ĐẤU */}
      <GameOverModal
        isOpen={isGameOverModalOpen && !replayMatch}
        gameStatus={currentStatus}
        playerColor={playerColor}
        isOnlineMatch={!!activeMatch}
        isRated={activeMatch?.isRated ?? false}
        endReason={currentEndReason}
        customMessage={customGameOverMsg}
        myEloResult={currentMatchEloResult}
        moveHistory={moveHistory}
        isTournamentMatch={activeMode === 'tournament' || !!activeMatch?.isTournament}
        isChampion={isTournamentChampion}
        onOpenAnalysis={() => handleStartAnalysis(moveHistory)}
        onViewBracket={() => {
          setIsGameOverModalOpen(false);
          setIsTournamentModalOpen(true);
        }}
        onPlayAgain={handlePlayAgain}
        onCloseToReview={() => setIsGameOverModalOpen(false)}
        onBackToMenu={() => {
          setLocalGameOverStatus(null);
          setCustomGameOverMsg(undefined);
          setCurrentEndReason(undefined);
          setCurrentMatchEloResult(null);
          setActiveMode(null);
          clearActiveMatch();
          resetGame();
          setIsGameOverModalOpen(false);
          if (tournamentData?.status === 'FINISHED') {
            setTournamentData(null);
            setTournamentChampionId(null);
          }
        }}
      />

      {/* GIAO DIỆN BÁO CÁO PHÂN TÍCH VÁN CỜ (REPORT VIEW) */}
      {analysisReport && (
        <GameReportView
          report={analysisReport}
          onClose={() => setAnalysisReport(null)}
          isTournament={activeMode === 'tournament'}
          onViewBracket={() => {
            setAnalysisReport(null);
            setIsTournamentModalOpen(true);
          }}
        />
      )}

      {/* OVERLAY TIẾN TRÌNH PHÂN TÍCH STOCKFISH */}
      {isReviewAnalyzing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in select-none">
          <div className="w-full max-w-sm bg-[#262421] border border-[#3A3733] rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin mb-4" />
            <h3 className="text-base font-black text-white mb-1">Đang Phân Tích Ván Đấu</h3>
            <p className="text-xs text-[#A8A6A4] mb-4">{analysisStatusText || 'Đang đánh giá các nước đi...'}</p>
            <div className="w-full bg-[#1C1A17] rounded-full h-2.5 overflow-hidden border border-[#3A3733] mb-3">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 transition-all duration-300"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
            <span className="text-xs font-mono font-bold text-indigo-400 mb-4">{analysisProgress}%</span>
            <button
              onClick={() => {
                analysisAbortControllerRef.current?.abort();
                setIsReviewAnalyzing(false);
              }}
              className="py-2 px-4 rounded-xl bg-[#312E2B] hover:bg-[#3B3835] text-xs font-bold text-[#BAB8B6] transition-colors"
            >
              Hủy phân tích
            </button>
          </div>
        </div>
      )}

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

      {/* POPUP THÔNG BÁO BỊ ĐĂNG XUẤT DO ĐĂNG NHẬP Ở NƠI KHÁC (SINGLE SESSION) */}
      {forceLogoutMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 select-none">
          <div className="w-full max-w-sm bg-[#262421] border border-amber-500/40 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-white mb-2">Phiên làm việc đã kết thúc</h3>
            <p className="text-xs text-[#BAB8B6] mb-5 leading-relaxed">
              {forceLogoutMessage}
            </p>
            <button
              onClick={clearForceLogoutMessage}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
