'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Sidebar, ActiveTab } from '../components/Sidebar';
import { GameModeSelection } from '../components/PlayMenu';
import { AuthModal } from '../components/AuthModal';
import { MatchmakingModal } from '../components/MatchmakingModal';
import { FriendRoomModal } from '../components/FriendRoomModal';
import { GameOverModal } from '../components/GameOverModal';
import { LeaveRoomModal } from '../components/LeaveRoomModal';
import { ResignModal } from '../components/ResignModal';
import { LogoutModal } from '../components/LogoutModal';
import { MoveHistoryModal } from '../components/MoveHistoryModal';
import { TournamentModal, TournamentData } from '../components/TournamentModal';
import { TournamentDetailModal } from '../components/TournamentDetailModal';
import { GameReportView } from '../components/GameReportView';
import { PromotionPiece } from '../components/PromotionModal';
import { MatchRecord } from '../components/HistoryView';

// Các Tab Components đã được tách theo kiến trúc module hóa
import { PlayTab } from '../components/tabs/PlayTab';
import { LearnTab } from '../components/tabs/LearnTab';
import { LeaderboardTab } from '../components/tabs/LeaderboardTab';
import { PuzzleTab } from '../components/tabs/PuzzleTab';
import { HistoryTab } from '../components/tabs/HistoryTab';
import { PlayerProfileTab } from '../components/PlayerProfileTab';

// Custom Hooks quản lý trạng thái
import { useModalState } from '../hooks/useModalState';
import { useGameOverFlow } from '../hooks/useGameOverFlow';
import { useChessEngine } from '../hooks/useChessEngine';
import { useSocket } from '../hooks/useSocket';
import { useLiveAnalysis } from '../hooks/useLiveAnalysis';

import { sounds } from '../utils/soundEffects';
import { getApiUrl } from '../utils/apiUrl';
import { AnalysisCacheService } from '../services/analysis/AnalysisCacheService';
import { AnalysisEngine } from '../services/analysis/AnalysisEngine';
import { GameReportService } from '../services/analysis/GameReportService';
import { MoveAnalysis, CompletedMoveAnalysis, GamePhase, GameAnalysisReport } from '../services/analysis/types';
import { Chess, Square } from 'chess.js';
import { Menu, Crown, ScrollText, Flag, ArrowLeft, AlertTriangle, Volume2, VolumeX, Trophy, X } from 'lucide-react';
import { calculateMaterialDetails } from '../utils/chessMaterial';

function buildReportFromLiveAnalysis(
  analysisMap: Record<number, MoveAnalysis>,
  moves: string[],
  matchId?: string
): GameAnalysisReport | null {
  if (!moves || moves.length === 0) return null;

  const completedMoves: CompletedMoveAnalysis[] = [];
  const clone = new Chess();

  for (let i = 0; i < moves.length; i++) {
    const ply = i + 1;
    const san = moves[i];
    const color: 'w' | 'b' = ply % 2 === 1 ? 'w' : 'b';
    const moveNumber = Math.floor(i / 2) + 1;
    const fenBefore = clone.fen();

    let from: Square = 'a1';
    let to: Square = 'a1';
    try {
      const moveRes = clone.move(san);
      if (moveRes) {
        from = moveRes.from;
        to = moveRes.to;
      }
    } catch {
      // ignore
    }
    const fenAfter = clone.fen();

    let phase: GamePhase = 'OPENING';
    if (moveNumber > 30) {
      phase = 'ENDGAME';
    } else if (moveNumber > 10) {
      phase = 'MIDDLEGAME';
    }

    const liveMove = analysisMap[ply];
    if (liveMove && liveMove.status === 'ANALYZED' && liveMove.classification && liveMove.cpl !== undefined) {
      completedMoves.push({
        ...liveMove,
        ply,
        moveNumber,
        color,
        san,
        from: liveMove.from || from,
        to: liveMove.to || to,
        fenBefore: liveMove.fenBefore || fenBefore,
        fenAfter: liveMove.fenAfter || fenAfter,
        evalBefore: liveMove.evalBefore ?? 0,
        evalAfter: liveMove.evalAfter ?? 0,
        cpl: liveMove.cpl,
        classification: liveMove.classification,
        accuracy: liveMove.accuracy ?? 100,
        phase: liveMove.phase || phase,
      });
    } else {
      const isCheckmate = san.includes('#');
      const cpl = isCheckmate ? 0 : 10;
      const classification = isCheckmate ? 'BEST' : 'GOOD';
      const accuracy = isCheckmate ? 100 : 90;
      const evalBefore = 0;
      const evalAfter = isCheckmate ? 10000 : 0;

      completedMoves.push({
        ply,
        moveNumber,
        color,
        san,
        from,
        to,
        fenBefore,
        fenAfter,
        bestMoveSan: san,
        bestMoveUci: '',
        evalBefore,
        evalAfter,
        cpl,
        classification,
        accuracy,
        phase,
        status: 'ANALYZED',
      });
    }
  }

  if (completedMoves.length === 0) return null;
  return GameReportService.generateReport(completedMoves, matchId);
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('play');
  const [activeMode, setActiveModeState] = useState<GameModeSelection | null>(null);

  const setActiveMode = useCallback((mode: GameModeSelection | null) => {
    setActiveModeState(mode);
    if (typeof window !== 'undefined') {
      if (mode) {
        localStorage.setItem('chess_active_mode', mode);
      } else {
        localStorage.removeItem('chess_active_mode');
      }
    }
  }, []);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ id?: string; username: string; eloRating: number; avatarUrl?: string; token: string } | null>(null);

  // Hook quản lý Modal tập trung (Modal State Machine)
  const {
    isAuthOpen,
    isLeaveModalOpen,
    isResignModalOpen,
    isFriendModalOpen,
    isTournamentModalOpen,
    isLogoutModalOpen,
    isGameOverModalOpen,
    isMoveHistoryModalOpen,
    setIsAuthOpen,
    setIsLeaveModalOpen,
    setIsResignModalOpen,
    setIsFriendModalOpen,
    setIsTournamentModalOpen,
    setIsLogoutModalOpen,
    setIsGameOverModalOpen,
    setIsMoveHistoryModalOpen,
  } = useModalState();

  // Hook quản lý Kết thúc ván & Phân tích Stockfish
  const {
    tournamentChampionId,
    setTournamentChampionId,
    analysisReport,
    setAnalysisReport,
    isReviewAnalyzing,
    setIsReviewAnalyzing,
    analysisProgress,
    analysisStatusText,
    customGameOverMsg,
    setCustomGameOverMsg,
    currentEndReason,
    setCurrentEndReason,
    localGameOverStatus,
    setLocalGameOverStatus,
    currentMatchEloResult,
    setCurrentMatchEloResult,
    analysisOriginTournamentId,
    setAnalysisOriginTournamentId,
    handleStartAnalysis,
    handleAbortAnalysis,
    triggerAutoAnalysis,
    resetGameOverState,
  } = useGameOverFlow(() => setIsGameOverModalOpen(false));

  // Trạng thái Giải đấu
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(null);
  const [selectedTournamentDetailId, setSelectedTournamentDetailId] = useState<string | null>(null);
  const [historySubTab, setHistorySubTab] = useState<'matches' | 'tournaments'>('matches');
  const [tournamentToast, setTournamentToast] = useState<{
    tournament: TournamentData;
    championId: string;
    championName: string;
  } | null>(null);

  useEffect(() => {
    if (!tournamentToast) return;
    const timer = setTimeout(() => {
      setTournamentToast(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [tournamentToast]);

  // Trạng thái Replay
  const [replayMatch, setReplayMatch] = useState<MatchRecord | null>(null);
  const [replayMoveIndex, setReplayMoveIndex] = useState<number>(0);
  const [replayOrigin, setReplayOrigin] = useState<{
    source: 'history' | 'tournament_detail' | 'game_over' | 'tournament_live';
    tournamentIdOrCode?: string;
    preferredColor?: 'w' | 'b';
  } | null>(null);
  const [progressiveReplayAnalysis, setProgressiveReplayAnalysis] = useState<Record<number, MoveAnalysis>>({});
  const [isReplayAnalyzing, setIsReplayAnalyzing] = useState<boolean>(false);
  const [replayAnalysisProgress, setReplayAnalysisProgress] = useState<{ current: number; total: number } | null>(null);
  const replayAbortRef = useRef<AbortController | null>(null);

  // Đếm ngược Reconnect
  const [reconnectCountdown, setReconnectCountdown] = useState<number>(45);

  // Ref ghi nhớ sự kiện kết thúc ván đã hiển thị, tránh mở lại liên tục khi người dùng bấm X hoặc Xem lại bàn cờ
  const processedGameOverRef = useRef<string | null>(null);

  // Trạng thái Âm thanh
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    setIsMuted(sounds.getMuted());
  }, []);

  const toggleMute = () => {
    const next = !isMuted;
    sounds.setMuted(next);
    setIsMuted(next);
  };

  // Bảng xếp hạng thật từ MongoDB
  const [realLeaderboard, setRealLeaderboard] = useState<any[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const prevStatusRef = useRef<string>('IN_PROGRESS');

  // Tải Bảng xếp hạng thật từ Backend MongoDB Atlas
  useEffect(() => {
    if (activeTab === 'leaderboard') {
      setIsLeaderboardLoading(true);
      const apiUrl = getApiUrl();
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
        const parsed = JSON.parse(savedUser);
        setUser({ ...parsed, token });

        const apiUrl = getApiUrl();
        fetch(`${apiUrl}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => res.json())
          .then((resData) => {
            if (resData.success && resData.data?.user) {
              const u = resData.data.user;
              setUser((prev) => {
                if (!prev) return null;
                const updated = {
                  ...prev,
                  username: u.username || prev.username,
                  avatarUrl: u.avatarUrl,
                  eloRating: u.eloRating ?? prev.eloRating,
                };
                localStorage.setItem('chess_user', JSON.stringify(updated));
                return updated;
              });
            }
          })
          .catch((err) => console.error('Lỗi đồng bộ profile:', err));
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
    isReconnectingMatch,
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
    shareMoveAnalysis,
    syncedAnalysis,
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

  // Tính toán Quân cờ bị ăn và Chênh lệch điểm số (Material Advantage)
  const materialDetails = useMemo(() => {
    return calculateMaterialDetails(fen || game.fen());
  }, [fen]);

  const currentStatus = !activeMode ? 'IDLE' : (localGameOverStatus || engineStatus);

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

  const handleExitReplay = () => {
    const origin = replayOrigin;
    replayAbortRef.current?.abort();
    replayAbortRef.current = null;
    setIsReplayAnalyzing(false);
    setReplayAnalysisProgress(null);
    setProgressiveReplayAnalysis({});
    setReplayMatch(null);
    setReplayMoveIndex(0);
    resetGameOverState();
    setIsGameOverModalOpen(false);

    if (origin?.source === 'tournament_detail' && origin.tournamentIdOrCode) {
      setSelectedTournamentDetailId(origin.tournamentIdOrCode);
      setHistorySubTab('tournaments');
      setActiveTab('history');
    } else if (origin?.source === 'tournament_live') {
      setActiveTab('play');
      setActiveMode('tournament');
      setIsTournamentModalOpen(true);
      clearActiveMatch();
    } else if (origin?.source === 'game_over') {
      setActiveTab('play');
      setActiveMode(null);
      clearActiveMatch();
    } else {
      setActiveTab('history');
      setHistorySubTab('matches');
    }
    setReplayOrigin(null);
  };

  // Bản đồ phân loại nước đi khi xem lại ván cờ (Tự động nạp từ Cache hoặc MongoDB, hoặc kết quả cấp tiến)
  const replayAnalysisByPly = useMemo(() => {
    if (!replayMatch) return undefined;
    const reportOrSummary = AnalysisCacheService.getValidAnalysis(
      replayMatch.analysis,
      replayMatch._id,
      replayMatch.moves
    );
    if (reportOrSummary) {
      const converted = AnalysisCacheService.convertToAnalysisByPly(reportOrSummary);
      if (Object.keys(converted).length > 0) {
        return converted;
      }
    }
    if (Object.keys(progressiveReplayAnalysis).length > 0) {
      return progressiveReplayAnalysis;
    }
    return undefined;
  }, [replayMatch, progressiveReplayAnalysis]);

  // Khóa định danh bất biến của ván cờ đang xem lại để tránh useEffect re-trigger không cần thiết
  const replayMatchKey = replayMatch
    ? replayMatch._id || AnalysisCacheService.getMovesKey(replayMatch.moves)
    : null;

  // Tự động phân tích ván cờ nếu đang xem lại mà chưa có dữ liệu đánh giá (Cấp tiến theo thời gian thực)
  useEffect(() => {
    if (!replayMatch || !replayMatch.moves || replayMatch.moves.length < 2) {
      setIsReplayAnalyzing(false);
      setReplayAnalysisProgress(null);
      setProgressiveReplayAnalysis({});
      return;
    }

    const existing = AnalysisCacheService.getValidAnalysis(
      replayMatch.analysis,
      replayMatch._id,
      replayMatch.moves
    );

    if (existing) {
      setIsReplayAnalyzing(false);
      setReplayAnalysisProgress(null);
      setProgressiveReplayAnalysis({});
      return;
    }

    // Kích hoạt phân tích nền cấp tiến với Stockfish Engine
    replayAbortRef.current?.abort();
    const controller = new AbortController();
    replayAbortRef.current = controller;
    setIsReplayAnalyzing(true);
    setReplayAnalysisProgress({ current: 0, total: replayMatch.moves.length });
    setProgressiveReplayAnalysis({});

    AnalysisEngine.analyzeGame(replayMatch.moves, {
      depth: 8,
      movetimeMs: 150,
      abortSignal: controller.signal,
      onMoveAnalyzed: (analyzedMove) => {
        setProgressiveReplayAnalysis((prev) => ({
          ...prev,
          [analyzedMove.ply]: {
            ...analyzedMove,
            status: 'ANALYZED',
          },
        }));
        setReplayAnalysisProgress({
          current: analyzedMove.ply,
          total: replayMatch.moves.length,
        });
      },
    })
      .then((report) => {
        AnalysisCacheService.saveCache(replayMatch._id, report, replayMatch.moves);
        if (replayMatch._id && !replayMatch._id.startsWith('local_') && !replayMatch._id.startsWith('game_')) {
          AnalysisCacheService.syncToBackend(replayMatch._id, report, user?.token);
        }
        setReplayMatch((prev) => (prev ? { ...prev, analysis: report } : null));
        setAnalysisReport(report);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError' && err?.message !== 'Analysis aborted') {
          console.warn('Lỗi phân tích ván cờ xem lại:', err);
        }
      })
      .finally(() => {
        setIsReplayAnalyzing(false);
        setReplayAnalysisProgress(null);
      });

    return () => {
      controller.abort();
    };
  }, [replayMatchKey, user?.token]);

  // TÍCH HỢP LIVE MOVE ANALYSIS (CHỈ KÍCH HOẠT KHI ĐẤU VỚI MÁY / BOTS THEO CHUẨN QUỐC TẾ)
  const isLiveAnalysisEnabled =
    activeTab === 'play' &&
    replayMatch === null &&
    activeMode === 'bots';

  const handleMoveAnalyzed = useCallback(
    (ply: number, analysis: any) => {
      // Khi đấu với máy, phân tích chỉ phục vụ hiển thị cục bộ cho người chơi
    },
    []
  );

  const {
    analysisByPly,
    selectedPly,
    setSelectedPly,
    enqueueMove,
    resetAnalysis,
    syncRemoteAnalysis,
    syncAllRemoteAnalyses,
  } = useLiveAnalysis({
    enabled: isLiveAnalysisEnabled,
    onMoveAnalyzed: handleMoveAnalyzed,
  });

  const processedPlyRef = useRef<number>(0);

  // Trigger phân tích Realtime sau mỗi nước cờ hợp lệ (Kèm Reconciliation tự động phục hồi nước cờ bị sót)
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

    if (currentPlies === 0) {
      processedPlyRef.current = 0;
      resetAnalysis();
      return;
    }

    // Tái tạo lại FEN từng nước và enqueue các nước chưa có kết quả phân tích
    const clone = new Chess();
    for (let p = 1; p <= currentPlies; p++) {
      const ply = p;
      const san = moveHistory[p - 1];
      const moveColor: 'w' | 'b' = ply % 2 === 1 ? 'w' : 'b';
      const fenBefore = clone.fen();
      try {
        clone.move(san);
      } catch {
        break;
      }
      const fenAfter = clone.fen();

      // Reconciliation: Chỉ enqueue nếu nước này chưa từng được phân tích hoặc bị FAILED (tránh trùng lặp khi PENDING)
      const existing = analysisByPly[ply];
      if (!existing || existing.status === 'FAILED') {
        enqueueMove({
          ply,
          fenBefore,
          fenAfter,
          moveSan: san,
          playerColor: moveColor,
        });
      }
    }

    processedPlyRef.current = currentPlies;
  }, [moveHistory, isLiveAnalysisEnabled, enqueueMove, resetAnalysis, analysisByPly]);

  // Đồng bộ phân tích nước đi tức thời từ đối thủ qua WebSocket trong phòng bạn bè
  useEffect(() => {
    if (syncedAnalysis && activeMatch && syncedAnalysis.roomId === activeMatch.roomId) {
      syncRemoteAnalysis(syncedAnalysis.ply, syncedAnalysis.analysis);
    }
  }, [syncedAnalysis, activeMatch, syncRemoteAnalysis]);

  // Phục hồi phân tích của các nước đi trước đó khi F5 / Reconnect vào phòng bạn bè
  useEffect(() => {
    if (activeMatch?.liveAnalyses && Object.keys(activeMatch.liveAnalyses).length > 0) {
      syncAllRemoteAnalyses(activeMatch.liveAnalyses);
    }
  }, [activeMatch, syncAllRemoteAnalyses]);

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
    const interval = setInterval(() => {
      const now = Date.now();
      const baseline = clockBaselineRef.current;
      const elapsed = Math.max(0, now - baseline.turnStartedAt);

      if (baseline.activeColor === 'w') {
        const remaining = Math.max(0, baseline.whiteBaseMs - elapsed);
        setWhiteDisplayTimeMs(remaining);
        if (isBotGame && remaining <= 0) {
          setLocalGameOverStatus('BLACK_WIN');
          setCurrentEndReason('TIMEOUT');
          setCustomGameOverMsg('Hết thời gian! Bên Trắng đã thua do hết giờ.');
          setIsGameOverModalOpen(true);
        }
      } else {
        const remaining = Math.max(0, baseline.blackBaseMs - elapsed);
        setBlackDisplayTimeMs(remaining);
        if (isBotGame && remaining <= 0) {
          setLocalGameOverStatus('WHITE_WIN');
          setCurrentEndReason('TIMEOUT');
          setCustomGameOverMsg('Hết thời gian! Bên Đen đã thua do hết giờ.');
          setIsGameOverModalOpen(true);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [currentStatus, isBotGame, setIsGameOverModalOpen, setCurrentEndReason, setCustomGameOverMsg, setLocalGameOverStatus]);

  // Đăng ký định danh Socket khi Đăng nhập hoặc Kết nối lại
  useEffect(() => {
    if (isConnected && user && user.token) {
      registerUser(user.token, user.id || user.username);
    }
  }, [isConnected, user, registerUser]);

  // Hủy đăng ký khi Đăng xuất
  useEffect(() => {
    if (!user) {
      unregisterUser();
    }
  }, [user, unregisterUser]);

  // Cố gắng khôi phục ván đấu dở dang (F5 Reconnect)
  const isInitialReconnectAttempted = useRef(false);
  useEffect(() => {
    if (isConnected && !activeMatch && !isInitialReconnectAttempted.current) {
      try {
        const savedMatch = localStorage.getItem('chess_active_online_match');
        if (savedMatch) {
          const { roomId, userId } = JSON.parse(savedMatch);
          if (roomId) {
            isInitialReconnectAttempted.current = true;
            const token = user?.token || (typeof window !== 'undefined' ? localStorage.getItem('chess_token') : null);
            reconnectMatch(roomId, token || undefined, userId);
          }
        }
      } catch (err) {
        console.error('Error recovering active match:', err);
      }
    }
  }, [isConnected, user, activeMatch, reconnectMatch]);

  // Khôi phục activeMode từ localStorage ngay khi Client Mount (giải quyết triệt để SSR F5)
  const isStateRestoredOnMountRef = useRef(false);
  useEffect(() => {
    if (isStateRestoredOnMountRef.current) return;
    isStateRestoredOnMountRef.current = true;

    try {
      const savedMode = localStorage.getItem('chess_active_mode');
      const savedMatch = localStorage.getItem('chess_active_online_match');
      const savedTournamentId = localStorage.getItem('chess_active_tournament_id');

      if (savedMatch) {
        try {
          const parsed = JSON.parse(savedMatch);
          const isTourney = Boolean(
            parsed.isTournament ||
            parsed.roomId?.startsWith('tournament_') ||
            parsed.roomId?.startsWith('room_armageddon_') ||
            savedTournamentId ||
            savedMode === 'tournament'
          );
          if (isTourney) {
            setActiveModeState('tournament');
          } else if (savedMode === 'friend') {
            setActiveModeState('friend');
          } else {
            setActiveModeState('online');
          }
        } catch {
          setActiveModeState(savedTournamentId ? 'tournament' : 'online');
        }
      } else if (savedTournamentId) {
        setActiveModeState('tournament');
        setIsTournamentModalOpen(true);
      } else if (savedMode === 'bots' || savedMode === 'online' || savedMode === 'friend' || savedMode === 'tournament') {
        setActiveModeState(savedMode as GameModeSelection);
      }
    } catch (err) {
      console.error('Lỗi khôi phục trạng thái từ localStorage:', err);
    }
  }, [setIsTournamentModalOpen]);

  // 1. LẮNG NGHE SỰ KIỆN GIẢI ĐẤU TỪ SOCKET.IO
  useEffect(() => {
    if (!socket) return;

    const handleTournamentUpdated = (data: { tournament: TournamentData }) => {
      setTournamentData(data.tournament);
    };

    const handleTournamentCancelled = (data: { tournamentId: string; message: string }) => {
      alert(data.message || 'Giải đấu đã bị hủy bởi chủ phòng.');
      setTournamentData(null);
      setIsTournamentModalOpen(false);
    };

    const handleTournamentFinished = (data: { tournament: TournamentData; championId: string }) => {
      setTournamentData(data.tournament);
      setTournamentChampionId(data.championId);

      // Nếu người chơi đã bị loại và chủ động rời giải về menu hoặc đang đấu chế độ khác, bỏ qua hoàn toàn thông báo
      if (activeMode !== 'tournament') {
        return;
      }

      setIsGameOverModalOpen(false);
      setIsTournamentModalOpen(true);
    };

    socket.on('tournament_updated', handleTournamentUpdated);
    socket.on('tournament_cancelled', handleTournamentCancelled);
    socket.on('tournament_finished', handleTournamentFinished);

    return () => {
      socket.off('tournament_updated', handleTournamentUpdated);
      socket.off('tournament_cancelled', handleTournamentCancelled);
      socket.off('tournament_finished', handleTournamentFinished);
    };
  }, [socket, activeMode, activeMatch, replayMatch, setIsTournamentModalOpen, setIsGameOverModalOpen, setTournamentChampionId]);

  // 2. LẮNG NGHE VÀO PHÒNG TRẬN ĐẤU MỚI (MATCH_FOUND)
  const currentActiveRoomIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeMatch) {
      if (currentActiveRoomIdRef.current === activeMatch.roomId) return;
      currentActiveRoomIdRef.current = activeMatch.roomId;
      setReplayMatch(null);
      setReplayOrigin(null);
      setIsFriendModalOpen(false);
      setIsTournamentModalOpen(false);
      const isTourneyMatch = Boolean(
        activeMatch.isTournament ||
        activeMatch.roomId?.startsWith('tournament_') ||
        activeMatch.roomId?.startsWith('room_armageddon_') ||
        activeMode === 'tournament' ||
        tournamentData ||
        (typeof window !== 'undefined' && localStorage.getItem('chess_active_tournament_id'))
      );
      if (isTourneyMatch) {
        setActiveMode('tournament');
      } else if (activeMatch.isRated === false) {
        setActiveMode('friend');
      } else {
        setActiveMode('online');
      }
      processedGameOverRef.current = null;
      resetGameOverState();
      // Ưu tiên lịch sử nước đi nếu đối thủ đã đi trước khi phòng mount xong
      const initialHistory =
        activeMatch.history && activeMatch.history.length > 0
          ? activeMatch.history
          : latestMove?.history && latestMove.history.length > 0
          ? latestMove.history
          : moveHistory.length > 0
          ? moveHistory
          : [];

      if (initialHistory.length === 0) {
        resetAnalysis();
        processedPlyRef.current = 0;
      }

      const myColor = activeMatch.yourColor || 'w';
      setPlayerColor(myColor);
      const initialFen = (latestMove && latestMove.history?.length === initialHistory.length) ? latestMove.fen : activeMatch.fen;
      setBoardFen(initialFen, initialHistory);
      sounds.playGameStart();

      try {
        const myUserId = (myColor === 'w' ? activeMatch.whitePlayer.userId : activeMatch.blackPlayer.userId);
        localStorage.setItem(
          'chess_active_online_match',
          JSON.stringify({
            roomId: activeMatch.roomId,
            userId: myUserId,
            isTournament: isTourneyMatch,
          })
        );
      } catch (err) {
        console.error('Error saving active online match to localStorage:', err);
      }
    } else if (!activeMatch) {
      currentActiveRoomIdRef.current = null;
    }
  }, [activeMatch, activeMode, setIsFriendModalOpen, setIsTournamentModalOpen, setIsGameOverModalOpen, resetGameOverState, setPlayerColor, setBoardFen, resetAnalysis]);

  // 3. LẮNG NGHE SỰ KIỆN ĐỐI THỦ ĐẦU HÀNG, F5 HOẶC HẾT GIỜ (TIMEOUT)
  useEffect(() => {
    if (replayMatch) return; // F-01 Fix: Không can thiệp hoặc mở GameOverModal khi đang xem lại ván cờ (Replay)
    if (resignationEvent) {
      const eventKey = `${resignationEvent.roomId}_${resignationEvent.reason}_${resignationEvent.winnerColor}`;
      if (processedGameOverRef.current === eventKey) return;
      processedGameOverRef.current = eventKey;

      localStorage.removeItem('chess_active_online_match');
      setIsResignModalOpen(false);
      setIsLeaveModalOpen(false);
      setIsLogoutModalOpen(false);
      setIsGameOverModalOpen(true);

      const isMeWin = resignationEvent.winnerColor === playerColor;
      if (resignationEvent.reason === 'TIMEOUT') {
        setCurrentEndReason('TIMEOUT');
        setLocalGameOverStatus(resignationEvent.winnerColor === 'w' ? 'WHITE_WIN' : 'BLACK_WIN');
        setCustomGameOverMsg(
          isMeWin
            ? (resignationEvent.message || 'Đối thủ đã hết thời gian thi đấu. Bạn thắng!')
            : 'Bạn đã hết thời gian thi đấu. Bạn thua!'
        );
      } else {
        setCurrentEndReason(resignationEvent.reason === 'DISCONNECT' ? 'ABANDONED' : 'RESIGNED');
        setLocalGameOverStatus(resignationEvent.winnerColor === 'w' ? 'WHITE_WIN' : 'BLACK_WIN');
        setCustomGameOverMsg(
          isMeWin
            ? (resignationEvent.message || 'Đối thủ đã rời trận hoặc đầu hàng. Bạn thắng!')
            : (resignationEvent.reason === 'DISCONNECT' ? 'Bạn đã ngắt kết nối quá lâu và bị xử thua.' : 'Bạn đã đầu hàng.')
        );
      }

      if (resignationEvent.eloResult) {
        const myElo = playerColor === 'w' ? resignationEvent.eloResult.white : resignationEvent.eloResult.black;
        setCurrentMatchEloResult(myElo);
        setUser((prev) => {
          if (!prev) return null;
          const updated = { ...prev, eloRating: myElo.newElo };
          localStorage.setItem('chess_user', JSON.stringify(updated));
          return updated;
        });
      }

      // Tự động phân tích ván đấu ở chế độ nền
      if (moveHistory.length >= 2) {
        triggerAutoAnalysis(resignationEvent.matchId || resignationEvent.roomId, moveHistory, user?.token);
      }
    }
  }, [replayMatch, resignationEvent, playerColor, moveHistory, user?.token, triggerAutoAnalysis, setIsResignModalOpen, setIsLeaveModalOpen, setIsLogoutModalOpen, setIsGameOverModalOpen, setCurrentEndReason, setLocalGameOverStatus, setCustomGameOverMsg, setCurrentMatchEloResult]);

  // 4. LẮNG NGHE ĐỐI THỦ MẤT KẾT NỐI (GRACE PERIOD 45S)
  useEffect(() => {
    if (!disconnectedOpponent) {
      setReconnectCountdown(45);
      return;
    }

    setReconnectCountdown(disconnectedOpponent.gracePeriodSeconds || 45);
    const timer = setInterval(() => {
      setReconnectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [disconnectedOpponent]);

  // Âm thanh Kết thúc trận đấu
  useEffect(() => {
    if (replayMatch) return;
    if (prevStatusRef.current === 'IN_PROGRESS' && currentStatus !== 'IN_PROGRESS' && currentStatus !== 'IDLE') {
      if (currentStatus === 'DRAW') {
        sounds.playGameEndDraw();
      } else {
        const isMeWin = (currentStatus === 'WHITE_WIN' && playerColor === 'w') ||
                        (currentStatus === 'BLACK_WIN' && playerColor === 'b');
        if (isMeWin) {
          sounds.playGameEndWin();
        } else {
          sounds.playGameEndLose();
        }
      }

      // Tự động phân tích ván đấu với Bot (tái sử dụng ngay dữ liệu phân tích từng nước trong trận)
      if (activeMode === 'bots' && moveHistory.length >= 2) {
        const botReport = buildReportFromLiveAnalysis(analysisByPly, moveHistory);
        if (botReport) {
          AnalysisCacheService.saveCache(null, botReport, moveHistory);
        } else {
          triggerAutoAnalysis('local_bot_' + Date.now(), moveHistory);
        }
      }
    }
    prevStatusRef.current = currentStatus;
  }, [currentStatus, playerColor, replayMatch, activeMode, moveHistory, triggerAutoAnalysis, analysisByPly]);

  // 5. Đồng bộ nước đi mới từ WebSocket Realtime & Cập nhật kết thúc trận (Checkmate / Draw)
  useEffect(() => {
    if (replayMatch) return; // Không can thiệp bàn cờ khi đang ở chế độ Xem lại (Replay)
    if (latestMove && (activeMode === 'online' || activeMode === 'tournament' || activeMode === 'friend' || Boolean(activeMatch))) {
      if (latestMove.fen !== fen || latestMove.history?.length !== moveHistory.length) {
        setBoardFen(latestMove.fen, latestMove.history);
      }

      if (latestMove.isGameOver) {
        const moveEndKey = `${activeMatch?.roomId || 'game'}_${latestMove.fen}_${latestMove.winnerColor || 'draw'}`;
        if (processedGameOverRef.current === moveEndKey) return;
        processedGameOverRef.current = moveEndKey;

        localStorage.removeItem('chess_active_online_match');
        setIsResignModalOpen(false);
        setIsLeaveModalOpen(false);
        setIsLogoutModalOpen(false);
        setIsGameOverModalOpen(true);
        if (latestMove.isCheckmate) {
          setCurrentEndReason('CHECKMATE');
          const winningStatus = latestMove.winnerColor === 'w' ? 'WHITE_WIN' : 'BLACK_WIN';
          setLocalGameOverStatus(winningStatus);
          const isMeWin = latestMove.winnerColor === playerColor;
          setCustomGameOverMsg(
            isMeWin
              ? 'Bạn đã chiếu hết Vua của đối thủ. Bạn thắng!'
              : 'Bạn đã bị đối thủ chiếu hết. Bạn thua!'
          );
        } else if (latestMove.isDraw) {
          setCurrentEndReason('DRAW');
          if (latestMove.isArmageddonDraw || latestMove.armageddonWinnerColor === 'b') {
            setLocalGameOverStatus('BLACK_WIN');
            const isMeBlack = playerColor === 'b';
            setCustomGameOverMsg(
              isMeBlack
                ? 'Ván cờ kết thúc hòa. Bên Đen giành chiến thắng theo điều lệ ván phụ.'
                : 'Ván cờ kết thúc hòa. Bên Đen giành chiến thắng theo điều lệ ván phụ.'
            );
          } else {
            setLocalGameOverStatus('DRAW');
            setCustomGameOverMsg('Ván cờ kết thúc với kết quả hòa.');
          }
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

        // Tự động phân tích ván đấu ở chế độ nền
        const fullHistory = latestMove.history || moveHistory;
        if (fullHistory && fullHistory.length >= 2) {
          triggerAutoAnalysis(latestMove.matchId || activeMatch?.matchId || activeMatch?.roomId || 'game_' + Date.now(), fullHistory, user?.token);
        }
      }
    }
  }, [replayMatch, latestMove, activeMode, activeMatch?.roomId, playerColor, fen, moveHistory, user?.token, triggerAutoAnalysis, setBoardFen, setIsResignModalOpen, setIsLeaveModalOpen, setIsLogoutModalOpen, setIsGameOverModalOpen, setCurrentEndReason, setLocalGameOverStatus, setCustomGameOverMsg, setCurrentMatchEloResult]);

  // Xử lý chọn Chế độ chơi từ PlayMenu (RÀNG BUỘC ĐĂNG NHẬP CHO ĐẤU TRỰC TUYẾN)
  const handleSelectMode = (mode: GameModeSelection) => {
    resetGameOverState();
    setIsGameOverModalOpen(false);

    if (mode === 'online') {
      if (!user) {
        setIsAuthOpen(true);
        return;
      }

      if (user.token) {
        registerUser(user.token, user.id || user.username);
      }

      joinQueue({
        userId: user.id || user.username,
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
    resetGame({ autoTriggerAi: mode === 'bots' });
    sounds.playGameStart();
  };

  // Tạo phòng bạn bè
  const handleCreateFriendRoom = () => {
    createFriendRoom({
      userId: user ? (user.id || user.username) : `guest_host_${Math.floor(Math.random() * 1000)}`,
      username: user ? user.username : 'Chủ phòng',
      eloRating: user ? user.eloRating : 1200,
    });
  };

  // Nhập mã phòng tham gia
  const handleJoinFriendRoom = (code: string) => {
    joinFriendRoom(code, {
      userId: user ? (user.id || user.username) : `guest_join_${Math.floor(Math.random() * 1000)}`,
      username: user ? user.username : 'Khách',
      eloRating: user ? user.eloRating : 1200,
    });
  };

  // Xử lý thả quân cờ
  const handlePieceDrop = (from: Square, to: Square, promotion: PromotionPiece = 'q'): boolean => {
    if (activeMatch) {
      if (!isConnected) return false;
      const isMyTurn = game.turn() === playerColor;
      if (!isMyTurn || game.isGameOver() || currentStatus !== 'IN_PROGRESS') return false;

      try {
        const testGame = new Chess(game.fen());
        const move = testGame.move({ from, to, promotion });
        if (move) {
          setBoardFen(testGame.fen(), [...moveHistory, move.san]);
          sendMove(activeMatch.roomId, from, to, promotion);
          return true;
        }
      } catch (err) {
        return false;
      }
      return false;
    }

    if (activeMode === 'friend' && !activeMatch) {
      return false;
    }

    return makePlayerMove(from, to, promotion);
  };

  const handleLogout = () => {
    if (activeMatch && currentStatus === 'IN_PROGRESS') {
      resignMatch(activeMatch.roomId);
    }

    if (isSearchingQueue) {
      leaveQueue();
    }

    if (createdRoomCode) {
      cancelFriendRoom();
    }

    localStorage.removeItem('chess_token');
    localStorage.removeItem('chess_user');
    localStorage.removeItem('chess_active_online_match');
    localStorage.removeItem('chess_active_mode');
    localStorage.removeItem('chess_bot_game');
    localStorage.removeItem('chess_active_tournament_id');
    setUser(null);
    setActiveMode(null);
    clearActiveMatch();
    resetGame();
    resetGameOverState();
    setIsGameOverModalOpen(false);
  };

  const handleConfirmLogout = () => {
    handleLogout();
    setIsLogoutModalOpen(false);
  };

  const handleConfirmLeaveRoom = () => {
    if (activeMatch && currentStatus === 'IN_PROGRESS') {
      resignMatch(activeMatch.roomId);
    }
    if (isSearchingQueue) {
      leaveQueue();
    }
    if (createdRoomCode) {
      cancelFriendRoom();
    }
    localStorage.removeItem('chess_active_online_match');
    localStorage.removeItem('chess_active_mode');
    localStorage.removeItem('chess_bot_game');
    clearActiveMatch();
    setActiveMode(null);
    resetGame();
    setIsLeaveModalOpen(false);
    resetGameOverState();
    setIsGameOverModalOpen(false);
  };

  const handleConfirmResign = () => {
    if (activeMatch && currentStatus === 'IN_PROGRESS') {
      resignMatch(activeMatch.roomId);
    }
    setIsResignModalOpen(false);
    if (activeMode === 'bots') {
      setLocalGameOverStatus(playerColor === 'w' ? 'BLACK_WIN' : 'WHITE_WIN');
      setCurrentEndReason('RESIGNED');
      setCustomGameOverMsg('Bạn đã chấp nhận đầu hàng trước máy tính.');
      setIsGameOverModalOpen(true);
    }
  };

  const handlePlayAgain = () => {
    resetGameOverState();
    setIsGameOverModalOpen(false);
    processedGameOverRef.current = null;

    if (activeMode === 'bots') {
      resetAnalysis();
      resetGame({ autoTriggerAi: true });
    } else if (activeMode === 'friend' || (activeMatch && !activeMatch.isRated && !activeMatch.isTournament)) {
      clearActiveMatch();
      setActiveMode('friend');
      setIsFriendModalOpen(true);
      resetGame();
    } else if (activeMode === 'online') {
      clearActiveMatch();
      if (user) {
        if (user.token) {
          registerUser(user.token, user.id || user.username);
        }
        joinQueue({
          userId: user.id || user.username,
          username: user.username,
          eloRating: user.eloRating || 1200,
        });
      }
    }
  };

  const handleToggleBotColor = () => {
    resetGameOverState();
    setIsGameOverModalOpen(false);
    processedGameOverRef.current = null;
    togglePlayerColor();
  };

  const handleBackToMenu = () => {
    resetGameOverState();
    setActiveMode(null);
    clearActiveMatch();
    resetGame();
    setIsGameOverModalOpen(false);
    processedGameOverRef.current = null;
    localStorage.removeItem('chess_active_online_match');
    localStorage.removeItem('chess_active_mode');
    localStorage.removeItem('chess_bot_game');
    if (tournamentData?.status === 'FINISHED') {
      setTournamentData(null);
      setTournamentChampionId(null);
      localStorage.removeItem('chess_active_tournament_id');
    }
  };

  const opponentInfo = activeMatch
    ? playerColor === 'w'
      ? activeMatch.blackPlayer
      : activeMatch.whitePlayer
    : null;

  const myInfo = activeMatch
    ? playerColor === 'w'
      ? activeMatch.whitePlayer
      : activeMatch.blackPlayer
    : null;

  const isTournamentChampion =
    (activeMode === 'tournament' || Boolean(activeMatch?.isTournament)) &&
    (tournamentChampionId !== null || tournamentData?.status === 'FINISHED') &&
    (tournamentChampionId === user?.id ||
      tournamentChampionId === user?.username ||
      tournamentData?.championId === user?.id ||
      tournamentData?.championId === user?.username ||
      (Boolean(user?.username) &&
        tournamentData?.players?.find((p) => p.userId === (tournamentChampionId || tournamentData?.championId))?.username === user?.username));

  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-[#0B0F19] text-[#E2E8F0] flex select-none">
      {/* Sidebar Điều Hướng */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab: ActiveTab) => {
          if (activeMatch && currentStatus === 'IN_PROGRESS') {
            setIsLeaveModalOpen(true);
            return;
          }
          setActiveTab(tab);
        }}
        user={user}
        onOpenAuthModal={() => setIsAuthOpen(true)}
        onLogout={() => setIsLogoutModalOpen(true)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main View Area */}
      <main className={`flex-1 h-full flex flex-col p-1.5 sm:p-2 md:p-4 bg-radial-glow ${replayMatch ? 'overflow-y-auto' : 'overflow-y-auto md:overflow-hidden'}`}>
        {/* TOP HEADER BAR CHO MOBILE (< md) */}
        <header className="md:hidden flex items-center justify-between p-2 sm:p-2.5 bg-[#16202E] rounded-2xl border border-[#2A374A] mb-1.5 shadow-lg shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 rounded-xl bg-[#1E293B] text-white hover:bg-[#2A374A] border border-[#334155] transition-colors active:scale-95"
              title="Menu Điều Hướng"
            >
              <Menu className="w-5 h-5 text-pink-400" />
            </button>
            <div className="flex items-center gap-1.5 font-black text-sm text-white">
              <Crown className="w-4 h-4 text-pink-500 fill-pink-500/20" />
              <span>Chess Online</span>
            </div>
          </div>

          {/* Cụm nút thao tác trên Mobile */}
          {replayMatch && activeTab === 'play' ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExitReplay}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold transition-all active:scale-95 shadow"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>
                  {replayOrigin?.source === 'tournament_detail'
                    ? 'Về Sơ đồ'
                    : replayOrigin?.source === 'game_over'
                    ? 'Về menu'
                    : 'Về lịch sử'}
                </span>
              </button>
            </div>
          ) : (activeMode || activeMatch) && activeTab === 'play' ? (
            <div className="flex items-center gap-1">
              <button
                onClick={toggleMute}
                className="p-1.5 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-all active:scale-95"
                title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
              </button>

              <button
                onClick={() => setIsMoveHistoryModalOpen(true)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/30 text-xs font-bold transition-all active:scale-95"
                title="Xem Lịch sử nước đi"
              >
                <ScrollText className="w-3.5 h-3.5" />
                <span className="font-mono text-[11px]">({moveHistory.length})</span>
              </button>

              <button
                onClick={() => setIsResignModalOpen(true)}
                className="p-1.5 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all active:scale-95"
                title="Đầu hàng"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsLeaveModalOpen(true)}
                className="p-1.5 px-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all active:scale-95"
                title="Rời phòng"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleMute}
                className="p-1.5 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-all active:scale-95"
                title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
            </div>
          )}
        </header>

        {/* 1. TAB CHƠI CỜ (PLAY) */}
        {activeTab === 'play' && (
          <PlayTab
            activeMode={activeMode}
            activeMatch={activeMatch}
            isReconnectingMatch={isReconnectingMatch}
            replayMatch={replayMatch}
            replayMoveIndex={replayMoveIndex}
            replayOrigin={replayOrigin}
            disconnectedOpponent={disconnectedOpponent}
            reconnectCountdown={reconnectCountdown}
            opponentInfo={opponentInfo}
            myInfo={myInfo}
            user={user}
            game={game}
            fen={fen}
            playerColor={playerColor}
            materialDetails={materialDetails}
            currentStatus={currentStatus}
            currentTurn={currentTurn}
            whiteDisplayTimeMs={whiteDisplayTimeMs}
            blackDisplayTimeMs={blackDisplayTimeMs}
            difficulty={difficulty}
            isAiThinking={isAiThinking}
            isMuted={isMuted}
            moveHistory={moveHistory}
            analysisByPly={replayMatch || !isLiveAnalysisEnabled ? undefined : analysisByPly}
            selectedPly={replayMatch || !isLiveAnalysisEnabled ? null : selectedPly}
            isLiveAnalysisEnabled={isLiveAnalysisEnabled}
            isGameOverModalOpen={isGameOverModalOpen}
            onSelectMode={handleSelectMode}
            handlePieceDrop={handlePieceDrop}
            handleExitReplay={handleExitReplay}
            goToReplayMove={goToReplayMove}
            handlePlayAgain={handlePlayAgain}
            handleBackToMenu={handleBackToMenu}
            tournamentData={tournamentData}
            onExitTournament={handleBackToMenu}
            setDifficulty={setDifficulty}
            resetGame={resetGame}
            togglePlayerColor={handleToggleBotColor}
            toggleMute={toggleMute}
            setIsGameOverModalOpen={setIsGameOverModalOpen}
            setIsTournamentModalOpen={setIsTournamentModalOpen}
            setIsFriendModalOpen={setIsFriendModalOpen}
            setIsLeaveModalOpen={setIsLeaveModalOpen}
            setIsResignModalOpen={setIsResignModalOpen}
            setSelectedPly={setSelectedPly}
            replayAnalysisByPly={replayAnalysisByPly}
            isReplayAnalyzing={isReplayAnalyzing}
            replayAnalysisProgress={replayAnalysisProgress}
            analysisReport={replayMatch ? (AnalysisCacheService.getCache(replayMatch._id, replayMatch.moves) || analysisReport) : analysisReport}
            onOpenAnalysisReport={() => {
              if (!replayMatch) return;
              const cached = AnalysisCacheService.getCache(replayMatch._id, replayMatch.moves);
              if (cached) {
                setAnalysisReport(cached);
              } else {
                handleStartAnalysis(replayMatch.moves, replayMatch._id, user?.token);
              }
            }}
          />
        )}

        {/* 2. TAB BẢNG XẾP HẠNG (LEADERBOARD) */}
        {activeTab === 'leaderboard' && (
          <LeaderboardTab
            user={user}
            realLeaderboard={realLeaderboard}
            isLoading={isLeaderboardLoading}
          />
        )}

        {/* 3. TAB LỊCH SỬ ĐẤU (MATCH HISTORY) */}
        {activeTab === 'history' && (
          <HistoryTab
            currentUser={user}
            initialSubTab={historySubTab}
            onSelectReplay={(matchRecord: MatchRecord) => {
              const cachedAnalysis = AnalysisCacheService.getValidAnalysis(matchRecord.analysis, matchRecord._id, matchRecord.moves);
              const matchToReplay = cachedAnalysis ? { ...matchRecord, analysis: cachedAnalysis as any } : matchRecord;
              const isMyBlack = (user?.id && matchRecord.blackUserId === user.id) ||
                                (user?.username && matchRecord.blackUsername === user.username);
              setReplayOrigin({ source: 'history', preferredColor: isMyBlack ? 'b' : 'w' });
              setHistorySubTab('matches');
              setReplayMatch(matchToReplay);
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
            onOpenAnalysis={(matchRecord: MatchRecord) => handleStartAnalysis(matchRecord.moves, matchRecord._id, user?.token)}
            onOpenTournamentDetail={(idOrCode: string) => setSelectedTournamentDetailId(idOrCode)}
            onOpenTournamentModal={() => setIsTournamentModalOpen(true)}
            onOpenAuthModal={() => setIsAuthOpen(true)}
          />
        )}

        {/* 4. TAB GIẢI THẾ CỜ (CHESS PUZZLES) */}
        {activeTab === 'puzzles' && <PuzzleTab />}

        {/* 5. TAB HỌC CỜ (CHESS LESSONS) */}
        {activeTab === 'learn' && <LearnTab />}

        {/* 6. TAB PHONG CÁCH & HỌC MÁY (ML BEHAVIORAL PROFILE) */}
        {activeTab === 'profile' && (
          <PlayerProfileTab
            user={user}
            onOpenAuthModal={() => setIsAuthOpen(true)}
            onSelectTab={setActiveTab}
          />
        )}
      </main>

      {/* POPUP ĐĂNG NHẬP / ĐĂNG KÝ */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccessLogin={(userData) => setUser(userData)}
      />

      {/* MODAL HÀNG CHỜ TÌM TRẬN ĐẤU XẾP HẠNG */}
      <MatchmakingModal
        isOpen={isSearchingQueue}
        onCancel={leaveQueue}
        userElo={user?.eloRating || 1200}
        timeControlLabel="10+0 Rapid"
      />

      {/* MODAL PHÒNG THI ĐẤU BẠN BÈ */}
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
          if (tournamentData?.status === 'FINISHED') {
            setTournamentData(null);
            setTournamentChampionId(null);
            localStorage.removeItem('chess_active_tournament_id');
            setActiveMode(null);
          }
        }}
        currentUserId={user?.id || user?.username}
        currentUsername={user?.username}
        currentUserElo={user?.eloRating}
        socket={socket}
        tournamentData={tournamentData}
        onTournamentUpdated={(t) => setTournamentData(t)}
      />

      {/* MODAL CHI TIẾT GIẢI ĐẤU */}
      <TournamentDetailModal
        isOpen={Boolean(selectedTournamentDetailId)}
        onClose={() => setSelectedTournamentDetailId(null)}
        tournamentIdOrCode={selectedTournamentDetailId}
        currentUserId={user?.id}
        token={user?.token}
        onSelectReplayMatch={(matchRecord) => {
          setSelectedTournamentDetailId(null);
          const isMyBlack = (user?.id && matchRecord.blackUserId === user.id) ||
                            (user?.username && matchRecord.blackUsername === user.username);
          setReplayOrigin({
            source: 'tournament_detail',
            tournamentIdOrCode: selectedTournamentDetailId || undefined,
            preferredColor: isMyBlack ? 'b' : 'w',
          });
          setReplayMatch(matchRecord);
          setActiveTab('play');
          setActiveMode(null);
          clearActiveMatch();
          setReplayMoveIndex(matchRecord.moves?.length || 0);
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
            `Đang xem lại ván cờ giải: ${matchRecord.whiteUsername} vs ${matchRecord.blackUsername}`
          );
          setIsGameOverModalOpen(false);
        }}
        onAnalyzeMatch={(moves) => {
          setAnalysisOriginTournamentId(selectedTournamentDetailId);
          setSelectedTournamentDetailId(null);
          handleStartAnalysis(moves);
        }}
      />

      {/* POPUP LỊCH SỬ NƯỚC ĐI TRÊN MOBILE */}
      <MoveHistoryModal
        isOpen={isMoveHistoryModalOpen}
        onClose={() => setIsMoveHistoryModalOpen(false)}
        moveHistory={replayMatch ? replayMatch.moves : moveHistory}
        analysisByPly={replayMatch ? replayAnalysisByPly : (isLiveAnalysisEnabled ? analysisByPly : undefined)}
        selectedPly={replayMatch ? replayMoveIndex : selectedPly}
        onSelectPly={replayMatch ? (ply) => { if (ply !== null) goToReplayMove(ply); } : setSelectedPly}
        showLiveAnalysis={isLiveAnalysisEnabled}
      />

      {/* POPUP KẾT QUẢ KHI KẾT THÚC TRẬN ĐẤU */}
      {(() => {
        const isCurrentTournamentMatch = Boolean(
          activeMode === 'tournament' ||
          activeMatch?.isTournament ||
          activeMatch?.roomId?.startsWith('tournament_') ||
          activeMatch?.roomId?.startsWith('room_armageddon_') ||
          resignationEvent?.isTournament ||
          resignationEvent?.roomId?.startsWith('tournament_') ||
          resignationEvent?.roomId?.startsWith('room_armageddon_') ||
          latestMove?.isTournament ||
          latestMove?.roomId?.startsWith('tournament_') ||
          tournamentData ||
          (typeof window !== 'undefined' && localStorage.getItem('chess_active_tournament_id'))
        );

        return (
          <GameOverModal
            isOpen={isGameOverModalOpen && !replayMatch}
            gameStatus={currentStatus}
            playerColor={playerColor}
            isOnlineMatch={Boolean(activeMatch)}
            isRated={isCurrentTournamentMatch ? false : (activeMatch?.isRated ?? false)}
            endReason={currentEndReason}
            customMessage={customGameOverMsg}
            myEloResult={currentMatchEloResult}
            moveHistory={moveHistory}
            isTournamentMatch={isCurrentTournamentMatch}
            isChampion={isTournamentChampion}
            onOpenAnalysis={() => handleStartAnalysis(moveHistory, activeMatch?.roomId || 'local_' + Date.now(), user?.token)}
            onViewBracket={() => {
              setIsGameOverModalOpen(false);
              if (isCurrentTournamentMatch) {
                clearActiveMatch();
                currentActiveRoomIdRef.current = null;
                localStorage.removeItem('chess_active_online_match');
              }
              setIsTournamentModalOpen(true);
            }}
            onPlayAgain={handlePlayAgain}
            onCloseToReview={() => {
              setIsGameOverModalOpen(false);
              if (moveHistory && moveHistory.length > 0) {
                const matchId = activeMatch?.roomId || resignationEvent?.roomId || latestMove?.roomId || 'local_' + Date.now();
                let cachedAnalysis = AnalysisCacheService.getValidAnalysis(undefined, matchId, moveHistory);
                if (!cachedAnalysis && Object.keys(analysisByPly).length > 0) {
                  cachedAnalysis = buildReportFromLiveAnalysis(analysisByPly, moveHistory, matchId);
                  if (cachedAnalysis) {
                    AnalysisCacheService.saveCache(matchId, cachedAnalysis, moveHistory);
                  }
                }
                const isWhite = playerColor === 'w';
                const userElo = user?.eloRating || myInfo?.eloRating || 1200;
                const oppElo = opponentInfo?.eloRating || (activeMode === 'bots' ? (difficulty === 1 ? 800 : difficulty === 2 ? 1300 : 2000) : 1200);
                const record: MatchRecord = {
                  _id: matchId,
                  whiteUserId: isWhite ? (user?.id || 'me') : (opponentInfo?.userId || 'opp'),
                  blackUserId: !isWhite ? (user?.id || 'me') : (opponentInfo?.userId || 'opp'),
                  whiteUsername: isWhite ? (user?.username || 'Bạn') : (opponentInfo?.username || 'Đối thủ'),
                  blackUsername: !isWhite ? (user?.username || 'Bạn') : (opponentInfo?.username || 'Đối thủ'),
                  whiteOldElo: isWhite ? userElo : oppElo,
                  blackOldElo: !isWhite ? userElo : oppElo,
                  gameMode: isCurrentTournamentMatch ? 'TOURNAMENT' : activeMatch?.isRated ? 'PVP_RATED' : activeMode === 'friend' ? 'PVP_CUSTOM' : 'PV_AI',
                  winnerColor: currentStatus === 'WHITE_WIN' ? 'w' : currentStatus === 'BLACK_WIN' ? 'b' : 'draw',
                  endReason: (currentEndReason as any) || 'CHECKMATE',
                  isRated: isCurrentTournamentMatch ? false : Boolean(activeMatch?.isRated),
                  moves: [...moveHistory],
                  pgn: '',
                  finalFen: fen,
                  movesCount: moveHistory.length,
                  timeControl: {
                    initialSeconds: 600,
                    incrementSeconds: 0,
                  },
                  analysis: cachedAnalysis || undefined,
                  startedAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                };
                clearActiveMatch();
                setReplayOrigin({
                  source: isCurrentTournamentMatch ? 'tournament_live' : 'game_over',
                  preferredColor: playerColor,
                });
                setReplayMatch(record);
                setReplayMoveIndex(moveHistory.length);
                setBoardFen(fen, moveHistory);
              }
            }}
            onBackToMenu={handleBackToMenu}
          />
        );
      })()}

      {/* GIAO DIỆN BÁO CÁO PHÂN TÍCH VÁN CỜ (REPORT VIEW) */}
      {analysisReport && !replayMatch && (
        <GameReportView
          report={analysisReport}
          onClose={() => {
            setAnalysisReport(null);
            if (analysisOriginTournamentId) {
              setHistorySubTab('tournaments');
              setSelectedTournamentDetailId(analysisOriginTournamentId);
              setAnalysisOriginTournamentId(null);
            }
          }}
          isTournament={activeMode === 'tournament' || Boolean(analysisOriginTournamentId)}
          onViewBracket={() => {
            setAnalysisReport(null);
            if (analysisOriginTournamentId) {
              setHistorySubTab('tournaments');
              setSelectedTournamentDetailId(analysisOriginTournamentId);
              setAnalysisOriginTournamentId(null);
            } else {
              setIsTournamentModalOpen(true);
            }
          }}
        />
      )}

      {/* OVERLAY TIẾN TRÌNH PHÂN TÍCH STOCKFISH */}
      {isReviewAnalyzing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in select-none">
          <div className="w-full max-w-sm bg-[#16202E] border border-[#334155] rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin mb-4" />
            <h3 className="text-base font-black text-white mb-1">Đang Phân Tích Ván Đấu</h3>
            <p className="text-xs text-[#94A3B8] mb-4">{analysisStatusText || 'Đang đánh giá các nước đi...'}</p>
            <div className="w-full bg-[#0F172A] rounded-full h-2.5 overflow-hidden border border-[#334155] mb-3">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 transition-all duration-300"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
            <span className="text-xs font-mono font-bold text-indigo-400 mb-4">{analysisProgress}%</span>
            <button
              onClick={handleAbortAnalysis}
              className="py-2 px-4 rounded-xl bg-[#2A374A] hover:bg-[#3B3835] text-xs font-bold text-[#CBD5E1] transition-colors"
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

      {/* POPUP XÁC NHẬN ĐĂNG XUẤT */}
      <LogoutModal
        isOpen={isLogoutModalOpen}
        isInGame={Boolean(activeMatch && currentStatus === 'IN_PROGRESS')}
        onConfirm={handleConfirmLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
      />

      {/* POPUP THÔNG BÁO BỊ ĐĂNG XUẤT DO ĐĂNG NHẬP Ở NƠI KHÁC */}
      {forceLogoutMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 select-none">
          <div className="w-full max-w-sm bg-[#16202E] border border-amber-500/40 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-white mb-2">Phiên làm việc đã kết thúc</h3>
            <p className="text-xs text-[#CBD5E1] mb-5 leading-relaxed">
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

      {/* TOAST THÔNG BÁO KẾT QUẢ GIẢI ĐẤU (Khi người chơi đang trong ván cờ mới) */}
      {tournamentToast && (
        <div className="fixed top-5 right-5 z-[100] max-w-sm w-full p-4 bg-[#16202E] border border-amber-500/60 rounded-2xl shadow-2xl flex items-start gap-3 animate-in slide-in-from-top duration-300 select-none">
          <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              Giải đấu đã kết thúc
            </h4>
            <p className="text-xs text-slate-200 mt-0.5 truncate">
              Nhà vô địch: <span className="font-bold text-amber-400">{tournamentToast.championName}</span>
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={() => {
                  setTournamentData(tournamentToast.tournament);
                  setTournamentChampionId(tournamentToast.championId);
                  setIsTournamentModalOpen(true);
                  setTournamentToast(null);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] transition-all shadow"
              >
                Xem sơ đồ
              </button>
              <button
                onClick={() => setTournamentToast(null)}
                className="px-2 py-1 rounded-lg bg-[#2A374A] hover:bg-[#3B3835] text-slate-300 text-[11px] transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
          <button
            onClick={() => setTournamentToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
