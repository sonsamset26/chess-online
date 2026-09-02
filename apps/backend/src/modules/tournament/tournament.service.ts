import crypto from 'crypto';
import { Tournament, ITournament, ITournamentMatch, ITournamentRound } from './tournament.model';

export class TournamentService {
  /**
   * Tạo mã phòng giải đấu gồm 6 ký tự viết hoa ngẫu nhiên
   */
  private static generateUniqueCode(): string {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  /**
   * Khởi tạo giải đấu mới
   */
  public static async createTournament(
    hostUserId: string,
    hostUsername: string,
    hostElo: number = 1200,
    size: 4 | 8 = 4
  ): Promise<ITournament> {
    let code = this.generateUniqueCode();
    let existing = await Tournament.findOne({ code });
    while (existing) {
      code = this.generateUniqueCode();
      existing = await Tournament.findOne({ code });
    }

    const tournamentId = `tour_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const tournament = new Tournament({
      tournamentId,
      code,
      hostUserId,
      hostUsername,
      size,
      status: 'WAITING',
      players: [
        {
          userId: hostUserId,
          username: hostUsername,
          eloRating: hostElo,
        },
      ],
      rounds: [],
      championId: null,
    });

    await tournament.save();
    return tournament;
  }

  /**
   * Lấy thông tin giải đấu theo mã phòng
   */
  public static async getTournamentByCode(code: string): Promise<ITournament | null> {
    return Tournament.findOne({ code: code.toUpperCase() });
  }

  /**
   * Tham gia giải đấu bằng mã code
   */
  public static async joinTournament(
    code: string,
    user: { userId: string; username: string; eloRating: number }
  ): Promise<ITournament> {
    const tournament = await Tournament.findOne({ code: code.toUpperCase() });
    if (!tournament) {
      throw { statusCode: 404, message: 'Không tìm thấy phòng giải đấu với mã này' };
    }

    if (tournament.status !== 'WAITING') {
      throw { statusCode: 400, message: 'Giải đấu đã bắt đầu hoặc đã kết thúc' };
    }

    // Kiểm tra xem user đã trong phòng chưa
    const alreadyJoined = tournament.players.some((p) => p.userId === user.userId);
    if (alreadyJoined) {
      return tournament;
    }

    if (tournament.players.length >= tournament.size) {
      throw { statusCode: 400, message: 'Phòng giải đấu đã đủ số lượng người tham gia' };
    }

    tournament.players.push({
      userId: user.userId,
      username: user.username,
      eloRating: user.eloRating || 1200,
    });

    await tournament.save();
    return tournament;
  }

  /**
   * Bắt đầu giải đấu, sinh bracket vòng 1 và xử lý trường hợp Bye (người lẻ)
   */
  public static async startTournament(
    code: string,
    requestingUserId: string
  ): Promise<{
    tournament: ITournament;
    round1Matches: ITournamentMatch[];
  }> {
    const tournament = await Tournament.findOne({ code: code.toUpperCase() });
    if (!tournament) {
      throw { statusCode: 404, message: 'Không tìm thấy giải đấu' };
    }

    if (tournament.hostUserId !== requestingUserId) {
      throw { statusCode: 403, message: 'Chỉ chủ phòng mới có quyền bắt đầu giải đấu' };
    }

    if (tournament.status !== 'WAITING') {
      throw { statusCode: 400, message: 'Giải đấu đã được bắt đầu trước đó' };
    }

    if (tournament.players.length < 2) {
      throw { statusCode: 400, message: 'Cần tối thiểu 2 người chơi để bắt đầu giải đấu' };
    }

    // Xáo trộn ngẫu nhiên danh sách người chơi
    const shuffled = [...tournament.players].sort(() => Math.random() - 0.5);
    const targetMatchesCount = tournament.size === 8 ? 4 : 2;
    const round1Matches: ITournamentMatch[] = [];

    for (let i = 0; i < targetMatchesCount; i++) {
      const p1 = shuffled[i * 2]?.userId || null;
      const p2 = shuffled[i * 2 + 1]?.userId || null;

      if (p1 && !p2) {
        // Trận Bye: 1 người tự động qua vòng, không tạo match trong DB
        round1Matches.push({
          matchId: null,
          player1: p1,
          player2: null,
          winnerId: p1,
          status: 'DONE',
        });
      } else if (p1 && p2) {
        round1Matches.push({
          matchId: null, // Sẽ gán khi tạo room thi đấu
          player1: p1,
          player2: p2,
          winnerId: null,
          status: 'PENDING',
        });
      }
    }

    tournament.status = 'IN_PROGRESS';
    tournament.rounds = [
      {
        roundNumber: 1,
        matches: round1Matches,
      },
    ];

    await tournament.save();
    return {
      tournament,
      round1Matches,
    };
  }

  /**
   * Báo cáo kết quả ván cờ từ MatchGateway
   */
  public static async reportMatchResult(
    tournamentContext: { tournamentId: string; roundNumber: number; matchIndex: number },
    winnerId: string,
    matchId?: string,
    isArmageddon: boolean = false
  ): Promise<{
    tournament: ITournament;
    isRoundFinished: boolean;
    isTournamentFinished: boolean;
    championId: string | null;
  }> {
    const { tournamentId, roundNumber, matchIndex } = tournamentContext;
    const tournament = await Tournament.findOne({ tournamentId });
    if (!tournament) {
      throw new Error(`Tournament ${tournamentId} không tồn tại`);
    }

    const round = tournament.rounds.find((r) => r.roundNumber === roundNumber);
    if (!round || !round.matches[matchIndex]) {
      throw new Error(`Trận đấu vòng ${roundNumber} index ${matchIndex} không tồn tại`);
    }

    const targetMatch = round.matches[matchIndex];
    if (isArmageddon) {
      targetMatch.armageddonMatchId = matchId;
    } else if (matchId) {
      targetMatch.matchId = matchId;
    }

    targetMatch.winnerId = winnerId;
    targetMatch.status = 'DONE';

    // Kiểm tra xem toàn bộ các trận trong vòng hiện tại đã kết thúc chưa
    const isRoundFinished = round.matches.every((m) => m.status === 'DONE' && m.winnerId !== null);
    let isTournamentFinished = false;
    let championId: string | null = null;

    if (isRoundFinished) {
      // Nếu vòng hiện tại chỉ có 1 trận đấu (Chung kết)
      if (round.matches.length === 1) {
        tournament.status = 'FINISHED';
        tournament.championId = winnerId;
        isTournamentFinished = true;
        championId = winnerId;
      }
    }

    await tournament.save();
    return {
      tournament,
      isRoundFinished,
      isTournamentFinished,
      championId,
    };
  }

  /**
   * Tạo vòng đấu kế tiếp sau khi hết 30 giây countdown
   */
  public static async advanceNextRound(tournamentId: string): Promise<{
    tournament: ITournament;
    nextRound: ITournamentRound | null;
  }> {
    const tournament = await Tournament.findOne({ tournamentId });
    if (!tournament || tournament.status !== 'IN_PROGRESS') {
      return { tournament: tournament as any, nextRound: null };
    }

    const currentRoundNumber = tournament.rounds.length;
    const currentRound = tournament.rounds[currentRoundNumber - 1];

    if (!currentRound) {
      return { tournament, nextRound: null };
    }

    // Lấy danh sách người chiến thắng của vòng trước
    const winners = currentRound.matches.map((m) => m.winnerId).filter(Boolean) as string[];

    if (winners.length < 2) {
      // Đã có nhà vô địch hoặc không đủ người
      if (winners.length === 1) {
        tournament.status = 'FINISHED';
        tournament.championId = winners[0];
        await tournament.save();
      }
      return { tournament, nextRound: null };
    }

    const nextRoundMatches: ITournamentMatch[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      nextRoundMatches.push({
        matchId: null,
        player1: winners[i],
        player2: winners[i + 1] || null,
        winnerId: winners[i + 1] ? null : winners[i],
        status: winners[i + 1] ? 'PENDING' : 'DONE',
      });
    }

    const nextRound: ITournamentRound = {
      roundNumber: currentRoundNumber + 1,
      matches: nextRoundMatches,
    };

    tournament.rounds.push(nextRound);
    await tournament.save();

    return {
      tournament,
      nextRound,
    };
  }
}
