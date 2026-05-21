'use client';

import { useState } from 'react';

import { markdownExportFilename } from '@/export-report';

import { downloadTextFile } from '../lib/client-export';
import { RESEARCH_MODEL_LABELS } from '../lib/research-models';
import { useResearchJobs } from './research-jobs-provider';
import { ResearchMarkdownContent } from './research-markdown';

function formatWhen(ts: number) {
  return new Date(ts).toLocaleString('zh-TW', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ResearchHistoryPanel() {
  const { history, removeHistoryEntry } = useResearchJobs();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const copyContent = async (content: string, query: string) => {
    await navigator.clipboard.writeText(content);
    setCopyHint(query);
    setTimeout(() => setCopyHint(null), 2000);
  };

  if (!history.length) {
    return (
      <section className="card research-history-card">
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>歷史紀錄</h2>
        <p className="research-hint" style={{ marginTop: '0.75rem' }}>
          完成的研究報告會顯示在這裡。
        </p>
      </section>
    );
  }

  return (
    <section className="card research-history-card">
      <h2 style={{ margin: 0, fontSize: '1.1rem' }}>歷史紀錄</h2>
      <ul className="research-history-list">
        {history.map(entry => {
          const expanded = expandedId === entry.id;
          const copied = copyHint === entry.query;
          return (
            <li key={entry.id} className="research-history-item">
              <button
                type="button"
                className="research-history-item-head"
                onClick={() => setExpandedId(expanded ? null : entry.id)}
              >
                <span className="research-history-query">{entry.query}</span>
                <span className="research-history-meta">
                  {formatWhen(entry.completedAt)} ·{' '}
                  {RESEARCH_MODEL_LABELS[entry.model]} ·{' '}
                  {entry.mode === 'report' ? '報告' : '答案'}
                </span>
                <span className="research-history-preview">
                  {entry.preview}
                </span>
              </button>
              {expanded && (
                <div className="research-history-body">
                  <div className="research-history-content report-body">
                    <ResearchMarkdownContent
                      content={entry.content}
                      mode={entry.mode}
                    />
                  </div>
                  <div className="actions" style={{ marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        void copyContent(entry.content, entry.query)
                      }
                    >
                      {copied ? '已複製' : '複製'}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        downloadTextFile(
                          entry.content,
                          markdownExportFilename(entry.content, entry.query),
                          'text/markdown;charset=utf-8',
                        )
                      }
                    >
                      匯出 Markdown
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => removeHistoryEntry(entry.id)}
                    >
                      刪除紀錄
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
