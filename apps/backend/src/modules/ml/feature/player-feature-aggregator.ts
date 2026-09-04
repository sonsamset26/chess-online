import { IMatch, PlayerFeatureVector } from '../../match/match.model';
import { GameFeatureService } from './game-feature.service';
import { ProfileReliabilityStatus } from '../profile/player-profile.model';

export interface AggregatedPlayerProfileResult {
  gamesAnalyzed: number;
  movesAnalyzed: number;
  featureVector: PlayerFeatureVector;
  reliabilityStatus: ProfileReliabilityStatus;
  profileWindow: {
    games: number;
    from?: Date;
    to?: Date;
  };
}

export class PlayerFeatureAggregator {
  public static readonly MAX_GAMES_WINDOW = 20;
  public static readonly MIN_GAMES_PRELIMINARY = 5;
  public static readonly MIN_GAMES_USABLE = 10;
  public static readonly MIN_GAMES_STABLE = 20;

  /**
   * Tổng hợp các ván đấu hợp lệ của kỳ thủ với trọng số thời gian (Recency Weighting)
   */
  public static aggregatePlayerFeatures(
    userIdOrUsername: string,
    matches: IMatch[]
  ): AggregatedPlayerProfileResult {
    // 1. Chỉ lấy các ván đấu mang tính cạnh tranh thực tế (PVP_RATED hoặc TOURNAMENT)
    // Loại bỏ hoàn toàn đấu máy (PV_AI) để tránh làm méo mó hành vi thi đấu
    const validMatches = matches
      .filter((m) => m.gameMode === 'PVP_RATED' || m.gameMode === 'TOURNAMENT')
      .slice(0, this.MAX_GAMES_WINDOW);

    const N = validMatches.length;

    // Trạng thái khi chưa đủ dữ liệu tối thiểu
    if (N === 0) {
      return {
        gamesAnalyzed: 0,
        movesAnalyzed: 0,
        featureVector: {
          openingCpl: 0,
          middlegameCpl: 0,
          endgameCpl: 0,
          openingBlunderRate: 0,
          middlegameBlunderRate: 0,
          endgameBlunderRate: 0,
          timePressureBlunderRate: 0,
          averageThinkingTimeMs: 0,
        },
        reliabilityStatus: 'INSUFFICIENT_DATA',
        profileWindow: { games: 0 },
      };
    }

    // Đánh giá mức độ tin cậy của tập mẫu
    let reliabilityStatus: ProfileReliabilityStatus = 'INSUFFICIENT_DATA';
    if (N >= this.MIN_GAMES_STABLE) {
      reliabilityStatus = 'STABLE';
    } else if (N >= this.MIN_GAMES_USABLE) {
      reliabilityStatus = 'USABLE';
    } else if (N >= this.MIN_GAMES_PRELIMINARY) {
      reliabilityStatus = 'PRELIMINARY';
    }

    // 2. Trích xuất vector từng ván và tính trọng số thời gian (Recency Weighting)
    // Sắp xếp từ cũ nhất đến mới nhất để ván mới nhất nhận trọng số cao nhất (w = 1.0, ván cũ w = 0.5)
    const chronologicalMatches = [...validMatches].sort(
      (a, b) => new Date(a.endedAt || a.createdAt).getTime() - new Date(b.endedAt || b.createdAt).getTime()
    );

    let totalWeight = 0;
    let totalMoves = 0;
    const weightedSums: Record<keyof PlayerFeatureVector, number> = {
      openingCpl: 0,
      middlegameCpl: 0,
      endgameCpl: 0,
      openingBlunderRate: 0,
      middlegameBlunderRate: 0,
      endgameBlunderRate: 0,
      timePressureBlunderRate: 0,
      averageThinkingTimeMs: 0,
    };

    for (let i = 0; i < N; i++) {
      const match = chronologicalMatches[i];
      const features = GameFeatureService.extractPlayerFeaturesFromMatch(match, userIdOrUsername);

      if (!features) continue;

      // Trọng số tuyến tính: w_i = 0.5 + 0.5 * (i / (N - 1)) nếu N > 1, nếu N = 1 thì w = 1.0
      const weight = N === 1 ? 1.0 : 0.5 + 0.5 * (i / (N - 1));
      totalWeight += weight;
      totalMoves += match.movesCount || match.moves?.length || 0;

      for (const key of Object.keys(weightedSums) as (keyof PlayerFeatureVector)[]) {
        weightedSums[key] += (features[key] || 0) * weight;
      }
    }

    const safeWeight = totalWeight > 0 ? totalWeight : 1;
    const aggregatedVector: PlayerFeatureVector = {
      openingCpl: Math.round((weightedSums.openingCpl / safeWeight) * 10) / 10,
      middlegameCpl: Math.round((weightedSums.middlegameCpl / safeWeight) * 10) / 10,
      endgameCpl: Math.round((weightedSums.endgameCpl / safeWeight) * 10) / 10,
      openingBlunderRate: Math.round((weightedSums.openingBlunderRate / safeWeight) * 1000) / 1000,
      middlegameBlunderRate: Math.round((weightedSums.middlegameBlunderRate / safeWeight) * 1000) / 1000,
      endgameBlunderRate: Math.round((weightedSums.endgameBlunderRate / safeWeight) * 1000) / 1000,
      timePressureBlunderRate: Math.round((weightedSums.timePressureBlunderRate / safeWeight) * 1000) / 1000,
      averageThinkingTimeMs: Math.round(weightedSums.averageThinkingTimeMs / safeWeight),
    };

    const fromDate = chronologicalMatches[0]?.endedAt || chronologicalMatches[0]?.createdAt;
    const toDate = chronologicalMatches[N - 1]?.endedAt || chronologicalMatches[N - 1]?.createdAt;

    return {
      gamesAnalyzed: N,
      movesAnalyzed: totalMoves,
      featureVector: aggregatedVector,
      reliabilityStatus,
      profileWindow: {
        games: N,
        from: fromDate ? new Date(fromDate) : undefined,
        to: toDate ? new Date(toDate) : undefined,
      },
    };
  }
}
