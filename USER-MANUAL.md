# strester — User Manual

**strester** is the performance test runner for Labguru. It wraps k6, Playwright, Cypress, Lighthouse, and Ruby scripts into a single CLI, reads configuration from one central file, writes all results into versioned folders, and generates both human-readable and machine-readable reports.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Configuration](#2-configuration)
3. [Environment Variables](#3-environment-variables)
4. [Commands Reference](#4-commands-reference)
   - [setup](#41-strester-setup)
   - [run \<file\>](#42-strester-run-file)
   - [run all](#43-strester-run-all)
   - [run folder](#44-strester-run-folder)
   - [monitor](#45-strester-monitor)
   - [list tests](#46-strester-list-tests)
   - [stop](#47-strester-stop)
   - [summary](#48-strester-summary)
   - [report](#49-strester-report)
   - [config](#410-strester-config)
5. [Test Files](#5-test-files)
6. [Results Directory Structure](#6-results-directory-structure)
7. [Output Files Explained](#7-output-files-explained)
   - [k6 — CSV data file](#71-k6--csv-data-file)
   - [k6 — summary JSON](#72-k6--summary-json)
   - [k6 — log file](#73-k6--log-file)
   - [Playwright — results JSON](#74-playwright--results-json)
   - [Playwright — HTML report](#75-playwright--html-report)
   - [Cypress — results JSON](#76-cypress--results-json)
   - [Lighthouse — report JSON](#77-lighthouse--report-json)
8. [Report Files Explained](#8-report-files-explained)
   - [TXT report](#81-txt-report)
   - [JSON report](#82-json-report)
9. [Typical Workflows](#9-typical-workflows)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Quick Start

```bash
# 1. Install all required tools (first time only)
bin/strester setup

# 2. Set your API token
export PERF_TOKEN_USER_A=your_api_token_here

# 3. Edit the target URL and version
#    perf/config/strester.json → target.base_url, target.version

# 4. Run a single test
bin/strester run k6/scenarios/pr0-base-url-load.js

# 5. Run everything
bin/strester run all

# 6. Generate a report
bin/strester report
```

All output lands in `perf/results/<Name>-<Version>/`.

---

## 2. Configuration

**File:** `perf/config/strester.json`

```json
{
  "target": {
    "name": "Labguru",
    "version": "v6.41.2",
    "base_url": "http://admin.lvh.me:3000/auth/login",
    "start_page_url": ""
  },
  "auth": {
    "user_a_token_env": "PERF_TOKEN_USER_A",
    "user_b_token_env": "PERF_TOKEN_USER_B"
  },
  "admin_login": {
    "email": "admin.example.com",
    "password_env": "PERF_ADMIN_PASSWORD",
    "login_path": "/auth/login",
    "tenants_path": "/admin/resources/tenants"
  },
  "output": {
    "format": "csv",
    "results_dir": "perf/results"
  }
}
```

| Field | Description |
|---|---|
| `target.name` | Product name — used as the results folder prefix |
| `target.version` | Release version — appended to the folder name (`Labguru-v6.41.2`) |
| `target.base_url` | Base URL all tests run against |
| `target.start_page_url` | Optional URL with auth token embedded for Lighthouse login |
| `auth.user_a_token_env` | Name of the env var that holds User A's API token |
| `auth.user_b_token_env` | Name of the env var that holds User B's API token |
| `admin_login.email` | Admin username / email for form-based login tests (PR-13) |
| `admin_login.password_env` | Name of the env var holding the admin password — never store the password value here |
| `admin_login.login_path` | Path of the login form page (default: `/auth/login`) |
| `admin_login.tenants_path` | Path of the admin tenants page measured by PR-13 |
| `output.format` | k6 raw output format: `csv` (default) or `json` |
| `output.results_dir` | Root folder for all results (relative to repo root) |

> **Before each release test cycle:** update `target.version` and `target.base_url` so results land in a new versioned folder and don't overwrite previous runs.

---

## 3. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PERF_TOKEN_USER_A` | Yes | API token for the primary test user. Passed to k6 as `--env TOKEN` and to Playwright/Cypress via `BASE_URL` auth. If not set, strester will prompt you to enter it. |
| `PERF_TOKEN_USER_B` | For cross-user tests | API token for a second user. Used by tests that verify multi-user isolation (e.g. `pr8-cross-user`). |
| `PERF_EMAIL` | For Cypress | Login email for Cypress UI tests that use form-based login. |
| `PERF_PASSWORD` | For Cypress | Login password for Cypress UI tests. |
| `PERF_ADMIN_EMAIL` | For PR-13 | Admin username / email for the login-to-tenants test. Defaults to the value in `strester.json → admin_login.email`. |
| `PERF_ADMIN_PASSWORD` | For PR-13 | Admin password. **Never commit this value** — always pass via env var. |
| `BASE_URL` | Optional override | Overrides `target.base_url` from config at runtime. |

Set them in your shell before running:

```bash
export PERF_TOKEN_USER_A=abc123
export PERF_TOKEN_USER_B=def456
export PERF_EMAIL=tester@example.com
export PERF_PASSWORD=secret
export PERF_ADMIN_PASSWORD=SecurePassword123!
```

---

## 4. Commands Reference

### 4.1 `strester setup`

Installs all required tools and scaffolds the folder tree.

```bash
bin/strester setup
```

**What it does:**

- Checks which tools are already installed (k6, Node.js, Playwright, Cypress, Lighthouse CI, Sentry CLI, jq)
- Prompts you to select which missing tools to install
- Runs the appropriate `brew install` / `npm install -g` commands
- Creates any missing folders under `perf/`

**Run this once** on a new machine or after cloning the repo.

---

### 4.2 `strester run <file>`

Runs a single test file. The tool is auto-detected from the file path.

```bash
# k6 API load test
bin/strester run k6/scenarios/pr0-base-url-load.js

# Playwright UI test
bin/strester run playwright/tests/pr0-base-url-load.spec.ts

# Cypress functional test
bin/strester run cypress/e2e/pr0-base-url-load.cy.js

# Lighthouse base URL audit (no auth)
bin/strester run lighthouse/lighthouse-base.js

# Lighthouse authenticated tenants audit (PR-13)
bin/strester run lighthouse/lighthouserc.js

# Run in quiet mode — shows spinner instead of live output
bin/strester run k6/scenarios/pr3-index.js -q

# Run in background (non-blocking)
bin/strester run k6/scenarios/pr3-index.js --bg
```

**Tool auto-detection rules:**

| File path pattern | Tool used |
|---|---|
| `k6/scenarios/*.js` | k6 |
| `playwright/tests/*.spec.ts` | Playwright |
| `cypress/e2e/*.cy.js` | Cypress |
| `lighthouse/*.{js,json}` | Lighthouse |
| `scripts/*.rb` | Ruby (via `rails runner`) |

**Output:** Results are written to `perf/results/<Name>-<Version>/<tool>/`.

**`--bg` flag:** Spawns the test in the background and returns immediately. Use `strester monitor` to watch it and `strester stop` to kill it.

**`-q` / `-p` / `--quiet` flag:** Suppresses live test output. Shows a spinner with the test name while it runs, then prints `done` or `failed` with elapsed time. All output is still written to the log file.

---

### 4.3 `strester run all`

Runs every discovered test file across all tools, one by one.

```bash
bin/strester run all

# Quiet mode — live progress bar instead of per-test output
bin/strester run all -q

# Run all in background
bin/strester run all --bg
```

**What it does:**

1. Discovers all test files via `ToolDetector.all_tests`
2. Shows a table of everything found and asks for confirmation
3. Runs each test sequentially, recording per-test duration
4. Prints a final summary table with ✅/❌ per test and total elapsed time
5. Exits with code 1 if any test failed

**Normal mode example output:**

```
strester run all — Complete

Tool         Test                        Duration   Result
k6           pr0-base-url-load.js        62.3s      ✅
playwright   pr0-base-url-load.spec.ts   18.1s      ❌
cypress      pr0-base-url-load.cy.js     34.7s      ✅

Passed: 2 / 3  (total time: 115.1s)
Failed: 1
```

**Quiet mode (`-q`) example output:**

```
  [████████████░░░░░░░░░░░░░░░░] 4/12 33%  k6: pr3-index.js  42s elapsed · ETA 86s
```
As each test finishes a result row is printed and the progress bar advances:
```
  ✅ 🔥 k6    pr0-base-url-load.js                 62.3s
  ❌ 🎭 playwright  pr0-base-url-load.spec.ts       18.1s
  [████████████████████████████░░] 11/12 91%  ...
```

---

### 4.4 `strester run folder <folder>`

Runs all test files found in a specific folder.

```bash
bin/strester run folder k6/scenarios
bin/strester run folder playwright/tests
bin/strester run folder cypress/e2e
```

Asks for confirmation before running. Useful when you want to run all tests for a single tool without running the entire suite.

---

### 4.5 `strester monitor`

Shows a live auto-refreshing view of all background tests.

```bash
bin/strester monitor
```

Displays:

- PID, tool, label, elapsed time for each running process
- Tail of the last 4 lines of each test's log file
- Refreshes every 2 seconds
- Press **Ctrl+C** to exit

---

### 4.6 `strester list tests`

Lists every available test file grouped by tool.

```bash
bin/strester list tests
```

Useful for finding the exact path to pass to `strester run`.

---

### 4.7 `strester stop`

Kills running background tests.

```bash
bin/strester stop
```

Shows all running processes, lets you select which to stop (or stop all), and sends SIGTERM to the selected PIDs.

---

### 4.8 `strester summary`

Prints a quick formatted summary to the terminal and writes a `strester-summary-*.txt` file.

```bash
# Latest results
bin/strester summary

# Specific version
bin/strester summary Labguru-v6.41.2
```

Covers: k6 scenario tables, Playwright pass/fail totals, Cypress results, Lighthouse scores, Ruby log outcomes.

> For a richer output with full per-test breakdowns and JSON export, use `strester report` instead.

---

### 4.9 `strester report`

The main reporting command. Parses **all** output files from every tool and produces two files:

```bash
# Latest results
bin/strester report

# Specific version
bin/strester report Labguru-v6.41.2
```

**Produces:**

- `report-YYYYMMDD-HHMMSS.txt` — human-readable with icons, tables, and ASCII bars
- `report-YYYYMMDD-HHMMSS.json` — machine-readable structured data

See [Section 8](#8-report-files-explained) for full details.

---

### 4.10 `strester config`

Prints the currently active configuration.

```bash
bin/strester config
```

Shows target name/version, base URL, output directory, and whether tokens are set.

---

## 5. Test Files

All test source files live under `perf/`:

```
perf/
├── k6/
│   ├── scenarios/          ← k6 load test scripts (.js)
│   ├── helpers/            ← shared auth, checks, compounds helpers
│   └── data/               ← CSV/JSON fixture data for bulk tests
├── playwright/
│   ├── tests/              ← Playwright specs (.spec.ts)
│   └── helpers/            ← login, timing, ketcher helpers
├── cypress/
│   ├── e2e/                ← Cypress specs (.cy.js)
│   └── support/            ← global commands (cy.login, etc.)
├── lighthouse/             ← Lighthouse config files
└── scripts/                ← Ruby utility scripts
```

**Naming convention:** test files follow the pattern `pr<N>-<description>`:

- `pr0` — base URL / smoke tests
- `pr1` — compound creation (API + UI)
- `pr3` — grid / index page
- `pr12` — deletion
- `pr13` — admin login → tenants page
- etc.

**Lighthouse files** in `perf/lighthouse/`:

| File | Purpose |
|---|---|
| `lighthouse-base.js` | PR-0 direct Lighthouse config — audits the base URL (no authentication) |
| `lighthouserc.js` | PR-13 LHCI config — audits `/admin/resources/tenants` after logging in |
| `puppeteer-login.js` | Shared authentication script used by `lighthouserc.js` to log in before each audit |

---

## 6. Results Directory Structure

Every test run writes into a versioned folder:

```
perf/results/
└── Labguru-v6.41.2/           ← Name-Version from strester.json
    ├── k6/
    │   ├── pr0-base-url-load.js-20260530-195404.csv
    │   ├── pr0-base-url-load.js-20260530-195404-summary.json
    │   └── pr0-base-url-load.js-20260530-195404.log
    ├── playwright/
    │   ├── playwright-results-20260530-195315.json
    │   ├── pr0-base-url-load-20260530-195315.log
    │   └── html-report/        ← Full Playwright HTML report
    ├── cypress/
    │   ├── cypress-results-20260530-202516.json
    │   └── pr0-base-url-load-20260530-202516.log
    ├── lighthouse/
    │   └── lhr-20260530-202800.json
    ├── ruby/
    │   └── seed_compounds-20260530-202900.log
    ├── report-20260530-202757.txt    ← Generated by strester report
    └── report-20260530-202757.json   ← Generated by strester report
```

**Timestamp format:** `YYYYMMDD-HHMMSS` — all files from the same test run share the same timestamp.

Multiple runs of the same test accumulate in the same versioned folder. This is intentional — it lets you compare successive runs in the report.

---

## 7. Output Files Explained

### 7.1 k6 — CSV data file

**Pattern:** `k6/<scenario>-<timestamp>.csv`

Raw time-series data. Every HTTP request is one row. Columns:

| Column | Description |
|---|---|
| `metric_name` | Metric type (`http_req_duration`, `http_reqs`, etc.) |
| `timestamp` | Unix timestamp of the sample |
| `metric_value` | Value in milliseconds (for duration metrics) |
| `status` | HTTP response status code |
| `url` | Request URL |
| `scenario` | k6 scenario name |
| `expected_response` | `true` if status was in the expected range |

Useful for: importing into Grafana, Excel pivot analysis, or feeding into other monitoring tools.

---

### 7.2 k6 — summary JSON

**Pattern:** `k6/<scenario>-<timestamp>-summary.json`

Aggregated statistics for the entire run. Key sections:

```json
{
  "metrics": {
    "http_req_duration": {
      "avg": 43.1,
      "min": 13.4,
      "med": 40.3,
      "p(90)": 69.2,
      "p(95)": 86.3,
      "max": 292.8
    },
    "http_reqs": {
      "count": 580,
      "rate": 9.56
    },
    "http_req_failed": {
      "value": 0.0
    },
    "base_url_load_duration": {
      "p(95)": 86.3,
      "thresholds": {
        "p(95)<3000": false
      }
    }
  },
  "root_group": {
    "checks": {
      "status is 200 or 302": {
        "passes": 580,
        "fails": 0
      }
    }
  }
}
```

**Understanding thresholds:** A threshold value of `false` means the threshold was **breached** (failed). A value of `true` means it passed. This is k6's convention — `false` = the expression was not satisfied.

**Key metrics to watch:**

- `http_req_duration.p(95)` — 95th percentile response time. 95% of requests completed within this time.
- `http_req_duration.p(99)` — tail latency. If this is much higher than p95, you have outliers.
- `http_req_failed.value` — error rate as a fraction (0.05 = 5% errors). Should be 0 for healthy runs.
- `http_reqs.rate` — requests per second throughput.

---

### 7.3 k6 — log file

**Pattern:** `k6/<scenario>-<timestamp>.log`

Full terminal output from the k6 run including real-time progress, VU counts, and the end-of-run summary table. Useful for debugging failed runs.

---

### 7.4 Playwright — results JSON

**Pattern:** `playwright/playwright-results-<timestamp>.json`

Full structured results from the Playwright test runner. Key sections:

```json
{
  "stats": {
    "total": 1,
    "expected": 0,
    "unexpected": 1,
    "skipped": 0,
    "flaky": 0,
    "duration": 17176
  },
  "suites": [
    {
      "title": "PR-0-BaseURL-UI",
      "specs": [
        {
          "title": "base URL loads within 5000ms (p95)",
          "ok": false,
          "tests": [
            {
              "status": "unexpected",
              "results": [
                {
                  "duration": 16757,
                  "errors": [
                    { "message": "TimeoutError: page.waitForURL ..." }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

**Test status values:**

| Status | Meaning |
|---|---|
| `expected` | Test passed |
| `unexpected` | Test failed |
| `skipped` | Test was skipped |
| `flaky` | Test passed on retry after initially failing |

Multiple `playwright-results-*.json` files accumulate in the folder across runs. `strester report` uses the **most recent** file for the main breakdown but shows a history of all runs.

---

### 7.5 Playwright — HTML report

**Location:** `playwright/html-report/`

A full interactive HTML report generated by Playwright. Open it with:

```bash
open perf/results/Labguru-v6.41.2/playwright/html-report/index.html
```

Contains screenshots, videos, and stack traces for failed tests.

---

### 7.6 Cypress — results JSON

**Pattern:** `cypress/cypress-results-<timestamp>.json`

Mocha JSON reporter output. Key sections:

```json
{
  "stats": {
    "tests": 4,
    "passes": 3,
    "failures": 1,
    "pending": 0,
    "duration": 34700
  },
  "results": [
    {
      "file": "e2e/pr0-base-url-load.cy.js",
      "suites": [
        {
          "tests": [
            {
              "title": "base URL loads within 5000ms (p95)",
              "state": "passing",
              "duration": 8200
            }
          ]
        }
      ]
    }
  ]
}
```

**Test state values:** `passing`, `failing`, `pending`.

---

### 7.7 Lighthouse — report JSON

**Pattern:** `lighthouse/lhr-<timestamp>.json` or `*.report.json`

Full Lighthouse audit result. Key sections:

```json
{
  "finalUrl": "http://localhost:3000",
  "fetchTime": "2026-05-30T19:00:00.000Z",
  "categories": {
    "performance":    { "score": 0.87, "title": "Performance" },
    "accessibility":  { "score": 0.95, "title": "Accessibility" },
    "best-practices": { "score": 0.91, "title": "Best Practices" },
    "seo":            { "score": 0.82, "title": "SEO" }
  },
  "audits": {
    "first-contentful-paint":    { "displayValue": "1.2 s",  "score": 0.95 },
    "largest-contentful-paint":  { "displayValue": "2.4 s",  "score": 0.75 },
    "total-blocking-time":       { "displayValue": "120 ms", "score": 0.88 },
    "cumulative-layout-shift":   { "displayValue": "0.01",   "score": 0.99 },
    "speed-index":               { "displayValue": "1.8 s",  "score": 0.90 },
    "interactive":               { "displayValue": "3.1 s",  "score": 0.80 }
  }
}
```

**Score interpretation:** Scores are 0–1 (multiply by 100 for percentage). Lighthouse's thresholds:

- 90–100 → ✅ Good
- 50–89  → ⚠️  Needs improvement
- 0–49   → ❌ Poor

---

## 8. Report Files Explained

Running `strester report` produces two files per invocation, both with the same timestamp.

### 8.1 TXT report

**Pattern:** `report-YYYYMMDD-HHMMSS.txt`

Human-readable. Designed to be readable in any terminal, text editor, or copy-pasted into a chat/email.

**Structure:**

```
================================================================================
                  📊  PERFORMANCE TEST REPORT — Labguru-v6.41.2
================================================================================
  Generated      30 May 2026  20:27:57 IDT
  🎯 Target       http://admin.lvh.me:3000/auth/login
  📁 Results      perf/results/Labguru-v6.41.2
  Status         ❌ FAIL

─── 📋  Overall Breakdown ───────────────────────────────────────────────────────

  Tool           Status      Duration   Details
  ──────────────────────────────────────────────────────────────────────
  K6             ✅ pass        62.3s   1 scenario(s)  pass=1  fail=0
  PLAYWRIGHT     ❌ fail        18.1s   4 run(s)  tests=1  ✅0  ❌1
  CYPRESS        ⚠️  no_data        —   0 run(s)  tests=0  ✅0  ❌0

  ⏱️  Total test time:  80.4s  (1.3 min)

─── 🔥  k6 Load Tests  (1 scenario(s)) ─────────────────────────────────────────

  ✅ pr0-base-url-load.js  [20260530-195404]
    test duration              62.3s
    avg / med / max            43.1ms / 40.3ms / 292.8ms
    p90 / p95 / p99            69.2ms / 86.3ms / N/A
    requests                   580  (9.557 req/s)
    error rate                 0%
    peak VUs                   10

  Thresholds:
    ✅  base_url_load_duration: p(95)<3000

  Checks:
    ✅  status is 200 or 302  [██████████████████████████████] 100.0%
```

**Icon legend:**

| Icon | Meaning |
|---|---|
| ✅ | Passed / within threshold |
| ❌ | Failed / threshold breached |
| ⚠️  | Warning / no data for this tool |
| ⏱️  | Timing / custom metric |
| `[████░░░░]` | Pass-rate bar (filled = passing fraction) |

**Quick tips:**

- Copy the file and paste it into ChatGPT/Claude for instant analysis: `cat report-*.txt | pbcopy`
- The overall `Status` at the top is `PASS` only if **all** tools with data passed.
- `no_data` means no result files were found for that tool this run — it is not a failure.

---

### 8.2 JSON report

**Pattern:** `report-YYYYMMDD-HHMMSS.json`

Machine-readable. Structured for programmatic consumption, CI comparisons, or AI analysis.

**Top-level structure:**

```json
{
  "meta": {
    "generated": "30 May 2026  20:27:57 IDT",
    "slug": "Labguru-v6.41.2",
    "target_url": "http://admin.lvh.me:3000/auth/login",
    "results_dir": "/path/to/perf/results/Labguru-v6.41.2",
    "status": "fail",
    "total_duration_s": 80.4,
    "duration_by_tool_s": { "k6": 62.3, "playwright": 18.1 }
  },
  "totals": {
    "overall_status": "fail",
    "by_tool": {
      "k6":         { "scenarios": 1, "pass": 1, "fail": 0, "status": "pass" },
      "playwright": { "runs": 4, "tests": 1, "passed": 0, "failed": 1, "status": "fail" },
      "cypress":    { "runs": 0, "tests": 0, "passed": 0, "failed": 0, "status": "no_data" },
      "lighthouse": { "reports": 0, "pass": 0, "fail": 0 },
      "ruby":       { "scripts": 0, "pass": 0, "fail": 0 }
    }
  },
  "tools": {
    "k6": {
      "scenarios": [
        {
          "name": "pr0-base-url-load.js",
          "timestamp": "20260530-195404",
          "status": "pass",
          "run_duration_s": 62.3,
          "http_req_duration": {
            "avg": 43.078, "min": 13.425, "med": 40.268,
            "p90": 69.174, "p95": 86.337, "p99": null, "max": 292.769
          },
          "requests":       { "count": 580, "rate": 9.557 },
          "error_rate_pct": 0.0,
          "peak_vus":       10,
          "thresholds": {
            "base_url_load_duration": { "p(95)<3000": "pass" }
          },
          "checks": [
            { "name": "status is 200 or 302", "passes": 580, "fails": 0, "pass_rate": 100.0 }
          ]
        }
      ]
    },
    "playwright": {
      "runs": [
        {
          "file": "playwright-results-20260530-195315.json",
          "timestamp": "20260530-195315",
          "stats": { "total": 1, "passed": 0, "failed": 1, "skipped": 0, "duration_ms": 17176 },
          "tests": [
            {
              "suite": "pr0-base-url-load.spec.ts › PR-0-BaseURL-UI",
              "title": "base URL loads within 5000ms (p95)",
              "status": "unexpected",
              "duration_ms": 16757,
              "error": "TimeoutError: page.waitForURL: Timeout 15000ms exceeded."
            }
          ]
        }
      ]
    }
  }
}
```

**`status` field values** used throughout the JSON:

| Value | Meaning |
|---|---|
| `"pass"` | All tests/thresholds passed |
| `"fail"` | One or more tests/thresholds failed |
| `"no_data"` | No result files found for this tool |

---

## 9. Typical Workflows

### Run the admin login → tenants test

```bash
# Set the admin password (never commit this)
export PERF_ADMIN_PASSWORD=SecurePassword123!

# k6 HTTP-level login + tenants navigation
bin/strester run k6/scenarios/pr13-login-to-tenants.js

# Playwright browser login + tenants timing (3 runs, p95 assertion)
bin/strester run playwright/tests/pr13-login-to-tenants.spec.ts

# Cypress browser login + tenants timing
bin/strester run cypress/e2e/pr13-login-to-tenants.cy.js

# Lighthouse audit of tenants page (LHCI, 3 runs, authenticated)
bin/strester run lighthouse/lighthouserc.js

# Generate report with durations
bin/strester report
```

---

### Run a single test and inspect results

```bash
export PERF_TOKEN_USER_A=your_token

# Run the k6 base URL test
bin/strester run k6/scenarios/pr0-base-url-load.js

# Generate report
bin/strester report

# Open the HTML report for Playwright
open perf/results/Labguru-v6.41.2/playwright/html-report/index.html
```

---

### Full release regression run

```bash
# 1. Update version in config
#    "version": "v6.42.0" in perf/config/strester.json

# 2. Set tokens
export PERF_TOKEN_USER_A=...
export PERF_TOKEN_USER_B=...

# 3. Run everything
bin/strester run all

# 4. Generate report
bin/strester report

# 5. Copy for review
cat perf/results/Labguru-v6.42.0/report-*.txt | pbcopy
```

---

### Long-running tests in background

```bash
# Start k6 in background
bin/strester run k6/scenarios/pr3-index.js --bg

# Watch progress
bin/strester monitor

# When done, generate report
bin/strester report
```

---

### Compare two versions

```bash
# Run report for each version
bin/strester report Labguru-v6.41.0
bin/strester report Labguru-v6.42.0

# The JSON reports are ideal for diff/comparison:
diff perf/results/Labguru-v6.41.0/report-*.json \
     perf/results/Labguru-v6.42.0/report-*.json
```

---

## 10. Troubleshooting

### `Cannot find module '@playwright/test'`

Run `npm install` inside `perf/playwright/`:

```bash
cd perf/playwright && npm install
```

### `Cannot find module 'cypress'`

Run `npm install` inside `perf/cypress/`:

```bash
cd perf/cypress && npm install
```

### `net::ERR_SSL_PROTOCOL_ERROR` in Playwright

The `base_url` uses `https://` but the server has a self-signed certificate.
`ignoreHTTPSErrors: true` is already set in `playwright.config.ts`. If still failing, check that the server is actually running and the URL is correct in `strester.json`.

### k6 `TOKEN is not set` / `401 Unauthorized`

```bash
export PERF_TOKEN_USER_A=your_token_here
```

Or strester will prompt you to enter it interactively.

### `Could not find a Cypress configuration file`

The Cypress runner must run from `perf/cypress/`. This is handled automatically by strester. If running Cypress manually, `cd perf/cypress` first.

### Results folder already has data from a previous run

This is expected. All output files include timestamps so they never overwrite each other. Run `strester report` to get a combined view of all accumulated runs.

### `strester report` shows `no_data` for a tool

The tool produced no result files this cycle. Either the test wasn't run, or it crashed before writing output. Check the `.log` file in the tool's results subfolder for details.

### Lighthouse `[lhci-auth] Login error: No email input found`

The selector list in `puppeteer-login.js` didn't match any field on the login page. Open the login page in a browser, inspect the email input's `name` or `id` attribute, and add it to the `emailSelectors` array in `perf/lighthouse/puppeteer-login.js`.

### Lighthouse audit fails immediately after login

This usually means the login succeeded but the session cookie wasn't carried over. Ensure `waitUntil: 'networkidle2'` is in the `waitForNavigation` call inside `puppeteer-login.js`. If the app uses SPA routing, try `waitUntil: 'load'` instead.

### k6 `422 Unprocessable Entity` on login POST

The CSRF token extraction regex didn't match. The Rails app may use a different attribute order. Check the actual HTML source of `/auth/login` and adjust the regex in `pr13-login-to-tenants.js` if needed.
