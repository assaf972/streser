# Cypress Test Fixtures

Place the following Excel test files here for the PR-1-Validation-Bulk functional tests:

## Required files

### test-validation-5rows.xlsx

An Excel file with 5 compound rows:

- Row 2: valid compound (control) — e.g. SMILES: `c1ccccc1`
- Row 3: reaction SMILES — e.g. `CC>>CC` (should be rejected)
- Row 4: invalid valence — e.g. `C(C)(C)(C)(C)C` (should fail sanitization)
- Row 5: missing required field (project column empty)
- Row 6: valid compound (control) — e.g. SMILES: `CCO`

Expected result: 2 persisted, 3 rejected.

### test-unparseable-10rows.xlsx

An Excel file with 10 compound rows, mix of valid and invalid.
Used to verify the C9 regression (no rows silently filtered).

Expected result: persisted + rejected == 10 (all rows accounted for).

### mol-complex.mol

Copy from `perf/playwright/fixtures/mol-complex.mol` — used by PR-7 functional test.

## Generating fixtures

Use the Ruby script to create Excel files:

```bash
RAILS_ENV=performance bundle exec ruby perf/scripts/generate_excel.rb 5
```

Then manually edit to introduce the required errors.
