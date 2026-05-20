'use client';

import { useChat } from '@ai-sdk/react';
import type { JSONValue } from 'ai';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {
  docxExportFilename,
  markdownExportFilename,
  pdfExportFilename,
} from '@/export-report';
import { normalizeReportMarkdown } from '@/normalize-report-markdown';
import type { FollowUpEntry } from '@/research-query';

import {
  downloadBlob,
  downloadTextFile,
  fetchDocxExport,
  fetchPdfExport,
} from '../lib/client-export';

const reportMarkdownComponents: Components = {
  table: ({ children, ...props }) => (
    <div className="table-wrap">
      <table {...props}>{children}</table>
    </div>
  ),
};

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
  | { type: 'step'; step: ResearchStepId; status: Exclude<StepStatus, 'pending'>; detail?: string }
  | { type: 'log'; icon: 'search' | 'brain' | 'link' | 'check'; message: string }
  | { type: 'query-plan'; queries: string[] }
  | { type: 'search-result'; query: string; urls: string[]; resultCount: number }
  | {
      type: 'learning-result';
      query: string;
      learningsCount: number;
      followUpCount: number;
    };

const STEP_CONFIG: Array<{ id: ResearchStepId; label: string }> = [
  { id: 'query-analysis', label: 'Query Analysis' },
  { id: 'web-search', label: 'Web & Source Search' },
  { id: 'evaluation-cross-check', label: 'Evaluation & Cross-Check' },
  { id: 'synthesis', label: 'Synthesis' },
  { id: 'report-generation', label: 'Report Generation' },
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

function TypewriterLine({ text, isActive }: { text: string; isActive: boolean }) {
  const [visibleLength, setVisibleLength] = useState(isActive ? 0 : text.length);

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
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Open Deep Research';
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [breadth, setBreadth] = useState(4);
  const [depth, setDepth] = useState(2);
  const [mode, setMode] = useState<Mode>('report');
  const [step, setStep] = useState<'form' | 'followup' | 'result'>('form');
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<number, string>>({});
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'md' | 'docx' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<ResearchStepId>('query-analysis');
  const [researchStartedAt, setResearchStartedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const feedRef = useRef<HTMLDivElement>(null);

  const [chatId, setChatId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    void fetch('/api/model')
      .then(res => res.json())
      .then(json => {
        if (typeof json.model === 'string') {
          const extra =
            Array.isArray(json.providers) && json.providers.length
              ? ` · ${json.providers.join(' → ')}`
              : '';
          setModelLabel(`${json.model}${extra}`);
        }
      })
      .catch(() => setModelLabel(null));
  }, []);

  const { messages, data, isLoading, error, append, setMessages, setData } = useChat({
    id: chatId,
    api: '/api/research',
    streamProtocol: 'data',
  });

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
    () => parsedData.filter((part): part is Extract<StreamDataPart, { type: 'step' }> => part.type === 'step'),
    [parsedData],
  );
  const logEvents = useMemo(
    () => parsedData.filter((part): part is Extract<StreamDataPart, { type: 'log' }> => part.type === 'log'),
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
    () => parsedData.filter((part): part is ProgressData => part.type === 'progress'),
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
    if (phase?.phase === 'writing' && initial['report-generation'] === 'pending') {
      initial['report-generation'] = 'active';
    }
    return initial;
  }, [phase?.phase, stepEvents]);
  const stepPercent = useMemo(() => {
    const doneCount = STEP_CONFIG.filter(step => stepStatus[step.id] === 'done').length;
    return Math.round((doneCount / STEP_CONFIG.length) * 100);
  }, [stepStatus]);
  const etaSeconds = useMemo(() => {
    if (!researchStartedAt || !progress?.totalQueries || progress.completedQueries <= 0) {
      return null;
    }
    const elapsed = Math.max(1, (nowTick - researchStartedAt) / 1000);
    const avgPerQuery = elapsed / progress.completedQueries;
    const remainingQueries = Math.max(0, progress.totalQueries - progress.completedQueries);
    return Math.max(0, Math.round(avgPerQuery * remainingQueries));
  }, [nowTick, progress?.completedQueries, progress?.totalQueries, researchStartedAt]);

  const reportMarkdown = useMemo(() => {
    const assistant = [...messages].reverse().find(m => m.role === 'assistant');
    const raw = assistant?.content ?? '';
    return normalizeReportMarkdown(raw);
  }, [messages]);

  const fullMarkdown = reportMarkdown + sourcesMarkdown(sources?.urls ?? []);

  const exportContent = mode === 'answer' ? (answerPart?.answer ?? '') : fullMarkdown;
  const exportFallbackTitle = query.trim() || 'research';

  const progressPercent = useMemo(() => {
    if (!progress?.totalQueries) {
      return 0;
    }
    return Math.round((progress.completedQueries / progress.totalQueries) * 100);
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
    setChatId(crypto.randomUUID());
    setMessages([]);
    setData(undefined);
    setStep('form');
    setFollowUpQuestions([]);
    setFollowUpAnswers({});
    setFeedbackError(null);
    setExportError(null);
    setExpandedStep('query-analysis');
    setResearchStartedAt(null);
  }, [setMessages, setData]);

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
        body: JSON.stringify({ query: query.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? 'Failed to load questions');
      }
      setFollowUpQuestions(json.questions ?? []);
      setStep('followup');
    } catch (e) {
      setFeedbackError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingFeedback(false);
    }
  };

  const startResearch = async (followUp?: FollowUpEntry[]) => {
    if (!query.trim()) {
      return;
    }
    setStep('result');
    setMessages([]);
    setData(undefined);
    setExpandedStep('query-analysis');
    setResearchStartedAt(Date.now());
    await append(
      { role: 'user', content: query.trim() },
      {
        body: {
          query: query.trim(),
          breadth,
          depth,
          mode,
          followUp,
        },
      },
    );
  };

  const handleFormNext = async () => {
    if (mode === 'report') {
      await loadFollowUp();
    } else {
      await startResearch();
    }
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const followUp: FollowUpEntry[] = followUpQuestions.map((question, i) => ({
      question,
      answer: followUpAnswers[i]?.trim() ?? '',
    }));
    await startResearch(followUp);
  };

  const downloadMarkdown = () => {
    if (!exportContent) {
      return;
    }
    setExportError(null);
    const filename =
      mode === 'answer'
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
        mode === 'answer'
          ? docxExportFilename(exportContent, `${exportFallbackTitle}-answer`)
          : docxExportFilename(exportContent, exportFallbackTitle);
      const blob = await fetchDocxExport(
        exportContent,
        mode === 'answer' ? `${exportFallbackTitle}-answer` : exportFallbackTitle,
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
        mode === 'answer'
          ? pdfExportFilename(exportContent, `${exportFallbackTitle}-answer`)
          : pdfExportFilename(exportContent, exportFallbackTitle);
      const blob = await fetchPdfExport(
        exportContent,
        mode === 'answer' ? `${exportFallbackTitle}-answer` : exportFallbackTitle,
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
              {item.query}：提取 {item.learningsCount} 條事實，生成 {item.followUpCount} 個追問
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
          已進入生成階段{mode === 'answer' ? '（答案）' : '（報告）'}，內容會持續即時更新。
        </p>
      );
    }

    return <p className="step-detail-empty">等待進入報告生成階段…</p>;
  };

  return (
    <main className="research-shell">
      <header className="research-shell-header">
        <div className="research-header-brand">
          <Link href="/" className="home-logo research-header-logo" aria-label="返回首頁">
            OI
          </Link>
          <div>
            <h1 className="research-title">{appName}</h1>
            <p className="research-subtitle">
              迭代式深度研究 — 輸入主題後自動搜尋、分析並產出報告
              {modelLabel ? (
                <>
                  <br />
                  <span className="research-model-label">模型：{modelLabel}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <Link href="/" className="research-back-link">
          ← 返回首頁
        </Link>
      </header>

      {(error || feedbackError || exportError) && (
        <div className="error-banner">{error?.message ?? feedbackError ?? exportError}</div>
      )}

      {step === 'form' && (
        <section className="card">
          <label htmlFor="query">研究主題</label>
          <textarea
            id="query"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="例如：2025 年固態電池商業化進展與主要玩家"
            rows={3}
          />

          <div className="row" style={{ marginTop: '1rem' }}>
            <div>
              <label htmlFor="breadth">廣度 (breadth)</label>
              <input
                id="breadth"
                type="number"
                min={1}
                max={10}
                value={breadth}
                onChange={e => setBreadth(Number(e.target.value) || 4)}
              />
            </div>
            <div>
              <label htmlFor="depth">深度 (depth)</label>
              <input
                id="depth"
                type="number"
                min={1}
                max={5}
                value={depth}
                onChange={e => setDepth(Number(e.target.value) || 2)}
              />
            </div>
          </div>

          <label style={{ marginTop: '1rem' }}>輸出模式</label>
          <div className="mode-toggle">
            <button
              type="button"
              className={mode === 'report' ? 'active' : ''}
              onClick={() => setMode('report')}
            >
              長篇報告
            </button>
            <button
              type="button"
              className={mode === 'answer' ? 'active' : ''}
              onClick={() => setMode('answer')}
            >
              簡短答案
            </button>
          </div>

          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={!query.trim() || loadingFeedback}
              onClick={() => void handleFormNext()}
            >
              {loadingFeedback
                ? '產生追問中…'
                : mode === 'report'
                  ? '下一步：釐清需求'
                  : '開始研究'}
            </button>
          </div>
        </section>
      )}

      {step === 'followup' && (
        <section className="card">
          <p className="research-hint">
            回答以下問題以精準研究方向（可留空）
          </p>
          <form onSubmit={e => void handleFollowUpSubmit(e)}>
            {followUpQuestions.map((question, i) => (
              <div key={i} className="follow-up-item">
                <p>{question}</p>
                <textarea
                  value={followUpAnswers[i] ?? ''}
                  onChange={e =>
                    setFollowUpAnswers(prev => ({ ...prev, [i]: e.target.value }))
                  }
                  rows={2}
                />
              </div>
            ))}
            <div className="actions">
              <button type="button" className="secondary" onClick={() => setStep('form')}>
                返回
              </button>
              <button type="submit" className="primary" disabled={isLoading}>
                開始研究
              </button>
            </div>
          </form>
        </section>
      )}

      {step === 'result' && (
        <>
          <section className="card">
            <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>研究流程</h2>
            <div className="stepper-progress">
              <div className="stepper-progress-fill" style={{ width: `${stepPercent}%` }} />
            </div>
            <p className="progress-detail" style={{ marginTop: '0.5rem' }}>
              流程完成度 {stepPercent}% {etaSeconds !== null ? ` · 預計還需 ${etaSeconds} 秒` : ''}
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
            <div className="step-detail-panel">{renderStepDetails(expandedStep)}</div>
          </section>

          <section className="card thinking-feed">
            <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Live Thinking Feed</h2>
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

          {(isLoading || phaseLabel) && (
            <section className="card progress-block">
              {phaseLabel && <p className="phase-label">{phaseLabel}</p>}
              {progress && progress.totalQueries > 0 && (
                <>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="progress-detail">
                    查詢 {progress.completedQueries}/{progress.totalQueries} · 深度{' '}
                    {progress.totalDepth - progress.currentDepth}/{progress.totalDepth}
                    {progress.currentQuery ? ` · ${progress.currentQuery}` : ''}
                    {etaSeconds !== null ? ` · 預計還需 ${etaSeconds} 秒` : ''}
                  </p>
                </>
              )}
            </section>
          )}

          {mode === 'answer' && answerPart && (
            <section className="card">
              <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>答案</h2>
              <p className="answer-box">{answerPart.answer}</p>
            </section>
          )}

          {mode === 'report' && (reportMarkdown || isLoading) && (
            <section className="card report-body">
              <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>報告</h2>
              {reportMarkdown ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={reportMarkdownComponents}
                >
                  {reportMarkdown}
                </ReactMarkdown>
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

          {!isLoading && (reportMarkdown || answerPart) && (
            <div className="actions">
              <button type="button" className="secondary" onClick={() => void copyToClipboard()}>
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
  );
}
