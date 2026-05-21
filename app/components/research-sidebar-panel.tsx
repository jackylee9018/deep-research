'use client';

import { useMemo, type ReactNode } from 'react';

import type { ResearchHistoryEntry } from '../lib/research-history';
import type { ResearchJob } from '../lib/research-jobs';
import { useResearchJobs } from './research-jobs-provider';
import { useOptionalResearchNavHandlers } from './research-nav-context';

const STATUS_LABEL = {
  pending: '待處理',
  running: '進行中',
  completed: '已完成',
  failed: '失敗',
} as const;

function formatWhen(ts: number) {
  return new Date(ts).toLocaleString('zh-TW', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ResearchSidebarPanel() {
  const nav = useOptionalResearchNavHandlers();
  const { jobs, history, cancelJob, dismissJob, removeHistoryEntry } =
    useResearchJobs();

  const activeJobs = useMemo(
    () =>
      jobs
        .filter(
          job =>
            job.status === 'pending' ||
            job.status === 'running' ||
            job.status === 'failed',
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [jobs],
  );

  const historySorted = useMemo(
    () => [...history].sort((a, b) => b.completedAt - a.completedAt),
    [history],
  );

  if (!nav) {
    return null;
  }

  return (
    <div className="app-nav-research-panel">
      <button
        type="button"
        className="research-sidebar-new-chat"
        onClick={nav.onNewResearch}
      >
        <PencilIcon />
        <span>新建研究</span>
      </button>

      <div className="research-sidebar-scroll app-nav-panel-scroll">
        {activeJobs.length > 0 && (
          <SidebarSection title="進行中">
            {activeJobs.map(job => (
              <SidebarJobItem
                key={job.id}
                job={job}
                selected={nav.activeJobId === job.id}
                onSelect={() => nav.onSelectJob(job.id)}
                onCancel={() =>
                  job.status === 'failed'
                    ? dismissJob(job.id)
                    : cancelJob(job.id)
                }
              />
            ))}
          </SidebarSection>
        )}

        <SidebarSection title="對話歷史">
          {historySorted.length === 0 ? (
            <li className="research-sidebar-empty-item">
              <span className="research-sidebar-empty">
                完成的研究會顯示在這裡
              </span>
            </li>
          ) : (
            historySorted.map(entry => (
              <SidebarHistoryItem
                key={entry.id}
                entry={entry}
                selected={nav.selectedHistoryId === entry.id}
                onSelect={() => nav.onSelectHistory(entry.id)}
                onDelete={() => removeHistoryEntry(entry.id)}
              />
            ))
          )}
        </SidebarSection>
      </div>
    </div>
  );
}

function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="research-sidebar-section">
      <p className="research-sidebar-section-title">{title}</p>
      <ul className="research-sidebar-list">{children}</ul>
    </div>
  );
}

function SidebarJobItem({
  job,
  selected,
  onSelect,
  onCancel,
}: {
  job: ResearchJob;
  selected: boolean;
  onSelect: () => void;
  onCancel: () => void;
}) {
  return (
    <li>
      <div
        className={`research-sidebar-chat ${selected ? 'is-active' : ''}`}
      >
        <button
          type="button"
          className="research-sidebar-chat-main"
          onClick={onSelect}
        >
          <span className="research-sidebar-chat-title">{job.query}</span>
          <span className="research-sidebar-chat-meta">
            <span className={`research-sidebar-badge ${job.status}`}>
              {STATUS_LABEL[job.status]}
            </span>
            {formatWhen(job.updatedAt)}
          </span>
        </button>
        <button
          type="button"
          className="research-sidebar-chat-action"
          title={job.status === 'failed' ? '清除' : '取消'}
          onClick={e => {
            e.stopPropagation();
            onCancel();
          }}
        >
          ×
        </button>
      </div>
    </li>
  );
}

function SidebarHistoryItem({
  entry,
  selected,
  onSelect,
  onDelete,
}: {
  entry: ResearchHistoryEntry;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <li>
      <div
        className={`research-sidebar-chat ${selected ? 'is-active' : ''}`}
      >
        <button
          type="button"
          className="research-sidebar-chat-main"
          onClick={onSelect}
        >
          <span className="research-sidebar-chat-title">{entry.query}</span>
          <span className="research-sidebar-chat-meta">
            {formatWhen(entry.completedAt)}
          </span>
        </button>
        <button
          type="button"
          className="research-sidebar-chat-action"
          title="刪除紀錄"
          onClick={e => {
            e.stopPropagation();
            onDelete();
          }}
        >
          ×
        </button>
      </div>
    </li>
  );
}

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
