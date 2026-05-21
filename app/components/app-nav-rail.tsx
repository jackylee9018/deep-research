'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import {
  PPT_FEATURE_DISPLAY_NAME,
  RESEARCH_FEATURE_DISPLAY_NAME,
  resolveAppDisplayName,
} from '../lib/app-brand';
import { loadAppNavOpen, saveAppNavOpen } from '../lib/app-nav-prefs';
import { navigateToOpenWebUI } from '../lib/openwebui';
import { useOptionalPptNavHandlers } from './ppt-nav-context';
import { PptSidebarPanel } from './ppt-sidebar-panel';
import { useOptionalResearchNavHandlers } from './research-nav-context';
import { ResearchSidebarPanel } from './research-sidebar-panel';

export function AppNavRail() {
  const pathname = usePathname();
  const isResearchRoute = pathname.startsWith('/research');
  const isPptRoute = pathname.startsWith('/ppt');
  const isFeatureRoute = isResearchRoute || isPptRoute;
  const researchNav = useOptionalResearchNavHandlers();
  const pptNav = useOptionalPptNavHandlers();

  const [expanded, setExpanded] = useState(false);
  const [brandHover, setBrandHover] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setExpanded(loadAppNavOpen(isFeatureRoute));
    setHydrated(true);
  }, [isFeatureRoute]);

  const setOpen = (next: boolean) => {
    setExpanded(next);
    saveAppNavOpen(next);
  };

  if (!hydrated) {
    return (
      <div
        className={`app-nav-rail app-nav-rail--placeholder${isResearchRoute ? ' is-research' : ''}${isPptRoute ? ' is-ppt' : ''}`}
        aria-hidden
      />
    );
  }

  const openNewChat = () => {
    if (isResearchRoute && researchNav) {
      researchNav.onNewResearch();
      return;
    }
    if (isPptRoute && pptNav) {
      pptNav.onNewPpt();
      return;
    }
    void navigateToOpenWebUI();
  };

  const openSearchChat = () => void navigateToOpenWebUI();

  const railClass = [
    'app-nav-rail',
    expanded ? 'is-expanded' : '',
    isResearchRoute ? 'is-research' : '',
    isPptRoute ? 'is-ppt' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (expanded) {
    return (
      <>
        <aside className={railClass} aria-label="應用導覽">
          <div className="app-nav-panel">
            <div className="app-nav-panel-top">
              {isResearchRoute ? (
                <Link
                  href="/research"
                  className="app-nav-panel-brand research-sidebar-brand"
                  aria-label={RESEARCH_FEATURE_DISPLAY_NAME}
                >
                  <span className="research-sidebar-logo">OI</span>
                  <span className="research-sidebar-brand-text">
                    {RESEARCH_FEATURE_DISPLAY_NAME}
                  </span>
                </Link>
              ) : isPptRoute ? (
                <Link
                  href="/ppt"
                  className="app-nav-panel-brand research-sidebar-brand"
                  aria-label={PPT_FEATURE_DISPLAY_NAME}
                >
                  <span className="research-sidebar-logo">OI</span>
                  <span className="research-sidebar-brand-text">
                    {PPT_FEATURE_DISPLAY_NAME}
                  </span>
                </Link>
              ) : (
                <Link href="/" className="app-nav-panel-brand" aria-label="返回首頁">
                  <AppBrandLogo />
                  <span className="app-nav-panel-brand-text">
                    {resolveAppDisplayName()}
                  </span>
                </Link>
              )}
              <button
                type="button"
                className="app-nav-icon-btn"
                aria-label="收合側欄"
                onClick={() => setOpen(false)}
              >
                <SidebarPanelIcon />
              </button>
            </div>

            {isResearchRoute ? (
              <ResearchSidebarPanel />
            ) : isPptRoute ? (
              <PptSidebarPanel />
            ) : (
              <nav className="app-nav-panel-nav" aria-label="主要功能">
                <AppNavPanelItem
                  label="新對話"
                  onClick={openNewChat}
                  icon={<EditIcon />}
                />
                <AppNavPanelItem
                  label="搜尋／聊天"
                  onClick={openSearchChat}
                  icon={<SearchIcon />}
                />
              </nav>
            )}
          </div>
        </aside>
        <button
          type="button"
          className="app-nav-backdrop"
          aria-label="關閉側欄"
          onClick={() => setOpen(false)}
        />
      </>
    );
  }

  return (
    <aside className={railClass} aria-label="應用導覽">
      <nav className="app-nav-rail-icons">
        <button
          type="button"
          className="app-nav-rail-btn app-nav-brand-btn"
          aria-label={brandHover ? '展開側欄' : '品牌'}
          onMouseEnter={() => setBrandHover(true)}
          onMouseLeave={() => setBrandHover(false)}
          onFocus={() => setBrandHover(true)}
          onBlur={() => setBrandHover(false)}
          onClick={() => setOpen(true)}
        >
          {brandHover ? <SidebarPanelIcon /> : <AppBrandLogo />}
        </button>

        <AppNavRailIconButton
          label={
            isResearchRoute
              ? '新建研究'
              : isPptRoute
                ? '新建簡報'
                : '新對話'
          }
          onClick={openNewChat}
          icon={<EditIcon />}
        />
        <AppNavRailIconButton
          label="搜尋／聊天"
          onClick={openSearchChat}
          icon={<SearchIcon />}
        />
      </nav>
    </aside>
  );
}

function AppNavRailIconButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      className="app-nav-rail-btn"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function AppNavPanelItem({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button type="button" className="app-nav-panel-item" onClick={onClick}>
      <span className="app-nav-panel-item-icon">{icon}</span>
      <span className="app-nav-panel-item-label">{label}</span>
    </button>
  );
}

function AppBrandLogo() {
  return (
    <svg
      className="app-nav-brand-logo"
      width="28"
      height="28"
      viewBox="0 0 32 32"
      aria-hidden
    >
      <path
        d="M8 6c6 0 8 4 8 10s-2 10-8 10"
        fill="none"
        stroke="#22c55e"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M24 26c-6 0-8-4-8-10s2-10 8-10"
        fill="none"
        stroke="#3b82f6"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SidebarPanelIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M9 4v16" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M20 20l-3-3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
