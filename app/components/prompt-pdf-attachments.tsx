'use client';

import { useId, useRef, useState } from 'react';

import type { PromptAttachment } from '../lib/prompt-attachments';
import { MAX_PROMPT_PDF_ATTACHMENTS } from '../lib/prompt-attachments';

import { PromptToolbarIconTip } from './prompt-toolbar-icon-tip';

type PromptPdfAttachmentsProps = {
  attachments: PromptAttachment[];
  onChange: (attachments: PromptAttachment[]) => void;
  disabled?: boolean;
  /** Renders inside the prompt toolbar (attach button). */
  variant?: 'toolbar' | 'chips';
};

export function PromptPdfAttachments({
  attachments,
  onChange,
  disabled = false,
  variant = 'toolbar',
}: PromptPdfAttachmentsProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atLimit = attachments.length >= MAX_PROMPT_PDF_ATTACHMENTS;

  const removeAttachment = (name: string) => {
    onChange(attachments.filter(item => item.name !== name));
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || disabled) {
      return;
    }

    setError(null);
    setParsing(true);

    try {
      const next = [...attachments];

      for (const file of Array.from(files)) {
        if (next.length >= MAX_PROMPT_PDF_ATTACHMENTS) {
          break;
        }

        if (
          file.type !== 'application/pdf' &&
          !file.name.toLowerCase().endsWith('.pdf')
        ) {
          throw new Error(`「${file.name}」不是 PDF 檔案`);
        }

        if (next.some(item => item.name === file.name)) {
          throw new Error(`「${file.name}」已加入`);
        }

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/attachments/parse-pdf', {
          method: 'POST',
          body: formData,
        });

        const json = (await res.json().catch(() => ({}))) as {
          name?: string;
          text?: string;
          message?: string;
          error?: string;
        };

        if (!res.ok) {
          throw new Error(
            json.message ?? json.error ?? `無法解析「${file.name}」`,
          );
        }

        if (!json.name || !json.text) {
          throw new Error(`無法解析「${file.name}」`);
        }

        next.push({ name: json.name, text: json.text });
      }

      onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setParsing(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const attachTip = parsing
    ? '解析中…'
    : atLimit
      ? `最多 ${MAX_PROMPT_PDF_ATTACHMENTS} 個`
      : '附加 PDF';

  const attachButton = (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="prompt-attachment-input"
        disabled={disabled || parsing || atLimit}
        onChange={e => void handleFiles(e.target.files)}
      />
      <PromptToolbarIconTip tip={attachTip}>
        <button
          type="button"
          className="owui-toolbar-icon-btn prompt-attachment-btn"
          aria-label="附加 PDF"
          disabled={disabled || parsing || atLimit}
          onClick={() => inputRef.current?.click()}
          title={attachTip}
        >
          {parsing ? <SpinnerIcon /> : <PdfAttachIcon />}
        </button>
      </PromptToolbarIconTip>
    </>
  );

  const chips =
    attachments.length > 0 ? (
      <ul className="prompt-attachment-list" aria-label="已附加 PDF">
        {attachments.map(item => (
          <li key={item.name} className="prompt-attachment-chip">
            <PdfFileIcon />
            <span className="prompt-attachment-name" title={item.name}>
              {item.name}
            </span>
            <button
              type="button"
              className="prompt-attachment-remove"
              aria-label={`移除 ${item.name}`}
              title={`移除 ${item.name}`}
              disabled={disabled || parsing}
              onClick={() => removeAttachment(item.name)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  if (variant === 'toolbar') {
    return (
      <>
        {attachButton}
        {error ? (
          <span className="prompt-attachment-error" role="alert">
            {error}
          </span>
        ) : null}
      </>
    );
  }

  return (
    <div className="prompt-attachment-block">
      {chips}
      {error ? (
        <p className="prompt-attachment-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PromptPdfAttachmentToolbar({
  attachments,
  onChange,
  disabled,
}: Omit<PromptPdfAttachmentsProps, 'variant'>) {
  return (
    <PromptPdfAttachments
      attachments={attachments}
      onChange={onChange}
      disabled={disabled}
      variant="toolbar"
    />
  );
}

export function PromptPdfAttachmentChips({
  attachments,
  onChange,
  disabled,
}: Omit<PromptPdfAttachmentsProps, 'variant'>) {
  if (!attachments.length) {
    return null;
  }

  return (
    <PromptPdfAttachments
      attachments={attachments}
      onChange={onChange}
      disabled={disabled}
      variant="chips"
    />
  );
}

function PdfAttachIcon() {
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
        d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.116-5.116 1.768-1.768"
      />
    </svg>
  );
}

function PdfFileIcon() {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6M8 13h8M8 17h5" strokeLinecap="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      aria-hidden
      className="prompt-attachment-spinner"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
