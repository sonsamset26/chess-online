import dotenv from 'dotenv';
import { connectDB } from '../config/db';
import { User } from '../modules/user/user.model';
import { Match } from '../modules/match/match.model';
import { PuzzleModel } from '../modules/puzzle/puzzle.model';
import { INITIAL_PUZZLES } from '../modules/puzzle/puzzle.service';

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();

    console.log('🧹 Đang làm sạch dữ liệu cũ...');
    await User.deleteMany({});
    await Match.deleteMany({});
    await PuzzleModel.deleteMany({});

    console.log('🌱 Đang khởi tạo dữ liệu mẫu (Seed Data)...');

    // 1. Tạo các Tài khoản Mẫu (Users)
    const admin = await User.create({
      email: 'admin@chess.online',
      username: 'chess_admin',
      name: 'Phan Hồng Sơn (Admin)',
      passwordHash: '$2a$10$X8XzQ1K2K3K4K5K6K7K8K.z9y8x7w6v5u4t3s2r1q0p9o8n7m6',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
      eloRating: 2000,
      role: 'ADMIN',
    });

    const player1 = await User.create({
      email: 'magnus@chess.online',
      username: 'Magnus Carlsen',
      name: 'Magnus Carlsen',
      passwordHash: '$2a$10$X8XzQ1K2K3K4K5K6K7K8K.z9y8x7w6v5u4t3s2r1q0p9o8n7m6',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=magnus',
      eloRating: 2882,
      wins: 45,
      losses: 5,
      draws: 10,
      totalGames: 60,
    });

    const player2 = await User.create({
      email: 'hikaru@chess.online',
      username: 'Hikaru Nakamura',
      name: 'Hikaru Nakamura',
      passwordHash: '$2a$10$X8XzQ1K2K3K4K5K6K7K8K.z9y8x7w6v5u4t3s2r1q0p9o8n7m6',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=hikaru',
      eloRating: 2875,
      wins: 40,
      losses: 8,
      draws: 12,
      totalGames: 60,
    });

    // 2. Tạo Lịch sử Trận đấu Mẫu (Match)
    await Match.create({
      whitePlayer: player1._id,
      blackPlayer: player2._id,
      gameMode: 'PVP_REALTIME',
      pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7',
      finalFen: 'r1bqk2r/1pp1bppp/p1np1n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 2 6',
      result: 'WHITE_WIN',
      movesCount: 5,
      endedAt: new Date(),
    });

    // 3. Tạo Bài tập Cờ thế Mẫu (Puzzles) vào MongoDB Atlas
    await PuzzleModel.insertMany(INITIAL_PUZZLES);

    console.log('✅ KHỞI TẠO CÁC COLLECTION VÀ DỮ LIỆU MẪU THÀNH CÔNG!');
    console.log('📊 Các collection đã được tạo trên MongoDB Cloud: [users, matches, puzzles]');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi seed data:', error);
    process.exit(1);
  }
};

seedData();
