import React from 'react';
import { LeaderboardView } from '../LeaderboardView';

interface LeaderboardTabProps {
  user: any;
  realLeaderboard: any[];
  isLoading: boolean;
}

export const LeaderboardTab: React.FC<LeaderboardTabProps> = ({
  user,
  realLeaderboard,
  isLoading,
}) => {
  return (
    <LeaderboardView
      user={user}
      realLeaderboard={realLeaderboard}
      isLoading={isLoading}
    />
  );
};
