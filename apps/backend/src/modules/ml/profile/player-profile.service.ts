import mongoose from 'mongoose';
import { PlayerProfile, IPlayerProfile } from './player-profile.model';
import { PlayerFeatureAggregator } from '../feature/player-feature-aggregator';
import { MLModelService } from '../model/ml-model.service';
import { WeaknessAnalyzer, WeaknessAnalysisResult } from './weakness-analyzer';
import { Match, IMatch } from '../../match/match.model';
import { User } from '../../user/user.model';

export interface EnrichedPlayerProfileResponse extends IPlayerProfile {
  weaknessAnalysis?: WeaknessAnalysisResult;
}

export class PlayerProfileService {
  /**
   * Lấy hồ sơ hành vi kỳ thủ đã lưu trữ sẵn trong MongoDB (Materialized View)
   */
  public static async getProfile(userIdOrUsername: string): Promise<EnrichedPlayerProfileResponse | null> {
    let profile = await PlayerProfile.findOne({
      $or: [{ userId: userIdOrUsername }, { username: userIdOrUsername }],
    }).lean() as unknown as IPlayerProfile | null;

    // Nếu chưa có hồ sơ, tự động tính toán tổng hợp lần đầu
    if (!profile) {
      profile = await this.aggregateAndSaveProfile(userIdOrUsername);
    }

    if (!profile) return null;

    // Bổ sung phân tích điểm yếu chi tiết theo thời gian thực
    const weaknessAnalysis = WeaknessAnalyzer.analyzeWeakness(profile.featureVector);

    return {
      ...(profile as any),
      weaknessAnalysis,
    };
  }

  /**
   * Thu thập dữ liệu ván đấu và cập nhật/tạo mới hồ sơ kỳ thủ trong MongoDB
   */
  public static async aggregateAndSaveProfile(userIdOrUsername: string): Promise<IPlayerProfile | null> {
    // 1. Tìm thông tin người dùng
    let user = null;
    if (mongoose.Types.ObjectId.isValid(userIdOrUsername)) {
      user = await User.findById(userIdOrUsername);
    }
    if (!user) {
      user = await User.findOne({
        $or: [{ userId: userIdOrUsername }, { username: userIdOrUsername }],
      });
    }

    const userId = user ? (user.id || user._id.toString()) : userIdOrUsername;
    const username = user?.username || userIdOrUsername;

    // 2. Truy vấn các ván cờ xếp hạng hoặc đấu giải gần nhất
    const matches = await Match.find({
      $or: [
        { whiteUserId: userId },
        { blackUserId: userId },
        { whiteUsername: username },
        { blackUsername: username },
      ],
      gameMode: { $in: ['PVP_RATED', 'TOURNAMENT'] },
    })
      .sort({ endedAt: -1, createdAt: -1 })
      .limit(PlayerFeatureAggregator.MAX_GAMES_WINDOW)
      .lean();

    // 3. Thực hiện tổng hợp đặc trưng
    const aggregation = PlayerFeatureAggregator.aggregatePlayerFeatures(
      userId,
      matches as unknown as IMatch[]
    );

    // 4. Dự đoán Cụm phong cách (KMeans Clustering Inference)
    let clusterId = 0;
    let clusterLabel = 'Đang phân tích phong cách';
    let similarityScore = 50;

    try {
      const mlPrediction = await MLModelService.predictPlayerStyle(aggregation.featureVector);
      clusterId = mlPrediction.clusterId;
      clusterLabel = mlPrediction.clusterLabel;
      similarityScore = mlPrediction.similarityScore;
    } catch (mlErr) {
      console.warn('Lỗi dự đoán phong cách kỳ thủ bằng ML:', mlErr);
    }

    // 5. Chẩn đoán điểm yếu (Weakness Diagnosis)
    const weakness = WeaknessAnalyzer.analyzeWeakness(aggregation.featureVector);

    // 6. Lưu hoặc cập nhật vào bảng PlayerProfile
    const updated = await PlayerProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          user: user?._id,
          username,
          gamesAnalyzed: aggregation.gamesAnalyzed,
          movesAnalyzed: aggregation.movesAnalyzed,
          featureVector: aggregation.featureVector,
          reliabilityStatus: aggregation.reliabilityStatus,
          profileWindow: aggregation.profileWindow,
          clusterId,
          clusterLabel,
          similarityScore,
          weakestPhase: weakness.weakestPhase,
          weaknessScore: weakness.weaknessScore,
          featureVersion: 'feature-v1',
          modelVersion: 'kmeans-v1',
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return updated;
  }
}
