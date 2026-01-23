import type { Page } from 'playwright';
import type { Review } from '../types/index.js';
import type { Logger } from '../utils.js';
import { DEFAULT_NAVIGATION_TIMEOUT } from './constants.js';

export async function extractReviewsFromInitialState(page: Page): Promise<Review[]> {
  return await page.evaluate(() => {
    // biome-ignore lint/suspicious/noExplicitAny: Browser window object is dynamic
    const state = (window as any).initialState;
    if (!state?.data?.review) return [];

    const reviewData = state.data.review;
    const allReviews = [];

    for (const [id, reviewObj] of Object.entries(reviewData)) {
      // biome-ignore lint/suspicious/noExplicitAny: 2GIS review data structure is dynamic
      const review = (reviewObj as any)?.data;
      if (review) {
        allReviews.push({
          id,
          text: review.text || '',
          rating: review.rating || 0,
          dateCreated: review.date_created || '',
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

    return allReviews;
  });
}

export async function extractReviewsFromDOM(page: Page): Promise<Review[]> {
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: DOM review extraction requires complex navigation and parsing logic
  return await page.evaluate(() => {
    // Find all review containers
    // Strategy: Find divs that contain both the review text link and author element
    const reviewLinks = document.querySelectorAll('a._1msln3t');
    // biome-ignore lint/suspicious/noExplicitAny: DOM review items have dynamic structure
    const reviewItems: any[] = [];
    const seenTexts = new Set<string>();

    for (let i = 0; i < reviewLinks.length; i++) {
      const link = reviewLinks[i];
      if (!link) continue;

      const text = link.textContent?.trim() || '';
      if (!text || seenTexts.has(text)) continue;

      // Find the review container (go up from the link)
      let reviewContainer = link.parentElement;
      for (let j = 0; j < 10 && reviewContainer; j++) {
        // Look for container with author element
        if (reviewContainer.querySelector('._1pi8bc0')) {
          break;
        }
        reviewContainer = reviewContainer.parentElement;
      }

      if (!reviewContainer) continue;

      // Skip official responses (company answers to reviews)
      const isOfficialResponse = reviewContainer.querySelector('._1evjsdb');
      if (isOfficialResponse) continue;

      // Extract author name
      const authorEl = reviewContainer.querySelector('._1pi8bc0');
      const authorText = authorEl?.textContent?.trim() || '';
      const authorMatch = authorText.match(/^(.+?)​(\\d+)\\s+отзыв/);
      const author = authorMatch ? authorMatch[1] : authorText.split('​')[0];

      // Extract date
      const dateEl = reviewContainer.querySelector('._a5f6uz');
      const dateCreated = dateEl?.textContent?.trim() || '';

      // Extract rating (count filled star SVGs)
      const stars = reviewContainer.querySelectorAll('svg[fill="currentColor"]');
      const rating = stars.length;

      // Generate a pseudo ID
      const id = `dom_${author}_${dateCreated}_${text.slice(0, 20)}`;

      reviewItems.push({
        id,
        text,
        rating,
        dateCreated,
        author,
        authorId: undefined,
        commentsCount: undefined,
        source: null,
        likes: undefined,
        dislikes: undefined,
      });

      seenTexts.add(text);
    }

    return reviewItems;
  });
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Review scraping combines multiple strategies with error handling and pagination
export async function scrapeReviews(
  page: Page,
  firmId: string,
  maxReviews: number,
  logger: Logger,
): Promise<Review[]> {
  const reviews: Review[] = [];
  const reviewIds = new Set<string>();

  try {
    const reviewsUrl = `https://2gis.ru/moscow/firm/${firmId}/tab/reviews`;
    logger.debug(`Navigating to reviews: ${reviewsUrl}`);

    await page.goto(reviewsUrl, {
      waitUntil: 'domcontentloaded',
      timeout: DEFAULT_NAVIGATION_TIMEOUT,
    });

    // Wait for initialState to be updated with reviews
    // biome-ignore lint/suspicious/noExplicitAny: Browser window object is dynamic
    await page.waitForFunction(() => typeof (window as any).initialState !== 'undefined', {
      timeout: 5000,
    });

    // Wait for reviews to render
    await page.waitForTimeout(500);

    // Step 1: Extract initial reviews from initialState (fast, first 50)
    const initialReviews = await extractReviewsFromInitialState(page);

    // Add initial reviews
    for (const review of initialReviews) {
      if (reviews.length >= maxReviews) break;
      if (!reviewIds.has(review.id)) {
        reviews.push(review);
        reviewIds.add(review.id);
      }
    }

    logger.debug(`Extracted ${reviews.length} reviews from initialState`);

    // Step 2: If we need more, scrape from DOM with pagination
    if (reviews.length < maxReviews) {
      let clickCount = 0;
      const maxClicks = 20; // Safety limit

      while (reviews.length < maxReviews && clickCount < maxClicks) {
        // Check if "Load more" button exists
        const loadMoreButton = await page.locator('button:has-text("Загрузить ещё")').first();
        const isVisible = await loadMoreButton.isVisible().catch(() => false);

        if (!isVisible) {
          logger.debug('No more "Load more" button, stopping pagination');
          break;
        }

        // Click to load more reviews
        await loadMoreButton.click();
        clickCount++;
        await page.waitForTimeout(1000);

        // Extract reviews from DOM
        const domReviews = await extractReviewsFromDOM(page);

        // Add new reviews
        let addedCount = 0;
        for (const review of domReviews) {
          if (reviews.length >= maxReviews) break;
          if (!reviewIds.has(review.id)) {
            reviews.push(review);
            reviewIds.add(review.id);
            addedCount++;
          }
        }

        logger.debug(
          `Click ${clickCount}: Added ${addedCount} new reviews (total: ${reviews.length})`,
        );

        if (addedCount === 0) {
          logger.debug('No new reviews after pagination, stopping');
          break;
        }
      }
    }

    const finalReviews = reviews.slice(0, maxReviews);
    logger.debug(`Extracted ${finalReviews.length} total reviews`);
    return finalReviews;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    logger.warn(`Failed to extract reviews: ${errorMsg}`);
  }

  return reviews.slice(0, maxReviews);
}
