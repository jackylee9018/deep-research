'use client';

import type { ValidationIssue } from '../lib/ppt-types';

export type PptProgressPhase =
  | 'idle'
  | 'planning'
  | 'generating'
  | 'validating'
  | 'done'
  | 'failed';

const PHASE_LABELS: Record<PptProgressPhase, string> = {
  idle: '待機',
  planning: '規劃內容',
  generating: '規劃內容',
  validating: '檢查內容',
  done: '完成',
  failed: '失敗',
};

type PptProgressPanelProps = {
  phase: PptProgressPhase;
  attempt: number;
  maxAttempts: number;
  logs: string[];
  issues: ValidationIssue[];
  error?: string;
  downloadUrl?: string;
  slideCount?: number;
  readySlideCount?: number;
  onDismiss?: () => void;
};

export function PptProgressPanel({
  phase,
  attempt,
  maxAttempts,
  logs,
  issues,
  error,
  downloadUrl,
  slideCount,
  readySlideCount,
  onDismiss,
}: PptProgressPanelProps) {
  const showAttempt =
    phase !== 'idle' && phase !== 'done' && phase !== 'failed' && maxAttempts > 0;
  const isActive =
    phase !== 'idle' && phase !== 'done' && phase !== 'failed';

  return (
    <article className="card ppt-progress-card">
      <header className="ppt-progress-header">
        <div className="ppt-progress-title-group">
          {isActive ? (
            <span className="ppt-progress-spinner" aria-hidden />
          ) : null}
          <div>
            <p className="ppt-eyebrow">PPT 生成</p>
            <h2>{PHASE_LABELS[phase]}</h2>
          </div>
        </div>
        <div className="ppt-progress-header-actions">
          {showAttempt ? (
            <span className="ppt-attempt">
              嘗試 {attempt}/{maxAttempts}
            </span>
          ) : null}
          {readySlideCount != null &&
          slideCount != null &&
          phase !== 'done' &&
          phase !== 'failed' ? (
            <span className="ppt-slide-count-badge">
              {readySlideCount}/{slideCount} 頁
            </span>
          ) : null}
          {slideCount != null && phase === 'done' ? (
            <span className="ppt-slide-count-badge">{slideCount} 頁</span>
          ) : null}
          {onDismiss ? (
            <button
              type="button"
              className="ppt-progress-dismiss"
              aria-label="收起進度"
              onClick={onDismiss}
            >
              ×
            </button>
          ) : null}
        </div>
      </header>

      {downloadUrl ? (
        <a className="ppt-download" href={downloadUrl} download>
          下載 PPT
        </a>
      ) : null}

      {error ? <div className="error-banner ppt-progress-error">{error}</div> : null}

      {issues.length > 0 ? (
        <div className="ppt-issues">
          <ul>
            {issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>
                {issue.slideIndex != null ? `第 ${issue.slideIndex} 頁：` : ''}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {logs.length > 0 ? (
        <div className="ppt-log">
          {logs.slice(-8).map((line, index) => (
            <p key={`${index}-${line}`}>{line}</p>
          ))}
        </div>
      ) : null}
    </article>
  );
}
