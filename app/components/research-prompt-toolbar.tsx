'use client';

import { ResearchModelSelect } from './research-model-select';
import {
  RESEARCH_INTENSITY_OPTIONS,
  type ResearchIntensity,
} from '../lib/research-intensity';
import type { ResearchModelId } from '../lib/research-models';
import {
  RESEARCH_OUTPUT_LANGUAGES,
  RESEARCH_OUTPUT_LANGUAGE_LABELS,
  type ResearchOutputLanguage,
} from '@/research-output-language';

export function ResearchPromptToolbar({
  intensity,
  onIntensityChange,
  model,
  onModelChange,
  outputLanguage,
  onOutputLanguageChange,
  disabled,
}: {
  intensity: ResearchIntensity;
  onIntensityChange: (value: ResearchIntensity) => void;
  model: ResearchModelId;
  onModelChange: (model: ResearchModelId) => void;
  outputLanguage: ResearchOutputLanguage;
  onOutputLanguageChange: (value: ResearchOutputLanguage) => void;
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
      <div className="research-model-select research-model-select--inline">
        <select
          id="research-form-output-language"
          value={outputLanguage}
          disabled={disabled}
          aria-label="輸出語言"
          onChange={e =>
            onOutputLanguageChange(e.target.value as ResearchOutputLanguage)
          }
        >
          {RESEARCH_OUTPUT_LANGUAGES.map(language => (
            <option key={language} value={language}>
              {RESEARCH_OUTPUT_LANGUAGE_LABELS[language]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
