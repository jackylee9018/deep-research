'use client';

import { useCallback, useEffect, useState } from 'react';

import { resolveJobMarkdown } from '../lib/meeting-job-content';
import { MeetingFormPanel } from '../components/meeting-form-panel';
import { MeetingProgressPanel } from '../components/meeting-progress-panel';
import { MeetingResultPanel } from '../components/meeting-result-panel';
import { MeetingShellLayout } from '../components/meeting-shell-layout';
import { useMeetingJobs } from '../components/meeting-jobs-provider';

export default function MeetingPage() {
  const { jobs, activeJobId, setActiveJobId, enqueueJob } = useMeetingJobs();

  const [language, setLanguage] = useState('zh');
  const [detailLevel, setDetailLevel] = useState<'brief' | 'full'>('full');
  const [includeAppendix, setIncludeAppendix] = useState(true);
  const [restorePunctuation, setRestorePunctuation] = useState(false);
  const [workerReady, setWorkerReady] = useState<boolean | null>(null);
  const [llmReady, setLlmReady] = useState<boolean | null>(null);

  const activeJob = activeJobId
    ? jobs.find(j => j.id === activeJobId)
    : undefined;
  const isRunning = activeJob?.status === 'running';

  useEffect(() => {
    void fetch('/api/meeting/health')
      .then(res => res.json())
      .then(json => {
        setWorkerReady(Boolean(json.whisperxWorkerOk));
        setLlmReady(Boolean(json.llmConfigured));
      })
      .catch(() => {
        setWorkerReady(false);
        setLlmReady(false);
      });
  }, []);

  const handleSubmit = useCallback(
    (file: File) => {
      if (isRunning) {
        return;
      }
      enqueueJob({
        file,
        language,
        detailLevel,
        includeAppendix,
        restorePunctuation,
      });
    },
    [enqueueJob, language, detailLevel, includeAppendix, restorePunctuation, isRunning],
  );

  const onNewMeeting = useCallback(() => {
    setActiveJobId(null);
  }, [setActiveJobId]);

  const onSelectJob = useCallback(
    (jobId: string) => {
      setActiveJobId(jobId);
    },
    [setActiveJobId],
  );

  const showForm = !activeJob || activeJob.status === 'failed';

  return (
    <MeetingShellLayout
      activeJobId={activeJobId}
      onNewMeeting={onNewMeeting}
      onSelectJob={onSelectJob}
    >
      <main className="research-shell meeting-shell">
        <section className="meeting-workspace">
          {showForm ? (
            <MeetingFormPanel
              language={language}
              onLanguageChange={setLanguage}
              detailLevel={detailLevel}
              onDetailLevelChange={setDetailLevel}
              includeAppendix={includeAppendix}
              onIncludeAppendixChange={setIncludeAppendix}
              restorePunctuation={restorePunctuation}
              onRestorePunctuationChange={setRestorePunctuation}
              onSubmit={handleSubmit}
              loading={isRunning}
              disabled={workerReady === false || llmReady === false}
              workerReady={workerReady}
              llmReady={llmReady}
            />
          ) : null}

          {activeJob ? <MeetingProgressPanel job={activeJob} /> : null}
          {activeJob ? <MeetingResultPanel job={activeJob} /> : null}
        </section>
      </main>
    </MeetingShellLayout>
  );
}
