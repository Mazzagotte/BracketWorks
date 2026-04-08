# BracketWorks - Project Analysis & Tech Stack Report
**Date:** October 29, 2025
**Analysis By:** Claude Code

---

## 1. Project Structure Summary

BracketWorks is a **full-stack tournament bracket management system** for bowling tournaments with the following architecture:

```
BracketWorks/
├── frontend/                 # Next.js 14 TypeScript PWA
│   ├── app/
│   │   ├── brackets/        # Bracket UI (INCOMPLETE - Placeholder only)
│   │   ├── players/         # Player management (FUNCTIONAL)
│   │   ├── scores/          # Score tracking (IN PROGRESS)
│   │   ├── payouts/         # Payout calculations
│   │   ├── login/           # Authentication pages
│   │   ├── hooks/           # Custom React hooks (useBrackets, usePlayers, etc.)
│   │   ├── lib/             # API client, auth context, types
│   │   └── components/      # Reusable UI components
│   └── types/               # TypeScript definitions
│
├── backend/                 # FastAPI Python application
│   ├── app/
│   │   ├── api/v1/         # REST API endpoints
│   │   │   ├── brackets.py     # Bracket generation API
│   │   │   ├── players.py      # Player management
│   │   │   ├── scores.py       # Score entry
│   │   │   ├── payouts.py      # Payout calculations
│   │   │   └── tournaments.py  # Tournament management
│   │   ├── core/           # Database models, schemas, config
│   │   └── services/       # Business logic
│   │       ├── brackets.py            # Bracket generation logic
│   │       ├── brackets_simple.py     # Simplified version
│   │       ├── bracket_persistence.py # Database persistence
│   │       └── payouts.py             # Payout calculations
│   ├── alembic/            # Database migrations
│   └── tests/              # Test suite
│
├── database/               # PostgreSQL initialization scripts
└── .dev/                  # Development documentation
```

---

## 2. Technology Stack

### Frontend Stack
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 14.2.5 | React framework with App Router |
| **React** | 18.3.1 | UI library |
| **TypeScript** | 5.5.4 | Type-safe development |
| **styled-jsx** | 5.1.7 | Component-scoped CSS |
| **ESLint** | 9.14.0 | Code linting |

**Frontend Characteristics:**
- App Router pattern (not Pages Router)
- Client-side rendering with 'use client' directives
- Custom hooks for API integration
- Context API for auth and header management
- Progressive Web App capabilities
- No UI component library (custom styles)

### Backend Stack
| Technology | Version | Purpose |
|-----------|---------|---------|
| **FastAPI** | 0.115.2 | Modern async Python API framework |
| **SQLAlchemy** | 2.0.35 | ORM for database operations |
| **Pydantic** | 2.9.2 | Data validation |
| **PostgreSQL** | 16 | Primary database |
| **Alembic** | 1.16.5 | Database migrations |
| **Uvicorn** | 0.30.6 | ASGI server |
| **python-jose** | 3.5.0 | JWT authentication |
| **bcrypt** | 3.2.2 | Password hashing |
| **pytest** | 7.4.4 | Testing framework |

**Backend Characteristics:**
- RESTful API design
- JWT-based authentication
- Database connection pooling
- Automated migrations with Alembic
- Comprehensive API documentation (Swagger/ReDoc)

### Infrastructure
| Component | Details |
|-----------|---------|
| **Database** | PostgreSQL 16 with Docker |
| **Container Orchestration** | Docker Compose (3 services) |
| **Development** | Hot reload enabled (both frontend/backend) |
| **Deployment** | Render.com (production) |
| **Version Control** | Git |

---

## 3. Identified Issues & Warnings

### Critical Issues

#### 🔴 **ISSUE #1: Brackets Page - Missing UI Implementation**
**Location:** `frontend/app/brackets/page.tsx:289-302`

**Description:**
The brackets page is essentially a placeholder with no actual bracket rendering logic.

**Current State:**
```tsx
<h1>Brackets Page</h1>
<p>Bracket content will be built here.</p>
```

**Impact:**
- Main feature of the application is non-functional
- Users cannot view or interact with generated brackets
- API calls work (hooks are properly implemented), but no UI to display results

**Evidence:**
- Backend API endpoints exist and are functional (`/api/v1/brackets/`)
- `useBrackets` hook is complete with all CRUD operations
- Bracket generation service exists in backend (`services/brackets.py`)
- UI component is missing to render the bracket tree/grid

---

#### 🟡 **ISSUE #2: Multiple Bracket Service Versions**
**Location:** `backend/app/services/`

**Files Found:**
- `brackets.py` (18,657 bytes)
- `brackets_simple.py` (13,394 bytes)
- `bracket_persistence.py` (10,757 bytes)
- `bracket_persistence_simple.py` (8,049 bytes)

**Description:**
Multiple versions of bracket services suggest incomplete refactoring or work-in-progress code.

**Impact:**
- Code duplication
- Unclear which version is active
- Potential inconsistency in bracket generation

---

#### 🟡 **ISSUE #3: Incomplete Scores Feature**
**Location:** `frontend/app/scores/`

**Git Status Shows:**
```
?? frontend/app/scores/components/
?? frontend/app/scores/types.ts
```

**Description:**
Scores feature has untracked files, suggesting new development in progress.

**Impact:**
- Scores components may not be integrated
- Type definitions not committed
- Feature may be partially functional

---

### Configuration Warnings

#### ⚠️ **TypeScript Strict Mode Disabled**
**Location:** `frontend/tsconfig.json:7`
```json
"strict": false
```

**Impact:**
- Reduced type safety
- Potential runtime errors not caught at compile time
- May allow `any` types to slip through

---

#### ⚠️ **No Compilation Errors**
**Status:** ✅ **PASS**

TypeScript compilation completed without errors:
```bash
cd frontend && npx tsc --noEmit
# No output = no errors
```

---

### Recent File Modifications (Git Status)

**Modified Files:**
- `frontend/app/brackets/page.tsx` - Main brackets UI
- `frontend/app/hooks/useBrackets.ts` - Bracket hooks
- `frontend/app/layout.tsx` - Root layout
- `frontend/app/lib/auth-context.tsx` - Auth context
- `frontend/app/lib/header-context.tsx` - Header context
- `frontend/app/login/page.tsx` - Login page
- `frontend/app/players/components/PlayersTable.tsx` - Players table
- `frontend/app/players/hooks/usePlayers.ts` - Players hooks
- `frontend/app/players/page.tsx` - Players page
- `frontend/app/players/types.ts` - Player types
- `frontend/app/scores/page.tsx` - Scores page

**Untracked Files:**
- `frontend/app/scores/components/` - New components directory
- `frontend/app/scores/types.ts` - Score type definitions

---

## 4. Architecture Analysis

### Frontend Architecture

**State Management:**
- ✅ Custom hooks pattern (useBrackets, usePlayers, useTournaments)
- ✅ Context API for global state (AuthContext, HeaderContext)
- ✅ Local component state with useState

**Data Flow:**
```
User Action → Component → Custom Hook → API Client → Backend API
                ↓                           ↓
            Local State ← Response Data ← JSON Response
```

**API Integration:**
- Centralized API client (`app/lib/api`)
- Type-safe requests with TypeScript interfaces
- Toast notifications for user feedback
- Error handling in hooks

### Backend Architecture

**API Design:**
- RESTful endpoints under `/api/v1/`
- Versioned API for future compatibility
- Swagger documentation at `/docs`
- ReDoc documentation at `/redoc`

**Key Endpoints:**
| Endpoint | Purpose | Status |
|----------|---------|--------|
| `/api/v1/brackets/generate-multiple` | Generate tournament brackets | ✅ |
| `/api/v1/brackets/preview` | Preview bracket structure | ✅ |
| `/api/v1/brackets/update-match-score` | Update match scores | ✅ |
| `/api/v1/players/` | Player CRUD operations | ✅ |
| `/api/v1/scores/` | Score entry | ✅ |
| `/api/v1/payouts/` | Payout calculations | ✅ |

**Database Schema:**
- SQLAlchemy ORM models
- Alembic migrations for version control
- PostgreSQL with indexing optimization
- Connection pooling (size: 20, overflow: 30)

---

## 5. Development Environment

### Running Services
```yaml
Services (Docker Compose):
  - db:       PostgreSQL on port 5432
  - backend:  FastAPI on port 8000
  - frontend: Next.js on port 3000
```

### Environment Variables
**Frontend:**
- `NEXT_PUBLIC_BACKEND_URL`: Backend API URL (default: http://localhost:8000)
- `NEXT_TELEMETRY_DISABLED`: Telemetry disabled for performance

**Backend:**
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: JWT signing key
- `CORS_ORIGINS`: Allowed frontend origins
- `UVICORN_WORKERS`: 1 (development)
- `UVICORN_RELOAD`: true (hot reload enabled)

### Known Platform Issues
**Windows Development:**
- Next.js production builds may fail due to symlink issues
- Workaround: Use `yarn dev` for development
- Production builds work correctly in Docker/Linux

---

## 6. Summary of Findings

### What's Working ✅
1. Backend API is fully functional
2. Database schema and migrations are complete
3. Authentication system is operational
4. Players page is functional
5. Custom hooks for data fetching are properly implemented
6. No TypeScript compilation errors
7. Docker development environment is configured
8. API documentation is available

### What's Not Working ❌
1. **Brackets UI rendering** - Main feature is non-functional
2. Scores feature has uncommitted/incomplete components
3. Multiple versions of bracket services (needs cleanup)

### Priority Action Items
1. **HIGH:** Implement bracket visualization UI component
2. **HIGH:** Determine which bracket service version to use (remove duplicates)
3. **MEDIUM:** Complete and commit scores feature
4. **LOW:** Enable TypeScript strict mode for better type safety
5. **LOW:** Add tests for frontend components

---

## Next Steps

See `IMPLEMENTATION_PLAN.md` for detailed steps to fix the brackets feature and complete the application.
