import { Response, NextFunction } from 'express';
import { TournamentService } from './tournament.service';
import { ApiResponse } from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { User } from '../user/user.model';

export class TournamentController {
  /**
   * POST /api/v1/tournaments
   * Tạo giải đấu mới (Yêu cầu JWT)
   */
  public static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return ApiResponse.error(res, 'Yêu cầu đăng nhập để tạo giải đấu', 401);
      }

      const user = await User.findById(userId);
      const username = user?.username || `Player_${userId.substring(0, 5)}`;
      const eloRating = user?.eloRating || 1200;

      const size = Number(req.body.size) === 8 ? 8 : 4;
      const tournament = await TournamentService.createTournament(userId, username, eloRating, size);

      return ApiResponse.success(res, tournament, 'Tạo giải đấu thành công');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tournaments/me
   * Lấy danh sách lịch sử giải đấu của người chơi đăng nhập (JWT)
   */
  public static async getMyTournaments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return ApiResponse.error(res, 'Yêu cầu đăng nhập để xem lịch sử giải đấu', 401);
      }

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;

      const result = await TournamentService.getUserTournamentHistory(userId, page, limit);

      return ApiResponse.success(res, result, 'Lấy lịch sử giải đấu thành công');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tournaments/:idOrCode
   * Lấy thông tin chi tiết giải đấu theo code (6 ký tự) hoặc tournamentId
   */
  public static async getByIdOrCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { idOrCode } = req.params;
      if (!idOrCode) {
        return ApiResponse.error(res, 'Vui lòng cung cấp mã phòng hoặc ID giải đấu', 400);
      }

      const tournament = await TournamentService.getTournamentByIdOrCode(idOrCode);
      if (!tournament) {
        return ApiResponse.error(res, 'Không tìm thấy giải đấu', 404);
      }

      return ApiResponse.success(res, tournament, 'Lấy thông tin giải đấu thành công');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tournaments/code/:code (Legacy alias)
   */
  public static async getByCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    return TournamentController.getByIdOrCode(req, res, next);
  }
}
