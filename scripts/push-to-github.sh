#!/bin/bash
# Push Fiber Splice Manager to GitHub

echo "🚀 Pushing to GitHub repository: FiberMapConnect"
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
  echo "Initializing git repository..."
  git init
fi

# Add all files
echo "📦 Adding files to git..."
git add .

# Commit
echo "💾 Creating commit..."
git commit -m "Initial commit: Fiber Splice Manager PWA with offline support

Features:
- Progressive Web App with complete offline functionality
- IndexedDB storage for local data persistence
- OCR support using Tesseract.js for circuit ID extraction
- Automatic splice matching with range-based logic
- File-based save/load system
- Inline cable editing with type and fiber count
- Color-coded ribbon/fiber visualization
- Adaptive splice display (ribbon view vs fiber view)
- Feed fiber conflict prevention
- Service worker v3 with comprehensive caching strategy"

# Add remote if not exists
if ! git remote | grep -q origin; then
  echo "🔗 Adding GitHub remote..."
  git remote add origin https://github.com/ksvendetta/FiberMapConnect.git
fi

# Set main branch
git branch -M main

# Push to GitHub
echo "⬆️  Pushing to GitHub..."
git push -u origin main --force

echo ""
echo "✅ Successfully pushed to GitHub!"
echo "🌐 View your repository: https://github.com/ksvendetta/FiberMapConnect"
