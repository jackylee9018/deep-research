'use client';

import { useCallback, useEffect, useRef } from 'react';

type HomePromptInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onVoiceMode?: () => void;
  placeholder?: string;
  disabled?: boolean;
};

export function HomePromptInput({
  value,
  onChange,
  onSubmit,
  onVoiceMode,
  placeholder = '今天我能幫您什麼？',
  disabled = false,
}: HomePromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasContent = value.trim().length > 0;

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 384)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled) {
        onSubmit();
      }
    }
  };

  return (
    <form
      className="owui-prompt-form"
      onSubmit={e => {
        e.preventDefault();
        if (!disabled) {
          onSubmit();
        }
      }}
    >
      <div id="message-input-container" className="owui-message-input-container">
        <div className="owui-input-area-wrap">
          <div id="chat-input-container" className="owui-chat-input-container">
            <textarea
              ref={textareaRef}
              id="chat-input"
              className="owui-chat-input"
              value={value}
              onChange={e => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              disabled={disabled}
              aria-label="輸入您的需求"
            />
          </div>
        </div>

        <div className="owui-input-toolbar">
          <div className="owui-input-toolbar-left">
            <button
              type="button"
              id="input-menu-button"
              className="owui-toolbar-icon-btn"
              aria-label="更多"
            >
              <PlusAltIcon />
            </button>
          </div>

          <div className="owui-input-toolbar-right">
            {hasContent ? (
              <>
                <button
                  type="button"
                  id="voice-input-button"
                  className="owui-voice-dictate-btn"
                  aria-label="語音輸入"
                >
                  <DictateMicIcon />
                </button>
                <button
                  type="submit"
                  id="send-message-button"
                  className="owui-send-btn owui-send-btn--active"
                  aria-label="送出訊息"
                  disabled={disabled}
                >
                  <SendArrowIcon />
                </button>
              </>
            ) : (
              <button
                type="button"
                className="owui-voice-mode-btn"
                aria-label="語音模式"
                disabled={disabled}
                onClick={() => onVoiceMode?.()}
              >
                <VoiceModeIcon />
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

function PlusAltIcon() {
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
      <path d="M6 12H12M18 12H12M12 12V6M12 12V18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DictateMicIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      className="owui-icon-mic"
    >
      <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
      <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
    </svg>
  );
}

function SendArrowIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className="owui-icon-send"
    >
      <path
        fillRule="evenodd"
        d="M8 14a.75.75 0 0 1-.75-.75V4.56L4.03 7.78a.75.75 0 0 1-1.06-1.06l4.5-4.5a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1-1.06 1.06L8.75 4.56v8.69A.75.75 0 0 1 8 14Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function VoiceModeIcon() {
  return (
    <svg
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2.5"
      stroke="currentColor"
      className="owui-icon-voice"
    >
      <path d="M12 4L12 20" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 9L8 15" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 10L20 14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 10L4 14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 7L16 17" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
