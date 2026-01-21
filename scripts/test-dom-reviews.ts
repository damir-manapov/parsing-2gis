import { chromium } from 'playwright';

async function testDOMReviews() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  const url = 'https://2gis.ru/moscow/firm/4504127908652933/tab/reviews';
  console.log('Navigating to:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Get DOM structure - analyze first 3 reviews in detail
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Test script
  const reviewInfo = await page.evaluate(() => {
    const authorElements = document.querySelectorAll('._1pi8bc0');
    if (authorElements.length === 0) return { error: 'No author elements found' };

    const firstThreeReviews = [];

    for (let i = 0; i < Math.min(3, authorElements.length); i++) {
      const authorEl = authorElements[i];
      if (!authorEl) continue;

      // Go up to find review container
      let reviewContainer = authorEl.parentElement;
      for (let j = 0; j < 5 && reviewContainer; j++) {
        if (reviewContainer.className && reviewContainer.children.length > 2) {
          break;
        }
        reviewContainer = reviewContainer.parentElement;
      }

      if (!reviewContainer) continue;

      // Extract all text elements with their class names
      const allTexts = Array.from(reviewContainer.querySelectorAll('*'))
        // biome-ignore lint/suspicious/noExplicitAny: Test script DOM manipulation
        .filter((el: any) => el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) // Text nodes only
        // biome-ignore lint/suspicious/noExplicitAny: Test script DOM manipulation
        .map((el: any) => ({
          tag: el.tagName,
          className: el.className,
          text: el.textContent?.trim(),
          length: el.textContent?.trim().length || 0,
        }))
        // biome-ignore lint/suspicious/noExplicitAny: Test script
        .filter((item: any) => item.length > 10) // Filter out short text
        // biome-ignore lint/suspicious/noExplicitAny: Test script
        .sort((a: any, b: any) => b.length - a.length); // Sort by length descending

      firstThreeReviews.push({
        index: i,
        authorText: authorEl.textContent?.trim(),
        allTexts: allTexts.slice(0, 8), // Top 8 longest texts
      });
    }

    return { firstThreeReviews };
  });

  console.log('\nReview analysis:');
  console.log(JSON.stringify(reviewInfo, null, 2));

  console.log('\n\nPress Ctrl+C to close...');
  await new Promise(() => {});
}

testDOMReviews().catch(console.error);
