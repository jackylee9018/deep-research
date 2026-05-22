'use client';

import type { DeckSlide } from '../lib/ppt-types';

const LAYOUT_SHORT: Record<DeckSlide['layoutId'], string> = {
  title: '封面',
  section: '章節',
  bullets: '條列',
  two_column: '雙欄',
  quote: '引用',
  stat: '數據',
  closing: '結尾',
};

function ThumbnailContent({ slide }: { slide: DeckSlide }) {
  if (slide.layoutId === 'title' || slide.layoutId === 'section') {
    return (
      <>
        <span className="ppt-thumb-line ppt-thumb-line--title">{slide.title}</span>
        {slide.subtitle ? (
          <span className="ppt-thumb-line ppt-thumb-line--sub">{slide.subtitle}</span>
        ) : null}
      </>
    );
  }
  if (slide.layoutId === 'bullets') {
    return (
      <>
        <span className="ppt-thumb-line ppt-thumb-line--title">{slide.title}</span>
        <span className="ppt-thumb-line">{slide.bullets[0]}</span>
      </>
    );
  }
  if (slide.layoutId === 'two_column') {
    return (
      <>
        <span className="ppt-thumb-line ppt-thumb-line--title">{slide.title}</span>
        <span className="ppt-thumb-line">{slide.leftTitle} / {slide.rightTitle}</span>
      </>
    );
  }
  if (slide.layoutId === 'quote') {
    return (
      <>
        <span className="ppt-thumb-line ppt-thumb-line--title">{slide.quote}</span>
        {slide.attribution ? (
          <span className="ppt-thumb-line">{slide.attribution}</span>
        ) : null}
      </>
    );
  }
  if (slide.layoutId === 'stat') {
    return (
      <>
        <span className="ppt-thumb-line ppt-thumb-line--title">{slide.value}</span>
        <span className="ppt-thumb-line">{slide.title}</span>
      </>
    );
  }
  return (
    <>
      <span className="ppt-thumb-line ppt-thumb-line--title">{slide.title}</span>
      {'bullets' in slide ? (
        <span className="ppt-thumb-line">{slide.bullets[0]}</span>
      ) : null}
    </>
  );
}

export function PptSlideThumbnail({
  slide,
  selected,
  onSelect,
}: {
  slide: DeckSlide;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`ppt-thumb-item${selected ? ' is-active' : ''}`}
      onClick={onSelect}
      aria-label={`第 ${slide.index} 頁：${slide.title}`}
      aria-current={selected ? 'true' : undefined}
    >
      <span className="ppt-thumb-index">{slide.index}</span>
      <span className="ppt-thumb-frame">
        <span className="ppt-thumb-layout">{LAYOUT_SHORT[slide.layoutId]}</span>
        <ThumbnailContent slide={slide} />
      </span>
    </button>
  );
}
