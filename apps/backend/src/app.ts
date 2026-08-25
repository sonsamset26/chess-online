import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './config/swagger';
import { requestLogger } from './middlewares/logger';
import { globalErrorHandler } from './middlewares/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import healthRoutes from './modules/health/health.routes';
import puzzleRoutes from './modules/puzzle/puzzle.routes';
import { ApiResponse } from './utils/apiResponse';

dotenv.config();

const app: Application = express();

// Global Middlewares
app.use(
  cors({
    origin: true,
    credentials: true, // Cho phép gửi nhận httpOnly Cookie giữa Client và Server
  })
);
app.use(cookieParser()); // Middleware bóc tách Cookie an toàn
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// GẮN CỔNG TÀI LIỆU API (SWAGGER UI OPENAPI 3.0) TẠI /api VÀ /api/docs
const swaggerCustomOptions = {
  customSiteTitle: 'Chess Online API Documentation | https://chessvn.tech',
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { color: #db2777; font-weight: 800; }
    .swagger-ui .scheme-container { background: #fdf2f8; padding: 15px; border-radius: 12px; }
  `,
};

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerCustomOptions));
app.use('/api', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerCustomOptions));

// Mount Modules API Routes (RESTful prefix /api/v1)
app.use('/api/v1', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/puzzles', puzzleRoutes);
app.use('/api/puzzles', puzzleRoutes);

// Unhandled Route Handler (404)
app.use('*', (req: Request, res: Response) => {
  return ApiResponse.error(
    res,
    `Đường dẫn API ${req.originalUrl} không tồn tại trên máy chủ. Xem tài liệu API tại: https://chessvn.tech/api`,
    404
  );
});

// Global Error Handler Middleware
app.use(globalErrorHandler);

export default app;
