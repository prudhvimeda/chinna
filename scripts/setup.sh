#!/bin/bash
# ============================================================
# Chinna AI Voice Assistant — One-Command Setup
# ============================================================

set -e

echo "============================================================"
echo "  🤖 Chinna AI Voice Assistant — Setup"
echo "============================================================"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Python
if command -v python3 &> /dev/null; then
    PY_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    echo "   ✅ Python $PY_VERSION"
else
    echo "   ❌ Python 3 not found. Please install Python 3.12+"
    exit 1
fi

# Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "   ✅ Node.js $NODE_VERSION"
else
    echo "   ❌ Node.js not found. Please install Node.js 20+"
    exit 1
fi

# Ollama
if command -v ollama &> /dev/null; then
    echo "   ✅ Ollama found"
else
    echo "   ⚠️  Ollama not found. Install: brew install ollama"
fi

echo ""

# Setup backend
echo "🐍 Setting up Python backend..."
cd backend
python3 -m venv venv
./venv/bin/pip install --upgrade pip --quiet
./venv/bin/pip install -r requirements.txt --quiet
cp -n .env.example .env 2>/dev/null || true
cd ..
echo "   ✅ Backend ready."

echo ""

# Setup frontend
echo "⚛️  Setting up Next.js frontend..."
cd frontend
npm install --silent
cd ..
echo "   ✅ Frontend ready."

echo ""

# Download models
echo "📥 Setting up models..."
bash scripts/download-models.sh

echo ""
echo "============================================================"
echo "  ✅ Setup complete!"
echo ""
echo "  Start Chinna:"
echo "    1. Start Ollama:  ollama serve"
echo "    2. Start Chinna:  make dev"
echo ""
echo "  Open: http://localhost:3000"
echo "============================================================"
