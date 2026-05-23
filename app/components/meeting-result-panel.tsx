'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  docxExportFilename,
  pdfExportFilename,
} from '@/export-report';
import { formatTimestamp } from '@/meeting/format-transcript';

import type { MeetingJob } from '../lib/meeting-jobs';
import {
  jobHasDisplayableContent,
  resolveJobMarkdown,
  resolveJobMinutes,
  resolveJobTranscript,
} from '../lib/meeting-job-content';
import {
  downloadBlob,
  downloadTextFile,
  fetchDocxExport,
  fetchPdfExport,
} from '../lib/client-export';
import { ResearchMarkdownContent } from './research-markdown';

type Tab = 'minutes' | 'transcript' | 'actions';

export function MeetingResultPanel({ job }: { job: MeetingJob }) {
  const [tab, setTab] = useState<Tab>('minutes');
  const [exporting, setExporting] = useState(false);

  const markdown = resolveJobMarkdown(job);
  const minutes = resolveJobMinutes(job);
  const transcript = resolveJobTranscript(job);
  const hasContent = jobHasDisplayableContent(job);
  const actionItems = minutes?.actionItems ?? [];
  const title = minutes?.title ?? job.fileName;

  const transcriptLines = useMemo(() => {
    if (!transcript?.utterances.length) {
      return [];
    }
    return transcript.utterances.map(u => ({
      id: u.id,
      label: `[${formatTimestamp(u.startSec)}] ${u.speaker}`,
      text: u.text,
    }));
  }, [transcript]);

  useEffect(() => {
    setTab('minutes');
  }, [job.id]);

  useEffect(() => {
    if (job.status === 'running' && !markdown && transcriptLines.length > 0) {
      setTab('transcript');
    }
  }, [job.status, markdown, transcriptLines.length]);

  useEffect(() => {
    if (markdown) {
      setTab('minutes');
    } else if (
      job.status === 'completed' &&
      !markdown &&
      transcriptLines.length > 0
    ) {
      setTab('transcript');
    }
  }, [job.status, markdown, transcriptLines.length]);

  const exportDocx = async () => {
    if (!markdown) {
      return;
    }
    setExporting(true);
    try {
      const blob = await fetchDocxExport(markdown, title);
      downloadBlob(blob, docxExportFilename(markdown, title));
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = async () => {
    if (!markdown) {
      return;
    }
    setExporting(true);
    try {
      const blob = await fetchPdfExport(markdown, title);
      downloadBlob(blob, pdfExportFilename(markdown, title));
    } finally {
      setExporting(false);
    }
  };

  const exportMd = () => {
    if (!markdown) {
      return;
    }
    downloadTextFile(
      markdown,
      `${job.fileName.replace(/\.[^.]+$/, '')}-minutes.md`,
      'text/markdown',
    );
  };

  if (job.status === 'running' && !hasContent) {
    const uploadDetail = job.data
      .slice()
      .reverse()
      .find(
        part =>
          typeof part === 'object' &&
          part !== null &&
          !Array.isArray(part) &&
          (part as { type?: string }).type === 'transcribe',
      ) as { detail?: string } | undefined;

    return (
      <section className="meeting-result-panel">
        <p className="meeting-streaming-note" role="status">
          {job.serverJobId
            ? '音訊已上傳，伺服器處理中…'
            : (uploadDetail?.detail ?? '正在上傳音訊…')}
        </p>
        <p className="meeting-empty">
          {job.serverJobId
            ? '轉錄與摘要可能需要數分鐘。若 SSE 中斷，系統仍會每 4 秒從伺服器拉取結果。'
            : '大型音訊檔上傳中，完成後會立即顯示處理進度。'}
        </p>
      </section>
    );
  }

  if (job.status !== 'running' && !hasContent) {
    return (
      <section className="meeting-result-panel">
        <p className="meeting-empty">
          {job.serverJobId
            ? '正在從伺服器載入紀要…'
            : (job.error ??
              '紀要內容未能載入。請在左側選取任務，或重新上傳音訊。')}
        </p>
      </section>
    );
  }

  return (
    <section className="meeting-result-panel">
      {job.status === 'running' ? (
        <p className="meeting-streaming-note" role="status">
          {markdown
            ? '會議紀要分段更新中…'
            : transcriptLines.length
              ? '逐字稿分段載入中…'
              : '處理中…'}
        </p>
      ) : null}
      <div className="meeting-result-toolbar">
        <div className="meeting-result-tabs">
          <button
            type="button"
            className={tab === 'minutes' ? 'active' : ''}
            onClick={() => setTab('minutes')}
          >
            會議紀要
          </button>
          <button
            type="button"
            className={tab === 'transcript' ? 'active' : ''}
            onClick={() => setTab('transcript')}
          >
            逐字稿
          </button>
          {actionItems.length ? (
            <button
              type="button"
              className={tab === 'actions' ? 'active' : ''}
              onClick={() => setTab('actions')}
            >
              待辦
            </button>
          ) : null}
        </div>
        <div className="meeting-export-actions">
          <button type="button" onClick={exportMd} disabled={!markdown}>
            Markdown
          </button>
          <button
            type="button"
            onClick={() => void exportDocx()}
            disabled={!markdown || exporting}
          >
            Word
          </button>
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={!markdown || exporting}
          >
            PDF
          </button>
        </div>
      </div>

      {tab === 'minutes' ? (
        markdown ? (
          <article className="meeting-markdown">
            <ResearchMarkdownContent content={markdown} mode="report" />
          </article>
        ) : (
          <p className="meeting-empty">
            {job.status === 'running'
              ? '正在生成會議紀要…'
              : '尚無紀要，請查看逐字稿分頁。'}
          </p>
        )
      ) : null}

      {tab === 'transcript' ? (
        <TranscriptList lines={transcriptLines} />
      ) : null}

      {tab === 'actions' ? (
        <ActionsTable items={actionItems} />
      ) : null}
    </section>
  );
}

function TranscriptList({
  lines,
}: {
  lines: { id: string; label: string; text: string }[];
}) {
  if (!lines.length) {
    return <p className="meeting-empty">尚無逐字稿</p>;
  }
  return (
    <div className="meeting-transcript-list">
      {lines.map(line => (
        <div key={line.id} className="meeting-transcript-line">
          <div className="meeting-transcript-meta">{line.label}</div>
          <p>{line.text}</p>
        </div>
      ))}
    </div>
  );
}

function ActionsTable({
  items,
}: {
  items: { owner: string; task: string; deadline?: string }[];
}) {
  if (!items.length) {
    return <p className="meeting-empty">尚無待辦事項</p>;
  }
  return (
    <div className="meeting-actions-table-wrap">
      <table className="meeting-actions-table">
        <thead>
          <tr>
            <th>負責人</th>
            <th>事項</th>
            <th>期限</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.owner}-${index}`}>
              <td>{item.owner}</td>
              <td>{item.task}</td>
              <td>{item.deadline ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
