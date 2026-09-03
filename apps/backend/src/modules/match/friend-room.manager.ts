import { Server, Socket } from 'socket.io';
import { Chess } from 'chess.js';
import { GameState, PlayerState, FriendRoom } from './match.types';

export class FriendRoomManager {
  // friendRooms và activeFriendMatches là state riêng của manager này (cách (a) theo spec)
  private friendRooms: Map<string, FriendRoom> = new Map();
  private activeFriendMatches: Map<string, string> = new Map(); // roomCode -> roomId

  constructor(
    private io: Server,
    private activeRooms: Map<string, GameState>,
    private socketToRoom: Map<string, string>,
    private scheduleTimeout: (room: GameState) => void
  ) {}

  // Đăng ký các socket event liên quan đến phòng bạn bè
  public registerHandlers(socket: Socket): void {
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
  }

  // Gọi từ disconnect handler ở gateway core để dọn phòng chờ khi chủ phòng đứt kết nối
  public cleanupOnDisconnect(socketId: string): void {
    for (const [code, fRoom] of this.friendRooms.entries()) {
      if (fRoom.hostPlayer.socketId === socketId) {
        this.friendRooms.delete(code);
        console.log(`🧹 [Friend Room] Dọn dẹp phòng chờ ${code} do chủ phòng ngắt kết nối`);
      }
    }
  }

  // Gọi từ cleanupRoomResources ở gateway core khi ván bạn bè kết thúc
  public releaseActiveMatch(friendRoomCode: string): void {
    this.activeFriendMatches.delete(friendRoomCode);
  }
}
