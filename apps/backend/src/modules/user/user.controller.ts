import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { ApiResponse } from '../../utils/apiResponse';

export class UserController {
  public static async getLeaderboard(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const leaderboard = await UserService.getLeaderboard(limit);
      return ApiResponse.success(res, leaderboard, 'Lấy bảng xếp hạng Elo thành công');
    } catch (error) {
      next(error);
    }
  }
}
