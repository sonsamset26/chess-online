import React from 'react';
import { HistoryView, MatchRecord } from '../HistoryView';

interface HistoryTabProps {
  currentUser: any;
  initialSubTab?: 'matches' | 'tournaments';
  onSelectReplay: (matchRecord: MatchRecord) => void;
  onOpenAnalysis: (matchRecord: MatchRecord) => void;
  onOpenTournamentDetail: (idOrCode: string) => void;
  onOpenTournamentModal: () => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  currentUser,
  initialSubTab,
  onSelectReplay,
  onOpenAnalysis,
  onOpenTournamentDetail,
  onOpenTournamentModal,
}) => {
  return (
    <HistoryView
      currentUser={currentUser}
      initialSubTab={initialSubTab}
      onSelectReplay={onSelectReplay}
      onOpenAnalysis={onOpenAnalysis}
      onOpenTournamentDetail={onOpenTournamentDetail}
      onOpenTournamentModal={onOpenTournamentModal}
    />
  );
};
