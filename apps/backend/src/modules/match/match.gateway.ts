import { Server, Socket } from 'socket.io';
import { Chess, Square } from 'chess.js';
import mongoose from 'mongoose';
import { calculateElo, EloCalculationResult } from '../../utils/elo';
import { User } from '../user/user.model';

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
}

export interface GameState {
  roomId: string;
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
  private waitingQueue: PlayerState[] = [];
  private activeRooms: Map<string, GameState> = new Map();
  private friendRooms: Map<string, FriendRoom> = new Map();
  private socketToRoom: Map<string, string> = new Map(); // SocketId -> RoomId

  constructor(io: Server) {
    this.io = io;
    this.initializeSockets();
  }

  private initializeSockets() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`🔌 [Socket.io] Client kết nối: ${socket.id}`);

      // 1. Gia nhập hàng chờ ghép trận ngẫu nhiên (ĐẤU XẾP HẠNG ONLINE -> CÓ TÍNH ELO)
      socket.on('join_queue', (data: { userId: string; username: string; eloRating?: number }) => {
        const player: PlayerState = {
          socketId: socket.id,
          userId: data.userId || `guest_${socket.id.substring(0, 5)}`,
          username: data.username || 'Người chơi',
          eloRating: data.eloRating || 1200,
          isConnected: true,
        };

        this.waitingQueue = this.waitingQueue.filter((p) => p.socketId !== socket.id && p.userId !== player.userId);
        this.waitingQueue.push(player);

        console.log(`🎮 [Matchmaker - Rated] Player ${player.username} (Elo: ${player.eloRating}) gia nhập hàng chờ.`);
        socket.emit('queue_joined', { message: 'Đã gia nhập hàng chờ ghép trận...' });

        this.tryMatchmaking();
      });

      // 2. Rời hàng chờ ghép trận
      socket.on('leave_queue', () => {
        this.waitingQueue = this.waitingQueue.filter((p) => p.socketId !== socket.id);
        socket.emit('queue_left', { message: 'Đã rời hàng chờ' });
      });

      // 3. TẠO PHÒNG BẠN BÈ (Giao hữu - Không tính Elo)
      socket.on('create_friend_room', (data: { userId: string; username: string; eloRating?: number }) => {
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
        } while (this.friendRooms.has(roomCode));

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

      // 4. NHẬP MÃ PHÒNG VÀO ĐẤU BẠN BÈ (Đấu Bạn Bè = Unrated / Giao hữu)
      socket.on('join_friend_room', (data: { roomCode: string; userId: string; username: string; eloRating?: number }) => {
        const roomCode = data.roomCode?.trim();
        const friendRoom = this.friendRooms.get(roomCode);

        if (!friendRoom) {
          return socket.emit('friend_room_error', { message: 'Mã phòng không tồn tại!' });
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

        this.friendRooms.delete(roomCode);
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
              room.winnerColor = 'draw';
              room.endReason = 'DRAW';

              if (room.isRated) {
                eloResult = calculateElo(room.players.white.eloRating, room.players.black.eloRating, 'd');
                await this.updateUserElo(room.players.white.userId, eloResult.white.delta, 'draw');
                await this.updateUserElo(room.players.black.userId, eloResult.black.delta, 'draw');
              }
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
            eloResult: room.isRated ? eloResult : null,
          });

          if (isGameOver) {
            this.socketToRoom.delete(room.players.white.socketId);
            this.socketToRoom.delete(room.players.black.socketId);
            this.activeRooms.delete(data.roomId);
          }
        } catch (err) {
          socket.emit('move_error', { message: 'Nước đi không hợp lệ' });
        }
      });

      // 7. Xử lý ngắt kết nối (Disconnect)
      socket.on('disconnect', () => {
        console.log(`🔌 [Socket.io] Client ngắt kết nối: ${socket.id}`);
        this.waitingQueue = this.waitingQueue.filter((p) => p.socketId !== socket.id);

        const roomId = this.socketToRoom.get(socket.id);
        if (roomId) {
          this.handlePlayerResignation(socket.id, roomId, 'DISCONNECT');
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

    this.socketToRoom.delete(room.players.white.socketId);
    this.socketToRoom.delete(room.players.black.socketId);
    this.activeRooms.delete(roomId);
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
        ? `Đối thủ ${loserPlayer.username} đã ngắt kết nối (F5/Đóng tab). Bạn thắng!` 
        : `Đối thủ ${loserPlayer.username} đã đầu hàng. Bạn thắng!`,
      eloResult: room.isRated ? eloResult : null,
    });

    this.socketToRoom.delete(room.players.white.socketId);
    this.socketToRoom.delete(room.players.black.socketId);
    this.activeRooms.delete(roomId);
  }

  // Ghép trận ngẫu nhiên (Matchmaking)
  private tryMatchmaking() {
    while (this.waitingQueue.length >= 2) {
      const p1 = this.waitingQueue.shift()!;
      const p2 = this.waitingQueue.shift()!;

      const isP1White = Math.random() < 0.5;
      const whitePlayer = isP1White ? p1 : p2;
      const blackPlayer = isP1White ? p2 : p1;

      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const game = new Chess();
      const serverNow = Date.now();

      const initialTimeMs = 600000; // 10 phút mặc định (Rapid 10+0)
      const incrementMs = 0;

      const newRoom: GameState = {
        roomId,
        version: 1,
        status: 'PLAYING',
        isRated: true, // Ghép trận Online luôn là Rated (Tính Elo)
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

      this.activeRooms.set(roomId, newRoom);
      this.socketToRoom.set(whitePlayer.socketId, roomId);
      this.socketToRoom.set(blackPlayer.socketId, roomId);

      this.scheduleTimeout(newRoom);

      const socketWhite = this.io.sockets.sockets.get(whitePlayer.socketId);
      const socketBlack = this.io.sockets.sockets.get(blackPlayer.socketId);

      // ⚠️ GẮN SOCKET CỦA CẢ 2 VÀO ROOM ID TRƯỚC KHI EMIT SỰ KIỆN
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
        isRated: true,
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
  }
}
