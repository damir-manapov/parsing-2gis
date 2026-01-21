import { chromium } from 'playwright';

async function testReviews() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Navigate to a place with reviews - directly to reviews tab
  const url = 'https://2gis.ru/moscow/firm/70000001031659781/tab/reviews';
  console.log('Navigating to:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Wait for page to load
  await page.waitForTimeout(3000);

  // Check if reviews are in initialState
  const reviews = await page.evaluate(() => {
    // biome-ignore lint/suspicious/noExplicitAny: Window object extension
    const state = (window as any).initialState;
    if (!state) return { error: 'No initialState found' };

    // Get all reviews
    const reviewData = state.data?.review;
    if (!reviewData) return { error: 'No review data found' };

    const allReviews = [];
    for (const [id, reviewObj] of Object.entries(reviewData)) {
      // biome-ignore lint/suspicious/noExplicitAny: Review object structure
      const review = (reviewObj as any)?.data;
      if (review) {
        allReviews.push({
          id,
          text: review.text,
          rating: review.rating,
          dateCreated: review.date_created,
          dateEdited: review.date_edited,
          author: review.user?.name,
          authorId: review.user?.id,
          commentsCount: review.comments_count,
          source: review.source,
          likes: review.likes_count,
          dislikes: review.dislikes_count,
        });
      }
    }

    return {
      totalReviews: allReviews.length,
      reviews: allReviews.slice(0, 5), // First 5 for display
    };
  });

  console.log('\nExtracted reviews:');
  console.log(JSON.stringify(reviews, null, 2));

  // Take screenshot
  await page.screenshot({ path: 'data/temp/reviews-tab.png', fullPage: true });

  console.log('\n\nPress Ctrl+C to close browser...');
  await new Promise(() => {}); // Keep browser open
}

testReviews().catch(console.error);
