import { Router } from 'express';
import { TournamentController } from './tournament.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

// POST /api/v1/tournaments - Tạo giải đấu mới
router.post('/', authenticateJWT, TournamentController.create);

// GET /api/v1/tournaments/me - Lấy lịch sử giải đấu của tài khoản hiện tại (JWT required)
// Đặt TRƯỚC dynamic route để tránh bị :idOrCode bắt nhầm
router.get('/me', authenticateJWT, TournamentController.getMyTournaments);

// GET /api/v1/tournaments/:idOrCode - Lấy thông tin chi tiết giải đấu theo code (6 ký tự) hoặc tournamentId
router.get('/:idOrCode', TournamentController.getByIdOrCode);

export default router;
