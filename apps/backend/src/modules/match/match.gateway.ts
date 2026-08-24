import { Server, Socket } from 'socket.io';
import { Chess, Square } from 'chess.js';
import mongoose from 'mongoose';
import { calculateElo, EloCalculationResult } from '../../utils/elo';
import { User } from '../user/user.model';
import { Match } from './match.model';

interface WaitingPlayer {
  socketId: string;
  userId: string;
  username: string;
  eloRating: number;
}

interface ActiveRoom {
  roomId: string;
  whitePlayer: WaitingPlayer;
  blackPlayer: WaitingPlayer;
  game: Chess;
  isRated: boolean; // true = Đấu Xếp Hạng Online/Giải Đấu (Tính Elo), false = Đấu Bạn Bè (Giao Hữu Unrated)
}

interface FriendRoom {
  roomCode: string;
  roomId: string;
  hostPlayer: WaitingPlayer;
  guestPlayer?: WaitingPlayer;
}

export class MatchGateway {
  private io: Server;
  private waitingQueue: WaitingPlayer[] = [];
  private activeRooms: Map<string, ActiveRoom> = new Map();
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
        const player: WaitingPlayer = {
          socketId: socket.id,
          userId: data.userId || `guest_${socket.id.substring(0, 5)}`,
          username: data.username || 'Người chơi',
          eloRating: data.eloRating || 1200,
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
        const hostPlayer: WaitingPlayer = {
          socketId: socket.id,
          userId: data.userId || `guest_${socket.id.substring(0, 5)}`,
          username: data.username || 'Chủ phòng',
          eloRating: data.eloRating || 1200,
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

        const guestPlayer: WaitingPlayer = {
          socketId: socket.id,
          userId: data.userId || `guest_${socket.id.substring(0, 5)}`,
          username: data.username || 'Khách',
          eloRating: data.eloRating || 1200,
        };

        friendRoom.guestPlayer = guestPlayer;
        socket.join(friendRoom.roomId);

        const whitePlayer = friendRoom.hostPlayer;
        const blackPlayer = guestPlayer;

        const game = new Chess();
        this.activeRooms.set(friendRoom.roomId, {
          roomId: friendRoom.roomId,
          whitePlayer,
          blackPlayer,
          game,
          isRated: false, // ⚠️ ĐẤU BẠN BÈ LÀ GIAO HỮU (UNRATED) -> KHÔNG TÍNH ELO
        });

        this.socketToRoom.set(whitePlayer.socketId, friendRoom.roomId);
        this.socketToRoom.set(blackPlayer.socketId, friendRoom.roomId);

        const matchPayload = {
          roomId: friendRoom.roomId,
          whitePlayer: { userId: whitePlayer.userId, username: whitePlayer.username, eloRating: whitePlayer.eloRating },
          blackPlayer: { userId: blackPlayer.userId, username: blackPlayer.username, eloRating: blackPlayer.eloRating },
          fen: game.fen(),
          isRated: false,
        };

        const socketWhite = this.io.sockets.sockets.get(whitePlayer.socketId);
        const socketBlack = this.io.sockets.sockets.get(blackPlayer.socketId);

        if (socketWhite) socketWhite.emit('match_found', { ...matchPayload, yourColor: 'w' });
        if (socketBlack) socketBlack.emit('match_found', { ...matchPayload, yourColor: 'b' });

        this.friendRooms.delete(roomCode);
      });

      // 5. ĐẦU HÀNG HOẶC RỜI PHÒNG KHI ĐANG THI ĐẤU
      socket.on('resign_match', (data: { roomId: string }) => {
        this.handlePlayerResignation(socket.id, data.roomId, 'RESIGNATION');
      });

      // 6. Gửi nước đi Realtime & Kiểm tra Chiếu Hết (Checkmate)
      socket.on('send_move', async (data: { roomId: string; from: Square; to: Square; promotion?: string }) => {
        const room = this.activeRooms.get(data.roomId);
        if (!room) return;

        try {
          const move = room.game.move({
            from: data.from,
            to: data.to,
            promotion: data.promotion || 'q',
          });

          if (move) {
            const isGameOver = room.game.isGameOver();
            const isCheckmate = room.game.isCheckmate();
            const isDraw = room.game.isDraw();

            let eloResult: EloCalculationResult | null = null;
            let winnerColor: 'w' | 'b' | null = null;

            // ⚠️ CHỈ TÍNH VÀ CẬP NHẬT ELO NẾU LÀ TRẬN ĐẤU XẾP HẠNG (isRated === true)
            if (isGameOver && room.isRated) {
              if (isCheckmate) {
                winnerColor = room.game.turn() === 'w' ? 'b' : 'w';
                eloResult = calculateElo(room.whitePlayer.eloRating, room.blackPlayer.eloRating, winnerColor);
                
                await this.updateUserElo(room.whitePlayer.userId, eloResult.white.delta, winnerColor === 'w' ? 'win' : 'lose');
                await this.updateUserElo(room.blackPlayer.userId, eloResult.black.delta, winnerColor === 'b' ? 'win' : 'lose');
              } else if (isDraw) {
                eloResult = calculateElo(room.whitePlayer.eloRating, room.blackPlayer.eloRating, 'd');
                await this.updateUserElo(room.whitePlayer.userId, eloResult.white.delta, 'draw');
                await this.updateUserElo(room.blackPlayer.userId, eloResult.black.delta, 'draw');
              }
            }

            this.io.to(data.roomId).emit('receive_move', {
              from: data.from,
              to: data.to,
              fen: room.game.fen(),
              history: room.game.history(),
              isGameOver,
              isCheckmate,
              isDraw,
              turn: room.game.turn(),
              winnerColor,
              eloResult: room.isRated ? eloResult : null, // Không gửi eloResult nếu là phòng bạn bè
            });

            if (isGameOver) {
              this.socketToRoom.delete(room.whitePlayer.socketId);
              this.socketToRoom.delete(room.blackPlayer.socketId);
              this.activeRooms.delete(data.roomId);
            }
          }
        } catch (err) {
          socket.emit('move_error', { message: 'Nước đi không hợp lệ' });
        }
      });

      // 7. Xử lý khi F5 trang hoặc ngắt kết nối (Disconnect)
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

  // Cập nhật Elo vào MongoDB Atlas
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
        console.log(`📈 [MongoDB Atlas] Cập nhật Elo Xếp Hạng cho ${updated.username}: Elo mới = ${updated.eloRating} (Δ ${delta >= 0 ? '+' + delta : delta})`);
      }
    } catch (err) {
      console.error('❌ Lỗi cập nhật Elo người chơi trong MongoDB:', err);
    }
  }

  // Xử lý khi 1 người chơi Đầu hàng hoặc F5 / Thoát trình duyệt
  private async handlePlayerResignation(socketId: string, roomId: string, reason: 'RESIGNATION' | 'DISCONNECT') {
    const room = this.activeRooms.get(roomId);
    if (!room) return;

    const isWhiteResigned = room.whitePlayer.socketId === socketId;
    const winnerColor = isWhiteResigned ? 'b' : 'w';
    const winnerPlayer = isWhiteResigned ? room.blackPlayer : room.whitePlayer;
    const loserPlayer = isWhiteResigned ? room.whitePlayer : room.blackPlayer;

    console.log(`🏳️ [Resignation] Room ${roomId} (${room.isRated ? 'Rated' : 'Unrated Friend'}): ${loserPlayer.username} (${reason === 'DISCONNECT' ? 'Thoát/F5 Web' : 'Đầu hàng'}). Thắng: ${winnerPlayer.username}`);

    let eloResult: EloCalculationResult | null = null;

    // ⚠️ CHỈ TÍNH VÀ CẬP NHẬT ELO NẾU LÀ TRẬN ĐẤU XẾP HẠNG (isRated === true)
    if (room.isRated) {
      eloResult = calculateElo(room.whitePlayer.eloRating, room.blackPlayer.eloRating, winnerColor);
      await this.updateUserElo(winnerPlayer.userId, winnerColor === 'w' ? eloResult.white.delta : eloResult.black.delta, 'win');
      await this.updateUserElo(loserPlayer.userId, winnerColor === 'w' ? eloResult.black.delta : eloResult.white.delta, 'lose');
    }

    // Phát sự kiện Kết thúc trận đấu tới CẢ HAI phía
    this.io.to(roomId).emit('opponent_resigned', {
      roomId,
      winnerColor,
      winnerName: winnerPlayer.username,
      loserName: loserPlayer.username,
      reason,
      message: reason === 'DISCONNECT' 
        ? `Đối thủ ${loserPlayer.username} đã ngắt kết nối (F5/Đóng tab). Bạn thắng!` 
        : `Đối thủ ${loserPlayer.username} đã đầu hàng. Bạn thắng!`,
      eloResult: room.isRated ? eloResult : null, // Phòng bạn bè không tính Elo
    });

    // Dọn dẹp phòng đấu
    this.socketToRoom.delete(room.whitePlayer.socketId);
    this.socketToRoom.delete(room.blackPlayer.socketId);
    this.activeRooms.delete(roomId);
  }

  private tryMatchmaking() {
    while (this.waitingQueue.length >= 2) {
      const p1 = this.waitingQueue.shift()!;
      const p2 = this.waitingQueue.shift()!;

      const isP1White = Math.random() < 0.5;
      const whitePlayer = isP1White ? p1 : p2;
      const blackPlayer = isP1White ? p2 : p1;

      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const game = new Chess();

      this.activeRooms.set(roomId, {
        roomId,
        whitePlayer,
        blackPlayer,
        game,
        isRated: true, // 🏆 ĐẤU GHÉP TRẬN ONLINE LUÔN LÀ RATED (CÓ TÍNH ELO)
      });

      this.socketToRoom.set(whitePlayer.socketId, roomId);
      this.socketToRoom.set(blackPlayer.socketId, roomId);

      const socketWhite = this.io.sockets.sockets.get(whitePlayer.socketId);
      const socketBlack = this.io.sockets.sockets.get(blackPlayer.socketId);

      const matchPayload = {
        roomId,
        whitePlayer: { userId: whitePlayer.userId, username: whitePlayer.username, eloRating: whitePlayer.eloRating },
        blackPlayer: { userId: blackPlayer.userId, username: blackPlayer.username, eloRating: blackPlayer.eloRating },
        fen: game.fen(),
        isRated: true,
      };

      if (socketWhite) socketWhite.emit('match_found', { ...matchPayload, yourColor: 'w' });
      if (socketBlack) socketBlack.emit('match_found', { ...matchPayload, yourColor: 'b' });
    }
  }
}
