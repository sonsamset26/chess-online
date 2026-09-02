import { Router } from 'express';
import { MatchController } from './match.controller';
import { authenticateJWT, optionalAuthenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

// Endpoint bảo mật xem lịch sử ván đấu của chính tài khoản đăng nhập (JWT)
router.get('/me', authenticateJWT, MatchController.getMyHistory);

// Endpoint xem chi tiết ván đấu (cho phép công khai với giải đấu, hoặc kiểm tra quyền sở hữu)
router.get('/:id', optionalAuthenticateJWT, MatchController.getMatchById);

export default router;
