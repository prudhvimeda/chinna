.PHONY: setup setup-backend setup-frontend dev dev-backend dev-frontend test clean download-models

# ============================================================
# Setup
# ============================================================

setup: setup-backend setup-frontend download-models
	@echo "✅ Chinna is ready! Run 'make dev' to start."

setup-backend:
	@echo "🐍 Setting up Python backend..."
	cd backend && python3 -m venv venv
	cd backend && ./venv/bin/pip install --upgrade pip
	cd backend && ./venv/bin/pip install -r requirements.txt
	cp -n backend/.env.example backend/.env 2>/dev/null || true
	@echo "✅ Backend ready."

setup-frontend:
	@echo "⚛️  Setting up Next.js frontend..."
	cd frontend && npm install
	@echo "✅ Frontend ready."

download-models:
	@echo "📥 Downloading models..."
	bash scripts/download-models.sh
	@echo "✅ Models downloaded."

# ============================================================
# Development
# ============================================================

dev:
	@echo "🚀 Starting Chinna..."
	@echo "   Backend:  http://localhost:8000"
	@echo "   Frontend: http://localhost:3000"
	@make -j2 dev-backend dev-frontend

dev-backend:
	cd backend && ./venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && npm run dev

# ============================================================
# Testing
# ============================================================

test:
	cd backend && ./venv/bin/pytest tests/ -v

test-coverage:
	cd backend && ./venv/bin/pytest tests/ -v --cov=. --cov-report=html

# ============================================================
# Utilities
# ============================================================

clean:
	rm -rf backend/venv backend/__pycache__ backend/**/__pycache__
	rm -rf frontend/node_modules frontend/.next
	@echo "🧹 Cleaned."

lint:
	cd backend && ./venv/bin/ruff check .
	cd frontend && npm run lint
