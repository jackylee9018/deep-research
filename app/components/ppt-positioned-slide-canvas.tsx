'use client';

import type { BoxRect, DeckSlide, SlideBoxKey } from '../lib/ppt-types';

import { getEffectiveSlideBoxes, patchSlideBox } from '../lib/ppt-slide-boxes';
import { slideBoxRole } from '../lib/ppt-slide-box-role';
import { PptDraggableBox } from './ppt-draggable-box';

function linesToBullets(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function bulletsToLines(bullets: string[]): string {
  return bullets.join('\n');
}

function CanvasInput({
  value,
  onChange,
  className,
  placeholder,
  multiline = false,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  if (multiline) {
    return (
      <textarea
        className={className}
        value={value}
        placeholder={placeholder}
        rows={3}
        onChange={e => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      type="text"
      className={className}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
    />
  );
}

function Box({
  slide,
  boxKey,
  label,
  rect,
  onChange,
  draggable,
  children,
}: {
  slide: DeckSlide;
  boxKey: SlideBoxKey;
  label: string;
  rect: BoxRect;
  onChange: (slide: DeckSlide) => void;
  draggable: boolean;
  children: React.ReactNode;
}) {
  const role = slideBoxRole(boxKey);
  const updateRect = (next: BoxRect) => {
    onChange(patchSlideBox(slide, boxKey, next));
  };

  if (!draggable) {
    return (
      <div
        className={`ppt-drag-box ppt-drag-box--static ppt-drag-box--${role}`}
        style={{
          left: `${rect.x}%`,
          top: `${rect.y}%`,
          width: `${rect.w}%`,
          height: `${rect.h}%`,
        }}
      >
        <div className="ppt-drag-box-content">{children}</div>
      </div>
    );
  }

  return (
    <PptDraggableBox
      rect={rect}
      label={label}
      boxRole={role}
      onChange={updateRect}
    >
      {children}
    </PptDraggableBox>
  );
}

function SlideImageBox({
  slideIndex,
  jobId,
  rect,
  alt,
}: {
  slideIndex: number;
  jobId?: string;
  rect: BoxRect;
  alt?: string;
}) {
  const src = jobId
    ? `/api/ppt/media?jobId=${encodeURIComponent(jobId)}&slide=${slideIndex}`
    : undefined;

  return (
    <div
      className="ppt-drag-box ppt-drag-box--static ppt-drag-box--image"
      style={{
        left: `${rect.x}%`,
        top: `${rect.y}%`,
        width: `${rect.w}%`,
        height: `${rect.h}%`,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- job-scoped API URL
        <img className="ppt-canvas-slide-image" src={src} alt={alt ?? ''} />
      ) : (
        <span className="ppt-canvas-image-placeholder">配圖</span>
      )}
    </div>
  );
}

export function PptPositionedSlideCanvas({
  slide,
  onChange,
  draggable = true,
  jobId,
}: {
  slide: DeckSlide;
  onChange: (slide: DeckSlide) => void;
  draggable?: boolean;
  jobId?: string;
}) {
  const boxes = getEffectiveSlideBoxes(slide);
  const patch = (next: Partial<DeckSlide>) =>
    onChange({ ...slide, ...next } as DeckSlide);

  return (
    <div className="ppt-canvas-stage">
      <div
        className={`ppt-canvas-slide ppt-canvas-slide--positioned ppt-canvas-slide--layout-${slide.layoutId}${draggable ? '' : ' ppt-canvas-slide--readonly'}`}
        data-layout={slide.layoutId}
      >
        {draggable ? (
          <p className="ppt-canvas-position-hint">
            拖曳區塊移動 · 右下角調整大小
          </p>
        ) : null}

        {slide.layoutId === 'title' || slide.layoutId === 'section' ? (
          <>
            {boxes.title ? (
              <Box
                slide={slide}
                boxKey="title"
                label="標題"
                rect={boxes.title}
                onChange={onChange}
                draggable={draggable}
              >
                <CanvasInput
                  className={
                    slide.layoutId === 'title'
                      ? 'ppt-canvas-hero-title'
                      : 'ppt-canvas-section-title'
                  }
                  value={slide.title}
                  placeholder="標題"
                  onChange={title => patch({ title })}
                />
              </Box>
            ) : null}
            {boxes.subtitle ? (
              <Box
                slide={slide}
                boxKey="subtitle"
                label="副標"
                rect={boxes.subtitle}
                onChange={onChange}
                draggable={draggable}
              >
                <CanvasInput
                  className="ppt-canvas-hero-subtitle"
                  value={slide.subtitle ?? ''}
                  placeholder="副標題"
                  onChange={subtitle => patch({ subtitle: subtitle || undefined })}
                />
              </Box>
            ) : null}
          </>
        ) : null}

        {slide.layoutId === 'bullets' ? (
          <>
            {boxes.title ? (
              <Box
                slide={slide}
                boxKey="title"
                label="標題"
                rect={boxes.title}
                onChange={onChange}
                draggable={draggable}
              >
                <CanvasInput
                  className="ppt-canvas-slide-title"
                  value={slide.title}
                  placeholder="投影片標題"
                  onChange={title => patch({ title })}
                />
              </Box>
            ) : null}
            {boxes.body ? (
              <Box
                slide={slide}
                boxKey="body"
                label="內文"
                rect={boxes.body}
                onChange={onChange}
                draggable={draggable}
              >
                <textarea
                  className="ppt-canvas-bullets"
                  value={bulletsToLines(slide.bullets)}
                  placeholder="每行一個重點"
                  rows={5}
                  onChange={e => patch({ bullets: linesToBullets(e.target.value) })}
                />
              </Box>
            ) : null}
            {boxes.image ? (
              <SlideImageBox
                slideIndex={slide.index}
                jobId={jobId}
                rect={boxes.image}
                alt={
                  slide.layoutId === 'bullets' ? slide.image?.alt : undefined
                }
              />
            ) : null}
          </>
        ) : null}

        {slide.layoutId === 'two_column' ? (
          <>
            {boxes.title ? (
              <Box
                slide={slide}
                boxKey="title"
                label="標題"
                rect={boxes.title}
                onChange={onChange}
                draggable={draggable}
              >
                <CanvasInput
                  className="ppt-canvas-slide-title"
                  value={slide.title}
                  onChange={title => patch({ title })}
                />
              </Box>
            ) : null}
            {boxes.leftTitle ? (
              <Box
                slide={slide}
                boxKey="leftTitle"
                label="左欄標題"
                rect={boxes.leftTitle}
                onChange={onChange}
                draggable={draggable}
              >
                <CanvasInput
                  className="ppt-canvas-col-title"
                  value={slide.leftTitle}
                  onChange={leftTitle => patch({ leftTitle })}
                />
              </Box>
            ) : null}
            {boxes.leftBody ? (
              <Box
                slide={slide}
                boxKey="leftBody"
                label="左欄內容"
                rect={boxes.leftBody}
                onChange={onChange}
                draggable={draggable}
              >
                <textarea
                  className="ppt-canvas-bullets ppt-canvas-bullets--sm"
                  value={bulletsToLines(slide.leftBullets)}
                  rows={4}
                  onChange={e =>
                    patch({ leftBullets: linesToBullets(e.target.value) })
                  }
                />
              </Box>
            ) : null}
            {boxes.rightTitle ? (
              <Box
                slide={slide}
                boxKey="rightTitle"
                label="右欄標題"
                rect={boxes.rightTitle}
                onChange={onChange}
                draggable={draggable}
              >
                <CanvasInput
                  className="ppt-canvas-col-title"
                  value={slide.rightTitle}
                  onChange={rightTitle => patch({ rightTitle })}
                />
              </Box>
            ) : null}
            {boxes.rightBody ? (
              <Box
                slide={slide}
                boxKey="rightBody"
                label="右欄內容"
                rect={boxes.rightBody}
                onChange={onChange}
                draggable={draggable}
              >
                <textarea
                  className="ppt-canvas-bullets ppt-canvas-bullets--sm"
                  value={bulletsToLines(slide.rightBullets)}
                  rows={4}
                  onChange={e =>
                    patch({ rightBullets: linesToBullets(e.target.value) })
                  }
                />
              </Box>
            ) : null}
          </>
        ) : null}

        {slide.layoutId === 'quote' ? (
          <>
            {boxes.title ? (
              <Box
                slide={slide}
                boxKey="title"
                label="標籤"
                rect={boxes.title}
                onChange={onChange}
                draggable={draggable}
              >
                <CanvasInput
                  className="ppt-canvas-col-title"
                  value={slide.title ?? ''}
                  placeholder="選填標籤"
                  onChange={title => patch({ title: title || undefined })}
                />
              </Box>
            ) : null}
            {boxes.body ? (
              <Box
                slide={slide}
                boxKey="body"
                label="引文"
                rect={boxes.body}
                onChange={onChange}
                draggable={draggable}
              >
                <textarea
                  className="ppt-canvas-quote"
                  value={slide.quote}
                  rows={4}
                  onChange={e => patch({ quote: e.target.value })}
                />
              </Box>
            ) : null}
            {boxes.subtitle ? (
              <Box
                slide={slide}
                boxKey="subtitle"
                label="出處"
                rect={boxes.subtitle}
                onChange={onChange}
                draggable={draggable}
              >
                <CanvasInput
                  className="ppt-canvas-hero-subtitle"
                  value={slide.attribution ?? ''}
                  placeholder="出處"
                  onChange={attribution =>
                    patch({ attribution: attribution || undefined })
                  }
                />
              </Box>
            ) : null}
          </>
        ) : null}

        {slide.layoutId === 'stat' ? (
          <>
            {boxes.title ? (
              <Box
                slide={slide}
                boxKey="title"
                label="指標名稱"
                rect={boxes.title}
                onChange={onChange}
                draggable={draggable}
              >
                <CanvasInput
                  className="ppt-canvas-slide-title"
                  value={slide.title}
                  onChange={title => patch({ title })}
                />
              </Box>
            ) : null}
            {boxes.subtitle ? (
              <Box
                slide={slide}
                boxKey="subtitle"
                label="數值"
                rect={boxes.subtitle}
                onChange={onChange}
                draggable={draggable}
              >
                <CanvasInput
                  className="ppt-canvas-stat-value"
                  value={slide.value}
                  onChange={value => patch({ value })}
                />
              </Box>
            ) : null}
            {boxes.body ? (
              <Box
                slide={slide}
                boxKey="body"
                label="說明"
                rect={boxes.body}
                onChange={onChange}
                draggable={draggable}
              >
                <textarea
                  className="ppt-canvas-bullets"
                  value={
                    slide.context ??
                    (slide.bullets?.length ? bulletsToLines(slide.bullets) : '')
                  }
                  rows={3}
                  placeholder="補充說明或條列"
                  onChange={e => {
                    const lines = linesToBullets(e.target.value);
                    if (lines.length <= 1) {
                      patch({ context: lines[0], bullets: undefined });
                    } else {
                      patch({ context: undefined, bullets: lines });
                    }
                  }}
                />
              </Box>
            ) : null}
          </>
        ) : null}

        {slide.layoutId === 'closing' ? (
          <>
            {boxes.title ? (
              <Box
                slide={slide}
                boxKey="title"
                label="標題"
                rect={boxes.title}
                onChange={onChange}
                draggable={draggable}
              >
                <CanvasInput
                  className="ppt-canvas-slide-title"
                  value={slide.title}
                  onChange={title => patch({ title })}
                />
              </Box>
            ) : null}
            {boxes.subtitle ? (
              <Box
                slide={slide}
                boxKey="subtitle"
                label="副標"
                rect={boxes.subtitle}
                onChange={onChange}
                draggable={draggable}
              >
                <CanvasInput
                  className="ppt-canvas-hero-subtitle"
                  value={slide.subtitle ?? ''}
                  onChange={subtitle => patch({ subtitle: subtitle || undefined })}
                />
              </Box>
            ) : null}
            {boxes.body ? (
              <Box
                slide={slide}
                boxKey="body"
                label="內文"
                rect={boxes.body}
                onChange={onChange}
                draggable={draggable}
              >
                <textarea
                  className="ppt-canvas-bullets ppt-canvas-bullets--compact"
                  value={bulletsToLines(slide.bullets)}
                  rows={3}
                  onChange={e => patch({ bullets: linesToBullets(e.target.value) })}
                />
              </Box>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
