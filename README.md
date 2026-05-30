# Labguru Performance, Load & Stress Tests

Performance testing suite for the Compound Registration & Chemistry Module.
Covers all 31 performance requirements from `docs/strees-tests/Performance-Requirements.md`.

## Tool Stack

| Tool | Scope |
|------|-------|
| **k6** | API/backend load testing (17 scenarios) |
| **Playwright** | UI & browser performance (9 tests) |
| **Ruby scripts** | DB seeding, job monitoring, dedup verification |
| **Cypress** | Functional regression tests (5 tests) — validates correctness, not timing |
| **Lighthouse CI** | Frontend rendering & bundle size regression gate |
| **Sentry** | Production performance observability (config templates) |

## Prerequisites

- **Node.js ≥ 22** (for Playwright, Cypress, Lighthouse CI)
- **k6** — `brew install k6` (macOS)
- **Ruby** — project Ruby version (for scripts run via `rails runner`)
- **RDKit (Python)** — for generating test SDF files
- **Dedicated performance environment** — never run against staging or production

## Setup

```bash
# From the perf/ directory:

# 1. Install Playwright dependencies
cd playwright && npm install && npx playwright install --with-deps chromium && cd ..

# 2. Configure environment
cp config/environments.json config/environments.local.json
# Edit config/environments.local.json with your target URL and API tokens

# 3. Generate test data (requires rails runner)
cd .. && bin/rails runner perf/scripts/seed_compounds.rb
bin/rails runner perf/scripts/generate_sdf.rb
bin/rails runner perf/scripts/generate_excel.rb
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PERF_BASE_URL` | Target application URL (e.g. `https://perf.labguru.com`) |
| `PERF_TOKEN_A` | API token for User A |
| `PERF_TOKEN_B` | API token for User B (same account, for PR-8 tests) |
| `PERF_SCALE` | Scale point: `100k`, `500k`, or `1m` |

## Running Tests

### k6 — API Load Tests

```bash
# Single scenario
k6 run k6/scenarios/pr1-api-create.js \
  -e BASE_URL=$PERF_BASE_URL \
  -e TOKEN=$PERF_TOKEN_A

# All API scenarios
for f in k6/scenarios/*.js; do
  k6 run "$f" -e BASE_URL=$PERF_BASE_URL -e TOKEN=$PERF_TOKEN_A \
    --out json=results/$(basename "$f" .js).json
done
```

### Playwright — UI Performance Tests

```bash
cd playwright
BASE_URL=$PERF_BASE_URL PERF_TOKEN=$PERF_TOKEN_A npx playwright test
```

### Ruby Scripts

```bash
# Seed database to target scale
bin/rails runner perf/scripts/seed_compounds.rb -- --scale 100k

# Monitor Sidekiq job completion
bin/rails runner perf/scripts/monitor_sidekiq.rb

# Verify parent dedup after PR-5 tests
bin/rails runner perf/scripts/verify_dedup.rb
```

### Cypress — Functional Regression Tests

```bash
cd cypress
npm install
npx cypress run --browser chrome
# Or open interactive runner:
npx cypress open
```

### Lighthouse CI — Frontend Rendering Audit

```bash
cd lighthouse
npm install
LHCI_BASE_URL=$PERF_BASE_URL LHCI_USERNAME=user@example.com LHCI_PASSWORD=secret \
  npx lhci autorun --config=lighthouserc.js
```

### Bundle Size Check

```bash
BASE_URL=$PERF_BASE_URL LHCI_AUTH_COOKIE="session=xxx" \
  ./scripts/check-bundle-size.sh
```

### Sentry — Production Observability

Sentry is not a test runner. See `perf/sentry/README.md` for configuration
templates to integrate into the application.

## Execution Phases

| Phase | Content | Parallel |
|-------|---------|----------|
| 1 | Infrastructure setup (helpers, config) | — |
| 2 | Test data preparation (seeding, file generation) | — |
| 3 | API performance tests (k6) | Yes, with Phase 4 |
| 4 | UI performance tests (Playwright) | Yes, with Phase 3 |
| 5 | Import & background job tests | After 3–4 baseline |
| 6 | Cross-cutting concurrency | After Phase 5 |

## Directory Structure

```
perf/
├── config/          # Environment URLs, API tokens, p95 thresholds
├── k6/
│   ├── helpers/     # Shared k6 utilities (auth, CRUD, polling)
│   ├── scenarios/   # One JS file per performance requirement
│   └── data/        # SMILES CSVs, bulk JSON payloads
├── playwright/
│   ├── helpers/     # Login, timing, Ketcher interaction
│   ├── tests/       # One spec per UI requirement
│   └── fixtures/    # MOL, CDXML, CDX test files
├── cypress/
│   ├── e2e/         # Functional regression tests (not performance)
│   ├── fixtures/    # Test Excel files for import validation
│   └── support/     # Login command, global hooks
├── lighthouse/      # Lighthouse CI config & login script
├── sentry/          # Sentry SDK config templates & alert rules
├── scripts/         # Ruby scripts + bundle-size check
├── imports/         # Generated SDF/Excel test files (Git LFS)
└── results/         # k6 JSON/HTML + Lighthouse reports (gitignored)
```
# streser
