
# BracketWorks

**Professional Tournament Bracket Management System**

A comprehensive web application for managing tournament brackets, tracking player scores, calculating automated payouts, and generating detailed tournament reports.

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

- **Frontend**: Next.js 14 (TypeScript), Progressive Web App, Responsive Design
- **Backend**: FastAPI (Python 3.13), SQLAlchemy ORM, Alembic Migrations
- **Database**: PostgreSQL with optimized indexing
- **Deployment**: Docker containers for local and self-hosted environments
- **Development**: Hot reload, comprehensive testing suite

## Quick Start

### Prerequisites
- **Node.js** 22.19.0+
- **Python** 3.13+
- **Yarn** package manager
- **PostgreSQL** (or use Docker setup)

### Option 1: Docker Development (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd BracketWorks

# Start local database and backend with Docker
docker compose up -d --build db backend

# Start the frontend locally
cd frontend
yarn install
yarn dev

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/docs
# Database: localhost:5432
```

### Docker Development Notes
```bash
# Default local Docker database URL used by the backend container
postgresql://bracketworks:bracketworks@db:5432/bracketworks

# Default local database URL if you run the backend outside Docker
postgresql://bracketworks:bracketworks@localhost:5432/bracketworks
```

- The backend container now waits for Postgres and runs `alembic upgrade head` automatically on startup.
- The PowerShell launcher [start_bracketworks.ps1](e:/BracketWorks/start_bracketworks.ps1) starts Docker `db` and `backend`, then launches the frontend against `http://localhost:8000`.
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

# Optional: Cache Configuration
REDIS_URL=redis://localhost:6379
```

## Project Structure

```
BracketWorks/
├── frontend/                 # Next.js TypeScript PWA
│   ├── app/                 # App router pages and components
│   │   ├── brackets/        # Bracket management interface
│   │   ├── payouts/         # Payout calculation and tracking
│   │   ├── players/         # Player management
│   │   ├── scores/          # Score entry and tracking
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

The current setup is focused on local Docker and local PostgreSQL development.

```bash
# Start local services
docker compose up -d --build db backend

# Stop local services
docker compose down
```

## Known Issues & Platform Notes

### Windows Development
- **Next.js Production Builds**: May encounter symlink issues on Windows
- **Workaround**: Use `yarn dev` for development; production builds work correctly in Linux/Docker environments
- **PowerShell Scripts**: Included helper scripts for Windows development workflow

### Performance Considerations
- **Large Tournaments**: Bracket generation optimized for tournaments up to 64 players
- **Caching**: Bracket data cached to improve load times
- **Database Indexing**: Optimized queries for player lookup and tournament statistics

## API Documentation

The FastAPI backend provides comprehensive API documentation:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Key API Endpoints
- `/api/v1/brackets/` - Bracket generation and management
- `/api/v1/payouts/` - Payout calculations and history
- `/api/v1/players/` - Player management and statistics
- `/api/v1/scores/` - Score entry and match results

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues, feature requests, or questions:
- **GitHub Issues**: Use the repository issue tracker
- **Documentation**: Check the `/docs` directory for detailed guides
- **API Reference**: Use the interactive API documentation

---

**BracketWorks** - Streamlining tournament management with intelligent automation and comprehensive tracking.
