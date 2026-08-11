import { Router } from 'express';
import healthRoutes from './health.routes';

const router = Router();

// Mount các sub-routers với prefix API v1
router.use('/v1', healthRoutes);

export default router;
