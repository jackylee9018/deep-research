'use client';

import {
  PPT_LAYOUT_IDS,
  type OutlineDeck,
  type PptLayoutId,
} from '../lib/ppt-types';

export function PptOutlineEditor({
  outline,
  onChange,
  disabled,
}: {
  outline: OutlineDeck;
  onChange: (outline: OutlineDeck) => void;
  disabled?: boolean;
}) {
  const updateSlide = (
    slideIndex: number,
    patch: Partial<OutlineDeck['slides'][number]>,
  ) => {
    onChange({
      ...outline,
      slides: outline.slides.map(slide =>
        slide.index === slideIndex ? { ...slide, ...patch } : slide,
      ),
    });
  };

  const updateBulletSummary = (slideIndex: number, value: string) => {
    const bullets = value
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 5);
    updateSlide(slideIndex, {
      bulletSummary: bullets.length ? bullets : ['待補內容'],
    });
  };

  return (
    <div className="ppt-outline-list">
      {outline.slides.map(slide => (
        <section key={slide.index} className="ppt-outline-card">
          <div className="ppt-outline-card-header">
            <span>Slide {slide.index}</span>
            <select
              value={slide.layoutId}
              disabled={disabled}
              onChange={e =>
                updateSlide(slide.index, {
                  layoutId: e.target.value as PptLayoutId,
                })
              }
            >
              {PPT_LAYOUT_IDS.map(layoutId => (
                <option key={layoutId} value={layoutId}>
                  {layoutId}
                </option>
              ))}
            </select>
          </div>

          <label>
            標題
            <input
              type="text"
              value={slide.headline}
              disabled={disabled}
              onChange={e =>
                updateSlide(slide.index, { headline: e.target.value })
              }
            />
          </label>

          <label>
            內容摘要（一行一點）
            <textarea
              value={slide.bulletSummary.join('\n')}
              disabled={disabled}
              onChange={e => updateBulletSummary(slide.index, e.target.value)}
            />
          </label>
        </section>
      ))}
    </div>
  );
}
