'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  docxExportFilename,
} from '@/export-report';
import { renderMeetingMinutesMarkdown } from '@/meeting/render-minutes-md';
import type { MeetingMinutes } from '@/meeting/schemas/minutes';
import { filenameFromTitle } from '@/slugify';
import { formatTimestamp } from '@/meeting/format-transcript';

import type { MeetingJob } from '../lib/meeting-jobs';
import {
  jobHasDisplayableContent,
  latestStreamDetail,
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
import { useMeetingJobs } from './meeting-jobs-provider';
import { ResearchMarkdownContent } from './research-markdown';

type Tab = 'minutes' | 'transcript' | 'actions';

type EditableMinutes = {
  title: string;
  summary: string;
  participantsText: string;
  agendaText: string;
  keyDecisionsText: string;
  openQuestionsText: string;
  actionItems: { owner: string; task: string; deadline: string }[];
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applySpeakerAliasesToText(
  text: string,
  aliases: Record<string, string>,
): string {
  let output = text;
  for (const [speaker, alias] of Object.entries(aliases)) {
    const name = alias.trim();
    if (!name) {
      continue;
    }
    output = output.replace(new RegExp(escapeRegExp(speaker), 'g'), name);
  }
  return output;
}

function meetingPdfExportFilename(title: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const timestamp = `${yyyy}${mm}${dd}-${hh}${min}`;
  const fallbackTitle = title.trim() || 'meeting-minutes';
  return filenameFromTitle(`${timestamp}-${fallbackTitle}`, '.pdf');
}

function linesToList(text: string): string[] {
  return text
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean);
}

function minutesToEditable(minutes: MeetingMinutes, fallbackTitle: string): EditableMinutes {
  return {
    title: minutes.title || fallbackTitle,
    summary: minutes.summary || '',
    participantsText: minutes.participants.join('\n'),
    agendaText: minutes.agenda.join('\n'),
    keyDecisionsText: minutes.keyDecisions.join('\n'),
    openQuestionsText: minutes.openQuestions.join('\n'),
    actionItems: minutes.actionItems.map(item => ({
      owner: item.owner,
      task: item.task,
      deadline: item.deadline ?? '',
    })),
  };
}

function editableToMinutes(value: EditableMinutes): MeetingMinutes {
  return {
    title: value.title.trim() || '會議紀要',
    summary: value.summary.trim(),
    participants: linesToList(value.participantsText),
    agenda: linesToList(value.agendaText),
    keyDecisions: linesToList(value.keyDecisionsText),
    actionItems: value.actionItems
      .map(item => ({
        owner: item.owner.trim(),
        task: item.task.trim(),
        deadline: item.deadline.trim() || undefined,
      }))
      .filter(item => item.owner || item.task),
    openQuestions: linesToList(value.openQuestionsText),
    speakerHighlights: [],
  };
}

export function MeetingResultPanel({ job }: { job: MeetingJob }) {
  const { updateJob } = useMeetingJobs();
  const [tab, setTab] = useState<Tab>('minutes');
  const [exporting, setExporting] = useState(false);
  const [speakerAliases, setSpeakerAliases] = useState<Record<string, string>>(
    {},
  );
  const [editableMarkdown, setEditableMarkdown] = useState('');
  const [hasManualMarkdown, setHasManualMarkdown] = useState(false);
  const [minutesEditMode, setMinutesEditMode] = useState(false);
  const [editedMinutes, setEditedMinutes] = useState<EditableMinutes | null>(null);

  const markdown = resolveJobMarkdown(job);
  const minutes = resolveJobMinutes(job);
  const transcript = resolveJobTranscript(job);
  const hasContent = jobHasDisplayableContent(job);
  const actionItems = minutes?.actionItems ?? [];
  const title = minutes?.title ?? job.fileName;
  const renderedMarkdown = useMemo(
    () => applySpeakerAliasesToText(editableMarkdown, speakerAliases),
    [editableMarkdown, speakerAliases],
  );
  const displayActionItems = useMemo(
    () => (hasManualMarkdown && editedMinutes ? editedMinutes.actionItems : actionItems),
    [actionItems, editedMinutes, hasManualMarkdown],
  );

  const transcriptLines = useMemo(() => {
    if (!transcript?.utterances.length) {
      return [];
    }
    return transcript.utterances.map(u => ({
      id: u.id,
      label: `[${formatTimestamp(u.startSec)}] ${
        speakerAliases[u.speaker]?.trim() || u.speaker
      }`,
      text: u.text,
    }));
  }, [transcript, speakerAliases]);
  const speakers = useMemo(() => {
    if (!transcript?.utterances.length) {
      return [];
    }
    const seen = new Set<string>();
    const orderedSpeakers: string[] = [];
    for (const utterance of transcript.utterances) {
      if (!seen.has(utterance.speaker)) {
        seen.add(utterance.speaker);
        orderedSpeakers.push(utterance.speaker);
      }
    }
    return orderedSpeakers;
  }, [transcript]);

  useEffect(() => {
    setTab('minutes');
    const persistedAliases = job.speakerAliases ?? {};
    const persistedEditedMarkdown = job.editedMarkdown;
    setSpeakerAliases(persistedAliases);
    setEditableMarkdown(persistedEditedMarkdown ?? markdown);
    setHasManualMarkdown(Boolean(persistedEditedMarkdown?.trim()));
    if (minutes) {
      setEditedMinutes(minutesToEditable(minutes, job.fileName));
    } else {
      setEditedMinutes(null);
    }
    setMinutesEditMode(false);
  }, [job.id]);

  useEffect(() => {
    if (!hasManualMarkdown) {
      setEditableMarkdown(markdown);
    }
  }, [markdown, hasManualMarkdown]);

  useEffect(() => {
    if (!minutes || hasManualMarkdown) {
      return;
    }
    setEditedMinutes(minutesToEditable(minutes, job.fileName));
  }, [hasManualMarkdown, job.fileName, minutes]);

  useEffect(() => {
    updateJob(job.id, {
      speakerAliases:
        Object.keys(speakerAliases).length > 0 ? speakerAliases : undefined,
    });
  }, [job.id, speakerAliases, updateJob]);

  useEffect(() => {
    updateJob(job.id, {
      editedMarkdown:
        hasManualMarkdown && editableMarkdown.trim() ? editableMarkdown : undefined,
    });
  }, [editableMarkdown, hasManualMarkdown, job.id, updateJob]);

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
    if (!renderedMarkdown) {
      return;
    }
    setExporting(true);
    try {
      const blob = await fetchDocxExport(renderedMarkdown, title);
      downloadBlob(blob, docxExportFilename(renderedMarkdown, title));
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = async () => {
    if (!renderedMarkdown) {
      return;
    }
    setExporting(true);
    try {
      const blob = await fetchPdfExport(renderedMarkdown, title);
      downloadBlob(blob, meetingPdfExportFilename(title));
    } finally {
      setExporting(false);
    }
  };

  const exportMd = () => {
    if (!renderedMarkdown) {
      return;
    }
    downloadTextFile(
      renderedMarkdown,
      `${job.fileName.replace(/\.[^.]+$/, '')}-minutes.md`,
      'text/markdown',
    );
  };

  const applyMinutesEdit = (next: EditableMinutes) => {
    setEditedMinutes(next);
    const nextMarkdown = renderMeetingMinutesMarkdown(
      editableToMinutes(next),
      transcript,
      { includeAppendix: Boolean(transcript?.utterances.length) },
    );
    setEditableMarkdown(nextMarkdown);
    setHasManualMarkdown(true);
  };

  if (job.status === 'running' && !hasContent) {
    const progressDetail = latestStreamDetail(job);

    return (
      <section className="meeting-result-panel">
        <p className="meeting-streaming-note" role="status">
          {progressDetail ||
            (job.serverJobId
              ? '音訊已上傳，伺服器處理中…'
              : '正在上傳音訊…')}
        </p>
        <p className="meeting-empty">
          {job.serverJobId
            ? '轉錄與摘要可能需要數分鐘，下方進度會每 2 秒更新。'
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
          <button type="button" onClick={exportMd} disabled={!renderedMarkdown}>
            Markdown
          </button>
          <button
            type="button"
            onClick={() => void exportDocx()}
            disabled={!renderedMarkdown || exporting}
          >
            Word
          </button>
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={!renderedMarkdown || exporting}
          >
            PDF
          </button>
        </div>
      </div>

      {tab === 'minutes' ? (
        renderedMarkdown ? (
          <article className="meeting-markdown">
            <div className="meeting-markdown-editor-actions">
              <button
                type="button"
                onClick={() => setMinutesEditMode(mode => !mode)}
                aria-label={minutesEditMode ? '切換到預覽' : '切換到編輯'}
                title={minutesEditMode ? '預覽' : '編輯'}
              >
                ✏️
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditableMarkdown(markdown);
                  if (minutes) {
                    setEditedMinutes(minutesToEditable(minutes, job.fileName));
                  }
                  setHasManualMarkdown(false);
                  setMinutesEditMode(false);
                  updateJob(job.id, { editedMarkdown: undefined });
                }}
                disabled={!hasManualMarkdown}
              >
                還原 AI 版本
              </button>
            </div>
            {minutesEditMode ? (
              editedMinutes ? (
                <MinutesPlainEditor value={editedMinutes} onChange={applyMinutesEdit} />
              ) : (
                <p className="meeting-empty">尚無可編輯會議內容</p>
              )
            ) : (
              <ResearchMarkdownContent content={renderedMarkdown} mode="report" />
            )}
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
        <TranscriptList
          lines={transcriptLines}
          speakers={speakers}
          aliases={speakerAliases}
          onAliasChange={(speaker, alias) =>
            setSpeakerAliases(prev => ({ ...prev, [speaker]: alias }))
          }
        />
      ) : null}

      {tab === 'actions' ? (
        <ActionsTable
          items={displayActionItems.map(item => ({
            ...item,
            owner: speakerAliases[item.owner]?.trim() || item.owner,
          }))}
        />
      ) : null}
    </section>
  );
}

function MinutesPlainEditor({
  value,
  onChange,
}: {
  value: EditableMinutes;
  onChange: (next: EditableMinutes) => void;
}) {
  const updateActionItem = (
    index: number,
    field: 'owner' | 'task' | 'deadline',
    fieldValue: string,
  ) => {
    const nextItems = value.actionItems.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: fieldValue } : item,
    );
    onChange({ ...value, actionItems: nextItems });
  };

  const addActionItem = () => {
    onChange({
      ...value,
      actionItems: [...value.actionItems, { owner: '', task: '', deadline: '' }],
    });
  };

  const removeActionItem = (index: number) => {
    onChange({
      ...value,
      actionItems: value.actionItems.filter((_, itemIndex) => itemIndex !== index),
    });
  };

  return (
    <div className="meeting-plain-editor">
      <label>
        <span>標題</span>
        <input
          type="text"
          value={value.title}
          onChange={event => onChange({ ...value, title: event.target.value })}
        />
      </label>
      <label>
        <span>摘要</span>
        <textarea
          value={value.summary}
          onChange={event => onChange({ ...value, summary: event.target.value })}
        />
      </label>
      <label>
        <span>與會者（每行一位）</span>
        <textarea
          value={value.participantsText}
          onChange={event => onChange({ ...value, participantsText: event.target.value })}
        />
      </label>
      <label>
        <span>討論議題（每行一項）</span>
        <textarea
          value={value.agendaText}
          onChange={event => onChange({ ...value, agendaText: event.target.value })}
        />
      </label>
      <label>
        <span>決策（每行一項）</span>
        <textarea
          value={value.keyDecisionsText}
          onChange={event => onChange({ ...value, keyDecisionsText: event.target.value })}
        />
      </label>
      <label>
        <span>未決事項（每行一項）</span>
        <textarea
          value={value.openQuestionsText}
          onChange={event => onChange({ ...value, openQuestionsText: event.target.value })}
        />
      </label>
      <div className="meeting-plain-editor-actions">
        <span>待辦事項</span>
        <button type="button" onClick={addActionItem}>
          + 新增
        </button>
      </div>
      {value.actionItems.map((item, index) => (
        <div key={index} className="meeting-plain-editor-action-row">
          <input
            type="text"
            placeholder="負責人"
            value={item.owner}
            onChange={event => updateActionItem(index, 'owner', event.target.value)}
          />
          <input
            type="text"
            placeholder="事項"
            value={item.task}
            onChange={event => updateActionItem(index, 'task', event.target.value)}
          />
          <input
            type="text"
            placeholder="期限"
            value={item.deadline}
            onChange={event => updateActionItem(index, 'deadline', event.target.value)}
          />
          <button type="button" onClick={() => removeActionItem(index)}>
            刪除
          </button>
        </div>
      ))}
    </div>
  );
}

function TranscriptList({
  lines,
  speakers,
  aliases,
  onAliasChange,
}: {
  lines: { id: string; label: string; text: string }[];
  speakers: string[];
  aliases: Record<string, string>;
  onAliasChange: (speaker: string, alias: string) => void;
}) {
  const [aliasEditorOpen, setAliasEditorOpen] = useState(false);

  if (!lines.length) {
    return <p className="meeting-empty">尚無逐字稿</p>;
  }

  const namedCount = speakers.filter(speaker => Boolean(aliases[speaker]?.trim())).length;
  const unnamedCount = Math.max(0, speakers.length - namedCount);

  return (
    <>
      {speakers.length ? (
        <div className="meeting-speaker-alias-panel">
          <div className="meeting-speaker-alias-head">
            <div>
              <p className="meeting-speaker-alias-title">發言者姓名對應</p>
              <p className="meeting-speaker-alias-progress">
                已命名 {namedCount}/{speakers.length}
                {unnamedCount > 0 ? `（尚有 ${unnamedCount} 位待命名）` : ''}
              </p>
            </div>
            <button
              type="button"
              className="meeting-speaker-alias-toggle"
              onClick={() => setAliasEditorOpen(open => !open)}
              aria-expanded={aliasEditorOpen}
            >
              {aliasEditorOpen ? '收合' : '編輯發言者'}
            </button>
          </div>
          {aliasEditorOpen ? (
            <div className="meeting-speaker-alias-grid">
              {speakers.map(speaker => (
                <label key={speaker} className="meeting-speaker-alias-item">
                  <span>{speaker}</span>
                  <input
                    type="text"
                    value={aliases[speaker] ?? ''}
                    onChange={event => onAliasChange(speaker, event.target.value)}
                    placeholder="輸入姓名"
                  />
                </label>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="meeting-transcript-list">
        {lines.map(line => (
          <div key={line.id} className="meeting-transcript-line">
            <div className="meeting-transcript-meta">{line.label}</div>
            <p>{line.text}</p>
          </div>
        ))}
      </div>
    </>
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
