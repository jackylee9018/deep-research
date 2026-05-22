'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import type { OutlineDeck } from '../lib/ppt-types';

import {
  PPT_PAGE_TEXT_OPTIONS,
  type PptPageTextPreset,
} from '../lib/ppt-page-text';
import {
  freeFormatTextToOutline,
  outlineToFreeFormatText,
} from '../lib/ppt-outline-format';
import type { ResearchModelId } from '../lib/research-models';
import { RESEARCH_MODEL_LABELS } from '../lib/research-models';
import { PptOutlineActivityBar } from './ppt-outline-activity-bar';
import { PptOutlineEditor } from './ppt-outline-editor';
import { PptTemplateSelect } from './ppt-template-select';
import { ResearchModelSelect } from './research-model-select';
import type { PptTemplateId } from '../lib/ppt-templates';

type ContentView = 'free' | 'slides';

type PptOutlineWorkspaceProps = {
  outline: OutlineDeck;
  /** Remounts only the center content editor when outline structure resets. */
  contentRevision?: number;
  onChange: (outline: OutlineDeck) => void;
  pageTextPreset: PptPageTextPreset;
  onPageTextPresetChange: (value: PptPageTextPreset) => void;
  model: ResearchModelId;
  onModelChange: (model: ResearchModelId) => void;
  pptTemplateId: PptTemplateId;
  onPptTemplateIdChange: (value: PptTemplateId) => void;
  additionalNotes: string;
  onAdditionalNotesChange: (value: string) => void;
  onRegenerateOutline: () => void;
  onGeneratePpt: () => void;
  onBack: () => void;
  busy?: boolean;
  generating?: boolean;
  outlineReady?: boolean;
  streamingFreeText?: string;
  streamingStatus?: string;
  error?: string;
  /** When set via PPT_OUTPUT_DIR, shown in settings as the save root. */
  pptOutputDir?: string | null;
  generationFeedback?: ReactNode;
};

function reindexSlides(slides: OutlineDeck['slides']): OutlineDeck['slides'] {
  return slides.map((slide, index) => ({ ...slide, index: index + 1 }));
}

export function PptOutlineWorkspace({
  outline,
  contentRevision = 0,
  onChange,
  pageTextPreset,
  onPageTextPresetChange,
  model,
  onModelChange,
  pptTemplateId,
  onPptTemplateIdChange,
  additionalNotes,
  onAdditionalNotesChange,
  onRegenerateOutline,
  onGeneratePpt,
  onBack,
  busy = false,
  generating = false,
  outlineReady = true,
  streamingFreeText,
  streamingStatus,
  error,
  pptOutputDir,
  generationFeedback,
}: PptOutlineWorkspaceProps) {
  const [contentView, setContentView] = useState<ContentView>('free');
  const [freeText, setFreeText] = useState(() => outlineToFreeFormatText(outline));
  const isStreaming = busy && streamingFreeText !== undefined;
  const displayFreeText = isStreaming ? streamingFreeText : freeText;

  const outlineActivityMessage = busy
    ? (streamingStatus?.trim() ||
        (isStreaming ? '正在撰寫大綱…' : '準備大綱中…'))
    : null;
  const showOutlineActivity = Boolean(outlineActivityMessage);
  const showPptGeneratingHint = generating && !busy;

  useEffect(() => {
    if (isStreaming) {
      setContentView('free');
    }
  }, [isStreaming]);

  useEffect(() => {
    if (!isStreaming) {
      setFreeText(outlineToFreeFormatText(outline));
    }
  }, [outline, isStreaming]);

  const updateOutline = (next: OutlineDeck) => {
    onChange(next);
    setFreeText(outlineToFreeFormatText(next));
  };

  const updateMeta = (patch: Partial<Pick<OutlineDeck, 'title' | 'audience' | 'tone'>>) => {
    updateOutline({ ...outline, ...patch });
  };

  const adjustSlideCount = (delta: number) => {
    const nextCount = outline.slides.length + delta;
    if (nextCount < 3 || nextCount > 15) {
      return;
    }

    let slides = [...outline.slides];
    if (delta > 0) {
      const last = slides[slides.length - 1]!;
      slides.push({
        index: slides.length + 1,
        layoutId: last.layoutId,
        headline: '新投影片',
        bulletSummary: ['待補內容'],
      });
    } else {
      slides = slides.slice(0, -1);
    }

    updateOutline({ ...outline, slides: reindexSlides(slides) });
  };

  const handleFreeTextChange = (value: string) => {
    setFreeText(value);
    onChange(freeFormatTextToOutline(outline, value));
  };

  const switchToFreeView = () => {
    setFreeText(outlineToFreeFormatText(outline));
    setContentView('free');
  };

  return (
    <div className="ppt-outline-workspace">
      <header className="ppt-outline-workspace-header">
        <button
          type="button"
          className="ppt-outline-back-btn"
          disabled={busy}
          onClick={onBack}
        >
          ← 返回
        </button>
        <h1 className="ppt-outline-workspace-title">大綱編輯器</h1>
        <span className="ppt-outline-header-spacer" aria-hidden />
      </header>

      {error ? <div className="error-banner ppt-outline-error">{error}</div> : null}

      <div className="ppt-outline-columns">
        <aside className="ppt-outline-col ppt-outline-col--settings">
          <div className="ppt-outline-col-head">
            <h2>設定</h2>
          </div>

          <div className="ppt-outline-panel">
            <p className="ppt-outline-panel-label">簡報標題</p>
            <input
              type="text"
              className="ppt-outline-title-input"
              value={outline.title}
              disabled={busy}
              onChange={e => updateMeta({ title: e.target.value })}
            />
          </div>

          <div className="ppt-outline-panel">
            <p className="ppt-outline-panel-label">頁面文字量</p>
            <div
              className="ppt-outline-text-amount"
              role="group"
              aria-label="頁面文字量"
            >
              {PPT_PAGE_TEXT_OPTIONS.map(option => (
                <button
                  key={option.id}
                  type="button"
                  className={
                    pageTextPreset === option.id
                      ? 'ppt-outline-text-amount-btn is-active'
                      : 'ppt-outline-text-amount-btn'
                  }
                  aria-pressed={pageTextPreset === option.id}
                  disabled={busy}
                  title={option.description}
                  onClick={() => onPageTextPresetChange(option.id)}
                >
                  <span className="ppt-outline-text-amount-label">
                    {option.label}
                  </span>
                  <span className="ppt-outline-text-amount-hint">
                    {option.shortHint}
                  </span>
                </button>
              ))}
            </div>
            <p className="ppt-outline-hint">
              變更後請按「重新產生大綱」套用新的每頁文字用量。
            </p>
          </div>

          <div className="ppt-outline-panel">
            <label className="ppt-outline-field">
              <span>寫給…</span>
              <textarea
                rows={3}
                placeholder="例如：部門主管、客戶決策者"
                value={outline.audience ?? ''}
                disabled={busy}
                onChange={e => updateMeta({ audience: e.target.value })}
              />
            </label>
          </div>

          <div className="ppt-outline-panel">
            <label className="ppt-outline-field">
              <span>語氣</span>
              <textarea
                rows={2}
                placeholder="例如：專業、精煉、具說服力"
                value={outline.tone ?? ''}
                disabled={busy}
                onChange={e => updateMeta({ tone: e.target.value })}
              />
            </label>
          </div>

          <div className="ppt-outline-panel">
            <label className="ppt-outline-field">
              <span>輸出語言</span>
              <select disabled={busy} defaultValue="zh-TW">
                <option value="zh-TW">繁體中文</option>
              </select>
            </label>
          </div>

          <div className="ppt-outline-panel">
            <p className="ppt-outline-panel-label">模型</p>
            <ResearchModelSelect
              id="ppt-outline-model"
              variant="inline"
              value={model}
              onChange={onModelChange}
              disabled={busy}
            />
            <p className="ppt-outline-hint">{RESEARCH_MODEL_LABELS[model]}</p>
          </div>

          {pptOutputDir ? (
            <div className="ppt-outline-panel">
              <p className="ppt-outline-panel-label">PPTX 輸出目錄</p>
              <p className="ppt-outline-hint ppt-output-dir-hint">
                已設定 <code>{pptOutputDir}</code>；每次生成會建立子資料夾{' '}
                <code>{'{jobId}/deck.pptx'}</code>。
              </p>
            </div>
          ) : null}

          <button
            type="button"
            className="ppt-outline-secondary-action"
            disabled={busy}
            onClick={onRegenerateOutline}
          >
            重新產生大綱
          </button>
        </aside>

        <section className="ppt-outline-col ppt-outline-col--content">
          <div className="ppt-outline-col-head">
            <h2>內容</h2>
            <div className="ppt-outline-view-toggle" role="group" aria-label="內容檢視">
              <button
                type="button"
                className={contentView === 'free' ? 'is-active' : undefined}
                disabled={busy}
                onClick={switchToFreeView}
              >
                自由格式
              </button>
              <button
                type="button"
                className={contentView === 'slides' ? 'is-active' : undefined}
                disabled={busy}
                onClick={() => setContentView('slides')}
              >
                逐頁編輯
              </button>
            </div>
          </div>

          {showOutlineActivity && outlineActivityMessage ? (
            <PptOutlineActivityBar
              message={outlineActivityMessage}
              hint={
                isStreaming
                  ? '內容將即時出現於下方，完成後可編輯'
                  : undefined
              }
            />
          ) : showPptGeneratingHint ? (
            <PptOutlineActivityBar
              variant="ppt"
              message="簡報生成中"
              hint="可繼續編輯大綱，完成後可下載"
            />
          ) : null}

          <div
            key={contentRevision}
            className={
              isStreaming
                ? 'ppt-outline-content-body ppt-outline-content-body--streaming'
                : 'ppt-outline-content-body'
            }
          >
            {contentView === 'free' ? (
              <div
                className={
                  isStreaming ? 'ppt-outline-free-text-wrap is-streaming' : 'ppt-outline-free-text-wrap'
                }
              >
                <textarea
                  className={
                    isStreaming
                      ? 'ppt-outline-free-text ppt-outline-free-text--streaming'
                      : 'ppt-outline-free-text'
                  }
                  value={displayFreeText}
                  readOnly={isStreaming}
                  disabled={busy && !isStreaming}
                  onChange={e => handleFreeTextChange(e.target.value)}
                  placeholder="每段第一行為投影片標題，其餘為條列重點…"
                />
                {isStreaming ? (
                  <span className="ppt-outline-stream-caret" aria-hidden>
                    ▋
                  </span>
                ) : null}
              </div>
            ) : (
              <PptOutlineEditor
                outline={outline}
                onChange={updateOutline}
                disabled={busy}
              />
            )}
          </div>
        </section>

        <aside className="ppt-outline-col ppt-outline-col--notes">
          <div className="ppt-outline-col-head">
            <h2>風格與說明</h2>
          </div>

          <div className="ppt-outline-panel ppt-outline-panel--templates">
            <PptTemplateSelect
              variant="rail"
              value={pptTemplateId}
              onChange={onPptTemplateIdChange}
              disabled={busy || generating}
            />
          </div>

          <label className="ppt-outline-field ppt-outline-notes-field">
            <span className="ppt-outline-field-label">附加說明</span>
            <span className="sr-only">附加說明</span>
            <textarea
              rows={6}
              placeholder="可補充風格、必須涵蓋的章節、禁忌用語等（選填）"
              value={additionalNotes}
              disabled={busy}
              onChange={e => onAdditionalNotesChange(e.target.value)}
            />
          </label>

          <div className="ppt-outline-tips">
            <h3>提示</h3>
            <p>
              在「自由格式」下，以空行分隔各頁；每段第一行為標題，其餘行為條列重點。
              切換至「逐頁編輯」可調整版型與各頁細節。
            </p>
            <p>
              確認大綱後，使用下方「生成 PPT」產出簡報檔案。
            </p>
          </div>

          <Link href="/" className="ppt-outline-home-link">
            ← 返回首頁
          </Link>
        </aside>
      </div>

      {generationFeedback}

      <div className="ppt-outline-dock" role="toolbar" aria-label="大綱操作">
        <div className="ppt-outline-dock-meta">
          <span className="ppt-outline-dock-icon" aria-hidden>
            ✦
          </span>
          <span>{outline.slides.length} 頁</span>
        </div>

        <div className="ppt-outline-dock-stepper">
          <button
            type="button"
            className="ppt-outline-dock-step"
            aria-label="減少一頁"
            disabled={busy || outline.slides.length <= 3}
            onClick={() => adjustSlideCount(-1)}
          >
            −
          </button>
          <span className="ppt-outline-dock-count">
            {outline.slides.length} 張投影片
          </span>
          <button
            type="button"
            className="ppt-outline-dock-step"
            aria-label="增加一頁"
            disabled={busy || outline.slides.length >= 15}
            onClick={() => adjustSlideCount(1)}
          >
            +
          </button>
        </div>

        <button
          type="button"
          className="ppt-outline-dock-generate"
          disabled={busy || generating || !outlineReady}
          onClick={onGeneratePpt}
        >
          <span aria-hidden>✦</span>
          {generating ? 'PPT 生成中…' : '生成 PPT'}
        </button>
      </div>
    </div>
  );
}
