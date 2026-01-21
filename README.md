# parsing-2gis

A TypeScript tool for scraping 2GIS organization data using Playwright browser automation.

## Requirements

- Node.js 22+
- bun (or pnpm)
- Playwright (installed automatically)
- gitleaks (for security checks)

## Installation

```bash
pnpm install
# Playwright will install automatically, or run:
npx playwright install chromium
```

## Usage

The scraper uses Playwright to extract organization data from 2GIS search results:

```bash
bun scripts/scrape-search.ts --query "кальян" --max-records 50 --delay 2000
```

### Scraper Options

- `--query` - Search query (default: "кальян")
- `--max-records` - Maximum results to scrape (default: 50)
- `--delay` - Delay between requests in ms (default: 2000)
- `--max-retries` - Retry attempts for failed operations (default: 3)
- `--headless` - Run browser in headless mode (default: true)
- `--include-reviews` - Extract reviews for each organization (default: false)
- `--max-reviews` - Maximum reviews per organization (default: 100, **unlimited with DOM pagination**)

### Examples

```bash
# Basic scraping
bun scripts/scrape-search.ts --query "ресторан" --max-records 10

# Include reviews (up to 50 from initialState)
bun scripts/scrape-search.ts --query "кафе" --max-records 5 --include-reviews true --max-reviews 50

# Extract more reviews with pagination (slower)
bun scripts/scrape-search.ts --query "ресторан" --max-records 3 --include-reviews true --max-reviews 200

# Visible browser (non-headless)
bun scripts/scrape-search.ts --query "кальян" --headless false
```

## Data Storage

API results are stored in the `data/` folder (gitignored).

## Development

```bash
pnpm dev
```

## Scripts

### Scraper

```bash
# Scrape organizations with Playwright
bun scripts/scrape-search.ts --query "кальян" --max-records 50

# Include reviews (up to 50 per organization, fast)
bun scripts/scrape-search.ts --query "ресторан" --max-records 10 --include-reviews true --max-reviews 50

# Extract unlimited reviews with pagination (slower)
bun scripts/scrape-search.ts --query "кафе" --max-records 3 --include-reviews true --max-reviews 200
```

### Development Scripts

- `pnpm dev` - Run in watch mode
- `pnpm start` - Run the application
- `pnpm build` - Type check
- `pnpm lint` - Check linting
- `pnpm lint:fix` - Fix linting issues
- `pnpm format` - Format code
- `pnpm test` - Run tests
- `pnpm test:watch` - Run tests in watch mode

## Quality Checks

```bash
./check.sh      # Format, lint, typecheck, tests
./health.sh     # Gitleaks, outdated deps, vulnerabilities
./all-checks.sh # Run all checks
```

## Installing gitleaks

If gitleaks is not installed, you can install it via:

```bash
# Using Homebrew (macOS/Linux)
brew install gitleaks

# Using apt (Debian/Ubuntu)
sudo apt install gitleaks

# Using go
go install github.com/gitleaks/gitleaks/v8@latest
```

## Why Playwright?

Direct 2GIS API usage has significant limitations:

### API Challenges

1. **Session-based IDs**: Organization IDs from search results expire quickly and require matching `search_ctx`
2. **Complex Authentication**: Multiple parameters (viewpoints, r values, context_rubrics) required
3. **Version Routing Issues**: Malformed requests fall back to API v2 which blocks keys
4. **Hash Suffixes**: ByID endpoint requires special ID format with hash suffixes

### Playwright Solution

Browser automation handles all complexity automatically:
- **Request Blocking**: Disables images, fonts, stylesheets, analytics for speed
- **Retry Logic**: Exponential backoff with configurable attempts
- **Data Source**: Extracts from `window.initialState` (instant, reliable)
- **Progress Tracking**: Real-time counters with detailed timing breakdowns
- **Review Extraction**: Optional scraping from `/tab/reviews` page
- **Performance**: ~1.4s per organization (without reviews), ~2.6s with reviews
- **Reliability**: Browser handles authentication and session management

### Extracted Data

Each organization includes:
- **Basic Info**: Name, description, address, phone, email, website
- **Location**: Coordinates, nearest metro stations (top 3 with lines/colors)
- **Business Details**: Schedule, rubrics, payment methods, features
- **Organization**: Org ID, branch count, photo count
- **Ratings**: Branch-level, organization-wide, and per-platform ratings
- **Review Summary**: Aggregated ratings from multiple sources (2GIS, Flamp)
- **Reviews** (optional): Full review texts with author, date, rating, engagement metrics

### Review Extraction

The scraper supports two methods for extracting reviews:

**1. Fast extraction (default, up to 50 reviews)**
- Extracts from `window.initialState` on `/tab/reviews` page
- Speed: ~1.3s per organization
- Includes: Review ID, text, rating, author, dates, likes/dislikes, source
- Limitation: 2GIS only loads 50 reviews into initialState

**2. Unlimited extraction (with DOM pagination)**
- First gets 50 reviews from initialState (fast)
- Then clicks "Load more" button and scrapes from DOM
- Each click loads ~15-30 more reviews
- Speed: ~1s per pagination click
- Fields: Review text, author, date, rating (no engagement metrics from DOM)
- Limitation: Slower, class-based selectors may break if 2GIS changes DOM structure

**Example performance:**
- 50 reviews: ~1.3s
- 100 reviews: ~2.3s (50 fast + 1 click)
- 150 reviews: ~3.3s (50 fast + 2 clicks)

To extract more than 50 reviews:
```bash
bun scripts/scrape-search.ts --query "ресторан" --max-records 3 --include-reviews true --max-reviews 150
```

### Data Output

Scraped data is saved in two formats:
- **Raw data** (`data/raw/`): Organization data from initialState (optimized, 93% smaller)
- **Parsed data** (`data/parsed/`): Structured JSON with 25+ extracted fields per organization

## Performance

The scraper is highly optimized for speed:

- **~1.4s per organization** (without reviews)
  - Navigation: 1.1-1.6s
  - Wait for initialState: 10-15ms
  - Data extraction: ~95ms

- **~2.6s per organization** (with up to 50 reviews)
  - Organization data: ~1.4s
  - Review extraction: ~1.3s (fast initialState extraction)

- **~3-5s per organization** (with 100-200 reviews)
  - Organization data: ~1.4s
  - Review extraction: ~1.3s (first 50) + ~1s per pagination click

**Optimizations:**
- No unnecessary sleep delays
- Direct URL navigation (no back button)
- Request blocking (images, fonts, analytics)
- Instant data from `window.initialState`
- 93% reduction in raw data file size
- Hybrid approach: Fast initialState + DOM pagination for unlimited reviews

**Example:** 
- Scraping 10 organizations: ~14 seconds
- With 50 reviews each: ~26 seconds (~2.6s per org)
- With 100 reviews each: ~37 seconds (~3.7s per org)
