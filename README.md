# 🤖 Chinna — AI Voice Assistant

A production-ready, fully open-source AI voice assistant that runs **100% offline**. No API keys. No cloud. Just you and Chinna.

```
🎤 Audio → faster-whisper (ASR) → Ollama/Llama 3.2 (LLM) → Kokoro-82M (TTS) → 🔊 Audio
```

## ✨ Features

- **Fully Offline** — All components run locally on your machine
- **Real-time Streaming** — WebSocket-based pipeline for low-latency conversations
- **Zero Hallucination** — Grounded responses with strict system prompting
- **Professional & Friendly** — Production-ready assistant personality
- **Latency Tracking** — Per-component performance monitoring (ASR, LLM TTFT, TTS TTFB)
- **Provider Failover** — Automatic fallback between providers (Kokoro → Piper, Llama → Qwen)
- **Beautiful UI** — Dark theme with animated voice orb and real-time audio visualization

## 🏗️ Architecture

| Layer | Technology | Details |
|-------|-----------|---------|
| **Speech Recognition** | faster-whisper | CTranslate2 backend, 4x faster than OpenAI Whisper |
| **Reasoning** | Ollama + Llama 3.2 3B | Local LLM, low footprint, fast inference |
| **Speech Synthesis** | Kokoro-82M | 82M params, faster-than-realtime on CPU |
| **TTS Fallback** | Piper TTS | Ultra-lightweight ONNX-based TTS |
| **Backend** | FastAPI (Python 3.12) | Async WebSocket server |
| **Frontend** | Next.js 15 + React 19 | Modern UI with glassmorphism design |
| **Orchestration** | WebSockets | Full-duplex, real-time communication |

## 🚀 Quick Start

### Prerequisites

```bash
# Install Ollama
brew install ollama  # macOS
# or: curl -fsSL https://ollama.com/install.sh | sh  # Linux

# Pull the LLM model
ollama pull llama3.2:3b

# Ensure Python 3.12+ and Node.js 20+ are installed
python3 --version
node --version
```

### Setup

```bash
# Clone the repo
git clone https://github.com/prudhvimeda/chinna.git
cd chinna

# Run the setup script (installs everything)
make setup

# Or manually:
# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### Run

```bash
# Start everything (backend + frontend)
make dev

# Or manually:
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Start Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 3: Start Frontend
cd frontend
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) and click the orb to start talking!

## 📁 Project Structure

```
chinna/
├── backend/                    # Python FastAPI Backend
│   ├── main.py                 # Entry point
│   ├── config.py               # Settings
│   ├── core/                   # Pipeline orchestration
│   ├── providers/              # ASR, LLM, TTS providers
│   ├── monitoring/             # Latency tracking
│   └── websocket/              # WebSocket handler
├── frontend/                   # Next.js Frontend
│   ├── app/                    # Pages and layouts
│   ├── components/             # UI components
│   ├── hooks/                  # Custom React hooks
│   └── lib/                    # Types and constants
└── scripts/                    # Setup and utility scripts
```

## 🔧 Configuration

Edit `backend/.env` to customize:

```env
# ASR Configuration
WHISPER_MODEL_SIZE=base          # tiny, base, small, medium, large-v3
WHISPER_DEVICE=cpu               # cpu or cuda
WHISPER_COMPUTE_TYPE=int8        # int8, float16, float32

# LLM Configuration
OLLAMA_MODEL=llama3.2:3b         # Any Ollama model
OLLAMA_HOST=http://localhost:11434
LLM_TEMPERATURE=0.3             # Low for less hallucination

# TTS Configuration
TTS_PROVIDER=kokoro              # kokoro or piper
KOKORO_VOICE=af_heart            # Voice ID

# Server
HOST=0.0.0.0
PORT=8000
```

## 🧪 Testing

```bash
cd backend
pytest tests/ -v
```

## 📊 Latency Budget

Target latency breakdown for conversational feel:

| Component | Target | Description |
|-----------|--------|-------------|
| ASR | < 300ms | Audio to transcript |
| LLM TTFT | < 500ms | First token generation |
| TTS TTFB | < 200ms | First audio byte |
| Total | < 1.5s | End-to-end response |

## 🛡️ Development Phases

1. **Phase 1**: End-to-end streaming pipeline ✅
2. **Phase 2**: Latency tracking & monitoring
3. **Phase 3**: Resilience & production hardening

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

Built with ❤️ by [Prudhvi](https://github.com/prudhvimeda)
