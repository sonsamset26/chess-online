import React from 'react';
import { Shield, Sparkles, Trophy, Cpu } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="w-full max-w-6xl mx-auto flex items-center justify-between py-2 px-5 bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800/80 shadow-lg shrink-0 mb-3">
      {/* Brand & Mode */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-md shadow-blue-500/20">
          <Shield className="w-5 h-5 text-white" />
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">
              Chess Online
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
              v1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-emerald-400 inline" /> Chế độ: Luyện tập với Stockfish AI
          </p>
        </div>
      </div>

      {/* Stats & Actions */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-800/70 rounded-xl border border-slate-700/60 shadow-inner">
          <Trophy className="w-4 h-4 text-amber-400" />
          <div className="text-xs">
            <span className="text-slate-400">Elo: </span>
            <span className="font-bold text-amber-300">1200</span>
          </div>
        </div>
      </div>
    </header>
  );
};
