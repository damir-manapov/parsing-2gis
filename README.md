# parsing-2gis

A TypeScript tool for scraping 2GIS organization data using Playwright browser automation with a modular architecture.

## Features

- **Modular Architecture**: Clean separation of concerns (browser, helpers, single-org scraping, repository)
- **Two-Stage Workflow**: Fast list collection → detailed scraping from saved lists
- **Three Scraping Modes**: List (basic), Full (detailed), Full-with-Reviews (detailed + reviews)
- **Organization by ID**: Direct scraping of specific organizations
- **Smart Data Storage**: Organized by mode with individual org files and manifests
- **Performance Optimized**: Request blocking, instant data extraction, retry logic

## Requirements

- Node.js 22+
- Bun (or pnpm)
- Playwright (installed automatically)
- gitleaks (for security checks)

## Installation

```bash
pnpm install
# Playwright will install automatically, or run:
npx playwright install chromium
```

## Usage

### Two-Stage Workflow (Recommended)

**Stage 1: Collect organization IDs from search**
```bash
bun scripts/scrape.ts --query "кальян" --mode list --max-records 100
```
This creates a list file in `data/parsed/list/` with organization IDs.

**Stage 2: Scrape full details from saved list**
```bash
# Single list file
bun scripts/scrape.ts --from-list data/parsed/list/list-кальян-2026-01-23T14-25-11-633Z.json --mode full-with-reviews --max-reviews 100

# Or batch process all list files
for f in data/parsed/list/*.json; do
  bun scripts/scrape.ts --from-list "$f" --mode full-with-reviews --max-reviews 100
done
```

### Single-Stage Workflow

**List mode (basic data only)**
```bash
bun scripts/scrape.ts --query "ресторан" --mode list --max-records 50
```

**Full mode (detailed data)**
```bash
bun scripts/scrape.ts --query "кафе" --mode full --max-records 10
```

**Full-with-reviews mode (detailed data + reviews)**
```bash
bun scripts/scrape.ts --query "бар" --mode full-with-reviews --max-records 5 --max-reviews 100
```

### Exporting Reviews Dataset

After scraping reviews, export them as a simple dataset for ML/analysis:

```bash
# Export as JSONL (default)
bun scripts/export-reviews-dataset.ts --format jsonl

# Export as CSV
bun scripts/export-reviews-dataset.ts --format csv

# Custom output directory
bun scripts/export-reviews-dataset.ts --format jsonl --output data/exports
```

Outputs:
- `data/exports/reviews-dataset.jsonl` - One JSON object per line: `{"text":"...", "rating":5}`
- `data/exports/reviews-dataset.csv` - CSV format: `rating,text`

### Organization by ID

```bash
bun scripts/scrape.ts --org-id 70000001044609041 --mode full
bun scripts/scrape.ts --org-id 70000001044609041 --mode full-with-reviews --max-reviews 150
```

### Publishing to Hugging Face

After scraping data, you can publish it as a dataset:

```bash
# Prepare dataset for upload
bun scripts/publish-to-hf.ts --dataset-name "tebuchet/org-reviews" --mode full

# Follow the instructions to upload using HF CLI
huggingface-cli login
huggingface-cli repo create tebuchet/org-reviews --type dataset
huggingface-cli upload tebuchet/org-reviews data/hf-dataset-full.jsonl train.jsonl
huggingface-cli upload tebuchet/org-reviews data/hf-README.md README.md
```

**Published dataset**: [tebuchet/org-reviews](https://huggingface.co/datasets/tebuchet/org-reviews)

See [Publishing to Hugging Face Guide](docs/PUBLISHING_TO_HF.md) for detailed instructions.

### Scraper Options

- `--query` - Search query (required for list mode)
- `--org-id` - Scrape specific organization by ID
- `--from-list` - Path to list file from Stage 1
- `--mode` - Scraping mode: `list`, `full`, `full-with-reviews` (default: `full`)
- `--max-records` - Maximum results to scrape (default: 50)
- `--max-reviews` - Maximum reviews per organization (default: 100)
- `--delay` - Delay between requests in ms (default: 2000)
- `--max-retries` - Retry attempts for failed operations (default: 3)
- `--headless` - Run browser in headless mode (default: `true`)

## Data Storage

Data is organized by scraping mode in the `data/` folder (gitignored):

```
data/
├── raw/
│   ├── list/              # Raw search results
│   ├── full/
│   │   └── organizations/ # Raw organization data
│   └── full-with-reviews/
│       └── organizations/ # Raw org data with reviews
├── parsed/
│   ├── list/              # Parsed list files (for Stage 2)
│   ├── full/
│   │   ├── organizations/ # Individual org files: {orgId}-{timestamp}.json
│   │   └── manifests/     # Batch metadata
│   ├── full-with-reviews/
│   │   ├── organizations/ # Individual org files with reviews
│   │   ├── reviews/       # Aggregated reviews
│   │   └── manifests/     # Batch metadata
│   └── organizations/     # Org-by-ID mode outputs
└── exports/               # Prepared datasets (reviews-dataset.jsonl/csv)
```

## Development

```bash
pnpm dev
```

## Development Scripts

- `pnpm dev` - Run in watch mode
- `pnpm start` - Run the application
- `pnpm build` - Type check
- `pnpm lint` - Check linting
- `pnpm lint:fix` - Fix linting issues
- `pnpm format` - Format code
- `pnpm test` - Run tests
- `pnpm test:watch` - Run tests in watch mode

## Architecture

The scraper is organized into focused modules:

**Scraper Core:**
- **`src/scraper/browser.ts`** - Browser session management and request blocking
- **`src/scraper/helpers.ts`** - Retry logic, data extraction utilities
- **`src/scraper/single-org.ts`** - Single organization scraping (with/without reviews)
- **`src/scraper/index.ts`** - Main orchestration (list search, fromList batch, org-by-id)

**Data Layer:**
- **`src/repository.ts`** - Scraping data persistence (list files, organizations, reviews)
- **`src/publisher-repository.ts`** - Publishing data operations (collect files, convert to JSONL)

**Export & Publishing:**
- **`src/exporter.ts`** - Export reviews to dataset formats (JSONL, CSV)
- **`src/publisher.ts`** - Generate HF dataset cards and upload instructions

**Utilities:**
- **`src/utils.ts`** - Generic utilities (Logger, parseArgs, slugify, etc.)
- **`src/config.ts`** - API configuration
- **`src/errors.ts`** - Custom error classes

**CLI Scripts:**
- **`scripts/scrape.ts`** - Main scraping CLI
- **`scripts/export-reviews-dataset.ts`** - Export reviews to datasets
- **`scripts/publish-to-hf.ts`** - Prepare HF dataset uploads

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

**1. Fast extraction (up to 50 reviews)**
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

**Usage:**
```bash
# Fast (up to 50 reviews)
bun scripts/scrape.ts --query "ресторан" --mode full-with-reviews --max-records 3

# Unlimited (with pagination)
bun scripts/scrape.ts --query "ресторан" --mode full-with-reviews --max-records 3 --max-reviews 150
```

### Performance

**List Mode:**
- **~0.3s per organization** (basic data from search results)
- No individual page navigation required
- Ideal for collecting organization IDs for Stage 2

**Full Mode:**
- **~1.4s per organization** (without reviews)
  - Navigation: 1.1-1.6s
  - Wait for initialState: 10-15ms
  - Data extraction: ~95ms

**Full-with-Reviews Mode:**
- **~2.6s per organization** (with up to 50 reviews)
  - Organization data: ~1.4s
  - Review extraction: ~1.3s (fast initialState extraction)

- **~3-5s per organization** (with 100-200 reviews)
  - Organization data: ~1.4s
  - Review extraction: ~1.3s (first 50) + ~1s per pagination click

**Two-Stage Workflow Performance:**
- Stage 1 (list): 100 orgs in ~30 seconds
- Stage 2 (full): 10 orgs in ~14 seconds
- **Benefit**: Collect many IDs fast, then selectively scrape details

**Optimizations:**
- No unnecessary sleep delays
- Direct URL navigation (no back button)
- Request blocking (images, fonts, analytics)
- Instant data from `window.initialState`
- 93% reduction in raw data file size
- Hybrid approach: Fast initialState + DOM pagination for unlimited reviews
- Individual file per org for parallel processing

**Example Timings:**
- Scraping 10 organizations: ~14 seconds
- With 50 reviews each: ~26 seconds (~2.6s per org)
- With 100 reviews each: ~37 seconds (~3.7s per org)
