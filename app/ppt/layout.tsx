import { LightRouteShell } from '../components/light-route-shell';

export default function PptLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LightRouteShell className="route-bg route-bg--ppt">
      {children}
    </LightRouteShell>
  );
}
