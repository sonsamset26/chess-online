import { MLModel, IMLModel } from './ml-model.model';
import { StandardScaler } from './standard-scaler';
import { KMeans, KMeansResult } from './kmeans';
import {
  generateBootstrapProfiles,
  CLUSTER_STYLE_NAMES,
  vectorToArray,
} from './synthetic-dataset';
import { PlayerFeatureVector } from '../../match/match.model';

export class MLModelService {
  private static cachedModel: {
    kmeans: KMeans;
    scaler: StandardScaler;
    meta: IMLModel;
  } | null = null;

  /**
   * Lấy mô hình đang hoạt động (Active Model).
   * Nếu trong CSDL chưa có, tự động huấn luyện mô hình cơ sở từ tập dữ liệu Bootstrap.
   */
  public static async getActiveModel(): Promise<{
    kmeans: KMeans;
    scaler: StandardScaler;
    meta: IMLModel;
  }> {
    if (this.cachedModel) {
      return this.cachedModel;
    }

    let activeDoc: IMLModel | null = (await MLModel.findOne({ isCurrentActive: true }).sort({ createdAt: -1 })) as unknown as IMLModel | null;

    if (!activeDoc) {
      console.log('🤖 [MLModelService] Chưa tìm thấy mô hình trong CSDL, bắt đầu khởi tạo mô hình Bootstrap...');
      activeDoc = await this.trainBootstrapModel();
    }

    if (!activeDoc) {
      throw new Error('Không thể nạp hoặc khởi tạo mô hình ML');
    }

    const scaler = new StandardScaler(activeDoc.scaler);
    const kmeans = new KMeans(activeDoc.k);
    kmeans.centroids = activeDoc.centroids;
    kmeans.inertia = activeDoc.inertia;

    const loadedModel = {
      kmeans,
      scaler,
      meta: activeDoc,
    };

    this.cachedModel = loadedModel;
    return loadedModel;
  }

  /**
   * Huấn luyện mô hình từ tập mẫu Bootstrap Cold-Start
   */
  public static async trainBootstrapModel(): Promise<IMLModel> {
    const rawData = generateBootstrapProfiles();
    const scaler = new StandardScaler();
    const scaledData = scaler.fitTransform(rawData);

    const k = 4;
    const kmeans = new KMeans(k);
    kmeans.fit(scaledData);

    const labels = scaledData.map((row) => kmeans.predict(row).clusterId);
    const silhouette = KMeans.computeSilhouetteScore(scaledData, labels, k);

    // Vô hiệu hóa các model active cũ
    await MLModel.updateMany({ isCurrentActive: true }, { $set: { isCurrentActive: false } });

    const clusterLabelsMap: Record<string, string> = {};
    for (let c = 0; c < k; c++) {
      clusterLabelsMap[c.toString()] = CLUSTER_STYLE_NAMES[c] || `Phong cách nhóm ${c + 1}`;
    }

    const newModel = await MLModel.create({
      modelVersion: `kmeans-v1-${Date.now()}`,
      algorithm: 'KMEANS',
      k,
      centroids: kmeans.centroids,
      scaler: scaler.toJSON(),
      silhouetteScore: silhouette,
      inertia: kmeans.inertia,
      clusterLabels: clusterLabelsMap,
      trainingSamplesCount: rawData.length,
      isCurrentActive: true,
      trainedAt: new Date(),
    });

    console.log(`✅ [MLModelService] Huấn luyện thành công mô hình ${newModel.modelVersion} (Silhouette: ${silhouette})`);
    return newModel as unknown as IMLModel;
  }

  /**
   * Phân loại phong cách thi đấu cho vector đặc trưng của kỳ thủ
   */
  public static async predictPlayerStyle(featureVector: PlayerFeatureVector): Promise<KMeansResult & { clusterLabel: string }> {
    const active = await this.getActiveModel();
    const rawArray = vectorToArray(featureVector);
    const scaledVector = active.scaler.transformSingle(rawArray);
    const prediction = active.kmeans.predict(scaledVector);

    const clusterLabel = CLUSTER_STYLE_NAMES[prediction.clusterId] || `Phong cách ${prediction.clusterId + 1}`;

    return {
      ...prediction,
      clusterLabel,
    };
  }
}
