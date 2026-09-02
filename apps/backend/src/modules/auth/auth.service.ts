import bcrypt from 'bcryptjs';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { User, IUser } from '../user/user.model';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: Partial<IUser>;
}

export class AuthService {
  private static get JWT_ACCESS_SECRET(): Secret {
    return process.env.JWT_SECRET || 'supersecretchessaccesskey123';
  }
  private static get JWT_REFRESH_SECRET(): Secret {
    return process.env.JWT_REFRESH_SECRET || 'supersecretchessrefreshkey456';
  }
  private static get googleClient(): OAuth2Client {
    return new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  // 1. Đăng ký Tài khoản mới (Tên hiển thị: name, Email, Mật khẩu)
  public static async register(data: {
    email: string;
    name: string;
    password: string;
  }): Promise<AuthTokens> {
    const existingUser = await User.findOne({ email: data.email });

    if (existingUser) {
      throw { statusCode: 400, message: 'Email này đã được đăng ký tài khoản' };
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const user = await User.create({
      email: data.email,
      name: data.name,
      username: data.name,
      passwordHash,
    });

    const { accessToken, refreshToken } = this.generateTokens(user._id.toString(), user.role);

    return {
      user: {
        id: user._id,
        email: user.email,
        username: user.name || user.username,
        avatarUrl: user.avatarUrl,
        eloRating: user.eloRating,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  // 2. Đăng nhập chuẩn bằng Email & Mật khẩu
  public static async login(data: {
    email: string;
    password: string;
  }): Promise<AuthTokens> {
    const user = await User.findOne({ email: data.email });

    if (!user) {
      throw { statusCode: 401, message: 'Email hoặc mật khẩu không chính xác' };
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw { statusCode: 401, message: 'Email hoặc mật khẩu không chính xác' };
    }

    const { accessToken, refreshToken } = this.generateTokens(user._id.toString(), user.role);

    return {
      user: {
        id: user._id,
        email: user.email,
        username: user.name || user.username,
        avatarUrl: user.avatarUrl,
        eloRating: user.eloRating,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  // 3. Đăng nhập bằng Google (Google OAuth 2.0)
  public static async googleLogin(idToken: string): Promise<AuthTokens> {
    try {
      let email = '';
      let name = '';
      let picture = '';

      if (idToken.startsWith('ya29.') || idToken.split('.').length !== 3) {
        const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (!googleRes.ok) {
          throw { statusCode: 400, message: 'Xác thực Google Access Token thất bại' };
        }

        const payload: any = await googleRes.json();
        email = payload.email;
        name = payload.name || payload.given_name || email.split('@')[0];
        picture = payload.picture || '';
      } else if (process.env.GOOGLE_CLIENT_ID) {
        const ticket = await this.googleClient.verifyIdToken({
          idToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          throw { statusCode: 400, message: 'Xác thực Token Google thất bại' };
        }
        email = payload.email;
        name = payload.name || payload.given_name || email.split('@')[0];
        picture = payload.picture || '';
      } else {
        const decoded: any = jwt.decode(idToken);
        email = decoded?.email || `user_${Date.now()}@gmail.com`;
        name = decoded?.name || 'Tài khoản Google';
        picture = decoded?.picture || 'https://api.dicebear.com/7.x/bottts/svg?seed=google';
      }

      if (!email) {
        throw { statusCode: 400, message: 'Không lấy được Email từ Google' };
      }

      let user = await User.findOne({ email });

      if (!user) {
        const randomPassword = Math.random().toString(36).slice(-10);
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(randomPassword, salt);

        user = await User.create({
          email,
          name,
          username: name,
          passwordHash,
          avatarUrl: picture || 'https://api.dicebear.com/7.x/bottts/svg?seed=google',
        });
      }

      const { accessToken, refreshToken } = this.generateTokens(user._id.toString(), user.role);

      return {
        user: {
          id: user._id,
          email: user.email,
          username: user.name || user.username,
          avatarUrl: user.avatarUrl,
          eloRating: user.eloRating,
          role: user.role,
        },
        accessToken,
        refreshToken,
      };
    } catch (err: any) {
      console.error('❌ Google Login Error:', err);
      throw { statusCode: 400, message: err.message || 'Xác thực Google OAuth thất bại' };
    }
  }

  // 4. Làm mới Token (Silent Refresh Token Mechanism)
  public static async refreshAccessToken(token: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(token, this.JWT_REFRESH_SECRET) as { userId: string; role: string };
      const user = await User.findById(decoded.userId);

      if (!user) {
        throw { statusCode: 401, message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa' };
      }

      const tokens = this.generateTokens(user._id.toString(), user.role);

      return {
        user: {
          id: user._id,
          email: user.email,
          username: user.name || user.username,
          avatarUrl: user.avatarUrl,
          eloRating: user.eloRating,
          role: user.role,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (err: any) {
      throw { statusCode: 401, message: 'RefreshToken không hợp lệ hoặc đã hết hạn' };
    }
  }

  // Sinh cặp Token: accessToken (7 ngày) & refreshToken (30 ngày)
  private static generateTokens(userId: string, role: string): { accessToken: string; refreshToken: string } {
    const accessOptions: SignOptions = { expiresIn: '7d' };
    const refreshOptions: SignOptions = { expiresIn: '30d' };

    const accessToken = jwt.sign({ userId, role }, this.JWT_ACCESS_SECRET, accessOptions);
    const refreshToken = jwt.sign({ userId, role }, this.JWT_REFRESH_SECRET, refreshOptions);

    return { accessToken, refreshToken };
  }
}
