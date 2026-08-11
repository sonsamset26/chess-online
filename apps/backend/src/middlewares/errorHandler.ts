import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/apiResponse';

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(`❌ [Error Handler] ${req.method} ${req.path}:`, err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Lỗi hệ thống nội bộ máy chủ (Internal Server Error)';

  return ApiResponse.error(res, message, statusCode, err.errors || null);
};
