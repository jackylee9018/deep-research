'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ResearchNavHandlers = {
  activeJobId: string | null;
  selectedHistoryId: string | null;
  onNewResearch: () => void;
  onSelectJob: (jobId: string) => void;
  onSelectHistory: (entryId: string) => void;
};

type ResearchNavContextValue = {
  handlers: ResearchNavHandlers | null;
  setHandlers: (handlers: ResearchNavHandlers | null) => void;
};

const ResearchNavContext = createContext<ResearchNavContextValue | null>(null);

export function ResearchNavProvider({ children }: { children: ReactNode }) {
  const [handlers, setHandlers] = useState<ResearchNavHandlers | null>(null);
  const value = useMemo(
    () => ({ handlers, setHandlers }),
    [handlers],
  );
  return (
    <ResearchNavContext.Provider value={value}>
      {children}
    </ResearchNavContext.Provider>
  );
}

export function useResearchNavHandlers() {
  const ctx = useContext(ResearchNavContext);
  if (!ctx) {
    throw new Error('useResearchNavHandlers must be used within ResearchNavProvider');
  }
  return ctx.handlers;
}

export function useSyncResearchNav(handlers: ResearchNavHandlers) {
  const ctx = useContext(ResearchNavContext);
  if (!ctx) {
    throw new Error('useSyncResearchNav must be used within ResearchNavProvider');
  }
  const { setHandlers } = ctx;

  useEffect(() => {
    setHandlers(handlers);
    return () => setHandlers(null);
  }, [handlers, setHandlers]);
}

/** Safe for AppNavRail outside the research page tree. */
export function useOptionalResearchNavHandlers() {
  const ctx = useContext(ResearchNavContext);
  return ctx?.handlers ?? null;
}
