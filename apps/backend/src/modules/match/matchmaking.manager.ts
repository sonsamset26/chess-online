import { Server, Socket } from 'socket.io';
import { Chess } from 'chess.js';
import {
  GameState,
  QueueEntry,
  PlayerState,
  TimeControlConfig,
  ELO_WINDOW_STEPS,
} from './match.types';

export class MatchmakingManager {
  // waitingQueue là state riêng của manager này (cách (a) theo spec)
  private waitingQueue: QueueEntry[] = [];

  constructor(
    private io: Server,
    private activeRooms: Map<string, GameState>,
    private socketToRoom: Map<string, string>,
    private scheduleTimeout: (room: GameState) => void
  ) {}

  // Đăng ký các socket event liên quan đến ghép trận
  public registerHandlers(socket: Socket): void {
    // 1. Gia nhập hàng chờ ghép trận theo Elo Window (ĐẤU XẾP HẠNG ONLINE)
    socket.on('join_queue', (data: {
      userId?: string;
      username?: string;
      eloRating?: number;
      timeControl?: { initialTimeMs?: number; incrementMs?: number };
    }) => {
      let verifiedUserId = (socket as any).authenticatedUserId;
      if (!verifiedUserId && data?.userId && !data.userId.startsWith('guest_')) {
        verifiedUserId = data.userId;
        (socket as any).authenticatedUserId = verifiedUserId;
      }
      if (!verifiedUserId || verifiedUserId.startsWith('guest_')) {
        return socket.emit('queue_error', { message: 'Cần đăng nhập để tham gia xếp hạng.' });
      }

      const timeControl: TimeControlConfig = {
        initialTimeMs: data?.timeControl?.initialTimeMs || 600000,
        incrementMs: data?.timeControl?.incrementMs || 0,
      };

      const entry: QueueEntry = {
        socketId: socket.id,
        userId: verifiedUserId,
        username: (data as any)?.username || 'Người chơi',
        eloRating: (data as any)?.eloRating || 1200,
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
  }

  // Gọi từ disconnect handler ở gateway core để dọn queue khi socket đứt
  public removeFromQueue(socketId: string): void {
    this.waitingQueue = this.waitingQueue.filter((p) => p.socketId !== socketId);
  }

  // Thuật toán Ghép trận theo khung Elo mở rộng (Expanding Elo Window Matchmaker)
  public processMatchmakingQueue(): void {
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

  private getEloWindowDelta(joinedAt: number): number {
    const elapsedSec = Math.max(0, (Date.now() - joinedAt) / 1000);
    for (const step of ELO_WINDOW_STEPS) {
      if (elapsedSec <= step.maxWaitSeconds) {
        return step.delta;
      }
    }
    return 400;
  }

  // Khởi tạo phòng thi đấu cho cặp đấu thỏa mãn Elo Window
  private createMatchedGame(p1: QueueEntry, p2: QueueEntry): void {
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
}
