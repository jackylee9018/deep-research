import type { Metadata } from 'next';

import { RESEARCH_FEATURE_DISPLAY_NAME } from '../lib/app-brand';
import { LightRouteShell } from '../components/light-route-shell';

export const metadata: Metadata = {
  title: RESEARCH_FEATURE_DISPLAY_NAME,
};

export default function ResearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LightRouteShell className="route-bg route-bg--research">
      {children}
    </LightRouteShell>
  );
}
