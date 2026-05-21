'use client';

import { useMemo, type ReactNode } from 'react';

import {
  useSyncResearchNav,
  type ResearchNavHandlers,
} from './research-nav-context';

export function ResearchShellLayout({
  children,
  activeJobId,
  selectedHistoryId,
  onNewResearch,
  onSelectJob,
  onSelectHistory,
}: {
  children: ReactNode;
  activeJobId: string | null;
  selectedHistoryId: string | null;
  onNewResearch: () => void;
  onSelectJob: (jobId: string) => void;
  onSelectHistory: (entryId: string) => void;
}) {
  const handlers = useMemo<ResearchNavHandlers>(
    () => ({
      activeJobId,
      selectedHistoryId,
      onNewResearch,
      onSelectJob,
      onSelectHistory,
    }),
    [
      activeJobId,
      selectedHistoryId,
      onNewResearch,
      onSelectJob,
      onSelectHistory,
    ],
  );

  useSyncResearchNav(handlers);

  return <div className="research-app-layout">{children}</div>;
}
