import mongoose from 'mongoose';
import { Match, IMatch, MoveTelemetry } from './match.model';
import { User } from '../user/user.model';
import { PlayerProfileService } from '../ml/profile/player-profile.service';

export interface CreateMatchInput {
  whiteUserId: string;
  blackUserId: string;
  whiteUsername: string;
  blackUsername: string;
  roomId?: string;
  gameMode: 'PV_AI' | 'PVP_RATED' | 'PVP_CUSTOM' | 'TOURNAMENT';
  aiDifficulty?: number;
  winnerColor: 'w' | 'b' | 'draw';
  endReason: 'CHECKMATE' | 'TIMEOUT' | 'RESIGNED' | 'ABANDONED' | 'DRAW';
  isRated: boolean;
  isArmageddon?: boolean;
  tournamentWinnerId?: string;
  tournamentId?: string;
  tournamentRound?: number;
  tournamentMatchIndex?: number;
  whiteEloDelta?: number;
  blackEloDelta?: number;
  whiteOldElo?: number;
  blackOldElo?: number;
  moves: string[];
  moveTelemetry?: MoveTelemetry[];
  pgn: string;
  finalFen: string;
  movesCount: number;
  timeControl?: {
    initialSeconds: number;
    incrementSeconds: number;
  };
  startedAt: Date;
  endedAt?: Date;
}

export interface HistoryResult {
  matches: IMatch[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class MatchService {
  /**
   * Lưu trữ ván cờ vào MongoDB Atlas khi kết thúc trận kèm dữ liệu viễn trắc MoveTelemetry
   */
  public static async saveMatch(data: CreateMatchInput): Promise<IMatch> {
    try {
      // Cố gắng liên kết với ObjectId của User trong MongoDB nếu tồn tại
      let whiteObjectId: mongoose.Types.ObjectId | undefined;
      let blackObjectId: mongoose.Types.ObjectId | undefined;

      if (mongoose.Types.ObjectId.isValid(data.whiteUserId)) {
        whiteObjectId = new mongoose.Types.ObjectId(data.whiteUserId);
      } else {
        const whiteUser = await User.findOne({ username: data.whiteUsername });
        if (whiteUser) whiteObjectId = whiteUser._id as mongoose.Types.ObjectId;
      }

      if (mongoose.Types.ObjectId.isValid(data.blackUserId)) {
        blackObjectId = new mongoose.Types.ObjectId(data.blackUserId);
      } else {
        const blackUser = await User.findOne({ username: data.blackUsername });
        if (blackUser) blackObjectId = blackUser._id as mongoose.Types.ObjectId;
      }

      const match = await Match.create({
        ...data,
        whitePlayer: whiteObjectId,
        blackPlayer: blackObjectId,
        moveTelemetry: data.moveTelemetry || [],
        analysis: {
          status: 'NOT_ANALYZED',
          featureVersion: 'feature-v1',
          source: 'SERVER',
        },
        timeControl: data.timeControl || { initialSeconds: 600, incrementSeconds: 0 },
        endedAt: data.endedAt || new Date(),
      });

      console.log(`💾 [MatchService] Đã lưu ván đấu ${match._id} (${data.gameMode}) kèm ${data.moveTelemetry?.length || 0} telemetry vào CSDL.`);
      return match;
    } catch (error) {
      console.error('❌ [MatchService] Lỗi lưu trữ ván đấu:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách lịch sử thi đấu của một kỳ thủ kèm phân trang
   */
  public static async getUserHistory(
    userIdOrUsername: string,
    page: number = 1,
    limit: number = 20
  ): Promise<HistoryResult> {
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const skip = (pageNum - 1) * limitNum;

    const userFilter: any[] = [
      { whiteUserId: userIdOrUsername },
      { blackUserId: userIdOrUsername },
      { whiteUsername: userIdOrUsername },
      { blackUsername: userIdOrUsername },
    ];

    if (mongoose.Types.ObjectId.isValid(userIdOrUsername)) {
      const objId = new mongoose.Types.ObjectId(userIdOrUsername);
      userFilter.push({ whitePlayer: objId }, { blackPlayer: objId });
    }

    const query = {
      $or: userFilter,
      gameMode: { $ne: 'TOURNAMENT' },
      tournamentId: { $in: [null, undefined] },
    };

    const [matches, total] = await Promise.all([
      Match.find(query)
        .sort({ endedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Match.countDocuments(query),
    ]);

    return {
      matches: matches as unknown as IMatch[],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  /**
   * Lấy chi tiết một ván đấu theo ID (kiểm tra quyền truy cập nếu cung cấp requestingUserId)
   */
  public static async getMatchById(
    matchId: string,
    requestingUserId?: string,
    requestingUserRole?: string
  ): Promise<IMatch | null> {
    if (!mongoose.Types.ObjectId.isValid(matchId)) return null;

    const match = await Match.findById(matchId).lean() as unknown as IMatch | null;
    if (!match) return null;

    // Quản trị viên (Admin) hoặc các ván đấu thuộc giải đấu (TOURNAMENT) có quyền xem công khai
    if (requestingUserRole === 'ADMIN' || match.gameMode === 'TOURNAMENT') {
      return match;
    }

    // Với các ván đấu riêng tư (PVP_RATED, PVP_CUSTOM, PV_AI): Bắt buộc phải đăng nhập
    if (!requestingUserId) {
      throw { statusCode: 401, message: 'Yêu cầu đăng nhập để xem ván đấu riêng tư này' };
    }

    const isParticipant =
      match.whiteUserId === requestingUserId ||
      match.blackUserId === requestingUserId ||
      match.whiteUsername === requestingUserId ||
      match.blackUsername === requestingUserId ||
      (match.whitePlayer && match.whitePlayer.toString() === requestingUserId) ||
      (match.blackPlayer && match.blackPlayer.toString() === requestingUserId);

    if (!isParticipant) {
      throw { statusCode: 403, message: 'Bạn không có quyền truy cập ván đấu này' };
    }

    return match;
  }

  /**
   * Lấy danh sách các ván đấu thuộc về một giải đấu cụ thể
   */
  public static async getMatchesByTournament(tournamentId: string): Promise<IMatch[]> {
    const matches = await Match.find({ tournamentId })
      .sort({ tournamentRound: 1, tournamentMatchIndex: 1, createdAt: 1 })
      .lean();
    return matches as unknown as IMatch[];
  }

  /**
   * Lấy các ván đấu của một người chơi trong một giải đấu cụ thể
   */
  public static async getTournamentMatchesByUser(
    tournamentId: string,
    userId: string
  ): Promise<IMatch[]> {
    const matches = await Match.find({
      tournamentId,
      $or: [{ whiteUserId: userId }, { blackUserId: userId }],
    })
      .sort({ tournamentRound: 1, createdAt: 1 })
      .lean();
    return matches as unknown as IMatch[];
  }

  /**
   * Lưu hoặc cập nhật kết quả phân tích ván đấu (Idempotent CAS)
   */
  public static async saveMatchAnalysis(
    matchIdOrRoomId: string,
    analysisData: any
  ): Promise<IMatch | null> {
    if (!matchIdOrRoomId) return null;

    let existing = null;
    if (mongoose.Types.ObjectId.isValid(matchIdOrRoomId)) {
      existing = await Match.findById(matchIdOrRoomId);
    }
    if (!existing) {
      existing = await Match.findOne({ roomId: matchIdOrRoomId });
    }
    if (!existing) return null;

    // Idempotent guard: Nếu ván đấu đã có phân tích, trả về luôn để tránh ghi đè xung đột
    if (existing.analysis?.analyzedAt && existing.analysis.status === 'ANALYZED') {
      return existing;
    }

    const updated = await Match.findByIdAndUpdate(
      existing._id,
      {
        $set: {
          analysis: {
            status: 'ANALYZED',
            featureVersion: analysisData.featureVersion || 'feature-v1',
            source: 'CLIENT_CACHE',
            whiteAccuracy: analysisData.whiteAccuracy,
            blackAccuracy: analysisData.blackAccuracy,
            whiteAvgCpl: analysisData.whiteAvgCpl,
            blackAvgCpl: analysisData.blackAvgCpl,
            whiteFeatures: analysisData.whiteFeatures,
            blackFeatures: analysisData.blackFeatures,
            moveClassifications: analysisData.moveClassifications || [],
            analyzedAt: new Date(),
          },
        },
      },
      { new: true }
    );

    // Kích hoạt cập nhật hồ sơ kỳ thủ ngầm không đồng bộ (Fire-and-forget background task)
    if (existing.whiteUserId) {
      PlayerProfileService.aggregateAndSaveProfile(existing.whiteUserId).catch((e) =>
        console.warn('Lỗi cập nhật ngầm profile kỳ thủ Trắng:', e)
      );
    }
    if (existing.blackUserId) {
      PlayerProfileService.aggregateAndSaveProfile(existing.blackUserId).catch((e) =>
        console.warn('Lỗi cập nhật ngầm profile kỳ thủ Đen:', e)
      );
    }

    return updated;
  }
}
