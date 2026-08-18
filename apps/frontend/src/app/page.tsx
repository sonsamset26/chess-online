'use client';

import React, { useState } from 'react';
import { Sidebar, ActiveTab } from '../components/Sidebar';
import { PlayMenu, GameModeSelection } from '../components/PlayMenu';
import { AuthModal } from '../components/AuthModal';
import { ChessBoardComponent } from '../components/ChessBoard';
import { PlayerCard } from '../components/PlayerCard';
import { DifficultySelector } from '../components/DifficultySelector';
import { GameControls } from '../components/GameControls';
import { MoveHistory } from '../components/MoveHistory';
import { useChessEngine } from '../hooks/useChessEngine';
import { Bot, Cpu, ArrowLeft, Trophy, Users, Puzzle } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('play');
  const [activeMode, setActiveMode] = useState<GameModeSelection | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState<{ username: string; eloRating: number; token: string } | null>(null);

  // Hook quản lý Bàn cờ & Stockfish AI Engine
  const {
    game,
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

  const handleSelectMode = (mode: GameModeSelection) => {
    setActiveMode(mode);
  };

  const handleLogout = () => {
    localStorage.removeItem('chess_token');
    setUser(null);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#161512] text-[#C3C1C0] flex select-none">
      {/* Left Sidebar - Chuẩn Chess.com */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        onOpenAuthModal={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main View Area */}
      <main className="flex-1 h-full overflow-hidden flex flex-col p-2.5 md:p-4 bg-radial-glow">
        
        {/* TAB 1: PLAY CHESS (MATCHING USER SCREENSHOT 100%) */}
        {activeTab === 'play' && (
          <div className="w-full max-w-7xl mx-auto flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 items-center justify-center">
            
            {/* Left Column (8/12 Cols): Bàn cờ & Thanh Thông tin Người chơi */}
            <div className="lg:col-span-8 flex flex-col items-center justify-between h-full py-1">
              {/* Opponent Card (Phía trên Bàn cờ - Chuẩn trong hình chụp) */}
              <PlayerCard
                isAi={activeMode === 'bots' || !activeMode}
                name={activeMode === 'friend' ? 'Bạn bè (Player 2)' : 'Stockfish Engine'}
                subText={
                  activeMode === 'bots' || !activeMode
                    ? difficulty === 1
                      ? 'Mức: Dễ (~800 Elo)'
                      : difficulty === 2
                      ? 'Mức: Trung bình (~1400 Elo)'
                      : 'Mức: Khó (~2000 Elo)'
                    : 'Phòng thi đấu trực tuyến'
                }
                color={aiColor}
                isThinking={isAiThinking}
                gameStatus={gameStatus}
              />

              {/* Bàn cờ Cờ vua (Màu Xanh lá - Kem chuẩn Chess.com) */}
              <ChessBoardComponent
                game={game}
                fen={fen}
                playerColor={playerColor}
                onPieceDrop={makePlayerMove}
                disabled={isAiThinking}
              />

              {/* Player Card (Phía dưới Bàn cờ - Chuẩn trong hình chụp) */}
              <PlayerCard
                isAi={false}
                name={user ? user.username : 'Người chơi (Bạn)'}
                subText={playerColor === 'w' ? 'Cầm quân Trắng' : 'Cầm quân Đen'}
                color={playerColor}
                gameStatus={gameStatus}
              />
            </div>

            {/* Right Column (4/12 Cols): Menu Chọn chế độ chơi (Giống hình chụp) HOẶC Bảng điều khiển trận đấu */}
            <div className="lg:col-span-4 flex flex-col gap-3 h-full max-h-[calc(100vh-40px)] justify-between">
              {!activeMode ? (
                /* MÀN HÌNH CHỌN CHẾ ĐỘ CHƠI - MATCHING SCREENSHOT 100% */
                <PlayMenu onSelectMode={handleSelectMode} />
              ) : (
                /* MÀN HÌNH BẢNG ĐIỀU KHIỂN & LỊCH SỬ NƯỚC ĐI KHI ĐANG TRONG TRẬN */
                <div className="flex flex-col gap-3 h-full justify-between">
                  {/* Top Bar: Back to Menu */}
                  <div className="p-3 bg-[#262421] rounded-2xl border border-[#312E2B] flex items-center justify-between shadow-lg shrink-0">
                    <button
                      onClick={() => setActiveMode(null)}
                      className="flex items-center gap-2 text-xs font-bold text-[#BAB8B6] hover:text-white transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Quay lại Menu</span>
                    </button>
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                      {activeMode === 'bots' ? 'Đánh với Máy' : activeMode === 'online' ? 'Đấu Online' : 'Đấu Bạn bè'}
                    </span>
                  </div>

                  {/* Controls Box */}
                  <div className="p-4 bg-[#262421] rounded-2xl border border-[#312E2B] flex flex-col gap-3.5 shadow-xl shrink-0">
                    <div className="flex items-center justify-between border-b border-[#312E2B] pb-2">
                      <h2 className="font-bold text-xs text-white flex items-center gap-1.5">
                        <Cpu className="w-4 h-4 text-blue-400" />
                        Cấu hình Trận đấu
                      </h2>
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Active
                      </span>
                    </div>

                    {activeMode === 'bots' && (
                      <DifficultySelector
                        difficulty={difficulty}
                        onSelect={setDifficulty}
                        disabled={isAiThinking}
                      />
                    )}

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
              )}
            </div>
          </div>
        )}

        {/* TAB 2: LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div className="w-full max-w-4xl mx-auto h-full overflow-hidden flex flex-col p-4">
            <div className="bg-[#262421] rounded-2xl border border-[#312E2B] p-6 flex flex-col h-full shadow-2xl">
              <div className="flex items-center gap-3 border-b border-[#312E2B] pb-4 mb-4">
                <Trophy className="w-7 h-7 text-amber-400" />
                <div>
                  <h2 className="text-lg font-black text-white">Bảng Xếp Hạng Elo Quốc Tế</h2>
                  <p className="text-xs text-[#8B8987]">Top cao thủ có điểm Elo cao nhất hệ thống</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <div className="flex flex-col gap-2">
                  {[
                    { rank: 1, name: 'Magnus Carlsen', elo: 2882, wins: 450, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=magnus' },
                    { rank: 2, name: 'Hikaru Nakamura', elo: 2875, wins: 412, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=hikaru' },
                    { rank: 3, name: 'Alireza Firouzja', elo: 2805, wins: 380, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=alireza' },
                    { rank: 4, name: 'Lê Quang Liêm', elo: 2740, wins: 320, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=liem' },
                  ].map((player) => (
                    <div key={player.rank} className="flex items-center justify-between p-3.5 rounded-xl bg-[#2F2D2A] border border-[#3A3733]">
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                          player.rank === 1 ? 'bg-amber-500 text-slate-950' : player.rank === 2 ? 'bg-slate-300 text-slate-950' : 'bg-amber-700 text-white'
                        }`}>
                          #{player.rank}
                        </span>
                        <img src={player.avatar} alt="Avatar" className="w-9 h-9 rounded-lg bg-[#363431]" />
                        <div>
                          <p className="font-bold text-sm text-white">{player.name}</p>
                          <p className="text-[11px] text-[#8B8987]">Thắng: {player.wins} trận</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-black text-base text-amber-400 font-mono">🏆 {player.elo}</p>
                        <p className="text-[10px] text-emerald-400">Grandmaster</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PUZZLES */}
        {activeTab === 'puzzles' && (
          <div className="w-full max-w-4xl mx-auto h-full flex flex-col items-center justify-center p-4">
            <div className="bg-[#262421] rounded-2xl border border-[#312E2B] p-8 text-center max-w-md shadow-2xl">
              <Puzzle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h2 className="text-xl font-black text-white mb-2">Bài tập Cờ thế (Chess Puzzles)</h2>
              <p className="text-xs text-[#8B8987] mb-6">Giải thế cờ khó và nâng cao tư duy chiến thuật đỉnh cao.</p>
              <button
                onClick={() => {
                  setActiveTab('play');
                  setActiveMode('bots');
                }}
                className="py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-black text-xs uppercase tracking-wider shadow-lg"
              >
                Bắt đầu giải đố
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Auth Modal (Register / Login JWT) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccessLogin={(userData) => setUser(userData)}
      />
    </div>
  );
}
