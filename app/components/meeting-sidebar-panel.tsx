'use client';

import { useMemo, type ReactNode } from 'react';

import type { MeetingJob } from '../lib/meeting-jobs';
import { MEETING_JOB_STATUS_LABELS } from '../lib/meeting-status';
import { useMeetingJobs } from './meeting-jobs-provider';
import { useOptionalMeetingNavHandlers } from './meeting-nav-context';

function formatWhen(ts: number) {
  return new Date(ts).toLocaleString('zh-TW', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MeetingSidebarPanel() {
  const nav = useOptionalMeetingNavHandlers();
  const { jobs, cancelJob, dismissJob } = useMeetingJobs();

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

  const completedJobs = useMemo(
    () =>
      jobs
        .filter(job => job.status === 'completed')
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [jobs],
  );

  if (!nav) {
    return null;
  }

  return (
    <div className="app-nav-research-panel">
      <button
        type="button"
        className="research-sidebar-new-chat meeting-sidebar-new-meeting"
        onClick={nav.onNewMeeting}
      >
        <MicIcon />
        <span>新會議</span>
      </button>

      <div className="research-sidebar-scroll app-nav-panel-scroll">
        {activeJobs.length > 0 ? (
          <SidebarSection title="進行中">
            {activeJobs.map(job => (
              <SidebarJobItem
                key={job.id}
                job={job}
                selected={nav.activeJobId === job.id}
                onSelect={() => nav.onSelectJob(job.id)}
                onCancel={() =>
                  job.status === 'running'
                    ? cancelJob(job.id)
                    : dismissJob(job.id)
                }
                cancelLabel={
                  job.status === 'running'
                    ? '取消'
                    : job.status === 'failed'
                      ? '清除'
                      : '移除'
                }
              />
            ))}
          </SidebarSection>
        ) : null}

        <SidebarSection title="已完成">
          {completedJobs.length === 0 ? (
            <li className="research-sidebar-empty-item">
              <span className="research-sidebar-empty">
                完成的會議紀要會顯示在這裡
              </span>
            </li>
          ) : (
            completedJobs.map(job => (
              <SidebarJobItem
                key={job.id}
                job={job}
                selected={nav.activeJobId === job.id}
                onSelect={() => nav.onSelectJob(job.id)}
                onCancel={() => dismissJob(job.id)}
                cancelLabel="移除"
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
  cancelLabel,
}: {
  job: MeetingJob;
  selected: boolean;
  onSelect: () => void;
  onCancel: () => void;
  cancelLabel: string;
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
          <span className="research-sidebar-chat-title" title={job.fileName}>
            {job.fileName}
          </span>
          <span className="research-sidebar-chat-meta">
            <span className={`research-sidebar-badge ${job.status}`}>
              {MEETING_JOB_STATUS_LABELS[job.status]}
            </span>
            {formatWhen(job.updatedAt)}
          </span>
        </button>
        <button
          type="button"
          className="research-sidebar-chat-action"
          title={cancelLabel}
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

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
