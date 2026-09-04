import crypto from 'crypto';
import mongoose from 'mongoose';
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
    // D-02 Fix: Kiểm tra rejoin không cần atomic
    const existing = await Tournament.findOne({ code: code.toUpperCase() });
    if (!existing) {
      throw { statusCode: 404, message: 'Không tìm thấy phòng giải đấu với mã này' };
    }

    // Nếu user đã có trong giải đấu, luôn cho phép lấy thông tin giải và rejoin
    const alreadyJoined = existing.players.some((p) => p.userId === user.userId);
    if (alreadyJoined) {
      return existing;
    }

    // D-02 Fix: Atomic findOneAndUpdate đảm bảo không vượt quá size
    const newPlayer = {
      userId: user.userId,
      username: user.username,
      eloRating: user.eloRating || 1200,
    };

    const updated = await Tournament.findOneAndUpdate(
      {
        code: code.toUpperCase(),
        status: 'WAITING',
        'players.userId': { $ne: user.userId }, // Chưa có trong danh sách
        $expr: { $lt: [{ $size: '$players' }, '$size'] }, // Chưa đủ người
      },
      { $push: { players: newPlayer } },
      { new: true }
    );

    if (!updated) {
      // Có thể do: đã đầy, đã bắt đầu, hoặc đã join từ request song song
      const current = await Tournament.findOne({ code: code.toUpperCase() });
      if (!current) throw { statusCode: 404, message: 'Không tìm thấy phòng giải đấu với mã này' };
      if (current.players.some((p) => p.userId === user.userId)) return current;
      if (current.status !== 'WAITING') throw { statusCode: 400, message: 'Giải đấu đã bắt đầu hoặc đã kết thúc' };
      throw { statusCode: 400, message: 'Phòng giải đấu đã đủ số lượng người tham gia' };
    }

    return updated;
  }

  /**
   * Hủy giải đấu (chỉ Chủ phòng khi giải đang ở sảnh chờ WAITING)
   */
  public static async cancelTournament(
    code: string,
    requestingUserId: string
  ): Promise<ITournament> {
    const tournament = await Tournament.findOne({ code: code.toUpperCase() });
    if (!tournament) {
      throw { statusCode: 404, message: 'Không tìm thấy phòng giải đấu' };
    }

    const isHost =
      tournament.hostUserId === requestingUserId ||
      tournament.hostUsername === requestingUserId;
    if (!isHost) {
      throw { statusCode: 403, message: 'Chỉ chủ phòng mới có quyền hủy giải đấu' };
    }

    if (tournament.status !== 'WAITING') {
      throw { statusCode: 400, message: 'Không thể hủy giải đấu đã bắt đầu hoặc đã kết thúc' };
    }

    const updated = await Tournament.findOneAndUpdate(
      { code: code.toUpperCase(), status: 'WAITING' },
      { $set: { status: 'CANCELLED' } },
      { new: true }
    );

    if (!updated) {
      throw { statusCode: 400, message: 'Không thể hủy giải đấu lúc này' };
    }

    return updated;
  }

  /**
   * Rời khỏi phòng giải đấu (khi giải đang ở sảnh chờ WAITING)
   */
  public static async leaveTournament(
    code: string,
    userId: string
  ): Promise<ITournament> {
    const tournament = await Tournament.findOne({ code: code.toUpperCase() });
    if (!tournament) {
      throw { statusCode: 404, message: 'Không tìm thấy phòng giải đấu' };
    }

    if (tournament.status !== 'WAITING') {
      throw { statusCode: 400, message: 'Không thể rời giải đấu đã bắt đầu hoặc đã kết thúc' };
    }

    // T-01 Fix: Nếu chủ phòng rời đi, chuyển quyền chủ phòng cho kỳ thủ kế tiếp nếu còn người
    const isHost = tournament.hostUserId === userId || tournament.hostUsername === userId;
    if (isHost) {
      const remainingPlayers = tournament.players.filter((p) => p.userId !== userId && p.username !== userId);
      if (remainingPlayers.length > 0) {
        const nextHost = remainingPlayers[0];
        const updated = await Tournament.findOneAndUpdate(
          { code: code.toUpperCase(), status: 'WAITING' },
          {
            $set: { hostUserId: nextHost.userId, hostUsername: nextHost.username },
            $pull: { players: { userId } },
          },
          { new: true }
        );
        return updated || tournament;
      } else {
        tournament.status = 'CANCELLED';
        await tournament.save();
        return tournament;
      }
    }

    // Nếu là thành viên tham gia -> xóa khỏi danh sách người chơi
    const updated = await Tournament.findOneAndUpdate(
      { code: code.toUpperCase(), status: 'WAITING' },
      { $pull: { players: { userId } } },
      { new: true }
    );

    return updated || tournament;
  }

  /**
   * Bắt đầu giải đấu, sinh các cặp đấu vòng 1 khi đủ 4 hoặc 8 người
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

    const isHost =
      tournament.hostUserId === requestingUserId ||
      tournament.hostUsername === requestingUserId;
    if (!isHost) {
      throw { statusCode: 403, message: 'Chỉ chủ phòng mới có quyền bắt đầu giải đấu' };
    }

    if (tournament.status !== 'WAITING') {
      throw { statusCode: 400, message: 'Giải đấu đã được bắt đầu trước đó' };
    }

    if (tournament.players.length !== tournament.size) {
      throw {
        statusCode: 400,
        message: `Cần đủ ${tournament.size} người chơi để bắt đầu giải đấu (Hiện tại: ${tournament.players.length}/${tournament.size})`,
      };
    }

    // Xáo trộn ngẫu nhiên danh sách người chơi
    const shuffled = [...tournament.players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const targetMatchesCount = tournament.size === 8 ? 4 : 2;
    const round1Matches: ITournamentMatch[] = [];

    for (let i = 0; i < targetMatchesCount; i++) {
      const p1 = shuffled[i * 2]?.userId;
      const p2 = shuffled[i * 2 + 1]?.userId;

      round1Matches.push({
        matchId: null, // Sẽ gán khi tạo room thi đấu
        player1: p1,
        player2: p2,
        winnerId: null,
        status: 'PENDING',
      });
    }

    // Atomic Compare-And-Swap (CAS) Transition tại MongoDB
    const updatedTournament = await Tournament.findOneAndUpdate(
      {
        _id: tournament._id,
        status: 'WAITING',
      },
      {
        $set: {
          status: 'IN_PROGRESS',
          roundBreakUntil: new Date(Date.now() + 30000),
          rounds: [
            {
              roundNumber: 1,
              matches: round1Matches,
            },
          ],
        },
      },
      { new: true }
    );

    if (!updatedTournament) {
      throw { statusCode: 409, message: 'Giải đấu đã được bắt đầu hoặc trạng thái không hợp lệ' };
    }

    return {
      tournament: updatedTournament,
      round1Matches,
    };
  }

  /**
   * Liên kết matchId của ván chính khi ván đấu hòa trước khi bắt đầu Armageddon
   */
  public static async linkMainMatch(
    tournamentContext: { tournamentId: string; roundNumber: number; matchIndex: number },
    mainMatchId: string
  ): Promise<ITournament | null> {
    const { tournamentId, roundNumber, matchIndex } = tournamentContext;
    return Tournament.findOneAndUpdate(
      {
        tournamentId,
        'rounds.roundNumber': roundNumber,
      },
      {
        $set: {
          [`rounds.$[r].matches.${matchIndex}.matchId`]: mainMatchId,
        },
      },
      {
        arrayFilters: [{ 'r.roundNumber': roundNumber }],
        new: true,
      }
    );
  }

  /**
   * Báo cáo kết quả ván cờ từ MatchGateway (Atomic State Transition & Concurrency Guard)
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

    const setFields: Record<string, any> = {
      [`rounds.$[r].matches.${matchIndex}.winnerId`]: winnerId,
      [`rounds.$[r].matches.${matchIndex}.status`]: 'DONE',
    };

    if (isArmageddon) {
      if (matchId) setFields[`rounds.$[r].matches.${matchIndex}.armageddonMatchId`] = matchId;
    } else {
      if (matchId) setFields[`rounds.$[r].matches.${matchIndex}.matchId`] = matchId;
    }

    // ATOMIC UPDATE: Chỉ cập nhật khi trận đấu CHƯA 'DONE' (Idempotency & Concurrency Guard)
    // D-01 Fix: $[r] không hợp lệ trong query filter, phải dùng $elemMatch
    const updatedTournament = await Tournament.findOneAndUpdate(
      {
        tournamentId,
        rounds: {
          $elemMatch: {
            roundNumber,
            [`matches.${matchIndex}.status`]: { $ne: 'DONE' },
          },
        },
      },
      {
        $set: setFields,
      },
      {
        arrayFilters: [{ 'r.roundNumber': roundNumber }],
        new: true,
      }
    );

    if (!updatedTournament) {
      // Đã có request khác cập nhật trước đó
      const current = await Tournament.findOne({ tournamentId });
      if (!current) throw new Error(`Tournament ${tournamentId} không tồn tại`);
      return {
        tournament: current,
        isRoundFinished: false,
        isTournamentFinished: current.status === 'FINISHED',
        championId: current.championId,
      };
    }

    const currentRound = updatedTournament.rounds.find((r) => r.roundNumber === roundNumber);
    if (!currentRound) {
      throw new Error(`Round ${roundNumber} không tồn tại sau khi cập nhật`);
    }

    // B-02 Fix: Vòng hoàn tất khi tất cả các trận đã DONE (kể cả trận Double Forfeit winnerId = null)
    const isRoundFinished = currentRound.matches.every((m) => m.status === 'DONE');

    let isTournamentFinished = false;
    let championId: string | null = null;

    if (isRoundFinished) {
      if (currentRound.matches.length === 1) {
        // Vòng chung kết hoàn tất -> Cập nhật giải thành FINISHED
        const finalWinner = (winnerId && winnerId.trim().length > 0) ? winnerId : null;
        const finalFinished = await Tournament.findOneAndUpdate(
          {
            tournamentId,
            status: { $ne: 'FINISHED' },
          },
          {
            $set: {
              status: 'FINISHED',
              championId: finalWinner,
              roundBreakUntil: null,
            },
          },
          { new: true }
        );
        isTournamentFinished = true;
        championId = finalWinner;
        return {
          tournament: finalFinished || updatedTournament,
          isRoundFinished: true,
          isTournamentFinished: true,
          championId,
        };
      } else {
        // Nghỉ giữa các vòng -> Đặt roundBreakUntil 30 giây
        const withBreak = await Tournament.findOneAndUpdate(
          {
            tournamentId,
          },
          {
            $set: {
              roundBreakUntil: new Date(Date.now() + 30000),
            },
          },
          { new: true }
        );
        return {
          tournament: withBreak || updatedTournament,
          isRoundFinished: true,
          isTournamentFinished: false,
          championId: null,
        };
      }
    }

    return {
      tournament: updatedTournament,
      isRoundFinished: false,
      isTournamentFinished: false,
      championId: null,
    };
  }

  /**
   * Tạo vòng đấu kế tiếp sau khi hết 30 giây countdown (Atomic CAS Round Advancement)
   */
  public static async advanceNextRound(tournamentId: string): Promise<{
    tournament: ITournament;
    nextRound: ITournamentRound | null;
    isNewlyCreated?: boolean;
  }> {
    const tournament = await Tournament.findOne({ tournamentId });
    if (!tournament || tournament.status !== 'IN_PROGRESS') {
      return { tournament: tournament as any, nextRound: null, isNewlyCreated: false };
    }

    const currentRoundNumber = tournament.rounds.length;
    const currentRound = tournament.rounds[currentRoundNumber - 1];

    if (!currentRound) {
      return { tournament, nextRound: null, isNewlyCreated: false };
    }

    // IDEMPOTENCY GUARD 1: Chỉ tiến vòng khi tất cả các trận vòng hiện tại đã hoàn thành
    const isRoundDone = currentRound.matches.every((m) => m.status === 'DONE');
    if (!isRoundDone) {
      return { tournament, nextRound: null, isNewlyCreated: false };
    }

    // IDEMPOTENCY GUARD 2: Nếu vòng tiếp theo đã được tạo (do 2 request gọi song song), không tạo thêm
    const nextRoundNumber = currentRoundNumber + 1;
    const existingNextRound = tournament.rounds.find((r) => r.roundNumber === nextRoundNumber);
    if (existingNextRound) {
      return { tournament, nextRound: existingNextRound, isNewlyCreated: false };
    }

    // ADV-02 Fix: Chuẩn hóa cấu trúc Cây phân nhánh nhị phân cố định (Slot-based Binary Tree)
    // Trận k của vòng r+1 luôn được ghép từ Trận 2k và Trận 2k+1 của vòng r
    const prevMatches = currentRound.matches;
    const nextMatchesCount = Math.floor(prevMatches.length / 2);

    if (nextMatchesCount < 1) {
      // Đã tới trận cuối cùng hoặc không thể chia đôi tiếp
      const singleWinner = currentRound.matches[0]?.winnerId || null;
      const finalFinished = await Tournament.findOneAndUpdate(
        { tournamentId, status: { $ne: 'FINISHED' } },
        { $set: { status: 'FINISHED', championId: singleWinner, roundBreakUntil: null } },
        { new: true }
      );
      return { tournament: finalFinished || tournament, nextRound: null, isNewlyCreated: false };
    }

    const nextRoundMatches: ITournamentMatch[] = [];
    for (let k = 0; k < nextMatchesCount; k++) {
      const parent1 = prevMatches[2 * k];
      const parent2 = prevMatches[2 * k + 1];

      const w1 = parent1?.winnerId || null;
      const w2 = parent2?.winnerId || null;

      if (w1 && w2) {
        // Cả 2 nhánh đều có người chiến thắng hợp lệ -> Ghép đấu bình thường
        nextRoundMatches.push({
          matchId: null,
          player1: w1,
          player2: w2,
          winnerId: null,
          status: 'PENDING',
        });
      } else if (w1 && !w2) {
        // Nhánh 2 bị Double Forfeit hoặc vắng mặt -> w1 nhận suất Miễn đấu (BYE) tại đúng nhánh của mình
        nextRoundMatches.push({
          matchId: null,
          player1: w1,
          player2: null,
          winnerId: w1,
          status: 'DONE',
        });
      } else if (!w1 && w2) {
        // Nhánh 1 bị Double Forfeit hoặc vắng mặt -> w2 nhận suất Miễn đấu (BYE) tại đúng nhánh của mình
        nextRoundMatches.push({
          matchId: null,
          player1: w2,
          player2: null,
          winnerId: w2,
          status: 'DONE',
        });
      } else {
        // Cả 2 nhánh đều không có người thắng (Double Forfeit cả 2 trận)
        nextRoundMatches.push({
          matchId: null,
          player1: null,
          player2: null,
          winnerId: null,
          status: 'DONE',
        });
      }
    }

    // Kiểm tra nếu tất cả các trận vòng mới đều đã DONE (ví dụ do Bye hết hoặc Double Forfeit hết)
    const pendingMatches = nextRoundMatches.filter((m) => m.status === 'PENDING');
    if (pendingMatches.length === 0) {
      // Xác định nếu có duy nhất 1 người sống sót -> Trao giải Quán quân
      const activeWinners = nextRoundMatches.map((m) => m.winnerId).filter(Boolean);
      const championId = activeWinners.length === 1 ? activeWinners[0] : null;

      const finalFinished = await Tournament.findOneAndUpdate(
        { tournamentId, status: { $ne: 'FINISHED' } },
        { $set: { status: 'FINISHED', championId, roundBreakUntil: null } },
        { new: true }
      );
      return { tournament: finalFinished || tournament, nextRound: null, isNewlyCreated: false };
    }

    const nextRound: ITournamentRound = {
      roundNumber: nextRoundNumber,
      matches: nextRoundMatches,
    };

    // ATOMIC CAS PUSH: Chỉ thêm vòng mới nếu số vòng hiện tại vẫn đúng bằng currentRoundNumber
    const updated = await Tournament.findOneAndUpdate(
      {
        tournamentId,
        status: 'IN_PROGRESS',
        rounds: { $size: currentRoundNumber },
      },
      {
        $set: { roundBreakUntil: null },
        $push: { rounds: nextRound },
      },
      { new: true }
    );

    if (!updated) {
      // Đã có request khác đẩy vòng tiếp theo trước
      const current = await Tournament.findOne({ tournamentId });
      const createdNextRound = current?.rounds.find((r) => r.roundNumber === nextRoundNumber) || null;
      return { tournament: current as any, nextRound: createdNextRound, isNewlyCreated: false };
    }

    return {
      tournament: updated,
      nextRound,
      isNewlyCreated: true,
    };
  }

  /**
   * Tính toán thành tích cá nhân của một kỳ thủ trong giải đấu
   */
  public static computeMyResult(tournament: ITournament, userId: string): {
    placement: number | null;
    roundReached: number;
    roundName: string;
    isChampion: boolean;
    wins: number;
    losses: number;
  } {
    const totalRounds = tournament.size === 8 ? 3 : 2;
    let wins = 0;
    let losses = 0;
    let maxRoundReached = 0;
    let eliminatedRound: number | null = null;

    const userPlayer = tournament.players?.find((p) => p.userId === userId || p.username === userId);
    const resolvedIds = new Set<string>([userId]);
    if (userPlayer) {
      if (userPlayer.userId) resolvedIds.add(userPlayer.userId);
      if (userPlayer.username) resolvedIds.add(userPlayer.username);
    }

    for (const round of tournament.rounds || []) {
      const match = round.matches.find(
        (m) => (m.player1 && resolvedIds.has(m.player1)) || (m.player2 && resolvedIds.has(m.player2))
      );
      if (match) {
        if (round.roundNumber > maxRoundReached) {
          maxRoundReached = round.roundNumber;
        }
        if (match.status === 'DONE') {
          // Chỉ tính ván thắng thật khi có đối thủ thực tế và không phải trận Bye
          if (match.winnerId && resolvedIds.has(match.winnerId) && match.player2 !== null) {
            wins++;
          } else if (match.winnerId && !resolvedIds.has(match.winnerId)) {
            losses++;
            eliminatedRound = round.roundNumber;
          }
        }
      }
    }

    const isChampion = tournament.championId ? resolvedIds.has(tournament.championId) : false;
    let placement: number | null = null;

    if (isChampion) {
      placement = 1;
    } else if (eliminatedRound !== null) {
      // D-05 Fix: Tính placement từ vòng bị loại thực tế
      placement = eliminatedRound === totalRounds
        ? 2  // Thua ở Chung kết → Á quân
        : Math.pow(2, totalRounds - eliminatedRound) + 1; // Tứ/Bán kết → Hạng 5/3
    }
    // D-05 Fix: Không fallback placement=2 nếu không có eliminatedRound
    // (Trường hợp này xảy ra khi Double Forfeit hoặc giải chưa kết thúc → để null)

    const getRoundName = (round: number, size: number) => {
      if (round === 0) return 'Phòng chờ';
      if (size === 8) {
        if (round === 1) return 'Tứ kết';
        if (round === 2) return 'Bán kết';
        if (round === 3) return 'Chung kết';
      } else {
        if (round === 1) return 'Bán kết';
        if (round === 2) return 'Chung kết';
      }
      return `Vòng ${round}`;
    };

    return {
      placement,
      roundReached: maxRoundReached,
      roundName: getRoundName(maxRoundReached, tournament.size),
      isChampion,
      wins,
      losses,
    };
  }

  /**
   * Lấy lịch sử các giải đấu của người chơi có phân trang
   */
  public static async getUserTournamentHistory(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    tournaments: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(50, Math.max(1, limit));
    const skip = (pageNum - 1) * limitNum;

    const query = {
      $or: [
        { 'players.userId': userId },
        { 'players.username': userId },
      ],
      status: { $in: ['IN_PROGRESS', 'FINISHED'] },
    };

    const [tournaments, total] = await Promise.all([
      Tournament.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Tournament.countDocuments(query),
    ]);

    const mapped = tournaments.map((t: any) => {
      const myResult = TournamentService.computeMyResult(t, userId);
      const championPlayer = t.players?.find((p: any) => p.userId === t.championId);

      return {
        tournamentId: t.tournamentId,
        code: t.code,
        size: t.size,
        status: t.status,
        createdAt: t.createdAt,
        championId: t.championId,
        championName: championPlayer?.username || (t.status === 'IN_PROGRESS' ? 'Đang tranh tài' : (t.championId || 'Chưa xác định')),
        myResult,
        playersCount: t.players?.length || 0,
      };
    });

    return {
      tournaments: mapped,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  /**
   * Tra cứu chi tiết một giải đấu theo mã code phòng hoặc tournamentId / _id
   */
  public static async getTournamentByIdOrCode(idOrCode: string): Promise<ITournament | null> {
    const trimmed = idOrCode.trim();
    if (/^[A-Za-z0-9]{6}$/.test(trimmed)) {
      const byCode = await Tournament.findOne({ code: trimmed.toUpperCase() });
      if (byCode) return byCode;
    }

    const conditions: any[] = [{ tournamentId: trimmed }];
    if (mongoose.Types.ObjectId.isValid(trimmed)) {
      conditions.push({ _id: new mongoose.Types.ObjectId(trimmed) });
    }
    return Tournament.findOne({ $or: conditions });
  }
}
