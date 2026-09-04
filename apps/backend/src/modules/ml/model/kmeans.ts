export interface KMeansResult {
  clusterId: number;
  distance: number;
  distances: number[];
  similarityScore: number;
}

export class KMeans {
  public k: number;
  public maxIterations: number;
  public centroids: number[][] = [];
  public inertia: number = 0;

  constructor(k: number = 4, maxIterations: number = 100) {
    this.k = k;
    this.maxIterations = maxIterations;
  }

  /**
   * Tính khoảng cách Euclidean giữa 2 vector
   */
  public static euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  }

  /**
   * Khởi tạo tâm cụm thông minh K-Means++
   */
  private initCentroidsKMeansPlusPlus(data: number[][]): number[][] {
    const n = data.length;
    const centroids: number[][] = [];

    // Chọn tâm đầu tiên ngẫu nhiên
    const firstIdx = Math.floor(Math.random() * n);
    centroids.push([...data[firstIdx]]);

    // Chọn k-1 tâm tiếp theo dựa trên xác suất tỷ lệ thuận với bình phương khoảng cách
    while (centroids.length < this.k) {
      const distances: number[] = [];
      let totalDistSq = 0;

      for (let i = 0; i < n; i++) {
        let minDist = Infinity;
        for (const c of centroids) {
          const d = KMeans.euclideanDistance(data[i], c);
          if (d < minDist) minDist = d;
        }
        const distSq = minDist * minDist;
        distances.push(distSq);
        totalDistSq += distSq;
      }

      let target = Math.random() * totalDistSq;
      let selectedIdx = 0;
      for (let i = 0; i < n; i++) {
        target -= distances[i];
        if (target <= 0) {
          selectedIdx = i;
          break;
        }
      }
      centroids.push([...data[selectedIdx]]);
    }

    return centroids;
  }

  /**
   * Huấn luyện K-Means trên tập dữ liệu đã chuẩn hóa
   */
  public fit(data: number[][]): this {
    if (data.length < this.k) {
      throw new Error(`Số lượng mẫu (${data.length}) phải lớn hơn hoặc bằng số cụm k (${this.k})`);
    }

    const numFeatures = data[0].length;
    this.centroids = this.initCentroidsKMeansPlusPlus(data);

    let labels = new Array(data.length).fill(0);

    for (let iter = 0; iter < this.maxIterations; iter++) {
      // 1. Phân bổ từng điểm vào tâm gần nhất
      let changed = false;
      for (let i = 0; i < data.length; i++) {
        let nearestCluster = 0;
        let minDistance = Infinity;

        for (let c = 0; c < this.k; c++) {
          const dist = KMeans.euclideanDistance(data[i], this.centroids[c]);
          if (dist < minDistance) {
            minDistance = dist;
            nearestCluster = c;
          }
        }

        if (labels[i] !== nearestCluster) {
          labels[i] = nearestCluster;
          changed = true;
        }
      }

      // 2. Cập nhật lại tọa độ tâm cụm
      const newCentroids: number[][] = Array.from({ length: this.k }, () => new Array(numFeatures).fill(0));
      const clusterCounts: number[] = new Array(this.k).fill(0);

      for (let i = 0; i < data.length; i++) {
        const cluster = labels[i];
        clusterCounts[cluster]++;
        for (let j = 0; j < numFeatures; j++) {
          newCentroids[cluster][j] += data[i][j];
        }
      }

      for (let c = 0; c < this.k; c++) {
        if (clusterCounts[c] > 0) {
          for (let j = 0; j < numFeatures; j++) {
            newCentroids[c][j] /= clusterCounts[c];
          }
        } else {
          // Nếu cụm rỗng, tái chỉ định tâm ngẫu nhiên
          newCentroids[c] = [...data[Math.floor(Math.random() * data.length)]];
        }
      }

      // Kiểm tra hội tụ (Centroid movement delta < 1e-4)
      let maxMovement = 0;
      for (let c = 0; c < this.k; c++) {
        const movement = KMeans.euclideanDistance(this.centroids[c], newCentroids[c]);
        if (movement > maxMovement) maxMovement = movement;
      }

      this.centroids = newCentroids;

      if (!changed || maxMovement < 1e-4) {
        break;
      }
    }

    // Tính tổng sai số bình phương quán tính (Inertia)
    this.inertia = 0;
    for (let i = 0; i < data.length; i++) {
      const dist = KMeans.euclideanDistance(data[i], this.centroids[labels[i]]);
      this.inertia += dist * dist;
    }

    return this;
  }

  /**
   * Dự đoán cụm cho một vector mới
   */
  public predict(vector: number[]): KMeansResult {
    let nearestCluster = 0;
    let minDistance = Infinity;
    const distances: number[] = [];

    for (let c = 0; c < this.k; c++) {
      const dist = KMeans.euclideanDistance(vector, this.centroids[c]);
      distances.push(dist);
      if (dist < minDistance) {
        minDistance = dist;
        nearestCluster = c;
      }
    }

    // Quy đổi khoảng cách Euclidean sang Điểm tương đồng 0-100% bằng hàm Gaussian kernel
    // similarity = exp(-distance / 2) * 100%
    const similarityScore = Math.max(10, Math.min(99, Math.round(Math.exp(-minDistance / 3) * 100)));

    return {
      clusterId: nearestCluster,
      distance: minDistance,
      distances,
      similarityScore,
    };
  }

  /**
   * Tính hệ số Silhouette Score để đánh giá chất lượng phân cụm (-1 đến +1)
   */
  public static computeSilhouetteScore(data: number[][], labels: number[], k: number): number {
    const n = data.length;
    if (n <= k) return 0;

    let totalSilhouette = 0;

    for (let i = 0; i < n; i++) {
      const currentCluster = labels[i];

      // 1. a(i): Khoảng cách trung bình nội bộ cụm
      let sameClusterDistSum = 0;
      let sameClusterCount = 0;

      // 2. b(i): Khoảng cách trung bình nhỏ nhất tới các cụm khác
      const otherClusterDistSums: number[] = new Array(k).fill(0);
      const otherClusterCounts: number[] = new Array(k).fill(0);

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const d = KMeans.euclideanDistance(data[i], data[j]);
        if (labels[j] === currentCluster) {
          sameClusterDistSum += d;
          sameClusterCount++;
        } else {
          otherClusterDistSums[labels[j]] += d;
          otherClusterCounts[labels[j]]++;
        }
      }

      const a_i = sameClusterCount > 0 ? sameClusterDistSum / sameClusterCount : 0;

      let b_i = Infinity;
      for (let c = 0; c < k; c++) {
        if (c === currentCluster || otherClusterCounts[c] === 0) continue;
        const meanDistToCluster = otherClusterDistSums[c] / otherClusterCounts[c];
        if (meanDistToCluster < b_i) {
          b_i = meanDistToCluster;
        }
      }
      if (b_i === Infinity) b_i = 0;

      const max_ab = Math.max(a_i, b_i);
      const s_i = max_ab > 0 ? (b_i - a_i) / max_ab : 0;
      totalSilhouette += s_i;
    }

    return Math.round((totalSilhouette / n) * 1000) / 1000;
  }
}
