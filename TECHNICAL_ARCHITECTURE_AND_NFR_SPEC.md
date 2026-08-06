# BracketWorks Technical Architecture and NFR Specification

Date: 2026-05-12 | Last updated: 2026-05-27

## Table of Contents
- [1) System Purpose](#1-system-purpose)
- [2) Architecture Overview](#2-architecture-overview)
- [3) Hosting and Deployment](#3-hosting-and-deployment)
- [4) Non-Functional Requirements](#4-non-functional-requirements)
- [5) Scope and Personas](#5-scope-and-personas)
- [6) Critical Data Flows](#6-critical-data-flows)
- [7) API and Contract Governance](#7-api-and-contract-governance)
- [8) Security Controls](#8-security-controls)
- [9) Implementation Backlog](#9-implementation-backlog)
- [10) Current State](#10-current-state)
- [11) Change Log](#11-change-log)

---

## 1) System Purpose
BracketWorks is a web platform for running bowling tournaments with bracket generation, score capture, winner progression, and payout management. The system supports authenticated organizer workflows and player/tournament data persistence.

---

## 2) Architecture Overview

### Frontend
- Stack: **Next.js 15.5.4**, React 18, TypeScript
- Pattern: App Router with domain-driven route groups (brackets, payouts, players, scores, admin, auth)
- Integration: Environment-driven API base URL via `NEXT_PUBLIC_BACKEND_URL`
- Public content: Landing page with hero section, feature grid, workflow steps, benefits, and CTAs
- SEO: OpenGraph, Twitter Card, JSON-LD WebApplication schema, canonical URLs, XML sitemap
- Client runtime:
  - Centralized API client with token attachment, retry/backoff, GET cache, and automatic `Idempotency-Key` headers on mutations
  - Responsive mobile-first layout with PWA assets (manifest/service worker)
  - Active session visibility and per-session revoke UI in settings

### Backend
- Stack: **FastAPI 0.136.1**, SQLAlchemy 2.0.35, Alembic 1.16.5
- Runtime: **Python 3.13+** (current local environment), Python 3.12+ recommended for the container setup
- API routes: `/api/v1` — health, admin, bowlers, brackets, tournaments, users, squads, bracket_settings, scores, payouts, public
- Cross-cutting:
  - CORS policy by environment with localhost + production domain support
  - Centralized rate limiting (Redis-backed with in-memory fallback)
  - Request timing and slow-request logging middleware
  - Structured response shapes for errors
  - Session intelligence (device, region, risk score) and MFA-readiness auth contract
- Startup safety: wait-for-db with exponential backoff → `alembic upgrade head` → serve traffic; fail-fast on DB or migration errors

### Data Layer
- **PostgreSQL 16** — primary database (Railway managed in production, docker-compose locally)
- **Redis 7** — rate limiting, session state, refresh tokens, async job status (Railway managed in production)
- **ORM**: SQLAlchemy 2.0.35 with Alembic 1.16.5 migration-managed schema
- **Data domains**:
  - users / auth_sessions / refresh_tokens / login_attempts
  - tournaments / squads / bowlers / entries
  - brackets / bracket_settings / scores / winners
  - payouts / payout_summaries
  - admin_audit_logs
  - idempotency_keys
  - email_verification_tokens / password_reset_tokens
- 16 Alembic migrations applied to date; daily automated backups retained 14+ days (Railway)

---

## 3) Hosting and Deployment

### Local Development
- Docker Compose: `db` (postgres:16), `redis` (redis:7-alpine), `backend` (port 8000)
- Recommended mode: containers for DB + Redis + backend, frontend apps run locally via pnpm scripts
- Start script: `start_bracketworks.ps1` launches the local services and the frontend/backend process flow for development
- Backend auto-runs `alembic upgrade head` on startup

### Production (Railway)
- **4-service topology**: PostgreSQL plugin, Redis plugin, Backend (FastAPI, port 8000), Frontend (Next.js, port 3000)
- **Custom domains** via Cloudflare: `bracketworks.app` (frontend), `api.bracketworks.app` (backend)
- **TLS**: automatic HTTPS at Railway/Cloudflare edge
- **Deployment**: auto-build on push to the default branch; backend runs migrations before serving; automatic rollback on health check failure

### Environment Variables
| Scope | Required Variables |
|---|---|
| Backend | `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, `CORS_ORIGINS`, `FRONTEND_URL`, `ENVIRONMENT`, `DEBUG` |
| Backend (optional) | `FROM_EMAIL`, `FROM_NAME`, `RESEND_API_KEY`, `LOG_LEVEL`, `RATE_LIMIT_*_PER_MINUTE` |
| Frontend | `NEXT_PUBLIC_BACKEND_URL` |

Rate limiter defaults: login 10/min, password reset 6/min, public 120/min, bracket generation 20/min. Falls back to in-memory if `REDIS_URL` is unavailable.

### External Dependencies
- Resend hosted templates for transactional email (password reset)

---

## 4) Non-Functional Requirements

### Performance
- p50 <= 150 ms / p95 <= 500 ms for read endpoints under normal load
- p95 <= 1000 ms for bracket generation and payout endpoints
- Primary route transition <= 1.5 s on broadband desktop; TTI <= 3.0 s on modern mobile
- Must support tournaments up to 64 active players without degradation

### Availability and Reliability
- 99.5% monthly availability target (app + API combined)
- 5xx response rate <= 1.0% per rolling 24h window
- API must fail fast on DB connectivity or migration failure; health endpoint must reflect readiness

### Data Integrity and Recovery
- Schema changes only via Alembic migrations
- Daily automated backups retained 14+ days; RPO <= 24h, RTO <= 4h

### Security
- Bearer token auth on all protected endpoints; bcrypt/passlib password hashing
- Secrets via environment variables only — never hardcoded or committed
- HTTPS required in production; admin endpoints restricted to admin identities
- Failed auth attempts and admin actions must be logged

### Quality
- Backend unit/integration tests required for new service/business logic
- Critical paths (auth, bracket generation, payouts) must have regression coverage
- Lint and type checks must pass in CI before release
- API contract changes must be versioned or feature-flagged

---

## 5) Scope and Personas

### In Scope
- Tournament creation and management
- Squad scheduling and selection
- Bowler roster, entries, and score tracking
- Bracket generation, progression, and persistence
- Payout calculation and payout history
- Admin oversight and public read-only viewing

### Out of Scope
- Payment processing gateway integration
- Native mobile applications
- Multi-tenant org-level billing and subscriptions
- Real-time websocket push (polling/refresh model is current approach)

### Personas
- **Tournament Director** — configures tournaments and executes operations
- **Scorekeeper** — enters and corrects scores
- **Administrator** — platform-level user/tournament oversight
- **Public Viewer** — read-only consumer of published tournament views

### Critical Journeys
1. Login and access dashboard
2. Configure tournament and bracket settings
3. Add bowlers and entries, then generate brackets
4. Update match scores and finalize winners
5. Calculate, save, and review payouts

---

## 6) Critical Data Flows

- **Login**: `POST /api/v1/users/login` → validate credentials → issue JWT access token + opaque refresh token → persist session → client stores tokens
- **Refresh token rotation**: `POST /api/v1/users/refresh` → validate → issue new access + refresh tokens → invalidate prior refresh token immediately
- **Bracket generation**: `POST /api/v1/brackets/generate` → async job queue → return job ID → client polls `GET /api/v1/brackets/jobs/{job_id}` → persist bracket to PostgreSQL
- **Score submission**: `POST /api/v1/scores` → idempotency key validation → persist score → trigger bracket progression → advance winner automatically
- **Payout calculation**: `POST /api/v1/payouts/calculate` → async job → compute prize distribution → persist payout records → return summary
- **Public tournament view**: `GET /api/v1/public/tournaments/{id}` → no auth → aggressive cache-control headers → return readonly bracket/scores/payouts

---

## 7) API and Contract Governance

### Versioning and Compatibility
- Primary namespace: `/api/v1`; breaking changes require additive migration path or new versioned namespace
- Additive response fields are preferred; existing field semantics must not change without a version bump
- Contract-sensitive endpoints (auth, bracket generation, payouts, public) require regression tests before any change

### Error Contract
- All errors return consistent shape: `detail` (human-readable), optional `code` (machine-readable), optional `context`

### Authentication Session Contract
- **Access token**: JWT bearer, 15 min (production) / 60 min (non-production)
- **Refresh token**: opaque, server-tracked, 30-day absolute max, 7-day idle timeout
- Every successful refresh issues a new refresh token and invalidates the prior one immediately
- Replay attempt forces session revocation
- Logout revokes the active device session; admin global revoke invalidates all sessions for a user
- Server stores: session_id, user_id, issued_at, last_seen_at, source_ip hash, user-agent fingerprint, revoked_at

---

## 8) Security Controls

| Control | Requirement | Verification | Status |
|---|---|---|---|
| Authentication | Token-based auth on all protected endpoints | Integration tests + smoke | ✅ |
| Session Strategy | JWT access + opaque refresh rotation with server-side tracking | Integration tests | ✅ |
| Authorization | Admin-only routes enforce role checks | Endpoint tests | ✅ |
| Password Handling | bcrypt/passlib only, no plain text | Code review + tests | ✅ |
| Brute-force Protection | Progressive throttle + IP hard cap on login | Security tests | ✅ |
| Session Revocation | Logout, admin revoke, and replay detection all invalidate sessions | Integration tests | ✅ |
| Rate Limiting | Redis-backed limiter with in-memory fallback on all auth/public/high-cost routes | Security tests | ✅ |
| Email Verification | Required before privileged flows | Integration tests | ⏸ Deferred |
| MFA Readiness | Auth contract supports step-up challenge without client breakage | Architecture review | ✅ Contract only |
| Secrets Management | No secrets in repo; environment-managed only | Secret scan per PR | ✅ |
| TLS Enforcement | HTTPS required in production | External probe | ✅ (Railway/Cloudflare) |
| Dependency Security | Vulnerability scan + patch SLA (Critical 48h, High 7d, Medium 30d) | CI pip-audit + npm audit | ✅ |

### Login Throttling Defaults
- Per-account: progressive delay after 5 failed attempts within 15 minutes
- Per-IP: hard cap and temporary block after repeated failures
- Failed attempts logged with normalized reason and risk metadata

---

## 9) Implementation Backlog

### Next Steps
- **P0-2 (Email verification)**: deferred — requires Resend API key and hosted template setup
- **P1-1 (Metrics/tracing)**: create `monitoring.py` and `logging_config.py` from scratch (prior stubs deleted as dead code); emit request count, latency, error rate, and auth-failure metrics; add correlation IDs to logs
- **P1-2 (Alerting)**: define alert thresholds for p95 latency, 5xx rate, and DB connectivity failures; expose readiness semantics in health endpoint
- **P1-3 (Backup drills)**: document and script RPO/RTO restore verification procedures
- **P1-4 (API client hardening)**: ensure all authenticated pages consistently use the shared refresh-aware client

### P0 Backlog

| ID | Work Package | Status |
|---|---|---|
| P0-1 | Centralized rate limiting — Redis-backed with in-memory fallback across auth/public/high-cost routes | ✅ Complete |
| P0-2 | Email verification enforcement for password reset and privileged flows | ⏸ Deferred |
| P0-3 | Security/quality CI gates — backend tests, frontend lint/type/build, pip-audit, npm audit | ✅ Complete |
| P0-4 | Auth integration test baseline — refresh rotation, logout revoke, admin revoke, throttle | ✅ Complete |

### P1 Backlog

| ID | Work Package | Primary Files |
|---|---|---|
| P1-1 | Metrics and tracing baseline | `backend/app/core/monitoring.py` (create fresh), `backend/app/core/logging_config.py` (create fresh), `backend/app/main.py` |
| P1-2 | Alerting thresholds for SLO breach signals | `backend/app/api/v1/health.py`, alerting config |
| P1-3 | Backup/restore drill scripts and documentation | `backend/scripts/`, `README.md` |
| P1-4 | Frontend API client hardening across all authenticated pages | `frontend/app/lib/api.ts`, dashboard, players, scores, payouts pages |

### P2 Backlog

| ID | Work Package | Status |
|---|---|---|
| P2-1 | Async job architecture for bracket generation and payouts | ✅ Backend baseline complete |
| P2-2 | Idempotency and duplicate-write protection on critical mutations | ✅ Backend + client baseline complete |
| P2-3 | Public API caching and CDN-friendly cache-control headers | ✅ Backend complete |
| P2-4 | Session intelligence fields + MFA-readiness contract extension | ✅ Backend + frontend baseline complete |

### Future Roadmap (prioritized)
- Tournament rules engine specification (seeding, tie-break, byes, handicap, payout rounding)
- Full audit event subsystem (score edits, bracket rerolls, payout edits with actor + diff + timestamp)
- Observability stack: Prometheus, Grafana, Sentry, OpenTelemetry
- MFA step-up (TOTP/WebAuthn) — auth contract is already MFA-ready
- Redis-backed job queues (Celery/Dramatiq/RQ) for multi-squad and bulk operations
- Horizontal backend scaling, read replicas, CDN caching

---

## 10) Current State

*As of 2026-05-27*

### User-Facing Features (Production Ready)
- Public landing page with SEO (OpenGraph, JSON-LD, sitemap, robots.txt)
- Authentication: sign up, login, password reset, session management, logout with revocation
- Tournament management: create/configure tournaments, bracket types (scratch/handicap), entry fees, prize pools
- Squad management
- Bracket generation: automated seeding, intelligent pairing, async job model
- Score tracking: live updates, automatic winner advancement
- Payout calculations: automated prize distribution
- Player statistics: win/loss, earnings history, performance analytics
- Admin dashboard: user management, tournament oversight, audit logs
- Mobile-responsive PWA with offline capabilities
- Public tournament views: read-only bracket/payout visibility

### Known Gaps and Deferred Items
- ⏸ Email verification not enforced in password reset flow (waiting on Resend template setup)
- ⏳ Social media preview images (og-image.png, twitter-image.png) not yet created
- ⏳ Google Search Console registration and sitemap submission pending
- ⏳ Metrics/alerting stack not deployed (Railway logs available for debugging)
- ⏳ MFA UI not implemented (auth contract is ready)

### Production Readiness Checklist
- ✅ Authentication hardened with session management and brute-force protection
- ✅ Rate limiting deployed across all critical routes
- ✅ CI gates blocking merges on test, lint, and security failures
- ✅ Docker Compose local development with auto-migration
- ✅ Railway deployment with managed PostgreSQL and Redis
- ✅ Custom domains (bracketworks.app, api.bracketworks.app) active via Cloudflare
- ✅ Public landing page with SEO
- ✅ Responsive mobile-first PWA
- ⏳ Social media preview images
- ⏳ Email verification enforcement
- ⏳ Metrics/alerting dashboard

---

## 11) Change Log

| Date | Summary |
|---|---|
| 2026-05-12 | Initial spec baseline (sections 1–18) |
| 2026-05-13 | Refresh-session auth flow; frontend token refresh lifecycle; auth smoke CI workflow |
| 2026-05-13 | P0 execution: rate limiting (P0-1), CI gates (P0-3), auth regression tests (P0-4); P0-2 deferred |
| 2026-05-13 | P2 backend: async jobs (P2-1), idempotency (P2-2), CDN cache headers (P2-3), session intelligence (P2-4) |
| 2026-05-13 | P2 frontend: session list/revoke UI in settings, automatic Idempotency-Key headers in API client |
| 2026-05-15 | Railway 4-service production deployment; frontend Dockerfile rewritten to multi-stage standalone build; Cloudflare custom domains configured |
| 2026-05-15 | Dependency hardening: `next` upgraded to 14.2.35 (CVE-2025-55184, CVE-2025-67779); `pytest-asyncio` >=0.24.0; GitHub Actions pinned |
| 2026-05-15 | Codebase cleanup: dead helper functions removed, `setBracketSize` bug fixed, 4 dead frontend files deleted |
| 2026-05-18 | Public landing page with SEO (OpenGraph, Twitter Card, JSON-LD, sitemap.xml, robots.txt, 15+ keywords) |
| 2026-05-18 | Spec sync: updated versions (Next.js 16.2.6, FastAPI 0.136.1, SQLAlchemy 2.0.35, Alembic 1.16.5), deployment details |
| 2026-05-27 | Dead-code audit: deleted `cache.py`, `email_templates.py`, `logging_config.py`, `monitoring.py` (never imported); deleted 2 unused CSS files; removed orphaned `CACHE_TTL_SECONDS` setting; backend quality fixes (bulk delete, `rng.sample()`, `datetime.now(timezone.utc)`); README rewritten as public-facing description; spec trimmed to remove enterprise-overhead sections |


