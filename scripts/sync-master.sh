#!/bin/bash
# Sync master branch to main — run this after every push to main
# to ensure Vercel's native GitHub integration deploys the correct code.
#
# Vercel deploys from the "master" branch, but our repo uses "main".
# The CI workflow's step 18 (Sync master) gets skipped when step 17
# (Commit version.json) fails. This script manually syncs master to main.
#
# Usage: bash scripts/sync-master.sh

set -e
cd "$(git rev-parse --show-toplevel)"

echo "Fetching origin main..."
git fetch origin main

echo "Force-pushing main → master..."
git push origin origin/main:refs/heads/master --force 2>&1 || true

echo "✓ master is now synced with main"
echo "  Vercel will deploy the latest code automatically."
