#!/bin/bash
set -e

echo "=== Checking gitleaks ==="
if ! command -v gitleaks &> /dev/null; then
  echo "ERROR: gitleaks is not installed"
  exit 1
fi
gitleaks detect --source . -v

echo ""
echo "=== Checking for outdated dependencies ==="
# Use grep to extract only the JSON part, ignoring WARN messages
OUTDATED=$(pnpm outdated --format json 2>&1 | grep -E '^\{.*\}$|^\[.*\]$' || echo "{}")
if [ -n "$OUTDATED" ] && [ "$OUTDATED" != "{}" ] && [ "$OUTDATED" != "[]" ]; then
  echo "Outdated dependencies found:"
  pnpm outdated
  exit 1
fi
echo "All dependencies are up-to-date"

echo ""
echo "=== Checking for vulnerabilities ==="
pnpm audit

echo ""
echo "=== Health checks passed ==="
