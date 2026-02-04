#!/bin/bash
# =============================================================================
# fix_extension_not_loading.sh
# =============================================================================
# Use this script when your Azure CLI extension changes aren't showing up in
# --help output or commands aren't working as expected.
#
# Common symptoms this fixes:
#   - New parameters not appearing in --help
#   - Code changes not taking effect
#   - Extension appears installed but commands use old behavior
#
# Usage:
#   ./fix_extension_not_loading.sh [extension_name]
#
# Example:
#   ./fix_extension_not_loading.sh containerapp
# =============================================================================

set -e

EXTENSION_NAME="${1:-containerapp}"
AZURE_CONFIG_DIR="${AZURE_CONFIG_DIR:-$HOME/.azure}"

echo "=============================================="
echo "Fixing Azure CLI Extension: $EXTENSION_NAME"
echo "=============================================="
echo ""

# Step 1: Check for duplicate extensions (whl + dev)
echo "Step 1: Checking for duplicate extensions..."
EXTENSION_COUNT=$(az extension list --output json 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
matches = [e for e in data if e.get('name') == '$EXTENSION_NAME']
print(len(matches))
for m in matches:
    print(f\"  - {m.get('extensionType')}: {m.get('path')}\", file=sys.stderr)
")

if [ "$EXTENSION_COUNT" -gt 1 ]; then
    echo "  ⚠️  Found $EXTENSION_COUNT versions of '$EXTENSION_NAME'!"
    echo "  Removing whl version (keeping dev version)..."
    az extension remove --name "$EXTENSION_NAME" 2>/dev/null || true
fi

# Step 2: Clear Python bytecode cache
echo ""
echo "Step 2: Clearing Python bytecode cache..."
EXTENSION_PATH=$(az extension list --output json 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
for e in data:
    if e.get('name') == '$EXTENSION_NAME' and e.get('extensionType') == 'dev':
        print(e.get('path'))
        break
")

if [ -n "$EXTENSION_PATH" ]; then
    find "$EXTENSION_PATH" -name "*.pyc" -delete 2>/dev/null || true
    find "$EXTENSION_PATH" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
    echo "  ✓ Cleared cache in $EXTENSION_PATH"
else
    echo "  ⚠️  Dev extension path not found"
fi

# Step 3: Remove Azure CLI command index cache
echo ""
echo "Step 3: Removing Azure CLI command index cache..."
if [ -f "$AZURE_CONFIG_DIR/commandIndex.json" ]; then
    rm -f "$AZURE_CONFIG_DIR/commandIndex.json"
    echo "  ✓ Removed $AZURE_CONFIG_DIR/commandIndex.json"
else
    echo "  ✓ No commandIndex.json found (already clean)"
fi

# Step 4: Reinstall the extension with azdev
echo ""
echo "Step 4: Reinstalling extension with azdev..."
if command -v azdev &> /dev/null; then
    azdev extension remove "$EXTENSION_NAME" 2>/dev/null || true
    azdev extension add "$EXTENSION_NAME"
    echo "  ✓ Reinstalled $EXTENSION_NAME"
else
    echo "  ⚠️  azdev not found. Install with: pip install azdev"
    echo "  Trying pip install -e instead..."
    if [ -n "$EXTENSION_PATH" ]; then
        pip install -e "$EXTENSION_PATH" --no-deps --quiet
        echo "  ✓ Installed with pip"
    fi
fi

# Step 5: Verify the fix
echo ""
echo "Step 5: Verifying installation..."
az extension list --output table 2>/dev/null | grep -i "$EXTENSION_NAME" || echo "  Extension not found in list"

echo ""
echo "=============================================="
echo "Done! Try running your command with --help"
echo "=============================================="
