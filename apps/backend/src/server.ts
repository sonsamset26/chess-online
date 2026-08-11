import app from './app';
import { connectDB } from './config/db';

const PORT = process.env.PORT || 5000;

// Kết nối MongoDB và Khởi chạy Server
const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(PORT, () => {
      console.log(`🚀 [Node.js Express Server] đang chạy tại http://localhost:${PORT}`);
      console.log(`📌 API Health Check: http://localhost:${PORT}/api/v1/health`);
    });
  } catch (error) {
    console.error('❌ Lỗi khởi động Server:', error);
    process.exit(1);
  }
};

startServer();
