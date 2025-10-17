
# BracketWorks Web Application

A tournament bracket management system with payout calculations:

- **Frontend**: Next.js 14 (TypeScript) PWA
- **Backend**: FastAPI (Python 3.13), SQLAlchemy, Alembic
- **Database**: PostgreSQL (Production: Render.com)
- **Development**: Local development setup

## Quick Start

### Prerequisites
- Node.js 22.19.0+
- Python 3.13+
- Yarn package manager

### Development Setup

1. **Backend Setup**:
   ```bash
   cd backend
   pip install -r requirements.txt
   # Set up your .env file with DATABASE_URL
   alembic upgrade head
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

2. **Frontend Setup**:
   ```bash
   cd frontend
   yarn install
   yarn dev
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API docs: http://localhost:8000/docs

## Known Issues

### Windows Development Notes
- **Production Build Issue**: Next.js production builds may fail on Windows due to symlink issues. Development server works correctly.
- **Workaround**: Use `yarn dev` for development. Production builds work correctly in Linux environments (Docker, CI/CD).

## Environment Configuration

Create a `.env` file in the backend directory with:
```bash
DATABASE_URL=postgresql://user:password@host:port/database
SECRET_KEY=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=120
CORS_ORIGINS=["http://localhost:3000"]
```

## Project Structure

- `frontend/`: Next.js React application
- `backend/`: FastAPI Python application
- `database/`: Database initialization scripts
- `docker-compose.yml`: Docker development environment
