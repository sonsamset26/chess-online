import { Server, Socket } from 'socket.io';
import { Chess } from 'chess.js';
import { GameState, PlayerState, TimeControlConfig } from './match.types';
import { verifySocketToken } from './match.utils';
import { TournamentService } from '../tournament/tournament.service';
import { Tournament } from '../tournament/tournament.model';

export class TournamentMatchManager {
  private activeTournamentTimers: Map<string, NodeJS.Timeout> = new Map(); // tournamentId -> Timer 30s

  constructor(
    private io: Server,
    private activeRooms: Map<string, GameState>,
    private socketToRoom: Map<string, string>,
    private userSockets: Map<string, Socket>,
    private scheduleTimeout: (room: GameState) => void,
    private handlePlayerResignation: (socketId: string, roomId: string, reason: 'RESIGNATION' | 'DISCONNECT') => void,
    private cleanupRoomResources: (room: GameState, roomId: string) => void
  ) {}

  // Đăng ký các socket event liên quan đến giải đấu
  public registerHandlers(socket: Socket): void {
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
        const mongoose = require('mongoose');
        const { User } = require('../user/user.model');
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

    // 4b1. HỦY GIẢI ĐẤU (CHỈ CHỦ PHÒNG KHI ĐANG Ở SẢNH CHỜ WAITING)
    socket.on('cancel_tournament', async (data: { code: string; token?: string }) => {
      try {
        if (!data?.code) {
          return socket.emit('tournament_error', { message: 'Mã giải đấu không hợp lệ.' });
        }

        let verifiedUserId = (socket as any).authenticatedUserId;
        if (!verifiedUserId && data.token) {
          verifiedUserId = verifySocketToken(data.token);
        }

        if (!verifiedUserId || verifiedUserId.startsWith('guest_')) {
          return socket.emit('tournament_error', { message: 'Xác thực thất bại. Vui lòng đăng nhập lại.' });
        }

        const tournament = await TournamentService.cancelTournament(data.code, verifiedUserId);

        if (this.activeTournamentTimers.has(tournament.tournamentId)) {
          clearTimeout(this.activeTournamentTimers.get(tournament.tournamentId)!);
          this.activeTournamentTimers.delete(tournament.tournamentId);
        }

        console.log(`🏆 [Tournament] Chủ phòng ${verifiedUserId} đã hủy giải đấu ${tournament.code}`);
        this.io.to(`tournament_${tournament.tournamentId}`).emit('tournament_cancelled', {
          tournamentId: tournament.tournamentId,
          code: tournament.code,
          message: 'Chủ phòng đã hủy giải đấu',
        });
      } catch (err: any) {
        socket.emit('tournament_error', { message: err?.message || 'Không thể hủy giải đấu' });
      }
    });

    // 4b2. RỜI KHỎI GIẢI ĐẤU (KHI ĐANG Ở SẢNH CHỜ WAITING)
    socket.on('leave_tournament', async (data: { code: string; token?: string }) => {
      try {
        if (!data?.code) {
          return socket.emit('tournament_error', { message: 'Mã giải đấu không hợp lệ.' });
        }

        let verifiedUserId = (socket as any).authenticatedUserId;
        if (!verifiedUserId && data.token) {
          verifiedUserId = verifySocketToken(data.token);
        }

        if (!verifiedUserId || verifiedUserId.startsWith('guest_')) {
          return socket.emit('tournament_error', { message: 'Xác thực thất bại. Vui lòng đăng nhập lại.' });
        }

        const tournament = await TournamentService.leaveTournament(data.code, verifiedUserId);
        socket.leave(`tournament_${tournament.tournamentId}`);

        if (tournament.status === 'CANCELLED') {
          console.log(`🏆 [Tournament] Chủ phòng ${verifiedUserId} rời đi -> Hủy giải đấu ${tournament.code}`);
          this.io.to(`tournament_${tournament.tournamentId}`).emit('tournament_cancelled', {
            tournamentId: tournament.tournamentId,
            code: tournament.code,
            message: 'Chủ phòng đã rời đi, giải đấu đã bị hủy',
          });
        } else {
          console.log(`🏆 [Tournament] Người chơi ${verifiedUserId} đã rời phòng giải đấu ${tournament.code}`);
          this.io.to(`tournament_${tournament.tournamentId}`).emit('tournament_updated', { tournament });
        }
      } catch (err: any) {
        socket.emit('tournament_error', { message: err?.message || 'Không thể rời giải đấu' });
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

        // M-04 Fix: Lưu timer vào activeTournamentTimers để có thể clear nếu giải bị hủy
        if (this.activeTournamentTimers.has(tournament.tournamentId)) {
          clearTimeout(this.activeTournamentTimers.get(tournament.tournamentId)!);
        }
        const round1Timer = setTimeout(() => {
          this.activeTournamentTimers.delete(tournament.tournamentId);
          // Tạo phòng thi đấu cho các cặp đấu vòng 1 sau khi hết thời gian chờ
          for (let mIdx = 0; mIdx < round1Matches.length; mIdx++) {
            const m = round1Matches[mIdx];
            if (m.player1 && m.player2 && m.status === 'PENDING') {
              this.startTournamentMatch(tournament, 1, mIdx, m.player1, m.player2);
            }
          }
        }, countdownSeconds * 1000);
        this.activeTournamentTimers.set(tournament.tournamentId, round1Timer);
      } catch (err: any) {
        socket.emit('tournament_error', { message: err?.message || 'Không thể bắt đầu giải đấu' });
      }
    });
  }

  // Báo cáo kết quả giải đấu và kích hoạt vòng mới hoặc Armageddon
  public async handleTournamentMatchEnd(
    room: GameState,
    winnerColor: 'w' | 'b' | 'draw',
    savedMatchId?: string
  ) {
    if (!room.tournamentContext) return;

    // Nếu ván chính hòa và không phải Armageddon -> Lưu ván chính vào bracket trước khi tổ chức ván Armageddon phân định
    if (winnerColor === 'draw' && !room.isArmageddon) {
      console.log(`⚔️ [Tournament] Trận đấu ${room.roomId} kết thúc HÒA. Lưu ván chính và bắt đầu ván phụ Armageddon!`);
      if (savedMatchId) {
        await TournamentService.linkMainMatch(room.tournamentContext, savedMatchId);
      }
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
          // SINGLETON TIMER GUARD: Tránh tạo nhiều timer đếm ngược song song cho cùng 1 giải
          if (this.activeTournamentTimers.has(tournamentId)) {
            return;
          }

          // 1. TẠO NGAY VÒNG MỚI ĐỂ HIỂN THỊ CẶP ĐẤU TRÊN BRACKET TRONG KHI ĐỢI
          const adv = await TournamentService.advanceNextRound(tournamentId);
          const currentTournament = adv.tournament || result.tournament;

          if (currentTournament.status === 'FINISHED') {
            console.log(`🏆 [Tournament] Giải đấu ${tournamentId} kết thúc! Vô địch: ${currentTournament.championId}`);
            this.io.to(`tournament_${tournamentId}`).emit('tournament_finished', {
              tournament: currentTournament,
              championId: currentTournament.championId,
            });
            this.io.to(`tournament_${tournamentId}`).emit('tournament_updated', {
              tournament: currentTournament,
            });
            return;
          }

          // Emit bản cập nhật giải đấu có ngay vòng mới và cặp đấu mới!
          this.io.to(`tournament_${tournamentId}`).emit('tournament_updated', {
            tournament: currentTournament,
          });

          // Bắt đầu đếm ngược 30 giây nghỉ giữa 2 vòng (dựa trên mốc thời gian tuyệt đối)
          const countdownSeconds = 30;
          const targetTimestamp = currentTournament.roundBreakUntil
            ? new Date(currentTournament.roundBreakUntil).getTime()
            : Date.now() + 30000;
          const serverNow = Date.now();

          console.log(`⏳ [Tournament] Vòng hoàn thành và đã tạo vòng ${adv.nextRound?.roundNumber || ''}. Đếm ngược ${countdownSeconds}s trước khi vào bàn cờ...`);
          this.io.to(`tournament_${tournamentId}`).emit('round_countdown', {
            nextRound: adv.nextRound?.roundNumber || currentTournament.rounds.length,
            countdownSeconds,
            targetTimestamp,
            serverTimestamp: serverNow,
          });

          const timer = setTimeout(async () => {
            this.activeTournamentTimers.delete(tournamentId);
            try {
              if (adv.nextRound) {
                // Khởi tạo các ván đấu của vòng mới sau khi hết 30s đếm ngược
                for (let mIdx = 0; mIdx < adv.nextRound.matches.length; mIdx++) {
                  const m = adv.nextRound.matches[mIdx];
                  if (m.player1 && m.player2 && m.status === 'PENDING') {
                    this.startTournamentMatch(currentTournament, adv.nextRound.roundNumber, mIdx, m.player1, m.player2);
                  }
                }
              }
            } catch (err) {
              console.error('❌ [Tournament] Lỗi khởi tạo trận đấu sau đếm ngược:', err);
            }
          }, countdownSeconds * 1000);

          this.activeTournamentTimers.set(tournamentId, timer);
        }
      }
    } catch (err) {
      console.error('❌ [Tournament] Lỗi báo cáo kết quả trận đấu:', err);
    }
  }

  // Khởi tạo ván cờ Armageddon phân định khi hòa
  public startArmageddonMatch(prevRoom: GameState) {
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
    if (prevRoom.disconnectTimers?.white) {
      clearTimeout(prevRoom.disconnectTimers.white);
      prevRoom.disconnectTimers.white = undefined;
    }
    if (prevRoom.disconnectTimers?.black) {
      clearTimeout(prevRoom.disconnectTimers.black);
      prevRoom.disconnectTimers.black = undefined;
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
  public startTournamentMatch(
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

    // Cập nhật trạng thái trận đấu trong MongoDB sang PLAYING
    Tournament.updateOne(
      { tournamentId: tournament.tournamentId, 'rounds.roundNumber': roundNumber },
      { $set: { [`rounds.$[r].matches.${matchIndex}.status`]: 'PLAYING' } },
      { arrayFilters: [{ 'r.roundNumber': roundNumber }] }
    ).catch((e: any) => console.error('Lỗi cập nhật status PLAYING cho trận đấu:', e));

    const isP1Online = !!socket1?.connected;
    const isP2Online = !!socket2?.connected;

    if (socket1) socket1.emit('match_found', { ...matchPayload, yourColor: 'w' });
    if (socket2) socket2.emit('match_found', { ...matchPayload, yourColor: 'b' });

    // OFFLINE PLAYER HANDLING:
    // 1. Nếu CẢ HAI kỳ thủ đều offline -> Xử Double Forfeit, không ai được thắng khống
    if (!isP1Online && !isP2Online) {
      console.log(`⚠️ [Tournament] Cả 2 kỳ thủ ${player1Id} và ${player2Id} đều offline -> Double Forfeit.`);
      room.status = 'FINISHED';
      this.cleanupRoomResources(room, roomId);
      TournamentService.reportMatchResult(
        room.tournamentContext!,
        '',
        undefined,
        false
      ).catch((e) => console.error('Lỗi reportMatchResult khi double forfeit:', e));
      return;
    }

    // 2. Nếu có 1 kỳ thủ offline, chuyển sang RECONNECTING và kích hoạt Grace Period 45s để xử thua vắng mặt (Walkover)
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

      if (!room.disconnectTimers) room.disconnectTimers = {};
      const offlineKey: 'white' | 'black' = !isP1Online ? 'white' : 'black';
      room.disconnectTimers[offlineKey] = setTimeout(() => {
        console.log(`⏰ [Tournament Walkover] ${offlinePlayer.username} không vào bàn sau 45s -> Xử thua vắng mặt.`);
        this.handlePlayerResignation(offlinePlayer.socketId || '', roomId, 'DISCONNECT');
      }, 45000);

      // Tuyệt đối không khởi động đồng hồ 10 phút khi chưa đủ người
      return;
    }

    this.scheduleTimeout(room);
  }

  // Dọn dẹp Tournament Timers khi ứng dụng tắt
  public destroy(): void {
    for (const timer of this.activeTournamentTimers.values()) {
      clearTimeout(timer);
    }
    this.activeTournamentTimers.clear();
  }
}
