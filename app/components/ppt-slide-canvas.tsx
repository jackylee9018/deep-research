'use client';

import type { DeckSlide } from '../lib/ppt-types';

import { PptPositionedSlideCanvas } from './ppt-positioned-slide-canvas';

function linesToBullets(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function bulletsToLines(bullets: string[]): string {
  return bullets.join('\n');
}

function SlideReadOnlyContent({ slide }: { slide: DeckSlide }) {
  if (slide.layoutId === 'title' || slide.layoutId === 'section') {
    return (
      <div className="ppt-canvas-body ppt-canvas-body--center">
        <h2 className="ppt-canvas-hero-title">{slide.title}</h2>
        {slide.subtitle ? (
          <p className="ppt-canvas-hero-subtitle">{slide.subtitle}</p>
        ) : null}
      </div>
    );
  }
  if (slide.layoutId === 'bullets') {
    return (
      <div className="ppt-canvas-body">
        <h2 className="ppt-canvas-slide-title">{slide.title}</h2>
        <ul className="ppt-canvas-bullets-readonly">
          {slide.bullets.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (slide.layoutId === 'two_column') {
    return (
      <div className="ppt-canvas-body">
        <h2 className="ppt-canvas-slide-title">{slide.title}</h2>
        <div className="ppt-canvas-two-col">
          <div className="ppt-canvas-col">
            <h3 className="ppt-canvas-col-title">{slide.leftTitle}</h3>
            <ul className="ppt-canvas-bullets-readonly">
              {slide.leftBullets.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="ppt-canvas-col">
            <h3 className="ppt-canvas-col-title">{slide.rightTitle}</h3>
            <ul className="ppt-canvas-bullets-readonly">
              {slide.rightBullets.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }
  if (slide.layoutId === 'quote') {
    return (
      <div className="ppt-canvas-body">
        {slide.title ? (
          <p className="ppt-canvas-col-title">{slide.title}</p>
        ) : null}
        <p className="ppt-canvas-quote">{slide.quote}</p>
        {slide.attribution ? (
          <p className="ppt-canvas-hero-subtitle">{slide.attribution}</p>
        ) : null}
      </div>
    );
  }
  if (slide.layoutId === 'stat') {
    return (
      <div className="ppt-canvas-body">
        <h2 className="ppt-canvas-slide-title">{slide.title}</h2>
        <p className="ppt-canvas-stat-value">{slide.value}</p>
        {slide.context ? (
          <p className="ppt-canvas-hero-subtitle">{slide.context}</p>
        ) : null}
        {slide.bullets?.length ? (
          <ul className="ppt-canvas-bullets-readonly">
            {slide.bullets.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  return (
    <div className="ppt-canvas-body ppt-canvas-body--center">
      <h2 className="ppt-canvas-slide-title">{slide.title}</h2>
      {'subtitle' in slide && slide.subtitle ? (
        <p className="ppt-canvas-hero-subtitle">{slide.subtitle}</p>
      ) : null}
      {'bullets' in slide ? (
        <ul className="ppt-canvas-bullets-readonly">
          {slide.bullets.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function PptSlideCanvas({
  slide,
  onChange,
  readOnly = false,
  positionedLayout = true,
  jobId,
}: {
  slide: DeckSlide;
  onChange: (slide: DeckSlide) => void;
  readOnly?: boolean;
  /** Enable drag-to-position blocks (preview editor). */
  positionedLayout?: boolean;
  jobId?: string;
}) {
  if (positionedLayout) {
    return (
      <PptPositionedSlideCanvas
        slide={slide}
        onChange={onChange}
        draggable={!readOnly}
        jobId={jobId}
      />
    );
  }

  if (readOnly) {
    return (
      <div className="ppt-canvas-stage">
        <div className="ppt-canvas-slide ppt-canvas-slide--readonly">
          <SlideReadOnlyContent slide={slide} />
        </div>
      </div>
    );
  }

  return (
    <PptPositionedSlideCanvas
      slide={slide}
      onChange={onChange}
      draggable
      jobId={jobId}
    />
  );
}
