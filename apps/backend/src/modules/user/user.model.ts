import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name: string;
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
    name: {
      type: String,
      required: [true, 'Tên hiển thị là bắt buộc'],
      trim: true,
      minlength: [2, 'Tên hiển thị tối thiểu 2 ký tự'],
      maxlength: [50, 'Tên hiển thị tối đa 50 ký tự'],
    },
    username: {
      type: String,
      trim: true,
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
      index: true,
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

UserSchema.index({ eloRating: -1 });

export const User = model<IUser>('User', UserSchema);
