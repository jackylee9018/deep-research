'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type MeetingNavHandlers = {
  activeJobId: string | null;
  onNewMeeting: () => void;
  onSelectJob: (jobId: string) => void;
};

type MeetingNavContextValue = {
  handlers: MeetingNavHandlers | null;
  setHandlers: (handlers: MeetingNavHandlers | null) => void;
};

const MeetingNavContext = createContext<MeetingNavContextValue | null>(null);

export function MeetingNavProvider({ children }: { children: ReactNode }) {
  const [handlers, setHandlers] = useState<MeetingNavHandlers | null>(null);
  const value = useMemo(() => ({ handlers, setHandlers }), [handlers]);
  return (
    <MeetingNavContext.Provider value={value}>
      {children}
    </MeetingNavContext.Provider>
  );
}

export function useSyncMeetingNav(handlers: MeetingNavHandlers) {
  const ctx = useContext(MeetingNavContext);
  if (!ctx) {
    throw new Error('useSyncMeetingNav must be used within MeetingNavProvider');
  }
  const { setHandlers } = ctx;

  useEffect(() => {
    setHandlers(handlers);
    return () => setHandlers(null);
  }, [handlers, setHandlers]);
}

export function useOptionalMeetingNavHandlers() {
  const ctx = useContext(MeetingNavContext);
  return ctx?.handlers ?? null;
}
