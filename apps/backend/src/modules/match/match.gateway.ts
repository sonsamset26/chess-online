import { Server, Socket } from 'socket.io';
import { Chess, Square } from 'chess.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { calculateElo, EloCalculationResult } from '../../utils/elo';
import { User } from '../user/user.model';
import { MatchService } from './match.service';
import {
  GameState,
  PlayerState,
  ClockState,
  TimeControlConfig,
  QueueEntry,
  FriendRoom,
  isPlayerInsufficientToMate,
} from './match.types';
import { MatchmakingManager } from './matchmaking.manager';
import { FriendRoomManager } from './friend-room.manager';
import { TournamentMatchManager } from './tournament-match.manager';
import { verifySocketToken } from './match.utils';

// Re-export toàn bộ types và utils để các module khác import thuận tiện
export * from './match.types';
export * from './match.utils';

// -----------------------------------------------------------------------------
// WEBSOCKET GATEWAY CHÍNH (CORE GATEWAY ENGINE)
// -----------------------------------------------------------------------------

export class MatchGateway {
  private io: Server;
  private activeRooms: Map<string, GameState> = new Map();
  private socketToRoom: Map<string, string> = new Map(); // SocketId -> RoomId
  private userSockets: Map<string, Socket> = new Map();  // UserId -> Socket
  private matchmakerTimer?: NodeJS.Timeout;

  private matchmakingManager: MatchmakingManager;
  private friendRoomManager: FriendRoomManager;
  private tournamentMatchManager: TournamentMatchManager;

  constructor(io: Server) {
    this.io = io;

    this.matchmakingManager = new MatchmakingManager(
      this.io,
      this.activeRooms,
      this.socketToRoom,
      (room) => this.scheduleTimeout(room)
    );

    this.friendRoomManager = new FriendRoomManager(
      this.io,
      this.activeRooms,
      this.socketToRoom,
      (room) => this.scheduleTimeout(room)
    );

    this.tournamentMatchManager = new TournamentMatchManager(
      this.io,
      this.activeRooms,
      this.socketToRoom,
      this.userSockets,
      (room) => this.scheduleTimeout(room),
      (socketId, roomId, reason, resignedColor) => this.handlePlayerResignation(socketId, roomId, reason, resignedColor),
      (room, roomId) => this.cleanupRoomResources(room, roomId)
    );

    this.initializeSockets();

    // Phục hồi các giải đấu đang diễn ra nếu server khởi động lại (B-03 Fix)
    this.tournamentMatchManager.recoverActiveTournaments();

    // Khởi động Matchmaker Loop định kỳ mỗi 1.5 giây
    this.matchmakerTimer = setInterval(() => {
      this.matchmakingManager.processMatchmakingQueue();
    }, 1500);
  }

  private initializeSockets() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`🔌 [Socket.io] Client kết nối: ${socket.id}`);

      // Đăng ký UserId với Socket (Bảo mật qua JWT Token & Chống đăng nhập 2 nơi cùng lúc)
      socket.on('register_user', (data: { token?: string; userId?: string }) => {
        let verifiedUserId: string | null = null;
        const isJwt = (s?: string) => typeof s === 'string' && s.split('.').length === 3;
        const candidateToken = isJwt(data?.token) ? data?.token : (isJwt(data?.userId) ? data?.userId : data?.token);
        const fallbackUserId = !isJwt(data?.userId) ? data?.userId : (!isJwt(data?.token) ? data?.token : undefined);

        if (candidateToken) {
          verifiedUserId = verifySocketToken(candidateToken);
        }
        if (!verifiedUserId && fallbackUserId && fallbackUserId.startsWith('guest_')) {
          // Cho phép guest tự nhận diện nếu chưa đăng nhập
          verifiedUserId = fallbackUserId;
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

      // Đăng ký các module quản lý tính năng
      this.matchmakingManager.registerHandlers(socket);
      this.friendRoomManager.registerHandlers(socket);
      this.tournamentMatchManager.registerHandlers(socket);

      // 5. ĐẦU HÀNG HOẶC RỜI PHÒNG KHI ĐANG THI ĐẤU
      socket.on('resign_match', (data: { roomId: string }) => {
        this.handlePlayerResignation(socket.id, data.roomId, 'RESIGNATION');
      });

      // 5.1. CẦU HÒA (DRAW OFFER - FIDE ARTICLE 9.1)
      socket.on('offer_draw', (data: { roomId: string }) => {
        const room = this.activeRooms.get(data?.roomId);
        if (!room || room.status === 'FINISHED') return;
        const isWhite = room.players.white.socketId === socket.id;
        const isBlack = room.players.black.socketId === socket.id;
        if (!isWhite && !isBlack) return;

        const myColor: 'w' | 'b' = isWhite ? 'w' : 'b';
        const opponentSocketId = isWhite ? room.players.black.socketId : room.players.white.socketId;

        room.drawOfferedBy = myColor;
        this.io.to(opponentSocketId).emit('draw_offered', {
          roomId: room.roomId,
          offeredBy: myColor,
          username: isWhite ? room.players.white.username : room.players.black.username,
        });
      });

      // 5.2. CHẤP NHẬN HÒA (ACCEPT DRAW)
      socket.on('accept_draw', async (data: { roomId: string }) => {
        const room = this.activeRooms.get(data?.roomId);
        if (!room || room.status === 'FINISHED') return;
        const isWhite = room.players.white.socketId === socket.id;
        const isBlack = room.players.black.socketId === socket.id;
        if (!isWhite && !isBlack) return;

        const opponentColor: 'w' | 'b' = isWhite ? 'b' : 'w';

        // Chỉ chấp nhận nếu đối phương là người vừa gửi lời mời hòa
        if (room.drawOfferedBy !== opponentColor) {
          return socket.emit('draw_error', { message: 'Không có lời mời hòa hợp lệ từ đối thủ.' });
        }

        const winnerColor: 'w' | 'b' | 'draw' = room.isArmageddon ? 'b' : 'draw';
        const { eloResult } = await this.finalizeMatchEnding(room, room.roomId, winnerColor, 'DRAW');

        this.io.to(room.roomId).emit('game_draw', {
          roomId: room.roomId,
          reason: 'MUTUAL_AGREEMENT',
          message: 'Hai bên đã đồng ý hòa ván cờ theo thỏa thuận.',
          eloResult: room.isRated ? eloResult : null,
        });
      });

      // 5.3. TỪ CHỐI LỜI MỜI HÒA (DECLINE DRAW)
      socket.on('decline_draw', (data: { roomId: string }) => {
        const room = this.activeRooms.get(data?.roomId);
        if (!room || room.status === 'FINISHED') return;
        const isWhite = room.players.white.socketId === socket.id;
        const isBlack = room.players.black.socketId === socket.id;
        if (!isWhite && !isBlack) return;

        room.drawOfferedBy = null;
        const opponentSocketId = isWhite ? room.players.black.socketId : room.players.white.socketId;
        this.io.to(opponentSocketId).emit('draw_declined', {
          roomId: room.roomId,
          declinedBy: isWhite ? 'w' : 'b',
          message: 'Đối thủ đã từ chối lời mời hòa.',
        });
      });

      // 6. GỬI NƯỚC ĐI - KIỂM TRA BẢO MẬT ZERO-TRUST & TÍNH TOÁN CLOCK ENGINE
      socket.on('send_move', async (data: { roomId: string; from: Square; to: Square; promotion?: string }) => {
        if (!data || !data.roomId || !data.from || !data.to) {
          return socket.emit('move_error', { message: 'Dữ liệu nước đi không hợp lệ' });
        }

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

        // 6.4. Kiểm tra tính hợp lệ của nước đi TRƯỚC (C-01 Fix: Không trừ giờ nếu nước đi sai)
        let move;
        try {
          move = room.game.move({
            from: data.from,
            to: data.to,
            promotion: data.promotion || 'q',
          });
        } catch {
          move = null;
        }

        if (!move) {
          return socket.emit('move_error', { message: 'Nước đi không hợp lệ theo luật cờ vua' });
        }

        // 6.5. Tính toán thời gian thực tế đã suy nghĩ (Event-Driven Clock Engine)
        // C-01 Fix: Chỉ trừ giờ SAU KHI nước đi đã được xác nhận hợp lệ
        const serverNow = Date.now();
        const elapsed = Math.max(0, serverNow - room.clock.turnStartedAt);

        if (playerColor === 'w') {
          room.clock.whiteTimeMs = Math.max(0, room.clock.whiteTimeMs - elapsed + room.clock.incrementMs);
          if (room.clock.whiteTimeMs <= 0) {
            room.game.undo(); // Hoàn tác nước đi nếu đã hết giờ trước khi kịp đi
            return this.handleTimeout(room.roomId, 'w');
          }
        } else {
          room.clock.blackTimeMs = Math.max(0, room.clock.blackTimeMs - elapsed + room.clock.incrementMs);
          if (room.clock.blackTimeMs <= 0) {
            room.game.undo(); // Hoàn tác nước đi nếu đã hết giờ trước khi kịp đi
            return this.handleTimeout(room.roomId, 'b');
          }
        }

        // Ghi nhận dữ liệu viễn trắc nước đi chính xác do Máy chủ kiểm soát (Phase 0 Data Foundation)
        if (!room.moveTelemetry) {
          room.moveTelemetry = [];
        }
        const remainingTimeMs = playerColor === 'w' ? room.clock.whiteTimeMs : room.clock.blackTimeMs;
        room.moveTelemetry.push({
          color: playerColor,
          timeSpentMs: elapsed,
          timeLeftMs: remainingTimeMs,
        });

        try {
          // 6.6. Chuyển lượt và cập nhật mốc thời gian
          const nextTurn = room.game.turn();
          room.clock.activeColor = nextTurn;
          room.clock.turnStartedAt = serverNow;
          room.version += 1;
          room.status = 'PLAYING';

          // FIDE 9.1.b: Đi một nước cờ hợp lệ sẽ tự động hủy bất kỳ lời mời hòa nào đang treo
          if (room.drawOfferedBy) {
            room.drawOfferedBy = null;
            this.io.to(data.roomId).emit('draw_cancelled', { roomId: data.roomId });
          }

          const isGameOver = room.game.isGameOver();
          const isCheckmate = room.game.isCheckmate();
          const isDraw = room.game.isDraw();

          // 6.7. Lập lịch phát hiện hết giờ cho lượt tiếp theo (C-02 Fix: Chỉ lập lịch nếu ván chưa kết thúc)
          if (!isGameOver) {
            this.scheduleTimeout(room);
          }

          let eloResult: EloCalculationResult | null = null;
          let winnerColor: 'w' | 'b' | null = null;

          // 6.8. Xử lý kết quả ván đấu nếu kết thúc
          if (isGameOver) {
            let finColor: 'w' | 'b' | 'draw' = 'draw';
            let finReason: 'CHECKMATE' | 'DRAW' = 'DRAW';

            if (isCheckmate) {
              finColor = nextTurn === 'w' ? 'b' : 'w';
              finReason = 'CHECKMATE';
            } else if (isDraw) {
              finColor = room.isArmageddon ? 'b' : 'draw';
              finReason = 'DRAW';
            }

            const res = await this.finalizeMatchEnding(room, data.roomId, finColor, finReason);
            eloResult = res.eloResult;
            winnerColor = finColor === 'draw' ? null : finColor;
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
            isArmageddonDraw: room.isArmageddon && isDraw,
            armageddonWinnerColor: room.isArmageddon && isDraw ? 'b' : undefined,
            isTournament: Boolean(room.tournamentContext),
            moveTimeMs: elapsed,
            eloResult: room.isRated ? eloResult : null,
          });
        } catch (err) {
          socket.emit('move_error', { message: 'Nước đi không hợp lệ' });
        }
      });

      // 6b. CHIA SẺ VÀ ĐỒNG BỘ PHÂN TÍCH NƯỚC ĐI REALTIME GIỮA 2 KỲ THỦ
      socket.on('share_move_analysis', (data: { roomId: string; ply: number; analysis: any }) => {
        if (!data || !data.roomId || !data.ply || !data.analysis) return;
        const room = this.activeRooms.get(data.roomId);
        if (!room) return;

        // Chỉ chấp nhận từ 2 người chơi trong phòng
        const isWhite = room.players.white.socketId === socket.id;
        const isBlack = room.players.black.socketId === socket.id;
        if (!isWhite && !isBlack) return;

        if (!room.liveAnalyses) {
          room.liveAnalyses = {};
        }

        // Canonical single-source of truth: Lấy kết quả đầu tiên được gửi lên
        if (!room.liveAnalyses[data.ply]) {
          room.liveAnalyses[data.ply] = data.analysis;
        }

        // Broadcast bản phân tích chuẩn cho cả 2 bên cùng hiển thị đồng nhất 100%
        this.io.to(data.roomId).emit('sync_move_analysis', {
          roomId: data.roomId,
          ply: data.ply,
          analysis: room.liveAnalyses[data.ply],
        });
      });

      // 7. XỬ LÝ KẾT NỐI LẠI PHÒNG (RECONNECT / F5 GRACE PERIOD)
      socket.on('reconnect_match', (data: { roomId: string; userId?: string; token?: string }) => {
        if (!data || !data.roomId) {
          return socket.emit('reconnect_error', { message: 'Dữ liệu kết nối lại không hợp lệ.' });
        }

        const room = this.activeRooms.get(data.roomId);
        if (!room || room.status === 'FINISHED') {
          return socket.emit('reconnect_error', { message: 'Ván đấu không tồn tại hoặc đã kết thúc.' });
        }

        // S-03: Xác thực danh tính người dùng qua JWT hoặc session
        const verifiedUserId = data.token
          ? verifySocketToken(data.token)
          : ((socket as any).authenticatedUserId as string | null);

        const effectiveUserId = verifiedUserId || data.userId;
        if (!effectiveUserId) {
          return socket.emit('reconnect_error', { message: 'Xác thực thất bại. Vui lòng đăng nhập lại.' });
        }

        const isWhite =
          room.players.white.userId === effectiveUserId ||
          room.players.white.username === effectiveUserId ||
          (Boolean(data.userId) && (room.players.white.userId === data.userId || room.players.white.username === data.userId));

        const isBlack =
          room.players.black.userId === effectiveUserId ||
          room.players.black.username === effectiveUserId ||
          (Boolean(data.userId) && (room.players.black.userId === data.userId || room.players.black.username === data.userId));

        if (!isWhite && !isBlack) {
          return socket.emit('reconnect_error', { message: 'Bạn không thuộc ván đấu này.' });
        }

        const player = isWhite ? room.players.white : room.players.black;
        const opponent = isWhite ? room.players.black : room.players.white;
        const playerKey: 'white' | 'black' = isWhite ? 'white' : 'black';

        // C-03 Fix: Hủy bộ đếm 45s Disconnect của RIÊNG người chơi này
        if (!room.disconnectTimers) room.disconnectTimers = {};
        if (room.disconnectTimers[playerKey]) {
          clearTimeout(room.disconnectTimers[playerKey]);
          room.disconnectTimers[playerKey] = undefined;
        }
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
          isTournament: Boolean(room.tournamentContext),
          isArmageddon: Boolean(room.isArmageddon),
          yourColor: isWhite ? 'w' : 'b',
          liveAnalyses: room.liveAnalyses || {},
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
        this.matchmakingManager.removeFromQueue(socket.id);
        this.friendRoomManager.cleanupOnDisconnect(socket.id);

        for (const [uid, sock] of this.userSockets.entries()) {
          if (sock.id === socket.id) {
            this.userSockets.delete(uid);
            break;
          }
        }

        // M-03 Fix: Lấy roomId TRƯỚC, rồi xóa socketToRoom
        const roomId = this.socketToRoom.get(socket.id);
        this.socketToRoom.delete(socket.id);

        if (roomId) {
          const room = this.activeRooms.get(roomId);
          if (room && (room.status === 'PLAYING' || room.status === 'RECONNECTING')) {
            const isWhite = room.players.white.socketId === socket.id;
            const isBlack = room.players.black.socketId === socket.id;

            if (isWhite || isBlack) {
              const disconnectedPlayer = isWhite ? room.players.white : room.players.black;
              const playerKey: 'white' | 'black' = isWhite ? 'white' : 'black';
              disconnectedPlayer.isConnected = false;
              disconnectedPlayer.disconnectedAt = Date.now();
              room.status = 'RECONNECTING';

              console.log(`⚠️ [Disconnect] ${disconnectedPlayer.username} mất kết nối phòng ${roomId}. Bắt đầu 45s Grace Period...`);

              // Thông báo cho đối thủ đang trong phòng
              this.io.to(roomId).emit('player_disconnected', {
                disconnectedPlayer: disconnectedPlayer.username,
                gracePeriodSeconds: 45,
                message: `Đối thủ (${disconnectedPlayer.username}) tạm mất kết nối. Đang chờ 45s để kết nối lại...`,
              });

              // C-03 Fix: Quản lý timer disconnect riêng cho từng bên
              if (!room.disconnectTimers) room.disconnectTimers = {};
              if (room.disconnectTimers[playerKey]) {
                clearTimeout(room.disconnectTimers[playerKey]);
              }

              // Cho phép 45 giây để F5 / kết nối lại trước khi xử thua
              room.disconnectTimers[playerKey] = setTimeout(() => {
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
    if (room.disconnectTimers?.white) clearTimeout(room.disconnectTimers.white);
    if (room.disconnectTimers?.black) clearTimeout(room.disconnectTimers.black);
    if (room.reconnectTimer) clearTimeout(room.reconnectTimer);

    const opponentColor: 'w' | 'b' = timedOutColor === 'w' ? 'b' : 'w';
    const opponentPlayer = opponentColor === 'w' ? room.players.white : room.players.black;
    const timedOutPlayer = timedOutColor === 'w' ? room.players.white : room.players.black;

    // FIDE Article 6.9: Nếu bên còn giờ không đủ lực lượng chiếu hết, ván cờ xử HÒA
    const isOpponentInsufficient = isPlayerInsufficientToMate(room.game, opponentColor);
    let finalWinnerColor: 'w' | 'b' | 'draw' = opponentColor;

    if (room.isArmageddon) {
      // Trong Armageddon: Đen có Draw Odds. Nếu Trắng hết giờ -> Đen thắng. Nếu Đen hết giờ nhưng Trắng không đủ quân -> Hòa (Đen thắng).
      finalWinnerColor = isOpponentInsufficient ? 'b' : opponentColor;
    } else if (isOpponentInsufficient) {
      finalWinnerColor = 'draw';
    }

    const isDrawMatch = finalWinnerColor === 'draw';
    console.log(`⏱️ [Timeout] Phòng ${roomId}: ${timedOutPlayer.username} (${timedOutColor === 'w' ? 'Trắng' : 'Đen'}) hết giờ. Kết quả: ${isDrawMatch ? 'HÒA (FIDE 6.9 Insufficient Material)' : 'Thắng: ' + opponentPlayer.username}`);

    const endReason = isDrawMatch ? 'DRAW' : 'TIMEOUT';
    const timeoutMsg = isDrawMatch
      ? `Người chơi ${timedOutPlayer.username} đã hết thời gian thi đấu, nhưng đối phương không đủ quân để chiếu hết. Tỷ số hòa.`
      : `Người chơi ${timedOutPlayer.username} đã hết thời gian thi đấu. Bạn thắng!`;

    const { eloResult } = await this.finalizeMatchEnding(room, roomId, finalWinnerColor, endReason);

    const timeoutPayload = {
      roomId,
      winnerColor: finalWinnerColor,
      winnerName: isDrawMatch ? 'Hòa cờ' : opponentPlayer.username,
      loserName: timedOutPlayer.username,
      reason: endReason,
      message: timeoutMsg,
      isDraw: isDrawMatch,
      eloResult: room.isRated ? eloResult : null,
      isTournament: Boolean(room.tournamentContext),
      isArmageddon: Boolean(room.isArmageddon),
    };

    this.io.to(roomId).emit('opponent_resigned', timeoutPayload);
    if (room.players.white.socketId) this.io.to(room.players.white.socketId).emit('opponent_resigned', timeoutPayload);
    if (room.players.black.socketId) this.io.to(room.players.black.socketId).emit('opponent_resigned', timeoutPayload);
  }

  // Dọn dẹp tài nguyên phòng thi đấu an toàn (Safe Conditional Cleanup & Memory Deallocation)
  private cleanupRoomResources(room: GameState, targetRoomId: string) {
    // 1. Hủy các bộ đếm thời gian đang chạy ngầm của ván cờ
    if (room.timeoutTimer) {
      clearTimeout(room.timeoutTimer);
      room.timeoutTimer = undefined;
    }
    if (room.disconnectTimers?.white) {
      clearTimeout(room.disconnectTimers.white);
      room.disconnectTimers.white = undefined;
    }
    if (room.disconnectTimers?.black) {
      clearTimeout(room.disconnectTimers.black);
      room.disconnectTimers.black = undefined;
    }
    if (room.reconnectTimer) {
      clearTimeout(room.reconnectTimer);
      room.reconnectTimer = undefined;
    }

    // 2. Chờ 5 giây trước khi giải phóng socket room và activeRooms để đảm bảo các thông báo kết thúc ván đến được cả hai kỳ thủ
    setTimeout(() => {
      try {
        const sockW = this.io.sockets.sockets.get(room.players.white.socketId);
        const sockB = this.io.sockets.sockets.get(room.players.black.socketId);
        if (sockW) sockW.leave(targetRoomId);
        if (sockB) sockB.leave(targetRoomId);

        // 3. Xóa mapping socketToRoom có điều kiện
        if (this.socketToRoom.get(room.players.white.socketId) === targetRoomId) {
          this.socketToRoom.delete(room.players.white.socketId);
        }
        if (this.socketToRoom.get(room.players.black.socketId) === targetRoomId) {
          this.socketToRoom.delete(room.players.black.socketId);
        }

        // 4. Xóa Friend Room active nếu có
        if (room.friendRoomCode) {
          this.friendRoomManager.releaseActiveMatch(room.friendRoomCode);
        }

        // 5. Xóa GameState khỏi activeRooms
        this.activeRooms.delete(targetRoomId);
      } catch (err) {
        console.error('Lỗi khi dọn dẹp phòng:', err);
      }
    }, 5000);
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

  // Xử lý khi người chơi Đầu hàng hoặc F5 / Thoát web (B-01 Fix: hỗ trợ resignedColor trực tiếp)
  private async handlePlayerResignation(
    socketId: string,
    roomId: string,
    reason: 'RESIGNATION' | 'DISCONNECT',
    resignedColor?: 'w' | 'b'
  ) {
    const room = this.activeRooms.get(roomId);
    if (!room || room.status === 'FINISHED') return;

    let isWhiteResigned: boolean;
    if (resignedColor) {
      isWhiteResigned = resignedColor === 'w';
    } else {
      const isWhite = room.players.white.socketId === socketId;
      const isBlack = room.players.black.socketId === socketId;
      if (!isWhite && !isBlack) {
        console.warn(`⚠️ [Resignation] Socket ${socketId} không thuộc phòng ${roomId}. Từ chối yêu cầu đầu hàng.`);
        return;
      }
      isWhiteResigned = isWhite;
    }

    const winnerColor = isWhiteResigned ? 'b' : 'w';
    const winnerPlayer = isWhiteResigned ? room.players.black : room.players.white;
    const loserPlayer = isWhiteResigned ? room.players.white : room.players.black;
    const endReason = reason === 'DISCONNECT' ? 'ABANDONED' : 'RESIGNED';

    console.log(`🏳️ [Resignation] Phòng ${roomId} (${room.isRated ? 'Rated' : 'Unrated Friend'}): ${loserPlayer.username} (${reason === 'DISCONNECT' ? 'Thoát/F5 Web' : 'Đầu hàng'}). Thắng: ${winnerPlayer.username}`);

    const { eloResult } = await this.finalizeMatchEnding(room, roomId, winnerColor, endReason);

    const resPayload = {
      roomId,
      winnerColor,
      winnerName: winnerPlayer.username,
      loserName: loserPlayer.username,
      reason,
      message: reason === 'DISCONNECT' 
        ? `Đối thủ ${loserPlayer.username} đã rời trận do quá thời gian chờ kết nối lại. Bạn thắng!` 
        : `Đối thủ ${loserPlayer.username} đã đầu hàng. Bạn thắng!`,
      eloResult: room.isRated ? eloResult : null,
      isTournament: Boolean(room.tournamentContext),
      isArmageddon: Boolean(room.isArmageddon),
    };

    this.io.to(roomId).emit('opponent_resigned', resPayload);
    if (room.players.white.socketId) this.io.to(room.players.white.socketId).emit('opponent_resigned', resPayload);
    if (room.players.black.socketId) this.io.to(room.players.black.socketId).emit('opponent_resigned', resPayload);
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
        tournamentId: room.tournamentContext?.tournamentId,
        tournamentRound: room.tournamentContext?.roundNumber,
        tournamentMatchIndex: room.tournamentContext?.matchIndex,
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
        moveTelemetry: room.moveTelemetry || [],
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

  // Helper hợp nhất vòng đời kết thúc ván cờ (Tối ưu hóa Code Architecture)
  private async finalizeMatchEnding(
    room: GameState,
    roomId: string,
    winnerColor: 'w' | 'b' | 'draw',
    endReason: 'CHECKMATE' | 'TIMEOUT' | 'RESIGNED' | 'ABANDONED' | 'DRAW'
  ): Promise<{ eloResult: EloCalculationResult | null; savedMatchId?: string }> {
    room.status = 'FINISHED';
    room.winnerColor = winnerColor;
    room.endReason = endReason;
    room.drawOfferedBy = null;

    if (room.timeoutTimer) clearTimeout(room.timeoutTimer);
    if (room.disconnectTimers?.white) clearTimeout(room.disconnectTimers.white);
    if (room.disconnectTimers?.black) clearTimeout(room.disconnectTimers.black);
    if (room.reconnectTimer) clearTimeout(room.reconnectTimer);

    let eloResult: EloCalculationResult | null = null;
    if (room.isRated) {
      if (winnerColor === 'draw') {
        eloResult = calculateElo(room.players.white.eloRating, room.players.black.eloRating, 'd');
        await this.updateUserElo(room.players.white.userId, eloResult.white.delta, 'draw');
        await this.updateUserElo(room.players.black.userId, eloResult.black.delta, 'draw');
      } else {
        eloResult = calculateElo(room.players.white.eloRating, room.players.black.eloRating, winnerColor);
        const winPlayer = winnerColor === 'w' ? room.players.white : room.players.black;
        const losePlayer = winnerColor === 'w' ? room.players.black : room.players.white;
        await this.updateUserElo(winPlayer.userId, winnerColor === 'w' ? eloResult.white.delta : eloResult.black.delta, 'win');
        await this.updateUserElo(losePlayer.userId, winnerColor === 'w' ? eloResult.black.delta : eloResult.white.delta, 'lose');
      }
    }

    let savedMatchId: string | undefined;
    try {
      savedMatchId = await this.persistMatchRecord(room, winnerColor, endReason, eloResult);
      if (room.tournamentContext) {
        await this.tournamentMatchManager.handleTournamentMatchEnd(room, winnerColor, savedMatchId);
      }
    } catch (e) {
      console.error('❌ Lỗi khi lưu bản ghi hoặc báo cáo giải đấu:', e);
    } finally {
      this.cleanupRoomResources(room, roomId);
    }

    return { eloResult, savedMatchId };
  }

  // Dọn dẹp Timer khi ứng dụng tắt
  public destroy() {
    if (this.matchmakerTimer) {
      clearInterval(this.matchmakerTimer);
    }

    this.tournamentMatchManager.destroy();

    for (const room of this.activeRooms.values()) {
      if (room.timeoutTimer) clearTimeout(room.timeoutTimer);
      if (room.disconnectTimers?.white) clearTimeout(room.disconnectTimers.white);
      if (room.disconnectTimers?.black) clearTimeout(room.disconnectTimers.black);
    }
    this.activeRooms.clear();
  }
}
