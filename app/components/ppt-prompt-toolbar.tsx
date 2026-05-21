'use client';

import { ResearchModelSelect } from './research-model-select';
import {
  PPT_PAGE_TEXT_OPTIONS,
  type PptPageTextPreset,
} from '../lib/ppt-page-text';
import type { ResearchModelId } from '../lib/research-models';

export function PptPromptToolbar({
  pageTextPreset,
  onPageTextPresetChange,
  model,
  onModelChange,
  disabled,
}: {
  pageTextPreset: PptPageTextPreset;
  onPageTextPresetChange: (value: PptPageTextPreset) => void;
  model: ResearchModelId;
  onModelChange: (model: ResearchModelId) => void;
  disabled?: boolean;
}) {
  return (
    <div className="research-prompt-toolbar">
      <div
        className="research-intensity-group"
        role="group"
        aria-label="頁面文字量"
      >
        {PPT_PAGE_TEXT_OPTIONS.map(option => (
          <button
            key={option.id}
            type="button"
            className={
              pageTextPreset === option.id
                ? 'research-intensity-btn is-active'
                : 'research-intensity-btn'
            }
            aria-pressed={pageTextPreset === option.id}
            disabled={disabled}
            title={option.description}
            onClick={() => onPageTextPresetChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <ResearchModelSelect
        id="ppt-form-model"
        variant="inline"
        value={model}
        onChange={onModelChange}
        disabled={disabled}
      />
    </div>
  );
}
