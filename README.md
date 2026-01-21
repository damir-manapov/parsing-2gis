# parsing-2gis

A TypeScript library for parsing 2GIS search API data.

## Requirements

- Node.js 22+
- pnpm (or bun)
- gitleaks (for security checks)

## Installation

```bash
pnpm install
```

## Configuration

Set the `TWOGIS_API_KEY` environment variable:

```bash
export TWOGIS_API_KEY=your-api-key-here
```

You can get the API key by inspecting network requests on 2gis.ru.

## Usage

```typescript
import { searchOrganizations } from './src/api.js';

const orgs = await searchOrganizations({
  query: 'кальян',
  viewpoint1: { lon: 37.556366, lat: 55.926069 },
  viewpoint2: { lon: 37.683974, lat: 55.581373 },
});
```

### Run Example

```bash
bun scripts/example.ts
```

## Data Storage

API results are stored in the `data/` folder (gitignored).

## Development

```bash
pnpm dev
```

## Scripts

### Available Scripts

```bash
# Search using 2GIS API (basic search without details)
bun scripts/search-basic.ts --query "кальян"

# Scrape using Playwright (full details with browser automation)
bun scripts/scrape-search.ts --query "кальян" --max-records 50 --delay 2000

# Fetch by ID (requires special ID format with hash)
bun scripts/fetch-by-id.ts

# Enrich search results (experimental - API session issues)
bun scripts/enrich-search.ts --query "кальян"
```

### Scraper Options

The Playwright scraper supports:
- `--query` - Search query (default: "кальян")
- `--max-records` - Maximum results to scrape (default: 50)
- `--delay` - Delay between requests in ms (default: 2000)
- `--max-retries` - Retry attempts for failed operations (default: 3)

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

## API Findings

### 2GIS Catalog API v3.0

The 2GIS API has some quirks that were discovered during development:

#### API Version Routing

The API has two versions: v2 and v3. Requests may fall back to v2 (which blocks the key) if the URL is "malformed". Key findings:

1. **Check `meta.api_version` in responses** - If it starts with `2.0.x` instead of `3.0.x`, the URL is malformed
2. **Error responses include version info** - Helps debug why requests fail

#### Required Parameters for API v3

For the `/byid` endpoint to use API v3, these parameters are required:

- `viewpoint1` and `viewpoint2` - Viewport coordinates
- `search_ctx` - Search context with encoded rubric IDs (e.g., `0:r%3D110357%3B1:a%3D70000201006757123...`)
- `context_rubrics[0]` - Context rubric ID
- `r=1138174652` - A specific fixed value (changing this causes fallback to v2)
- Full `fields` list - Must include ~90 fields for v3 routing

#### ID Format for ByID Endpoint

The `/byid` endpoint requires a special ID format with a hash suffix:
```
70000001058714012_yswekqghdBdB9A822J7H1J2JHG2IGHGJb9c7ilhx39...
```

Plain numeric IDs like `70000001058714012` will return 403 errors.

#### Search vs ByID Endpoints

- **Search** (`/items`): Returns basic organization data, works with simpler parameters
- **ByID** (`/items/byid`): Returns full details including contacts (website, email, telegram, vkontakte), requires complex parameters

## Scraping Approach

Due to API limitations (session-based IDs, complex authentication), this project uses **Playwright** for reliable data extraction:

### Features

- **Request Blocking**: Disables images, fonts, stylesheets, and analytics for faster scraping
- **Retry Logic**: Exponential backoff with configurable attempts (default: 3)
- **Structured Logging**: Timestamped logs with progress tracking
- **Dual Data Sources**: Captures both API responses and `window.initialState` (server-side rendering)
- **Progress Tracking**: Real-time counters showing success/failure rates
- **Configurable Limits**: Max records, delays, and retry attempts

### Why Playwright?

1. **Session IDs**: 2GIS uses session-based IDs that expire quickly
2. **Complex Auth**: Multiple authentication parameters required
3. **Hybrid Loading**: Data comes from both API calls and pre-rendered state
4. **Reliability**: Browser automation handles all authentication automatically

### Data Output

Scraped data is saved in two formats:
- **Raw data** (`data/raw/`): Complete API responses and initialState dumps (9MB+)
- **Parsed data** (`data/parsed/`): Extracted fields (name, address, phone, website, rating, rubrics)
