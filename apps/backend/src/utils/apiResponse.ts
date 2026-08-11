import { Response } from 'express';
import { ApiResponseFormat } from '../types/api.response';

export class ApiResponse {
  public static success<T>(
    res: Response,
    data?: T,
    message: string = 'Thao tác thành công',
    statusCode: number = 200
  ): Response {
    const payload: ApiResponseFormat<T> = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(payload);
  }

  public static error(
    res: Response,
    message: string = 'Đã xảy ra lỗi hệ thống',
    statusCode: number = 500,
    errors: any = null
  ): Response {
    const payload: ApiResponseFormat = {
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(payload);
  }
}
