'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PptPreviewStudio } from '../../components/ppt-preview-studio';
import {
  PptProgressPanel,
  type PptProgressPhase,
} from '../../components/ppt-progress-panel';
import { usePptJobs } from '../../components/ppt-jobs-provider';
import { findPptJobByServerId } from '../../lib/ppt-client-jobs';
import {
  fetchPptTemplateOptions,
  resolvePptTemplateOption,
  type ClientPptTemplateOption,
} from '../../lib/ppt-templates';
import { outlineToSkeletonDeckPlan } from '../../lib/ppt-deck-plan-skeleton';
import type { DeckPlan, ValidationIssue } from '../../lib/ppt-types';
import type { PptJobPhase } from '../../lib/ppt-client-jobs';

type PreviewPayload = {
  jobId: string;
  deckPlan: DeckPlan;
  downloadUrl: string;
  slideCount: number;
  readyCount: number;
  contentReady: boolean;
  pptxAvailable: boolean;
};

const PREVIEW_POLL_MS = 1200;
/** Stop polling after ~15 minutes to avoid endless 404 spam. */
const PREVIEW_POLL_MAX_ATTEMPTS = 450;

function mapJobPhase(phase: PptJobPhase | undefined): PptProgressPhase {
  if (!phase || phase === 'idle') {
    return 'planning';
  }
  return phase;
}

export default function PptPreviewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('jobId')?.trim() ?? '';
  const { jobs } = usePptJobs();

  const matchedJob = useMemo(
    () => (jobId ? findPptJobByServerId(jobs, jobId) : undefined),
    [jobId, jobs],
  );

  const isGenerating =
    matchedJob?.status === 'running' || matchedJob?.status === 'pending';
  const jobFailed = matchedJob?.status === 'failed';

  const skeletonPlan = useMemo(
    () =>
      matchedJob?.outline
        ? outlineToSkeletonDeckPlan(matchedJob.outline)
        : null,
    [matchedJob?.outline],
  );

  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [deckPlan, setDeckPlan] = useState<DeckPlan | null>(null);
  const [contentReady, setContentReady] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | undefined>();
  const [exportIssues, setExportIssues] = useState<ValidationIssue[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);
  const pollAttempts = useRef(0);
  const [templateOptions, setTemplateOptions] = useState<ClientPptTemplateOption[]>(
    [],
  );

  useEffect(() => {
    void fetchPptTemplateOptions().then(setTemplateOptions);
  }, []);

  const fetchPreview = useCallback(async (): Promise<
    'pending' | 'partial' | 'ready'
  > => {
    if (!jobId) {
      throw new Error('缺少 jobId，無法載入預覽。');
    }

    const res = await fetch(
      `/api/ppt/preview?jobId=${encodeURIComponent(jobId)}`,
      { cache: 'no-store' },
    );

    if (res.status === 404) {
      return 'pending';
    }

    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(json.error ?? `無法載入預覽（HTTP ${res.status}）`);
    }

    const data = (await res.json()) as PreviewPayload;
    setPayload(data);
    setDeckPlan(data.deckPlan);
    setReadyCount(data.readyCount);
    if (data.contentReady) {
      setContentReady(true);
      skipNextSave.current = true;
      return 'ready';
    }
    return data.readyCount > 0 ? 'partial' : 'partial';
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setError('缺少 jobId，無法載入預覽。');
      setLoading(false);
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    pollAttempts.current = 0;

    const stopPollingWithError = (message: string) => {
      if (!skeletonPlan) {
        setDeckPlan(null);
      }
      setError(message);
      setLoading(false);
    };

    const poll = async () => {
      if (cancelled) {
        return;
      }

      if (jobFailed) {
        setLoading(false);
        if (!skeletonPlan) {
          setError(matchedJob?.error ?? 'PPT 生成失敗');
        }
        return;
      }

      pollAttempts.current += 1;
      if (pollAttempts.current > PREVIEW_POLL_MAX_ATTEMPTS) {
        stopPollingWithError('等待預覽逾時，請重新生成簡報。');
        return;
      }

      try {
        const status = await fetchPreview();
        if (cancelled) {
          return;
        }
        if (status === 'ready') {
          setLoading(false);
          return;
        }

        if (status === 'partial') {
          setLoading(false);
        }

        if (matchedJob?.status === 'completed' && status === 'pending') {
          stopPollingWithError(
            '伺服器上找不到預覽內容，請回到 PPT 頁重新生成。',
          );
          return;
        }
      } catch (e) {
        if (cancelled) {
          return;
        }
        if (!skeletonPlan) {
          setError(e instanceof Error ? e.message : String(e));
          setDeckPlan(null);
          setLoading(false);
          return;
        }
      }

      setLoading(false);
      if (!cancelled) {
        pollTimer = setTimeout(() => {
          void poll();
        }, PREVIEW_POLL_MS);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
    };
  }, [
    jobId,
    skeletonPlan,
    jobFailed,
    matchedJob?.error,
    matchedJob?.status,
    fetchPreview,
  ]);

  useEffect(() => {
    if (skeletonPlan && isGenerating && !contentReady) {
      setDeckPlan(skeletonPlan);
      setLoading(false);
      setError(undefined);
    }
  }, [skeletonPlan, isGenerating, contentReady]);

  const persistDeckPlan = useCallback(
    async (plan: DeckPlan) => {
      if (!jobId || !contentReady) {
        return;
      }
      setSaveStatus('saving');
      try {
        const res = await fetch('/api/ppt/preview', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, deckPlan: plan }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(json.error ?? `儲存失敗（HTTP ${res.status}）`);
        }
        setSaveStatus('saved');
      } catch (e) {
        setSaveStatus('error');
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [jobId, contentReady],
  );

  useEffect(() => {
    if (!deckPlan || !jobId || !contentReady) {
      return;
    }
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(() => {
      void persistDeckPlan(deckPlan);
    }, 700);
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [deckPlan, jobId, contentReady, persistDeckPlan]);

  const handleExport = async () => {
    if (!deckPlan || !jobId || !contentReady) {
      return;
    }
    setExporting(true);
    setExportError(undefined);
    setExportIssues([]);

    try {
      const res = await fetch('/api/ppt/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, deckPlan }),
      });
      const json = (await res.json()) as {
        downloadUrl?: string;
        error?: string;
        issues?: ValidationIssue[];
      };
      if (!res.ok) {
        setExportIssues(json.issues ?? []);
        throw new Error(json.error ?? `匯出失敗（HTTP ${res.status}）`);
      }
      if (json.downloadUrl) {
        setPayload(prev =>
          prev
            ? { ...prev, pptxAvailable: true, downloadUrl: json.downloadUrl! }
            : prev,
        );
        window.location.assign(json.downloadUrl);
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  if (!jobId) {
    return (
      <div className="ppt-studio ppt-studio--loading">
        <div className="card ppt-preview-error">
          <p className="error-banner">缺少 jobId，無法載入預覽。</p>
          <Link className="ppt-outline-secondary-action" href="/ppt">
            回到 PPT
          </Link>
        </div>
      </div>
    );
  }

  if (loading && !deckPlan) {
    return (
      <div className="ppt-studio ppt-studio--loading">
        <p className="research-hint">載入預覽中…</p>
      </div>
    );
  }

  if (error && !deckPlan) {
    return (
      <div className="ppt-studio ppt-studio--loading">
        <div className="card ppt-preview-error">
          <p className="error-banner">{error}</p>
          <Link className="ppt-outline-secondary-action" href="/ppt">
            回到 PPT
          </Link>
        </div>
      </div>
    );
  }

  if (!deckPlan) {
    return null;
  }

  const showGeneratingBar = isGenerating && !contentReady;
  const previewTemplateId =
    deckPlan.templateId ?? matchedJob?.templateId ?? 'default';
  const previewTemplate = resolvePptTemplateOption(
    previewTemplateId,
    templateOptions.length > 0 ? templateOptions : undefined,
  );

  return (
    <>
      {exportError ? (
        <div className="ppt-studio-toast-error" role="alert">
          {exportError}
        </div>
      ) : null}
      {exportIssues.length > 0 ? (
        <div className="ppt-studio-toast-error" role="alert">
          <ul className="ppt-outline-result-issues">
            {exportIssues.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>
                {issue.slideIndex != null ? `第 ${issue.slideIndex} 頁：` : ''}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {jobFailed && !contentReady ? (
        <div className="ppt-studio-toast-error" role="alert">
          {matchedJob?.error ?? 'PPT 生成失敗'}
        </div>
      ) : null}
      <PptPreviewStudio
        deckPlan={deckPlan}
        jobId={jobId}
        onChange={setDeckPlan}
        saveStatus={contentReady ? saveStatus : 'idle'}
        onExport={() => void handleExport()}
        exporting={exporting}
        onBack={() => router.push('/ppt')}
        pptxAvailable={payload?.pptxAvailable}
        onRedownload={payload?.downloadUrl}
        readOnly={!contentReady}
        templateId={previewTemplate.previewTheme}
        templateTheme={previewTemplate}
      />
      {showGeneratingBar ? (
        <div
          className="ppt-preview-generating-dock"
          role="region"
          aria-label="PPT 生成進度"
        >
          <PptProgressPanel
            phase={mapJobPhase(matchedJob?.phase)}
            attempt={matchedJob?.attempt ?? 0}
            maxAttempts={matchedJob?.maxAttempts ?? 3}
            logs={matchedJob?.logs ?? []}
            issues={matchedJob?.issues ?? []}
            slideCount={matchedJob?.slideCount ?? deckPlan.slides.length}
            readySlideCount={
              matchedJob?.readySlideCount ?? readyCount
            }
          />
        </div>
      ) : null}
    </>
  );
}
