'use client';

import { useEffect, useState } from 'react';

import {
  templateCardPreviewStyle,
  templateThemeCssVars,
} from '../lib/ppt-template-theme';
import {
  FALLBACK_PPT_TEMPLATE_OPTIONS,
  fetchPptTemplateOptions,
  type ClientPptTemplateOption,
  type PptTemplateId,
} from '../lib/ppt-templates';

type PptTemplateSelectProps = {
  value: PptTemplateId;
  onChange: (value: PptTemplateId) => void;
  disabled?: boolean;
  /** Compact layout for the outline right rail. */
  variant?: 'default' | 'rail';
};

export function PptTemplateSelect({
  value,
  onChange,
  disabled = false,
  variant = 'default',
}: PptTemplateSelectProps) {
  const [options, setOptions] = useState<ClientPptTemplateOption[]>(
    FALLBACK_PPT_TEMPLATE_OPTIONS,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchPptTemplateOptions().then(list => {
      if (!cancelled) {
        setOptions(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className={`ppt-template-select${variant === 'rail' ? ' ppt-template-select--rail' : ''}`}
    >
      <span className="ppt-template-select-label">簡報風格</span>
      {loading ? (
        <p className="ppt-template-select-loading">載入模板…</p>
      ) : null}
      <div className="ppt-template-select-grid" role="radiogroup" aria-label="簡報風格">
        {options.map(option => {
          const active = option.id === value;
          const missing = option.fileExists === false;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled || missing}
              className={`ppt-template-card ppt-template-card--gradient${active ? ' is-active' : ''}${missing ? ' ppt-template-card--missing' : ''}`}
              data-preview-theme={option.previewTheme}
              style={templateThemeCssVars(option)}
              title={missing ? `缺少檔案：${option.id}` : undefined}
              onClick={() => onChange(option.id)}
            >
              <span
                className="ppt-template-card-preview"
                aria-hidden
                style={templateCardPreviewStyle(option)}
              />
              <span className="ppt-template-card-body">
                <span className="ppt-template-card-title">{option.label}</span>
                <span className="ppt-template-card-desc">
                  {missing
                    ? '模板檔不存在，請檢查 templates/'
                    : option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="ppt-template-select-hint">
        色塊為投影片漸層背景預覽；匯出與預覽會套用{' '}
        <code>registry.json</code> 的 <code>exportTheme</code>。
      </p>
    </div>
  );
}
