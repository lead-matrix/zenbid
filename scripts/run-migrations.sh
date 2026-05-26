#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PeakEstimator — Migration Runner
# Usage: SUPABASE_DB_URL="postgresql://..." ./scripts/run-migrations.sh
# Or:    ./scripts/run-migrations.sh  (uses SUPABASE_DB_URL from .env.local)
# ═══════════════════════════════════════════════════════════════

set -e

# Load .env.local if it exists
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

if [ -z "$SUPABASE_DB_URL" ]; then
  echo "❌ SUPABASE_DB_URL is not set."
  echo "   Set it as: postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres"
  echo "   Find it in: Supabase Dashboard → Settings → Database → Connection string"
  exit 1
fi

MIGRATIONS_DIR="./supabase/migrations"

echo "🚀 Running PeakEstimator migrations..."
echo ""

for f in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  echo "  ▶ $(basename $f)"
  psql "$SUPABASE_DB_URL" -f "$f" -q 2>&1 | grep -v "^$" | sed 's/^/    /'
done

echo ""
echo "✅ All migrations applied successfully!"
