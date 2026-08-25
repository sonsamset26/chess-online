import { Router } from 'express';
import { AuthController } from './auth.controller';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/google', AuthController.googleLogin);
router.post('/refresh', AuthController.refreshToken);
router.post('/logout', AuthController.logout);

export default router;
