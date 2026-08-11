import { User, IUser } from './user.model';

export class UserService {
  public static async getProfile(userId: string): Promise<Partial<IUser> | null> {
    const user = await User.findById(userId).select('-passwordHash');
    if (!user) {
      throw { statusCode: 404, message: 'Không tìm thấy người dùng' };
    }
    return user;
  }

  public static async getLeaderboard(limit: number = 20): Promise<Partial<IUser>[]> {
    return await User.find()
      .select('username avatarUrl eloRating wins losses draws totalGames')
      .sort({ eloRating: -1 })
      .limit(limit);
  }
}
