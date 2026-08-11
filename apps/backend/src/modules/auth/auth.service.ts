import bcrypt from 'bcryptjs';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { User, IUser } from '../user/user.model';

export class AuthService {
  private static JWT_SECRET: Secret = process.env.JWT_SECRET || 'supersecretchesskey123';

  public static async register(data: {
    email: string;
    username: string;
    password: string;
  }): Promise<{ user: Partial<IUser>; token: string }> {
    const existingUser = await User.findOne({
      $or: [{ email: data.email }, { username: data.username }],
    });

    if (existingUser) {
      if (existingUser.email === data.email) {
        throw { statusCode: 400, message: 'Email này đã được sử dụng' };
      }
      throw { statusCode: 400, message: 'Tên đăng nhập này đã được sử dụng' };
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const user = await User.create({
      email: data.email,
      username: data.username,
      passwordHash,
    });

    const token = this.generateToken(user._id.toString(), user.role);

    return {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
        eloRating: user.eloRating,
        role: user.role,
      },
      token,
    };
  }

  public static async login(data: {
    email: string;
    password: string;
  }): Promise<{ user: Partial<IUser>; token: string }> {
    const user = await User.findOne({ email: data.email });
    if (!user) {
      throw { statusCode: 401, message: 'Email hoặc mật khẩu không chính xác' };
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw { statusCode: 401, message: 'Email hoặc mật khẩu không chính xác' };
    }

    const token = this.generateToken(user._id.toString(), user.role);

    return {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
        eloRating: user.eloRating,
        role: user.role,
      },
      token,
    };
  }

  private static generateToken(userId: string, role: string): string {
    const options: SignOptions = {
      expiresIn: '7d',
    };
    return jwt.sign({ userId, role }, this.JWT_SECRET, options);
  }
}
