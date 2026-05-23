import type { Metadata } from 'next';

import { LightRouteShell } from '../components/light-route-shell';

export const metadata: Metadata = {
  title: '會議摘要',
};

export default function MeetingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LightRouteShell className="route-bg route-bg--meeting">
      {children}
    </LightRouteShell>
  );
}
