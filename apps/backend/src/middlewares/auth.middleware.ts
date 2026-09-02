import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../utils/apiResponse';

export interface AuthenticatedUser {
  userId: string;
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const authenticateJWT = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return ApiResponse.error(
      res,
      'Yêu cầu xác thực tài khoản (Token không được cung cấp)',
      401
    );
  }

  const token = authHeader.split(' ')[1];
  const primarySecret = process.env.JWT_SECRET || 'supersecretchesskey123';
  const fallbackSecret = 'supersecretchessaccesskey123';

  try {
    let decoded: any;
    try {
      decoded = jwt.verify(token, primarySecret);
    } catch (ePrimary) {
      // Fallback cho token cũ sinh ra từ trước khi nạp .env
      decoded = jwt.verify(token, fallbackSecret);
    }

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };
    next();
  } catch (err: any) {
    return ApiResponse.error(
      res,
      'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.',
      401
    );
  }
};
