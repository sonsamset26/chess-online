import mongoose from 'mongoose';
import { Match, IMatch } from './match.model';
import { User } from '../user/user.model';

export interface CreateMatchInput {
  whiteUserId: string;
  blackUserId: string;
  whiteUsername: string;
  blackUsername: string;
  gameMode: 'PV_AI' | 'PVP_RATED' | 'PVP_CUSTOM';
  aiDifficulty?: number;
  winnerColor: 'w' | 'b' | 'draw';
  endReason: 'CHECKMATE' | 'TIMEOUT' | 'RESIGNED' | 'ABANDONED' | 'DRAW';
  isRated: boolean;
  whiteEloDelta?: number;
  blackEloDelta?: number;
  whiteOldElo?: number;
  blackOldElo?: number;
  moves: string[];
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
   * Lưu trữ ván cờ vào MongoDB Atlas khi kết thúc trận
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
        timeControl: data.timeControl || { initialSeconds: 600, incrementSeconds: 0 },
        endedAt: data.endedAt || new Date(),
      });

      console.log(`💾 [MatchService] Đã lưu ván đấu ${match._id} (${data.gameMode}) vào CSDL.`);
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

    const query = { $or: userFilter };

    const [matches, total] = await Promise.all([
      Match.find(query)
        .sort({ endedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean() as unknown as Promise<IMatch[]>,
      Match.countDocuments(query),
    ]);

    return {
      matches,
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

    // Quản trị viên (Admin) có quyền xem lại mọi ván đấu
    if (requestingUserRole === 'ADMIN') {
      return match;
    }

    if (requestingUserId) {
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
    }

    return match;
  }
}
