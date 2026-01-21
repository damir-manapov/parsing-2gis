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
bun scripts/scrape-search.ts --query "кальян" --max-records 50 --delay 2000
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
- **Dual Sources**: Captures both API responses and `window.initialState` (SSR)
- **Progress Tracking**: Real-time counters and structured logging
- **Reliability**: Browser handles authentication and session management

### Data Output

Scraped data is saved in two formats:
- **Raw data** (`data/raw/`): Complete API responses and initialState dumps
- **Parsed data** (`data/parsed/`): Extracted fields (name, address, phone, website, rating, rubrics)
