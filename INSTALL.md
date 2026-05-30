# Tool Installation Guide

Step-by-step instructions for installing every tool required by the Labguru stress-test suite.

---

## Prerequisites

| Requirement | Minimum Version |
|---|---|
| macOS / Linux | macOS 13+ or Ubuntu 20.04+ |
| Node.js | 18 LTS or newer |
| npm | 9+ (ships with Node.js) |
| Ruby | 3.4 (managed by mise — see project root `mise.toml`) |
| Bundler | 2.x |

---

## 1. k6 (Grafana)

k6 is the load-testing tool used for all API stress tests (`perf/k6/scenarios/*.js`).

### macOS (Homebrew)

```bash
brew install k6
```

### macOS (without Homebrew)

Download the binary from the [k6 releases page](https://github.com/grafana/k6/releases):

```bash
curl -LO https://github.com/grafana/k6/releases/latest/download/k6-macos-amd64.zip
unzip k6-macos-amd64.zip
sudo mv k6 /usr/local/bin/
```

For Apple Silicon (M1/M2/M3/M4):

```bash
curl -LO https://github.com/grafana/k6/releases/latest/download/k6-macos-arm64.zip
unzip k6-macos-arm64.zip
sudo mv k6 /usr/local/bin/
```

### Linux (Debian/Ubuntu)

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Linux (other distros)

```bash
# Download the static binary
curl -LO https://github.com/grafana/k6/releases/latest/download/k6-linux-amd64.tar.gz
tar xzf k6-linux-amd64.tar.gz
sudo mv k6-linux-amd64/k6 /usr/local/bin/
```

### Docker

```bash
docker pull grafana/k6
# Run a test
docker run --rm -v $(pwd)/perf:/perf grafana/k6 run /perf/k6/scenarios/pr1-api-create.js \
  -e BASE_URL=https://perf.labguru.com -e TOKEN=your_token -e TIER=simple
```

### Verify installation

```bash
k6 version
# Expected: k6 v0.50.0 or newer
```

---

## 2. Playwright

Playwright is used for all UI performance tests (`perf/playwright/tests/*.spec.ts`).

### Install Playwright and browser binaries

```bash
cd perf/playwright
npm install
npx playwright install chromium
```

`npm install` installs `@playwright/test` (version ^1.48.0) from `perf/playwright/package.json`.
`npx playwright install chromium` downloads the Chromium browser binary that Playwright uses. Only Chromium is needed (the performance tests are configured for `Desktop Chrome` only).

### System dependencies (Linux only)

On Linux, Playwright needs certain system libraries. Install them with:

```bash
npx playwright install-deps chromium
```

This installs required packages like `libgbm`, `libnss3`, `libatk-bridge2.0`, etc.

### Verify installation

```bash
cd perf/playwright
npx playwright test --list
# Should list all *.spec.ts tests without errors
```

---

## 3. Ruby & Bundler

Ruby is used for the support scripts (`perf/scripts/*.rb`): database seeding, SDF/Excel generation, Sidekiq monitoring, and dedup verification.

### Ruby version

The project uses Ruby 3.4, managed by [mise](https://mise.jdx.dev/) (see `mise.toml` in the project root).

```bash
# Install mise (if not already installed)
brew install mise    # macOS
# or
curl https://mise.jdx.dev/install.sh | sh    # Linux/macOS

# Install the project's Ruby version
mise install

# Verify
ruby --version
# Expected: ruby 3.4.x
```

### Bundler and gems

The Ruby scripts use gems from the main project Gemfile (Rails, Sidekiq, caxlsx):

```bash
# From project root
bundle install
```

Key gems used by the perf scripts:

| Gem | Used by | Purpose |
|---|---|---|
| `rails` (activerecord) | `seed_compounds.rb`, `verify_dedup.rb` | Database access via `Compound` model |
| `sidekiq` | `monitor_sidekiq.rb` | `Sidekiq::Stats`, `Sidekiq::Queue` API |
| `caxlsx` (axlsx) | `generate_excel.rb` | XLSX file generation |

No additional gem installation is needed beyond the standard `bundle install`.

### Verify installation

```bash
bundle exec ruby -e "require 'axlsx'; puts 'caxlsx OK'"
bundle exec ruby -e "require 'sidekiq/api'; puts 'sidekiq OK'"
```

---

## 4. Cypress

Cypress is used for functional regression tests (`perf/cypress/e2e/*.cy.js`).
These validate correctness (import reports, grid behavior, file uploads) — not timing.

### Install

```bash
cd perf/cypress
npm install
```

### Verify installation

```bash
cd perf/cypress
npx cypress verify
# Should print "Verified" with the Cypress version
```

### First run (opens interactive browser)

```bash
CYPRESS_BASE_URL=https://perf.labguru.com \
CYPRESS_PERF_EMAIL=user@example.com \
CYPRESS_PERF_PASSWORD=secret \
  npx cypress open
```

### Headless CI run

```bash
npx cypress run --browser chrome --config-file cypress.config.js
```

> **Note:** Cypress downloads a browser binary (~250 MB) on first install.
> For CI, use the `cypress/included` Docker image which bundles everything.

---

## 5. Lighthouse CI

Lighthouse CI audits frontend rendering performance and bundle size.
Used to gate PRs on LCP, TTI, CLS, and total JS weight.

### Install

```bash
cd perf/lighthouse
npm install
```

Or install globally:

```bash
npm install -g @lhci/cli@0.13.x
```

### Verify installation

```bash
npx lhci --version
# Expected: 0.13.x
```

### Run audits

```bash
cd perf/lighthouse
LHCI_BASE_URL=https://perf.labguru.com \
LHCI_USERNAME=user@example.com \
LHCI_PASSWORD=secret \
  npx lhci autorun --config=lighthouserc.js
```

Results are saved to `perf/results/lighthouse/`.

---

## 6. Sentry (Production Observability)

Sentry is a production monitoring tool, not a test runner. No separate install is needed
for the perf suite. Configuration templates are in `perf/sentry/`.

### Ruby SDK (Rails)

Add to `Gemfile`:

```ruby
gem 'sentry-ruby'
gem 'sentry-rails'
gem 'sentry-sidekiq'
```

Then:

```bash
bundle install
```

Copy `perf/sentry/sentry_rails.rb` to `config/initializers/sentry.rb`.

### React SDK (Frontend)

```bash
npm install @sentry/react @sentry/tracing
```

Merge `perf/sentry/sentry_react.ts` into your React entry point.

### Environment variables

```bash
export SENTRY_DSN="https://xxx@sentry.io/yyy"
export REACT_APP_SENTRY_DSN="https://xxx@sentry.io/zzz"
```

---

## 7. Environment Variables

All tools require environment variables for authentication and target URLs. Set them before running tests:

```bash
# Required for k6
export BASE_URL="https://perf.labguru.com"
export TOKEN="your_api_token_for_user_a"
export TOKEN_B="your_api_token_for_user_b"   # only for PR-8 cross-user test

# Required for Playwright
export BASE_URL="https://perf.labguru.com"
export PERF_TOKEN="your_api_token"
export PERF_EMAIL="perf-user@labguru.com"
export PERF_PASSWORD="your_password"
export PERF_COMPOUND_ID="1"                   # existing compound ID for edit tests

# Required for Cypress
export CYPRESS_BASE_URL="https://perf.labguru.com"
export CYPRESS_PERF_EMAIL="perf-user@labguru.com"
export CYPRESS_PERF_PASSWORD="your_password"

# Required for Lighthouse CI
export LHCI_BASE_URL="https://perf.labguru.com"
export LHCI_USERNAME="perf-user@labguru.com"
export LHCI_PASSWORD="your_password"
export LHCI_AUTH_COOKIE="session=xxx"         # for bundle-size script
export LHCI_COMPOUND_ID="12345"               # compound ID for edit page audit

# Required for Sentry (production only)
export SENTRY_DSN="https://xxx@sentry.io/yyy"
export REACT_APP_SENTRY_DSN="https://xxx@sentry.io/zzz"

# Required for Ruby scripts
export RAILS_ENV="performance"
```

Or create a `.env` file in `perf/` (it is git-ignored):

```bash
# perf/.env
BASE_URL=https://perf.labguru.com
TOKEN=your_api_token
TOKEN_B=your_api_token_user_b
PERF_TOKEN=your_api_token
PERF_EMAIL=perf-user@labguru.com
PERF_PASSWORD=your_password
PERF_COMPOUND_ID=1
RAILS_ENV=performance
```

---

## Quick Verification Checklist

Run these commands from the project root to confirm everything is installed:

```bash
# k6
k6 version

# Playwright
cd perf/playwright && npx playwright test --list && cd ../..

# Cypress
cd perf/cypress && npx cypress verify && cd ../..

# Lighthouse CI
cd perf/lighthouse && npx lhci --version && cd ../..

# Ruby gems
bundle exec ruby -e "puts 'Ruby OK: ' + RUBY_VERSION"
bundle exec ruby -e "require 'axlsx'; require 'sidekiq/api'; puts 'Gems OK'"

# Node.js
node --version
npm --version
```

All commands should complete without errors. You are ready to run the stress tests.

---

## Troubleshooting

### k6: "command not found"

Ensure `/usr/local/bin` (or the Homebrew bin path) is in your `$PATH`:

```bash
echo $PATH | tr ':' '\n' | grep -E 'local|brew'
```

### Playwright: browser launch fails on macOS

If you see "browser was not downloaded", re-run the install:

```bash
cd perf/playwright
npx playwright install chromium --force
```

### Playwright: missing system dependencies (Linux)

```bash
npx playwright install-deps chromium
```

### Ruby: "cannot load such file -- axlsx"

Make sure you ran `bundle install` from the project root, and are using `bundle exec` to run scripts:

```bash
bundle install
RAILS_ENV=performance bundle exec ruby perf/scripts/generate_excel.rb 100
```

### mise: wrong Ruby version

```bash
mise install         # installs the version from mise.toml
mise use ruby@3.4    # activates it
ruby --version
```

### Cypress: "No version of Cypress is installed"

```bash
cd perf/cypress
npx cypress install
npx cypress verify
```

### Cypress: browser not found on Linux CI

Use the `cypress/included` Docker image which bundles Chrome:

```bash
docker run --rm -v $(pwd):/e2e -w /e2e cypress/included:13.6.0 \
  --config-file perf/cypress/cypress.config.js
```

### Lighthouse CI: "lhci: command not found"

```bash
cd perf/lighthouse && npm install
# or globally:
npm install -g @lhci/cli
```

### Lighthouse CI: audits fail with "Page requires authentication"

Ensure the `lighthouse-login.js` puppeteer script is working. Test login manually:

```bash
LHCI_USERNAME=user@example.com LHCI_PASSWORD=secret \
  npx lhci collect --config=lighthouserc.js --url=https://perf.labguru.com/
```
