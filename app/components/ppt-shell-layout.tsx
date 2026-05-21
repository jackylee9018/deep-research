'use client';

import { useMemo, type ReactNode } from 'react';

import { useSyncPptNav, type PptNavHandlers } from './ppt-nav-context';

export function PptShellLayout({
  children,
  activeJobId,
  selectedHistoryId,
  onNewPpt,
  onSelectJob,
  onSelectHistory,
}: {
  children: ReactNode;
  activeJobId: string | null;
  selectedHistoryId: string | null;
  onNewPpt: () => void;
  onSelectJob: (jobId: string) => void;
  onSelectHistory: (entryId: string) => void;
}) {
  const handlers = useMemo<PptNavHandlers>(
    () => ({
      activeJobId,
      selectedHistoryId,
      onNewPpt,
      onSelectJob,
      onSelectHistory,
    }),
    [activeJobId, selectedHistoryId, onNewPpt, onSelectJob, onSelectHistory],
  );

  useSyncPptNav(handlers);

  return <div className="research-app-layout ppt-app-layout">{children}</div>;
}
