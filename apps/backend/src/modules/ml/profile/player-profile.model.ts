import { Schema, model, Document, Types } from 'mongoose';
import { PlayerFeatureVector } from '../../match/match.model';

export type ProfileReliabilityStatus = 'INSUFFICIENT_DATA' | 'PRELIMINARY' | 'USABLE' | 'STABLE';

export interface IPlayerProfile extends Document {
  userId: string;
  user?: Types.ObjectId;
  username: string;
  gamesAnalyzed: number;
  movesAnalyzed: number;
  featureVector: PlayerFeatureVector;
  reliabilityStatus: ProfileReliabilityStatus;
  profileWindow: {
    games: number;
    from?: Date;
    to?: Date;
  };
  clusterId?: number;
  clusterLabel?: string;
  similarityScore?: number;
  weakestPhase?: 'OPENING' | 'MIDDLEGAME' | 'ENDGAME';
  weaknessScore?: number;
  modelVersion: string;
  featureVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

const PlayerProfileSchema = new Schema<IPlayerProfile>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    username: {
      type: String,
      required: true,
      index: true,
    },
    gamesAnalyzed: {
      type: Number,
      required: true,
      default: 0,
    },
    movesAnalyzed: {
      type: Number,
      required: true,
      default: 0,
    },
    featureVector: {
      openingCpl: { type: Number, default: 0 },
      middlegameCpl: { type: Number, default: 0 },
      endgameCpl: { type: Number, default: 0 },
      openingBlunderRate: { type: Number, default: 0 },
      middlegameBlunderRate: { type: Number, default: 0 },
      endgameBlunderRate: { type: Number, default: 0 },
      timePressureBlunderRate: { type: Number, default: 0 },
      averageThinkingTimeMs: { type: Number, default: 0 },
    },
    reliabilityStatus: {
      type: String,
      enum: ['INSUFFICIENT_DATA', 'PRELIMINARY', 'USABLE', 'STABLE'],
      default: 'INSUFFICIENT_DATA',
    },
    profileWindow: {
      games: { type: Number, default: 0 },
      from: { type: Date },
      to: { type: Date },
    },
    clusterId: { type: Number },
    clusterLabel: { type: String },
    similarityScore: { type: Number },
    weakestPhase: {
      type: String,
      enum: ['OPENING', 'MIDDLEGAME', 'ENDGAME'],
    },
    weaknessScore: { type: Number },
    modelVersion: {
      type: String,
      default: 'kmeans-v1',
    },
    featureVersion: {
      type: String,
      default: 'feature-v1',
    },
  },
  {
    timestamps: true,
  }
);

export const PlayerProfile = model<IPlayerProfile>('PlayerProfile', PlayerProfileSchema);
