import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { ApiResponse } from '../../utils/apiResponse';

const COOKIE_OPTIONS = {
  httpOnly: true, // Chống XSS (JavaScript browser không thể đọc document.cookie)
  secure: process.env.NODE_ENV === 'production', // Bắt buộc HTTPS khi deploy production
  sameSite: 'lax' as const, // Chống CSRF
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
};

export class AuthController {
  // 1. Đăng ký tài khoản
  public static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, name, username, password } = req.body;
      const displayName = name || username;
      
      if (!email || !displayName || !password) {
        return ApiResponse.error(res, 'Vui lòng cung cấp đầy đủ Tên hiển thị, Email và Mật khẩu', 400);
      }

      const result = await AuthService.register({ email, name: displayName, password });
      
      // Lưu refreshToken vào httpOnly Cookie an toàn
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

      return ApiResponse.success(
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
          token: result.accessToken, // Giữ trường token cho tương thích ngược
        },
        'Đăng ký tài khoản thành công',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  // 2. Đăng nhập
  public static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, account, password } = req.body;
      const userEmail = email || account;

      if (!userEmail || !password) {
        return ApiResponse.error(res, 'Vui lòng cung cấp Email và Mật khẩu', 400);
      }

      const result = await AuthService.login({ email: userEmail, password });
      
      // Lưu refreshToken vào httpOnly Cookie an toàn
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

      return ApiResponse.success(
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
          token: result.accessToken,
        },
        'Đăng nhập thành công',
        200
      );
    } catch (error) {
      next(error);
    }
  }

  // 3. Đăng nhập Google
  public static async googleLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { idToken } = req.body;
      if (!idToken) {
        return ApiResponse.error(res, 'Thiếu Google idToken xác thực', 400);
      }

      const result = await AuthService.googleLogin(idToken);
      
      // Lưu refreshToken vào httpOnly Cookie an toàn
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

      return ApiResponse.success(
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
          token: result.accessToken,
        },
        'Đăng nhập Google thành công',
        200
      );
    } catch (error) {
      next(error);
    }
  }

  // 4. Làm mới AccessToken tự động (Silent Refresh)
  public static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.refreshToken || req.body?.refreshToken;

      if (!token) {
        return ApiResponse.error(res, 'Không tìm thấy RefreshToken trong Cookie hoặc Body', 401);
      }

      const result = await AuthService.refreshAccessToken(token);

      // Cập nhật refreshToken mới vào Cookie (Token Rotation)
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

      return ApiResponse.success(
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
          token: result.accessToken,
        },
        'Cấp mới AccessToken thành công',
        200
      );
    } catch (error) {
      next(error);
    }
  }

  // 5. Đăng xuất (Xóa Cookie)
  public static async logout(_req: Request, res: Response, next: NextFunction) {
    try {
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      return ApiResponse.success(res, null, 'Đăng xuất thành công', 200);
    } catch (error) {
      next(error);
    }
  }
}
