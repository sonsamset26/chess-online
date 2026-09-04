import { Router } from 'express';
import { PlayerProfileController } from './profile/player-profile.controller';
import { RecommendationController } from './recommendation/recommendation.controller';
import { authenticateJWT, optionalAuthenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

// Profile Endpoints
router.get('/profile/me', authenticateJWT, PlayerProfileController.getMyProfile);
router.post('/profile/recompute', authenticateJWT, PlayerProfileController.recomputeProfile);
router.get('/profile/:userIdOrUsername', optionalAuthenticateJWT, PlayerProfileController.getProfileById);

// Recommendation Endpoints
router.get('/recommendations/puzzles', authenticateJWT, RecommendationController.getMyRecommendedPuzzles);
router.get('/recommendations/puzzles/:userIdOrUsername', optionalAuthenticateJWT, RecommendationController.getPuzzlesForUser);

export default router;
