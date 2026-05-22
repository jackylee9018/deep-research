'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';

import {
  DEFAULT_TEMPLATE_THEME,
  templateThemeCssVars,
  type PptTemplateThemeColors,
} from '../lib/ppt-template-theme';
import type { DeckPlan, DeckSlide } from '../lib/ppt-types';

import { clearSlideBoxes } from '../lib/ppt-slide-boxes';
import { PptSlideCanvas } from './ppt-slide-canvas';
import { PptSlideThumbnail } from './ppt-slide-thumbnail';

const LAYOUT_LABELS: Record<DeckSlide['layoutId'], string> = {
  title: '封面',
  section: '章節',
  bullets: '條列',
  two_column: '雙欄',
  quote: '引用',
  stat: '數據',
  closing: '結尾',
};

type EditorTool = 'text' | 'bullets' | 'columns';

function updateSlide(
  plan: DeckPlan,
  slideIndex: number,
  patch: Partial<DeckSlide>,
): DeckPlan {
  return {
    ...plan,
    slides: plan.slides.map(slide =>
      slide.index === slideIndex ? ({ ...slide, ...patch } as DeckSlide) : slide,
    ),
  };
}

function ToolButton({
  label,
  title,
  active,
  onClick,
  children,
}: {
  label: string;
  title: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`ppt-studio-tool${active ? ' is-active' : ''}`}
      title={title}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function PptPreviewStudio({
  deckPlan,
  onChange,
  saveStatus,
  onExport,
  exporting,
  onBack,
  onRedownload,
  pptxAvailable,
  readOnly = false,
  templateId = 'default',
  templateTheme,
  jobId,
}: {
  deckPlan: DeckPlan;
  onChange: (plan: DeckPlan) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onExport: () => void;
  exporting: boolean;
  onBack: () => void;
  onRedownload?: string;
  pptxAvailable?: boolean;
  /** While PPT content is still generating on the server. */
  readOnly?: boolean;
  templateId?: string;
  /** Slide gradient + accent colors from templates/registry.json */
  templateTheme?: PptTemplateThemeColors;
  jobId?: string;
}) {
  const themeVars = templateThemeCssVars(
    templateTheme ?? DEFAULT_TEMPLATE_THEME,
  );
  const [activeIndex, setActiveIndex] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [tool, setTool] = useState<EditorTool>('text');

  const slides = deckPlan.slides;
  const activeSlide =
    slides.find(s => s.index === activeIndex) ?? slides[0] ?? null;

  const goToSlide = useCallback(
    (index: number) => {
      if (index >= 1 && index <= slides.length) {
        setActiveIndex(index);
      }
    },
    [slides.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (presenting) {
        if (e.key === 'Escape') {
          setPresenting(false);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          goToSlide(Math.min(activeIndex + 1, slides.length));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          goToSlide(Math.max(activeIndex - 1, 1));
        }
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        goToSlide(Math.min(activeIndex + 1, slides.length));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        goToSlide(Math.max(activeIndex - 1, 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, goToSlide, presenting, slides.length]);

  const saveLabel =
    saveStatus === 'saving'
      ? '儲存中…'
      : saveStatus === 'saved'
        ? '已儲存'
        : saveStatus === 'error'
          ? '儲存失敗'
          : null;

  return (
    <div
      className={`ppt-studio${presenting ? ' ppt-studio--present' : ''}${readOnly ? ' ppt-studio--readonly' : ''}`}
      data-ppt-template={templateId}
      style={themeVars}
    >
      <header className="ppt-studio-topbar">
        <div className="ppt-studio-topbar-left">
          <button
            type="button"
            className="ppt-studio-icon-btn"
            title={sidebarOpen ? '收合側欄' : '展開側欄'}
            onClick={() => setSidebarOpen(open => !open)}
          >
            ☰
          </button>
          <button type="button" className="ppt-studio-back" onClick={onBack}>
            ←
          </button>
          <input
            type="text"
            className="ppt-studio-deck-title"
            value={deckPlan.title}
            aria-label="簡報標題"
            readOnly={readOnly}
            onChange={e =>
              readOnly
                ? undefined
                : onChange({ ...deckPlan, title: e.target.value })
            }
          />
          {saveLabel ? (
            <span className="ppt-studio-save-badge">{saveLabel}</span>
          ) : null}
        </div>
        <div className="ppt-studio-topbar-right">
          <span className="ppt-studio-meta">
            {activeIndex} / {slides.length}
          </span>
          {pptxAvailable && onRedownload ? (
            <a className="ppt-studio-btn ppt-studio-btn--ghost" href={onRedownload} download>
              再次下載
            </a>
          ) : null}
          <button
            type="button"
            className="ppt-studio-btn ppt-studio-btn--ghost"
            onClick={() => setPresenting(true)}
          >
            ▶ 展示
          </button>
          <button
            type="button"
            className="ppt-studio-btn ppt-studio-btn--primary"
            disabled={exporting || readOnly}
            onClick={onExport}
          >
            {exporting ? '匯出中…' : '匯出 PPTX'}
          </button>
        </div>
      </header>

      <div className="ppt-studio-body">
        {sidebarOpen ? (
          <aside className="ppt-studio-rail ppt-studio-rail--left" aria-label="投影片清單">
            <div className="ppt-studio-rail-head">
              <span>投影片</span>
              <span className="ppt-studio-rail-count">{slides.length}</span>
            </div>
            <div className="ppt-studio-thumbs">
              {slides.map(slide => (
                <PptSlideThumbnail
                  key={slide.index}
                  slide={slide}
                  selected={slide.index === activeIndex}
                  onSelect={() => setActiveIndex(slide.index)}
                />
              ))}
            </div>
          </aside>
        ) : null}

        <section className="ppt-studio-stage" aria-label="投影片編輯區">
          {activeSlide ? (
            <>
              <div className="ppt-studio-stage-toolbar">
                <span className="ppt-studio-layout-pill">
                  {LAYOUT_LABELS[activeSlide.layoutId]}
                </span>
                <span className="ppt-studio-stage-hint">
                  {readOnly
                    ? '內容生成中，完成後可編輯'
                    : '拖曳區塊調整位置 · 右下角縮放 · 匯出 PPTX 會套用座標'}
                </span>
                {!readOnly ? (
                  <button
                    type="button"
                    className="ppt-studio-btn ppt-studio-btn--ghost ppt-studio-reset-layout"
                    onClick={() =>
                      onChange(
                        updateSlide(
                          deckPlan,
                          activeSlide.index,
                          clearSlideBoxes(activeSlide),
                        ),
                      )
                    }
                  >
                    重設版面
                  </button>
                ) : null}
              </div>
              <PptSlideCanvas
                slide={activeSlide}
                readOnly={readOnly}
                positionedLayout
                jobId={jobId}
                onChange={next =>
                  readOnly
                    ? undefined
                    : onChange(updateSlide(deckPlan, activeSlide.index, next))
                }
              />
            </>
          ) : null}
        </section>

        <aside className="ppt-studio-rail ppt-studio-rail--right" aria-label="編輯工具">
          <ToolButton
            label="文字"
            title="編輯標題與內文"
            active={tool === 'text'}
            onClick={() => setTool('text')}
          >
            <span className="ppt-studio-tool-icon">Aa</span>
          </ToolButton>
          <ToolButton
            label="條列"
            title="條列式投影片"
            active={tool === 'bullets'}
            onClick={() => setTool('bullets')}
          >
            <span className="ppt-studio-tool-icon">≡</span>
          </ToolButton>
          <ToolButton
            label="雙欄"
            title="雙欄式投影片"
            active={tool === 'columns'}
            onClick={() => setTool('columns')}
          >
            <span className="ppt-studio-tool-icon">▥</span>
          </ToolButton>
          <div className="ppt-studio-tool-spacer" />
          <p className="ppt-studio-tool-tip">
            {tool === 'text'
              ? '編輯標題、副標題'
              : tool === 'bullets'
                ? '條列頁：每行一個重點'
                : '雙欄頁：左右欄分別編輯'}
          </p>
        </aside>
      </div>

      {presenting && activeSlide ? (
        <div
          className="ppt-studio-present-overlay"
          role="dialog"
          aria-label="展示模式"
        >
          <button
            type="button"
            className="ppt-studio-present-close"
            onClick={() => setPresenting(false)}
          >
            結束展示 Esc
          </button>
          <div className="ppt-studio-present-slide">
            <PptSlideCanvas
              slide={activeSlide}
              onChange={() => {}}
              readOnly
              jobId={jobId}
            />
          </div>
          <div className="ppt-studio-present-nav">
            <button
              type="button"
              disabled={activeIndex <= 1}
              onClick={() => goToSlide(activeIndex - 1)}
            >
              上一頁
            </button>
            <span>
              {activeIndex} / {slides.length}
            </span>
            <button
              type="button"
              disabled={activeIndex >= slides.length}
              onClick={() => goToSlide(activeIndex + 1)}
            >
              下一頁
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
