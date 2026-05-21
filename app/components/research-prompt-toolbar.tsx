'use client';

import { ResearchModelSelect } from './research-model-select';
import {
  RESEARCH_INTENSITY_OPTIONS,
  type ResearchIntensity,
} from '../lib/research-intensity';
import type { ResearchModelId } from '../lib/research-models';

export function ResearchPromptToolbar({
  intensity,
  onIntensityChange,
  model,
  onModelChange,
  disabled,
}: {
  intensity: ResearchIntensity;
  onIntensityChange: (value: ResearchIntensity) => void;
  model: ResearchModelId;
  onModelChange: (model: ResearchModelId) => void;
  disabled?: boolean;
}) {
  return (
    <div className="research-prompt-toolbar">
      <div
        className="research-intensity-group"
        role="group"
        aria-label="研究強度"
      >
        {RESEARCH_INTENSITY_OPTIONS.map(option => (
          <button
            key={option.id}
            type="button"
            className={
              intensity === option.id
                ? 'research-intensity-btn is-active'
                : 'research-intensity-btn'
            }
            aria-pressed={intensity === option.id}
            disabled={disabled}
            onClick={() => onIntensityChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <ResearchModelSelect
        id="research-form-model"
        variant="inline"
        value={model}
        onChange={onModelChange}
        disabled={disabled}
      />
    </div>
  );
}
