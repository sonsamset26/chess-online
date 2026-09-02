import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Square } from 'chess.js';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');

export interface PlayerInfo {
  userId: string;
  username: string;
  eloRating: number;
}

export interface ClockPayload {
  whiteTimeMs: number;
  blackTimeMs: number;
  activeColor: 'w' | 'b';
  turnStartedAt: number;
  incrementMs: number;
  serverTimestamp: number;
}

export interface ActiveMatch {
  roomId: string;
  yourColor: 'w' | 'b';
  whitePlayer: PlayerInfo;
  blackPlayer: PlayerInfo;
  fen: string;
  history?: string[];
  isRated?: boolean;
  isArmageddon?: boolean;
  drawOdds?: 'w' | 'b';
  isTournament?: boolean;
  clock?: ClockPayload;
}

export interface EloPlayerResult {
  oldElo: number;
  newElo: number;
  delta: number;
}

export interface EloCalculationResult {
  white: EloPlayerResult;
  black: EloPlayerResult;
}

export interface MoveData {
  from: Square;
  to: Square;
  fen: string;
  history: string[];
  isGameOver: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  turn: string;
  winnerColor?: 'w' | 'b' | null;
  eloResult?: EloCalculationResult | null;
  clock?: ClockPayload;
  moveTimeMs?: number;
}

export interface ResignationData {
  roomId: string;
  winnerColor: 'w' | 'b';
  winnerName: string;
  loserName: string;
  reason: 'RESIGNATION' | 'DISCONNECT' | 'TIMEOUT';
  message: string;
  eloResult?: EloCalculationResult | null;
}

export interface DisconnectedOpponentInfo {
  disconnectedPlayer: string;
  gracePeriodSeconds: number;
  message: string;
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSearchingQueue, setIsSearchingQueue] = useState(false);
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null);
  const [latestMove, setLatestMove] = useState<MoveData | null>(null);
  const [currentClock, setCurrentClock] = useState<ClockPayload | null>(null);

  // States cho phòng bạn bè & sự kiện đối thủ đầu hàng/F5/Hết giờ
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [friendRoomError, setFriendRoomError] = useState<string | null>(null);
  const [resignationEvent, setResignationEvent] = useState<ResignationData | null>(null);

  // States cho sự kiện Mất kết nối & Kết nối lại (Reconnect 45s Grace Period)
  const [disconnectedOpponent, setDisconnectedOpponent] = useState<DisconnectedOpponentInfo | null>(null);

  // State cho sự kiện Bị đá phiên do đăng nhập ở nơi khác (Single Session Enforcement)
  const [forceLogoutMessage, setForceLogoutMessage] = useState<string | null>(null);

  useEffect(() => {
    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketInstance.on('connect', () => {
      console.log('🔌 [Socket.io Client] Đã kết nối thành công:', socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('🔌 [Socket.io Client] Mất kết nối tới Server');
      setIsConnected(false);
    });

    socketInstance.on('queue_joined', () => {
      setIsSearchingQueue(true);
    });

    socketInstance.on('queue_left', () => {
      setIsSearchingQueue(false);
    });

    socketInstance.on('friend_room_created', (data: { roomCode: string; roomId: string }) => {
      setCreatedRoomCode(data.roomCode);
      setFriendRoomError(null);
    });

    socketInstance.on('friend_room_error', (data: { message: string }) => {
      setFriendRoomError(data.message);
    });

    socketInstance.on('match_found', (data: ActiveMatch) => {
      console.log('⚔️ [Socket.io Client] Match found. Color:', data.yourColor);
      setIsSearchingQueue(false);
      setCreatedRoomCode(null);
      setFriendRoomError(null);
      setResignationEvent(null);
      setDisconnectedOpponent(null);
      setActiveMatch(data);
      setLatestMove(null);

      if (data.clock) {
        setCurrentClock(data.clock);
      }
    });

    // Nhận lại trạng thái ván đấu khi vừa Reconnect / F5
    socketInstance.on('match_reconnected', (data: ActiveMatch) => {
      console.log('🔄 [Socket.io Client] Khôi phục ván đấu sau Reconnect / F5:', data);
      setIsSearchingQueue(false);
      setResignationEvent(null);
      setDisconnectedOpponent(null);
      setActiveMatch(data);
      if (data.clock) {
        setCurrentClock(data.clock);
      }
    });

    // Đối thủ bị mất kết nối (bắt đầu đếm lùi 45s)
    socketInstance.on('player_disconnected', (data: DisconnectedOpponentInfo) => {
      console.log('⚠️ [Socket.io Client] Đối thủ mất kết nối:', data);
      setDisconnectedOpponent(data);
    });

    // Đối thủ đã kết nối lại thành công
    socketInstance.on('player_reconnected', () => {
      console.log('✅ [Socket.io Client] Đối thủ đã kết nối lại!');
      setDisconnectedOpponent(null);
    });

    socketInstance.on('receive_move', (moveData: MoveData) => {
      setLatestMove(moveData);
      if (moveData.clock) {
        setCurrentClock(moveData.clock);
      }
    });

    // Lắng nghe thông báo Đối thủ Đầu hàng hoặc F5 / Thoát web hoặc Hết giờ
    socketInstance.on('opponent_resigned', (data: ResignationData) => {
      console.log('🏳️ [Match Ended Event]:', data);
      setDisconnectedOpponent(null);
      setResignationEvent(data);
    });

    // Lắng nghe sự kiện Bị đá phiên do đăng nhập ở thiết bị khác (Single Session)
    socketInstance.on('force_logout', (data: { message: string }) => {
      console.log('🚨 [Socket.io Client] Bị Server đá phiên (Force Logout):', data.message);
      setForceLogoutMessage(data.message || 'Tài khoản của bạn vừa đăng nhập ở một thiết bị khác.');
      setActiveMatch(null);
      setIsSearchingQueue(false);
      setCreatedRoomCode(null);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const joinQueue = (userData: { userId: string; username: string; eloRating?: number }) => {
    if (socket && isConnected) {
      socket.emit('join_queue', userData);
    }
  };

  const leaveQueue = () => {
    if (socket && isConnected) {
      socket.emit('leave_queue');
      setIsSearchingQueue(false);
    }
  };

  const createFriendRoom = (userData: { userId: string; username: string; eloRating?: number }) => {
    if (socket && isConnected) {
      setFriendRoomError(null);
      socket.emit('create_friend_room', userData);
    }
  };

  const joinFriendRoom = (roomCode: string, userData: { userId: string; username: string; eloRating?: number }) => {
    if (socket && isConnected) {
      setFriendRoomError(null);
      socket.emit('join_friend_room', { roomCode, ...userData });
    }
  };

  const cancelFriendRoom = () => {
    if (socket && isConnected && createdRoomCode) {
      socket.emit('cancel_friend_room', { roomCode: createdRoomCode });
      setCreatedRoomCode(null);
      setFriendRoomError(null);
    }
  };

  // Reconnect lại phòng đấu khi F5 web
  const reconnectMatch = (roomId: string, userId: string) => {
    if (socket && isConnected) {
      socket.emit('reconnect_match', { roomId, userId });
    }
  };

  // Đầu hàng trận đấu
  const resignMatch = (roomId: string) => {
    if (socket && isConnected) {
      socket.emit('resign_match', { roomId });
    }
  };

  const sendMove = (roomId: string, from: Square, to: Square, promotion?: string) => {
    if (socket && isConnected) {
      socket.emit('send_move', { roomId, from, to, promotion });
    }
  };

  const clearActiveMatch = () => {
    setActiveMatch(null);
    setLatestMove(null);
    setCurrentClock(null);
    setCreatedRoomCode(null);
    setFriendRoomError(null);
    setResignationEvent(null);
    setDisconnectedOpponent(null);
  };

  const registerUser = (token: string, userId?: string) => {
    if (socket && isConnected && token) {
      socket.emit('register_user', { token, userId });
    }
  };

  const unregisterUser = () => {
    if (socket && isConnected) {
      socket.emit('unregister_user');
    }
  };

  const clearForceLogoutMessage = () => {
    setForceLogoutMessage(null);
  };

  return {
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
  };
}
