import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { ApiResponse } from '../../utils/apiResponse';

export class AuthController {
  public static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, name, username, password } = req.body;
      const displayName = name || username;
      
      if (!email || !displayName || !password) {
        return ApiResponse.error(res, 'Vui lòng cung cấp đầy đủ Tên hiển thị, Email và Mật khẩu', 400);
      }

      const result = await AuthService.register({ email, name: displayName, password });
      return ApiResponse.success(res, result, 'Đăng ký tài khoản thành công', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, account, password } = req.body;
      const userEmail = email || account;

      if (!userEmail || !password) {
        return ApiResponse.error(res, 'Vui lòng cung cấp Email và Mật khẩu', 400);
      }

      const result = await AuthService.login({ email: userEmail, password });
      return ApiResponse.success(res, result, 'Đăng nhập thành công', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async googleLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { idToken } = req.body;
      if (!idToken) {
        return ApiResponse.error(res, 'Thiếu Google idToken xác thực', 400);
      }

      const result = await AuthService.googleLogin(idToken);
      return ApiResponse.success(res, result, 'Đăng nhập Google thành công', 200);
    } catch (error) {
      next(error);
    }
  }
}
