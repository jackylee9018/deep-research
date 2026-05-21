'use client';

import Link from 'next/link';

import { HomePromptLayout } from './home-prompt-layout';
import {
  PromptPdfAttachmentChips,
  PromptPdfAttachmentToolbar,
} from './prompt-pdf-attachments';
import { PromptInput } from './prompt-input';
import { ResearchPromptToolbar } from './research-prompt-toolbar';
import type { PromptAttachment } from '../lib/prompt-attachments';
import {
  RESEARCH_INTENSITY_OPTIONS,
  type ResearchIntensity,
} from '../lib/research-intensity';
import type { ResearchModelId } from '../lib/research-models';

type ResearchFormPanelProps = {
  query: string;
  onQueryChange: (value: string) => void;
  intensity: ResearchIntensity;
  onIntensityChange: (value: ResearchIntensity) => void;
  model: ResearchModelId;
  onModelChange: (model: ResearchModelId) => void;
  attachments: PromptAttachment[];
  onAttachmentsChange: (attachments: PromptAttachment[]) => void;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function ResearchFormPanel({
  query,
  onQueryChange,
  intensity,
  onIntensityChange,
  model,
  onModelChange,
  attachments,
  onAttachmentsChange,
  onSubmit,
  loading = false,
  disabled = false,
}: ResearchFormPanelProps) {
  const intensityMeta = RESEARCH_INTENSITY_OPTIONS.find(
    option => option.id === intensity,
  );
  const submitBusy = loading || disabled;

  return (
    <HomePromptLayout
      title="Deep Research"
      description="迭代式深度研究 — 輸入主題後自動搜尋、分析並產出報告（可附加 PDF 參考）"
      topAction={
        <Link href="/" className="home-page-top-link" aria-label="返回首頁">
          ← 返回首頁
        </Link>
      }
      footer={
        <div className="research-form-meta">
          <ResearchPromptToolbar
            intensity={intensity}
            onIntensityChange={onIntensityChange}
            model={model}
            onModelChange={onModelChange}
            disabled={submitBusy}
          />

          {intensityMeta ? (
            <p className="research-intensity-hint">{intensityMeta.description}</p>
          ) : null}

          {loading ? (
            <p className="research-form-status" role="status">
              產生追問中…
            </p>
          ) : null}
        </div>
      }
    >
      <PromptPdfAttachmentChips
        attachments={attachments}
        onChange={onAttachmentsChange}
        disabled={submitBusy}
      />
      <PromptInput
        value={query}
        onChange={onQueryChange}
        onSubmit={onSubmit}
        disabled={submitBusy}
        placeholder="例如：2025 年固態電池商業化進展與主要玩家"
        toolbarLeft={
          <PromptPdfAttachmentToolbar
            attachments={attachments}
            onChange={onAttachmentsChange}
            disabled={submitBusy}
          />
        }
      />
    </HomePromptLayout>
  );
}
