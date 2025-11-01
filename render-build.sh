#!/usr/bin/env bash
# render-build.sh
echo "🛠️ Installing FFmpeg..."
apt-get update && apt-get install -y ffmpeg
echo "✅ FFmpeg installed."
npm install
