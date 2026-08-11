import { Router } from 'express';
import { UserController } from './user.controller';

const router = Router();

router.get('/leaderboard', UserController.getLeaderboard);

export default router;
