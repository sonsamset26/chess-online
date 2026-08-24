import { Router } from 'express';
import { puzzleController } from './puzzle.controller';

const router = Router();

router.get('/', (req, res) => puzzleController.getPuzzles(req, res));
router.post('/seed', (req, res) => puzzleController.seedPuzzles(req, res));

export default router;
