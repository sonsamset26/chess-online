import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { requestLogger } from './middlewares/logger';
import { globalErrorHandler } from './middlewares/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import healthRoutes from './modules/health/health.routes';
import { ApiResponse } from './utils/apiResponse';

dotenv.config();

const app: Application = express();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Mount Modules API Routes (RESTful prefix /api/v1)
app.use('/api/v1', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);

// Unhandled Route Handler (404)
app.use('*', (req: Request, res: Response) => {
  return ApiResponse.error(
    res,
    `Đường dẫn API ${req.originalUrl} không tồn tại trên máy chủ`,
    404
  );
});

// Global Error Handler Middleware
app.use(globalErrorHandler);

export default app;
