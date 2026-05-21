'use client';

import { PromptToolbarIconTip } from './prompt-toolbar-icon-tip';

export function PromptWebSearchToggle({
  enabled,
  onChange,
  disabled = false,
  available = true,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
  available?: boolean;
}) {
  const unavailable = !available;
  const isDisabled = disabled || unavailable;

  const title = unavailable
    ? '聯網搜尋未設定（需 TAVILY_API_KEY）'
    : enabled
      ? '已啟用聯網搜尋（產生大綱時搜尋網路）'
      : '啟用聯網搜尋（產生大綱時搜尋網路）';

  return (
    <PromptToolbarIconTip tip={title}>
      <button
        type="button"
        className={
          enabled && !isDisabled
            ? 'owui-toolbar-icon-btn prompt-web-search-btn is-active'
            : 'owui-toolbar-icon-btn prompt-web-search-btn'
        }
        aria-label="聯網搜尋"
        aria-pressed={enabled && !unavailable}
        disabled={isDisabled}
        title={title}
        onClick={() => {
          if (!isDisabled) {
            onChange(!enabled);
          }
        }}
      >
        <GlobeIcon />
      </button>
    </PromptToolbarIconTip>
  );
}

function GlobeIcon() {
  return (
    <svg
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      className="owui-icon-plus"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.959 8.959 0 0 1 3 12c0-.778.099-1.533.284-2.253M3 12a17.919 17.919 0 0 0 8.716 2.247"
      />
    </svg>
  );
}
