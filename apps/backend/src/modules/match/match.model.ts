import { Schema, model, Document, Types } from 'mongoose';

export interface IMatch extends Document {
  whitePlayer: Types.ObjectId;
  blackPlayer?: Types.ObjectId;
  gameMode: 'PV_AI' | 'PVP_REALTIME';
  aiDifficulty?: number;
  pgn: string;
  finalFen: string;
  result: 'WHITE_WIN' | 'BLACK_WIN' | 'DRAW' | 'IN_PROGRESS';
  movesCount: number;
  startedAt: Date;
  endedAt?: Date;
}

const MatchSchema = new Schema<IMatch>(
  {
    whitePlayer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    blackPlayer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    gameMode: {
      type: String,
      enum: ['PV_AI', 'PVP_REALTIME'],
      default: 'PV_AI',
    },
    aiDifficulty: {
      type: Number,
      enum: [1, 2, 3],
    },
    pgn: {
      type: String,
      default: '',
    },
    finalFen: {
      type: String,
      required: true,
      default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    },
    result: {
      type: String,
      enum: ['WHITE_WIN', 'BLACK_WIN', 'DRAW', 'IN_PROGRESS'],
      default: 'IN_PROGRESS',
    },
    movesCount: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const Match = model<IMatch>('Match', MatchSchema);
