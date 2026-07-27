#!/usr/bin/env bash
set -euo pipefail

# Gathers Phase 1 audit data for an Astro site.
# Runs CloudCannon CLI commands for SSG/collection/build detection,
# then supplements with project metadata the CLI doesn't cover.
#
# Usage: bash audit-astro.sh [project-dir]
#   project-dir defaults to the current directory.

PROJECT_DIR="${1:-.}"
cd "$PROJECT_DIR"

echo "=== Audit: $(basename "$(pwd)") ==="
echo ""

# --- CloudCannon CLI: SSG detection ---
echo "## CloudCannon CLI: SSG Detection"
echo '```json'
npx @cloudcannon/cli configure detect-ssg 2>/dev/null || echo '{ "error": "npx @cloudcannon/cli configure detect-ssg failed" }'
echo '```'
echo ""

# --- CloudCannon CLI: Collections ---
echo "## CloudCannon CLI: Collections"
echo '```json'
npx @cloudcannon/cli configure detect-collections --ssg astro 2>/dev/null || echo '{ "error": "npx @cloudcannon/cli configure detect-collections failed" }'
echo '```'
echo ""

# --- CloudCannon CLI: Build suggestions ---
echo "## CloudCannon CLI: Build Suggestions"
echo '```json'
npx @cloudcannon/cli configure detect-build-commands --ssg astro 2>/dev/null || echo '{ "error": "npx @cloudcannon/cli configure detect-build-commands failed" }'
echo '```'
echo ""

# --- Package manager ---
echo "## Package Manager"
if [ -f "yarn.lock" ]; then
  echo "Detected: yarn"
elif [ -f "pnpm-lock.yaml" ]; then
  echo "Detected: pnpm"
elif [ -f "package-lock.json" ]; then
  echo "Detected: npm"
elif [ -f "bun.lockb" ] || [ -f "bun.lock" ]; then
  echo "Detected: bun"
else
  echo "No lockfile found"
fi
echo ""

# --- Node version ---
echo "## Node Version"
if [ -f ".nvmrc" ]; then
  echo ".nvmrc: $(cat .nvmrc)"
elif [ -f ".node-version" ]; then
  echo ".node-version: $(cat .node-version)"
fi
if [ -f "package.json" ]; then
  engines=$(node -e "const p=require('./package.json'); p.engines && console.log(JSON.stringify(p.engines))" 2>/dev/null || true)
  if [ -n "$engines" ]; then
    echo "engines: $engines"
  fi
fi
echo ""

# --- Key dependencies from package.json ---
echo "## Dependencies"
if [ -f "package.json" ]; then
  node -e "
    const pkg = require('./package.json');
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    const interesting = [
      'astro', '@astrojs/react', '@astrojs/vue', '@astrojs/svelte', '@astrojs/solid-js',
      '@astrojs/mdx', '@astrojs/sitemap', '@astrojs/tailwind',
      'react', 'react-dom', 'vue', 'svelte',
      'tailwindcss', '@tailwindcss/vite', '@tailwindcss/postcss',
      'sharp', '@astrojs/image',
      'remark-toc', 'remark-collapse', 'rehype-pretty-code',
    ];
    const found = {};
    for (const name of Object.keys(all).sort()) {
      if (interesting.includes(name) || name.startsWith('@astrojs/')) {
        found[name] = all[name];
      }
    }
    if (Object.keys(found).length) {
      for (const [k, v] of Object.entries(found)) console.log('- ' + k + ': ' + v);
    } else {
      console.log('No notable dependencies found');
    }
  " 2>/dev/null || echo "Failed to parse package.json"
fi
echo ""

# --- Content config location ---
echo "## Content Config"
if [ -f "src/content.config.ts" ]; then
  echo "Location: src/content.config.ts (Astro 5+)"
elif [ -f "src/content.config.mts" ]; then
  echo "Location: src/content.config.mts (Astro 5+)"
elif [ -f "src/content/config.ts" ]; then
  echo "Location: src/content/config.ts (legacy)"
elif [ -f "src/content/config.mts" ]; then
  echo "Location: src/content/config.mts (legacy)"
else
  echo "No content config found"
fi
echo ""

# --- Pages and routing ---
echo "## Pages (src/pages/)"
if [ -d "src/pages" ]; then
  find src/pages -name '*.astro' -o -name '*.md' -o -name '*.mdx' | sort | while read -r f; do
    rel="${f#src/pages/}"
    if echo "$rel" | grep -qE '\['; then
      echo "- $rel (dynamic)"
    else
      echo "- $rel"
    fi
  done
else
  echo "No src/pages/ directory found"
fi
echo ""

# --- Data files outside content collections ---
echo "## Data Files"
for dir in src/config src/data data; do
  if [ -d "$dir" ]; then
    echo "### $dir/"
    find "$dir" -maxdepth 2 -name '*.json' -o -name '*.yaml' -o -name '*.yml' | sort | while read -r f; do
      echo "- $f"
    done
  fi
done
echo ""

# --- Dash-index files ---
echo "## Dash-Index Files (-index.md)"
dash_files=$(find src/content -name '-index.md' -o -name '-index.mdx' 2>/dev/null || true)
if [ -n "$dash_files" ]; then
  echo "$dash_files" | while read -r f; do echo "- $f"; done
  echo ""
  echo "These should be renamed to index.md during the content phase."
  echo "Run: bash rename-dash-index.sh"
else
  echo "None found."
fi
echo ""

echo "=== End of automated audit ==="
echo "The agent should now analyze schema fields, component hierarchy,"
echo "visual editing candidates, and flags/gotchas manually."
