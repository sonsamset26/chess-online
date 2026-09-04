import { Schema, model, Document } from 'mongoose';
import { ScalerParams } from './standard-scaler';

export interface IMLModel extends Document {
  modelVersion: string;
  algorithm: string;
  k: number;
  centroids: number[][];
  scaler: ScalerParams;
  silhouetteScore: number;
  inertia: number;
  clusterLabels: Record<string, string>;
  trainingSamplesCount: number;
  isCurrentActive: boolean;
  trainedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MLModelSchema = new Schema<IMLModel>(
  {
    modelVersion: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    algorithm: {
      type: String,
      default: 'KMEANS',
    },
    k: {
      type: Number,
      required: true,
      default: 4,
    },
    centroids: {
      type: [[Number]],
      required: true,
    },
    scaler: {
      means: { type: [Number], required: true },
      stds: { type: [Number], required: true },
    },
    silhouetteScore: {
      type: Number,
      default: 0,
    },
    inertia: {
      type: Number,
      default: 0,
    },
    clusterLabels: {
      type: Map,
      of: String,
      default: {},
    },
    trainingSamplesCount: {
      type: Number,
      default: 0,
    },
    isCurrentActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    trainedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const MLModel = model<IMLModel>('MLModel', MLModelSchema);
