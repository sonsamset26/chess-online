import React from 'react';
import { DifficultyLevel } from '../hooks/useChessEngine';
import { Bot, Zap, ShieldAlert } from 'lucide-react';

interface DifficultySelectorProps {
  difficulty: DifficultyLevel;
  onSelect: (level: DifficultyLevel) => void;
  disabled: boolean;
}

export const DifficultySelector: React.FC<DifficultySelectorProps> = ({
  difficulty,
  onSelect,
  disabled,
}) => {
  const levels: {
    level: DifficultyLevel;
    name: string;
    elo: string;
    icon: any;
    activeStyle: string;
  }[] = [
    {
      level: 1,
      name: 'Dễ',
      elo: '~800 Elo',
      icon: Bot,
      activeStyle:
        'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/10',
    },
    {
      level: 2,
      name: 'Trung bình',
      elo: '~1300 Elo',
      icon: Zap,
      activeStyle:
        'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-md shadow-amber-500/10',
    },
    {
      level: 3,
      name: 'Khó',
      elo: '~2000 Elo',
      icon: ShieldAlert,
      activeStyle:
        'bg-rose-500/15 border-rose-500/50 text-rose-300 shadow-md shadow-rose-500/10',
    },
  ];

  return (
    <div className="flex flex-col gap-1.5 w-full select-none">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-300">
          Độ khó AI Engine:
        </label>
        <span className="text-[10px] text-[#8B8987] font-mono">
          Fast Engine
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {levels.map((item) => {
          const Icon = item.icon;
          const isSelected = difficulty === item.level;

          return (
            <button
              key={item.level}
              disabled={disabled}
              onClick={() => onSelect(item.level)}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-200 ${
                isSelected
                  ? `${item.activeStyle} ring-1 ring-white/20`
                  : 'border-[#3A3733] bg-[#2B2926] hover:bg-[#363431] text-[#BAB8B6]'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Icon className="w-4 h-4 mb-1" />
              <span className="font-bold text-xs">{item.name}</span>
              <span className="text-[9px] opacity-75 font-mono">{item.elo}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
