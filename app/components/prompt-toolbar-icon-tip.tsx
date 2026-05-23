'use client';

import type { ReactNode } from 'react';

/**
 * Wraps a toolbar icon control with a visible hover/focus tooltip (in addition to native title).
 */
export function PromptToolbarIconTip({
  tip,
  children,
  placement = 'right',
}: {
  tip: string;
  children: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <span
      className={`prompt-toolbar-tip-wrap prompt-toolbar-tip-wrap--${placement}`}
      data-tip={tip}
    >
      {children}
      <span className="prompt-toolbar-tip" role="tooltip">
        {tip}
      </span>
    </span>
  );
}
