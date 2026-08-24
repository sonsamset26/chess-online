import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { connectDB } from './config/db';
import { MatchGateway } from './modules/match/match.gateway';

const PORT = process.env.PORT || 5000;

// Tạo Node.js HTTP Server bọc Express App
const httpServer = http.createServer(app);

// Khởi tạo Socket.io Gateway hỗ trợ CORS
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Khởi tạo Match Gateway quản lý ghép trận Realtime
new MatchGateway(io);

// Kết nối MongoDB và Khởi chạy Server
const startServer = async () => {
  try {
    await connectDB();
    
    httpServer.listen(PORT, () => {
      console.log(`🚀 [Node.js Express & Socket.io Server] đang chạy tại http://localhost:${PORT}`);
      console.log(`📌 API Health Check: http://localhost:${PORT}/api/v1/health`);
    });
  } catch (error) {
    console.error('❌ Lỗi khởi động Server:', error);
    process.exit(1);
  }
};

startServer();
