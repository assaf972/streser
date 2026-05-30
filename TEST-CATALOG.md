# Stress Test Catalog

Complete reference for every test in the Labguru performance / stress-test suite.
Each entry describes **what the script does**, **which tools it uses**, and **what output it produces**.

---

## Table of Contents

- [Tools Used](#tools-used)
- [k6 API Load Tests](#k6-api-load-tests)
  - [PR-1-API-Create](#pr-1-api-create)
  - [PR-1-API-Update](#pr-1-api-update)
  - [PR-1-API-Bulk](#pr-1-api-bulk)
  - [PR-1-Validation-Single](#pr-1-validation-single)
  - [PR-2b-Text-Search](#pr-2b-text-search)
  - [PR-2b-Property-Search](#pr-2b-property-search)
  - [PR-3-Index](#pr-3-index)
  - [PR-3-Filter](#pr-3-filter)
  - [PR-3-Sort](#pr-3-sort)
  - [PR-3-Detail](#pr-3-detail)
  - [PR-3-Parent](#pr-3-parent)
  - [PR-5-Dedup](#pr-5-dedup)
  - [PR-6-Small-Export](#pr-6-small-export)
  - [PR-6-Large-Export](#pr-6-large-export)
  - [PR-8-Cross-User](#pr-8-cross-user)
  - [PR-12-Delete-Single](#pr-12-delete-single)
  - [PR-12-Delete-Bulk](#pr-12-delete-bulk)
- [Playwright UI Performance Tests](#playwright-ui-performance-tests)
  - [PR-1-UI-Create](#pr-1-ui-create)
  - [PR-1-UI-Edit](#pr-1-ui-edit)
  - [PR-7-Ready](#pr-7-ready)
  - [PR-7-Load](#pr-7-load)
  - [PR-7-Input](#pr-7-input)
  - [PR-9-Global](#pr-9-global)
  - [PR-3-Index-UI](#pr-3-index-ui)
  - [PR-12-Delete-Single-UI](#pr-12-delete-single-ui)
  - [PR-12-Delete-Bulk-UI](#pr-12-delete-bulk-ui)
- [Ruby Support Scripts](#ruby-support-scripts)
  - [seed_compounds.rb](#seed_compoundsrb)
  - [generate_sdf.rb](#generate_sdfrb)
  - [generate_excel.rb](#generate_excelrb)
  - [monitor_sidekiq.rb](#monitor_sidekiqrb)
  - [verify_dedup.rb](#verify_deduprb)
- [Cypress Functional Regression Tests](#cypress-functional-regression-tests)
  - [PR-1-Validation-Bulk-Report](#pr-1-validation-bulk-report)
  - [PR-7-Input-Functional](#pr-7-input-functional)
  - [PR-3-Grid-Functional](#pr-3-grid-functional)
  - [PR-9-Global-Search-Functional](#pr-9-global-search-functional)
  - [PR-12-Delete-Functional](#pr-12-delete-functional)
- [Lighthouse CI Audits](#lighthouse-ci-audits)
- [Sentry Production Observability](#sentry-production-observability)
- [Data Files](#data-files)

---

## Tools Used

| Tool | Version | Purpose |
|---|---|---|
| **k6** (Grafana) | ≥ 0.50 | JavaScript-based HTTP load testing. Ramps virtual users, measures p95 latencies, enforces threshold pass/fail. |
| **Playwright** | ≥ 1.48 | Chromium browser automation. Measures real UI render times, Ketcher editor interactions, Kendo grid performance. |
| **Ruby** (Rails runner) | 3.4 | Database seeding, test-data generation (SDF/Excel), Sidekiq monitoring, dedup verification. |
| **Cypress** | ≥ 13.6 | Functional regression tests. Validates correctness of import reports, grid behavior, file uploads — NOT performance timing. |
| **Lighthouse CI** | ≥ 0.13 | Frontend rendering audits. Measures LCP, TTI, TBT, CLS, and JS bundle size. CI gate for budget violations. |
| **Sentry** | SDK | Production observability. Transaction tracing, Web Vitals, performance alerts. Observes, does not generate load. |

---

## k6 API Load Tests

All k6 tests live under `perf/k6/scenarios/`. Each is a standalone k6 script that can be run with:

```bash
k6 run perf/k6/scenarios/<script>.js \
  -e BASE_URL=https://perf.labguru.com \
  -e TOKEN=<api_token> \
  [... additional env vars]
```

**Common output**: k6 prints a summary table to stdout with p95/p99/avg/min/max latencies, request counts, error rates, and threshold pass/fail status. Custom `handleSummary()` functions (where present) write JSON reports to `perf/results/`.

---

### PR-1-API-Create

| | |
|---|---|
| **File** | `k6/scenarios/pr1-api-create.js` |
| **Requirement** | PR-1 — Compound registration |
| **Tool** | k6 |
| **What it does** | Registers new compounds via `POST /api/v1/compounds` under sustained load. Ramps from 1 to 50 virtual users (VUs) over 5 min, holds 50 VUs for 10 min, then ramps down over 2 min. Each VU picks a random SMILES string from a CSV file matching the selected molecule-size tier. |
| **Env vars** | `TIER` (`simple` \| `standard` \| `complex` \| `beyond`) — selects SMILES CSV and p95 threshold |
| **Data files** | `k6/data/smiles-simple.csv`, `smiles-standard.csv`, `smiles-complex.csv`, `smiles-beyond.csv` |
| **P95 thresholds** | simple < 1 s, standard < 2 s, complex < 4 s, beyond < 10 s |
| **Custom metrics** | `compound_create_duration` (Trend), `compound_create_errors` (Counter) |
| **Output** | k6 stdout summary with pass/fail per threshold |

---

### PR-1-API-Update

| | |
|---|---|
| **File** | `k6/scenarios/pr1-api-update.js` |
| **Requirement** | PR-1 — Compound update |
| **Tool** | k6 |
| **What it does** | Pre-creates compounds in `setup()`, then updates them via `PUT /api/v1/compounds/:id` under load. Supports two modes: **structure_change** (replaces the SMILES with a different structure) and **name_only** (changes only the name field, bypassing chemistry processing). Ramps to 30 VUs. |
| **Env vars** | `TIER` (`simple` \| `standard` \| `complex`), `MODE` (`structure_change` \| `name_only`) |
| **P95 thresholds** | simple < 1.5 s, standard < 2.5 s, complex < 5 s |
| **Custom metrics** | `compound_update_duration` (Trend), `compound_update_errors` (Counter) |
| **Output** | k6 stdout summary |

---

### PR-1-API-Bulk

| | |
|---|---|
| **File** | `k6/scenarios/pr1-api-bulk.js` |
| **Requirement** | PR-1 — Bulk compound operations |
| **Tool** | k6 |
| **What it does** | Submits bulk create operations via `POST /api/v1/compounds/bulk`. Measures two things: (1) the synchronous POST must return HTTP 202 with a `bulk_run_id` in < 1 s, (2) polls `GET /api/v1/bulk/:id` until the async job completes, measuring total completion time. Runs 3 iterations with 1 VU (bulk operations are inherently sequential). |
| **Env vars** | `OPS` (`100` \| `1000` \| `10000`) — number of operations per batch |
| **Data files** | `k6/data/bulk-100-create.json`, `bulk-1k-create.json`, `bulk-10k-mixed.json` (templates; actual payloads built dynamically from SMILES CSV) |
| **P95 thresholds** | Sync POST < 1 s; Async completion: 100 ops < 1 min, 1K ops < 5 min, 10K ops < 30 min |
| **Custom metrics** | `bulk_sync_post_duration` (Trend), `bulk_completion_time` (Trend), `bulk_errors` (Counter) |
| **Output** | k6 stdout summary; reconciliation check verifying created count matches expected |

---

### PR-1-Validation-Single

| | |
|---|---|
| **File** | `k6/scenarios/pr1-validation-single.js` |
| **Requirement** | PR-1 — Validation rejection speed |
| **Tool** | k6 |
| **What it does** | Sends intentionally invalid compound payloads to `POST /api/v1/compounds` and measures how fast the server rejects them. Tests 4 failure classes: **malformed SMILES** (garbage strings), **sanitization failures** (invalid valence/charge), **unsupported types** (reaction SMARTS, R-groups), and **custom field violations**. Runs at 5–10 VUs for 5 min. |
| **P95 thresholds** | Malformed < 200 ms, Sanitization < 500 ms, Unsupported < 1 s, Custom field < 1 s |
| **Custom metrics** | 4 separate Trends: `validation_malformed_duration`, `validation_sanitization_duration`, `validation_unsupported_duration`, `validation_custom_field_duration` |
| **Output** | k6 stdout summary with per-class pass/fail |

---

### PR-2b-Text-Search

| | |
|---|---|
| **File** | `k6/scenarios/pr2b-text-search.js` |
| **Requirement** | PR-2b — Text-based compound search |
| **Tool** | k6 |
| **What it does** | Searches for compounds by name, SysID, or external ID using three API endpoints: `GET /api/v1/global_search`, filter-by-name, and filter-by-SysID. Randomly selects from a pool of 20 search terms (drug names + compound IDs). Ramps to 20 VUs for 10 min. |
| **Env vars** | `SCALE` (`100k` \| `500k` \| `1m`) — for tagging results by dataset size |
| **P95 threshold** | < 1 s at 1M records |
| **Custom metrics** | `text_search_duration` (Trend, tagged by `search_type`), `text_search_errors` (Counter) |
| **Output** | k6 stdout summary |
| **Degradation test** | Re-run concurrently with an active SDF import to verify < 2× degradation |

---

### PR-2b-Property-Search

| | |
|---|---|
| **File** | `k6/scenarios/pr2b-property-search.js` |
| **Requirement** | PR-2b — Property-based compound search |
| **Tool** | k6 |
| **What it does** | Performs property-based queries: molecular weight range (200–500), cLogP range (1.0–5.0), Lipinski compliance filter, and custom-field queries. Each VU iteration picks a random query type. 20 VUs for 10 min. |
| **P95 threshold** | < 2 s at 1M records |
| **Custom metrics** | `property_search_duration` (Trend, tagged by `query_type`), `property_search_errors` (Counter) |
| **Output** | k6 stdout summary |

---

### PR-3-Index

| | |
|---|---|
| **File** | `k6/scenarios/pr3-index.js` |
| **Requirement** | PR-3 — Collection index page load |
| **Tool** | k6 |
| **What it does** | Loads the compound collection index via `GET /api/v1/compounds?page=N&per_page=SIZE` with 4 sequential sub-scenarios for page sizes 20, 50, 100, and 200. Each sub-scenario runs 10 VUs for 5 min. Random page numbers simulate real browsing. |
| **Env vars** | `SCALE` (`100k` \| `1m`) — selects threshold tier |
| **P95 thresholds (at 100K / 1M)** | Page 20: 1 s / 2 s, Page 50: 1.5 s / 2.5 s, Page 100: 2 s / 3 s, Page 200: 3 s / 4 s |
| **Custom metrics** | `index_load_duration` (Trend, tagged by `page_size`), `index_load_errors` (Counter) |
| **Output** | k6 stdout summary with per-page-size pass/fail |

---

### PR-3-Filter

| | |
|---|---|
| **File** | `k6/scenarios/pr3-filter.js` |
| **Requirement** | PR-3 — In-grid filter |
| **Tool** | k6 |
| **What it does** | Applies 6 filter types on the compound index: text-name, text-SysID, numeric range (MW), boolean (Lipinski), custom field, and parent linkage. Each VU iteration picks a random filter type. 15 VUs for 8 min. Multi-filter combo threshold: ≤ slowest single filter × 1.5. |
| **P95 thresholds** | Name < 1 s, SysID < 500 ms, Numeric range < 2 s, Boolean < 2 s, Custom field < 2 s, Parent linkage < 1 s |
| **Custom metrics** | `filter_duration` (Trend, tagged by `filter_type`), `filter_errors` (Counter) |
| **Output** | k6 stdout summary with per-filter-type pass/fail |

---

### PR-3-Sort

| | |
|---|---|
| **File** | `k6/scenarios/pr3-sort.js` |
| **Requirement** | PR-3 — Column-header sort |
| **Tool** | k6 |
| **What it does** | Sorts the compound index by text column (name), numeric property (MW), custom field, and a combined filter + sort. Also tests pagination stability (sort + navigate to random page). 15 VUs for 8 min. |
| **P95 thresholds** | Text / Numeric / Custom / Pagination < 2 s each, Filter+Sort combo < 3 s |
| **Custom metrics** | `sort_duration` (Trend, tagged by `sort_type`), `sort_errors` (Counter) |
| **Output** | k6 stdout summary |

---

### PR-3-Detail

| | |
|---|---|
| **File** | `k6/scenarios/pr3-detail.js` |
| **Requirement** | PR-3 — Compound detail page |
| **Tool** | k6 |
| **What it does** | Loads individual compound detail pages via `GET /api/v1/compounds/:id`. In `setup()`, fetches 100 compound IDs from the index, then each VU randomly picks one to load. Validates that the response includes properties and the structure image. 20 VUs for 5 min. |
| **P95 threshold** | < 1 s |
| **Custom metrics** | `detail_load_duration` (Trend), `detail_load_errors` (Counter) |
| **Output** | k6 stdout summary |

---

### PR-3-Parent

| | |
|---|---|
| **File** | `k6/scenarios/pr3-parent.js` |
| **Requirement** | PR-3 — Parent structure detail |
| **Tool** | k6 |
| **What it does** | Loads parent compound detail pages. Two scenarios: **normal parents** (few linked versions, < 1 s) and **heavy parents** (1000+ linked versions, < 2 s). 80% of iterations hit normal parents, 20% hit the heavy parent specified by `HEAVY_PARENT_ID`. 10 VUs for 5 min. |
| **Env vars** | `HEAVY_PARENT_ID` — ID of a parent compound with 1000+ linked versions |
| **P95 thresholds** | Normal < 1 s, Heavy (1000+ versions) < 2 s |
| **Custom metrics** | `parent_detail_duration` (Trend, tagged by `parent_type`), `parent_detail_errors` (Counter) |
| **Output** | k6 stdout summary |

---

### PR-5-Dedup

| | |
|---|---|
| **File** | `k6/scenarios/pr5-dedup.js` |
| **Requirement** | PR-5 — Parent structure deduplication under concurrency |
| **Tool** | k6 + Ruby (post-test verification) |
| **What it does** | 20 VUs simultaneously register compounds with the **same parent SMILES** (100 total iterations) via `POST /api/v1/compounds`. After the test, the companion script `verify_dedup.rb` queries the database to assert that exactly 1 parent row exists for that structure. |
| **Env vars** | `DEDUP_SMILES` — the SMILES string to use for all registrations (default: `c1ccccc1`) |
| **Pass criteria** | > 90% of registrations succeed (HTTP 200 or 201); exactly 1 parent row in DB |
| **Custom metrics** | `dedup_create_duration` (Trend), `dedup_create_success` (Rate), `dedup_total_registrations` (Counter) |
| **Output** | k6 stdout + `results/pr5-dedup-summary.json` with total registrations and success rate. Prints reminder to run `verify_dedup.rb`. |

---

### PR-6-Small-Export

| | |
|---|---|
| **File** | `k6/scenarios/pr6-small-export.js` |
| **Requirement** | PR-6 — Export ≤ 10K compounds |
| **Tool** | k6 |
| **What it does** | Triggers a compound export via `POST /api/v1/biocollections/compounds/export` requesting XLSX format with 10K rows. Polls `GET /api/v1/biocollections/compounds/export/:id` every 10 seconds until completion or timeout. 3 iterations, 1 VU. |
| **P95 threshold** | < 10 minutes |
| **Custom metrics** | `export_small_duration` (Trend), `export_small_errors` (Counter) |
| **Output** | k6 stdout summary |

---

### PR-6-Large-Export

| | |
|---|---|
| **File** | `k6/scenarios/pr6-large-export.js` |
| **Requirement** | PR-6 — Export > 10K compounds (format fallback) |
| **Tool** | k6 |
| **What it does** | Same flow as PR-6-Small but requests CSV format with 100K rows. Verifies the download URL ends in `.csv` (not `.xlsx`), confirming the large-export format fallback. Polls every 15 seconds. 1 iteration, 1 VU. |
| **P95 threshold** | < 30 minutes |
| **Custom metrics** | `export_large_duration` (Trend), `export_large_errors` (Counter) |
| **Output** | k6 stdout summary |

---

### PR-8-Cross-User

| | |
|---|---|
| **File** | `k6/scenarios/pr8-cross-user.js` |
| **Requirement** | PR-8 + PR-X2 — Cross-user degradation |
| **Tool** | k6 |
| **What it does** | Two-phase test using **two API tokens** (two different users). **Phase 1 (Baseline)**: User B performs a mix of operations (index, detail, search, create) for 5 min → records p95. **Phase 2 (Loaded)**: User A starts a heavy import (via a separate process); User B repeats the same operations → records p95. Compares loaded p95 to baseline p95. |
| **Env vars** | `TOKEN` (User B), `TOKEN_B` (User A — the one running the heavy import) |
| **Pass criterion** | Loaded p95 ≤ 2× Baseline p95 |
| **Custom metrics** | `baseline_duration` (Trend), `loaded_duration` (Trend), `cross_user_errors` (Counter) |
| **Output** | k6 stdout + `results/pr8-cross-user-summary.json` with baseline p95, loaded p95, degradation ratio, and pass/fail |

---

### PR-12-Delete-Single

| | |
|---|---|
| **File** | `k6/scenarios/pr12-delete-single.js` |
| **Requirement** | PR-12 — Single compound deletion |
| **Tool** | k6 |
| **What it does** | Pre-creates 100 compounds in `setup()`, then 10 VUs each delete 10 compounds via `DELETE /api/v1/compounds/:id`. After each deletion, performs a `GET` to verify the compound returns 404. |
| **P95 threshold** | < 1 s |
| **Custom metrics** | `delete_single_duration` (Trend), `delete_single_errors` (Counter) |
| **Output** | k6 stdout summary |

---

### PR-12-Delete-Bulk

| | |
|---|---|
| **File** | `k6/scenarios/pr12-delete-bulk.js` |
| **Requirement** | PR-12 — Bulk compound deletion |
| **Tool** | k6 |
| **What it does** | Pre-creates compounds in `setup()` organized into 5 batches. Each iteration deletes one batch sequentially via individual `DELETE /api/v1/compounds/:id` calls, measuring total wall-clock time for the batch. 1 VU, 5 iterations. |
| **Env vars** | `BATCH_SIZE` (`20` \| `200`) |
| **P95 thresholds** | 20 compounds < 2 s, 200 compounds < 5 s |
| **Custom metrics** | `delete_bulk_duration` (Trend), `delete_bulk_errors` (Counter) |
| **Output** | k6 stdout summary |

---

## Playwright UI Performance Tests

All Playwright tests live under `perf/playwright/tests/`. Run with:

```bash
cd perf/playwright
npm install
npx playwright test                    # all tests
npx playwright test pr7-ready.spec.ts  # single test
npx playwright test --headed           # watch in browser
```

**Common output**: HTML report at `perf/playwright/playwright-report/`, JSON results at `perf/results/playwright-results.json`. Console logs include per-test p95 and median timings.

---

### PR-1-UI-Create

| | |
|---|---|
| **File** | `playwright/tests/pr1-ui-create.spec.ts` |
| **Requirement** | PR-1 — Compound registration via UI |
| **Tool** | Playwright (Chromium) |
| **What it does** | Logs in via browser, navigates to `/compounds/new`, pastes a SMILES string into the Ketcher editor, clicks Save, and waits for the success notification. Runs 20 iterations per molecule tier to calculate p95. Timer starts on Save click, ends on success notification visible. |
| **Molecule tiers tested** | Simple, Standard, Complex |
| **P95 thresholds** | Simple < 2 s, Standard < 3 s, Complex < 5 s |
| **Output** | Console log with p95 and median per tier; Playwright HTML report |

---

### PR-1-UI-Edit

| | |
|---|---|
| **File** | `playwright/tests/pr1-ui-edit.spec.ts` |
| **Requirement** | PR-1 — Compound edit via UI |
| **Tool** | Playwright (Chromium) |
| **What it does** | Opens an existing compound edit page, waits for Ketcher canvas to pre-fill, pastes a new SMILES, and clicks Save. Measures two things: (1) Ketcher pre-fill time (must be < 2 s), (2) save latency per molecule tier (20 iterations each). Timer for save starts on Save click, excludes Ketcher pre-fill. |
| **Env vars** | `PERF_COMPOUND_ID` — ID of existing compound to edit |
| **P95 thresholds** | Simple < 2.5 s, Standard < 3.5 s, Complex < 6 s; Ketcher pre-fill < 2 s |
| **Output** | Console log with timings; Playwright HTML report |

---

### PR-7-Ready

| | |
|---|---|
| **File** | `playwright/tests/pr7-ready.spec.ts` |
| **Requirement** | PR-7 — Ketcher toolbar visible and interactive |
| **Tool** | Playwright (Chromium) |
| **What it does** | Measures how quickly the Ketcher toolbar becomes visible and interactive on three surfaces: compound new form, compound edit page, and structure-search modal. After a warmup iteration (to prime browser cache), runs 10 iterations per surface, measuring time from page/modal open to toolbar interactive. |
| **P95 threshold** | < 1.5 s (all surfaces) |
| **Output** | Console log with p95 per surface; Playwright HTML report |

---

### PR-7-Load

| | |
|---|---|
| **File** | `playwright/tests/pr7-load.spec.ts` |
| **Requirement** | PR-7 — Ketcher canvas ready for drawing |
| **Tool** | Playwright (Chromium) |
| **What it does** | Measures time until the Ketcher canvas (SVG or canvas element) is visible and ready. Two scenarios: empty canvas (new form) and pre-filled canvas (edit page with existing structure). 10 iterations each with warmup. |
| **P95 threshold** | < 2 s (both empty and pre-filled) |
| **Output** | Console log with p95 per scenario; Playwright HTML report |

---

### PR-7-Input

| | |
|---|---|
| **File** | `playwright/tests/pr7-input.spec.ts` |
| **Requirement** | PR-7 — Structure input into Ketcher |
| **Tool** | Playwright (Chromium) |
| **What it does** | Tests three input methods: (1) **Paste SMILES** — opens the paste dialog, types a SMILES string, confirms, waits for structure to render (15 iterations with 3 different SMILES). (2) **Upload MOL file** — uploads `fixtures/mol-simple.mol` (10 iterations). (3) **Upload CDXML file** — uploads `fixtures/structure.cdxml` (10 iterations). |
| **Fixture files** | `playwright/fixtures/mol-simple.mol`, `playwright/fixtures/structure.cdxml` |
| **P95 thresholds** | Paste SMILES < 1 s, Upload MOL/CDXML < 3 s |
| **Output** | Console log with p95 per method; Playwright HTML report |

---

### PR-9-Global

| | |
|---|---|
| **File** | `playwright/tests/pr9-global.spec.ts` |
| **Requirement** | PR-9 — Global top-bar search |
| **Tool** | Playwright (Chromium) |
| **What it does** | Navigates to the dashboard, focuses the global search input, types a query (cycles through 5 search terms: aspirin, benzene, caffeine, ibuprofen, c1ccccc1), and waits for the first result to appear in the dropdown. 20 iterations. |
| **P95 threshold** | < 1 s from keystroke to first result visible |
| **Output** | Console log with p95; Playwright HTML report |

---

### PR-3-Index-UI

| | |
|---|---|
| **File** | `playwright/tests/pr3-index-ui.spec.ts` |
| **Requirement** | PR-3 — Kendo grid rendering performance |
| **Tool** | Playwright (Chromium) |
| **What it does** | Tests the browser-side Kendo grid performance on `/compounds`. Three sub-tests: (1) **Initial grid render** — navigates to the page and waits for rows to appear (10 iterations). (2) **Page-size change** — switches the Kendo pager dropdown between 25/50/100/200 rows and waits for the grid to reload (10 iterations each). (3) **Column toggle** — opens the column chooser, toggles a checkbox, and waits for the grid to re-render (10 iterations). |
| **P95 thresholds** | Initial render < 2 s; Page 25 < 1 s, 50 < 1.5 s, 100 < 2.5 s, 200 < 4 s; Column toggle < 1 s |
| **Output** | Console log with p95 per sub-test; Playwright HTML report |

---

### PR-12-Delete-Single-UI

| | |
|---|---|
| **File** | `playwright/tests/pr12-delete-single.spec.ts` |
| **Requirement** | PR-12 — Detail page delete via UI |
| **Tool** | Playwright (Chromium) |
| **What it does** | For each of 20 iterations: creates a compound via the API, navigates to its detail page, clicks Delete, accepts the confirmation dialog, and waits for redirect to the index page or a success flash. Uses `fetch()` to create compounds (not Playwright, for speed). |
| **Env vars** | `PERF_TOKEN` — API token for compound creation |
| **P95 threshold** | < 1 s |
| **Output** | Console log with p95; Playwright HTML report |

---

### PR-12-Delete-Bulk-UI

| | |
|---|---|
| **File** | `playwright/tests/pr12-delete-bulk.spec.ts` |
| **Requirement** | PR-12 — Multiselect delete from grid |
| **Tool** | Playwright (Chromium) |
| **What it does** | Seeds compounds via the bulk API, navigates to `/compounds`, selects compounds in the Kendo grid (individual checkboxes for ≤ 20, header "select all" for > 20), clicks the bulk Delete button, accepts the confirmation, and waits for the grid to refresh. |
| **Env vars** | `PERF_TOKEN` — API token for compound creation |
| **P95 thresholds** | 20 compounds < 2 s, 200 compounds < 5 s |
| **Output** | Console log with timing; Playwright HTML report |

---

## Ruby Support Scripts

All Ruby scripts live under `perf/scripts/`. They run via Rails runner:

```bash
RAILS_ENV=performance bundle exec ruby perf/scripts/<script>.rb [args]
```

---

### seed_compounds.rb

| | |
|---|---|
| **File** | `scripts/seed_compounds.rb` |
| **Tool** | Ruby (Rails runner) |
| **What it does** | Seeds the database with compounds to reach scale points (100K, 500K, 1M). Uses a pool of 18 SMILES templates with 8 salt-form variations to simulate chemical diversity. Inserts in batches of 1,000 using `insert_all` for performance. Prints progress every 100 batches with rate and ETA. |
| **Args** | `TARGET_COUNT` (default: 100,000) |
| **Output** | Progress log to stdout: count, rate (compounds/sec), ETA. Final count with elapsed time. |

---

### generate_sdf.rb

| | |
|---|---|
| **File** | `scripts/generate_sdf.rb` |
| **Tool** | Ruby (standalone) |
| **What it does** | Generates SDF files for bulk import testing. Creates V2000 MOL blocks with SMILES, name, and ID data fields. Supports configurable duplicate ratios for dedup testing (e.g., 30% duplicates). |
| **Args** | `SIZE` (`1k` \| `10k` \| `100k`), `DEDUP_RATIO` (0.0–1.0, default: 0.0) |
| **Output** | `perf/k6/data/generated-<SIZE>.sdf` with file size report |

---

### generate_excel.rb

| | |
|---|---|
| **File** | `scripts/generate_excel.rb` |
| **Tool** | Ruby + caxlsx gem |
| **What it does** | Generates XLSX files for bulk import testing. Creates a worksheet with columns: Name, SMILES, Molecular Weight, Description. Uses the `Axlsx::Package` API. |
| **Args** | `SIZE` (`100` \| `1k` \| `10k`) |
| **Output** | `perf/k6/data/generated-<SIZE>.xlsx` with file size report |

---

### monitor_sidekiq.rb

| | |
|---|---|
| **File** | `scripts/monitor_sidekiq.rb` |
| **Tool** | Ruby (Rails runner) + Sidekiq API |
| **What it does** | Polls Sidekiq queues (`default`, `chemistry`, `bulk_import`) every 5 seconds. Reports total queued jobs, busy workers, retry count, and per-queue sizes. Detects stalled queues (no worker activity for > 5 min). Exits 0 when all queues drain, exits 1 on timeout. |
| **Args** | `TIMEOUT_SEC` (default: 3600 = 1 hour) |
| **Output** | Timestamped progress log to stdout. Final elapsed time or timeout warning. |

---

### verify_dedup.rb

| | |
|---|---|
| **File** | `scripts/verify_dedup.rb` |
| **Tool** | Ruby (Rails runner) |
| **What it does** | Post-test verification for PR-5 dedup. Queries the database for SMILES strings that have multiple compound records. For each, verifies: exactly 1 parent record exists (parent_id is nil), no orphan children (parent_id pointing to non-existent records). Reports totals and any errors. |
| **Args** | None |
| **Output** | Summary to stdout: duplicated SMILES count, total compounds, per-SMILES parent/child check results. Exit 0 on pass, exit 1 on errors. |

---

## Cypress Functional Regression Tests

All Cypress tests live under `perf/cypress/e2e/`. They validate **functional correctness** — not performance timing.
Cypress runs inside the browser event loop, so its timing is inflated by 200–500 ms and should not be used for p95 measurements.

Run all:

```bash
cd perf/cypress
npm install
CYPRESS_BASE_URL=https://perf.labguru.com \
CYPRESS_PERF_EMAIL=user@example.com \
CYPRESS_PERF_PASSWORD=secret \
  npx cypress run --browser chrome
```

---

### PR-1-Validation-Bulk-Report

| | |
|---|---|
| **File** | `cypress/e2e/pr1-validation-bulk-report.cy.js` |
| **Tool** | Cypress (Chrome) |
| **What it does** | Uploads an Excel file with known bad rows (reaction SMILES, invalid valence, missing required field) and verifies the import validation report. Checks: reconciliation line (M persisted + N rejected == total rows), per-row error details (row index, failure class, reason), and report download link. Second test verifies C9 regression (no rows silently filtered). |
| **PR** | PR-1-Validation-Bulk |
| **Output** | Pass/fail assertion. Video recording and screenshots on failure. |

---

### PR-7-Input-Functional

| | |
|---|---|
| **File** | `cypress/e2e/pr7-input-functional.cy.js` |
| **Tool** | Cypress (Chrome) |
| **What it does** | Verifies Ketcher structure file upload works correctly. First test uploads a MOL V3000 file and verifies atoms appear on canvas with no errors. Second test inputs reaction SMILES (`CC>>CC`) and verifies a visible error message appears. |
| **PR** | PR-7-Input |
| **Output** | Pass/fail assertion. Video recording and screenshots on failure. |

---

### PR-3-Grid-Functional

| | |
|---|---|
| **File** | `cypress/e2e/pr3-grid-functional.cy.js` |
| **Tool** | Cypress (Chrome) |
| **What it does** | Functional verification of the Kendo Grid on the compounds index page. Tests: expected columns render (Name, Structure, Molecular Formula), pagination (next/prev), sorting (column header click updates sort indicator), and filtering (text filter restricts rows). |
| **PR** | PR-3-Index |
| **Output** | Pass/fail assertion. Video recording and screenshots on failure. |

---

### PR-9-Global-Search-Functional

| | |
|---|---|
| **File** | `cypress/e2e/pr9-global-search-functional.cy.js` |
| **Tool** | Cypress (Chrome) |
| **What it does** | Verifies global search from the landing page. First test searches for a known compound ("aspirin") and verifies results appear. Second test searches for garbage text and verifies the no-results state is displayed. |
| **PR** | PR-9 |
| **Output** | Pass/fail assertion. Video recording and screenshots on failure. |

---

### PR-12-Delete-Functional

| | |
|---|---|
| **File** | `cypress/e2e/pr12-delete-functional.cy.js` |
| **Tool** | Cypress (Chrome) |
| **What it does** | Verifies the compound deletion flow. Clicks delete on a compound, verifies a confirmation dialog appears with delete text, then cancels to avoid modifying test data. |
| **PR** | PR-12 |
| **Output** | Pass/fail assertion. Video recording and screenshots on failure. |

---

## Lighthouse CI Audits

Lighthouse CI runs automated audits against authenticated compound pages and enforces frontend performance budgets.

| | |
|---|---|
| **Files** | `lighthouse/lighthouserc.js`, `lighthouse/lighthouse-login.js` |
| **Tool** | Lighthouse CI (`@lhci/cli`) |
| **What it does** | Audits 4 pages (/compounds/new, /compounds/:id/edit, /compounds, /) across 5 runs each. Measures Core Web Vitals (LCP, FID, CLS), Time to Interactive (TTI), Total Blocking Time (TBT), and JS bundle size. Enforces budgets: LCP < 2.5s, TTI < 3s, CLS < 0.1, TBT < 300ms, total JS < 1.5 MB. |
| **PRs** | PR-7-Ready, PR-7-Load, PR-3-Index, PR-9-Global |
| **Output** | HTML report in `perf/results/lighthouse/`. Exit code 1 if any budget assertion fails. |

### Bundle Size Check

| | |
|---|---|
| **File** | `scripts/check-bundle-size.sh` |
| **Tool** | Bash + curl |
| **What it does** | Fetches the compound new page, extracts all `<script>` tags, measures each bundle's `Content-Length`. Sums total JS and isolates Ketcher bundles. Fails if total JS > 1.5 MB or Ketcher JS > 1.1 MB. |
| **Output** | Per-script size list, total JS, Ketcher JS. Exit 0 on pass, exit 1 on budget exceeded. |

---

## Sentry Production Observability

Sentry configuration templates for production performance monitoring. These are **NOT test scripts** — they are SDK configurations to integrate into the application.

| | |
|---|---|
| **Files** | `sentry/sentry_rails.rb`, `sentry/sentry_react.ts`, `sentry/sentry_alerts.yml` |
| **Tool** | Sentry SDK (Rails + React) |
| **What it does** | `sentry_rails.rb` — Rails initializer that enables transaction tracing for compound registration (create/update/bulk), with 100% sampling in perf env, and molecule complexity tier tagging. `sentry_react.ts` — React SDK init capturing Web Vitals (LCP, FID, CLS) on compound pages, with custom measurements for Ketcher ready/canvas times. `sentry_alerts.yml` — alert rule definitions for 7 regression thresholds (PR-1 create, PR-4 pipeline, PR-7 Ketcher, PR-3 grid, PR-2b search). |
| **PRs** | PR-1, PR-2b, PR-3, PR-4, PR-7 |
| **Output** | Sentry dashboard: transaction traces, p50/p75/p95/p99, Web Vitals, Slack alerts on regression. |

---

## Data Files

### SMILES CSVs (`k6/data/smiles-*.csv`)

| File | Tier | Description | Record count |
|---|---|---|---|
| `smiles-simple.csv` | Simple (Ro3) | Small molecules: benzene, ethanol, aniline, etc. | 50 |
| `smiles-standard.csv` | Standard (Ro5) | Drug-like molecules: aspirin, ibuprofen, caffeine, etc. | 30 |
| `smiles-complex.csv` | Complex (bRo5) | Macrolides, peptide fragments, natural products | 20 |
| `smiles-beyond.csv` | Beyond envelope | Long peptides, polymers, high-MW chains | 10 |

### Bulk JSON templates (`k6/data/bulk-*.json`)

| File | Description |
|---|---|
| `bulk-100-create.json` | 20 create operations (template; k6 builds full 100 dynamically) |
| `bulk-1k-create.json` | 10 create operations (template; k6 builds full 1K dynamically) |
| `bulk-10k-mixed.json` | 10 mixed create+update operations (template; k6 builds full 10K dynamically) |

### Playwright fixtures (`playwright/fixtures/`)

| File | Description |
|---|---|
| `mol-simple.mol` | V2000 MOL file — benzene (6 atoms, 6 bonds) |
| `mol-complex.mol` | V2000 MOL file — complex molecule (41 atoms, 44 bonds) |
| `structure.cdxml` | CDXML XML file — benzoic acid derivative (10 nodes, 10 bonds) |
| `structure.cdx.README` | Instructions for generating binary CDX files from ChemDraw or OpenBabel |

---

## Configuration Files

### `config/environments.json`

Defines connection parameters for each environment (local, staging, performance). Contains `base_url`, `api_token` placeholders, and scale metadata.

### `config/thresholds.json`

Central reference for all p95 thresholds by requirement. Each k6 scenario reads its own thresholds directly, but this file serves as the single source of truth for documentation and CI comparison.
