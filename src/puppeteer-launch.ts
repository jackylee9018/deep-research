import puppeteer, { type Page } from 'puppeteer';

export function puppeteerLaunchOptions(): Parameters<
  typeof puppeteer.launch
>[0] {
  const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  return launchOptions;
}

export async function withPuppeteerPage<T>(
  fn: (page: Page) => Promise<T>,
): Promise<T> {
  const browser = await puppeteer.launch(puppeteerLaunchOptions());
  try {
    const page = await browser.newPage();
    return await fn(page);
  } finally {
    await browser.close();
  }
}
