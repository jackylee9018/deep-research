'use client';

import type { ValidationIssue } from '../lib/ppt-types';
import type { PptJobPhase, PptJobStatus } from '../lib/ppt-client-jobs';

import {
  PptProgressPanel,
  type PptProgressPhase,
} from './ppt-progress-panel';

export type PptGenerationFeedbackProps = {
  status?: PptJobStatus;
  phase?: PptJobPhase;
  attempt?: number;
  maxAttempts?: number;
  logs?: string[];
  issues?: ValidationIssue[];
  error?: string;
  downloadUrl?: string;
  slideCount?: number;
  outlineTitle?: string;
  progressDismissed?: boolean;
  onDismissProgress?: () => void;
  onDismissResult?: () => void;
};

function mapPhase(phase: PptJobPhase | undefined): PptProgressPhase {
  if (!phase || phase === 'idle') {
    return 'planning';
  }
  return phase;
}

export function PptGenerationFeedback({
  status,
  phase,
  attempt = 0,
  maxAttempts = 3,
  logs = [],
  issues = [],
  error,
  downloadUrl,
  slideCount,
  outlineTitle,
  progressDismissed = false,
  onDismissProgress,
  onDismissResult,
}: PptGenerationFeedbackProps) {
  const isRunning = status === 'running' || status === 'pending';
  const isCompleted = status === 'completed' && Boolean(downloadUrl);
  const isFailed = status === 'failed';

  const showProgressOverlay = isRunning && !progressDismissed;
  const showResult = isCompleted || isFailed;

  if (!showProgressOverlay && !showResult) {
    return null;
  }

  return (
    <>
      {showProgressOverlay ? (
        <div className="ppt-outline-progress-overlay" role="region" aria-label="PPT 生成進度">
          <PptProgressPanel
            phase={mapPhase(phase)}
            attempt={attempt}
            maxAttempts={maxAttempts}
            logs={logs}
            issues={issues}
            error={error}
            onDismiss={onDismissProgress}
          />
        </div>
      ) : null}

      {showResult ? (
        <div
          className={
            isCompleted
              ? 'ppt-outline-result ppt-outline-result--success'
              : 'ppt-outline-result ppt-outline-result--error'
          }
          role="status"
          aria-live="polite"
        >
          <div className="ppt-outline-result-body">
            {isCompleted ? (
              <>
                <p className="ppt-outline-result-title">
                  簡報已生成
                  {outlineTitle ? `：${outlineTitle}` : ''}
                  {slideCount != null ? `（${slideCount} 頁）` : ''}
                </p>
                <p className="ppt-outline-result-detail">
                  可下載 .pptx 檔案；若內容需調整，可修改大綱後再次生成。
                </p>
                <a className="ppt-download" href={downloadUrl} download>
                  下載 PPTX
                </a>
              </>
            ) : (
              <>
                <p className="ppt-outline-result-title">PPT 生成失敗</p>
                {error ? (
                  <p className="ppt-outline-result-detail">{error}</p>
                ) : (
                  <p className="ppt-outline-result-detail">
                    請調整大綱或設定後再試一次。
                  </p>
                )}
                {issues.length > 0 ? (
                  <ul className="ppt-outline-result-issues">
                    {issues.map((issue, index) => (
                      <li key={`${issue.code}-${index}`}>
                        {issue.slideIndex != null ? `第 ${issue.slideIndex} 頁：` : ''}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
          {onDismissResult ? (
            <button
              type="button"
              className="ppt-outline-result-dismiss"
              aria-label="關閉提示"
              onClick={onDismissResult}
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
