'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { HomePlaceholderHeader } from './components/home-placeholder-header';
import { HomePromptLayout } from './components/home-prompt-layout';
import { LightRouteShell } from './components/light-route-shell';
import { PromptInput } from './components/prompt-input';
import { navigateToOpenWebUI, preloadOpenWebUIOrigin } from './lib/openwebui';

const FEATURES = [
  {
    id: 'deep-research',
    href: '/research',
    title: 'Deep Research',
    description: '深度調查與資料分析',
    iconBg: '#ede9fe',
    iconColor: '#7c3aed',
    Icon: SearchIcon,
  },
  {
    id: 'ppt',
    href: '/ppt',
    title: '生成 PPT',
    description: '一鍵生成專業簡報',
    iconBg: '#d1fae5',
    iconColor: '#059669',
    Icon: PresentationIcon,
  },
  {
    id: 'meeting',
    href: null,
    title: '會議摘要',
    description: '快速提煉會議重點',
    iconBg: '#dbeafe',
    iconColor: '#2563eb',
    Icon: DocumentIcon,
  },
  {
    id: 'schedule',
    href: null,
    title: '日程管理',
    description: '高效規劃與提醒',
    iconBg: '#ffedd5',
    iconColor: '#ea580c',
    Icon: CalendarIcon,
  },
] as const;

export default function HomePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    preloadOpenWebUIOrigin();
  }, []);

  const goToOpenWebUI = async (query?: string, extra?: { call?: boolean }) => {
    const q = (query ?? prompt).trim();
    setRedirecting(true);
    try {
      await navigateToOpenWebUI({
        ...(q ? { q } : {}),
        ...extra,
      });
    } catch {
      setRedirecting(false);
    }
  };

  const goToResearch = (query?: string) => {
    const q = (query ?? prompt).trim();
    if (q) {
      router.push(`/research?q=${encodeURIComponent(q)}`);
      return;
    }
    router.push('/research');
  };

  return (
    <LightRouteShell className="route-bg route-bg--home">
      <HomePromptLayout
        header={<HomePlaceholderHeader />}
        footer={
          <nav className="home-features" aria-label="功能捷徑">
            {FEATURES.map(feature => {
              const content = (
                <>
                  <span
                    className="home-feature-icon"
                    style={{
                      background: feature.iconBg,
                      color: feature.iconColor,
                    }}
                  >
                    <feature.Icon />
                  </span>
                  <span className="home-feature-text">
                    <span className="home-feature-title">{feature.title}</span>
                    <span className="home-feature-desc">
                      {feature.description}
                    </span>
                  </span>
                </>
              );

              if (feature.href) {
                return (
                  <Link
                    key={feature.id}
                    href={feature.href}
                    className="home-feature-card"
                    onClick={e => {
                      if (feature.id === 'deep-research' && prompt.trim()) {
                        e.preventDefault();
                        goToResearch();
                      } else if (feature.id === 'ppt' && prompt.trim()) {
                        e.preventDefault();
                        router.push(
                          `/ppt?q=${encodeURIComponent(prompt.trim())}`,
                        );
                      }
                    }}
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <button
                  key={feature.id}
                  type="button"
                  className="home-feature-card home-feature-card--soon"
                  title="即將推出"
                  disabled
                >
                  {content}
                </button>
              );
            })}
          </nav>
        }
      >
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          onSubmit={() => void goToOpenWebUI()}
          onVoiceMode={() => void goToOpenWebUI(undefined, { call: true })}
          disabled={redirecting}
          placeholder="今天我能幫您什麼？"
        />
      </HomePromptLayout>
    </LightRouteShell>
  );
}

function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path
        d="M20 20l-3-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PresentationIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="4"
        width="18"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8 20h8M12 16v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6M8 13h8M8 17h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M3 10h18M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
