import { Server, Socket } from 'socket.io';
import { Chess, Square } from 'chess.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { calculateElo, EloCalculationResult } from '../../utils/elo';
import { User } from '../user/user.model';
import { MatchService } from './match.service';
import { TournamentService } from '../tournament/tournament.service';

// Xác thực JWT token từ client gửi lên khi đăng ký Socket session
function verifySocketToken(token: string): string | null {
  try {
    const primarySecret = process.env.JWT_SECRET || 'supersecretchesskey123';
    const fallbackSecret = 'supersecretchessaccesskey123';
    let decoded: any;
    try {
      decoded = jwt.verify(token, primarySecret);
    } catch {
      decoded = jwt.verify(token, fallbackSecret);
    }
    return decoded?.userId || null;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// DOMAIN MODELS & TYPINGS CHO HỆ THỐNG TRẬN ĐẤU CỜ VUA (MODULAR GAME STATE)
// -----------------------------------------------------------------------------

export interface PlayerState {
  socketId: string;
  userId: string;
  username: string;
  eloRating: number;
  isConnected: boolean;
  disconnectedAt?: number;
}

export interface ClockState {
  whiteTimeMs: number;     // Số mili-giây còn lại của Trắng
  blackTimeMs: number;     // Số mili-giây còn lại của Đen
  activeColor: 'w' | 'b';  // Bên đang chạy đồng hồ
  turnStartedAt: number;   // Timestamp (Date.now()) khi lượt đi bắt đầu
  incrementMs: number;     // Số mili-giây cộng thêm mỗi nước
}

export interface TimeControlConfig {
  initialTimeMs: number;   // Mặc định: 600,000 ms (10 phút)
  incrementMs: number;     // Mặc định: 0 ms (+0s)
  whiteInitialTimeMs?: number; // Dành riêng cho Armageddon (5 phút)
  blackInitialTimeMs?: number; // Dành riêng cho Armageddon (4 phút)
}

export interface GameState {
  roomId: string;
  friendRoomCode?: string;
  gameStartedAt: number;   // Timestamp Date.now() khi ván đấu được tạo
  version: number;         // Tăng dần 1, 2, 3... chống Race Condition
  status: 'READY' | 'PLAYING' | 'RECONNECTING' | 'FINISHED';
  isRated: boolean;        // true = Đấu Xếp Hạng (Tính Elo), false = Đấu Bạn Bè (Giao Hữu)
  game: Chess;             // Engine chess.js lưu FEN & Lịch sử
  players: {
    white: PlayerState;
    black: PlayerState;
  };
  clock: ClockState;
  timeControl: TimeControlConfig;
  winnerColor?: 'w' | 'b' | 'draw';
  endReason?: 'CHECKMATE' | 'TIMEOUT' | 'RESIGNED' | 'ABANDONED' | 'DRAW';
  timeoutTimer?: NodeJS.Timeout;
  reconnectTimer?: NodeJS.Timeout;
  tournamentContext?: {
    tournamentId: string;
    roundNumber: number;
    matchIndex: number;
  };
  isArmageddon?: boolean;
}

// Cấu hình các bước mở rộng khung Elo theo thời gian chờ (Heuristic Policy)
export const ELO_WINDOW_STEPS = [
  { maxWaitSeconds: 5, delta: 50 },
  { maxWaitSeconds: 15, delta: 100 },
  { maxWaitSeconds: 30, delta: 200 },
  { maxWaitSeconds: Infinity, delta: 400 },
];

export interface QueueEntry {
  socketId: string;
  userId: string;
  username: string;
  eloRating: number;
  joinedAt: number;
  timeControl: TimeControlConfig;
  isRated: boolean;
}

interface FriendRoom {
  roomCode: string;
  roomId: string;
  hostPlayer: PlayerState;
  guestPlayer?: PlayerState;
}

// -----------------------------------------------------------------------------
// WEBSOCKET GATEWAY CHÍNH
// -----------------------------------------------------------------------------

export class MatchGateway {
  private io: Server;
  private waitingQueue: QueueEntry[] = [];
  private activeRooms: Map<string, GameState> = new Map();
  private friendRooms: Map<string, FriendRoom> = new Map();
  private activeFriendMatches: Map<string, string> = new Map(); // roomCode -> roomId (Trận đấu bạn bè đang diễn ra)
  private socketToRoom: Map<string, string> = new Map(); // SocketId -> RoomId
  private userSockets: Map<string, Socket> = new Map();  // UserId -> Socket
  private matchmakerTimer?: NodeJS.Timeout;

  constructor(io: Server) {
    this.io = io;
    this.initializeSockets();

    // Khởi động Matchmaker Loop định kỳ mỗi 1.5 giây
    this.matchmakerTimer = setInterval(() => {
      this.processMatchmakingQueue();
    }, 1500);
  }

  private initializeSockets() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`🔌 [Socket.io] Client kết nối: ${socket.id}`);

      // Đăng ký UserId với Socket (Bảo mật qua JWT Token & Chống đăng nhập 2 nơi cùng lúc)
      socket.on('register_user', (data: { token?: string; userId?: string }) => {
        let verifiedUserId: string | null = null;
        if (data?.token) {
          verifiedUserId = verifySocketToken(data.token);
        } else if (data?.userId && data.userId.startsWith('guest_')) {
          // Cho phép guest tự nhận diện nếu chưa đăng nhập
          verifiedUserId = data.userId;
        }

        if (!verifiedUserId) {
          return socket.emit('register_error', { message: 'Xác thực token thất bại.' });
        }

        (socket as any).authenticatedUserId = verifiedUserId;

        // SINGLE SESSION ENFORCEMENT: Kiểm tra xem tài khoản này đã có socket khác đang kết nối hay chưa
        const existingSocket = this.userSockets.get(verifiedUserId);
        if (existingSocket && existingSocket.id !== socket.id && existingSocket.connected) {
          console.log(`⚠️ [Single Session Kick] Tài khoản ${verifiedUserId} đăng nhập ở phiên mới (${socket.id}). Ngắt phiên cũ: ${existingSocket.id}`);
          existingSocket.emit('force_logout', {
            message: 'Tài khoản của bạn vừa đăng nhập ở một thiết bị hoặc trình duyệt khác. Phiên này đã bị kết thúc.',
          });
          // Ngắt kết nối socket cũ
          existingSocket.disconnect(true);
        }

        this.userSockets.set(verifiedUserId, socket);
        console.log(`✅ [Socket.io] Đăng ký phiên thành công cho User: ${verifiedUserId} (socket: ${socket.id})`);
      });

      // Hủy đăng ký UserId khi người chơi bấm Đăng xuất
      socket.on('unregister_user', () => {
        const userId = (socket as any).authenticatedUserId;
        if (userId) {
          const currentSocket = this.userSockets.get(userId);
          // RACE CONDITION GUARD: Chỉ xóa nếu socket hiện tại đúng là socket đã lưu
          if (currentSocket && currentSocket.id === socket.id) {
            this.userSockets.delete(userId);
            console.log(`👋 [Socket.io] Đã hủy đăng ký phiên cho User: ${userId} (socket: ${socket.id})`);
          }
          delete (socket as any).authenticatedUserId;
        }
      });

      // 1. Gia nhập hàng chờ ghép trận theo Elo Window (ĐẤU XẾP HẠNG ONLINE)
      socket.on('join_queue', (data: {
        userId: string;
        username: string;
        eloRating?: number;
        timeControl?: { initialTimeMs?: number; incrementMs?: number };
      }) => {
        const timeControl: TimeControlConfig = {
          initialTimeMs: data.timeControl?.initialTimeMs || 600000,
          incrementMs: data.timeControl?.incrementMs || 0,
        };

        const entry: QueueEntry = {
          socketId: socket.id,
          userId: data.userId || `guest_${socket.id.substring(0, 5)}`,
          username: data.username || 'Người chơi',
          eloRating: data.eloRating || 1200,
          joinedAt: Date.now(),
          timeControl,
          isRated: true,
        };

        // Edge Case A: Loại bỏ trùng lặp nếu người chơi bấm tìm trận nhiều lần
        this.waitingQueue = this.waitingQueue.filter((p) => p.socketId !== socket.id && p.userId !== entry.userId);
        this.waitingQueue.push(entry);

        console.log(`🎮 [Matchmaker - Rated] ${entry.username} (Elo: ${entry.eloRating}, ${Math.round(timeControl.initialTimeMs / 60000)}+${Math.round(timeControl.incrementMs / 1000)}) gia nhập hàng chờ.`);
        socket.emit('queue_joined', {
          message: 'Đã gia nhập hàng chờ ghép trận...',
          joinedAt: entry.joinedAt,
          eloRating: entry.eloRating,
          initialDelta: 50,
        });

        // Thử ghép cặp ngay lập tức
        this.processMatchmakingQueue();
      });

      // 2. Rời hàng chờ ghép trận
      socket.on('leave_queue', () => {
        this.waitingQueue = this.waitingQueue.filter((p) => p.socketId !== socket.id);
        socket.emit('queue_left', { message: 'Đã rời hàng chờ' });
      });

      // 3. TẠO PHÒNG BẠN BÈ (Giao hữu - Không tính Elo)
      socket.on('create_friend_room', (data: { userId: string; username: string; eloRating?: number }) => {
        // Hủy phòng chờ cũ nếu socket này đã tạo trước đó
        for (const [code, fRoom] of this.friendRooms.entries()) {
          if (fRoom.hostPlayer.socketId === socket.id) {
            this.friendRooms.delete(code);
            socket.leave(fRoom.roomId);
          }
        }

        const hostPlayer: PlayerState = {
          socketId: socket.id,
          userId: data.userId || `guest_${socket.id.substring(0, 5)}`,
          username: data.username || 'Chủ phòng',
          eloRating: data.eloRating || 1200,
          isConnected: true,
        };

        let roomCode = '';
        do {
          roomCode = Math.floor(100000 + Math.random() * 900000).toString();
        } while (this.friendRooms.has(roomCode) || this.activeFriendMatches.has(roomCode));

        const roomId = `friend_room_${roomCode}_${Date.now()}`;

        this.friendRooms.set(roomCode, {
          roomCode,
          roomId,
          hostPlayer,
        });

        socket.join(roomId);
        console.log(`🏠 [Friend Room - Unrated] ${hostPlayer.username} tạo phòng. Mã: ${roomCode}`);

        socket.emit('friend_room_created', {
          roomCode,
          roomId,
          message: 'Tạo phòng thành công!',
        });
      });

      // 3b. HỦY PHÒNG BẠN BÈ (Chỉ chủ phòng mới có quyền hủy)
      socket.on('cancel_friend_room', (data: { roomCode: string }) => {
        const roomCode = data?.roomCode?.trim();
        if (!roomCode) return;
        const friendRoom = this.friendRooms.get(roomCode);
        if (!friendRoom) return;

        // Kiểm tra quyền: chỉ socket chủ phòng mới được hủy phòng
        if (friendRoom.hostPlayer.socketId !== socket.id) {
          return socket.emit('friend_room_error', { message: 'Chỉ chủ phòng mới có quyền hủy phòng!' });
        }

        this.friendRooms.delete(roomCode);
        socket.leave(friendRoom.roomId);
        console.log(`🏠 [Friend Room] Chủ phòng ${friendRoom.hostPlayer.username} đã hủy phòng ${roomCode}`);
        socket.emit('friend_room_cancelled', { roomCode, message: 'Đã hủy phòng đấu thành công' });
      });

      // 4. NHẬP MÃ PHÒNG VÀO ĐẤU BẠN BÈ (Đấu Bạn Bè = Unrated / Giao hữu)
      socket.on('join_friend_room', (data: { roomCode: string; userId: string; username: string; eloRating?: number }) => {
        const roomCode = data.roomCode?.trim();
        if (!roomCode) {
          return socket.emit('friend_room_error', { message: 'Mã phòng không hợp lệ!' });
        }

        // 4.1. Kiểm tra nếu mã phòng này đang có trận đấu diễn ra (Bên C nhập mã khi A, B đã vào)
        const activeMatchRoomId = this.activeFriendMatches.get(roomCode);
        if (activeMatchRoomId) {
          const activeRoom = this.activeRooms.get(activeMatchRoomId);
          if (activeRoom && (activeRoom.status === 'PLAYING' || activeRoom.status === 'RECONNECTING')) {
            return socket.emit('friend_room_error', { message: 'Phòng đấu đã đầy (trận đấu đang diễn ra)!' });
          }
        }

        // 4.2. Kiểm tra phòng chờ
        const friendRoom = this.friendRooms.get(roomCode);

        if (!friendRoom) {
          return socket.emit('friend_room_error', { message: 'Mã phòng không tồn tại hoặc chủ phòng đã hủy phòng!' });
        }

        // 4.3. Không cho chủ phòng tự nhập mã tham gia phòng của mình
        if (friendRoom.hostPlayer.socketId === socket.id) {
          return socket.emit('friend_room_error', { message: 'Bạn đang là chủ phòng này, vui lòng gửi mã cho bạn bè!' });
        }

        if (friendRoom.guestPlayer) {
          return socket.emit('friend_room_error', { message: 'Phòng đấu đã đầy!' });
        }

        const guestPlayer: PlayerState = {
          socketId: socket.id,
          userId: data.userId || `guest_${socket.id.substring(0, 5)}`,
          username: data.username || 'Khách',
          eloRating: data.eloRating || 1200,
          isConnected: true,
        };

        friendRoom.guestPlayer = guestPlayer;
        socket.join(friendRoom.roomId);

        const whitePlayer = friendRoom.hostPlayer;
        const blackPlayer = guestPlayer;
        const game = new Chess();
        const serverNow = Date.now();

        const initialTimeMs = 600000; // 10 phút mặc định
        const incrementMs = 0;

        const newRoom: GameState = {
          roomId: friendRoom.roomId,
          friendRoomCode: roomCode, // Lưu mã phòng để dọn dẹp activeFriendMatches khi ván cờ kết thúc
          gameStartedAt: serverNow,
          version: 1,
          status: 'PLAYING',
          isRated: false, // Phòng bạn bè không tính Elo
          game,
          players: {
            white: whitePlayer,
            black: blackPlayer,
          },
          clock: {
            whiteTimeMs: initialTimeMs,
            blackTimeMs: initialTimeMs,
            activeColor: 'w',
            turnStartedAt: serverNow,
            incrementMs,
          },
          timeControl: {
            initialTimeMs,
            incrementMs,
          },
        };

        this.activeRooms.set(friendRoom.roomId, newRoom);
        this.socketToRoom.set(whitePlayer.socketId, friendRoom.roomId);
        this.socketToRoom.set(blackPlayer.socketId, friendRoom.roomId);

        this.scheduleTimeout(newRoom);

        const socketWhite = this.io.sockets.sockets.get(whitePlayer.socketId);
        const socketBlack = this.io.sockets.sockets.get(blackPlayer.socketId);

        if (socketWhite) {
          socketWhite.join(friendRoom.roomId);
        }
        if (socketBlack) {
          socketBlack.join(friendRoom.roomId);
        }

        const matchPayload = {
          roomId: friendRoom.roomId,
          whitePlayer: { userId: whitePlayer.userId, username: whitePlayer.username, eloRating: whitePlayer.eloRating },
          blackPlayer: { userId: blackPlayer.userId, username: blackPlayer.username, eloRating: blackPlayer.eloRating },
          fen: game.fen(),
          isRated: false,
          clock: {
            whiteTimeMs: initialTimeMs,
            blackTimeMs: initialTimeMs,
            activeColor: 'w',
            turnStartedAt: serverNow,
            incrementMs,
            serverTimestamp: serverNow,
          },
        };

        if (socketWhite) socketWhite.emit('match_found', { ...matchPayload, yourColor: 'w' });
        if (socketBlack) socketBlack.emit('match_found', { ...matchPayload, yourColor: 'b' });

        // Chuyển từ waiting rooms sang activeFriendMatches
        this.friendRooms.delete(roomCode);
        this.activeFriendMatches.set(roomCode, friendRoom.roomId);
      });

      // 4b. THAM GIA GIẢI ĐẤU (BẢO MẬT ZERO-TRUST: XÁC THỰC JWT & TRUY VẤN DB)
      socket.on('join_tournament', async (data: { code: string; token?: string; userId?: string }) => {
        try {
          if (!data?.code) {
            return socket.emit('tournament_error', { message: 'Mã giải đấu không hợp lệ.' });
          }

          // 1. Xác thực định danh người dùng qua Socket Session hoặc JWT Token
          let verifiedUserId = (socket as any).authenticatedUserId;
          if (!verifiedUserId && data.token) {
            verifiedUserId = verifySocketToken(data.token);
          }

          if (!verifiedUserId || verifiedUserId.startsWith('guest_')) {
            return socket.emit('tournament_error', { message: 'Vui lòng đăng nhập tài khoản chính thức để tham gia giải đấu.' });
          }

          // 2. Truy vấn Database MongoDB để lấy thông tin thực tế (Chống làm giả Username/Elo)
          let user = null;
          if (mongoose.isValidObjectId(verifiedUserId)) {
            user = await User.findById(verifiedUserId);
          } else {
            user = await User.findOne({ username: verifiedUserId });
          }

          if (!user) {
            return socket.emit('tournament_error', { message: 'Tài khoản không tồn tại trên hệ thống.' });
          }

          // Gán phiên socket chính thức
          (socket as any).authenticatedUserId = user._id.toString();
          this.userSockets.set(user._id.toString(), socket);

          const tournament = await TournamentService.joinTournament(data.code, {
            userId: user._id.toString(),
            username: user.name || user.username,
            eloRating: user.eloRating || 1200,
          });

          socket.join(`tournament_${tournament.tournamentId}`);
          this.io.to(`tournament_${tournament.tournamentId}`).emit('tournament_updated', { tournament });
        } catch (err: any) {
          socket.emit('tournament_error', { message: err?.message || 'Không thể tham gia giải đấu' });
        }
      });

      // 4c. BẮT ĐẦU GIẢI ĐẤU (XÁC THỰC CHỦ PHÒNG SERVER-SIDE)
      socket.on('start_tournament', async (data: { code: string; token?: string }) => {
        try {
          if (!data?.code) {
            return socket.emit('tournament_error', { message: 'Mã giải đấu không hợp lệ.' });
          }

          let verifiedUserId = (socket as any).authenticatedUserId;
          if (!verifiedUserId && data.token) {
            verifiedUserId = verifySocketToken(data.token);
          }

          if (!verifiedUserId || verifiedUserId.startsWith('guest_')) {
            return socket.emit('tournament_error', { message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
          }

          this.userSockets.set(verifiedUserId, socket);
          const { tournament, round1Matches } = await TournamentService.startTournament(data.code, verifiedUserId);

          this.io.to(`tournament_${tournament.tournamentId}`).emit('tournament_started', {
            tournament,
            round1Matches,
          });

          // Bắt đầu đếm ngược thời gian chờ vào trận vòng 1 (30 giây để người chơi xem bảng đấu)
          const countdownSeconds = 30;
          const serverNow = Date.now();
          const targetTimestamp = serverNow + countdownSeconds * 1000;

          console.log(`⏳ [Tournament] Giải đấu ${tournament.tournamentId} bắt đầu! Đếm ngược ${countdownSeconds}s trước Vòng 1...`);
          this.io.to(`tournament_${tournament.tournamentId}`).emit('round_countdown', {
            nextRound: 1,
            countdownSeconds,
            targetTimestamp,
            serverTimestamp: serverNow,
          });

          setTimeout(() => {
            // Tạo phòng thi đấu cho các cặp đấu vòng 1 sau khi hết thời gian chờ
            for (let mIdx = 0; mIdx < round1Matches.length; mIdx++) {
              const m = round1Matches[mIdx];
              if (m.player1 && m.player2 && m.status === 'PENDING') {
                this.startTournamentMatch(tournament, 1, mIdx, m.player1, m.player2);
              }
            }
          }, countdownSeconds * 1000);
        } catch (err: any) {
          socket.emit('tournament_error', { message: err?.message || 'Không thể bắt đầu giải đấu' });
        }
      });

      // 5. ĐẦU HÀNG HOẶC RỜI PHÒNG KHI ĐANG THI ĐẤU
      socket.on('resign_match', (data: { roomId: string }) => {
        this.handlePlayerResignation(socket.id, data.roomId, 'RESIGNATION');
      });

      // 6. GỬI NƯỚC ĐI - KIỂM TRA BẢO MẬT ZERO-TRUST & TÍNH TOÁN CLOCK ENGINE
      socket.on('send_move', async (data: { roomId: string; from: Square; to: Square; promotion?: string }) => {
        const room = this.activeRooms.get(data.roomId);
        if (!room) {
          return socket.emit('move_error', { message: 'Phòng thi đấu không tồn tại hoặc đã kết thúc' });
        }

        // 6.1. Xác thực Socket có thuộc phòng thi đấu không
        const isWhite = room.players.white.socketId === socket.id;
        const isBlack = room.players.black.socketId === socket.id;
        if (!isWhite && !isBlack) {
          return socket.emit('move_error', { message: 'Bạn không có quyền thực hiện nước đi trong phòng này' });
        }

        // 6.2. Xác thực trạng thái trận đấu
        if (room.status !== 'PLAYING' && room.status !== 'RECONNECTING') {
          return socket.emit('move_error', { message: 'Ván cờ hiện tại không trong trạng thái thi đấu' });
        }

        // 6.3. Xác thực lượt đi hiện tại
        const playerColor: 'w' | 'b' = isWhite ? 'w' : 'b';
        const currentTurn = room.game.turn();
        if (playerColor !== currentTurn) {
          return socket.emit('move_error', { message: 'Chưa đến lượt đi của bạn' });
        }

        // 6.4. Tính toán thời gian thực tế đã suy nghĩ (Event-Driven Clock Engine)
        const serverNow = Date.now();
        const elapsed = Math.max(0, serverNow - room.clock.turnStartedAt);

        if (playerColor === 'w') {
          room.clock.whiteTimeMs = Math.max(0, room.clock.whiteTimeMs - elapsed + room.clock.incrementMs);
          if (room.clock.whiteTimeMs <= 0) {
            return this.handleTimeout(room.roomId, 'w');
          }
        } else {
          room.clock.blackTimeMs = Math.max(0, room.clock.blackTimeMs - elapsed + room.clock.incrementMs);
          if (room.clock.blackTimeMs <= 0) {
            return this.handleTimeout(room.roomId, 'b');
          }
        }

        // 6.5. Kiểm tra tính hợp lệ của nước đi bằng chess.js
        try {
          const move = room.game.move({
            from: data.from,
            to: data.to,
            promotion: data.promotion || 'q',
          });

          if (!move) {
            return socket.emit('move_error', { message: 'Nước đi không hợp lệ theo luật cờ vua' });
          }

          // 6.6. Chuyển lượt và cập nhật mốc thời gian
          const nextTurn = room.game.turn();
          room.clock.activeColor = nextTurn;
          room.clock.turnStartedAt = serverNow;
          room.version += 1;
          room.status = 'PLAYING';

          // 6.7. Lập lịch phát hiện hết giờ cho lượt tiếp theo
          this.scheduleTimeout(room);

          const isGameOver = room.game.isGameOver();
          const isCheckmate = room.game.isCheckmate();
          const isDraw = room.game.isDraw();

          let eloResult: EloCalculationResult | null = null;
          let winnerColor: 'w' | 'b' | null = null;

          // 6.8. Xử lý kết quả ván đấu nếu kết thúc
          if (isGameOver) {
            room.status = 'FINISHED';
            if (room.timeoutTimer) clearTimeout(room.timeoutTimer);
            if (room.reconnectTimer) clearTimeout(room.reconnectTimer);

            if (isCheckmate) {
              winnerColor = nextTurn === 'w' ? 'b' : 'w';
              room.winnerColor = winnerColor;
              room.endReason = 'CHECKMATE';

              if (room.isRated) {
                eloResult = calculateElo(room.players.white.eloRating, room.players.black.eloRating, winnerColor);
                await this.updateUserElo(room.players.white.userId, eloResult.white.delta, winnerColor === 'w' ? 'win' : 'lose');
                await this.updateUserElo(room.players.black.userId, eloResult.black.delta, winnerColor === 'b' ? 'win' : 'lose');
              }
            } else if (isDraw) {
              if (room.isArmageddon) {
                // Ván Armageddon: Đen hòa là Thắng
                winnerColor = 'b';
                room.winnerColor = 'b';
                room.endReason = 'DRAW';
              } else {
                room.winnerColor = 'draw';
                room.endReason = 'DRAW';
              }

              if (room.isRated) {
                eloResult = calculateElo(room.players.white.eloRating, room.players.black.eloRating, 'd');
                await this.updateUserElo(room.players.white.userId, eloResult.white.delta, 'draw');
                await this.updateUserElo(room.players.black.userId, eloResult.black.delta, 'draw');
              }
            }

            // Lưu lịch sử ván cờ vào MongoDB Atlas
            const savedMatchId = await this.persistMatchRecord(room, room.winnerColor || 'draw', room.endReason || 'CHECKMATE', eloResult);

            // Báo cáo kết quả giải đấu nếu có tournamentContext
            if (room.tournamentContext) {
              await this.handleTournamentMatchEnd(room, room.winnerColor || 'draw', savedMatchId);
            }
          }

          // 6.9. Broadcast gói tin Event-driven kèm mốc thời gian chuẩn
          this.io.to(data.roomId).emit('receive_move', {
            roomId: data.roomId,
            version: room.version,
            from: data.from,
            to: data.to,
            promotion: data.promotion,
            fen: room.game.fen(),
            history: room.game.history(),
            turn: nextTurn,
            clock: {
              whiteTimeMs: room.clock.whiteTimeMs,
              blackTimeMs: room.clock.blackTimeMs,
              activeColor: room.clock.activeColor,
              turnStartedAt: room.clock.turnStartedAt,
              incrementMs: room.clock.incrementMs,
              serverTimestamp: serverNow,
            },
            isGameOver,
            isCheckmate,
            isDraw,
            winnerColor,
            moveTimeMs: elapsed,
            eloResult: room.isRated ? eloResult : null,
          });

          if (isGameOver) {
            this.cleanupRoomResources(room, data.roomId);
          }
        } catch (err) {
          socket.emit('move_error', { message: 'Nước đi không hợp lệ' });
        }
      });

      // 7. XỬ LÝ KẾT NỐI LẠI PHÒNG (RECONNECT / F5 GRACE PERIOD)
      socket.on('reconnect_match', (data: { roomId: string; userId: string }) => {
        const room = this.activeRooms.get(data.roomId);
        if (!room || room.status === 'FINISHED') {
          return socket.emit('reconnect_error', { message: 'Ván đấu không tồn tại hoặc đã kết thúc.' });
        }

        const isWhite = room.players.white.userId === data.userId;
        const isBlack = room.players.black.userId === data.userId;

        if (!isWhite && !isBlack) {
          return socket.emit('reconnect_error', { message: 'Bạn không thuộc ván đấu này.' });
        }

        const player = isWhite ? room.players.white : room.players.black;
        const opponent = isWhite ? room.players.black : room.players.white;

        // Hủy bộ đếm 45s Disconnect nếu đang chạy
        if (room.reconnectTimer) {
          clearTimeout(room.reconnectTimer);
          room.reconnectTimer = undefined;
        }

        // Cập nhật Socket mới
        this.socketToRoom.delete(player.socketId);
        player.socketId = socket.id;
        player.isConnected = true;
        player.disconnectedAt = undefined;
        this.socketToRoom.set(socket.id, room.roomId);

        socket.join(room.roomId);
        room.status = 'PLAYING';

        // Nếu ván cờ chưa từng chạy clock (do khởi đầu thiếu người chơi), kích hoạt clock ngay khi người chơi vào bàn
        if (!room.timeoutTimer && room.players.white.isConnected && room.players.black.isConnected) {
          room.clock.turnStartedAt = Date.now();
          this.scheduleTimeout(room);
        }

        console.log(`🔄 [Reconnect Thành Công] ${player.username} kết nối lại phòng ${room.roomId}`);

        // Gửi toàn bộ Game State khôi phục cho người chơi vừa F5
        socket.emit('match_reconnected', {
          roomId: room.roomId,
          whitePlayer: { userId: room.players.white.userId, username: room.players.white.username, eloRating: room.players.white.eloRating },
          blackPlayer: { userId: room.players.black.userId, username: room.players.black.username, eloRating: room.players.black.eloRating },
          fen: room.game.fen(),
          history: room.game.history(),
          turn: room.game.turn(),
          isRated: room.isRated,
          yourColor: isWhite ? 'w' : 'b',
          clock: {
            whiteTimeMs: room.clock.whiteTimeMs,
            blackTimeMs: room.clock.blackTimeMs,
            activeColor: room.clock.activeColor,
            turnStartedAt: room.clock.turnStartedAt,
            incrementMs: room.clock.incrementMs,
            serverTimestamp: Date.now(),
          },
        });

        // Thông báo cho đối thủ để tắt cảnh báo đang chờ
        this.io.to(room.roomId).emit('player_reconnected', {
          reconnectedPlayer: player.username,
          message: `Đối thủ (${player.username}) đã kết nối lại ván đấu!`,
        });
      });

      // 8. XỬ LÝ NGẮT KẾT NỐI (DISCONNECT 45S GRACE PERIOD)
      socket.on('disconnect', () => {
        console.log(`🔌 [Socket.io] Client ngắt kết nối: ${socket.id}`);
        this.waitingQueue = this.waitingQueue.filter((p) => p.socketId !== socket.id);

        // Dọn dẹp phòng bạn bè ở trạng thái WAITING nếu chủ phòng ngắt kết nối
        for (const [code, fRoom] of this.friendRooms.entries()) {
          if (fRoom.hostPlayer.socketId === socket.id) {
            this.friendRooms.delete(code);
            console.log(`🧹 [Friend Room] Dọn dẹp phòng chờ ${code} do chủ phòng ngắt kết nối`);
          }
        }

        for (const [uid, sock] of this.userSockets.entries()) {
          if (sock.id === socket.id) {
            this.userSockets.delete(uid);
            break;
          }
        }

        const roomId = this.socketToRoom.get(socket.id);
        if (roomId) {
          const room = this.activeRooms.get(roomId);
          if (room && (room.status === 'PLAYING' || room.status === 'RECONNECTING')) {
            const isWhite = room.players.white.socketId === socket.id;
            const isBlack = room.players.black.socketId === socket.id;

            if (isWhite || isBlack) {
              const disconnectedPlayer = isWhite ? room.players.white : room.players.black;
              disconnectedPlayer.isConnected = false;
              disconnectedPlayer.disconnectedAt = Date.now();
              room.status = 'RECONNECTING';

              console.log(`⚠️ [Disconnect] ${disconnectedPlayer.username} mất kết nối phòng ${roomId}. Bắt đầu 45s Grace Period...`);

              // Thông báo cho đối thủ đang trong phòng
              this.io.to(roomId).emit('player_disconnected', {
                disconnectedPlayer: disconnectedPlayer.username,
                gracePeriodSeconds: 45,
                message: `Đối thủ (${disconnectedPlayer.username}) tạm mất kết nối. Đang chờ 45s kết nối lại...`,
              });

              // Hủy timer cũ nếu có
              if (room.reconnectTimer) clearTimeout(room.reconnectTimer);

              // Cho phép 45 giây để F5 / kết nối lại trước khi xử thua
              room.reconnectTimer = setTimeout(() => {
                console.log(`⏰ [Grace Period Hết hạn] ${disconnectedPlayer.username} không vào lại sau 45s -> Xử thua.`);
                this.handlePlayerResignation(disconnectedPlayer.socketId, roomId, 'DISCONNECT');
              }, 45000);
            }
          }
        }
      });
    });
  }

  // Lập lịch kiểm tra Hết giờ phía Server (Authoritative Timeout Scheduler)
  private scheduleTimeout(room: GameState) {
    if (room.timeoutTimer) {
      clearTimeout(room.timeoutTimer);
      room.timeoutTimer = undefined;
    }

    if (room.status === 'FINISHED') return;

    const activeTimeMs = room.clock.activeColor === 'w' ? room.clock.whiteTimeMs : room.clock.blackTimeMs;
    
    // Đặt Timer chính xác thời điểm hết giờ + 300ms bù trễ mạng
    room.timeoutTimer = setTimeout(() => {
      this.handleTimeout(room.roomId, room.clock.activeColor);
    }, activeTimeMs + 300);
  }

  // Xử lý khi một người chơi bị hết giờ (Flag Fall / Timeout)
  private async handleTimeout(roomId: string, timedOutColor: 'w' | 'b') {
    const room = this.activeRooms.get(roomId);
    if (!room || room.status === 'FINISHED') return;

    room.status = 'FINISHED';
    if (room.timeoutTimer) clearTimeout(room.timeoutTimer);
    if (room.reconnectTimer) clearTimeout(room.reconnectTimer);

    const winnerColor: 'w' | 'b' = timedOutColor === 'w' ? 'b' : 'w';
    const winnerPlayer = winnerColor === 'w' ? room.players.white : room.players.black;
    const loserPlayer = timedOutColor === 'w' ? room.players.white : room.players.black;

    console.log(`⏱️ [Timeout] Phòng ${roomId}: ${loserPlayer.username} (${timedOutColor === 'w' ? 'Trắng' : 'Đen'}) hết giờ. Thắng: ${winnerPlayer.username}`);

    let eloResult: EloCalculationResult | null = null;
    if (room.isRated) {
      eloResult = calculateElo(room.players.white.eloRating, room.players.black.eloRating, winnerColor);
      await this.updateUserElo(winnerPlayer.userId, winnerColor === 'w' ? eloResult.white.delta : eloResult.black.delta, 'win');
      await this.updateUserElo(loserPlayer.userId, winnerColor === 'w' ? eloResult.black.delta : eloResult.white.delta, 'lose');
    }

    this.io.to(roomId).emit('opponent_resigned', {
      roomId,
      winnerColor,
      winnerName: winnerPlayer.username,
      loserName: loserPlayer.username,
      reason: 'TIMEOUT',
      message: `Người chơi ${loserPlayer.username} (${timedOutColor === 'w' ? 'Trắng' : 'Đen'}) đã hết thời gian thi đấu. Bạn thắng!`,
      eloResult: room.isRated ? eloResult : null,
    });

    const savedMatchId = await this.persistMatchRecord(room, winnerColor, 'TIMEOUT', eloResult);

    if (room.tournamentContext) {
      await this.handleTournamentMatchEnd(room, winnerColor, savedMatchId);
    }

    this.cleanupRoomResources(room, roomId);
  }

  // Dọn dẹp tài nguyên phòng thi đấu an toàn (Safe Conditional Cleanup & Memory Deallocation)
  private cleanupRoomResources(room: GameState, targetRoomId: string) {
    // 1. Hủy các bộ đếm thời gian đang chạy ngầm của ván cờ
    if (room.timeoutTimer) {
      clearTimeout(room.timeoutTimer);
      room.timeoutTimer = undefined;
    }
    if (room.reconnectTimer) {
      clearTimeout(room.reconnectTimer);
      room.reconnectTimer = undefined;
    }

    // 2. Rời Socket.IO room để giải phóng bộ nhớ trong Adapter
    const sockW = this.io.sockets.sockets.get(room.players.white.socketId);
    const sockB = this.io.sockets.sockets.get(room.players.black.socketId);
    if (sockW) sockW.leave(targetRoomId);
    if (sockB) sockB.leave(targetRoomId);

    // 3. Xóa mapping socketToRoom CÓ ĐIỀU KIỆN (Tránh xóa đè phòng mới như Armageddon)
    if (this.socketToRoom.get(room.players.white.socketId) === targetRoomId) {
      this.socketToRoom.delete(room.players.white.socketId);
    }
    if (this.socketToRoom.get(room.players.black.socketId) === targetRoomId) {
      this.socketToRoom.delete(room.players.black.socketId);
    }

    // 4. Xóa Friend Room active nếu có
    if (room.friendRoomCode) {
      this.activeFriendMatches.delete(room.friendRoomCode);
    }

    // 5. Xóa GameState khỏi activeRooms
    this.activeRooms.delete(targetRoomId);
  }

  // Cập nhật điểm Elo vào MongoDB Atlas
  private async updateUserElo(userId: string, delta: number, outcome: 'win' | 'lose' | 'draw') {
    if (!userId || userId.startsWith('guest_')) return;

    try {
      let filter = null;
      if (mongoose.isValidObjectId(userId)) {
        filter = { _id: userId };
      } else {
        filter = { username: userId };
      }

      const updated = await User.findOneAndUpdate(
        filter,
        {
          $inc: {
            eloRating: delta,
            wins: outcome === 'win' ? 1 : 0,
            losses: outcome === 'lose' ? 1 : 0,
            draws: outcome === 'draw' ? 1 : 0,
            totalGames: 1,
          },
        },
        { new: true }
      );

      if (updated) {
        console.log(`📈 [MongoDB Atlas] Cập nhật Elo cho ${updated.username}: Elo mới = ${updated.eloRating} (Δ ${delta >= 0 ? '+' + delta : delta})`);
      }
    } catch (err) {
      console.error('❌ Lỗi cập nhật Elo người chơi trong MongoDB:', err);
    }
  }

  // Xử lý khi người chơi Đầu hàng hoặc F5 / Thoát web
  private async handlePlayerResignation(socketId: string, roomId: string, reason: 'RESIGNATION' | 'DISCONNECT') {
    const room = this.activeRooms.get(roomId);
    if (!room || room.status === 'FINISHED') return;

    room.status = 'FINISHED';
    if (room.timeoutTimer) clearTimeout(room.timeoutTimer);
    if (room.reconnectTimer) clearTimeout(room.reconnectTimer);

    const isWhiteResigned = room.players.white.socketId === socketId;
    const winnerColor = isWhiteResigned ? 'b' : 'w';
    const winnerPlayer = isWhiteResigned ? room.players.black : room.players.white;
    const loserPlayer = isWhiteResigned ? room.players.white : room.players.black;

    console.log(`🏳️ [Resignation] Phòng ${roomId} (${room.isRated ? 'Rated' : 'Unrated Friend'}): ${loserPlayer.username} (${reason === 'DISCONNECT' ? 'Thoát/F5 Web' : 'Đầu hàng'}). Thắng: ${winnerPlayer.username}`);

    let eloResult: EloCalculationResult | null = null;
    if (room.isRated) {
      eloResult = calculateElo(room.players.white.eloRating, room.players.black.eloRating, winnerColor);
      await this.updateUserElo(winnerPlayer.userId, winnerColor === 'w' ? eloResult.white.delta : eloResult.black.delta, 'win');
      await this.updateUserElo(loserPlayer.userId, winnerColor === 'w' ? eloResult.black.delta : eloResult.white.delta, 'lose');
    }

    this.io.to(roomId).emit('opponent_resigned', {
      roomId,
      winnerColor,
      winnerName: winnerPlayer.username,
      loserName: loserPlayer.username,
      reason,
      message: reason === 'DISCONNECT' 
        ? `Đối thủ ${loserPlayer.username} đã rời trận (quá 45s không kết nối lại). Bạn thắng!` 
        : `Đối thủ ${loserPlayer.username} đã đầu hàng. Bạn thắng!`,
      eloResult: room.isRated ? eloResult : null,
    });

    const endReason = reason === 'DISCONNECT' ? 'ABANDONED' : 'RESIGNED';
    const savedMatchId = await this.persistMatchRecord(room, winnerColor, endReason, eloResult);

    if (room.tournamentContext) {
      await this.handleTournamentMatchEnd(room, winnerColor, savedMatchId);
    }

    this.cleanupRoomResources(room, roomId);
  }

  // Ghi nhận và lưu trữ ván đấu hoàn chỉnh vào MongoDB Atlas
  private async persistMatchRecord(
    room: GameState,
    winnerColor: 'w' | 'b' | 'draw',
    endReason: 'CHECKMATE' | 'TIMEOUT' | 'RESIGNED' | 'ABANDONED' | 'DRAW',
    eloResult: EloCalculationResult | null
  ): Promise<string | undefined> {
    try {
      const match = await MatchService.saveMatch({
        whiteUserId: room.players.white.userId,
        blackUserId: room.players.black.userId,
        whiteUsername: room.players.white.username,
        blackUsername: room.players.black.username,
        gameMode: room.tournamentContext ? 'TOURNAMENT' : (room.isRated ? 'PVP_RATED' : 'PVP_CUSTOM'),
        winnerColor,
        endReason,
        isRated: room.isRated,
        isArmageddon: room.isArmageddon || false,
        tournamentWinnerId: room.isArmageddon && winnerColor === 'b' && endReason === 'DRAW' ? room.players.black.userId : undefined,
        whiteEloDelta: eloResult?.white.delta || 0,
        blackEloDelta: eloResult?.black.delta || 0,
        whiteOldElo: eloResult?.white.oldElo || room.players.white.eloRating,
        blackOldElo: eloResult?.black.oldElo || room.players.black.eloRating,
        moves: room.game.history(),
        pgn: room.game.pgn(),
        finalFen: room.game.fen(),
        movesCount: room.game.history().length,
        timeControl: {
          initialSeconds: Math.round(room.timeControl.initialTimeMs / 1000),
          incrementSeconds: Math.round(room.timeControl.incrementMs / 1000),
        },
        startedAt: new Date(room.gameStartedAt || room.clock.turnStartedAt),
        endedAt: new Date(),
      });
      return match?._id ? match._id.toString() : undefined;
    } catch (err) {
      console.error('❌ [MatchGateway] Lỗi ghi nhận ván đấu vào CSDL:', err);
      return undefined;
    }
  }

  // Báo cáo kết quả giải đấu và kích hoạt vòng mới hoặc Armageddon
  private async handleTournamentMatchEnd(
    room: GameState,
    winnerColor: 'w' | 'b' | 'draw',
    savedMatchId?: string
  ) {
    if (!room.tournamentContext) return;

    // Nếu ván chính hòa và không phải Armageddon -> tổ chức ván Armageddon phân định
    if (winnerColor === 'draw' && !room.isArmageddon) {
      console.log(`⚔️ [Tournament] Trận đấu ${room.roomId} kết thúc HÒA. Bắt đầu ván phụ Armageddon!`);
      this.startArmageddonMatch(room);
      return;
    }

    const winnerId = (room.isArmageddon && winnerColor === 'draw')
      ? room.players.black.userId
      : (winnerColor === 'w' ? room.players.white.userId : room.players.black.userId);

    try {
      const result = await TournamentService.reportMatchResult(
        room.tournamentContext,
        winnerId,
        savedMatchId,
        room.isArmageddon || false
      );

      const tournamentId = room.tournamentContext.tournamentId;
      this.io.to(`tournament_${tournamentId}`).emit('tournament_updated', {
        tournament: result.tournament,
      });

      if (result.isRoundFinished) {
        if (result.isTournamentFinished) {
          console.log(`🏆 [Tournament] Giải đấu ${tournamentId} kết thúc! Vô địch: ${result.championId}`);
          this.io.to(`tournament_${tournamentId}`).emit('tournament_finished', {
            tournament: result.tournament,
            championId: result.championId,
          });
          this.io.to(room.roomId).emit('tournament_finished', {
            tournament: result.tournament,
            championId: result.championId,
          });
        } else {
          // Bắt đầu đếm ngược 30 giây nghỉ giữa 2 vòng (dựa trên mốc thời gian tuyệt đối)
          const countdownSeconds = 30;
          const targetTimestamp = result.tournament.roundBreakUntil
            ? new Date(result.tournament.roundBreakUntil).getTime()
            : Date.now() + 30000;
          const serverNow = Date.now();

          console.log(`⏳ [Tournament] Vòng hoàn thành. Đếm ngược ${countdownSeconds}s trước vòng tiếp theo...`);
          this.io.to(`tournament_${tournamentId}`).emit('round_countdown', {
            nextRound: result.tournament.rounds.length + 1,
            countdownSeconds,
            targetTimestamp,
            serverTimestamp: serverNow,
          });

          setTimeout(async () => {
            try {
              const adv = await TournamentService.advanceNextRound(tournamentId);
              if (adv.nextRound) {
                this.io.to(`tournament_${tournamentId}`).emit('tournament_updated', {
                  tournament: adv.tournament,
                });

                // Khởi tạo các ván đấu của vòng mới
                for (let mIdx = 0; mIdx < adv.nextRound.matches.length; mIdx++) {
                  const m = adv.nextRound.matches[mIdx];
                  if (m.player1 && m.player2 && m.status === 'PENDING') {
                    this.startTournamentMatch(adv.tournament, adv.nextRound.roundNumber, mIdx, m.player1, m.player2);
                  }
                }
              }
            } catch (err) {
              console.error('❌ [Tournament] Lỗi tạo vòng mới sau đếm ngược:', err);
            }
          }, countdownSeconds * 1000);
        }
      }
    } catch (err) {
      console.error('❌ [Tournament] Lỗi báo cáo kết quả trận đấu:', err);
    }
  }

  // Khởi tạo ván cờ Armageddon phân định khi hòa
  private startArmageddonMatch(prevRoom: GameState) {
    if (!prevRoom.tournamentContext) return;

    // Đảo màu quân: người cầm Trắng ván trước cầm Đen ván này
    const whitePlayerState: PlayerState = {
      ...prevRoom.players.black,
      isConnected: true,
    };
    const blackPlayerState: PlayerState = {
      ...prevRoom.players.white,
      isConnected: true,
    };

    const roomId = `room_armageddon_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const game = new Chess();
    const serverNow = Date.now();

    // Trắng 5 phút (300,000ms), Đen 4 phút (240,000ms), increment 0
    const timeControl: TimeControlConfig = {
      initialTimeMs: 300000,
      incrementMs: 0,
      whiteInitialTimeMs: 300000,
      blackInitialTimeMs: 240000,
    };

    const room: GameState = {
      roomId,
      gameStartedAt: serverNow,
      version: 1,
      status: 'PLAYING',
      isRated: false,
      game,
      players: {
        white: whitePlayerState,
        black: blackPlayerState,
      },
      clock: {
        whiteTimeMs: 300000,
        blackTimeMs: 240000,
        activeColor: 'w',
        turnStartedAt: serverNow,
        incrementMs: 0,
      },
      timeControl,
      tournamentContext: prevRoom.tournamentContext,
      isArmageddon: true,
    };

    // Hủy các bộ đếm thời gian của ván đấu chính trước đó
    if (prevRoom.timeoutTimer) {
      clearTimeout(prevRoom.timeoutTimer);
      prevRoom.timeoutTimer = undefined;
    }
    if (prevRoom.reconnectTimer) {
      clearTimeout(prevRoom.reconnectTimer);
      prevRoom.reconnectTimer = undefined;
    }

    this.activeRooms.set(roomId, room);
    this.socketToRoom.set(whitePlayerState.socketId, roomId);
    this.socketToRoom.set(blackPlayerState.socketId, roomId);

    const socketWhite = this.io.sockets.sockets.get(whitePlayerState.socketId);
    const socketBlack = this.io.sockets.sockets.get(blackPlayerState.socketId);

    if (socketWhite) {
      socketWhite.leave(prevRoom.roomId);
      socketWhite.join(roomId);
    }
    if (socketBlack) {
      socketBlack.leave(prevRoom.roomId);
      socketBlack.join(roomId);
    }

    const matchPayload = {
      roomId,
      whitePlayer: { userId: whitePlayerState.userId, username: whitePlayerState.username, eloRating: whitePlayerState.eloRating },
      blackPlayer: { userId: blackPlayerState.userId, username: blackPlayerState.username, eloRating: blackPlayerState.eloRating },
      fen: game.fen(),
      isRated: false,
      isArmageddon: true,
      drawOdds: 'b',
      isTournament: true,
      clock: {
        whiteTimeMs: 300000,
        blackTimeMs: 240000,
        activeColor: 'w',
        turnStartedAt: serverNow,
        incrementMs: 0,
        serverTimestamp: serverNow,
      },
    };

    if (socketWhite) socketWhite.emit('match_found', { ...matchPayload, yourColor: 'w' });
    if (socketBlack) socketBlack.emit('match_found', { ...matchPayload, yourColor: 'b' });

    this.scheduleTimeout(room);
  }

  // Khởi tạo phòng thi đấu cho 1 cặp đấu trong giải đấu
  private startTournamentMatch(
    tournament: any,
    roundNumber: number,
    matchIndex: number,
    player1Id: string,
    player2Id: string
  ) {
    const socket1 = this.userSockets.get(player1Id);
    const socket2 = this.userSockets.get(player2Id);

    const p1Info = tournament.players.find((p: any) => p.userId === player1Id) || { userId: player1Id, username: 'Player 1', eloRating: 1200 };
    const p2Info = tournament.players.find((p: any) => p.userId === player2Id) || { userId: player2Id, username: 'Player 2', eloRating: 1200 };

    const roomId = `room_tour_${tournament.tournamentId}_r${roundNumber}_m${matchIndex}`;
    const game = new Chess();
    const serverNow = Date.now();
    const initialTimeMs = 600000; // 10 phút

    const room: GameState = {
      roomId,
      gameStartedAt: serverNow,
      version: 1,
      status: 'PLAYING',
      isRated: false,
      game,
      players: {
        white: {
          socketId: socket1?.id || '',
          userId: p1Info.userId,
          username: p1Info.username,
          eloRating: p1Info.eloRating,
          isConnected: !!socket1?.connected,
        },
        black: {
          socketId: socket2?.id || '',
          userId: p2Info.userId,
          username: p2Info.username,
          eloRating: p2Info.eloRating,
          isConnected: !!socket2?.connected,
        },
      },
      clock: {
        whiteTimeMs: initialTimeMs,
        blackTimeMs: initialTimeMs,
        activeColor: 'w',
        turnStartedAt: serverNow,
        incrementMs: 0,
      },
      timeControl: {
        initialTimeMs,
        incrementMs: 0,
      },
      tournamentContext: {
        tournamentId: tournament.tournamentId,
        roundNumber,
        matchIndex,
      },
    };

    this.activeRooms.set(roomId, room);
    if (socket1) {
      this.socketToRoom.set(socket1.id, roomId);
      socket1.join(roomId);
    }
    if (socket2) {
      this.socketToRoom.set(socket2.id, roomId);
      socket2.join(roomId);
    }

    const matchPayload = {
      roomId,
      whitePlayer: { userId: p1Info.userId, username: p1Info.username, eloRating: p1Info.eloRating },
      blackPlayer: { userId: p2Info.userId, username: p2Info.username, eloRating: p2Info.eloRating },
      fen: game.fen(),
      isRated: false,
      isTournament: true,
      clock: {
        whiteTimeMs: initialTimeMs,
        blackTimeMs: initialTimeMs,
        activeColor: 'w',
        turnStartedAt: serverNow,
        incrementMs: 0,
        serverTimestamp: serverNow,
      },
    };

    const isP1Online = !!socket1?.connected;
    const isP2Online = !!socket2?.connected;

    if (socket1) socket1.emit('match_found', { ...matchPayload, yourColor: 'w' });
    if (socket2) socket2.emit('match_found', { ...matchPayload, yourColor: 'b' });

    // OFFLINE PLAYER HANDLING:
    // Nếu có kỳ thủ offline khi bắt đầu trận, chuyển sang RECONNECTING và kích hoạt Grace Period 45s để xử thua vắng mặt (Walkover)
    if (!isP1Online || !isP2Online) {
      room.status = 'RECONNECTING';
      const offlinePlayer = !isP1Online ? room.players.white : room.players.black;
      const onlineSocket = !isP1Online ? socket2 : socket1;
      offlinePlayer.isConnected = false;
      offlinePlayer.disconnectedAt = serverNow;

      if (onlineSocket) {
        onlineSocket.emit('player_disconnected', {
          disconnectedPlayer: offlinePlayer.username,
          gracePeriodSeconds: 45,
          message: `Đối thủ (${offlinePlayer.username}) chưa có mặt. Đang chờ 45s để kết nối...`,
        });
      }

      room.reconnectTimer = setTimeout(() => {
        console.log(`⏰ [Tournament Walkover] ${offlinePlayer.username} không vào bàn sau 45s -> Xử thua vắng mặt.`);
        this.handlePlayerResignation(offlinePlayer.socketId || '', roomId, 'DISCONNECT');
      }, 45000);

      // Tuyệt đối không khởi động đồng hồ 10 phút khi chưa đủ người
      return;
    }

    this.scheduleTimeout(room);
  }

  // Lấy độ lệch Elo cho phép theo thời gian chờ (Heuristic Policy)
  private getEloWindowDelta(joinedAt: number): number {
    const elapsedSec = Math.max(0, (Date.now() - joinedAt) / 1000);
    for (const step of ELO_WINDOW_STEPS) {
      if (elapsedSec <= step.maxWaitSeconds) {
        return step.delta;
      }
    }
    return 400;
  }

  // Thuật toán Ghép trận theo khung Elo mở rộng (Expanding Elo Window Matchmaker)
  private processMatchmakingQueue() {
    if (this.waitingQueue.length < 2) return;

    // 1. Dọn dẹp các socket chết trước khi quét (Edge Case B)
    this.waitingQueue = this.waitingQueue.filter((p) => {
      const s = this.io.sockets.sockets.get(p.socketId);
      return s && s.connected;
    });

    if (this.waitingQueue.length < 2) return;

    // 2. Sắp xếp người chờ theo joinedAt tăng dần (người chờ lâu nhất được xét ưu tiên)
    this.waitingQueue.sort((a, b) => a.joinedAt - b.joinedAt);

    const matchedIndices = new Set<number>();

    for (let i = 0; i < this.waitingQueue.length; i++) {
      if (matchedIndices.has(i)) continue;
      const p1 = this.waitingQueue[i];
      const delta1 = this.getEloWindowDelta(p1.joinedAt);

      let bestCandidateIndex = -1;
      let bestEloDiff = Infinity;
      let bestWaitTime = -1;

      for (let j = i + 1; j < this.waitingQueue.length; j++) {
        if (matchedIndices.has(j)) continue;
        const p2 = this.waitingQueue[j];

        // Không tự ghép với chính mình
        if (p1.userId === p2.userId || p1.socketId === p2.socketId) continue;

        // Nguyên tắc 2: Phải cùng Thể thức thời gian & Cùng chế độ Rated/Unrated
        if (p1.isRated !== p2.isRated) continue;
        if (
          p1.timeControl.initialTimeMs !== p2.timeControl.initialTimeMs ||
          p1.timeControl.incrementMs !== p2.timeControl.incrementMs
        ) {
          continue;
        }

        // Nguyên tắc 1: Điều kiện giao thoa cả hai bên cùng chấp nhận: |Elo1 - Elo2| <= min(Δ1, Δ2)
        const delta2 = this.getEloWindowDelta(p2.joinedAt);
        const allowedDelta = Math.min(delta1, delta2);
        const eloDiff = Math.abs(p1.eloRating - p2.eloRating);

        if (eloDiff <= allowedDelta) {
          // Nguyên tắc 3: Ưu tiên giải phóng người chờ lâu hơn, sau đó đến độ lệch Elo nhỏ nhất
          const p2WaitTime = Date.now() - p2.joinedAt;
          if (
            bestCandidateIndex === -1 ||
            p2WaitTime > bestWaitTime ||
            (p2WaitTime === bestWaitTime && eloDiff < bestEloDiff)
          ) {
            bestCandidateIndex = j;
            bestEloDiff = eloDiff;
            bestWaitTime = p2WaitTime;
          }
        }
      }

      if (bestCandidateIndex !== -1) {
        matchedIndices.add(i);
        matchedIndices.add(bestCandidateIndex);

        const p2 = this.waitingQueue[bestCandidateIndex];
        console.log(
          `🤝 [Matchmaker] Ghép thành công: ${p1.username} (Elo ${p1.eloRating}, chờ ${(Date.now() - p1.joinedAt) / 1000}s) vs ` +
          `${p2.username} (Elo ${p2.eloRating}, chờ ${(Date.now() - p2.joinedAt) / 1000}s) - Lệch: ${Math.abs(p1.eloRating - p2.eloRating)} Elo`
        );

        this.createMatchedGame(p1, p2);
      }
    }

    // Xóa những người đã ghép trận thành công ra khỏi hàng chờ
    if (matchedIndices.size > 0) {
      this.waitingQueue = this.waitingQueue.filter((_, idx) => !matchedIndices.has(idx));
    }
  }

  // Khởi tạo phòng thi đấu cho cặp đấu thỏa mãn Elo Window
  private createMatchedGame(p1: QueueEntry, p2: QueueEntry) {
    const isP1White = Math.random() < 0.5;
    const whitePlayer: PlayerState = {
      socketId: isP1White ? p1.socketId : p2.socketId,
      userId: isP1White ? p1.userId : p2.userId,
      username: isP1White ? p1.username : p2.username,
      eloRating: isP1White ? p1.eloRating : p2.eloRating,
      isConnected: true,
    };
    const blackPlayer: PlayerState = {
      socketId: isP1White ? p2.socketId : p1.socketId,
      userId: isP1White ? p2.userId : p1.userId,
      username: isP1White ? p2.username : p1.username,
      eloRating: isP1White ? p2.eloRating : p1.eloRating,
      isConnected: true,
    };

    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const game = new Chess();
    const serverNow = Date.now();

    const initialTimeMs = p1.timeControl.initialTimeMs;
    const incrementMs = p1.timeControl.incrementMs;

    const newRoom: GameState = {
      roomId,
      gameStartedAt: serverNow,
      version: 1,
      status: 'PLAYING',
      isRated: p1.isRated,
      game,
      players: {
        white: whitePlayer,
        black: blackPlayer,
      },
      clock: {
        whiteTimeMs: initialTimeMs,
        blackTimeMs: initialTimeMs,
        activeColor: 'w',
        turnStartedAt: serverNow,
        incrementMs,
      },
      timeControl: p1.timeControl,
    };

    this.activeRooms.set(roomId, newRoom);
    this.socketToRoom.set(whitePlayer.socketId, roomId);
    this.socketToRoom.set(blackPlayer.socketId, roomId);

    this.scheduleTimeout(newRoom);

    const socketWhite = this.io.sockets.sockets.get(whitePlayer.socketId);
    const socketBlack = this.io.sockets.sockets.get(blackPlayer.socketId);

    // Gắn socket của cả hai vào room trước khi emit
    if (socketWhite) {
      socketWhite.join(roomId);
    }
    if (socketBlack) {
      socketBlack.join(roomId);
    }

    const matchPayload = {
      roomId,
      whitePlayer: { userId: whitePlayer.userId, username: whitePlayer.username, eloRating: whitePlayer.eloRating },
      blackPlayer: { userId: blackPlayer.userId, username: blackPlayer.username, eloRating: blackPlayer.eloRating },
      fen: game.fen(),
      isRated: p1.isRated,
      clock: {
        whiteTimeMs: initialTimeMs,
        blackTimeMs: initialTimeMs,
        activeColor: 'w',
        turnStartedAt: serverNow,
        incrementMs,
        serverTimestamp: serverNow,
      },
    };

    if (socketWhite) socketWhite.emit('match_found', { ...matchPayload, yourColor: 'w' });
    if (socketBlack) socketBlack.emit('match_found', { ...matchPayload, yourColor: 'b' });
  }

  // Dọn dẹp Timer khi ứng dụng tắt
  public destroy() {
    if (this.matchmakerTimer) {
      clearInterval(this.matchmakerTimer);
    }
  }
}
