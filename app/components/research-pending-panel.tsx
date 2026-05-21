'use client';

import { RESEARCH_MODEL_LABELS } from '../lib/research-models';
import { useResearchJobs } from './research-jobs-provider';

const STATUS_LABEL = {
  pending: '待處理',
  running: '進行中',
  completed: '已完成',
  failed: '失敗',
} as const;

export function ResearchPendingPanel({
  onOpenJob,
}: {
  onOpenJob?: (jobId: string) => void;
}) {
  const {
    jobs,
    activeJobId,
    setActiveJobId,
    cancelJob,
    dismissJob,
    runningCount,
    pendingCount,
  } = useResearchJobs();

  const activeJobs = jobs.filter(
    job => job.status === 'pending' || job.status === 'running',
  );
  const failedJobs = jobs.filter(job => job.status === 'failed');

  if (!activeJobs.length && !failedJobs.length) {
    return null;
  }

  return (
    <>
      {activeJobs.length > 0 && (
        <section className="card research-queue-card">
          <div className="research-queue-header">
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>研究佇列</h2>
            <p className="research-queue-summary">
              {runningCount > 0 ? `${runningCount} 個進行中` : null}
              {runningCount > 0 && pendingCount > 0 ? ' · ' : null}
              {pendingCount > 0 ? `${pendingCount} 個待處理` : null}
            </p>
          </div>
          {pendingCount > 0 && runningCount > 0 && (
            <p className="research-queue-hint">
              待處理任務會在目前研究完成後依序自動開始。
            </p>
          )}
          <ul className="research-queue-list">
            {activeJobs.map(job => (
              <li
                key={job.id}
                className={`research-queue-item ${job.status} ${activeJobId === job.id ? 'is-active' : ''}`}
              >
                <button
                  type="button"
                  className="research-queue-item-main"
                  onClick={() => {
                    setActiveJobId(job.id);
                    onOpenJob?.(job.id);
                  }}
                >
                  <span className={`research-queue-status ${job.status}`}>
                    {STATUS_LABEL[job.status]}
                  </span>
                  <span className="research-queue-query">{job.query}</span>
                  <span className="research-queue-meta">
                    {RESEARCH_MODEL_LABELS[job.model]} ·{' '}
                    {job.mode === 'report' ? '報告' : '答案'}
                  </span>
                </button>
                <button
                  type="button"
                  className="research-queue-cancel"
                  title="取消任務"
                  onClick={() => cancelJob(job.id)}
                >
                  取消
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {failedJobs.length > 0 && (
        <section className="card research-queue-card research-failed-card">
          <div className="research-queue-header">
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>失敗的研究</h2>
            <p className="research-queue-summary">
              {failedJobs.length} 個需處理
            </p>
          </div>
          <ul className="research-queue-list">
            {failedJobs.map(job => (
              <li
                key={job.id}
                className={`research-queue-item failed ${activeJobId === job.id ? 'is-active' : ''}`}
              >
                <button
                  type="button"
                  className="research-queue-item-main"
                  onClick={() => {
                    setActiveJobId(job.id);
                    onOpenJob?.(job.id);
                  }}
                >
                  <span className="research-queue-status failed">
                    {STATUS_LABEL.failed}
                  </span>
                  <span className="research-queue-query">{job.query}</span>
                  {job.error ? (
                    <span className="research-queue-error">{job.error}</span>
                  ) : null}
                  <span className="research-queue-meta">
                    {RESEARCH_MODEL_LABELS[job.model]} ·{' '}
                    {job.mode === 'report' ? '報告' : '答案'}
                  </span>
                </button>
                <button
                  type="button"
                  className="research-queue-cancel"
                  title="清除紀錄"
                  onClick={() => dismissJob(job.id)}
                >
                  清除
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
