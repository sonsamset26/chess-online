import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Square } from 'chess.js';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

export interface PlayerInfo {
  userId: string;
  username: string;
  eloRating: number;
}

export interface ActiveMatch {
  roomId: string;
  yourColor: 'w' | 'b';
  whitePlayer: PlayerInfo;
  blackPlayer: PlayerInfo;
  fen: string;
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
}

export interface ResignationData {
  roomId: string;
  winnerColor: 'w' | 'b';
  winnerName: string;
  loserName: string;
  reason: 'RESIGNATION' | 'DISCONNECT';
  message: string;
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSearchingQueue, setIsSearchingQueue] = useState(false);
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null);
  const [latestMove, setLatestMove] = useState<MoveData | null>(null);

  // States cho phòng bạn bè & sự kiện đối thủ đầu hàng/F5
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [friendRoomError, setFriendRoomError] = useState<string | null>(null);
  const [resignationEvent, setResignationEvent] = useState<ResignationData | null>(null);

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
      setActiveMatch(data);
      setLatestMove(null);
    });

    socketInstance.on('receive_move', (moveData: MoveData) => {
      setLatestMove(moveData);
    });

    // Lắng nghe thông báo Đối thủ Đầu hàng hoặc F5 / Thoát trình duyệt
    socketInstance.on('opponent_resigned', (data: ResignationData) => {
      console.log('🏳️ [Resignation Event]:', data);
      setResignationEvent(data);
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
    setCreatedRoomCode(null);
    setFriendRoomError(null);
    setResignationEvent(null);
  };

  return {
    socket,
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
  };
}
