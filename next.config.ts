import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['js-tiktoken', 'html-to-docx', 'puppeteer'],
};

export default nextConfig;
