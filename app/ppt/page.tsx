'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { PptFormPanel } from '../components/ppt-form-panel';
import { PptGenerationFeedback } from '../components/ppt-generation-feedback';
import { PptOutlineWorkspace } from '../components/ppt-outline-workspace';
import { PptShellLayout } from '../components/ppt-shell-layout';
import { usePptJobs } from '../components/ppt-jobs-provider';
import {
  createPlaceholderOutline,
  freeFormatTextToOutline,
  outlineToFreeFormatText,
} from '../lib/ppt-outline-format';
import { runPptOutlineStream } from '../lib/ppt-outline-stream';
import {
  DEFAULT_PPT_OUTLINE_SLIDE_COUNT,
  DEFAULT_PPT_PAGE_TEXT_PRESET,
  type PptPageTextPreset,
} from '../lib/ppt-page-text';
import type { PromptAttachment } from '../lib/prompt-attachments';
import type { OutlineDeck } from '../lib/ppt-types';
import { pptPreviewPath } from '../lib/ppt-job-id';
import { resolveHistoryPreviewUrl } from '../lib/ppt-history';
import {
  DEFAULT_RESEARCH_MODEL,
  loadSelectedModel,
  RESEARCH_MODEL_LABELS,
  saveSelectedModel,
  type ResearchModelId,
} from '../lib/research-models';
import {
  type PptTemplateId,
} from '../lib/ppt-templates';

type PptStep = 'form' | 'workflow' | 'history';

export default function PptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPrompt = useMemo(
    () => searchParams.get('q') ?? '',
    [searchParams],
  );

  const {
    jobs,
    history,
    activeJob,
    activeJobId,
    setActiveJobId,
    enqueueJob,
    cancelActiveJobs,
    dismissJob,
    removeHistoryEntry,
  } = usePptJobs();

  const [progressDismissed, setProgressDismissed] = useState(false);
  const [resultDismissed, setResultDismissed] = useState(false);

  const [step, setStep] = useState<PptStep>('form');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null,
  );
  const [prompt, setPrompt] = useState(initialPrompt);
  const [pageTextPreset, setPageTextPreset] = useState<PptPageTextPreset>(
    DEFAULT_PPT_PAGE_TEXT_PRESET,
  );
  const [model, setModel] = useState<ResearchModelId>(DEFAULT_RESEARCH_MODEL);
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  const [outline, setOutline] = useState<OutlineDeck | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [streamingFreeText, setStreamingFreeText] = useState('');
  const [outlineStatus, setOutlineStatus] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [outlineRevision, setOutlineRevision] = useState(0);
  const [outlineReady, setOutlineReady] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [webSearchAvailable, setWebSearchAvailable] = useState(true);
  const [pptOutputDir, setPptOutputDir] = useState<string | null>(null);
  const [pptTemplateId, setPptTemplateId] = useState<PptTemplateId>('default');

  const outlineAbortRef = useRef<AbortController | null>(null);
  const placeholderRef = useRef<OutlineDeck | null>(null);
  const previewNavigatedForJob = useRef<string | null>(null);

  const selectedHistoryEntry = useMemo(
    () => history.find(entry => entry.id === selectedHistoryId),
    [history, selectedHistoryId],
  );

  useEffect(() => {
    setModel(loadSelectedModel());
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/app-config', { cache: 'no-store' });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as {
          webSearchAvailable?: boolean;
          pptOutputDir?: string | null;
        };
        if (typeof data.webSearchAvailable === 'boolean') {
          setWebSearchAvailable(data.webSearchAvailable);
          if (!data.webSearchAvailable) {
            setWebSearch(false);
          }
        }
        if (typeof data.pptOutputDir === 'string' && data.pptOutputDir.trim()) {
          setPptOutputDir(data.pptOutputDir);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    return () => {
      outlineAbortRef.current?.abort();
    };
  }, []);

  const generating =
    activeJob?.status === 'running' || activeJob?.status === 'pending';

  useEffect(() => {
    if (step !== 'workflow' || !activeJob?.serverJobId) {
      return;
    }
    if (activeJob.status !== 'running' && activeJob.status !== 'pending') {
      return;
    }
    if (previewNavigatedForJob.current === activeJob.id) {
      return;
    }
    previewNavigatedForJob.current = activeJob.id;
    router.push(pptPreviewPath(activeJob.serverJobId));
  }, [activeJob, router, step]);

  const updateModel = (next: ResearchModelId) => {
    setModel(next);
    saveSelectedModel(next);
  };

  const resetToForm = useCallback(() => {
    outlineAbortRef.current?.abort();
    outlineAbortRef.current = null;
    cancelActiveJobs();
    setSelectedHistoryId(null);
    setActiveJobId(null);
    setStep('form');
    setOutline(null);
    setStreamingFreeText('');
    setError(undefined);
    setOutlineLoading(false);
    setOutlineReady(false);
    setProgressDismissed(false);
    setResultDismissed(false);
    placeholderRef.current = null;
  }, [cancelActiveJobs, setActiveJobId]);

  const openJob = useCallback(
    (jobId: string) => {
      const job = jobs.find(item => item.id === jobId);
      if (!job) {
        return;
      }

      setSelectedHistoryId(null);
      setActiveJobId(jobId);
      setPrompt(job.prompt);
      setOutline(job.outline);
      setModel(job.model);
      setAttachments(job.attachments ?? []);
      setOutlineReady(true);
      setOutlineRevision(rev => rev + 1);
      setProgressDismissed(false);
      setResultDismissed(false);
      setError(undefined);
      setStep('workflow');
    },
    [jobs, setActiveJobId],
  );

  const openHistory = useCallback(
    (entryId: string) => {
      setActiveJobId(null);
      setSelectedHistoryId(entryId);
      setStep('history');
      setProgressDismissed(false);
      setResultDismissed(false);
    },
    [setActiveJobId],
  );

  const generateOutline = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError('請先輸入簡報需求。');
      return;
    }

    outlineAbortRef.current?.abort();
    const controller = new AbortController();
    outlineAbortRef.current = controller;

    const placeholder = createPlaceholderOutline(
      trimmed,
      DEFAULT_PPT_OUTLINE_SLIDE_COUNT,
    );
    placeholderRef.current = placeholder;

    cancelActiveJobs();
    setProgressDismissed(false);
    setResultDismissed(false);
    setSelectedHistoryId(null);
    setActiveJobId(null);

    setError(undefined);
    setStreamingFreeText('');
    setOutlineStatus('');
    setOutline(placeholder);
    setOutlineReady(false);
    setOutlineLoading(true);
    setStep('workflow');

    let streamFailed = false;

    try {
      await runPptOutlineStream(
        {
          prompt: trimmed,
          pageTextPreset,
          model,
          attachments,
          webSearch,
        },
        {
          onStatus: message => {
            setOutlineStatus(message);
          },
          onText: text => {
            setStreamingFreeText(text);
            const base = placeholderRef.current ?? placeholder;
            setOutline(freeFormatTextToOutline(base, text));
          },
          onOutline: finalOutline => {
            setOutline(finalOutline);
            setOutlineRevision(rev => rev + 1);
            setStreamingFreeText('');
            setOutlineStatus('');
            setOutlineReady(true);
          },
          onError: message => {
            streamFailed = true;
            setError(message);
          },
        },
        controller.signal,
      );

      if (controller.signal.aborted || streamFailed) {
        return;
      }

      setOutlineReady(true);
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (!controller.signal.aborted) {
        setOutlineLoading(false);
        setStreamingFreeText('');
        setOutlineStatus('');
      }
    }
  };

  const generatePpt = () => {
    if (!outline || outlineLoading || !outlineReady) {
      return;
    }

    setProgressDismissed(false);
    setResultDismissed(false);
    setError(undefined);
    setSelectedHistoryId(null);
    previewNavigatedForJob.current = null;

    enqueueJob({
      prompt: prompt.trim(),
      outline,
      model,
      attachments,
      templateId: pptTemplateId,
    });
  };

  const showGenerationFeedback =
    activeJob &&
    !resultDismissed &&
    step === 'workflow' &&
    (activeJob.status === 'failed' ||
      activeJob.status === 'running' ||
      activeJob.status === 'pending');

  return (
    <PptShellLayout
      activeJobId={activeJobId}
      selectedHistoryId={selectedHistoryId}
      onNewPpt={resetToForm}
      onSelectJob={openJob}
      onSelectHistory={openHistory}
    >
      {step === 'form' ? (
        <main className="research-shell research-shell--form">
          {error ? <div className="error-banner">{error}</div> : null}
          <PptFormPanel
            prompt={prompt}
            onPromptChange={setPrompt}
            pageTextPreset={pageTextPreset}
            onPageTextPresetChange={setPageTextPreset}
            model={model}
            onModelChange={updateModel}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            webSearch={webSearch}
            onWebSearchChange={setWebSearch}
            webSearchAvailable={webSearchAvailable}
            onSubmit={() => void generateOutline()}
            loading={false}
            disabled={false}
          />
        </main>
      ) : step === 'history' && selectedHistoryEntry ? (
        <main className="research-shell ppt-workflow-shell">
          <section className="card ppt-history-view">
            <header className="ppt-history-view-header">
              <div>
                <h1 className="ppt-history-view-title">
                  {selectedHistoryEntry.outlineTitle}
                </h1>
                <p className="ppt-history-view-meta">
                  {new Date(selectedHistoryEntry.completedAt).toLocaleString(
                    'zh-TW',
                  )}
                  {' · '}
                  {RESEARCH_MODEL_LABELS[selectedHistoryEntry.model]}
                  {selectedHistoryEntry.slideCount != null
                    ? ` · ${selectedHistoryEntry.slideCount} 頁`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                className="ppt-outline-back-btn"
                onClick={() => {
                  setSelectedHistoryId(null);
                  setStep('form');
                }}
              >
                ← 返回
              </button>
            </header>

            <p className="ppt-history-view-prompt">{selectedHistoryEntry.prompt}</p>

            <div className="ppt-outline-result-actions">
              <Link
                className="ppt-download ppt-download--primary"
                href={resolveHistoryPreviewUrl(selectedHistoryEntry)}
              >
                預覽與編輯
              </Link>
              {selectedHistoryEntry.downloadUrl ? (
                <a
                  className="ppt-download"
                  href={selectedHistoryEntry.downloadUrl}
                  download
                >
                  下載 PPTX
                </a>
              ) : null}
            </div>

            <textarea
              className="ppt-outline-free-text ppt-history-view-outline"
              value={outlineToFreeFormatText(selectedHistoryEntry.outline)}
              readOnly
              rows={16}
            />

            <div className="ppt-history-view-actions">
              <button
                type="button"
                className="ppt-outline-secondary-action"
                onClick={() => {
                  setPrompt(selectedHistoryEntry.prompt);
                  setOutline(selectedHistoryEntry.outline);
                  setModel(selectedHistoryEntry.model);
                  setOutlineReady(true);
                  setOutlineRevision(rev => rev + 1);
                  setSelectedHistoryId(null);
                  setStep('workflow');
                }}
              >
                以此大綱繼續編輯
              </button>
              <button
                type="button"
                className="ppt-outline-secondary-action"
                onClick={() => {
                  removeHistoryEntry(selectedHistoryEntry.id);
                  setSelectedHistoryId(null);
                  setStep('form');
                }}
              >
                刪除紀錄
              </button>
            </div>
          </section>
        </main>
      ) : !outline ? (
        <main className="research-shell ppt-workflow-shell">
          <p className="research-hint">載入大綱中…</p>
        </main>
      ) : (
        <main className="research-shell ppt-workflow-shell">
          <PptOutlineWorkspace
            key={outlineRevision}
            outline={outline}
            onChange={setOutline}
            pageTextPreset={pageTextPreset}
            onPageTextPresetChange={setPageTextPreset}
            model={model}
            onModelChange={updateModel}
            pptTemplateId={pptTemplateId}
            onPptTemplateIdChange={setPptTemplateId}
            additionalNotes={additionalNotes}
            onAdditionalNotesChange={setAdditionalNotes}
            onRegenerateOutline={() => void generateOutline()}
            onGeneratePpt={generatePpt}
            onBack={resetToForm}
            busy={outlineLoading}
            generating={generating}
            outlineReady={outlineReady}
            streamingFreeText={
              outlineLoading ? streamingFreeText : undefined
            }
            streamingStatus={outlineLoading ? outlineStatus : undefined}
            error={error}
            pptOutputDir={pptOutputDir}
            generationFeedback={
              showGenerationFeedback ? (
                <PptGenerationFeedback
                  status={activeJob.status}
                  phase={activeJob.phase}
                  attempt={activeJob.attempt}
                  maxAttempts={activeJob.maxAttempts}
                  logs={activeJob.logs}
                  issues={activeJob.issues}
                  error={activeJob.error}
                  slideCount={activeJob.slideCount}
                  readySlideCount={activeJob.readySlideCount}
                  progressDismissed={progressDismissed}
                  onDismissProgress={() => setProgressDismissed(true)}
                  onDismissResult={() => {
                    setResultDismissed(true);
                    dismissJob(activeJob.id);
                  }}
                />
              ) : null
            }
          />
        </main>
      )}
    </PptShellLayout>
  );
}
