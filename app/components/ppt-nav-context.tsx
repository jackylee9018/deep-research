'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type PptNavHandlers = {
  activeJobId: string | null;
  selectedHistoryId: string | null;
  onNewPpt: () => void;
  onSelectJob: (jobId: string) => void;
  onSelectHistory: (entryId: string) => void;
};

type PptNavContextValue = {
  handlers: PptNavHandlers | null;
  setHandlers: (handlers: PptNavHandlers | null) => void;
};

const PptNavContext = createContext<PptNavContextValue | null>(null);

export function PptNavProvider({ children }: { children: ReactNode }) {
  const [handlers, setHandlers] = useState<PptNavHandlers | null>(null);
  const value = useMemo(() => ({ handlers, setHandlers }), [handlers]);
  return (
    <PptNavContext.Provider value={value}>{children}</PptNavContext.Provider>
  );
}

export function useSyncPptNav(handlers: PptNavHandlers) {
  const ctx = useContext(PptNavContext);
  if (!ctx) {
    throw new Error('useSyncPptNav must be used within PptNavProvider');
  }
  const { setHandlers } = ctx;

  useEffect(() => {
    setHandlers(handlers);
    return () => setHandlers(null);
  }, [handlers, setHandlers]);
}

export function useOptionalPptNavHandlers() {
  const ctx = useContext(PptNavContext);
  return ctx?.handlers ?? null;
}
