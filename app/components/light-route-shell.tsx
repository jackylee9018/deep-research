import { Suspense, type ReactNode } from 'react';

import { AppShellWithRail } from './app-shell-with-rail';

/**
 * Persistent light backdrop for routes that use useSearchParams (Suspense).
 * The outer shell does not suspend, so navigation avoids a dark body flash.
 */
export function LightRouteShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const shellClass = ['light-route-shell', className].filter(Boolean).join(' ');
  return (
    <div className={shellClass}>
      <AppShellWithRail>
        <Suspense fallback={null}>{children}</Suspense>
      </AppShellWithRail>
    </div>
  );
}
