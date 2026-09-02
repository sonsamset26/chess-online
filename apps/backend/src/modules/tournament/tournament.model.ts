import { Schema, model, Document } from 'mongoose';

export interface ITournamentPlayer {
  userId: string;
  username: string;
  eloRating: number;
}

export interface ITournamentMatch {
  matchId: string | null;
  armageddonMatchId?: string;
  player1: string | null;
  player2: string | null;
  winnerId: string | null;
  status: 'PENDING' | 'PLAYING' | 'DONE';
}

export interface ITournamentRound {
  roundNumber: number;
  matches: ITournamentMatch[];
}

export interface ITournament extends Document {
  tournamentId: string;
  code: string;
  hostUserId: string;
  hostUsername: string;
  size: 4 | 8;
  status: 'WAITING' | 'IN_PROGRESS' | 'FINISHED';
  players: ITournamentPlayer[];
  rounds: ITournamentRound[];
  championId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const TournamentMatchSchema = new Schema<ITournamentMatch>(
  {
    matchId: { type: String, default: null },
    armageddonMatchId: { type: String, default: null },
    player1: { type: String, default: null },
    player2: { type: String, default: null },
    winnerId: { type: String, default: null },
    status: {
      type: String,
      enum: ['PENDING', 'PLAYING', 'DONE'],
      default: 'PENDING',
    },
  },
  { _id: false }
);

const TournamentRoundSchema = new Schema<ITournamentRound>(
  {
    roundNumber: { type: Number, required: true },
    matches: [TournamentMatchSchema],
  },
  { _id: false }
);

const TournamentSchema = new Schema<ITournament>(
  {
    tournamentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    hostUserId: {
      type: String,
      required: true,
      index: true,
    },
    hostUsername: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      enum: [4, 8],
      required: true,
    },
    status: {
      type: String,
      enum: ['WAITING', 'IN_PROGRESS', 'FINISHED'],
      default: 'WAITING',
      index: true,
    },
    players: [
      {
        userId: { type: String, required: true },
        username: { type: String, required: true },
        eloRating: { type: Number, default: 1200 },
      },
    ],
    rounds: [TournamentRoundSchema],
    championId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Tournament = model<ITournament>('Tournament', TournamentSchema);
