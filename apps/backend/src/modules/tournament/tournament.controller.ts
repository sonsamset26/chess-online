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
   * GET /api/v1/tournaments/:code
   * Lấy thông tin bracket giải đấu theo mã phòng
   */
  public static async getByCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { code } = req.params;
      if (!code) {
        return ApiResponse.error(res, 'Vui lòng cung cấp mã phòng giải đấu', 400);
      }

      const tournament = await TournamentService.getTournamentByCode(code);
      if (!tournament) {
        return ApiResponse.error(res, 'Không tìm thấy phòng giải đấu', 404);
      }

      return ApiResponse.success(res, tournament, 'Lấy thông tin giải đấu thành công');
    } catch (error) {
      next(error);
    }
  }
}
