'use client';

import Link from 'next/link';
import { useRef, type ChangeEvent } from 'react';

import { HomePromptLayout } from './home-prompt-layout';
import { MEETING_LANGUAGE_OPTIONS } from '../lib/meeting-languages';

type MeetingFormPanelProps = {
  language: string;
  onLanguageChange: (value: string) => void;
  detailLevel: 'brief' | 'full';
  onDetailLevelChange: (value: 'brief' | 'full') => void;
  includeAppendix: boolean;
  onIncludeAppendixChange: (value: boolean) => void;
  onSubmit: (file: File) => void;
  loading?: boolean;
  disabled?: boolean;
  workerReady?: boolean | null;
  llmReady?: boolean | null;
};

export function MeetingFormPanel({
  language,
  onLanguageChange,
  detailLevel,
  onDetailLevelChange,
  includeAppendix,
  onIncludeAppendixChange,
  onSubmit,
  loading = false,
  disabled = false,
  workerReady,
  llmReady,
}: MeetingFormPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = loading || disabled;

  const pickFile = () => {
    if (!busy) {
      inputRef.current?.click();
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      onSubmit(file);
    }
  };

  return (
    <HomePromptLayout
      title="會議摘要"
      description="上傳 MP3/WAV/M4A/MP4 檔案，自動轉錄並區分說話者，產出結構化會議紀要（需本地 WhisperX worker + LLM）"
      topAction={
        <Link href="/" className="home-page-top-link" aria-label="返回首頁">
          ← 返回首頁
        </Link>
      }
      footer={
        <div className="meeting-form-meta">
          <div className="meeting-form-options">
            <label className="meeting-form-label">
              語言
              <select
                value={language}
                onChange={e => onLanguageChange(e.target.value)}
                disabled={busy}
              >
                {MEETING_LANGUAGE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="meeting-form-label">
              紀要詳略
              <select
                value={detailLevel}
                onChange={e =>
                  onDetailLevelChange(e.target.value as 'brief' | 'full')
                }
                disabled={busy}
              >
                <option value="full">完整</option>
                <option value="brief">簡要</option>
              </select>
            </label>
            <label className="meeting-form-check">
              <input
                type="checkbox"
                checked={includeAppendix}
                onChange={e => onIncludeAppendixChange(e.target.checked)}
                disabled={busy}
              />
              附逐字稿
            </label>
          </div>
          <div className="meeting-service-status">
            {workerReady === null || llmReady === null ? (
              <span>檢查服務狀態…</span>
            ) : (
              <>
                <span className={workerReady ? 'ok' : 'bad'}>
                  WhisperX {workerReady ? '就緒' : '未啟動'}
                </span>
                <span className={llmReady ? 'ok' : 'bad'}>
                  LLM {llmReady ? '就緒' : '未設定'}
                </span>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="meeting-upload-zone">
        <input
          ref={inputRef}
          type="file"
          accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/m4a,video/mp4,.mp3,.wav,.m4a,.mp4"
          className="sr-only"
          onChange={onFileChange}
          disabled={busy}
        />
        <button
          type="button"
          className="meeting-upload-button"
          onClick={pickFile}
          disabled={busy}
        >
          {loading ? '處理中…' : '選擇 MP3 / WAV / M4A / MP4 檔案'}
        </button>
        <p className="meeting-upload-hint">
          支援 MP3、WAV、M4A、MP4。Mac 上請先執行{' '}
          <code className="meeting-inline-code">npm run meeting:worker</code>
        </p>
      </div>
    </HomePromptLayout>
  );
}
