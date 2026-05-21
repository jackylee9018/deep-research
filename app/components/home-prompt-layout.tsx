'use client';

import type { ReactNode } from 'react';

export type HomePromptLayoutProps = {
  /** Custom hero block (e.g. Hello header). Overrides title/description. */
  header?: ReactNode;
  title?: string;
  description?: string;
  /** Shared prompt input — use `<PromptInput />`. */
  children: ReactNode;
  /** Content below the input (home feature cards, research options, etc.). */
  footer?: ReactNode;
  /** Top-right action, e.g. back link on /research. */
  topAction?: ReactNode;
};

/**
 * Centered home-style column: hero title + prompt slot + optional footer.
 * Used by `/` and `/research` form step so both pages share the same shell.
 */
export function HomePromptLayout({
  header,
  title,
  description,
  children,
  footer,
  topAction,
}: HomePromptLayoutProps) {
  return (
    <div className="home-page">
      {topAction ? <div className="home-page-top-action">{topAction}</div> : null}
      <div className="home-inner">
        <div className="home-main-column">
          <div className="home-above-prompt">
            {header ??
              (title ? (
                <div className="owui-placeholder-hero">
                  <div className="owui-placeholder-title-row">
                    <h1 className="owui-placeholder-title">
                      <span className="owui-placeholder-title-text">{title}</span>
                    </h1>
                  </div>
                  {description ? (
                    <div className="owui-placeholder-desc-wrap">
                      <p className="owui-placeholder-desc">{description}</p>
                    </div>
                  ) : null}
                </div>
              ) : null)}
          </div>

          <div className="home-prompt-slot">{children}</div>

          <div className="home-below-prompt">{footer}</div>
        </div>
      </div>
    </div>
  );
}
