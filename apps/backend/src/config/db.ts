import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Nạp file .env đảm bảo luôn đọc đúng chuỗi MONGODB_URI
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI =
      process.env.MONGODB_URI ||
      process.env.MONGO_URI ||
      'mongodb://127.0.0.1:27017/chess_online';

    const isCloud = mongoURI.includes('mongodb+srv');

    const conn = await mongoose.connect(mongoURI);
    console.log(
      `🍃 [MongoDB ${isCloud ? 'Atlas Cloud' : 'Local'}] Kết nối CSDL thành công: ${conn.connection.host}`
    );
  } catch (error) {
    console.error('❌ [MongoDB] Lỗi kết nối CSDL:', error);
    process.exit(1);
  }
};
