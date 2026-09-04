import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { PlayerProfileService } from './player-profile.service';
import { ApiResponse } from '../../../utils/apiResponse';

export class PlayerProfileController {
  /**
   * GET /api/v1/ml/profile/me
   * Lấy hồ sơ hành vi và phong cách của chính người chơi đang đăng nhập
   */
  public static async getMyProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return ApiResponse.error(res, 'Yêu cầu đăng nhập để xem hồ sơ', 401);
      }

      const profile = await PlayerProfileService.getProfile(userId);
      return ApiResponse.success(res, profile, 'Lấy hồ sơ kỳ thủ thành công');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/ml/profile/:userIdOrUsername
   * Lấy hồ sơ công khai của một kỳ thủ bất kỳ
   */
  public static async getProfileById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { userIdOrUsername } = req.params;
      if (!userIdOrUsername) {
        return ApiResponse.error(res, 'Thiếu ID hoặc username của người chơi', 400);
      }

      const profile = await PlayerProfileService.getProfile(userIdOrUsername);
      return ApiResponse.success(res, profile, 'Lấy hồ sơ kỳ thủ thành công');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/ml/profile/recompute
   * Kích hoạt cập nhật lại hồ sơ theo yêu cầu
   */
  public static async recomputeProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return ApiResponse.error(res, 'Yêu cầu đăng nhập để thực hiện', 401);
      }

      const updated = await PlayerProfileService.aggregateAndSaveProfile(userId);
      return ApiResponse.success(res, updated, 'Cập nhật lại hồ sơ kỳ thủ thành công');
    } catch (error) {
      next(error);
    }
  }
}
