import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { resolveAppDisplayName } from './lib/app-brand';
import { AppProviders } from './providers';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: resolveAppDisplayName(),
  description: 'AI-powered iterative deep research',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className={inter.className}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
