'use client';

import { type ReactNode } from 'react';

import { AppBackgroundToasts } from './components/app-background-toasts';
import { MeetingJobsProvider } from './components/meeting-jobs-provider';
import { MeetingNavProvider } from './components/meeting-nav-context';
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
            <MeetingNavProvider>
              <MeetingJobsProvider>
                {children}
                <AppBackgroundToasts />
              </MeetingJobsProvider>
            </MeetingNavProvider>
          </PptJobsProvider>
        </PptNavProvider>
      </ResearchNavProvider>
    </ResearchJobsProvider>
  );
}
