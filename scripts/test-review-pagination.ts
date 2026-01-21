import { chromium } from 'playwright';

async function testPagination() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Navigate to McDonald's reviews (has many reviews)
  const url = 'https://2gis.ru/moscow/firm/4504127908652933/tab/reviews';
  console.log('Navigating to:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  await page.waitForTimeout(2000);

  // Count initial reviews
  let reviewCount = await page.evaluate(() => {
    // biome-ignore lint/suspicious/noExplicitAny: Window object extension
    const state = (window as any).initialState;
    return state?.data?.review ? Object.keys(state.data.review).length : 0;
  });
  console.log(`Initial reviews in state: ${reviewCount}`);

  // Try scrolling multiple times
  for (let i = 0; i < 5; i++) {
    console.log(`\nScroll iteration ${i + 1}:`);

    // Scroll to bottom
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    console.log('  Scrolled to bottom, waiting...');
    await page.waitForTimeout(1500);

    // Check if new reviews loaded
    const newCount = await page.evaluate(() => {
      // biome-ignore lint/suspicious/noExplicitAny: Window object extension
      const state = (window as any).initialState;
      return state?.data?.review ? Object.keys(state.data.review).length : 0;
    });

    console.log(
      `  Reviews in state: ${newCount} (${newCount - reviewCount > 0 ? `+${newCount - reviewCount}` : 'no change'})`,
    );

    if (newCount === reviewCount) {
      console.log('  No new reviews loaded');
    }
    reviewCount = newCount;

    // Check for "Show more" button with more specific text matching
    const allText = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
      return buttons
        .map((el) => ({
          tag: el.tagName,
          text: el.textContent?.trim().slice(0, 50),
          classes: el.className.slice(0, 80),
        }))
        .filter((item) => item.text && item.text.length > 0);
    });

    const relevantButtons = allText.filter(
      (item) =>
        item.text?.toLowerCase().includes('ещё') ||
        item.text?.toLowerCase().includes('показать') ||
        item.text?.toLowerCase().includes('загрузить') ||
        item.text?.toLowerCase().includes('more'),
    );

    if (relevantButtons.length > 0) {
      console.log('  Relevant buttons found:');
      relevantButtons.forEach((btn) => {
        console.log(`    - ${btn.tag}: "${btn.text}"`);
      });

      // Try clicking the "Load more" button
      try {
        await page.locator('button:has-text("Загрузить ещё")').click({ timeout: 2000 });
        console.log('  ✓ Clicked "Загрузить ещё" button');
        await page.waitForTimeout(1500);

        // Check if more reviews loaded after click
        const afterClickCount = await page.evaluate(() => {
          // biome-ignore lint/suspicious/noExplicitAny: Window object extension
          const state = (window as any).initialState;
          return state?.data?.review ? Object.keys(state.data.review).length : 0;
        });
        console.log(
          `  After click: ${afterClickCount} reviews (${afterClickCount - reviewCount > 0 ? `+${afterClickCount - reviewCount}` : 'no change'})`,
        );
        reviewCount = afterClickCount;
      } catch (e) {
        console.log('  ✗ Could not click button:', (e as Error).message.slice(0, 80));
      }
    }
  }

  console.log('\n\nFinal review count:', reviewCount);
  console.log('Keeping browser open for inspection...');
  await new Promise(() => {}); // Keep open
}

testPagination().catch(console.error);
