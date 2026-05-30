#!/bin/bash
# perf/scripts/check-bundle-size.sh
# Fails if any JS bundle exceeds budget or total JS exceeds limit.
# Use in CI to catch bundle size regressions before they reach production.
#
# Usage:
#   LHCI_AUTH_COOKIE="session=xxx" BASE_URL="https://perf.labguru.com" ./check-bundle-size.sh
#
# Exit codes:
#   0 = within budget
#   1 = exceeds budget

set -euo pipefail

BASE_URL="${BASE_URL:-https://perf.labguru.com}"
AUTH_COOKIE="${LHCI_AUTH_COOKIE:-}"
BUDGET_JS_TOTAL_KB=1500     # Total JS: 1.5 MB
BUDGET_KETCHER_KB=1100      # Ketcher bundle: 1.1 MB

echo "=== Bundle Size Check ==="
echo "Target: ${BASE_URL}/compounds/new"
echo ""

# Fetch page and extract script src paths
SCRIPTS=$(curl -s "${BASE_URL}/compounds/new" \
  -H "Cookie: ${AUTH_COOKIE}" \
  | grep -oE 'src="[^"]*\.js"' \
  | sed 's/src="//;s/"//')

if [ -z "$SCRIPTS" ]; then
  echo "ERROR: No scripts found on page. Check BASE_URL and AUTH_COOKIE."
  exit 1
fi

TOTAL_BYTES=0
KETCHER_BYTES=0

echo "Script sizes:"
echo "---"

while IFS= read -r script; do
  # Build full URL
  if [[ "$script" == http* ]]; then
    url="$script"
  else
    url="${BASE_URL}${script}"
  fi

  size=$(curl -sI "$url" \
    -H "Cookie: ${AUTH_COOKIE}" \
    | grep -i content-length | awk '{print $2}' | tr -d '\r' || echo "0")

  size=${size:-0}
  size_kb=$((size / 1024))
  echo "  ${script}: ${size_kb} KB"

  TOTAL_BYTES=$((TOTAL_BYTES + size))

  # Track Ketcher bundle separately
  if echo "$script" | grep -qi 'ketcher'; then
    KETCHER_BYTES=$((KETCHER_BYTES + size))
  fi
done <<< "$SCRIPTS"

TOTAL_KB=$((TOTAL_BYTES / 1024))
KETCHER_KB=$((KETCHER_BYTES / 1024))

echo ""
echo "Total JS: ${TOTAL_KB} KB (budget: ${BUDGET_JS_TOTAL_KB} KB)"
echo "Ketcher JS: ${KETCHER_KB} KB (budget: ${BUDGET_KETCHER_KB} KB)"
echo ""

EXIT_CODE=0

if [ "$TOTAL_KB" -gt "$BUDGET_JS_TOTAL_KB" ]; then
  echo "FAIL: Total JS exceeds budget by $((TOTAL_KB - BUDGET_JS_TOTAL_KB)) KB"
  EXIT_CODE=1
else
  echo "PASS: Total JS within budget"
fi

if [ "$KETCHER_KB" -gt "$BUDGET_KETCHER_KB" ]; then
  echo "FAIL: Ketcher JS exceeds budget by $((KETCHER_KB - BUDGET_KETCHER_KB)) KB"
  EXIT_CODE=1
else
  echo "PASS: Ketcher JS within budget"
fi

exit $EXIT_CODE
