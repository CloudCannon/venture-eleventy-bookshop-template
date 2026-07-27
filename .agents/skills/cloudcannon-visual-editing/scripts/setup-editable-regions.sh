#!/usr/bin/env bash
set -euo pipefail

# Sets up @cloudcannon/editable-regions boilerplate for an Astro site.
# Installs the package, adds the integration to astro.config.{mjs,ts},
# and creates the registerComponents script.
#
# Usage: bash setup-editable-regions.sh [project-dir]
#   project-dir defaults to the current directory.

PROJECT_DIR="${1:-.}"
cd "$PROJECT_DIR"

PACKAGE="@cloudcannon/editable-regions"
REGISTER_DIR="src/cloudcannon"

# --- Detect astro config file (mjs or ts) ---
if [ -f "astro.config.mjs" ]; then
  CONFIG="astro.config.mjs"
elif [ -f "astro.config.ts" ]; then
  CONFIG="astro.config.ts"
else
  CONFIG=""
fi
REGISTER_FILE="$REGISTER_DIR/registerComponents.ts"

# --- Detect package manager ---
if [ -f "pnpm-lock.yaml" ]; then
  PKG_MGR="pnpm"
  INSTALL_CMD="pnpm add"
elif [ -f "yarn.lock" ]; then
  PKG_MGR="yarn"
  INSTALL_CMD="yarn add"
else
  PKG_MGR="npm"
  INSTALL_CMD="npm install"
fi

# --- Install the package ---
echo "Installing $PACKAGE with $PKG_MGR..."
if $INSTALL_CMD "$PACKAGE" 2>/dev/null; then
  echo "Installed $PACKAGE"
else
  if [ "$PKG_MGR" = "npm" ]; then
    echo "Peer dependency conflict detected, retrying with --legacy-peer-deps..."
    npm install "$PACKAGE" --legacy-peer-deps
    echo "Installed $PACKAGE (with --legacy-peer-deps)"
  else
    echo "ERROR: Failed to install $PACKAGE with $PKG_MGR"
    exit 1
  fi
fi
echo ""

# --- Add integration to astro config ---
if [ -z "$CONFIG" ]; then
  echo "WARNING: No astro.config.mjs or astro.config.ts found. Add the integration manually."
else
  if grep -q "editable-regions/astro-integration" "$CONFIG"; then
    echo "Integration already present in $CONFIG"
  else
    # Add the import after the last existing import line
    last_import_line=$(grep -n "^import " "$CONFIG" | tail -1 | cut -d: -f1)
    if [ -n "$last_import_line" ]; then
      sed -i '' "${last_import_line}a\\
import editableRegions from \"$PACKAGE/astro-integration\";
" "$CONFIG"
      echo "Added import to $CONFIG (after line $last_import_line)"
    else
      echo "WARNING: No import lines found in $CONFIG. Add manually:"
      echo "  import editableRegions from \"$PACKAGE/astro-integration\";"
    fi

    # Add editableRegions() to the integrations array
    if grep -q "integrations:" "$CONFIG"; then
      if grep -q 'integrations:.*\[.*\]' "$CONFIG"; then
        # Single-line array: insert before the closing ]
        sed -i '' 's/\(integrations:.*\)\]/\1, editableRegions()]/' "$CONFIG"
      else
        # Multi-line array: insert after the opening [ line
        sed -i '' '/integrations:[[:space:]]*\[/a\
    editableRegions(),
' "$CONFIG"
      fi
      echo "Added editableRegions() to integrations array"
    else
      echo "WARNING: No integrations array found in $CONFIG. Add manually:"
      echo "  integrations: [editableRegions()]"
    fi
  fi
fi
echo ""

# --- Create registerComponents.ts ---
mkdir -p "$REGISTER_DIR"
if [ -f "$REGISTER_FILE" ]; then
  echo "$REGISTER_FILE already exists, skipping"
else
  cat > "$REGISTER_FILE" << 'TSEOF'
// Register Astro components for live re-rendering in the Visual Editor.
// Import each component and call registerAstroComponent() to enable
// EditableComponent regions to re-render when data changes.
//
// import { registerAstroComponent } from "@cloudcannon/editable-regions/astro";
// import CallToAction from "@/layouts/partials/CallToAction.astro";
// registerAstroComponent("call-to-action", CallToAction);
TSEOF
  echo "Created $REGISTER_FILE"
fi
echo ""

# --- Reminder ---
echo "=== Next steps ==="
echo "1. Conditionally import registerComponents in your base layout:"
echo ""
echo '   <script>'
echo '     if (window.inEditorMode) {'
echo '       import("../cloudcannon/registerComponents").catch((error) => {'
echo '         console.warn("Failed to load CloudCannon component registration:", error);'
echo '       });'
echo '     }'
echo '   </script>'
echo ""
echo "2. Uncomment and add component registrations in $REGISTER_FILE"
echo "   as you wire up EditableComponent regions."
