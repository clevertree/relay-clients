#!/bin/bash
# Simple development server
# Builds production bundle and serves it on port 5174

PORT=${PORT:-5174}
BUILD_DIR="dist"

echo "🔨 Building..."
npm run build || { echo "❌ Build failed"; exit 1; }

echo "🚀 Starting server on port $PORT..."
echo "📡 Visit http://localhost:$174"
echo ""
echo "Press Ctrl+C to stop"

# Serve the built directory
cd "$BUILD_DIR" && python3 -m http.server $PORT
