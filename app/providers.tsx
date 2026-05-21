'use client';

import { type ReactNode } from 'react';

import { AppBackgroundToasts } from './components/app-background-toasts';
import { PptJobsProvider } from './components/ppt-jobs-provider';
import { PptNavProvider } from './components/ppt-nav-context';
import { ResearchNavProvider } from './components/research-nav-context';
import { ResearchJobsProvider } from './components/research-jobs-provider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ResearchJobsProvider>
      <ResearchNavProvider>
        <PptNavProvider>
          <PptJobsProvider>
            {children}
            <AppBackgroundToasts />
          </PptJobsProvider>
        </PptNavProvider>
      </ResearchNavProvider>
    </ResearchJobsProvider>
  );
}
