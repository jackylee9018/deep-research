import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'js-tiktoken',
    'html-to-docx',
    'puppeteer',
    'pdf-parse',
    '@langchain/core',
    '@langchain/langgraph',
  ],
};

export default nextConfig;
