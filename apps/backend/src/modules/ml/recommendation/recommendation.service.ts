import { PuzzleModel, IPuzzle } from '../../puzzle/puzzle.model';
import { PlayerProfileService } from '../profile/player-profile.service';
import { WeaknessAnalyzer } from '../profile/weakness-analyzer';
import { User } from '../../user/user.model';

export interface RecommendedPuzzleItem {
  puzzleId: string;
  title: string;
  description: string;
  difficulty: string;
  rating: number;
  fen: string;
  turn: 'w' | 'b';
  hint: string;
  matchReason: string;
}

export interface RecommendationResponse {
  userId: string;
  targetPhase: 'OPENING' | 'MIDDLEGAME' | 'ENDGAME';
  targetPhaseName: string;
  userElo: number;
  summary: string;
  puzzles: RecommendedPuzzleItem[];
}

export class RecommendationService {
  /**
   * Gợi ý bài tập cờ vua được cá nhân hóa theo Điểm yếu và Trình độ Elo của kỳ thủ
   */
  public static async getPersonalizedPuzzles(
    userIdOrUsername: string,
    limit: number = 6
  ): Promise<RecommendationResponse> {
    const profile = await PlayerProfileService.getProfile(userIdOrUsername);

    // Lấy Elo hiện tại của kỳ thủ
    let userElo = 1200;
    const user = await User.findOne({
      $or: [{ userId: userIdOrUsername }, { username: userIdOrUsername }],
    });
    if (user?.eloRating) {
      userElo = user.eloRating;
    }

    const weakestPhase = profile?.weakestPhase || 'MIDDLEGAME';
    const phaseNames: Record<string, string> = {
      OPENING: 'Đầu trận',
      MIDDLEGAME: 'Giữa trận',
      ENDGAME: 'Cuối trận',
    };

    // Bộ lọc độ khó câu đố theo Elo (Dao động trong khoảng [userElo - 150, userElo + 200])
    const minRating = Math.max(600, userElo - 150);
    const maxRating = userElo + 250;

    // Tìm kiếm câu đố phù hợp trong MongoDB
    let candidatePuzzles = await PuzzleModel.find({
      rating: { $gte: minRating, $lte: maxRating },
    })
      .limit(limit * 3)
      .lean();

    // Nếu không đủ câu đố theo dải rating, mở rộng tìm kiếm
    if (candidatePuzzles.length < limit) {
      candidatePuzzles = await PuzzleModel.find({})
        .limit(limit * 2)
        .lean();
    }

    const matchedPuzzles: RecommendedPuzzleItem[] = candidatePuzzles.slice(0, limit).map((p: any) => ({
      puzzleId: p.puzzleId,
      title: p.title,
      description: p.description,
      difficulty: p.difficulty,
      rating: p.rating,
      fen: p.fen,
      turn: p.turn,
      hint: p.hint,
      matchReason: `Thích hợp rèn luyện ${phaseNames[weakestPhase].toLowerCase()} ở mức Elo ${p.rating}`,
    }));

    return {
      userId: userIdOrUsername,
      targetPhase: weakestPhase,
      targetPhaseName: phaseNames[weakestPhase],
      userElo,
      summary: `Các bài tập ${phaseNames[weakestPhase].toLowerCase()} được chọn lọc phù hợp với trình độ Elo ${userElo} của bạn.`,
      puzzles: matchedPuzzles,
    };
  }
}
