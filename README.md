
# BracketWorks

**Professional Tournament Bracket Management System**

A comprehensive web application for managing tournament brackets, tracking player scores, calculating automated payouts, and generating detailed tournament reports.

**Live app**: [https://bracketworks.app](https://bracketworks.app)

## Features

### Tournament Management
- **Multi-Bracket Tournaments**: Support for both scratch and handicap bracket types
- **Automated Bracket Generation**: Intelligent player seeding based on scores and performance
- **Real-time Score Tracking**: Live match updates with automatic winner advancement
- **Squad Management**: Organize tournaments by squad groups

### Payout System
- **Automated Calculations**: Intelligent payout distribution based on customizable prize pools
- **Entry Fee Management**: Flexible entry fee structures for different bracket types
- **House Percentage**: Configurable house take with transparent calculations
- **Payout History**: Complete audit trail of all tournament payouts and winners

### Analytics & Reporting
- **Player Performance Tracking**: Detailed statistics on wins, losses, and earnings
- **Entry Analysis**: Comprehensive breakdown of player participation and results
- **Tournament Summaries**: Complete tournament reports with all bracket results
- **Financial Tracking**: Prize pool management and payout verification

### Technical Features
- **Progressive Web App (PWA)**: Mobile-responsive with offline capabilities
- **Real-time Updates**: Live bracket updates and score synchronization
- **Data Persistence**: Reliable bracket and payout storage with version tracking
- **User Authentication**: Secure user management and access control

## Technology Stack

- **Frontend**: Next.js 16 (TypeScript), Progressive Web App, Responsive Design
- **Backend**: FastAPI (Python 3.11), SQLAlchemy ORM, Alembic Migrations
- **Database**: PostgreSQL 16 with optimized indexing
- **Cache / Rate Limiting**: Redis 7
- **Deployment**: Docker containers for local and self-hosted environments
- **Development**: Hot reload, comprehensive testing suite

## Quick Start

### Prerequisites
- **Node.js** 20+
- **Python** 3.11+
- **Yarn** package manager
- **PostgreSQL** (or use Docker setup)

### Option 1: Docker Development (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd BracketWorks

# Start local database, Redis cache, and backend with Docker
docker compose up -d --build db redis backend

# Start the frontend locally
cd frontend
yarn install
yarn dev

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/docs
# Database: localhost:5432
# Redis: localhost:6379
```

### Docker Development Notes
```bash
# Default local Docker database URL used by the backend container
postgresql://bracketworks:bracketworks@db:5432/bracketworks

# Default local database URL if you run the backend outside Docker
postgresql://bracketworks:bracketworks@localhost:5432/bracketworks
```

- The backend container now waits for Postgres and runs `alembic upgrade head` automatically on startup.
- The PowerShell launcher [start_bracketworks.ps1](start_bracketworks.ps1) starts Docker `db`, `redis`, and `backend`, then launches the frontend against `http://localhost:8000`.
- If you want the frontend in Docker too, run `docker compose up --build`, then open `http://localhost:3000`.

### Option 2: Manual Setup

#### Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Set up environment variables (see Environment Configuration below)
cp .env.example .env  # Edit with your database credentials

# Run database migrations
alembic upgrade head

# Start the development server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend Setup
```bash
cd frontend
yarn install

# Start development server
yarn dev
```

#### Access Points
- **Frontend**: http://localhost:3000
- **Backend API Documentation**: http://localhost:8000/docs
- **Interactive API**: http://localhost:8000/redoc

## Environment Configuration

Create a `.env` file in the backend directory:

```bash
# Environment
ENVIRONMENT=development
DEBUG=true

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/bracketworks

# Security
SECRET_KEY=your-super-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=120

# CORS Origins (comma-separated)
CORS_ORIGINS=["http://localhost:3000","https://yourdomain.com"]

# Optional: Logging Level
LOG_LEVEL=INFO

# Email provider (Resend hosted templates)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=no-reply@bracketworks.app
FROM_NAME=BracketWorks
FRONTEND_URL=https://bracketworks.app

# Cache / Rate Limiting (Redis)
REDIS_URL=redis://localhost:6379

# Rate limiting (per-minute defaults)
RATE_LIMIT_LOGIN_PER_MINUTE=10
RATE_LIMIT_PASSWORD_RESET_PER_MINUTE=6
RATE_LIMIT_PUBLIC_PER_MINUTE=120
RATE_LIMIT_BRACKET_GENERATE_PER_MINUTE=20

# Frontend (used by Docker compose)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

Rate limiting behavior:
- Production should use Redis-backed counters via `REDIS_URL`.
- If Redis is unavailable, the API falls back to process-local in-memory counters.
- Rate-limited responses return HTTP `429` with `Retry-After` and `X-RateLimit-*` headers.

## Project Structure

```
BracketWorks/
├── frontend/                 # Next.js TypeScript PWA
│   ├── app/                 # App router pages and components
│   │   ├── brackets/        # Bracket management interface
│   │   ├── payouts/         # Payout calculation and tracking
│   │   ├── players/         # Player management
│   │   ├── scores/          # Score entry and tracking
│   │   ├── dashboard/       # Tournament dashboard
│   │   ├── admin/           # Admin panel
│   │   ├── settings/        # User and app settings
│   │   ├── view/            # Public tournament view
│   │   ├── login/           # Authentication
│   │   ├── signup/          # New user registration
│   │   ├── verify-email/    # Email verification flow
│   │   ├── reset-password/  # Password reset flow
│   │   └── components/      # Reusable UI components
│   ├── types/               # TypeScript type definitions
│   └── public/              # Static assets and PWA manifest
├── backend/                 # FastAPI Python application
│   ├── app/
│   │   ├── api/v1/         # API endpoint routes
│   │   ├── core/           # Configuration, models, schemas
│   │   └── services/       # Business logic and data processing
│   ├── alembic/            # Database migration scripts
│   └── tests/              # Test suite
├── database/               # Database initialization scripts
└── docker-compose.yml     # Development environment setup
```

## Development & Testing

### Running Tests
```bash
# Backend tests
cd backend
python -m pytest tests/ -v

# Frontend tests (if configured)
cd frontend
yarn test
```

### Database Migrations
```bash
# Create new migration
cd backend
alembic revision --autogenerate -m "Description of changes"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

## Deployment

### Local Development

```bash
# Start all local services
docker compose up -d --build

# Stop local services
docker compose down
```

### Production

The full stack runs as four Docker services: `db`, `redis`, `backend`, `frontend`. Set the following environment variables on your host before deploying:

```bash
ENVIRONMENT=production
DEBUG=false
SECRET_KEY=<64-char random string>          # openssl rand -hex 32
DATABASE_URL=postgresql://user:pass@host:5432/bracketworks
REDIS_URL=redis://redis:6379/0
CORS_ORIGINS=https://bracketworks.app
FRONTEND_URL=https://bracketworks.app
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_BACKEND_URL=https://bracketworks.app
```

Then start all services:

```bash
docker compose up -d --build
```

### Production Security Checklist

- [ ] `SECRET_KEY` is a strong random value (never use the default)
- [ ] `DEBUG=false` and `ENVIRONMENT=production`
- [ ] `CORS_ORIGINS` is set to your domain only
- [ ] Redis is running and `REDIS_URL` is set (required for distributed rate limiting)
- [ ] `RESEND_API_KEY` is set (required for email verification and password reset)
- [ ] API docs are disabled — set `docs_url=None` and `redoc_url=None` in `backend/app/main.py` for production if the interactive docs should not be publicly accessible
- [ ] PostgreSQL is not exposed on a public port (`ports` entry for `db` removed or firewalled)

## Performance Notes

- **Large Tournaments**: Bracket generation optimized for tournaments up to 64 players
- **Caching**: Bracket data cached via Redis to improve load times
- **Database Indexing**: Optimized queries for player lookup and tournament statistics

## API Documentation

The FastAPI backend exposes interactive docs in development:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

> **Note**: Consider disabling these in production by setting `docs_url=None, redoc_url=None` on the `FastAPI(...)` constructor in `backend/app/main.py`.

### Key API Endpoints
- `/api/v1/brackets/` - Bracket generation and management
- `/api/v1/payouts/` - Payout calculations and history
- `/api/v1/players/` - Player management and statistics
- `/api/v1/scores/` - Score entry and match results
- `/api/v1/tournaments/` - Tournament and squad management
- `/api/v1/squads/` - Squad group management
- `/api/v1/bowlers/` - Bowler profile management
- `/api/v1/admin/` - Admin audit and management tools
- `/api/v1/health/` - Service health check

## Support

For issues or questions, open an issue on the repository or reach out via [bracketworks.app](https://bracketworks.app).

## License

MIT

---

**BracketWorks** - Streamlining tournament management with intelligent automation and comprehensive tracking.