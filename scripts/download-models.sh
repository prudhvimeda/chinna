#!/bin/bash
# ============================================================
# Chinna AI Voice Assistant — Model Download Script
# ============================================================

set -e

echo "📥 Downloading models for Chinna..."

# Create models directory
mkdir -p backend/models

# Check and pull Ollama model
if command -v ollama &> /dev/null; then
    echo ""
    echo "🦙 Pulling Llama 3.2 3B model via Ollama..."
    ollama pull llama3.2:3b 2>/dev/null || echo "  ⚠️  Could not pull model. Make sure 'ollama serve' is running."
else
    echo "  ⚠️  Ollama not installed. Skipping LLM model download."
    echo "     Install: brew install ollama"
fi

# faster-whisper downloads models automatically on first use
echo ""
echo "🎤 faster-whisper will download the 'base' model on first run (~140MB)"

# Kokoro downloads models automatically on first use
echo ""
echo "🔊 Kokoro-82M will download on first run (~200MB)"

echo ""
echo "✅ Model setup complete!"
echo "   Models will auto-download on first use if not already cached."
