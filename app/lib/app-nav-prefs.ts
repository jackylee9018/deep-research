const APP_NAV_OPEN_KEY = 'deep-research:app-nav-open';
const LEGACY_RESEARCH_SIDEBAR_OPEN_KEY = 'deep-research:sidebar-open';

export function loadAppNavOpen(defaultOpen = false): boolean {
  if (typeof window === 'undefined') {
    return defaultOpen;
  }
  try {
    const raw = localStorage.getItem(APP_NAV_OPEN_KEY);
    if (raw === null) {
      const legacy = localStorage.getItem(LEGACY_RESEARCH_SIDEBAR_OPEN_KEY);
      if (legacy !== null) {
        return legacy === '1';
      }
      return defaultOpen;
    }
    return raw === '1';
  } catch {
    return defaultOpen;
  }
}

export function saveAppNavOpen(open: boolean) {
  localStorage.setItem(APP_NAV_OPEN_KEY, open ? '1' : '0');
}
