export interface ScalerParams {
  means: number[];
  stds: number[];
}

export class StandardScaler {
  public means: number[] = [];
  public stds: number[] = [];

  constructor(params?: ScalerParams) {
    if (params) {
      this.means = params.means;
      this.stds = params.stds;
    }
  }

  /**
   * Tính kỳ vọng toán học và độ lệch chuẩn cho từng chiều dữ liệu
   */
  public fit(data: number[][]): this {
    if (!data || data.length === 0) return this;
    const numFeatures = data[0].length;
    const n = data.length;

    this.means = new Array(numFeatures).fill(0);
    this.stds = new Array(numFeatures).fill(0);

    for (let j = 0; j < numFeatures; j++) {
      let sum = 0;
      for (let i = 0; i < n; i++) {
        sum += data[i][j];
      }
      this.means[j] = sum / n;

      let varianceSum = 0;
      for (let i = 0; i < n; i++) {
        varianceSum += Math.pow(data[i][j] - this.means[j], 2);
      }
      // Tránh chia cho 0 nếu một chiều có phương sai bằng 0
      this.stds[j] = Math.sqrt(varianceSum / n) || 1e-6;
    }

    return this;
  }

  /**
   * Chuẩn hóa tập dữ liệu về phân phối chuẩn chuẩn hóa Z ~ N(0, 1)
   */
  public transform(data: number[][]): number[][] {
    return data.map((row) => this.transformSingle(row));
  }

  public fitTransform(data: number[][]): number[][] {
    return this.fit(data).transform(data);
  }

  /**
   * Chuẩn hóa 1 vector duy nhất
   */
  public transformSingle(vector: number[]): number[] {
    return vector.map((val, j) => {
      const mean = this.means[j] ?? 0;
      const std = this.stds[j] || 1;
      return (val - mean) / std;
    });
  }

  public toJSON(): ScalerParams {
    return {
      means: [...this.means],
      stds: [...this.stds],
    };
  }
}
