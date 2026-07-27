#!/usr/bin/env bash
set -euo pipefail

# Renames -index.md / -index.mdx files to index.md / index.mdx
# under src/content/. This is a prerequisite for CloudCannon's
# [slug] URL collapsing to work correctly on listing pages.
#
# Usage: bash rename-dash-index.sh [project-dir]
#   project-dir defaults to the current directory.
#
# After running, you still need to update helper functions:
#   - getSinglePage(): filter on id === "index" instead of id.startsWith("-")
#   - getListPage() callers: change "-index" to "index"

PROJECT_DIR="${1:-.}"
cd "$PROJECT_DIR"

if [ ! -d "src/content" ]; then
  echo "No src/content/ directory found in $(pwd)"
  exit 1
fi

count=0
find src/content -name '-index.md' -o -name '-index.mdx' | sort | while read -r f; do
  dir=$(dirname "$f")
  ext="${f##*.}"
  target="$dir/index.$ext"

  if [ -f "$target" ]; then
    echo "SKIP: $f (target $target already exists)"
    continue
  fi

  mv "$f" "$target"
  echo "RENAMED: $f -> $target"
  count=$((count + 1))
done

if [ "$count" -eq 0 ]; then
  echo "No -index files found to rename."
fi
