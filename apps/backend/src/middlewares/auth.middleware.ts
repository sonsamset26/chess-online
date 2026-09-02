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
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return ApiResponse.error(res, 'Lỗi cấu hình server: JWT_SECRET chưa được thiết lập.', 500);
  }

  try {
    let decoded: any;
    try {
      decoded = jwt.verify(token, secret);
    } catch (ePrimary) {
      throw ePrimary;
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

export const optionalAuthenticateJWT = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) return next();

  try {
    let decoded: any;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      // Token không hợp lệ -> bỏ qua
    }

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };
  } catch {
    // Token không hợp lệ hoặc hết hạn -> coi là khách vãng lai
  }
  next();
};
