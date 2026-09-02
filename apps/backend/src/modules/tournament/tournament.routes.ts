import { Router } from 'express';
import { TournamentController } from './tournament.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

// POST /api/v1/tournaments - Tạo giải đấu mới
router.post('/', authenticateJWT, TournamentController.create);

// GET /api/v1/tournaments/:code - Lấy thông tin bracket giải đấu
router.get('/:code', TournamentController.getByCode);

export default router;
