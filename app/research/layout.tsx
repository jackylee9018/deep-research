import { Suspense } from 'react';

export default function ResearchLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<main className="research-shell" style={{ padding: '2rem' }}>載入中…</main>}>{children}</Suspense>;
}
