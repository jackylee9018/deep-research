'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import {
  templateCardPreviewStyle,
  templateThemeCssVars,
} from '../lib/ppt-template-theme';
import {
  FALLBACK_PPT_TEMPLATE_OPTIONS,
  fetchPptTemplateOptions,
  importPptTemplateFile,
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

type ImportPhase = 'idle' | 'uploading' | 'success' | 'error';

export function PptTemplateSelect({
  value,
  onChange,
  disabled = false,
  variant = 'default',
}: PptTemplateSelectProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [options, setOptions] = useState<ClientPptTemplateOption[]>(
    FALLBACK_PPT_TEMPLATE_OPTIONS,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle');
  const [importMessage, setImportMessage] = useState('');
  const [importId, setImportId] = useState('');
  const [importLabel, setImportLabel] = useState('');

  const reloadTemplates = useCallback(async () => {
    setLoading(true);
    const { templates, error } = await fetchPptTemplateOptions();
    setOptions(templates);
    setLoadError(error ?? null);
    setLoading(false);
    return templates;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchPptTemplateOptions().then(({ templates, error }) => {
      if (!cancelled) {
        setOptions(templates);
        setLoadError(error ?? null);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectTemplate = useCallback(
    (id: PptTemplateId) => {
      onChange(id);
      requestAnimationFrame(() => {
        const active = gridRef.current?.querySelector(
          `[data-template-id="${CSS.escape(id)}"]`,
        );
        active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    },
    [onChange],
  );

  const handleImportFile = async (file: File) => {
    setImportPhase('uploading');
    setImportMessage(`正在上傳並解析「${file.name}」…`);
    try {
      const result = await importPptTemplateFile(file, {
        id: importId,
        label: importLabel,
      });

      const selectedId = result.template.id;

      setOptions(prev => {
        const without = prev.filter(t => t.id !== selectedId);
        return [result.template, ...without];
      });
      selectTemplate(selectedId);

      const templates = await reloadTemplates();
      const merged = templates.some(t => t.id === selectedId)
        ? templates
        : [result.template, ...templates];
      const selected = merged.find(t => t.id === selectedId) ?? result.template;
      const rest = merged.filter(t => t.id !== selectedId);
      setOptions([selected, ...rest]);
      selectTemplate(selectedId);

      const warn =
        result.warnings.length > 0
          ? `；${result.warnings.length} 則提示（見 registry）`
          : '';
      setImportPhase('success');
      setImportMessage(
        `${result.created ? '已新增' : '已更新'}「${result.template.label}」並已自動選用（id: ${selectedId}）。${result.analysisSummary}。可直接產生大綱或生成簡報。${warn}`,
      );
      setImportId('');
      setImportLabel('');
    } catch (error) {
      setImportPhase('error');
      setImportMessage(
        error instanceof Error ? error.message : '匯入失敗，請稍後再試',
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const uploadBusy = importPhase === 'uploading';
  const uploadBtnDisabled = disabled || uploadBusy;

  return (
    <div
      className={`ppt-template-select${variant === 'rail' ? ' ppt-template-select--rail' : ''}`}
    >
      <div className="ppt-template-select-head">
        <span className="ppt-template-select-label">
          簡報風格
          {!loading ? `（${options.length}）` : ''}
        </span>
        <label
          htmlFor={fileInputId}
          className={`ppt-template-import-btn${uploadBtnDisabled ? ' is-disabled' : ''}`}
        >
          {uploadBusy ? '匯入中…' : '上傳模板'}
        </label>
        <input
          id={fileInputId}
          ref={fileInputRef}
          type="file"
          accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="sr-only"
          disabled={uploadBtnDisabled}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) {
              void handleImportFile(file);
            }
          }}
        />
      </div>

      <details className="ppt-template-import-details">
        <summary>匯入選項（選填）</summary>
        <div className="ppt-template-import-fields">
          <label>
            <span>模板 id</span>
            <input
              type="text"
              value={importId}
              disabled={uploadBtnDisabled}
              placeholder="小寫英文開頭，如 my_brand"
              autoComplete="off"
              spellCheck={false}
              onChange={e => setImportId(e.target.value)}
            />
          </label>
          <label>
            <span>顯示名稱</span>
            <input
              type="text"
              value={importLabel}
              disabled={uploadBtnDisabled}
              placeholder="例如 品牌簡報"
              onChange={e => setImportLabel(e.target.value)}
            />
          </label>
        </div>
      </details>

      {importPhase !== 'idle' ? (
        <div
          className={`ppt-template-import-banner ppt-template-import-banner--${importPhase}`}
          role="status"
          aria-live="polite"
        >
          {importMessage}
        </div>
      ) : null}

      {loadError ? (
        <p className="ppt-template-load-error" role="alert">
          {loadError}（目前顯示內建模板）
        </p>
      ) : null}

      {loading ? (
        <p className="ppt-template-select-loading">載入模板…</p>
      ) : null}

      {!loading && options.length === 0 ? (
        <p className="ppt-template-select-empty">尚無可用模板，請上傳 .pptx。</p>
      ) : (
        <div
          ref={gridRef}
          className="ppt-template-select-grid"
          role="radiogroup"
          aria-label="簡報風格"
        >
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
                data-template-id={option.id}
                className={`ppt-template-card ppt-template-card--gradient${active ? ' is-active' : ''}${missing ? ' ppt-template-card--missing' : ''}`}
                data-preview-theme={option.previewTheme}
                style={templateThemeCssVars(option)}
                title={missing ? `缺少檔案：${option.id}` : undefined}
                onClick={() => selectTemplate(option.id)}
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
      )}

      <p className="ppt-template-select-hint">
        上傳成功後會自動選用該模板；也可隨時點其他卡片切換。
      </p>
    </div>
  );
}
