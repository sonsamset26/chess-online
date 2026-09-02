import { Schema, model, Document, Types } from 'mongoose';

export interface IMatch extends Document {
  whitePlayer?: Types.ObjectId;
  blackPlayer?: Types.ObjectId;
  whiteUserId: string;
  blackUserId: string;
  whiteUsername: string;
  blackUsername: string;
  gameMode: 'PV_AI' | 'PVP_RATED' | 'PVP_CUSTOM' | 'TOURNAMENT';
  aiDifficulty?: number;
  winnerColor: 'w' | 'b' | 'draw';
  endReason: 'CHECKMATE' | 'TIMEOUT' | 'RESIGNED' | 'ABANDONED' | 'DRAW';
  isRated: boolean;
  isArmageddon?: boolean;
  tournamentWinnerId?: string;
  tournamentId?: string;
  tournamentRound?: number;
  tournamentMatchIndex?: number;
  whiteEloDelta?: number;
  blackEloDelta?: number;
  whiteOldElo?: number;
  blackOldElo?: number;
  moves: string[];
  pgn: string;
  finalFen: string;
  movesCount: number;
  timeControl?: {
    initialSeconds: number;
    incrementSeconds: number;
  };
  startedAt: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MatchSchema = new Schema<IMatch>(
  {
    whitePlayer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    blackPlayer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    whiteUserId: {
      type: String,
      required: true,
      index: true,
    },
    blackUserId: {
      type: String,
      required: true,
      index: true,
    },
    whiteUsername: {
      type: String,
      required: true,
    },
    blackUsername: {
      type: String,
      required: true,
    },
    gameMode: {
      type: String,
      enum: ['PV_AI', 'PVP_RATED', 'PVP_CUSTOM', 'TOURNAMENT'],
      default: 'PVP_RATED',
    },
    isArmageddon: {
      type: Boolean,
      default: false,
    },
    tournamentWinnerId: {
      type: String,
    },
    tournamentId: {
      type: String,
      index: true,
    },
    tournamentRound: {
      type: Number,
    },
    tournamentMatchIndex: {
      type: Number,
    },
    aiDifficulty: {
      type: Number,
      enum: [1, 2, 3],
    },
    winnerColor: {
      type: String,
      enum: ['w', 'b', 'draw'],
      required: true,
    },
    endReason: {
      type: String,
      enum: ['CHECKMATE', 'TIMEOUT', 'RESIGNED', 'ABANDONED', 'DRAW'],
      default: 'CHECKMATE',
    },
    isRated: {
      type: Boolean,
      default: false,
    },
    whiteEloDelta: {
      type: Number,
      default: 0,
    },
    blackEloDelta: {
      type: Number,
      default: 0,
    },
    whiteOldElo: {
      type: Number,
    },
    blackOldElo: {
      type: Number,
    },
    moves: {
      type: [String],
      default: [],
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
    movesCount: {
      type: Number,
      default: 0,
    },
    timeControl: {
      initialSeconds: {
        type: Number,
        default: 600,
      },
      incrementSeconds: {
        type: Number,
        default: 0,
      },
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index tối ưu hóa truy vấn lịch sử đấu theo người chơi và thời gian
MatchSchema.index({ whiteUserId: 1, endedAt: -1 });
MatchSchema.index({ blackUserId: 1, endedAt: -1 });
MatchSchema.index({ whiteUsername: 1, endedAt: -1 });
MatchSchema.index({ blackUsername: 1, endedAt: -1 });
MatchSchema.index({ whitePlayer: 1, endedAt: -1 });
MatchSchema.index({ blackPlayer: 1, endedAt: -1 });
MatchSchema.index({ tournamentId: 1, tournamentRound: 1, tournamentMatchIndex: 1 });

export const Match = model<IMatch>('Match', MatchSchema);
