#!/bin/bash
# OpenGrammar Production Deployment Script
# This script builds the browser extension. The extension is bring-your-own-key
# and talks to LLM providers directly — there is no backend to deploy.

set -e  # Exit on error

echo "🪶 OpenGrammar Extension Build"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo -e "${RED}Error: Bun is not installed${NC}"
    echo "Please install Bun: https://bun.sh"
    exit 1
fi

BUN_VERSION=$(bun -v)
echo -e "${BLUE}✓ Bun version $BUN_VERSION check passed${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Build Extension
echo "📦 Building Chrome Extension"
echo "------------------------------------"
cd "$SCRIPT_DIR/extension"

if [ ! -d "node_modules" ]; then
    echo "Installing extension dependencies with Bun..."
    bun install
fi

echo "Building extension..."
bun run build

echo -e "${GREEN}✓ Extension built successfully${NC}"
echo ""

# Summary
echo "✅ Build Complete!"
echo "======================"
echo ""
echo "Next steps:"
echo "1. Load the extension in Chrome:"
echo "   - Go to chrome://extensions/"
echo "   - Enable 'Developer mode'"
echo "   - Click 'Load unpacked'"
echo "   - Select: $SCRIPT_DIR/extension/dist"
echo ""
echo "2. Configure the extension:"
echo "   - Click the extension icon"
echo "   - Open Settings"
echo "   - Choose your AI provider and add your API key"
echo ""
echo -e "${GREEN}Happy writing with OpenGrammar!${NC}"
