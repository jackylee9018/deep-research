'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  buildPresentationAiCreateUrl,
  getWorkspaceReturnUrl,
  resolvePresentationAiOrigin,
} from '../lib/presentation-ai';
import { usePptJobs } from './ppt-jobs-provider';

export function PptBackgroundToast() {
  const { jobs, history, runningCount, pendingCount, dismissJob } = usePptJobs();
  const [dismissedToastId, setDismissedToastId] = useState<string | null>(null);
  const [presentationHref, setPresentationHref] = useState(() =>
    buildPresentationAiCreateUrl(),
  );

  useEffect(() => {
    void resolvePresentationAiOrigin().then(origin => {
      setPresentationHref(
        buildPresentationAiCreateUrl(
          { returnUrl: getWorkspaceReturnUrl('/') },
          origin,
        ),
      );
    });
  }, []);

  const activeTotal = runningCount + pendingCount;

  const latestCompleted = useMemo(
    () =>
      [...history]
        .sort((a, b) => b.completedAt - a.completedAt)[0],
    [history],
  );

  const latestFailed = useMemo(
    () =>
      [...jobs]
        .filter(job => job.status === 'failed')
        .sort((a, b) => b.updatedAt - a.updatedAt)[0],
    [jobs],
  );

  if (activeTotal > 0) {
    return (
      <div className="research-bg-toast ppt-bg-toast" role="status">
        <span>
          {runningCount > 0 ? `${runningCount} 個 PPT 生成中` : null}
          {runningCount > 0 && pendingCount > 0 ? '，' : null}
          {pendingCount > 0 ? `${pendingCount} 個待處理` : null}
        </span>
        <a href={presentationHref}>查看進度 →</a>
      </div>
    );
  }

  if (
    latestCompleted &&
    latestCompleted.id !== dismissedToastId
  ) {
    return (
      <div
        className="research-bg-toast ppt-bg-toast ppt-bg-toast--success"
        role="status"
      >
        <span>
          「{latestCompleted.outlineTitle}」已生成
          {latestCompleted.slideCount != null
            ? `（${latestCompleted.slideCount} 頁）`
            : ''}
        </span>
        <a href={presentationHref}>查看簡報服務 →</a>
        <button
          type="button"
          className="ppt-bg-toast-dismiss"
          aria-label="關閉"
          onClick={() => setDismissedToastId(latestCompleted.id)}
        >
          ×
        </button>
      </div>
    );
  }

  if (latestFailed && latestFailed.id !== dismissedToastId) {
    return (
      <div
        className="research-bg-toast ppt-bg-toast ppt-bg-toast--error"
        role="alert"
      >
        <span>
          PPT 生成失敗
          {latestFailed.error ? `：${latestFailed.error}` : ''}
        </span>
        <a href={presentationHref}>前往簡報服務 →</a>
        <button
          type="button"
          className="ppt-bg-toast-dismiss"
          aria-label="關閉"
          onClick={() => {
            setDismissedToastId(latestFailed.id);
            dismissJob(latestFailed.id);
          }}
        >
          ×
        </button>
      </div>
    );
  }

  return null;
}
