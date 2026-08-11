import { Request, Response, NextFunction } from 'express';
import { HealthService } from '../services/health.service';
import { ApiResponse } from '../utils/apiResponse';

export class HealthController {
  public static check(req: Request, res: Response, next: NextFunction) {
    try {
      const statusData = HealthService.getSystemStatus();
      return ApiResponse.success(
        res,
        statusData,
        'Hệ thống đang hoạt động bình thường'
      );
    } catch (error) {
      next(error);
    }
  }
}
