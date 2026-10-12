#!/usr/bin/env bash
# Rebuild every generated page, then cache-bust assets.  Usage:  bash gen/build_all.sh [--db]
#   --db  also re-export the generator data from the Neon database first
set -e
cd "$(dirname "$0")/.."
[ "$1" = "--db" ] && python -I gen/pcg_db.py export
python -I gen/build_products.py
python -I gen/build_career.py
python -I gen/build_pages.py
python -I gen/build_generator.py
python -I gen/build_seo.py
python -I gen/version_assets.py
