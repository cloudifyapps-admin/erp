from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.endpoints import auth, crm, crm_analytics, dashboard, sales, purchase, inventory, projects, project_finance, project_analytics, project_risk, hr, documents, tickets, settings as settings_router, utility

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers under /api prefix
api_prefix = "/api"
app.include_router(auth.router, prefix=api_prefix)
app.include_router(crm.router, prefix=api_prefix)
app.include_router(crm_analytics.router, prefix=api_prefix)
app.include_router(dashboard.router, prefix=api_prefix)
app.include_router(sales.router, prefix=api_prefix)
app.include_router(purchase.router, prefix=api_prefix)
app.include_router(inventory.router, prefix=api_prefix)
app.include_router(projects.router, prefix=api_prefix)
app.include_router(project_finance.router, prefix=api_prefix)
app.include_router(project_analytics.router, prefix=api_prefix)
app.include_router(project_risk.router, prefix=api_prefix)
app.include_router(hr.router, prefix=api_prefix)
app.include_router(documents.router, prefix=api_prefix)
app.include_router(tickets.router, prefix=api_prefix)
app.include_router(settings_router.router, prefix=api_prefix)
app.include_router(utility.router, prefix=api_prefix)


@app.get("/api/health")
async def health():
    return {"status": "healthy", "version": settings.APP_VERSION}
