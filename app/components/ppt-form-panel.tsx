'use client';

import Link from 'next/link';

import { HomePromptLayout } from './home-prompt-layout';
import {
  PromptPdfAttachmentChips,
  PromptPdfAttachmentToolbar,
} from './prompt-pdf-attachments';
import { PromptWebSearchToggle } from './prompt-web-search-toggle';
import { PromptInput } from './prompt-input';
import { PptPromptToolbar } from './ppt-prompt-toolbar';
import {
  PPT_PAGE_TEXT_OPTIONS,
  type PptPageTextPreset,
} from '../lib/ppt-page-text';
import type { PromptAttachment } from '../lib/prompt-attachments';
import type { ResearchModelId } from '../lib/research-models';

type PptFormPanelProps = {
  prompt: string;
  onPromptChange: (value: string) => void;
  pageTextPreset: PptPageTextPreset;
  onPageTextPresetChange: (value: PptPageTextPreset) => void;
  model: ResearchModelId;
  onModelChange: (model: ResearchModelId) => void;
  attachments: PromptAttachment[];
  onAttachmentsChange: (attachments: PromptAttachment[]) => void;
  onSubmit: () => void;
  webSearch: boolean;
  onWebSearchChange: (enabled: boolean) => void;
  webSearchAvailable?: boolean;
  loading?: boolean;
  disabled?: boolean;
  loadingStatus?: string;
};

export function PptFormPanel({
  prompt,
  onPromptChange,
  pageTextPreset,
  onPageTextPresetChange,
  model,
  onModelChange,
  attachments,
  onAttachmentsChange,
  onSubmit,
  webSearch,
  onWebSearchChange,
  webSearchAvailable = true,
  loading = false,
  disabled = false,
  loadingStatus = '產生大綱中…',
}: PptFormPanelProps) {
  const pageTextMeta = PPT_PAGE_TEXT_OPTIONS.find(
    option => option.id === pageTextPreset,
  );
  const submitBusy = loading || disabled;

  return (
    <HomePromptLayout
      title="生成 PPT"
      description="輸入簡報需求，可附加 PDF 參考；先產生可編輯大綱，確認後再生成簡報"
      topAction={
        <Link href="/" className="home-page-top-link" aria-label="返回首頁">
          ← 返回首頁
        </Link>
      }
      footer={
        <div className="research-form-meta">
          <PptPromptToolbar
            pageTextPreset={pageTextPreset}
            onPageTextPresetChange={onPageTextPresetChange}
            model={model}
            onModelChange={onModelChange}
            disabled={submitBusy}
          />

          {pageTextMeta ? (
            <p className="research-intensity-hint">{pageTextMeta.description}</p>
          ) : null}

          {loading ? (
            <p className="research-form-status" role="status">
              {loadingStatus}
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
        value={prompt}
        onChange={onPromptChange}
        onSubmit={onSubmit}
        disabled={submitBusy}
        showVoiceControls={false}
        submitAriaLabel="產生大綱"
        placeholder="例如：為主管做一份 AI 客服導入提案，包含現況、方案、效益與時程"
        toolbarLeft={
          <div className="prompt-toolbar-left">
            <PromptPdfAttachmentToolbar
              attachments={attachments}
              onChange={onAttachmentsChange}
              disabled={submitBusy}
            />
            <PromptWebSearchToggle
              enabled={webSearch}
              onChange={onWebSearchChange}
              disabled={submitBusy}
              available={webSearchAvailable}
            />
          </div>
        }
      />
    </HomePromptLayout>
  );
}
