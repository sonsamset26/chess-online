import { Request, Response } from 'express';
import { puzzleService } from './puzzle.service';

export class PuzzleController {
  async getPuzzles(req: Request, res: Response): Promise<void> {
    try {
      const puzzles = await puzzleService.getAllPuzzles();
      res.status(200).json({
        success: true,
        count: puzzles.length,
        data: puzzles,
      });
    } catch (err: any) {
      console.error('Error fetching puzzles from MongoDB:', err);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy dữ liệu cờ thế' });
    }
  }

  async seedPuzzles(req: Request, res: Response): Promise<void> {
    try {
      await puzzleService.seedPuzzles();
      res.status(200).json({ success: true, message: 'Đã nạp bài tập cờ thế vào MongoDB Cloud thành công!' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Lỗi máy chủ khi seed cờ thế' });
    }
  }
}

export const puzzleController = new PuzzleController();
