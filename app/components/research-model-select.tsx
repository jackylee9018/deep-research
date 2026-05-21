'use client';

import {
  RESEARCH_MODEL_LABELS,
  RESEARCH_MODELS,
  type ResearchModelId,
} from '../lib/research-models';

export function ResearchModelSelect({
  value,
  onChange,
  disabled,
  variant = 'stacked',
  id = 'research-model',
}: {
  value: ResearchModelId;
  onChange: (model: ResearchModelId) => void;
  disabled?: boolean;
  variant?: 'stacked' | 'inline';
  id?: string;
}) {
  const className =
    variant === 'inline'
      ? 'research-model-select research-model-select--inline'
      : 'research-model-select';

  return (
    <div className={className}>
      {variant === 'stacked' && (
        <label htmlFor={id}>研究模型</label>
      )}
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-label={variant === 'inline' ? '研究模型' : undefined}
        onChange={e => onChange(e.target.value as ResearchModelId)}
      >
        {RESEARCH_MODELS.map(modelId => (
          <option key={modelId} value={modelId}>
            {variant === 'inline'
              ? RESEARCH_MODEL_LABELS[modelId]
              : `${RESEARCH_MODEL_LABELS[modelId]} (${modelId})`}
          </option>
        ))}
      </select>
    </div>
  );
}
