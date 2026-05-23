'use client';

import { useMemo, type ReactNode } from 'react';

import {
  useSyncMeetingNav,
  type MeetingNavHandlers,
} from './meeting-nav-context';

export function MeetingShellLayout({
  children,
  activeJobId,
  onNewMeeting,
  onSelectJob,
}: {
  children: ReactNode;
  activeJobId: string | null;
  onNewMeeting: () => void;
  onSelectJob: (jobId: string) => void;
}) {
  const handlers = useMemo<MeetingNavHandlers>(
    () => ({
      activeJobId,
      onNewMeeting,
      onSelectJob,
    }),
    [activeJobId, onNewMeeting, onSelectJob],
  );

  useSyncMeetingNav(handlers);

  return <div className="research-app-layout meeting-app-layout">{children}</div>;
}
