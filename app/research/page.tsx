'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { JSONValue } from 'ai';

import {
  docxExportFilename,
  markdownExportFilename,
  pdfExportFilename,
} from '@/export-report';
import { normalizeReportMarkdown } from '@/normalize-report-markdown';
import type { FollowUpEntry } from '@/research-query';
import type { ResearchOutputLanguage } from '@/research-output-language';

import { ResearchFormPanel } from '../components/research-form-panel';
import { ResearchShellLayout } from '../components/research-shell-layout';
import { useResearchJobs } from '../components/research-jobs-provider';
import { ResearchMarkdownContent } from '../components/research-markdown';
import {
  downloadBlob,
  downloadTextFile,
  fetchDocxExport,
  fetchPdfExport,
} from '../lib/client-export';
import type { PromptAttachment } from '../lib/prompt-attachments';
import {
  DEFAULT_RESEARCH_INTENSITY,
  inferResearchIntensity,
  researchIntensityParams,
  type ResearchIntensity,
} from '../lib/research-intensity';
import { RESEARCH_MODEL_LABELS } from '../lib/research-models';

type Phase = 'research' | 'writing';
type Mode = 'report' | 'answer';
type StepStatus = 'pending' | 'active' | 'done';
type ResearchStepId =
  | 'query-analysis'
  | 'web-search'
  | 'evaluation-cross-check'
  | 'synthesis'
  | 'report-generation';

type ProgressData = {
  type: 'progress';
  currentDepth: number;
  totalDepth: number;
  currentBreadth: number;
  totalBreadth: number;
  currentQuery?: string | null;
  totalQueries: number;
  completedQueries: number;
};

type StreamDataPart =
  | { type: 'phase'; phase: Phase }
  | ProgressData
  | { type: 'sources'; urls: string[] }
  | { type: 'answer'; answer: string }
  | { type: 'learnings'; count: number; urlsCount: number }
  | {
      type: 'step';
      step: ResearchStepId;
      status: Exclude<StepStatus, 'pending'>;
      detail?: string;
    }
  | {
      type: 'log';
      icon: 'search' | 'brain' | 'link' | 'check';
      message: string;
    }
  | { type: 'query-plan'; queries: string[] }
  | {
      type: 'search-result';
      query: string;
      urls: string[];
      resultCount: number;
    }
  | {
      type: 'learning-result';
      query: string;
      learningsCount: number;
      followUpCount: number;
    };

const STEP_CONFIG: Array<{ id: ResearchStepId; label: string }> = [
  { id: 'query-analysis', label: '查詢分析' },
  { id: 'web-search', label: '搜尋與來源' },
  { id: 'evaluation-cross-check', label: '評估與交叉驗證' },
  { id: 'synthesis', label: '綜合整理' },
  { id: 'report-generation', label: '產出生成' },
];

const LOG_ICON: Record<'search' | 'brain' | 'link' | 'check', string> = {
  search: '🔎',
  brain: '🧠',
  link: '🔗',
  check: '✅',
};

function parseDataPart(value: JSONValue): StreamDataPart | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const part = value as Record<string, unknown>;
  if (typeof part.type !== 'string') {
    return null;
  }
  return part as StreamDataPart;
}

function latestFromData<T extends StreamDataPart['type']>(
  data: JSONValue[] | undefined,
  type: T,
): Extract<StreamDataPart, { type: T }> | undefined {
  if (!data?.length) {
    return undefined;
  }
  for (let i = data.length - 1; i >= 0; i--) {
    const part = parseDataPart(data[i]!);
    if (part?.type === type) {
      return part as Extract<StreamDataPart, { type: T }>;
    }
  }
  return undefined;
}

function sourcesMarkdown(urls: string[]) {
  if (!urls.length) {
    return '';
  }
  return `\n\n## Sources\n\n${urls.map(url => `- ${url}`).join('\n')}`;
}

function TypewriterLine({
  text,
  isActive,
}: {
  text: string;
  isActive: boolean;
}) {
  const [visibleLength, setVisibleLength] = useState(
    isActive ? 0 : text.length,
  );

  useEffect(() => {
    if (!isActive) {
      setVisibleLength(text.length);
      return;
    }
    setVisibleLength(0);
    const timer = setInterval(() => {
      setVisibleLength(prev => {
        const next = prev + 2;
        if (next >= text.length) {
          clearInterval(timer);
          return text.length;
        }
        return next;
      });
    }, 18);
    return () => clearInterval(timer);
  }, [isActive, text]);

  return <span>{text.slice(0, visibleLength)}</span>;
}

export default function ResearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const {
    activeJob,
    activeJobId,
    setActiveJobId,
    enqueueJob,
    dismissJob,
    selectedModel,
    setSelectedModel,
    runningCount,
    pendingCount,
    history,
    removeHistoryEntry,
  } = useResearchJobs();

  const [query, setQuery] = useState(initialQuery);
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  const [intensity, setIntensity] = useState<ResearchIntensity>(
    DEFAULT_RESEARCH_INTENSITY,
  );
  const [mode, setMode] = useState<Mode>('report');
  const [outputLanguage, setOutputLanguage] =
    useState<ResearchOutputLanguage>('auto');
  const [step, setStep] = useState<
    'form' | 'followup' | 'result' | 'history'
  >('form');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null,
  );
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [followUpAnswers, setFollowUpAnswers] = useState<
    Record<number, string>
  >({});
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'md' | 'docx' | 'pdf' | null>(
    null,
  );
  const [exportError, setExportError] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] =
    useState<ResearchStepId>('query-analysis');
  const [researchStartedAt, setResearchStartedAt] = useState<number | null>(
    null,
  );
  const [nowTick, setNowTick] = useState(Date.now());
  const feedRef = useRef<HTMLDivElement>(null);
  const syncedActiveJobIdRef = useRef<string | null>(null);

  const messages = activeJob?.messages ?? [];
  const data = activeJob?.data;
  const isLoading = activeJob?.status === 'running';
  const isFailed = activeJob?.status === 'failed';
  const error = activeJob?.error ? new Error(activeJob.error) : undefined;
  const viewMode = activeJob?.mode ?? mode;
  const selectedHistoryEntry = useMemo(
    () => history.find(entry => entry.id === selectedHistoryId),
    [history, selectedHistoryId],
  );

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  // 僅在切換檢視的任務時同步表單，避免背景任務 status 更新覆寫使用者的研究強度選擇
  useEffect(() => {
    if (!activeJobId || !activeJob) {
      syncedActiveJobIdRef.current = null;
      return;
    }
    if (syncedActiveJobIdRef.current === activeJobId) {
      return;
    }
    syncedActiveJobIdRef.current = activeJobId;
    setQuery(activeJob.query);
    setIntensity(inferResearchIntensity(activeJob.breadth, activeJob.depth));
    setMode(activeJob.mode);
    setOutputLanguage(activeJob.outputLanguage ?? 'auto');
    if (activeJob.status === 'running' || activeJob.status === 'completed') {
      setResearchStartedAt(activeJob.createdAt);
    }
  }, [activeJob, activeJobId]);

  useEffect(() => {
    if (!activeJob) {
      return;
    }
    if (activeJob.status === 'running' || activeJob.status === 'completed') {
      setResearchStartedAt(activeJob.createdAt);
    }
  }, [activeJob?.status, activeJobId, activeJob]);

  useEffect(() => {
    if (step === 'result' && !activeJob) {
      setStep('form');
    }
    if (step === 'history' && !selectedHistoryEntry) {
      setStep('form');
      setSelectedHistoryId(null);
    }
  }, [step, activeJob, selectedHistoryEntry]);

  const phase = latestFromData(data, 'phase');
  const progress = latestFromData(data, 'progress');
  const sources = latestFromData(data, 'sources');
  const answerPart = latestFromData(data, 'answer');
  const parsedData = useMemo(
    () =>
      (data ?? [])
        .map(parseDataPart)
        .filter((part): part is StreamDataPart => part !== null),
    [data],
  );
  const queryPlanPart = useMemo(
    () => [...parsedData].reverse().find(part => part.type === 'query-plan'),
    [parsedData],
  );
  const stepEvents = useMemo(
    () =>
      parsedData.filter(
        (part): part is Extract<StreamDataPart, { type: 'step' }> =>
          part.type === 'step',
      ),
    [parsedData],
  );
  const logEvents = useMemo(
    () =>
      parsedData.filter(
        (part): part is Extract<StreamDataPart, { type: 'log' }> =>
          part.type === 'log',
      ),
    [parsedData],
  );
  const searchResultEvents = useMemo(
    () =>
      parsedData.filter(
        (part): part is Extract<StreamDataPart, { type: 'search-result' }> =>
          part.type === 'search-result',
      ),
    [parsedData],
  );
  const learningResultEvents = useMemo(
    () =>
      parsedData.filter(
        (part): part is Extract<StreamDataPart, { type: 'learning-result' }> =>
          part.type === 'learning-result',
      ),
    [parsedData],
  );
  const progressEvents = useMemo(
    () =>
      parsedData.filter(
        (part): part is ProgressData => part.type === 'progress',
      ),
    [parsedData],
  );
  const stepStatus = useMemo(() => {
    const initial: Record<ResearchStepId, StepStatus> = {
      'query-analysis': 'pending',
      'web-search': 'pending',
      'evaluation-cross-check': 'pending',
      synthesis: 'pending',
      'report-generation': 'pending',
    };
    for (const event of stepEvents) {
      initial[event.step] = event.status;
    }
    if (
      phase?.phase === 'writing' &&
      initial['report-generation'] === 'pending'
    ) {
      initial['report-generation'] = 'active';
    }
    return initial;
  }, [phase?.phase, stepEvents]);
  const stepsDoneCount = useMemo(
    () => STEP_CONFIG.filter(step => stepStatus[step.id] === 'done').length,
    [stepStatus],
  );
  const etaSeconds = useMemo(() => {
    if (
      !researchStartedAt ||
      !progress?.totalQueries ||
      progress.completedQueries <= 0
    ) {
      return null;
    }
    const elapsed = Math.max(1, (nowTick - researchStartedAt) / 1000);
    const avgPerQuery = elapsed / progress.completedQueries;
    const remainingQueries = Math.max(
      0,
      progress.totalQueries - progress.completedQueries,
    );
    return Math.max(0, Math.round(avgPerQuery * remainingQueries));
  }, [
    nowTick,
    progress?.completedQueries,
    progress?.totalQueries,
    researchStartedAt,
  ]);

  const reportMarkdown = useMemo(() => {
    const assistant = [...messages].reverse().find(m => m.role === 'assistant');
    const raw = assistant?.content ?? '';
    return normalizeReportMarkdown(raw);
  }, [messages]);

  const fullMarkdown = reportMarkdown + sourcesMarkdown(sources?.urls ?? []);

  const exportContent =
    viewMode === 'answer' ? (answerPart?.answer ?? '') : fullMarkdown;
  const exportFallbackTitle = query.trim() || 'research';

  const progressPercent = useMemo(() => {
    if (!progress?.totalQueries) {
      return 0;
    }
    return Math.round(
      (progress.completedQueries / progress.totalQueries) * 100,
    );
  }, [progress]);

  const phaseLabel =
    phase?.phase === 'writing'
      ? '撰寫報告中…'
      : isLoading
        ? '深度研究中…'
        : null;

  useEffect(() => {
    if (!isLoading) {
      return;
    }
    setNowTick(Date.now());
    const timer = setInterval(() => setNowTick(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [isLoading]);

  useEffect(() => {
    if (!feedRef.current) {
      return;
    }
    feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [logEvents]);

  const resetSession = useCallback(() => {
    syncedActiveJobIdRef.current = null;
    setActiveJobId(null);
    setSelectedHistoryId(null);
    setStep('form');
    setMode('report');
    setOutputLanguage('auto');
    setIntensity(DEFAULT_RESEARCH_INTENSITY);
    setAttachments([]);
    setFollowUpQuestions([]);
    setFollowUpAnswers({});
    setFeedbackError(null);
    setExportError(null);
    setExpandedStep('query-analysis');
    setResearchStartedAt(null);
  }, [setActiveJobId]);

  const sendToBackground = useCallback(() => {
    syncedActiveJobIdRef.current = null;
    setActiveJobId(null);
    setSelectedHistoryId(null);
    setStep('form');
    setExportError(null);
  }, [setActiveJobId]);

  const openJob = useCallback(
    (jobId: string) => {
      setSelectedHistoryId(null);
      setActiveJobId(jobId);
      setStep('result');
    },
    [setActiveJobId],
  );

  const openHistory = useCallback((entryId: string) => {
    setActiveJobId(null);
    syncedActiveJobIdRef.current = null;
    setSelectedHistoryId(entryId);
    setStep('history');
  }, [setActiveJobId]);

  const loadFollowUp = async () => {
    if (!query.trim()) {
      return;
    }
    setLoadingFeedback(true);
    setFeedbackError(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), model: selectedModel }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.message ?? json.error ?? 'Failed to load questions',
        );
      }
      setFollowUpQuestions(json.questions ?? []);
      setStep('followup');
    } catch (e) {
      setFeedbackError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingFeedback(false);
    }
  };

  const startResearch = (followUp?: FollowUpEntry[]) => {
    if (!query.trim()) {
      return;
    }
    setStep('result');
    setExpandedStep('query-analysis');
    setResearchStartedAt(Date.now());
    const { breadth, depth } = researchIntensityParams(intensity);
    enqueueJob({
      query: query.trim(),
      breadth,
      depth,
      mode: 'report',
      model: selectedModel,
      outputLanguage,
      followUp,
      attachments,
    });
  };

  const handleFormNext = async () => {
    await loadFollowUp();
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const followUp: FollowUpEntry[] = followUpQuestions.map((question, i) => ({
      question,
      answer: followUpAnswers[i]?.trim() ?? '',
    }));
    startResearch(followUp);
  };

  const downloadMarkdown = () => {
    if (!exportContent) {
      return;
    }
    setExportError(null);
    const filename =
      viewMode === 'answer'
        ? markdownExportFilename(exportContent, `${exportFallbackTitle}-answer`)
        : markdownExportFilename(exportContent, exportFallbackTitle);
    downloadTextFile(exportContent, filename, 'text/markdown;charset=utf-8');
  };

  const downloadDocx = async () => {
    if (!exportContent) {
      return;
    }
    setExportError(null);
    setExporting('docx');
    try {
      const filename =
        viewMode === 'answer'
          ? docxExportFilename(exportContent, `${exportFallbackTitle}-answer`)
          : docxExportFilename(exportContent, exportFallbackTitle);
      const blob = await fetchDocxExport(
        exportContent,
        viewMode === 'answer'
          ? `${exportFallbackTitle}-answer`
          : exportFallbackTitle,
      );
      downloadBlob(blob, filename);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(null);
    }
  };

  const downloadPdf = async () => {
    if (!exportContent) {
      return;
    }
    setExportError(null);
    setExporting('pdf');
    try {
      const filename =
        viewMode === 'answer'
          ? pdfExportFilename(exportContent, `${exportFallbackTitle}-answer`)
          : pdfExportFilename(exportContent, exportFallbackTitle);
      const blob = await fetchPdfExport(
        exportContent,
        viewMode === 'answer'
          ? `${exportFallbackTitle}-answer`
          : exportFallbackTitle,
      );
      downloadBlob(blob, filename);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(null);
    }
  };

  const copyToClipboard = async () => {
    if (!exportContent) {
      return;
    }
    await navigator.clipboard.writeText(exportContent);
  };

  const renderStepDetails = (stepId: ResearchStepId) => {
    if (stepId === 'query-analysis') {
      return queryPlanPart?.type === 'query-plan' ? (
        <ul className="step-detail-list">
          {queryPlanPart.queries.map(queryText => (
            <li key={queryText}>{queryText}</li>
          ))}
        </ul>
      ) : (
        <p className="step-detail-empty">等待查詢規劃中…</p>
      );
    }

    if (stepId === 'web-search') {
      if (!searchResultEvents.length) {
        return <p className="step-detail-empty">尚未回傳來源。</p>;
      }
      return (
        <div className="step-detail-block">
          {searchResultEvents.slice(-5).map((item, idx) => (
            <div key={`${item.query}-${idx}`} className="step-result-item">
              <p>
                <strong>{item.query}</strong> · {item.resultCount} 筆來源
              </p>
              <ul className="step-detail-list compact">
                {item.urls.slice(0, 3).map(url => (
                  <li key={url}>{url}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    }

    if (stepId === 'evaluation-cross-check') {
      if (!learningResultEvents.length) {
        return <p className="step-detail-empty">等待來源內容分析中…</p>;
      }
      return (
        <ul className="step-detail-list">
          {learningResultEvents.slice(-6).map((item, idx) => (
            <li key={`${item.query}-${idx}`}>
              {item.query}：提取 {item.learningsCount} 條事實，生成{' '}
              {item.followUpCount} 個追問
            </li>
          ))}
        </ul>
      );
    }

    if (stepId === 'synthesis') {
      const latest = [...stepEvents]
        .reverse()
        .find(event => event.step === 'synthesis' && event.detail);
      return latest ? (
        <p className="step-detail-empty">{latest.detail}</p>
      ) : (
        <p className="step-detail-empty">正在整合多輪研究輸出…</p>
      );
    }

    if (phase?.phase === 'writing') {
      return (
        <p className="step-detail-empty">
          已進入生成階段{viewMode === 'answer' ? '（答案）' : '（報告）'}
          ，內容會持續即時更新。
        </p>
      );
    }

    return <p className="step-detail-empty">等待進入報告生成階段…</p>;
  };

  return (
    <ResearchShellLayout
      activeJobId={activeJobId}
      selectedHistoryId={selectedHistoryId}
      onNewResearch={resetSession}
      onSelectJob={openJob}
      onSelectHistory={openHistory}
    >
      <main
        className={
          step === 'form'
            ? 'research-shell research-shell--form'
            : 'research-shell'
        }
      >
      {step !== 'form' && (
        <header className="research-shell-header">
          <div className="research-header-brand">
            <Link
              href="/"
              className="home-logo research-header-logo"
              aria-label="返回首頁"
            >
              OI
            </Link>
            <div>
              <h1 className="research-title">Deep Research</h1>
              <p className="research-subtitle">
                {query.trim() || '深度研究進行中'}
                <br />
                <span className="research-model-label">
                  模型：{RESEARCH_MODEL_LABELS[selectedModel]}
                  {(runningCount > 0 || pendingCount > 0) &&
                    ` · ${runningCount + pendingCount} 個任務進行中`}
                </span>
              </p>
            </div>
          </div>
          <Link href="/" className="research-back-link">
            ← 返回首頁
          </Link>
        </header>
      )}

      {(feedbackError || exportError || (error && !isFailed)) && (
        <div className="error-banner">
          {feedbackError ??
            exportError ??
            (error && !isFailed ? error.message : null)}
        </div>
      )}

      {step === 'form' && (
        <ResearchFormPanel
          query={query}
          onQueryChange={setQuery}
          intensity={intensity}
          onIntensityChange={setIntensity}
          model={selectedModel}
          onModelChange={setSelectedModel}
          outputLanguage={outputLanguage}
          onOutputLanguageChange={setOutputLanguage}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onSubmit={() => void handleFormNext()}
          loading={loadingFeedback}
          disabled={isLoading}
        />
      )}

      {step === 'followup' && (
        <section className="card">
          <p className="research-hint">回答以下問題以精準研究方向（可留空）</p>
          <form onSubmit={e => void handleFollowUpSubmit(e)}>
            {followUpQuestions.map((question, i) => (
              <div key={i} className="follow-up-item">
                <p>{question}</p>
                <textarea
                  value={followUpAnswers[i] ?? ''}
                  onChange={e =>
                    setFollowUpAnswers(prev => ({
                      ...prev,
                      [i]: e.target.value,
                    }))
                  }
                  rows={2}
                />
              </div>
            ))}
            <div className="actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setStep('form')}
              >
                返回
              </button>
              <button type="submit" className="primary" disabled={isLoading}>
                開始研究
              </button>
            </div>
          </form>
        </section>
      )}

      {step === 'history' && selectedHistoryEntry && (
        <section className="card report-body">
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>
            {selectedHistoryEntry.query}
          </h2>
          <p className="research-hint" style={{ marginTop: 0 }}>
            {new Date(selectedHistoryEntry.completedAt).toLocaleString('zh-TW')}{' '}
            · {RESEARCH_MODEL_LABELS[selectedHistoryEntry.model]} ·{' '}
            {selectedHistoryEntry.mode === 'report' ? '報告' : '答案'}
          </p>
          <ResearchMarkdownContent
            content={selectedHistoryEntry.content}
            mode={selectedHistoryEntry.mode}
          />
          <div className="actions" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                void navigator.clipboard.writeText(selectedHistoryEntry.content)
              }
            >
              複製
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                downloadTextFile(
                  selectedHistoryEntry.content,
                  markdownExportFilename(
                    selectedHistoryEntry.content,
                    selectedHistoryEntry.query,
                  ),
                  'text/markdown;charset=utf-8',
                )
              }
            >
              匯出 Markdown
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                removeHistoryEntry(selectedHistoryEntry.id);
                setSelectedHistoryId(null);
                setStep('form');
              }}
            >
              刪除紀錄
            </button>
            <button type="button" className="primary" onClick={resetSession}>
              新建研究
            </button>
          </div>
        </section>
      )}

      {step === 'result' && activeJob && (
        <>
          {isFailed && (
            <section className="card research-failed-banner" role="alert">
              <p className="research-failed-title">研究未完成</p>
              <p className="research-failed-message">
                {activeJob.error ?? '發生未知錯誤'}
              </p>
              <div className="actions" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setStep('form')}
                >
                  返回表單
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    dismissJob(activeJob.id);
                    setStep('form');
                  }}
                >
                  清除任務
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={resetSession}
                >
                  新研究
                </button>
              </div>
            </section>
          )}

          <section className="card">
            <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>研究階段</h2>
            <p
              className="research-hint"
              style={{ marginTop: 0, marginBottom: '0.75rem' }}
            >
              階段狀態僅供參考；整體進度請見下方「研究進度」。
            </p>
            <p className="progress-detail" style={{ marginTop: 0 }}>
              已完成 {stepsDoneCount}/{STEP_CONFIG.length} 個階段
            </p>
            <div className="stepper">
              {STEP_CONFIG.map(stepItem => {
                const status = stepStatus[stepItem.id];
                return (
                  <button
                    key={stepItem.id}
                    type="button"
                    className={`step-node ${status} ${expandedStep === stepItem.id ? 'expanded' : ''}`}
                    onClick={() => setExpandedStep(stepItem.id)}
                  >
                    <span className="step-orb" />
                    <span className="step-label">{stepItem.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="step-detail-panel">
              {renderStepDetails(expandedStep)}
            </div>
          </section>

          <section className="card thinking-feed">
            <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>即時思考動態</h2>
            <div className="feed-list" ref={feedRef}>
              {logEvents.length === 0 ? (
                <p className="step-detail-empty">等待研究事件流啟動…</p>
              ) : (
                logEvents.slice(-24).map((item, idx, arr) => {
                  const isLatest = idx === arr.length - 1 && isLoading;
                  return (
                    <div key={`${item.message}-${idx}`} className="feed-line">
                      <span className="feed-icon">{LOG_ICON[item.icon]}</span>
                      <TypewriterLine text={item.message} isActive={isLatest} />
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {(isLoading ||
            phaseLabel ||
            (progress && progress.totalQueries > 0)) && (
            <section className="card progress-block">
              <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>研究進度</h2>
              {phaseLabel && <p className="phase-label">{phaseLabel}</p>}
              {progress && progress.totalQueries > 0 ? (
                <>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="progress-detail">
                    查詢 {progress.completedQueries}/{progress.totalQueries} ·
                    深度 {progress.totalDepth - progress.currentDepth}/
                    {progress.totalDepth}
                    {progress.currentQuery ? ` · ${progress.currentQuery}` : ''}
                    {etaSeconds !== null ? ` · 預計還需 ${etaSeconds} 秒` : ''}
                  </p>
                </>
              ) : isLoading ? (
                <p className="research-hint">正在啟動研究…</p>
              ) : null}
            </section>
          )}

          {viewMode === 'answer' && (answerPart || isLoading) && (
            <section className="card">
              <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>答案</h2>
              {answerPart ? (
                <p className="answer-box">{answerPart.answer}</p>
              ) : (
                <p className="research-hint">等待答案內容…</p>
              )}
            </section>
          )}

          {viewMode === 'report' && (reportMarkdown || isLoading) && (
            <section className="card report-body">
              <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>報告</h2>
              {reportMarkdown ? (
                <ResearchMarkdownContent
                  content={reportMarkdown}
                  mode="report"
                />
              ) : (
                <p className="research-hint">等待報告內容…</p>
              )}
            </section>
          )}

          {sources && sources.urls.length > 0 && (
            <section className="card">
              <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>來源</h2>
              <ul className="sources-list">
                {sources.urls.map(url => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(isLoading || activeJob) && (
            <div className="actions" style={{ marginBottom: '0.5rem' }}>
              <button
                type="button"
                className="secondary"
                onClick={sendToBackground}
              >
                放到背景繼續
              </button>
            </div>
          )}

          {!isLoading && !isFailed && (reportMarkdown || answerPart) && (
            <div className="actions">
              <button
                type="button"
                className="secondary"
                onClick={() => void copyToClipboard()}
              >
                複製
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!!exporting}
                onClick={downloadMarkdown}
              >
                匯出 Markdown
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!!exporting}
                onClick={() => void downloadDocx()}
              >
                {exporting === 'docx' ? '匯出 Word 中…' : '匯出 Word (.docx)'}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!!exporting}
                onClick={() => void downloadPdf()}
              >
                {exporting === 'pdf' ? '匯出 PDF 中…' : '匯出 PDF (.pdf)'}
              </button>
              <button type="button" className="primary" onClick={resetSession}>
                新研究
              </button>
            </div>
          )}
        </>
      )}

    </main>
    </ResearchShellLayout>
  );
}
