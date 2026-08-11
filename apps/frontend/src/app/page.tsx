'use client';

import React from 'react';
import { useChessEngine } from '../hooks/useChessEngine';
import { Header } from '../components/Header';
import { PlayerCard } from '../components/PlayerCard';
import { ChessBoardComponent } from '../components/ChessBoard';
import { DifficultySelector } from '../components/DifficultySelector';
import { GameControls } from '../components/GameControls';
import { MoveHistory } from '../components/MoveHistory';
import { Cpu } from 'lucide-react';

export default function PvAIPage() {
  const {
    fen,
    playerColor,
    difficulty,
    isAiThinking,
    gameStatus,
    moveHistory,
    setDifficulty,
    makePlayerMove,
    resetGame,
    togglePlayerColor,
  } = useChessEngine();

  const aiColor = playerColor === 'w' ? 'b' : 'w';

  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-950 bg-radial-glow text-slate-100 flex flex-col p-2.5 md:p-4 select-none">
      {/* Sleek Header */}
      <Header />

      {/* Main Grid Fit Screen */}
      <div className="w-full max-w-6xl mx-auto flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 items-center justify-center">
        {/* Left Column: AI Card + Chessboard + Player Card */}
        <div className="lg:col-span-7 flex flex-col items-center justify-between h-full py-1">
          {/* Opponent Info Card (AI) */}
          <PlayerCard
            isAi={true}
            name="Stockfish Engine"
            subText={
              difficulty === 1
                ? 'Mức: Dễ (~800 Elo)'
                : difficulty === 2
                ? 'Mức: Trung bình (~1400 Elo)'
                : 'Mức: Khó (~2000 Elo)'
            }
            color={aiColor}
            isThinking={isAiThinking}
            gameStatus={gameStatus}
          />

          {/* Interactive Chessboard */}
          <ChessBoardComponent
            fen={fen}
            playerColor={playerColor}
            onPieceDrop={makePlayerMove}
            disabled={isAiThinking}
          />

          {/* Player Info Card */}
          <PlayerCard
            isAi={false}
            name="Người chơi (Bạn)"
            subText={playerColor === 'w' ? 'Cầm quân Trắng' : 'Cầm quân Đen'}
            color={playerColor}
            gameStatus={gameStatus}
          />
        </div>

        {/* Right Column: Controls & Move History */}
        <div className="lg:col-span-5 flex flex-col gap-3 h-full max-h-[calc(100vh-90px)] justify-between">
          {/* Game Controls Card */}
          <div className="p-4 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800 flex flex-col gap-3.5 shadow-xl shrink-0">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h2 className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-blue-400" />
                Cấu hình Trận đấu
              </h2>
              <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Sẵn sàng
              </span>
            </div>

            <DifficultySelector
              difficulty={difficulty}
              onSelect={setDifficulty}
              disabled={isAiThinking}
            />

            <GameControls
              onReset={resetGame}
              onToggleColor={togglePlayerColor}
              playerColor={playerColor}
              disabled={isAiThinking}
            />
          </div>

          {/* Move History Panel */}
          <MoveHistory moveHistory={moveHistory} />
        </div>
      </div>
    </main>
  );
}
