import { withPuppeteerPage } from './puppeteer-launch';

export async function htmlToPdfBuffer(html: string): Promise<Uint8Array> {
  return withPuppeteerPage(async page => {
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    });
    return new Uint8Array(pdf);
  });
}
