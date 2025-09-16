
# BracketWorks Web — Starter Monorepo

A pragmatic starter for **BracketWorks** as a web app:

- **Frontend**: Next.js 14 (TypeScript) PWA
- **Backend**: FastAPI (Python 3.11), SQLAlchemy
- **DB**: PostgreSQL
- **Dev**: Docker Compose (`docker compose up --build`)

> This is a skeleton with stubs and example endpoints (health, bowlers, brackets). Replace with your real logic.

## Quick start

1. Install Docker Desktop.
2. Copy `.env.example` to `.env` and adjust values if needed.
3. Run:
   ```bash
   docker compose up --build
   ```
4. Open:
   - Frontend: http://localhost:3000
   - Backend docs (Swagger): http://localhost:8000/docs

## Repo layout

- `frontend/`: Next.js app (PWA ready)
- `backend/`: FastAPI app with basic modules and routes
- `database/`: init SQL
- `shared/`: place for shared contracts, e.g., OpenAPI/TypeScript types

## Replace me (BracketWorks specifics)

- Implement bracket generation in `backend/app/services/brackets.py`
- Add payout presets in `backend/app/services/payouts.py`
- Flesh out domain models in `backend/app/core/models.py`
- Build the dashboard UI in `frontend/app/page.tsx` and `frontend/app/components/BracketPreview.tsx`
