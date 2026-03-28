# CLAUDE.md — Cloudifyapps ERP

## Project Overview

Full-stack multi-tenant ERP system with 11 integrated business modules (CRM, Sales, Purchase, Inventory, Projects, HR, Tickets, Documents, Settings, Auth, Utility). SaaS-ready with tenant isolation and RBAC.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI 0.115.6, SQLAlchemy 2.0 (async), Alembic |
| Frontend | Next.js 16, TypeScript 5, Tailwind CSS 4, shadcn/ui (Radix) |
| Database | PostgreSQL 16 (asyncpg driver) |
| Cache/Broker | Redis 7 |
| Task Queue | Celery 5.4 with Beat scheduler |
| Object Storage | MinIO (S3-compatible) |
| Auth | JWT (python-jose, bcrypt), RBAC, Keycloak (optional SSO) |
| State Mgmt | Zustand (auth), TanStack Query (server state) |
| Forms | React Hook Form + Zod validation |
| Containerization | Docker, docker-compose |

## Project Structure

```
erp/
├── backend/
│   └── app/
│       ├── main.py              # FastAPI entry point
│       ├── worker.py            # Celery config + beat schedule
│       ├── api/v1/endpoints/    # Domain routers (auth, crm, sales, purchase, inventory, projects, hr, documents, tickets, settings, utility)
│       ├── models/              # SQLAlchemy models (global, tenant, crm, sales, purchase, inventory, projects, hr, tickets, documents)
│       ├── schemas/             # Pydantic request/response schemas
│       ├── services/            # Business logic (crud.py, numbering.py)
│       ├── core/                # config, database, security, deps
│       ├── middleware/          # Custom middleware
│       └── utils/               # Utilities
│   ├── migrations/              # Alembic migrations
│   ├── seeds/                   # seed.py (countries, currencies, permissions)
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── start.sh                 # Container startup (migrate → seed → uvicorn)
│   └── Dockerfile
├── frontend/
│   └── src/
│       ├── app/                 # Next.js App Router
│       │   ├── (auth)/          # Login/register
│       │   └── (dashboard)/     # Protected routes by domain
│       ├── components/
│       │   ├── ui/              # 28+ shadcn/ui components
│       │   ├── layout/          # Layout components
│       │   └── shared/          # page-header, data-table, filter-bar, status-badge
│       ├── lib/                 # api.ts, api-helpers.ts, utils.ts
│       ├── providers/           # query-provider, theme-provider
│       └── stores/              # Zustand auth store
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   └── Dockerfile
├── docker-compose.yml           # All services orchestrated
└── cloudifyapps-erp.md          # Feature specification
```

## Common Commands

```bash
# Full stack via Docker
docker compose up                # Start all services
docker compose up -d             # Detached mode
docker compose down              # Stop all

# Backend (manual)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
alembic upgrade head             # Run migrations
python -m seeds.seed             # Seed initial data
celery -A app.worker worker --loglevel=info
celery -A app.worker beat --loglevel=info

# Frontend
npm run dev                      # Dev server on :3000
npm run build                    # Production build
npm run lint                     # ESLint
```

## Architecture Patterns

- **Multi-tenant**: All business models inherit `TenantMixin` (tenant_id, created_by, updated_by) + `TimestampMixin`
- **Async-first**: All DB operations use SQLAlchemy async sessions with asyncpg
- **Domain-driven routing**: One router per business domain in `api/v1/endpoints/`
- **Dependency injection**: FastAPI `Depends()` for auth, permissions, DB sessions
- **RBAC**: Permissions → Roles → UserRoles; checked via `require_permission()` dependency
- **API path convention**: `/api/v1/{domain}/{resource}`
- **Frontend data flow**: Axios client → JWT interceptor → FastAPI → tenant-scoped SQLAlchemy query → Pydantic response

## Code Conventions

### Backend (Python)
- PEP 8, full type hints on all functions
- Async/await for all DB operations
- Pydantic schemas for all request/response validation
- HTTPException for error responses
- Pydantic BaseSettings for configuration (env-based)
- Import order: stdlib → third-party → local

### Frontend (TypeScript/React)
- Strict TypeScript (`strict: true`)
- Functional components with hooks only
- Tailwind CSS utility classes (no CSS modules)
- shadcn/ui for UI primitives (Radix + Tailwind)
- React Hook Form + Zod for form validation
- Axios with centralized interceptor in `lib/api.ts`
- Path alias: `@/*` → `src/*`
- camelCase for files/variables, PascalCase for components
- Dark mode via CSS variables (OKLch color space) + next-themes

## Environment Variables

### Backend
```
DATABASE_URL=postgresql+asyncpg://erp_user:erp_password@postgres:5432/erp_db
DATABASE_URL_SYNC=postgresql://erp_user:erp_password@postgres:5432/erp_db
REDIS_URL=redis://redis:6379/0
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
SECRET_KEY=<random-secret>
CORS_ORIGINS=["http://localhost:3000"]
DEBUG=true
```

### Frontend
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_APP_NAME=Cloudifyapps ERP
```

## Services (docker-compose)

| Service | Port | Notes |
|---------|------|-------|
| PostgreSQL | 5432 | erp_user/erp_password, db: erp_db |
| Redis | 6379 | Cache + Celery broker |
| MinIO | 9000, 9001 | Object storage (minioadmin/minioadmin) |
| Keycloak | 8080 | Optional SSO (admin/admin) |
| Backend | 8000 | FastAPI, Swagger at /api/docs |
| Frontend | 3000 | Next.js App Router |
| Celery Worker | — | Background task processing |
| Celery Beat | — | Scheduled tasks |

## Key Files

- **Backend entry**: `backend/app/main.py`
- **Backend config**: `backend/app/core/config.py`
- **DB setup**: `backend/app/core/database.py`
- **Auth/security**: `backend/app/core/security.py`
- **Permission deps**: `backend/app/core/deps.py`
- **Frontend entry**: `frontend/src/app/layout.tsx`
- **API client**: `frontend/src/lib/api.ts`
- **Auth store**: `frontend/src/stores/auth.ts`
- **Feature spec**: `cloudifyapps-erp.md`

## Domain Modules

- **CRM**: Leads, Contacts, Customers, Opportunities, Activities
- **Sales**: Quotations, Sales Orders, Deliveries, Invoices
- **Purchase**: Vendors, Purchase Orders, Goods Receipts, Purchase Requests
- **Inventory**: Products, Warehouses, Stock Movements, Adjustments, Transfers
- **Projects**: Projects, Tasks, Milestones, Time Logs
- **HR**: Employees, Departments, Attendance, Leave, Payroll, Performance, Expenses
- **Tickets**: Support/issue tracking
- **Documents**: File management via MinIO

## Notes

- No test suite configured yet — no pytest or Jest/Vitest installed
- No CI/CD pipeline configured
- API docs available at `http://localhost:8000/api/docs` (Swagger) and `/api/redoc`
- Frontend uses Next.js 16 — see `frontend/AGENTS.md` for breaking change warnings
