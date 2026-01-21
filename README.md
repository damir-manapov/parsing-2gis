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
