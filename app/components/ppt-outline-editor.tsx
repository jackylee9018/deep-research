'use client';

import { useEffect, useState } from 'react';

import { resolveOutlineComposition } from '@/ppt/composition/load-catalog';

import type { OutlineDeck, PptLayoutId } from '../lib/ppt-types';

type CompositionOption = {
  id: string;
  layoutId: PptLayoutId;
  label: string;
  whenToUse: string;
};

export function PptOutlineEditor({
  outline,
  onChange,
  disabled,
}: {
  outline: OutlineDeck;
  onChange: (outline: OutlineDeck) => void;
  disabled?: boolean;
}) {
  const [compositions, setCompositions] = useState<CompositionOption[]>([]);

  useEffect(() => {
    void fetch('/api/ppt/compositions', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.compositions?.length) {
          setCompositions(data.compositions);
        }
      })
      .catch(() => undefined);
  }, []);

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

  const onCompositionChange = (slideIndex: number, compositionId: string) => {
    const slide = outline.slides.find(s => s.index === slideIndex);
    if (!slide) {
      return;
    }
    const resolved = resolveOutlineComposition(
      compositionId,
      slideIndex - 1,
      outline.slides.length,
    );
    updateSlide(slideIndex, {
      compositionId: resolved.compositionId,
      layoutId: resolved.layoutId,
    });
  };

  return (
    <div className="ppt-outline-list">
      {outline.slides.map(slide => {
        const compositionId =
          slide.compositionId ??
          compositions.find(c => c.layoutId === slide.layoutId)?.id ??
          slide.layoutId;
        const activeComposition = compositions.find(c => c.id === compositionId);

        return (
          <section key={slide.index} className="ppt-outline-card">
            <div className="ppt-outline-card-header">
              <span>Slide {slide.index}</span>
              <select
                value={compositionId}
                disabled={disabled || compositions.length === 0}
                title={activeComposition?.whenToUse}
                onChange={e => onCompositionChange(slide.index, e.target.value)}
              >
                {compositions.length > 0 ? (
                  compositions.map(comp => (
                    <option key={comp.id} value={comp.id}>
                      {comp.label}
                    </option>
                  ))
                ) : (
                  <option value={slide.layoutId}>{slide.layoutId}</option>
                )}
              </select>
            </div>
            {activeComposition ? (
              <p className="ppt-outline-composition-hint">
                {activeComposition.whenToUse}
              </p>
            ) : null}

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
                rows={4}
                onChange={e => updateBulletSummary(slide.index, e.target.value)}
              />
            </label>
          </section>
        );
      })}
    </div>
  );
}
