'use client';

import Link from 'next/link';

import { useResearchJobs } from './research-jobs-provider';

export function ResearchBackgroundToast() {
  const { runningCount, pendingCount } = useResearchJobs();
  const total = runningCount + pendingCount;

  if (!total) {
    return null;
  }

  return (
    <div className="research-bg-toast" role="status">
      <span>
        {runningCount > 0 ? `${runningCount} 個研究進行中` : null}
        {runningCount > 0 && pendingCount > 0 ? '，' : null}
        {pendingCount > 0 ? `${pendingCount} 個待處理` : null}
      </span>
      <Link href="/research">查看進度 →</Link>
    </div>
  );
}
