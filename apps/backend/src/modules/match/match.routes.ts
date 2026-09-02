import { Router } from 'express';
import { MatchController } from './match.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

// Endpoint bảo mật xem lịch sử ván đấu của chính tài khoản đăng nhập (JWT)
router.get('/me', authenticateJWT, MatchController.getMyHistory);

// Endpoint xem chi tiết ván đấu (kiểm tra quyền sở hữu qua JWT hoặc Admin)
router.get('/:id', authenticateJWT, MatchController.getMatchById);

export default router;
