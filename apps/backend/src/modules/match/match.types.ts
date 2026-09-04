import { Chess } from 'chess.js';
import { MoveTelemetry } from './match.model';

// -----------------------------------------------------------------------------
// DOMAIN MODELS & TYPINGS CHO HỆ THỐNG TRẬN ĐẤU CỜ VUA (MODULAR GAME STATE)
// -----------------------------------------------------------------------------

export interface PlayerState {
  socketId: string;
  userId: string;
  username: string;
  eloRating: number;
  isConnected: boolean;
  disconnectedAt?: number;
}

export interface ClockState {
  whiteTimeMs: number;
  blackTimeMs: number;
  activeColor: 'w' | 'b';
  turnStartedAt: number;
  incrementMs: number;
}

export interface TimeControlConfig {
  initialTimeMs: number;
  incrementMs: number;
  whiteInitialTimeMs?: number;
  blackInitialTimeMs?: number;
}

export interface GameState {
  roomId: string;
  friendRoomCode?: string;
  gameStartedAt: number;
  version: number;
  status: 'READY' | 'PLAYING' | 'RECONNECTING' | 'FINISHED';
  isRated: boolean;
  game: Chess;
  players: {
    white: PlayerState;
    black: PlayerState;
  };
  clock: ClockState;
  timeControl: TimeControlConfig;
  moveTelemetry: MoveTelemetry[];
  winnerColor?: 'w' | 'b' | 'draw';
  endReason?: 'CHECKMATE' | 'TIMEOUT' | 'RESIGNED' | 'ABANDONED' | 'DRAW';
  timeoutTimer?: NodeJS.Timeout;
  disconnectTimers?: { white?: NodeJS.Timeout; black?: NodeJS.Timeout };
  reconnectTimer?: NodeJS.Timeout;
  tournamentContext?: {
    tournamentId: string;
    roundNumber: number;
    matchIndex: number;
  };
  isArmageddon?: boolean;
  drawOfferedBy?: 'w' | 'b' | null;
  liveAnalyses?: Record<number, any>;
}

export interface QueueEntry {
  socketId: string;
  userId: string;
  username: string;
  eloRating: number;
  joinedAt: number;
  timeControl: TimeControlConfig;
  isRated: boolean;
}

export interface FriendRoom {
  roomCode: string;
  roomId: string;
  hostPlayer: PlayerState;
  guestPlayer?: PlayerState;
}

// Cấu hình các bước mở rộng khung Elo theo thời gian chờ (Heuristic Policy)
export const ELO_WINDOW_STEPS = [
  { maxWaitSeconds: 5, delta: 50 },
  { maxWaitSeconds: 15, delta: 100 },
  { maxWaitSeconds: 30, delta: 200 },
  { maxWaitSeconds: Infinity, delta: 400 },
];

/**
 * Kiểm tra xem một bên có bị thiếu lực lượng chiếu hết theo Điều 6.9 Luật FIDE hay không.
 */
export function isPlayerInsufficientToMate(game: Chess, playerColor: 'w' | 'b'): boolean {
  if (game.isInsufficientMaterial()) return true;
  const board = game.board();
  let pawns = 0;
  let knights = 0;
  let bishops = 0;
  let rooks = 0;
  let queens = 0;

  for (const row of board) {
    for (const square of row) {
      if (square && square.color === playerColor) {
        if (square.type === 'p') pawns++;
        else if (square.type === 'n') knights++;
        else if (square.type === 'b') bishops++;
        else if (square.type === 'r') rooks++;
        else if (square.type === 'q') queens++;
      }
    }
  }

  if (pawns === 0 && queens === 0 && rooks === 0) {
    if (knights === 0 && bishops === 0) return true;
    if (knights === 1 && bishops === 0) return true;
    if (knights === 0 && bishops === 1) return true;
  }

  return false;
}
