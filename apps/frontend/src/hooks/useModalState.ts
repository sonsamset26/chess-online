import { useState, useCallback } from 'react';

export type DialogModalKey = 'auth' | 'leave' | 'resign' | 'friend' | 'tournament' | 'logout' | null;

export function useModalState() {
  const [activeDialog, setActiveDialog] = useState<DialogModalKey>(null);
  const [isGameOverModalOpen, setIsGameOverModalOpen] = useState<boolean>(false);
  const [isMoveHistoryModalOpen, setIsMoveHistoryModalOpen] = useState<boolean>(false);

  const openDialog = useCallback((key: DialogModalKey) => {
    setActiveDialog(key);
  }, []);

  const closeDialog = useCallback(() => {
    setActiveDialog(null);
  }, []);

  const openAuthModal = useCallback(() => setActiveDialog('auth'), []);
  const openLeaveModal = useCallback(() => setActiveDialog('leave'), []);
  const openResignModal = useCallback(() => setActiveDialog('resign'), []);
  const openFriendModal = useCallback(() => setActiveDialog('friend'), []);
  const openTournamentModal = useCallback(() => setActiveDialog('tournament'), []);
  const openLogoutModal = useCallback(() => setActiveDialog('logout'), []);

  const setIsAuthOpen = useCallback((open: boolean) => setActiveDialog(open ? 'auth' : null), []);
  const setIsLeaveModalOpen = useCallback((open: boolean) => setActiveDialog(open ? 'leave' : null), []);
  const setIsResignModalOpen = useCallback((open: boolean) => setActiveDialog(open ? 'resign' : null), []);
  const setIsFriendModalOpen = useCallback((open: boolean) => setActiveDialog(open ? 'friend' : null), []);
  const setIsTournamentModalOpen = useCallback((open: boolean) => setActiveDialog(open ? 'tournament' : null), []);
  const setIsLogoutModalOpen = useCallback((open: boolean) => setActiveDialog(open ? 'logout' : null), []);

  const closeAllModals = useCallback(() => {
    setActiveDialog(null);
    setIsGameOverModalOpen(false);
    setIsMoveHistoryModalOpen(false);
  }, []);

  return {
    activeDialog,
    isAuthOpen: activeDialog === 'auth',
    isLeaveModalOpen: activeDialog === 'leave',
    isResignModalOpen: activeDialog === 'resign',
    isFriendModalOpen: activeDialog === 'friend',
    isTournamentModalOpen: activeDialog === 'tournament',
    isLogoutModalOpen: activeDialog === 'logout',
    isGameOverModalOpen,
    isMoveHistoryModalOpen,
    openAuthModal,
    openLeaveModal,
    openResignModal,
    openFriendModal,
    openTournamentModal,
    openLogoutModal,
    closeDialog,
    setIsAuthOpen,
    setIsLeaveModalOpen,
    setIsResignModalOpen,
    setIsFriendModalOpen,
    setIsTournamentModalOpen,
    setIsLogoutModalOpen,
    setIsGameOverModalOpen,
    setIsMoveHistoryModalOpen,
    closeAllModals,
  };
}
