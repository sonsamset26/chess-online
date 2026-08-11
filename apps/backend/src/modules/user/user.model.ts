import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  username: string;
  passwordHash: string;
  avatarUrl: string;
  eloRating: number;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  role: 'USER' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email là bắt buộc'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      required: [true, 'Tên đăng nhập là bắt buộc'],
      unique: true,
      trim: true,
      minlength: [3, 'Tên đăng nhập tối thiểu 3 ký tự'],
      maxlength: [30, 'Tên đăng nhập tối đa 30 ký tự'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Mật khẩu là bắt buộc'],
    },
    avatarUrl: {
      type: String,
      default: 'https://api.dicebear.com/7.x/bottts/svg?seed=chess',
    },
    eloRating: {
      type: Number,
      default: 1200,
      index: true, // Index để tăng tốc truy vấn Leaderboard Top Elo
    },
    wins: {
      type: Number,
      default: 0,
    },
    losses: {
      type: Number,
      default: 0,
    },
    draws: {
      type: Number,
      default: 0,
    },
    totalGames: {
      type: Number,
      default: 0,
    },
    role: {
      type: String,
      enum: ['USER', 'ADMIN'],
      default: 'USER',
    },
  },
  {
    timestamps: true,
  }
);

// Index sắp xếp Leaderboard Elo giảm dần
UserSchema.index({ eloRating: -1 });

export const User = model<IUser>('User', UserSchema);
