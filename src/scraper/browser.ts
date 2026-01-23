import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import type { Logger } from '../utils.js';
import { setupRequestBlocking } from './helpers.js';

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export async function createBrowserSession(
  headless: boolean,
  logger: Logger,
): Promise<BrowserSession> {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Setup request blocking
  await setupRequestBlocking(page, logger);

  return { browser, context, page };
}

export async function closeBrowser(browser: Browser, logger: Logger): Promise<void> {
  await browser.close();
  logger.debug('Browser closed');
}
