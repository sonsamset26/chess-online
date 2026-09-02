import { Request, Response, NextFunction } from 'express';
import { MatchService } from './match.service';
import { ApiResponse } from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';

export class MatchController {
  /**
   * GET /api/v1/matches/me
   * Lấy danh sách ván đấu của chính tài khoản đăng nhập (xác thực qua JWT Token)
   */
  public static async getMyHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return ApiResponse.error(res, 'Yêu cầu đăng nhập để xem lịch sử đấu cá nhân', 401);
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 15;

      const result = await MatchService.getUserHistory(userId, page, limit);
      return ApiResponse.success(res, result, 'Lấy lịch sử đấu cá nhân thành công');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/matches/user/:userIdOrUsername
   * Lấy danh sách các trận đấu công khai của người dùng (hỗ trợ phân trang)
   */
  public static async getUserHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { userIdOrUsername } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!userIdOrUsername) {
        return ApiResponse.error(res, 'Vui lòng cung cấp ID hoặc username của người chơi', 400);
      }

      const result = await MatchService.getUserHistory(userIdOrUsername, page, limit);
      return ApiResponse.success(res, result, 'Lấy lịch sử đấu thành công');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/matches/:id
   * Lấy chi tiết ván đấu để xem lại bàn cờ (kiểm tra quyền truy cập)
   */
  public static async getMatchById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const requestingUserId = req.user?.userId;
      const requestingUserRole = req.user?.role;
      const match = await MatchService.getMatchById(id, requestingUserId, requestingUserRole);

      if (!match) {
        return ApiResponse.error(res, 'Không tìm thấy ván đấu theo mã yêu cầu', 404);
      }

      return ApiResponse.success(res, match, 'Lấy chi tiết ván đấu thành công');
    } catch (error: any) {
      if (error?.statusCode) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      next(error);
    }
  }
}
