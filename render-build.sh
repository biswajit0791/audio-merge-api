#!/usr/bin/env bash
# render-build.sh
# Run during Render's build phase before npm install

echo "🛠️  Installing FFmpeg..."
apt-get update && apt-get install -y ffmpeg

echo "📁 Creating writable directories..."
mkdir -p /opt/render/project/src/sessions
mkdir -p /opt/render/project/src/uploads
mkdir -p /opt/render/project/src/merged

# Set broad write permissions (for Node runtime)
chmod -R 777 /opt/render/project/src/sessions
chmod -R 777 /opt/render/project/src/uploads
chmod -R 777 /opt/render/project/src/merged

echo "📦 Installing dependencies..."
npm install

echo "✅ Build script completed."
