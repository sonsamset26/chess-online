import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { RecommendationService } from './recommendation.service';
import { ApiResponse } from '../../../utils/apiResponse';

export class RecommendationController {
  /**
   * GET /api/v1/ml/recommendations/puzzles
   * Lấy danh sách câu đố được hệ thống gợi ý riêng cho người dùng hiện tại
   */
  public static async getMyRecommendedPuzzles(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return ApiResponse.error(res, 'Yêu cầu đăng nhập để nhận gợi ý bài tập', 401);
      }

      const limit = parseInt(req.query.limit as string) || 6;
      const result = await RecommendationService.getPersonalizedPuzzles(userId, limit);
      return ApiResponse.success(res, result, 'Lấy danh sách bài tập gợi ý thành công');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/ml/recommendations/puzzles/:userIdOrUsername
   */
  public static async getPuzzlesForUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { userIdOrUsername } = req.params;
      const limit = parseInt(req.query.limit as string) || 6;
      const result = await RecommendationService.getPersonalizedPuzzles(userIdOrUsername, limit);
      return ApiResponse.success(res, result, 'Lấy danh sách bài tập gợi ý thành công');
    } catch (error) {
      next(error);
    }
  }
}
