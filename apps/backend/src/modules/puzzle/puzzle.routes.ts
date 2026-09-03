import { Router } from 'express';
import { puzzleController } from './puzzle.controller';
import { authenticateJWT, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { ApiResponse } from '../../utils/apiResponse';

const router = Router();

router.get('/', (req, res) => puzzleController.getPuzzles(req, res));
router.post('/seed', authenticateJWT, (req: AuthenticatedRequest, res) => {
  if (req.user?.role !== 'ADMIN') {
    return ApiResponse.error(res, 'Chỉ Quản trị viên (ADMIN) mới có quyền tạo lại dữ liệu cờ thế.', 403);
  }
  return puzzleController.seedPuzzles(req, res);
});

export default router;
