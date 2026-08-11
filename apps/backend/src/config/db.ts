import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chess_online';
    
    const conn = await mongoose.connect(mongoURI);
    console.log(`🍃 [MongoDB] Kết nối cơ sở dữ liệu thành công: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ [MongoDB] Lỗi kết nối CSDL:', error);
    process.exit(1);
  }
};
