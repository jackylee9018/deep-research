'use client';

import type { ReactNode } from 'react';

import { AppNavRail } from './app-nav-rail';

export function AppShellWithRail({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell-with-rail">
      <AppNavRail />
      <div className="app-shell-with-rail-main">{children}</div>
    </div>
  );
}
