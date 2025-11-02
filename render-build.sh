#!/usr/bin/env bash
# render-build.sh
echo "🛠️ Installing FFmpeg and Redis tools..."
apt-get update && apt-get install -y ffmpeg redis-tools
echo "✅ FFmpeg & Redis tools installed."
npm install
