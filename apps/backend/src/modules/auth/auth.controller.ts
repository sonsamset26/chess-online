import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { ApiResponse } from '../../utils/apiResponse';

export class AuthController {
  public static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, username, password } = req.body;
      
      if (!email || !username || !password) {
        return ApiResponse.error(res, 'Vui lòng cung cấp đầy đủ email, username và password', 400);
      }

      const result = await AuthService.register({ email, username, password });
      return ApiResponse.success(res, result, 'Đăng ký tài khoản thành công', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return ApiResponse.error(res, 'Vui lòng cung cấp email và password', 400);
      }

      const result = await AuthService.login({ email, password });
      return ApiResponse.success(res, result, 'Đăng nhập thành công', 200);
    } catch (error) {
      next(error);
    }
  }
}
